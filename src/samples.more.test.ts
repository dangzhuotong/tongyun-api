import { describe, expect, it } from "vitest";
import { builtinWorkspace } from "./samples";
import { resolveRequest } from "./parser/substitute";

describe("builtinWorkspace additional coverage", () => {
  it("resolves every sample request against both built-in environments", () => {
    const workspace = builtinWorkspace();
    for (const file of workspace.files) {
      for (const envName of ["httpbin", "local"]) {
        const variables = file.environments.variables[envName];
        for (const request of file.requests) {
          const label = `${file.path} ${envName} ${request.name}`;
          const resolved = resolveRequest(request, variables);
          expect(resolved.missing, label).toEqual([]);
          expect(resolved.unsupported, label).toEqual([]);
          expect(resolved.url.length, label).toBeGreaterThan(0);
        }
      }
    }
  });

  it("keeps variables unresolved in the raw parsed requests", () => {
    for (const file of builtinWorkspace().files) {
      for (const request of file.requests) {
        expect(request.url.startsWith("{{host}}"), request.name).toBe(true);
      }
    }
  });

  it("assigns unique ids derived from the path and source line", () => {
    const ids = builtinWorkspace().files.flatMap((file) =>
      file.requests.map((request) => request.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("httpbin/basics.http#4");
    expect(ids).toContain("httpbin/methods.http#18");
  });

  it("exposes both environments from the single public env file with no problems", () => {
    const env = builtinWorkspace().files[0].environments;
    expect(env.names).toEqual(["httpbin", "local"]);
    expect(env.problems).toEqual([]);
    expect(env.variables.local).toMatchObject({
      host: "http://127.0.0.1:8080",
      name: "local",
      token: "local-placeholder",
      "meta.source": "examples",
    });
  });

  it("keeps templated headers on the raw sample request", () => {
    const basics = builtinWorkspace().files[0];
    expect(basics.requests[1].headers).toEqual([
      { name: "Content-Type", value: "application/json" },
      { name: "Authorization", value: "Bearer {{token}}" },
    ]);
  });

  it("resolves the JSON body of the post sample with the chosen environment", () => {
    const basics = builtinWorkspace().files[0];
    const resolved = resolveRequest(basics.requests[1], basics.environments.variables.httpbin);
    expect(resolved.url).toBe("https://httpbin.org/post");
    expect(resolved.body).toBe(
      '{\n  "hello": "tongyun",\n  "from": "tongyun-api"\n}',
    );
  });
});
