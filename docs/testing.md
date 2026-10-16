# 橦云接口 · 测试指南与分层规范

本文档记录橦云接口（tongyun-api）的测试分层架构、运行方式、当前覆盖的模块清单、虚拟测试示例与测试守则。

---

## 1. 测试分层架构

橦云接口定位为**本地优先、纯文本驱动**的桌面 API 调试工具。测试分层严格按照应用关注点分离：

```
                    ┌────────────────────────────────────────┐
                    │          端到端桌面验证 (手动)          │
                    │      npm run tauri dev + examples/     │
                    └───────────────────┬────────────────────┘
                                        │
           ┌────────────────────────────┴──────────────────────────┐
           ▼                                                       ▼
┌─────────────────────────────────┐     ┌─────────────────────────────────┐
│     前端解析与断言层 (Vitest)    │     │       后端宿主与发送层 (Cargo)   │
│   src/parser/ & src/utils/      │     │   src-tauri/src/                │
│                                 │     │                                 │
│  - .http / .rest 文本解析       │     │  - 工作区递归扫描与目录过滤      │
│  - 公共与私有环境变量层级合并    │     │  - http / https 协议白名单校验  │
│  - {{变量}} 替换与缺失检测      │     │  - 同源重定向跟随 / 跨域拦截    │
│  - cURL 导入导出与代码生成       │     │  - Hop-by-hop 头安全过滤        │
│  - 自动化响应断言与变量提取      │     │  - 用例模型 Serde 与互逆读写    │
└─────────────────────────────────┘     └─────────────────────────────────┘
```

### 1.1 前端层（Vitest + TypeScript）
* **目录位置**：`src/parser/` 与 `src/utils/`
* **运行机制**：基于纯内存的 TypeScript/JavaScript 运行环境，不依赖浏览器 DOM，无外部网络强依赖，毫秒级快速反馈。
* **职责范畴**：
  * **请求文本解析**：解析 `###` 标题分隔、请求行解析、HTTP 版本清洗、默认 GET 处理、注释行过滤、`< {% ... %}` 与 `> {% ... %}` 脚本剥离、`# @name` 与 `// @name` 优先级处理、缩进 Query 参数拼装。
  * **环境配置合并**：公共环境文件 `http-client.env.json` 与本机私有环境文件 `http-client.private.env.json` 按文件树向上追溯合并，私有配置优先；点号访问嵌套字段（如 `{{auth.token}}`）；损坏 JSON 容错与提示。
  * **模板变量代入**：请求 URL、请求头、请求体中 `{{变量名}}` 的提取与替换；收集 `missing` 缺失变量并向 UI 提供告警列表以阻止误发送；标记不受支持或动态系统变量。
  * **客户端代码生成与转换**：8 种主流语言与框架代码片段生成（cURL、Fetch、Axios、Requests、HTTPX、Go、Rust）；双向 cURL 序列化与反序列化解析。
  * **断言与测试判定引擎**：深层 JSON 属性获取、各种操作符断言判定、响应内容变量提取及工业级用例生成。
  * **示例集回归**：以 `examples/` 真实用例文件为基准，确保各接口在 `httpbin` 及 `local` 环境下替换无误。

### 1.2 后端层（Cargo Test + Rust）
* **目录位置**：`src-tauri/src/`
* **运行机制**：标准的 Rust `cargo test` 单测体系，涉及文件 IO 使用 `tempfile` 临时目录，网络测试使用 `127.0.0.1:0` 本地回环 Listener。
* **职责范畴**：
  * **工作区扫描（`scan.rs`）**：安全递归遍历本地集合目录；忽略 `node_modules`、`.git`、`target`、`dist` 等黑名单与隐藏目录；保护性跳过超过 512KB 的大文件；规范化跨平台相对路径（统一使用 `/`）；深度计算与环境文件排序；自动寻找 `examples/` 目录。
  * **网络发送与协议安全（`send.rs`）**：强制仅允许 `http` 与 `https` 协议；校验标准 HTTP 方法；过滤逐跳标头（`Hop-by-hop headers` 如 `content-length`、`host`、`connection` 等）；实施重定向安全策略（限制同源跳转至多 10 次，跨主机跳转立即中断防止敏感 Header 泄漏）；响应体尺寸限制（至多 1MB）。
  * **用例数据结构与互逆读写（`lib.rs`）**：`RequestData`、`RequestBody`、`RequestAuth`、`EnvironmentData` 等核心模型的 JSON 序列化/反序列化完整性；默认集合目录路径推导；支持 `.json` 结构化文件与 `.http` 纯文本文件的读取与写入互逆一致性。

---

## 2. 如何运行测试

在仓库根目录下执行对应 npm 命令：

| 目的 | 命令 | 底层工具 | 说明 |
| --- | --- | --- | --- |
| **前端全量单测** | `npm test` | `vitest run` | 运行所有解析器、工具函数与断言引擎的测试用例 |
| **前端单文件针对性测试** | `npm test -- src/parser/parser.test.ts` | `vitest run <file>` | 快速定位并调试指定测试套件 |
| **前端类型检查** | `npm run typecheck` | `tsc --noEmit` | 静态类型核验，确保无类型错误 |
| **前端生产构建** | `npm run build` | `tsc && vite build` | 验证前端能够顺利编译出生产静态文件 |
| **后端 Rust 语法检查** | `npm run check:rust` | `cargo check --manifest-path src-tauri/Cargo.toml` | 检查后端代码语法与依赖调用 |
| **后端 Rust 单测** | `npm run test:rust` | `cargo test --manifest-path src-tauri/Cargo.toml` | 执行后端目录扫描、网络安全性及用例数据单测 |
| **后端单项过滤测试** | `npm run test:rust -- scans_empty` | `cargo test --manifest-path src-tauri/Cargo.toml -- <filter>` | 仅运行名称匹配的 Rust 单元测试 |
| **全量自动化流水线** | `npm run check` | 串联所有检查 | 自动化验收门禁：类型检查 + Vitest + Rust check + Rust test |

---

## 3. 当前覆盖的模块清单

### 3.1 前端模块清单
* `src/parser/httpFile.ts` (`src/parser/parser.test.ts`)
  * `parseHttpFile`：请求切分、请求行格式化、注释行过滤、前置/响应脚本过滤、`# @name` / `// @name` 自定义命名优先级、URL 缩进 Query 语法合并、外部文件引用警告、格式容错。
  * `examples/` 示例集解析验证（`basics.http`、`methods.http`、`headers-auth.http`、`json-body.http`、`variables.http`）。
* `src/parser/env.ts` (`src/parser/env.test.ts`)
  * `mergeEnvironmentLayers`：公共环境与私有环境合并、路径由近及远层级覆盖、嵌套 JSON 对象展开为点号路径、非法 JSON 容错。
  * `flattenVariables`：嵌套对象扁平化与基本类型保留。
* `src/parser/substitute.ts` (`src/parser/substitute.test.ts`)
  * `substitute`：模板插值、重复变量替换、缺失变量收集。
  * `resolveRequest`：整合 URL、Headers、Body 的变量替换，敏感键掩码脱敏，动态系统变量识别（`$uuid`、`$timestamp` 等）。
* `src/utils/curl.ts` (`src/utils/curl.test.ts`)
  * `interpolateText`：cURL 文本变量安全插值。
  * `exportToCurl`：将内部请求模型转为标准可执行 cURL 文本。
  * `parseCurl`：将单条 cURL 命令行反解为内部请求模型。
* `src/utils/codeGenerators.ts` (`src/utils/codeGenerators.test.ts`)
  * 8 种主流语言与框架代码生成器输出校验（cURL、JavaScript Fetch/Axios、TypeScript、Python requests/httpx、Go、Rust reqwest）。
* `src/utils/importers.ts` (`src/utils/importers.test.ts`)
  * Postman Collection v2.1 格式导入解析。
  * OpenAPI 3.0 / Swagger 规范解析导入。
  * 原生 `.http` 集合文件解析导入。
* `src/utils/tester.ts` (`src/utils/tester.test.ts`)
  * `getNestedValue`：安全提取深层嵌套字段及数组元素。
  * `evaluateAssertions`：状态码、响应耗时、JSON 路径与响应头断言引擎。
  * `extractVariables`：从响应 JSON 或 Header 提取字段并注入环境变量。
  * `generateSmartAssertions` & `generateAiTestCaseSuite`：智能测试用例集生成。

### 3.2 后端模块清单
* `src-tauri/src/scan.rs`
  * `scan_workspace`：工作区深度遍历、黑名单目录跳过、`.http` 与 `.rest` 扩展名识别、大文件限制与告警。
  * `depth`：路径深度计算。
  * `kind_rank`：环境类型权重排序（`public` 优先于 `private` 排序规则）。
  * `relative`：跨平台路径相对化与正斜杠标准化。
  * `find_examples_dir`：向上搜索定位 `examples/` 示例目录。
* `src-tauri/src/send.rs`
  * `validate`：请求方法合法性校验、URL 格式与 Scheme 协议校验（拦截 `file://`、`ftp://`、`ws://` 等非 HTTP 协议）。
  * `is_hop_by_hop`：逐跳标头识别（大小写不敏感）。
  * `redirect_policy`：同源重定向放行与跨主机重定向拦截。
  * `execute`：端到端本地 TcpListener 接收验证，包括状态码、耗时、响应头、正文读取。
* `src-tauri/src/lib.rs`
  * `get_default_workspace`：默认工作区路径后缀核验。
  * `RequestData` & `EnvironmentData`：Serde 序列化与反序列化双向一致性。
  * `read_request_file` & `save_request_file`：`.json` 与 `.http` 格式文件读写测试。

---

## 4. 编写与维护测试守则

1. **绝对中立与脱敏**：
   * 测试代码与示例数据中严禁包含任何真实内网地址、公司域名、本机私有绝对路径或真实认证 Token。
   * 地址必须使用中立虚拟域名或沙箱地址（如 `https://httpbin.org`、`https://api.example.com`、`http://127.0.0.1`）。
   * 凭据占位符仅允许使用 `sample-token`、`replace-me`、`secret-key-placeholder` 等虚拟标识。
2. **纯函数优先**：
   * 前端单元测试优先针对纯计算函数编写（如解析器、插值器、断言判定），杜绝外部网络侧漏。
   * 涉及文件系统测试时，必须使用临时隔离目录（如 Rust 中的 `tempfile::tempdir()`），运行后立即释放，避免污染实际工作区。
3. **快速与幂等**：
   * 单元测试必须具备毫秒级执行速度，保持多次执行结果确定且无顺序依赖。

---

## 5. 虚拟测试示例 (Fictional Examples)

以下为测试套件中常见的核心逻辑虚拟用例编写范式，供新增测试时参考。

### 5.1 纯文本 `.http` 文件解析与变量插值测试

```typescript
import { describe, expect, it } from "vitest";
import { parseHttpFile } from "./httpFile";
import { resolveRequest } from "./substitute";

describe("虚拟接口解析与环境替换示例", () => {
  it("正确解析请求行、请求头并替换多层环境变量", () => {
    // 虚拟 .http 纯文本内容
    const httpContent = `### 查询虚拟商品详情
GET {{apiHost}}/v1/products/{{productId}}?category={{category}}
Authorization: Bearer {{auth.token}}
Accept: application/json
`;

    // 虚拟环境上下文
    const environmentVariables = {
      apiHost: "https://httpbin.org",
      productId: "prod_10029",
      category: "electronics",
      "auth.token": "sample-fictional-bearer-token",
    };

    // 1. 解析纯文本
    const parsed = parseHttpFile(httpContent);
    expect(parsed.requests).toHaveLength(1);
    expect(parsed.requests[0].name).toBe("查询虚拟商品详情");

    // 2. 代入环境求值
    const resolved = resolveRequest(parsed.requests[0], environmentVariables);
    expect(resolved.url).toBe("https://httpbin.org/v1/products/prod_10029?category=electronics");
    expect(resolved.headers.find((h) => h.name === "Authorization")?.value).toBe(
      "Bearer sample-fictional-bearer-token"
    );
    expect(resolved.missingVariables).toEqual([]);
  });
});
```

### 5.2 响应断言判定引擎与变量提取测试

```typescript
import { describe, expect, it } from "vitest";
import { evaluateAssertions, extractVariables } from "./tester";
import type { RequestAssertion, ResponsePayload, VariableExtraction } from "../types/api";

describe("虚拟响应断言与提取测试", () => {
  const fictionalResponse: ResponsePayload = {
    status: 200,
    status_text: "OK",
    headers: [
      { key: "Content-Type", value: "application/json", enabled: true },
      { key: "X-Request-Id", value: "req-fictional-99", enabled: true },
    ],
    body: JSON.stringify({
      code: 0,
      message: "success",
      data: {
        userId: "usr_42",
        sessionToken: "sess_xyz_789",
      },
    }),
    time_ms: 120,
    size_bytes: 104,
    is_json: true,
  };

  it("多项断言全部通过", () => {
    const assertions: RequestAssertion[] = [
      { type: "status_code", operator: "equals", expected: "200", enabled: true },
      { type: "response_time", operator: "less_than", expected: "300", enabled: true },
      { type: "json_path", operator: "equals", target_path: "data.userId", expected: "usr_42", enabled: true },
      { type: "header", operator: "contains", target_path: "Content-Type", expected: "json", enabled: true },
    ];

    const results = evaluateAssertions(assertions, fictionalResponse);
    expect(results).toHaveLength(4);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("级联提取凭证存入下一轮环境变量", () => {
    const extractions: VariableExtraction[] = [
      {
        source: "json_body",
        expression: "data.sessionToken",
        target_variable: "activeSession",
        enabled: true,
      },
    ];

    const updatedEnv = extractVariables(extractions, fictionalResponse);
    expect(updatedEnv.activeSession).toBe("sess_xyz_789");
  });
});
```

### 5.3 后端 Rust 目录隔离测试范式

```rust
#[cfg(test)]
mod tests {
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_fictional_workspace_scan() {
        // 创建隔离的临时目录，测试结束后自动销毁
        let temp_workspace = tempdir().unwrap();
        let base_path = temp_workspace.path();

        // 写入虚拟测试文件
        let test_file = base_path.join("fictional_api.http");
        fs::write(&test_file, "GET https://httpbin.org/get\n").unwrap();

        // 执行扫描逻辑验证
        let scanned = scan_workspace(base_path).unwrap();
        assert_eq!(scanned.http_files.len(), 1);
        assert_eq!(scanned.http_files[0].relative_path, "fictional_api.http");
    }
}
```

当前 Agent 授权、Runner 行为与持久化审计契约见 [Agent 安全与追溯](agent-safety.md)。

本轮执行证据：[2026-10-16 Agent 安全与追溯](testing/runs/2026-10-16-agent-safety.md)。
