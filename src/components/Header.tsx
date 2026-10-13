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
    <header className="h-14 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between px-4 select-none shrink-0 backdrop-blur z-20">
      {/* Brand & Workspace & Git Branch */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-bold text-slate-100 tracking-wide">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 p-[1px] flex items-center justify-center shadow-lg shadow-sky-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
              <Cloud className="w-4 h-4 text-sky-400" />
            </div>
          </div>
          <span className="text-sm font-semibold bg-gradient-to-r from-sky-400 to-indigo-300 bg-clip-text text-transparent">
            橦云 API
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            v0.1·Git
          </span>
        </div>

        <div className="h-4 w-[1px] bg-slate-800 mx-1" />

        {/* Workspace directory indicator & Git branch badge */}
        <div
          title={`当前存储目录: ${workspacePath}\n纯文本组织，点击查看 Git 状态`}
          className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-300 transition-colors cursor-pointer"
          onClick={onOpenGitModal}
        >
          <FolderGit2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-mono text-[11px] text-slate-300 max-w-[140px] truncate">{shortWs}</span>

          {gitBranch && (
            <span className="font-mono text-[10px] bg-slate-900 text-sky-400 px-1.5 py-0.5 rounded border border-slate-700/80 flex items-center gap-1">
              <GitBranch className="w-2.5 h-2.5" />
              <span>{gitBranch}</span>
            </span>
          )}

          {gitModifiedCount !== undefined && gitModifiedCount > 0 && (
            <span
              className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30"
              title={`${gitModifiedCount} 个文件变动`}
            >
              {gitModifiedCount} 改动
            </span>
          )}

          <button
            onClick={e => {
              e.stopPropagation();
              onRefreshWorkspace();
            }}
            title="刷新工作区与环境"
            className="text-slate-500 hover:text-slate-300 ml-0.5"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Middle Active Request Title */}
      <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
        {activeRequestName && (
          <>
            <span className="text-slate-500">正在调试:</span>
            <span className="font-medium text-slate-200">{activeRequestName}</span>
            {isDirty && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="有未保存改动" />
            )}
          </>
        )}
      </div>

      {/* Right Actions: Environment, Code Gen, Import, Save, Send */}
      <div className="flex items-center gap-2">
        {/* Environment selector */}
        <div className="flex items-center bg-slate-800/80 rounded-md border border-slate-700 text-xs overflow-hidden">
          <select
            value={selectedEnvId}
            onChange={e => onSelectEnv(e.target.value)}
            className="bg-transparent text-slate-200 py-1.5 pl-2.5 pr-2 outline-none cursor-pointer text-xs"
          >
            <option value="" className="bg-slate-900 text-slate-300">
              无环境 (No Environment)
            </option>
            {environments.map(env => (
              <option key={env.id} value={env.id} className="bg-slate-900 text-slate-200">
                🌱 {env.name} ({env.variables.filter(v => v.enabled).length}项)
              </option>
            ))}
          </select>
          <button
            onClick={onOpenEnvModal}
            title="管理环境变量"
            className="px-2 py-1.5 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-l border-slate-700 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* AI Inspector Button */}
        <button
          onClick={onOpenAiInspector}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-sky-300 transition-colors"
          title="打开 AI 运行流与实时观测台 (AI Inspector)"
        >
          <Bot className="w-3.5 h-3.5 text-sky-400" />
          <span>AI 观测台</span>
          {executionLogsCount !== undefined && executionLogsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-500/20 text-sky-300 font-mono">
              {executionLogsCount}
            </span>
          )}
        </button>

        {/* Collection Runner Button */}
        <button
          onClick={onOpenCollectionRunner}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-emerald-300 transition-colors"
          title="批量执行集合与自动化回归 (Collection Runner)"
        >
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
          <span>批量回归</span>
        </button>

        {/* Code Snippet Button */}
        <button
          onClick={onOpenCodeSnippet}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition-colors"
          title="生成客户端调用代码 (JS/Python/Go/Rust等)"
        >
          <Code2 className="w-3.5 h-3.5 text-sky-400" />
          <span>代码</span>
        </button>

        {/* Import Modal Button */}
        <button
          onClick={onOpenImportModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition-colors"
          title="导入 cURL / Postman / Swagger / .http 集合"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span>导入</span>
        </button>

        {/* New Request Button */}
        <button
          onClick={onNewRequest}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition-colors"
          title="新建空白请求"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          <span>新建</span>
        </button>

        {/* Save button */}
        <button
          onClick={onSaveCurrentRequest}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            isDirty
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
          title="保存接口到本地仓库纯文本 (Ctrl+S)"
        >
          <Save className="w-3.5 h-3.5" />
          <span>保存</span>
          {isDirty && <span className="text-[10px] text-amber-400">*</span>}
        </button>

        {/* Send Button */}
        <button
          onClick={onSendRequest}
          disabled={isSending}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-sky-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="发送请求 (Ctrl+Enter)"
        >
          {isSending ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-white" />
          )}
          <span>{isSending ? '请求中...' : '发送'}</span>
        </button>
      </div>
    </header>
  );
};
