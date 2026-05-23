// ─────────────────────────────────────────────────────────────
// CHAT PANEL — Real-time chat powered by WebSocket + MongoDB.
//
// Step 2 (Silver): floating panel that any logged-in user can open.
// Messages are persisted in MongoDB and broadcast to all users in
// the same room via the existing /ws WebSocket connection.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { getStoredToken } from '../data/api';

const ROOM = 'general';

export default function ChatPanel({ realtime, currentUser }) {
  const [open,      setOpen]      = useState(false);
  const [messages,  setMessages]  = useState([]);
  const [online,    setOnline]    = useState([]);
  const [input,     setInput]     = useState('');
  const [connected, setConnected] = useState(false);
  const [joined,    setJoined]    = useState(false);
  const bottomRef = useRef(null);

  // ── Authenticate + join on WS connect/reconnect ──────────────
  useEffect(() => {
    const offConn = realtime.onConnectionChange((isConnected) => {
      setConnected(isConnected);
      if (isConnected) {
        const token = getStoredToken();
        if (token) realtime.send({ type: 'chat:auth', token });
        realtime.send({ type: 'chat:join', roomId: ROOM });
        setJoined(true);
      } else {
        setJoined(false);
      }
    });
    return offConn;
  }, [realtime]);

  // Join once if WS is already connected when panel mounts
  useEffect(() => {
    const token = getStoredToken();
    if (token) realtime.send({ type: 'chat:auth', token });
    realtime.send({ type: 'chat:join', roomId: ROOM });
    setJoined(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Subscribe to chat events ──────────────────────────────────
  useEffect(() => {
    const offMsg = realtime.subscribe('chat:message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });
    const offHist = realtime.subscribe('chat:history', (history) => {
      setMessages(Array.isArray(history) ? history : []);
    });
    const offOnline = realtime.subscribe('chat:online', (users) => {
      setOnline(Array.isArray(users) ? users : []);
    });
    return () => { offMsg(); offHist(); offOnline(); };
  }, [realtime]);

  // ── Auto-scroll to bottom on new messages ────────────────────
  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // ── Send ─────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const content = input.trim();
    if (!content || !connected) return;
    realtime.send({ type: 'chat:message', content });
    setInput('');
  }, [input, connected, realtime]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="chat-widget">
      {/* Toggle button */}
      <button
        className={`chat-toggle ${open ? 'chat-toggle--open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Chat"
      >
        <span className="chat-toggle-icon">💬</span>
        {!open && messages.length > 0 && (
          <span className="chat-badge">{Math.min(messages.length, 99)}</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="chat-panel">
          {/* Header */}
          <div className="chat-header">
            <span className="chat-title">CHAT — GENERAL</span>
            <span className="chat-status">
              {connected ? (
                <span className="chat-dot chat-dot--on" title="Connected" />
              ) : (
                <span className="chat-dot chat-dot--off" title="Disconnected" />
              )}
            </span>
            <button className="chat-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* Online users */}
          {online.length > 0 && (
            <div className="chat-online">
              {online.map(u => (
                <span
                  key={u.userId}
                  className={`chat-online-user ${u.userId === currentUser?.id ? 'chat-online-user--self' : ''}`}
                >
                  ● {u.userEmail.split('@')[0]}
                </span>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="chat-messages">
            {messages.length === 0 && (
              <p className="chat-empty">No messages yet. Say hello!</p>
            )}
            {messages.map((msg, i) => {
              const isSelf = msg.userId === currentUser?.id;
              return (
                <div key={msg._id ?? i} className={`chat-msg ${isSelf ? 'chat-msg--self' : ''}`}>
                  <div className="chat-msg-meta">
                    <span className="chat-msg-author">
                      {msg.userEmail?.split('@')[0] ?? 'unknown'}
                      {msg.userRole === 'admin' && <span className="chat-msg-admin"> ★</span>}
                    </span>
                    <span className="chat-msg-time">
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div className="chat-msg-content">{msg.content}</div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="chat-input-row">
            <textarea
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={connected ? 'Type a message… (Enter to send)' : 'Reconnecting…'}
              disabled={!connected || !joined}
              rows={1}
            />
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={!connected || !input.trim()}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
