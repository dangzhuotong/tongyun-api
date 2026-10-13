import React from 'react';
import { Plus, X } from 'lucide-react';
import { RequestData } from '../types/api';
import { getMethodBadgeColor } from './Sidebar';

export interface TabItem {
  id: string;
  filePath?: string;
  request: RequestData;
  isDirty: boolean;
}

interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  onNewTab: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}) => {
  return (
    <div className="h-8 bg-[var(--ty-surface)] border-b border-[var(--ty-border)] flex items-center px-1.5 select-none overflow-x-auto shrink-0 gap-1 scrollbar-none">
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`group relative flex items-center gap-1.5 px-2.5 h-[28px] rounded-t-[var(--ty-radius-xs,4px)] text-xs cursor-pointer border-t-2 border-x transition-colors max-w-[200px] shrink-0 ${
              isActive
                ? 'bg-[var(--ty-surface-raised)] border-t-[var(--ty-matcha)] border-x-[var(--ty-border)] text-[var(--ty-text)] font-medium shadow-xs'
                : 'border-transparent text-[var(--ty-text-muted)] hover:bg-[var(--ty-surface-raised)]/50 hover:text-[var(--ty-text)]'
            }`}
          >
            {/* Method badge */}
            <span
              className={`text-[9px] font-mono px-1 py-0.2 rounded border font-bold shrink-0 uppercase ${getMethodBadgeColor(
                tab.request.method
              )}`}
            >
              {tab.request.method}
            </span>

            {/* Request name */}
            <span className="truncate text-[11px] font-mono">{tab.request.name || '未命名'}</span>

            {/* Unsaved dirty dot */}
            {tab.isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ty-honey)] shrink-0" title="有未保存修改" />
            )}

            {/* Close button */}
            {tabs.length > 1 && (
              <button
                onClick={e => onCloseTab(tab.id, e)}
                className="opacity-0 group-hover:opacity-100 hover:bg-[var(--ty-surface-sunken)] p-0.5 rounded text-[var(--ty-text-subtle)] hover:text-[var(--ty-peach)] transition-opacity ml-0.5"
                title="关闭标签页"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}

      {/* New tab button */}
      <button
        onClick={onNewTab}
        className="p-1 rounded-[var(--ty-radius-xs,4px)] hover:bg-[var(--ty-surface-raised)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] transition-colors ml-0.5"
        title="新建空白请求标签页"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
