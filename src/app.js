import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

const CREW = ["Cap", "Lt. Burns", "Patrick", "Garcia", "Kowalski", "Torres", "Nguyen"];
const KITTY_MANAGER = "Lt. Burns";
const DEFAULT_PAYMENT_INFO = {
  venmo: "LtBurns-Kitty",
  zelle: "813-555-0192",
};

const initialPayments = [
  { id: 1, from: "Torres", amount: 20, method: "venmo", note: "Monthly dues", timestamp: "Fri 6/14" },
  { id: 2, from: "Garcia", amount: 20, method: "zelle", note: "Monthly dues", timestamp: "Fri 6/14" },
];

export default function App() {
  const [tab, setTab] = useState("groceries");
  const [currentUser, setCurrentUser] = useState(null);
  const [groceries, setGroceries] = useState(() => {
    try { return JSON.parse(localStorage.getItem("kitty_groceries")) || []; } catch { return []; }
  });
  const [newItem, setNewItem] = useState("");
  const [requests, setRequests] = useState([]);
  const [newMeal, setNewMeal] = useState("");
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [payments, setPayments] = useState(initialPayments);
  const [kittyBalance, setKittyBalance] = useState(140);
  const [paymentInfo, setPaymentInfo] = useState(DEFAULT_PAYMENT_INFO);
  const [payFrom, setPayFrom] = useState(CREW[0]);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [showPayConfirm, setShowPayConfirm] = useState(false);
  const [pendingMethod, setPendingMethod] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editVenmo, setEditVenmo] = useState(DEFAULT_PAYMENT_INFO.venmo);
  const [editZelle, setEditZelle] = useState(DEFAULT_PAYMENT_INFO.zelle);
  const [showNamePicker, setShowNamePicker] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("kitty_user");
    if (saved) setCurrentUser(saved);
    else setShowNamePicker(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("kitty_groceries", JSON.stringify(groceries));
  }, [groceries]);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    const { data, error } = await supabase.from("requests").select("*").order("created_at", { ascending: false });
    if (!error && data) setRequests(data);
    setRequestsLoading(false);
  }, []);

  useEffect(() => {
    loadRequests();
    const channel = supabase.channel("requests_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => { loadRequests(); })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadRequests]);

  function addGrocery() {
    if (!newItem.trim()) return;
    setGroceries(prev => [...prev, { id: Date.now(), item: newItem.trim(), added_by: currentUser, done: false }]);
    setNewItem("");
  }
  function toggleGrocery(id) { setGroceries(prev => prev.map(g => g.id === id ? { ...g, done: !g.done } : g)); }
  function removeGrocery(id) { setGroceries(prev => prev.filter(g => g.id !== id)); }
  function clearDone() { setGroceries(prev => prev.filter(g => !g.done)); }

  async function addRequest() {
    if (!newMeal.trim() || !currentUser) return;
    const { error } = await supabase.from("requests").insert({ meal: newMeal.trim(), requested_by: currentUser, upvotes: [currentUser], downvotes: [] });
    if (!error) setNewMeal("");
  }

  async function voteRequest(id, direction) {
    if (!currentUser) return;
    const req = requests.find(r => r.id === id);
    if (!req) return;
    let upvotes = [...(req.upvotes || [])];
    let downvotes = [...(req.downvotes || [])];
    if (direction === "up") {
      if (upvotes.includes(currentUser)) { upvotes = upvotes.filter(u => u !== currentUser); }
      else { upvotes = [...upvotes, currentUser]; downvotes = downvotes.filter(u => u !== currentUser); }
    } else {
      if (downvotes.includes(currentUser)) { downvotes = downvotes.filter(u => u !== currentUser); }
      else { downvotes = [...downvotes, currentUser]; upvotes = upvotes.filter(u => u !== currentUser); }
    }
    await supabase.from("requests").update({ upvotes, downvotes }).eq("id", id);
  }

  async function removeRequest(id) { await supabase.from("requests").delete().eq("id", id); }

  function submitPayment(method) {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    setPendingMethod(method);
    setShowPayConfirm(true);
  }

  function confirmPayment() {
    const amt = parseFloat(payAmount);
    const note = payNote || "Kitty payment";
    const timestamp = new Date().toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
    setPayments(prev => [{ id: Date.now(), from: payFrom, amount: amt, method: pendingMethod, note, timestamp }, ...prev]);
    setKittyBalance(prev => prev + amt);
    if (pendingMethod === "venmo") {
      const encodedNote = encodeURIComponent(`Kitchen Kitty - ${note}`);
      window.open(`venmo://paycharge?txn=pay&recipients=${paymentInfo.venmo}&amount=${amt}&note=${encodedNote}`, "_blank");
      setTimeout(() => { window.open(`https://venmo.com/${paymentInfo.venmo}?txn=pay&amount=${amt}&note=${encodedNote}`, "_blank"); }, 1500);
    } else { window.open("https://www.zellepay.com/", "_blank"); }
    setPayAmount(""); setPayNote(""); setShowPayConfirm(false); setPendingMethod(null);
  }

  function saveSettings() { setPaymentInfo({ venmo: editVenmo, zelle: editZelle }); setShowSettings(false); }

  const doneCt = groceries.filter(g => g.done).length;
  const hasVenmo = paymentInfo.venmo.trim().length > 0;
  const hasZelle = paymentInfo.zelle.trim().length > 0;
  const sortedRequests = [...requests].sort((a, b) => (b.upvotes?.length - b.downvotes?.length) - (a.upvotes?.length - a.downvotes?.length));

  if (showNamePicker) {
    return (
      <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", minHeight: "100vh", background: "#1a1a1a", color: "#f0ece4", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 340, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚒</div>
          <div style={{ fontWeight: 900, fontSize: 28, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Kitchen Kitty</div>
          <div style={{ color: "#888", fontSize: 14, marginBottom: 32 }}>Station House · Who are you?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {CREW.map(name => (
              <button key={name} onClick={() => { setCurrentUser(name); localStorage.setItem("kitty_user", name); setShowNamePicker(false); setPayFrom(name); }}
                style={{ padding: "14px", borderRadius: 10, border: "1px solid #333", background: "#252525", color: "#f0ece4", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", minHeight: "100vh", background: "#1a1a1a", color: "#f0ece4" }}>
      <div style={{ background: "#c0392b", padding: "18px 20px 0", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <span style={{ fontSize: 28 }}>🚒</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: 1, textTransform: "uppercase" }}>Kitchen Kitty</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Hey <strong>{currentUser}</strong> · <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setShowNamePicker(true)}>switch</span></div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, opacity: 0.75, textTransform: "uppercase", letterSpacing: 0.5 }}>Balance</div>
                <div style={{ fontWeight: 800, fontSize: 22 }}>${kittyBalance}</div>
              </div>
              <button onClick={() => { setEditVenmo(paymentInfo.venmo); setEditZelle(paymentInfo.zelle); setShowSettings(true); }} style={{ background: "rgba(0,0,0,0.2)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", padding: "6px 10px", fontSize: 18 }}>⚙️</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
            {[["groceries", "🛒 Groceries"], ["requests", "🍳 Requests"], ["kitty", "💵 Kitty"]].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "10px 4px 12px", border: "none", borderRadius: "6px 6px 0 0", background: tab === key ? "#1a1a1a" : "rgba(0,0,0,0.2)", color: tab === key ? "#f0ece4" : "rgba(255,255,255,0.7)", fontWeight: tab === key ? 700 : 500, fontSize: 13, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "20px 16px 40px" }}>
        {tab === "groceries" && (
          <div>
            <div style={{ background: "#1e1e1e", border: "1px solid #2e2e2e", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#888", textAlign: "center", marginBottom: 14 }}>🔒 Your private list — only you can see this</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === "Enter" && addGrocery()} placeholder="Add item..." style={{ background: "#252525", border: "1px solid #333", borderRadius: 8, color: "#f0ece4", padding: "10px 12px", fontSize: 14, flex: 1, outline: "none" }} />
              <button onClick={addGrocery} style={{ background: "#c0392b", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Add</button>
            </div>
            {groceries.length === 0 && <div style={{ textAlign: "center", color: "#555", padding: "40px 20px", fontSize: 14 }}>Your list is empty. Add something above.</div>}
            {groceries.filter(g => !g.done).map(g => (<GroceryRow key={g.id} item={g} onToggle={() => toggleGrocery(g.id)} onRemove={() => removeGrocery(g.id)} />))}
            {doneCt > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 0 10px" }}>
                  <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>Grabbed ({doneCt})</div>
                  <button onClick={clearDone} style={{ fontSize: 12, color: "#c0392b", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Clear done</button>
                </div>
                {groceries.filter(g => g.done).map(g => (<GroceryRow key={g.id} item={g} onToggle={() => toggleGrocery(g.id)} onRemove={() => removeGrocery(g.id)} />))}
              </>
            )}
          </div>
        )}

        {tab === "requests" && (
          <div>
            <div style={{ background: "#1e1e1e", border: "1px solid #2e2e2e", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#888", textAlign: "center", marginBottom: 14 }}>🌐 Shared with the whole crew — votes sync live</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={newMeal} onChange={e => setNewMeal(e.target.value)} onKeyDown={e => e.key === "Enter" && addRequest()} placeholder="Request a meal or item..." style={{ background: "#252525", border: "1px solid #333", borderRadius: 8, color: "#f0ece4", padding: "10px 12px", fontSize: 14, flex: 1, outline: "none" }} />
              <button onClick={addRequest} style={{ background: "#c0392b", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Add</button>
            </div>
            {requestsLoading && <div style={{ textAlign: "center", color: "#555", padding: "40px 20px", fontSize: 14 }}>Loading...</div>}
            {!requestsLoading && requests.length === 0 && <div style={{ textAlign: "center", color: "#555", padding: "40px 20px", fontSize: 14 }}>No requests yet. Be the first!</div>}
            {sortedRequests.map(r => {
              const ups = r.upvotes || [];
              const downs = r.downvotes || [];
              const score = ups.length - downs.length;
              const votedUp = ups.includes(currentUser);
              const votedDown = downs.includes(currentUser);
              return (
                <div key={r.id} style={{ background: "#252525", borderRadius: 10, padding: "14px", marginBottom: 10, border: "1px solid #2e2e2e" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => voteRequest(r.id, "up")} style={{ width: 36, height: 32, borderRadius: 6, border: `2px solid ${votedUp ? "#4caf50" : "#444"}`, background: votedUp ? "#4caf50" : "transparent", color: votedUp ? "#fff" : "#888", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>▲</button>
                      <span style={{ fontWeight: 800, fontSize: 15, color: score > 0 ? "#4caf50" : score < 0 ? "#e74c3c" : "#888", minWidth: 20, textAlign: "center" }}>{score}</span>
                      <button onClick={() => voteRequest(r.id, "down")} style={{ width: 36, height: 32, borderRadius: 6, border: `2px solid ${votedDown ? "#e74c3c" : "#444"}`, background: votedDown ? "#e74c3c" : "transparent", color: votedDown ? "#fff" : "#888", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>▼</button>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{r.meal}</div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>by {r.requested_by} · {new Date(r.created_at).toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" })}</div>
                      <div style={{ fontSize: 11, marginTop: 5, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {ups.length > 0 && <span style={{ color: "#4caf50" }}>👍 {ups.join(", ")}</span>}
                        {downs.length > 0 && <span style={{ color: "#e74c3c" }}>👎 {downs.join(", ")}</span>}
                      </div>
                    </div>
                    <button onClick={() => removeRequest(r.id)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 16, padding: "4px 8px", borderRadius: 4 }}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "kitty" && (
          <div>
            <div style={{ background: "#c0392b", borderRadius: 10, padding: "14px", marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontSize: 13, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5 }}>Kitty Balance</div>
              <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.1 }}>${kittyBalance}</div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>Managed by {KITTY_MANAGER}</div>
            </div>
            <div style={{ background: "#252525", borderRadius: 10, padding: "14px", marginBottom: 20, border: "1px solid #2e2e2e" }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Pay the Kitty</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <select value={payFrom} onChange={e => setPayFrom(e.target.value)} style={{ background: "#252525", border: "1px solid #333", borderRadius: 8, color: "#f0ece4", padding: "10px 12px", fontSize: 14, flex: 1, outline: "none" }}>
                  {CREW.map(c => <option key={c}>{c}</option>)}
                </select>
                <div style={{ position: "relative", flex: 1 }}>
                  <span style={{ position: "absolute", left: 10, top: "50%",
