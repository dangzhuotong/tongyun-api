mod scan;
mod send;

use std::path::PathBuf;

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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![scan_workspace, examples_dir, send_http])
        .run(tauri::generate_context!())
        .expect("error while running tongyun-api");
}
