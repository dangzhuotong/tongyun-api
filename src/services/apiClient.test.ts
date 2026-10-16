import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { apiClient, isTauri } from "./apiClient";
import type { RequestData, EnvironmentData } from "../types/api";

describe("apiClient", () => {
  const storageMap = new Map<string, string>();

  beforeEach(() => {
    storageMap.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storageMap.set(key, String(value));
      },
      removeItem: (key: string) => {
        storageMap.delete(key);
      },
      clear: () => {
        storageMap.clear();
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("isTauri helper", () => {
    it("returns false when window is undefined", () => {
      expect(isTauri()).toBe(false);
    });

    it("returns false when window exists but __TAURI_INTERNALS__ is not present", () => {
      vi.stubGlobal("window", {});
      expect(isTauri()).toBe(false);
    });

    it("returns true when window contains __TAURI_INTERNALS__", () => {
      vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
      expect(isTauri()).toBe(true);
    });
  });

  describe("workspace and mock storage management", () => {
    it("returns mock workspace path when not running in Tauri", async () => {
      const wsPath = await apiClient.getWorkspacePath();
      expect(wsPath).toBe("/tongyun-collections (浏览器演示模拟)");
    });

    it("loads initial default file tree", async () => {
      const tree = await apiClient.loadFileTree();
      expect(tree).toHaveLength(2);
      expect(tree[0].name).toBe("01-基础HTTP");
      expect(tree[0].is_dir).toBe(true);
      expect(tree[0].children).toHaveLength(2);
      expect(tree[1].name).toBe("02-状态码与时延");
    });

    it("reads existing request file and throws error for non-existent file", async () => {
      const validPath = "/tongyun-collections/01-基础HTTP/GET测试 (Query参数).json";
      const req = await apiClient.readRequestFile(validPath);
      expect(req.name).toBe("GET测试 (Query参数)");
      expect(req.method).toBe("GET");
      expect(req.filePath).toBe(validPath);

      await expect(
        apiClient.readRequestFile("/tongyun-collections/not-exists.json"),
      ).rejects.toThrow("未找到请求文件");
    });

    it("saves and updates an existing request file", async () => {
      const path = "/tongyun-collections/01-基础HTTP/GET测试 (Query参数).json";
      const original = await apiClient.readRequestFile(path);
      const updated: RequestData = {
        ...original,
        name: "修改后的请求名称",
        url: "https://httpbin.org/updated",
      };

      await apiClient.saveRequestFile(path, updated);
      const readBack = await apiClient.readRequestFile(path);
      expect(readBack.name).toBe("修改后的请求名称");
      expect(readBack.url).toBe("https://httpbin.org/updated");
    });

    it("creates a new file and adds it to parent folder", async () => {
      const parentPath = "/tongyun-collections/01-基础HTTP";
      const createdPath = await apiClient.createFileOrFolder(parentPath, "新请求", false);
      expect(createdPath).toBe("/tongyun-collections/01-基础HTTP/新请求.json");

      const fileData = await apiClient.readRequestFile(createdPath);
      expect(fileData.name).toBe("新请求");
      expect(fileData.method).toBe("GET");

      const tree = await apiClient.loadFileTree();
      const folder = tree.find((t) => t.path === parentPath);
      expect(folder?.children?.some((c) => c.path === createdPath)).toBe(true);
    });

    it("creates a new directory in the workspace", async () => {
      const parentPath = "/tongyun-collections";
      const createdPath = await apiClient.createFileOrFolder(parentPath, "03-新模块", true);
      expect(createdPath).toBe("/tongyun-collections/03-新模块");

      const tree = await apiClient.loadFileTree();
      expect(tree.some((n) => n.path === createdPath && n.is_dir)).toBe(true);
    });

    it("renames a request file and its tree node", async () => {
      const oldPath = "/tongyun-collections/01-基础HTTP/GET测试 (Query参数).json";
      const newPath = await apiClient.renameFileOrFolder(oldPath, "GET测试改名");
      expect(newPath).toBe("/tongyun-collections/01-基础HTTP/GET测试改名.json");

      const renamed = await apiClient.readRequestFile(newPath);
      expect(renamed.name).toBe("GET测试改名");

      await expect(apiClient.readRequestFile(oldPath)).rejects.toThrow("未找到请求文件");
    });

    it("deletes a request file from storage and tree", async () => {
      const path = "/tongyun-collections/01-基础HTTP/GET测试 (Query参数).json";
      await apiClient.deleteFileOrFolder(path);

      await expect(apiClient.readRequestFile(path)).rejects.toThrow("未找到请求文件");
      const tree = await apiClient.loadFileTree();
      const folder = tree.find((t) => t.path === "/tongyun-collections/01-基础HTTP");
      expect(folder?.children?.some((c) => c.path === path)).toBe(false);
    });

    it("manages environment datasets (load, save, delete)", async () => {
      const initialEnvs = await apiClient.loadEnvironments();
      expect(initialEnvs).toHaveLength(1);
      expect(initialEnvs[0].id).toBe("development");

      const newEnv: EnvironmentData = {
        id: "staging",
        name: "预发布环境",
        variables: [{ key: "baseUrl", value: "https://staging.example.com", enabled: true }],
      };
      await apiClient.saveEnvironment(undefined, newEnv);

      let envs = await apiClient.loadEnvironments();
      expect(envs).toHaveLength(2);
      expect(envs.some((e) => e.id === "staging")).toBe(true);

      const updatedEnv: EnvironmentData = {
        ...newEnv,
        name: "预发布环境(更新)",
      };
      await apiClient.saveEnvironment(undefined, updatedEnv);
      envs = await apiClient.loadEnvironments();
      expect(envs.find((e) => e.id === "staging")?.name).toBe("预发布环境(更新)");

      await apiClient.deleteEnvironment(undefined, "staging");
      envs = await apiClient.loadEnvironments();
      expect(envs.some((e) => e.id === "staging")).toBe(false);
    });

    it("returns default git status and initial sample workspace path", async () => {
      const git = await apiClient.getGitStatus("/some/workspace");
      expect(git).toEqual({
        is_git_repo: true,
        branch: "master",
        modified_files: [],
      });

      const samplePath = await apiClient.initSampleWorkspace();
      expect(samplePath).toBe("/tongyun-collections");
    });

    it("calls alert when openInExplorer is triggered in browser mode", async () => {
      const alertMock = vi.fn();
      vi.stubGlobal("alert", alertMock);

      await apiClient.openInExplorer("/test/path");
      expect(alertMock).toHaveBeenCalledWith("在桌面端将打开本地目录: /test/path");
    });
  });

  describe("executeHttpRequest via web fallback", () => {
    const baseRequest: RequestData = {
      id: "req_test",
      name: "测试请求",
      method: "GET",
      url: "{{baseUrl}}/get",
      headers: [{ key: "Accept", value: "application/json", enabled: true }],
      params: [{ key: "q", value: "test", enabled: true }],
      body: { body_type: "none", content: "" },
      auth: { auth_type: "none" },
    };

    const env: EnvironmentData = {
      id: "dev",
      name: "开发环境",
      variables: [{ key: "baseUrl", value: "https://httpbin.org", enabled: true }],
    };

    it("interpolates variables and executes GET with query params", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => '{"args":{"q":"test"}}',
      });
      vi.stubGlobal("fetch", mockFetch);

      const resp = await apiClient.executeHttpRequest(baseRequest, env);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledInit] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe("https://httpbin.org/get?q=test");
      expect(calledInit.method).toBe("GET");
      expect(calledInit.headers["Accept"]).toBe("application/json");

      expect(resp.status).toBe(200);
      expect(resp.status_text).toBe("OK");
      expect(resp.is_json).toBe(true);
      expect(resp.body).toBe('{"args":{"q":"test"}}');
      expect(resp.size_bytes).toBeGreaterThan(0);
      expect(resp.time_ms).toBeGreaterThanOrEqual(0);
    });

    it("sends POST with JSON body and Content-Type header", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 201,
        statusText: "Created",
        headers: new Headers({ "content-type": "application/json" }),
        text: async () => '{"created":true}',
      });
      vi.stubGlobal("fetch", mockFetch);

      const postReq: RequestData = {
        ...baseRequest,
        method: "POST",
        url: "https://httpbin.org/post",
        params: [],
        body: { body_type: "json", content: '{"hello":"world"}' },
      };

      const resp = await apiClient.executeHttpRequest(postReq, null);
      const [, calledInit] = mockFetch.mock.calls[0];
      expect(calledInit.method).toBe("POST");
      expect(calledInit.headers["Content-Type"]).toBe("application/json");
      expect(calledInit.body).toBe('{"hello":"world"}');
      expect(resp.status).toBe(201);
      expect(resp.is_json).toBe(true);
    });

    it("sends POST with form-urlencoded body", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "text/plain" }),
        text: async () => "ok",
      });
      vi.stubGlobal("fetch", mockFetch);

      const postReq: RequestData = {
        ...baseRequest,
        method: "POST",
        url: "https://httpbin.org/post",
        params: [],
        body: { body_type: "form-urlencoded", content: "a=1&b=2" },
      };

      await apiClient.executeHttpRequest(postReq, null);
      const [, calledInit] = mockFetch.mock.calls[0];
      expect(calledInit.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
      expect(calledInit.body).toBe("a=1&b=2");
    });

    it("rejects missing variables before invoking either transport", async () => {
      const fetch=vi.fn();vi.stubGlobal("fetch",fetch);
      await expect(apiClient.executeHttpRequest(baseRequest,null)).rejects.toThrow("UNRESOLVED_VARIABLE");
      expect(fetch).not.toHaveBeenCalled();
    });

    it("handles Bearer authentication", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        text: async () => "ok",
      });
      vi.stubGlobal("fetch", mockFetch);

      const authReq: RequestData = {
        ...baseRequest,
        url: "https://httpbin.org/get",
        auth: { auth_type: "bearer", token: "my-secret-token" },
      };

      await apiClient.executeHttpRequest(authReq, null);
      const [, calledInit] = mockFetch.mock.calls[0];
      expect(calledInit.headers["Authorization"]).toBe("Bearer my-secret-token");
    });

    it("handles Basic authentication", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        text: async () => "ok",
      });
      vi.stubGlobal("fetch", mockFetch);

      const authReq: RequestData = {
        ...baseRequest,
        url: "https://httpbin.org/get",
        auth: { auth_type: "basic", username: "user", password: "pwd" },
      };

      await apiClient.executeHttpRequest(authReq, null);
      const [, calledInit] = mockFetch.mock.calls[0];
      expect(calledInit.headers["Authorization"]).toBe(`Basic ${btoa("user:pwd")}`);
    });

    it("handles ApiKey in header and in query", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        text: async () => "ok",
      });
      vi.stubGlobal("fetch", mockFetch);

      const headerKeyReq: RequestData = {
        ...baseRequest,
        url: "https://httpbin.org/get",
        auth: {
          auth_type: "apikey",
          api_key_name: "X-API-KEY",
          api_key_value: "key123",
          api_key_in: "header",
        },
      };

      await apiClient.executeHttpRequest(headerKeyReq, null);
      const [, headerInit] = mockFetch.mock.calls[0];
      expect(headerInit.headers["X-API-KEY"]).toBe("key123");

      const queryKeyReq: RequestData = {
        ...baseRequest,
        url: "https://httpbin.org/get",
        auth: {
          auth_type: "apikey",
          api_key_name: "token",
          api_key_value: "val456",
          api_key_in: "query",
        },
      };

      await apiClient.executeHttpRequest(queryKeyReq, null);
      const [queryUrl] = mockFetch.mock.calls[1];
      expect(queryUrl).toContain("token=val456");
    });

    it("catches fetch network failure and returns formatted error payload", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connection refused")));

      const resp = await apiClient.executeHttpRequest({...baseRequest,url:"https://httpbin.org/get"}, null);
      expect(resp.status).toBe(0);
      expect(resp.status_text).toBe("Network Error");
      expect(resp.is_json).toBe(false);
      expect(resp.body).toContain("请求异常: Connection refused");
    });
  });
});
