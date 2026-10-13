import { describe, expect, it } from "vitest";
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
    expect(workspace.environments.variables.dev).toMatchObject({
      host: "http://127.0.0.1:9",
      token: "secret",
    });
    expect(workspace.environments.privateKeys.dev).toEqual(["token"]);

    const tree = buildTree(workspace.files);
    expect(tree.files.map((file) => file.path)).toEqual(["a.http"]);
    expect(tree.dirs[0].name).toBe("b");
    expect(tree.dirs[0].files[0].path).toBe("b/z.http");
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
