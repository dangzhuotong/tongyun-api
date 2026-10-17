# 橦云接口 · AI 开发规则

在这个仓库里写代码或补请求文件之前，先读本文件。产品目标见 [docs/PRD.md](docs/PRD.md)，MVP 验收见 [docs/tasks/001-mvp.md](docs/tasks/001-mvp.md)。

## 定位

本地桌面应用。接口和测试数据是仓库里的纯文本，应用负责读取、替换环境变量、发送请求、展示响应。

技术栈：React 19 + TypeScript + Vite 7，桌面宿主 Tauri 2，发送使用 Rust `reqwest`（rustls）。解析器在 `src/parser/`，用 Vitest 测。扫描文件夹和发送在 `src-tauri/src/`。

## 命令

在仓库根目录执行。依赖装好之后，这些命令才算数。

| 目的 | 命令 | 成功时 |
| --- | --- | --- |
| 安装 | `npm install` | 生成 `node_modules` 和锁文件 |
| 解析器测试 | `npm test` | Vitest 全部通过 |
| 类型检查 | `npm run typecheck` | `tsc --noEmit` 无错误 |
| 前端构建 | `npm run build` | 产出 `dist/` |
| Rust 检查 | `npm run check:rust` | `cargo check` 无错误 |
| Rust 测试 | `npm run test:rust` | `cargo test` 全部通过 |
| 一起检查 | `npm run check` | 类型、解析器、Rust 检查和测试都通过 |
| 浏览器预览 | `npm run dev` | Vite 在 `http://localhost:1420` |
| 桌面开发 | `npm run tauri dev` | 打开「橦云接口」窗口，发送走 Rust |

浏览器预览可以核对请求树和环境替换。真正发送必须在桌面窗口里做。

## 文件格式

请求文件用 IntelliJ IDEA HTTP Client 的 `.http`（也认 `.rest`）。

- 一行 `###` 开始一个新请求。`###` 后面的文字是请求名。`# @name 名字` 或 `// @name 名字` 优先于这个标题。
- 请求行是 `METHOD URL`，可以带 `HTTP/1.1` 或 `HTTP/2`。只有 URL 时按 GET。请求行下面缩进、并且以 `?` 或 `&` 开头的行会拼进 URL。
- `#` 和 `//` 是注释，写在请求行和请求头区域。空行之后是请求体，请求体里的内容原样保留。
- `{{变量名}}` 按当前环境替换。变量名用字母或下划线开头，后面可以是字母、数字、`_`、`.`、`-`。`{{$uuid}}` 这类动态变量先不替换，界面会标出来，并且不会发出去。
- `< {% ... %}` 前置脚本和 `> {% ... %}` 响应脚本不会被发送。MVP 不执行脚本。
- 请求体如果只有 `< ./某个文件`，应用会警告，并且不会去读那个文件。

环境文件：

- `http-client.env.json`：可提交的公共变量。
- `http-client.private.env.json`：本机私有变量，覆盖同名公共变量。已在 `.gitignore` 中忽略。
- 顶层键是环境名。值可以嵌套，用点号读取，例如 `{{auth.token}}`。
- 每个 `.http` 只使用从集合根目录走到该文件所在目录这一条路径上的环境文件。兄弟目录的变量不会套用。
- 同一目录里 private 覆盖 public。更靠近该文件的环境覆盖更远的同名变量。

```json
{
  "httpbin": {
    "host": "https://httpbin.org",
    "name": "tongyun"
  }
}
```

## 新增一个请求

1. 在目标集合目录新增或修改 `.http` 文件，用 `###` 隔开请求。需要固定名字时写 `# @name 名字`。
2. 地址、请求头、请求体里的会变化的部分写成 `{{变量}}`。
3. 把不含密钥的值写进该目录或上级目录的 `http-client.env.json`。
4. 密钥、Cookie、令牌只写进 `http-client.private.env.json`。需要让别人知道字段名时，改 `http-client.private.env.json.example`，值用 `replace-me` 这类占位。
5. 跑 `npm test`。示例文件被测试锁住：`examples/` 里的请求在 `httpbin` 环境下必须能完成替换。

## 新增一个环境

在 `http-client.env.json` 增加一个顶层键，例如 `"staging"`。每个键都写成字符串、数字或布尔值，嵌套对象会摊成 `a.b`。私有差异写到 private 文件的同一个环境名下。

应用的环境下拉框只列出当前 `.http` 沿目录向上能看到的环境名。切换环境会重新替换当前请求，不会改磁盘上的 `.http` 文件。

## 绝对不要提交这些

- 真实的公司域名、内网主机名、仓库以外的本机绝对路径（例如 `/Users/...`、`/home/<姓名>/公司目录`、盘符路径）
- 令牌、Cookie、密码、连接串、客户数据
- `http-client.private.env.json` 以及任何 `*.private.env.json`
- `.env` 里的真实配置

`examples/` 只使用 `https://httpbin.org` 和 `http://127.0.0.1`。占位令牌写成 `public-placeholder` 或 `replace-me`。

## 改代码时

- 解析规则放在 `src/parser/`，补行为就补 `src/parser/parser.test.ts`。
- 文件夹扫描放在 `src-tauri/src/scan.rs`。跳过 `node_modules`、`target`、`dist`、`.git` 和点开头的目录。
- 发送放在 `src-tauri/src/send.rs`，由异步命令放到阻塞线程上执行。只允许 `http` 和 `https`。跨主机的重定向停在 3xx，不继续把请求头带过去。
- 界面保持安静：浅底、细分割线、一种强调色。文案用中文。
- 改完跑 `npm run check`。没跑过的命令不要写进说明。

## 代码审查规矩

1. **本地测试进 PR**：改代码必须在本地跑相关测试，把测试命令和输出贴进 PR 描述（或附件）。没跑过别声称通过。
2. **提 PR 前自查 diff**：提交前自己过一遍 diff，重点看正确性、兼容（旧接口/旧数据）、权限、生命周期（启停、清理、泄漏）。
3. **已知坑沉淀**：同类问题第二次出现，就写进本文件「已知坑」一节（没有就新建），避免反复踩。
4. **AI 改稿轮次上限**：AI 修改来回审超过 3 轮还没过，停下重想方案并上报（阿码/阿审），不要硬改硬怼。
5. **风险分级合入**：
   - **低风险**：文档、测试的小改动，CI 绿可直接合。
   - **功能改动**：要阿审审过再合。
   - **高风险（必须阿橦本人批）**：计费、密钥相关、CI/发布流程（`.github/workflows`、updater、签名）的改动。

不要把密钥、Token、密码写进本文件或仓库任何位置。
