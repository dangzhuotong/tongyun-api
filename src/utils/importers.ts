import { RequestData, HttpMethod, KeyValueItem, BodyType } from '../types/api';

// Postman Collection v2.1 Parser
export interface ImportedCollectionResult {
  collectionName: string;
  items: {
    folderPath: string[]; // e.g. ["用户模块", "鉴权"]
    request: RequestData;
  }[];
}

export function parsePostmanCollection(jsonStr: string): ImportedCollectionResult {
  const data = JSON.parse(jsonStr);
  const collectionName = data.info?.name || 'Postman导入集合';
  const result: ImportedCollectionResult = {
    collectionName,
    items: [],
  };

  function processItems(items: any[], currentPath: string[]) {
    for (const item of items) {
      if (item.item && Array.isArray(item.item)) {
        // It's a folder
        processItems(item.item, [...currentPath, item.name || '未命名分组']);
      } else if (item.request) {
        // It's a request
        const req = item.request;
        const method = (typeof req.method === 'string' ? req.method.toUpperCase() : 'GET') as HttpMethod;
        
        let url = '';
        if (typeof req.url === 'string') {
          url = req.url;
        } else if (req.url && typeof req.url === 'object') {
          url = req.url.raw || '';
        }

        // Headers
        const headers: KeyValueItem[] = [];
        if (Array.isArray(req.header)) {
          for (const h of req.header) {
            if (h.key) {
              headers.push({
                key: h.key,
                value: h.value || '',
                enabled: !h.disabled,
                description: h.description,
              });
            }
          }
        }

        // Params
        const params: KeyValueItem[] = [];
        if (req.url && Array.isArray(req.url.query)) {
          for (const q of req.url.query) {
            if (q.key) {
              params.push({
                key: q.key,
                value: q.value || '',
                enabled: !q.disabled,
                description: q.description,
              });
            }
          }
        }

        // Body
        let bodyType: BodyType = 'none';
        let bodyContent = '';
        if (req.body) {
          if (req.body.mode === 'raw') {
            bodyContent = req.body.raw || '';
            bodyType = bodyContent.trim().startsWith('{') || bodyContent.trim().startsWith('[') ? 'json' : 'raw';
          } else if (req.body.mode === 'urlencoded' && Array.isArray(req.body.urlencoded)) {
            bodyType = 'form-urlencoded';
            bodyContent = req.body.urlencoded
              .filter((x: any) => !x.disabled && x.key)
              .map((x: any) => `${encodeURIComponent(x.key)}=${encodeURIComponent(x.value || '')}`)
              .join('&');
          }
        }

        // Auth
        let auth = { auth_type: 'none' as const };
        if (req.auth) {
          if (req.auth.type === 'bearer' && Array.isArray(req.auth.bearer)) {
            const tokenItem = req.auth.bearer.find((b: any) => b.key === 'token');
            auth = {
              auth_type: 'bearer',
              token: tokenItem?.value || '',
            } as any;
          } else if (req.auth.type === 'basic' && Array.isArray(req.auth.basic)) {
            const u = req.auth.basic.find((b: any) => b.key === 'username')?.value || '';
            const p = req.auth.basic.find((b: any) => b.key === 'password')?.value || '';
            auth = {
              auth_type: 'basic',
              username: u,
              password: p,
            } as any;
          }
        }

        const requestData: RequestData = {
          id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: item.name || '未命名请求',
          method,
          url,
          headers,
          params,
          body: {
            body_type: bodyType,
            content: bodyContent,
          },
          auth: auth as any,
          description: req.description || item.description || '',
        };

        result.items.push({
          folderPath: currentPath,
          request: requestData,
        });
      }
    }
  }

  if (Array.isArray(data.item)) {
    processItems(data.item, [collectionName]);
  }

  return result;
}

// Swagger / OpenAPI 3.0 Parser
export function parseOpenApiSpec(specStr: string): ImportedCollectionResult {
  const spec = JSON.parse(specStr);
  const title = spec.info?.title || 'OpenAPI集合';
  const result: ImportedCollectionResult = {
    collectionName: title,
    items: [],
  };

  const baseUrl = spec.servers?.[0]?.url || '{{baseUrl}}';
  const paths = spec.paths || {};

  for (const [pathKey, pathItem] of Object.entries<any>(paths)) {
    for (const [methodKey, op] of Object.entries<any>(pathItem)) {
      if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(methodKey.toLowerCase())) {
        const method = methodKey.toUpperCase() as HttpMethod;
        const name = op.summary || op.operationId || `${method} ${pathKey}`;
        const tag = (op.tags && op.tags[0]) || '默认分组';

        const headers: KeyValueItem[] = [];
        const params: KeyValueItem[] = [];

        if (Array.isArray(op.parameters)) {
          for (const p of op.parameters) {
            if (p.in === 'query') {
              params.push({
                key: p.name,
                value: p.example || p.schema?.default || '',
                enabled: true,
                description: p.description,
              });
            } else if (p.in === 'header') {
              headers.push({
                key: p.name,
                value: p.example || '',
                enabled: true,
                description: p.description,
              });
            }
          }
        }

        let bodyType: BodyType = 'none';
        let bodyContent = '';
        if (op.requestBody?.content) {
          if (op.requestBody.content['application/json']) {
            bodyType = 'json';
            const schema = op.requestBody.content['application/json'].schema;
            bodyContent = schema ? '{\n  // 请根据接口模式输入请求体\n}' : '{}';
          }
        }

        result.items.push({
          folderPath: [title, tag],
          request: {
            id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name,
            method,
            url: `${baseUrl}${pathKey}`,
            headers,
            params,
            body: {
              body_type: bodyType,
              content: bodyContent,
            },
            auth: { auth_type: 'none' },
            description: op.description || op.summary || '',
          },
        });
      }
    }
  }

  return result;
}
