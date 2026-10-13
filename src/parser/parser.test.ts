import { describe, expect, it } from "vitest";
import basicsText from "../../examples/httpbin/basics.http?raw";
import methodsText from "../../examples/httpbin/methods.http?raw";
import envText from "../../examples/http-client.env.json?raw";
import { mergeEnvironmentLayers } from "./env";
import { parseHttpFile } from "./httpFile";
import { resolveRequest, substitute } from "./substitute";

describe("parseHttpFile", () => {
  it("splits requests on ### and keeps the name", () => {
    const parsed = parseHttpFile(`### 查询
GET https://httpbin.org/get
Accept: application/json

### 提交
POST https://httpbin.org/post
Content-Type: application/json

{"ok":true}
`);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.requests).toHaveLength(2);
    expect(parsed.requests[0]).toMatchObject({
      name: "查询",
      method: "GET",
      url: "https://httpbin.org/get",
      line: 2,
      headers: [{ name: "Accept", value: "application/json" }],
      body: "",
    });
    expect(parsed.requests[1].body).toBe('{"ok":true}');
    expect(parsed.requests[1].line).toBe(6);
  });

  it("accepts a file that starts without a separator", () => {
    const parsed = parseHttpFile("GET https://httpbin.org/get\n");
    expect(parsed.requests[0].name).toBe("GET https://httpbin.org/get");
    expect(parsed.requests[0].method).toBe("GET");
  });

  it("defaults a bare URL to GET and strips the HTTP version", () => {
    const parsed = parseHttpFile("https://httpbin.org/get\n\n###\nPOST {{host}}/post HTTP/1.1\n");
    expect(parsed.requests.map((request) => [request.method, request.url])).toEqual([
      ["GET", "https://httpbin.org/get"],
      ["POST", "{{host}}/post"],
    ]);
  });

  it("ignores comments and does not send response handlers", () => {
    const parsed = parseHttpFile(`### 带回显脚本
# 这是注释
// 这也是注释
GET {{host}}/get
Accept: application/json

{"draft":true}

> {%
client.test("ok", function() {
  client.assert(response.status === 200);
});
%}
`);
    expect(parsed.requests[0].headers).toEqual([{ name: "Accept", value: "application/json" }]);
    expect(parsed.requests[0].body).toBe('{"draft":true}');
  });

  it("skips pre-request scripts", () => {
    const parsed = parseHttpFile(`< {%
request.variables.set("id", "1")
%}
GET https://httpbin.org/get?id=1
`);
    expect(parsed.requests[0].url).toBe("https://httpbin.org/get?id=1");
    expect(parsed.requests[0].body).toBe("");
  });

  it("handles CRLF and a body that starts without a blank line", () => {
    const parsed = parseHttpFile("### 紧凑\r\nPOST https://httpbin.org/post\r\nContent-Type: text/plain\r\nhello\r\n");
    expect(parsed.requests[0].headers).toEqual([{ name: "Content-Type", value: "text/plain" }]);
    expect(parsed.requests[0].body).toBe("hello");
  });

  it("warns when the body points at an external file", () => {
    const parsed = parseHttpFile("POST https://httpbin.org/post\n\n< ./payload.json\n");
    expect(parsed.warnings[0].message).toContain("外部文件");
    expect(parsed.requests[0].body).toBe("< ./payload.json");
  });

  it("uses # @name and lets it override the ### title", () => {
    const parsed = parseHttpFile(`# @name login
POST https://httpbin.org/login

### 标题
// @name profile
GET https://httpbin.org/get
`);
    expect(parsed.requests.map((request) => request.name)).toEqual(["login", "profile"]);
  });

  it("joins indented query lines into the URL and trims header values", () => {
    const parsed = parseHttpFile(`GET https://httpbin.org/get
    ?a=1
    &b=2
X-A: v   
Accept: application/json
`);
    expect(parsed.requests[0].url).toBe("https://httpbin.org/get?a=1&b=2");
    expect(parsed.requests[0].headers).toEqual([
      { name: "X-A", value: "v" },
      { name: "Accept", value: "application/json" },
    ]);
    expect(parsed.requests[0].body).toBe("");
  });

  it("reads a JSON body that is missing the blank line and warns", () => {
    const parsed = parseHttpFile('POST https://httpbin.org/post\n{"a":1}\n');
    expect(parsed.requests[0].headers).toEqual([]);
    expect(parsed.requests[0].body).toBe('{"a":1}');
    expect(parsed.warnings[0].message).toContain("空行");
  });

  it("reports a separator that never becomes a request", () => {
    const parsed = parseHttpFile("### 只有名字\n# 注释\n");
    expect(parsed.requests).toHaveLength(0);
    expect(parsed.warnings[0].message).toContain("没有请求行");
  });
});

describe("environments and substitution", () => {
  it("flattens nested values and lets private override public", () => {
    const merged = mergeEnvironmentLayers([
      {
        path: "http-client.env.json",
        kind: "public",
        content: JSON.stringify({
          httpbin: { host: "https://httpbin.org", auth: { token: "public" }, count: 1 },
          local: { host: "http://127.0.0.1:8080" },
        }),
      },
      {
        path: "http-client.private.env.json",
        kind: "private",
        content: JSON.stringify({ httpbin: { auth: { token: "secret" } } }),
      },
    ]);
    expect(merged.names).toEqual(["httpbin", "local"]);
    expect(merged.variables.httpbin).toMatchObject({
      host: "https://httpbin.org",
      "auth.token": "secret",
      count: "1",
    });
    expect(merged.privateKeys.httpbin).toEqual(["auth.token"]);
    expect(merged.variables.local.host).toBe("http://127.0.0.1:8080");
  });

  it("lets a closer public layer replace a private value", () => {
    const merged = mergeEnvironmentLayers([
      {
        path: "http-client.private.env.json",
        kind: "private",
        content: JSON.stringify({ dev: { token: "secret" } }),
      },
      {
        path: "nested/http-client.env.json",
        kind: "public",
        content: JSON.stringify({ dev: { token: "override" } }),
      },
    ]);
    expect(merged.variables.dev.token).toBe("override");
    expect(merged.privateKeys.dev).toEqual([]);
  });

  it("records invalid environment JSON", () => {
    const merged = mergeEnvironmentLayers([
      { path: "http-client.env.json", kind: "public", content: "{not json" },
    ]);
    expect(merged.names).toEqual([]);
    expect(merged.problems[0]).toContain("不是合法 JSON");
  });

  it("substitutes repeated variables and lists missing names", () => {
    const result = substitute("{{ host }}/{{name}}/{{name}}/{{missing}}", {
      host: "https://httpbin.org",
      name: "tongyun",
    });
    expect(result.text).toBe("https://httpbin.org/tongyun/tongyun/{{missing}}");
    expect(result.missing).toEqual(["missing"]);
    expect(result.unsupported).toEqual([]);
  });

  it("reports dynamic variables instead of sending them unchanged", () => {
    const parsed = parseHttpFile("POST {{host}}/post\n\n{{$uuid}}\n");
    const resolved = resolveRequest(parsed.requests[0], { host: "https://httpbin.org" });
    expect(resolved.url).toBe("https://httpbin.org/post");
    expect(resolved.body).toBe("{{$uuid}}");
    expect(resolved.missing).toEqual([]);
    expect(resolved.unsupported).toEqual(["$uuid"]);
    const masked = resolveRequest(
      parseHttpFile("GET {{host}}/get\nAuthorization: Bearer {{token}}\n").requests[0],
      { host: "https://httpbin.org", token: "token-a" },
      { maskKeys: new Set(["token"]) },
    );
    expect(masked.headers[0].value).toBe("Bearer to••••-a");
    expect(masked.url).toBe("https://httpbin.org/get");
  });

  it("resolves a whole request", () => {
    const parsed = parseHttpFile(`### 提交
POST {{host}}/post
X-Token: {{auth.token}}

{"name":"{{name}}"}
`);
    const resolved = resolveRequest(parsed.requests[0], {
      host: "https://httpbin.org",
      name: "tongyun",
      "auth.token": "public-placeholder",
    });
    expect(resolved.url).toBe("https://httpbin.org/post");
    expect(resolved.headers[0].value).toBe("public-placeholder");
    expect(resolved.body).toBe('{"name":"tongyun"}');
    expect(resolved.missing).toEqual([]);
  });
});

describe("examples", () => {
  it("parses the httpbin samples against the public env", () => {
    const merged = mergeEnvironmentLayers([
      {
        path: "http-client.env.json",
        kind: "public",
        content: envText,
      },
    ]);
    const basics = parseHttpFile(basicsText);
    const methods = parseHttpFile(methodsText);
    expect(basics.warnings).toEqual([]);
    expect(basics.requests.map((request) => request.name)).toEqual([
      "查询参数",
      "提交 JSON",
      "回显请求头",
    ]);
    expect(methods.warnings).toEqual([]);
    expect(methods.requests.map((request) => request.name)).toEqual([
      "期望成功",
      "期望未找到",
      "提交表单",
      "脚本不会被发送",
    ]);
    expect(methods.requests[3].body).toBe("");
    for (const request of [...basics.requests, ...methods.requests]) {
      const resolved = resolveRequest(request, merged.variables.httpbin);
      expect(resolved.missing, request.name).toEqual([]);
      expect(resolved.url.startsWith("https://httpbin.org/"), request.name).toBe(true);
    }
    const local = resolveRequest(basics.requests[0], merged.variables.local);
    expect(local.url.startsWith("http://127.0.0.1:8080/")).toBe(true);
  });
});
