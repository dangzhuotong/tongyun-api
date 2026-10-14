use std::sync::{Arc, Mutex};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tauri::{AppHandle, Emitter};

pub fn start_bridge_server(app: AppHandle, port: u16) {
    let state = Arc::new(Mutex::new(serde_json::json!({
        "status": "ready",
        "app": "tongyun-api",
        "version": "0.1.0",
        "active_request": null,
        "last_response": null,
        "test_results": null,
        "telemetry": null,
        "human_feedback": null,
        "updated_at": 0
    })));

    tauri::async_runtime::spawn(async move {
        let addr = format!("127.0.0.1:{}", port);
        let listener = match TcpListener::bind(&addr).await {
            Ok(l) => {
                println!("🤖 [Tongyun AI Bridge] 正在监听: http://{}", addr);
                l
            }
            Err(e) => {
                eprintln!("⚠️ [Tongyun AI Bridge] 绑定端口 {} 失败: {}", port, e);
                return;
            }
        };

        loop {
            let (mut socket, _) = match listener.accept().await {
                Ok(s) => s,
                Err(_) => continue,
            };
            let app_clone = app.clone();
            let state_clone = state.clone();

            tokio::spawn(async move {
                let mut buf = vec![0u8; 65536];
                let n = match socket.read(&mut buf).await {
                    Ok(n) if n > 0 => n,
                    _ => return,
                };

                let request_str = String::from_utf8_lossy(&buf[..n]);
                let (head, body) = match request_str.split_once("\r\n\r\n") {
                    Some((h, b)) => (h, b),
                    None => (request_str.as_ref(), ""),
                };

                let first_line = head.lines().next().unwrap_or("");
                let parts: Vec<&str> = first_line.split_whitespace().collect();
                if parts.len() < 2 {
                    return;
                }

                let method = parts[0];
                let path = parts[1];

                if method == "OPTIONS" {
                    let resp = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Authorization\r\nContent-Length: 0\r\n\r\n";
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return;
                }

                let cors_headers = "Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Authorization\r\nContent-Type: application/json; charset=utf-8\r\n";

                // 1. 状态检查
                if path == "/api/status" || path == "/" {
                    let payload = r#"{"status":"ready","app":"tongyun-api","version":"0.1.0","message":"AI Skill Bridge 运行就绪","endpoints":["/api/status","/api/state","/api/push","/api/send","/api/run-cases","/api/telemetry","/api/thought","/api/feedback","/api/sync"]}"#;
                    let resp = format!("HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, payload.len(), payload);
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return;
                }

                // 2. 获取当前客户端状态 (激活接口、最后响应、断言用例)
                if path == "/api/state" || path == "/api/last-response" {
                    let current_state = {
                        let lock = state_clone.lock().unwrap();
                        lock.clone()
                    };
                    let payload = serde_json::to_string(&current_state).unwrap_or_else(|_| "{}".to_string());
                    let resp = format!("HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, payload.len(), payload);
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return;
                }

                // 3. UI 向 Bridge 同步状态
                if (path == "/api/sync" || path == "/api/state") && method == "POST" {
                    if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(body) {
                        {
                            let mut lock = state_clone.lock().unwrap();
                            if let Some(obj) = lock.as_object_mut() {
                                if let Some(req) = json_val.get("active_request") {
                                    obj.insert("active_request".to_string(), req.clone());
                                }
                                if let Some(resp) = json_val.get("last_response") {
                                    obj.insert("last_response".to_string(), resp.clone());
                                }
                                if let Some(tests) = json_val.get("test_results") {
                                    obj.insert("test_results".to_string(), tests.clone());
                                }
                                if let Some(feedback) = json_val.get("human_feedback") {
                                    obj.insert("human_feedback".to_string(), feedback.clone());
                                }
                                obj.insert("updated_at".to_string(), serde_json::json!(chrono::Utc::now().timestamp_millis()));
                            }
                        }
                        let payload = r#"{"ok":true,"message":"状态已同步到 Bridge"}"#;
                        let resp = format!("HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, payload.len(), payload);
                        let _ = socket.write_all(resp.as_bytes()).await;
                        return;
                    }
                }

                // 4. 推送接口与用例集到 UI
                if (path == "/api/push" || path == "/api/open-request" || path == "/api/push-request" || path == "/api/push-cases") && method == "POST" {
                    if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(body) {
                        let _ = app_clone.emit("ai-bridge-push", &json_val);
                        {
                            let mut lock = state_clone.lock().unwrap();
                            if let Some(obj) = lock.as_object_mut() {
                                obj.insert("last_pushed".to_string(), json_val.clone());
                            }
                        }
                        let payload = r#"{"ok":true,"message":"接口及用例数据已成功推送到桌面 UI 标签页"}"#;
                        let resp = format!("HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, payload.len(), payload);
                        let _ = socket.write_all(resp.as_bytes()).await;
                        return;
                    }
                }

                // 5. 触发发送
                if path == "/api/send" && method == "POST" {
                    let json_val = serde_json::from_str::<serde_json::Value>(body).unwrap_or(serde_json::json!({}));
                    let _ = app_clone.emit("ai-bridge-send", &json_val);
                    let payload = r#"{"ok":true,"message":"已触发桌面 UI 执行发送"}"#;
                    let resp = format!("HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, payload.len(), payload);
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return;
                }

                // 6. 触发批量执行用例
                if path == "/api/run-cases" && method == "POST" {
                    let json_val = serde_json::from_str::<serde_json::Value>(body).unwrap_or(serde_json::json!({}));
                    let _ = app_clone.emit("ai-bridge-run-cases", &json_val);
                    let payload = r#"{"ok":true,"message":"已触发桌面 UI 执行用例集"}"#;
                    let resp = format!("HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, payload.len(), payload);
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return;
                }

                // 7. 投屏 Agent 思考过程与态势 (Telemetry / Thought)
                if (path == "/api/telemetry" || path == "/api/thought") && method == "POST" {
                    if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(body) {
                        let _ = app_clone.emit("ai-bridge-telemetry", &json_val);
                        {
                            let mut lock = state_clone.lock().unwrap();
                            if let Some(obj) = lock.as_object_mut() {
                                obj.insert("telemetry".to_string(), json_val.clone());
                                obj.insert("updated_at".to_string(), serde_json::json!(chrono::Utc::now().timestamp_millis()));
                            }
                        }
                        let payload = r#"{"ok":true,"message":"Agent 思考过程与态势已实时投屏至桌面 HUD"}"#;
                        let resp = format!("HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, payload.len(), payload);
                        let _ = socket.write_all(resp.as_bytes()).await;
                        return;
                    }
                }

                // 8. 人类反馈通道 (Human-in-the-Loop Feedback: 供 Agent 读取人类在 UI 上给出的裁决/指令)
                if path == "/api/feedback" && method == "GET" {
                    let feedback_val = {
                        let lock = state_clone.lock().unwrap();
                        lock.get("human_feedback").cloned().unwrap_or(serde_json::Value::Null)
                    };
                    let payload = serde_json::to_string(&serde_json::json!({
                        "ok": true,
                        "feedback": feedback_val
                    })).unwrap_or_else(|_| "{}".to_string());
                    let resp = format!("HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, payload.len(), payload);
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return;
                }

                if path == "/api/feedback" && method == "POST" {
                    if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(body) {
                        {
                            let mut lock = state_clone.lock().unwrap();
                            if let Some(obj) = lock.as_object_mut() {
                                obj.insert("human_feedback".to_string(), json_val.clone());
                                obj.insert("updated_at".to_string(), serde_json::json!(chrono::Utc::now().timestamp_millis()));
                            }
                        }
                        let payload = r#"{"ok":true,"message":"人类反馈已保存到 Bridge"}"#;
                        let resp = format!("HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, payload.len(), payload);
                        let _ = socket.write_all(resp.as_bytes()).await;
                        return;
                    }
                }

                let not_found = r#"{"error":"Not Found","endpoints":["/api/status", "/api/state", "/api/push", "/api/send", "/api/run-cases", "/api/telemetry", "/api/thought", "/api/feedback", "/api/sync"]}"#;
                let resp = format!("HTTP/1.1 404 Not Found\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, not_found.len(), not_found);
                let _ = socket.write_all(resp.as_bytes()).await;
            });
        }
    });
}
