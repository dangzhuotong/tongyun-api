---
name: tongyun-api
description: |
  当你在仓库 tongyun-api 中编写代码、添加接口请求文件、修改解析器、调整 Rust 后端或维护环境配置时，激活本 skill。
  它描述了项目定位、启动方式、环境变量配置规范以及所有常用命令，是在本仓库内做任何开发或 AI 辅助任务的首要参考。
---

# tongyun-api — Agent Skill

## 用途

**橦云接口**（tongyun-api）是一款**本地优先、纯文本驱动、Git 原生协作**的 API 调试桌面客户端。

- 解析并运行 **IntelliJ `.http` / `.rest`** 格式的请求文件。
- 支持 `http-client.env.json` / `http-client.private.env.json` 多层环境变量继承。
- 底层由 **Rust `reqwest`（rustls）** 发送请求，不受浏览器 CORS 限制。
- 前端技术栈：**React 19 + TypeScript + Vite**，桌面宿主：**Tauri 2**。
- 解析器位于 `src/parser/`，目录扫描位于 `src-tauri/src/scan.rs`，请求发送位于 `src-tauri/src/send.rs`。

详细产品需求见 [docs/PRD.md](../../docs/PRD.md)，MVP 验收项见 [docs/tasks/001-mvp.md](../../docs/tasks/001-mvp.md)，完整开发规范见 [AGENTS.md](../../AGENTS.md)。

---

## 启动方式

所有命令均在仓库根目录执行。

| 目的 | 命令 |
|---|---|
| 浏览器预览（无 Rust 发送） | `npm run dev` → 访问 `http://localhost:1420` |
| 桌面开发（含 Rust 发送） | `npm run tauri dev` |

> 真正的请求发送必须在桌面窗口（`tauri dev`）中进行，浏览器预览仅用于核对请求树和环境替换效果。

---

## 配置（环境变量）

环境变量写在 `.http` 文件所在目录及其父目录的以下文件中：

| 文件 | 说明 |
|---|---|
| `http-client.env.json` | 可提交的公共变量，顶层键为环境名（如 `httpbin`、`development`、`production`） |
| `http-client.private.env.json` | 本机私有变量，覆盖同名公共变量，**已在 `.gitignore` 中忽略，禁止提交** |
| `http-client.private.env.json.example` | 私有变量字段名示例，值填写占位符（如 `replace-me`、`public-placeholder`） |

**变量命名规则**：以字母或下划线开头，后续可含字母、数字、`_`、`.`、`-`。  
**引用语法**：`{{变量名}}`，嵌套对象以点号读取，如 `{{auth.token}}`。  
**动态变量**（如 `{{$uuid}}`、`{{$timestamp}}`）：界面标出，不会替换后发送，MVP 阶段不执行脚本。

> 禁止将真实令牌、Cookie、密码、连接串或公司内网地址提交到仓库。`examples/` 目录只使用 `https://httpbin.org` 和 `http://127.0.0.1`。

---

## 常用命令

| 目的 | 命令 | 成功时 |
|---|---|---|
| 安装依赖 | `npm install` | 生成 `node_modules` 和锁文件 |
| **解析器测试** | `npm test` | Vitest 全部通过 |
| 类型检查 | `npm run typecheck` | `tsc --noEmit` 无错误 |
| 前端构建 | `npm run build` | 产出 `dist/` |
| Rust 语法检查 | `npm run check:rust` | `cargo check` 无错误 |
| Rust 测试 | `npm run test:rust` | `cargo test` 全部通过 |
| **全量检查（CI 用）** | `npm run check` | 类型、解析器、Rust 检查与测试全部通过 |

> 改完代码后，提交前务必运行 `npm run check`，确认全量通过再推送。
