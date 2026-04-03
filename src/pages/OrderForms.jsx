/* v3-rebuild-1774864528 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { RepairChat, Notification, Staff, RepairOrder, Customer, SparePart, SparePartUsage } from "./pb.jsx";
import { uploadFile } from "./pb.jsx";

import { timeAgo, genOrderId, getKpiTimerInfo } from "./MediaViewer";
import { searchKvCustomers, createKvDeliveryOrder } from "./kiotviet.jsx";
import { QRScanModal, IMEIScanModal } from "./QRComponents.jsx";

function NewOrderModal({ onClose, onCreate, users, orders }) {
  const [form, setForm] = useState({ customer_id:"", customer_name:"", customer_phone:"", device_model:"", imei_serial:"", passcode:"", qr_code:"", issues:[], notes:"", assigned_to:"" });
  const [custSearch, setCustSearch] = useState("");
  const [dbCusts, setDbCusts] = useState([]);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [showQRScan, setShowQRScan] = useState(false);
  const [showIMEIScan, setShowIMEIScan] = useState(false);
  const [qrMsg, setQrMsg] = useState(null);
  const photoRef = useRef(); const videoRef = useRef(); const fileRef = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]:v }));

  const [kvSearching, setKvSearching] = React.useState(false);

  // Load khách hàng: ưu tiên KiotViet, fallback PocketBase local
  useEffect(() => {
    if (custSearch.length < 2) { setDbCusts([]); return; }
    const timer = setTimeout(async () => {
      setKvSearching(true);
      try {
        // 1. Thử KiotViet trước
        const kvResults = await searchKvCustomers(custSearch);
        if (kvResults.length > 0) {
          setDbCusts(kvResults);
          setKvSearching(false);
          return;
        }
      } catch {}
      // 2. Fallback: tìm trong PocketBase local
      try {
        const q = custSearch.toLowerCase();
        const items = await Customer.list({ limit: 200 });
        const filtered = items.filter(c =>
          (c.full_name||"").toLowerCase().includes(q) || (c.phone||"").includes(custSearch)
        );
        if (filtered.length > 0) { setDbCusts(filtered); setKvSearching(false); return; }
      } catch {}
      // 3. Fallback: lấy từ orders cũ
      if (orders) {
        const extra = [];
        const q = custSearch.toLowerCase();
        orders.forEach(o => {
          if (o.customer_name && o.customer_phone && !extra.find(c=>c.phone===o.customer_phone)) {
            extra.push({ id: o.customer_id||o.customer_phone, full_name:o.customer_name, phone:o.customer_phone });
          }
        });
        setDbCusts(extra.filter(c =>
          (c.full_name||"").toLowerCase().includes(q) || (c.phone||"").includes(custSearch)
        ));
      }
      setKvSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [custSearch]);

  function handleFiles(e) {
    const items = Array.from(e.target.files).map(f => ({ id:Math.random().toString(36), file:f, type:f.type.startsWith("video/")?"video":"image", url:URL.createObjectURL(f), name:f.name }));
    setMediaFiles(p => [...p, ...items]); e.target.value = "";
  }

  function handleQRResult(result) {
    setShowQRScan(false);
    if (result.type !== "raw") return;
    const code = result.code;
    const prevOrder = orders.find(o => o.qr_code === code);
    if (prevOrder) {
      const cust = prevOrder.customer_name ? { full_name: prevOrder.customer_name, phone: prevOrder.customer_phone } : null;
      set("qr_code", code);
      set("device_model", prevOrder.device_model);
      set("imei_serial", prevOrder.imei_serial || "");
      set("passcode", prevOrder.passcode || "");
      set("issues", [...prevOrder.issues]);
      set("notes", prevOrder.notes || "");
      if (cust) { set("customer_id", prevOrder.customer_id); setCustSearch(`${cust.full_name} — ${cust.phone}`); }
      setQrMsg({ type:"found", code, prevOrder });
    } else {
      set("qr_code", code);
      setQrMsg({ type:"new", code });
    }
  }

  function submit() {
    if (!form.device_model.trim()) { alert("Vui lòng nhập tên thiết bị!"); return; }
    // Nếu chưa chọn khách từ DB, tạo mới từ custSearch
    let cName = form.customer_name;
    let cPhone = form.customer_phone;
    let cId = form.customer_id;
    if (!cId && custSearch.trim()) {
      // Tách tên và SĐT từ custSearch nếu có định dạng "Tên — SĐT"
      const parts = custSearch.split(/[—\-]/);
      cName = parts[0].trim();
      cPhone = (parts[1]||"").trim();
      cId = "new_" + Date.now();
    }
    if (!cName && !cId) { alert("Vui lòng nhập tên hoặc SĐT khách hàng!"); return; }
    const imgUrls = mediaFiles.map(m => m.type==="video" ? `video:${m.name}` : m.url);
    const newOrder = { ...form, id:genOrderId(), created:new Date().toISOString(), assigned_at:form.assigned_to?new Date().toISOString():null, accept_stage:0, status:"Mới Nhận", images:imgUrls, customer_id:cId, customer_name:cName, customer_phone:cPhone };
    onCreate(newOrder);

    // Gửi đơn sang KiosThong tạo hóa đơn (không block UI)
    (async () => {
      try {
        const assignedUser = users.find(u => u.id === newOrder.assigned_to);
        await createKvDeliveryOrder({
          orderCode:     newOrder.id,
          deviceModel:   newOrder.device_model,
          technicianName: assignedUser?.name || assignedUser?.full_name || "Chưa giao",
          parts: [{
            sku:          "REPAIR_ORDER",
            kvProductId:  null,
            name:         `[${newOrder.id}] ${newOrder.device_model} — ${(newOrder.issues||[]).join(", ") || newOrder.notes || "Sửa chữa"}`,
            qty:          1,
            price:        newOrder.estimated_cost || 0,
          }],
        });
        console.log("[KiosThong] Đã tạo đơn:", newOrder.id);
      } catch(e) {
        console.warn("[KiosThong] Gửi đơn thất bại (không ảnh hưởng hệ thống):", e.message);
      }
    })();

    onClose();
  }

  const inp = { width:"100%", height:48, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:15, outline:"none", boxSizing:"border-box" };
  const lbl = { fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:6 };
  const sec = { background:"#f9fafb", borderRadius:16, padding:16, marginBottom:14 };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:22, width:"100%", maxWidth:540, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,.25)" }}>
        <div style={{ position:"sticky", top:0, background:"#3730a3", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", borderRadius:"22px 22px 0 0" }}>
          <div style={{ color:"#fff", fontWeight:800, fontSize:18 }}>➕ Tạo Đơn Mới</div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:34, height:34, borderRadius:"50%", fontSize:16, cursor:"pointer" }}>✕</button>
        </div>

        <div style={{ padding:"20px 20px 8px" }}>
          <div style={{ ...sec, background:"#eef2ff", border:"1.5px solid #a5b4fc" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#3730a3", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>📲 Mã QR Máy</span>
              <button onClick={() => setShowQRScan(true)}
                style={{ height:36, padding:"0 14px", borderRadius:10, background:"#4f46e5", color:"#fff", border:"none", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                📷 Quét QR
              </button>
            </div>
            <input value={form.qr_code} onChange={e => { set("qr_code", e.target.value); setQrMsg(null); }}
              placeholder="Quét hoặc nhập mã QR trên máy..."
              style={{ ...inp, fontFamily:"monospace", background:form.qr_code?"#f0fdf4":"#fff", borderColor:form.qr_code?"#6ee7b7":"#e5e7eb" }} />
            {qrMsg?.type === "found" && (
              <div style={{ marginTop:10, background:"#fffbeb", borderRadius:12, padding:"10px 14px", border:"1.5px solid #fcd34d" }}>
                <div style={{ fontWeight:800, color:"#d97706", marginBottom:4 }}>⚡ Đã tìm thấy dữ liệu cũ — điền tự động!</div>
                <div style={{ fontSize:13, color:"#374151" }}>Đơn gần nhất: <strong>{qrMsg.prevOrder.id}</strong> · {qrMsg.prevOrder.status}</div>
              </div>
            )}
            {qrMsg?.type === "new" && (
              <div style={{ marginTop:10, background:"#f0fdf4", borderRadius:12, padding:"10px 14px", border:"1.5px solid #6ee7b7" }}>
                <div style={{ fontWeight:800, color:"#059669", marginBottom:2 }}>✅ Mã QR mới — sẽ gắn vào đơn này</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>Mã: <strong style={{fontFamily:"monospace"}}>{qrMsg.code}</strong></div>
              </div>
            )}
          </div>

          <div style={{ ...sec, background:"#f0f9ff" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#0369a1", marginBottom:10 }}>👤 Khách Hàng</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <label style={{...lbl, marginBottom:0}}>Tìm theo SĐT hoặc tên *</label>
              {kvSearching && <span style={{ fontSize:11, color:"#0369a1", fontWeight:700 }}>🔄 Đang tìm KiotViet...</span>}
            </div>
            <input value={custSearch} onChange={e => { setCustSearch(e.target.value); if(!e.target.value) { set("customer_id",""); set("customer_name",""); set("customer_phone",""); } }}
              placeholder="🔍 0901234567 hoặc Nguyễn Văn A..." style={inp} />
            {custSearch.length > 0 && !form.customer_id && dbCusts.length === 0 && !kvSearching && custSearch.length >= 2 && (
              <div style={{ marginTop:6, background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#92400e" }}>
                💡 Không tìm thấy trong KiotViet. Nhập tên/SĐT rồi bấm Tạo Đơn để thêm khách mới.
              </div>
            )}
            {dbCusts.length > 0 && (
              <div style={{ marginTop:6, border:"1px solid #bae6fd", borderRadius:10, overflow:"hidden" }}>
                {dbCusts.map(c => (
                  <div key={c.id} onClick={() => { set("customer_id", c.id); set("customer_name", c.full_name||""); set("customer_phone", c.phone||""); setCustSearch(`${c.full_name} — ${c.phone}`); }}
                    style={{ padding:"12px 14px", cursor:"pointer", background:form.customer_id===c.id?"#e0f2fe":"#fff", borderBottom:"1px solid #f3f4f6", fontSize:14 }}>
                    <div style={{ fontWeight:700 }}>{c.full_name}</div>
                    <div style={{ color:"#6b7280", fontSize:12 }}>{c.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={sec}>
            <div style={{ fontWeight:800, fontSize:14, color:"#3730a3", marginBottom:10 }}>📱 Thiết Bị</div>
            {/* Hàng 1: Model + PIN */}
            <div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"flex-end" }}>
              <div style={{ flex:1 }}>
                <label style={lbl}>Tên / Model máy *</label>
                <input value={form.device_model} onChange={e => set("device_model", e.target.value)}
                  placeholder="iPhone 15 Pro Max, Samsung S24..." style={inp} />
              </div>
              <div style={{ width:90, flexShrink:0 }}>
                <label style={lbl}>🔑 Mã PIN</label>
                <input value={form.passcode} onChange={e => set("passcode", e.target.value)}
                  placeholder="1234" maxLength={8}
                  style={{ ...inp, textAlign:"center", letterSpacing:2, fontWeight:700 }} />
              </div>
            </div>
            {/* Hàng 2: IMEI + nút quét barcode */}
            <div>
              <label style={lbl}>IMEI / Serial</label>
              <div style={{ display:"flex", gap:8 }}>
                <input value={form.imei_serial} onChange={e => set("imei_serial", e.target.value)}
                  placeholder="358..." inputMode="numeric"
                  style={{ ...inp, flex:1 }} />
                <button onClick={() => setShowIMEIScan(true)}
                  title="Quét barcode IMEI"
                  style={{ width:46, height:46, flexShrink:0, background:"#4f46e5", border:"none", borderRadius:12, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* barcode bars */}
                    <rect x="2"  y="4" width="1.5" height="12" rx="0.5" fill="white"/>
                    <rect x="5"  y="4" width="1"   height="12" rx="0.5" fill="white"/>
                    <rect x="7.5" y="4" width="2"  height="12" rx="0.5" fill="white"/>
                    <rect x="11" y="4" width="1"   height="12" rx="0.5" fill="white"/>
                    <rect x="13.5" y="4" width="1.5" height="12" rx="0.5" fill="white"/>
                    <rect x="16.5" y="4" width="1" height="12" rx="0.5" fill="white"/>
                    <rect x="18.5" y="4" width="2" height="12" rx="0.5" fill="white"/>
                    {/* magnifier */}
                    <circle cx="17" cy="17" r="4" stroke="white" strokeWidth="1.8" fill="none"/>
                    <line x1="20" y1="20" x2="22.5" y2="22.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div style={sec}>
            <div style={{ fontWeight:800, fontSize:14, color:"#3730a3", marginBottom:10 }}>🛠️ Tình Trạng Lỗi</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
              {ISSUE_OPTIONS.map(issue => (
                <button key={issue} onClick={() => set("issues", form.issues.includes(issue)?form.issues.filter(i=>i!==issue):[...form.issues,issue])}
                  style={{ padding:"14px 10px", borderRadius:12, border:`2px solid ${form.issues.includes(issue)?"#4f46e5":"#e5e7eb"}`, background:form.issues.includes(issue)?"#eef2ff":"#fff", color:form.issues.includes(issue)?"#4f46e5":"#374151", fontSize:14, fontWeight:form.issues.includes(issue)?800:500, cursor:"pointer", textAlign:"left", minHeight:48 }}>
                  {form.issues.includes(issue)?"✓ ":""}{issue}
                </button>
              ))}
            </div>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Ghi chú thêm..." rows={2}
              style={{ ...inp, height:"auto", padding:"12px 14px", resize:"vertical" }} />
          </div>

          <div style={{ ...sec, background:"#f0fdf4", border:"1.5px solid #6ee7b7" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#065f46", marginBottom:10 }}>📸 Hình Ảnh & Video Tình Trạng</div>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" multiple style={{ display:"none" }} onChange={handleFiles} />
            <input ref={videoRef} type="file" accept="video/*" capture="environment" style={{ display:"none" }} onChange={handleFiles} />
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display:"none" }} onChange={handleFiles} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
              <button onClick={() => photoRef.current.click()} style={{ padding:"14px 8px", background:"#f0fdf4", border:"2px dashed #6ee7b7", borderRadius:12, cursor:"pointer", fontSize:20, textAlign:"center" }}>📷<div style={{fontSize:11,color:"#065f46",marginTop:4}}>Chụp ảnh</div></button>
              <button onClick={() => videoRef.current.click()} style={{ padding:"14px 8px", background:"#fdf4ff", border:"2px dashed #d8b4fe", borderRadius:12, cursor:"pointer", fontSize:20, textAlign:"center" }}>🎬<div style={{fontSize:11,color:"#7e22ce",marginTop:4}}>Quay video</div></button>
              <button onClick={() => fileRef.current.click()} style={{ padding:"14px 8px", background:"#f0f9ff", border:"2px dashed #bae6fd", borderRadius:12, cursor:"pointer", fontSize:20, textAlign:"center" }}>📁<div style={{fontSize:11,color:"#0369a1",marginTop:4}}>Chọn file</div></button>
            </div>
            {mediaFiles.length > 0 && (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {mediaFiles.map(m => (
                  <div key={m.id} style={{ position:"relative", width:72, height:72 }}>
                    {m.type==="video"
                      ? <div style={{ width:72, height:72, background:"#1e1b4b", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🎬</div>
                      : <img src={m.url} style={{ width:72, height:72, objectFit:"cover", borderRadius:10 }} alt="" />}
                    <button onClick={() => setMediaFiles(p=>p.filter(x=>x.id!==m.id))}
                      style={{ position:"absolute", top:-6, right:-6, width:20, height:20, background:"#ef4444", border:"none", borderRadius:"50%", color:"#fff", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ ...sec, background:"#fffbeb", border:"1.5px solid #fcd34d" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#d97706", marginBottom:10 }}>👨‍🔧 Giao Cho KTV</div>
            <select value={form.assigned_to} onChange={e => set("assigned_to", e.target.value)}
              style={{ ...inp, color:form.assigned_to?"#111":"#9ca3af" }}>
              <option value="">-- Chưa giao (giao sau) --</option>
              {users.filter(u => (u.role==="technician" || u.role==="kỹ thuật") && u.is_active !== false).map(u => (
                <option key={u.id} value={u.id}>{u.name || u.full_name} — KPI: {u.kpi ?? 0}</option>
              ))}
            </select>
          </div>

          {showQRScan && (
            <QRScanModal
              mode="capture"
              orders={orders || []}
              onClose={() => setShowQRScan(false)}
              onFound={handleQRResult}
            />
          )}
          {showIMEIScan && (
            <IMEIScanModal
              onClose={() => setShowIMEIScan(false)}
              onFound={imei => { set("imei_serial", imei); setShowIMEIScan(false); }}
            />
          )}
        </div>

        <div style={{ padding:"0 20px 20px", display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:52, background:"#f3f4f6", border:"none", borderRadius:14, fontWeight:700, fontSize:16, cursor:"pointer" }}>Hủy</button>
          <button onClick={submit} style={{ flex:2, height:52, background:"#4f46e5", border:"none", borderRadius:14, color:"#fff", fontWeight:800, fontSize:16, cursor:"pointer" }}>
            ✅ Tạo Đơn
          </button>
        </div>
      </div>
    </div>
  );
}

const ISSUE_OPTIONS = [
  "🔋 Hao pin / Phồng pin","📱 Màn hình vỡ / nứt","🔊 Loa / micro lỗi",
  "🔌 Sạc không vào","📷 Camera mờ / hỏng","💧 Vào nước","🔘 Nút bấm hỏng",
  "📶 Mất sóng / wifi","🌡️ Máy nóng","⚡ Không lên nguồn",
];

function KPIPage({ users, orders }) {
  const techs = users.filter(u => u.role==="technician");
  return (
    <div style={{ padding:16, maxWidth:800, margin:"0 auto" }}>
      <div style={{ fontWeight:900, fontSize:20, color:"#1e1b4b", marginBottom:16 }}>🏆 Bảng KPI Kỹ Thuật Viên</div>
      {techs.length === 0 && <div style={{ textAlign:"center", color:"#9ca3af", padding:40 }}>Chưa có KTV nào</div>}
      {techs.sort((a,b) => b.kpi - a.kpi).map((u, i) => {
        const myOrders = orders.filter(o => o.assigned_to === u.id);
        const done = myOrders.filter(o => ["Hoàn Thành","Đã Giao"].includes(o.status)).length;
        const pending = myOrders.filter(o => !["Hoàn Thành","Đã Giao"].includes(o.status)).length;
        const kpiColor = u.kpi >= 90 ? "#059669" : u.kpi >= 70 ? "#d97706" : "#dc2626";
        return (
          <div key={u.id} style={{ background:"#fff", borderRadius:16, padding:18, marginBottom:12, boxShadow:"0 2px 12px rgba(0,0,0,.08)", display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ fontSize:32, minWidth:40, textAlign:"center" }}>
              {i===0?"🥇":i===1?"🥈":i===2?"🥉":"👨‍🔧"}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:16, color:"#1e1b4b" }}>{u.name}</div>
              <div style={{ fontSize:13, color:"#6b7280", marginTop:2 }}>
                ✅ Hoàn thành: {done} · ⏳ Đang làm: {pending}
              </div>
              <div style={{ marginTop:8, height:8, background:"#f3f4f6", borderRadius:99, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.min(100,u.kpi)}%`, background:kpiColor, borderRadius:99, transition:"width .3s" }} />
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:28, fontWeight:900, color:kpiColor }}>{u.kpi}</div>
              <div style={{ fontSize:11, color:"#9ca3af" }}>điểm KPI</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = async () => {
    if (!username.trim() || !password.trim()) { setErr("Vui lòng nhập đầy đủ thông tin!"); return; }
    setLoading(true);
    setErr("");
    try {
      const staffList = await Staff.list();
      const hashedInput = btoa(unescape(encodeURIComponent(password.trim())));
      const found = staffList.find(s =>
        s.username === username.trim() &&
        s.password_hash === hashedInput &&
        s.is_active !== false
      );
      if (found) {
        onLogin({
          id: found.id,
          name: found.full_name,
          username: found.username,
          role: found.role,
          kpi: found.kpi_score || 0,
          phone: found.phone || "",
          note: found.note || "",
          must_change_password: found.must_change_password,
          avatar_url: found.avatar_url || "",
        });
      } else {
        const matchUser = staffList.find(s => s.username === username.trim());
        if (!matchUser) setErr("Không tìm thấy username!");
        else if (matchUser.is_active === false) setErr("Tài khoản đã bị vô hiệu hóa!");
        else setErr("Sai mật khẩu!");
        setLoading(false);
      }
    } catch(e) {
      setErr("Lỗi kết nối, thử lại!");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1e1b4b,#4f46e5,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:24, padding:40, width:"100%", maxWidth:400, boxShadow:"0 24px 64px rgba(0,0,0,.3)" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:56 }}>🔧</div>
          <div style={{ fontWeight:900, fontSize:24, color:"#1e1b4b", marginTop:8 }}>Quản Lý Sửa Chữa</div>
          <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Hệ thống nội bộ</div>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>👤 Tên đăng nhập</label>
          <input id="login-user"
            value={username} onChange={e => { setUsername(e.target.value); setErr(""); }}
            onKeyDown={e => e.key==="Enter" && doLogin()}
            placeholder="Nhập username..."
            style={{ width:"100%", height:50, borderRadius:12, border:`2px solid ${err?"#ef4444":"#e5e7eb"}`, padding:"0 16px", fontSize:15, outline:"none", boxSizing:"border-box" }}
            autoFocus
          />
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>🔑 Mật khẩu</label>
          <div style={{ position:"relative" }}>
            <input id="login-pw"
              value={password} onChange={e => { setPassword(e.target.value); setErr(""); }}
              onKeyDown={e => e.key==="Enter" && doLogin()}
              placeholder="Nhập mật khẩu..."
              type={showPw ? "text" : "password"}
              style={{ width:"100%", height:50, borderRadius:12, border:`2px solid ${err?"#ef4444":"#e5e7eb"}`, padding:"0 50px 0 16px", fontSize:15, outline:"none", boxSizing:"border-box" }}
            />
            <button onClick={() => setShowPw(v=>!v)} type="button"
              style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#9ca3af" }}>
              {showPw ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        {err && (
          <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#dc2626", fontWeight:600 }}>
            ⚠️ {err}
          </div>
        )}

        <button id="login-btn" onClick={doLogin} disabled={loading}
          style={{ width:"100%", height:54, background:loading?"#a5b4fc":"#4f46e5", color:"#fff", border:"none", borderRadius:14, fontSize:18, fontWeight:800, cursor:loading?"not-allowed":"pointer" }}>
          {loading ? "⏳ Đang kiểm tra..." : "🚀 Đăng Nhập"}
        </button>
      </div>
    </div>
  );
}

export { NewOrderModal, KPIPage, LoginScreen };
export const _BUILD_TS = "1774864528-FORCE-V3";

export default function OrderFormsPage() { return null; }
