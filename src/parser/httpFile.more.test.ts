import { describe, expect, it } from "vitest";
import { parseHttpFile } from "./httpFile";

describe("parseHttpFile additional edge cases", () => {
  describe("request lines", () => {
    it("uppercases a lowercase method", () => {
      const parsed = parseHttpFile("get https://httpbin.org/get\n");
      expect(parsed.warnings).toEqual([]);
      expect(parsed.requests[0].method).toBe("GET");
      expect(parsed.requests[0].name).toBe("GET https://httpbin.org/get");
    });

    it("keeps custom method names containing dashes", () => {
      const parsed = parseHttpFile("M-SEARCH https://httpbin.org/get\n");
      expect(parsed.requests[0].method).toBe("M-SEARCH");
    });

    it("strips an HTTP/2 version token from the request line", () => {
      const parsed = parseHttpFile("POST {{host}}/post HTTP/2\n");
      expect(parsed.requests[0]).toMatchObject({ method: "POST", url: "{{host}}/post" });
    });

    it("accepts an uppercase scheme in a bare URL", () => {
      const parsed = parseHttpFile("HTTP://httpbin.org/get\n");
      expect(parsed.requests[0]).toMatchObject({
        method: "GET",
        url: "HTTP://httpbin.org/get",
      });
    });

    it("truncates an over-long URL in the fallback request name", () => {
      const url = "https://httpbin.org/get?" + "a".repeat(80);
      expect(url.length).toBeGreaterThan(72);
      const parsed = parseHttpFile(`${url}\n`);
      expect(parsed.requests[0].name).toBe(`GET ${url.slice(0, 69)}…`);
    });

    it("warns when the request line only contains a method", () => {
      const parsed = parseHttpFile("GET\n");
      expect(parsed.requests).toEqual([]);
      expect(parsed.warnings).toEqual([
        { line: 1, message: "无法识别请求行：GET" },
      ]);
    });
  });

  describe("headers and body separation", () => {
    it("treats a line without a colon as the start of the body", () => {
      const parsed = parseHttpFile("GET https://httpbin.org/get\nNotAHeader\n");
      expect(parsed.warnings).toEqual([]);
      expect(parsed.requests[0].headers).toEqual([]);
      expect(parsed.requests[0].body).toBe("NotAHeader");
    });

    it("does not treat an indented header-like line as a header", () => {
      const parsed = parseHttpFile(
        "GET https://httpbin.org/get\n  Accept: application/json\n",
      );
      expect(parsed.requests[0].headers).toEqual([]);
      expect(parsed.requests[0].body).toBe("  Accept: application/json");
    });

    it("only joins query continuations that start with whitespace", () => {
      const parsed = parseHttpFile("GET https://httpbin.org/get\n?a=1\n");
      expect(parsed.requests[0].url).toBe("https://httpbin.org/get");
      expect(parsed.requests[0].body).toBe("?a=1");
    });
  });

  describe("preamble and scripts", () => {
    it("skips a single-line pre-request script fence", () => {
      const parsed = parseHttpFile(
        '< {% request.variables.set("id", "1") %}\nGET https://httpbin.org/get\n',
      );
      expect(parsed.warnings).toEqual([]);
      expect(parsed.requests[0].url).toBe("https://httpbin.org/get");
      expect(parsed.requests[0].body).toBe("");
    });

    it("skips a multi-line response handler that sits inside the body", () => {
      const parsed = parseHttpFile(`POST https://httpbin.org/post

first
> {%
client.log("x");
%}
second
`);
      expect(parsed.warnings).toEqual([]);
      expect(parsed.requests[0].body).toBe("first\nsecond");
    });

    it("strips a leading BOM before parsing", () => {
      const parsed = parseHttpFile("\uFEFFGET https://httpbin.org/get\n");
      expect(parsed.warnings).toEqual([]);
      expect(parsed.requests[0].url).toBe("https://httpbin.org/get");
    });
  });

  describe("block splitting", () => {
    it("trims the separator title", () => {
      const parsed = parseHttpFile("###    我的请求   \nGET https://httpbin.org/get\n");
      expect(parsed.requests[0].name).toBe("我的请求");
    });

    it("warns for a named block that never reaches a request line", () => {
      const parsed = parseHttpFile("### 只有名字\n\n# 注释\n");
      expect(parsed.requests).toEqual([]);
      expect(parsed.warnings).toEqual([
        { line: 2, message: "请求「只有名字」没有请求行" },
      ]);
    });

    it("drops a nameless comment-only block without warnings", () => {
      const parsed = parseHttpFile("###\n# 只有注释\n");
      expect(parsed.requests).toEqual([]);
      expect(parsed.warnings).toEqual([]);
    });
  });
});
