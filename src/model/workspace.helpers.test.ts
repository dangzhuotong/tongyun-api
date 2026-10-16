import { describe, expect, it } from "vitest";
import {
  assembleWorkspace,
  buildTree,
  environmentForFile,
  prettyBody,
  type EnvFile,
} from "./workspace";

describe("environmentForFile", () => {
  const envFiles: EnvFile[] = [
    {
      relativePath: "http-client.env.json",
      kind: "public",
      content: JSON.stringify({ dev: { host: "https://root", shared: "root" } }),
    },
    {
      relativePath: "http-client.private.env.json",
      kind: "private",
      content: JSON.stringify({ dev: { secret: "root-secret" } }),
    },
    {
      relativePath: "a/http-client.env.json",
      kind: "public",
      content: JSON.stringify({ dev: { host: "https://a", token: "a" } }),
    },
    {
      relativePath: "a/http-client.private.env.json",
      kind: "private",
      content: JSON.stringify({ dev: { token: "a-secret" } }),
    },
    {
      relativePath: "a/b/http-client.env.json",
      kind: "public",
      content: JSON.stringify({ dev: { host: "https://ab" } }),
    },
    {
      relativePath: "sibling/http-client.env.json",
      kind: "public",
      content: JSON.stringify({ dev: { host: "https://sibling" } }),
    },
  ];

  it("merges only ancestor directories, with nearer layers winning", () => {
    const env = environmentForFile("a/b/c.http", envFiles);
    expect(env.names).toEqual(["dev"]);
    expect(env.variables.dev).toEqual({
      host: "https://ab",
      shared: "root",
      secret: "root-secret",
      token: "a-secret",
    });
    expect(env.privateKeys.dev).toEqual(["secret", "token"]);
  });

  it("excludes deeper and sibling directory environment files", () => {
    const env = environmentForFile("a/c.http", envFiles);
    expect(env.variables.dev).toEqual({
      host: "https://a",
      shared: "root",
      secret: "root-secret",
      token: "a-secret",
    });
    expect(env.variables.dev.host).not.toBe("https://ab");
    expect(env.variables.dev.host).not.toBe("https://sibling");
  });

  it("falls back to the root environment for a top-level file", () => {
    const env = environmentForFile("root.http", envFiles);
    expect(env.variables.dev).toEqual({ host: "https://root", shared: "root", secret: "root-secret" });
    expect(env.privateKeys.dev).toEqual(["secret"]);
  });

  it("records env file sources in merge order", () => {
    const env = environmentForFile("a/b/c.http", envFiles);
    expect(env.sources).toEqual([
      { path: "http-client.env.json", kind: "public" },
      { path: "http-client.private.env.json", kind: "private" },
      { path: "a/http-client.env.json", kind: "public" },
      { path: "a/http-client.private.env.json", kind: "private" },
      { path: "a/b/http-client.env.json", kind: "public" },
    ]);
  });
});

describe("buildTree", () => {
  it("returns an empty root for no files", () => {
    expect(buildTree([])).toEqual({ name: "", path: "", dirs: [], files: [] });
  });

  it("nests multi-level directories and keeps files at every level", () => {
    const workspace = assembleWorkspace(
      [
        { relativePath: "root.http", content: "GET https://httpbin.org/root\n" },
        { relativePath: "a/one.http", content: "GET https://httpbin.org/one\n" },
        { relativePath: "a/three.http", content: "GET https://httpbin.org/three\n" },
        { relativePath: "a/b/two.http", content: "GET https://httpbin.org/two\n" },
      ],
      [],
    );

    const tree = buildTree(workspace.files);
    expect(tree.files.map((f) => f.path)).toEqual(["root.http"]);
    expect(tree.dirs.map((d) => d.name)).toEqual(["a"]);

    const a = tree.dirs[0];
    expect(a.path).toBe("a");
    expect(a.files.map((f) => f.path)).toEqual(["a/one.http", "a/three.http"]);
    expect(a.dirs[0].name).toBe("b");
    expect(a.dirs[0].path).toBe("a/b");
    expect(a.dirs[0].files.map((f) => f.path)).toEqual(["a/b/two.http"]);
  });
});

describe("prettyBody edge cases", () => {
  it("pretty-prints an array body even without a JSON content type", () => {
    expect(prettyBody("[1,2]", null)).toEqual({ text: "[\n  1,\n  2\n]", json: true });
  });

  it("pretty-prints when content type declares JSON with a charset", () => {
    expect(prettyBody('{"a":1}', "application/json; charset=utf-8").json).toBe(true);
  });

  it("trims surrounding whitespace before detecting JSON by shape", () => {
    expect(prettyBody('  {"a":1}  ', "text/plain")).toEqual({ text: '{\n  "a": 1\n}', json: true });
  });

  it("returns the original text when declared JSON is not valid JSON", () => {
    expect(prettyBody("not json at all", "application/json")).toEqual({
      text: "not json at all",
      json: false,
    });
  });

  it("returns empty text untouched", () => {
    expect(prettyBody("", null)).toEqual({ text: "", json: false });
  });
});

describe("assembleWorkspace problems", () => {
  it("propagates extra problems", () => {
    const workspace = assembleWorkspace([], [], ["上游扫描失败"]);
    expect(workspace.files).toEqual([]);
    expect(workspace.problems).toEqual(["上游扫描失败"]);
  });

  it("reports a non-empty file that yields no sendable request", () => {
    const workspace = assembleWorkspace(
      [{ relativePath: "empty.http", content: "### 只有名字\n# 注释\n" }],
      [],
    );
    expect(workspace.files).toHaveLength(1);
    expect(workspace.files[0].requests).toEqual([]);
    expect(workspace.problems).toEqual(["empty.http 里没有可发送的请求"]);
  });

  it("does not report a problem for a whitespace-only file", () => {
    const workspace = assembleWorkspace([{ relativePath: "blank.http", content: "   \n" }], []);
    expect(workspace.files).toHaveLength(1);
    expect(workspace.problems).toEqual([]);
  });
});
