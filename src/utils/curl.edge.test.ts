import { describe, expect, it } from "vitest";
import { exportToCurl, interpolateText, parseCurl } from "./curl";
import type { EnvironmentData, RequestData } from "../types/api";

const baseRequest: RequestData = {
  id: "req_edge",
  name: "边界请求",
  method: "GET",
  url: "https://httpbin.org/get",
  headers: [],
  params: [],
  body: { body_type: "none", content: "" },
  auth: { auth_type: "none" },
};

describe("interpolateText edge cases", () => {
  it("trims whitespace around environment variable keys", () => {
    const env: EnvironmentData = {
      id: "e1",
      name: "环境",
      variables: [{ key: "  host  ", value: "https://httpbin.org", enabled: true }],
    };
    expect(interpolateText("{{host}}/get", env)).toBe("https://httpbin.org/get");
  });

  it("replaces a variable whose value is an empty string", () => {
    const env: EnvironmentData = {
      id: "e1",
      name: "环境",
      variables: [{ key: "empty", value: "", enabled: true }],
    };
    expect(interpolateText("prefix-{{empty}}-suffix", env)).toBe("prefix--suffix");
  });

  it("escapes regular-expression metacharacters in keys", () => {
    const env: EnvironmentData = {
      id: "e1",
      name: "环境",
      variables: [{ key: "a+b(c)", value: "ok", enabled: true }],
    };
    expect(interpolateText("{{a+b(c)}}", env)).toBe("ok");
  });

  it("leaves unsupported dynamic variables untouched", () => {
    expect(interpolateText("id={{$doesNotExist}}", null)).toBe("id={{$doesNotExist}}");
  });

  it("does not substitute variables whose key is blank", () => {
    const env: EnvironmentData = {
      id: "e1",
      name: "环境",
      variables: [{ key: "   ", value: "x", enabled: true }],
    };
    expect(interpolateText("{{host}}", env)).toBe("{{host}}");
  });
});

describe("exportToCurl edge cases", () => {
  it("exports a raw body without adding a Content-Type header", () => {
    const req: RequestData = {
      ...baseRequest,
      method: "POST",
      url: "https://httpbin.org/post",
      body: { body_type: "raw", content: 'a "b"\nnext' },
    };
    const curl = exportToCurl(req, null);
    expect(curl).toContain('-d "a \\"b\\" next"');
    expect(curl).not.toContain("Content-Type");
  });

  it("omits the body flags for json content that is only whitespace", () => {
    const req: RequestData = {
      ...baseRequest,
      method: "POST",
      url: "https://httpbin.org/post",
      body: { body_type: "json", content: "   " },
    };
    const curl = exportToCurl(req, null);
    expect(curl).not.toContain("-d");
    expect(curl).not.toContain("Content-Type");
  });

  it("does not emit an API key that is configured for the query string", () => {
    const req: RequestData = {
      ...baseRequest,
      auth: {
        auth_type: "apikey",
        api_key_name: "X-API-KEY",
        api_key_value: "key-123",
        api_key_in: "query",
      },
    };
    const curl = exportToCurl(req, null);
    expect(curl).not.toContain("X-API-KEY");
    expect(curl).not.toContain("key-123");
  });

  it("does not emit Basic auth without a username or Bearer auth without a token", () => {
    const basic = exportToCurl({ ...baseRequest, auth: { auth_type: "basic" } }, null);
    expect(basic).not.toContain("-u");

    const bearer = exportToCurl({ ...baseRequest, auth: { auth_type: "bearer", token: "" } }, null);
    expect(bearer).not.toContain("Authorization");
  });

  it("skips disabled params and params with a blank key", () => {
    const req: RequestData = {
      ...baseRequest,
      params: [
        { key: "  ", value: "blank", enabled: true },
        { key: "skip", value: "no", enabled: false },
        { key: "ok", value: "yes", enabled: true },
      ],
    };
    const curl = exportToCurl(req, null);
    expect(curl).toContain("ok=yes");
    expect(curl).not.toContain("blank");
    expect(curl).not.toContain("skip=no");
  });

  it("interpolates variables in param keys and values", () => {
    const env: EnvironmentData = {
      id: "e1",
      name: "环境",
      variables: [
        { key: "k", value: "page", enabled: true },
        { key: "v", value: "7", enabled: true },
      ],
    };
    const req: RequestData = {
      ...baseRequest,
      params: [{ key: "{{k}}", value: "{{v}}", enabled: true }],
    };
    expect(exportToCurl(req, env)).toContain("page=7");
  });
});

describe("parseCurl edge cases", () => {
  it("parses --data-raw as a raw body and defaults method to POST", () => {
    const parsed = parseCurl('curl "https://httpbin.org/post" --data-raw "hello world"');
    expect(parsed.method).toBe("POST");
    expect(parsed.body).toEqual({ body_type: "raw", content: "hello world" });
  });

  it("uppercases a lowercase method flag", () => {
    const parsed = parseCurl('curl -x put "https://httpbin.org/put"');
    expect(parsed.method).toBe("PUT");
  });

  it("parses a single-quoted URL", () => {
    const parsed = parseCurl("curl 'https://httpbin.org/get'");
    expect(parsed.url).toBe("https://httpbin.org/get");
    expect(parsed.method).toBe("GET");
  });

  it("keeps a non-Bearer Authorization header as a plain header", () => {
    const parsed = parseCurl('curl "https://httpbin.org/headers" -H "Authorization: Basic dXNlcjpwdw=="');
    expect(parsed.auth).toEqual({ auth_type: "none" });
    expect(parsed.headers).toEqual([
      { key: "Authorization", value: "Basic dXNlcjpwdw==", enabled: true },
    ]);
  });

  it("detects a JSON body even when it has leading whitespace", () => {
    const parsed = parseCurl("curl \"https://httpbin.org/post\" -d '  {\"a\":1}'");
    expect(parsed.body).toEqual({ body_type: "json", content: '  {"a":1}' });
  });

  it("leaves the URL empty when none is present", () => {
    const parsed = parseCurl("curl -X GET");
    expect(parsed.url).toBe("");
    expect(parsed.method).toBe("GET");
  });

  it("parses commands split across backslash-newline continuations", () => {
    const parsed = parseCurl('curl "https://httpbin.org/get" \\\n  -H "X-A: 1"');
    expect(parsed.url).toBe("https://httpbin.org/get");
    expect(parsed.headers).toEqual([{ key: "X-A", value: "1", enabled: true }]);
  });
});
