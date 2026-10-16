import { invoke } from '@tauri-apps/api/core';
/** Token stays in memory. Browser preview cannot access the desktop gateway. */
export async function bridgeFetch(path: string, options: RequestInit): Promise<Response> {
  const config = await invoke<{port: number; token: string}>('bridge_config');
  return fetch(`http://127.0.0.1:${config.port}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${config.token}` },
  });
}
