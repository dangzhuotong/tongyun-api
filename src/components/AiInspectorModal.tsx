import React, { useState, useMemo } from 'react';
import {
  X,
  Bot,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Download,
  Zap,
  User
} from 'lucide-react';
import { ExecutionLogItem, RequestData, ResponsePayload } from '../types/api';
import { generateAiDiagnosticPrompt } from '../utils/tester';
import { getMethodBadgeColor } from './Sidebar';

interface AiInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ExecutionLogItem[];
  onClearLogs: () => void;
  onReplayRequest: (req: RequestData, resp: ResponsePayload) => void;
  showToast: (msg: string) => void;
}

export const AiInspectorModal: React.FC<AiInspectorModalProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs,
  onReplayRequest,
  showToast,
}) => {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'agent' | 'gui' | 'runner'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (sourceFilter !== 'all') {
        if (sourceFilter === 'agent' && log.source !== 'agent' && log.source !== 'cli') return false;
        if (sourceFilter === 'gui' && log.source !== 'gui') return false;
        if (sourceFilter === 'runner' && log.source !== 'runner') return false;
      }
      if (statusFilter === 'success') {
        if (log.status < 200 || log.status >= 400) return false;
      } else if (statusFilter === 'error') {
        if (log.status >= 200 && log.status < 400 && log.assertionsTotal === log.assertionsPassed) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesUrl = log.url.toLowerCase().includes(q);
        const matchesName = log.requestName.toLowerCase().includes(q);
        const matchesMethod = log.method.toLowerCase().includes(q);
        if (!matchesUrl && !matchesName && !matchesMethod) return false;
      }
      return true;
    });
  }, [logs, sourceFilter, statusFilter, searchQuery]);

  // 统计概览
  const stats = useMemo(() => {
    const total = logs.length;
    if (total === 0) return { total: 0, successRate: 100, passRate: 100, avgTime: 0 };
    const successCount = logs.filter(l => l.status >= 200 && l.status < 400).length;
    const totalAssertions = logs.reduce((acc, l) => acc + l.assertionsTotal, 0);
    const passedAssertions = logs.reduce((acc, l) => acc + l.assertionsPassed, 0);
    const totalTime = logs.reduce((acc, l) => acc + l.timeMs, 0);

    return {
      total,
      successRate: Math.round((successCount / total) * 100),
      passRate: totalAssertions > 0 ? Math.round((passedAssertions / totalAssertions) * 100) : 100,
      avgTime: Math.round(totalTime / total),
    };
  }, [logs]);

  if (!isOpen) return null;

  const handleCopyPrompt = (log: ExecutionLogItem) => {
    const prompt = generateAiDiagnosticPrompt(log.request, log.response);
    navigator.clipboard.writeText(prompt);
    setCopiedId(log.id);
    showToast('已复制 AI 诊断 Prompt 到剪贴板');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tongyun_trace_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出执行审计 Trace 文件');
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 select-none animate-modal-backdrop">
      <div className="w-full max-w-5xl h-[88vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-modal-pop">
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-100">AI 运行流与观测台 (AI Inspector)</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-300 font-mono">
                  LIVE TRACE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                实时记录 AI Agent 与桌面环境执行的每个接口请求、响应快照与断言审计
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Metric Bar */}
        <div className="grid grid-cols-4 gap-3 p-4 bg-slate-950/30 border-b border-slate-800/80 shrink-0">
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span>总执行用例数</span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-100 mt-1">{stats.total}</div>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>HTTP 响应正常率</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{stats.successRate}%</div>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>测试断言达成率</span>
            </div>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">{stats.passRate}%</div>
          </div>
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>平均响应延迟</span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-100 mt-1">{stats.avgTime} ms</div>
          </div>
        </div>

        {/* Filter & Action Toolbar */}
        <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-3 text-xs bg-slate-950/20 shrink-0">
          <div className="flex items-center gap-3">
            {/* Source switcher */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5">
              <button
                onClick={() => setSourceFilter('all')}
                className={`px-2 py-1 rounded text-[11px] transition-colors ${
                  sourceFilter === 'all' ? 'bg-sky-500 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                全部来源
              </button>
              <button
                onClick={() => setSourceFilter('agent')}
                className={`px-2 py-1 rounded text-[11px] transition-colors flex items-center gap-1 ${
                  sourceFilter === 'agent' ? 'bg-sky-500 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Bot className="w-3 h-3" />
                <span>AI Agent / CLI</span>
              </button>
              <button
                onClick={() => setSourceFilter('gui')}
                className={`px-2 py-1 rounded text-[11px] transition-colors flex items-center gap-1 ${
                  sourceFilter === 'gui' ? 'bg-sky-500 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-3 h-3" />
                <span>人类桌面操作</span>
              </button>
              <button
                onClick={() => setSourceFilter('runner')}
                className={`px-2 py-1 rounded text-[11px] transition-colors flex items-center gap-1 ${
                  sourceFilter === 'runner' ? 'bg-sky-500 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>批量跑批</span>
              </button>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1 border-l border-slate-800 pl-3">
              <span className="text-[11px] text-slate-500">状态:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 text-[11px] outline-none"
              >
                <option value="all">全部结果</option>
                <option value="success">仅成功 (2xx/3xx)</option>
                <option value="error">仅异常 / 断言失败</option>
              </select>
            </div>

            {/* Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索接口 URL 或名称..."
              className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-200 placeholder-slate-500 outline-none w-48"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              disabled={logs.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors disabled:opacity-50"
            >
              <Download className="w-3 h-3" />
              <span>导出 JSON</span>
            </button>
            <button
              onClick={onClearLogs}
              disabled={logs.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] border border-rose-500/20 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              <span>清空记录</span>
            </button>
          </div>
        </div>

        {/* Logs Feed Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16">
              <Activity className="w-10 h-10 text-slate-600 mb-2 animate-pulse" />
              <p className="text-sm">暂无符合条件的执行记录</p>
              <p className="text-xs text-slate-600 mt-1">在工作区或通过 AI 运行接口后，将在此实时捕获轨迹</p>
            </div>
          ) : (
            filteredLogs.map(log => {
              const isSuccess = log.status >= 200 && log.status < 400;
              const hasAssertionFail = log.assertionsTotal > 0 && log.assertionsPassed < log.assertionsTotal;

              return (
                <div
                  key={log.id}
                  className="bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-lg p-3 transition-colors flex items-center justify-between gap-4"
                >
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {/* Method badge */}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${getMethodBadgeColor(log.method)}`}>
                        {log.method}
                      </span>

                      {/* Request Name */}
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {log.requestName}
                      </span>

                      {/* Source badge */}
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                        {log.source === 'gui' ? <User className="w-2.5 h-2.5 text-sky-400" /> : <Bot className="w-2.5 h-2.5 text-emerald-400" />}
                        <span>{log.source === 'gui' ? '人类桌面' : log.source === 'runner' ? '批量跑批' : 'AI Agent'}</span>
                      </span>

                      {/* Time */}
                      <span className="text-[10px] text-slate-500 font-mono ml-auto">
                        {formatTime(log.timestamp)}
                      </span>
                    </div>

                    {/* URL */}
                    <div className="text-[11px] font-mono text-slate-400 truncate mb-1.5">
                      {log.url}
                    </div>

                    {/* Bottom metrics */}
                    <div className="flex items-center gap-3 text-[11px]">
                      {/* Status */}
                      <span
                        className={`font-mono font-medium px-1.5 py-0.5 rounded text-[10px] ${
                          isSuccess
                            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                            : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                        }`}
                      >
                        {log.status > 0 ? `${log.status} ${log.statusText}` : '网络连接异常'}
                      </span>

                      {/* Latency */}
                      <span className="text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{log.timeMs}ms</span>
                      </span>

                      {/* Assertions badge */}
                      {log.assertionsTotal > 0 && (
                        <span
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                            hasAssertionFail
                              ? 'text-rose-300 bg-rose-500/15 border border-rose-500/30'
                              : 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/30'
                          }`}
                        >
                          {hasAssertionFail ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          <span>断言: {log.assertionsPassed}/{log.assertionsTotal} 通过</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCopyPrompt(log)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-medium transition-colors"
                      title="复制完整 Markdown 上下文直接喂给 AI 修复排错"
                    >
                      {copiedId === log.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === log.id ? '已复制 Prompt' : '复制 AI 诊断'}</span>
                    </button>

                    <button
                      onClick={() => {
                        onReplayRequest(log.request, log.response);
                        onClose();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                      title="在主工作区打开并重放该请求"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>在工作区重放</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="h-12 px-5 border-t border-slate-800 flex items-center justify-between bg-slate-950/50 shrink-0 text-xs text-slate-400">
          <span>共记录 {logs.length} 条执行痕迹，当前展示 {filteredLogs.length} 条</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            关闭观测台
          </button>
        </div>
      </div>
    </div>
  );
};
