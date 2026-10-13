import React, { useState, useMemo } from 'react';
import {
  X,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Layers,
  Copy,
  Check,
  Bot,
  Zap
} from 'lucide-react';
import {
  FileTreeNode,
  EnvironmentData,
  RequestData,
  ResponsePayload,
  BatchRunReport,
  BatchRunItemResult,
  ExecutionLogItem
} from '../types/api';
import { getMethodBadgeColor } from './Sidebar';

interface CollectionRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileTree: FileTreeNode[];
  environments: EnvironmentData[];
  selectedEnvId: string;
  onExecuteRequestFile: (filePath: string, env: EnvironmentData | null) => Promise<{ request: RequestData; response: ResponsePayload }>;
  onRecordLog: (log: ExecutionLogItem) => void;
  showToast: (msg: string) => void;
}

export const CollectionRunnerModal: React.FC<CollectionRunnerModalProps> = ({
  isOpen,
  onClose,
  fileTree,
  environments,
  selectedEnvId,
  onExecuteRequestFile,
  onRecordLog,
  showToast,
}) => {
  const [selectedEnv, setSelectedEnv] = useState<string>(selectedEnvId);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [stopOnFailure, setStopOnFailure] = useState(false);
  const [delayMs, setDelayMs] = useState<number>(100);

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [report, setReport] = useState<BatchRunReport | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedAiPrompt, setCopiedAiPrompt] = useState(false);

  // 递归提取所有 .json / .http 请求文件
  const allRequestFiles = useMemo(() => {
    const files: { path: string; name: string; folder: string }[] = [];

    const traverse = (nodes: FileTreeNode[], currentFolder: string) => {
      for (const node of nodes) {
        if (node.is_dir) {
          if (node.children) {
            traverse(node.children, node.name);
          }
        } else {
          files.push({
            path: node.path,
            name: node.name,
            folder: currentFolder || '根目录',
          });
        }
      }
    };

    traverse(fileTree, '');
    return files;
  }, [fileTree]);

  // 根据选定文件夹过滤文件
  const targetFiles = useMemo(() => {
    if (selectedFolder === 'all') return allRequestFiles;
    return allRequestFiles.filter(f => f.folder === selectedFolder);
  }, [allRequestFiles, selectedFolder]);

  // 获取所有独立分组文件夹名
  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const f of allRequestFiles) {
      if (f.folder) set.add(f.folder);
    }
    return Array.from(set);
  }, [allRequestFiles]);

  if (!isOpen) return null;

  const currentEnvObj = environments.find(e => e.id === selectedEnv) || null;

  // 开始跑批
  const handleStartRun = async () => {
    if (targetFiles.length === 0 || isRunning) return;

    setIsRunning(true);
    setProgress({ current: 0, total: targetFiles.length });
    const startTime = Date.now();
    const results: BatchRunItemResult[] = [];

    for (let i = 0; i < targetFiles.length; i++) {
      const file = targetFiles[i];
      setProgress({ current: i + 1, total: targetFiles.length });

      try {
        const { request, response } = await onExecuteRequestFile(file.path, currentEnvObj);

        const assertions = response.test_results || [];
        const passedAssertions = assertions.filter(a => a.passed).length;
        const totalAssertions = assertions.length;
        const isPassed = response.status >= 200 && response.status < 400 && (totalAssertions === 0 || passedAssertions === totalAssertions);

        results.push({
          requestName: request.name || file.name,
          method: request.method,
          url: request.url,
          status: response.status,
          timeMs: response.time_ms,
          passed: isPassed,
          assertionResults: assertions,
        });

        // 记入 AI 审计流
        onRecordLog({
          id: `log_runner_${Date.now()}_${i}`,
          timestamp: Date.now(),
          source: 'runner',
          requestName: request.name || file.name,
          method: request.method,
          url: request.url,
          status: response.status,
          statusText: response.status_text,
          timeMs: response.time_ms,
          sizeBytes: response.size_bytes,
          assertionsTotal: totalAssertions,
          assertionsPassed: passedAssertions,
          request,
          response,
        });

        if (!isPassed && stopOnFailure) {
          showToast(`已在失败用例处中断: ${request.name}`);
          break;
        }
      } catch (err: any) {
        results.push({
          requestName: file.name,
          method: 'GET',
          url: file.path,
          status: 0,
          timeMs: 0,
          passed: false,
          assertionResults: [],
          error: err.message || String(err),
        });

        if (stopOnFailure) {
          showToast(`执行发生异常，已中断`);
          break;
        }
      }

      if (delayMs > 0 && i < targetFiles.length - 1) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    const totalTimeMs = Date.now() - startTime;
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.length - passedCount;

    setReport({
      id: `report_${Date.now()}`,
      timestamp: Date.now(),
      collectionName: selectedFolder === 'all' ? '全部测试集合' : selectedFolder,
      total: results.length,
      passed: passedCount,
      failed: failedCount,
      totalTimeMs,
      results,
    });

    setIsRunning(false);
    showToast(`批量测试完成：${passedCount}/${results.length} 通过`);
  };

  // 复制 Markdown 报告
  const handleCopyMarkdownReport = () => {
    if (!report) return;

    const md = `# 📊 橦云接口 · 批量测试套件执行报告

- **测试集合**: ${report.collectionName}
- **执行环境**: ${currentEnvObj?.name || '默认/无'}
- **执行时间**: ${new Date(report.timestamp).toLocaleString()}
- **总用例数**: ${report.total}
- **通过数量**: ${report.passed} (${Math.round((report.passed / report.total) * 100)}%)
- **失败数量**: ${report.failed}
- **总耗时**: ${report.totalTimeMs} ms

## 用例明细清单

| 状态 | 方法 | 接口名称 | HTTP 状态 | 耗时 | 断言结果 |
| :--- | :--- | :--- | :--- | :--- | :--- |
${report.results
  .map(
    r =>
      `| ${r.passed ? '✅ 通过' : '❌ 失败'} | \`${r.method}\` | ${r.requestName} | ${r.status || 'Error'} | ${r.timeMs}ms | ${
        r.assertionResults.length > 0
          ? `${r.assertionResults.filter(a => a.passed).length}/${r.assertionResults.length}`
          : '无断言'
      } |`
  )
  .join('\n')}
`.trim();

    navigator.clipboard.writeText(md);
    setCopiedReport(true);
    showToast('已复制 Markdown 测试报告');
    setTimeout(() => setCopiedReport(false), 2000);
  };

  // 复制失败用例的 AI 批量修复 Prompt
  const handleCopyFailedAiPrompt = () => {
    if (!report) return;
    const failures = report.results.filter(r => !r.passed);
    if (failures.length === 0) {
      showToast('所有用例均已通过，无需 AI 修复！');
      return;
    }

    const md = `# 🤖 橦云接口 · 批量测试失败修复任务

在自动化跑批中检测到以下 **${failures.length}** 个接口出现异常或断言未达成，请协助分析并输出修复方案：

${failures
  .map(
    (f, idx) => `### 缺陷 ${idx + 1}: ${f.requestName}
- **请求行**: \`${f.method} ${f.url}\`
- **响应状态**: \`${f.status}\` (耗时: ${f.timeMs}ms)
${f.error ? `- **底层异常**: ${f.error}` : ''}
${
  f.assertionResults.length > 0
    ? `- **未达标断言**:\n` +
      f.assertionResults
        .filter(a => !a.passed)
        .map(a => `  - ❌ ${a.assertion.name}: ${a.message} (实际: ${a.actual})`)
        .join('\n')
    : '- **判定失败原因**: HTTP 状态码异常'
}
`
  )
  .join('\n')}

## 修复目标与指引
1. 排查这些接口在服务端或测试用例中的实现缺陷；
2. 给出服务端修复代码或修正后的 .http 用例。
`.trim();

    navigator.clipboard.writeText(md);
    setCopiedAiPrompt(true);
    showToast('已复制失败用例 AI 修复 Prompt');
    setTimeout(() => setCopiedAiPrompt(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-4xl h-[85vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-100">批量测试套件执行器 (Collection Runner)</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                  AUTOMATION
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                顺序执行指定目录或全量纯文本接口用例，自动校验断言并生成测试报告
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-4 bg-slate-950/30 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            {/* Target Folder */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">测试范围:</span>
              <select
                value={selectedFolder}
                onChange={e => {
                  setSelectedFolder(e.target.value);
                  setReport(null);
                }}
                disabled={isRunning}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2.5 py-1.5 text-xs outline-none focus:border-sky-500"
              >
                <option value="all">全量接口 ({allRequestFiles.length} 个文件)</option>
                {folders.map(f => (
                  <option key={f} value={f}>
                    📁 {f} ({allRequestFiles.filter(item => item.folder === f).length} 个)
                  </option>
                ))}
              </select>
            </div>

            {/* Environment */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">执行环境:</span>
              <select
                value={selectedEnv}
                onChange={e => setSelectedEnv(e.target.value)}
                disabled={isRunning}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2.5 py-1.5 text-xs outline-none focus:border-sky-500"
              >
                <option value="">默认 / 无环境</option>
                {environments.map(e => (
                  <option key={e.id} value={e.id}>
                    🌐 {e.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Delay */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400">间隔延迟:</span>
              <select
                value={delayMs}
                onChange={e => setDelayMs(Number(e.target.value))}
                disabled={isRunning}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1.5 text-xs outline-none"
              >
                <option value={0}>0 ms (无延迟)</option>
                <option value={100}>100 ms</option>
                <option value={300}>300 ms</option>
                <option value={1000}>1000 ms</option>
              </select>
            </div>

            {/* Stop on Failure */}
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={stopOnFailure}
                onChange={e => setStopOnFailure(e.target.checked)}
                disabled={isRunning}
                className="rounded accent-emerald-500"
              />
              <span>遇错中止 (Bail)</span>
            </label>
          </div>

          {/* Action Run Button */}
          <button
            onClick={handleStartRun}
            disabled={isRunning || targetFiles.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>跑批中 ({progress.current}/{progress.total})...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>开始跑批 ({targetFiles.length} 个用例)</span>
              </>
            )}
          </button>
        </div>

        {/* Progress Bar (Visible when running) */}
        {isRunning && (
          <div className="h-1 bg-slate-950 w-full overflow-hidden shrink-0">
            <div
              className="h-full bg-emerald-500 transition-all duration-200"
              style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%` }}
            />
          </div>
        )}

        {/* Result Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {!report && !isRunning ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16">
              <Layers className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-300">准备就绪，点击右上角按钮开始回归测试</p>
              <p className="text-xs text-slate-500 mt-1">
                选定范围内共检测到 {targetFiles.length} 个纯文本接口用例文件
              </p>
            </div>
          ) : report ? (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <div className="text-[11px] text-slate-400">总执行用例</div>
                  <div className="text-xl font-bold font-mono text-slate-100 mt-1">{report.total}</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <div className="text-[11px] text-slate-400">测试通过</div>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                    {report.passed} ({Math.round((report.passed / Math.max(1, report.total)) * 100)}%)
                  </div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <div className="text-[11px] text-slate-400">测试失败</div>
                  <div className={`text-xl font-bold font-mono mt-1 ${report.failed > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {report.failed}
                  </div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <div className="text-[11px] text-slate-400">总执行耗时</div>
                  <div className="text-xl font-bold font-mono text-indigo-400 mt-1">{report.totalTimeMs} ms</div>
                </div>
              </div>

              {/* Action Toolbar for Report */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-semibold text-slate-200">执行用例详情列表</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyMarkdownReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                  >
                    {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>复制 Markdown 报告</span>
                  </button>

                  {report.failed > 0 && (
                    <button
                      onClick={handleCopyFailedAiPrompt}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors"
                    >
                      {copiedAiPrompt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Bot className="w-3.5 h-3.5" />}
                      <span>打包失败用例发给 AI 修复</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Table List */}
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="w-12 px-3 py-2 text-center">状态</th>
                      <th className="w-16 px-3 py-2">方法</th>
                      <th className="px-3 py-2">接口用例名称与地址</th>
                      <th className="w-24 px-3 py-2 text-center">HTTP 码</th>
                      <th className="w-20 px-3 py-2 text-center">耗时</th>
                      <th className="w-28 px-3 py-2 text-center">断言结果</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {report.results.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="px-3 py-2 text-center">
                          {item.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400 mx-auto" />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getMethodBadgeColor(item.method)}`}>
                            {item.method}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-sans">
                          <div className="font-medium text-slate-200">{item.requestName}</div>
                          <div className="text-[11px] font-mono text-slate-400 truncate max-w-md">{item.url}</div>
                          {item.error && <div className="text-[11px] text-rose-400 mt-0.5">{item.error}</div>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              item.status >= 200 && item.status < 400
                                ? 'text-emerald-400 bg-emerald-500/10'
                                : 'text-rose-400 bg-rose-500/10'
                            }`}
                          >
                            {item.status || 'Err'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-slate-400">{item.timeMs}ms</td>
                        <td className="px-3 py-2 text-center font-sans">
                          {item.assertionResults.length > 0 ? (
                            <span
                              className={`text-[11px] ${
                                item.assertionResults.every(a => a.passed) ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {item.assertionResults.filter(a => a.passed).length}/{item.assertionResults.length}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">无</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="h-12 px-5 border-t border-slate-800 flex items-center justify-between bg-slate-950/50 shrink-0 text-xs text-slate-400">
          <span>待执行目标：{targetFiles.length} 个接口文件</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            关闭跑批窗口
          </button>
        </div>
      </div>
    </div>
  );
};
