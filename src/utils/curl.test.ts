import { describe, expect, it } from "vitest";
import { exportToCurl, interpolateText, parseCurl } from "./curl";
import type { EnvironmentData, RequestData } from "../types/api";

describe("interpolateText", () => {
  it("returns empty string for empty input", () => {
    expect(interpolateText("", null)).toBe("");
  });

  it("returns original text when env is null", () => {
    expect(interpolateText("https://httpbin.org/get?user={{name}}", null)).toBe(
      "https://httpbin.org/get?user={{name}}",
    );
  });

  it("replaces enabled environment variables", () => {
    const env: EnvironmentData = {
      id: "test-env",
      name: "测试环境",
      variables: [
        { key: "host", value: "https://httpbin.org", enabled: true },
        { key: "name", value: "alice", enabled: true },
        { key: "disabledVar", value: "ignored", enabled: false },
      ],
    };

    const result = interpolateText(
      "{{host}}/get?name={{name}}&flag={{disabledVar}}",
      env,
    );
    expect(result).toBe("https://httpbin.org/get?name=alice&flag={{disabledVar}}");
  });

  it("handles variable keys with special characters safely", () => {
    const env: EnvironmentData = {
      id: "test-env",
      name: "测试环境",
      variables: [
        { key: "api.version", value: "v1", enabled: true },
        { key: "user[id]", value: "42", enabled: true },
      ],
    };

    const result = interpolateText("{{api.version}}/users/{{user[id]}}", env);
    expect(result).toBe("v1/users/42");
  });

  it("replaces dynamic variables like {{$uuid}} and {{$timestamp}}", () => {
    const result = interpolateText("id={{$uuid}}&time={{$timestamp}}", null);
    expect(result).toMatch(/^id=[0-9a-f-]{36}&time=\d{10}$/i);
  });
});

describe("exportToCurl", () => {
  const baseRequest: RequestData = {
    id: "req_1",
    name: "测试请求",
    method: "GET",
    url: "https://httpbin.org/get",
    headers: [],
    params: [],
    body: { body_type: "none", content: "" },
    auth: { auth_type: "none" },
  };

  it("exports a simple GET request", () => {
    const curl = exportToCurl(baseRequest, null);
    expect(curl).toBe('curl \\\n  "https://httpbin.org/get"');
  });

  it("exports non-GET methods with -X", () => {
    const req: RequestData = {
      ...baseRequest,
      method: "DELETE",
      url: "https://httpbin.org/delete",
    };
    const curl = exportToCurl(req, null);
    expect(curl).toBe('curl \\\n  -X DELETE \\\n  "https://httpbin.org/delete"');
  });

  it("appends query params to the URL", () => {
    const req: RequestData = {
      ...baseRequest,
      params: [
        { key: "query", value: "vitest", enabled: true },
        { key: "page", value: "1", enabled: true },
        { key: "disabled", value: "no", enabled: false },
      ],
    };
    const curl = exportToCurl(req, null);
    expect(curl).toContain("https://httpbin.org/get?query=vitest&page=1");
    expect(curl).not.toContain("disabled");
  });

  it("exports headers", () => {
    const req: RequestData = {
      ...baseRequest,
      headers: [
        { key: "Accept", value: "application/json", enabled: true },
        { key: "X-Trace-Id", value: "abc-123", enabled: true },
        { key: "X-Disabled", value: "skip", enabled: false },
      ],
    };
    const curl = exportToCurl(req, null);
    expect(curl).toContain('-H "Accept: application/json"');
    expect(curl).toContain('-H "X-Trace-Id: abc-123"');
    expect(curl).not.toContain("X-Disabled");
  });

  it("exports Bearer auth", () => {
    const req: RequestData = {
      ...baseRequest,
      auth: {
        auth_type: "bearer",
        token: "my-jwt-token",
      },
    };
    const curl = exportToCurl(req, null);
    expect(curl).toContain('-H "Authorization: Bearer my-jwt-token"');
  });

  it("exports Basic auth", () => {
    const req: RequestData = {
      ...baseRequest,
      auth: {
        auth_type: "basic",
        username: "admin",
        password: "secretpassword",
      },
    };
    const curl = exportToCurl(req, null);
    expect(curl).toContain('-u "admin:secretpassword"');
  });

  it("exports API Key in header", () => {
    const req: RequestData = {
      ...baseRequest,
      auth: {
        auth_type: "apikey",
        api_key_name: "X-API-KEY",
        api_key_value: "key-123",
        api_key_in: "header",
      },
    };
    const curl = exportToCurl(req, null);
    expect(curl).toContain('-H "X-API-KEY: key-123"');
  });

  it("exports JSON body with Content-Type header and escaped quotes", () => {
    const req: RequestData = {
      ...baseRequest,
      method: "POST",
      url: "https://httpbin.org/post",
      body: {
        body_type: "json",
        content: '{\n  "title": "hello"\n}',
      },
    };
    const curl = exportToCurl(req, null);
    expect(curl).toContain('-H "Content-Type: application/json"');
    expect(curl).toContain('-d "{   \\"title\\": \\"hello\\" }"');
  });

  it("exports form-urlencoded body", () => {
    const req: RequestData = {
      ...baseRequest,
      method: "POST",
      url: "https://httpbin.org/post",
      body: {
        body_type: "form-urlencoded",
        content: "a=1&b=2",
      },
    };
    const curl = exportToCurl(req, null);
    expect(curl).toContain('-H "Content-Type: application/x-www-form-urlencoded"');
    expect(curl).toContain('-d "a=1&b=2"');
  });

  it("interpolates variables in curl output when env is provided", () => {
    const env: EnvironmentData = {
      id: "env1",
      name: "开发环境",
      variables: [
        { key: "host", value: "https://httpbin.org", enabled: true },
        { key: "token", value: "tok-secret", enabled: true },
      ],
    };
    const req: RequestData = {
      ...baseRequest,
      url: "{{host}}/get",
      auth: {
        auth_type: "bearer",
        token: "{{token}}",
      },
    };
    const curl = exportToCurl(req, env);
    expect(curl).toContain('"https://httpbin.org/get"');
    expect(curl).toContain('-H "Authorization: Bearer tok-secret"');
  });
});

describe("parseCurl", () => {
  it("throws error if command does not start with curl", () => {
    expect(() => parseCurl("wget https://httpbin.org/get")).toThrow(
      "请输入以 curl 开头的有效命令",
    );
  });

  it("parses a basic GET curl command", () => {
    const parsed = parseCurl('curl "https://httpbin.org/get"');
    expect(parsed.method).toBe("GET");
    expect(parsed.url).toBe("https://httpbin.org/get");
    expect(parsed.headers).toEqual([]);
    expect(parsed.body?.body_type).toBe("none");
  });

  it("parses method from -X flag", () => {
    const parsed = parseCurl('curl -X PUT "https://httpbin.org/put"');
    expect(parsed.method).toBe("PUT");
    expect(parsed.url).toBe("https://httpbin.org/put");
  });

  it("parses headers and extracts Bearer authorization", () => {
    const cmd = `curl "https://httpbin.org/headers" \\
      -H "Accept: application/json" \\
      -H "Authorization: Bearer secret-tok" \\
      -H "X-Custom: test"`;

    const parsed = parseCurl(cmd);
    expect(parsed.auth).toEqual({
      auth_type: "bearer",
      token: "secret-tok",
    });
    expect(parsed.headers).toEqual([
      { key: "Accept", value: "application/json", enabled: true },
      { key: "X-Custom", value: "test", enabled: true },
    ]);
  });

  it("parses JSON body and defaults method to POST if previously GET", () => {
    const cmd = `curl "https://httpbin.org/post" \\
      -H "Content-Type: application/json" \\
      -d '{"name": "tongyun"}'`;

    const parsed = parseCurl(cmd);
    expect(parsed.method).toBe("POST");
    expect(parsed.body).toEqual({
      body_type: "json",
      content: '{"name": "tongyun"}',
    });
  });

  it("parses raw data body with --data flag", () => {
    const cmd = `curl "https://httpbin.org/post" \\
      --data "raw-plain-text"`;

    const parsed = parseCurl(cmd);
    expect(parsed.method).toBe("POST");
    expect(parsed.body).toEqual({
      body_type: "raw",
      content: "raw-plain-text",
    });
  });
});
