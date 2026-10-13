import React, { useRef, useMemo } from 'react';
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
      }, 0);
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
      className="flex-1 flex border border-[var(--ty-border)] rounded-[var(--ty-radius-sm)] bg-[var(--ty-surface-sunken)] overflow-hidden font-mono text-xs relative group focus-within:border-[var(--ty-matcha)] transition-all"
      style={{ minHeight }}
    >
      {/* IntelliJ Line Number Gutter */}
      <div
        ref={gutterRef}
        className="w-11 shrink-0 py-3 pr-2 pl-1 select-none text-right font-mono text-[11px] text-[var(--ty-text-subtle)] bg-[var(--ty-surface-raised)]/20 border-r border-[var(--ty-border)]/50 overflow-hidden leading-relaxed"
      >
        {Array.from({ length: lineCount }).map((_, idx) => (
          <div key={idx} className="opacity-60">
            {idx + 1}
          </div>
        ))}
      </div>

      {/* Editor Main Canvas */}
      <div className="flex-1 relative overflow-hidden">
        {/* Background Syntax Highlighted Layer */}
        <pre
          ref={preRef}
          aria-hidden="true"
          className="absolute inset-0 p-3 m-0 font-mono text-xs leading-relaxed whitespace-pre overflow-hidden pointer-events-none select-none z-0"
        >
          {renderHighlightedContent()}
        </pre>

        {/* Foreground Interactive Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          placeholder={placeholder}
          className="absolute inset-0 w-full h-full p-3 m-0 font-mono text-xs leading-relaxed whitespace-pre bg-transparent text-transparent caret-emerald-400 outline-none border-0 resize-none z-10 selection:bg-sky-500/30 selection:text-transparent"
        />
      </div>
    </div>
  );
};
