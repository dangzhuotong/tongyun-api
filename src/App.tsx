import { FolderOpen, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  examplesDir,
  isDesktop,
  pickFolder,
  scanWorkspace,
  sendHttp,
  type Exchange,
} from "./bridge";
import { FileTree } from "./components/FileTree";
import { RequestPane } from "./components/RequestPane";
import { ResponsePane } from "./components/ResponsePane";
import { assembleWorkspace, type WorkspaceModel } from "./model/workspace";
import { resolveRequest } from "./parser/substitute";
import { builtinWorkspace } from "./samples";

type Outcome =
  | { kind: "idle" }
  | { kind: "exchange"; exchange: Exchange }
  | { kind: "error"; message: string };

export function App() {
  const builtin = builtinWorkspace();
  const [model, setModel] = useState<WorkspaceModel>(builtin);
  const [label, setLabel] = useState("内置示例");
  const [folder, setFolder] = useState<string | null>(null);
  const [envName, setEnvName] = useState(builtin.environments.names[0] ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(firstRequestId(builtin));
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<string | null>(builtin.problems[0] ?? null);
  const [desktop, setDesktop] = useState(false);
  const [examples, setExamples] = useState<string | null>(null);
  const [showPrivate, setShowPrivate] = useState(false);
  const [busy, setBusy] = useState(false);

  const applyModel = useCallback((next: WorkspaceModel, nextLabel: string, nextFolder: string | null, keepId?: string | null) => {
    setModel(next);
    setLabel(nextLabel);
    setFolder(nextFolder);
    setEnvName((current) =>
      next.environments.names.includes(current) ? current : (next.environments.names[0] ?? ""),
    );
    const ids = next.files.flatMap((file) => file.requests.map((request) => request.id));
    setSelectedId(keepId && ids.includes(keepId) ? keepId : (ids[0] ?? null));
    setOutcome({ kind: "idle" });
    setBanner(next.problems[0] ?? null);
  }, []);

  const loadFolder = useCallback(
    async (root: string, keepId?: string | null) => {
      setBusy(true);
      try {
        const scanned = await scanWorkspace(root);
        const next = assembleWorkspace(scanned.httpFiles, scanned.envFiles);
        applyModel(next, scanned.root, scanned.root, keepId);
      } catch (error) {
        setBanner(error instanceof Error ? error.message : "读取文件夹失败");
      } finally {
        setBusy(false);
      }
    },
    [applyModel],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const onDesktop = await isDesktop();
      if (cancelled) return;
      setDesktop(onDesktop);
      if (!onDesktop) return;
      const dir = await examplesDir();
      if (cancelled) return;
      setExamples(dir);
      if (dir) await loadFolder(dir);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFolder]);

  const selected = useMemo(() => {
    for (const file of model.files) {
      const request = file.requests.find((item) => item.id === selectedId);
      if (request) return { file, request };
    }
    return null;
  }, [model.files, selectedId]);

  const variables = model.environments.variables[envName] ?? {};
  const resolved = selected ? resolveRequest(selected.request, variables) : null;
  const canSend = Boolean(desktop && resolved && resolved.missing.length === 0 && !busy);

  async function openFolder() {
    if (!desktop) {
      setBanner("打开本机文件夹只在桌面窗口里可用。浏览器预览使用内置示例。");
      return;
    }
    try {
      const root = await pickFolder();
      if (root) await loadFolder(root);
    } catch (error) {
      setBanner(error instanceof Error ? error.message : "无法打开文件夹");
    }
  }

  async function onSend() {
    if (!resolved || !selected) return;
    if (!desktop) {
      setOutcome({
        kind: "error",
        message: "发送走本机 Rust 客户端，不经过浏览器。请用 npm run tauri dev 打开桌面窗口。",
      });
      return;
    }
    if (resolved.missing.length > 0) return;
    setSending(true);
    setOutcome({ kind: "idle" });
    try {
      const exchange = await sendHttp({
        method: resolved.method,
        url: resolved.url,
        headers: resolved.headers,
        body: resolved.body ? resolved.body : null,
      });
      setOutcome({ kind: "exchange", exchange });
    } catch (error) {
      setOutcome({
        kind: "error",
        message: error instanceof Error ? error.message : "发送失败",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <div>
            <strong>橦云接口</strong>
            <p>{busy ? "正在读取…" : label}</p>
          </div>
        </div>
        <label className="env-switch">
          <span>环境</span>
          <select
            value={envName}
            onChange={(event) => {
              setEnvName(event.target.value);
              setOutcome({ kind: "idle" });
            }}
            disabled={model.environments.names.length === 0}
          >
            {model.environments.names.length === 0 ? <option value="">无环境</option> : null}
            {model.environments.names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="top-actions">
          {folder ? (
            <button type="button" className="btn" onClick={() => void loadFolder(folder, selectedId)} disabled={busy}>
              <RefreshCw size={15} />
              重新读取
            </button>
          ) : null}
          {examples ? (
            <button type="button" className="btn" onClick={() => void loadFolder(examples)} disabled={busy}>
              示例
            </button>
          ) : null}
          <button type="button" className="btn primary" onClick={() => void openFolder()} disabled={busy}>
            <FolderOpen size={15} />
            打开文件夹
          </button>
        </div>
      </header>
      {banner ? <div className="banner">{banner}</div> : null}
      <main className="workspace">
        <FileTree
          files={model.files}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setOutcome({ kind: "idle" });
          }}
        />
        {selected && resolved ? (
          <RequestPane
            filePath={selected.file.path}
            request={selected.request}
            resolved={resolved}
            envName={envName}
            environments={model.environments}
            showPrivate={showPrivate}
            onTogglePrivate={() => setShowPrivate((value) => !value)}
            sending={sending}
            canSend={canSend}
            sendHint={
              desktop
                ? null
                : "浏览器预览只核对环境和变量替换。发送请求请用桌面窗口。"
            }
            onSend={() => void onSend()}
          />
        ) : (
          <section className="request">
            <p className="empty-stage">从左侧选择一个请求。</p>
          </section>
        )}
        <ResponsePane sending={sending} outcome={outcome} />
      </main>
    </div>
  );
}

function firstRequestId(model: WorkspaceModel): string | null {
  return model.files[0]?.requests[0]?.id ?? null;
}
