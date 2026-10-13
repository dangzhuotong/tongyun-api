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
      return 'text-[var(--ty-matcha)] bg-[var(--ty-matcha-soft)] border-[var(--ty-matcha)]/30';
    case 'POST':
      return 'text-[var(--ty-honey)] bg-[var(--ty-honey-soft)] border-[var(--ty-honey)]/30';
    case 'PUT':
      return 'text-[var(--ty-sky,#78a9ff)] bg-[var(--ty-surface-raised)] border-[var(--ty-border)]';
    case 'DELETE':
      return 'text-[var(--ty-peach)] bg-[var(--ty-peach-soft)] border-[var(--ty-peach)]/30';
    case 'PATCH':
      return 'text-[var(--ty-lavender,#b598ff)] bg-[var(--ty-surface-raised)] border-[var(--ty-border)]';
    case 'WS':
      return 'text-[var(--ty-matcha)] bg-[var(--ty-matcha-soft)] border-[var(--ty-matcha)]/40 font-semibold';
    default:
      return 'text-[var(--ty-text-muted)] bg-[var(--ty-surface-raised)] border-[var(--ty-border)]';
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
    return expandedDirs[path] !== false; // 默认展开
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
                style={{ paddingLeft: `${depth * 12 + 6}px` }}
                onClick={() => toggleDir(node.path)}
                className="group flex items-center justify-between h-7 pr-2 rounded-[var(--ty-radius-xs,4px)] hover:bg-[var(--ty-surface-raised)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] cursor-pointer text-xs transition-colors"
              >
                <div className="flex items-center gap-1.5 truncate">
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--ty-text-subtle)] shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--ty-text-subtle)] shrink-0" />
                  )}
                  {isOpen ? (
                    <FolderOpen className="w-3.5 h-3.5 text-[var(--ty-honey)] shrink-0" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-[var(--ty-honey)] shrink-0" />
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
                      className="bg-[var(--ty-surface-sunken)] border border-[var(--ty-matcha)] rounded px-1 text-xs text-[var(--ty-text)] outline-none"
                    />
                  ) : (
                    <span className="font-medium truncate text-[11px]">{node.name}</span>
                  )}
                </div>

                {/* Folder Hover Actions */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onCreateRequest(node.path);
                    }}
                    title="在目录内新建请求"
                    className="p-1 hover:bg-[var(--ty-surface-sunken)] rounded text-[var(--ty-text-subtle)] hover:text-[var(--ty-matcha)]"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onCreateFolder(node.path);
                    }}
                    title="新建子文件夹"
                    className="p-1 hover:bg-[var(--ty-surface-sunken)] rounded text-[var(--ty-text-subtle)] hover:text-[var(--ty-honey)]"
                  >
                    <FolderPlus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={e => handleStartRename(e, node.path, node.name)}
                    title="重命名目录"
                    className="p-1 hover:bg-[var(--ty-surface-sunken)] rounded text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)]"
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
                    className="p-1 hover:bg-[var(--ty-peach-soft)] rounded text-[var(--ty-text-subtle)] hover:text-[var(--ty-peach)]"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {isOpen && node.children && node.children.length > 0 && (
                <div className="border-l border-[var(--ty-border)]/50 ml-2.5">
                  {renderTreeNodes(node.children, depth + 1)}
                </div>
              )}
            </div>
          );
        }

        // Request File Node
        const isSelected = activeFilePath === node.path;
        return (
          <div
            key={node.path}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => onSelectFile(node.path)}
            className={`group flex items-center justify-between h-7 pr-2 rounded-[var(--ty-radius-xs,4px)] text-xs cursor-pointer transition-colors ${
              isSelected
                ? 'bg-[var(--ty-matcha-soft)] text-[var(--ty-text)] font-medium border-l-2 border-[var(--ty-matcha)]'
                : 'text-[var(--ty-text-muted)] hover:bg-[var(--ty-surface-raised)] hover:text-[var(--ty-text)]'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
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
                  className="bg-[var(--ty-surface-sunken)] border border-[var(--ty-matcha)] rounded px-1 text-xs text-[var(--ty-text)] outline-none"
                />
              ) : (
                <span className="truncate text-[11px]">{node.name}</span>
              )}
            </div>

            {/* Request Hover Actions */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
              <button
                onClick={e => handleStartRename(e, node.path, node.name)}
                title="重命名接口"
                className="p-1 hover:bg-[var(--ty-surface-sunken)] rounded text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)]"
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
                className="p-1 hover:bg-[var(--ty-peach-soft)] rounded text-[var(--ty-text-subtle)] hover:text-[var(--ty-peach)]"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      });
  };

  return (
    <aside className="w-64 bg-[var(--ty-surface)] border-r border-[var(--ty-border)] flex flex-col h-full shrink-0 select-none">
      {/* Top Tabs (32px) */}
      <div className="h-8 flex items-center border-b border-[var(--ty-border)] px-2 gap-1 bg-[var(--ty-surface)]">
        <button
          onClick={() => setActiveTab('collections')}
          className={`flex items-center gap-1.5 px-2.5 h-full text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'collections'
              ? 'text-[var(--ty-text)] border-[var(--ty-matcha)]'
              : 'text-[var(--ty-text-muted)] border-transparent hover:text-[var(--ty-text)]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>接口集合</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-2.5 h-full text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'text-[var(--ty-text)] border-[var(--ty-matcha)]'
              : 'text-[var(--ty-text-muted)] border-transparent hover:text-[var(--ty-text)]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>历史 ({history.length})</span>
        </button>
      </div>

      {/* Search and Action Bar */}
      <div className="p-2 border-b border-[var(--ty-border)] flex flex-col gap-1.5">
        <div className="relative">
          <Search className="w-3 h-3 text-[var(--ty-text-subtle)] absolute left-2 top-2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索接口、方法或路径..."
            className="w-full bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] rounded-[var(--ty-radius-xs,4px)] pl-7 pr-6 py-1 text-xs text-[var(--ty-text)] placeholder-[var(--ty-text-subtle)] focus:outline-none focus:border-[var(--ty-matcha)] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1.5 top-1.5 text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {activeTab === 'collections' && (
          <div className="flex items-center justify-between text-xs text-[var(--ty-text-muted)] px-1">
            <span className="text-[10px] text-[var(--ty-text-subtle)] uppercase tracking-wider font-mono">COLLECTIONS</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onCreateRequest()}
                title="新建请求文件"
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-[var(--ty-radius-xs,4px)] hover:bg-[var(--ty-surface-raised)] text-[var(--ty-text-muted)] hover:text-[var(--ty-matcha)] transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span className="text-[10px]">请求</span>
              </button>
              <button
                onClick={() => onCreateFolder()}
                title="新建分组文件夹"
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-[var(--ty-radius-xs,4px)] hover:bg-[var(--ty-surface-raised)] text-[var(--ty-text-muted)] hover:text-[var(--ty-honey)] transition-colors"
              >
                <FolderPlus className="w-3 h-3" />
                <span className="text-[10px]">目录</span>
              </button>
              <button
                onClick={onRefresh}
                title="刷新目录树"
                className="p-1 rounded-[var(--ty-radius-xs,4px)] hover:bg-[var(--ty-surface-raised)] text-[var(--ty-text-subtle)] hover:text-[var(--ty-text)] transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {activeTab === 'collections' ? (
          tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-[var(--ty-text-subtle)] text-xs px-4">
              <Folder className="w-8 h-8 text-[var(--ty-text-subtle)] mb-2 stroke-1 opacity-50" />
              <p>暂无接口文件</p>
              <button
                onClick={() => onCreateRequest()}
                className="mt-3 px-3 py-1 bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] text-[var(--ty-matcha)] rounded-[var(--ty-radius-xs,4px)] border border-[var(--ty-border)] transition-colors text-xs"
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
            <div className="flex flex-col items-center justify-center h-48 text-center text-[var(--ty-text-subtle)] text-xs px-4">
              <History className="w-8 h-8 text-[var(--ty-text-subtle)] mb-2 stroke-1 opacity-50" />
              <p>暂无发送记录</p>
              <p className="text-[10px] text-[var(--ty-text-subtle)] mt-1">发送接口后在此查看历史</p>
            </div>
          ) : (
            history.map(item => (
              <div
                key={item.id}
                onClick={() => onSelectHistory(item)}
                className="group flex flex-col p-2 rounded-[var(--ty-radius-xs,4px)] hover:bg-[var(--ty-surface-raised)] border border-transparent hover:border-[var(--ty-border)] cursor-pointer text-xs transition-colors"
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
                          ? 'text-[var(--ty-matcha)] bg-[var(--ty-matcha-soft)]'
                          : item.status >= 400
                          ? 'text-[var(--ty-peach)] bg-[var(--ty-peach-soft)]'
                          : 'text-[var(--ty-honey)] bg-[var(--ty-honey-soft)]'
                      }`}
                    >
                      {item.status || 'ERR'}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--ty-text-subtle)] font-mono">{item.time_ms}ms</span>
                </div>
                <div className="mt-1 text-[var(--ty-text)] truncate font-mono text-[11px]">{item.url}</div>
                <div className="text-[10px] text-[var(--ty-text-subtle)] mt-0.5">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Bottom info bar */}
      <div className="h-6 px-2.5 border-t border-[var(--ty-border)] bg-[var(--ty-surface)] text-[10px] text-[var(--ty-text-subtle)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 text-[var(--ty-text-muted)] font-mono">
          <GitBranch className="w-3 h-3 text-[var(--ty-matcha)]" />
          <span>Git 纯文本跟踪</span>
        </div>
      </div>
    </aside>
  );
};
