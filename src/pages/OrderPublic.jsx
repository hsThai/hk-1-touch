/* v1775225000-public-v3 */
// Trang công khai — khách quét QR xem tiến độ đơn sửa
// KHÔNG cần đăng nhập, gọi qua backend function để proxy PocketBase

import React, { useState, useEffect } from "react";

const BACKEND_URL = "https://be-yeu-tinh-66577274.base44.app/functions/getPublicOrder";

async function fetchPublicOrder(code) {
  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code.toUpperCase().trim() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Không tìm thấy đơn");
  return data; // { order, history, shopInfo }
}

// ── Status config ────────────────────────────────────────
const STATUS_MAP = {
  // Chuẩn
  "Cho KTV":       { bg:"#fef2f2", text:"#dc2626", icon:"schedule_send" },
  "KTV Dang Kiem": { bg:"#e0f2fe", text:"#0369a1", icon:"manage_search" },
  "Đang Kiểm Tra": { bg:"#fef9c3", text:"#854d0e", icon:"manage_search" },
  "Đang Sửa":      { bg:"#fce7f3", text:"#be185d", icon:"build" },
  "Chờ Linh Kiện": { bg:"#ffedd5", text:"#c2410c", icon:"inventory_2" },
  "Hoàn Thành":    { bg:"#dcfce7", text:"#15803d", icon:"check_circle" },
  "Đã Giao":       { bg:"#d1fae5", text:"#065f46", icon:"handshake" },
  "Hủy":           { bg:"#fee2e2", text:"#dc2626", icon:"cancel" },
  // Không dấu fallback
  "Hoan Thanh":    { bg:"#dcfce7", text:"#15803d", icon:"check_circle" },
  "Da Giao":       { bg:"#d1fae5", text:"#065f46", icon:"handshake" },
  "Huy":           { bg:"#fee2e2", text:"#dc2626", icon:"cancel" },
  "Cho Linh Kien": { bg:"#ffedd5", text:"#c2410c", icon:"inventory_2" },
  "Dang Sua":      { bg:"#fce7f3", text:"#be185d", icon:"build" },
  "Cho KTV":       { bg:"#fef2f2", text:"#dc2626", icon:"schedule_send" },
  "KTV Dang Kiem": { bg:"#e0f2fe", text:"#0369a1", icon:"manage_search" },
  "Cho Bao Gia":   { bg:"#fffbeb", text:"#d97706", icon:"request_quote" },
  "Cho Xac Nhan":  { bg:"#fdf2f8", text:"#db2777", icon:"pending_actions" },
  "Cho KTV Sua":   { bg:"#f5f3ff", text:"#7c3aed", icon:"engineering" },
  "Thuong":        { bg:"#f3f4f6", text:"#6b7280", icon:"info" },
};

const STATUS_DISPLAY = {
  "Hoan Thanh": "Hoàn Thành",
  "Da Giao": "Đã Giao",
  "Huy": "Hủy",
  "Cho Linh Kien": "Chờ Linh Kiện",
  "Dang Sua": "Đang Sửa",
  "Cho KTV": "Chờ KTV",
  "KTV Dang Kiem": "KTV Đang Kiểm",
  "Cho Bao Gia": "Chờ Báo Giá",
  "Cho Xac Nhan": "Chờ Xác Nhận",
  "Cho KTV Sua": "Chờ KTV Sửa",
};

function getStatus(raw) {
  const display = STATUS_DISPLAY[raw] || raw;
  const cfg = STATUS_MAP[raw] || STATUS_MAP[display] || { bg:"#f3f4f6", text:"#6b7280", icon:"info" };
  return { display, cfg };
}

const ACTION_ICON = {
  created:        { icon:"add_circle",   color:"#4f46e5" },
  status_changed: { icon:"swap_horiz",   color:"#0369a1" },
  assigned:       { icon:"person_add",   color:"#7c3aed" },
  reassigned:     { icon:"people",       color:"#b45309" },
  cost_updated:   { icon:"payments",     color:"#15803d" },
  note_updated:   { icon:"edit_note",    color:"#6b7280" },
  delivered:      { icon:"handshake",    color:"#065f46" },
  parts_added:    { icon:"inventory_2",  color:"#0891b2" },
  other:          { icon:"info",         color:"#9ca3af" },
};

function MI({ name, style }) {
  return <span className="material-icons" style={{ fontFamily:"Material Icons", userSelect:"none", lineHeight:1, verticalAlign:"middle", ...style }}>{name}</span>;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleString("vi-VN", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}
function fmtDateFull(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString("vi-VN", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

// ── Progress steps ───────────────────────────────────────
const STEPS = [
  { key:"Chờ KTV",       altKey:"Cho KTV",       icon:"schedule_send" },
  { key:"KTV Đang Kiểm", altKey:"KTV Dang Kiem", icon:"manage_search" },
  { key:"Chờ Báo Giá",   altKey:"Cho Bao Gia",   icon:"request_quote" },
  { key:"Chờ KTV Sửa",   altKey:"Cho KTV Sua",   icon:"engineering" },
  { key:"Đang Sửa",      altKey:"Dang Sua",      icon:"build" },
  { key:"Hoàn Thành",    altKey:"Hoan Thanh",    icon:"check_circle" },
  { key:"Đã Giao",       altKey:"Da Giao",       icon:"handshake" },
];

function ProgressBar({ rawStatus }) {
  const normalized = STATUS_DISPLAY[rawStatus] || rawStatus;
  const idx = STEPS.findIndex(s => s.key === normalized || s.altKey === rawStatus);
  const cur = idx < 0 ? (["Chờ Linh Kiện","Cho Linh Kien"].includes(rawStatus) ? 2 : 0) : idx;

  return (
    <div style={{ display:"flex", alignItems:"center", padding:"4px 0" }}>
      {STEPS.map((s, i) => {
        const done = i < cur, active = i === cur;
        return (
          <React.Fragment key={s.key}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
              <div style={{
                width:36, height:36, borderRadius:"50%",
                background: active ? "#4f46e5" : done ? "#818cf8" : "#e5e7eb",
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: active ? "0 0 0 4px #c7d2fe" : "none",
                transition:"all .3s",
              }}>
                <MI name={s.icon} style={{ fontSize:16, color:(active||done)?"#fff":"#9ca3af" }} />
              </div>
              <div style={{ fontSize:9, color:active?"#4f46e5":done?"#818cf8":"#9ca3af", marginTop:4, fontWeight:active?800:500, textAlign:"center", maxWidth:52, lineHeight:"1.2" }}>
                {s.key}
              </div>
            </div>
            {i < STEPS.length-1 && (
              <div style={{ flex:1, height:2, background:i < cur?"#818cf8":"#e5e7eb", marginBottom:18, minWidth:6 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Row({ icon, label, value, mono, highlight }) {
  if (!value) return null;
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:10 }}>
      <MI name={icon} style={{ fontSize:18, color:"#818cf8", marginTop:1, flexShrink:0 }} />
      <div style={{ flex:1 }}>
        <div style={{ fontSize:11, color:"#9ca3af", fontWeight:600 }}>{label}</div>
        <div style={{ fontSize:14, color:highlight?"#15803d":"#1e1b4b", fontWeight:highlight?700:500, fontFamily:mono?"monospace":"inherit", marginTop:1 }}>{value}</div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function OrderPublic() {
  const [order, setOrder]       = useState(null);
  const [history, setHistory]   = useState([]);
  const [shopInfo, setShopInfo] = useState({});
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [code, setCode]         = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("code") || params.get("order") || "";
    if (c) { setCode(c); load(c); }
  }, []);

  async function load(c) {
    setLoading(true); setError(""); setSearched(true);
    try {
      const result = await fetchPublicOrder(c);
      setOrder(result.order);
      setHistory(result.history || []);
      setShopInfo(result.shopInfo || {});
    } catch(e) {
      setError(e.message || "Không tìm thấy đơn sửa");
    }
    setLoading(false);
  }

  const { display: statusDisplay, cfg: st } = order ? getStatus(order.status) : { display:"", cfg:{} };
  const shopName = shopInfo.shop_name || "HK One Touch";
  const shopPhone = shopInfo.shop_phone || "";
  const shopAddress = shopInfo.shop_address || "";
  const isCancelled = ["Hủy","Huy"].includes(order?.status);
  const isWaiting = ["Chờ Linh Kiện","Cho Linh Kien"].includes(order?.status);

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#1e1b4b 0%,#312e81 55%,#4338ca 100%)", display:"flex", flexDirection:"column", alignItems:"center", padding:"20px 16px 48px" }}>
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />

      {/* Header */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:24, width:"100%", maxWidth:460 }}>
        <div style={{ width:64, height:64, borderRadius:20, background:"rgba(255,255,255,.15)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:10, boxShadow:"0 4px 24px rgba(0,0,0,.3)" }}>
          <MI name="phone_android" style={{ fontSize:36, color:"#fff" }} />
        </div>
        <div style={{ color:"#fff", fontWeight:800, fontSize:22 }}>{shopName}</div>
        <div style={{ color:"rgba(255,255,255,.55)", fontSize:12, marginTop:2 }}>Tra cứu tiến độ sửa chữa</div>
      </div>

      {/* Search box */}
      {!order && (
        <div style={{ width:"100%", maxWidth:420, background:"rgba(255,255,255,.1)", borderRadius:20, padding:20, backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,.15)", marginBottom:16 }}>
          <div style={{ color:"#fff", fontWeight:700, fontSize:15, marginBottom:12 }}>Nhập mã đơn sửa chữa</div>
          <div style={{ display:"flex", gap:8 }}>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => e.key === "Enter" && code && load(code)}
              placeholder="VD: SC242934"
              autoCapitalize="characters"
              style={{ flex:1, height:48, borderRadius:12, border:"none", padding:"0 14px", fontSize:15, outline:"none", background:"rgba(255,255,255,.92)" }}
            />
            <button
              onClick={() => code && load(code)}
              disabled={loading}
              style={{ height:48, width:48, borderRadius:12, background:"#4f46e5", border:"none", color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", opacity: loading ? .6 : 1 }}>
              {loading
                ? <div style={{ width:20, height:20, border:"2px solid rgba(255,255,255,.3)", borderTop:"2px solid #fff", borderRadius:"50%", animation:"spin .8s linear infinite" }} />
                : <MI name="search" style={{ fontSize:22, color:"#fff" }} />}
            </button>
          </div>
          {error && searched && (
            <div style={{ color:"#fca5a5", fontSize:13, marginTop:10, display:"flex", alignItems:"center", gap:6 }}>
              <MI name="error_outline" style={{ fontSize:16, color:"#fca5a5" }} />{error}
            </div>
          )}
          <div style={{ color:"rgba(255,255,255,.45)", fontSize:11, marginTop:12, textAlign:"center" }}>Mã đơn có trên phiếu tiếp nhận hoặc được nhân viên cung cấp</div>
        </div>
      )}

      {/* Loading full page */}
      {loading && !order && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginTop:32, gap:12 }}>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ width:48, height:48, border:"4px solid rgba(255,255,255,.2)", borderTop:"4px solid #818cf8", borderRadius:"50%", animation:"spin .8s linear infinite" }} />
          <div style={{ color:"rgba(255,255,255,.6)", fontSize:14 }}>Đang tải thông tin đơn sửa...</div>
        </div>
      )}

      {/* Order card */}
      {order && !loading && (
        <div style={{ width:"100%", maxWidth:460 }}>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

          {/* Status badge */}
          <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
            <div style={{ background:st.bg, color:st.text, borderRadius:50, padding:"10px 24px", display:"flex", alignItems:"center", gap:8, fontWeight:800, fontSize:16, boxShadow:"0 4px 16px rgba(0,0,0,.2)" }}>
              <MI name={st.icon} style={{ fontSize:22, color:st.text }} />
              {statusDisplay}
            </div>
          </div>

          {/* Chờ linh kiện */}
          {isWaiting && (
            <div style={{ background:"#fff7ed", borderRadius:14, padding:"12px 16px", marginBottom:14, display:"flex", alignItems:"center", gap:10, border:"1.5px solid #fed7aa" }}>
              <MI name="inventory_2" style={{ fontSize:24, color:"#ea580c", flexShrink:0 }} />
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:"#c2410c" }}>Đang chờ linh kiện về</div>
                <div style={{ fontSize:12, color:"#78350f", marginTop:2 }}>Chúng tôi sẽ thông báo khi máy bạn được tiếp tục sửa</div>
              </div>
            </div>
          )}

          {/* Progress */}
          {!isCancelled && !["Hủy","Huy"].includes(order.status) && (
            <div style={{ background:"rgba(255,255,255,.97)", borderRadius:20, padding:"16px 16px 20px", marginBottom:14, boxShadow:"0 4px 24px rgba(0,0,0,.15)" }}>
              <ProgressBar rawStatus={order.status} />
            </div>
          )}

          {/* Thông tin đơn */}
          <div style={{ background:"rgba(255,255,255,.97)", borderRadius:20, padding:20, marginBottom:14, boxShadow:"0 4px 24px rgba(0,0,0,.15)" }}>
            <div style={{ fontWeight:800, fontSize:15, color:"#1e1b4b", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
              <MI name="receipt_long" style={{ fontSize:20, color:"#4f46e5" }} /> Thông tin đơn sửa
            </div>
            <Row icon="tag"            label="Mã đơn"         value={order.order_code} mono />
            <Row icon="person"         label="Khách hàng"     value={order.customer_name} />
            <Row icon="phone_android"  label="Thiết bị"       value={[order.device_name, order.device_model].filter(Boolean).join(" — ")} />
            {order.imei && <Row icon="fingerprint"   label="IMEI/Serial"   value={order.imei} mono />}
            <Row icon="build_circle"   label="Vấn đề"         value={order.issue_description} />
            <Row icon="calendar_today" label="Ngày nhận"      value={fmtDateFull(order.received_date)} />
            {order.estimated_done_date && <Row icon="event_available" label="Dự kiến xong" value={fmtDateFull(order.estimated_done_date)} highlight />}
            {order.done_date && <Row icon="check_circle" label="Hoàn thành lúc" value={fmtDateFull(order.done_date)} />}
            {order.warranty_days > 0 && <Row icon="verified_user" label="Bảo hành" value={`${order.warranty_days} ngày`} />}
            {order.technician_note && (
              <div style={{ background:"#fef9c3", borderRadius:12, padding:"10px 14px", marginTop:8 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#854d0e", marginBottom:4, display:"flex", alignItems:"center", gap:4 }}>
                  <MI name="sticky_note_2" style={{ fontSize:14, color:"#854d0e" }} /> Ghi chú kỹ thuật
                </div>
                <div style={{ fontSize:13, color:"#713f12" }}>{order.technician_note}</div>
              </div>
            )}
          </div>

          {/* Timeline */}
          {history.length > 0 && (
            <div style={{ background:"rgba(255,255,255,.97)", borderRadius:20, padding:20, marginBottom:14, boxShadow:"0 4px 24px rgba(0,0,0,.15)" }}>
              <div style={{ fontWeight:800, fontSize:15, color:"#1e1b4b", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
                <MI name="history" style={{ fontSize:20, color:"#4f46e5" }} /> Lịch sử cập nhật
              </div>
              <div style={{ position:"relative" }}>
                <div style={{ position:"absolute", left:14, top:4, bottom:4, width:2, background:"#e5e7eb" }} />
                {history.map((h, i) => {
                  const a = ACTION_ICON[h.action_type] || ACTION_ICON.other;
                  return (
                    <div key={h.id||i} style={{ display:"flex", gap:12, marginBottom:i < history.length-1 ? 16 : 0, position:"relative" }}>
                      <div style={{ width:30, height:30, borderRadius:"50%", background:"#fff", border:`2px solid ${a.color}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, zIndex:1 }}>
                        <MI name={a.icon} style={{ fontSize:14, color:a.color }} />
                      </div>
                      <div style={{ flex:1, paddingTop:3 }}>
                        <div style={{ fontWeight:700, fontSize:13, color:"#1e1b4b" }}>{h.action_label || h.action_type}</div>
                        {h.action_type !== "created" && h.new_value && (
                          <div style={{ fontSize:12, color:"#4f46e5", marginTop:1 }}>
                            {h.old_value && <><span style={{ color:"#9ca3af" }}>{h.old_value}</span> <MI name="arrow_forward" style={{ fontSize:10, color:"#9ca3af" }} /> </>}
                            <span style={{ fontWeight:600 }}>{h.new_value}</span>
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
          <div style={{ background:"rgba(255,255,255,.1)", borderRadius:18, padding:"16px 20px", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,.15)", marginBottom:16 }}>
            <div style={{ color:"rgba(255,255,255,.7)", fontSize:12, marginBottom:10, textAlign:"center", fontWeight:600 }}>LIÊN HỆ HỖ TRỢ</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {shopName !== "HK One Touch" && (
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <MI name="store" style={{ fontSize:18, color:"#86efac" }} />
                  <div style={{ color:"#fff", fontWeight:700, fontSize:14 }}>{shopName}</div>
                </div>
              )}
              {shopPhone && (
                <a href={`tel:${shopPhone}`} style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none" }}>
                  <MI name="call" style={{ fontSize:18, color:"#86efac" }} />
                  <div style={{ color:"#fff", fontWeight:700, fontSize:15 }}>{shopPhone}</div>
                </a>
              )}
              {shopAddress && (
                <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                  <MI name="location_on" style={{ fontSize:18, color:"#86efac", marginTop:1 }} />
                  <div style={{ color:"rgba(255,255,255,.75)", fontSize:13 }}>{shopAddress}</div>
                </div>
              )}
            </div>
          </div>

          {/* Tra cứu đơn khác */}
          <div style={{ textAlign:"center" }}>
            <button
              onClick={() => { setOrder(null); setHistory([]); setShopInfo({}); setCode(""); setError(""); setSearched(false); }}
              style={{ background:"rgba(255,255,255,.12)", border:"1px solid rgba(255,255,255,.25)", color:"#fff", borderRadius:12, padding:"10px 22px", fontSize:13, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6 }}>
              <MI name="search" style={{ fontSize:16, color:"#fff" }} />
              Tra cứu đơn khác
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
