"use client";

import { useState, useRef, useEffect, FormEvent } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  escalated?: boolean;
  ts: number;
};

type SendState = "idle" | "sending";

const DEMO_SCENARIOS = [
  { label: "Order tracking",     message: "Hi, I need to check on my order AW-10091, email james@example.com" },
  { label: "Return request",     message: "I want to return my Ember chair. Order AW-10042, sarah@example.com" },
  { label: "Custom item return", message: "I need to return my sofa. Order AW-10115, email maria@example.com" },
  { label: "Product question",   message: "What are the dimensions of the Drift Dining Table? Does it need assembly?" },
  { label: "Escalation trigger", message: "This is unacceptable — I'm considering contacting a lawyer about my damaged table." },
  { label: "Window expired",     message: "Can I return my coffee table? Order AW-9887, lin@example.com" },
];

function uid() { return Math.random().toString(36).slice(2, 10); }

const INIT_MSG: Message = {
  id: "init",
  role: "assistant",
  content: "Hello! I'm here to help with anything Arcwood — products, orders, returns, or general questions. What can I do for you today?",
  ts: 0,
};

export default function ChatPage() {
  const [mounted, setMounted]           = useState(false);
  const [messages, setMessages]         = useState<Message[]>([INIT_MSG]);
  const [input, setInput]               = useState("");
  const [sendState, setSendState]       = useState<SendState>("idle");
  const [isEscalated, setIsEscalated]   = useState(false);
  const [mode, setMode]                 = useState<"demo" | "live">("demo");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // Fix hydration: only stamp real time on the client
  useEffect(() => {
    setMounted(true);
    setMessages([{ ...INIT_MSG, ts: Date.now() }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function resetSession() {
    await fetch("/api/reset", { method: "POST" }).catch(() => {});
    setMessages([{ ...INIT_MSG, ts: Date.now() }]);
    setIsEscalated(false);
    setInput("");
    setSendState("idle");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function send(text: string) {
    if (!text.trim() || sendState !== "idle") return;
    setMessages((m) => [...m, { id: uid(), role: "user", content: text.trim(), ts: Date.now() }]);
    setInput("");
    setSendState("sending");

    try {
      const res  = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim() }),
      });
      const data = await res.json();
      setMode(data.mode ?? "demo");
      if (data.escalated) setIsEscalated(true);
      setMessages((m) => [...m, { id: uid(), role: "assistant", content: data.reply, escalated: data.escalated, ts: Date.now() }]);
    } catch {
      setMessages((m) => [...m, { id: uid(), role: "assistant", content: "I'm having trouble connecting right now. Please try again in a moment.", ts: Date.now() }]);
    } finally {
      setSendState("idle");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleSubmit(e: FormEvent) { e.preventDefault(); send(input); }
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  function fmt(line: string): React.ReactNode {
    return line.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
      p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2,-2)}</strong> : p
    );
  }

  function fmtTime(ts: number) {
    if (!mounted || ts === 0) return "";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={s.page}>
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <span style={s.logoWord}>Arcwood</span>
          <span style={s.logoSub}>Support</span>
        </div>

        <div style={s.sideSection}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <p style={s.sideLabel}>Demo scenarios</p>
            <button onClick={resetSession} style={s.resetBtn}>↺ Reset</button>
          </div>
          <p style={s.sideHint}>Click to send · Reset to start fresh</p>
          <div style={s.scenarioList}>
            {DEMO_SCENARIOS.map((sc) => (
              <button
                key={sc.label}
                style={{ ...s.scenarioBtn, opacity: sendState !== "idle" ? 0.5 : 1 }}
                onClick={() => send(sc.message)}
                disabled={sendState !== "idle"}
              >
                <span style={s.arrow}>→</span>{sc.label}
              </button>
            ))}
          </div>
        </div>

        <div style={s.sideSection}>
          <p style={s.sideLabel}>Mode</p>
          <div style={{ ...s.modeBadge, background: mode === "live" ? "#D4EDDA" : "#FFF3CD" }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background: mode==="live" ? "#2D7A4F" : "#B5703B", display:"inline-block", flexShrink:0 }} />
            {mode === "live" ? "Live Shopify data" : "Demo / mock data"}
          </div>
        </div>

        {isEscalated && (
          <div style={s.escalatedBanner}>
            <span>⬆</span>
            <div>
              <strong>Escalated to team</strong>
              <p style={{ margin:0, fontSize:12, opacity:0.85, marginTop:2 }}>Hit ↺ Reset to start a new conversation.</p>
            </div>
          </div>
        )}
      </aside>

      <main style={s.main}>
        <div style={s.header}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={s.avatar}>A</div>
            <div>
              <div style={s.agentName}>Arcwood Support</div>
              <div style={s.agentStatus}>
                <span style={{ display:"inline-block", width:7, height:7, borderRadius:"50%", background:"#2D7A4F", marginRight:5 }} />
                Online · typically replies instantly
              </div>
            </div>
          </div>
        </div>

        <div style={s.messages}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ ...s.row, justifyContent: msg.role==="user" ? "flex-end" : "flex-start" }}>
              {msg.role === "assistant" && <div style={s.avatarSm}>A</div>}
              <div style={{ maxWidth:"72%" }}>
                <div style={{ ...s.bubble, ...(msg.role==="user" ? s.bUser : s.bAgent), ...(msg.escalated ? s.bEsc : {}) }}>
                  {msg.content.split("\n").map((line, i, arr) => (
                    <span key={i}>{fmt(line)}{i < arr.length-1 && <br />}</span>
                  ))}
                </div>
                <div style={{ ...s.ts, textAlign: msg.role==="user" ? "right" : "left" }}>
                  {fmtTime(msg.ts)}
                  {msg.escalated && <span style={{ color:"#B5703B", fontWeight:600 }}> · escalated</span>}
                </div>
              </div>
            </div>
          ))}

          {sendState === "sending" && (
            <div style={{ ...s.row, justifyContent:"flex-start" }}>
              <div style={s.avatarSm}>A</div>
              <div style={{ ...s.bubble, ...s.bAgent, display:"flex", gap:5, padding:"14px 18px" }}>
                {[0,1,2].map((i) => (
                  <span key={i} style={{ width:7, height:7, borderRadius:"50%", background:"#B5703B", display:"inline-block", animation:`pulse 1.2s infinite ${i*0.2}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={s.inputArea}>
          <form onSubmit={handleSubmit} style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about an order, product, or policy…"
              disabled={sendState !== "idle"}
              rows={1}
              style={s.textarea}
            />
            <button type="submit" disabled={sendState !== "idle" || !input.trim()} style={{ ...s.sendBtn, opacity: sendState !== "idle" || !input.trim() ? 0.4 : 1 }}>
              Send
            </button>
          </form>
          <p style={{ fontSize:11, color:"#7A7068", textAlign:"center", marginTop:6 }}>
            {mode === "demo" ? "Running on mock data — set SHOPIFY_* env vars for live store." : "Connected to live Shopify store."}
          </p>
        </div>
      </main>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.25} 50%{opacity:1} }
        textarea { resize:none; overflow:hidden; }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:          { display:"flex", height:"100vh", fontFamily:"var(--font-body)", background:"var(--sand)" },
  sidebar:       { width:244, flexShrink:0, background:"var(--bark)", color:"#F5F0E8", display:"flex", flexDirection:"column", padding:"28px 20px", gap:28, overflowY:"auto" },
  logo:          { display:"flex", flexDirection:"column", gap:2 },
  logoWord:      { fontFamily:"var(--font-display)", fontSize:22, color:"#FAF7F2" },
  logoSub:       { fontSize:11, textTransform:"uppercase", letterSpacing:"2px", color:"#B5703B", fontWeight:500 },
  sideSection:   { display:"flex", flexDirection:"column", gap:8 },
  sideLabel:     { fontSize:11, textTransform:"uppercase", letterSpacing:"1.5px", color:"#9E8F7E", fontWeight:600, margin:0 },
  sideHint:      { fontSize:11, color:"#7A6B5C", margin:0 },
  resetBtn:      { background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:6, color:"#C8BAA8", fontSize:11, padding:"3px 8px", cursor:"pointer", fontFamily:"var(--font-body)" },
  scenarioList:  { display:"flex", flexDirection:"column", gap:5 },
  scenarioBtn:   { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#E8E2D9", fontSize:12, padding:"8px 12px", textAlign:"left", cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontFamily:"var(--font-body)" },
  arrow:         { color:"#B5703B", fontSize:13, flexShrink:0 },
  modeBadge:     { display:"flex", alignItems:"center", gap:8, borderRadius:8, padding:"8px 12px", fontSize:12, color:"#3D2E1E", fontWeight:500 },
  escalatedBanner: { background:"rgba(181,112,59,0.2)", border:"1px solid rgba(181,112,59,0.4)", borderRadius:10, padding:"12px 14px", display:"flex", gap:10, alignItems:"flex-start", color:"#F5D4B5", fontSize:13 },
  main:          { flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"var(--cream)" },
  header:        { padding:"14px 24px", borderBottom:"1px solid var(--mist)", background:"var(--white)", boxShadow:"0 1px 4px rgba(61,46,30,0.06)" },
  avatar:        { width:40, height:40, borderRadius:"50%", background:"var(--bark)", color:"var(--sand)", fontFamily:"var(--font-display)", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" },
  agentName:     { fontWeight:600, fontSize:15, color:"var(--bark)" },
  agentStatus:   { fontSize:12, color:"var(--slate)", display:"flex", alignItems:"center" },
  messages:      { flex:1, overflowY:"auto", padding:"24px 28px", display:"flex", flexDirection:"column", gap:16 },
  row:           { display:"flex", alignItems:"flex-end", gap:10 },
  avatarSm:      { width:30, height:30, borderRadius:"50%", background:"var(--bark)", color:"var(--sand)", fontFamily:"var(--font-display)", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  bubble:        { padding:"12px 16px", borderRadius:16, fontSize:14, lineHeight:1.65, wordBreak:"break-word" as const },
  bAgent:        { background:"var(--white)", border:"1px solid var(--mist)", color:"var(--bark)", borderBottomLeftRadius:4, boxShadow:"0 2px 8px rgba(61,46,30,0.06)" },
  bUser:         { background:"var(--bark)", color:"var(--cream)", borderBottomRightRadius:4 },
  bEsc:          { borderLeft:"3px solid #B5703B" },
  ts:            { fontSize:11, color:"var(--slate)", marginTop:4, paddingLeft:2, paddingRight:2 },
  inputArea:     { padding:"14px 24px 18px", borderTop:"1px solid var(--mist)", background:"var(--white)" },
  textarea:      { flex:1, border:"1.5px solid var(--mist)", borderRadius:12, padding:"11px 16px", fontSize:14, fontFamily:"var(--font-body)", color:"var(--bark)", background:"var(--sand)", outline:"none", lineHeight:1.5, maxHeight:140, width:"100%" },
  sendBtn:       { background:"var(--bark)", color:"var(--cream)", border:"none", borderRadius:10, padding:"11px 20px", fontSize:14, fontWeight:600, fontFamily:"var(--font-body)", flexShrink:0, cursor:"pointer" },
};
