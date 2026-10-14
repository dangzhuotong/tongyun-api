import { describe, expect, it } from "vitest";
import {
  evaluateAssertions,
  exportTestCasesToHttp,
  extractVariables,
  generateAiDiagnosticPrompt,
  generateAiTestCaseSuite,
  generateSmartAssertions,
  getNestedValue,
} from "./tester";
import type {
  RequestAssertion,
  RequestData,
  ResponsePayload,
  TestCaseItem,
  VariableExtraction,
} from "../types/api";

describe("getNestedValue", () => {
  it("returns undefined for null object or empty path", () => {
    expect(getNestedValue(null, "a.b")).toBeUndefined();
    expect(getNestedValue({ a: 1 }, "")).toBeUndefined();
  });

  it("extracts direct and nested properties", () => {
    const data = {
      user: {
        profile: {
          name: "Alice",
          age: 30,
        },
      },
    };
    expect(getNestedValue(data, "user.profile.name")).toBe("Alice");
    expect(getNestedValue(data, "user.profile.age")).toBe(30);
  });

  it("extracts array elements using numeric index", () => {
    const data = {
      items: ["first", "second", "third"],
      users: [{ id: 1 }, { id: 2 }],
    };
    expect(getNestedValue(data, "items.1")).toBe("second");
    expect(getNestedValue(data, "users.0.id")).toBe(1);
  });

  it("returns undefined if path does not exist", () => {
    const data = { a: { b: 1 } };
    expect(getNestedValue(data, "a.c")).toBeUndefined();
    expect(getNestedValue(data, "x.y.z")).toBeUndefined();
  });

  it("trims whitespace around path segments", () => {
    const data = { data: { code: 0 } };
    expect(getNestedValue(data, " data . code ")).toBe(0);
  });
});

describe("evaluateAssertions", () => {
  const baseResponse: ResponsePayload = {
    status: 200,
    status_text: "OK",
    headers: [
      { key: "Content-Type", value: "application/json", enabled: true },
      { key: "X-Trace-Id", value: "tr-123", enabled: true },
    ],
    body: JSON.stringify({ code: 0, message: "success", data: { id: 100 } }),
    time_ms: 150,
    size_bytes: 64,
    is_json: true,
  };

  it("returns empty array when assertions is undefined or empty", () => {
    expect(evaluateAssertions(undefined, baseResponse)).toEqual([]);
    expect(evaluateAssertions([], baseResponse)).toEqual([]);
  });

  it("skips disabled assertions", () => {
    const assertions: RequestAssertion[] = [
      {
        id: "a1",
        name: "状态码200",
        type: "status_equals",
        expected: "200",
        enabled: false,
      },
    ];
    expect(evaluateAssertions(assertions, baseResponse)).toEqual([]);
  });

  it("evaluates status_equals assertion", () => {
    const assertions: RequestAssertion[] = [
      { id: "a1", name: "等于200", type: "status_equals", expected: "200", enabled: true },
      { id: "a2", name: "等于404", type: "status_equals", expected: "404", enabled: true },
    ];
    const results = evaluateAssertions(assertions, baseResponse);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(false);
    expect(results[1].message).toContain("期望为 404，实际为 200");
  });

  it("evaluates status_in_range assertion", () => {
    const assertions: RequestAssertion[] = [
      { id: "a1", name: "2xx范围", type: "status_in_range", expected: "200-299", enabled: true },
      { id: "a2", name: "4xx范围", type: "status_in_range", expected: "400-499", enabled: true },
      { id: "a3", name: "无效区间", type: "status_in_range", expected: "invalid", enabled: true },
    ];
    const results = evaluateAssertions(assertions, baseResponse);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(false);
    expect(results[2].passed).toBe(false);
    expect(results[2].message).toContain("区间表达式无效");
  });

  it("evaluates time_less_than assertion", () => {
    const assertions: RequestAssertion[] = [
      { id: "a1", name: "耗时<500", type: "time_less_than", expected: "500", enabled: true },
      { id: "a2", name: "耗时<100", type: "time_less_than", expected: "100", enabled: true },
    ];
    const results = evaluateAssertions(assertions, baseResponse);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(false);
  });

  it("evaluates body_contains assertion", () => {
    const assertions: RequestAssertion[] = [
      { id: "a1", name: "包含success", type: "body_contains", expected: "success", enabled: true },
      { id: "a2", name: "包含error", type: "body_contains", expected: "error", enabled: true },
    ];
    const results = evaluateAssertions(assertions, baseResponse);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(false);
  });

  it("evaluates json_path_equals assertion", () => {
    const assertions: RequestAssertion[] = [
      {
        id: "a1",
        name: "code为0",
        type: "json_path_equals",
        target: "code",
        expected: "0",
        enabled: true,
      },
      {
        id: "a2",
        name: "data.id为100",
        type: "json_path_equals",
        target: "data.id",
        expected: "100",
        enabled: true,
      },
      {
        id: "a3",
        name: "不存在字段",
        type: "json_path_equals",
        target: "data.missing",
        expected: "value",
        enabled: true,
      },
    ];
    const results = evaluateAssertions(assertions, baseResponse);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(true);
    expect(results[2].passed).toBe(false);
  });

  it("fails json_path_equals gracefully when response is not valid JSON", () => {
    const notJsonResponse: ResponsePayload = {
      ...baseResponse,
      is_json: false,
      body: "plain text error",
    };
    const assertions: RequestAssertion[] = [
      {
        id: "a1",
        name: "json检查",
        type: "json_path_equals",
        target: "code",
        expected: "0",
        enabled: true,
      },
    ];
    const results = evaluateAssertions(assertions, notJsonResponse);
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain("无法执行路径提取");
  });

  it("evaluates header_exists assertion", () => {
    const assertions: RequestAssertion[] = [
      { id: "a1", name: "有Content-Type", type: "header_exists", expected: "content-type", enabled: true },
      { id: "a2", name: "有X-Trace-Id", type: "header_exists", expected: "x-trace-id", enabled: true },
      { id: "a3", name: "有Authorization", type: "header_exists", expected: "authorization", enabled: true },
    ];
    const results = evaluateAssertions(assertions, baseResponse);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(true);
    expect(results[2].passed).toBe(false);
  });
});

describe("extractVariables", () => {
  const response: ResponsePayload = {
    status: 200,
    status_text: "OK",
    headers: [{ key: "X-Token", value: "header-tok-123", enabled: true }],
    body: JSON.stringify({
      auth: { token: "body-tok-456" },
      user: { id: 1001 },
    }),
    time_ms: 50,
    size_bytes: 100,
    is_json: true,
  };

  it("extracts variables from JSON path and headers", () => {
    const extracts: VariableExtraction[] = [
      {
        id: "e1",
        var_name: "jwt",
        source: "json",
        path_or_key: "auth.token",
        enabled: true,
      },
      {
        id: "e2",
        var_name: "userId",
        source: "json",
        path_or_key: "user.id",
        enabled: true,
      },
      {
        id: "e3",
        var_name: "headerToken",
        source: "header",
        path_or_key: "x-token",
        enabled: true,
      },
      {
        id: "e4",
        var_name: "disabledVar",
        source: "json",
        path_or_key: "user.id",
        enabled: false,
      },
    ];

    const result = extractVariables(extracts, response);
    expect(result).toEqual([
      { key: "jwt", value: "body-tok-456", source: "JSON: auth.token" },
      { key: "userId", value: "1001", source: "JSON: user.id" },
      { key: "headerToken", value: "header-tok-123", source: "Header: X-Token" },
    ]);
  });
});

describe("generateSmartAssertions", () => {
  it("generates assertions for status, time, headers and JSON keys", () => {
    const resp: ResponsePayload = {
      status: 200,
      status_text: "OK",
      headers: [{ key: "Content-Type", value: "application/json", enabled: true }],
      body: JSON.stringify({ code: 0, message: "ok" }),
      time_ms: 200,
      size_bytes: 50,
      is_json: true,
    };

    const assertions = generateSmartAssertions(resp);
    expect(assertions.length).toBeGreaterThanOrEqual(3);

    const statusAssert = assertions.find((a) => a.type === "status_equals");
    expect(statusAssert?.expected).toBe("200");

    const timeAssert = assertions.find((a) => a.type === "time_less_than");
    expect(timeAssert?.expected).toBe("1000"); // Math.max(1000, 200 * 1.5)

    const headerAssert = assertions.find((a) => a.type === "header_exists");
    expect(headerAssert?.target).toBe("content-type");

    const jsonAssert = assertions.find((a) => a.type === "json_path_equals");
    expect(jsonAssert?.target).toBe("code");
    expect(jsonAssert?.expected).toBe("0");
  });
});

describe("generateAiDiagnosticPrompt", () => {
  const req: RequestData = {
    id: "req_diag",
    name: "创建订单",
    method: "POST",
    url: "https://httpbin.org/post",
    headers: [{ key: "Authorization", value: "Bearer xxx", enabled: true }],
    params: [],
    body: { body_type: "json", content: '{"orderId":1}' },
    auth: { auth_type: "none" },
  };

  it("generates markdown diagnostic prompt for completed response", () => {
    const resp: ResponsePayload = {
      status: 500,
      status_text: "Internal Server Error",
      headers: [{ key: "Content-Type", value: "text/plain", enabled: true }],
      body: "Database connection failed",
      time_ms: 450,
      size_bytes: 26,
      is_json: false,
      test_results: [
        {
          assertion: {
            id: "a1",
            name: "状态码为200",
            type: "status_equals",
            expected: "200",
            enabled: true,
          },
          passed: false,
          actual: "500",
          message: "状态码期望为 200，实际为 500",
        },
      ],
    };

    const prompt = generateAiDiagnosticPrompt(req, resp, { environmentName: "staging" });
    expect(prompt).toContain("# 🤖 橦云接口 · 真实 API 执行诊断与排错上下文");
    expect(prompt).toContain("POST https://httpbin.org/post");
    expect(prompt).toContain("500 Internal Server Error");
    expect(prompt).toContain("Database connection failed");
    expect(prompt).toContain("❌ [未通过]");
  });

  it("generates markdown diagnostic prompt when network connection failed (response is null)", () => {
    const prompt = generateAiDiagnosticPrompt(req, null);
    expect(prompt).toContain("请求未成功建立连接或网络中断");
  });
});

describe("generateAiTestCaseSuite", () => {
  it("generates positive, negative, boundary, and security test cases", () => {
    const req: RequestData = {
      id: "req_suite",
      name: "登录",
      method: "POST",
      url: "https://httpbin.org/post",
      headers: [
        { key: "Content-Type", value: "application/json", enabled: true },
        { key: "Authorization", value: "Bearer token", enabled: true },
      ],
      params: [{ key: "source", value: "web", enabled: true }],
      body: {
        body_type: "json",
        content: JSON.stringify({ username: "alice", age: 25 }),
      },
      auth: { auth_type: "none" },
    };

    const suite = generateAiTestCaseSuite(req);
    expect(suite).toHaveLength(4);

    const categories = suite.map((c) => c.category);
    expect(categories).toEqual(["positive", "negative", "boundary", "security"]);

    const pos = suite.find((c) => c.category === "positive")!;
    expect(pos.tests.length).toBeGreaterThan(0);

    const neg = suite.find((c) => c.category === "negative")!;
    expect(neg.name).toContain("必填参数缺失");

    const bound = suite.find((c) => c.category === "boundary")!;
    expect(bound.name).toContain("极端数值与超长字符");

    const sec = suite.find((c) => c.category === "security")!;
    expect(sec.headers.some((h) => h.key.toLowerCase().includes("auth"))).toBe(false);
  });
});

describe("exportTestCasesToHttp", () => {
  it("formats test cases into IntelliJ HTTP client .http syntax", () => {
    const req: RequestData = {
      id: "req_export",
      name: "查询接口",
      method: "GET",
      url: "https://httpbin.org/get",
      headers: [],
      params: [],
      body: { body_type: "none", content: "" },
      auth: { auth_type: "none" },
    };

    const cases: TestCaseItem[] = [
      {
        id: "case_1",
        name: "标准查询",
        description: "测试用例描述说明",
        category: "positive",
        params: [{ key: "page", value: "1", enabled: true }],
        headers: [{ key: "Accept", value: "application/json", enabled: true }],
        body: { body_type: "none", content: "" },
        auth: { auth_type: "none" },
        tests: [],
      },
    ];

    const httpText = exportTestCasesToHttp(req, cases);
    expect(httpText).toContain("### 标准查询");
    expect(httpText).toContain("# @name case_1");
    expect(httpText).toContain("# 测试用例描述说明");
    expect(httpText).toContain("GET https://httpbin.org/get?page=1");
    expect(httpText).toContain("Accept: application/json");
  });
});
