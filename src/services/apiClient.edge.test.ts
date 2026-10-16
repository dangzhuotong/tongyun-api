import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { apiClient } from "./apiClient";
import type { RequestData } from "../types/api";

describe("apiClient web fallback edge cases", () => {
  const storageMap = new Map<string, string>();
  const mockStorageKey = "tongyun_api_mock_workspace";

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

  const okResponse = (overrides: Record<string, unknown> = {}) => ({
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    text: async () => "ok",
    ...overrides,
  });

  describe("mock storage robustness", () => {
    it("falls back to default storage when persisted JSON is corrupt", async () => {
      storageMap.set(mockStorageKey, "{ not valid json");
      const tree = await apiClient.loadFileTree();
      expect(tree).toHaveLength(2);
      expect(tree[0].name).toBe("01-基础HTTP");
    });

    it("creates a file in an unknown parent by pushing a root tree node", async () => {
      const createdPath = await apiClient.createFileOrFolder("/no-such-parent", "孤儿文件", false);
      expect(createdPath).toBe("/no-such-parent/孤儿文件.json");

      const tree = await apiClient.loadFileTree();
      expect(tree.some((n) => n.path === createdPath)).toBe(true);
    });

    it("uses provided initial data when creating a file", async () => {
      const initial: RequestData = {
        id: "custom_id",
        name: "自定义名称",
        method: "PUT",
        url: "https://httpbin.org/put",
        headers: [],
        params: [],
        body: { body_type: "none", content: "" },
        auth: { auth_type: "none" },
      };
      const createdPath = await apiClient.createFileOrFolder(
        "/tongyun-collections/01-基础HTTP",
        "自定义请求",
        false,
        initial,
      );

      const fileData = await apiClient.readRequestFile(createdPath);
      expect(fileData.name).toBe("自定义名称");
      expect(fileData.method).toBe("PUT");

      const tree = await apiClient.loadFileTree();
      const folder = tree.find((t) => t.path === "/tongyun-collections/01-基础HTTP");
      const node = folder?.children?.find((c) => c.path === createdPath);
      expect(node?.method).toBe("PUT");
    });

    it("renames a directory and updates its tree path", async () => {
      const createdPath = await apiClient.createFileOrFolder("/tongyun-collections", "03-模块", true);
      const renamedPath = await apiClient.renameFileOrFolder(createdPath, "03-改名");

      expect(renamedPath).toBe("/tongyun-collections/03-改名");
      const tree = await apiClient.loadFileTree();
      expect(tree.some((n) => n.path === renamedPath && n.is_dir)).toBe(true);
      expect(tree.some((n) => n.path === createdPath)).toBe(false);
    });
  });

  describe("executeHttpRequest edge cases", () => {
    it("prefixes a protocol-less URL with http", async () => {
      const mockFetch = vi.fn().mockResolvedValue(okResponse());
      vi.stubGlobal("fetch", mockFetch);

      await apiClient.executeHttpRequest({ ...baseRequest, url: "localhost:3000/api" }, null);
      const [calledUrl] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe("http://localhost:3000/api");
    });

    it("returns a network error for a malformed URL that already looks like http", async () => {
      const resp = await apiClient.executeHttpRequest({ ...baseRequest, url: "httpbin.org/get" }, null);
      expect(resp.status).toBe(0);
      expect(resp.status_text).toBe("Network Error");
      expect(resp.body).toContain("请求异常");
    });

    it("filters disabled headers and params and blank keys", async () => {
      const mockFetch = vi.fn().mockResolvedValue(okResponse());
      vi.stubGlobal("fetch", mockFetch);

      const req: RequestData = {
        ...baseRequest,
        params: [
          { key: "on", value: "1", enabled: true },
          { key: "off", value: "2", enabled: false },
          { key: "   ", value: "3", enabled: true },
        ],
        headers: [
          { key: "X-On", value: "yes", enabled: true },
          { key: "X-Off", value: "no", enabled: false },
          { key: "  ", value: "blank", enabled: true },
        ],
      };
      await apiClient.executeHttpRequest(req, null);
      const [calledUrl, calledInit] = mockFetch.mock.calls[0];
      expect(calledUrl).toContain("on=1");
      expect(calledUrl).not.toContain("off=2");
      expect(calledUrl).not.toContain("=3");
      expect(calledInit.headers["X-On"]).toBe("yes");
      expect(calledInit.headers["X-Off"]).toBeUndefined();
      expect(calledInit.headers[""]).toBeUndefined();
    });

    it("sends a raw body without a Content-Type header", async () => {
      const mockFetch = vi.fn().mockResolvedValue(okResponse());
      vi.stubGlobal("fetch", mockFetch);

      const req: RequestData = {
        ...baseRequest,
        method: "POST",
        url: "https://httpbin.org/post",
        body: { body_type: "raw", content: "plain payload" },
      };
      await apiClient.executeHttpRequest(req, null);
      const [, calledInit] = mockFetch.mock.calls[0];
      expect(calledInit.body).toBe("plain payload");
      expect(calledInit.headers["Content-Type"]).toBeUndefined();
    });

    it("builds FormData for form-data bodies and removes Content-Type", async () => {
      const mockFetch = vi.fn().mockResolvedValue(okResponse());
      vi.stubGlobal("fetch", mockFetch);

      const req: RequestData = {
        ...baseRequest,
        method: "POST",
        url: "https://httpbin.org/post",
        headers: [{ key: "Content-Type", value: "multipart/form-data", enabled: true }],
        body: {
          body_type: "form-data",
          content: "",
          form_data: [
            { key: "field", value: "value", type: "text", enabled: true },
            { key: "skip", value: "x", type: "text", enabled: false },
          ],
        },
      };
      await apiClient.executeHttpRequest(req, null);
      const [, calledInit] = mockFetch.mock.calls[0];
      expect(calledInit.body).toBeInstanceOf(FormData);
      expect((calledInit.body as FormData).get("field")).toBe("value");
      expect((calledInit.body as FormData).has("skip")).toBe(false);
      expect(calledInit.headers["Content-Type"]).toBeUndefined();
    });

    it("does not attach a body for HEAD requests", async () => {
      const mockFetch = vi.fn().mockResolvedValue(okResponse());
      vi.stubGlobal("fetch", mockFetch);

      const req: RequestData = {
        ...baseRequest,
        method: "HEAD",
        body: { body_type: "json", content: '{"ignored":true}' },
      };
      await apiClient.executeHttpRequest(req, null);
      const [, calledInit] = mockFetch.mock.calls[0];
      expect(calledInit.body).toBeUndefined();
      expect(calledInit.headers["Content-Type"]).toBeUndefined();
    });

    it("marks a non-JSON content type body as JSON when it parses", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        okResponse({ headers: new Headers({ "content-type": "text/plain" }), text: async () => '{"a":1}' }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const resp = await apiClient.executeHttpRequest(baseRequest, null);
      expect(resp.is_json).toBe(true);
    });

    it("leaves is_json false when a JSON-looking body does not parse", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        okResponse({ headers: new Headers({ "content-type": "text/plain" }), text: async () => "{oops" }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const resp = await apiClient.executeHttpRequest(baseRequest, null);
      expect(resp.is_json).toBe(false);
    });

    it("falls back to a generic status text when the response has none", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        okResponse({ status: 204, statusText: "", text: async () => "" }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const resp = await apiClient.executeHttpRequest(baseRequest, null);
      expect(resp.status).toBe(204);
      expect(resp.status_text).toBe("Response");
      expect(resp.size_bytes).toBe(0);
    });

    it("uses OK as the fallback status text for a 200 response without one", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        okResponse({ statusText: "", text: async () => "" }),
      );
      vi.stubGlobal("fetch", mockFetch);

      const resp = await apiClient.executeHttpRequest(baseRequest, null);
      expect(resp.status_text).toBe("OK");
    });

    it("appends an ApiKey query parameter after existing params", async () => {
      const mockFetch = vi.fn().mockResolvedValue(okResponse());
      vi.stubGlobal("fetch", mockFetch);

      const req: RequestData = {
        ...baseRequest,
        params: [{ key: "a", value: "1", enabled: true }],
        auth: {
          auth_type: "apikey",
          api_key_name: "k",
          api_key_value: "v",
          api_key_in: "query",
        },
      };
      await apiClient.executeHttpRequest(req, null);
      const [calledUrl] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe("https://httpbin.org/get?a=1&k=v");
    });

    it("interpolates variables inside auth fields before sending", async () => {
      const mockFetch = vi.fn().mockResolvedValue(okResponse());
      vi.stubGlobal("fetch", mockFetch);

      const req: RequestData = {
        ...baseRequest,
        auth: { auth_type: "bearer", token: "{{tok}}" },
      };
      await apiClient.executeHttpRequest(req, {
        id: "dev",
        name: "开发",
        variables: [{ key: "tok", value: "resolved-token", enabled: true }],
      });
      const [, calledInit] = mockFetch.mock.calls[0];
      expect(calledInit.headers["Authorization"]).toBe("Bearer resolved-token");
    });
  });
});
