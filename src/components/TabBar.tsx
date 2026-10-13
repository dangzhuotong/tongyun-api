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
    <div className="h-9 bg-slate-950/70 border-b border-slate-800 flex items-center px-2 select-none overflow-x-auto shrink-0 gap-1 scrollbar-none">
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-xs cursor-pointer border-t border-x transition-colors max-w-[200px] shrink-0 ${
              isActive
                ? 'bg-slate-900 border-slate-700/80 text-slate-100 font-medium'
                : 'bg-slate-950/40 border-transparent text-slate-400 hover:bg-slate-900/60 hover:text-slate-300'
            }`}
          >
            {/* Method badge */}
            <span
              className={`text-[9px] font-mono px-1 py-0.2 rounded border font-semibold shrink-0 uppercase ${getMethodBadgeColor(
                tab.request.method
              )}`}
            >
              {tab.request.method}
            </span>

            {/* Request name */}
            <span className="truncate text-xs font-mono">{tab.request.name || '未命名'}</span>

            {/* Unsaved dirty dot */}
            {tab.isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="有未保存修改" />
            )}

            {/* Close button */}
            {tabs.length > 1 && (
              <button
                onClick={e => onCloseTab(tab.id, e)}
                className="opacity-0 group-hover:opacity-100 hover:bg-slate-800 p-0.5 rounded text-slate-400 hover:text-slate-200 transition-opacity ml-1"
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
        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors ml-1"
        title="新建空白请求标签页"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
