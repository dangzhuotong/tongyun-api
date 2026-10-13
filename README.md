# 橦云接口

个人用、只在本机运行的 API 调试桌面应用。AI agent 把接口和测试数据写成仓库里的纯文本；应用打开文件夹，列出 `.http` 请求，切换环境变量，一键发送，并查看响应。

没有云端账号，也没有协作。

## 能做什么

- 打开一个文件夹，读取其中的 `.http` / `.rest` 文件
- 按目录显示请求树，选中后看到方法、地址、请求头和请求体
- 用 `http-client.env.json` 与 `http-client.private.env.json` 切换环境，替换 `{{变量}}`
- 由 Rust `reqwest` 发送请求，不受浏览器 CORS 限制
- 查看状态码、耗时、响应头，以及整理后的 JSON 正文

## 技术栈

Tauri 2、React 19、TypeScript、Vite 7。窗口、权限和 npm 脚本沿用橦云桌面应用的习惯。HTTP 发送在 Rust 侧完成。

## 本地运行

需要 Node.js 20+、Rust 1.90+（当前 Tauri 2 的要求），以及 Tauri 在当前系统上的依赖（Linux 需要 WebKitGTK 4.1）。

```bash
npm install
npm run tauri dev
```

只看界面、不发送请求时：

```bash
npm run dev
```

浏览器里的「发送」不会发出网络请求。

## 请求文件

格式对齐 IntelliJ IDEA HTTP Client。`###` 单独成行，用来分隔请求，同一行后面的文字是请求名。`{{变量}}` 会按当前环境替换。

```http
### 查询参数
GET {{host}}/get?name={{name}}
Accept: application/json

### 提交 JSON
POST {{host}}/post
Content-Type: application/json

{
  "hello": "{{name}}"
}
```

公共环境放在集合目录的 `http-client.env.json`。真实密钥只放 `http-client.private.env.json`，这个文件已被 git 忽略。示例在 `examples/`，访问的是 httpbin。

## 检查

```bash
npm test                 # 解析器与环境合并
npm run typecheck
npm run build
npm run check:rust
npm run test:rust
npm run check            # 上面几项一起跑
```

## 文档

- [AGENTS.md](AGENTS.md)：给 AI agent 的文件格式、新增请求和环境的步骤、禁止提交的内容
- [docs/PRD.md](docs/PRD.md)：产品需求
- [docs/tasks/001-mvp.md](docs/tasks/001-mvp.md)：MVP 范围和验收
