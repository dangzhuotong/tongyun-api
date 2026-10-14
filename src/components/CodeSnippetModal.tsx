import React, { useState, useMemo } from 'react';
import { X, Copy, Check, Code2, Sparkles } from 'lucide-react';
import { RequestData, EnvironmentData } from '../types/api';
import {
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
  generateCodeSnippet,
} from '../utils/codeGenerators';

interface CodeSnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: RequestData;
  environment: EnvironmentData | null;
}

export const CodeSnippetModal: React.FC<CodeSnippetModalProps> = ({
  isOpen,
  onClose,
  request,
  environment,
}) => {
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>('curl');
  const [interpolate, setInterpolate] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const snippet = useMemo(() => {
    return generateCodeSnippet(selectedLang, request, environment, interpolate);
  }, [selectedLang, request, environment, interpolate]);

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-modal-backdrop">
      <div className="bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-[var(--ty-radius-lg)] shadow-[var(--ty-shadow-pop)] w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden animate-modal-pop">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--ty-border)] bg-[var(--ty-surface-raised)]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[var(--ty-matcha-tint)] text-[var(--ty-matcha)]">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--ty-text)] flex items-center gap-2">
                <span>生成客户端调用代码</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--ty-surface-sunken)] text-[var(--ty-text-muted)] border border-[var(--ty-border)]">
                  {request.method} {request.name}
                </span>
              </h3>
              <p className="text-xs text-[var(--ty-text-muted)]">将当前接口直接转换为可运行的多语言工程代码</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)] p-1.5 rounded-lg hover:bg-[var(--ty-surface)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Language Tabs & Options Bar */}
        <div className="px-5 py-3 border-b border-[var(--ty-border)] bg-[var(--ty-surface-sunken)]/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Language selector chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {SUPPORTED_LANGUAGES.map(lang => {
              const isActive = selectedLang === lang.id;
              return (
                <button
                  key={lang.id}
                  onClick={() => setSelectedLang(lang.id)}
                  className={`ty-pressable px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[var(--ty-matcha)] text-white shadow-xs'
                      : 'bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface)] text-[var(--ty-text-muted)] border border-[var(--ty-border)]'
                  }`}
                >
                  {lang.name}
                </button>
              );
            })}
          </div>

          {/* Interpolation Toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-[var(--ty-text-muted)] select-none">
            <input
              type="checkbox"
              checked={interpolate}
              onChange={e => setInterpolate(e.target.checked)}
              className="accent-[var(--ty-matcha)] rounded cursor-pointer"
            />
            <span className="text-xs">
              {interpolate ? '已代换环境变量' : '保留 {{变量名}} 原型'}
            </span>
            {environment && (
              <span className="text-[10px] text-[var(--ty-matcha)] font-mono bg-[var(--ty-matcha-tint)] px-1.5 py-0.5 rounded border border-[var(--ty-matcha)]/30">
                {environment.name}
              </span>
            )}
          </label>
        </div>

        {/* Code Content */}
        <div className="flex-1 p-5 overflow-y-auto bg-[var(--ty-surface-sunken)]">
          <div className="relative group">
            <pre className="font-mono text-xs text-[var(--ty-text)] bg-[var(--ty-surface)] p-4 rounded-lg border border-[var(--ty-border)] overflow-x-auto leading-relaxed shadow-inner">
              {snippet}
            </pre>

            <button
              onClick={handleCopy}
              className="ty-pressable absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface)] border border-[var(--ty-border)] text-xs font-medium text-[var(--ty-text)] shadow-xs transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[var(--ty-matcha)]" />
                  <span className="text-[var(--ty-matcha)]">已复制到剪贴板</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[var(--ty-matcha)]" />
                  <span>复制代码</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--ty-border)] bg-[var(--ty-surface-raised)] flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-[var(--ty-text-subtle)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--ty-honey)]" />
            <span>自动解析 Query、Headers、Auth、Payload 及环境代换</span>
          </div>
          <button
            onClick={onClose}
            className="ty-pressable px-4 py-1.5 rounded-md bg-[var(--ty-surface)] hover:bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] transition-colors"
          >
            完成并关闭
          </button>
        </div>
      </div>
    </div>
  );
};
