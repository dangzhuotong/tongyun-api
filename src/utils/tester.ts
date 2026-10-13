import {
  RequestAssertion,
  AssertionResult,
  VariableExtraction,
  ExtractedVariable,
  ResponsePayload,
  RequestData,
} from '../types/api';

/**
 * 安全解析对象的深层路径值，例如 'data.user.id' 或 'items.0.name'
 */
export function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split('.').map(p => p.trim()).filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * 执行请求断言测试
 */
export function evaluateAssertions(
  assertions: RequestAssertion[] | undefined,
  response: ResponsePayload
): AssertionResult[] {
  if (!assertions || assertions.length === 0) return [];

  let parsedJson: any = null;
  if (response.is_json && response.body) {
    try {
      parsedJson = JSON.parse(response.body);
    } catch {
      parsedJson = null;
    }
  }

  const results: AssertionResult[] = [];

  for (const a of assertions) {
    if (!a.enabled) continue;

    let passed = false;
    let actual = '';
    let message = '';

    switch (a.type) {
      case 'status_equals': {
        const expectedStatus = parseInt(a.expected.trim(), 10);
        actual = response.status.toString();
        passed = response.status === expectedStatus;
        message = passed
          ? `状态码等于 ${expectedStatus}`
          : `状态码期望为 ${expectedStatus}，实际为 ${response.status}`;
        break;
      }

      case 'status_in_range': {
        const range = a.expected.split('-').map(s => parseInt(s.trim(), 10));
        actual = response.status.toString();
        if (range.length === 2 && !isNaN(range[0]) && !isNaN(range[1])) {
          passed = response.status >= range[0] && response.status <= range[1];
          message = passed
            ? `状态码在区间 ${range[0]} - ${range[1]} 内`
            : `状态码 ${response.status} 不在区间 ${range[0]} - ${range[1]} 内`;
        } else {
          passed = false;
          message = `区间表达式无效 (需如 200-299)`;
        }
        break;
      }

      case 'time_less_than': {
        const maxTime = parseInt(a.expected.trim(), 10);
        actual = `${response.time_ms} ms`;
        passed = response.time_ms <= maxTime;
        message = passed
          ? `响应耗时 ${response.time_ms}ms <= ${maxTime}ms`
          : `响应耗时 ${response.time_ms}ms 超过预期 ${maxTime}ms`;
        break;
      }

      case 'body_contains': {
        actual = response.body.length > 50 ? response.body.slice(0, 50) + '...' : response.body;
        passed = response.body.includes(a.expected);
        message = passed
          ? `响应体包含指定文本 "${a.expected}"`
          : `响应体未匹配到 "${a.expected}"`;
        break;
      }

      case 'json_path_equals': {
        if (!response.is_json || !parsedJson) {
          actual = '非有效 JSON';
          passed = false;
          message = '响应体不是合法 JSON，无法执行路径提取';
        } else {
          const val = getNestedValue(parsedJson, a.target || '');
          actual = typeof val === 'object' ? JSON.stringify(val) : String(val ?? 'undefined');
          const expectedNormalized = a.expected.trim();
          passed = String(val) === expectedNormalized;
          message = passed
            ? `字段 "${a.target}" 值等于 "${a.expected}"`
            : `字段 "${a.target}" 实际为 "${actual}"，期望为 "${a.expected}"`;
        }
        break;
      }

      case 'header_exists': {
        const headerKey = (a.target || a.expected).toLowerCase().trim();
        const found = response.headers.find(h => h.key.toLowerCase().trim() === headerKey);
        actual = found ? `${found.key}: ${found.value}` : '未找到';
        passed = Boolean(found);
        message = passed
          ? `响应包含 Header 字段 "${found?.key}"`
          : `响应未找到 Header 字段 "${headerKey}"`;
        break;
      }

      default:
        message = '未知断言类型';
    }

    results.push({
      assertion: a,
      passed,
      actual,
      message,
    });
  }

  return results;
}

/**
 * 从响应提取环境变量
 */
export function extractVariables(
  extracts: VariableExtraction[] | undefined,
  response: ResponsePayload
): ExtractedVariable[] {
  if (!extracts || extracts.length === 0) return [];

  let parsedJson: any = null;
  if (response.is_json && response.body) {
    try {
      parsedJson = JSON.parse(response.body);
    } catch {
      parsedJson = null;
    }
  }

  const extracted: ExtractedVariable[] = [];

  for (const item of extracts) {
    if (!item.enabled || !item.var_name.trim()) continue;

    if (item.source === 'json') {
      if (parsedJson) {
        const val = getNestedValue(parsedJson, item.path_or_key);
        if (val !== undefined && val !== null) {
          const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
          extracted.push({
            key: item.var_name.trim(),
            value: strVal,
            source: `JSON: ${item.path_or_key}`,
          });
        }
      }
    } else if (item.source === 'header') {
      const headerKey = item.path_or_key.toLowerCase().trim();
      const found = response.headers.find(h => h.key.toLowerCase().trim() === headerKey);
      if (found) {
        extracted.push({
          key: item.var_name.trim(),
          value: found.value,
          source: `Header: ${found.key}`,
        });
      }
    }
  }

  return extracted;
}

/**
 * 根据真实响应智能生成推荐的测试断言
 */
export function generateSmartAssertions(response: ResponsePayload): RequestAssertion[] {
  const assertions: RequestAssertion[] = [];
  const baseTime = Date.now();

  // 1. 状态码断言
  assertions.push({
    id: `smart_status_${baseTime}`,
    name: `状态码为 ${response.status}`,
    type: 'status_equals',
    expected: String(response.status),
    enabled: true,
  });

  // 2. 耗时断言（留有 50% 浮动容限，最低 1000ms）
  const expectedMaxTime = Math.max(1000, Math.ceil(response.time_ms * 1.5));
  assertions.push({
    id: `smart_time_${baseTime + 1}`,
    name: `响应耗时 <= ${expectedMaxTime}ms`,
    type: 'time_less_than',
    expected: String(expectedMaxTime),
    enabled: true,
  });

  // 3. Header 断言
  const hasContentType = response.headers.some(h => h.key.toLowerCase() === 'content-type');
  if (hasContentType) {
    assertions.push({
      id: `smart_header_${baseTime + 2}`,
      name: '包含 Content-Type 响应头',
      type: 'header_exists',
      target: 'content-type',
      expected: 'content-type',
      enabled: true,
    });
  }

  // 4. JSON 字段智能匹配
  if (response.is_json && response.body) {
    try {
      const obj = JSON.parse(response.body);
      if (typeof obj === 'object' && obj !== null) {
        // 匹配常见顶层标识字段
        const candidateKeys = ['code', 'status', 'success', 'message', 'msg'];
        for (const key of candidateKeys) {
          if (key in obj && (typeof obj[key] === 'string' || typeof obj[key] === 'number' || typeof obj[key] === 'boolean')) {
            assertions.push({
              id: `smart_json_${key}_${baseTime}`,
              name: `字段 ${key} 等于 ${obj[key]}`,
              type: 'json_path_equals',
              target: key,
              expected: String(obj[key]),
              enabled: true,
            });
            break;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return assertions;
}

/**
 * 生成面向 AI Agent (Cursor / Claude / OpenCode / Antigravity) 的标准 Markdown 诊断与修复上下文 Prompt
 */
export function generateAiDiagnosticPrompt(
  request: RequestData,
  response: ResponsePayload | null,
  options?: { environmentName?: string }
): string {
  const headersList = request.headers
    .filter(h => h.enabled && h.key)
    .map(h => `- \`${h.key}\`: ${h.value}`)
    .join('\n') || '- (无自定义 Header)';

  const bodySnippet = request.body.content.trim()
    ? `\`\`\`json\n${request.body.content}\n\`\`\``
    : '- (空请求体)';

  let responseSection = '- (请求未成功建立连接或网络中断)';
  let assertionsSection = '- (未配置测试断言)';

  if (response) {
    const respHeaders = response.headers
      .slice(0, 10)
      .map(h => `- \`${h.key}\`: ${h.value}`)
      .join('\n');

    const bodyPreview = response.body.length > 3000
      ? response.body.slice(0, 3000) + '\n... [响应内容截断已保留前 3000 字符]'
      : response.body || '(空响应体)';

    responseSection = `
- **HTTP 状态码**: \`${response.status} ${response.status_text}\`
- **总耗时**: \`${response.time_ms} ms\`
- **传输大小**: \`${response.size_bytes} 字节\`
- **关键响应头**:
${respHeaders}

**响应体内容**:
\`\`\`${response.is_json ? 'json' : 'text'}
${bodyPreview}
\`\`\`
`.trim();

    if (response.test_results && response.test_results.length > 0) {
      assertionsSection = response.test_results
        .map(t => {
          const mark = t.passed ? '✅ [通过]' : '❌ [未通过]';
          return `- ${mark} **${t.assertion.name}**: ${t.message} (实际值: \`${t.actual || '无'}\`)`;
        })
        .join('\n');
    }
  }

  return `# 🤖 橦云接口 · 真实 API 执行诊断与排错上下文

请作为全栈架构与 API 测试专家，根据以下在桌面调试器中捕获的真实纯文本 API 运行上下文，定位可能存在的问题并输出修复代码。

## 1. 触发请求详情
- **用例名称**: ${request.name}
- **请求行**: \`${request.method} ${request.url}\`
- **激活环境**: ${options?.environmentName || '默认/无'}
- **描述信息**: ${request.description || '无'}

### 请求头
${headersList}

### 请求体 (${request.body.body_type})
${bodySnippet}

## 2. 真实响应快照
${responseSection}

## 3. 测试断言与自动化校验
${assertionsSection}

---

## 4. 诊断与修复诉求
1. **原因定位**：分析上述状态码、响应体与断言不符的深层根因（如路由未匹配、数据库校验失败、鉴权 Token 过期、DTO 序列化异常等）；
2. **修复方案**：提供服务端修复代码（若为后端缺陷）或修正后的 IntelliJ \`.http\` 测试用例；
3. **防护建议**：指出需要强化的边界测试用例。
`.trim();
}
