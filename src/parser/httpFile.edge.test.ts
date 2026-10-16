import { describe, expect, it } from "vitest";
import { parseHttpFile } from "./httpFile";

describe("parseHttpFile edge cases", () => {
  describe("request lines", () => {
    it("accepts a bare URL that already contains a query string and defaults to GET", () => {
      const parsed = parseHttpFile("https://httpbin.org/get?a=1&b=2\n");
      expect(parsed.warnings).toEqual([]);
      expect(parsed.requests).toHaveLength(1);
      expect(parsed.requests[0].method).toBe("GET");
      expect(parsed.requests[0].url).toBe("https://httpbin.org/get?a=1&b=2");
      expect(parsed.requests[0].name).toBe("GET https://httpbin.org/get?a=1&b=2");
    });

    it("joins query continuation lines indented with a tab", () => {
      const parsed = parseHttpFile("GET https://httpbin.org/get\n\t?page=1\n\t&size=2\n");
      expect(parsed.requests[0].url).toBe("https://httpbin.org/get?page=1&size=2");
    });

    it("keeps only the first request line when extra non-continuation tokens follow", () => {
      const parsed = parseHttpFile("GET https://httpbin.org/get extra-token\n");
      expect(parsed.requests).toHaveLength(0);
      expect(parsed.warnings[0].message).toBe("无法识别请求行：GET https://httpbin.org/get extra-token");
    });
  });

  describe("preamble directives", () => {
    it("recognizes #@name without a separating space", () => {
      const parsed = parseHttpFile("#@name login\nGET https://httpbin.org/get\n");
      expect(parsed.requests[0].name).toBe("login");
    });

    it("warns instead of skipping when a > response line appears before the request line", () => {
      const parsed = parseHttpFile(`### 带响应脚本
> {% client.test("x", function(){}); %}
GET https://httpbin.org/get
`);
      expect(parsed.requests).toHaveLength(0);
      expect(parsed.warnings).toHaveLength(1);
      expect(parsed.warnings[0].message.startsWith("无法识别请求行：>")).toBe(true);
    });
  });

  describe("headers", () => {
    it("keeps colons inside header values including URLs", () => {
      const parsed = parseHttpFile(`GET https://httpbin.org/get
Host: http://example.com
X-Time: 12:30:45
`);
      expect(parsed.requests[0].headers).toEqual([
        { name: "Host", value: "http://example.com" },
        { name: "X-Time", value: "12:30:45" },
      ]);
    });

    it("supports an empty header value", () => {
      const parsed = parseHttpFile("GET https://httpbin.org/get\nX-Empty:\n");
      expect(parsed.requests[0].headers).toEqual([{ name: "X-Empty", value: "" }]);
    });

    it("ends the header block at a blank line and treats later header-like lines as body", () => {
      const parsed = parseHttpFile(`GET https://httpbin.org/get
Accept: application/json

X-Looks-Like-Header: value
`);
      expect(parsed.requests[0].headers).toEqual([{ name: "Accept", value: "application/json" }]);
      expect(parsed.requests[0].body).toBe("X-Looks-Like-Header: value");
    });
  });

  describe("body and handlers", () => {
    it("drops a > response line that sits between body lines", () => {
      const parsed = parseHttpFile(`POST https://httpbin.org/post

first
> {% client.log("x"); %}
second
`);
      expect(parsed.requests[0].body).toBe("first\nsecond");
    });

    it("drops any line starting with > even when it is not a script fence", () => {
      const parsed = parseHttpFile(`POST https://httpbin.org/post

first
> just a quoted note
second
`);
      expect(parsed.requests[0].body).toBe("first\nsecond");
    });

    it("does not warn when the body merely starts with an external file reference plus more text", () => {
      const parsed = parseHttpFile(`POST https://httpbin.org/post

< ./data.json
extra
`);
      expect(parsed.warnings).toEqual([]);
      expect(parsed.requests[0].body).toBe("< ./data.json\nextra");
    });

    it("warns when the body is exactly an external file reference separated by a tab", () => {
      const parsed = parseHttpFile("POST https://httpbin.org/post\n\n<\t./data.json\n");
      expect(parsed.warnings).toHaveLength(1);
      expect(parsed.warnings[0].message).toBe("MVP 不读取外部文件作为请求体");
    });

    it("stores an empty body when only blank lines follow the headers", () => {
      const parsed = parseHttpFile("POST https://httpbin.org/post\n\n\n\n");
      expect(parsed.requests[0].body).toBe("");
    });
  });

  describe("block splitting", () => {
    it("does not produce requests for consecutive separators", () => {
      const parsed = parseHttpFile("###\n###\nGET https://httpbin.org/get\n");
      expect(parsed.warnings).toEqual([]);
      expect(parsed.requests).toHaveLength(1);
      expect(parsed.requests[0].url).toBe("https://httpbin.org/get");
    });

    it("skips comment-only blocks between real requests without warnings", () => {
      const parsed = parseHttpFile(`GET https://httpbin.org/get
###
# just a comment
###
POST https://httpbin.org/post
`);
      expect(parsed.warnings).toEqual([]);
      expect(parsed.requests.map((r) => r.method)).toEqual(["GET", "POST"]);
    });
  });
});
