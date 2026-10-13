import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const SHORTCUT_GROUPS = [
    {
      category: '🚀 请求调试与发送',
      items: [
        { keys: ['Ctrl', 'Enter'], desc: '立即发送当前接口请求' },
        { keys: ['Ctrl', 'S'], desc: '将当前请求保存为纯文本 .http 文件 (Git 跟踪)' },
        { keys: ['Ctrl', 'Alt', 'L'], desc: '一键格式化与美化 JSON 请求体' },
      ],
    },
    {
      category: '📑 标签页与工作区',
      items: [
        { keys: ['Ctrl', 'T'], desc: '新建空白请求标签页' },
        { keys: ['Ctrl', 'W'], desc: '关闭当前激活标签页' },
      ],
    },
    {
      category: '🤖 外部 Agent 与辅助工具',
      items: [
        { keys: ['Ctrl', 'Alt', 'B'], desc: '打开 AI Bridge 协同观测台 (:4171)' },
        { keys: ['Ctrl', 'Alt', 'R'], desc: '打开接口用例批量运行器 (Collection Runner)' },
        { keys: ['Ctrl', 'Alt', 'G'], desc: '查看 Git 本地变更与分支状态' },
        { keys: ['Ctrl', 'Alt', 'E'], desc: '配置本地环境变量与私有凭据' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-[var(--ty-radius-md)] shadow-[var(--ty-shadow-pop)] w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-10 px-4 border-b border-[var(--ty-border)] flex items-center justify-between bg-[var(--ty-surface-raised)] select-none">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--ty-text)]">
            <Keyboard className="w-4 h-4 text-[var(--ty-matcha)]" />
            <span>快捷键指南 (IntelliJ Keymap)</span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)] p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {SHORTCUT_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="space-y-2">
              <h4 className="text-[11px] font-semibold text-[var(--ty-text-muted)] font-mono uppercase tracking-wider">
                {group.category}
              </h4>
              <div className="bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] rounded-[var(--ty-radius-sm)] divide-y divide-[var(--ty-border)]/50">
                {group.items.map((item, iIdx) => (
                  <div key={iIdx} className="flex items-center justify-between p-2.5">
                    <span className="text-[var(--ty-text)]">{item.desc}</span>
                    <div className="flex items-center gap-1 font-mono">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 rounded-[var(--ty-radius-xs,4px)] bg-[var(--ty-surface-raised)] border border-[var(--ty-border)] text-[var(--ty-text)] text-[10px] font-semibold shadow-2xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="h-9 px-4 border-t border-[var(--ty-border)] bg-[var(--ty-surface-sunken)] flex items-center justify-between text-[11px] font-mono text-[var(--ty-text-subtle)] select-none">
          <span>提示：按 Esc 或点击遮罩可关闭此弹窗</span>
          <button
            onClick={onClose}
            className="px-2.5 py-0.5 rounded bg-[var(--ty-surface-raised)] border border-[var(--ty-border)] text-[var(--ty-text)] hover:bg-[var(--ty-surface)] transition-colors"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
};
