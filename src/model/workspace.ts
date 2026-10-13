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
}

export interface WorkspaceModel {
  files: HttpFileModel[];
  environments: EnvironmentSet;
  problems: string[];
}

export function assembleWorkspace(httpFiles: TextFile[], envFiles: EnvFile[]): WorkspaceModel {
  const problems: string[] = [];
  const files = [...httpFiles]
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    .map((file) => {
      const parsed = parseHttpFile(file.content);
      if (parsed.requests.length === 0 && file.content.trim() !== "") {
        problems.push(`${file.relativePath} 里没有可发送的请求`);
      }
      return {
        path: file.relativePath,
        warnings: parsed.warnings,
        requests: parsed.requests.map((request) => ({
          ...request,
          id: `${file.relativePath}#${request.line}`,
        })),
      };
    });

  const environments = mergeEnvironmentLayers(
    [...envFiles].sort(compareEnvFiles).map((file) => ({
      path: file.relativePath,
      kind: file.kind,
      content: file.content,
    })),
  );

  return { files, environments, problems: [...problems, ...environments.problems] };
}

function compareEnvFiles(a: EnvFile, b: EnvFile): number {
  const depthA = a.relativePath.split("/").length;
  const depthB = b.relativePath.split("/").length;
  if (depthA !== depthB) return depthA - depthB;
  if (a.kind !== b.kind) return a.kind === "public" ? -1 : 1;
  return a.relativePath.localeCompare(b.relativePath);
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
