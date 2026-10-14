import React, { useState } from 'react';
import {
  Bot,
  MessageSquare,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Send,
  Terminal,
  X,
  History,
  RotateCcw,
} from 'lucide-react';
import { AgentTelemetry, AgentActivityItem, RequestData, ResponsePayload } from '../types/api';
import { getMethodBadgeColor } from './Sidebar';

interface AgentHudProps {
  telemetry: AgentTelemetry | null;
  activityStream: AgentActivityItem[];
  isSending: boolean;
  currentResponse: ResponsePayload | null;
  currentRequest: RequestData;
  onClearTelemetry: () => void;
  onSendFeedback: (feedbackText: string) => Promise<void>;
  showToast: (msg: string) => void;
}

export const AgentHud: React.FC<AgentHudProps> = ({
  telemetry,
  activityStream,
  isSending,
  currentResponse,
  currentRequest,
  onClearTelemetry,
  onSendFeedback,
  showToast,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [copiedHttp, setCopiedHttp] = useState(false);

  // 状态判定
  const agentName = telemetry?.agentName || 'AI Agent';
  const taskName = telemetry?.taskName || (telemetry ? '自主接口调度' : '协同网关就绪');
  const step = telemetry?.step;
  const thought = telemetry?.thought || (
    telemetry
      ? '正在进行接口联调与参数探索...'
      : '协同网关在线 (端口 4171) · 等待 Agent 发起任务、注入用例或开始测试'
  );

  const status = isSending ? 'running' : (telemetry?.status || 'idle');

  // 生成 IntelliJ 格式的 .http 请求代码
  const handleCopyHttpFormat = () => {
    const lines: string[] = [];
    lines.push(`### ${currentRequest.name || 'AI 请求'}`);
    if (currentRequest.description) {
      lines.push(`# @name ${currentRequest.name}`);
      lines.push(`// ${currentRequest.description}`);
    }
    lines.push(`${currentRequest.method} ${currentRequest.url}`);

    if (currentRequest.headers && currentRequest.headers.length > 0) {
      currentRequest.headers
        .filter(h => h.enabled && h.key)
        .forEach(h => {
          lines.push(`${h.key}: ${h.value}`);
        });
    }

    if (currentRequest.body && currentRequest.body.content && currentRequest.method !== 'GET') {
      lines.push('');
      lines.push(currentRequest.body.content);
    }

    const httpText = lines.join('\n');
    navigator.clipboard.writeText(httpText);
    setCopiedHttp(true);
    showToast('已复制标准 IntelliJ .http 文本到剪贴板！');
    setTimeout(() => setCopiedHttp(false), 2000);
  };

  // 提交人类反馈
  const handleSubmitFeedback = async () => {
    if (!feedbackInput.trim()) return;
    await onSendFeedback(feedbackInput.trim());
    setFeedbackInput('');
    setIsFeedbackOpen(false);
  };

  // 快捷反馈短语
  const presetFeedbacks = [
    '❌ 拦截失败：后端未对该字段做防空校验，请修改后端代码增加防御性断言',
    '⚠️ 耗时过长：请检查是否缺失索引，并测试优化后的响应耗时',
    '✅ 验证通过：此用例完全符合预期，请继续执行下一组边界用例',
    '🔁 请切换到 staging 环境并重新验证鉴权失效逻辑',
  ];

  return (
    <div className="bg-[var(--ty-surface)] border-b border-[var(--ty-border)] select-none shrink-0 transition-all duration-200 z-10">
      {/* HUD 主指示条 */}
      <div className="px-3 py-1.5 flex items-center justify-between gap-3 text-xs">
        {/* 左侧：Agent 身份与状态指示灯 */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 border border-[var(--ty-border)]">
            {/* 呼吸灯状态指示 */}
            <span className="relative flex h-2 w-2">
              {status === 'running' ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ty-matcha)] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--ty-matcha)]"></span>
                </>
              ) : status === 'error' ? (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--ty-peach)]"></span>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--ty-sky)]"></span>
              )}
            </span>

            <Bot className="w-3.5 h-3.5 text-[var(--ty-sky)]" />
            <span className="font-semibold text-[11px] text-[var(--ty-text)] font-mono">
              {agentName}
            </span>
          </div>

          {/* 任务名称 */}
          <div className="flex items-center gap-1">
            <span className="px-2 py-0.5 rounded bg-[var(--ty-sky-tint)] text-[var(--ty-sky)] border border-[var(--ty-sky-soft)] text-[10px] font-medium font-sans">
              {taskName}
            </span>

            {step && (
              <span className="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[10px] text-[var(--ty-text-subtle)] font-mono font-medium">
                {step}
              </span>
            )}

            {telemetry && (
              <button
                onClick={onClearTelemetry}
                title="重置当前态势回待命状态"
                className="p-1 rounded text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>

        {/* 中间核心：AI 意图与思考气泡 (Live Thought / Intent) */}
        {isExpanded ? (
          <div className="flex-1 flex items-center min-w-0 bg-[#FAF8F5] dark:bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)]/80 rounded-md px-2.5 py-1 text-xs shadow-2xs group relative">
            <Sparkles className="w-3.5 h-3.5 text-[var(--ty-honey)] shrink-0 mr-1.5 animate-pulse" />
            <div className="flex-1 truncate font-sans text-[11px] text-[var(--ty-text-muted)] italic select-text">
              <span className="text-[var(--ty-text-subtle)] not-italic mr-1 select-none">💭 思考:</span>
              "{thought}"
            </div>
          </div>
        ) : (
          <div className="flex-1 truncate text-[11px] text-[var(--ty-text-subtle)] italic">
            "{thought.slice(0, 50)}..."
          </div>
        )}

        {/* 右侧：速览指标与人类主考官动作区 */}
        <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
          {/* 最新指标徽章 */}
          {currentResponse && (
            <div className="hidden lg:flex items-center gap-1.5 mr-1 text-[10px]">
              <span className={`px-1.5 py-0.5 rounded font-bold ${
                currentResponse.status >= 200 && currentResponse.status < 300
                  ? 'bg-[var(--ty-matcha-tint)] text-[var(--ty-matcha)]'
                  : 'bg-[var(--ty-peach-tint)] text-[var(--ty-peach)]'
              }`}>
                {currentResponse.status}
              </span>
              <span className="text-[var(--ty-text-subtle)] flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />
                {currentResponse.time_ms}ms
              </span>
            </div>
          )}

          {/* 协同流水账按钮 */}
          <button
            onClick={() => setIsActivityOpen(prev => !prev)}
            title="查看外部 Agent 在本会话中的执行轨迹与思考流水"
            className={`ty-pressable flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs transition-all ${
              isActivityOpen
                ? 'bg-[var(--ty-sky-tint)] text-[var(--ty-sky)] border-[var(--ty-sky-soft)]'
                : 'bg-white dark:bg-[var(--ty-surface)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] border-[var(--ty-border)] shadow-2xs'
            }`}
          >
            <History className="w-3 h-3" />
            <span className="text-[10px] hidden sm:inline font-sans">协同流水</span>
            {activityStream.length > 0 && (
              <span className="px-1 py-0.2 rounded-full text-[9px] bg-black/5 dark:bg-white/10 font-bold">
                {activityStream.length}
              </span>
            )}
          </button>

          {/* 裁判反馈按钮 (Human-in-the-Loop) */}
          <button
            onClick={() => setIsFeedbackOpen(true)}
            title="向外部 Agent 派发裁判意见、批注或下一步指令"
            className="ty-pressable flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--ty-honey-tint)] text-[var(--ty-honey)] border border-[var(--ty-honey-soft)] text-xs transition-all shadow-2xs"
          >
            <MessageSquare className="w-3 h-3" />
            <span className="text-[10px] hidden sm:inline font-sans font-medium">主考官反馈</span>
          </button>

          {/* 复制标准 .http 格式 */}
          <button
            onClick={handleCopyHttpFormat}
            title="将当前接口以标准 IntelliJ .http 格式复制到剪贴板"
            className="ty-pressable flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-[var(--ty-surface)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] border border-[var(--ty-border)] text-xs transition-all shadow-2xs"
          >
            {copiedHttp ? (
              <Check className="w-3 h-3 text-[var(--ty-matcha)]" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span className="text-[10px] hidden sm:inline font-sans">复制.http</span>
          </button>

          {/* 收起 / 展开折叠按钮 */}
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-1 rounded text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title={isExpanded ? '收起 AI 态势舱' : '展开 AI 态势舱'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 协同流水抽屉 (Activity Stream Drawer) */}
      {isActivityOpen && (
        <div className="border-t border-[var(--ty-border)] bg-[#FAF8F5]/90 dark:bg-[var(--ty-surface-raised)]/90 backdrop-blur-xs p-3 max-h-64 overflow-y-auto font-sans text-xs select-text">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--ty-text)]">
              <Terminal className="w-3.5 h-3.5 text-[var(--ty-sky)]" />
              <span>Agent 实时协同轨迹与推理流水 ({activityStream.length})</span>
            </div>
            <button
              onClick={() => setIsActivityOpen(false)}
              className="text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)] text-[10px]"
            >
              关闭
            </button>
          </div>

          {activityStream.length === 0 ? (
            <div className="text-center py-6 text-[var(--ty-text-subtle)] text-[11px]">
              暂无协同记录。当外部 Agent 发起操作或推送用例时，这里将实时投屏每一步的推导过程。
            </div>
          ) : (
            <div className="space-y-2">
              {activityStream.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="bg-white dark:bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-md p-2 text-xs shadow-2xs flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[var(--ty-sky)]">[{item.agentName}]</span>
                      {item.taskName && (
                        <span className="text-[var(--ty-text-muted)]">· {item.taskName}</span>
                      )}
                      {item.step && (
                        <span className="px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[var(--ty-text-subtle)]">
                          {item.step}
                        </span>
                      )}
                    </div>
                    <span className="text-[var(--ty-text-subtle)]">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {item.thought && (
                    <div className="text-[11px] text-[var(--ty-text-muted)] italic bg-[#FAF8F5] dark:bg-[var(--ty-surface-sunken)] p-1.5 rounded border border-[var(--ty-border)]/50">
                      💭 "{item.thought}"
                    </div>
                  )}

                  {item.requestName && (
                    <div className="flex items-center gap-2 font-mono text-[10px] mt-0.5">
                      <span className={`px-1 py-0.2 rounded font-bold ${getMethodBadgeColor(item.method || 'GET')}`}>
                        {item.method || 'GET'}
                      </span>
                      <span className="truncate text-[var(--ty-text)]">{item.requestName}</span>
                      {item.statusCode && (
                        <span className={`font-bold ml-auto ${item.statusCode < 400 ? 'text-[var(--ty-matcha)]' : 'text-[var(--ty-peach)]'}`}>
                          {item.statusCode} ({item.timeMs || 0}ms)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 人类主考官反馈弹窗 (Human-in-the-Loop Feedback Modal) */}
      {isFeedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col">
            {/* 标题栏 */}
            <div className="h-10 px-4 bg-[#FAF8F5] dark:bg-[var(--ty-surface-raised)] border-b border-[var(--ty-border)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ty-text)]">
                <MessageSquare className="w-4 h-4 text-[var(--ty-honey)]" />
                <span>主考官裁决反馈 (Human-in-the-Loop Feedback)</span>
              </div>
              <button
                onClick={() => setIsFeedbackOpen(false)}
                className="text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 内容区 */}
            <div className="p-4 flex flex-col gap-3 font-sans text-xs">
              <p className="text-[11px] text-[var(--ty-text-subtle)] leading-relaxed">
                输入你的裁决、验收批注或下一阶段指令。该反馈将实时注入 Bridge 服务（端口 4171），外部 Agent 可通过 <code className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[10px]">python scripts/tongyun_ui_bridge.py feedback</code> 读取并调整后续动作。
              </p>

              {/* 快捷短语 */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold text-[var(--ty-text-muted)]">点击填入快捷预设:</span>
                <div className="flex flex-wrap gap-1.5">
                  {presetFeedbacks.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => setFeedbackInput(preset)}
                      className="text-left text-[10px] px-2 py-1 rounded bg-[#FAF8F5] dark:bg-[var(--ty-surface-sunken)] hover:bg-[var(--ty-honey-tint)] border border-[var(--ty-border)] hover:border-[var(--ty-honey-soft)] text-[var(--ty-text-muted)] hover:text-[var(--ty-honey)] transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* 文本输入框 */}
              <div className="flex flex-col gap-1 mt-1">
                <span className="text-[10px] font-semibold text-[var(--ty-text-muted)]">反馈内容:</span>
                <textarea
                  value={feedbackInput}
                  onChange={e => setFeedbackInput(e.target.value)}
                  placeholder="例如：发现 500 异常是由于 token 格式解析错误导致的，请为该用例增加负向断言..."
                  rows={4}
                  className="w-full bg-[#FAF8F5] dark:bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] rounded-md p-2.5 text-xs text-[var(--ty-text)] outline-none focus:border-[var(--ty-honey)] focus:ring-1 focus:ring-[var(--ty-honey)] transition-all resize-none font-sans"
                />
              </div>
            </div>

            {/* 底部按钮栏 */}
            <div className="h-12 px-4 bg-[#FAF8F5] dark:bg-[var(--ty-surface-raised)] border-t border-[var(--ty-border)] flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsFeedbackOpen(false)}
                className="px-3 py-1 rounded-md border border-[var(--ty-border)] text-xs text-[var(--ty-text-muted)] hover:text-[var(--ty-text)]"
              >
                取消
              </button>
              <button
                onClick={handleSubmitFeedback}
                disabled={!feedbackInput.trim()}
                className="ty-pressable px-4 py-1 rounded-md bg-[var(--ty-honey)] hover:opacity-90 disabled:opacity-40 text-white font-medium text-xs flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>发送裁决指令</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
