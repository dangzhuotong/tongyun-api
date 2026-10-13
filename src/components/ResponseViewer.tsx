import React, { useState } from 'react';
import {
  Check,
  Copy,
  Clock,
  HardDrive,
  Terminal,
  Zap,
  Download,
  Search,
  X,
  CheckCircle2,
  XCircle,
  Variable,
  CheckSquare,
  Bot
} from 'lucide-react';
import { ResponsePayload, RequestData } from '../types/api';

interface ResponseViewerProps {
  response: ResponsePayload | null;
  isSending: boolean;
  currentRequest?: RequestData;
  onCopyAiPrompt?: () => void;
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({
  response,
  isSending,
  currentRequest,
  onCopyAiPrompt,
}) => {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'tests' | 'preview'>('body');
  const [viewMode, setViewMode] = useState<'pretty' | 'raw'>('pretty');
  const [copied, setCopied] = useState(false);
  const [copiedHeaders, setCopiedHeaders] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
    if (status >= 300 && status < 400) return 'text-sky-400 bg-sky-500/15 border-sky-500/30';
    if (status >= 400 && status < 500) return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/15 border-rose-500/30';
  };

  const getStatusMeaning = (status: number) => {
    switch (status) {
      case 200: return 'OK (成功)';
      case 201: return 'Created (已创建)';
      case 204: return 'No Content (无内容)';
      case 301: return 'Moved Permanently (永久重定向)';
      case 302: return 'Found (临时重定向)';
      case 304: return 'Not Modified (未修改)';
      case 400: return 'Bad Request (请求参数错误)';
      case 401: return 'Unauthorized (未认证)';
      case 403: return 'Forbidden (禁止访问)';
      case 404: return 'Not Found (未找到接口)';
      case 405: return 'Method Not Allowed (方法不被允许)';
      case 422: return 'Unprocessable Entity (语义错误)';
      case 429: return 'Too Many Requests (请求过于频繁)';
      case 500: return 'Internal Server Error (服务端错误)';
      case 502: return 'Bad Gateway (网关错误)';
      case 503: return 'Service Unavailable (服务不可用)';
      case 504: return 'Gateway Timeout (网关超时)';
      default: return 'HTTP Response';
    }
  };

  const handleCopy = () => {
    if (!response) return;
    navigator.clipboard.writeText(response.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyHeaders = () => {
    if (!response) return;
    const headerStr = response.headers.map(h => `${h.key}: ${h.value}`).join('\n');
    navigator.clipboard.writeText(headerStr);
    setCopiedHeaders(true);
    setTimeout(() => setCopiedHeaders(false), 2000);
  };

  const handleDownloadResponse = () => {
    if (!response) return;
    const ext = response.is_json ? 'json' : 'txt';
    const blob = new Blob([response.body], { type: response.is_json ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFormattedBody = () => {
    if (!response) return '';
    if (viewMode === 'raw') return response.body;

    if (response.is_json) {
      try {
        const parsed = JSON.parse(response.body);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return response.body;
      }
    }
    return response.body;
  };

  if (isSending) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950/70 p-6 text-center select-none">
        <div className="relative mb-4">
          <div className="w-12 h-12 rounded-full border-2 border-sky-500/20 border-t-sky-400 animate-spin" />
          <Zap className="w-5 h-5 text-sky-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="text-sm font-medium text-slate-200">正在发送 HTTP 请求...</div>
        <p className="text-xs text-slate-500 mt-1 font-mono">Tauri 原生客户端免跨域直连</p>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950/70 p-6 text-center select-none text-slate-500">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-600 shadow-inner">
          <Terminal className="w-8 h-8 text-sky-500/60" />
        </div>
        <h3 className="text-sm font-semibold text-slate-300">尚未发送请求</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          点击右上角“发送”按钮或使用快捷键启动接口调试
        </p>

        {/* Shortcuts card */}
        <div className="mt-6 grid grid-cols-2 gap-2 text-left text-xs bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 max-w-md w-full">
          <div className="flex items-center justify-between px-2 py-1 bg-slate-950/40 rounded border border-slate-800/40">
            <span className="text-slate-400">发送请求</span>
            <kbd className="font-mono text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
              Ctrl + Enter
            </kbd>
          </div>
          <div className="flex items-center justify-between px-2 py-1 bg-slate-950/40 rounded border border-slate-800/40">
            <span className="text-slate-400">保存接口纯文本</span>
            <kbd className="font-mono text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
              Ctrl + S
            </kbd>
          </div>
          <div className="flex items-center justify-between px-2 py-1 bg-slate-950/40 rounded border border-slate-800/40">
            <span className="text-slate-400">环境变量代换</span>
            <code className="font-mono text-[11px] text-emerald-400">{"{{baseUrl}}"}</code>
          </div>
          <div className="flex items-center justify-between px-2 py-1 bg-slate-950/40 rounded border border-slate-800/40">
            <span className="text-slate-400">文件保存位置</span>
            <span className="font-mono text-[11px] text-amber-400">./tongyun-collections/</span>
          </div>
        </div>
      </div>
    );
  }

  const formattedBody = getFormattedBody();
  const lineCount = formattedBody.split('\n').length;

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* Response Header Status Bar */}
      <div className="h-11 px-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div
            title={getStatusMeaning(response.status)}
            className={`px-2 py-0.5 rounded border font-mono text-xs font-bold flex items-center gap-1.5 ${getStatusColor(
              response.status
            )}`}
          >
            <span>{response.status || 'ERROR'}</span>
            <span>{response.status_text}</span>
            <span className="text-[10px] opacity-75 font-normal">({getStatusMeaning(response.status)})</span>
          </div>

          {/* Time Badge */}
          <div className="flex items-center gap-1 text-xs font-mono text-slate-400" title="响应耗时">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{response.time_ms} ms</span>
          </div>

          {/* Size Badge */}
          <div className="flex items-center gap-1 text-xs font-mono text-slate-400" title="响应体大小">
            <HardDrive className="w-3.5 h-3.5 text-slate-500" />
            <span>{formatSize(response.size_bytes)}</span>
          </div>

          {/* Tests Badge if ran */}
          {response.test_results && response.test_results.length > 0 && (
            <div
              className={`px-2 py-0.5 rounded border font-mono text-[11px] font-medium flex items-center gap-1 ${
                response.test_results.every(t => t.passed)
                  ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                  : 'text-rose-400 bg-rose-500/15 border-rose-500/30'
              }`}
            >
              {response.test_results.every(t => t.passed) ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              ) : (
                <XCircle className="w-3 h-3 text-rose-400" />
              )}
              <span>
                断言: {response.test_results.filter(t => t.passed).length}/{response.test_results.length}
              </span>
            </div>
          )}

          {/* Extracted Vars Badge */}
          {response.extracted_vars && response.extracted_vars.length > 0 && (
            <div className="px-2 py-0.5 rounded border border-sky-500/30 bg-sky-500/15 text-sky-300 font-mono text-[11px] font-medium flex items-center gap-1">
              <Zap className="w-3 h-3 text-sky-400" />
              <span>提取 {response.extracted_vars.length} 变量</span>
            </div>
          )}
        </div>

        {/* Right actions: Copy & Modes & Download */}
        <div className="flex items-center gap-2">
          {activeTab === 'body' && (
            <div className="flex items-center bg-slate-900 rounded border border-slate-800 p-0.5 text-xs">
              <button
                onClick={() => setViewMode('pretty')}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  viewMode === 'pretty' ? 'bg-sky-500/20 text-sky-300 font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Pretty
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  viewMode === 'raw' ? 'bg-sky-500/20 text-sky-300 font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Raw
              </button>
            </div>
          )}

          {onCopyAiPrompt && (
            <button
              onClick={onCopyAiPrompt}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-xs text-sky-300 font-medium transition-colors"
              title={`复制 ${currentRequest?.name || '当前接口'} 的 AI 诊断 Prompt`}
            >
              <Bot className="w-3.5 h-3.5 text-sky-400" />
              <span>复制给 AI 诊断</span>
            </button>
          )}

          <button
            onClick={handleDownloadResponse}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition-colors"
            title="下载并保存响应体"
          >
            <Download className="w-3.5 h-3.5" />
            <span>下载</span>
          </button>

          <button
            onClick={activeTab === 'headers' ? handleCopyHeaders : handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition-colors"
            title="复制响应内容"
          >
            {(activeTab === 'headers' ? copiedHeaders : copied) ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 text-xs">已复制</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>复制</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* View Tabs & Search Bar */}
      <div className="flex items-center justify-between px-4 border-b border-slate-800/80 bg-slate-950 text-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('body')}
            className={`py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'body'
                ? 'text-sky-400 border-sky-400'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            正文 (Body)
          </button>
          <button
            onClick={() => setActiveTab('headers')}
            className={`py-2 font-medium border-b-2 transition-colors flex items-center gap-1 ${
              activeTab === 'headers'
                ? 'text-sky-400 border-sky-400'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <span>响应头 (Headers)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-400 font-mono">
              {response.headers.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('tests')}
            className={`py-2 font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'tests'
                ? 'text-sky-400 border-sky-400'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <span>断言与提取结果</span>
            {response.test_results && response.test_results.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  response.test_results.every(t => t.passed)
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {response.test_results.filter(t => t.passed).length}/{response.test_results.length}
              </span>
            )}
            {response.extracted_vars && response.extracted_vars.length > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-sky-500/20 text-sky-300 font-mono">
                {response.extracted_vars.length} 变量
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'preview'
                ? 'text-sky-400 border-sky-400'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            HTML预览
          </button>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'body' && (
            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-slate-500 absolute left-2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="过滤/查找响应..."
                className="bg-slate-900 border border-slate-800 rounded pl-6 pr-6 py-0.5 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono w-36"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {activeTab === 'body' && (
            <span className="text-[11px] font-mono text-slate-500">
              {lineCount} 行 · {response.is_json ? 'JSON 语法' : '纯文本'}
            </span>
          )}
        </div>
      </div>

      {/* Response Content Panels */}
      <div className="flex-1 overflow-auto p-3 font-mono text-xs select-text">
        {activeTab === 'body' && (
          <pre className="text-slate-200 leading-relaxed whitespace-pre-wrap break-all font-mono">
            {searchQuery
              ? formattedBody
                  .split('\n')
                  .filter(l => l.toLowerCase().includes(searchQuery.toLowerCase()))
                  .join('\n') || `(未找到包含 "${searchQuery}" 的行)`
              : formattedBody || '(空响应体)'}
          </pre>
        )}

        {activeTab === 'headers' && (
          <div className="border border-slate-800 rounded-md overflow-hidden select-text">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2 w-1/3">响应头名称 (Header)</th>
                  <th className="px-3 py-2">响应头内容 (Value)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/60">
                {response.headers.map((h, i) => (
                  <tr key={i} className="hover:bg-slate-900/40">
                    <td className="px-3 py-1.5 font-semibold text-sky-300 font-mono">{h.key}</td>
                    <td className="px-3 py-1.5 text-slate-200 font-mono break-all">{h.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'tests' && (
          <div className="space-y-4 max-w-3xl font-sans">
            {/* Assertions list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  <span>断言测试运行结果</span>
                </span>
                {response.test_results && response.test_results.length > 0 && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    共运行 {response.test_results.length} 项断言 · 通过率{' '}
                    {Math.round(
                      (response.test_results.filter(t => t.passed).length / response.test_results.length) * 100
                    )}
                    %
                  </span>
                )}
              </div>

              {(!response.test_results || response.test_results.length === 0) ? (
                <div className="p-6 bg-slate-900/60 rounded-lg border border-slate-800 text-center text-slate-500">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                  <p>当前请求未配置断言规则</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    在上方请求编辑器的“断言与测试”选项卡中添加状态码、耗时或 JSON 校验即可自动检测
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {response.test_results.map((tr, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border flex items-start justify-between gap-3 ${
                        tr.passed
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                          : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {tr.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                        )}
                        <div>
                          <div className="font-semibold text-xs text-slate-200">
                            {tr.assertion.name || tr.assertion.type}
                          </div>
                          <div className={`text-[11px] mt-0.5 ${tr.passed ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {tr.message}
                          </div>
                          {tr.actual && !tr.passed && (
                            <div className="text-[10px] text-slate-400 font-mono mt-1 bg-slate-900/80 p-1.5 rounded">
                              实际值: {tr.actual} | 期望值: {tr.assertion.expected}
                            </div>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold ${
                          tr.passed
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {tr.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Extracted Variables list */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="font-semibold text-xs text-slate-300 flex items-center gap-1.5">
                <Variable className="w-4 h-4 text-sky-400" />
                <span>已自动提取并同步的环境变量</span>
              </span>

              {(!response.extracted_vars || response.extracted_vars.length === 0) ? (
                <div className="p-4 bg-slate-900/40 rounded-lg border border-slate-800/80 text-center text-slate-500 text-[11px]">
                  未从本次响应中提取环境变量（可在请求编辑器配置“环境变量自动提取”）
                </div>
              ) : (
                <div className="space-y-2">
                  {response.extracted_vars.map((ev, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-sky-950/20 border border-sky-500/30 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {`{{${ev.key}}}`}
                        </span>
                        <span className="text-slate-400">=</span>
                        <span className="font-mono text-slate-200 select-all truncate max-w-xs">{ev.value}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({ev.source})</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        ✓ 已持久化写入当前环境
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="w-full h-full bg-white rounded-md overflow-hidden border border-slate-700">
            <iframe
              title="HTML Preview"
              srcDoc={response.body}
              sandbox=""
              className="w-full h-full min-h-[300px]"
            />
          </div>
        )}
      </div>
    </div>
  );
};
