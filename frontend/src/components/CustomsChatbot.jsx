import { useState, useRef, useEffect } from "react";

/* ─── Groq config (mirrors backend/config.py) ─── */
const GROQ_API_KEY  = import.meta.env.VITE_GROQ_API_KEY || "";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL    = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are TradeMaster's expert customs and trade compliance assistant.
You specialize in:
- Customs regulations and procedures worldwide
- HS (Harmonized System) codes and tariff classification
- Import/export duties, taxes, and fees
- Trade compliance and documentation requirements (commercial invoices, packing lists, certificates of origin, bills of lading)
- Incoterms and shipping terms
- Free Trade Agreements (FTAs) and preferential tariff programs
- Customs valuation methods
- Restricted and prohibited goods
- ATA Carnet, temporary admission
- Anti-dumping and countervailing duties
- Frequently asked questions about customs processes

Always be concise, accurate, and professional. When citing regulations, note they may vary by country and advise users to verify with official customs authorities for binding rulings. Keep responses focused and actionable.`;

const QUICK_QUESTIONS = [
  "What documents do I need for importing goods?",
  "How do I find the HS code for my product?",
  "What are Incoterms and which should I use?",
  "How is customs duty calculated?",
  "What is a Certificate of Origin?",
  "How long does customs clearance take?",
];

export default function CustomsChatbot() {
  const [open,      setOpen]      = useState(false);
  const [messages,  setMessages]  = useState([{
    role: "assistant",
    content: "👋 Hi! I'm your TradeMaster customs assistant powered by Groq. Ask me anything about customs regulations, duties, HS codes, trade compliance, or import/export procedures.",
  }]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [minimized, setMinimized] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    if (open && !minimized) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, minimized]);

  useEffect(() => {
    if (open && !minimized && !loading) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, minimized, loading]);

  const sendMessage = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg      = { role: "user", content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      // Build conversation for Groq — skip the initial greeting bubble (index 0)
      const apiMessages = nextMessages
        .slice(1)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          max_tokens: 1000,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...apiMessages,
          ],
        }),
      });

      const data      = await response.json();
      const replyText =
        data?.choices?.[0]?.message?.content ||
        data?.error?.message ||
        "Sorry, I couldn't get a response. Please try again.";

      setMessages((prev) => [...prev, { role: "assistant", content: replyText }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Connection error. Please check your network and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <>
      {/* ── Chat window ── */}
      {open && (
        <div style={{
          position: "fixed", bottom: 90, right: 24,
          width: minimized ? 280 : 380,
          height: minimized ? "auto" : 520,
          zIndex: 9999,
          display: "flex", flexDirection: "column",
          borderRadius: 20, overflow: "hidden",
          background: "rgba(7,11,18,0.97)",
          border: "1px solid rgba(56,189,248,0.25)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(56,189,248,0.08)",
          backdropFilter: "blur(24px)",
          animation: "slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)",
          transition: "width 0.3s ease, height 0.3s ease",
          fontFamily: "'Inter','DM Sans',sans-serif",
        }}>

          {/* Header */}
          <div style={{
            padding: "14px 16px",
            background: "linear-gradient(135deg,rgba(56,189,248,0.12) 0%,rgba(0,160,255,0.06) 100%)",
            borderBottom: "1px solid rgba(56,189,248,0.15)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg,#38BDF8,#0ea5e9)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, flexShrink: 0,
                boxShadow: "0 0 12px rgba(56,189,248,0.4)",
              }}>🛃</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#e9f2ff", letterSpacing: "-0.01em" }}>
                  Customs Assistant
                </div>
                <div style={{ fontSize: 10, color: "#38BDF8", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 6px #22c55e" }} />
                  Groq · llama-3.3-70b
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setMinimized((m) => !m)}
                style={{ background: "none", border: "none", color: "rgba(56,189,248,0.6)", cursor: "pointer", fontSize: 16, padding: "2px 6px", borderRadius: 6, lineHeight: 1 }}
                title={minimized ? "Expand" : "Minimize"}
              >{minimized ? "▲" : "▼"}</button>
              <button
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", color: "rgba(56,189,248,0.6)", cursor: "pointer", fontSize: 16, padding: "2px 6px", borderRadius: 6, lineHeight: 1 }}
                title="Close"
              >✕</button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div style={{
                flex: 1, overflowY: "auto", padding: "16px 14px",
                display: "flex", flexDirection: "column", gap: 12,
                scrollbarWidth: "thin", scrollbarColor: "rgba(56,189,248,0.15) transparent",
              }}>
                {/* Quick chips — only at conversation start */}
                {messages.length <= 1 && (
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 10, color: "rgba(56,189,248,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                      Quick questions
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {QUICK_QUESTIONS.map((q) => (
                        <button key={q} onClick={() => sendMessage(q)} style={{
                          background: "rgba(56,189,248,0.07)",
                          border: "1px solid rgba(56,189,248,0.2)",
                          borderRadius: 20, padding: "5px 10px",
                          color: "#7dd3fc", fontSize: 11, cursor: "pointer",
                          transition: "all 0.2s", textAlign: "left", lineHeight: 1.4,
                        }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(56,189,248,0.14)"; e.currentTarget.style.borderColor = "rgba(56,189,248,0.4)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(56,189,248,0.07)"; e.currentTarget.style.borderColor = "rgba(56,189,248,0.2)"; }}
                        >{q}</button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} style={{
                    display: "flex",
                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                    alignItems: "flex-end", gap: 8,
                    animation: "msgIn 0.25s ease",
                  }}>
                    {msg.role === "assistant" && (
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                        background: "linear-gradient(135deg,#38BDF8,#0ea5e9)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, boxShadow: "0 0 8px rgba(56,189,248,0.3)",
                      }}>🛃</div>
                    )}
                    <div style={{
                      maxWidth: "82%", padding: "10px 13px",
                      borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: msg.role === "user"
                        ? "linear-gradient(135deg,rgba(56,189,248,0.18),rgba(14,165,233,0.12))"
                        : "rgba(255,255,255,0.05)",
                      border: msg.role === "user"
                        ? "1px solid rgba(56,189,248,0.3)"
                        : "1px solid rgba(255,255,255,0.08)",
                      color: msg.role === "user" ? "#e9f2ff" : "#c8d8ea",
                      fontSize: 12.5, lineHeight: 1.65,
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}>{msg.content}</div>
                  </div>
                ))}

                {loading && (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                      background: "linear-gradient(135deg,#38BDF8,#0ea5e9)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                    }}>🛃</div>
                    <div style={{
                      padding: "10px 14px", borderRadius: "16px 16px 16px 4px",
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                      display: "flex", gap: 4, alignItems: "center",
                    }}>
                      {[0, 0.2, 0.4].map((delay, i) => (
                        <div key={i} style={{
                          width: 6, height: 6, borderRadius: "50%", background: "#38BDF8",
                          animation: `bounce 1s ease-in-out ${delay}s infinite`,
                        }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{
                padding: "12px 14px",
                borderTop: "1px solid rgba(56,189,248,0.1)",
                background: "rgba(5,8,14,0.8)",
                display: "flex", gap: 8, flexShrink: 0, alignItems: "flex-end",
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask about customs, duties, HS codes…"
                  rows={1}
                  disabled={loading}
                  style={{
                    flex: 1,
                    background: "rgba(56,189,248,0.06)",
                    border: "1px solid rgba(56,189,248,0.2)",
                    borderRadius: 12, padding: "9px 12px",
                    color: "#e9f2ff", fontSize: 12.5,
                    resize: "none", outline: "none",
                    fontFamily: "inherit", lineHeight: 1.5,
                    maxHeight: 80, overflowY: "auto",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(56,189,248,0.5)"; }}
                  onBlur={(e)  => { e.target.style.borderColor = "rgba(56,189,248,0.2)"; }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  style={{
                    width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                    background: input.trim() && !loading
                      ? "linear-gradient(135deg,#38BDF8,#0ea5e9)"
                      : "rgba(56,189,248,0.1)",
                    border: "none",
                    color: input.trim() && !loading ? "#fff" : "rgba(56,189,248,0.3)",
                    cursor: input.trim() && !loading ? "pointer" : "default",
                    fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                    boxShadow: input.trim() && !loading ? "0 0 16px rgba(56,189,248,0.3)" : "none",
                  }}
                >↑</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── FAB button ── */}
      <button
        onClick={() => { setOpen((o) => !o); setMinimized(false); }}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          width: 56, height: 56, borderRadius: "50%",
          background: open
            ? "rgba(56,189,248,0.15)"
            : "linear-gradient(135deg,#38BDF8 0%,#0ea5e9 100%)",
          border: open ? "2px solid rgba(56,189,248,0.4)" : "none",
          color: "#fff", fontSize: open ? 22 : 24, cursor: "pointer",
          boxShadow: open
            ? "0 4px 24px rgba(56,189,248,0.2)"
            : "0 8px 32px rgba(56,189,248,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
          transform: open ? "rotate(180deg) scale(0.9)" : "scale(1)",
          animation: open ? "none" : "fabPulse 3s ease-in-out infinite",
        }}
        title="Customs Assistant"
      >{open ? "✕" : "🛃"}</button>

      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform:translateY(20px) scale(0.95); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }
        @keyframes msgIn {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0);   }
        }
        @keyframes bounce {
          0%,80%,100% { transform:translateY(0);   opacity:0.5; }
          40%          { transform:translateY(-6px); opacity:1;   }
        }
        @keyframes fabPulse {
          0%,100% { box-shadow:0 8px 32px rgba(56,189,248,0.45),0 0 0  0px rgba(56,189,248,0.4); }
          50%     { box-shadow:0 8px 32px rgba(56,189,248,0.45),0 0 0 10px rgba(56,189,248,0);   }
        }
      `}</style>
    </>
  );
}
