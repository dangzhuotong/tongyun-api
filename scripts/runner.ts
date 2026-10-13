import fs from 'node:fs';
import path from 'node:path';
import { parseHttpFile } from '../src/parser/httpFile.ts';
import { mergeEnvironmentLayers, type EnvLayer } from '../src/parser/env.ts';
import { resolveRequest } from '../src/parser/substitute.ts';

interface CliArgs {
  targetPath: string;
  envName?: string;
  jsonOutput: boolean;
  bail: boolean;
  delayMs: number;
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  let targetPath = '';
  let envName: string | undefined = undefined;
  let jsonOutput = false;
  let bail = false;
  let delayMs = 50;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') {
      jsonOutput = true;
    } else if (arg === '--bail') {
      bail = true;
    } else if (arg === '--env' && i + 1 < args.length) {
      envName = args[++i];
    } else if (arg === '--delay' && i + 1 < args.length) {
      delayMs = parseInt(args[++i], 10) || 0;
    } else if (!arg.startsWith('-') && !targetPath) {
      targetPath = arg;
    }
  }

  if (!targetPath) {
    targetPath = 'examples/httpbin/basics.http';
  }

  return { targetPath, envName, jsonOutput, bail, delayMs };
}

function findEnvLayers(filePath: string): EnvLayer[] {
  const layers: EnvLayer[] = [];
  let currentDir = path.resolve(path.dirname(filePath));
  const repoRoot = path.resolve(process.cwd());

  const searchDirs: string[] = [];
  while (true) {
    searchDirs.push(currentDir);
    if (currentDir === repoRoot || path.dirname(currentDir) === currentDir) {
      break;
    }
    currentDir = path.dirname(currentDir);
  }

  // 从上层往下层添加，保证子目录 private/public 可以覆盖上层
  for (const dir of searchDirs.reverse()) {
    const pubPath = path.join(dir, 'http-client.env.json');
    if (fs.existsSync(pubPath)) {
      try {
        layers.push({
          path: pubPath,
          kind: 'public',
          content: fs.readFileSync(pubPath, 'utf-8'),
        });
      } catch {}
    }

    const privPath = path.join(dir, 'http-client.private.env.json');
    if (fs.existsSync(privPath)) {
      try {
        layers.push({
          path: privPath,
          kind: 'private',
          content: fs.readFileSync(privPath, 'utf-8'),
        });
      } catch {}
    }
  }

  return layers;
}

async function executeSingleRequest(
  method: string,
  url: string,
  headers: { name: string; value: string }[],
  body: string
): Promise<{ status: number; statusText: string; timeMs: number; bodyPreview: string }> {
  const startTime = Date.now();
  const headerObj: Record<string, string> = {};
  for (const h of headers) {
    headerObj[h.name] = h.value;
  }

  const fetchOptions: RequestInit = {
    method,
    headers: headerObj,
    redirect: 'manual',
  };

  if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && body) {
    fetchOptions.body = body;
  }

  try {
    const res = await fetch(url, fetchOptions);
    const timeMs = Date.now() - startTime;
    let respText = '';
    try {
      respText = await res.text();
    } catch {
      respText = '';
    }

    return {
      status: res.status,
      statusText: res.statusText || 'OK',
      timeMs,
      bodyPreview: respText.slice(0, 500),
    };
  } catch (err: any) {
    const timeMs = Date.now() - startTime;
    return {
      status: 0,
      statusText: err.message || 'Network Error',
      timeMs,
      bodyPreview: `连接异常: ${err.message}`,
    };
  }
}

async function run() {
  const { targetPath, envName, jsonOutput, bail, delayMs } = parseCliArgs();
  const absolutePath = path.resolve(process.cwd(), targetPath);

  if (!fs.existsSync(absolutePath)) {
    if (jsonOutput) {
      console.log(JSON.stringify({ error: `目标文件不存在: ${targetPath}` }));
    } else {
      console.error(`❌ 错误: 目标文件不存在: ${targetPath}`);
    }
    process.exit(1);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const parsedHttp = parseHttpFile(content);

  // 环境文件解析与变量层级继承
  const layers = findEnvLayers(absolutePath);
  const mergedEnv = mergeEnvironmentLayers(layers);

  const activeEnvName = envName || mergedEnv.names[0] || 'httpbin';
  const variables = mergedEnv.variables[activeEnvName] || {};

  if (!jsonOutput) {
    console.log(`\n======================================================`);
    console.log(` 🤖 橦云接口 · AI 原生命令行执行器 (Headless Runner)`);
    console.log(`======================================================`);
    console.log(` 📁 运行文件 : ${targetPath}`);
    console.log(` 🌐 激活环境 : ${activeEnvName} (已载入 ${Object.keys(variables).length} 个变量)`);
    console.log(` 📋 请求数量 : ${parsedHttp.requests.length} 个`);
    console.log(`------------------------------------------------------\n`);
  }

  const results: any[] = [];
  let passedCount = 0;
  let failedCount = 0;
  const startTime = Date.now();

  for (let idx = 0; idx < parsedHttp.requests.length; idx++) {
    const req = parsedHttp.requests[idx];
    const resolved = resolveRequest(req, variables, { resolveDynamic: true });

    const execResult = await executeSingleRequest(
      resolved.method,
      resolved.url,
      resolved.headers,
      resolved.body
    );

    const isPassed = execResult.status >= 200 && execResult.status < 400;
    if (isPassed) {
      passedCount++;
    } else {
      failedCount++;
    }

    const itemRecord = {
      index: idx + 1,
      name: req.name,
      method: resolved.method,
      url: resolved.url,
      status: execResult.status,
      statusText: execResult.statusText,
      timeMs: execResult.timeMs,
      passed: isPassed,
      bodyPreview: execResult.bodyPreview,
    };
    results.push(itemRecord);

    if (!jsonOutput) {
      const mark = isPassed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✕\x1b[0m';
      const statusPill = isPassed
        ? `\x1b[32m[${execResult.status} ${execResult.statusText}]\x1b[0m`
        : `\x1b[31m[${execResult.status || 'ERROR'} ${execResult.statusText}]\x1b[0m`;
      const methodPill = `\x1b[36m${resolved.method.padEnd(6)}\x1b[0m`;

      console.log(` ${mark} ${statusPill} ${methodPill} ${req.name} (${execResult.timeMs}ms)`);
      console.log(`   ↳ \x1b[90m${resolved.url}\x1b[0m`);
    }

    if (!isPassed && bail) {
      if (!jsonOutput) {
        console.log(`\n\x1b[33m⚠️ 已因 --bail 选项在失败用例处中断。\x1b[0m`);
      }
      break;
    }

    if (delayMs > 0 && idx < parsedHttp.requests.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  const totalTimeMs = Date.now() - startTime;

  if (jsonOutput) {
    const summary = {
      targetFile: targetPath,
      environment: activeEnvName,
      total: results.length,
      passed: passedCount,
      failed: failedCount,
      totalTimeMs,
      results,
    };
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`\n------------------------------------------------------`);
    console.log(
      ` 📊 回归测试完成: \x1b[32m${passedCount} 通过\x1b[0m, ${
        failedCount > 0 ? `\x1b[31m${failedCount} 失败\x1b[0m` : '0 失败'
      } (总用时: ${totalTimeMs}ms)`
    );
    console.log(`======================================================\n`);
  }

  // 记录到本地 Trace 审计历史供桌面应用人类观测台审查
  try {
    const tracePath = path.resolve(process.cwd(), '.tongyun-trace.json');
    let existingLogs: any[] = [];
    if (fs.existsSync(tracePath)) {
      try {
        existingLogs = JSON.parse(fs.readFileSync(tracePath, 'utf-8'));
      } catch {}
    }
    const newLogs = [
      ...results.map(r => ({
        id: `log_cli_${Date.now()}_${r.index}`,
        timestamp: Date.now(),
        source: 'cli',
        requestName: r.name,
        method: r.method,
        url: r.url,
        status: r.status,
        statusText: r.statusText,
        timeMs: r.timeMs,
        sizeBytes: r.bodyPreview.length,
        assertionsTotal: 1,
        assertionsPassed: r.passed ? 1 : 0,
        request: {
          id: `cli_req_${Date.now()}_${r.index}`,
          name: r.name,
          method: r.method,
          url: r.url,
          headers: [],
          params: [],
          body: { body_type: 'none', content: '' },
          auth: { auth_type: 'none' },
        },
        response: {
          status: r.status,
          status_text: r.statusText,
          headers: [],
          body: r.bodyPreview,
          time_ms: r.timeMs,
          size_bytes: r.bodyPreview.length,
          is_json: r.bodyPreview.trim().startsWith('{') || r.bodyPreview.trim().startsWith('['),
        },
      })),
      ...existingLogs,
    ].slice(0, 100);
    fs.writeFileSync(tracePath, JSON.stringify(newLogs, null, 2), 'utf-8');
  } catch {}

  process.exit(failedCount > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal CLI runner error:', err);
  process.exit(1);
});
