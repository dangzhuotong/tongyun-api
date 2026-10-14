# 橦云接口 · 测试指南与分层规范

本文档记录橦云接口（tongyun-api）的测试分层架构、运行方式、当前覆盖的模块清单与测试守则。

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
│     前端解析与环境层 (Vitest)    │     │       后端宿主与发送层 (Cargo)   │
│   src/parser/                   │     │   src-tauri/src/                │
│                                 │     │                                 │
│  - .http / .rest 文本解析       │     │  - 工作区递归扫描与目录过滤      │
│  - 公共与私有环境变量层级合并    │     │  - http / https 协议白名单校验  │
│  - {{变量}} 替换与缺失检测      │     │  - 同源重定向跟随 / 跨域拦截    │
│  - 脚本与注释安全剔除           │     │  - Hop-by-hop 头过滤            │
│  - 示例文件全量解析回归         │     │  - 用例模型 Serde 与互逆读写    │
└─────────────────────────────────┘     └─────────────────────────────────┘
```

### 1.1 前端层（Vitest + TypeScript）
* **目录位置**：`src/parser/` 及测试文件 `src/parser/parser.test.ts`
* **运行机制**：基于纯内存的 TypeScript/JavaScript 运行环境，不依赖浏览器 DOM，无外部网络依赖，毫秒级快速反馈。
* **职责范畴**：
  * **请求文本解析**：解析 `###` 标题分隔、请求行解析、HTTP 版本清洗、默认 GET 处理、注释行过滤、`< {% ... %}` 与 `> {% ... %}` 脚本剥离、`# @name` 与 `// @name` 优先级处理、缩进 Query 参数拼装。
  * **环境配置合并**：公共环境文件 `http-client.env.json` 与本机私有环境文件 `http-client.private.env.json` 按文件树向上追溯合并，私有配置优先；点号访问嵌套字段（如 `{{auth.token}}`）；损坏 JSON 容错与提示。
  * **模板变量代入**：请求 URL、请求头、请求体中 `{{变量名}}` 的提取与替换；收集 `missing` 缺失变量并向 UI 提供告警列表以阻止误发送；标记不受支持或动态系统变量。
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
| **前端单测** | `npm test` | `vitest run` | 运行所有解析器与环境替换的测试用例 |
| **前端类型检查** | `npm run typecheck` | `tsc --noEmit` | 静态类型核验，确保无类型错误 |
| **前端生产构建** | `npm run build` | `tsc && vite build` | 验证前端能够顺利编译出生产静态文件 |
| **后端 Rust 检查** | `npm run check:rust` | `cargo check --manifest-path src-tauri/Cargo.toml` | 检查后端代码语法与依赖调用 |
| **后端 Rust 单测** | `npm run test:rust` | `cargo test --manifest-path src-tauri/Cargo.toml` | 执行后端目录扫描、网络安全性及用例数据单测 |
| **全量自动化流水线** | `npm run check` | 串联所有检查 | 自动化验收前必跑：类型检查 + Vitest + Rust check + Rust test |

---

## 3. 当前覆盖的模块清单

### 3.1 前端模块清单
* `src/parser/httpFile.ts`
  * `parseHttpFile`：请求切分、请求行格式化、注释行过滤、前置/响应脚本过滤、`# @name` / `// @name` 自定义命名优先级、URL 缩进 Query 语法合并、外部文件引用警告、格式容错。
* `src/parser/env.ts`
  * `mergeEnvironmentLayers`：公共环境与私有环境合并、路径由近及远层级覆盖、嵌套 JSON 对象展开为点号路径、非法 JSON 告警。
* `src/parser/substitute.ts`
  * `substitute`：模板插值、重复变量替换、缺失变量收集。
  * `resolveRequest`：整合 URL、Headers、Body 的变量替换，敏感键掩码脱敏，动态系统变量识别与解析。
* `src/parser/parser.test.ts`
  * 覆盖以上纯函数及 `examples/httpbin/` 用例文件的实际解析验证。

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

1. **绝对纯净**：
   * 测试中严禁包含任何真实内网地址、公司域名、本机私有绝对路径或真实认证 Token。
   * 必须使用 `https://httpbin.org`、`http://127.0.0.1`、`http://localhost` 或本地临时端口。
   * 令牌占位符仅允许使用 `secret`、`replace-me`、`sample-token` 或 `public-placeholder`。
2. **纯函数优先**：
   * 优先测试确定性高、无副作用的纯计算逻辑。
   * 涉及文件系统测试时，必须使用 `tempfile::tempdir()`，避免污染实际工作区或源码目录。
3. **保持测试速度**：
   * 单元测试保持秒级运行完毕，不得在测试中引入无意义的长时等待。
