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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-modal-backdrop">
      <div className="w-full max-w-2xl bg-[var(--ty-surface)] border border-[var(--ty-border)] rounded-[var(--ty-radius-lg)] shadow-[var(--ty-shadow-pop)] flex flex-col overflow-hidden animate-modal-pop">
        {/* Header */}
        <div className="h-11 px-4 border-b border-[var(--ty-border)] flex items-center justify-between bg-[var(--ty-surface-raised)]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ty-text)]">
            <FolderDown className="w-4 h-4 text-[var(--ty-matcha)]" />
            <span>导入接口与集合</span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)] p-1 rounded hover:bg-[var(--ty-surface)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center border-b border-[var(--ty-border)] px-4 bg-[var(--ty-surface-sunken)] text-xs gap-4">
          <button
            onClick={() => {
              setActiveTab('http');
              setError(null);
            }}
            className={`py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'http'
                ? 'text-[var(--ty-matcha)] border-[var(--ty-matcha)]'
                : 'text-[var(--ty-text-muted)] border-transparent hover:text-[var(--ty-text)]'
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
                ? 'text-[var(--ty-matcha)] border-[var(--ty-matcha)]'
                : 'text-[var(--ty-text-muted)] border-transparent hover:text-[var(--ty-text)]'
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
                ? 'text-[var(--ty-matcha)] border-[var(--ty-matcha)]'
                : 'text-[var(--ty-text-muted)] border-transparent hover:text-[var(--ty-text)]'
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
                ? 'text-[var(--ty-matcha)] border-[var(--ty-matcha)]'
                : 'text-[var(--ty-text-muted)] border-transparent hover:text-[var(--ty-text)]'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Swagger / OpenAPI</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-[var(--ty-text-muted)]">
            <span>
              {activeTab === 'http' && '直接粘贴 IntelliJ .http / .rest 文本，自动按 ### 拆分为纯文本接口用例：'}
              {activeTab === 'curl' && '直接粘贴完整的 cURL 命令：'}
              {activeTab === 'postman' && '直接粘贴 Postman 导出的 Collection JSON，将自动生成目录树与纯文本文件：'}
              {activeTab === 'openapi' && '直接粘贴 OpenAPI 3.0 或 Swagger JSON，将自动按 Tag 分组创建纯文本接口：'}
            </span>
            {activeTab !== 'curl' && (
              <label className="flex items-center gap-1 text-[11px] text-[var(--ty-matcha)] hover:underline cursor-pointer">
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
            className="w-full bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] rounded-[var(--ty-radius-sm)] p-3 text-xs font-mono text-[var(--ty-text)] placeholder-[var(--ty-text-subtle)] focus:outline-none focus:border-[var(--ty-matcha)] resize-none leading-relaxed"
          />

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-500 bg-rose-500/10 p-2 rounded-[var(--ty-radius-xs)] border border-rose-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-12 px-4 border-t border-[var(--ty-border)] flex items-center justify-end gap-2 bg-[var(--ty-surface-raised)]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-[var(--ty-radius-sm)] bg-[var(--ty-surface)] hover:bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] text-[var(--ty-text)] text-xs transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[var(--ty-radius-sm)] bg-[var(--ty-matcha)] hover:bg-[var(--ty-matcha-hover)] text-white font-medium text-xs shadow-xs transition-all disabled:opacity-50"
          >
            <span>{isImporting ? '导入中...' : activeTab === 'curl' ? '导入并填充' : '批量生成纯文本接口'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
