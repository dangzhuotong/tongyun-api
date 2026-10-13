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
│       └── methods.http                     # 各 HTTP 动词示例
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

## 🚀 本地运行与构建

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动桌面应用开发模式（原生网络能力）

```bash
pnpm tauri dev
```

### 3. 仅启动浏览器预览

```bash
pnpm dev
```

### 4. 运行完整工程检查（解析器测试、类型检查、Rust 检查）

```bash
pnpm test          # 运行 Vitest 测试 .http 解析器与环境合并
pnpm build         # 前端构建检查
cargo check --manifest-path src-tauri/Cargo.toml
```

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
