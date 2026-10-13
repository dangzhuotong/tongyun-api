use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KeyValueItem {
    pub key: String,
    pub value: String,
    pub enabled: bool,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequestAuth {
    pub auth_type: String, // "none" | "bearer" | "basic" | "apikey"
    pub token: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub api_key_name: Option<String>,
    pub api_key_value: Option<String>,
    pub api_key_in: Option<String>, // "header" | "query"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FormDataItem {
    pub id: String,
    pub key: String,
    pub value: String,
    #[serde(rename = "type")]
    pub item_type: String, // "text" | "file"
    pub file_name: Option<String>,
    pub file_path: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequestBody {
    pub body_type: String, // "none" | "json" | "raw" | "form-urlencoded" | "form-data"
    pub content: String,
    pub form_data: Option<Vec<FormDataItem>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequestData {
    pub id: String,
    pub name: String,
    pub method: String,
    pub url: String,
    pub headers: Vec<KeyValueItem>,
    pub params: Vec<KeyValueItem>,
    pub body: RequestBody,
    pub auth: RequestAuth,
    pub redirect_policy: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequestExecutePayload {
    pub method: String,
    pub url: String,
    pub headers: Vec<KeyValueItem>,
    pub params: Vec<KeyValueItem>,
    pub body: RequestBody,
    pub auth: RequestAuth,
    pub timeout_ms: Option<u64>,
    pub redirect_policy: Option<String>, // "safe" | "follow" | "manual"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResponsePayload {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<KeyValueItem>,
    pub body: String,
    pub time_ms: u64,
    pub size_bytes: usize,
    pub is_json: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileTreeNode {
    pub id: String,
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub method: Option<String>,
    pub children: Option<Vec<FileTreeNode>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnvironmentVariable {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnvironmentData {
    pub id: String,
    pub name: String,
    pub variables: Vec<EnvironmentVariable>,
}

fn get_default_workspace() -> PathBuf {
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("tongyun-collections")
}

#[tauri::command]
fn get_workspace_path(custom_path: Option<String>) -> Result<String, String> {
    let p = match custom_path {
        Some(cp) if !cp.trim().is_empty() => PathBuf::from(cp),
        _ => get_default_workspace(),
    };
    if !p.exists() {
        fs::create_dir_all(&p).map_err(|e| format!("无法创建工作区目录: {}", e))?;
    }
    Ok(p.to_string_lossy().to_string())
}

#[tauri::command]
async fn execute_http_request(payload: RequestExecutePayload) -> Result<ResponsePayload, String> {
    let redirect_policy = match payload.redirect_policy.as_deref() {
        Some("manual") => reqwest::redirect::Policy::none(),
        Some("follow") => reqwest::redirect::Policy::limited(10),
        _ => reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 10 {
                return attempt.error("重定向次数过多");
            }
            let Some(previous) = attempt.previous().last() else {
                return attempt.follow();
            };
            let next = attempt.url();
            if previous.scheme() == next.scheme()
                && previous.host_str() == next.host_str()
                && previous.port_or_known_default() == next.port_or_known_default()
            {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }),
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(payload.timeout_ms.unwrap_or(30000)))
        .redirect(redirect_policy)
        .build()
        .map_err(|e| format!("构建 HTTP 客户端失败: {}", e))?;

    let method = match payload.method.to_uppercase().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "PATCH" => reqwest::Method::PATCH,
        "HEAD" => reqwest::Method::HEAD,
        "OPTIONS" => reqwest::Method::OPTIONS,
        other => reqwest::Method::from_bytes(other.as_bytes()).map_err(|_| format!("未知 HTTP 方法: {}", other))?,
    };

    // 构建 URL 与 Query 参数
    let mut url = match reqwest::Url::parse(&payload.url) {
        Ok(u) => u,
        Err(e) => {
            let fallback = format!("http://{}", payload.url);
            reqwest::Url::parse(&fallback).map_err(|_| format!("无效的请求 URL: {}", e))?
        }
    };

    {
        let mut query_pairs = url.query_pairs_mut();
        for param in payload.params.iter().filter(|p| p.enabled && !p.key.trim().is_empty()) {
            query_pairs.append_pair(&param.key, &param.value);
        }
    }

    let mut req_builder = client.request(method, url);

    // 添加请求头
    for header in payload.headers.iter().filter(|h| h.enabled && !h.key.trim().is_empty()) {
        req_builder = req_builder.header(&header.key, &header.value);
    }

    // 鉴权配置
    match payload.auth.auth_type.as_str() {
        "bearer" => {
            if let Some(token) = payload.auth.token.filter(|t| !t.trim().is_empty()) {
                req_builder = req_builder.bearer_auth(token);
            }
        }
        "basic" => {
            if let Some(user) = payload.auth.username {
                req_builder = req_builder.basic_auth(user, payload.auth.password);
            }
        }
        "apikey" => {
            if let (Some(k), Some(v)) = (payload.auth.api_key_name, payload.auth.api_key_value) {
                if !k.trim().is_empty() {
                    if payload.auth.api_key_in.as_deref() == Some("query") {
                        let mut current_url = req_builder.try_clone().and_then(|r| r.build().ok()).map(|r| r.url().clone()).unwrap_or_else(|| reqwest::Url::parse(&payload.url).unwrap());
                        current_url.query_pairs_mut().append_pair(&k, &v);
                        req_builder = client.request(reqwest::Method::from_bytes(payload.method.as_bytes()).unwrap(), current_url);
                    } else {
                        req_builder = req_builder.header(&k, &v);
                    }
                }
            }
        }
        _ => {}
    }

    // 添加请求体
    match payload.body.body_type.as_str() {
        "json" => {
            if !payload.body.content.trim().is_empty() {
                req_builder = req_builder
                    .header("Content-Type", "application/json")
                    .body(payload.body.content);
            }
        }
        "raw" => {
            if !payload.body.content.is_empty() {
                req_builder = req_builder.body(payload.body.content);
            }
        }
        "form-urlencoded" => {
            req_builder = req_builder
                .header("Content-Type", "application/x-www-form-urlencoded")
                .body(payload.body.content);
        }
        "form-data" => {
            if let Some(items) = &payload.body.form_data {
                let mut form = reqwest::multipart::Form::new();
                for item in items.iter().filter(|i| i.enabled && !i.key.trim().is_empty()) {
                    if item.item_type == "file" {
                        if let Some(path_str) = &item.file_path {
                            let p = std::path::Path::new(path_str);
                            if p.exists() {
                                if let Ok(bytes) = std::fs::read(p) {
                                    let filename = item.file_name.clone().unwrap_or_else(|| {
                                        p.file_name().unwrap_or_default().to_string_lossy().to_string()
                                    });
                                    let part = reqwest::multipart::Part::bytes(bytes).file_name(filename);
                                    form = form.part(item.key.clone(), part);
                                    continue;
                                }
                            }
                        }
                    }
                    form = form.text(item.key.clone(), item.value.clone());
                }
                req_builder = req_builder.multipart(form);
            }
        }
        _ => {}
    }

    let start_time = Instant::now();
    let res = req_builder.send().await.map_err(|e| format!("请求发送失败: {}", e))?;
    let duration = start_time.elapsed();

    let status = res.status().as_u16();
    let status_text = res.status().canonical_reason().unwrap_or("Unknown").to_string();

    let mut resp_headers = Vec::new();
    let mut is_json = false;
    for (k, v) in res.headers().iter() {
        let key_str = k.as_str().to_string();
        let val_str = v.to_str().unwrap_or("").to_string();
        if key_str.to_lowercase() == "content-type" && val_str.contains("application/json") {
            is_json = true;
        }
        resp_headers.push(KeyValueItem {
            key: key_str,
            value: val_str,
            enabled: true,
            description: None,
        });
    }

    let body_bytes = res.bytes().await.map_err(|e| format!("读取响应内容失败: {}", e))?;
    let size_bytes = body_bytes.len();
    let body_str = String::from_utf8_lossy(&body_bytes).to_string();

    if !is_json && (body_str.trim().starts_with('{') || body_str.trim().starts_with('[')) {
        if serde_json::from_str::<serde_json::Value>(&body_str).is_ok() {
            is_json = true;
        }
    }

    Ok(ResponsePayload {
        status,
        status_text,
        headers: resp_headers,
        body: body_str,
        time_ms: duration.as_millis() as u64,
        size_bytes,
        is_json,
    })
}

fn scan_dir_recursive(dir_path: &Path) -> Vec<FileTreeNode> {
    let mut nodes = Vec::new();
    if let Ok(entries) = fs::read_dir(dir_path) {
        let mut sorted_entries: Vec<_> = entries.flatten().collect();
        sorted_entries.sort_by_key(|e| (e.file_type().map(|t| !t.is_dir()).unwrap_or(true), e.file_name()));

        for entry in sorted_entries {
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();

            if file_name.starts_with('.') || file_name == "environments" {
                continue;
            }

            if path.is_dir() {
                let children = scan_dir_recursive(&path);
                nodes.push(FileTreeNode {
                    id: path.to_string_lossy().to_string(),
                    name: file_name,
                    path: path.to_string_lossy().to_string(),
                    is_dir: true,
                    method: None,
                    children: Some(children),
                });
            } else if file_name.ends_with(".json") || file_name.ends_with(".http") {
                let mut method = None;
                if file_name.ends_with(".json") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                            if let Some(m) = parsed.get("method").and_then(|v| v.as_str()) {
                                method = Some(m.to_string());
                            }
                        }
                    }
                }
                nodes.push(FileTreeNode {
                    id: path.to_string_lossy().to_string(),
                    name: file_name.trim_end_matches(".json").trim_end_matches(".http").to_string(),
                    path: path.to_string_lossy().to_string(),
                    is_dir: false,
                    method,
                    children: None,
                });
            }
        }
    }
    nodes
}

#[tauri::command]
fn load_file_tree(workspace_path: Option<String>) -> Result<Vec<FileTreeNode>, String> {
    let ws = match workspace_path {
        Some(p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => get_default_workspace(),
    };
    if !ws.exists() {
        fs::create_dir_all(&ws).map_err(|e| format!("创建工作区失败: {}", e))?;
    }
    Ok(scan_dir_recursive(&ws))
}

#[tauri::command]
fn read_request_file(file_path: String) -> Result<RequestData, String> {
    let content = fs::read_to_string(&file_path).map_err(|e| format!("读取文件失败: {}", e))?;
    if let Ok(data) = serde_json::from_str::<RequestData>(&content) {
        return Ok(data);
    }

    // 尝试解析纯文本 IntelliJ .http / .rest 格式
    let mut method = "GET".to_string();
    let mut url = "https://httpbin.org/get".to_string();
    let mut headers = Vec::new();
    let mut body = String::new();
    let mut is_body = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if !is_body {
            if trimmed.starts_with("###") || trimmed.starts_with("#") || trimmed.starts_with("//") {
                continue;
            }
            if trimmed.is_empty() {
                is_body = true;
                continue;
            }
            if trimmed.starts_with("GET ")
                || trimmed.starts_with("POST ")
                || trimmed.starts_with("PUT ")
                || trimmed.starts_with("DELETE ")
                || trimmed.starts_with("PATCH ")
                || trimmed.starts_with("HEAD ")
                || trimmed.starts_with("OPTIONS ")
            {
                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                if parts.len() >= 2 {
                    method = parts[0].to_string();
                    url = parts[1].to_string();
                }
            } else if trimmed.contains(':') && !trimmed.starts_with("http") {
                let parts: Vec<&str> = trimmed.splitn(2, ':').collect();
                headers.push(KeyValueItem {
                    key: parts[0].trim().to_string(),
                    value: parts[1].trim().to_string(),
                    enabled: true,
                    description: None,
                });
            }
        } else {
            body.push_str(line);
            body.push('\n');
        }
    }

    let file_name = Path::new(&file_path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "HTTP用例".to_string());

    let body_trimmed = body.trim();
    let body_type = if body_trimmed.starts_with('{') || body_trimmed.starts_with('[') {
        "json".to_string()
    } else if !body_trimmed.is_empty() {
        "raw".to_string()
    } else {
        "none".to_string()
    };

    Ok(RequestData {
        id: format!("http_{}", chrono::Utc::now().timestamp_millis()),
        name: file_name,
        method,
        url,
        headers,
        params: vec![],
        body: RequestBody {
            body_type,
            content: body_trimmed.to_string(),
            form_data: None,
        },
        auth: RequestAuth {
            auth_type: "none".to_string(),
            token: None,
            username: None,
            password: None,
            api_key_name: None,
            api_key_value: None,
            api_key_in: None,
        },
        redirect_policy: None,
        description: Some("源自 .http 纯文本规范文件".to_string()),
    })
}

#[tauri::command]
fn save_request_file(file_path: String, data: RequestData) -> Result<(), String> {
    if let Some(parent) = Path::new(&file_path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建父目录失败: {}", e))?;
    }

    if file_path.ends_with(".http") || file_path.ends_with(".rest") {
        let mut text = format!("### {}\n", data.name);
        text.push_str(&format!("{} {}\n", data.method, data.url));
        for h in &data.headers {
            if h.enabled && !h.key.trim().is_empty() {
                text.push_str(&format!("{}: {}\n", h.key, h.value));
            }
        }
        if data.body.body_type != "none" && !data.body.content.trim().is_empty() {
            text.push('\n');
            text.push_str(data.body.content.trim());
            text.push('\n');
        }
        fs::write(&file_path, text).map_err(|e| format!("写入文件失败: {}", e))?;
        return Ok(());
    }

    let formatted = serde_json::to_string_pretty(&data).map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&file_path, formatted).map_err(|e| format!("写入文件失败: {}", e))?;
    Ok(())
}

#[tauri::command]
fn create_file_or_folder(
    parent_path: String,
    name: String,
    is_dir: bool,
    initial_data: Option<RequestData>,
) -> Result<String, String> {
    let parent = Path::new(&parent_path);
    if !parent.exists() {
        fs::create_dir_all(parent).map_err(|e| format!("父目录不存在且创建失败: {}", e))?;
    }

    if is_dir {
        let new_dir = parent.join(&name);
        fs::create_dir_all(&new_dir).map_err(|e| format!("创建文件夹失败: {}", e))?;
        Ok(new_dir.to_string_lossy().to_string())
    } else {
        let raw_name = name.clone();
        let file_name = if name.ends_with(".json") { name } else { format!("{}.json", name) };
        let new_file = parent.join(file_name);
        let data = initial_data.unwrap_or_else(|| RequestData {
            id: format!("req_{}", chrono::Utc::now().timestamp_millis()),
            name: raw_name.replace(".json", ""),
            method: "GET".to_string(),
            url: "https://httpbin.org/get".to_string(),
            headers: vec![
                KeyValueItem {
                    key: "Accept".to_string(),
                    value: "application/json".to_string(),
                    enabled: true,
                    description: Some("期望响应格式".to_string()),
                }
            ],
            params: vec![],
            body: RequestBody {
                body_type: "none".to_string(),
                content: String::new(),
                form_data: None,
            },
            auth: RequestAuth {
                auth_type: "none".to_string(),
                token: None,
                username: None,
                password: None,
                api_key_name: None,
                api_key_value: None,
                api_key_in: None,
            },
            redirect_policy: None,
            description: Some("新建请求".to_string()),
        });
        let formatted = serde_json::to_string_pretty(&data).map_err(|e| format!("序列化失败: {}", e))?;
        fs::write(&new_file, formatted).map_err(|e| format!("写入新请求失败: {}", e))?;
        Ok(new_file.to_string_lossy().to_string())
    }
}

#[tauri::command]
fn delete_file_or_folder(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Ok(());
    }
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| format!("删除文件夹失败: {}", e))?;
    } else {
        fs::remove_file(p).map_err(|e| format!("删除文件失败: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn rename_file_or_folder(old_path: String, new_name: String) -> Result<String, String> {
    let old_p = Path::new(&old_path);
    if !old_p.exists() {
        return Err("原路径不存在".to_string());
    }
    let parent = old_p.parent().ok_or("找不到父目录")?;
    let new_file_name = if old_p.is_file() && !new_name.ends_with(".json") {
        format!("{}.json", new_name)
    } else {
        new_name
    };
    let new_p = parent.join(new_file_name);
    fs::rename(old_p, &new_p).map_err(|e| format!("重命名失败: {}", e))?;
    Ok(new_p.to_string_lossy().to_string())
}

#[tauri::command]
fn load_environments(workspace_path: Option<String>) -> Result<Vec<EnvironmentData>, String> {
    let ws = match workspace_path {
        Some(p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => get_default_workspace(),
    };
    let env_dir = ws.join("environments");
    if !env_dir.exists() {
        fs::create_dir_all(&env_dir).map_err(|e| format!("创建环境变量目录失败: {}", e))?;
    }

    let mut list = Vec::new();
    if let Ok(entries) = fs::read_dir(&env_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() && p.extension().map(|e| e == "json").unwrap_or(false) {
                if let Ok(c) = fs::read_to_string(&p) {
                    if let Ok(data) = serde_json::from_str::<EnvironmentData>(&c) {
                        list.push(data);
                    }
                }
            }
        }
    }
    Ok(list)
}

#[tauri::command]
fn save_environment(workspace_path: Option<String>, env: EnvironmentData) -> Result<(), String> {
    let ws = match workspace_path {
        Some(p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => get_default_workspace(),
    };
    let env_dir = ws.join("environments");
    if !env_dir.exists() {
        fs::create_dir_all(&env_dir).map_err(|e| format!("创建环境变量目录失败: {}", e))?;
    }
    let file_name = format!("{}.json", env.id);
    let target = env_dir.join(file_name);
    let content = serde_json::to_string_pretty(&env).map_err(|e| format!("序列化环境变量失败: {}", e))?;
    fs::write(target, content).map_err(|e| format!("保存环境变量文件失败: {}", e))?;
    Ok(())
}

#[tauri::command]
fn delete_environment(workspace_path: Option<String>, env_id: String) -> Result<(), String> {
    let ws = match workspace_path {
        Some(p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => get_default_workspace(),
    };
    let target = ws.join("environments").join(format!("{}.json", env_id));
    if target.exists() {
        fs::remove_file(target).map_err(|e| format!("删除环境变量文件失败: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn init_sample_workspace(workspace_path: Option<String>) -> Result<String, String> {
    let ws = match workspace_path {
        Some(p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => get_default_workspace(),
    };
    if !ws.exists() {
        fs::create_dir_all(&ws).map_err(|e| format!("初始化目录失败: {}", e))?;
    }

    let env_dir = ws.join("environments");
    fs::create_dir_all(&env_dir).map_err(|e| format!("创建环境目录失败: {}", e))?;
    let dev_env = EnvironmentData {
        id: "development".to_string(),
        name: "本地开发环境".to_string(),
        variables: vec![
            EnvironmentVariable {
                key: "baseUrl".to_string(),
                value: "https://httpbin.org".to_string(),
                enabled: true,
            },
            EnvironmentVariable {
                key: "apiToken".to_string(),
                value: "ty_token_dev_8899".to_string(),
                enabled: true,
            },
            EnvironmentVariable {
                key: "userId".to_string(),
                value: "1001".to_string(),
                enabled: true,
            },
        ],
    };
    let dev_env_path = env_dir.join("development.json");
    if !dev_env_path.exists() {
        let _ = fs::write(&dev_env_path, serde_json::to_string_pretty(&dev_env).unwrap());
    }

    let dir1 = ws.join("01-基础HTTP");
    fs::create_dir_all(&dir1).ok();

    let req1 = RequestData {
        id: "sample_get".to_string(),
        name: "GET测试 (Query参数)".to_string(),
        method: "GET".to_string(),
        url: "{{baseUrl}}/get".to_string(),
        headers: vec![
            KeyValueItem {
                key: "Accept".to_string(),
                value: "application/json".to_string(),
                enabled: true,
                description: Some("接收JSON响应".to_string()),
            },
            KeyValueItem {
                key: "User-Agent".to_string(),
                value: "TongyunAPI/1.0".to_string(),
                enabled: true,
                description: None,
            },
        ],
        params: vec![
            KeyValueItem {
                key: "userId".to_string(),
                value: "{{userId}}".to_string(),
                enabled: true,
                description: Some("当前测试用户ID".to_string()),
            },
            KeyValueItem {
                key: "lang".to_string(),
                value: "zh-CN".to_string(),
                enabled: true,
                description: None,
            },
        ],
        body: RequestBody {
            body_type: "none".to_string(),
            content: String::new(),
            form_data: None,
        },
        auth: RequestAuth {
            auth_type: "bearer".to_string(),
            token: Some("{{apiToken}}".to_string()),
            username: None,
            password: None,
            api_key_name: None,
            api_key_value: None,
            api_key_in: None,
        },
        redirect_policy: None,
        description: Some("演示带环境变量、Query 参数与 Bearer Token 的 GET 请求".to_string()),
    };
    let req1_path = dir1.join("GET测试 (Query参数).json");
    if !req1_path.exists() {
        let _ = fs::write(req1_path, serde_json::to_string_pretty(&req1).unwrap());
    }

    let req2 = RequestData {
        id: "sample_post_json".to_string(),
        name: "POST测试 (JSON Body)".to_string(),
        method: "POST".to_string(),
        url: "{{baseUrl}}/post".to_string(),
        headers: vec![
            KeyValueItem {
                key: "Content-Type".to_string(),
                value: "application/json".to_string(),
                enabled: true,
                description: None,
            },
        ],
        params: vec![],
        body: RequestBody {
            body_type: "json".to_string(),
            content: "{\n  \"appName\": \"tongyun-api\",\n  \"version\": \"0.1.0\",\n  \"features\": [\n    \"纯文本存储\",\n    \"Git友好\",\n    \"毫秒级响应测量\"\n  ]\n}".to_string(),
            form_data: None,
        },
        auth: RequestAuth {
            auth_type: "none".to_string(),
            token: None,
            username: None,
            password: None,
            api_key_name: None,
            api_key_value: None,
            api_key_in: None,
        },
        redirect_policy: None,
        description: Some("演示 POST 请求体发送与格式化".to_string()),
    };
    let req2_path = dir1.join("POST测试 (JSON Body).json");
    if !req2_path.exists() {
        let _ = fs::write(req2_path, serde_json::to_string_pretty(&req2).unwrap());
    }

    let dir2 = ws.join("02-状态码与时延");
    fs::create_dir_all(&dir2).ok();
    let req3 = RequestData {
        id: "sample_delay".to_string(),
        name: "延迟响应测量 (Delay 1s)".to_string(),
        method: "GET".to_string(),
        url: "{{baseUrl}}/delay/1".to_string(),
        headers: vec![],
        params: vec![],
        body: RequestBody {
            body_type: "none".to_string(),
            content: String::new(),
            form_data: None,
        },
        auth: RequestAuth {
            auth_type: "none".to_string(),
            token: None,
            username: None,
            password: None,
            api_key_name: None,
            api_key_value: None,
            api_key_in: None,
        },
        redirect_policy: None,
        description: Some("测试耗时时延测量功能，验证进度条与耗时徽标".to_string()),
    };
    let req3_path = dir2.join("延迟响应测量 (Delay 1s).json");
    if !req3_path.exists() {
        let _ = fs::write(req3_path, serde_json::to_string_pretty(&req3).unwrap());
    }

    Ok(ws.to_string_lossy().to_string())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitStatusResult {
    pub is_git_repo: bool,
    pub branch: String,
    pub modified_files: Vec<String>,
}

#[tauri::command]
fn get_git_status(workspace_path: String) -> Result<GitStatusResult, String> {
    let ws_path = Path::new(&workspace_path);
    let repo_dir = if ws_path.file_name().and_then(|s| s.to_str()) == Some("tongyun-collections") {
        ws_path.parent().unwrap_or(ws_path)
    } else {
        ws_path
    };

    // 1. 获取当前 Git 分支
    let branch_out = std::process::Command::new("git")
        .args(&["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(repo_dir)
        .output();

    if let Ok(out) = branch_out {
        if out.status.success() {
            let branch = String::from_utf8_lossy(&out.stdout).trim().to_string();

            // 2. 检查针对 tongyun-collections 的未提交文件状态
            let status_out = std::process::Command::new("git")
                .args(&["status", "--porcelain", "tongyun-collections"])
                .current_dir(repo_dir)
                .output();

            let mut modified_files = Vec::new();
            if let Ok(s_out) = status_out {
                let status_str = String::from_utf8_lossy(&s_out.stdout);
                for line in status_str.lines() {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        modified_files.push(trimmed.to_string());
                    }
                }
            }

            return Ok(GitStatusResult {
                is_git_repo: true,
                branch,
                modified_files,
            });
        }
    }

    Ok(GitStatusResult {
        is_git_repo: false,
        branch: "非Git仓库".to_string(),
        modified_files: Vec::new(),
    })
}

#[tauri::command]
fn open_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

mod scan;
mod send;
mod bridge_server;

#[tauri::command]
fn scan_workspace(root: String) -> Result<scan::ScannedWorkspace, String> {
    scan::scan_workspace(PathBuf::from(root).as_path())
}

#[tauri::command]
fn examples_dir() -> Option<String> {
    let start = std::env::current_dir().ok()?;
    scan::find_examples_dir(&start).map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn send_http(request: send::OutgoingRequest) -> Result<send::HttpExchange, String> {
    tauri::async_runtime::spawn_blocking(move || send::execute(&request))
        .await
        .map_err(|err| format!("发送任务中断：{err}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            bridge_server::start_bridge_server(handle, 4171);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_workspace_path,
            execute_http_request,
            load_file_tree,
            read_request_file,
            save_request_file,
            create_file_or_folder,
            delete_file_or_folder,
            rename_file_or_folder,
            load_environments,
            save_environment,
            delete_environment,
            init_sample_workspace,
            get_git_status,
            open_in_explorer,
            scan_workspace,
            examples_dir,
            send_http
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
