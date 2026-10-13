# tongyun-api

> **自用 API 调试桌面端（Tauri 2 + React 19）**  
> 核心特性：所有接口与环境变量以**纯文本 JSON 格式**直接保存在当前 Git 仓库中，天然支持 Git 分支管理、代码审查（Diff）与团队协同，无需绑定任何专有云端账号。

---

## ✨ 核心特性

- 📂 **仓库内纯文本存储**：接口存放在 `./tongyun-collections/` 目录中，每个接口是一个可读可编辑的 `.json` 文件，直接提交 Git 即可与团队共享，Diff 清晰直观。
- ⚡ **Rust 原生免跨域网络引擎**：底层基于 Rust `reqwest` 实现，彻底摆脱浏览器的 CORS 限制，可自由设定 `User-Agent`、`Cookie`、`Host` 等底层请求头。
- ⏱️ **毫秒级时延与指标分析**：精确记录总耗时（ms）、响应体尺寸（Bytes/KB/MB）、状态码、协议头，支持 JSON 自动语法高亮、美化与格式校验。
- 🌱 **多套环境变量管理**：支持 `{{baseUrl}}`、`{{apiToken}}`、`{{userId}}` 等模板变量动态替换，环境配置同样以纯文本存储在 `environments/` 目录中。
- 🔄 **cURL 双向互通**：支持一键将当前请求导出为终端可执行的完整 `cURL` 命令，亦可直接粘贴任何浏览器/网络控制台复制的 `cURL` 快速解析导入。
- 🎨 **现代化轻量极速体验**：基于 Tauri 2 + Vite + React 19 + Tailwind CSS，开箱即用，内存占用低，启动毫秒级。

---

## 📁 接口目录组织结构

项目启动后，将在当前仓库中自动维护纯文本接口树：

```text
tongyun-collections/
├── environments/
│   ├── development.json            # 本地/开发环境变量配置
│   └── production.json             # 生产正式环境配置
├── 01-基础HTTP/
│   ├── GET测试 (Query与Token).json  # GET 请求示例
│   └── POST测试 (JSON Body).json    # POST 请求示例
├── 02-状态码与时延/
│   └── 延迟测量 (Delay 1s).json      # 耗时时延测量示例
└── 03-AI模型测试/
    └── OpenAI标准补全.json          # AI Chat Completions 模板
```

### 单接口纯文本文件格式（示例）

```json
{
  "id": "req_get_demo",
  "name": "GET测试 (Query与Token)",
  "method": "GET",
  "url": "{{baseUrl}}/get",
  "headers": [
    { "key": "Accept", "value": "application/json", "enabled": true }
  ],
  "params": [
    { "key": "userId", "value": "{{userId}}", "enabled": true }
  ],
  "body": {
    "body_type": "none",
    "content": ""
  },
  "auth": {
    "auth_type": "bearer",
    "token": "{{apiToken}}"
  },
  "description": "演示带环境变量、Query 参数与 Bearer Token 的 GET 接口"
}
```

---

## 🚀 启动与构建

### 1. 本地网页端开发预览（支持 Mock 调试）

```bash
pnpm dev
```

浏览器打开 `http://localhost:1420` 即可实时预览界面与交互。

### 2. 本地 Tauri 桌面端运行（原生网络能力）

```bash
pnpm tauri dev
```

### 3. 构建发布安装包

```bash
# 编译前端并生成桌面端可执行程序
pnpm build
cargo build --release --manifest-path src-tauri/Cargo.toml
```

或者使用 Tauri CLI 生成完整打包分发包：

```bash
pnpm tauri build
```

---

## ⌨️ 常用快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl + Enter` | 发送当前请求 |
| `Ctrl + S` | 保存当前接口改动到仓库纯文本 |
| `{{variable}}` | 请求 URL/Header/Body 中的环境变量替换语法 |

---

## 🛠️ 技术栈

- **桌面运行时**：[Tauri 2](https://tauri.app/) + Rust 1.96 (`reqwest`, `tokio`, `serde`)
- **前端框架**：[React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)
- **UI & 样式**：[Tailwind CSS v4](https://tailwindcss.com/) + [Lucide React](https://lucide.dev/)
