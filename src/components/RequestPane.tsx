import { Send } from "lucide-react";
import type { EnvironmentSet } from "../parser/env";
import type { ParsedRequest } from "../parser/httpFile";
import type { ResolvedRequest } from "../parser/substitute";

interface RequestPaneProps {
  filePath: string;
  request: ParsedRequest;
  resolved: ResolvedRequest;
  envName: string;
  environments: EnvironmentSet;
  showPrivate: boolean;
  onTogglePrivate: () => void;
  sending: boolean;
  canSend: boolean;
  sendHint: string | null;
  onSend: () => void;
}

export function RequestPane({
  filePath,
  request,
  resolved,
  envName,
  environments,
  showPrivate,
  onTogglePrivate,
  sending,
  canSend,
  sendHint,
  onSend,
}: RequestPaneProps) {
  const variables = environments.variables[envName] ?? {};
  const privateKeys = new Set(environments.privateKeys[envName] ?? []);
  const entries = Object.entries(variables).sort(([a], [b]) => a.localeCompare(b));

  return (
    <section className="request">
      <div className="pane-label">
        <span>请求</span>
        <span>{filePath}</span>
      </div>
      <div className="request-scroll">
        <p className="kicker">
          第 {request.line} 行{envName ? ` · 环境 ${envName}` : ""}
        </p>
        <h2>{request.name}</h2>
        <div className="url-block">
          <span className="method" data-method={resolved.method}>
            {resolved.method}
          </span>
          <code>{resolved.url}</code>
        </div>
        {resolved.url !== request.url ? <p className="template">原文 {request.url}</p> : null}
        {resolved.missing.length > 0 ? (
          <p className="warn-banner">还没有这些变量：{resolved.missing.map((name) => `{{${name}}}`).join("、")}</p>
        ) : null}

        <h3>请求头</h3>
        {resolved.headers.length === 0 ? (
          <p className="empty-copy">无</p>
        ) : (
          <dl className="pairs">
            {resolved.headers.map((header, index) => (
              <div key={`${header.name}-${index}`}>
                <dt>{header.name}</dt>
                <dd>{header.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <h3>请求体</h3>
        {resolved.body ? <pre>{resolved.body}</pre> : <p className="empty-copy">无</p>}

        <div className="var-head">
          <h3>环境变量</h3>
          <button type="button" className="text-button" onClick={onTogglePrivate}>
            {showPrivate ? "隐藏私有值" : "显示私有值"}
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="empty-copy">当前环境没有变量。</p>
        ) : (
          <dl className="pairs">
            {entries.map(([key, value]) => (
              <div key={key}>
                <dt>
                  {key}
                  {privateKeys.has(key) ? <em>私有</em> : null}
                </dt>
                <dd>{privateKeys.has(key) && !showPrivate ? mask(value) : value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="request-actions">
        <button type="button" className="btn primary" disabled={!canSend || sending} onClick={onSend}>
          <Send size={15} />
          {sending ? "发送中" : "发送"}
        </button>
        {sendHint ? <p className="template">{sendHint}</p> : null}
      </div>
    </section>
  );
}

function mask(value: string): string {
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}
