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

export interface RequestData {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValueItem[];
  params: KeyValueItem[];
  body: RequestBody;
  auth: RequestAuth;
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
