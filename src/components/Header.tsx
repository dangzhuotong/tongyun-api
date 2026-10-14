import React from 'react';
import {
  Cloud,
  FolderGit2,
  SlidersHorizontal,
  Plus,
  Save,
  RefreshCw,
  GitBranch,
  Code2,
  Download,
  Bot,
  Zap,
  Moon
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
  onSendRequest?: () => void;
  onRefreshWorkspace: () => void;
  isSending?: boolean;
  isDirty: boolean;
  activeRequestName?: string;
  theme: 'planner' | 'dark';
  onToggleTheme: () => void;
  onQuickSwitchEnv?: () => void;
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
  onRefreshWorkspace,
  isDirty,
  activeRequestName,
  theme,
  onToggleTheme,
  onQuickSwitchEnv,
}) => {
  const shortWs = workspacePath.length > 28 ? '...' + workspacePath.slice(-25) : workspacePath;

  return (
    <header className="h-10 bg-[var(--ty-nav-bg)] border-b border-[var(--ty-border)] flex items-center justify-between px-3 select-none shrink-0 z-20">
      {/* Brand & Workspace & Git Branch */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 font-bold text-[var(--ty-text)] tracking-wide">
          <div className="w-5.5 h-5.5 rounded-md bg-[var(--ty-matcha)] flex items-center justify-center shadow-xs">
            <Cloud className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-bold text-[var(--ty-text)] tracking-tight">
            橦云接口
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--ty-matcha-tint)] text-[var(--ty-matcha)] font-medium border border-[var(--ty-matcha-soft)]">
            v0.1
          </span>
        </div>

        {/* 风格切换：橦云手帐 / 极客暗黑 */}
        <button
          onClick={onToggleTheme}
          className="ty-pressable flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/70 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.1] border border-[var(--ty-border)] text-xs text-[var(--ty-text)] transition-colors cursor-pointer ml-1"
          title={theme === 'planner' ? "当前为 橦云手帐暖奶茶风格，点击切换至 极客暗黑" : "当前为 极客暗黑风格，点击切换至 橦云手帐暖奶茶"}
        >
          {theme === 'planner' ? (
            <>
              <span className="text-[11px] leading-none">🍵</span>
              <span className="text-[10px] font-medium text-[var(--ty-matcha)]">手帐</span>
            </>
          ) : (
            <>
              <Moon className="w-3 h-3 text-[var(--ty-sky)]" />
              <span className="text-[10px] font-medium text-[var(--ty-text)]">暗黑</span>
            </>
          )}
        </button>

        <div className="h-3.5 w-px bg-[var(--ty-border)] opacity-60 mx-1" />

        {/* Workspace directory indicator & Git branch badge */}
        <div
          title={`当前存储目录: ${workspacePath}\n纯文本组织，点击查看 Git 状态`}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/60 dark:hover:bg-white/[0.04] border border-transparent hover:border-[var(--ty-border)] text-xs text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] transition-colors cursor-pointer"
          onClick={onOpenGitModal}
        >
          <FolderGit2 className="w-3.5 h-3.5 text-[var(--ty-honey)] shrink-0" />
          <span className="font-mono text-[11px] text-[var(--ty-text)] max-w-[120px] truncate">{shortWs}</span>

          {gitBranch && (
            <span className="font-mono text-[10px] bg-white/70 dark:bg-white/[0.06] border border-[var(--ty-border)] text-[var(--ty-sky)] px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
              <GitBranch className="w-2.5 h-2.5" />
              <span>{gitBranch}</span>
            </span>
          )}

          {gitModifiedCount !== undefined && gitModifiedCount > 0 && (
            <span
              className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[var(--ty-peach-tint)] text-[var(--ty-peach)] border border-[var(--ty-peach-soft)]"
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
            className="text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)] ml-0.5 p-0.5 rounded hover:bg-white/80"
          >
            <RefreshCw className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Middle Active Request Title */}
      <div className="hidden lg:flex items-center gap-2 text-xs">
        {activeRequestName && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 dark:bg-white/[0.05] border border-[var(--ty-border)] text-[11px] font-mono shadow-2xs">
            <span className="text-[var(--ty-text-subtle)]">正在编辑:</span>
            <span className="font-semibold text-[var(--ty-text)]">{activeRequestName}</span>
            {isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ty-peach-soft)] shrink-0 animate-pulse" title="有未保存改动" />
            )}
          </div>
        )}
      </div>

      {/* Right Actions: Environment, Tools, Actions */}
      <div className="flex items-center gap-1">
        {/* Environment selector */}
        <div className="flex items-center bg-white dark:bg-[var(--ty-surface)] rounded-md border border-[var(--ty-border)] text-xs h-7 shadow-2xs mr-1 overflow-hidden">
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
            className="px-1.5 h-full hover:bg-[var(--ty-surface-raised)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] border-l border-[var(--ty-border)] transition-colors flex items-center justify-center cursor-pointer"
          >
            <SlidersHorizontal className="w-3 h-3" />
          </button>
        </div>

        {/* Quick Switch & Replay button */}
        {environments.length > 0 && onQuickSwitchEnv && (
          <button
            onClick={onQuickSwitchEnv}
            title="一键循环切换下一个环境并即刻重放请求 (快捷键: Ctrl + E)"
            className="ty-pressable flex items-center gap-1 px-2 h-7 rounded-md text-xs bg-white/70 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.1] border border-[var(--ty-border)] text-[var(--ty-honey)] hover:text-[var(--ty-honey)] transition-all font-mono mr-1 shadow-2xs"
          >
            <RefreshCw className="w-3 h-3 text-[var(--ty-honey)]" />
            <span className="text-[10px] hidden sm:inline font-medium">切环境重放</span>
            <kbd className="text-[9px] px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[var(--ty-text-subtle)] border border-[var(--ty-border)]">Ctrl+E</kbd>
          </button>
        )}

        {/* AI Inspector Button */}
        <button
          onClick={onOpenAiInspector}
          className="ty-btn-ghost ty-pressable flex items-center gap-1 px-2 h-7 rounded-md text-xs transition-all"
          title="打开 AI 运行流与实时观测台 (AI Inspector)"
        >
          <Bot className="w-3.5 h-3.5 text-[var(--ty-sky)]" />
          <span className="text-[11px] font-medium">观测台</span>
          {executionLogsCount !== undefined && executionLogsCount > 0 && (
            <span className="px-1.5 py-0.1 rounded-full text-[9px] bg-[var(--ty-sky-tint)] text-[var(--ty-sky)] border border-[var(--ty-sky-soft)] font-mono font-semibold">
              {executionLogsCount}
            </span>
          )}
        </button>

        {/* Collection Runner Button */}
        <button
          onClick={onOpenCollectionRunner}
          className="ty-btn-ghost ty-pressable flex items-center gap-1 px-2 h-7 rounded-md text-xs transition-all"
          title="批量执行集合与自动化回归 (Collection Runner)"
        >
          <Zap className="w-3.5 h-3.5 text-[var(--ty-matcha)]" />
          <span className="text-[11px] font-medium">运行器</span>
        </button>

        {/* Code Snippet Button */}
        <button
          onClick={onOpenCodeSnippet}
          className="ty-btn-ghost ty-pressable flex items-center gap-1 px-2 h-7 rounded-md text-xs transition-all"
          title="生成客户端调用代码 (JS/Python/Go/Rust等)"
        >
          <Code2 className="w-3.5 h-3.5 text-[var(--ty-text-subtle)]" />
          <span className="text-[11px] font-medium">代码</span>
        </button>

        {/* Import Modal Button */}
        <button
          onClick={onOpenImportModal}
          className="ty-btn-ghost ty-pressable flex items-center gap-1 px-2 h-7 rounded-md text-xs transition-all"
          title="导入 cURL / Postman / Swagger / .http 集合"
        >
          <Download className="w-3.5 h-3.5 text-[var(--ty-text-subtle)]" />
          <span className="text-[11px] font-medium">导入</span>
        </button>

        <div className="h-3.5 w-px bg-[var(--ty-border)] opacity-60 mx-1" />

        {/* New Request Button */}
        <button
          onClick={onNewRequest}
          className="ty-btn-ghost ty-pressable flex items-center gap-1 px-2 h-7 rounded-md text-xs transition-all"
          title="新建空白请求"
        >
          <Plus className="w-3.5 h-3.5 text-[var(--ty-matcha)]" />
          <span className="text-[11px] font-medium">新建</span>
        </button>

        {/* Save button */}
        <button
          onClick={onSaveCurrentRequest}
          className={`ty-pressable flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium transition-all cursor-pointer ${
            isDirty
              ? 'bg-white dark:bg-[var(--ty-surface)] text-[var(--ty-text)] border border-[#E8A0BF] shadow-2xs'
              : 'ty-btn-ghost'
          }`}
          title="保存接口到本地仓库纯文本 (Ctrl+S)"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="text-[11px]">保存</span>
          {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-[#E8A0BF] animate-pulse" title="有未保存修改" />}
        </button>
      </div>
    </header>
  );
};
