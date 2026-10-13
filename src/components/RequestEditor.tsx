import React, { useState, useEffect } from 'react';
import {
  Play,
  Copy,
  Check,
  Plus,
  Trash2,
  Wand2,
  RefreshCw,
  Code2,
  CheckSquare,
  Variable,
  Sparkles,
  Bot,
  Settings,
  Upload,
  FileUp,
  Shield,
  Radio,
  ChevronDown
} from 'lucide-react';
import {
  RequestData,
  HttpMethod,
  BodyType,
  EnvironmentData,
  RequestAssertion,
  VariableExtraction,
  AssertionType,
  ResponsePayload,
  FormDataItem,
  RedirectPolicy
} from '../types/api';
import { exportToCurl } from '../utils/curl';
import { generateSmartAssertions } from '../utils/tester';
import { getMethodBadgeColor } from './Sidebar';
import { WebSocketPanel } from './WebSocketPanel';

interface RequestEditorProps {
  request: RequestData;
  environment: EnvironmentData | null;
  onChange: (updated: RequestData) => void;
  onSend: () => void;
  isSending: boolean;
  onOpenCodeSnippet?: () => void;
  lastResponse?: ResponsePayload | null;
  onToast?: (msg: string) => void;
}

export const RequestEditor: React.FC<RequestEditorProps> = ({
  request,
  environment,
  onChange,
  onSend,
  isSending,
  onOpenCodeSnippet,
  lastResponse,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'auth' | 'body' | 'tests' | 'docs' | 'settings'>('params');
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [aiPromptInput, setAiPromptInput] = useState('');
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);

  // 常见接口一键模板
  const AI_TEMPLATES = [
    {
      label: '🔑 用户登录鉴权',
      data: {
        name: '用户登录鉴权',
        method: 'POST' as HttpMethod,
        url: 'https://httpbin.org/post',
        headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
        params: [],
        body: {
          body_type: 'json' as BodyType,
          content: JSON.stringify({ username: 'admin', password: 'password123', client: 'web' }, null, 2),
        },
        auth: { auth_type: 'none' as const },
        tests: [
          { id: 't1', name: '状态码为 200', type: 'status_equals' as const, expected: '200', enabled: true },
          { id: 't2', name: '响应耗时 <= 1000ms', type: 'time_less_than' as const, expected: '1000', enabled: true },
        ],
        extracts: [
          { id: 'e1', var_name: 'token', source: 'json' as const, path_or_key: 'json.client', enabled: true },
        ],
      },
    },
    {
      label: '📎 Multipart 文件上传',
      data: {
        name: '表单与文件附件上传',
        method: 'POST' as HttpMethod,
        url: 'https://httpbin.org/post',
        headers: [],
        params: [],
        body: {
          body_type: 'form-data' as BodyType,
          content: '',
          form_data: [
            { key: 'username', value: 'tongyun_dev', type: 'text' as const, enabled: true, description: '文本字段' },
            { key: 'avatar', value: 'avatar.png', type: 'file' as const, enabled: true, description: '二进制文件附件' },
          ],
        },
        auth: { auth_type: 'none' as const },
        tests: [
          { id: 't1', name: '状态码为 200', type: 'status_equals' as const, expected: '200', enabled: true },
        ],
        extracts: [],
      },
    },
    {
      label: '📡 WebSocket 实时通道',
      data: {
        name: 'WebSocket 实时测试',
        method: 'WS' as HttpMethod,
        url: 'wss://echo.websocket.events',
        headers: [],
        params: [],
        body: { body_type: 'none' as BodyType, content: '' },
        auth: { auth_type: 'none' as const },
        tests: [],
        extracts: [],
      },
    },
    {
      label: '📦 创建业务订单',
      data: {
        name: '创建业务订单',
        method: 'POST' as HttpMethod,
        url: 'https://httpbin.org/post',
        headers: [
          { key: 'Content-Type', value: 'application/json', enabled: true },
          { key: 'Authorization', value: 'Bearer {{token}}', enabled: true },
        ],
        params: [],
        body: {
          body_type: 'json' as BodyType,
          content: JSON.stringify(
            {
              orderNo: '{{$uuid}}',
              amount: 199.9,
              currency: 'CNY',
              items: [{ productId: 'P1001', quantity: 2, price: 99.95 }],
            },
            null,
            2
          ),
        },
        auth: { auth_type: 'bearer' as const, token: '{{token}}' },
        tests: [
          { id: 't1', name: '状态码为 200', type: 'status_equals' as const, expected: '200', enabled: true },
        ],
      },
    },
    {
      label: '🔍 分页查询列表',
      data: {
        name: '分页查询列表',
        method: 'GET' as HttpMethod,
        url: 'https://httpbin.org/get',
        headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
        params: [
          { key: 'page', value: '1', enabled: true, description: '当前页码' },
          { key: 'pageSize', value: '20', enabled: true, description: '每页条数' },
          { key: 'keyword', value: 'tongyun', enabled: true, description: '检索词' },
        ],
        body: { body_type: 'none' as BodyType, content: '' },
        auth: { auth_type: 'none' as const },
        tests: [
          { id: 't1', name: '状态码为 200', type: 'status_equals' as const, expected: '200', enabled: true },
        ],
      },
    },
    {
      label: '❤️ 健康检查探测',
      data: {
        name: '健康检查探测',
        method: 'GET' as HttpMethod,
        url: 'https://httpbin.org/status/200',
        headers: [],
        params: [],
        body: { body_type: 'none' as BodyType, content: '' },
        auth: { auth_type: 'none' as const },
        tests: [
          { id: 't1', name: '健康状态码 200', type: 'status_equals' as const, expected: '200', enabled: true },
          { id: 't2', name: '延迟 <= 500ms', type: 'time_less_than' as const, expected: '500', enabled: true },
        ],
      },
    },
  ];

  const handleApplyAiTemplate = (tpl: any) => {
    onChange({
      ...request,
      ...tpl.data,
      id: request.id,
      name: tpl.data.name,
    });
    if (onToast) onToast(`✨ AI 已自动填入接口结构: ${tpl.data.name}`);
  };

  const handleAiPromptGenerate = () => {
    const p = aiPromptInput.trim();
    if (!p) return;

    let inferredMethod: HttpMethod = 'GET';
    if (p.includes('创建') || p.includes('添加') || p.includes('登录') || p.includes('提交') || p.toLowerCase().includes('post')) {
      inferredMethod = 'POST';
    } else if (p.includes('修改') || p.includes('更新') || p.toLowerCase().includes('put')) {
      inferredMethod = 'PUT';
    } else if (p.includes('删除') || p.toLowerCase().includes('delete')) {
      inferredMethod = 'DELETE';
    }

    const newReq: RequestData = {
      ...request,
      name: p,
      method: inferredMethod,
      url: inferredMethod === 'GET' ? 'https://httpbin.org/get' : 'https://httpbin.org/post',
      headers:
        inferredMethod !== 'GET'
          ? [{ key: 'Content-Type', value: 'application/json', enabled: true }]
          : [{ key: 'Accept', value: 'application/json', enabled: true }],
      params: inferredMethod === 'GET' ? [{ key: 'keyword', value: p, enabled: true }] : [],
      body:
        inferredMethod !== 'GET'
          ? {
              body_type: 'json',
              content: JSON.stringify({ title: p, timestamp: '{{$timestamp}}' }, null, 2),
            }
          : { body_type: 'none', content: '' },
      tests: [
        { id: `test_${Date.now()}`, name: '状态码为 200', type: 'status_equals', expected: '200', enabled: true },
      ],
    };

    onChange(newReq);
    setAiPromptInput('');
    if (onToast) onToast(`✨ AI 已根据需求 "${p}" 自动生成并填入所有接口字段`);
  };

  // 格式化 JSON
  const handlePrettifyJson = () => {
    try {
      if (!request.body.content.trim()) return;
      const parsed = JSON.parse(request.body.content);
      const formatted = JSON.stringify(parsed, null, 2);
      onChange({
        ...request,
        body: {
          ...request.body,
          content: formatted,
        },
      });
      setJsonError(null);
    } catch (e: any) {
      setJsonError(`JSON 格式错误: ${e.message}`);
    }
  };

  // 校验 JSON
  useEffect(() => {
    if (request.body.body_type === 'json' && request.body.content.trim()) {
      try {
        JSON.parse(request.body.content);
        setJsonError(null);
      } catch (e: any) {
        setJsonError(e.message);
      }
    } else {
      setJsonError(null);
    }
  }, [request.body.content, request.body.body_type]);

  // 复制 cURL
  const handleCopyCurl = () => {
    const curl = exportToCurl(request, environment);
    navigator.clipboard.writeText(curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  // 改变基础字段
  const updateField = <K extends keyof RequestData>(field: K, value: RequestData[K]) => {
    onChange({ ...request, [field]: value });
  };

  // Params 操作
  const handleAddParam = () => {
    const updated = [...request.params, { key: '', value: '', enabled: true }];
    updateField('params', updated);
  };

  const handleUpdateParam = (index: number, key: string, value: string, enabled: boolean, desc?: string) => {
    const updated = [...request.params];
    updated[index] = { key, value, enabled, description: desc };
    updateField('params', updated);
  };

  const handleDeleteParam = (index: number) => {
    const updated = request.params.filter((_, i) => i !== index);
    updateField('params', updated);
  };

  // Headers 操作
  const handleAddHeader = (presetKey = '', presetValue = '') => {
    const updated = [...request.headers, { key: presetKey, value: presetValue, enabled: true }];
    updateField('headers', updated);
  };

  const handleUpdateHeader = (index: number, key: string, value: string, enabled: boolean, desc?: string) => {
    const updated = [...request.headers];
    updated[index] = { key, value, enabled, description: desc };
    updateField('headers', updated);
  };

  const handleDeleteHeader = (index: number) => {
    const updated = request.headers.filter((_, i) => i !== index);
    updateField('headers', updated);
  };

  // 断言操作
  const handleAddAssertion = (preset?: Partial<RequestAssertion>) => {
    const currentTests = request.tests || [];
    const newAssertion: RequestAssertion = {
      id: `test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: preset?.name || '响应状态码校验',
      type: preset?.type || 'status_equals',
      target: preset?.target || '',
      expected: preset?.expected || '200',
      enabled: true,
    };
    updateField('tests', [...currentTests, newAssertion]);
  };

  const handleUpdateAssertion = (index: number, updated: RequestAssertion) => {
    const currentTests = [...(request.tests || [])];
    currentTests[index] = updated;
    updateField('tests', currentTests);
  };

  const handleDeleteAssertion = (index: number) => {
    const currentTests = (request.tests || []).filter((_, i) => i !== index);
    updateField('tests', currentTests);
  };

  // 变量提取操作
  const handleAddExtraction = (preset?: Partial<VariableExtraction>) => {
    const currentExtracts = request.extracts || [];
    const newExtraction: VariableExtraction = {
      id: `ext_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      var_name: preset?.var_name || 'token',
      source: preset?.source || 'json',
      path_or_key: preset?.path_or_key || 'token',
      enabled: true,
    };
    updateField('extracts', [...currentExtracts, newExtraction]);
  };

  const handleUpdateExtraction = (index: number, updated: VariableExtraction) => {
    const currentExtracts = [...(request.extracts || [])];
    currentExtracts[index] = updated;
    updateField('extracts', currentExtracts);
  };

  const handleDeleteExtraction = (index: number) => {
    const currentExtracts = (request.extracts || []).filter((_, i) => i !== index);
    updateField('extracts', currentExtracts);
  };

  // Form-Data 操作
  const handleAddFormData = (type: 'text' | 'file' = 'text') => {
    const current = request.body.form_data || [];
    const updated: FormDataItem[] = [
      ...current,
      { key: '', value: '', type, enabled: true }
    ];
    updateField('body', { ...request.body, form_data: updated });
  };

  const handleUpdateFormData = (index: number, updatedItem: FormDataItem) => {
    const current = [...(request.body.form_data || [])];
    current[index] = updatedItem;
    updateField('body', { ...request.body, form_data: current });
  };

  const handleDeleteFormData = (index: number) => {
    const current = (request.body.form_data || []).filter((_, i) => i !== index);
    updateField('body', { ...request.body, form_data: current });
  };

  const activeParamsCount = request.params.filter(p => p.enabled && p.key.trim()).length;
  const activeHeadersCount = request.headers.filter(h => h.enabled && h.key.trim()).length;
  const activeTestsCount = (request.tests?.filter(t => t.enabled).length || 0) + (request.extracts?.filter(e => e.enabled).length || 0);

  return (
    <div className="flex flex-col h-full bg-[var(--ty-bg)] overflow-hidden border-b border-[var(--ty-border)]">
      {/* IntelliJ Action Strip: Template Selector & AI Quick Fill */}
      <div className="h-8 bg-[var(--ty-surface)] border-b border-[var(--ty-border)] px-3 text-xs flex items-center justify-between gap-3 shrink-0 select-none">
        <div className="flex items-center gap-2">
          {/* Templates Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setIsTemplateMenuOpen(!isTemplateMenuOpen)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] text-xs text-[var(--ty-text)] transition-colors"
              title="常用接口结构与用例模板"
            >
              <Sparkles className="w-3 h-3 text-[var(--ty-honey)]" />
              <span className="text-[11px] font-medium">快速模板</span>
              <ChevronDown className="w-3 h-3 text-[var(--ty-text-subtle)]" />
            </button>

            {isTemplateMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsTemplateMenuOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1 w-56 py-1 bg-[var(--ty-surface-raised)] border border-[var(--ty-border)] rounded-[var(--ty-radius-sm)] shadow-[var(--ty-shadow-pop)] z-40">
                  <div className="px-2.5 py-1 text-[10px] text-[var(--ty-text-subtle)] font-mono uppercase tracking-wider border-b border-[var(--ty-border)]/60">
                    一键载入场景模板
                  </div>
                  {AI_TEMPLATES.map((tpl, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        handleApplyAiTemplate(tpl);
                        setIsTemplateMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[var(--ty-surface)] text-xs text-[var(--ty-text)] hover:text-[var(--ty-matcha)] flex items-center gap-2 transition-colors"
                    >
                      <span>{tpl.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="h-3 w-[1px] bg-[var(--ty-border)]" />

          {/* AI Intent Input */}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={aiPromptInput}
              onChange={e => setAiPromptInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAiPromptGenerate()}
              placeholder="告诉 AI 要测什么 (如: 微信退款、发送验证码)..."
              className="bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] rounded-[var(--ty-radius-xs,4px)] px-2 py-0.5 text-[11px] text-[var(--ty-text)] placeholder-[var(--ty-text-subtle)] outline-none focus:border-[var(--ty-matcha)] w-56 font-mono"
            />
            <button
              onClick={handleAiPromptGenerate}
              disabled={!aiPromptInput.trim()}
              className="flex items-center gap-1 px-2 py-0.5 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] text-[var(--ty-text-muted)] hover:text-[var(--ty-matcha)] text-[11px] transition-colors disabled:opacity-40"
            >
              <Bot className="w-3 h-3 text-[var(--ty-matcha)]" />
              <span>生成</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--ty-text-subtle)]">
          <span>HTTP/1.1</span>
          <span>·</span>
          <span>UTF-8</span>
        </div>
      </div>

      {/* Unified IDE Address Omnibar */}
      <div className="p-2 bg-[var(--ty-surface)] border-b border-[var(--ty-border)] flex items-center gap-2">
        <div className="flex-1 flex items-center bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] rounded-[var(--ty-radius-sm)] focus-within:border-[var(--ty-matcha)] focus-within:ring-1 focus-within:ring-[var(--ty-matcha)]/30 transition-all overflow-hidden h-8">
          {/* Method selector */}
          <select
            value={request.method}
            onChange={e => {
              const newMethod = e.target.value as HttpMethod;
              if (newMethod === 'WS' && (!request.url || request.url.startsWith('http://') || request.url.startsWith('https://'))) {
                const wsUrl = request.url ? request.url.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://') : 'wss://echo.websocket.events';
                onChange({ ...request, method: newMethod, url: wsUrl });
              } else if (newMethod !== 'WS' && (request.url.startsWith('ws://') || request.url.startsWith('wss://'))) {
                const httpUrl = request.url.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://');
                onChange({ ...request, method: newMethod, url: httpUrl });
              } else {
                updateField('method', newMethod);
              }
            }}
            className={`font-mono text-xs font-bold px-2.5 h-full outline-none bg-transparent cursor-pointer border-r border-[var(--ty-border)] shrink-0 ${getMethodBadgeColor(
              request.method
            )}`}
          >
            <option value="GET" className="bg-[var(--ty-surface)] text-emerald-400">GET</option>
            <option value="POST" className="bg-[var(--ty-surface)] text-amber-400">POST</option>
            <option value="PUT" className="bg-[var(--ty-surface)] text-sky-400">PUT</option>
            <option value="DELETE" className="bg-[var(--ty-surface)] text-rose-400">DELETE</option>
            <option value="PATCH" className="bg-[var(--ty-surface)] text-purple-400">PATCH</option>
            <option value="WS" className="bg-[var(--ty-surface)] text-emerald-300 font-bold">WS (WebSocket)</option>
            <option value="HEAD" className="bg-[var(--ty-surface)] text-[var(--ty-text)]">HEAD</option>
            <option value="OPTIONS" className="bg-[var(--ty-surface)] text-[var(--ty-text)]">OPTIONS</option>
          </select>

          {/* URL Input */}
          <input
            type="text"
            value={request.url}
            onChange={e => updateField('url', e.target.value)}
            placeholder={request.method === 'WS' ? "输入 WebSocket 链接 (如 wss://echo.websocket.events)" : "输入请求 URL 或 {{baseUrl}}/api/v1/..."}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && request.method !== 'WS') {
                onSend();
              }
            }}
            className="flex-1 bg-transparent px-2.5 py-1 text-xs font-mono text-[var(--ty-text)] placeholder-[var(--ty-text-subtle)] outline-none"
          />

          {/* Inside Omnibar Quick Action Buttons */}
          <div className="flex items-center gap-1 pr-1.5 shrink-0">
            {request.method !== 'WS' && (
              <button
                onClick={handleCopyCurl}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] hover:bg-[var(--ty-surface-raised)] transition-colors"
                title="复制为完整 cURL 命令"
              >
                {copiedCurl ? (
                  <>
                    <Check className="w-3 h-3 text-[var(--ty-matcha)]" />
                    <span className="text-[var(--ty-matcha)]">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>cURL</span>
                  </>
                )}
              </button>
            )}

            {onOpenCodeSnippet && request.method !== 'WS' && (
              <button
                onClick={onOpenCodeSnippet}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] hover:bg-[var(--ty-surface-raised)] transition-colors"
                title="生成多语言客户端调用代码 (JS/Python/Go/Rust等)"
              >
                <Code2 className="w-3 h-3 text-[var(--ty-sky)]" />
                <span>代码</span>
              </button>
            )}
          </div>
        </div>

        {/* Send / WS Indicator Button */}
        {request.method === 'WS' ? (
          <div className="flex items-center gap-1.5 px-3 h-8 rounded-[var(--ty-radius-sm)] bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono select-none shrink-0">
            <Radio className="w-3 h-3 animate-pulse" />
            <span className="text-[11px]">WS 模式</span>
          </div>
        ) : (
          <button
            onClick={onSend}
            disabled={isSending}
            className="flex items-center gap-1.5 px-3.5 h-8 rounded-[var(--ty-radius-sm)] bg-[var(--ty-matcha)] hover:bg-[var(--ty-matcha-hover)] text-[#10140f] text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 shrink-0"
            title="发送请求 (Ctrl+Enter)"
          >
            {isSending ? (
              <RefreshCw className="w-3 h-3 animate-spin text-[#10140f]" />
            ) : (
              <Play className="w-3 h-3 fill-[#10140f]" />
            )}
            <span className="text-[11px] font-bold">{isSending ? '请求中...' : '发送'}</span>
          </button>
        )}
      </div>

      {/* When method === 'WS', render the dedicated WebSocket debug console */}
      {request.method === 'WS' ? (
        <div className="flex-1 overflow-hidden">
          <WebSocketPanel
            url={request.url}
            onChangeUrl={newUrl => updateField('url', newUrl)}
            environment={environment}
            onToast={onToast}
          />
        </div>
      ) : (
        <>
          {/* Sub Tabs Bar */}
          <div className="h-8 flex items-center border-b border-[var(--ty-border)] px-3 bg-[var(--ty-surface)] text-xs gap-1 select-none shrink-0">
            {[
              { id: 'params', label: 'Params', count: activeParamsCount },
              { id: 'headers', label: 'Headers', count: activeHeadersCount },
              { id: 'auth', label: 'Auth', badge: request.auth.auth_type !== 'none' ? request.auth.auth_type.toUpperCase() : undefined },
              { id: 'body', label: 'Body', badge: request.body.body_type !== 'none' ? request.body.body_type.toUpperCase() : undefined },
              { id: 'tests', label: '断言与测试', count: activeTestsCount },
              { id: 'docs', label: '文档' },
              { id: 'settings', label: '设置', badge: request.redirect_policy && request.redirect_policy !== 'safe' ? request.redirect_policy : undefined },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`h-full px-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === tab.id
                    ? 'text-[var(--ty-text)] border-[var(--ty-matcha)]'
                    : 'text-[var(--ty-text-muted)] border-transparent hover:text-[var(--ty-text)] hover:bg-[var(--ty-surface-raised)]/50'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-[var(--ty-surface-raised)] border border-[var(--ty-border)] text-[var(--ty-matcha)] font-mono font-semibold">
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span className="px-1 py-0.2 rounded text-[9px] bg-[var(--ty-surface-raised)] border border-[var(--ty-border)] text-[var(--ty-honey)] font-mono uppercase">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* PARAMS TAB */}
        {activeTab === 'params' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[var(--ty-text-muted)]">
              <span className="font-semibold text-[var(--ty-text)]">Query Parameters (URL 查询参数)</span>
              <button
                onClick={handleAddParam}
                className="flex items-center gap-1 px-2 py-1 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] text-[var(--ty-matcha)] text-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加参数</span>
              </button>
            </div>

            <div className="border border-[var(--ty-border)] rounded-[var(--ty-radius-sm)] overflow-hidden bg-[var(--ty-surface-sunken)]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--ty-surface-raised)] text-[var(--ty-text-muted)] border-b border-[var(--ty-border)]">
                  <tr>
                    <th className="w-10 px-3 py-2 text-center">启用</th>
                    <th className="px-3 py-2 w-1/3">参数名 (Key)</th>
                    <th className="px-3 py-2 w-1/3">参数值 (Value)</th>
                    <th className="px-3 py-2">说明 (Description)</th>
                    <th className="w-10 px-2 py-2 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ty-border)]/50">
                  {request.params.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-[var(--ty-text-subtle)]">
                        暂无查询参数，点击右上角「添加参数」创建
                      </td>
                    </tr>
                  ) : (
                    request.params.map((p, idx) => (
                      <tr key={idx} className="hover:bg-[var(--ty-surface-raised)]/30 transition-colors">
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={p.enabled}
                            onChange={e => handleUpdateParam(idx, p.key, p.value, e.target.checked, p.description)}
                            className="rounded accent-[var(--ty-matcha)] cursor-pointer"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={p.key}
                            onChange={e => handleUpdateParam(idx, e.target.value, p.value, p.enabled, p.description)}
                            placeholder="参数名"
                            className="w-full bg-transparent border-0 text-[var(--ty-text)] font-mono text-xs focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={p.value}
                            onChange={e => handleUpdateParam(idx, p.key, e.target.value, p.enabled, p.description)}
                            placeholder="参数值，支持 {{变量}}"
                            className="w-full bg-transparent border-0 text-[var(--ty-text)] font-mono text-xs focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={p.description || ''}
                            onChange={e => handleUpdateParam(idx, p.key, p.value, p.enabled, e.target.value)}
                            placeholder="备注说明"
                            className="w-full bg-transparent border-0 text-[var(--ty-text-muted)] text-xs focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            onClick={() => handleDeleteParam(idx)}
                            className="text-[var(--ty-text-subtle)] hover:text-[var(--ty-peach)] p-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* HEADERS TAB */}
        {activeTab === 'headers' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[var(--ty-text-muted)]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--ty-text)]">Request Headers (请求标头)</span>
                {/* Header Presets */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-[var(--ty-text-subtle)]">预设:</span>
                  <button
                    onClick={() => handleAddHeader('Content-Type', 'application/json')}
                    className="px-1.5 py-0.5 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] border border-[var(--ty-border)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] text-[10px]"
                  >
                    + JSON
                  </button>
                  <button
                    onClick={() => handleAddHeader('Accept', 'application/json')}
                    className="px-1.5 py-0.5 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] border border-[var(--ty-border)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] text-[10px]"
                  >
                    + Accept
                  </button>
                  <button
                    onClick={() => handleAddHeader('User-Agent', 'TongyunAPI/1.0')}
                    className="px-1.5 py-0.5 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] border border-[var(--ty-border)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] text-[10px]"
                  >
                    + User-Agent
                  </button>
                </div>
              </div>
              <button
                onClick={() => handleAddHeader()}
                className="flex items-center gap-1 px-2 py-1 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] text-[var(--ty-matcha)] text-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加请求头</span>
              </button>
            </div>

            <div className="border border-[var(--ty-border)] rounded-[var(--ty-radius-sm)] overflow-hidden bg-[var(--ty-surface-sunken)]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--ty-surface-raised)] text-[var(--ty-text-muted)] border-b border-[var(--ty-border)]">
                  <tr>
                    <th className="w-10 px-3 py-2 text-center">启用</th>
                    <th className="px-3 py-2 w-1/3">名称 (Header Name)</th>
                    <th className="px-3 py-2 w-1/3">内容 (Header Value)</th>
                    <th className="px-3 py-2">说明 (Description)</th>
                    <th className="w-10 px-2 py-2 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ty-border)]/50">
                  {request.headers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-[var(--ty-text-subtle)]">
                        暂无自定义请求头
                      </td>
                    </tr>
                  ) : (
                    request.headers.map((h, idx) => (
                      <tr key={idx} className="hover:bg-[var(--ty-surface-raised)]/30 transition-colors">
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={h.enabled}
                            onChange={e => handleUpdateHeader(idx, h.key, h.value, e.target.checked, h.description)}
                            className="rounded accent-[var(--ty-matcha)] cursor-pointer"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={h.key}
                            onChange={e => handleUpdateHeader(idx, e.target.value, h.value, h.enabled, h.description)}
                            placeholder="Header Key"
                            className="w-full bg-transparent border-0 text-[var(--ty-text)] font-mono text-xs focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={h.value}
                            onChange={e => handleUpdateHeader(idx, h.key, e.target.value, h.enabled, h.description)}
                            placeholder="Header Value"
                            className="w-full bg-transparent border-0 text-[var(--ty-text)] font-mono text-xs focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={h.description || ''}
                            onChange={e => handleUpdateHeader(idx, h.key, h.value, h.enabled, e.target.value)}
                            placeholder="说明"
                            className="w-full bg-transparent border-0 text-[var(--ty-text-muted)] text-xs focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            onClick={() => handleDeleteHeader(idx)}
                            className="text-[var(--ty-text-subtle)] hover:text-[var(--ty-peach)] p-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUTH TAB */}
        {activeTab === 'auth' && (
          <div className="space-y-4 max-w-xl">
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer text-[var(--ty-text)]">
                <input
                  type="radio"
                  name="auth_type"
                  checked={request.auth.auth_type === 'none'}
                  onChange={() => updateField('auth', { ...request.auth, auth_type: 'none' })}
                  className="accent-[var(--ty-matcha)]"
                />
                <span>无鉴权 (None)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-[var(--ty-text)]">
                <input
                  type="radio"
                  name="auth_type"
                  checked={request.auth.auth_type === 'bearer'}
                  onChange={() => updateField('auth', { ...request.auth, auth_type: 'bearer' })}
                  className="accent-[var(--ty-matcha)]"
                />
                <span>Bearer Token</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-[var(--ty-text)]">
                <input
                  type="radio"
                  name="auth_type"
                  checked={request.auth.auth_type === 'basic'}
                  onChange={() => updateField('auth', { ...request.auth, auth_type: 'basic' })}
                  className="accent-[var(--ty-matcha)]"
                />
                <span>Basic Auth</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-[var(--ty-text)]">
                <input
                  type="radio"
                  name="auth_type"
                  checked={request.auth.auth_type === 'apikey'}
                  onChange={() => updateField('auth', { ...request.auth, auth_type: 'apikey' })}
                  className="accent-[var(--ty-matcha)]"
                />
                <span>API Key</span>
              </label>
            </div>

            {request.auth.auth_type === 'bearer' && (
              <div className="space-y-2 p-3 bg-[var(--ty-surface-sunken)] rounded-[var(--ty-radius-sm)] border border-[var(--ty-border)]">
                <label className="text-xs text-[var(--ty-text-muted)] block">Token</label>
                <input
                  type="text"
                  value={request.auth.token || ''}
                  onChange={e => updateField('auth', { ...request.auth, token: e.target.value })}
                  placeholder="Bearer 令牌或 {{apiToken}}"
                  className="w-full bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-[var(--ty-radius-xs,4px)] px-3 py-1.5 text-xs font-mono text-[var(--ty-text)] outline-none focus:border-[var(--ty-matcha)]"
                />
              </div>
            )}

            {request.auth.auth_type === 'basic' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--ty-surface-sunken)] rounded-[var(--ty-radius-sm)] border border-[var(--ty-border)]">
                <div className="space-y-1">
                  <label className="text-xs text-[var(--ty-text-muted)]">用户名 (Username)</label>
                  <input
                    type="text"
                    value={request.auth.username || ''}
                    onChange={e => updateField('auth', { ...request.auth, username: e.target.value })}
                    placeholder="用户名"
                    className="w-full bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-[var(--ty-radius-xs,4px)] px-3 py-1.5 text-xs text-[var(--ty-text)] outline-none focus:border-[var(--ty-matcha)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[var(--ty-text-muted)]">密码 (Password)</label>
                  <input
                    type="password"
                    value={request.auth.password || ''}
                    onChange={e => updateField('auth', { ...request.auth, password: e.target.value })}
                    placeholder="密码"
                    className="w-full bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-[var(--ty-radius-xs,4px)] px-3 py-1.5 text-xs text-[var(--ty-text)] outline-none focus:border-[var(--ty-matcha)]"
                  />
                </div>
              </div>
            )}

            {request.auth.auth_type === 'apikey' && (
              <div className="grid grid-cols-3 gap-3 p-3 bg-[var(--ty-surface-sunken)] rounded-[var(--ty-radius-sm)] border border-[var(--ty-border)]">
                <div className="space-y-1">
                  <label className="text-xs text-[var(--ty-text-muted)]">键名 (Key)</label>
                  <input
                    type="text"
                    value={request.auth.api_key_name || ''}
                    onChange={e => updateField('auth', { ...request.auth, api_key_name: e.target.value })}
                    placeholder="如 X-API-Key"
                    className="w-full bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-[var(--ty-radius-xs,4px)] px-3 py-1.5 text-xs text-[var(--ty-text)] outline-none focus:border-[var(--ty-matcha)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[var(--ty-text-muted)]">键值 (Value)</label>
                  <input
                    type="text"
                    value={request.auth.api_key_value || ''}
                    onChange={e => updateField('auth', { ...request.auth, api_key_value: e.target.value })}
                    placeholder="API 密钥"
                    className="w-full bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-[var(--ty-radius-xs,4px)] px-3 py-1.5 text-xs text-[var(--ty-text)] outline-none focus:border-[var(--ty-matcha)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[var(--ty-text-muted)]">添加至 (Add To)</label>
                  <select
                    value={request.auth.api_key_in || 'header'}
                    onChange={e =>
                      updateField('auth', { ...request.auth, api_key_in: e.target.value as 'header' | 'query' })
                    }
                    className="w-full bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-[var(--ty-radius-xs,4px)] px-3 py-1.5 text-xs text-[var(--ty-text)] outline-none focus:border-[var(--ty-matcha)]"
                  >
                    <option value="header">Header</option>
                    <option value="query">Query Parameter</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BODY TAB */}
        {activeTab === 'body' && (
          <div className="space-y-3 h-full flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs">
                {(['none', 'json', 'raw', 'form-urlencoded', 'form-data'] as BodyType[]).map(type => (
                  <label key={type} className="flex items-center gap-1.5 cursor-pointer text-[var(--ty-text)]">
                    <input
                      type="radio"
                      name="body_type"
                      checked={request.body.body_type === type}
                      onChange={() =>
                        updateField('body', {
                          ...request.body,
                          body_type: type,
                        })
                      }
                      className="accent-[var(--ty-matcha)]"
                    />
                    <span className="capitalize">{type}</span>
                  </label>
                ))}
              </div>

              {request.body.body_type === 'json' && (
                <div className="flex items-center gap-2">
                  {jsonError ? (
                    <span className="text-[11px] text-[var(--ty-peach)] font-mono truncate max-w-xs">{jsonError}</span>
                  ) : (
                    <span className="text-[11px] text-[var(--ty-matcha)] font-mono">✓ JSON 格式正确</span>
                  )}
                  <button
                    onClick={handlePrettifyJson}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] text-[var(--ty-matcha)] text-xs border border-[var(--ty-border)] transition-colors"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>美化格式</span>
                  </button>
                </div>
              )}
            </div>

            {request.body.body_type === 'form-data' && (
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between text-xs text-[var(--ty-text-muted)]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--ty-text)]">Multipart 表单项与附件列表</span>
                    <span className="text-[11px] text-[var(--ty-text-subtle)]">
                      (支持键值文本及本地磁盘二进制文件上传)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAddFormData('text')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] text-[var(--ty-matcha)] text-xs border border-[var(--ty-border)] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ 文本字段</span>
                    </button>
                    <button
                      onClick={() => handleAddFormData('file')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-honey-soft)] text-[var(--ty-honey)] text-xs border border-[var(--ty-honey)]/40 hover:brightness-110 transition-colors"
                    >
                      <FileUp className="w-3.5 h-3.5" />
                      <span>+ 文件附件</span>
                    </button>
                  </div>
                </div>

                <div className="border border-[var(--ty-border)] rounded-[var(--ty-radius-sm)] overflow-hidden bg-[var(--ty-surface-sunken)] flex-1 overflow-y-auto min-h-[160px]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[var(--ty-surface-raised)] text-[var(--ty-text-muted)] border-b border-[var(--ty-border)] sticky top-0">
                      <tr>
                        <th className="w-10 px-3 py-2 text-center">启用</th>
                        <th className="px-3 py-2 w-1/4">字段名 (Key)</th>
                        <th className="px-3 py-2 w-28">类型 (Type)</th>
                        <th className="px-3 py-2">字段内容 / 文件路径 (Value)</th>
                        <th className="px-3 py-2 w-1/4">说明 (Description)</th>
                        <th className="w-10 px-2 py-2 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ty-border)]/50">
                      {(!request.body.form_data || request.body.form_data.length === 0) ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-[var(--ty-text-subtle)]">
                            暂无表单字段，点击右上角「+ 文本字段」或「+ 文件附件」添加
                          </td>
                        </tr>
                      ) : (
                        request.body.form_data.map((item, idx) => (
                          <tr key={idx} className="hover:bg-[var(--ty-surface-raised)]/30 transition-colors">
                            <td className="px-3 py-1.5 text-center">
                              <input
                                type="checkbox"
                                checked={item.enabled}
                                onChange={e => handleUpdateFormData(idx, { ...item, enabled: e.target.checked })}
                                className="rounded accent-[var(--ty-matcha)] cursor-pointer"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="text"
                                value={item.key}
                                onChange={e => handleUpdateFormData(idx, { ...item, key: e.target.value })}
                                placeholder="字段名 (如 file, avatar)"
                                className="w-full bg-transparent border-0 text-[var(--ty-text)] font-mono text-xs focus:outline-none"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <select
                                value={item.type}
                                onChange={e => handleUpdateFormData(idx, { ...item, type: e.target.value as 'text' | 'file' })}
                                className={`bg-[var(--ty-surface)] border rounded-[var(--ty-radius-xs,4px)] px-1.5 py-0.5 text-[11px] font-mono outline-none ${
                                  item.type === 'file' ? 'text-[var(--ty-honey)] border-[var(--ty-honey)]/40' : 'text-[var(--ty-matcha)] border-[var(--ty-border)]'
                                }`}
                              >
                                <option value="text">Text (文本)</option>
                                <option value="file">File (文件)</option>
                              </select>
                            </td>
                            <td className="px-2 py-1">
                              {item.type === 'file' ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={item.value}
                                    onChange={e => handleUpdateFormData(idx, { ...item, value: e.target.value })}
                                    placeholder="本地绝对路径，如 C:\data\avatar.png 或相对路径"
                                    className="flex-1 bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-[var(--ty-radius-xs,4px)] px-2 py-1 text-[var(--ty-honey)] font-mono text-xs focus:outline-none focus:border-[var(--ty-honey)]"
                                  />
                                  <label className="px-2 py-1 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] text-[var(--ty-text)] hover:text-[var(--ty-honey)] border border-[var(--ty-border)] text-xs cursor-pointer flex items-center gap-1 shrink-0 transition-colors">
                                    <Upload className="w-3 h-3" />
                                    <span>浏览</span>
                                    <input
                                      type="file"
                                      className="hidden"
                                      onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const path = (file as any).path || file.name;
                                          handleUpdateFormData(idx, { ...item, value: path });
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={item.value}
                                  onChange={e => handleUpdateFormData(idx, { ...item, value: e.target.value })}
                                  placeholder="字段值，支持 {{变量}}"
                                  className="w-full bg-transparent border-0 text-[var(--ty-text)] font-mono text-xs focus:outline-none"
                                />
                              )}
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="text"
                                value={item.description || ''}
                                onChange={e => handleUpdateFormData(idx, { ...item, description: e.target.value })}
                                placeholder="字段说明"
                                className="w-full bg-transparent border-0 text-[var(--ty-text-muted)] text-xs focus:outline-none"
                              />
                            </td>
                            <td className="px-2 py-1 text-center">
                              <button
                                onClick={() => handleDeleteFormData(idx)}
                                className="text-[var(--ty-text-subtle)] hover:text-[var(--ty-peach)] p-1 transition-colors"
                                title="删除此字段"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {request.body.body_type !== 'none' && request.body.body_type !== 'form-data' && (
              <div className="flex-1 flex flex-col min-h-[220px]">
                <textarea
                  value={request.body.content}
                  onChange={e =>
                    updateField('body', {
                      ...request.body,
                      content: e.target.value,
                    })
                  }
                  placeholder={
                    request.body.body_type === 'json'
                      ? '{\n  "key": "value"\n}'
                      : '输入请求体内容...'
                  }
                  className="w-full flex-1 bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] rounded-[var(--ty-radius-sm)] p-3 text-xs font-mono text-[var(--ty-text)] placeholder-[var(--ty-text-subtle)] focus:outline-none focus:border-[var(--ty-matcha)] transition-colors resize-none leading-relaxed"
                />
              </div>
            )}
          </div>
        )}

        {/* TESTS & EXTRACTION TAB */}
        {activeTab === 'tests' && (
          <div className="space-y-6 text-xs max-w-4xl">
            {/* 1. Assertions */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ty-border)] pb-2">
                <div>
                  <h4 className="font-semibold text-[var(--ty-text)] flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-[var(--ty-matcha)]" />
                    <span>请求断言规则 (Assertions)</span>
                  </h4>
                  <p className="text-[11px] text-[var(--ty-text-subtle)] mt-0.5">
                    发送请求后自动运行断言，在下方“响应”面板展示测试通过与失败详情
                  </p>
                </div>

                {/* Preset shortcuts */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-[var(--ty-text-subtle)] mr-1">快捷添加:</span>
                  <button
                    onClick={() => handleAddAssertion({ name: '状态码为 200', type: 'status_equals', expected: '200' })}
                    className="px-2 py-1 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] text-[11px] border border-[var(--ty-border)] transition-colors"
                  >
                    + 状态码 200
                  </button>
                  <button
                    onClick={() => handleAddAssertion({ name: '响应耗时在 1s 内', type: 'time_less_than', expected: '1000' })}
                    className="px-2 py-1 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] text-[11px] border border-[var(--ty-border)] transition-colors"
                  >
                    + 耗时 &lt; 1000ms
                  </button>
                  <button
                    onClick={() => handleAddAssertion({ name: '包含成功标记', type: 'body_contains', expected: 'success' })}
                    className="px-2 py-1 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] text-[11px] border border-[var(--ty-border)] transition-colors"
                  >
                    + 包含关键字
                  </button>
                  <button
                    onClick={() => handleAddAssertion({ name: 'code 字段校验', type: 'json_path_equals', target: 'code', expected: '0' })}
                    className="px-2 py-1 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] text-[11px] border border-[var(--ty-border)] transition-colors"
                  >
                    + JSON 字段
                  </button>
                  {lastResponse && (
                    <button
                      onClick={() => {
                        const smart = generateSmartAssertions(lastResponse);
                        const existing = request.tests || [];
                        onChange({
                          ...request,
                          tests: [...existing, ...smart],
                        });
                        if (onToast) onToast(`⚡ 已根据当前响应智能生成 ${smart.length} 条测试断言`);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-honey-soft)] text-[var(--ty-honey)] font-medium text-[11px] border border-[var(--ty-honey)]/40 hover:brightness-110 transition-colors ml-1"
                      title="根据当前接口真实响应的状态码、耗时和数据结构自动生成推荐断言"
                    >
                      <Wand2 className="w-3 h-3 text-[var(--ty-honey)]" />
                      <span>智能推荐断言</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleAddAssertion()}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] text-[var(--ty-matcha)] text-[11px] font-medium transition-colors ml-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>添加断言</span>
                  </button>
                </div>
              </div>

              {/* Assertion Table */}
              <div className="border border-[var(--ty-border)] rounded-[var(--ty-radius-sm)] overflow-hidden bg-[var(--ty-surface-sunken)]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[var(--ty-surface-raised)] text-[var(--ty-text-muted)] border-b border-[var(--ty-border)]">
                    <tr>
                      <th className="w-10 px-3 py-2 text-center">启用</th>
                      <th className="px-3 py-2 w-1/4">断言说明名称</th>
                      <th className="px-3 py-2 w-1/4">校验类型</th>
                      <th className="px-3 py-2 w-1/5">目标路径 / 标头</th>
                      <th className="px-3 py-2 w-1/5">期望值 (Expected)</th>
                      <th className="w-10 px-2 py-2 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ty-border)]/50">
                    {(!request.tests || request.tests.length === 0) ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-[var(--ty-text-subtle)]">
                          暂无断言规则，点击上方快捷按钮添加（例如验证状态码 200 或耗时小于 1000ms）
                        </td>
                      </tr>
                    ) : (
                      request.tests.map((test, idx) => (
                        <tr key={test.id || idx} className="hover:bg-[var(--ty-surface-raised)]/30 transition-colors">
                          <td className="px-3 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={test.enabled}
                              onChange={e => handleUpdateAssertion(idx, { ...test, enabled: e.target.checked })}
                              className="rounded accent-[var(--ty-matcha)] cursor-pointer"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              value={test.name}
                              onChange={e => handleUpdateAssertion(idx, { ...test, name: e.target.value })}
                              placeholder="例如: 状态码 200"
                              className="w-full bg-transparent border-0 text-[var(--ty-text)] text-xs focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <select
                              value={test.type}
                              onChange={e => handleUpdateAssertion(idx, { ...test, type: e.target.value as AssertionType })}
                              className="w-full bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-[var(--ty-radius-xs,4px)] px-2 py-1 text-[var(--ty-text)] text-xs outline-none"
                            >
                              <option value="status_equals">状态码等于 (==)</option>
                              <option value="status_in_range">状态码区间 (如 200-299)</option>
                              <option value="time_less_than">响应耗时小于 (ms)</option>
                              <option value="body_contains">响应体包含文本</option>
                              <option value="json_path_equals">JSON 字段值匹配</option>
                              <option value="header_exists">包含 Header 标头</option>
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              value={test.target || ''}
                              onChange={e => handleUpdateAssertion(idx, { ...test, target: e.target.value })}
                              placeholder={
                                test.type === 'json_path_equals'
                                  ? '如 data.code'
                                  : test.type === 'header_exists'
                                  ? '如 content-type'
                                  : '不需填写'
                              }
                              disabled={test.type !== 'json_path_equals' && test.type !== 'header_exists'}
                              className="w-full bg-transparent border-0 text-[var(--ty-text)] font-mono text-xs focus:outline-none disabled:opacity-30"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              value={test.expected}
                              onChange={e => handleUpdateAssertion(idx, { ...test, expected: e.target.value })}
                              placeholder="期望匹配值"
                              className="w-full bg-transparent border-0 text-[var(--ty-text)] font-mono text-xs focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1 text-center">
                            <button
                              onClick={() => handleDeleteAssertion(idx)}
                              className="text-[var(--ty-text-subtle)] hover:text-[var(--ty-peach)] p-1 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Variable Extractions */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ty-border)] pb-2">
                <div>
                  <h4 className="font-semibold text-[var(--ty-text)] flex items-center gap-1.5">
                    <Variable className="w-4 h-4 text-[var(--ty-matcha)]" />
                    <span>环境变量自动提取 (Auto Variable Extraction)</span>
                  </h4>
                  <p className="text-[11px] text-[var(--ty-text-subtle)] mt-0.5">
                    请求成功后，自动从返回内容中提取字段并写入当前环境，下游接口可直接通过 <code className="text-[var(--ty-matcha)] font-mono">{"{{变量名}}"}</code> 调用
                  </p>
                </div>

                <button
                  onClick={() => handleAddExtraction()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] text-[var(--ty-matcha)] text-[11px] font-medium transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>添加提取规则</span>
                </button>
              </div>

              {/* Extraction Table */}
              <div className="border border-[var(--ty-border)] rounded-[var(--ty-radius-sm)] overflow-hidden bg-[var(--ty-surface-sunken)]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[var(--ty-surface-raised)] text-[var(--ty-text-muted)] border-b border-[var(--ty-border)]">
                    <tr>
                      <th className="w-10 px-3 py-2 text-center">启用</th>
                      <th className="px-3 py-2 w-1/3">写入目标变量名 (将成为 {"{{变量}}"})</th>
                      <th className="px-3 py-2 w-1/4">提取来源</th>
                      <th className="px-3 py-2 w-1/3">提取字段路径 (JSON 路径 / Header 名)</th>
                      <th className="w-10 px-2 py-2 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ty-border)]/50">
                    {(!request.extracts || request.extracts.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-[var(--ty-text-subtle)]">
                          暂无提取规则，例如在登录接口配置提取 data.token 写入 {"{{token}}"}
                        </td>
                      </tr>
                    ) : (
                      request.extracts.map((ext, idx) => (
                        <tr key={ext.id || idx} className="hover:bg-[var(--ty-surface-raised)]/30 transition-colors">
                          <td className="px-3 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={ext.enabled}
                              onChange={e => handleUpdateExtraction(idx, { ...ext, enabled: e.target.checked })}
                              className="rounded accent-[var(--ty-matcha)] cursor-pointer"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[var(--ty-text-subtle)] font-mono">{"{{"}</span>
                              <input
                                type="text"
                                value={ext.var_name}
                                onChange={e => handleUpdateExtraction(idx, { ...ext, var_name: e.target.value })}
                                placeholder="如 token, userId"
                                className="w-full bg-transparent border-0 text-[var(--ty-matcha)] font-mono text-xs focus:outline-none"
                              />
                              <span className="text-[var(--ty-text-subtle)] font-mono">{"}}"}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1">
                            <select
                              value={ext.source}
                              onChange={e => handleUpdateExtraction(idx, { ...ext, source: e.target.value as 'json' | 'header' })}
                              className="w-full bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-[var(--ty-radius-xs,4px)] px-2 py-1 text-[var(--ty-text)] text-xs outline-none"
                            >
                              <option value="json">JSON 响应体路径</option>
                              <option value="header">响应 Header 标头</option>
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              value={ext.path_or_key}
                              onChange={e => handleUpdateExtraction(idx, { ...ext, path_or_key: e.target.value })}
                              placeholder={ext.source === 'json' ? '如 data.token 或 items.0.id' : '如 Authorization'}
                              className="w-full bg-transparent border-0 text-[var(--ty-text)] font-mono text-xs focus:outline-none"
                            />
                          </td>
                          <td className="px-2 py-1 text-center">
                            <button
                              onClick={() => handleDeleteExtraction(idx)}
                              className="text-[var(--ty-text-subtle)] hover:text-[var(--ty-peach)] p-1 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* DOCS TAB */}
        {activeTab === 'docs' && (
          <div className="space-y-4 max-w-2xl text-xs">
            <div className="space-y-1">
              <label className="text-[var(--ty-text-muted)] font-medium">接口名称</label>
              <input
                type="text"
                value={request.name}
                onChange={e => updateField('name', e.target.value)}
                className="w-full bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] rounded-[var(--ty-radius-sm)] px-3 py-2 text-[var(--ty-text)] text-xs focus:outline-none focus:border-[var(--ty-matcha)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[var(--ty-text-muted)] font-medium">接口文档说明 / 备注</label>
              <textarea
                value={request.description || ''}
                onChange={e => updateField('description', e.target.value)}
                rows={5}
                placeholder="记录此接口的业务用途、字段定义或错误码规范..."
                className="w-full bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] rounded-[var(--ty-radius-sm)] p-3 text-[var(--ty-text)] text-xs focus:outline-none focus:border-[var(--ty-matcha)] leading-relaxed resize-none"
              />
            </div>

            {request.filePath && (
              <div className="p-3 bg-[var(--ty-surface-sunken)] rounded-[var(--ty-radius-sm)] border border-[var(--ty-border)] space-y-1">
                <span className="text-[var(--ty-text-subtle)]">底层存储文件路径 (纯文本 Git 跟踪):</span>
                <div className="font-mono text-[var(--ty-text-muted)] break-all select-all text-[11px] bg-[var(--ty-surface)] p-2 rounded-[var(--ty-radius-xs,4px)] border border-[var(--ty-border)]/60">
                  {request.filePath}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-3xl text-xs">
            <div>
              <h4 className="font-semibold text-[var(--ty-text)] flex items-center gap-1.5 text-sm mb-1">
                <Shield className="w-4 h-4 text-[var(--ty-matcha)]" />
                <span>3xx 重定向安全策略 (Redirect Policy)</span>
              </h4>
              <p className="text-[11px] text-[var(--ty-text-subtle)]">
                配置发送请求遇到 HTTP 301 / 302 / 307 / 308 重定向时的跳转行为与机密数据防泄露机制。
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  value: 'safe' as RedirectPolicy,
                  badge: '推荐 · 默认',
                  badgeColor: 'bg-[var(--ty-surface)] text-[var(--ty-matcha)] border-[var(--ty-matcha)]/40',
                  title: '安全防泄露模式 (Safe)',
                  desc: '自动跟随同域名/同主机的重定向；跨主机重定向（跳转到未知第三方域名）时自动停在 3xx 并返回，杜绝携带私密 Authorization 令牌、Cookie 或 Header 静默外泄。',
                },
                {
                  value: 'follow' as RedirectPolicy,
                  badge: '自动跟随',
                  badgeColor: 'bg-[var(--ty-surface)] text-[var(--ty-text)] border-[var(--ty-border)]',
                  title: '自动跟随所有重定向 (Follow)',
                  desc: '无论同主机还是跨主机均自动跟随重定向（最多 10 跳），直接获取最终目标网址的响应内容。',
                },
                {
                  value: 'manual' as RedirectPolicy,
                  badge: '手动拦截',
                  badgeColor: 'bg-[var(--ty-honey-soft)] text-[var(--ty-honey)] border-[var(--ty-honey)]/40',
                  title: '严格手动拦截 3xx (Manual)',
                  desc: '严格停在 3xx 响应码，不进行任何自动跟随跳转。便于单步调试 OAuth 2.0 授权码回调、跳转 URL 及 Location 响应头。',
                },
              ].map(opt => {
                const isSelected = (request.redirect_policy || 'safe') === opt.value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => updateField('redirect_policy', opt.value)}
                    className={`p-3.5 rounded-[var(--ty-radius-sm)] border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[var(--ty-surface-raised)] border-[var(--ty-matcha)] ring-1 ring-[var(--ty-matcha)]/30'
                        : 'bg-[var(--ty-surface-sunken)] border-[var(--ty-border)] hover:border-[var(--ty-border-subtle)] hover:bg-[var(--ty-surface-raised)]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="redirect_policy"
                          checked={isSelected}
                          onChange={() => updateField('redirect_policy', opt.value)}
                          className="accent-[var(--ty-matcha)]"
                        />
                        <span className="font-semibold text-[var(--ty-text)]">{opt.title}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-[var(--ty-radius-xs,4px)] text-[10px] font-mono border ${opt.badgeColor}`}>
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--ty-text-subtle)] pl-5 leading-relaxed">{opt.desc}</p>
                  </div>
                );
              })}
            </div>

            <div className="p-3.5 rounded-[var(--ty-radius-sm)] border border-[var(--ty-border)] bg-[var(--ty-surface-sunken)] space-y-2">
              <h5 className="font-semibold text-[var(--ty-text)] flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-[var(--ty-text-subtle)]" />
                <span>底层网络传输引擎规范</span>
              </h5>
              <div className="text-[11px] text-[var(--ty-text-subtle)] space-y-1 leading-relaxed">
                <p>• 桌面客户端采用 Rust 原生 <code className="text-[var(--ty-text)] font-mono">reqwest + rustls</code> 网络栈，避免 Node/Browser 的沙盒与 CORS 跨域限制。</p>
                <p>• 接口定义完全基于纯文本 <code className="text-[var(--ty-text)] font-mono">.http</code> 与 <code className="text-[var(--ty-text)] font-mono">http-client.env.json</code>，支持 Git 协同审查与版本追溯。</p>
                <p>• 当前重定向策略配置将随接口请求状态持久化，并在批量运行器中生效。</p>
              </div>
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};
