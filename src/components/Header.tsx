import React from 'react';
import {
  Cloud,
  FolderGit2,
  SlidersHorizontal,
  Plus,
  Save,
  Play,
  RefreshCw,
  GitBranch,
  Code2,
  Download,
  Bot,
  Zap
} from 'lucide-react';
import { EnvironmentData } from '../types/api';

interface HeaderProps {
  workspacePath: string;
  environments: EnvironmentData[];
  selectedEnvId: string;
  onSelectEnv: (id: string) => void;
  onOpenEnvModal: () => void;
  onOpenImportModal: () => void;
  onOpenCodeSnippet: () => void;
  onOpenGitModal: () => void;
  onOpenAiInspector: () => void;
  onOpenCollectionRunner: () => void;
  executionLogsCount?: number;
  gitBranch?: string;
  gitModifiedCount?: number;
  onNewRequest: () => void;
  onSaveCurrentRequest: () => void;
  onSendRequest: () => void;
  onRefreshWorkspace: () => void;
  isSending: boolean;
  isDirty: boolean;
  activeRequestName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  workspacePath,
  environments,
  selectedEnvId,
  onSelectEnv,
  onOpenEnvModal,
  onOpenImportModal,
  onOpenCodeSnippet,
  onOpenGitModal,
  onOpenAiInspector,
  onOpenCollectionRunner,
  executionLogsCount,
  gitBranch,
  gitModifiedCount,
  onNewRequest,
  onSaveCurrentRequest,
  onSendRequest,
  onRefreshWorkspace,
  isSending,
  isDirty,
  activeRequestName,
}) => {
  const shortWs = workspacePath.length > 28 ? '...' + workspacePath.slice(-25) : workspacePath;

  return (
    <header className="h-10 bg-[var(--ty-surface)] border-b border-[var(--ty-border)] flex items-center justify-between px-3 select-none shrink-0 z-20">
      {/* Brand & Workspace & Git Branch */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 font-bold text-[var(--ty-text)] tracking-wide">
          <div className="w-6 h-6 rounded bg-[var(--ty-matcha-tint)] border border-[var(--ty-matcha-soft)] flex items-center justify-center shadow-xs">
            <Cloud className="w-3.5 h-3.5 text-[var(--ty-matcha)]" />
          </div>
          <span className="text-xs font-bold text-[var(--ty-text)] tracking-tight">
            橦云接口
          </span>
          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[var(--ty-matcha-tint)] text-[var(--ty-matcha)] border border-[var(--ty-matcha-soft)]">
            v0.1
          </span>
        </div>

        <div className="h-3.5 w-[1px] bg-[var(--ty-border)] mx-0.5" />

        {/* Workspace directory indicator & Git branch badge */}
        <div
          title={`当前存储目录: ${workspacePath}\n纯文本组织，点击查看 Git 状态`}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] text-xs text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] transition-colors cursor-pointer"
          onClick={onOpenGitModal}
        >
          <FolderGit2 className="w-3 h-3 text-[var(--ty-honey)] shrink-0" />
          <span className="font-mono text-[11px] text-[var(--ty-text)] max-w-[120px] truncate">{shortWs}</span>

          {gitBranch && (
            <span className="font-mono text-[10px] bg-[var(--ty-surface-sunken)] text-[var(--ty-sky)] px-1 py-0.2 rounded border border-[var(--ty-border)] flex items-center gap-0.5">
              <GitBranch className="w-2.5 h-2.5" />
              <span>{gitBranch}</span>
            </span>
          )}

          {gitModifiedCount !== undefined && gitModifiedCount > 0 && (
            <span
              className="px-1 py-0.2 rounded text-[10px] font-mono bg-[var(--ty-peach-tint)] text-[var(--ty-peach)] border border-[var(--ty-peach-soft)]"
              title={`${gitModifiedCount} 个文件变动`}
            >
              {gitModifiedCount} 变动
            </span>
          )}

          <button
            onClick={e => {
              e.stopPropagation();
              onRefreshWorkspace();
            }}
            title="刷新工作区与环境"
            className="text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)] ml-0.5"
          >
            <RefreshCw className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Middle Active Request Title */}
      <div className="hidden lg:flex items-center gap-2 text-xs">
        {activeRequestName && (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)]/60 text-[11px] font-mono">
            <span className="text-[var(--ty-text-subtle)]">正在编辑:</span>
            <span className="font-medium text-[var(--ty-text)]">{activeRequestName}</span>
            {isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ty-honey)] animate-pulse" title="有未保存改动" />
            )}
          </div>
        )}
      </div>

      {/* Right Actions: Environment, Code Gen, Import, Save, Send */}
      <div className="flex items-center gap-1.5">
        {/* Environment selector */}
        <div className="flex items-center bg-[var(--ty-surface-raised)] rounded-[var(--ty-radius-xs,4px)] border border-[var(--ty-border)] text-xs h-7 overflow-hidden">
          <select
            value={selectedEnvId}
            onChange={e => onSelectEnv(e.target.value)}
            className="bg-transparent text-[var(--ty-text)] py-0.5 pl-2 pr-1 outline-none cursor-pointer text-[11px] font-mono"
          >
            <option value="" className="bg-[var(--ty-surface)] text-[var(--ty-text-muted)]">
              无环境 (No Env)
            </option>
            {environments.map(env => (
              <option key={env.id} value={env.id} className="bg-[var(--ty-surface)] text-[var(--ty-text)]">
                🌱 {env.name} ({env.variables.filter(v => v.enabled).length}项)
              </option>
            ))}
          </select>
          <button
            onClick={onOpenEnvModal}
            title="管理环境变量"
            className="px-1.5 h-full hover:bg-[var(--ty-surface)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] border-l border-[var(--ty-border)] transition-colors flex items-center justify-center"
          >
            <SlidersHorizontal className="w-3 h-3" />
          </button>
        </div>

        {/* AI Inspector Button */}
        <button
          onClick={onOpenAiInspector}
          className="ty-pressable flex items-center gap-1 px-2 h-7 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface)] border border-[var(--ty-border)] text-xs text-[var(--ty-sky)] transition-all"
          title="打开 AI 运行流与实时观测台 (AI Inspector)"
        >
          <Bot className="w-3 h-3 text-[var(--ty-sky)]" />
          <span className="text-[11px]">观测台</span>
          {executionLogsCount !== undefined && executionLogsCount > 0 && (
            <span className="px-1 py-0.1 rounded text-[9px] bg-[var(--ty-sky-tint)] text-[var(--ty-sky)] font-mono">
              {executionLogsCount}
            </span>
          )}
        </button>

        {/* Collection Runner Button */}
        <button
          onClick={onOpenCollectionRunner}
          className="ty-pressable flex items-center gap-1 px-2 h-7 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface)] border border-[var(--ty-border)] text-xs text-[var(--ty-matcha)] transition-all"
          title="批量执行集合与自动化回归 (Collection Runner)"
        >
          <Zap className="w-3 h-3 text-[var(--ty-matcha)]" />
          <span className="text-[11px]">运行器</span>
        </button>

        {/* Code Snippet Button */}
        <button
          onClick={onOpenCodeSnippet}
          className="ty-pressable flex items-center gap-1 px-2 h-7 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface)] border border-[var(--ty-border)] text-xs text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] transition-all"
          title="生成客户端调用代码 (JS/Python/Go/Rust等)"
        >
          <Code2 className="w-3 h-3 text-[var(--ty-text-subtle)]" />
          <span className="text-[11px]">代码</span>
        </button>

        {/* Import Modal Button */}
        <button
          onClick={onOpenImportModal}
          className="ty-pressable flex items-center gap-1 px-2 h-7 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface)] border border-[var(--ty-border)] text-xs text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] transition-all"
          title="导入 cURL / Postman / Swagger / .http 集合"
        >
          <Download className="w-3 h-3 text-[var(--ty-text-subtle)]" />
          <span className="text-[11px]">导入</span>
        </button>

        {/* New Request Button */}
        <button
          onClick={onNewRequest}
          className="ty-pressable flex items-center gap-1 px-2 h-7 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface)] border border-[var(--ty-border)] text-xs text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] transition-all"
          title="新建空白请求"
        >
          <Plus className="w-3 h-3 text-[var(--ty-matcha)]" />
          <span className="text-[11px]">新建</span>
        </button>

        {/* Save button */}
        <button
          onClick={onSaveCurrentRequest}
          className={`ty-pressable flex items-center gap-1 px-2 h-7 rounded-[var(--ty-radius-xs,4px)] text-xs font-medium border transition-all ${
            isDirty
              ? 'bg-[var(--ty-honey-tint)] text-[var(--ty-honey)] border-[var(--ty-honey)]/40 hover:bg-[var(--ty-honey-tint)]/80 shadow-xs'
              : 'bg-[var(--ty-surface-raised)] text-[var(--ty-text-muted)] border-[var(--ty-border)] hover:bg-[var(--ty-surface)] hover:text-[var(--ty-text)]'
          }`}
          title="保存接口到本地仓库纯文本 (Ctrl+S)"
        >
          <Save className="w-3 h-3" />
          <span className="text-[11px]">保存</span>
          {isDirty && <span className="text-[9px] text-[var(--ty-honey)] font-bold">*</span>}
        </button>

        {/* Send Button (Matcha Green - IDEA Run Button) */}
        <button
          onClick={onSendRequest}
          disabled={isSending}
          className="ty-pressable flex items-center gap-1 px-3 h-7 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-matcha)] hover:bg-[var(--ty-matcha-hover)] hover:shadow-[0_0_12px_rgba(111,173,132,0.4)] text-[#10140f] text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="发送请求 (Ctrl+Enter)"
        >
          {isSending ? (
            <RefreshCw className="w-3 h-3 animate-spin text-[#10140f]" />
          ) : (
            <Play className="w-3 h-3 fill-[#10140f]" />
          )}
          <span className="text-[11px] font-bold">{isSending ? '请求中...' : '发送'}</span>
        </button>
      </div>
    </header>
  );
};
