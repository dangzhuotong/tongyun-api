# Agent 安全与追溯修复验收 · 2026-10-16

基线 9b1f9a9，分支 codex/agent-safety-trace。macOS / Node 24；所有网络验证使用临时目录和本机临时端口，无业务数据或真实凭据。

## 结果

- `npm run check`：175 个前端/Runner 测试、33 个 Rust 测试通过，0 失败/忽略。
- `npm run build`：通过。`python3 -m py_compile scripts/tongyun_ui_bridge.py`：通过。
- Rust 实际 TCP 测试复用 Bridge 的完整连接处理器，仅将 Tauri 原生事件发送替换为计数器：无令牌 401、错误来源 403、合法同步/读取 200、合法发送只派发一次；非法 JSON 400，未实现批量接口 501，审计不含私有状态正文。
- 分段正文完整读取、重复长度/chunked/超限拒绝；trusted Origin 预检及 Host 校验通过。
- Node 子进程 + 本机 HTTP：缺/未知变量发送前拒绝，DELETE 正文到达；JSON 复用实际断言，期望 404 可通过；超时/大响应/跨源跳转失败；脚本/外部文件/坏环境/不可用审计阻止发送。
- 桌面实际 Rust 发送函数 + 本机 HTTP：DELETE 正文保留，Query API Key 不丢已有头，响应超限中止；绕过前端直接调用仍拦截缺变量。
- 事件跨进程读取，started/finished 均可见；公共事件不含请求/响应正文及密钥。

## 首次失败与修正

新增变量校验暴露 4 个原测试使用带变量 URL 却不传环境，原 fetch mock 掩盖了无效请求；将鉴权与网络故障夹具改为明确虚拟 URL，并新增缺变量时 fetch 不被调用的断言。Runner 不可用审计测试最初被夹具重复的 --audit-dir 参数覆盖，修正夹具后验证真实拒绝路径。

跨工具测试初次夹具使用非法 port_mode=fixed，Dev 正确拒绝；改为既有 none 模式后通过。打包测试脚本位于 Dev 的 scripts/cross-tool-smoke.py：真实 Dev 启动隔离 HTTP 服务、Runner 校验、Git 真实提交、Dev 停止，同一个 taskId 的 8 项操作全部有开始/结束记录，服务已停止。

## 未验证

未启动当前用户的真实桌面应用、未使用其私有环境、未调用公网 API。没有完成三平台安装包 GUI/系统 ACL 验收，不把 Tauri 事件替身测试当成真实桌面交互测试。跨工具联调验证的是 CLI 链路，不是新增总控 UI。
