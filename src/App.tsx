import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { RequestEditor } from './components/RequestEditor';
import { ResponseViewer } from './components/ResponseViewer';
import { EnvironmentModal } from './components/EnvironmentModal';
import { CurlImportModal } from './components/CurlImportModal';
import { apiClient } from './services/apiClient';
import {
  RequestData,
  ResponsePayload,
  FileTreeNode,
  EnvironmentData,
  HistoryItem
} from './types/api';

const defaultBlankRequest: RequestData = {
  id: 'blank_req',
  name: '新建请求',
  method: 'GET',
  url: 'https://httpbin.org/get',
  headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
  params: [],
  body: { body_type: 'none', content: '' },
  auth: { auth_type: 'none' },
  description: '自用 API 调试',
};

export const App: React.FC = () => {
  const [workspacePath, setWorkspacePath] = useState<string>('');
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [environments, setEnvironments] = useState<EnvironmentData[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');
  const [activeFilePath, setActiveFilePath] = useState<string | undefined>(undefined);
  const [currentRequest, setCurrentRequest] = useState<RequestData>(defaultBlankRequest);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [response, setResponse] = useState<ResponsePayload | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState<boolean>(false);
  const [isCurlModalOpen, setIsCurlModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // 当前激活的环境对象
  const activeEnvironment = useMemo(() => {
    return environments.find(e => e.id === selectedEnvId) || null;
  }, [environments, selectedEnvId]);

  // 加载工作区与初始化
  const loadWorkspace = useCallback(async () => {
    try {
      // 确保初始化了样例接口库
      const ws = await apiClient.initSampleWorkspace();
      setWorkspacePath(ws);

      const tree = await apiClient.loadFileTree();
      setFileTree(tree);

      const envs = await apiClient.loadEnvironments();
      setEnvironments(envs);
      if (envs.length > 0 && !selectedEnvId) {
        setSelectedEnvId(envs[0].id);
      }

      // 如果有接口文件，默认打开第一个
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
        setActiveFilePath(firstFile);
        setCurrentRequest(req);
        setIsDirty(false);
      }
    } catch (e: any) {
      console.error('加载工作区失败:', e);
      showToast(`加载工作区失败: ${e.message}`);
    }
  }, [selectedEnvId]);

  useEffect(() => {
    loadWorkspace();

    // 加载调用历史
    const savedHistory = localStorage.getItem('tongyun_api_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch {
        // ignore
      }
    }
  }, []);

  // 选择接口文件
  const handleSelectFile = async (filePath: string) => {
    try {
      const data = await apiClient.readRequestFile(filePath);
      setActiveFilePath(filePath);
      setCurrentRequest(data);
      setIsDirty(false);
      setResponse(null);
    } catch (e: any) {
      showToast(`读取接口文件失败: ${e.message}`);
    }
  };

  // 保存接口文件 (写回本地仓库纯文本)
  const handleSaveRequest = async () => {
    if (!activeFilePath) {
      // 如果还没有路径，先在工作区根目录创建文件
      try {
        const newFilePath = await apiClient.createFileOrFolder(
          workspacePath,
          currentRequest.name || '新建请求',
          false,
          currentRequest
        );
        setActiveFilePath(newFilePath);
        setIsDirty(false);
        const tree = await apiClient.loadFileTree();
        setFileTree(tree);
        showToast('已保存为纯文本文件');
      } catch (e: any) {
        showToast(`保存失败: ${e.message}`);
      }
      return;
    }

    try {
      await apiClient.saveRequestFile(activeFilePath, currentRequest);
      setIsDirty(false);
      // 刷新树以便更新方法徽标和名称
      const tree = await apiClient.loadFileTree();
      setFileTree(tree);
      showToast('已保存');
    } catch (e: any) {
      showToast(`保存失败: ${e.message}`);
    }
  };

  // 发送 HTTP 请求
  const handleSendRequest = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      const resp = await apiClient.executeHttpRequest(currentRequest, activeEnvironment);
      setResponse(resp);

      // 记录到历史
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
      showToast('已新建接口');
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
      if (activeFilePath === path) {
        setActiveFilePath(undefined);
        setCurrentRequest(defaultBlankRequest);
        setResponse(null);
      }
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
      if (activeFilePath === oldPath) {
        setActiveFilePath(newPath);
      }
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
    setCurrentRequest(item.request);
    setResponse(item.response);
    setIsDirty(true);
    showToast(`已从历史载入 ${item.method} 请求`);
  };

  // 导入 cURL
  const handleImportCurl = (parsed: Partial<RequestData>) => {
    setCurrentRequest(prev => ({
      ...prev,
      ...parsed,
      name: parsed.url ? `cURL_${new URL(parsed.url).pathname.split('/').pop() || '导入'}` : prev.name,
      headers: parsed.headers || prev.headers,
      params: parsed.params || prev.params,
      body: parsed.body || prev.body,
      auth: parsed.auth || prev.auth,
    }));
    setIsDirty(true);
    showToast('cURL 命令已解析导入');
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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentRequest, activeFilePath, activeEnvironment, isSending]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <Header
        workspacePath={workspacePath}
        environments={environments}
        selectedEnvId={selectedEnvId}
        onSelectEnv={setSelectedEnvId}
        onOpenEnvModal={() => setIsEnvModalOpen(true)}
        onOpenCurlModal={() => setIsCurlModalOpen(true)}
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
          {/* Top half: Request Editor */}
          <div className="h-[52%] flex flex-col min-h-[300px]">
            <RequestEditor
              request={currentRequest}
              environment={activeEnvironment}
              onChange={updated => {
                setCurrentRequest(updated);
                setIsDirty(true);
              }}
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

      {/* cURL Import Modal */}
      <CurlImportModal
        isOpen={isCurlModalOpen}
        onClose={() => setIsCurlModalOpen(false)}
        onImport={handleImportCurl}
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
