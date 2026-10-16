# 橦云接口 (tongyun-api)

> **本地优先 · 纯文本驱动 · Git 原生协作的 API 调试桌面客户端**  
> 支持 **IntelliJ `.http` / `.rest`** 规范与 **JSON 纯文本用例集** 双重协议，零云端账号绑定，数据留在本机仓库，天然支持 Git 分支管理与 Pull Request 审查。

---

## ✨ 核心特性

- 📄 **双重纯文本格式支持**：
  - **IntelliJ `.http` / `.rest` 协议**：支持以 `###` 分隔、`# @name` 命名的标准文本接口文件，支持 `http-client.env.json` 与 `http-client.private.env.json` 环境继承。
  - **模块化 JSON 用例集**：存放在 `./tongyun-collections/` 目录中，每个接口一个独立可读可版本化的 `.json` 文件。
- ⚡ **Rust 原生免跨域引擎**：底层基于 Rust `reqwest`，直连本地、内网及公网服务，不受浏览器 CORS 限制，自由配置 Headers、Auth 与 Body。
- 🗂️ **现代化工作台 (多标签页)**：支持多请求并行编辑切换，脏改动实时提示，快捷键（`Ctrl+Enter` 发送、`Ctrl+S` 保存、`Ctrl+T` 新建、`Ctrl+W` 关闭）。
- 🧪 **自动化测试断言引擎**：可视化配置状态码、响应耗时、JSON 路径属性匹配、Header 校验，并在响应面板生成即时测试报告。
- ⚡ **环境变量自动提取**：支持从响应内容（JSON 属性或 Header）自动提取字段并持久化同步至当前环境变量（`{{变量名}}`），轻松实现登录凭据与级联接口调用。
- 💻 **多语言客户端代码生成**：一键生成 8 种主流语言/框架代码（cURL、JavaScript Fetch/Axios、TypeScript、Python requests/httpx、Go、Rust）。
- 📦 **全格式生态导入**：一键解析导入单条 `cURL`、**Postman Collection v2.1**、**Swagger / OpenAPI 3.0** 及 **IntelliJ `.http`** 文件。
- 🛡️ **安全隔离与 Git 协同**：私有密钥留存于 `*.private.env.json`（已被 `.gitignore` 忽略），提供应用内 Git 分支与改动检测面板。

---

## 📁 目录结构

```text
tongyun-api/
├── examples/                                # IntelliJ .http 官方示例
│   ├── http-client.env.json                 # 公共环境变量
│   ├── http-client.private.env.json.example # 私有变量模板
│   └── httpbin/
│       ├── basics.http                      # GET / POST 基础请求
│       ├── methods.http                     # 各 HTTP 动词与状态码示例
│       ├── headers-auth.http                # 鉴权与请求头示例
│       ├── json-body.http                   # JSON 请求体与增删改示例
│       └── variables.http                   # 环境变量多层替换与插值示例
├── tongyun-collections/                     # 本地纯文本 JSON 接口集
│   ├── environments/                        # 环境配置 (development / production)
│   ├── 01-基础HTTP/
│   ├── 02-状态码与时延/
│   └── 03-AI模型测试/
├── docs/                                    # 产品需求与任务规范
│   ├── PRD.md
│   └── tasks/001-mvp.md
├── src-tauri/                               # Tauri 2 原生 Rust 后端
│   └── src/
│       ├── lib.rs                           # IPC 命令总线与原生 HTTP
│       ├── scan.rs                          # 目录扫描
│       └── send.rs                          # 线程安全请求调度
└── src/                                     # React 19 + Tailwind CSS 前端
    ├── components/                          # 现代化多标签、编辑器与面板
    ├── parser/                              # .http 文件与环境层解析器
    ├── utils/                               # 断言引擎、代码生成与转换器
    └── services/                            # IPC 桥接层
```

---

## 📖 示例 (Examples)

仓库在 `examples/` 目录下提供了遵循 **IntelliJ HTTP Client (`.http`)** 规范的纯文本样例，所有示例接口均使用公开的中立沙箱 `https://httpbin.org`，无需启动额外后端即可直接调试。

### 1. 示例文件清单

- **`examples/httpbin/basics.http`**：基础 GET / POST 请求、URL 查询参数拼装与请求头回显。
- **`examples/httpbin/methods.http`**：状态码校验（200 / 404）、URL-encoded 表单提交、前置与响应处理脚本隔离说明。
- **`examples/httpbin/headers-auth.http`**：Bearer Token 令牌鉴权、自定义请求头回显及 Basic 基础认证演示。
- **`examples/httpbin/json-body.http`**：POST（新建资源）、PUT（全量更新）、PATCH（局部变更）等标准 JSON 载荷提交。
- **`examples/httpbin/variables.http`**：`{{host}}`、`{{envName}}`、`{{meta.source}}` 等多层环境变量在 URL、Header 与 Body 中的插值替换。

### 2. 环境配置与安全隔离

- **`examples/http-client.env.json`**：公共非敏感环境配置，包含 `httpbin`（公网测试）与 `local`（本机调试）两套预设环境。
- **`examples/http-client.private.env.json.example`**：私有敏感环境模板（用于存放本机 Token、Cookie、真实 Host 等）。
- **层级继承规则**：每个 `.http` 文件仅继承从根目录到该文件所在目录链路上的环境文件；同一目录内 `private` 覆盖 `public`，子目录环境覆盖父目录同名变量。
- **安全约定**：私有文件 `*.private.env.json` 已在 `.gitignore` 中忽略，绝对不要将内部真实域名、真实凭据提交至公共仓库。

---

## 🚀 本地运行与构建

### 1. 安装依赖

```bash
npm install
```

### 2. 启动桌面应用开发模式（原生网络能力）

```bash
npm run tauri dev
```

### 3. 仅启动浏览器预览

```bash
npm run dev
```

---

## 检查更新

安装版桌面 App 在顶栏点 **检查更新**，状态栏的 **关于** 里也能看到当前版本并再次检查。启动大约 3 秒后会静默检查；已经是最新时，手动检查会提示「已是最新版本」。有新版会下载并重启。

`0.1.0` 没有更新器，需要先从 [Releases](https://github.com/dangzhuotong/tongyun-api/releases/latest) 手动安装一次 `0.2.0`，之后才能在应用内升级。新版本来自 tag `vX.Y.Z`，并且和 `package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 的版本一致。GitHub Actions 在 tag 上发布 Release，并带上更新器用的 `latest.json`。合进 `master` 只会打未签名构建产物，不会发布 Release。步骤见 [docs/RELEASE.md](docs/RELEASE.md)。

安装包在 CI 里用 **minisign** 签过更新包（`TAURI_SIGNING_*`）。**尚未做 Apple 公证**。macOS 首次打开如果提示无法验证开发者：

1. 系统设置 → 隐私与安全性 → 往下找到提示，点「仍要打开」；
2. 在「应用程序」里右键点 App，选「打开」，再确认一次；
3. 终端执行：`xattr -dr com.apple.quarantine /Applications/tongyun-api.app`

已经装上的 App 用「检查更新」换的是 minisign 签过的包。

---

## 🧪 运行测试 (Running Tests)

本项目采用**分层测试架构**，前端使用 [Vitest](https://vitest.dev/) 执行纯文本解析层与断言工具函数的单元测试，后端使用 Rust `cargo test` 验证目录安全扫描与请求调度。测试文件与被测模块同级放置（`xxx.test.ts`），纯内存执行且无外部网络依赖。

### 1. 常用测试命令

| 测试目的 | 执行命令 | 说明 |
|---|---|---|
| **全量前端单测** | `npm test` | 调用 `vitest run` 执行所有前端单测 |
| **单文件针对性测试** | `npm test -- src/parser/parser.test.ts` | 针对单个测试套件进行快速调试与验证 |
| **后端 Rust 单测** | `npm run test:rust` | 执行后端目录扫描、安全策略与请求调度测试 |
| **全量工程门禁** | `npm run check` | 依次执行类型检查、前端单测、Rust 语法检查与 Rust 单测 |

### 2. 前端测试套件覆盖

- **`src/parser/parser.test.ts`**：`.http` 语法规范解析、请求分割、注释过滤与 `examples/` 示例在 `httpbin` 环境下的解析验证。
- **`src/parser/env.test.ts`**：环境变量对象扁平化（`flattenVariables`）与多层公私环境文件就近合并（`mergeEnvironmentLayers`）。
- **`src/parser/substitute.test.ts`**：静态变量插值、系统动态变量生成（`$uuid`、`$timestamp` 等）及敏感密钥掩码脱敏（`maskSecret`）。
- **`src/utils/curl.test.ts`**：cURL 文本插值（`interpolateText`）、请求转 cURL（`exportToCurl`）及 cURL 命令逆向解析（`parseCurl`）。
- **`src/utils/codeGenerators.test.ts`**：8 种主流语言与框架（cURL、JS Fetch/Axios、TS Fetch、Python Requests/HTTPX、Go、Rust Reqwest）的代码片段生成。
- **`src/utils/importers.test.ts`**：Postman Collection v2.1、OpenAPI 3.0 / Swagger 与 `.http` 文件的生态导入解析。
- **`src/utils/tester.test.ts`**：深层 JSON 属性获取（`getNestedValue`）、断言判定引擎（`evaluateAssertions`）、变量提取（`extractVariables`）及测试用例集生成。

### 3. 虚拟测试示例 (Fictional Examples)

测试用例与接口样例统一采用中立的虚拟地址（如 `https://httpbin.org` 或 `https://api.example.com`），不依赖真实生产环境。

#### 示例 A：`.http` 接口解析与变量插值测试
```typescript
// 虚拟示例：验证解析器对变量 {{baseUrl}} 与 {{userId}} 的正确插值
const rawHttp = `### 获取虚拟用户信息
GET {{baseUrl}}/users/{{userId}}
Authorization: Bearer {{token}}
`;

const env = {
  baseUrl: "https://httpbin.org",
  userId: "1001",
  token: "sample-fictional-token",
};

const parsed = parseHttpFile(rawHttp);
const resolved = resolveRequest(parsed.requests[0], env);
expect(resolved.url).toBe("https://httpbin.org/users/1001");
expect(resolved.headers[0].value).toBe("Bearer sample-fictional-token");
```

#### 示例 B：自动化响应断言与变量提取测试
```typescript
// 虚拟示例：验证断言引擎判定状态码与从 JSON 响应体提取字段
const mockResponse = {
  status: 200,
  body: JSON.stringify({ code: 0, data: { orderId: "ord_9988", amount: 128.5 } }),
  time_ms: 85,
};

// 1. 断言检查：状态码等于 200，耗时小于 500ms
const assertionResults = evaluateAssertions([
  { type: "status_code", operator: "equals", expected: "200", enabled: true },
  { type: "response_time", operator: "less_than", expected: "500", enabled: true },
], mockResponse);
expect(assertionResults.every((r) => r.passed)).toBe(true);

// 2. 提取变量：将 data.orderId 存入 extractedOrderId
const extracted = extractVariables([
  { source: "json_body", expression: "data.orderId", target_variable: "extractedOrderId", enabled: true },
], mockResponse);
expect(extracted.extractedOrderId).toBe("ord_9988");
```

更完整的测试架构设计、模块映射与测试守则请参阅 [docs/testing.md](docs/testing.md)。

---

## ⌨️ 常用快捷键

| 快捷键 | 功能说明 |
|---|---|
| `Ctrl + Enter` | 发送当前激活的请求 |
| `Ctrl + S` | 保存接口改动到本地纯文本文件 |
| `Ctrl + T` | 新建空白请求标签页 |
| `Ctrl + W` | 关闭当前标签页 |
| `{{variable}}` | 模板变量动态替换语法 |

---

## 📚 详细文档

- [AGENTS.md](AGENTS.md)：给 AI Agent 与开发者的代码规范、文件契约与提交守则
- [docs/PRD.md](docs/PRD.md)：产品需求与设计原则
- [docs/tasks/001-mvp.md](docs/tasks/001-mvp.md)：MVP 验收项清单
- [docs/RELEASE.md](docs/RELEASE.md)：桌面 App 发版与检查更新
