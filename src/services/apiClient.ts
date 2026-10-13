import { invoke } from '@tauri-apps/api/core';
import {
  RequestData,
  ResponsePayload,
  FileTreeNode,
  EnvironmentData,
  KeyValueItem,
  GitStatusResult
} from '../types/api';
import { interpolateText } from '../utils/curl';

export type { GitStatusResult };


export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// Web / Mock Fallback state for previewing in plain browser
const mockStorageKey = 'tongyun_api_mock_workspace';

function getMockStorage(): { files: Record<string, RequestData>; tree: FileTreeNode[]; envs: EnvironmentData[] } {
  const saved = localStorage.getItem(mockStorageKey);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // ignore
    }
  }

  const defaultEnvs: EnvironmentData[] = [
    {
      id: 'development',
      name: '本地开发环境',
      variables: [
        { key: 'baseUrl', value: 'https://httpbin.org', enabled: true },
        { key: 'apiToken', value: 'ty_token_dev_8899', enabled: true },
        { key: 'userId', value: '1001', enabled: true },
      ],
    },
  ];

  const defaultFiles: Record<string, RequestData> = {
    '/tongyun-collections/01-基础HTTP/GET测试 (Query参数).json': {
      id: 'sample_get',
      name: 'GET测试 (Query参数)',
      method: 'GET',
      url: '{{baseUrl}}/get',
      headers: [
        { key: 'Accept', value: 'application/json', enabled: true, description: '接收JSON响应' },
        { key: 'User-Agent', value: 'TongyunAPI/1.0', enabled: true },
      ],
      params: [
        { key: 'userId', value: '{{userId}}', enabled: true, description: '当前测试用户ID' },
        { key: 'lang', value: 'zh-CN', enabled: true },
      ],
      body: { body_type: 'none', content: '' },
      auth: { auth_type: 'bearer', token: '{{apiToken}}' },
      description: '演示带环境变量、Query 参数与 Bearer Token 的 GET 请求',
    },
    '/tongyun-collections/01-基础HTTP/POST测试 (JSON Body).json': {
      id: 'sample_post_json',
      name: 'POST测试 (JSON Body)',
      method: 'POST',
      url: '{{baseUrl}}/post',
      headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
      params: [],
      body: {
        body_type: 'json',
        content: '{\n  "appName": "tongyun-api",\n  "version": "0.1.0",\n  "features": [\n    "纯文本存储",\n    "Git友好",\n    "毫秒级响应测量"\n  ]\n}',
      },
      auth: { auth_type: 'none' },
      description: '演示 POST 请求体发送与格式化',
    },
    '/tongyun-collections/02-状态码与时延/延迟响应测量 (Delay 1s).json': {
      id: 'sample_delay',
      name: '延迟响应测量 (Delay 1s)',
      method: 'GET',
      url: '{{baseUrl}}/delay/1',
      headers: [],
      params: [],
      body: { body_type: 'none', content: '' },
      auth: { auth_type: 'none' },
      description: '测试耗时时延测量功能，验证进度条与耗时徽标',
    },
  };

  const defaultTree: FileTreeNode[] = [
    {
      id: '/tongyun-collections/01-基础HTTP',
      name: '01-基础HTTP',
      path: '/tongyun-collections/01-基础HTTP',
      is_dir: true,
      children: [
        {
          id: '/tongyun-collections/01-基础HTTP/GET测试 (Query参数).json',
          name: 'GET测试 (Query参数)',
          path: '/tongyun-collections/01-基础HTTP/GET测试 (Query参数).json',
          is_dir: false,
          method: 'GET',
        },
        {
          id: '/tongyun-collections/01-基础HTTP/POST测试 (JSON Body).json',
          name: 'POST测试 (JSON Body)',
          path: '/tongyun-collections/01-基础HTTP/POST测试 (JSON Body).json',
          is_dir: false,
          method: 'POST',
        },
      ],
    },
    {
      id: '/tongyun-collections/02-状态码与时延',
      name: '02-状态码与时延',
      path: '/tongyun-collections/02-状态码与时延',
      is_dir: true,
      children: [
        {
          id: '/tongyun-collections/02-状态码与时延/延迟响应测量 (Delay 1s).json',
          name: '延迟响应测量 (Delay 1s)',
          path: '/tongyun-collections/02-状态码与时延/延迟响应测量 (Delay 1s).json',
          is_dir: false,
          method: 'GET',
        },
      ],
    },
  ];

  return { files: defaultFiles, tree: defaultTree, envs: defaultEnvs };
}

function saveMockStorage(data: { files: Record<string, RequestData>; tree: FileTreeNode[]; envs: EnvironmentData[] }) {
  localStorage.setItem(mockStorageKey, JSON.stringify(data));
}

export const apiClient = {
  async getWorkspacePath(customPath?: string): Promise<string> {
    if (isTauri()) {
      return await invoke<string>('get_workspace_path', { customPath });
    }
    return '/tongyun-collections (浏览器演示模拟)';
  },

  async loadFileTree(workspacePath?: string): Promise<FileTreeNode[]> {
    if (isTauri()) {
      return await invoke<FileTreeNode[]>('load_file_tree', { workspacePath });
    }
    return getMockStorage().tree;
  },

  async readRequestFile(filePath: string): Promise<RequestData> {
    if (isTauri()) {
      const data = await invoke<RequestData>('read_request_file', { filePath });
      return { ...data, filePath };
    }
    const store = getMockStorage();
    const found = store.files[filePath];
    if (!found) throw new Error(`未找到请求文件: ${filePath}`);
    return { ...found, filePath };
  },

  async saveRequestFile(filePath: string, data: RequestData): Promise<void> {
    if (isTauri()) {
      await invoke('save_request_file', { filePath, data });
      return;
    }
    const store = getMockStorage();
    store.files[filePath] = data;
    saveMockStorage(store);
  },

  async createFileOrFolder(
    parentPath: string,
    name: string,
    isDir: boolean,
    initialData?: RequestData
  ): Promise<string> {
    if (isTauri()) {
      return await invoke<string>('create_file_or_folder', {
        parentPath,
        name,
        isDir,
        initialData,
      });
    }
    const store = getMockStorage();
    const newPath = `${parentPath}/${name}${isDir ? '' : '.json'}`;
    if (!isDir) {
      const req: RequestData = initialData || {
        id: `req_${Date.now()}`,
        name: name.replace('.json', ''),
        method: 'GET',
        url: 'https://httpbin.org/get',
        headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
        params: [],
        body: { body_type: 'none', content: '' },
        auth: { auth_type: 'none' },
        description: '新建请求',
      };
      store.files[newPath] = req;
    }
    // Update tree
    const targetFolder = store.tree.find(t => t.path === parentPath);
    const newNode: FileTreeNode = {
      id: newPath,
      name: name.replace('.json', ''),
      path: newPath,
      is_dir: isDir,
      method: isDir ? undefined : initialData?.method || 'GET',
      children: isDir ? [] : undefined,
    };
    if (targetFolder && targetFolder.children) {
      targetFolder.children.push(newNode);
    } else {
      store.tree.push(newNode);
    }
    saveMockStorage(store);
    return newPath;
  },

  async deleteFileOrFolder(path: string): Promise<void> {
    if (isTauri()) {
      await invoke('delete_file_or_folder', { path });
      return;
    }
    const store = getMockStorage();
    delete store.files[path];
    const filterNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes
        .filter(n => n.path !== path)
        .map(n => ({
          ...n,
          children: n.children ? filterNodes(n.children) : undefined,
        }));
    };
    store.tree = filterNodes(store.tree);
    saveMockStorage(store);
  },

  async renameFileOrFolder(oldPath: string, newName: string): Promise<string> {
    if (isTauri()) {
      return await invoke<string>('rename_file_or_folder', { oldPath, newName });
    }
    const store = getMockStorage();
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const isFile = oldPath.endsWith('.json');
    const newPath = `${parentPath}/${newName}${isFile && !newName.endsWith('.json') ? '.json' : ''}`;
    if (isFile && store.files[oldPath]) {
      const data = store.files[oldPath];
      data.name = newName.replace('.json', '');
      store.files[newPath] = data;
      delete store.files[oldPath];
    }
    const renameNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.map(n => {
        if (n.path === oldPath) {
          return {
            ...n,
            id: newPath,
            path: newPath,
            name: newName.replace('.json', ''),
            children: n.children,
          };
        }
        return {
          ...n,
          children: n.children ? renameNodes(n.children) : undefined,
        };
      });
    };
    store.tree = renameNodes(store.tree);
    saveMockStorage(store);
    return newPath;
  },

  async loadEnvironments(workspacePath?: string): Promise<EnvironmentData[]> {
    if (isTauri()) {
      return await invoke<EnvironmentData[]>('load_environments', { workspacePath });
    }
    return getMockStorage().envs;
  },

  async saveEnvironment(workspacePath: string | undefined, env: EnvironmentData): Promise<void> {
    if (isTauri()) {
      await invoke('save_environment', { workspacePath, env });
      return;
    }
    const store = getMockStorage();
    const idx = store.envs.findIndex(e => e.id === env.id);
    if (idx >= 0) {
      store.envs[idx] = env;
    } else {
      store.envs.push(env);
    }
    saveMockStorage(store);
  },

  async deleteEnvironment(workspacePath: string | undefined, envId: string): Promise<void> {
    if (isTauri()) {
      await invoke('delete_environment', { workspacePath, envId });
      return;
    }
    const store = getMockStorage();
    store.envs = store.envs.filter(e => e.id !== envId);
    saveMockStorage(store);
  },

  async initSampleWorkspace(workspacePath?: string): Promise<string> {
    if (isTauri()) {
      return await invoke<string>('init_sample_workspace', { workspacePath });
    }
    const store = getMockStorage();
    saveMockStorage(store);
    return '/tongyun-collections';
  },

  async executeHttpRequest(
    request: RequestData,
    environment: EnvironmentData | null
  ): Promise<ResponsePayload> {
    // 变量替换
    const resolvedUrl = interpolateText(request.url || '', environment);
    const resolvedHeaders: KeyValueItem[] = (request.headers || []).map(h => ({
      ...h,
      key: interpolateText(h.key, environment),
      value: interpolateText(h.value, environment),
    }));
    const resolvedParams: KeyValueItem[] = (request.params || []).map(p => ({
      ...p,
      key: interpolateText(p.key, environment),
      value: interpolateText(p.value, environment),
    }));
    const resolvedBody = {
      ...(request.body || { body_type: 'none', content: '' }),
      content: interpolateText(request.body?.content || '', environment),
    };
    const resolvedAuth = {
      ...(request.auth || { auth_type: 'none' }),
      token: request.auth?.token ? interpolateText(request.auth.token, environment) : undefined,
      username: request.auth?.username ? interpolateText(request.auth.username, environment) : undefined,
      password: request.auth?.password ? interpolateText(request.auth.password, environment) : undefined,
      api_key_name: request.auth?.api_key_name ? interpolateText(request.auth.api_key_name, environment) : undefined,
      api_key_value: request.auth?.api_key_value ? interpolateText(request.auth.api_key_value, environment) : undefined,
    };

    if (isTauri()) {
      return await invoke<ResponsePayload>('execute_http_request', {
        payload: {
          method: request.method,
          url: resolvedUrl,
          headers: resolvedHeaders,
          params: resolvedParams,
          body: resolvedBody,
          auth: resolvedAuth,
          timeout_ms: 30000,
          redirect_policy: request.redirect_policy || 'safe',
        },
      });
    }

    // Web Fallback execution via standard browser fetch
    const startTime = performance.now();
    try {
      const urlObj = new URL(resolvedUrl.startsWith('http') ? resolvedUrl : `http://${resolvedUrl}`);
      for (const p of resolvedParams.filter(p => p.enabled && p.key.trim())) {
        urlObj.searchParams.append(p.key, p.value);
      }

      const headers: Record<string, string> = {};
      for (const h of resolvedHeaders.filter(h => h.enabled && h.key.trim())) {
        headers[h.key] = h.value;
      }

      if (resolvedAuth.auth_type === 'bearer' && resolvedAuth.token) {
        headers['Authorization'] = `Bearer ${resolvedAuth.token}`;
      } else if (resolvedAuth.auth_type === 'basic' && resolvedAuth.username) {
        headers['Authorization'] = `Basic ${btoa(`${resolvedAuth.username}:${resolvedAuth.password || ''}`)}`;
      } else if (resolvedAuth.auth_type === 'apikey' && resolvedAuth.api_key_name && resolvedAuth.api_key_value) {
        if (resolvedAuth.api_key_in === 'query') {
          urlObj.searchParams.append(resolvedAuth.api_key_name, resolvedAuth.api_key_value);
        } else {
          headers[resolvedAuth.api_key_name] = resolvedAuth.api_key_value;
        }
      }

      const fetchOptions: RequestInit = {
        method: request.method,
        headers,
      };

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        if (resolvedBody.body_type === 'json' && resolvedBody.content) {
          headers['Content-Type'] = 'application/json';
          fetchOptions.body = resolvedBody.content;
        } else if (resolvedBody.body_type === 'form-urlencoded' && resolvedBody.content) {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
          fetchOptions.body = resolvedBody.content;
        } else if (resolvedBody.body_type === 'raw' && resolvedBody.content) {
          fetchOptions.body = resolvedBody.content;
        } else if (resolvedBody.body_type === 'form-data' && resolvedBody.form_data) {
          const formData = new FormData();
          for (const item of resolvedBody.form_data.filter(i => i.enabled && i.key.trim())) {
            if (item.type === 'file' && item.fileName) {
              const blob = new Blob([item.value || ''], { type: 'application/octet-stream' });
              formData.append(item.key, blob, item.fileName);
            } else {
              formData.append(item.key, item.value);
            }
          }
          delete headers['Content-Type'];
          fetchOptions.body = formData;
        }
      }

      const resp = await fetch(urlObj.toString(), fetchOptions);
      const timeMs = Math.round(performance.now() - startTime);
      const respHeaders: KeyValueItem[] = [];
      let isJson = false;
      resp.headers.forEach((v, k) => {
        if (k.toLowerCase() === 'content-type' && v.includes('application/json')) {
          isJson = true;
        }
        respHeaders.push({ key: k, value: v, enabled: true });
      });

      const bodyText = await resp.text();
      if (!isJson && (bodyText.trim().startsWith('{') || bodyText.trim().startsWith('['))) {
        try {
          JSON.parse(bodyText);
          isJson = true;
        } catch {
          // not json
        }
      }

      return {
        status: resp.status,
        status_text: resp.statusText || (resp.status === 200 ? 'OK' : 'Response'),
        headers: respHeaders,
        body: bodyText,
        time_ms: timeMs,
        size_bytes: new Blob([bodyText]).size,
        is_json: isJson,
      };
    } catch (err: any) {
      const timeMs = Math.round(performance.now() - startTime);
      return {
        status: 0,
        status_text: 'Network Error',
        headers: [],
        body: `请求异常: ${err.message || String(err)}\n(提示: 浏览器预览环境受 CORS 限制，请在 Tauri 桌面端运行体验完整免跨域原生请求)`,
        time_ms: timeMs,
        size_bytes: 0,
        is_json: false,
      };
    }
  },

  async getGitStatus(workspacePath: string): Promise<GitStatusResult> {
    if (isTauri()) {
      return await invoke<GitStatusResult>('get_git_status', { workspacePath });
    }
    return {
      is_git_repo: true,
      branch: 'master',
      modified_files: [],
    };
  },

  async openInExplorer(path: string): Promise<void> {
    if (isTauri()) {
      return await invoke('open_in_explorer', { path });
    }
    alert(`在桌面端将打开本地目录: ${path}`);
  },
};

