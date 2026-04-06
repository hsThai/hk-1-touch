/* v1775220000-public */
// Trang công khai — khách quét QR xem tiến độ đơn sửa
// URL: /order-public?code=HK-XXXX
// KHÔNG cần đăng nhập

import React, { useState, useEffect } from "react";

const APP_URL = "https://hk-app-copy-4cefbb7c.base44.app";

// ── Helpers ──────────────────────────────────────────────
function getPbUrl() {
  try { return localStorage.getItem("pb_url") || "https://digiera.cameraddns.net"; } catch { return "https://digiera.cameraddns.net"; }
}

async function pbFetch(path, options = {}) {
  const base = getPbUrl();
  const url = `${base}/api/${path}`;
  const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers||{}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

async function getOrderByCode(code) {
  const params = new URLSearchParams({ filter: `order_code="${code}"`, perPage: 1 });
  const data = await pbFetch(`collections/repair_orders/records?${params}`);
  return (data.items || [])[0] || null;
}

async function getOrderHistory(order_id) {
  const params = new URLSearchParams({ filter: `order_id="${order_id}"`, sort: "created", perPage: 100 });
  const data = await pbFetch(`collections/order_history/records?${params}`);
  return data.items || [];
}

// ── Status display ───────────────────────────────────────
const STATUS_COLOR = {
  "Chưa Nhận":     { bg:"#f3f4f6", text:"#6b7280",  icon:"schedule" },
  "Mới Nhận":      { bg:"#dbeafe", text:"#1d4ed8",  icon:"inbox" },
  "Đang Kiểm Tra": { bg:"#fef9c3", text:"#854d0e",  icon:"search" },
  "Đang Sửa":      { bg:"#fce7f3", text:"#be185d",  icon:"build" },
  "Chờ Linh Kiện": { bg:"#ffedd5", text:"#c2410c",  icon:"inventory_2" },
  "Hoàn Thành":    { bg:"#dcfce7", text:"#15803d",  icon:"check_circle" },
  "Đã Giao":       { bg:"#d1fae5", text:"#065f46",  icon:"handshake" },
  "Hủy":           { bg:"#fee2e2", text:"#dc2626",  icon:"cancel" },
};

const ACTION_ICON = {
  created:        { icon:"add_circle", color:"#4f46e5" },
  status_changed: { icon:"swap_horiz",  color:"#0369a1" },
  assigned:       { icon:"person_add",  color:"#7c3aed" },
  reassigned:     { icon:"people",      color:"#b45309" },
  cost_updated:   { icon:"payments",    color:"#15803d" },
  note_updated:   { icon:"edit_note",   color:"#6b7280" },
  delivered:      { icon:"handshake",   color:"#065f46" },
  parts_added:    { icon:"inventory_2", color:"#0891b2" },
  other:          { icon:"info",        color:"#9ca3af" },
};

function MI({ name, style }) {
  return <span className="material-icons" style={{ fontFamily:"Material Icons", userSelect:"none", lineHeight:1, verticalAlign:"middle", ...style }}>{name}</span>;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

function fmtDateFull(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

// ── Progress bar ─────────────────────────────────────────
const STEPS = ["Chưa Nhận","Mới Nhận","Đang Kiểm Tra","Đang Sửa","Hoàn Thành","Đã Giao"];
function ProgressBar({ status }) {
  const idx = STEPS.indexOf(status);
  const cur = idx < 0 ? 0 : idx;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:0, margin:"8px 0 4px" }}>
      {STEPS.map((s, i) => {
        const done = i <= cur;
        const active = i === cur;
        return (
          <React.Fragment key={s}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:i===0||i===STEPS.length-1?0:1, minWidth:i===0||i===STEPS.length-1?28:undefined }}>
              <div style={{
                width:28, height:28, borderRadius:"50%",
                background: active ? "#4f46e5" : done ? "#818cf8" : "#e5e7eb",
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: active ? "0 0 0 3px #c7d2fe" : "none",
                transition:"all .3s",
              }}>
                {done
                  ? <MI name={active ? "radio_button_checked" : "check"} style={{ fontSize:14, color:"#fff" }} />
                  : <div style={{ width:8, height:8, borderRadius:"50%", background:"#d1d5db" }} />
                }
              </div>
              <div style={{ fontSize:9, color: active?"#4f46e5":done?"#818cf8":"#9ca3af", marginTop:3, fontWeight:active?700:400, textAlign:"center", lineHeight:"1.2", maxWidth:44 }}>{s}</div>
            </div>
            {i < STEPS.length-1 && (
              <div style={{ flex:1, height:2, background: i < cur ? "#818cf8" : "#e5e7eb", transition:"all .3s", minWidth:8, marginBottom:18 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────
export default function OrderPublic() {
  const [order, setOrder] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    // Lấy code từ URL query
    const params = new URLSearchParams(window.location.search);
    const c = params.get("code") || params.get("order") || "";
    setCode(c);
    if (c) loadOrder(c);
    else setLoading(false);
  }, []);

  async function loadOrder(c) {
    setLoading(true);
    setError("");
    try {
      const ord = await getOrderByCode(c.toUpperCase().trim());
      if (!ord) { setError("Không tìm thấy đơn sửa chữa với mã: " + c); setLoading(false); return; }
      setOrder(ord);
      const hist = await getOrderHistory(ord.id);
      setHistory(hist);
    } catch(e) {
      setError("Không thể kết nối hệ thống. Vui lòng thử lại sau.");
    }
    setLoading(false);
  }

  const st = order ? (STATUS_COLOR[order.status] || { bg:"#f3f4f6", text:"#6b7280", icon:"info" }) : null;

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%)", display:"flex", flexDirection:"column", alignItems:"center", padding:"20px 16px 40px" }}>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />

      {/* Header */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:24 }}>
        <div style={{ width:64, height:64, borderRadius:20, background:"rgba(255,255,255,.15)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:10, boxShadow:"0 4px 24px rgba(0,0,0,.3)" }}>
          <MI name="phone_android" style={{ fontSize:36, color:"#fff" }} />
        </div>
        <div style={{ color:"#fff", fontWeight:800, fontSize:22, letterSpacing:0.5 }}>HK One Touch</div>
        <div style={{ color:"rgba(255,255,255,.6)", fontSize:12, marginTop:2 }}>Tra cứu tiến độ sửa chữa</div>
      </div>

      {/* Search box nếu chưa có code */}
      {!order && !loading && (
        <div style={{ width:"100%", maxWidth:420, background:"rgba(255,255,255,.1)", borderRadius:20, padding:20, backdropFilter:"blur(12px)" }}>
          <div style={{ color:"#fff", fontWeight:700, fontSize:15, marginBottom:12 }}>Nhập mã đơn sửa chữa</div>
          <div style={{ display:"flex", gap:8 }}>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key==="Enter" && code && loadOrder(code)}
              placeholder="VD: HK-240501-001"
              style={{ flex:1, height:44, borderRadius:12, border:"none", padding:"0 14px", fontSize:15, outline:"none", background:"rgba(255,255,255,.9)" }}
            />
            <button onClick={() => code && loadOrder(code)}
              style={{ height:44, padding:"0 18px", borderRadius:12, background:"#4f46e5", border:"none", color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer" }}>
              <MI name="search" style={{ fontSize:20, color:"#fff" }} />
            </button>
          </div>
          {error && <div style={{ color:"#fca5a5", fontSize:13, marginTop:10 }}>{error}</div>}
          <div style={{ color:"rgba(255,255,255,.5)", fontSize:12, marginTop:12, textAlign:"center" }}>
            Mã đơn có trên phiếu tiếp nhận hoặc được gửi qua Zalo/SMS
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ color:"rgba(255,255,255,.7)", fontSize:16, marginTop:40 }}>
          <MI name="sync" style={{ fontSize:28, color:"rgba(255,255,255,.7)", animation:"spin 1s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* Order card */}
      {order && !loading && (
        <div style={{ width:"100%", maxWidth:460 }}>
          {/* Status badge */}
          <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
            <div style={{ background: st.bg, color: st.text, borderRadius:50, padding:"8px 20px", display:"flex", alignItems:"center", gap:6, fontWeight:800, fontSize:15, boxShadow:"0 2px 12px rgba(0,0,0,.15)" }}>
              <MI name={st.icon} style={{ fontSize:20, color:st.text }} />
              {order.status}
            </div>
          </div>

          {/* Progress */}
          {!["Hủy","Chờ Linh Kiện"].includes(order.status) && (
            <div style={{ background:"rgba(255,255,255,.95)", borderRadius:20, padding:"16px 16px 20px", marginBottom:14, boxShadow:"0 4px 24px rgba(0,0,0,.15)" }}>
              <ProgressBar status={order.status} />
            </div>
          )}

          {/* Thông tin đơn */}
          <div style={{ background:"rgba(255,255,255,.95)", borderRadius:20, padding:20, marginBottom:14, boxShadow:"0 4px 24px rgba(0,0,0,.15)" }}>
            <div style={{ fontWeight:800, fontSize:16, color:"#1e1b4b", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
              <MI name="receipt_long" style={{ fontSize:20, color:"#4f46e5" }} /> Thông tin đơn
            </div>
            <Row icon="tag" label="Mã đơn" value={order.order_code} mono />
            <Row icon="phone_android" label="Thiết bị" value={[order.device_name, order.device_model].filter(Boolean).join(" — ")} />
            {order.imei && <Row icon="fingerprint" label="IMEI/Serial" value={order.imei} mono />}
            <Row icon="build_circle" label="Tình trạng" value={order.issue_description} />
            <Row icon="calendar_today" label="Ngày nhận" value={fmtDateFull(order.received_date || order.created)} />
            {order.estimated_done_date && <Row icon="event_available" label="Dự kiến xong" value={fmtDateFull(order.estimated_done_date)} highlight />}
            {order.done_date && <Row icon="check_circle" label="Hoàn thành lúc" value={fmtDateFull(order.done_date)} />}
            {order.warranty_days > 0 && <Row icon="verified_user" label="Bảo hành" value={`${order.warranty_days} ngày`} />}
            {order.technician_note && (
              <div style={{ background:"#fef9c3", borderRadius:12, padding:"10px 14px", marginTop:10 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#854d0e", marginBottom:4, display:"flex", alignItems:"center", gap:4 }}>
                  <MI name="sticky_note_2" style={{ fontSize:14, color:"#854d0e" }} /> Ghi chú kỹ thuật
                </div>
                <div style={{ fontSize:13, color:"#713f12" }}>{order.technician_note}</div>
              </div>
            )}
          </div>

          {/* Timeline lịch sử */}
          {history.length > 0 && (
            <div style={{ background:"rgba(255,255,255,.95)", borderRadius:20, padding:20, marginBottom:14, boxShadow:"0 4px 24px rgba(0,0,0,.15)" }}>
              <div style={{ fontWeight:800, fontSize:16, color:"#1e1b4b", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
                <MI name="history" style={{ fontSize:20, color:"#4f46e5" }} /> Lịch sử cập nhật
              </div>
              <div style={{ position:"relative" }}>
                {/* vertical line */}
                <div style={{ position:"absolute", left:13, top:0, bottom:0, width:2, background:"#e5e7eb" }} />
                {history.map((h, i) => {
                  const a = ACTION_ICON[h.action_type] || ACTION_ICON.other;
                  return (
                    <div key={h.id} style={{ display:"flex", gap:12, marginBottom: i<history.length-1?16:0, position:"relative" }}>
                      {/* dot */}
                      <div style={{ width:28, height:28, borderRadius:"50%", background:a.color+"22", border:`2px solid ${a.color}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, zIndex:1, background:"#fff" }}>
                        <MI name={a.icon} style={{ fontSize:14, color:a.color }} />
                      </div>
                      <div style={{ flex:1, paddingTop:2 }}>
                        <div style={{ fontWeight:700, fontSize:13, color:"#1e1b4b" }}>{h.action_label || h.action_type}</div>
                        {h.new_value && h.action_type !== "created" && (
                          <div style={{ fontSize:12, color:"#4f46e5", marginTop:1 }}>
                            {h.old_value && <><span style={{color:"#9ca3af"}}>{h.old_value}</span> <MI name="arrow_forward" style={{fontSize:10,color:"#9ca3af"}}/> </>}
                            <span style={{fontWeight:600}}>{h.new_value}</span>
                          </div>
                        )}
                        {h.action_type === "created" && h.new_value && (
                          <div style={{ fontSize:12, color:"#6b7280", marginTop:1 }}>{h.new_value}</div>
                        )}
                        {h.note && <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{h.note}</div>}
                        <div style={{ fontSize:11, color:"#9ca3af", marginTop:3, display:"flex", alignItems:"center", gap:4 }}>
                          <MI name="person" style={{ fontSize:12, color:"#c4b5fd" }} />
                          {h.changed_by_name || "Hệ thống"}
                          <span style={{ margin:"0 4px" }}>·</span>
                          {fmtDate(h.created)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Liên hệ */}
          <div style={{ background:"rgba(255,255,255,.1)", borderRadius:16, padding:16, textAlign:"center", backdropFilter:"blur(8px)" }}>
            <div style={{ color:"rgba(255,255,255,.8)", fontSize:13, marginBottom:6 }}>Cần hỗ trợ?</div>
            <div style={{ color:"#fff", fontWeight:700, fontSize:15, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <MI name="call" style={{ fontSize:18, color:"#86efac" }} />
              Liên hệ cửa hàng
            </div>
          </div>

          {/* Tìm đơn khác */}
          <div style={{ textAlign:"center", marginTop:16 }}>
            <button onClick={() => { setOrder(null); setHistory([]); setCode(""); setError(""); }}
              style={{ background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.3)", color:"#fff", borderRadius:12, padding:"8px 20px", fontSize:13, cursor:"pointer" }}>
              <MI name="search" style={{ fontSize:15, color:"#fff", marginRight:4 }} />
              Tra cứu đơn khác
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Row helper ────────────────────────────────────────────
function Row({ icon, label, value, mono, highlight }) {
  if (!value) return null;
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:10 }}>
      <MI name={icon} style={{ fontSize:18, color:"#818cf8", marginTop:1, flexShrink:0 }} />
      <div style={{ flex:1 }}>
        <div style={{ fontSize:11, color:"#9ca3af", fontWeight:600 }}>{label}</div>
        <div style={{ fontSize:14, color: highlight?"#15803d":"#1e1b4b", fontWeight: highlight?700:500, fontFamily: mono?"monospace":"inherit", marginTop:1 }}>{value}</div>
      </div>
    </div>
  );
}
