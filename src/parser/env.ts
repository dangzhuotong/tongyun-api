export type EnvKind = "public" | "private";

export interface EnvLayer {
  path: string;
  kind: EnvKind;
  content: string;
}

export interface EnvironmentSource {
  path: string;
  kind: EnvKind;
}

export interface EnvironmentSet {
  names: string[];
  variables: Record<string, Record<string, string>>;
  privateKeys: Record<string, string[]>;
  sources: EnvironmentSource[];
  problems: string[];
}

/**
 * 合并已经按「从集合根到某一个 .http 所在目录」排好序的环境层。
 * 后面的层覆盖前面的层。同一目录里 private 应排在 public 之后。
 * 不要把兄弟目录的环境文件放进同一次合并。
 */
export function mergeEnvironmentLayers(layers: EnvLayer[]): EnvironmentSet {
  const variables: Record<string, Record<string, string>> = {};
  const privateKeys: Record<string, Set<string>> = {};
  const sources: EnvironmentSource[] = [];
  const problems: string[] = [];

  for (const layer of layers) {
    sources.push({ path: layer.path, kind: layer.kind });
    let document: unknown;
    try {
      document = JSON.parse(layer.content);
    } catch {
      problems.push(`${layer.path} 不是合法 JSON`);
      continue;
    }
    if (!document || typeof document !== "object" || Array.isArray(document)) {
      problems.push(`${layer.path} 的顶层必须是环境对象`);
      continue;
    }

    for (const [envName, value] of Object.entries(document)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        problems.push(`${layer.path} 的环境「${envName}」必须是对象`);
        continue;
      }
      const flat = flattenVariables(value as Record<string, unknown>);
      const bucket = variables[envName] ?? {};
      const hidden = privateKeys[envName] ?? new Set<string>();
      for (const [key, variable] of Object.entries(flat)) {
        bucket[key] = variable;
        if (layer.kind === "private") hidden.add(key);
        else hidden.delete(key);
      }
      variables[envName] = bucket;
      privateKeys[envName] = hidden;
    }
  }

  return {
    names: Object.keys(variables).sort(),
    variables,
    privateKeys: Object.fromEntries(
      Object.entries(privateKeys).map(([name, keys]) => [name, [...keys].sort()]),
    ),
    sources,
    problems,
  };
}

export function flattenVariables(value: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    writeFlat(item, key, out);
  }
  return out;
}

function writeFlat(value: unknown, prefix: string, out: Record<string, string>) {
  if (value === null || value === undefined) return;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    out[prefix] = String(value);
    return;
  }
  if (Array.isArray(value)) {
    out[prefix] = JSON.stringify(value);
    return;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      out[prefix] = "";
      return;
    }
    for (const [key, item] of entries) {
      writeFlat(item, `${prefix}.${key}`, out);
    }
  }
}
