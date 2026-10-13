import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { EnvKind } from "./parser/env";

export interface ScannedFile {
  relativePath: string;
  content: string;
}

export interface ScannedEnvFile extends ScannedFile {
  kind: EnvKind;
}

export interface ScannedWorkspace {
  root: string;
  httpFiles: ScannedFile[];
  envFiles: ScannedEnvFile[];
  warnings: string[];
}

export interface ExchangeHeader {
  name: string;
  value: string;
}

export interface Exchange {
  status: number;
  reason: string;
  elapsedMs: number;
  headers: ExchangeHeader[];
  body: string;
  truncated: boolean;
  contentType: string | null;
}

export interface Outgoing {
  method: string;
  url: string;
  headers: ExchangeHeader[];
  body: string | null;
}

export async function isDesktop(): Promise<boolean> {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

export async function examplesDir(): Promise<string | null> {
  try {
    return await invoke<string | null>("examples_dir");
  } catch {
    return null;
  }
}

export async function pickFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "打开接口文件夹",
  });
  return typeof selected === "string" ? selected : null;
}

export function scanWorkspace(root: string): Promise<ScannedWorkspace> {
  return invoke<ScannedWorkspace>("scan_workspace", { root });
}

export function sendHttp(request: Outgoing): Promise<Exchange> {
  return invoke<Exchange>("send_http", { request });
}
