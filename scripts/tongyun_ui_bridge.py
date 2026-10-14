#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tongyun API (橦云接口) - AI UI Bridge Client
面向外部 AI Agent（Antigravity、Cursor、Claude Code、GPT）的全功能协同网关。
外部 Agent 可以直接通过本脚本向「橦云接口」桌面 UI 注入接口、用例矩阵、自动化触发测试、读取运行结果，
实现“AI 负责写用例调接口，人类在 UI 面前喝茶监看”的极简工作流。
"""

import sys
import os
import json
import argparse
import urllib.request
import urllib.error

# 适配 Windows 控制台编码
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BRIDGE_PORT = 4171
BRIDGE_BASE_URL = f"http://127.0.0.1:{BRIDGE_PORT}"

def check_status():
    """检查桌面客户端 Bridge 状态"""
    url = f"{BRIDGE_BASE_URL}/api/status"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(f"✅ [Tongyun AI Bridge] 客户端在线 (端口 {BRIDGE_PORT}): {data.get('message', '就绪')}")
            return True
    except Exception as e:
        print(f"⚠️ [Tongyun AI Bridge] 客户端未在线 (端口 {BRIDGE_PORT})。请确认已打开橦云桌面应用 (`npm run tauri dev`)。")
        return False

def get_state():
    """获取当前客户端 UI 的激活接口、最新响应及用例状态"""
    url = f"{BRIDGE_BASE_URL}/api/state"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(json.dumps(data, ensure_ascii=False, indent=2))
            return data
    except Exception as e:
        print(f"❌ [获取状态失败]: {e}")
        return None

def push_request(payload):
    """推送单个接口请求及用例数据到客户端 UI"""
    url = f"{BRIDGE_BASE_URL}/api/push"
    data_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data_bytes,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            res_json = json.loads(resp.read().decode("utf-8"))
            action_desc = "用例已追加" if payload.get("action") == "append_cases" else f"{payload.get('method', 'GET')} {payload.get('url', '')}"
            print(f"🚀 [推送成功] {action_desc} -> 已实时注入桌面 UI 标签页！")
            return res_json
    except urllib.error.URLError as e:
        print(f"❌ [推送失败] 无法连接到桌面应用 (端口 {BRIDGE_PORT}): {e}")
        return None
    except Exception as e:
        print(f"❌ [推送失败] 发生异常: {e}")
        return None

def trigger_send(payload=None):
    """触发客户端 UI 执行发送当前接口"""
    url = f"{BRIDGE_BASE_URL}/api/send"
    data_bytes = json.dumps(payload or {}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data_bytes,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            res_json = json.loads(resp.read().decode("utf-8"))
            print(f"⚡ [触发成功] 已通知桌面 UI 执行发送！")
            return res_json
    except Exception as e:
        print(f"❌ [触发失败] 无法触发发送: {e}")
        return None

def trigger_run_cases():
    """触发客户端 UI 执行用例集批量测试"""
    url = f"{BRIDGE_BASE_URL}/api/run-cases"
    req = urllib.request.Request(
        url,
        data=b"{}",
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            res_json = json.loads(resp.read().decode("utf-8"))
            print(f"⚡ [触发成功] 已通知桌面 UI 批量执行测试用例！")
            return res_json
    except Exception as e:
        print(f"❌ [触发失败] 无法触发用例执行: {e}")
        return None

def push_telemetry(payload):
    """向桌面 HUD 投屏 Agent 的思考、假设与任务态势"""
    url = f"{BRIDGE_BASE_URL}/api/telemetry"
    data_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data_bytes,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            res_json = json.loads(resp.read().decode("utf-8"))
            agent = payload.get("agent", "Agent")
            thought = payload.get("thought", "")
            print(f"🧠 [HUD投屏成功] {agent}: {thought[:60]}... 已实时投屏至桌面 HUD！")
            return res_json
    except urllib.error.HTTPError as e:
        if e.code == 404:
            payload_copy = dict(payload)
            payload_copy["action"] = "telemetry"
            return push_request(payload_copy)
        print(f"❌ [HUD投屏失败] HTTP {e.code}: {e.reason}")
        return None
    except Exception as e:
        print(f"❌ [HUD投屏失败] 无法连接到桌面应用: {e}")
        return None

def get_feedback():
    """获取人类在桌面 UI 上给出的裁决、批注或下一步指令"""
    url = f"{BRIDGE_BASE_URL}/api/feedback"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            feedback = data.get("feedback")
            if feedback:
                print(f"💬 [人类反馈就绪]:")
                print(json.dumps(feedback, ensure_ascii=False, indent=2))
            else:
                print(f"☕ [暂无人类新反馈] 人类正在观察监视屏，未提出新干预指令。")
            return feedback
    except urllib.error.HTTPError as e:
        if e.code == 404:
            state = get_state()
            feedback = state.get("human_feedback") if state else None
            if feedback:
                print(f"💬 [人类反馈就绪 (来自状态快照)]:")
                print(json.dumps(feedback, ensure_ascii=False, indent=2))
            else:
                print(f"☕ [暂无人类新反馈] 人类正在观察监视屏，未提出新干预指令。")
            return feedback
        print(f"❌ [获取人类反馈失败] HTTP {e.code}: {e.reason}")
        return None
    except Exception as e:
        print(f"❌ [获取人类反馈失败]: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="橦云接口 UI AI 联动客户端 (供外部 AI Agent 调度)")
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # status
    subparsers.add_parser("status", help="检查桌面 UI Bridge 运行状态")

    # state
    subparsers.add_parser("state", help="获取当前 UI 的激活接口、响应状态及用例数据")

    # send
    subparsers.add_parser("send", help="触发当前激活接口执行发送")

    # run-cases
    subparsers.add_parser("run-cases", help="触发当前接口的所有测试用例执行")

    # push
    push_p = subparsers.add_parser("push", help="推送接口及测试用例到桌面 UI")
    push_p.add_argument("--name", type=str, default="AI 生成请求", help="请求名称")
    push_p.add_argument("--method", type=str, default="GET", help="HTTP 方法: GET, POST, PUT, DELETE 等")
    push_p.add_argument("--url", type=str, required=True, help="请求 URL")
    push_p.add_argument("--header", action="append", help="请求头，格式 'Key: Value'，可多次指定")
    push_p.add_argument("--param", action="append", help="查询参数，格式 'key=value' 或 'key: value'，可多次指定")
    push_p.add_argument("--body", type=str, help="请求体字符串或 JSON")
    push_p.add_argument("--test", action="append", help="测试断言，例如 'status: 200' 或 'contains: ok'")
    push_p.add_argument("--cases-file", type=str, help="测试用例 JSON 文件路径")
    push_p.add_argument("--agent", type=str, default="Antigravity", help="Agent 名称 (如 Antigravity, Cursor, Claude)")
    push_p.add_argument("--task", type=str, help="当前任务描述 (如 '支付接口逆向测试')")
    push_p.add_argument("--thought", type=str, help="AI 思考与意图说明 (投屏至桌面 HUD)")
    push_p.add_argument("--step", type=str, help="当前步骤 (如 'Step 2/5')")
    push_p.add_argument("--send", action="store_true", help="推送后自动触发立即执行发送")

    # thought (向桌面 HUD 投屏思考与任务进度)
    thought_p = subparsers.add_parser("thought", help="向桌面 HUD 投屏 Agent 当前的思考与态势")
    thought_p.add_argument("thought", type=str, help="AI 思考内容或推理逻辑")
    thought_p.add_argument("--agent", type=str, default="Antigravity", help="Agent 名称")
    thought_p.add_argument("--task", type=str, help="当前执行的任务")
    thought_p.add_argument("--step", type=str, help="执行步骤 (如 'Step 3/5')")
    thought_p.add_argument("--status", type=str, default="running", choices=["running", "success", "error", "idle"], help="运行状态")

    # feedback (读取人类在桌面 UI 上留给 Agent 的反馈或裁决)
    subparsers.add_parser("feedback", help="读取人类在桌面 UI 上留下的裁决与反馈")

    # add-case (向当前激活接口追加测试用例)
    case_p = subparsers.add_parser("add-case", help="向当前激活接口追加测试用例")
    case_p.add_argument("--name", type=str, required=True, help="用例名称，如 '逆向：缺Token拦截'")
    case_p.add_argument("--category", type=str, default="positive", choices=["positive", "negative", "boundary", "security"], help="用例类别")
    case_p.add_argument("--body", type=str, help="用例请求体")
    case_p.add_argument("--test", action="append", help="用例断言，如 'status: 401'")
    case_p.add_argument("--thought", type=str, help="此用例的推导思考")

    # json (直接传入完整 JSON)
    json_p = subparsers.add_parser("json", help="以完整 JSON 格式推送接口")
    json_p.add_argument("data", type=str, help="接口 JSON 字符串或文件路径")
    json_p.add_argument("--send", action="store_true", help="推送后自动触发立即执行发送")

    args = parser.parse_args()

    if args.command == "status":
        check_status()
        return

    if args.command == "state":
        get_state()
        return

    if args.command == "send":
        trigger_send()
        return

    if args.command == "run-cases":
        trigger_run_cases()
        return

    if args.command == "thought":
        payload = {
            "agent": args.agent,
            "task": args.task,
            "thought": args.thought,
            "step": args.step,
            "status": args.status,
            "timestamp": int(os.path.getmtime(__file__) if False else 0)
        }
        push_telemetry(payload)
        return

    if args.command == "feedback":
        get_feedback()
        return

    if args.command == "add-case":
        tests = []
        if args.test:
            for i, t in enumerate(args.test):
                if ":" in t:
                    kind, val = t.split(":", 1)
                    kind = kind.strip().lower()
                    val = val.strip()
                    if kind in ("status", "status_equals"):
                        tests.append({
                            "id": f"case_test_{i}",
                            "name": f"状态码为 {val}",
                            "type": "status_equals",
                            "expected": val,
                            "enabled": True
                        })
                    elif kind in ("contains", "body_contains"):
                        tests.append({
                            "id": f"case_test_{i}",
                            "name": f"响应包含 '{val}'",
                            "type": "body_contains",
                            "expected": val,
                            "enabled": True
                        })
        case_item = {
            "name": args.name,
            "category": args.category,
            "body": args.body or "",
            "tests": tests
        }
        push_request({
            "action": "append_cases",
            "cases": [case_item]
        })
        return

    if args.command == "push":
        headers = []
        if args.header:
            for h in args.header:
                if ":" in h:
                    k, v = h.split(":", 1)
                    headers.append({"key": k.strip(), "value": v.strip(), "enabled": True})
        else:
            headers.append({"key": "Content-Type", "value": "application/json", "enabled": True})

        params = []
        if args.param:
            for p in args.param:
                delim = "=" if "=" in p else ":"
                if delim in p:
                    k, v = p.split(delim, 1)
                    params.append({"key": k.strip(), "value": v.strip(), "enabled": True})

        tests = []
        if args.test:
            for i, t in enumerate(args.test):
                if ":" in t:
                    kind, val = t.split(":", 1)
                    kind = kind.strip().lower()
                    val = val.strip()
                    if kind in ("status", "status_equals"):
                        tests.append({
                            "id": f"test_cli_{i}",
                            "name": f"状态码为 {val}",
                            "type": "status_equals",
                            "expected": val,
                            "enabled": True
                        })
                    elif kind in ("contains", "body_contains"):
                        tests.append({
                            "id": f"test_cli_{i}",
                            "name": f"响应包含 '{val}'",
                            "type": "body_contains",
                            "expected": val,
                            "enabled": True
                        })
                    elif kind in ("time", "time_less_than"):
                        tests.append({
                            "id": f"test_cli_{i}",
                            "name": f"耗时小于 {val}ms",
                            "type": "time_less_than",
                            "expected": val,
                            "enabled": True
                        })

        cases = []
        if args.cases_file and os.path.isfile(args.cases_file):
            try:
                with open(args.cases_file, "r", encoding="utf-8") as f:
                    cases = json.load(f)
            except Exception as e:
                print(f"⚠️ 读取用例文件失败: {e}")

        payload = {
            "name": args.name,
            "method": args.method.upper(),
            "url": args.url,
            "headers": headers,
            "params": params,
            "body": args.body or "",
            "tests": tests,
            "cases": cases,
            "agent": args.agent,
            "task": args.task,
            "thought": args.thought,
            "step": args.step,
            "autoSend": args.send
        }
        push_request(payload)
        return

    if args.command == "json":
        raw = args.data
        if os.path.isfile(raw):
            with open(raw, "r", encoding="utf-8") as f:
                payload = json.load(f)
        else:
            payload = json.loads(raw)
        if args.send:
            payload["autoSend"] = True
        push_request(payload)
        return

    parser.print_help()

if __name__ == "__main__":
    main()
