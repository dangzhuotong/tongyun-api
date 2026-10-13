import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  Plus,
  FolderPlus,
  Search,
  Trash2,
  Edit2,
  History,
  Layers,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  GitBranch,
  X
} from 'lucide-react';
import { FileTreeNode, HistoryItem } from '../types/api';

interface SidebarProps {
  tree: FileTreeNode[];
  history: HistoryItem[];
  activeFilePath?: string;
  onSelectFile: (path: string) => void;
  onSelectHistory: (item: HistoryItem) => void;
  onCreateRequest: (parentPath?: string) => void;
  onCreateFolder: (parentPath?: string) => void;
  onDeleteNode: (path: string) => void;
  onRenameNode: (path: string, newName: string) => void;
  onRefresh: () => void;
}

export const getMethodBadgeColor = (method?: string) => {
  switch (method?.toUpperCase()) {
    case 'GET':
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    case 'POST':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'PUT':
      return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
    case 'DELETE':
      return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    case 'PATCH':
      return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    case 'WS':
      return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 font-semibold';
    default:
      return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  }
};

export const Sidebar: React.FC<SidebarProps> = ({
  tree,
  history,
  activeFilePath,
  onSelectFile,
  onSelectHistory,
  onCreateRequest,
  onCreateFolder,
  onDeleteNode,
  onRenameNode,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'collections' | 'history'>('collections');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => ({
      ...prev,
      [path]: prev[path] === undefined ? false : !prev[path],
    }));
  };

  const isDirOpen = (path: string) => {
    return expandedDirs[path] !== false; // 默认全部展开
  };

  const handleStartRename = (e: React.MouseEvent, path: string, currentName: string) => {
    e.stopPropagation();
    setEditingPath(path);
    setEditName(currentName);
  };

  const handleFinishRename = (path: string) => {
    if (editName.trim()) {
      onRenameNode(path, editName.trim());
    }
    setEditingPath(null);
  };

  // 递归渲染文件树
  const renderTreeNodes = (nodes: FileTreeNode[], depth = 0) => {
    return nodes
      .filter(node => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        if (node.name.toLowerCase().includes(q)) return true;
        if (node.method?.toLowerCase().includes(q)) return true;
        if (node.is_dir && node.children) {
          return node.children.some(c => c.name.toLowerCase().includes(q));
        }
        return false;
      })
      .map(node => {
        if (node.is_dir) {
          const isOpen = isDirOpen(node.path);
          return (
            <div key={node.path} className="select-none">
              <div
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={() => toggleDir(node.path)}
                className="group flex items-center justify-between py-1.5 pr-2 rounded-md hover:bg-slate-800/70 text-slate-300 hover:text-slate-100 cursor-pointer text-xs transition-colors"
              >
                <div className="flex items-center gap-1.5 truncate">
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  )}
                  {isOpen ? (
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400/90 shrink-0" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />
                  )}

                  {editingPath === node.path ? (
                    <input
                      type="text"
                      value={editName}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => handleFinishRename(node.path)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleFinishRename(node.path);
                        if (e.key === 'Escape') setEditingPath(null);
                      }}
                      className="bg-slate-950 border border-sky-500 rounded px-1 text-xs text-white outline-none"
                    />
                  ) : (
                    <span className="font-medium truncate">{node.name}</span>
                  )}
                </div>

                {/* Folder Hover Actions */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onCreateRequest(node.path);
                    }}
                    title="在目录内新建请求"
                    className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-sky-300"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onCreateFolder(node.path);
                    }}
                    title="新建子文件夹"
                    className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-amber-300"
                  >
                    <FolderPlus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={e => handleStartRename(e, node.path, node.name)}
                    title="重命名目录"
                    className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm(`确定要删除目录 "${node.name}" 及其所有接口吗？`)) {
                        onDeleteNode(node.path);
                      }
                    }}
                    title="删除目录"
                    className="p-1 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {isOpen && node.children && node.children.length > 0 && (
                <div className="border-l border-slate-800/80 ml-3">
                  {renderTreeNodes(node.children, depth + 1)}
                </div>
              )}
            </div>
          );
        }

        // Request File
        const isSelected = activeFilePath === node.path;
        return (
          <div
            key={node.path}
            style={{ paddingLeft: `${depth * 12 + 10}px` }}
            onClick={() => onSelectFile(node.path)}
            className={`group flex items-center justify-between py-1.5 pr-2 rounded-md text-xs cursor-pointer transition-colors ${
              isSelected
                ? 'bg-sky-500/15 text-sky-200 font-medium border-l-2 border-sky-400'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <span
                className={`text-[9px] font-mono px-1 py-0.2 rounded border font-semibold shrink-0 uppercase ${getMethodBadgeColor(
                  node.method
                )}`}
              >
                {node.method || 'GET'}
              </span>

              {editingPath === node.path ? (
                <input
                  type="text"
                  value={editName}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => handleFinishRename(node.path)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleFinishRename(node.path);
                    if (e.key === 'Escape') setEditingPath(null);
                  }}
                  className="bg-slate-950 border border-sky-500 rounded px-1 text-xs text-white outline-none"
                />
              ) : (
                <span className="truncate">{node.name}</span>
              )}
            </div>

            {/* Request Hover Actions */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0">
              <button
                onClick={e => handleStartRename(e, node.path, node.name)}
                title="重命名接口"
                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  if (confirm(`确定要删除接口 "${node.name}" 吗？此操作会从磁盘删除该文件。`)) {
                    onDeleteNode(node.path);
                  }
                }}
                title="删除接口文件"
                className="p-1 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-400"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      });
  };

  return (
    <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 select-none">
      {/* Top Tabs */}
      <div className="flex items-center border-b border-slate-800 px-2 pt-2 gap-1 bg-slate-950/40">
        <button
          onClick={() => setActiveTab('collections')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md transition-colors border-b-2 ${
            activeTab === 'collections'
              ? 'text-sky-400 border-sky-400 bg-slate-900'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>接口集合</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md transition-colors border-b-2 ${
            activeTab === 'history'
              ? 'text-sky-400 border-sky-400 bg-slate-900'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>历史 ({history.length})</span>
        </button>
      </div>

      {/* Search and Action Bar */}
      <div className="p-2 border-b border-slate-800/80 flex flex-col gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索接口、方法或路径..."
            className="w-full bg-slate-950/70 border border-slate-800 rounded-md pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {activeTab === 'collections' && (
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="text-[11px] text-slate-500">接口目录树</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onCreateRequest()}
                title="新建请求文件"
                className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-sky-400 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="text-[11px]">请求</span>
              </button>
              <button
                onClick={() => onCreateFolder()}
                title="新建分组文件夹"
                className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-amber-400 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span className="text-[11px]">目录</span>
              </button>
              <button
                onClick={onRefresh}
                title="刷新目录树"
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {activeTab === 'collections' ? (
          tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 text-xs px-4">
              <Folder className="w-8 h-8 text-slate-600 mb-2 stroke-1" />
              <p>暂无接口文件</p>
              <button
                onClick={() => onCreateRequest()}
                className="mt-3 px-3 py-1 bg-sky-500/20 text-sky-300 rounded border border-sky-500/30 hover:bg-sky-500/30 transition-colors"
              >
                创建第一个请求
              </button>
            </div>
          ) : (
            renderTreeNodes(tree)
          )
        ) : (
          /* History tab */
          history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 text-xs px-4">
              <History className="w-8 h-8 text-slate-600 mb-2 stroke-1" />
              <p>暂无发送记录</p>
              <p className="text-[11px] text-slate-600 mt-1">发送接口后在此查看历史</p>
            </div>
          ) : (
            history.map(item => (
              <div
                key={item.id}
                onClick={() => onSelectHistory(item)}
                className="group flex flex-col p-2 rounded-md hover:bg-slate-800/70 border border-transparent hover:border-slate-800 cursor-pointer text-xs transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-mono px-1 py-0.2 rounded border font-semibold uppercase ${getMethodBadgeColor(
                        item.method
                      )}`}
                    >
                      {item.method}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1 rounded ${
                        item.status >= 200 && item.status < 300
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : item.status >= 400
                          ? 'text-rose-400 bg-rose-500/10'
                          : 'text-amber-400 bg-amber-500/10'
                      }`}
                    >
                      {item.status || 'ERR'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{item.time_ms}ms</span>
                </div>
                <div className="mt-1 text-slate-300 truncate font-mono text-[11px]">{item.url}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Bottom info bar */}
      <div className="p-2.5 border-t border-slate-800/80 bg-slate-950/60 text-[11px] text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-1 text-slate-400">
          <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
          <span>纯文本存储 · Git 自由跟踪</span>
        </div>
      </div>
    </aside>
  );
};
