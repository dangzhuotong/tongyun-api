import { RequestData, EnvironmentData, HttpMethod, KeyValueItem } from '../types/api';

export function interpolateText(text: string, env: EnvironmentData | null): string {
  if (!text || !env) return text;
  let result = text;
  for (const v of env.variables) {
    if (v.enabled && v.key.trim()) {
      const pattern = new RegExp(`\\{\\{${v.key.trim()}\\}\\}`, 'g');
      result = result.replace(pattern, v.value);
    }
  }
  return result;
}

export function exportToCurl(req: RequestData, env: EnvironmentData | null): string {
  const resolvedUrl = interpolateText(req.url, env);
  
  // 处理 params
  const enabledParams = req.params.filter(p => p.enabled && p.key.trim());
  let finalUrl = resolvedUrl;
  if (enabledParams.length > 0) {
    const urlObj = new URL(resolvedUrl.startsWith('http') ? resolvedUrl : `http://${resolvedUrl}`);
    for (const p of enabledParams) {
      urlObj.searchParams.append(interpolateText(p.key, env), interpolateText(p.value, env));
    }
    finalUrl = urlObj.toString();
  }

  const parts: string[] = ['curl'];

  if (req.method !== 'GET') {
    parts.push(`-X ${req.method}`);
  }

  parts.push(`"${finalUrl}"`);

  // Headers
  for (const h of req.headers.filter(h => h.enabled && h.key.trim())) {
    const k = interpolateText(h.key, env);
    const v = interpolateText(h.value, env);
    parts.push(`-H "${k}: ${v}"`);
  }

  // Auth
  if (req.auth.auth_type === 'bearer' && req.auth.token) {
    const token = interpolateText(req.auth.token, env);
    parts.push(`-H "Authorization: Bearer ${token}"`);
  } else if (req.auth.auth_type === 'basic' && req.auth.username) {
    const u = interpolateText(req.auth.username, env);
    const p = interpolateText(req.auth.password || '', env);
    parts.push(`-u "${u}:${p}"`);
  } else if (req.auth.auth_type === 'apikey' && req.auth.api_key_name && req.auth.api_key_value) {
    const k = interpolateText(req.auth.api_key_name, env);
    const v = interpolateText(req.auth.api_key_value, env);
    if (req.auth.api_key_in === 'header') {
      parts.push(`-H "${k}: ${v}"`);
    }
  }

  // Body
  if (req.body.body_type === 'json' && req.body.content.trim()) {
    parts.push(`-H "Content-Type: application/json"`);
    const escaped = req.body.content.replace(/"/g, '\\"').replace(/\n/g, ' ');
    parts.push(`-d "${escaped}"`);
  } else if (req.body.body_type === 'form-urlencoded' && req.body.content.trim()) {
    parts.push(`-H "Content-Type: application/x-www-form-urlencoded"`);
    parts.push(`-d "${req.body.content}"`);
  } else if (req.body.body_type === 'raw' && req.body.content) {
    const escaped = req.body.content.replace(/"/g, '\\"').replace(/\n/g, ' ');
    parts.push(`-d "${escaped}"`);
  }

  return parts.join(' \\\n  ');
}

export function parseCurl(curlStr: string): Partial<RequestData> {
  const result: Partial<RequestData> = {
    method: 'GET',
    url: '',
    headers: [],
    params: [],
    body: { body_type: 'none', content: '' },
    auth: { auth_type: 'none' },
  };

  const cleanCmd = curlStr.replace(/\\\r?\n/g, ' ').trim();
  if (!cleanCmd.toLowerCase().startsWith('curl')) {
    throw new Error('请输入以 curl 开头的有效命令');
  }

  // 提取方法
  const methodMatch = cleanCmd.match(/-X\s+([A-Z]+)/i);
  if (methodMatch) {
    result.method = methodMatch[1].toUpperCase() as HttpMethod;
  }

  // 提取 URL
  const urlMatch = cleanCmd.match(/(?:curl\s+|["'])(https?:\/\/[^\s"']+)/i) ||
                   cleanCmd.match(/(https?:\/\/[^\s"']+)/i);
  if (urlMatch) {
    result.url = urlMatch[1];
  }

  // 提取 Headers
  const headerRegex = /-H\s+["']([^"']+)["']/g;
  let match;
  const headers: KeyValueItem[] = [];
  while ((match = headerRegex.exec(cleanCmd)) !== null) {
    const headerLine = match[1];
    const colonIdx = headerLine.indexOf(':');
    if (colonIdx > 0) {
      const key = headerLine.substring(0, colonIdx).trim();
      const value = headerLine.substring(colonIdx + 1).trim();
      
      if (key.toLowerCase() === 'authorization' && value.toLowerCase().startsWith('bearer ')) {
        result.auth = {
          auth_type: 'bearer',
          token: value.substring(7).trim(),
        };
      } else {
        headers.push({ key, value, enabled: true });
      }
    }
  }
  result.headers = headers;

  // 提取 Body (-d or --data or --data-raw)
  const dataMatch = cleanCmd.match(/(?:-d|--data|--data-raw)\s+["']([\s\S]*?)["'](?:\s+-[A-Za-z]|$)/);
  if (dataMatch) {
    const bodyText = dataMatch[1];
    result.body = {
      body_type: bodyText.trim().startsWith('{') || bodyText.trim().startsWith('[') ? 'json' : 'raw',
      content: bodyText,
    };
    if (result.method === 'GET') {
      result.method = 'POST';
    }
  }

  return result;
}
