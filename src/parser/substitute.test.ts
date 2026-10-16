import { describe, expect, it } from "vitest";
import {
  generateDynamicVariable,
  maskSecret,
  substitute,
  resolveRequest,
} from "./substitute";
import type { ParsedRequest } from "./httpFile";

describe("generateDynamicVariable", () => {
  it("generates UUID for $uuid and $random.uuid", () => {
    const uuid1 = generateDynamicVariable("$uuid");
    const uuid2 = generateDynamicVariable("$random.uuid");

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid1).toMatch(uuidRegex);
    expect(uuid2).toMatch(uuidRegex);
  });

  it("generates timestamp for $timestamp and ISO timestamp for $isoTimestamp", () => {
    const timestamp = generateDynamicVariable("$timestamp");
    expect(timestamp).toMatch(/^\d{10}$/);

    const iso = generateDynamicVariable("$isoTimestamp");
    expect(iso).toBeDefined();
    expect(new Date(iso!).toISOString()).toBe(iso);
  });

  it("generates random integer for $randomInt and $random.integer", () => {
    const num1 = parseInt(generateDynamicVariable("$randomInt")!, 10);
    const num2 = parseInt(generateDynamicVariable("$random.integer")!, 10);

    expect(num1).toBeGreaterThanOrEqual(0);
    expect(num1).toBeLessThan(10000);
    expect(num2).toBeGreaterThanOrEqual(0);
    expect(num2).toBeLessThan(10000);
  });

  it("generates random email for $random.email", () => {
    const email = generateDynamicVariable("$random.email");
    expect(email).toMatch(/^user_\d+@example\.com$/);
  });

  it("generates random alphabetic string for $random.alphabetic", () => {
    const alpha = generateDynamicVariable("$random.alphabetic");
    expect(typeof alpha).toBe("string");
    expect(alpha!.length).toBeGreaterThanOrEqual(1);
    expect(alpha!.length).toBeLessThanOrEqual(6);
  });

  it("returns null for unknown dynamic variable names", () => {
    expect(generateDynamicVariable("$unknownVar")).toBeNull();
    expect(generateDynamicVariable("regularVar")).toBeNull();
  });
});

describe("maskSecret", () => {
  it("masks values with length <= 4 entirely with bullets", () => {
    expect(maskSecret("")).toBe("••••");
    expect(maskSecret("a")).toBe("••••");
    expect(maskSecret("12")).toBe("••••");
    expect(maskSecret("pass")).toBe("••••");
  });

  it("masks values with length > 4 preserving first 2 and last 2 characters", () => {
    expect(maskSecret("12345")).toBe("12••••45");
    expect(maskSecret("super-secret-token")).toBe("su••••en");
  });
});

describe("substitute", () => {
  it("substitutes static environment variables with or without inner whitespace", () => {
    const input = "{{host}}/api/v1/users?name={{ name }}&env={{env}}";
    const variables = {
      host: "https://httpbin.org",
      name: "tongyun",
      env: "staging",
    };

    const result = substitute(input, variables);
    expect(result.text).toBe("https://httpbin.org/api/v1/users?name=tongyun&env=staging");
    expect(result.missing).toEqual([]);
    expect(result.unsupported).toEqual([]);
  });

  it("records missing variables without breaking other substitutions", () => {
    const input = "{{host}}/get?found={{found}}&missing={{notFound}}";
    const result = substitute(input, { host: "https://httpbin.org", found: "yes" });

    expect(result.text).toBe("https://httpbin.org/get?found=yes&missing={{notFound}}");
    expect(result.missing).toEqual(["notFound"]);
    expect(result.unsupported).toEqual([]);
  });

  it("marks dynamic variables as unsupported when resolveDynamic is not enabled", () => {
    const input = "{{host}}/post?id={{$uuid}}";
    const result = substitute(input, { host: "https://httpbin.org" });

    expect(result.text).toBe("https://httpbin.org/post?id={{$uuid}}");
    expect(result.unsupported).toEqual(["$uuid"]);
    expect(result.missing).toEqual([]);
  });

  it("resolves dynamic variables when resolveDynamic is true", () => {
    const input = "trace={{$uuid}}&created={{$timestamp}}";
    const result = substitute(input, {}, { resolveDynamic: true });

    expect(result.missing).toEqual([]);
    expect(result.unsupported).toEqual([]);
    expect(result.text).toMatch(/^trace=[a-f0-9-]{36}&created=\d{10}$/);
  });

  it("marks unknown dynamic variables as unsupported even when resolveDynamic is true", () => {
    const input = "val={{$nonExistent}}";
    const result = substitute(input, {}, { resolveDynamic: true });

    expect(result.text).toBe("val={{$nonExistent}}");
    expect(result.unsupported).toEqual(["$nonExistent"]);
  });

  it("masks variables present in maskKeys", () => {
    const input = "Bearer {{token}} for {{username}}";
    const variables = {
      token: "secret-token-value",
      username: "admin",
    };
    const maskKeys = new Set(["token"]);

    const result = substitute(input, variables, { maskKeys });
    expect(result.text).toBe("Bearer se••••ue for admin");
  });

  it("returns empty text for empty input and leaves plain text untouched", () => {
    expect(substitute("", { host: "x" })).toEqual({
      text: "",
      missing: [],
      unsupported: [],
    });
    expect(substitute("no variables here", {})).toEqual({
      text: "no variables here",
      missing: [],
      unsupported: [],
    });
  });

  it("treats a variable defined as an empty string as present", () => {
    const result = substitute("value=[{{empty}}]", { empty: "" });
    expect(result.text).toBe("value=[]");
    expect(result.missing).toEqual([]);
  });

  it("supports variable names containing dots and dashes", () => {
    const result = substitute("{{auth.token}}|{{server-host}}", {
      "auth.token": "abc",
      "server-host": "httpbin.org",
    });
    expect(result.text).toBe("abc|httpbin.org");
    expect(result.missing).toEqual([]);
  });

  it("deduplicates repeated missing variables", () => {
    const result = substitute("{{gone}}/{{gone}}?again={{gone}}", {});
    expect(result.missing).toEqual(["gone"]);
  });

  it("deduplicates repeated unsupported dynamic variables and tolerates whitespace", () => {
    const result = substitute("{{ $uuid }}-{{$uuid}}", {});
    expect(result.text).toBe("{{ $uuid }}-{{$uuid}}");
    expect(result.unsupported).toEqual(["$uuid"]);
  });

  it("leaves malformed or incomplete braces untouched", () => {
    const result = substitute("{{ }} { {a} } {{a", {});
    expect(result.text).toBe("{{ }} { {a} } {{a");
    expect(result.missing).toEqual([]);
    expect(result.unsupported).toEqual([]);
  });
});

describe("resolveRequest", () => {
  it("resolves method, url, headers, and body of a ParsedRequest", () => {
    const req: ParsedRequest = {
      name: "测试请求",
      method: "POST",
      url: "{{host}}/post?tenant={{tenant}}",
      headers: [
        { name: "Authorization", value: "Bearer {{token}}" },
        { name: "X-Trace-{{traceHeader}}", value: "{{traceId}}" },
      ],
      body: '{"username":"{{name}}","env":"{{env}}"}',
      line: 1,
    };

    const variables = {
      host: "https://httpbin.org",
      tenant: "tongyun",
      token: "secret-token-123456",
      traceHeader: "Id",
      traceId: "tr-999",
      name: "tester",
      env: "test",
    };

    const maskKeys = new Set(["token"]);
    const resolved = resolveRequest(req, variables, { maskKeys });

    expect(resolved.method).toBe("POST");
    expect(resolved.url).toBe("https://httpbin.org/post?tenant=tongyun");
    expect(resolved.headers).toEqual([
      { name: "Authorization", value: "Bearer se••••56" },
      { name: "X-Trace-Id", value: "tr-999" },
    ]);
    expect(resolved.body).toBe('{"username":"tester","env":"test"}');
    expect(resolved.missing).toEqual([]);
    expect(resolved.unsupported).toEqual([]);
  });

  it("aggregates and sorts all missing and unsupported variables from url, headers, and body", () => {
    const req: ParsedRequest = {
      name: "有缺失的请求",
      method: "GET",
      url: "{{host}}/{{path}}",
      headers: [{ name: "X-Var", value: "{{missingHeader}}" }],
      body: "body with {{$uuid}} and {{missingBody}}",
      line: 1,
    };

    const resolved = resolveRequest(req, { host: "https://httpbin.org" });

    expect(resolved.missing).toEqual(["missingBody", "missingHeader", "path"]);
    expect(resolved.unsupported).toEqual(["$uuid"]);
  });

  it("handles a request with no headers and an empty body", () => {
    const req: ParsedRequest = {
      name: "最小请求",
      method: "GET",
      url: "https://httpbin.org/get",
      headers: [],
      body: "",
      line: 1,
    };

    const resolved = resolveRequest(req, {});
    expect(resolved).toEqual({
      method: "GET",
      url: "https://httpbin.org/get",
      headers: [],
      body: "",
      missing: [],
      unsupported: [],
    });
  });

  it("resolves dynamic variables and masks secrets across url and body", () => {
    const req: ParsedRequest = {
      name: "动态请求",
      method: "POST",
      url: "{{host}}/post?id={{$uuid}}",
      headers: [],
      body: '{"token":"{{token}}"}',
      line: 1,
    };

    const resolved = resolveRequest(req, { host: "https://httpbin.org", token: "abcdefgh" }, {
      maskKeys: new Set(["token"]),
      resolveDynamic: true,
    });

    expect(resolved.url).toMatch(/^https:\/\/httpbin\.org\/post\?id=[a-f0-9-]{36}$/);
    expect(resolved.body).toBe('{"token":"ab••••gh"}');
    expect(resolved.missing).toEqual([]);
    expect(resolved.unsupported).toEqual([]);
  });
});
