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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-modal-backdrop">
      <div className="bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-[var(--ty-radius-lg)] shadow-[var(--ty-shadow-pop)] w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden animate-modal-pop">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--ty-border)] bg-[var(--ty-surface-raised)]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[var(--ty-matcha-tint)] text-[var(--ty-matcha)]">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--ty-text)] flex items-center gap-2">
                <span>Git 版本控制与纯文本协作</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--ty-matcha-tint)] text-[var(--ty-matcha)] border border-[var(--ty-matcha)]/30">
                  纯文本仓库原生存储
                </span>
              </h3>
              <p className="text-xs text-[var(--ty-text-muted)]">零云端账号绑定，用标准 Git 管理你的全部 API 用例</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)] p-1.5 rounded-lg hover:bg-[var(--ty-surface)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Key Value Proposition Card */}
          <div className="p-3.5 rounded-lg bg-[var(--ty-matcha-tint)]/60 border border-[var(--ty-matcha)]/25 text-xs text-[var(--ty-text)] space-y-2">
            <div className="flex items-center gap-2 font-medium text-[var(--ty-matcha)]">
              <ShieldCheck className="w-4 h-4 text-[var(--ty-matcha)] shrink-0" />
              <span>为什么橦云 API 坚持将所有接口存为 Git 纯文本？</span>
            </div>
            <p className="text-[var(--ty-text-muted)] leading-relaxed text-[11px]">
              传统 API 工具强制将接口数据锁死在私有云端或收取团队席位费。
              橦云 API 将每一个接口、环境配置、测试断言直接落盘在项目的 <code className="text-[var(--ty-matcha)] font-mono">tongyun-collections/</code> 目录。
              所有修改均可查看 <code className="text-[var(--ty-sky)] font-mono">git diff</code>，随代码一同分支合并、Code Review 与版本归档。
            </p>
            <div className="text-[11px] font-mono text-[var(--ty-text-muted)] bg-[var(--ty-surface-sunken)] p-2 rounded border border-[var(--ty-border)] select-all break-all">
              目录: {workspacePath}
            </div>
          </div>

          {/* Git Branch & Status Summary */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[var(--ty-sky)]" />
                <span className="text-[var(--ty-text-muted)]">当前 Git 分支</span>
              </div>
              <span className="font-mono font-semibold text-[var(--ty-sky)] bg-[var(--ty-sky-tint)] px-2 py-0.5 rounded border border-[var(--ty-sky)]/30">
                {gitStatus?.branch || '检测中...'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-[var(--ty-honey)]" />
                <span className="text-[var(--ty-text-muted)]">用例目录改动</span>
              </div>
              <span className="font-mono font-semibold text-[var(--ty-text)]">
                {gitStatus?.modified_files.length ? (
                  <span className="text-[var(--ty-honey)]">{gitStatus.modified_files.length} 个文件变动</span>
                ) : (
                  <span className="text-[var(--ty-matcha)]">工作区已完全同步</span>
                )}
              </span>
            </div>
          </div>

          {/* Modified Files Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--ty-text-muted)]">
              <span className="font-medium text-[var(--ty-text)]">用例文件变更状态 (tongyun-collections/)</span>
              <button
                onClick={onRefreshGit}
                className="ty-pressable flex items-center gap-1 text-[var(--ty-text-muted)] hover:text-[var(--ty-matcha)] transition-colors"
                title="刷新 Git 状态"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>刷新</span>
              </button>
            </div>

            <div className="bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] rounded-lg max-h-40 overflow-y-auto p-2">
              {gitStatus?.modified_files && gitStatus.modified_files.length > 0 ? (
                <div className="space-y-1 font-mono text-[11px]">
                  {gitStatus.modified_files.map((file: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--ty-surface)] border border-[var(--ty-border)]/60 text-[var(--ty-text)]"
                    >
                      <span className="text-[var(--ty-honey)] font-bold shrink-0">
                        {file.slice(0, 2).trim() || 'M'}
                      </span>
                      <span className="truncate">{file.slice(2).trim() || file}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 flex flex-col items-center justify-center text-[var(--ty-text-subtle)] gap-1.5">
                  <CheckCircle2 className="w-6 h-6 text-[var(--ty-matcha)]" />
                  <span className="text-xs">无未提交改动，用例与 Git 库完全一致</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Git Commit Command */}
          <div className="space-y-1.5">
            <label className="text-xs text-[var(--ty-text-muted)] flex items-center gap-1.5">
              <GitCommit className="w-3.5 h-3.5 text-[var(--ty-honey)]" />
              <span>快速团队提交流水线命令:</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] rounded-md px-3 py-2 font-mono text-xs text-[var(--ty-text)] truncate select-all">
                {commitCmd}
              </div>
              <button
                onClick={handleCopyCmd}
                className="ty-pressable flex items-center gap-1.5 px-3 py-2 rounded-md bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface)] border border-[var(--ty-border)] text-xs font-medium text-[var(--ty-text)] transition-colors"
              >
                {copiedCmd ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[var(--ty-matcha)]" />
                    <span className="text-[var(--ty-matcha)]">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[var(--ty-matcha)]" />
                    <span>复制</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--ty-border)] bg-[var(--ty-surface-raised)] flex items-center justify-between text-xs">
          <button
            onClick={onOpenExplorer}
            className="ty-pressable flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--ty-surface)] hover:bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[var(--ty-matcha)]" />
            <span>在文件资源管理器中打开目录</span>
          </button>

          <button
            onClick={onClose}
            className="ty-pressable px-4 py-1.5 rounded-md bg-[var(--ty-matcha)] hover:bg-[var(--ty-matcha-hover)] text-white font-medium transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
