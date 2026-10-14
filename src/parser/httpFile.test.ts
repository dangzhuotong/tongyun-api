import { describe, expect, it } from "vitest";
import { parseHttpFile } from "./httpFile";

describe("parseHttpFile", () => {
  describe("BOM and empty content", () => {
    it("strips UTF-8 BOM from the beginning of the file", () => {
      const source = "\uFEFFGET https://httpbin.org/get\n";
      const parsed = parseHttpFile(source);
      expect(parsed.warnings).toEqual([]);
      expect(parsed.requests).toHaveLength(1);
      expect(parsed.requests[0].url).toBe("https://httpbin.org/get");
    });

    it("returns empty requests and warnings for empty source", () => {
      const parsed = parseHttpFile("");
      expect(parsed.requests).toEqual([]);
      expect(parsed.warnings).toEqual([]);
    });

    it("returns empty requests and warnings for comment-only source", () => {
      const source = "# comment line\n// another comment\n\n";
      const parsed = parseHttpFile(source);
      expect(parsed.requests).toEqual([]);
      expect(parsed.warnings).toEqual([]);
    });
  });

  describe("request line and method parsing", () => {
    it("parses standard method, URL, and strips HTTP version", () => {
      const parsed = parseHttpFile(`### 测试请求
POST https://httpbin.org/post HTTP/1.1
Content-Type: application/json

{"ok":true}
`);
      expect(parsed.warnings).toEqual([]);
      expect(parsed.requests).toHaveLength(1);
      expect(parsed.requests[0]).toMatchObject({
        name: "测试请求",
        method: "POST",
        url: "https://httpbin.org/post",
        line: 2,
        headers: [{ name: "Content-Type", value: "application/json" }],
        body: '{"ok":true}',
      });
    });

    it("supports HTTP/2 and custom methods", () => {
      const parsed = parseHttpFile(`CUSTOM-METHOD https://httpbin.org/anything HTTP/2\n`);
      expect(parsed.warnings).toEqual([]);
      expect(parsed.requests[0].method).toBe("CUSTOM-METHOD");
      expect(parsed.requests[0].url).toBe("https://httpbin.org/anything");
    });

    it("defaults bare URL to GET method", () => {
      const parsed = parseHttpFile("https://httpbin.org/get\n\n###\nhttp://localhost:3000/api\n");
      expect(parsed.requests.map((r) => [r.method, r.url])).toEqual([
        ["GET", "https://httpbin.org/get"],
        ["GET", "http://localhost:3000/api"],
      ]);
    });

    it("joins indented query continuation lines into the URL", () => {
      const parsed = parseHttpFile(`GET https://httpbin.org/get
    ?page=1
    &size=20
    &sort=desc
`);
      expect(parsed.requests[0].url).toBe("https://httpbin.org/get?page=1&size=20&sort=desc");
    });

    it("generates fallback name when no directive or block name is provided", () => {
      const parsed = parseHttpFile("GET https://httpbin.org/get\n");
      expect(parsed.requests[0].name).toBe("GET https://httpbin.org/get");
    });

    it("truncates long URL in fallback name to 69 chars with ellipsis", () => {
      const longUrl = "https://httpbin.org/very/long/path/that/exceeds/the/seventy/two/character/limit/test";
      const parsed = parseHttpFile(`GET ${longUrl}\n`);
      expect(longUrl.length).toBeGreaterThan(72);
      expect(parsed.requests[0].name).toBe(`GET ${longUrl.slice(0, 69)}…`);
    });
  });

  describe("directives and preambles", () => {
    it("uses # @name directive and overrides block name", () => {
      const parsed = parseHttpFile(`### 旧标题
# @name 新名字
GET https://httpbin.org/get
`);
      expect(parsed.requests[0].name).toBe("新名字");
    });

    it("uses // @name directive and overrides fallback name", () => {
      const parsed = parseHttpFile(`// @name apiEndpoint
GET https://httpbin.org/get
`);
      expect(parsed.requests[0].name).toBe("apiEndpoint");
    });

    it("skips preamble comments and blank lines before request line", () => {
      const parsed = parseHttpFile(`### 带前置注释
# 第一行注释
// 第二行注释

GET https://httpbin.org/get
`);
      expect(parsed.requests[0].line).toBe(5);
      expect(parsed.requests[0].url).toBe("https://httpbin.org/get");
    });

    it("skips single-line and multi-line pre-request scripts in preamble", () => {
      const parsed = parseHttpFile(`< {% request.variables.set("token", "123") %}
< {%
  // 多行前置脚本
  console.log("init");
%}
GET https://httpbin.org/get
`);
      expect(parsed.requests).toHaveLength(1);
      expect(parsed.requests[0].url).toBe("https://httpbin.org/get");
      expect(parsed.requests[0].body).toBe("");
    });
  });

  describe("headers parsing", () => {
    it("trims header keys and values and ignores comments inside header block", () => {
      const parsed = parseHttpFile(`GET https://httpbin.org/headers
X-Custom-Header :  custom-value   
# 注释
Authorization: Bearer token123
// 注释
Accept: application/json
`);
      expect(parsed.requests[0].headers).toEqual([
        { name: "X-Custom-Header", value: "custom-value" },
        { name: "Authorization", value: "Bearer token123" },
        { name: "Accept", value: "application/json" },
      ]);
    });

    it("warns when body starts without blank line if it looks like JSON or array", () => {
      const jsonParsed = parseHttpFile('POST https://httpbin.org/post\n{"name":"tongyun"}\n');
      expect(jsonParsed.warnings).toHaveLength(1);
      expect(jsonParsed.warnings[0].message).toContain("请求体前面缺少空行");
      expect(jsonParsed.requests[0].body).toBe('{"name":"tongyun"}');

      const arrayParsed = parseHttpFile('POST https://httpbin.org/post\n[1, 2, 3]\n');
      expect(arrayParsed.warnings).toHaveLength(1);
      expect(arrayParsed.warnings[0].message).toContain("请求体前面缺少空行");
      expect(arrayParsed.requests[0].body).toBe("[1, 2, 3]");
    });

    it("stops parsing headers on non-header line that does not look like body", () => {
      const parsed = parseHttpFile(`POST https://httpbin.org/post
Content-Type: text/plain
plain body text without colon
second body line
`);
      expect(parsed.requests[0].headers).toEqual([
        { name: "Content-Type", value: "text/plain" },
      ]);
      expect(parsed.requests[0].body).toBe("plain body text without colon\nsecond body line");
    });
  });

  describe("body and response handlers", () => {
    it("preserves multiline body and removes trailing blank lines", () => {
      const parsed = parseHttpFile(`POST https://httpbin.org/post
Content-Type: text/plain

line 1
line 2


`);
      expect(parsed.requests[0].body).toBe("line 1\nline 2");
    });

    it("ignores single-line and multi-line response handlers", () => {
      const parsed = parseHttpFile(`POST https://httpbin.org/post

payload

> {% client.test("single", function() {}); %}

> {%
client.test("multi", function() {
  client.assert(response.status === 200);
});
%}
`);
      expect(parsed.requests[0].body).toBe("payload");
    });

    it("warns when body references an external file", () => {
      const parsed = parseHttpFile("POST https://httpbin.org/post\n\n< ./data.json\n");
      expect(parsed.warnings).toHaveLength(1);
      expect(parsed.warnings[0].message).toBe("MVP 不读取外部文件作为请求体");
      expect(parsed.requests[0].body).toBe("< ./data.json");
    });
  });

  describe("warnings and skipped blocks", () => {
    it("warns when request line cannot be parsed", () => {
      const parsed = parseHttpFile("### 无效块\n12345 INVALID LINE\n");
      expect(parsed.requests).toHaveLength(0);
      expect(parsed.warnings).toHaveLength(1);
      expect(parsed.warnings[0].message).toBe("无法识别请求行：12345 INVALID LINE");
      expect(parsed.warnings[0].line).toBe(2);
    });

    it("warns when block has a name but no request line", () => {
      const parsed = parseHttpFile("### 仅有名称没有请求行\n# 注释\n");
      expect(parsed.requests).toHaveLength(0);
      expect(parsed.warnings).toHaveLength(1);
      expect(parsed.warnings[0].message).toBe("请求「仅有名称没有请求行」没有请求行");
    });

    it("warns when block has content (e.g. script) but no name and no request line", () => {
      const parsed = parseHttpFile("< {%\nscript\n%}\n");
      expect(parsed.requests).toHaveLength(0);
      expect(parsed.warnings).toHaveLength(1);
      expect(parsed.warnings[0].message).toBe("空请求块已跳过");
    });
  });

  describe("multiple requests in a single file", () => {
    it("parses multiple requests separated by ### with line numbers", () => {
      const source = `### 请求1
GET https://httpbin.org/get

### 请求2
POST https://httpbin.org/post
Content-Type: application/json

{"hello":"world"}
`;
      const parsed = parseHttpFile(source);
      expect(parsed.warnings).toEqual([]);
      expect(parsed.requests).toHaveLength(2);
      expect(parsed.requests[0].name).toBe("请求1");
      expect(parsed.requests[0].line).toBe(2);
      expect(parsed.requests[1].name).toBe("请求2");
      expect(parsed.requests[1].line).toBe(5);
    });
  });
});
