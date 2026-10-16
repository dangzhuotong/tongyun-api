import { describe, expect, it } from "vitest";
import { builtinWorkspace } from "./samples";
import { buildTree } from "./model/workspace";
import { resolveRequest } from "./parser/substitute";

describe("builtinWorkspace edge cases", () => {
  it("exposes the public env file as the only source and no private keys", () => {
    const basics = builtinWorkspace().files[0];
    expect(basics.environments.names).toEqual(["httpbin", "local"]);
    expect(basics.environments.sources).toEqual([
      { path: "http-client.env.json", kind: "public" },
    ]);
    expect(basics.environments.privateKeys.httpbin).toEqual([]);
    expect(basics.environments.privateKeys.local).toEqual([]);
    expect(basics.environments.variables.httpbin["meta.source"]).toBe("examples");
  });

  it("nests both sample files under a single httpbin directory", () => {
    const workspace = builtinWorkspace();
    const tree = buildTree(workspace.files);
    expect(tree.files).toEqual([]);
    expect(tree.dirs.map((d) => d.name)).toEqual(["httpbin"]);
    expect(tree.dirs[0].files.map((f) => f.path)).toEqual([
      "httpbin/basics.http",
      "httpbin/methods.http",
    ]);
  });

  it("resolves sample headers and form bodies against the httpbin variables", () => {
    const workspace = builtinWorkspace();
    const basics = workspace.files[0];
    const methods = workspace.files[1];

    const first = resolveRequest(basics.requests[0], basics.environments.variables.httpbin);
    expect(first.headers).toEqual([
      { name: "Accept", value: "application/json" },
      { name: "X-Demo-Env", value: "httpbin" },
      { name: "X-Source", value: "examples" },
    ]);

    const form = resolveRequest(methods.requests[2], methods.environments.variables.httpbin);
    expect(form.body).toBe("note=tongyun-api&name=tongyun");
    expect(form.missing).toEqual([]);
  });

  it("resolves the local environment to a 127.0.0.1 base URL", () => {
    const basics = builtinWorkspace().files[0];
    const resolved = resolveRequest(basics.requests[0], basics.environments.variables.local);
    expect(resolved.url.startsWith("http://127.0.0.1:8080/")).toBe(true);
    expect(resolved.missing).toEqual([]);
  });
});
