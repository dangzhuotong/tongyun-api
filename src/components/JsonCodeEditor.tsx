import React, { useRef, useMemo, useState } from 'react';
import { Copy, Check, Wand2, Minimize2 } from 'lucide-react';
import { tokenizeJson } from '../utils/jsonTokenizer';

interface JsonCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: string;
}

export const JsonCodeEditor: React.FC<JsonCodeEditorProps> = ({
  value,
  onChange,
  placeholder = '{\n  "key": "value"\n}',
  readOnly = false,
  minHeight = '240px',
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);

  const lines = useMemo(() => {
    return (value || '').split('\n');
  }, [value]);

  const lineCount = Math.max(1, lines.length);

  // Sync scroll positions between textarea, pre and gutter
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = scrollTop;
    }
  };

  const updateCursorPosition = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const pos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, pos);
    const linesBefore = textBefore.split('\n');
    setCursorLine(linesBefore.length);
    setCursorCol(linesBefore[linesBefore.length - 1].length + 1);
  };

  // Support Tab key indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      const nextVal = val.substring(0, start) + '  ' + val.substring(end);
      onChange(nextVal);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        updateCursorPosition();
      }, 0);
    }
  };

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(value);
      onChange(JSON.stringify(parsed, null, 2));
    } catch {
      // not valid json, ignore
    }
  };

  const handleMinify = () => {
    try {
      const parsed = JSON.parse(value);
      onChange(JSON.stringify(parsed));
    } catch {
      // not valid json, ignore
    }
  };

  // Render tokenized tokens with syntax colors
  const renderHighlightedContent = () => {
    if (!value) {
      return (
        <span className="text-[var(--ty-text-subtle)] italic select-none">
          {placeholder}
        </span>
      );
    }

    const tokens = tokenizeJson(value);
    return tokens.map((token, idx) => {
      let colorClass = 'text-[var(--ty-text)]';

      switch (token.type) {
        case 'key':
          colorClass = 'text-sky-400 font-medium';
          break;
        case 'string':
          colorClass = 'text-emerald-400';
          break;
        case 'number':
          colorClass = 'text-amber-400 font-mono';
          break;
        case 'boolean':
          colorClass = 'text-purple-400 font-bold';
          break;
        case 'null':
          colorClass = 'text-slate-400 italic';
          break;
        case 'variable':
          colorClass = 'text-emerald-300 font-semibold bg-emerald-950/40 px-1 py-0.5 rounded border border-emerald-500/30';
          break;
        case 'punctuation':
          colorClass = 'text-slate-400';
          break;
        default:
          colorClass = 'text-[var(--ty-text)]';
          break;
      }

      return (
        <span key={idx} className={colorClass}>
          {token.value}
        </span>
      );
    });
  };

  return (
    <div
      className="flex-1 flex flex-col border border-[var(--ty-border)] rounded-[var(--ty-radius-sm)] bg-[var(--ty-surface-sunken)] overflow-hidden font-mono text-xs relative group focus-within:border-[var(--ty-matcha)] shadow-inner transition-all"
      style={{ minHeight }}
    >
      {/* Editor Top Toolbar */}
      <div className="h-7 px-2.5 bg-[var(--ty-surface-raised)]/60 border-b border-[var(--ty-border)]/60 flex items-center justify-between text-[11px] text-[var(--ty-text-subtle)] shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[var(--ty-text-muted)] text-[10px] tracking-wider uppercase">JSON Payload</span>
          <span className="text-[var(--ty-border-strong)]">|</span>
          <span>{lineCount} 行</span>
          <span>·</span>
          <span>{value ? `${value.length} 字符` : '空'}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleFormat}
            title="美化格式 (Ctrl+Alt+L)"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--ty-surface)] text-[var(--ty-matcha)] hover:text-[var(--ty-matcha-hover)] transition-colors"
          >
            <Wand2 className="w-3 h-3" />
            <span>美化</span>
          </button>
          <button
            onClick={handleMinify}
            title="压缩成单行"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--ty-surface)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] transition-colors"
          >
            <Minimize2 className="w-3 h-3" />
            <span>压缩</span>
          </button>
          <button
            onClick={handleCopy}
            title="复制请求体"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--ty-surface)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-[var(--ty-matcha)]" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? '已复制' : '复制'}</span>
          </button>
        </div>
      </div>

      {/* Editor Main Canvas Body */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* IntelliJ Line Number Gutter */}
        <div
          ref={gutterRef}
          className="w-11 shrink-0 py-2.5 pr-2 pl-1 select-none text-right font-mono text-[11px] text-[var(--ty-text-subtle)] bg-[var(--ty-surface-raised)]/20 border-r border-[var(--ty-border)]/50 overflow-hidden leading-relaxed"
        >
          {Array.from({ length: lineCount }).map((_, idx) => {
            const lineNum = idx + 1;
            const isActive = lineNum === cursorLine;
            return (
              <div
                key={idx}
                className={`transition-colors ${isActive ? 'text-[var(--ty-matcha)] font-bold opacity-100' : 'opacity-60'}`}
              >
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Editor Code Area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Background Syntax Highlighted Layer */}
          <pre
            ref={preRef}
            aria-hidden="true"
            className="absolute inset-0 p-2.5 m-0 font-mono text-xs leading-relaxed whitespace-pre overflow-hidden pointer-events-none select-none z-0"
          >
            {renderHighlightedContent()}
          </pre>

          {/* Foreground Interactive Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => {
              onChange(e.target.value);
              updateCursorPosition();
            }}
            onKeyUp={updateCursorPosition}
            onClick={updateCursorPosition}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            readOnly={readOnly}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            placeholder={placeholder}
            className="absolute inset-0 w-full h-full p-2.5 m-0 font-mono text-xs leading-relaxed whitespace-pre bg-transparent text-transparent caret-emerald-400 outline-none border-0 resize-none z-10 selection:bg-sky-500/30 selection:text-transparent"
          />
        </div>
      </div>

      {/* Editor Bottom Micro Status Strip */}
      <div className="h-5 px-2 bg-[var(--ty-surface-raised)]/30 border-t border-[var(--ty-border)]/40 flex items-center justify-between text-[10px] text-[var(--ty-text-subtle)] shrink-0 select-none font-mono">
        <div className="flex items-center gap-2">
          <span>行 {cursorLine}, 列 {cursorCol}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>缩进: 2 空格</span>
          <span>·</span>
          <span>UTF-8</span>
          <span>·</span>
          <span className="text-[var(--ty-matcha)]">JSON</span>
        </div>
      </div>
    </div>
  );
};
