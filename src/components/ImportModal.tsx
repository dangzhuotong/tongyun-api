import React, { useState } from 'react';
import {
  X,
  Terminal,
  FolderDown,
  Layers,
  ArrowRight,
  AlertCircle,
  FileCode2,
  FileUp
} from 'lucide-react';
import { RequestData } from '../types/api';
import { parseCurl } from '../utils/curl';
import {
  parsePostmanCollection,
  parseOpenApiSpec,
  parseHttpFileContent,
  ImportedCollectionResult
} from '../utils/importers';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSingle: (imported: Partial<RequestData>) => void;
  onImportBatchCollection: (result: ImportedCollectionResult) => Promise<void>;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportSingle,
  onImportBatchCollection,
}) => {
  const [activeTab, setActiveTab] = useState<'curl' | 'http' | 'postman' | 'openapi'>('http');
  const [inputText, setInputText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const handleImport = async () => {
    setError(null);
    if (!inputText.trim()) {
      setError('请输入或粘贴内容');
      return;
    }

    try {
      setIsImporting(true);
      if (activeTab === 'curl') {
        const parsed = parseCurl(inputText);
        if (!parsed.url) {
          setError('未能从命令中解析出有效的 URL');
          return;
        }
        onImportSingle(parsed);
        setInputText('');
        onClose();
      } else if (activeTab === 'http') {
        const result = parseHttpFileContent(inputText, uploadedFileName || 'HTTP用例导入');
        if (result.items.length === 0) {
          setError('未能从 .http 文件中解析出请求');
          return;
        }
        await onImportBatchCollection(result);
        setInputText('');
        onClose();
      } else if (activeTab === 'postman') {
        const result = parsePostmanCollection(inputText);
        if (result.items.length === 0) {
          setError('未能从 Postman 集合中解析出接口');
          return;
        }
        await onImportBatchCollection(result);
        setInputText('');
        onClose();
      } else if (activeTab === 'openapi') {
        const result = parseOpenApiSpec(inputText);
        if (result.items.length === 0) {
          setError('未能从 OpenAPI 文档中解析出路径接口');
          return;
        }
        await onImportBatchCollection(result);
        setInputText('');
        onClose();
      }
    } catch (e: any) {
      setError(e.message || '解析失败，请检查输入格式');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = evt => {
      const content = evt.target?.result as string;
      setInputText(content);
      setError(null);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-12 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <FolderDown className="w-4 h-4 text-sky-400" />
            <span>导入接口与集合</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center border-b border-slate-800 px-4 bg-slate-950/30 text-xs gap-4">
          <button
            onClick={() => {
              setActiveTab('http');
              setError(null);
            }}
            className={`py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'http'
                ? 'text-sky-400 border-sky-400'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>.http / .rest 文件</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('curl');
              setError(null);
            }}
            className={`py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'curl'
                ? 'text-sky-400 border-sky-400'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>cURL 命令行</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('postman');
              setError(null);
            }}
            className={`py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'postman'
                ? 'text-sky-400 border-sky-400'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Postman 集合 (v2.1)</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('openapi');
              setError(null);
            }}
            className={`py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'openapi'
                ? 'text-sky-400 border-sky-400'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Swagger / OpenAPI</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              {activeTab === 'http' && '直接粘贴 IntelliJ .http / .rest 文本，自动按 ### 拆分为纯文本接口用例：'}
              {activeTab === 'curl' && '直接粘贴完整的 cURL 命令：'}
              {activeTab === 'postman' && '直接粘贴 Postman 导出的 Collection JSON，将自动生成目录树与纯文本文件：'}
              {activeTab === 'openapi' && '直接粘贴 OpenAPI 3.0 或 Swagger JSON，将自动按 Tag 分组创建纯文本接口：'}
            </span>
            {activeTab !== 'curl' && (
              <label className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 cursor-pointer">
                <FileUp className="w-3.5 h-3.5" />
                <span>选择本地文件</span>
                <input
                  type="file"
                  accept=".http,.rest,.json,.yaml,.yml"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            )}
          </div>

          <textarea
            value={inputText}
            onChange={e => {
              setInputText(e.target.value);
              setError(null);
            }}
            rows={9}
            placeholder={
              activeTab === 'http'
                ? `### 示例请求\nGET https://httpbin.org/get?name={{name}}\nAuthorization: Bearer {{token}}\n\n### 提交数据\nPOST https://httpbin.org/post\nContent-Type: application/json\n\n{\n  "hello": "world"\n}`
                : activeTab === 'curl'
                ? `curl -X POST "https://api.example.com/v1/users" \\\n  -H "Authorization: Bearer token123" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name": "Alice"}'`
                : activeTab === 'postman'
                ? `{\n  "info": { "name": "我的接口集合" },\n  "item": [...] \n}`
                : `{\n  "openapi": "3.0.0",\n  "info": { "title": "API Spec" },\n  "paths": {...}\n}`
            }
            className="w-full bg-slate-950 border border-slate-800 rounded-md p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 resize-none leading-relaxed"
          />

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
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
            onClick={handleImport}
            disabled={isImporting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs shadow-md shadow-sky-500/20 transition-all disabled:opacity-50"
          >
            <span>{isImporting ? '导入中...' : activeTab === 'curl' ? '导入并填充' : '批量生成纯文本接口'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
