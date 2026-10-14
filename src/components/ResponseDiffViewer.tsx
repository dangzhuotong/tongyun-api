import React, { useState, useMemo } from 'react';
import {
  Columns2,
  Clock,
  HardDrive,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { ResponsePayload, HistoryItem } from '../types/api';
import { computeLineDiff } from '../utils/diff';

interface ResponseDiffViewerProps {
  currentResponse: ResponsePayload;
  previousResponse?: ResponsePayload | null;
  history?: HistoryItem[];
}

export const ResponseDiffViewer: React.FC<ResponseDiffViewerProps> = ({
  currentResponse,
  previousResponse,
  history = [],
}) => {
  // 可选的基准响应来源
  const [selectedBaselineId, setSelectedBaselineId] = useState<string>('previous');
  const [onlyShowDiff, setOnlyShowDiff] = useState(false);

  // 解析选中的基准响应
  const baselineResponse: ResponsePayload | null = useMemo(() => {
    if (selectedBaselineId === 'previous') {
      return previousResponse || null;
    }
    const item = history.find(h => h.id === selectedBaselineId);
    return item?.response || null;
  }, [selectedBaselineId, previousResponse, history]);

  // 计算文本差分
  const diffSummary = useMemo(() => {
    if (!baselineResponse) return null;
    return computeLineDiff(baselineResponse.body || '', currentResponse.body || '');
  }, [baselineResponse, currentResponse]);

  // 过滤后的行列表
  const displayedItems = useMemo(() => {
    if (!diffSummary) return [];
    if (!onlyShowDiff) return diffSummary.items;
    return diffSummary.items.filter(item => item.type !== 'equal');
  }, [diffSummary, onlyShowDiff]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // 如果没有基准可对比
  if (!baselineResponse) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-[var(--ty-surface-sunken)] select-none">
        <div className="w-12 h-12 rounded-xl bg-[#FAF8F5] dark:bg-[var(--ty-surface)] border border-[var(--ty-border)] flex items-center justify-center mb-3 shadow-2xs">
          <Columns2 className="w-6 h-6 text-[var(--ty-matcha)]" />
        </div>
        <h3 className="text-xs font-semibold text-[var(--ty-text)]">暂无历史对比基准</h3>
        <p className="text-[11px] text-[var(--ty-text-subtle)] max-w-sm mt-1">
          再次发送一次请求，或切换环境后重新请求，系统将自动对比两次响应的指标与正文逐行差异。
        </p>

        {history.length > 0 && (
          <div className="mt-4 flex items-center gap-2 text-xs">
            <span className="text-[11px] text-[var(--ty-text-muted)]">或从发送历史中选择基准:</span>
            <select
              value={selectedBaselineId}
              onChange={e => setSelectedBaselineId(e.target.value)}
              className="bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-md px-2.5 py-1 text-xs text-[var(--ty-text)] outline-none shadow-2xs font-mono"
            >
              <option value="previous">暂无上一次响应</option>
              {history.map(h => (
                <option key={h.id} value={h.id}>
                  {h.method} {h.status} ({h.time_ms}ms) - {new Date(h.timestamp).toLocaleTimeString()}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  }

  // 状态差异判定
  const statusChanged = baselineResponse.status !== currentResponse.status;
  const timeDelta = currentResponse.time_ms - baselineResponse.time_ms;
  const sizeDelta = currentResponse.size_bytes - baselineResponse.size_bytes;

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-[var(--ty-surface-sunken)] overflow-hidden text-xs">
      {/* 顶部指标对比条 (Metrics Diff Bar) */}
      <div className="p-3 bg-[var(--ty-nav-bg)]/40 border-b border-[var(--ty-border)] flex items-center justify-between shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-4">
          {/* 基准选择器 */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-[11px] text-[var(--ty-text-muted)] font-sans">对比基准:</span>
            <select
              value={selectedBaselineId}
              onChange={e => setSelectedBaselineId(e.target.value)}
              className="bg-white dark:bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-md px-2 py-0.5 text-[11px] text-[var(--ty-text)] outline-none shadow-2xs font-mono"
            >
              {previousResponse && (
                <option value="previous">上一次请求响应 ({previousResponse.status} · {previousResponse.time_ms}ms)</option>
              )}
              {history.map(h => (
                <option key={h.id} value={h.id}>
                  历史: {h.method} {h.status} ({h.time_ms}ms) · {new Date(h.timestamp).toLocaleTimeString()}
                </option>
              ))}
            </select>
          </div>

          <div className="h-4 w-px bg-[var(--ty-border)]" />

          {/* 状态码对比 */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="text-[var(--ty-text-subtle)] font-sans text-[10px]">状态:</span>
            <span className="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 font-bold">
              {baselineResponse.status}
            </span>
            <ArrowRight className="w-3 h-3 text-[var(--ty-text-subtle)]" />
            <span className={`px-1.5 py-0.2 rounded font-bold ${
              statusChanged
                ? 'bg-[var(--ty-peach-tint)] text-[var(--ty-peach)] border border-[var(--ty-peach-soft)]'
                : 'bg-[var(--ty-matcha-tint)] text-[var(--ty-matcha)] border border-[var(--ty-matcha-soft)]'
            }`}>
              {currentResponse.status}
            </span>
          </div>

          {/* 耗时对比 */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <Clock className="w-3 h-3 text-[var(--ty-text-subtle)]" />
            <span>{baselineResponse.time_ms}ms</span>
            <ArrowRight className="w-3 h-3 text-[var(--ty-text-subtle)]" />
            <span className="font-bold">{currentResponse.time_ms}ms</span>
            <span className={`text-[10px] px-1 rounded ${
              timeDelta > 0
                ? 'text-[var(--ty-peach)] bg-[var(--ty-peach-tint)]'
                : 'text-[var(--ty-matcha)] bg-[var(--ty-matcha-tint)]'
            }`}>
              {timeDelta > 0 ? `+${timeDelta}ms` : `${timeDelta}ms`}
            </span>
          </div>

          {/* 体积对比 */}
          <div className="flex items-center gap-1.5 font-mono text-[11px] hidden sm:flex">
            <HardDrive className="w-3 h-3 text-[var(--ty-text-subtle)]" />
            <span>{formatSize(baselineResponse.size_bytes)}</span>
            <ArrowRight className="w-3 h-3 text-[var(--ty-text-subtle)]" />
            <span>{formatSize(currentResponse.size_bytes)}</span>
            {sizeDelta !== 0 && (
              <span className="text-[10px] text-[var(--ty-text-subtle)]">
                ({sizeDelta > 0 ? `+${sizeDelta}B` : `${sizeDelta}B`})
              </span>
            )}
          </div>
        </div>

        {/* 差异统计与过滤开关 */}
        <div className="flex items-center gap-2">
          {diffSummary && (
            <div className="flex items-center gap-1 font-mono text-[10px]">
              {diffSummary.isIdentical ? (
                <span className="text-[var(--ty-matcha)] bg-[var(--ty-matcha-tint)] px-2 py-0.5 rounded-full border border-[var(--ty-matcha-soft)] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>正文完全一致</span>
                </span>
              ) : (
                <div className="flex items-center gap-1">
                  {diffSummary.modifiedCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-[var(--ty-honey-tint)] text-[var(--ty-honey)] border border-[var(--ty-honey-soft)]">
                      {diffSummary.modifiedCount} 处变更
                    </span>
                  )}
                  {diffSummary.addedCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-[var(--ty-matcha-tint)] text-[var(--ty-matcha)] border border-[var(--ty-matcha-soft)]">
                      +{diffSummary.addedCount} 新增
                    </span>
                  )}
                  {diffSummary.deletedCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-[var(--ty-peach-tint)] text-[var(--ty-peach)] border border-[var(--ty-peach-soft)]">
                      -{diffSummary.deletedCount} 删除
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <label className="ty-pressable flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-[var(--ty-surface)] border border-[var(--ty-border)] text-xs text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] cursor-pointer shadow-2xs select-none">
            <input
              type="checkbox"
              checked={onlyShowDiff}
              onChange={e => setOnlyShowDiff(e.target.checked)}
              className="accent-[var(--ty-matcha)] rounded"
            />
            <span className="text-[11px]">仅看差异行</span>
          </label>
        </div>
      </div>

      {/* 左右分栏代码对比区 (Side-by-side Columns) */}
      <div className="flex-1 flex overflow-hidden font-mono text-xs select-text">
        {/* 左侧：基准响应 */}
        <div className="flex-1 flex flex-col border-r border-[var(--ty-border)] overflow-hidden">
          <div className="h-6 px-3 bg-[#FAF8F5] dark:bg-[var(--ty-surface-raised)] border-b border-[var(--ty-border)] flex items-center justify-between text-[10px] text-[var(--ty-text-subtle)] shrink-0 font-sans font-medium">
            <span>基准响应 (Baseline / Previous)</span>
            <span className="font-mono">{baselineResponse.status} OK</span>
          </div>

          <div className="flex-1 overflow-auto p-2">
            {displayedItems.length === 0 ? (
              <div className="text-center py-6 text-[var(--ty-text-subtle)]">
                (无显示内容)
              </div>
            ) : (
              displayedItems.map((item, idx) => {
                let bgClass = 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]';
                if (item.type === 'delete') {
                  bgClass = 'bg-[#FCF2F0] dark:bg-[#2D1F1C] text-[#A34E36] font-medium';
                } else if (item.type === 'modify') {
                  bgClass = 'bg-[#FCF2F0]/80 dark:bg-[#2D1F1C]/80 text-[#A34E36]';
                }

                return (
                  <div key={idx} className={`flex items-start leading-relaxed px-1.5 py-0.2 rounded-xs ${bgClass}`}>
                    <span className="w-8 shrink-0 text-right pr-2 text-[var(--ty-text-subtle)] select-none opacity-50 font-mono text-[10px]">
                      {item.oldLineNumber || ''}
                    </span>
                    <span className="w-4 shrink-0 text-center select-none font-bold">
                      {item.type === 'delete' || item.type === 'modify' ? '-' : ' '}
                    </span>
                    <pre className="flex-1 whitespace-pre font-mono text-xs overflow-x-auto m-0">
                      {item.oldContent || ''}
                    </pre>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 右侧：当前最新响应 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-6 px-3 bg-[#FAF8F5] dark:bg-[var(--ty-surface-raised)] border-b border-[var(--ty-border)] flex items-center justify-between text-[10px] text-[var(--ty-text-subtle)] shrink-0 font-sans font-medium">
            <span>当前响应 (Current / Latest)</span>
            <span className="font-mono text-[var(--ty-matcha)]">{currentResponse.status}</span>
          </div>

          <div className="flex-1 overflow-auto p-2">
            {displayedItems.length === 0 ? (
              <div className="text-center py-6 text-[var(--ty-text-subtle)]">
                (无显示内容)
              </div>
            ) : (
              displayedItems.map((item, idx) => {
                let bgClass = 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]';
                if (item.type === 'add') {
                  bgClass = 'bg-[#F0F5F1] dark:bg-[#1F2B23] text-[#4D7C5D] font-medium';
                } else if (item.type === 'modify') {
                  bgClass = 'bg-[#F0F5F1]/80 dark:bg-[#1F2B23]/80 text-[#4D7C5D] font-medium';
                }

                return (
                  <div key={idx} className={`flex items-start leading-relaxed px-1.5 py-0.2 rounded-xs ${bgClass}`}>
                    <span className="w-8 shrink-0 text-right pr-2 text-[var(--ty-text-subtle)] select-none opacity-50 font-mono text-[10px]">
                      {item.newLineNumber || ''}
                    </span>
                    <span className="w-4 shrink-0 text-center select-none font-bold">
                      {item.type === 'add' || item.type === 'modify' ? '+' : ' '}
                    </span>
                    <pre className="flex-1 whitespace-pre font-mono text-xs overflow-x-auto m-0">
                      {item.newContent || ''}
                    </pre>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
