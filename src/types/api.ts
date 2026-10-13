export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface KeyValueItem {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey';

export interface RequestAuth {
  auth_type: AuthType;
  token?: string;
  username?: string;
  password?: string;
  api_key_name?: string;
  api_key_value?: string;
  api_key_in?: 'header' | 'query';
}

export type BodyType = 'none' | 'json' | 'raw' | 'form-urlencoded';

export interface RequestBody {
  body_type: BodyType;
  content: string;
}

export type AssertionType =
  | 'status_equals'       // 状态码等于 (例如: 200)
  | 'status_in_range'     // 状态码区间 (例如: 200-299)
  | 'time_less_than'      // 耗时小于 (毫秒)
  | 'body_contains'       // 响应体包含文本
  | 'json_path_equals'    // JSON 路径值匹配 (例如: data.code === 0)
  | 'header_exists';      // 请求头包含字段

export interface RequestAssertion {
  id: string;
  name: string;
  type: AssertionType;
  target?: string;        // 目标路径或 Header 键名 (如: data.token, Content-Type)
  expected: string;       // 期望值 (如: 200, 500, success)
  enabled: boolean;
}

export interface AssertionResult {
  assertion: RequestAssertion;
  passed: boolean;
  actual?: string;
  message: string;
}

export interface VariableExtraction {
  id: string;
  var_name: string;       // 提取存入的目标变量名，例如: token
  source: 'json' | 'header'; // 来源
  path_or_key: string;    // 字段路径或 Header 键名，例如: data.token 或 Authorization
  enabled: boolean;
}

export interface ExtractedVariable {
  key: string;
  value: string;
  source: string;
}

export interface RequestData {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValueItem[];
  params: KeyValueItem[];
  body: RequestBody;
  auth: RequestAuth;
  tests?: RequestAssertion[];
  extracts?: VariableExtraction[];
  description?: string;
  filePath?: string;
}

export interface ResponsePayload {
  status: number;
  status_text: string;
  headers: KeyValueItem[];
  body: string;
  time_ms: number;
  size_bytes: number;
  is_json: boolean;
  test_results?: AssertionResult[];
  extracted_vars?: ExtractedVariable[];
}

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  is_dir: boolean;
  method?: string;
  children?: FileTreeNode[];
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  enabled: boolean;
}

export interface EnvironmentData {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  method: HttpMethod;
  url: string;
  status: number;
  time_ms: number;
  size_bytes: number;
  request: RequestData;
  response: ResponsePayload;
}

export interface GitStatusResult {
  is_git_repo: boolean;
  branch: string;
  modified_files: string[];
}

export interface ExecutionLogItem {
  id: string;
  timestamp: number;
  source: 'gui' | 'cli' | 'agent' | 'runner';
  requestName: string;
  method: HttpMethod;
  url: string;
  status: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  assertionsTotal: number;
  assertionsPassed: number;
  request: RequestData;
  response: ResponsePayload;
}

export interface BatchRunItemResult {
  requestName: string;
  method: HttpMethod;
  url: string;
  status: number;
  timeMs: number;
  passed: boolean;
  assertionResults: AssertionResult[];
  error?: string;
}

export interface BatchRunReport {
  id: string;
  timestamp: number;
  collectionName: string;
  total: number;
  passed: number;
  failed: number;
  totalTimeMs: number;
  results: BatchRunItemResult[];
}

