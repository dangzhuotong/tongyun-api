import { describe, expect, it } from "vitest";
import {
  parseHttpFileContent,
  parseOpenApiSpec,
  parsePostmanCollection,
} from "./importers";

describe("parsePostmanCollection", () => {
  it("parses collection name and top-level requests", () => {
    const postmanJson = JSON.stringify({
      info: {
        name: "测试用例集",
      },
      item: [
        {
          name: "获取用户列表",
          request: {
            method: "GET",
            url: {
              raw: "https://httpbin.org/get?page=1",
              query: [
                { key: "page", value: "1", disabled: false },
                { key: "limit", value: "10", disabled: true },
              ],
            },
            header: [
              { key: "Accept", value: "application/json", disabled: false },
              { key: "X-Ignore", value: "none", disabled: true },
            ],
            description: "获取用户接口描述",
          },
        },
      ],
    });

    const result = parsePostmanCollection(postmanJson);
    expect(result.collectionName).toBe("测试用例集");
    expect(result.items).toHaveLength(1);

    const first = result.items[0];
    expect(first.folderPath).toEqual(["测试用例集"]);
    expect(first.request.name).toBe("获取用户列表");
    expect(first.request.method).toBe("GET");
    expect(first.request.url).toBe("https://httpbin.org/get?page=1");
    expect(first.request.description).toBe("获取用户接口描述");
    expect(first.request.headers).toEqual([
      { key: "Accept", value: "application/json", enabled: true, description: undefined },
      { key: "X-Ignore", value: "none", enabled: false, description: undefined },
    ]);
    expect(first.request.params).toEqual([
      { key: "page", value: "1", enabled: true, description: undefined },
      { key: "limit", value: "10", enabled: false, description: undefined },
    ]);
  });

  it("handles nested folders recursively", () => {
    const postmanJson = JSON.stringify({
      info: { name: "多级目录集" },
      item: [
        {
          name: "用户模块",
          item: [
            {
              name: "鉴权子模块",
              item: [
                {
                  name: "登录接口",
                  request: {
                    method: "POST",
                    url: "https://httpbin.org/post",
                    body: {
                      mode: "raw",
                      raw: '{"username":"admin"}',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    const result = parsePostmanCollection(postmanJson);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].folderPath).toEqual([
      "多级目录集",
      "用户模块",
      "鉴权子模块",
    ]);
    expect(result.items[0].request.body).toEqual({
      body_type: "json",
      content: '{"username":"admin"}',
    });
  });

  it("parses urlencoded body and auth types", () => {
    const postmanJson = JSON.stringify({
      item: [
        {
          name: "表单与鉴权",
          request: {
            method: "POST",
            url: "https://httpbin.org/post",
            auth: {
              type: "bearer",
              bearer: [{ key: "token", value: "bearer-token-123" }],
            },
            body: {
              mode: "urlencoded",
              urlencoded: [
                { key: "user", value: "alice", disabled: false },
                { key: "role", value: "admin", disabled: false },
                { key: "skip", value: "me", disabled: true },
              ],
            },
          },
        },
        {
          name: "Basic鉴权",
          request: {
            method: "GET",
            url: "https://httpbin.org/get",
            auth: {
              type: "basic",
              basic: [
                { key: "username", value: "admin" },
                { key: "password", value: "pwd" },
              ],
            },
          },
        },
      ],
    });

    const result = parsePostmanCollection(postmanJson);
    expect(result.collectionName).toBe("Postman导入集合");
    expect(result.items).toHaveLength(2);

    expect(result.items[0].request.auth).toEqual({
      auth_type: "bearer",
      token: "bearer-token-123",
    });
    expect(result.items[0].request.body).toEqual({
      body_type: "form-urlencoded",
      content: "user=alice&role=admin",
    });

    expect(result.items[1].request.auth).toEqual({
      auth_type: "basic",
      username: "admin",
      password: "pwd",
    });
  });
});

describe("parseOpenApiSpec", () => {
  it("parses OpenAPI 3.0 specification into requests grouped by tags", () => {
    const openApiJson = JSON.stringify({
      openapi: "3.0.0",
      info: {
        title: "宠物商店 API",
        version: "1.0.0",
      },
      servers: [{ url: "https://api.example.com/v1" }],
      paths: {
        "/pets": {
          get: {
            summary: "获取宠物列表",
            tags: ["宠物服务"],
            parameters: [
              {
                name: "status",
                in: "query",
                example: "available",
                description: "宠物状态",
              },
              {
                name: "X-Trace-Id",
                in: "header",
                example: "trace-999",
              },
            ],
          },
          post: {
            summary: "新增宠物",
            tags: ["宠物服务"],
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                  },
                },
              },
            },
          },
        },
        "/pets/{id}": {
          delete: {
            operationId: "deletePet",
            description: "删除指定宠物",
          },
        },
      },
    });

    const result = parseOpenApiSpec(openApiJson);
    expect(result.collectionName).toBe("宠物商店 API");
    expect(result.items).toHaveLength(3);

    const getReq = result.items.find((i) => i.request.method === "GET")!;
    expect(getReq.folderPath).toEqual(["宠物商店 API", "宠物服务"]);
    expect(getReq.request.name).toBe("获取宠物列表");
    expect(getReq.request.url).toBe("https://api.example.com/v1/pets");
    expect(getReq.request.params).toEqual([
      { key: "status", value: "available", enabled: true, description: "宠物状态" },
    ]);
    expect(getReq.request.headers).toEqual([
      { key: "X-Trace-Id", value: "trace-999", enabled: true, description: undefined },
    ]);

    const postReq = result.items.find((i) => i.request.method === "POST")!;
    expect(postReq.request.body.body_type).toBe("json");

    const deleteReq = result.items.find((i) => i.request.method === "DELETE")!;
    expect(deleteReq.folderPath).toEqual(["宠物商店 API", "默认分组"]);
    expect(deleteReq.request.name).toBe("deletePet");
  });
});

describe("parseHttpFileContent", () => {
  it("parses .http content and derives collection name from filename", () => {
    const httpContent = `### 获取用户
GET https://httpbin.org/get?id=1
Accept: application/json
Authorization: Bearer secret-tok

### 提交数据
POST https://httpbin.org/post
Content-Type: application/json

{"hello":"world"}
`;

    const result = parseHttpFileContent(httpContent, "users.http");
    expect(result.collectionName).toBe("users");
    expect(result.items).toHaveLength(2);

    expect(result.items[0].folderPath).toEqual(["users"]);
    expect(result.items[0].request.name).toBe("获取用户");
    expect(result.items[0].request.method).toBe("GET");
    expect(result.items[0].request.auth).toEqual({
      auth_type: "bearer",
      token: "secret-tok",
    });

    expect(result.items[1].request.name).toBe("提交数据");
    expect(result.items[1].request.method).toBe("POST");
    expect(result.items[1].request.body).toEqual({
      body_type: "json",
      content: '{"hello":"world"}',
    });
  });

  it("defaults collection name to 'HTTP文件导入' when filename is omitted", () => {
    const result = parseHttpFileContent("GET https://httpbin.org/get\n");
    expect(result.collectionName).toBe("HTTP文件导入");
    expect(result.items).toHaveLength(1);
  });
});
