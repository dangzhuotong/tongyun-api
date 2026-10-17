import { describe, expect, it } from "vitest";
import { maskSecret, resolveRequest, substitute } from "./substitute";
import type { ParsedRequest } from "./httpFile";

describe("substitute additional edge cases", () => {
  it("does not treat a digit-leading brace pair as a variable", () => {
    const result = substitute("{{1abc}} {{_ok}}", { _ok: "yes" });
    expect(result.text).toBe("{{1abc}} yes");
    expect(result.missing).toEqual([]);
    expect(result.unsupported).toEqual([]);
  });

  it("inserts values literally even when they contain $ replacement tokens", () => {
    const result = substitute("{{a}}", { a: "$&$1" });
    expect(result.text).toBe("$&$1");
  });

  it("does not recursively substitute variable values", () => {
    const result = substitute("{{a}}", { a: "{{b}}", b: "B" });
    expect(result.text).toBe("{{b}}");
    expect(result.missing).toEqual([]);
    expect(result.unsupported).toEqual([]);
  });

  it("masks a short secret value entirely", () => {
    const result = substitute("{{token}}", { token: "abcd" }, {
      maskKeys: new Set(["token"]),
    });
    expect(result.text).toBe("••••");
  });

  it("ignores inherited properties on the variables object", () => {
    const variables = Object.create({ inherited: "x" }) as Record<string, string>;
    const result = substitute("{{inherited}}", variables);
    expect(result.text).toBe("{{inherited}}");
    expect(result.missing).toEqual(["inherited"]);
  });

  it("reports an unknown dynamic variable with punctuation as unsupported", () => {
    const result = substitute("{{$foo-bar}}", {}, { resolveDynamic: true });
    expect(result.text).toBe("{{$foo-bar}}");
    expect(result.unsupported).toEqual(["$foo-bar"]);
  });

  it("masks secrets found in header names and bodies via resolveRequest", () => {
    const request: ParsedRequest = {
      name: "带密钥的请求",
      method: "POST",
      url: "{{host}}/post",
      headers: [{ name: "X-Token-{{tokenName}}", value: "{{tokenValue}}" }],
      body: '{"secret":"{{tokenValue}}"}',
      line: 1,
    };

    const resolved = resolveRequest(
      request,
      { host: "https://httpbin.org", tokenName: "id", tokenValue: "abcdefgh" },
      { maskKeys: new Set(["tokenValue"]) },
    );

    expect(resolved.headers).toEqual([
      { name: "X-Token-id", value: "ab••••gh" },
    ]);
    expect(resolved.body).toBe('{"secret":"ab••••gh"}');
    expect(resolved.missing).toEqual([]);
  });
});

describe("maskSecret additional edge cases", () => {
  it("treats the threshold between short and long values at length four", () => {
    expect(maskSecret("abcd")).toBe("••••");
    expect(maskSecret("abcde")).toBe("ab••••de");
  });
});
