# Agent 访问控制与操作追溯（2026-10-16）

本次修复范围：Bridge 授权、Runner 发送与断言、桌面网络响应预算、持久化操作元数据。原 MVP 文档中的「不做自动化断言」属于初始范围；当前已有断言与批量 UI，本次复用现有实现，没有增加脚本执行能力。

## Bridge

- 仍绑定 `127.0.0.1:4171`。所有状态与业务路由均要求 `Authorization: Bearer <session-token>`，包括状态检查。
- 启动时生成随机令牌，仅保存在 Tauri app_config_dir 下的 `bridge-session.json`。macOS/Linux 使用目录 0700、文件 0600；Windows 使用用户配置目录继承的 ACL，尚无 Windows 真机权限验收。
- 桌面界面通过 Tauri `bridge_config` 获取令牌，仅在内存使用。`scripts/tongyun_ui_bridge.py` 从系统应用配置目录读当前会话；不在终端打印令牌。旧的无鉴权客户端需要升级。
- 校验 Host，拒绝不受信任 Origin；仅回显允许的 Tauri 源及开发源 localhost/127.0.0.1:1420，不使用 `*`。移除 BroadcastChannel 和 window message 驱动发送的旁路。
- 请求读取总预算 3 秒，header 16 KiB、body 64 KiB、最多 32 个并发连接；完整读取 Content-Length，拒绝重复头、chunked、截断正文与无效 JSON。
- `/api/send` 的 200 仅表示事件已派发，不能当成 HTTP 请求执行成功。`/api/run-cases` 没有实现对应的桌面监听，明确返回 501；通过现有桌面批量界面或 Runner 执行。
- 同步状态中的请求、鉴权和响应仍属于私有数据，只供持有本机会话令牌的调用者读取。令牌认证不区分同一 OS 用户下的不同进程。

```sh
python3 scripts/tongyun_ui_bridge.py status
python3 scripts/tongyun_ui_bridge.py operations
```

## Runner

```sh
npm run runner -- examples/httpbin/basics.http --root examples --env httpbin --json --task task-demo --actor agent:demo
```

以上为调用格式示例，未在本次验收向公网发送。一个 `.http` 中全部请求使用同一默认状态断言，默认 200–299，可用 `--expect-status N` 或 `N-M` 指定；JSON 请求文件复用 UI 的 `evaluateAssertions`，有启用断言时按实际断言判定。

- 必须明确目标文件；支持 `.http`/`.rest` 及单个 JSON 请求模型，不支持 JSON 文件夹集合、multipart、脚本或外部文件请求体。
- `--root` 默认当前目录，目标规范化后必须位于根内；仅合并根到目标文件目录链上的公私环境。环境损坏、显式环境不存在、解析警告、脚本、缺变量、未知动态变量均拒绝发送。
- DELETE 和其他允许正文的方法发送真实正文；GET/HEAD 携带非空正文明确拒绝。
- Runner 固定使用 safe 重定向策略，JSON 显式配置其他策略时拒绝发送，避免静默忽略。
- 默认 30 秒总发送/读取预算，可 `--timeout 1..120000` 毫秒调整。流式限制响应 1 MiB，超限失败；同源重定向有上限，跨源停止且默认不算成功。
- 失败退出码 1，支持 `--bail`；没有自动重试。结果包含 operationId，不默认输出原始 URL、请求或响应内容，避免将私有变量写进 CI 日志。
- `--audit-dir` 可覆盖测试/隔离目录。原 `.tongyun-trace.json` 的截断读改写不再用作持久化审计。

## 统一事件 v1

与 Git、Dev 共用字段语义：`schemaVersion / operationId / taskId / actor / tool / action / target / phase / timestampMs / outcome`。每条操作的 started、finished 分别为不可覆盖的独立 JSON 文件，先持久化开始再发送。请求正文、响应正文、鉴权、URL 查询参数不进公共审计；退出码和业务断言结果以实际 Runner 报告为准。

API 默认审计在 app_config_dir/audit；CLI 和桌面使用同一默认目录。Bridge `GET /api/operations` 需要令牌，Tauri `operation_history` 同样读取持久化元数据。CLI 的 actor/task 是调用者标签；桌面发送标为 desktop:local，不能视作身份认证。

如果只留下 started，或结束记录失败，必须核查真实目标状态，禁止自动重试写请求。成功派发不等于请求完成；本地事件文件不是与远端业务的原子事务。公共审计与 UI 最近 100 条详细历史分开，清空 UI 历史不会清除审计。当前未提供统一跨工具审计 UI、自动跨工具编排、自动补偿或防 OS 文件所有者篡改的保证。

新增 uuid（Apache-2.0 OR MIT）用于不可预测的 Bridge 会话令牌；复用现有 Rust/Node/前端栈，没有引入第二套 HTTP 框架。
