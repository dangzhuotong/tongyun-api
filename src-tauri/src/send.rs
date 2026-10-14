use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, CONTENT_TYPE};
use reqwest::{Method, Url};
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::time::{Duration, Instant};

const MAX_BODY: usize = 1024 * 1024;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct HeaderPair {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutgoingRequest {
    pub method: String,
    pub url: String,
    pub headers: Vec<HeaderPair>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HttpExchange {
    pub status: u16,
    pub reason: String,
    pub elapsed_ms: u64,
    pub headers: Vec<HeaderPair>,
    pub body: String,
    pub truncated: bool,
    pub content_type: Option<String>,
}

pub fn validate(request: &OutgoingRequest) -> Result<(), String> {
    if request.method.trim().is_empty() {
        return Err("请求方法为空".to_string());
    }
    Method::from_bytes(request.method.as_bytes())
        .map_err(|_| format!("不认识的方法：{}", request.method))?;
    let url = Url::parse(&request.url).map_err(|_| format!("无法解析地址：{}", request.url))?;
    match url.scheme() {
        "http" | "https" => Ok(()),
        other => Err(format!("只发送 http 和 https，收到 {other}")),
    }
}

pub fn execute(request: &OutgoingRequest) -> Result<HttpExchange, String> {
    validate(request)?;
    let method = Method::from_bytes(request.method.as_bytes()).map_err(|err| err.to_string())?;
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(10))
        .redirect(redirect_policy())
        .user_agent("tongyun-api/0.1")
        .build()
        .map_err(|err| format!("创建客户端失败：{err}"))?;

    let mut headers = HeaderMap::new();
    for header in &request.headers {
        if is_hop_by_hop(&header.name) {
            continue;
        }
        let name = HeaderName::from_bytes(header.name.as_bytes())
            .map_err(|_| format!("非法请求头：{}", header.name))?;
        let value = HeaderValue::from_str(&header.value)
            .map_err(|_| format!("请求头 {} 含有无法发送的字符", header.name))?;
        headers.append(name, value);
    }

    let mut builder = client.request(method, &request.url).headers(headers);
    if let Some(body) = &request.body {
        builder = builder.body(body.clone());
    }

    let started = Instant::now();
    let response = builder.send().map_err(|err| format!("发送失败：{err}"))?;
    let elapsed_ms = started.elapsed().as_millis() as u64;
    let status = response.status();
    let reason = status.canonical_reason().unwrap_or("").to_string();
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let headers = response
        .headers()
        .iter()
        .map(|(name, value)| HeaderPair {
            name: name.to_string(),
            value: value.to_str().unwrap_or("").to_string(),
        })
        .collect();

    let mut limited = response.take((MAX_BODY as u64) + 1);
    let mut bytes = Vec::new();
    limited
        .read_to_end(&mut bytes)
        .map_err(|err| format!("读取响应失败：{err}"))?;
    let truncated = bytes.len() > MAX_BODY;
    if truncated {
        bytes.truncate(MAX_BODY);
    }

    Ok(HttpExchange {
        status: status.as_u16(),
        reason,
        elapsed_ms,
        headers,
        body: String::from_utf8_lossy(&bytes).into_owned(),
        truncated,
        content_type,
    })
}

fn redirect_policy() -> reqwest::redirect::Policy {
    reqwest::redirect::Policy::custom(|attempt| {
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
    })
}

fn is_hop_by_hop(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "content-length"
            | "host"
            | "connection"
            | "transfer-encoding"
            | "keep-alive"
            | "upgrade"
            | "te"
            | "trailer"
            | "proxy-connection"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(method: &str, url: &str) -> OutgoingRequest {
        OutgoingRequest {
            method: method.to_string(),
            url: url.to_string(),
            headers: vec![],
            body: None,
        }
    }

    #[test]
    fn rejects_non_http_urls() {
        let error = validate(&request("GET", "file:///tmp/secret")).unwrap_err();
        assert!(error.contains("http"));
    }

    #[test]
    fn rejects_a_blank_method_and_an_unknown_method() {
        assert!(validate(&request(" ", "https://httpbin.org/get")).is_err());
        assert!(validate(&request("不是方法", "https://httpbin.org/get")).is_err());
    }

    #[test]
    fn accepts_localhost_and_https() {
        validate(&request("GET", "http://127.0.0.1:8080/health")).unwrap();
        validate(&request("POST", "https://httpbin.org/post")).unwrap();
    }

    #[test]
    fn sends_a_request_and_keeps_status_headers_and_body() {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        use std::time::Duration;

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(2)))
                .unwrap();
            let mut received = Vec::new();
            let mut buffer = [0_u8; 1024];
            loop {
                match stream.read(&mut buffer) {
                    Ok(0) => break,
                    Ok(count) => {
                        received.extend_from_slice(&buffer[..count]);
                        if received.windows(4).any(|window| window == b"\r\n\r\n")
                            && received.windows(11).any(|window| window == b"{\"ok\":true}")
                        {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
            let text = String::from_utf8_lossy(&received);
            assert!(text.contains("POST /echo HTTP/1.1"), "{text}");
            assert!(text.contains("x-demo: tongyun") || text.contains("X-Demo: tongyun"), "{text}");
            let body = "{\"echo\":true}";
            let response = format!(
                "HTTP/1.1 201 Created\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(response.as_bytes()).unwrap();
        });

        let exchange = execute(&OutgoingRequest {
            method: "POST".into(),
            url: format!("http://{address}/echo"),
            headers: vec![
                HeaderPair {
                    name: "Content-Type".into(),
                    value: "application/json".into(),
                },
                HeaderPair {
                    name: "X-Demo".into(),
                    value: "tongyun".into(),
                },
            ],
            body: Some("{\"ok\":true}".into()),
        })
        .unwrap();
        server.join().unwrap();

        assert_eq!(exchange.status, 201);
        assert_eq!(exchange.reason, "Created");
        assert!(exchange.elapsed_ms < 5_000);
        assert_eq!(exchange.body, "{\"echo\":true}");
        assert!(!exchange.truncated);
        assert_eq!(
            exchange.content_type.as_deref(),
            Some("application/json")
        );
        assert!(exchange
            .headers
            .iter()
            .any(|header| header.name.eq_ignore_ascii_case("content-type")));
    }

    #[test]
    fn follows_a_redirect_on_the_same_origin() {
        use std::io::Write;
        use std::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            for step in 0..2 {
                let (mut stream, _) = listener.accept().unwrap();
                let _ = read_headers(&mut stream);
                let response = if step == 0 {
                    "HTTP/1.1 302 Found\r\nlocation: /done\r\ncontent-length: 0\r\nconnection: close\r\n\r\n"
                        .to_string()
                } else {
                    "HTTP/1.1 200 OK\r\ncontent-type: text/plain\r\ncontent-length: 2\r\nconnection: close\r\n\r\nok"
                        .to_string()
                };
                stream.write_all(response.as_bytes()).unwrap();
            }
        });

        let exchange = execute(&request("GET", &format!("http://{address}/start"))).unwrap();
        server.join().unwrap();
        assert_eq!(exchange.status, 200);
        assert_eq!(exchange.body, "ok");
    }

    #[test]
    fn stops_when_a_redirect_changes_host() {
        use std::io::Write;
        use std::net::TcpListener;
        use std::sync::atomic::{AtomicBool, Ordering};
        use std::sync::Arc;

        let origin = TcpListener::bind("127.0.0.1:0").unwrap();
        let other = TcpListener::bind("127.0.0.1:0").unwrap();
        let origin_address = origin.local_addr().unwrap();
        let other_address = other.local_addr().unwrap();
        let followed = Arc::new(AtomicBool::new(false));
        let followed_flag = followed.clone();

        let other_server = std::thread::spawn(move || {
            let (mut stream, _) = other.accept().unwrap();
            followed_flag.store(true, Ordering::SeqCst);
            let _ = read_headers(&mut stream);
            stream
                .write_all(b"HTTP/1.1 200 OK\r\ncontent-length: 4\r\nconnection: close\r\n\r\nleak")
                .unwrap();
        });
        let origin_server = std::thread::spawn(move || {
            let (mut stream, _) = origin.accept().unwrap();
            let _ = read_headers(&mut stream);
            let response = format!(
                "HTTP/1.1 302 Found\r\nlocation: http://{other_address}/secret\r\ncontent-length: 0\r\nconnection: close\r\n\r\n"
            );
            stream.write_all(response.as_bytes()).unwrap();
        });

        let exchange = execute(&request("GET", &format!("http://{origin_address}/start"))).unwrap();
        origin_server.join().unwrap();
        assert_eq!(exchange.status, 302);
        assert!(!followed.load(Ordering::SeqCst));
        let _ = std::net::TcpStream::connect(other_address);
        other_server.join().unwrap();
    }

    fn read_headers(stream: &mut std::net::TcpStream) -> String {
        use std::io::Read;
        stream
            .set_read_timeout(Some(std::time::Duration::from_secs(2)))
            .unwrap();
        let mut received = Vec::new();
        let mut buffer = [0_u8; 1024];
        loop {
            match stream.read(&mut buffer) {
                Ok(0) => break,
                Ok(count) => {
                    received.extend_from_slice(&buffer[..count]);
                    if received.windows(4).any(|window| window == b"\r\n\r\n") {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
        String::from_utf8_lossy(&received).into_owned()
    }

    #[test]
    fn identifies_hop_by_hop_headers_case_insensitively() {
        assert!(is_hop_by_hop("content-length"));
        assert!(is_hop_by_hop("Content-Length"));
        assert!(is_hop_by_hop("HOST"));
        assert!(is_hop_by_hop("Host"));
        assert!(is_hop_by_hop("connection"));
        assert!(is_hop_by_hop("Connection"));
        assert!(is_hop_by_hop("Transfer-Encoding"));
        assert!(is_hop_by_hop("keep-alive"));
        assert!(is_hop_by_hop("Upgrade"));
        assert!(is_hop_by_hop("TE"));
        assert!(is_hop_by_hop("Trailer"));
        assert!(is_hop_by_hop("proxy-connection"));

        assert!(!is_hop_by_hop("Authorization"));
        assert!(!is_hop_by_hop("Content-Type"));
        assert!(!is_hop_by_hop("Accept"));
        assert!(!is_hop_by_hop("X-Requested-With"));
    }

    #[test]
    fn validate_accepts_all_standard_http_methods() {
        for method in &["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] {
            assert!(validate(&request(method, "https://httpbin.org/anything")).is_ok());
        }
    }

    #[test]
    fn validate_rejects_unsupported_schemes_and_malformed_urls() {
        let ftp_err = validate(&request("GET", "ftp://example.com/file")).unwrap_err();
        assert!(ftp_err.contains("只发送 http 和 https"));

        let ws_err = validate(&request("GET", "ws://example.com/socket")).unwrap_err();
        assert!(ws_err.contains("只发送 http 和 https"));

        let bad_url_err = validate(&request("GET", "not-a-valid-url")).unwrap_err();
        assert!(bad_url_err.contains("无法解析地址"));

        let empty_url_err = validate(&request("GET", "")).unwrap_err();
        assert!(empty_url_err.contains("无法解析地址"));
    }

    #[test]
    fn header_pair_serde_roundtrip() {
        let pair = HeaderPair {
            name: "X-Trace-Id".to_string(),
            value: "trace-123".to_string(),
        };
        let serialized = serde_json::to_string(&pair).unwrap();
        let deserialized: HeaderPair = serde_json::from_str(&serialized).unwrap();
        assert_eq!(pair, deserialized);
    }
}
