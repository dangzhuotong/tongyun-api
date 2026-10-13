import {
  RequestAssertion,
  AssertionResult,
  VariableExtraction,
  ExtractedVariable,
  ResponsePayload,
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
