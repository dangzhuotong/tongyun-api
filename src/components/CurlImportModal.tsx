import React, { useState } from 'react';
import {
  X,
  Terminal,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { RequestData } from '../types/api';
import { parseCurl } from '../utils/curl';
import { getMethodBadgeColor } from './Sidebar';

interface CurlImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (imported: Partial<RequestData>) => void;
}

export const CurlImportModal: React.FC<CurlImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [curlText, setCurlText] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParseAndImport = () => {
    try {
      if (!curlText.trim()) {
        setError('请输入 cURL 命令');
        return;
      }
      const parsed = parseCurl(curlText);
      if (!parsed.url) {
        setError('未能从命令中解析出有效的 URL');
        return;
      }
      onImport(parsed);
      setCurlText('');
      setError(null);
      onClose();
    } catch (e: any) {
      setError(e.message || '解析失败，请检查 cURL 命令格式');
    }
  };

  // 尝试做实时简要预览
  let parsedPreview: Partial<RequestData> | null = null;
  try {
    if (curlText.trim().toLowerCase().startsWith('curl')) {
      parsedPreview = parseCurl(curlText);
    }
  } catch {
    // ignore
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-12 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Terminal className="w-4 h-4 text-sky-400" />
            <span>导入 cURL 命令</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-400">
            支持直接粘贴从浏览器 Network 控制台 “Copy as cURL”、Swagger 或终端复制的完整命令：
          </p>

          <textarea
            value={curlText}
            onChange={e => {
              setCurlText(e.target.value);
              setError(null);
            }}
            rows={8}
            placeholder={`curl -X POST "https://api.example.com/v1/users" \\\n  -H "Authorization: Bearer token123" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name": "Alice"}'`}
            className="w-full bg-slate-950 border border-slate-800 rounded-md p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 resize-none leading-relaxed"
          />

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {parsedPreview && (
            <div className="p-2.5 rounded-md bg-slate-950/60 border border-slate-800 text-xs space-y-1">
              <div className="text-[11px] text-slate-500 font-medium">预览识别结果:</div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[9px] font-mono px-1 py-0.2 rounded border font-semibold uppercase ${getMethodBadgeColor(
                    parsedPreview.method
                  )}`}
                >
                  {parsedPreview.method}
                </span>
                <span className="font-mono text-slate-300 truncate">{parsedPreview.url}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                请求头: {parsedPreview.headers?.length || 0} 项 · 请求体: {parsedPreview.body?.body_type}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-12 px-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950/40">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleParseAndImport}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs shadow-md shadow-sky-500/20 transition-all"
          >
            <span>导入并填充</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
