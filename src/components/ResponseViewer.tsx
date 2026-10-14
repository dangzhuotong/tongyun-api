import React, { useState, useMemo } from 'react';
import {
  Check,
  Copy,
  Clock,
  HardDrive,
  Terminal,
  Download,
  Search,
  X,
  CheckCircle2,
  XCircle,
  Variable,
  CheckSquare,
  Zap
} from 'lucide-react';
import { ResponsePayload, RequestData, HistoryItem } from '../types/api';
import { ResponseDiffViewer } from './ResponseDiffViewer';
import { tokenizeJsonLine } from '../utils/jsonTokenizer';

const JsonLineHighlight: React.FC<{ line: string; searchQuery: string }> = ({ line, searchQuery }) => {
  const highlightQuery = (text: string) => {
    if (!searchQuery) return text;
    const parts = text.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-amber-400/30 text-amber-200 px-0.5 rounded font-bold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const tokens = tokenizeJsonLine(line);

  return (
    <div className="leading-relaxed font-mono">
      {tokens.map((token, idx) => {
        let colorClass = 'text-[var(--ty-text)]';
        switch (token.type) {
          case 'key':
            colorClass = 'text-[var(--ty-token-key)] font-medium';
            break;
          case 'string':
            colorClass = 'text-[var(--ty-token-string)]';
            break;
          case 'number':
            colorClass = 'text-[var(--ty-token-number)] font-mono font-semibold';
            break;
          case 'boolean':
            colorClass = 'text-[var(--ty-token-boolean)] font-bold';
            break;
          case 'null':
            colorClass = 'text-[var(--ty-token-null)] italic';
            break;
          case 'variable':
            colorClass = 'text-[var(--ty-token-variable)] font-bold bg-[var(--ty-token-var-bg)] px-1 py-0.2 rounded border border-[var(--ty-token-variable)]/30';
            break;
          case 'punctuation':
            colorClass = 'text-[var(--ty-token-punctuation)]';
            break;
          default:
            colorClass = 'text-[var(--ty-text)]';
            break;
        }

        return (
          <span key={idx} className={colorClass}>
            {highlightQuery(token.value)}
          </span>
        );
      })}
    </div>
  );
};

interface ResponseViewerProps {
  response: ResponsePayload | null;
  previousResponse?: ResponsePayload | null;
  history?: HistoryItem[];
  isSending: boolean;
  currentRequest?: RequestData;
  onCopyAiPrompt?: () => void;
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({
  response,
  previousResponse,
  history = [],
  isSending,
}) => {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'tests' | 'diff' | 'preview'>('body');
  const [viewMode, setViewMode] = useState<'pretty' | 'raw'>('pretty');
  const [copied, setCopied] = useState(false);
  const [copiedHeaders, setCopiedHeaders] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [headerFilter, setHeaderFilter] = useState('');
  const [copiedHeaderIdx, setCopiedHeaderIdx] = useState<number | null>(null);

  const formattedBody = useMemo(() => {
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
  }, [response, viewMode]);

  const bodyLines = useMemo(() => {
    if (!formattedBody) return [];
    return formattedBody.split('\n');
  }, [formattedBody]);

  const lineCount = bodyLines.length;

  const displayedLines = useMemo(() => {
    return bodyLines
      .map((line, idx) => ({
        lineNum: idx + 1,
        text: line,
        matches: searchQuery ? line.toLowerCase().includes(searchQuery.toLowerCase()) : true,
      }))
      .filter(item => item.matches);
  }, [bodyLines, searchQuery]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-[var(--ty-matcha)] bg-[var(--ty-matcha-tint)] border border-[var(--ty-matcha-soft)]';
    if (status >= 300 && status < 400) return 'text-[var(--ty-sky)] bg-[var(--ty-sky-tint)] border border-[var(--ty-sky-soft)]';
    if (status >= 400 && status < 500) return 'text-[var(--ty-honey)] bg-[var(--ty-honey-tint)] border border-[var(--ty-honey-soft)]';
    return 'text-[var(--ty-peach)] bg-[var(--ty-peach-tint)] border border-[var(--ty-peach-soft)]';
  };

  const getStatusMeaning = (status: number) => {
    switch (status) {
      case 200: return 'OK';
      case 201: return 'Created';
      case 204: return 'No Content';
      case 301: return 'Moved Permanently';
      case 302: return 'Found';
      case 304: return 'Not Modified';
      case 400: return 'Bad Request';
      case 401: return 'Unauthorized';
      case 403: return 'Forbidden';
      case 404: return 'Not Found';
      case 405: return 'Method Not Allowed';
      case 422: return 'Unprocessable Entity';
      case 429: return 'Too Many Requests';
      case 500: return 'Internal Server Error';
      case 502: return 'Bad Gateway';
      case 503: return 'Service Unavailable';
      case 504: return 'Gateway Timeout';
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


  if (isSending) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--ty-surface-sunken)] p-6 text-center select-none">
        <div className="relative mb-3">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--ty-matcha)]/20 border-t-[var(--ty-matcha)] animate-spin" />
        </div>
        <div className="text-xs font-medium text-[var(--ty-text)]">正在发送请求...</div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--ty-bg)] p-6 text-center select-none text-[var(--ty-text-subtle)]">
        <div className="w-12 h-12 rounded-[var(--ty-radius-md)] bg-white dark:bg-[var(--ty-surface)] border border-[var(--ty-border)] flex items-center justify-center mb-3 shadow-2xs">
          <Terminal className="w-6 h-6 text-[var(--ty-matcha)]" />
        </div>
        <h3 className="text-xs font-semibold text-[var(--ty-text)]">等待执行请求</h3>
        <p className="text-[11px] text-[var(--ty-text-subtle)] max-w-xs mt-1">
          点击右上角“发送”按钮或使用快捷键启动接口调试
        </p>

        {/* Shortcuts card */}
        <div className="mt-5 grid grid-cols-2 gap-1.5 text-left text-xs bg-white dark:bg-[var(--ty-surface)] p-3 rounded-[var(--ty-radius-sm)] border border-[var(--ty-border)] shadow-xs max-w-sm w-full">
          <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--ty-surface-sunken)] rounded-[var(--ty-radius-xs,4px)] border border-[var(--ty-border)]/50">
            <span className="text-[var(--ty-text-muted)] text-[11px]">发送请求</span>
            <kbd className="font-mono text-[10px] bg-white dark:bg-[var(--ty-surface-raised)] text-[var(--ty-text)] px-1.5 py-0.2 rounded border border-[var(--ty-border)] shadow-2xs">
              Ctrl + Enter
            </kbd>
          </div>
          <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--ty-surface-sunken)] rounded-[var(--ty-radius-xs,4px)] border border-[var(--ty-border)]/50">
            <span className="text-[var(--ty-text-muted)] text-[11px]">保存接口纯文本</span>
            <kbd className="font-mono text-[10px] bg-white dark:bg-[var(--ty-surface-raised)] text-[var(--ty-text)] px-1.5 py-0.2 rounded border border-[var(--ty-border)] shadow-2xs">
              Ctrl + S
            </kbd>
          </div>
          <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--ty-surface-sunken)] rounded-[var(--ty-radius-xs,4px)] border border-[var(--ty-border)]/50">
            <span className="text-[var(--ty-text-muted)] text-[11px]">环境变量代换</span>
            <code className="font-mono text-[10px] text-[var(--ty-matcha)]">{"{{baseUrl}}"}</code>
          </div>
          <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--ty-surface-sunken)] rounded-[var(--ty-radius-xs,4px)] border border-[var(--ty-border)]/50">
            <span className="text-[var(--ty-text-muted)] text-[11px]">格式标准</span>
            <span className="font-mono text-[10px] text-[var(--ty-honey)]">IntelliJ .http</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-[var(--ty-surface-sunken)] overflow-hidden select-none">
      {/* Response Header Status Bar (36px compact) */}
      <div className="h-9 px-3 border-b border-[var(--ty-border)] bg-[var(--ty-nav-bg)]/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Status Badge */}
          <div
            title={getStatusMeaning(response.status)}
            className={`ty-pressable animate-fade-in px-2.5 py-0.5 rounded-[var(--ty-radius-xs,4px)] font-mono text-[11px] font-bold flex items-center gap-1.5 shadow-2xs ${getStatusColor(
              response.status
            )}`}
          >
            <span>{response.status || 'ERROR'}</span>
            {response.status_text && <span>{response.status_text}</span>}
          </div>

          {/* Time Badge */}
          <div className="ty-pressable flex items-center gap-1.5 text-[11px] font-mono text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] transition-colors cursor-default" title="网络往返耗时 (RTT)">
            <Clock className="w-3 h-3 text-[var(--ty-text-subtle)]" />
            <span>{response.time_ms} ms</span>
          </div>

          {/* Size Badge */}
          <div className="ty-pressable flex items-center gap-1 text-[11px] font-mono text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] transition-colors cursor-default" title="响应体大小">
            <HardDrive className="w-3 h-3 text-[var(--ty-text-subtle)]" />
            <span>{formatSize(response.size_bytes)}</span>
          </div>

          {/* Tests Badge if ran */}
          {response.test_results && response.test_results.length > 0 && (
            <div
              className={`ty-pressable px-2 py-0.2 rounded-[var(--ty-radius-xs,4px)] border font-mono text-[10px] font-medium flex items-center gap-1 ${
                response.test_results.every(t => t.passed)
                  ? 'text-[var(--ty-matcha)] bg-[var(--ty-matcha-tint)] border border-[var(--ty-matcha-soft)]'
                  : 'text-[var(--ty-peach)] bg-[var(--ty-peach-tint)] border border-[var(--ty-peach-soft)]'
              }`}
            >
              {response.test_results.every(t => t.passed) ? (
                <CheckCircle2 className="w-3 h-3 text-[var(--ty-matcha)]" />
              ) : (
                <XCircle className="w-3 h-3 text-[var(--ty-peach)]" />
              )}
              <span>
                断言: {response.test_results.filter(t => t.passed).length}/{response.test_results.length}
              </span>
            </div>
          )}

          {/* Extracted Vars Badge */}
          {response.extracted_vars && response.extracted_vars.length > 0 && (
            <div className="ty-pressable px-2 py-0.2 rounded-[var(--ty-radius-xs,4px)] border border-[var(--ty-honey)]/30 bg-[var(--ty-honey-soft)] text-[var(--ty-honey)] font-mono text-[10px] font-medium flex items-center gap-1">
              <Zap className="w-3 h-3 text-[var(--ty-honey)]" />
              <span>提取 {response.extracted_vars.length} 变量</span>
            </div>
          )}
        </div>

        {/* Right actions: Copy & Modes & Download */}
        <div className="flex items-center gap-1.5">
          {activeTab === 'body' && (
            <div className="flex items-center bg-[var(--ty-surface-raised)] rounded-[var(--ty-radius-xs,4px)] border border-[var(--ty-border)] p-0.5 text-xs">
              <button
                onClick={() => setViewMode('pretty')}
                className={`ty-pressable px-2 py-0.5 rounded-[2px] text-[10px] font-mono transition-all ${
                  viewMode === 'pretty' ? 'bg-[var(--ty-surface)] text-[var(--ty-matcha)] font-medium shadow-xs' : 'text-[var(--ty-text-muted)] hover:text-[var(--ty-text)]'
                }`}
              >
                Pretty
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`ty-pressable px-2 py-0.5 rounded-[2px] text-[10px] font-mono transition-all ${
                  viewMode === 'raw' ? 'bg-[var(--ty-surface)] text-[var(--ty-matcha)] font-medium shadow-xs' : 'text-[var(--ty-text-muted)] hover:text-[var(--ty-text)]'
                }`}
              >
                Raw
              </button>
            </div>
          )}

          <button
            onClick={handleDownloadResponse}
            className="ty-btn-ghost ty-pressable flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] transition-all cursor-pointer"
            title="下载并保存响应体"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="text-[11px]">下载</span>
          </button>

          <button
            onClick={activeTab === 'headers' ? handleCopyHeaders : handleCopy}
            className="ty-btn-ghost ty-pressable flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] transition-all cursor-pointer"
            title="复制响应内容"
          >
            {(activeTab === 'headers' ? copiedHeaders : copied) ? (
              <>
                <Check className="w-3.5 h-3.5 text-[var(--ty-matcha)] scale-110 transition-transform" />
                <span className="text-[var(--ty-matcha)] text-[11px] font-medium">已复制</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="text-[11px]">复制</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* View Tabs & Search Bar (32px) */}
      <div className="h-8.5 flex items-center justify-between px-3 border-b border-[var(--ty-border)] bg-[var(--ty-nav-bg)]/40 text-xs">
        <div className="flex items-center gap-1 h-full">
          {[
            { id: 'body', label: '正文' },
            { id: 'headers', label: '响应头', count: response.headers.length },
            { id: 'tests', label: '断言', badge: response.test_results?.length ? `${response.test_results.filter(t => t.passed).length}/${response.test_results.length}` : undefined },
            { id: 'diff', label: '响应对比', badge: previousResponse ? '有基准' : undefined },
            { id: 'preview', label: 'HTML 预览' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`ty-pressable h-full px-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-all ${
                activeTab === tab.id
                  ? 'text-[var(--ty-text)] border-[var(--ty-matcha)] font-semibold'
                  : 'text-[var(--ty-text-muted)] border-transparent hover:text-[var(--ty-text)]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/[0.05] dark:bg-white/[0.07] text-[var(--ty-text-muted)] font-mono">
                  {tab.count}
                </span>
              )}
              {tab.badge && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  response.test_results?.every(t => t.passed)
                    ? 'bg-[var(--ty-matcha-tint)] text-[var(--ty-matcha)] font-medium'
                    : 'bg-[var(--ty-peach-tint)] text-[var(--ty-peach)] font-medium'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'body' && (
            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-[var(--ty-text-subtle)] absolute left-2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="过滤响应..."
                className="bg-[var(--ty-surface-raised)] border border-[var(--ty-border)] rounded-[var(--ty-radius-xs,4px)] pl-6 pr-5 py-0.5 text-[11px] text-[var(--ty-text)] placeholder-[var(--ty-text-subtle)] focus:outline-none focus:border-[var(--ty-matcha)] font-mono w-32"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {activeTab === 'body' && (
            <span className="text-[10px] font-mono text-[var(--ty-text-subtle)]">
              {searchQuery ? `${displayedLines.length}/${lineCount} 行匹配` : `${lineCount} 行`} · {response.is_json ? 'JSON' : 'TEXT'}
            </span>
          )}
        </div>
      </div>

      {/* Response Content Panels */}
      <div className="flex-1 overflow-auto font-mono text-xs select-text">
        {activeTab === 'body' && (
          <div className="flex min-h-full">
            {/* IntelliJ Line Number Gutter */}
            <div className="select-none text-right pr-3 pl-2 py-2 text-[var(--ty-text-subtle)] font-mono text-[11px] border-r border-[var(--ty-border)]/50 bg-[var(--ty-surface-raised)]/20 shrink-0 min-w-[3rem]">
              {displayedLines.map((item) => (
                <div key={item.lineNum} className="leading-relaxed opacity-60">
                  {item.lineNum}
                </div>
              ))}
            </div>

            {/* Code Content Area */}
            <div className="flex-1 p-2 pl-3 overflow-x-auto">
              {displayedLines.length === 0 ? (
                <div className="text-[var(--ty-text-subtle)] py-4 text-center">
                  (未找到包含 "{searchQuery}" 的响应内容)
                </div>
              ) : (
                <div className="whitespace-pre font-mono text-xs">
                  {displayedLines.map((item) =>
                    response.is_json && viewMode === 'pretty' ? (
                      <JsonLineHighlight key={item.lineNum} line={item.text} searchQuery={searchQuery} />
                    ) : (
                      <div key={item.lineNum} className="leading-relaxed text-[var(--ty-text)] font-mono">
                        {item.text}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="relative flex items-center w-64">
                <Search className="w-3 h-3 text-[var(--ty-text-subtle)] absolute left-2 pointer-events-none" />
                <input
                  type="text"
                  value={headerFilter}
                  onChange={e => setHeaderFilter(e.target.value)}
                  placeholder="过滤响应头 (Key 或 Value)..."
                  className="bg-[var(--ty-surface-raised)] border border-[var(--ty-border)] rounded-[var(--ty-radius-xs,4px)] pl-6 pr-5 py-0.5 text-[11px] text-[var(--ty-text)] placeholder-[var(--ty-text-subtle)] focus:outline-none focus:border-[var(--ty-matcha)] font-mono w-full"
                />
                {headerFilter && (
                  <button
                    onClick={() => setHeaderFilter('')}
                    className="absolute right-1 text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <span className="text-[10px] font-mono text-[var(--ty-text-subtle)]">
                共 {response.headers.length} 项响应头
              </span>
            </div>

            <div className="border border-[var(--ty-border)] rounded-[var(--ty-radius-sm)] overflow-hidden bg-[var(--ty-surface-sunken)]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--ty-surface-raised)] text-[var(--ty-text-muted)] border-b border-[var(--ty-border)]">
                  <tr>
                    <th className="px-3 py-1.5 w-1/3">响应头名称 (Header)</th>
                    <th className="px-3 py-1.5">响应头内容 (Value)</th>
                    <th className="px-2 py-1.5 w-12 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ty-border)]/50">
                  {response.headers
                    .filter(h =>
                      !headerFilter
                        ? true
                        : h.key.toLowerCase().includes(headerFilter.toLowerCase()) ||
                          h.value.toLowerCase().includes(headerFilter.toLowerCase())
                    )
                    .map((h, i) => (
                      <tr key={i} className="hover:bg-[var(--ty-surface-raised)]/30 transition-colors group">
                        <td className="px-3 py-1.5 font-semibold text-[var(--ty-matcha)] font-mono">{h.key}</td>
                        <td className="px-3 py-1.5 text-[var(--ty-text)] font-mono break-all select-all">{h.value}</td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${h.key}: ${h.value}`);
                              setCopiedHeaderIdx(i);
                              setTimeout(() => setCopiedHeaderIdx(null), 1500);
                            }}
                            className="p-1 rounded text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)] opacity-0 group-hover:opacity-100 transition-opacity"
                            title="复制此 Header"
                          >
                            {copiedHeaderIdx === i ? <Check className="w-3 h-3 text-[var(--ty-matcha)]" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'tests' && (
          <div className="p-3 space-y-4 max-w-3xl font-sans">
            {/* Assertions list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--ty-text)] flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-[var(--ty-matcha)]" />
                  <span>断言测试运行结果</span>
                </span>
                {response.test_results && response.test_results.length > 0 && (
                  <span className="text-[11px] text-[var(--ty-text-muted)] font-mono">
                    共运行 {response.test_results.length} 项断言 · 通过率{' '}
                    {Math.round(
                      (response.test_results.filter(t => t.passed).length / response.test_results.length) * 100
                    )}
                    %
                  </span>
                )}
              </div>

              {(!response.test_results || response.test_results.length === 0) ? (
                <div className="p-6 bg-[var(--ty-surface)] rounded-[var(--ty-radius-sm)] border border-[var(--ty-border)] text-center text-[var(--ty-text-subtle)]">
                  <CheckCircle2 className="w-6 h-6 mx-auto text-[var(--ty-text-subtle)] mb-2 opacity-50" />
                  <p className="text-xs">当前请求未配置断言规则</p>
                  <p className="text-[11px] text-[var(--ty-text-subtle)] mt-1">
                    在上方请求编辑器的“断言”选项卡中添加状态码、耗时或 JSON 校验即可自动检测
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {response.test_results.map((tr, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-[var(--ty-radius-sm)] border flex flex-col gap-2 transition-all ${
                        tr.passed
                          ? 'bg-[var(--ty-matcha-soft)] border-[var(--ty-matcha)]/40 text-[var(--ty-text)]'
                          : 'bg-[var(--ty-peach-soft)] border-[var(--ty-peach)]/40 text-[var(--ty-text)] shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          {tr.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-[var(--ty-matcha)] mt-0.5 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-[var(--ty-peach)] mt-0.5 shrink-0" />
                          )}
                          <div>
                            <div className="font-semibold text-xs text-[var(--ty-text)]">
                              {tr.assertion.name || tr.assertion.type}
                            </div>
                            <div className={`text-[11px] mt-0.5 ${tr.passed ? 'text-[var(--ty-matcha)]' : 'text-[var(--ty-peach)]'}`}>
                              {tr.message}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-[var(--ty-radius-xs,4px)] font-bold border shrink-0 ${
                            tr.passed
                              ? 'bg-[var(--ty-surface)] text-[var(--ty-matcha)] border-[var(--ty-matcha)]/40'
                              : 'bg-[var(--ty-surface)] text-[var(--ty-peach)] border-[var(--ty-peach)]/40'
                          }`}
                        >
                          {tr.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>

                      {/* 失败用例期望与实际差分卡 (Assertion Failure Diff Card) */}
                      {!tr.passed && (
                        <div className="mt-1 pt-2 border-t border-[var(--ty-border)]/50 animate-fade-in">
                          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                            <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20">
                              <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mb-1 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                                实际接收 (Actual)
                              </div>
                              <div className="text-rose-800 dark:text-rose-200 break-all select-all whitespace-pre-wrap font-mono leading-relaxed bg-[var(--ty-surface)]/60 p-1.5 rounded border border-rose-500/15">
                                {tr.actual !== undefined && tr.actual !== '' ? tr.actual : '(空值 / 未捕获)'}
                              </div>
                            </div>
                            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mb-1 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                期望判定 (Expected)
                              </div>
                              <div className="text-emerald-800 dark:text-emerald-200 break-all select-all whitespace-pre-wrap font-mono leading-relaxed bg-[var(--ty-surface)]/60 p-1.5 rounded border border-emerald-500/15">
                                {tr.assertion.expected}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Extracted Variables list */}
            <div className="space-y-2 pt-2 border-t border-[var(--ty-border)]">
              <span className="font-semibold text-xs text-[var(--ty-text)] flex items-center gap-1.5">
                <Variable className="w-4 h-4 text-[var(--ty-matcha)]" />
                <span>已自动提取并同步的环境变量</span>
              </span>

              {(!response.extracted_vars || response.extracted_vars.length === 0) ? (
                <div className="p-4 bg-[var(--ty-surface)] rounded-[var(--ty-radius-sm)] border border-[var(--ty-border)] text-center text-[var(--ty-text-subtle)] text-[11px]">
                  未从本次响应中提取环境变量（可在请求编辑器配置“环境变量自动提取”）
                </div>
              ) : (
                <div className="space-y-2">
                  {response.extracted_vars.map((ev, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-[var(--ty-radius-sm)] bg-[var(--ty-surface)] border border-[var(--ty-border)] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[var(--ty-matcha)] font-semibold bg-[var(--ty-matcha-soft)] px-2 py-0.5 rounded border border-[var(--ty-matcha)]/30">
                          {`{{${ev.key}}}`}
                        </span>
                        <span className="text-[var(--ty-text-subtle)]">=</span>
                        <span className="font-mono text-[var(--ty-text)] select-all truncate max-w-xs">{ev.value}</span>
                        <span className="text-[10px] text-[var(--ty-text-subtle)] font-mono">({ev.source})</span>
                      </div>
                      <span className="text-[10px] text-[var(--ty-matcha)] bg-[var(--ty-matcha-soft)] px-2 py-0.5 rounded border border-[var(--ty-matcha)]/30">
                        ✓ 已持久化写入当前环境
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}



        {activeTab === 'diff' && (
          <div className="w-full h-full min-h-0 flex flex-col">
            <ResponseDiffViewer
              currentResponse={response}
              previousResponse={previousResponse}
              history={history}
            />
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="w-full h-full p-2">
            <div className="w-full h-full bg-white rounded-[var(--ty-radius-sm)] overflow-hidden border border-[var(--ty-border)]">
              <iframe
                title="HTML Preview"
                srcDoc={response.body}
                sandbox=""
                className="w-full h-full min-h-[300px]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
