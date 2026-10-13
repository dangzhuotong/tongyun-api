import { mergeEnvironmentLayers, type EnvKind, type EnvironmentSet } from "../parser/env";
import { parseHttpFile, type ParseWarning, type ParsedRequest } from "../parser/httpFile";

export interface TextFile {
  relativePath: string;
  content: string;
}

export interface EnvFile extends TextFile {
  kind: EnvKind;
}

export interface HttpFileModel {
  path: string;
  requests: Array<ParsedRequest & { id: string }>;
  warnings: ParseWarning[];
  environments: EnvironmentSet;
}

export interface WorkspaceModel {
  files: HttpFileModel[];
  problems: string[];
}

export function assembleWorkspace(
  httpFiles: TextFile[],
  envFiles: EnvFile[],
  extraProblems: string[] = [],
): WorkspaceModel {
  const problems = new Set(extraProblems);
  const files = [...httpFiles]
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    .map((file) => {
      const parsed = parseHttpFile(file.content);
      if (parsed.requests.length === 0 && file.content.trim() !== "") {
        problems.add(`${file.relativePath} 里没有可发送的请求`);
      }
      const environments = environmentForFile(file.relativePath, envFiles);
      for (const problem of environments.problems) problems.add(problem);
      return {
        path: file.relativePath,
        warnings: parsed.warnings,
        environments,
        requests: parsed.requests.map((request) => ({
          ...request,
          id: `${file.relativePath}#${request.line}`,
        })),
      };
    });

  return { files, problems: [...problems] };
}

/** 只合并从集合根目录走到该 .http 所在目录的环境文件。兄弟目录不参与。 */
export function environmentForFile(httpPath: string, envFiles: EnvFile[]): EnvironmentSet {
  const layers = ancestorDirectories(directoryOf(httpPath)).flatMap((dir) =>
    envFiles
      .filter((file) => directoryOf(file.relativePath) === dir)
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "public" ? -1 : 1;
        return a.relativePath.localeCompare(b.relativePath);
      })
      .map((file) => ({
        path: file.relativePath,
        kind: file.kind,
        content: file.content,
      })),
  );
  return mergeEnvironmentLayers(layers);
}

function directoryOf(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

function ancestorDirectories(dir: string): string[] {
  if (!dir) return [""];
  const parts = dir.split("/").filter(Boolean);
  const dirs = [""];
  for (let index = 0; index < parts.length; index += 1) {
    dirs.push(parts.slice(0, index + 1).join("/"));
  }
  return dirs;
}

export interface TreeDir {
  name: string;
  path: string;
  dirs: TreeDir[];
  files: HttpFileModel[];
}

export function buildTree(files: HttpFileModel[]): TreeDir {
  const root: TreeDir = { name: "", path: "", dirs: [], files: [] };
  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    const dirs = parts.slice(0, -1);
    let cursor = root;
    const walked: string[] = [];
    for (const dir of dirs) {
      walked.push(dir);
      const path = walked.join("/");
      let next = cursor.dirs.find((item) => item.name === dir);
      if (!next) {
        next = { name: dir, path, dirs: [], files: [] };
        cursor.dirs.push(next);
      }
      cursor = next;
    }
    cursor.files.push(file);
  }
  return root;
}

export function prettyBody(body: string, contentType: string | null): { text: string; json: boolean } {
  const trimmed = body.trim();
  const declaredJson = Boolean(contentType && contentType.toLowerCase().includes("json"));
  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  if (!declaredJson && !looksJson) return { text: body, json: false };
  try {
    return { text: JSON.stringify(JSON.parse(trimmed), null, 2), json: true };
  } catch {
    return { text: body, json: false };
  }
}
