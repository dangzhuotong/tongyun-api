import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TabBar, TabItem } from './components/TabBar';
import { RequestEditor } from './components/RequestEditor';
import { ResponseViewer } from './components/ResponseViewer';
import { EnvironmentModal } from './components/EnvironmentModal';
import { ImportModal } from './components/ImportModal';
import { apiClient } from './services/apiClient';
import {
  RequestData,
  ResponsePayload,
  FileTreeNode,
  EnvironmentData,
  HistoryItem
} from './types/api';
import { ImportedCollectionResult } from './utils/importers';

const createDefaultRequest = (): RequestData => ({
  id: `req_${Date.now()}`,
  name: '新建请求',
  method: 'GET',
  url: 'https://httpbin.org/get',
  headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
  params: [],
  body: { body_type: 'none', content: '' },
  auth: { auth_type: 'none' },
  description: '自用 API 调试',
});

export const App: React.FC = () => {
  const [workspacePath, setWorkspacePath] = useState<string>('');
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [environments, setEnvironments] = useState<EnvironmentData[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');

  // 多标签页状态
  const [tabs, setTabs] = useState<TabItem[]>([
    {
      id: 'tab_initial',
      request: createDefaultRequest(),
      isDirty: false,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab_initial');

  const [response, setResponse] = useState<ResponsePayload | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // 当前激活的 Tab
  const activeTab = useMemo(() => {
    return tabs.find(t => t.id === activeTabId) || tabs[0];
  }, [tabs, activeTabId]);

  const currentRequest = activeTab ? activeTab.request : createDefaultRequest();
  const activeFilePath = activeTab ? activeTab.filePath : undefined;
  const isDirty = activeTab ? activeTab.isDirty : false;

  // 当前激活的环境变量对象
  const activeEnvironment = useMemo(() => {
    return environments.find(e => e.id === selectedEnvId) || null;
  }, [environments, selectedEnvId]);

  // 加载工作区与初始化
  const loadWorkspace = useCallback(async () => {
    try {
      const ws = await apiClient.initSampleWorkspace();
      setWorkspacePath(ws);

      const tree = await apiClient.loadFileTree();
      setFileTree(tree);

      const envs = await apiClient.loadEnvironments();
      setEnvironments(envs);
      if (envs.length > 0 && !selectedEnvId) {
        setSelectedEnvId(envs[0].id);
      }

      // 默认将树中第一个文件作为第一个标签页打开
      const findFirstFile = (nodes: FileTreeNode[]): string | null => {
        for (const n of nodes) {
          if (!n.is_dir) return n.path;
          if (n.children) {
            const f = findFirstFile(n.children);
            if (f) return f;
          }
        }
        return null;
      };

      const firstFile = findFirstFile(tree);
      if (firstFile) {
        const req = await apiClient.readRequestFile(firstFile);
        setTabs([
          {
            id: `tab_${firstFile}`,
            filePath: firstFile,
            request: req,
            isDirty: false,
          },
        ]);
        setActiveTabId(`tab_${firstFile}`);
      }
    } catch (e: any) {
      console.error('加载工作区失败:', e);
      showToast(`加载工作区失败: ${e.message}`);
    }
  }, [selectedEnvId]);

  useEffect(() => {
    loadWorkspace();

    const savedHistory = localStorage.getItem('tongyun_api_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch {
        // ignore
      }
    }
  }, []);

  // 选择文件（如果已在标签中则切过去，否则新增标签）
  const handleSelectFile = async (filePath: string) => {
    const existingTab = tabs.find(t => t.filePath === filePath);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    try {
      const data = await apiClient.readRequestFile(filePath);
      const newTab: TabItem = {
        id: `tab_${filePath}`,
        filePath,
        request: data,
        isDirty: false,
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);
      setResponse(null);
    } catch (e: any) {
      showToast(`读取接口文件失败: ${e.message}`);
    }
  };

  // 更新当前标签的请求内容
  const handleUpdateRequest = (updated: RequestData) => {
    setTabs(prev =>
      prev.map(t => {
        if (t.id === activeTabId) {
          return {
            ...t,
            request: updated,
            isDirty: true,
          };
        }
        return t;
      })
    );
  };

  // 新建标签页
  const handleNewTab = () => {
    const newReq = createDefaultRequest();
    const newTab: TabItem = {
      id: `tab_new_${Date.now()}`,
      request: newReq,
      isDirty: false,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setResponse(null);
  };

  // 关闭标签页
  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      const nextTab = newTabs[Math.max(0, tabIndex - 1)];
      setActiveTabId(nextTab.id);
    }
  };

  // 保存当前标签的接口文件到磁盘纯文本
  const handleSaveRequest = async () => {
    if (!activeTab) return;

    if (!activeTab.filePath) {
      try {
        const newFilePath = await apiClient.createFileOrFolder(
          workspacePath,
          activeTab.request.name || '新建请求',
          false,
          activeTab.request
        );
        setTabs(prev =>
          prev.map(t =>
            t.id === activeTabId
              ? { ...t, filePath: newFilePath, isDirty: false, request: { ...t.request, filePath: newFilePath } }
              : t
          )
        );
        const tree = await apiClient.loadFileTree();
        setFileTree(tree);
        showToast('已保存为本地纯文本文件');
      } catch (e: any) {
        showToast(`保存失败: ${e.message}`);
      }
      return;
    }

    try {
      await apiClient.saveRequestFile(activeTab.filePath, activeTab.request);
      setTabs(prev =>
        prev.map(t => (t.id === activeTabId ? { ...t, isDirty: false } : t))
      );
      const tree = await apiClient.loadFileTree();
      setFileTree(tree);
      showToast('已保存');
    } catch (e: any) {
      showToast(`保存失败: ${e.message}`);
    }
  };

  // 发送 HTTP 请求
  const handleSendRequest = async () => {
    if (isSending || !currentRequest) return;
    setIsSending(true);
    try {
      const resp = await apiClient.executeHttpRequest(currentRequest, activeEnvironment);
      setResponse(resp);

      const newHistoryItem: HistoryItem = {
        id: `hist_${Date.now()}`,
        timestamp: Date.now(),
        method: currentRequest.method,
        url: currentRequest.url,
        status: resp.status,
        time_ms: resp.time_ms,
        size_bytes: resp.size_bytes,
        request: JSON.parse(JSON.stringify(currentRequest)),
        response: resp,
      };

      setHistory(prev => {
        const next = [newHistoryItem, ...prev.slice(0, 49)];
        localStorage.setItem('tongyun_api_history', JSON.stringify(next));
        return next;
      });
    } catch (e: any) {
      setResponse({
        status: 0,
        status_text: 'Error',
        headers: [],
        body: `发送异常: ${e.message || String(e)}`,
        time_ms: 0,
        size_bytes: 0,
        is_json: false,
      });
    } finally {
      setIsSending(false);
    }
  };

  // 新建请求文件
  const handleCreateRequest = async (parentPath?: string) => {
    const targetDir = parentPath || workspacePath;
    const reqName = `新请求_${Date.now().toString().slice(-4)}`;
    try {
      const newFilePath = await apiClient.createFileOrFolder(targetDir, reqName, false);
      const tree = await apiClient.loadFileTree();
      setFileTree(tree);
      await handleSelectFile(newFilePath);
      showToast('已新建接口文件');
    } catch (e: any) {
      showToast(`新建请求失败: ${e.message}`);
    }
  };

  // 新建文件夹
  const handleCreateFolder = async (parentPath?: string) => {
    const targetDir = parentPath || workspacePath;
    const folderName = prompt('请输入新目录名称:', '新接口模块');
    if (!folderName || !folderName.trim()) return;

    try {
      await apiClient.createFileOrFolder(targetDir, folderName.trim(), true);
      const tree = await apiClient.loadFileTree();
      setFileTree(tree);
      showToast(`已创建目录 ${folderName}`);
    } catch (e: any) {
      showToast(`创建目录失败: ${e.message}`);
    }
  };

  // 删除文件或文件夹
  const handleDeleteNode = async (path: string) => {
    try {
      await apiClient.deleteFileOrFolder(path);
      const tree = await apiClient.loadFileTree();
      setFileTree(tree);
      // 关闭对应 tab
      setTabs(prev => {
        const remaining = prev.filter(t => t.filePath !== path);
        return remaining.length > 0 ? remaining : [{ id: 'tab_empty', request: createDefaultRequest(), isDirty: false }];
      });
      showToast('已从磁盘删除');
    } catch (e: any) {
      showToast(`删除失败: ${e.message}`);
    }
  };

  // 重命名节点
  const handleRenameNode = async (oldPath: string, newName: string) => {
    try {
      const newPath = await apiClient.renameFileOrFolder(oldPath, newName);
      const tree = await apiClient.loadFileTree();
      setFileTree(tree);
      setTabs(prev =>
        prev.map(t => (t.filePath === oldPath ? { ...t, filePath: newPath, request: { ...t.request, name: newName } } : t))
      );
      showToast('重命名成功');
    } catch (e: any) {
      showToast(`重命名失败: ${e.message}`);
    }
  };

  // 保存环境变量
  const handleSaveEnvironment = async (env: EnvironmentData) => {
    try {
      await apiClient.saveEnvironment(workspacePath, env);
      const envs = await apiClient.loadEnvironments(workspacePath);
      setEnvironments(envs);
      showToast(`已保存环境变量 ${env.name}`);
    } catch (e: any) {
      showToast(`保存环境变量失败: ${e.message}`);
    }
  };

  // 删除环境变量
  const handleDeleteEnvironment = async (envId: string) => {
    try {
      await apiClient.deleteEnvironment(workspacePath, envId);
      const envs = await apiClient.loadEnvironments(workspacePath);
      setEnvironments(envs);
      if (selectedEnvId === envId) {
        setSelectedEnvId(envs[0]?.id || '');
      }
      showToast('已删除环境变量');
    } catch (e: any) {
      showToast(`删除环境失败: ${e.message}`);
    }
  };

  // 从历史恢复请求
  const handleSelectHistory = (item: HistoryItem) => {
    const newTab: TabItem = {
      id: `tab_hist_${Date.now()}`,
      request: JSON.parse(JSON.stringify(item.request)),
      isDirty: true,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setResponse(item.response);
    showToast(`已从历史载入 ${item.method} 请求`);
  };

  // 导入单条 cURL
  const handleImportSingleCurl = (parsed: Partial<RequestData>) => {
    handleUpdateRequest({
      ...currentRequest,
      ...parsed,
      name: parsed.url ? `cURL_${new URL(parsed.url).pathname.split('/').pop() || '导入'}` : currentRequest.name,
      headers: parsed.headers || currentRequest.headers,
      params: parsed.params || currentRequest.params,
      body: parsed.body || currentRequest.body,
      auth: parsed.auth || currentRequest.auth,
    });
    showToast('cURL 命令已解析填充');
  };

  // 批量导入集合 (Postman / OpenAPI) 写入磁盘纯文本
  const handleImportBatchCollection = async (result: ImportedCollectionResult) => {
    try {
      for (const item of result.items) {
        // 构建目录路径
        let parentDir = workspacePath;
        for (const segment of item.folderPath) {
          parentDir = await apiClient.createFileOrFolder(parentDir, segment, true);
        }
        // 创建文件
        await apiClient.createFileOrFolder(parentDir, item.request.name, false, item.request);
      }
      const tree = await apiClient.loadFileTree();
      setFileTree(tree);
      showToast(`成功批量导入 ${result.items.length} 个接口至本地集合！`);
    } catch (e: any) {
      showToast(`批量导入失败: ${e.message}`);
    }
  };

  // 全局快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRequest();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSendRequest();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        handleNewTab();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (tabs.length > 1) {
          const tabIndex = tabs.findIndex(t => t.id === activeTabId);
          const newTabs = tabs.filter(t => t.id !== activeTabId);
          setTabs(newTabs);
          setActiveTabId(newTabs[Math.max(0, tabIndex - 1)].id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentRequest, activeTab, activeEnvironment, isSending, tabs, activeTabId]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <Header
        workspacePath={workspacePath}
        environments={environments}
        selectedEnvId={selectedEnvId}
        onSelectEnv={setSelectedEnvId}
        onOpenEnvModal={() => setIsEnvModalOpen(true)}
        onOpenCurlModal={() => setIsImportModalOpen(true)}
        onNewRequest={() => handleCreateRequest()}
        onSaveCurrentRequest={handleSaveRequest}
        onSendRequest={handleSendRequest}
        onRefreshWorkspace={loadWorkspace}
        isSending={isSending}
        isDirty={isDirty}
        activeRequestName={currentRequest.name}
      />

      {/* Main Content Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          tree={fileTree}
          history={history}
          activeFilePath={activeFilePath}
          onSelectFile={handleSelectFile}
          onSelectHistory={handleSelectHistory}
          onCreateRequest={handleCreateRequest}
          onCreateFolder={handleCreateFolder}
          onDeleteNode={handleDeleteNode}
          onRenameNode={handleRenameNode}
          onRefresh={loadWorkspace}
        />

        {/* Right Editor & Response Workspace */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Multi-Tab Bar */}
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            onCloseTab={handleCloseTab}
            onNewTab={handleNewTab}
          />

          {/* Top half: Request Editor */}
          <div className="h-[52%] flex flex-col min-h-[300px]">
            <RequestEditor
              request={currentRequest}
              environment={activeEnvironment}
              onChange={handleUpdateRequest}
              onSend={handleSendRequest}
              isSending={isSending}
            />
          </div>

          {/* Bottom half: Response Viewer */}
          <div className="flex-1 flex flex-col min-h-[240px]">
            <ResponseViewer response={response} isSending={isSending} />
          </div>
        </main>
      </div>

      {/* Environment Modal */}
      <EnvironmentModal
        isOpen={isEnvModalOpen}
        onClose={() => setIsEnvModalOpen(false)}
        environments={environments}
        onSaveEnvironment={handleSaveEnvironment}
        onDeleteEnvironment={handleDeleteEnvironment}
      />

      {/* Unified Import Modal (cURL / Postman / Swagger) */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSingle={handleImportSingleCurl}
        onImportBatchCollection={handleImportBatchCollection}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-800 border border-slate-700 text-slate-100 text-xs px-3.5 py-2 rounded-lg shadow-xl animate-fade-in flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default App;
