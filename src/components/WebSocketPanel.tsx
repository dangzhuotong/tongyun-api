import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Send,
  Power,
  Trash2,
  Copy,
  Check,
  ArrowUpRight,
  ArrowDownLeft,
  Code2
} from 'lucide-react';
import { WsMessageItem, EnvironmentData } from '../types/api';
import { interpolateText } from '../utils/curl';

interface WebSocketPanelProps {
  url: string;
  onChangeUrl: (newUrl: string) => void;
  environment: EnvironmentData | null;
  onToast?: (msg: string) => void;
}

export const WebSocketPanel: React.FC<WebSocketPanelProps> = ({
  url,
  onChangeUrl,
  environment,
  onToast,
}) => {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [messages, setMessages] = useState<WsMessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState('{\n  "event": "ping",\n  "timestamp": ' + Date.now() + '\n}');
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 解析环境变量后的 URL
  const resolvedUrl = interpolateText(url || 'wss://echo.websocket.events', environment);

  // 自动滚动到最新消息
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // 组件卸载时断开连接
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleConnect = () => {
    if (status === 'connected' || status === 'connecting') {
      if (wsRef.current) {
        wsRef.current.close();
      }
      setStatus('disconnected');
      return;
    }

    try {
      setStatus('connecting');
      if (onToast) onToast(`正在连接 WebSocket: ${resolvedUrl}`);
      const ws = new WebSocket(resolvedUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        if (onToast) onToast(`🟢 WebSocket 连接成功: ${resolvedUrl}`);
      };

      ws.onmessage = (event) => {
        const rawData = String(event.data);
        const item: WsMessageItem = {
          id: `msg_recv_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          direction: 'received',
          timestamp: Date.now(),
          data: rawData,
          size: new Blob([rawData]).size,
          isJson: rawData.trim().startsWith('{') || rawData.trim().startsWith('['),
        };
        setMessages(prev => [...prev, item]);
      };

      ws.onerror = (err) => {
        console.error('WebSocket Error:', err);
        setStatus('disconnected');
        if (onToast) onToast('⚠️ WebSocket 连接发生错误');
      };

      ws.onclose = () => {
        setStatus('disconnected');
        if (onToast) onToast('🔌 WebSocket 已断开连接');
      };
    } catch (e: any) {
      setStatus('disconnected');
      if (onToast) onToast(`连接失败: ${e.message}`);
    }
  };

  const handleSendMessage = () => {
    if (!wsRef.current || status !== 'connected') {
      if (onToast) onToast('⚠️ WebSocket 尚未建立连接，请先点击连接');
      return;
    }
    const dataToSend = inputMessage.trim();
    if (!dataToSend) return;

    try {
      wsRef.current.send(dataToSend);
      const item: WsMessageItem = {
        id: `msg_sent_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        direction: 'sent',
        timestamp: Date.now(),
        data: dataToSend,
        size: new Blob([dataToSend]).size,
        isJson: dataToSend.trim().startsWith('{') || dataToSend.trim().startsWith('['),
      };
      setMessages(prev => [...prev, item]);
    } catch (e: any) {
      if (onToast) onToast(`发送异常: ${e.message}`);
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredMessages = messages.filter(m => {
    if (filter === 'sent') return m.direction === 'sent';
    if (filter === 'received') return m.direction === 'received';
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-[var(--ty-bg)] text-[var(--ty-text)] overflow-hidden font-sans">
      {/* 顶部控制栏 */}
      <div className="p-3 border-b border-[var(--ty-border)] flex items-center gap-2 bg-[var(--ty-surface)]">
        {/* WS 协议徽章 */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] text-xs font-mono font-bold text-teal-400 shrink-0">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>WS</span>
        </div>

        {/* URL 输入框 */}
        <div className="relative flex-1">
          <input
            type="text"
            value={url}
            onChange={e => onChangeUrl(e.target.value)}
            placeholder="输入 WebSocket 地址 (如: wss://echo.websocket.events 或 ws://127.0.0.1:8080)..."
            className="w-full bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] rounded px-3 py-1.5 text-xs font-mono text-[var(--ty-text)] outline-none focus:border-[var(--ty-matcha)] transition-colors"
          />
        </div>

        {/* 预置地址快捷填入 */}
        <div className="hidden md:flex items-center gap-1">
          <button
            onClick={() => onChangeUrl('wss://echo.websocket.events')}
            className="px-2 py-1 rounded text-[11px] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] transition-colors"
            title="填入公共 Echo 测试服务"
          >
            Echo测试源
          </button>
          <button
            onClick={() => onChangeUrl('ws://127.0.0.1:8080')}
            className="px-2 py-1 rounded text-[11px] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] transition-colors"
            title="填入本地 8080 端口"
          >
            本地8080
          </button>
        </div>

        {/* 连接 / 断开按钮 (抹茶绿 / 蜜桃红) */}
        <button
          onClick={handleConnect}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold shadow-sm transition-all active:scale-95 ${
            status === 'connected'
              ? 'bg-[var(--ty-peach-tint)] hover:bg-[var(--ty-peach-soft)] text-[var(--ty-peach-text)] border border-[var(--ty-peach)]'
              : 'bg-[var(--ty-matcha)] hover:bg-[var(--ty-matcha-hover)] text-white'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          <span>{status === 'connected' ? '断开连接' : status === 'connecting' ? '连接中...' : '建立连接'}</span>
        </button>
      </div>

      {/* 连接状态指示栏 */}
      <div className="px-4 py-2 bg-[var(--ty-surface-raised)] border-b border-[var(--ty-border)] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[var(--ty-text-muted)]">连接状态:</span>
          <div className="flex items-center gap-1.5 font-medium">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'connected'
                  ? 'bg-emerald-400 ring-4 ring-emerald-500/20 animate-pulse'
                  : status === 'connecting'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-400'
              }`}
            />
            <span
              className={
                status === 'connected'
                  ? 'text-emerald-400'
                  : status === 'connecting'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }
            >
              {status === 'connected' ? '已在线连接' : status === 'connecting' ? '正在握手连接' : '未连接'}
            </span>
          </div>
          <span className="text-[var(--ty-border-strong)]">|</span>
          <span className="text-[var(--ty-text-subtle)] text-[11px] font-mono truncate max-w-sm">
            {resolvedUrl}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* 筛选按钮 */}
          <div className="flex items-center rounded border border-[var(--ty-border)] overflow-hidden text-[11px]">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-0.5 ${filter === 'all' ? 'bg-[var(--ty-matcha)] text-white' : 'hover:bg-[var(--ty-surface)] text-[var(--ty-text-muted)]'}`}
            >
              全部 ({messages.length})
            </button>
            <button
              onClick={() => setFilter('sent')}
              className={`px-2 py-0.5 border-l border-[var(--ty-border)] ${filter === 'sent' ? 'bg-[var(--ty-matcha)] text-white' : 'hover:bg-[var(--ty-surface)] text-[var(--ty-text-muted)]'}`}
            >
              发送 ({messages.filter(m => m.direction === 'sent').length})
            </button>
            <button
              onClick={() => setFilter('received')}
              className={`px-2 py-0.5 border-l border-[var(--ty-border)] ${filter === 'received' ? 'bg-[var(--ty-matcha)] text-white' : 'hover:bg-[var(--ty-surface)] text-[var(--ty-text-muted)]'}`}
            >
              接收 ({messages.filter(m => m.direction === 'received').length})
            </button>
          </div>

          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--ty-text-muted)] hover:text-rose-400 hover:bg-[var(--ty-surface)] transition-colors"
            title="清空消息流"
          >
            <Trash2 className="w-3 h-3" />
            <span>清空</span>
          </button>
        </div>
      </div>

      {/* 主体分栏：左侧消息历史流，右侧发送框 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 实时消息流 */}
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[var(--ty-surface-sunken)] border-r border-[var(--ty-border)] font-mono text-xs"
        >
          {filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--ty-text-subtle)] text-center p-6 space-y-2">
              <Radio className="w-8 h-8 opacity-40 text-[var(--ty-matcha)]" />
              <p className="text-sm font-medium">尚无实时 WebSocket 消息记录</p>
              <p className="text-xs">点击上方「建立连接」后，收发数据将在此毫秒级实时呈现</p>
            </div>
          ) : (
            filteredMessages.map((m) => (
              <div
                key={m.id}
                className={`p-2.5 rounded border transition-colors ${
                  m.direction === 'sent'
                    ? 'bg-[var(--ty-surface)] border-emerald-900/40 text-[var(--ty-text)]'
                    : 'bg-[var(--ty-surface-raised)] border-sky-900/40 text-[var(--ty-text)]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] mb-1.5 pb-1 border-b border-[var(--ty-border)]">
                  <div className="flex items-center gap-1.5">
                    {m.direction === 'sent' ? (
                      <span className="flex items-center gap-0.5 text-emerald-400 font-semibold">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>发送 (Sent)</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-sky-400 font-semibold">
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        <span>接收 (Received)</span>
                      </span>
                    )}
                    <span className="text-[var(--ty-text-subtle)]">
                      {new Date(m.timestamp).toLocaleTimeString()}.{String(m.timestamp % 1000).padStart(3, '0')}
                    </span>
                    <span className="text-[var(--ty-text-subtle)]">({m.size} B)</span>
                  </div>

                  <button
                    onClick={() => handleCopyMessage(m.id, m.data)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)] hover:bg-[var(--ty-surface)]"
                    title="复制消息内容"
                  >
                    {copiedId === m.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>复制</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="whitespace-pre-wrap break-all text-xs font-mono leading-relaxed select-text">
                  {m.data}
                </pre>
              </div>
            ))
          )}
        </div>

        {/* 消息发送面板 */}
        <div className="w-96 flex flex-col bg-[var(--ty-surface)] p-3 shrink-0">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--ty-border)]">
            <span className="text-xs font-semibold text-[var(--ty-text)]">发送数据载荷</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  try {
                    const obj = JSON.parse(inputMessage);
                    setInputMessage(JSON.stringify(obj, null, 2));
                  } catch {
                    if (onToast) onToast('JSON 格式有误，无法美化');
                  }
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-[var(--ty-surface-raised)] hover:bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] text-[var(--ty-text-muted)] hover:text-[var(--ty-text)]"
                title="美化 JSON"
              >
                <Code2 className="w-3 h-3" />
                <span>美化</span>
              </button>
            </div>
          </div>

          <textarea
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            placeholder="输入要发送给 WebSocket 服务器的文本或 JSON..."
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="flex-1 bg-[var(--ty-surface-sunken)] border border-[var(--ty-border)] rounded p-2.5 font-mono text-xs text-[var(--ty-text)] outline-none focus:border-[var(--ty-matcha)] resize-none leading-relaxed"
          />

          <div className="pt-3 flex items-center justify-between">
            <span className="text-[11px] text-[var(--ty-text-subtle)]">快捷键: Ctrl + Enter</span>
            <button
              onClick={handleSendMessage}
              disabled={status !== 'connected'}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[var(--ty-matcha)] hover:bg-[var(--ty-matcha-hover)] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              <span>发送消息</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
