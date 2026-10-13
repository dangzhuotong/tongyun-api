import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  SlidersHorizontal,
  FolderGit2,
  Save,
  Check,
  Globe
} from 'lucide-react';
import { EnvironmentData } from '../types/api';

interface EnvironmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  environments: EnvironmentData[];
  onSaveEnvironment: (env: EnvironmentData) => void;
  onDeleteEnvironment: (envId: string) => void;
}

export const EnvironmentModal: React.FC<EnvironmentModalProps> = ({
  isOpen,
  onClose,
  environments,
  onSaveEnvironment,
  onDeleteEnvironment,
}) => {
  const [selectedEnvId, setSelectedEnvId] = useState<string>(
    environments[0]?.id || ''
  );
  const [currentEnv, setCurrentEnv] = useState<EnvironmentData>(
    environments[0] || {
      id: 'custom',
      name: '自定义环境',
      variables: [{ key: 'baseUrl', value: 'https://httpbin.org', enabled: true }],
    }
  );
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  // 当切换所选环境
  const handleSelectEnv = (env: EnvironmentData) => {
    setSelectedEnvId(env.id);
    setCurrentEnv(JSON.parse(JSON.stringify(env)));
  };

  // 添加新环境
  const handleCreateNewEnv = () => {
    const newId = `env_${Date.now()}`;
    const newEnv: EnvironmentData = {
      id: newId,
      name: '新环境',
      variables: [
        { key: 'baseUrl', value: 'http://localhost:3000', enabled: true },
        { key: 'token', value: '', enabled: true },
      ],
    };
    setSelectedEnvId(newId);
    setCurrentEnv(newEnv);
  };

  // 变量行操作
  const handleAddVariable = () => {
    setCurrentEnv(prev => ({
      ...prev,
      variables: [...prev.variables, { key: '', value: '', enabled: true }],
    }));
  };

  const handleUpdateVariable = (index: number, key: string, value: string, enabled: boolean) => {
    const updated = [...currentEnv.variables];
    updated[index] = { key, value, enabled };
    setCurrentEnv(prev => ({ ...prev, variables: updated }));
  };

  const handleDeleteVariable = (index: number) => {
    const updated = currentEnv.variables.filter((_, i) => i !== index);
    setCurrentEnv(prev => ({ ...prev, variables: updated }));
  };

  const handleSave = () => {
    onSaveEnvironment(currentEnv);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 select-none animate-modal-backdrop">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col h-[520px] overflow-hidden animate-modal-pop">
        {/* Modal Header */}
        <div className="h-12 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <SlidersHorizontal className="w-4 h-4 text-sky-400" />
            <span>环境变量管理 (Environments)</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Two column layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left list of environments */}
          <div className="w-56 border-r border-slate-800 bg-slate-950/30 flex flex-col p-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-1">
              <span>环境列表</span>
              <button
                onClick={handleCreateNewEnv}
                className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300"
              >
                <Plus className="w-3 h-3" />
                <span>新建</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {environments.map(env => (
                <div
                  key={env.id}
                  onClick={() => handleSelectEnv(env)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs cursor-pointer transition-colors ${
                    selectedEnvId === env.id
                      ? 'bg-sky-500/15 text-sky-300 font-medium border border-sky-500/30'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{env.name}</span>
                  </div>
                  {environments.length > 1 && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (confirm(`确定删除环境 "${env.name}" 吗？`)) {
                          onDeleteEnvironment(env.id);
                        }
                      }}
                      className="text-slate-500 hover:text-rose-400 p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 flex items-center gap-1">
              <FolderGit2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>保存在 environments/*.json</span>
            </div>
          </div>

          {/* Right Editor */}
          <div className="flex-1 flex flex-col p-4 overflow-y-auto">
            {/* Env Name */}
            <div className="mb-4 space-y-1">
              <label className="text-xs text-slate-400 font-medium">环境名称</label>
              <input
                type="text"
                value={currentEnv.name}
                onChange={e => setCurrentEnv({ ...currentEnv, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Variable Table */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>变量定义 (使用方式: <code className="text-emerald-400 font-mono">{"{{变量名}}"}</code>)</span>
                <button
                  onClick={handleAddVariable}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs"
                >
                  <Plus className="w-3 h-3" />
                  <span>添加变量</span>
                </button>
              </div>

              <div className="border border-slate-800 rounded-md overflow-hidden bg-slate-950/40 flex-1">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="w-10 px-3 py-2 text-center">启用</th>
                      <th className="px-3 py-2 w-1/3">变量名 (Key)</th>
                      <th className="px-3 py-2">变量值 (Value)</th>
                      <th className="w-10 px-2 py-2 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {currentEnv.variables.map((v, i) => (
                      <tr key={i} className="hover:bg-slate-800/20">
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={v.enabled}
                            onChange={e => handleUpdateVariable(i, v.key, v.value, e.target.checked)}
                            className="rounded accent-sky-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={v.key}
                            onChange={e => handleUpdateVariable(i, e.target.value, v.value, v.enabled)}
                            placeholder="如 baseUrl"
                            className="w-full bg-transparent border-0 text-slate-200 font-mono text-xs focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={v.value}
                            onChange={e => handleUpdateVariable(i, v.key, e.target.value, v.enabled)}
                            placeholder="如 https://api.mytest.com"
                            className="w-full bg-transparent border-0 text-slate-200 font-mono text-xs focus:outline-none"
                          />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            onClick={() => handleDeleteVariable(i)}
                            className="text-slate-500 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="h-12 px-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="text-xs text-slate-400">
            {isSavedNotice && (
              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                <Check className="w-3.5 h-3.5" />
                已保存至本地环境纯文本
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
            >
              关闭
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs shadow-md shadow-sky-500/20 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>保存环境</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
