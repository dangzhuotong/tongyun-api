import { describe, expect, it } from "vitest";
import { resolveRequest } from "../parser/substitute";
import { assembleWorkspace, buildTree, prettyBody } from "./workspace";

describe("assembleWorkspace", () => {
  it("orders files, nests the tree, and overlays the nearer env", () => {
    const workspace = assembleWorkspace(
      [
        { relativePath: "b/z.http", content: "GET {{host}}/z\n" },
        { relativePath: "a.http", content: "### 根\nGET {{host}}/a\n" },
      ],
      [
        {
          relativePath: "http-client.env.json",
          kind: "public",
          content: JSON.stringify({ dev: { host: "https://httpbin.org", token: "public" } }),
        },
        {
          relativePath: "http-client.private.env.json",
          kind: "private",
          content: JSON.stringify({ dev: { token: "secret" } }),
        },
        {
          relativePath: "b/http-client.env.json",
          kind: "public",
          content: JSON.stringify({ dev: { host: "http://127.0.0.1:9" } }),
        },
      ],
    );

    expect(workspace.files.map((file) => file.path)).toEqual(["a.http", "b/z.http"]);
    expect(workspace.files[0].requests[0].id).toBe("a.http#2");
    expect(workspace.files[0].environments.variables.dev).toEqual({
      host: "https://httpbin.org",
      token: "secret",
    });
    expect(workspace.files[0].environments.privateKeys.dev).toEqual(["token"]);
    expect(workspace.files[1].environments.variables.dev).toEqual({
      host: "http://127.0.0.1:9",
      token: "secret",
    });
    expect(workspace.files[1].environments.privateKeys.dev).toEqual(["token"]);

    const tree = buildTree(workspace.files);
    expect(tree.files.map((file) => file.path)).toEqual(["a.http"]);
    expect(tree.dirs[0].name).toBe("b");
    expect(tree.dirs[0].files[0].path).toBe("b/z.http");
  });

  it("does not leak a sibling directory's private token", () => {
    const workspace = assembleWorkspace(
      [
        {
          relativePath: "a/a.http",
          content: "GET {{host}}/get\nAuthorization: Bearer {{token}}\n",
        },
        {
          relativePath: "b/b.http",
          content: "GET {{host}}/get\nAuthorization: Bearer {{token}}\n",
        },
      ],
      [
        {
          relativePath: "a/http-client.env.json",
          kind: "public",
          content: JSON.stringify({ dev: { host: "https://httpbin.org", token: "token-a" } }),
        },
        {
          relativePath: "b/http-client.private.env.json",
          kind: "private",
          content: JSON.stringify({ dev: { token: "token-b" } }),
        },
      ],
    );

    const fileA = workspace.files[0];
    const fileB = workspace.files[1];
    expect(fileA.environments.variables.dev).toEqual({
      host: "https://httpbin.org",
      token: "token-a",
    });
    expect(fileA.environments.privateKeys.dev).toEqual([]);
    const resolvedA = resolveRequest(fileA.requests[0], fileA.environments.variables.dev);
    expect(resolvedA.url).toBe("https://httpbin.org/get");
    expect(resolvedA.headers[0].value).toBe("Bearer token-a");

    expect(fileB.environments.variables.dev).toEqual({ token: "token-b" });
    expect(fileB.environments.privateKeys.dev).toEqual(["token"]);
    const resolvedB = resolveRequest(fileB.requests[0], fileB.environments.variables.dev);
    expect(resolvedB.headers[0].value).toBe("Bearer token-b");
    expect(resolvedB.missing).toEqual(["host"]);
  });
});

describe("prettyBody", () => {
  it("pretty-prints JSON and leaves other text alone", () => {
    expect(prettyBody('{"b":1,"a":[2]}', "application/json").text).toBe(
      '{\n  "b": 1,\n  "a": [\n    2\n  ]\n}',
    );
    expect(prettyBody("hello", "text/plain")).toEqual({ text: "hello", json: false });
    expect(prettyBody("{not", "application/json").json).toBe(false);
  });
});
