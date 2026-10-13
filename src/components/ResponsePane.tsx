import type { Exchange } from "../bridge";
import { prettyBody } from "../model/workspace";

interface ResponsePaneProps {
  sending: boolean;
  outcome: { kind: "idle" } | { kind: "exchange"; exchange: Exchange } | { kind: "error"; message: string };
}

export function ResponsePane({ sending, outcome }: ResponsePaneProps) {
  return (
    <section className="response">
      <div className="pane-label">
        <span>响应</span>
        <span>{sending ? "等待" : "本机发送"}</span>
      </div>
      {outcome.kind === "idle" ? (
        <p className="empty-stage">发送后在这里看状态、耗时、响应头和正文。</p>
      ) : null}
      {outcome.kind === "error" ? <p className="warn-banner standout">{outcome.message}</p> : null}
      {outcome.kind === "exchange" ? <ExchangeView exchange={outcome.exchange} /> : null}
    </section>
  );
}

function ExchangeView({ exchange }: { exchange: Exchange }) {
  const pretty = prettyBody(exchange.body, exchange.contentType);
  const bytes = new TextEncoder().encode(exchange.body).length;
  return (
    <div className="response-scroll">
      <div className="status-row">
        <strong data-status={statusBucket(exchange.status)}>{exchange.status}</strong>
        <span>{exchange.reason || "无原因短语"}</span>
        <span>{exchange.elapsedMs} ms</span>
        <span>{bytes} B</span>
      </div>
      {exchange.truncated ? <p className="warn-banner">正文超过 1MB，这里只保留前 1MB。</p> : null}
      <h3>响应头</h3>
      {exchange.headers.length === 0 ? (
        <p className="empty-copy">无</p>
      ) : (
        <dl className="pairs">
          {exchange.headers.map((header, index) => (
            <div key={`${header.name}-${index}`}>
              <dt>{header.name}</dt>
              <dd>{header.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <h3>{pretty.json ? "JSON" : "正文"}</h3>
      <pre>{pretty.text || "（空）"}</pre>
    </div>
  );
}

function statusBucket(status: number): string {
  if (status >= 200 && status < 300) return "ok";
  if (status >= 300 && status < 400) return "info";
  if (status >= 400 && status < 500) return "warn";
  return "danger";
}
