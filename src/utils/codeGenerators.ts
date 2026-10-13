import { RequestData, EnvironmentData } from '../types/api';
import { interpolateText, exportToCurl } from './curl';

export type SupportedLanguage =
  | 'curl'
  | 'javascript_fetch'
  | 'javascript_axios'
  | 'typescript_fetch'
  | 'python_requests'
  | 'python_httpx'
  | 'go_http'
  | 'rust_reqwest';

export interface LanguageOption {
  id: SupportedLanguage;
  name: string;
  category: string;
  extension: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { id: 'curl', name: 'cURL', category: 'Shell', extension: 'sh' },
  { id: 'javascript_fetch', name: 'JavaScript (Fetch)', category: 'JavaScript', extension: 'js' },
  { id: 'javascript_axios', name: 'JavaScript (Axios)', category: 'JavaScript', extension: 'js' },
  { id: 'typescript_fetch', name: 'TypeScript (Fetch)', category: 'TypeScript', extension: 'ts' },
  { id: 'python_requests', name: 'Python (Requests)', category: 'Python', extension: 'py' },
  { id: 'python_httpx', name: 'Python (HTTPX)', category: 'Python', extension: 'py' },
  { id: 'go_http', name: 'Go (net/http)', category: 'Go', extension: 'go' },
  { id: 'rust_reqwest', name: 'Rust (reqwest)', category: 'Rust', extension: 'rs' },
];

/**
 * 组装请求信息辅助函数
 */
function resolveRequestDetails(req: RequestData, env: EnvironmentData | null, interpolate: boolean) {
  const envToUse = interpolate ? env : null;
  const rawUrl = req.url || 'https://api.example.com';
  const resolvedUrl = interpolateText(rawUrl, envToUse);

  // 拼接查询参数
  const enabledParams = req.params.filter(p => p.enabled && p.key.trim());
  let finalUrl = resolvedUrl;
  if (enabledParams.length > 0) {
    try {
      const urlObj = new URL(resolvedUrl.startsWith('http') ? resolvedUrl : `http://${resolvedUrl}`);
      for (const p of enabledParams) {
        urlObj.searchParams.append(
          interpolateText(p.key, envToUse),
          interpolateText(p.value, envToUse)
        );
      }
      finalUrl = urlObj.toString();
    } catch {
      const qs = enabledParams
        .map(
          p =>
            `${encodeURIComponent(interpolateText(p.key, envToUse))}=${encodeURIComponent(
              interpolateText(p.value, envToUse)
            )}`
        )
        .join('&');
      finalUrl = finalUrl.includes('?') ? `${finalUrl}&${qs}` : `${finalUrl}?${qs}`;
    }
  }

  // 整理 Headers
  const headers: Record<string, string> = {};
  for (const h of req.headers.filter(h => h.enabled && h.key.trim())) {
    headers[interpolateText(h.key, envToUse)] = interpolateText(h.value, envToUse);
  }

  // Auth 处理
  if (req.auth.auth_type === 'bearer' && req.auth.token) {
    headers['Authorization'] = `Bearer ${interpolateText(req.auth.token, envToUse)}`;
  } else if (req.auth.auth_type === 'basic' && req.auth.username) {
    const cred = `${interpolateText(req.auth.username, envToUse)}:${interpolateText(
      req.auth.password || '',
      envToUse
    )}`;
    headers['Authorization'] = `Basic ${btoa(cred)}`;
  } else if (req.auth.auth_type === 'apikey' && req.auth.api_key_name && req.auth.api_key_value) {
    if (req.auth.api_key_in === 'header') {
      headers[interpolateText(req.auth.api_key_name, envToUse)] = interpolateText(
        req.auth.api_key_value,
        envToUse
      );
    }
  }

  // Body 与 Content-Type
  let bodyContent = '';
  if (req.body.body_type === 'json' && req.body.content.trim()) {
    headers['Content-Type'] = 'application/json';
    bodyContent = interpolateText(req.body.content, envToUse);
  } else if (req.body.body_type === 'form-urlencoded' && req.body.content.trim()) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    bodyContent = interpolateText(req.body.content, envToUse);
  } else if (req.body.body_type === 'raw' && req.body.content) {
    bodyContent = interpolateText(req.body.content, envToUse);
  }

  return {
    method: req.method,
    url: finalUrl,
    headers,
    body: bodyContent,
    bodyType: req.body.body_type,
  };
}

/**
 * 生成各语言代码片段
 */
export function generateCodeSnippet(
  lang: SupportedLanguage,
  req: RequestData,
  env: EnvironmentData | null,
  interpolate: boolean = true
): string {
  const envToUse = interpolate ? env : null;
  const details = resolveRequestDetails(req, env, interpolate);

  switch (lang) {
    case 'curl':
      return exportToCurl(req, envToUse);

    case 'javascript_fetch': {
      const headersStr = JSON.stringify(details.headers, null, 2);
      const hasBody = details.body && details.method !== 'GET' && details.method !== 'HEAD';
      return `const headers = ${headersStr};

fetch("${details.url}", {
  method: "${details.method}",
  headers: headers,${
    hasBody
      ? `\n  body: ${details.bodyType === 'json' ? JSON.stringify(details.body) : `\`${details.body}\``},`
      : ''
  }
})
  .then(async (response) => {
    const data = await response.text();
    console.log("Status:", response.status);
    console.log("Response:", data);
  })
  .catch((error) => console.error("Error:", error));
`;
    }

    case 'typescript_fetch': {
      const headersStr = JSON.stringify(details.headers, null, 2);
      const hasBody = details.body && details.method !== 'GET' && details.method !== 'HEAD';
      return `async function callApi(): Promise<void> {
  const headers: HeadersInit = ${headersStr};

  try {
    const response = await fetch("${details.url}", {
      method: "${details.method}",
      headers,${
        hasBody
          ? `\n      body: ${
              details.bodyType === 'json'
                ? `JSON.stringify(${details.body})`
                : `\`${details.body}\``
            },`
          : ''
      }
    });

    const result = await response.text();
    console.log("Status:", response.status);
    console.log("Result:", result);
  } catch (error) {
    console.error("Fetch failed:", error);
  }
}

callApi();
`;
    }

    case 'javascript_axios': {
      const headersStr = JSON.stringify(details.headers, null, 2);
      const hasBody = details.body && details.method !== 'GET' && details.method !== 'HEAD';
      return `import axios from 'axios';

const config = {
  method: '${details.method.toLowerCase()}',
  maxBodyLength: Infinity,
  url: '${details.url}',
  headers: ${headersStr},${
    hasBody
      ? `\n  data: ${details.bodyType === 'json' ? details.body : `\`${details.body}\``},`
      : ''
  }
};

axios.request(config)
  .then((response) => {
    console.log(response.status, response.data);
  })
  .catch((error) => {
    console.error(error);
  });
`;
    }

    case 'python_requests': {
      const headersList = Object.entries(details.headers)
        .map(([k, v]) => `    "${k}": "${v}",`)
        .join('\n');
      const hasHeaders = Object.keys(details.headers).length > 0;
      const hasBody = details.body && details.method !== 'GET' && details.method !== 'HEAD';

      return `import requests

url = "${details.url}"

${hasHeaders ? `headers = {\n${headersList}\n}` : `headers = {}`}
${hasBody ? `payload = ${details.bodyType === 'json' ? details.body : `"""${details.body}"""`}` : `payload = None`}

response = requests.request(
    "${details.method}",
    url,
    headers=headers,
    ${hasBody ? (details.bodyType === 'json' ? 'data=payload' : 'data=payload') : ''}
)

print(response.status_code)
print(response.text)
`;
    }

    case 'python_httpx': {
      const headersList = Object.entries(details.headers)
        .map(([k, v]) => `    "${k}": "${v}",`)
        .join('\n');
      const hasHeaders = Object.keys(details.headers).length > 0;
      const hasBody = details.body && details.method !== 'GET' && details.method !== 'HEAD';

      return `import httpx

url = "${details.url}"

${hasHeaders ? `headers = {\n${headersList}\n}` : `headers = {}`}
${hasBody ? `content = ${details.bodyType === 'json' ? details.body : `"""${details.body}"""`}` : `content = None`}

with httpx.Client() as client:
    response = client.request(
        "${details.method}",
        url,
        headers=headers,
        ${hasBody ? 'content=content' : ''}
    )
    print(response.status_code)
    print(response.text)
`;
    }

    case 'go_http': {
      const headerLines = Object.entries(details.headers)
        .map(([k, v]) => `\treq.Header.Add("${k}", "${v}")`)
        .join('\n');
      const hasBody = details.body && details.method !== 'GET' && details.method !== 'HEAD';

      return `package main

import (
\t"fmt"
\t"io"
\t"net/http"
\t"strings"
)

func main() {
\turl := "${details.url}"
\tmethod := "${details.method}"

\t${
  hasBody
    ? `payload := strings.NewReader(\`${details.body.replace(/`/g, '` + "`" + `')}\`)`
    : `var payload io.Reader = nil`
}

\tclient := &http.Client{}
\treq, err := http.NewRequest(method, url, payload)
\tif err != nil {
\t\tfmt.Println(err)
\t\treturn
\t}

${headerLines}

\tres, err := client.Do(req)
\tif err != nil {
\t\tfmt.Println(err)
\t\treturn
\t}
\tdefer res.Body.Close()

\tbody, err := io.ReadAll(res.Body)
\tif err != nil {
\t\tfmt.Println(err)
\t\treturn
\t}
\tfmt.Println(res.Status)
\tfmt.Println(string(body))
}
`;
    }

    case 'rust_reqwest': {
      const headerLines = Object.entries(details.headers)
        .map(([k, v]) => `        .header("${k}", "${v}")`)
        .join('\n');
      const hasBody = details.body && details.method !== 'GET' && details.method !== 'HEAD';
      const methodLower = details.method.toLowerCase();

      return `use reqwest::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new();
    let res = client
        .${methodLower}("${details.url}")
${headerLines}
${hasBody ? `        .body(r#"${details.body.replace(/"/g, '\\"')}"#)\n` : ''}        .send()
        .await?;

    println!("Status: {}", res.status());
    let body = res.text().await?;
    println!("Body: {}", body);

    Ok(())
}
`;
    }

    default:
      return exportToCurl(req, envToUse);
  }
}
