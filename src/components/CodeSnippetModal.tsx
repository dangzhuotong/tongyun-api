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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-modal-backdrop">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden animate-modal-pop">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>生成客户端调用代码</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {request.method} {request.name}
                </span>
              </h3>
              <p className="text-xs text-slate-400">将当前接口直接转换为可运行的多语言工程代码</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Language Tabs & Options Bar */}
        <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Language selector chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {SUPPORTED_LANGUAGES.map(lang => {
              const isActive = selectedLang === lang.id;
              return (
                <button
                  key={lang.id}
                  onClick={() => setSelectedLang(lang.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/20'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {lang.name}
                </button>
              );
            })}
          </div>

          {/* Interpolation Toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
            <input
              type="checkbox"
              checked={interpolate}
              onChange={e => setInterpolate(e.target.checked)}
              className="accent-sky-500 rounded cursor-pointer"
            />
            <span className="text-xs">
              {interpolate ? '已代换环境变量' : '保留 {{变量名}} 原型'}
            </span>
            {environment && (
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                {environment.name}
              </span>
            )}
          </label>
        </div>

        {/* Code Content */}
        <div className="flex-1 p-5 overflow-y-auto bg-slate-950">
          <div className="relative group">
            <pre className="font-mono text-xs text-slate-200 bg-slate-900/90 p-4 rounded-lg border border-slate-800 overflow-x-auto leading-relaxed selection:bg-sky-500/30">
              {snippet}
            </pre>

            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 shadow-md transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">已复制到剪贴板</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-sky-400" />
                  <span>复制代码</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>自动解析 Query、Headers、Auth、Payload 及环境代换</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          >
            完成并关闭
          </button>
        </div>
      </div>
    </div>
  );
};
