import React, { useState } from 'react';
import {
  X,
  GitBranch,
  FolderGit2,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  GitCommit,
  CheckCircle2,
  FileCode2,
  ShieldCheck
} from 'lucide-react';
import { GitStatusResult } from '../services/apiClient';

interface GitStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string;
  gitStatus: GitStatusResult | null;
  onOpenExplorer: () => void;
  onRefreshGit: () => void;
}

export const GitStatusModal: React.FC<GitStatusModalProps> = ({
  isOpen,
  onClose,
  workspacePath,
  gitStatus,
  onOpenExplorer,
  onRefreshGit,
}) => {
  const [copiedCmd, setCopiedCmd] = useState(false);

  if (!isOpen) return null;

  const commitCmd = `git add tongyun-collections && git commit -m "feat(api): 更新接口用例与测试断言"`;

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(commitCmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>Git 版本控制与纯文本协作</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  纯文本仓库原生存储
                </span>
              </h3>
              <p className="text-xs text-slate-400">零云端账号绑定，用标准 Git 管理你的全部 API 用例</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Key Value Proposition Card */}
          <div className="p-3.5 rounded-lg bg-gradient-to-r from-emerald-950/30 via-slate-900 to-indigo-950/30 border border-emerald-500/20 text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-2 font-medium text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>为什么橦云 API 坚持将所有接口存为 Git 纯文本？</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              传统 API 工具（Postman/Apifox）强制将接口数据锁死在私有云端或收取团队席位费。
              橦云 API 将每一个接口、环境配置、测试断言直接落盘在项目的 <code className="text-emerald-300 font-mono">tongyun-collections/</code> 目录。
              所有修改均可查看 <code className="text-sky-300 font-mono">git diff</code>，随代码一同分支合并、Code Review 与版本归档。
            </p>
            <div className="text-[11px] font-mono text-slate-400 bg-slate-950/80 p-2 rounded border border-slate-800 select-all break-all">
              目录: {workspacePath}
            </div>
          </div>

          {/* Git Branch & Status Summary */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-sky-400" />
                <span className="text-slate-400">当前 Git 分支</span>
              </div>
              <span className="font-mono font-semibold text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                {gitStatus?.branch || '检测中...'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-amber-400" />
                <span className="text-slate-400">用例目录改动</span>
              </div>
              <span className="font-mono font-semibold text-slate-200">
                {gitStatus?.modified_files.length ? (
                  <span className="text-amber-400">{gitStatus.modified_files.length} 个文件变动</span>
                ) : (
                  <span className="text-emerald-400">工作区已完全同步</span>
                )}
              </span>
            </div>
          </div>

          {/* Modified Files Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium text-slate-300">用例文件变更状态 (tongyun-collections/)</span>
              <button
                onClick={onRefreshGit}
                className="flex items-center gap-1 text-slate-400 hover:text-sky-300 transition-colors"
                title="刷新 Git 状态"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>刷新</span>
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg max-h-40 overflow-y-auto p-2">
              {gitStatus?.modified_files && gitStatus.modified_files.length > 0 ? (
                <div className="space-y-1 font-mono text-[11px]">
                  {gitStatus.modified_files.map((file: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-2 py-1 rounded bg-slate-900/60 border border-slate-800/40 text-slate-300"
                    >
                      <span className="text-amber-400 font-bold shrink-0">
                        {file.slice(0, 2).trim() || 'M'}
                      </span>
                      <span className="truncate">{file.slice(2).trim() || file}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 flex flex-col items-center justify-center text-slate-500 gap-1.5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500/70" />
                  <span className="text-xs">无未提交改动，用例与 Git 库完全一致</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Git Commit Command */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 flex items-center gap-1.5">
              <GitCommit className="w-3.5 h-3.5 text-indigo-400" />
              <span>快速团队提交流水线命令:</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-3 py-2 font-mono text-xs text-slate-300 truncate select-all">
                {commitCmd}
              </div>
              <button
                onClick={handleCopyCmd}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
              >
                {copiedCmd ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-sky-400" />
                    <span>复制</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs">
          <button
            onClick={onOpenExplorer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            <span>在文件资源管理器中打开目录</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-medium transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
