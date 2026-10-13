import React, { useState, useEffect } from 'react';
import {
  Play,
  Copy,
  Check,
  Plus,
  Trash2,
  Wand2,
  RefreshCw
} from 'lucide-react';
import {
  RequestData,
  HttpMethod,
  BodyType,
  EnvironmentData
} from '../types/api';
import { exportToCurl } from '../utils/curl';
import { getMethodBadgeColor } from './Sidebar';

interface RequestEditorProps {
  request: RequestData;
  environment: EnvironmentData | null;
  onChange: (updated: RequestData) => void;
  onSend: () => void;
  isSending: boolean;
}

export const RequestEditor: React.FC<RequestEditorProps> = ({
  request,
  environment,
  onChange,
  onSend,
  isSending,
}) => {
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'auth' | 'body' | 'docs'>('params');
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

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

  const activeParamsCount = request.params.filter(p => p.enabled && p.key.trim()).length;
  const activeHeadersCount = request.headers.filter(h => h.enabled && h.key.trim()).length;

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden border-b border-slate-800">
      {/* URL Input Bar */}
      <div className="p-3 border-b border-slate-800 flex items-center gap-2 bg-slate-950/30">
        {/* Method selector */}
        <select
          value={request.method}
          onChange={e => updateField('method', e.target.value as HttpMethod)}
          className={`font-mono text-xs font-bold py-2 px-2.5 rounded-md border outline-none bg-slate-900 cursor-pointer ${getMethodBadgeColor(
            request.method
          )}`}
        >
          <option value="GET" className="bg-slate-900 text-emerald-400">GET</option>
          <option value="POST" className="bg-slate-900 text-amber-400">POST</option>
          <option value="PUT" className="bg-slate-900 text-sky-400">PUT</option>
          <option value="DELETE" className="bg-slate-900 text-rose-400">DELETE</option>
          <option value="PATCH" className="bg-slate-900 text-purple-400">PATCH</option>
          <option value="HEAD" className="bg-slate-900 text-slate-300">HEAD</option>
          <option value="OPTIONS" className="bg-slate-900 text-slate-300">OPTIONS</option>
        </select>

        {/* URL Input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={request.url}
            onChange={e => updateField('url', e.target.value)}
            placeholder="输入请求 URL 或 {{baseUrl}}/api/v1/..."
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                onSend();
              }
            }}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        {/* Quick Copy cURL */}
        <button
          onClick={handleCopyCurl}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition-colors"
          title="复制为完整 cURL 命令"
        >
          {copiedCurl ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">已复制</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>cURL</span>
            </>
          )}
        </button>

        {/* Send Button */}
        <button
          onClick={onSend}
          disabled={isSending}
          className="flex items-center gap-1.5 px-5 py-2 rounded-md bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-sky-500/20 active:scale-95 transition-all disabled:opacity-50"
          title="发送请求 (Ctrl+Enter)"
        >
          {isSending ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-white" />
          )}
          <span>{isSending ? '发送中...' : '发送'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-800 px-4 bg-slate-950/20 text-xs gap-4">
        <button
          onClick={() => setActiveTab('params')}
          className={`py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'params'
              ? 'text-sky-400 border-sky-400'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <span>Params (查询参数)</span>
          {activeParamsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-500/20 text-sky-300 font-mono">
              {activeParamsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('headers')}
          className={`py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'headers'
              ? 'text-sky-400 border-sky-400'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <span>Headers (请求头)</span>
          {activeHeadersCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-500/20 text-sky-300 font-mono">
              {activeHeadersCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('auth')}
          className={`py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'auth'
              ? 'text-sky-400 border-sky-400'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <span>Auth (鉴权)</span>
          {request.auth.auth_type !== 'none' && (
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-500/20 text-purple-300 font-mono uppercase">
              {request.auth.auth_type}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('body')}
          className={`py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'body'
              ? 'text-sky-400 border-sky-400'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <span>Body (请求体)</span>
          {request.body.body_type !== 'none' && (
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono uppercase">
              {request.body.body_type}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('docs')}
          className={`py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'docs'
              ? 'text-sky-400 border-sky-400'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <span>信息与文档</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* PARAMS TAB */}
        {activeTab === 'params' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium text-slate-300">Query Parameters</span>
              <button
                onClick={handleAddParam}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加参数</span>
              </button>
            </div>

            <div className="border border-slate-800 rounded-md overflow-hidden bg-slate-950/40">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="w-10 px-3 py-2 text-center">启用</th>
                    <th className="px-3 py-2 w-1/3">参数名 (Key)</th>
                    <th className="px-3 py-2 w-1/3">参数值 (Value)</th>
                    <th className="px-3 py-2">说明 (Description)</th>
                    <th className="w-10 px-2 py-2 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {request.params.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-500">
                        暂无查询参数，点击右上角“添加参数”创建
                      </td>
                    </tr>
                  ) : (
                    request.params.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={p.enabled}
                            onChange={e => handleUpdateParam(idx, p.key, p.value, e.target.checked, p.description)}
                            className="rounded accent-sky-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={p.key}
                            onChange={e => handleUpdateParam(idx, e.target.value, p.value, p.enabled, p.description)}
                            placeholder="参数名"
                            className="w-full bg-transparent border-0 text-slate-200 font-mono text-xs focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={p.value}
                            onChange={e => handleUpdateParam(idx, p.key, e.target.value, p.enabled, p.description)}
                            placeholder="参数值，支持 {{变量}}"
                            className="w-full bg-transparent border-0 text-slate-200 font-mono text-xs focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={p.description || ''}
                            onChange={e => handleUpdateParam(idx, p.key, p.value, p.enabled, e.target.value)}
                            placeholder="备注说明"
                            className="w-full bg-transparent border-0 text-slate-400 text-xs focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            onClick={() => handleDeleteParam(idx)}
                            className="text-slate-500 hover:text-rose-400 p-1"
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
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-300">Request Headers</span>
                {/* Header Presets */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-500">常用预设:</span>
                  <button
                    onClick={() => handleAddHeader('Content-Type', 'application/json')}
                    className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-sky-300 text-[10px]"
                  >
                    + JSON
                  </button>
                  <button
                    onClick={() => handleAddHeader('Accept', 'application/json')}
                    className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-sky-300 text-[10px]"
                  >
                    + Accept
                  </button>
                  <button
                    onClick={() => handleAddHeader('User-Agent', 'TongyunAPI/1.0')}
                    className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-sky-300 text-[10px]"
                  >
                    + User-Agent
                  </button>
                </div>
              </div>
              <button
                onClick={() => handleAddHeader()}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加请求头</span>
              </button>
            </div>

            <div className="border border-slate-800 rounded-md overflow-hidden bg-slate-950/40">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="w-10 px-3 py-2 text-center">启用</th>
                    <th className="px-3 py-2 w-1/3">名称 (Header Name)</th>
                    <th className="px-3 py-2 w-1/3">内容 (Header Value)</th>
                    <th className="px-3 py-2">说明 (Description)</th>
                    <th className="w-10 px-2 py-2 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {request.headers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-500">
                        暂无自定义请求头
                      </td>
                    </tr>
                  ) : (
                    request.headers.map((h, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={h.enabled}
                            onChange={e => handleUpdateHeader(idx, h.key, h.value, e.target.checked, h.description)}
                            className="rounded accent-sky-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={h.key}
                            onChange={e => handleUpdateHeader(idx, e.target.value, h.value, h.enabled, h.description)}
                            placeholder="Header Key"
                            className="w-full bg-transparent border-0 text-slate-200 font-mono text-xs focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={h.value}
                            onChange={e => handleUpdateHeader(idx, h.key, e.target.value, h.enabled, h.description)}
                            placeholder="Header Value"
                            className="w-full bg-transparent border-0 text-slate-200 font-mono text-xs focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={h.description || ''}
                            onChange={e => handleUpdateHeader(idx, h.key, h.value, h.enabled, e.target.value)}
                            placeholder="说明"
                            className="w-full bg-transparent border-0 text-slate-400 text-xs focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            onClick={() => handleDeleteHeader(idx)}
                            className="text-slate-500 hover:text-rose-400 p-1"
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
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="radio"
                  name="auth_type"
                  checked={request.auth.auth_type === 'none'}
                  onChange={() => updateField('auth', { ...request.auth, auth_type: 'none' })}
                  className="accent-sky-500"
                />
                <span>无鉴权 (None)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="radio"
                  name="auth_type"
                  checked={request.auth.auth_type === 'bearer'}
                  onChange={() => updateField('auth', { ...request.auth, auth_type: 'bearer' })}
                  className="accent-sky-500"
                />
                <span>Bearer Token</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="radio"
                  name="auth_type"
                  checked={request.auth.auth_type === 'basic'}
                  onChange={() => updateField('auth', { ...request.auth, auth_type: 'basic' })}
                  className="accent-sky-500"
                />
                <span>Basic Auth</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="radio"
                  name="auth_type"
                  checked={request.auth.auth_type === 'apikey'}
                  onChange={() => updateField('auth', { ...request.auth, auth_type: 'apikey' })}
                  className="accent-sky-500"
                />
                <span>API Key</span>
              </label>
            </div>

            {request.auth.auth_type === 'bearer' && (
              <div className="space-y-2 p-3 bg-slate-950/60 rounded-md border border-slate-800">
                <label className="text-xs text-slate-400 block">Token</label>
                <input
                  type="text"
                  value={request.auth.token || ''}
                  onChange={e => updateField('auth', { ...request.auth, token: e.target.value })}
                  placeholder="Bearer 令牌或 {{apiToken}}"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-sky-500"
                />
              </div>
            )}

            {request.auth.auth_type === 'basic' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-md border border-slate-800">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">用户名 (Username)</label>
                  <input
                    type="text"
                    value={request.auth.username || ''}
                    onChange={e => updateField('auth', { ...request.auth, username: e.target.value })}
                    placeholder="用户名"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">密码 (Password)</label>
                  <input
                    type="password"
                    value={request.auth.password || ''}
                    onChange={e => updateField('auth', { ...request.auth, password: e.target.value })}
                    placeholder="密码"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            )}

            {request.auth.auth_type === 'apikey' && (
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950/60 rounded-md border border-slate-800">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">键名 (Key)</label>
                  <input
                    type="text"
                    value={request.auth.api_key_name || ''}
                    onChange={e => updateField('auth', { ...request.auth, api_key_name: e.target.value })}
                    placeholder="如 X-API-Key"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">键值 (Value)</label>
                  <input
                    type="text"
                    value={request.auth.api_key_value || ''}
                    onChange={e => updateField('auth', { ...request.auth, api_key_value: e.target.value })}
                    placeholder="API 密钥"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">添加至 (Add To)</label>
                  <select
                    value={request.auth.api_key_in || 'header'}
                    onChange={e =>
                      updateField('auth', { ...request.auth, api_key_in: e.target.value as 'header' | 'query' })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
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
                {(['none', 'json', 'raw', 'form-urlencoded'] as BodyType[]).map(type => (
                  <label key={type} className="flex items-center gap-1.5 cursor-pointer text-slate-300">
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
                      className="accent-sky-500"
                    />
                    <span className="capitalize">{type}</span>
                  </label>
                ))}
              </div>

              {request.body.body_type === 'json' && (
                <div className="flex items-center gap-2">
                  {jsonError ? (
                    <span className="text-[11px] text-rose-400 font-mono truncate max-w-xs">{jsonError}</span>
                  ) : (
                    <span className="text-[11px] text-emerald-400 font-mono">✓ JSON 格式正确</span>
                  )}
                  <button
                    onClick={handlePrettifyJson}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs border border-slate-700 transition-colors"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>美化格式</span>
                  </button>
                </div>
              )}
            </div>

            {request.body.body_type !== 'none' && (
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
                  className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-md p-3 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors resize-none leading-relaxed"
                />
              </div>
            )}
          </div>
        )}

        {/* DOCS TAB */}
        {activeTab === 'docs' && (
          <div className="space-y-4 max-w-2xl text-xs">
            <div className="space-y-1">
              <label className="text-slate-400 font-medium">接口名称</label>
              <input
                type="text"
                value={request.name}
                onChange={e => updateField('name', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-medium">接口文档说明 / 备注</label>
              <textarea
                value={request.description || ''}
                onChange={e => updateField('description', e.target.value)}
                rows={5}
                placeholder="记录此接口的业务用途、字段定义或错误码规范..."
                className="w-full bg-slate-950 border border-slate-800 rounded-md p-3 text-slate-200 text-xs focus:outline-none focus:border-sky-500 leading-relaxed resize-none"
              />
            </div>

            {request.filePath && (
              <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800 space-y-1">
                <span className="text-slate-500">底层存储文件路径 (纯文本 Git 跟踪):</span>
                <div className="font-mono text-slate-300 break-all select-all text-[11px] bg-slate-900/80 p-2 rounded">
                  {request.filePath}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
