export interface HeaderField {
  name: string;
  value: string;
}

export interface ParsedRequest {
  name: string;
  method: string;
  url: string;
  headers: HeaderField[];
  body: string;
  line: number;
}

export interface ParseWarning {
  line: number;
  message: string;
}

export interface ParsedHttpFile {
  requests: ParsedRequest[];
  warnings: ParseWarning[];
}

interface SourceLine {
  line: number;
  text: string;
}

interface Block {
  name: string;
  lines: SourceLine[];
}

const REQUEST_LINE =
  /^([A-Za-z][A-Za-z0-9-]*)\s+(\S+)(?:\s+HTTP\/\d+(?:\.\d+)?)?$/;
const URL_ONLY = /^(https?:\/\/\S+)$/i;
const HEADER_LINE = /^([^:\s]+)\s*:\s*(.*)$/;

/**
 * 解析 IntelliJ HTTP Client 的 .http / .rest 文本。
 * `###` 分隔请求；`{{var}}` 原样保留，替换在 substitute 里做。
 * 前置脚本 `< {% %}` 与响应处理 `> {% %}` 不进入请求体。
 */
export function parseHttpFile(source: string): ParsedHttpFile {
  const text = source.replace(/^\uFEFF/, "");
  const blocks = splitBlocks(text);
  const requests: ParsedRequest[] = [];
  const warnings: ParseWarning[] = [];

  for (const block of blocks) {
    const parsed = parseBlock(block);
    if (parsed.warning) warnings.push(parsed.warning);
    if (parsed.request) requests.push(parsed.request);
  }

  return { requests, warnings };
}

function splitBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block = { name: "", lines: [] };

  text.split(/\r?\n/).forEach((raw, index) => {
    const separator = raw.match(/^###\s*(.*)$/);
    if (separator) {
      if (shouldKeep(current)) blocks.push(current);
      current = { name: separator[1].trim(), lines: [] };
      return;
    }
    current.lines.push({ line: index + 1, text: raw });
  });

  if (shouldKeep(current)) blocks.push(current);
  return blocks;
}

function shouldKeep(block: Block): boolean {
  if (block.name.length > 0) return true;
  return block.lines.some((line) => {
    const trimmed = line.text.trim();
    return trimmed !== "" && !isComment(line.text);
  });
}

function parseBlock(block: Block): { request?: ParsedRequest; warning?: ParseWarning } {
  const cursor = { index: 0 };
  skipPreamble(block.lines, cursor);
  if (cursor.index >= block.lines.length) {
    return {
      warning: {
        line: block.lines[0]?.line ?? 1,
        message: block.name
          ? `请求「${block.name}」没有请求行`
          : "空请求块已跳过",
      },
    };
  }

  const requestLine = block.lines[cursor.index];
  const parsedLine = parseRequestLine(requestLine.text.trim());
  if (!parsedLine) {
    return {
      warning: {
        line: requestLine.line,
        message: `无法识别请求行：${requestLine.text.trim()}`,
      },
    };
  }
  cursor.index += 1;

  const headers: HeaderField[] = [];
  while (cursor.index < block.lines.length) {
    const current = block.lines[cursor.index];
    if (current.text.trim() === "") {
      cursor.index += 1;
      break;
    }
    if (isComment(current.text)) {
      cursor.index += 1;
      continue;
    }
    const header = current.text.match(HEADER_LINE);
    if (!header) break;
    headers.push({ name: header[1], value: header[2] });
    cursor.index += 1;
  }

  const bodyLines: string[] = [];
  while (cursor.index < block.lines.length) {
    const current = block.lines[cursor.index];
    if (isResponseHandler(current.text)) {
      skipHandler(block.lines, cursor);
      continue;
    }
    bodyLines.push(current.text);
    cursor.index += 1;
  }
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === "") {
    bodyLines.pop();
  }

  const body = bodyLines.join("\n");
  const fileBody = body.match(/^<\s+(\S+)\s*$/);
  const warning = fileBody
    ? {
        line: requestLine.line,
        message: "MVP 不读取外部文件作为请求体",
      }
    : undefined;

  return {
    request: {
      name: block.name || fallbackName(parsedLine.method, parsedLine.url),
      method: parsedLine.method,
      url: parsedLine.url,
      headers,
      body,
      line: requestLine.line,
    },
    warning,
  };
}

function parseRequestLine(text: string): { method: string; url: string } | null {
  const named = text.match(REQUEST_LINE);
  if (named) {
    return { method: named[1].toUpperCase(), url: named[2] };
  }
  const urlOnly = text.match(URL_ONLY);
  if (urlOnly) return { method: "GET", url: urlOnly[1] };
  return null;
}

function fallbackName(method: string, url: string): string {
  const short = url.length > 72 ? `${url.slice(0, 69)}…` : url;
  return `${method} ${short}`;
}

function skipPreamble(lines: SourceLine[], cursor: { index: number }) {
  while (cursor.index < lines.length) {
    const text = lines[cursor.index].text;
    const trimmed = text.trim();
    if (trimmed === "" || isComment(text)) {
      cursor.index += 1;
      continue;
    }
    if (trimmed.startsWith("<")) {
      skipScriptFence(lines, cursor);
      continue;
    }
    break;
  }
}

function skipHandler(lines: SourceLine[], cursor: { index: number }) {
  skipScriptFence(lines, cursor);
}

function skipScriptFence(lines: SourceLine[], cursor: { index: number }) {
  const opening = lines[cursor.index]?.text ?? "";
  cursor.index += 1;
  if (opening.includes("{%") && !opening.includes("%}")) {
    while (cursor.index < lines.length && !lines[cursor.index].text.includes("%}")) {
      cursor.index += 1;
    }
    if (cursor.index < lines.length) cursor.index += 1;
  }
}

function isComment(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("//") || (trimmed.startsWith("#") && !trimmed.startsWith("###"));
}

function isResponseHandler(text: string): boolean {
  return text.trim().startsWith(">");
}
