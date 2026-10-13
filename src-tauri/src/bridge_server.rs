use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tauri::{AppHandle, Emitter};

pub fn start_bridge_server(app: AppHandle, port: u16) {
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

                if path == "/api/status" || path == "/" {
                    let payload = r#"{"status":"ready","app":"tongyun-api","version":"0.1.0","message":"AI Skill Bridge 运行就绪"}"#;
                    let resp = format!("HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, payload.len(), payload);
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return;
                }

                if (path == "/api/push" || path == "/api/open-request" || path == "/api/push-request") && method == "POST" {
                    if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(body) {
                        let _ = app_clone.emit("ai-bridge-push", &json_val);
                        let payload = r#"{"ok":true,"message":"接口数据已成功推送到桌面 UI 标签页"}"#;
                        let resp = format!("HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, payload.len(), payload);
                        let _ = socket.write_all(resp.as_bytes()).await;
                        return;
                    }
                }

                if path == "/api/send" && method == "POST" {
                    let json_val = serde_json::from_str::<serde_json::Value>(body).unwrap_or(serde_json::json!({}));
                    let _ = app_clone.emit("ai-bridge-send", &json_val);
                    let payload = r#"{"ok":true,"message":"已触发桌面 UI 执行发送"}"#;
                    let resp = format!("HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, payload.len(), payload);
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return;
                }

                let not_found = r#"{"error":"Not Found","endpoints":["/api/status", "/api/push", "/api/send"]}"#;
                let resp = format!("HTTP/1.1 404 Not Found\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, not_found.len(), not_found);
                let _ = socket.write_all(resp.as_bytes()).await;
            });
        }
    });
}
