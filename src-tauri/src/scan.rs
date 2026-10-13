use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const SKIP_DIRS: &[&str] = &[
    "node_modules",
    "target",
    "dist",
    ".git",
    ".idea",
    ".vscode",
    "src-tauri",
];
const MAX_FILES: usize = 300;
const MAX_BYTES: u64 = 512 * 1024;
const MAX_DEPTH: usize = 8;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScannedFile {
    pub relative_path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScannedEnv {
    pub relative_path: String,
    pub kind: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScannedWorkspace {
    pub root: String,
    pub http_files: Vec<ScannedFile>,
    pub env_files: Vec<ScannedEnv>,
}

pub fn scan_workspace(root: &Path) -> Result<ScannedWorkspace, String> {
    let root = root
        .canonicalize()
        .map_err(|err| format!("无法打开文件夹：{err}"))?;
    if !root.is_dir() {
        return Err("选择的路径不是文件夹".to_string());
    }

    let mut http_files = Vec::new();
    let mut env_files = Vec::new();
    walk(&root, &root, 0, &mut http_files, &mut env_files)?;
    http_files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    env_files.sort_by(|a, b| {
        depth(&a.relative_path)
            .cmp(&depth(&b.relative_path))
            .then_with(|| kind_rank(&a.kind).cmp(&kind_rank(&b.kind)))
            .then_with(|| a.relative_path.cmp(&b.relative_path))
    });

    Ok(ScannedWorkspace {
        root: root.to_string_lossy().into_owned(),
        http_files,
        env_files,
    })
}

pub fn find_examples_dir(start: &Path) -> Option<PathBuf> {
    let mut candidates = vec![start.join("examples"), start.join("../examples")];
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("examples"));
        candidates.push(cwd.join("../examples"));
    }
    candidates.into_iter().find_map(|candidate| {
        if candidate.join("http-client.env.json").is_file() {
            candidate.canonicalize().ok()
        } else {
            None
        }
    })
}

fn walk(
    root: &Path,
    dir: &Path,
    depth: usize,
    http_files: &mut Vec<ScannedFile>,
    env_files: &mut Vec<ScannedEnv>,
) -> Result<(), String> {
    if depth > MAX_DEPTH {
        return Ok(());
    }
    let entries = fs::read_dir(dir).map_err(|err| format!("无法读取 {}：{err}", dir.display()))?;
    for entry in entries {
        let entry = entry.map_err(|err| format!("无法读取目录项：{err}"))?;
        let path = entry.path();
        let name = entry.file_name();
        let name = name.to_string_lossy();
        let file_type = entry
            .file_type()
            .map_err(|err| format!("无法识别 {name}：{err}"))?;
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            if SKIP_DIRS.contains(&name.as_ref()) || name.starts_with('.') {
                continue;
            }
            walk(root, &path, depth + 1, http_files, env_files)?;
            continue;
        }
        if !file_type.is_file() {
            continue;
        }
        if name == "http-client.env.json" || name == "http-client.private.env.json" {
            let content = read_limited(&path)?;
            env_files.push(ScannedEnv {
                relative_path: relative(root, &path),
                kind: if name == "http-client.private.env.json" {
                    "private".to_string()
                } else {
                    "public".to_string()
                },
                content,
            });
            continue;
        }
        let lower = name.to_ascii_lowercase();
        if lower.ends_with(".http") || lower.ends_with(".rest") {
            if http_files.len() >= MAX_FILES {
                return Err(format!(".http 文件超过 {MAX_FILES} 个，请缩小文件夹"));
            }
            let content = read_limited(&path)?;
            http_files.push(ScannedFile {
                relative_path: relative(root, &path),
                content,
            });
        }
    }
    Ok(())
}

fn read_limited(path: &Path) -> Result<String, String> {
    let meta = fs::metadata(path).map_err(|err| format!("无法读取 {}：{err}", path.display()))?;
    if meta.len() > MAX_BYTES {
        return Err(format!("{} 超过 512KB", path.display()));
    }
    fs::read_to_string(path).map_err(|err| format!("无法读取 {}：{err}", path.display()))
}

fn relative(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .components()
        .map(|component| component.as_os_str().to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join("/")
}

fn depth(path: &str) -> usize {
    path.chars().filter(|ch| *ch == '/').count()
}

fn kind_rank(kind: &str) -> u8 {
    if kind == "public" { 0 } else { 1 }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn scans_http_and_env_files_and_skips_noise() {
        let root = tempfile::tempdir().unwrap();
        let base = root.path();
        fs::create_dir_all(base.join("nested")).unwrap();
        fs::create_dir_all(base.join("node_modules")).unwrap();
        fs::create_dir_all(base.join(".git")).unwrap();
        fs::write(base.join("nested/a.http"), "GET https://httpbin.org/get\n").unwrap();
        fs::write(base.join("nested/notes.txt"), "ignore").unwrap();
        fs::write(base.join("node_modules/hidden.http"), "GET https://httpbin.org/deny\n").unwrap();
        fs::write(base.join(".git/hidden.http"), "GET https://httpbin.org/hidden\n").unwrap();
        fs::write(base.join("http-client.env.json"), "{\"dev\":{\"host\":\"https://httpbin.org\"}}").unwrap();
        fs::write(
            base.join("http-client.private.env.json"),
            "{\"dev\":{\"token\":\"secret\"}}",
        )
        .unwrap();
        fs::write(
            base.join("http-client.private.env.json.example"),
            "{\"dev\":{\"token\":\"example\"}}",
        )
        .unwrap();

        let scanned = scan_workspace(base).unwrap();
        assert_eq!(
            scanned.http_files.iter().map(|file| file.relative_path.as_str()).collect::<Vec<_>>(),
            vec!["nested/a.http"]
        );
        assert!(scanned.http_files[0].content.contains("httpbin.org"));
        assert_eq!(
            scanned
                .env_files
                .iter()
                .map(|file| (file.relative_path.as_str(), file.kind.as_str()))
                .collect::<Vec<_>>(),
            vec![
                ("http-client.env.json", "public"),
                ("http-client.private.env.json", "private"),
            ]
        );
    }

    #[test]
    fn rejects_a_missing_folder() {
        let missing = tempfile::tempdir().unwrap().path().join("nope");
        let error = scan_workspace(&missing).unwrap_err();
        assert!(error.contains("无法打开文件夹"));
    }
}
