import { describe, expect, it } from "vitest";
import { exportToCurl, interpolateText, parseCurl } from "./curl";
import type { EnvironmentData, RequestData } from "../types/api";

const baseRequest: RequestData = {
  id: "req_more",
  name: "补充测试请求",
  method: "GET",
  url: "https://httpbin.org/get",
  headers: [],
  params: [],
  body: { body_type: "none", content: "" },
  auth: { auth_type: "none" },
};

describe("interpolateText additional edge cases", () => {
  it("re-substitutes when a later variable references the replacement text", () => {
    const env: EnvironmentData = {
      id: "e1",
      name: "环境",
      variables: [
        { key: "a", value: "{{b}}", enabled: true },
        { key: "b", value: "B", enabled: true },
      ],
    };
    expect(interpolateText("{{a}}", env)).toBe("B");
  });

  it("does not re-substitute text produced by an already-processed variable", () => {
    const env: EnvironmentData = {
      id: "e1",
      name: "环境",
      variables: [
        { key: "b", value: "B", enabled: true },
        { key: "a", value: "{{b}}", enabled: true },
      ],
    };
    expect(interpolateText("{{a}}", env)).toBe("{{b}}");
  });

  it("resolves a dynamic variable produced by a static replacement", () => {
    const env: EnvironmentData = {
      id: "e1",
      name: "环境",
      variables: [{ key: "wrap", value: "{{$timestamp}}", enabled: true }],
    };
    expect(interpolateText("t={{wrap}}", env)).toMatch(/^t=\d{10}$/);
  });

  it("resolves only the first occurrence of each distinct variable name once per key", () => {
    const env: EnvironmentData = {
      id: "e1",
      name: "环境",
      variables: [{ key: "v", value: "x", enabled: true }],
    };
    expect(interpolateText("{{v}}-{{v}}-{{v}}", env)).toBe("x-x-x");
  });
});

describe("exportToCurl additional edge cases", () => {
  it("prefixes a protocol-less URL and URL-encodes parameter values", () => {
    const req: RequestData = {
      ...baseRequest,
      url: "localhost:3000/search",
      params: [{ key: "q", value: "a b&c", enabled: true }],
    };
    const curl = exportToCurl(req, null);
    expect(curl).toContain('"http://localhost:3000/search?q=a+b%26c"');
  });

  it("appends params to a URL that already has a query string", () => {
    const req: RequestData = {
      ...baseRequest,
      url: "https://httpbin.org/get?existing=1",
      params: [{ key: "added", value: "2", enabled: true }],
    };
    const curl = exportToCurl(req, null);
    expect(curl).toContain("existing=1&added=2");
  });

  it("still exports a body for a GET request that carries one", () => {
    const req: RequestData = {
      ...baseRequest,
      body: { body_type: "raw", content: "plain" },
    };
    const curl = exportToCurl(req, null);
    expect(curl).not.toContain("-X");
    expect(curl).toContain('-d "plain"');
  });

  it("does not emit an API key that has no explicit header location", () => {
    const req: RequestData = {
      ...baseRequest,
      auth: { auth_type: "apikey", api_key_name: "X-API-KEY", api_key_value: "v" },
    };
    expect(exportToCurl(req, null)).not.toContain("X-API-KEY");
  });

  it("emits an empty password for Basic auth without one", () => {
    const req: RequestData = {
      ...baseRequest,
      auth: { auth_type: "basic", username: "user" },
    };
    expect(exportToCurl(req, null)).toContain('-u "user:"');
  });
});

describe("parseCurl additional edge cases", () => {
  it("keeps an explicit method when a data body is present", () => {
    const parsed = parseCurl('curl -X PUT "https://httpbin.org/put" -d "{}"');
    expect(parsed.method).toBe("PUT");
    expect(parsed.body).toEqual({ body_type: "json", content: "{}" });
  });

  it("ignores -H arguments that contain no colon", () => {
    const parsed = parseCurl('curl "https://httpbin.org/get" -H "NoColon"');
    expect(parsed.headers).toEqual([]);
  });

  it("extracts a Bearer token case-insensitively and trims it", () => {
    const parsed = parseCurl(
      'curl "https://httpbin.org/get" -H "authorization: BEARER tok-123"',
    );
    expect(parsed.auth).toEqual({ auth_type: "bearer", token: "tok-123" });
    expect(parsed.headers).toEqual([]);
  });

  it("tolerates leading and trailing whitespace around the command", () => {
    const parsed = parseCurl('   curl "https://httpbin.org/get"   ');
    expect(parsed.url).toBe("https://httpbin.org/get");
    expect(parsed.method).toBe("GET");
  });
});
