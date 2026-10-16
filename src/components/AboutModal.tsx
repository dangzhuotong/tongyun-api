import { useEffect } from "react";
import { Cloud, X } from "lucide-react";

export interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
  checkingUpdate?: boolean;
  onCheckUpdate?: () => void;
}

export function AboutModal({
  isOpen,
  onClose,
  version,
  checkingUpdate = false,
  onCheckUpdate,
}: AboutModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[var(--ty-radius-md)] border border-[var(--ty-border)] bg-[var(--ty-surface)] shadow-[var(--ty-shadow-pop)] overflow-hidden flex flex-col animate-modal-pop"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby="about-title"
      >
        <div className="h-10 px-4 border-b border-[var(--ty-border)] flex items-center justify-between bg-[var(--ty-surface-raised)]">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--ty-text)]">
            <Cloud className="w-4 h-4 text-[var(--ty-matcha)]" />
            <span id="about-title">关于 橦云接口</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="关闭 (Esc)"
            aria-label="关闭"
            className="text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)] p-1 rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--ty-matcha)] text-white flex items-center justify-center shadow-xs">
            <Cloud className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--ty-text)]">橦云接口</h3>
            <p className="text-xs text-[var(--ty-text-muted)] mt-1">
              本地优先的纯文本 API 调试桌面应用
            </p>
            <div className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-[var(--ty-matcha-soft)] border border-[var(--ty-matcha)]/20 text-[var(--ty-matcha)] text-xs font-mono font-medium">
              当前版本 v{version}
            </div>
          </div>
          <div className="p-3.5 rounded-[var(--ty-radius-sm)] border border-[var(--ty-border)] bg-[var(--ty-surface-sunken)] text-left text-xs space-y-2">
            <div className="flex justify-between items-center gap-3">
              <span className="text-[var(--ty-text-muted)]">核心架构</span>
              <span className="font-medium text-[var(--ty-text)]">Rust + Tauri 2 + React 19</span>
            </div>
            <div className="flex justify-between items-center gap-3">
              <span className="text-[var(--ty-text-muted)]">更新</span>
              <span className="text-[var(--ty-text)]">启动约 3 秒静默检查</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 bg-[var(--ty-surface-sunken)] border-t border-[var(--ty-border)] flex justify-end gap-2">
          {onCheckUpdate && (
            <button
              type="button"
              onClick={onCheckUpdate}
              disabled={checkingUpdate}
              className="px-4 py-1.5 rounded-md text-xs font-medium border border-[var(--ty-border)] text-[var(--ty-text)] hover:bg-[var(--ty-surface)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkingUpdate ? "正在检查更新…" : "检查更新"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-xs font-medium bg-[var(--ty-matcha)] text-white hover:bg-[var(--ty-matcha-hover)] transition-colors cursor-pointer"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
