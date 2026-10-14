import { describe, expect, it } from "vitest";
import { builtinWorkspace } from "./samples";
import { resolveRequest } from "./parser/substitute";

describe("builtinWorkspace", () => {
  it("assembles the sample files and environment with no errors", () => {
    const workspace = builtinWorkspace();

    expect(workspace.problems).toEqual([]);
    expect(workspace.files).toHaveLength(2);
    expect(workspace.files.map((f) => f.path)).toEqual([
      "httpbin/basics.http",
      "httpbin/methods.http",
    ]);
  });

  it("correctly models httpbin/basics.http requests and environments", () => {
    const workspace = builtinWorkspace();
    const basics = workspace.files[0];

    expect(basics.path).toBe("httpbin/basics.http");
    expect(basics.warnings).toEqual([]);
    expect(basics.requests).toHaveLength(3);
    expect(basics.requests.map((r) => r.name)).toEqual([
      "查询参数",
      "提交 JSON",
      "回显请求头",
    ]);
    expect(basics.requests.map((r) => r.method)).toEqual(["GET", "POST", "GET"]);
    expect(basics.requests.map((r) => r.id)).toEqual([
      "httpbin/basics.http#4",
      "httpbin/basics.http#10",
      "httpbin/basics.http#20",
    ]);

    expect(basics.environments.names).toContain("httpbin");
    expect(basics.environments.names).toContain("local");
    expect(basics.environments.variables.httpbin).toMatchObject({
      host: "https://httpbin.org",
      name: "tongyun",
      token: "public-placeholder",
    });
  });

  it("correctly models httpbin/methods.http requests and strips script fences", () => {
    const workspace = builtinWorkspace();
    const methods = workspace.files[1];

    expect(methods.path).toBe("httpbin/methods.http");
    expect(methods.warnings).toEqual([]);
    expect(methods.requests).toHaveLength(4);
    expect(methods.requests.map((r) => r.name)).toEqual([
      "期望成功",
      "期望未找到",
      "提交表单",
      "脚本不会被发送",
    ]);
    expect(methods.requests.map((r) => r.method)).toEqual(["GET", "GET", "POST", "GET"]);
    expect(methods.requests.map((r) => r.id)).toEqual([
      "httpbin/methods.http#4",
      "httpbin/methods.http#8",
      "httpbin/methods.http#12",
      "httpbin/methods.http#18",
    ]);

    // The script fence in the fourth request should not be included in the body
    expect(methods.requests[3].body).toBe("");
  });

  it("allows every request in the sample workspace to resolve against httpbin variables", () => {
    const workspace = builtinWorkspace();
    for (const file of workspace.files) {
      const httpbinVars = file.environments.variables.httpbin;
      for (const request of file.requests) {
        const resolved = resolveRequest(request, httpbinVars);
        expect(resolved.missing, `${file.path} - ${request.name}`).toEqual([]);
        expect(resolved.url.startsWith("https://httpbin.org/")).toBe(true);
      }
    }
  });
});
