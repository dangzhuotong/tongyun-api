import type { HeaderField, ParsedRequest } from "./httpFile";

const VARIABLE = /\{\{\s*([A-Za-z_][\w.-]*)\s*\}\}/g;

export interface ResolvedRequest {
  method: string;
  url: string;
  headers: HeaderField[];
  body: string;
  missing: string[];
}

export function substitute(
  input: string,
  variables: Record<string, string>,
): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = input.replace(VARIABLE, (raw, name: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      return variables[name];
    }
    missing.add(name);
    return raw;
  });
  return { text, missing: [...missing] };
}

export function resolveRequest(
  request: ParsedRequest,
  variables: Record<string, string>,
): ResolvedRequest {
  const missing = new Set<string>();
  const take = (input: string) => {
    const result = substitute(input, variables);
    for (const name of result.missing) missing.add(name);
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
  };
}
