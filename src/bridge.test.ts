import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock, isTauriMock, openMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  isTauriMock: vi.fn(),
  openMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: openMock,
}));

import {
  examplesDir,
  isDesktop,
  pickFolder,
  scanWorkspace,
  sendHttp,
  type Outgoing,
} from "./bridge";

beforeEach(() => {
  invokeMock.mockReset();
  isTauriMock.mockReset();
  openMock.mockReset();
});

describe("isDesktop", () => {
  it("reports true when the Tauri runtime is available", async () => {
    isTauriMock.mockReturnValue(true);
    await expect(isDesktop()).resolves.toBe(true);
  });

  it("reports false when the Tauri runtime is unavailable", async () => {
    isTauriMock.mockReturnValue(false);
    await expect(isDesktop()).resolves.toBe(false);
  });

  it("swallows errors from the runtime probe", async () => {
    isTauriMock.mockImplementation(() => {
      throw new Error("no internals");
    });
    await expect(isDesktop()).resolves.toBe(false);
  });
});

describe("examplesDir", () => {
  it("returns the directory reported by the backend", async () => {
    invokeMock.mockResolvedValue("/tmp/examples");
    await expect(examplesDir()).resolves.toBe("/tmp/examples");
    expect(invokeMock).toHaveBeenCalledWith("examples_dir");
  });

  it("returns null when the backend reports no directory", async () => {
    invokeMock.mockResolvedValue(null);
    await expect(examplesDir()).resolves.toBeNull();
  });

  it("returns null when the backend call fails", async () => {
    invokeMock.mockRejectedValue(new Error("boom"));
    await expect(examplesDir()).resolves.toBeNull();
  });
});

describe("pickFolder", () => {
  it("returns the selected directory and passes directory options", async () => {
    openMock.mockResolvedValue("/tmp/collections");
    await expect(pickFolder()).resolves.toBe("/tmp/collections");
    expect(openMock).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      title: "打开接口文件夹",
    });
  });

  it("returns null when the dialog is dismissed", async () => {
    openMock.mockResolvedValue(null);
    await expect(pickFolder()).resolves.toBeNull();
  });

  it("returns null for non-string selections", async () => {
    openMock.mockResolvedValue(["/tmp/a", "/tmp/b"]);
    await expect(pickFolder()).resolves.toBeNull();
  });
});

describe("scanWorkspace", () => {
  it("invokes scan_workspace with the root argument", async () => {
    const workspace = {
      root: "/tmp/collections",
      httpFiles: [],
      envFiles: [],
      warnings: [],
    };
    invokeMock.mockResolvedValue(workspace);

    await expect(scanWorkspace("/tmp/collections")).resolves.toBe(workspace);
    expect(invokeMock).toHaveBeenCalledWith("scan_workspace", {
      root: "/tmp/collections",
    });
  });
});

describe("sendHttp", () => {
  it("invokes send_http with the outgoing request", async () => {
    const request: Outgoing = {
      method: "GET",
      url: "https://httpbin.org/get",
      headers: [{ name: "Accept", value: "application/json" }],
      body: null,
    };
    const exchange = {
      status: 200,
      reason: "OK",
      elapsedMs: 12,
      headers: [{ name: "content-type", value: "application/json" }],
      body: "{}",
      truncated: false,
      contentType: "application/json",
    };
    invokeMock.mockResolvedValue(exchange);

    await expect(sendHttp(request)).resolves.toBe(exchange);
    expect(invokeMock).toHaveBeenCalledWith("send_http", { request });
  });
});
