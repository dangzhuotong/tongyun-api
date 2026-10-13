---
name: tongyun-ui-bridge
description: >-
  External AI Bridge for Tongyun API (橦云接口桌面客户端).
  Allows any AI agent (Antigravity, Cursor, Claude Code, GPT) to push API requests, test case suites, payloads, headers, and query params directly into the open Desktop UI in real-time, trigger auto-execution without human manual input, and fetch runtime responses and test assertion results.
  Use for 推送接口到UI, 接口联调, AI填入接口, 自动填充请求, 橦云客户端联动, 外部Agent调用, or tongyun-ui-bridge.
license: MIT
metadata:
  version: "1.1.0"
  author: Tongyun Team
  origin: pro-native
---

# Tongyun UI Bridge（橦云桌面 UI 协同网关）

用于外部 AI Agent 与「橦云接口」桌面应用的双向协同交互。

## 核心定位：AI Agent 做大脑，橦云 UI 做眼睛与双手

在接口开发与联调场景中，**用户无需在 UI 中繁琐手敲或复制粘贴**。外部 AI Agent 直接作为调度大脑，利用本 Bridge 服务：
1. **注入接口与用例集**：将 AI 自动推导的正向、异常、边界、安全测试用例注入到桌面端。
2. **自动化触发与重放**：由 Agent 触发执行单例或批量跑批用例。
3. **回读运行时数据**：Agent 可直接查询当前活跃接口的响应体、状态码、响应耗时及断言结果，展开下一轮分析诊断。
4. **人类在 UI 监看**：人类用户在精雕细琢的桌面 UI 上监看动态、微调参数并一键持久化为 Git 纯文本 `.http` 文件。

---

## 1. 桌面端 Bridge 服务规范

橦云桌面客户端启动时（`npm run tauri dev`），内置的 Rust Tokio Bridge 会在本地监听：
- **服务端口**：`http://127.0.0.1:4171`
- **状态检查**：`GET /api/status`
- **读取 UI 状态**：`GET /api/state`（获取激活接口、最新响应、测试断言结果）
- **推送接口与用例**：`POST /api/push`
- **触发接口发送**：`POST /api/send`
- **触发批量用例执行**：`POST /api/run-cases`

---

## 2. 推荐调用方式（Python 联动脚本）

在仓库根目录下运行：

```bash
# 1. 检查客户端是否在线
python scripts/tongyun_ui_bridge.py status

# 2. 推送接口到桌面 UI 并附带基础断言
python scripts/tongyun_ui_bridge.py push \
  --name "获取用户信息" \
  --method GET \
  --url "https://httpbin.org/get" \
  --param "user_id=1001" \
  --test "status: 200"

# 3. 向当前激活接口动态追加测试用例（正向、异常、边界、安全）
python scripts/tongyun_ui_bridge.py add-case \
  --name "逆向：缺少Token拦截" \
  --category security \
  --test "status: 401"

# 4. 推送完整业务接口并立即触发执行
python scripts/tongyun_ui_bridge.py push \
  --name "创建业务订单" \
  --method POST \
  --url "https://httpbin.org/post" \
  --header "Authorization: Bearer prod-token-xyz" \
  --header "Content-Type: application/json" \
  --body '{"order_id": "ORD-2026", "amount": 199.9, "sku": "VIP_MEMBERSHIP"}' \
  --test "status: 200" \
  --send

# 5. 触发当前接口的测试用例集全部执行
python scripts/tongyun_ui_bridge.py run-cases

# 6. 读取当前 UI 的激活接口、响应状态及用例测试结果（JSON 格式供 Agent 消费）
python scripts/tongyun_ui_bridge.py state
```

---

## 3. 直接通过 HTTP / cURL 调用

若外部 Agent 无 Python 解释器环境，可直接向 `http://127.0.0.1:4171` 发起 HTTP 请求：

### 推送接口及完整用例矩阵：
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
    ],
    "cases": [
      {
        "name": "[正向] 正常登录",
        "category": "positive",
        "body": { "username": "admin", "password": "secret_password" },
        "tests": [{ "type": "status_equals", "expected": "200", "enabled": true }]
      },
      {
        "name": "[异常] 密码错误",
        "category": "negative",
        "body": { "username": "admin", "password": "wrong" },
        "tests": [{ "type": "status_equals", "expected": "401", "enabled": true }]
      }
    ]
  }'
```

### 获取当前运行结果供 Agent 分析诊断：
```bash
curl -X GET http://127.0.0.1:4171/api/state
```

---

## 4. UI 协同原则

1. **Agent-First**：所有用例推导、参数组合生成、断言规则规划均在外部 Agent 侧完成。
2. **零手工输入**：用户只要给出一句话“测试微信退款接口异常分支”，Agent 生成并直接 push 到 UI，自动激活标签页。
3. **人类一键保存**：人类用户随时在 UI 点击 `Ctrl+S` 或「保存」，即可落盘为规范的 IntelliJ IDEA `.http` 纯文本版本，随时提交 Git。
