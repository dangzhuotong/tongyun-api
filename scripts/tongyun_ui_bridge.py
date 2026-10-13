#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tongyun API (橦云接口) - AI UI Bridge Client
让任意外部 AI Agent（Antigravity、Cursor、Claude、GPT）能够将生成的接口请求实时推入橦云桌面客户端 UI，
免去用户手工录入与复制粘贴。
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

def push_request(payload):
    """推送单个接口请求数据到客户端 UI"""
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
            print(f"🚀 [推送成功] {payload.get('method', 'GET')} {payload.get('url', '')} -> 已实时注入桌面 UI 标签页！")
            return res_json
    except urllib.error.URLError as e:
        print(f"❌ [推送失败] 无法连接到桌面应用 (端口 {BRIDGE_PORT}): {e}")
        return None
    except Exception as e:
        print(f"❌ [推送失败] 发生异常: {e}")
        return None

def trigger_send(payload=None):
    """触发客户端 UI 执行发送"""
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
            print(f"⚡ [执行成功] 已通知桌面 UI 执行发送！")
            return res_json
    except Exception as e:
        print(f"❌ [执行失败] 无法触发发送: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="橦云接口 UI AI 联动客户端")
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # status
    subparsers.add_parser("status", help="检查桌面 UI Bridge 运行状态")

    # push
    push_p = subparsers.add_parser("push", help="推送接口到桌面 UI")
    push_p.add_argument("--name", type=str, default="AI 生成请求", help="请求名称")
    push_p.add_argument("--method", type=str, default="GET", help="HTTP 方法: GET, POST, PUT, DELETE 等")
    push_p.add_argument("--url", type=str, required=True, help="请求 URL")
    push_p.add_argument("--header", action="append", help="请求头，格式 'Key: Value'，可多次指定")
    push_p.add_argument("--param", action="append", help="查询参数，格式 'key=value' 或 'key: value'，可多次指定")
    push_p.add_argument("--body", type=str, help="请求体字符串或 JSON")
    push_p.add_argument("--test", action="append", help="测试断言，例如 'status: 200' 或 'contains: ok'")
    push_p.add_argument("--send", action="store_true", help="推送后自动触发立即执行发送")

    # json (直接传入完整 JSON)
    json_p = subparsers.add_parser("json", help="以完整 JSON 格式推送接口")
    json_p.add_argument("data", type=str, help="接口 JSON 字符串或文件路径")
    json_p.add_argument("--send", action="store_true", help="推送后自动触发立即执行发送")

    args = parser.parse_args()

    if args.command == "status":
        check_status()
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

        payload = {
            "name": args.name,
            "method": args.method.upper(),
            "url": args.url,
            "headers": headers,
            "params": params,
            "body": args.body or "",
            "tests": tests,
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
