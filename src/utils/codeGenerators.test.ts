import { describe, expect, it } from "vitest";
import {
  generateCodeSnippet,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "./codeGenerators";
import type { EnvironmentData, RequestData } from "../types/api";

describe("SUPPORTED_LANGUAGES", () => {
  it("contains all 8 supported languages with required metadata", () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(8);
    const ids = SUPPORTED_LANGUAGES.map((l) => l.id);
    expect(ids).toEqual([
      "curl",
      "javascript_fetch",
      "javascript_axios",
      "typescript_fetch",
      "python_requests",
      "python_httpx",
      "go_http",
      "rust_reqwest",
    ]);

    for (const item of SUPPORTED_LANGUAGES) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.extension).toBeTruthy();
    }
  });
});

describe("generateCodeSnippet", () => {
  const sampleRequest: RequestData = {
    id: "req_post",
    name: "创建用户",
    method: "POST",
    url: "https://httpbin.org/post",
    headers: [{ key: "Accept", value: "application/json", enabled: true }],
    params: [{ key: "source", value: "test", enabled: true }],
    body: {
      body_type: "json",
      content: '{"username":"alice"}',
    },
    auth: {
      auth_type: "bearer",
      token: "secret-token",
    },
  };

  it("generates cURL command", () => {
    const code = generateCodeSnippet("curl", sampleRequest, null);
    expect(code).toContain("curl");
    expect(code).toContain("-X POST");
    expect(code).toContain("https://httpbin.org/post?source=test");
    expect(code).toContain('-H "Authorization: Bearer secret-token"');
  });

  it("generates JavaScript Fetch code snippet", () => {
    const code = generateCodeSnippet("javascript_fetch", sampleRequest, null);
    expect(code).toContain('fetch("https://httpbin.org/post?source=test"');
    expect(code).toContain('method: "POST"');
    expect(code).toContain('"Authorization": "Bearer secret-token"');
    expect(code).toContain('"Content-Type": "application/json"');
    expect(code).toContain('body: "{\\"username\\":\\"alice\\"}"');
  });

  it("generates TypeScript Fetch code snippet", () => {
    const code = generateCodeSnippet("typescript_fetch", sampleRequest, null);
    expect(code).toContain("async function callApi(): Promise<void>");
    expect(code).toContain("const headers: HeadersInit =");
    expect(code).toContain('method: "POST"');
    expect(code).toContain("callApi();");
  });

  it("generates JavaScript Axios code snippet", () => {
    const code = generateCodeSnippet("javascript_axios", sampleRequest, null);
    expect(code).toContain("import axios from 'axios';");
    expect(code).toContain("method: 'post'");
    expect(code).toContain("url: 'https://httpbin.org/post?source=test'");
    expect(code).toContain("axios.request(config)");
  });

  it("generates Python Requests code snippet", () => {
    const code = generateCodeSnippet("python_requests", sampleRequest, null);
    expect(code).toContain("import requests");
    expect(code).toContain('url = "https://httpbin.org/post?source=test"');
    expect(code).toContain('requests.request(\n    "POST"');
    expect(code).toContain("payload =");
  });

  it("generates Python HTTPX code snippet", () => {
    const code = generateCodeSnippet("python_httpx", sampleRequest, null);
    expect(code).toContain("import httpx");
    expect(code).toContain("with httpx.Client() as client:");
    expect(code).toContain('client.request(\n        "POST"');
  });

  it("generates Go net/http code snippet", () => {
    const code = generateCodeSnippet("go_http", sampleRequest, null);
    expect(code).toContain("package main");
    expect(code).toContain('"net/http"');
    expect(code).toContain('url := "https://httpbin.org/post?source=test"');
    expect(code).toContain('method := "POST"');
    expect(code).toContain("http.NewRequest(method, url, payload)");
  });

  it("generates Rust reqwest code snippet", () => {
    const code = generateCodeSnippet("rust_reqwest", sampleRequest, null);
    expect(code).toContain("use reqwest::Client;");
    expect(code).toContain("#[tokio::main]");
    expect(code).toContain('.post("https://httpbin.org/post?source=test")');
    expect(code).toContain(".send()");
  });

  it("handles basic auth across generators", () => {
    const req: RequestData = {
      ...sampleRequest,
      auth: {
        auth_type: "basic",
        username: "user",
        password: "pwd",
      },
    };

    const jsCode = generateCodeSnippet("javascript_fetch", req, null);
    expect(jsCode).toContain('"Authorization": "Basic dXNlcjpwd2Q="');
  });

  it("handles API key in header", () => {
    const req: RequestData = {
      ...sampleRequest,
      auth: {
        auth_type: "apikey",
        api_key_name: "X-API-KEY",
        api_key_value: "key-999",
        api_key_in: "header",
      },
    };

    const pyCode = generateCodeSnippet("python_requests", req, null);
    expect(pyCode).toContain('"X-API-KEY": "key-999"');
  });

  it("respects interpolate = false by keeping variable placeholders", () => {
    const env: EnvironmentData = {
      id: "env1",
      name: "测试环境",
      variables: [
        { key: "host", value: "https://httpbin.org", enabled: true },
        { key: "token", value: "real-token", enabled: true },
      ],
    };

    const req: RequestData = {
      ...sampleRequest,
      url: "{{host}}/post",
      auth: {
        auth_type: "bearer",
        token: "{{token}}",
      },
    };

    const interpolated = generateCodeSnippet(
      "javascript_fetch",
      req,
      env,
      true,
    );
    expect(interpolated).toContain("https://httpbin.org/post");
    expect(interpolated).toContain('"Authorization": "Bearer real-token"');

    const nonInterpolated = generateCodeSnippet(
      "javascript_fetch",
      req,
      env,
      false,
    );
    expect(nonInterpolated).toContain("{{host}}/post");
    expect(nonInterpolated).toContain('"Authorization": "Bearer {{token}}"');
  });

  it("omits body for GET requests even if body content is defined", () => {
    const getReq: RequestData = {
      ...sampleRequest,
      method: "GET",
      url: "https://httpbin.org/get",
      body: {
        body_type: "json",
        content: '{"ignored":"true"}',
      },
    };

    const jsCode = generateCodeSnippet("javascript_fetch", getReq, null);
    expect(jsCode).not.toContain("body:");

    const pyCode = generateCodeSnippet("python_requests", getReq, null);
    expect(pyCode).toContain("payload = None");
  });

  it("falls back to cURL for unknown language identifier", () => {
    const code = generateCodeSnippet(
      "unknown_lang" as SupportedLanguage,
      sampleRequest,
      null,
    );
    expect(code).toContain("curl");
  });
});
