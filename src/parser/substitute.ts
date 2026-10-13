import type { HeaderField, ParsedRequest } from "./httpFile";

const VARIABLE = /\{\{\s*(\$[A-Za-z_][\w.-]*|[A-Za-z_][\w.-]*)\s*\}\}/g;

export interface SubstituteOptions {
  maskKeys?: ReadonlySet<string>;
  resolveDynamic?: boolean;
}

export interface ResolvedRequest {
  method: string;
  url: string;
  headers: HeaderField[];
  body: string;
  missing: string[];
  unsupported: string[];
}

export function generateDynamicVariable(name: string): string | null {
  switch (name) {
    case "$uuid":
      return typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
    case "$timestamp":
      return Math.floor(Date.now() / 1000).toString();
    case "$isoTimestamp":
      return new Date().toISOString();
    case "$randomInt":
      return Math.floor(Math.random() * 10000).toString();
    default:
      return null;
  }
}

export function maskSecret(value: string): string {
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}••••${value.slice(-2)}`;
}

export function substitute(
  input: string,
  variables: Record<string, string>,
  options: SubstituteOptions = {},
): { text: string; missing: string[]; unsupported: string[] } {
  const missing = new Set<string>();
  const unsupported = new Set<string>();
  const text = input.replace(VARIABLE, (raw, name: string) => {
    if (name.startsWith("$")) {
      if (options.resolveDynamic) {
        const dyn = generateDynamicVariable(name);
        if (dyn !== null) return dyn;
      }
      unsupported.add(name);
      return raw;
    }
    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      const value = variables[name];
      return options.maskKeys?.has(name) ? maskSecret(value) : value;
    }
    missing.add(name);
    return raw;
  });
  return { text, missing: [...missing], unsupported: [...unsupported] };
}

export function resolveRequest(
  request: ParsedRequest,
  variables: Record<string, string>,
  options: SubstituteOptions = {},
): ResolvedRequest {
  const missing = new Set<string>();
  const unsupported = new Set<string>();
  const take = (input: string) => {
    const result = substitute(input, variables, options);
    for (const name of result.missing) missing.add(name);
    for (const name of result.unsupported) unsupported.add(name);
    return result.text;
  };

  return {
    method: request.method,
    url: take(request.url),
    headers: request.headers.map((header) => ({
      name: take(header.name),
      value: take(header.value),
    })),
    body: take(request.body),
    missing: [...missing].sort(),
    unsupported: [...unsupported].sort(),
  };
}
