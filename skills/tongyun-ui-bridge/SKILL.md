---
name: tongyun-ui-bridge
description: >-
  External AI Bridge for Tongyun API (橦云接口桌面客户端).
  Allows any AI agent (Antigravity, Cursor, Claude Code, GPT) to push API requests, payloads, headers, query params, and test assertions directly into the open Desktop UI tabs in real-time, or trigger auto-execution without human manual input.
  Use for 推送接口到UI, 接口联调, AI填入接口, 自动填充请求, 橦云客户端联动, or tongyun-ui-bridge.
license: MIT
metadata:
  version: "1.0.0"
  author: Tongyun Team
  origin: pro-native
---

# Tongyun UI Bridge（橦云桌面 UI 协同网关）

用于外部 AI 与「橦云接口」桌面应用的实时协同交互。

当 AI 辅助用户设计、测试或审查接口时，**严禁要求用户手动复制粘贴或在 UI 中手敲字段**。AI 应当直接调用本 Skill 提供的命令或 HTTP 端口 `4171`，将生成的接口（名称、请求方法、URL、请求头、Query 参数、JSON 请求体、自动化断言）推送到桌面端 UI，自动新建标签页并高亮就绪。

---

## 1. 桌面端 Bridge 服务规范

橦云桌面客户端启动时（`npm run tauri dev`），内置的 Rust Tokio Bridge 会在本地监听：
- **服务端口**：`http://127.0.0.1:4171`
- **状态检查**：`GET /api/status`
- **推送接口**：`POST /api/push`
- **执行发送**：`POST /api/send`

---

## 2. 推荐调用方式

### 方式一：使用 Python 联动脚本（推荐）

在仓库根目录下运行：

```bash
# 1. 检查客户端是否在线
python scripts/tongyun_ui_bridge.py status

# 2. 推送 GET 接口到桌面 UI
python scripts/tongyun_ui_bridge.py push \
  --name "获取用户信息" \
  --method GET \
  --url "https://httpbin.org/get" \
  --param "user_id=1001" \
  --test "status: 200"

# 3. 推送 POST 业务接口到桌面 UI 并带 JSON Body
python scripts/tongyun_ui_bridge.py push \
  --name "创建业务订单" \
  --method POST \
  --url "https://httpbin.org/post" \
  --header "Authorization: Bearer prod-token-xyz" \
  --header "Content-Type: application/json" \
  --body '{"order_id": "ORD-2026", "amount": 199.9, "sku": "VIP_MEMBERSHIP"}' \
  --test "status: 200" \
  --test "contains: ORD-2026"

# 4. 推送并立即在桌面端执行发送
python scripts/tongyun_ui_bridge.py push \
  --name "健康检查探测" \
  --method GET \
  --url "https://httpbin.org/status/200" \
  --send
```

### 方式二：使用 cURL / HTTP 请求

若在其他工具或无 Python 环境中，可直接发起 HTTP POST：

```bash
curl -X POST http://127.0.0.1:4171/api/push \
  -H "Content-Type: application/json" \
  -d '{
    "name": "用户登录鉴权",
    "method": "POST",
    "url": "https://httpbin.org/post",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "username": "admin",
      "password": "secret_password"
    },
    "tests": [
      {
        "id": "t1",
        "name": "状态码为 200",
        "type": "status_equals",
        "expected": "200",
        "enabled": true
      }
    ]
  }'
```

---

## 3. UI 协同反馈原则

1. **零手工输入**：当用户提出“帮我测试这个接口”或“写一个登录接口调试一下”，AI 规划好参数后立即推送到 UI。
2. **直观呈现**：推送后，橦云接口桌面端会弹出 Toast 提示（如 `🤖 AI Skill 已将接口推入 UI: 创建业务订单`），并自动激活该标签页，展示方法高亮徽章与格式化好的 JSON。
3. **安全把关**：默认情况下只推入 UI 供人类用户检查与审阅；仅在用户明确指示“帮我直接跑一下”或带 `--send` 时，才自动发起请求。
