use std::{sync::{Arc, Mutex}, time::Duration};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tauri::{AppHandle, Emitter, Manager};
use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct BridgeConfig { pub port: u16, pub token: String }
#[tauri::command]
pub fn bridge_config(config: tauri::State<'_, BridgeConfig>) -> BridgeConfig { config.inner().clone() }

fn allowed_origin(origin: &str) -> bool {
    matches!(origin, "tauri://localhost" | "http://tauri.localhost" | "https://tauri.localhost" | "http://localhost:1420" | "http://127.0.0.1:1420")
}
struct Request { method: String, path: String, body: String, origin: Option<String>, task: String }
async fn read_request(socket: &mut TcpStream, token: &str, port: u16) -> Result<Request, u16> {
    let mut buf=Vec::new();
    let end=loop {
        if let Some(i)=buf.windows(4).position(|w| w==b"\r\n\r\n") { break i; }
        if buf.len()>16384 { return Err(413); }
        let mut chunk=[0;1024]; let n=socket.read(&mut chunk).await.map_err(|_|400u16)?;
        if n==0 { return Err(400); } buf.extend_from_slice(&chunk[..n]);
    };
    if end>16384 { return Err(413); }
    let head=std::str::from_utf8(&buf[..end]).map_err(|_|400u16)?;
    let mut lines=head.split("\r\n"); let parts:Vec<_>=lines.next().unwrap_or("").split_whitespace().collect();
    if parts.len()!=3 || parts[2]!="HTTP/1.1" { return Err(400); }
    let method=parts[0].to_string(); let path=parts[1].to_string();
    let mut headers=std::collections::HashMap::new();
    for line in lines {
        let (key,value)=line.split_once(':').ok_or(400u16)?;
        if headers.insert(key.to_ascii_lowercase(),value.trim().to_string()).is_some() { return Err(400); }
    }
    if !matches!(headers.get("host"),Some(h) if h==&format!("127.0.0.1:{port}") || h==&format!("localhost:{port}")) { return Err(403); }
    let origin=headers.get("origin").cloned();
    if origin.as_deref().is_some_and(|o| !allowed_origin(o)) { return Err(403); }
    if method!="OPTIONS" && headers.get("authorization")!=Some(&format!("Bearer {token}")) { return Err(401); }
    if method=="OPTIONS" && origin.is_none() { return Err(403); }
    if headers.contains_key("transfer-encoding") { return Err(400); }
    let len=headers.get("content-length").map(|s|s.parse::<usize>()).transpose().map_err(|_|400u16)?.unwrap_or(0);
    if len>65536 { return Err(413); }
    while buf.len()<end+4+len {
        let mut chunk=[0;4096]; let n=socket.read(&mut chunk).await.map_err(|_|400u16)?;
        if n==0 { return Err(400); } buf.extend_from_slice(&chunk[..n]);
    }
    if buf.len()!=end+4+len { return Err(400); }
    let body=String::from_utf8(buf[end+4..].to_vec()).map_err(|_|400u16)?;
    if method=="POST" && !serde_json::from_str::<serde_json::Value>(&body).is_ok_and(|v|v.is_object()) { return Err(400); }
    if !matches!(method.as_str(),"GET"|"POST"|"OPTIONS") { return Err(405); }
    Ok(Request { method,path,body,origin,task:headers.get("x-tongyun-task").cloned().unwrap_or_else(||"bridge-session".into()) })
}
async fn reject(socket: &mut TcpStream, code:u16) {
    let body=format!("{{\"ok\":false,\"error\":\"BRIDGE_{code}\"}}");
    let _=socket.write_all(format!("HTTP/1.1 {code} Error\r\nContent-Type: application/json\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{}",body.len(),body).as_bytes()).await;
}
pub fn start_bridge_server(app: AppHandle, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    // Bind before rotating credentials: a second instance cannot invalidate the first.
    let listener=std::net::TcpListener::bind(("127.0.0.1",port))?;
    listener.set_nonblocking(true)?;
    let dir=app.path().app_config_dir()?;
    crate::audit::private_dir(&dir)?;
    let config=BridgeConfig { port, token:format!("{}{}",uuid::Uuid::new_v4().simple(),uuid::Uuid::new_v4().simple()) };
    let session=dir.join("bridge-session.json");
    match std::fs::remove_file(&session) { Ok(())=>{},Err(e) if e.kind()==std::io::ErrorKind::NotFound=>{},Err(e)=>return Err(e.into()) }
    crate::audit::private_write(&session,&serde_json::to_vec(&config)?)?;
    app.manage(config.clone());
    let journal=dir.join("audit");
    let state=Arc::new(Mutex::new(serde_json::json!({"status":"ready","app":"tongyun-api","version":"0.1.0"})));
    tauri::async_runtime::spawn(async move {
        let listener=TcpListener::from_std(listener).expect("nonblocking listener");
        let permits=Arc::new(tokio::sync::Semaphore::new(32));
        loop {
            let Ok((socket,_))=listener.accept().await else { continue; };
            let Ok(permit)=permits.clone().try_acquire_owned() else { continue; };
            let app=app.clone(); let state_clone=state.clone(); let config=config.clone(); let journal=journal.clone();
            tokio::spawn(async move {
                let _permit=permit;
                serve_connection(socket,config,state_clone,journal,move |event,value|app.emit(event,value).map_err(|_|())).await;

            });
        }
    });
    Ok(())
}

async fn serve_connection(mut socket:TcpStream,config:BridgeConfig,state_clone:Arc<Mutex<serde_json::Value>>,journal:std::path::PathBuf,emit:impl Fn(&str,&serde_json::Value)->Result<(),()>) {
    let port=config.port;
                let request=match tokio::time::timeout(Duration::from_secs(3),read_request(&mut socket,&config.token,port)).await {
                    Ok(Ok(req))=>req,Ok(Err(code))=>{reject(&mut socket,code).await;return;},Err(_)=>{reject(&mut socket,408).await;return;}
                };
                let Request{method,path,body,origin,task}=request;
                let cors=origin.map(|o|format!("Access-Control-Allow-Origin: {o}\r\nVary: Origin\r\n")).unwrap_or_default();
                let cors_headers=format!("{cors}Access-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Authorization, X-Tongyun-Task\r\nContent-Type: application/json; charset=utf-8\r\nConnection: close\r\n");
                if method=="OPTIONS" { let _=socket.write_all(format!("HTTP/1.1 204 No Content\r\n{cors_headers}Content-Length: 0\r\n\r\n").as_bytes()).await; return; }
                let op=match crate::audit::Operation::begin(&journal,"api",&format!("bridge:{path}"),"desktop","agent:bridge",&task) {Ok(op)=>op,Err(_)=>{reject(&mut socket,503).await;return;}};
                let cors_headers=format!("{cors_headers}X-Tongyun-Operation: {}\r\n",op.id());
                let result:Result<(),()>=async {
                if path=="/api/operations" && method=="GET" {
                    let events=crate::audit::read(&journal).map_err(|_|())?;
                    let payload=serde_json::to_string(&events).map_err(|_|())?;
                    let _=socket.write_all(format!("HTTP/1.1 200 OK\r\n{cors_headers}Content-Length: {}\r\n\r\n{payload}",payload.len()).as_bytes()).await;
                    return Ok(());
                }
                // 1. 状态检查
                if (path == "/api/status" || path == "/") && method=="GET" {
                    let payload = r#"{"status":"ready","app":"tongyun-api","version":"0.1.0","message":"AI Skill Bridge 运行就绪","endpoints":["/api/status","/api/state","/api/push","/api/send","/api/operations","/api/telemetry","/api/thought","/api/feedback","/api/sync"]}"#;
                    let resp = format!("HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, payload.len(), payload);
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return Ok(());
                }

                // 2. 获取当前客户端状态 (激活接口、最后响应、断言用例)
                if (path == "/api/state" || path == "/api/last-response") && method == "GET" {
                    let current_state = {
                        let lock = state_clone.lock().unwrap();
                        lock.clone()
                    };
                    let payload = serde_json::to_string(&current_state).unwrap_or_else(|_| "{}".to_string());
                    let resp = format!("HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, payload.len(), payload);
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return Ok(());
                }

                // 3. UI 向 Bridge 同步状态
                if (path == "/api/sync" || path == "/api/state") && method == "POST" {
                    if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(&body) {
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
                        return Ok(());
                    }
                }

                // 4. 推送接口与用例集到 UI
                if (path == "/api/push" || path == "/api/open-request" || path == "/api/push-request" || path == "/api/push-cases") && method == "POST" {
                    if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(&body) {
                        emit("ai-bridge-push", &json_val)?;
                        {
                            let mut lock = state_clone.lock().unwrap();
                            if let Some(obj) = lock.as_object_mut() {
                                obj.insert("last_pushed".to_string(), json_val.clone());
                            }
                        }
                        let payload = r#"{"ok":true,"message":"接口及用例数据已成功推送到桌面 UI 标签页"}"#;
                        let resp = format!("HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, payload.len(), payload);
                        let _ = socket.write_all(resp.as_bytes()).await;
                        return Ok(());
                    }
                }

                // 5. 触发发送
                if path == "/api/send" && method == "POST" {
                    let json_val = serde_json::from_str::<serde_json::Value>(&body).unwrap_or(serde_json::json!({}));
                    emit("ai-bridge-send", &json_val)?;
                    let payload = r#"{"ok":true,"message":"已触发桌面 UI 执行发送"}"#;
                    let resp = format!("HTTP/1.1 200 OK\r\n{}Content-Length: {}\r\n\r\n{}", cors_headers, payload.len(), payload);
                    let _ = socket.write_all(resp.as_bytes()).await;
                    return Ok(());
                }

                // 6. 触发批量执行用例
                if path == "/api/run-cases" && method=="POST" {
                    reject(&mut socket,501).await;
                    return Ok(());
                }

                // 7. 投屏 Agent 思考过程与态势 (Telemetry / Thought)
                if (path == "/api/telemetry" || path == "/api/thought") && method == "POST" {
                    if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(&body) {
                        emit("ai-bridge-telemetry", &json_val)?;
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
                        return Ok(());
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
                    return Ok(());
                }

                if path == "/api/feedback" && method == "POST" {
                    if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(&body) {
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
                        return Ok(());
                    }
                }

                let _=socket.write_all(format!("HTTP/1.1 404 Not Found\r\n{cors_headers}Content-Length: 2\r\n\r\n{{}}").as_bytes()).await;
                Ok(())
                }.await;
                if result.is_err(){reject(&mut socket,503).await;}
                if let Err(_e)=op.finish(if result.is_ok(){"handled"}else{"dispatch_failed"}) { eprintln!("Bridge audit completion failed; inspect started operation"); }
}

#[cfg(test)]
mod tests {
    use super::*;
    async fn parse(chunks: Vec<Vec<u8>>) -> Result<Request,u16> {
        let listener=TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr=listener.local_addr().unwrap();
        let writer=tokio::spawn(async move {
            let mut client=TcpStream::connect(addr).await.unwrap();
            for chunk in chunks {client.write_all(&chunk).await.unwrap();tokio::task::yield_now().await;}
            client.shutdown().await.unwrap();
        });
        let (mut socket,_)=listener.accept().await.unwrap();
        let result=read_request(&mut socket,"fixture-token",4171).await;
        writer.await.unwrap();result
    }
    fn request(extra:&str)->Vec<u8> {format!("GET /api/state HTTP/1.1\r\nHost: 127.0.0.1:4171\r\n{extra}\r\n").into_bytes()}
    #[tokio::test] async fn refuses_missing_wrong_credentials_and_foreign_origin() {
        assert!(matches!(parse(vec![request("")]).await,Err(401)));
        assert!(matches!(parse(vec![request("Authorization: Bearer wrong\r\n")]).await,Err(401)));
        assert!(matches!(parse(vec![request("Authorization: Bearer fixture-token\r\nOrigin: https://example.com\r\n")]).await,Err(403)));
        assert!(parse(vec![request("Authorization: Bearer fixture-token\r\n")]).await.is_ok());
    }
    #[tokio::test] async fn reads_split_body_and_rejects_oversized_or_ambiguous_frames() {
        let head=b"POST /api/send HTTP/1.1\r\nHost: 127.0.0.1:4171\r\nAuthorization: Bearer fixture-token\r\nContent-Length: 7\r\n\r\n".to_vec();
        let req=parse(vec![head,b"{\"x\":".to_vec(),b"1}".to_vec()]).await.unwrap();assert_eq!(req.body,"{\"x\":1}");
        let auth="Authorization: Bearer fixture-token\r\n";
        assert!(matches!(parse(vec![request(&format!("{auth}Content-Length: 65537\r\n"))]).await,Err(413)));
        assert!(matches!(parse(vec![request(&format!("{auth}Content-Length: 0\r\nContent-Length: 0\r\n"))]).await,Err(400)));
        assert!(matches!(parse(vec![request(&format!("{auth}Transfer-Encoding: chunked\r\n"))]).await,Err(400)));
        assert!(parse(vec![request(auth)]).await.is_ok());
    }
    #[tokio::test] async fn preflight_requires_explicit_trusted_origin_and_host() {
        let valid=b"OPTIONS /api/send HTTP/1.1\r\nHost: localhost:4171\r\nOrigin: tauri://localhost\r\n\r\n".to_vec();
        assert!(parse(vec![valid]).await.is_ok());
        assert!(matches!(parse(vec![b"GET /api/state HTTP/1.1\r\nHost: example.com:4171\r\nAuthorization: Bearer fixture-token\r\n\r\n".to_vec()]).await,Err(403)));
    }
}

#[cfg(test)]
mod endpoint_tests {
    use super::*;
    async fn exchange(method:&str,path:&str,body:&str,auth:bool,origin:Option<&str>,state:Arc<Mutex<serde_json::Value>>,journal:std::path::PathBuf,dispatched:Arc<std::sync::atomic::AtomicUsize>)->String {
        let listener=TcpListener::bind("127.0.0.1:0").await.unwrap();let port=listener.local_addr().unwrap().port();
        let server=tokio::spawn(async move{let (socket,_)=listener.accept().await.unwrap();serve_connection(socket,BridgeConfig{port,token:"fixture-token".into()},state,journal,move |_,_|{dispatched.fetch_add(1,std::sync::atomic::Ordering::SeqCst);Ok(())}).await;});
        let mut client=TcpStream::connect(("127.0.0.1",port)).await.unwrap();
        let auth=if auth{"Authorization: Bearer fixture-token\r\n"}else{""};let origin=origin.map(|o|format!("Origin: {o}\r\n")).unwrap_or_default();
        let request=format!("{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n{auth}{origin}Content-Length: {}\r\n\r\n{body}",body.len());client.write_all(request.as_bytes()).await.unwrap();
        let mut response=Vec::new();client.read_to_end(&mut response).await.unwrap();server.await.unwrap();String::from_utf8(response).unwrap()
    }
    #[tokio::test] async fn authenticated_routes_sync_read_and_dispatch_with_private_durable_metadata(){
        let temp=tempfile::tempdir().unwrap();let journal=temp.path().join("audit");let state=Arc::new(Mutex::new(serde_json::json!({})));let count=Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let call=|method,path,body,auth,origin|exchange(method,path,body,auth,origin,state.clone(),journal.clone(),count.clone());
        assert!(call("POST","/api/sync",r#"{"active_request":{"fixture":"private-fixture"}}"#,true,None).await.starts_with("HTTP/1.1 200"));
        let denied=call("GET","/api/state","",false,None).await;assert!(denied.starts_with("HTTP/1.1 401"));assert!(!denied.contains("private-fixture"));
        let allowed=call("GET","/api/state","",true,None).await;assert!(allowed.contains("private-fixture"));
        assert!(call("POST","/api/send","{}",true,Some("https://example.com")).await.starts_with("HTTP/1.1 403"));
        assert_eq!(count.load(std::sync::atomic::Ordering::SeqCst),0);
        let sent=call("POST","/api/send","{}",true,None).await;assert!(sent.starts_with("HTTP/1.1 200"));assert!(sent.contains("X-Tongyun-Operation:"));assert_eq!(count.load(std::sync::atomic::Ordering::SeqCst),1);
        assert!(call("POST","/api/run-cases","{}",true,None).await.starts_with("HTTP/1.1 501"));
        assert!(call("POST","/api/send","{bad",true,None).await.starts_with("HTTP/1.1 400"));assert_eq!(count.load(std::sync::atomic::Ordering::SeqCst),1);
        let events=crate::audit::read(&journal).unwrap();assert!(events.len()>=8);assert!(!serde_json::to_string(&events).unwrap().contains("private-fixture"));
    }
}
