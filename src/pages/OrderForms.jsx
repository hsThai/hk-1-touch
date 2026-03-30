/* rebuild-1774861524-35360 */
/* v1774860462-7391 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { RepairChat, Notification, Staff, RepairOrder, Customer, SparePart, SparePartUsage } from "@/api/entities";
import { uploadFile } from "@/api/storage";

import { timeAgo, genOrderId, getKpiTimerInfo } from "./MediaViewer";

function NewOrderModal({ onClose, onCreate, users, orders }) {
  const [form, setForm] = useState({ customer_id:"", device_model:"", imei_serial:"", passcode:"", qr_code:"", issues:[], notes:"", assigned_to:"" });
  const [custSearch, setCustSearch] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [showQRScan, setShowQRScan] = useState(false);
  const [qrMsg, setQrMsg] = useState(null); // { type:"new"|"found", code, prevOrder }
  const photoRef = useRef(); const videoRef = useRef(); const fileRef = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]:v }));
  const filteredCusts = custSearch.length > 1
    ? (() => {
        const q = custSearch.toLowerCase();
        const extra = [];
        if (typeof orders !== "undefined") orders.forEach(o => {
          if (o.customer_name && o.customer_phone && !extra.find(c=>c.phone===o.customer_phone)) {
            extra.push({ id:o.customer_phone, full_name:o.customer_name, phone:o.customer_phone });
          }
        });
        return extra.filter(c =>
          (c.full_name||"").toLowerCase().includes(q) || (c.phone||"").includes(custSearch)
        );
      })()
    : [];

  function handleFiles(e) {
    const items = Array.from(e.target.files).map(f => ({ id:Math.random().toString(36), file:f, type:f.type.startsWith("video/")?"video":"image", url:URL.createObjectURL(f), name:f.name }));
    setMediaFiles(p => [...p, ...items]); e.target.value = "";
  }

  function handleQRResult(result) {
    setShowQRScan(false);
    if (result.type !== "raw") return;
    const code = result.code;
    // Tìm đơn cũ theo qr_code
    const prevOrder = orders.find(o => o.qr_code === code);
    if (prevOrder) {
      // Đã có data → load thông tin vào form, báo cho user
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
      // Chưa có → ghi nhận mã QR mới vào đơn
      set("qr_code", code);
      setQrMsg({ type:"new", code });
    }
  }

  function submit() {
    if (!form.customer_id || !form.device_model) { alert("Vui lòng chọn khách hàng và nhập thiết bị!"); return; }
    const imgUrls = mediaFiles.map(m => m.type==="video" ? `video:${m.name}` : m.url);
    const custObj = filteredCusts.find(c => c.id === form.customer_id) || null;
    onCreate({ ...form, id:genOrderId(), created:new Date().toISOString(), assigned_at:form.assigned_to?new Date().toISOString():null, accept_stage:0, status:"Mới Nhận", images:imgUrls, customer_name: custObj?.full_name||"", customer_phone: custObj?.phone||"" });
    onClose();
  }

  const inp = { width:"100%", height:48, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:15, outline:"none", boxSizing:"border-box" };
  const lbl = { fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:6 };
  const sec = { background:"#f9fafb", borderRadius:16, padding:16, marginBottom:14 };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:22, width:"100%", maxWidth:540, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,.25)" }}>
        {/* Header */}
        <div style={{ position:"sticky", top:0, background:"#3730a3", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", borderRadius:"22px 22px 0 0" }}>
          <div style={{ color:"#fff", fontWeight:800, fontSize:18 }}>➕ Tạo Đơn Mới</div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:34, height:34, borderRadius:"50%", fontSize:16, cursor:"pointer" }}>✕</button>
        </div>

        <div style={{ padding:"20px 20px 8px" }}>
          {/* ── QR SECTION ── */}
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

            {/* QR result message */}
            {qrMsg?.type === "found" && (
              <div style={{ marginTop:10, background:"#fffbeb", borderRadius:12, padding:"10px 14px", border:"1.5px solid #fcd34d" }}>
                <div style={{ fontWeight:800, color:"#d97706", marginBottom:4 }}>⚡ Đã tìm thấy dữ liệu cũ — điền tự động!</div>
                <div style={{ fontSize:13, color:"#374151" }}>Đơn gần nhất: <strong>{qrMsg.prevOrder.id}</strong> · {qrMsg.prevOrder.status}</div>
                <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>Thông tin thiết bị đã được tải vào form. Kiểm tra lại rồi tạo đơn mới.</div>
              </div>
            )}
            {qrMsg?.type === "new" && (
              <div style={{ marginTop:10, background:"#f0fdf4", borderRadius:12, padding:"10px 14px", border:"1.5px solid #6ee7b7" }}>
                <div style={{ fontWeight:800, color:"#059669", marginBottom:2 }}>✅ Mã QR mới — sẽ gắn vào đơn này</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>Mã: <strong style={{fontFamily:"monospace"}}>{qrMsg.code}</strong></div>
              </div>
            )}
          </div>

          {/* ── KHÁCH HÀNG ── */}
          <div style={{ ...sec, background:"#f0f9ff" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#0369a1", marginBottom:10 }}>👤 Khách Hàng</div>
            <label style={lbl}>Tìm theo SĐT hoặc tên *</label>
            <input value={custSearch} onChange={e => { setCustSearch(e.target.value); if(!e.target.value) set("customer_id",""); }}
              placeholder="🔍 0901234567 hoặc Nguyễn..." style={inp} />
            {filteredCusts.length > 0 && (
              <div style={{ marginTop:6, border:"1px solid #bae6fd", borderRadius:10, overflow:"hidden" }}>
                {filteredCusts.map(c => (
                  <div key={c.id} onClick={() => { set("customer_id", c.id); setCustSearch(`${c.full_name} — ${c.phone}`); }}
                    style={{ padding:"12px 14px", cursor:"pointer", background:form.customer_id===c.id?"#e0f2fe":"#fff", borderBottom:"1px solid #f3f4f6", fontSize:14 }}>
                    <div style={{ fontWeight:700 }}>{c.full_name}</div>
                    <div style={{ color:"#6b7280", fontSize:12 }}>{c.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── THIẾT BỊ ── */}
          <div style={sec}>
            <div style={{ fontWeight:800, fontSize:14, color:"#3730a3", marginBottom:10 }}>📱 Thiết Bị</div>
            <label style={lbl}>Tên / Model máy *</label>
            <input value={form.device_model} onChange={e => set("device_model", e.target.value)}
              placeholder="iPhone 15 Pro Max, Samsung S24..." style={{ ...inp, marginBottom:10 }} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <label style={lbl}>IMEI / Serial</label>
                <input value={form.imei_serial} onChange={e => set("imei_serial", e.target.value)} placeholder="358..." style={inp} />
              </div>
              <div>
                <label style={lbl}>🔑 Mã PIN</label>
                <input value={form.passcode} onChange={e => set("passcode", e.target.value)} placeholder="1234" style={inp} />
              </div>
            </div>
          </div>

          {/* ── TÌNH TRẠNG ── */}
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

          {/* ── ẢNH / VIDEO ── */}
          <div style={{ ...sec, background:"#f0fdf4", border:"1.5px solid #6ee7b7" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#065f46", marginBottom:10 }}>📸 Hình Ảnh & Video Tình Trạng</div>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" multiple style={{ display:"none" }} onChange={handleFiles} />
            <input ref={videoRef} type="file" accept="video/*" capture="environment" style={{ display:"none" }} onChange={handleFiles} />
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display:"none" }} onChange={handleFiles} />
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <button onClick={() => photoRef.current?.click()} style={{ flex:1, height:60, borderRadius:14, border:"2px dashed #6ee7b7", background:"#f0fdf4", color:"#065f46", fontWeight:700, cursor:"pointer", fontSize:13 }}>📷 Chụp ảnh</button>
              <button onClick={() => videoRef.current?.click()} style={{ flex:1, height:60, borderRadius:14, border:"2px dashed #6ee7b7", background:"#f0fdf4", color:"#065f46", fontWeight:700, cursor:"pointer", fontSize:13 }}>🎥 Quay video</button>
            </div>
            <button onClick={() => fileRef.current?.click()} style={{ width:"100%", height:44, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#f9fafb", color:"#6b7280", fontWeight:600, cursor:"pointer", fontSize:13 }}>📎 Chọn từ thư viện</button>
            {mediaFiles.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:10 }}>
                {mediaFiles.map(m => (
                  <div key={m.id} style={{ position:"relative", width:72, height:72 }}>
                    {m.type==="video"
                      ? <div style={{ width:72, height:72, borderRadius:10, background:"#1f2937", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, border:"2px solid #6ee7b7" }}>🎥</div>
                      : <img src={m.url} style={{ width:72, height:72, objectFit:"cover", borderRadius:10, border:"2px solid #6ee7b7" }} alt="" />
                    }
                    <button onClick={() => setMediaFiles(p => p.filter(x => x.id!==m.id))}
                      style={{ position:"absolute", top:-6, right:-6, width:20, height:20, borderRadius:"50%", background:"#ef4444", color:"#fff", border:"none", fontSize:11, fontWeight:900, cursor:"pointer" }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── PHÂN CÔNG ── */}
          <div style={sec}>
            <div style={{ fontWeight:800, fontSize:14, color:"#3730a3", marginBottom:10 }}>👨‍🔧 Phân Công KTV</div>
            <select value={form.assigned_to} onChange={e => set("assigned_to", e.target.value)} style={{ ...inp, background:"#fff" }}>
              <option value="">-- Chọn kỹ thuật viên --</option>
              {users.filter(u => u.role==="technician").map(u => <option key={u.id} value={u.id}>{u.name} (KPI: {u.kpi})</option>)}
            </select>
            {form.assigned_to && (
              <div style={{ marginTop:8, background:"#fffbeb", borderRadius:10, padding:"10px 12px", fontSize:13, color:"#92400e", fontWeight:600 }}>
                ⏰ KTV có <strong>60 phút</strong> để Nhận máy. Sau 60 phút: -1 KPI. Sau 120 phút: -3 KPI + chuyển QL.</div>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display:"flex", gap:10, marginBottom:20 }}>
            <button onClick={onClose} style={{ flex:1, height:52, borderRadius:14, border:"1.5px solid #e5e7eb", background:"#fff", fontSize:16, cursor:"pointer" }}>Huỷ</button>
            <button onClick={submit} style={{ flex:2, height:56, borderRadius:14, background:"#4f46e5", color:"#fff", border:"none", fontSize:16, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>🚀 Tạo Đơn</button>
          </div>
        </div>
      </div>

      {showQRScan && (
        <QRScanModal
          onClose={() => setShowQRScan(false)}
          onFound={handleQRResult}
          orders={orders}
          mode="capture"
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
//  KPI PAGE
// ══════════════════════════════════════════════
function KPIPage({ users, orders }) {
  const techs = users.filter(u => u.role === "technician");
  return (
    <div style={{ maxWidth:700, margin:"0 auto" }}>
      <div style={{ fontWeight:800, fontSize:22, marginBottom:4 }}>🏆 Đánh Giá KPI Kỹ Thuật</div>
      <div style={{ color:"#6b7280", fontSize:13, marginBottom:20 }}>Theo dõi hiệu suất nhận và xử lý đơn sửa chữa</div>

      {/* Rules */}
      <div style={{ background:"#fff", borderRadius:18, padding:20, marginBottom:20, boxShadow:"0 1px 8px rgba(0,0,0,.07)" }}>
        <div style={{ fontWeight:800, fontSize:15, marginBottom:12, color:"#3730a3" }}>📋 Quy Tắc KPI</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr style={{ background:"#eef2ff" }}>
            <th style={{ padding:"9px 12px", textAlign:"left", fontWeight:700 }}>Sự kiện</th>
            <th style={{ padding:"9px 12px", textAlign:"center", color:"#059669", fontWeight:700 }}>Đúng hạn</th>
            <th style={{ padding:"9px 12px", textAlign:"center", color:"#dc2626", fontWeight:700 }}>Quá hạn</th>
          </tr></thead>
          <tbody>
            {[
              ["Cập nhật trong 60 phút đầu (T=0→60')","Hệ thống dừng đếm","−1 KPI + nhắc lần 1"],
              ["Cập nhật trong 60'→120' (T=60→120')","Hệ thống dừng đếm","−3 KPI + báo QL"],
              ["Không Nhận máy sau 120 phút","—","Hệ thống chuyển việc cho QL"],
              ["Bấm Hoàn tất","+2 KPI","—"],
            ].map(([l,ok,bad],i) => (
              <tr key={i} style={{ borderBottom:"1px solid #f3f4f6" }}>
                <td style={{ padding:"9px 12px", fontWeight:600 }}>{l}</td>
                <td style={{ padding:"9px 12px", textAlign:"center", color:"#059669", fontWeight:700 }}>{ok}</td>
                <td style={{ padding:"9px 12px", textAlign:"center", color:"#dc2626", fontWeight:700 }}>{bad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))", gap:16, marginBottom:20 }}>
        {techs.map(u => {
          const myOrd = orders.filter(o => o.assigned_to===u.id);
          const kc = u.kpi>=8?"#059669":u.kpi>=5?"#d97706":"#dc2626";
          const kb = u.kpi>=8?"#ecfdf5":u.kpi>=5?"#fffbeb":"#fef2f2";
          return (
            <div key={u.id} style={{ background:"#fff", borderRadius:18, padding:20, boxShadow:"0 1px 8px rgba(0,0,0,.07)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <div style={{ width:50, height:50, borderRadius:"50%", background:"#4f46e5", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:20 }}>{u.name[0]}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800, fontSize:16 }}>{u.name}</div>
                  <div style={{ fontSize:12, color:"#6b7280" }}>{ROLE_LABELS[u.role]}</div>
                </div>
                <div style={{ textAlign:"center", background:kb, borderRadius:12, padding:"8px 14px", border:`2px solid ${kc}` }}>
                  <div style={{ fontSize:26, fontWeight:900, color:kc, lineHeight:1 }}>{u.kpi}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:kc }}>KPI</div>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                {[{l:"Đang làm",v:myOrd.filter(o=>!["Đã Giao","Hoàn Thành"].includes(o.status)).length,c:"#d97706"},{l:"Đã xong",v:myOrd.filter(o=>["Hoàn Thành","Đã Giao"].includes(o.status)).length,c:"#059669"},{l:"Tổng",v:myOrd.length,c:"#4f46e5"}].map(s=>(
                  <div key={s.l} style={{ background:"#f9fafb", borderRadius:10, padding:"8px 6px", textAlign:"center" }}>
                    <div style={{ fontSize:20, fontWeight:900, color:s.c }}>{s.v}</div>
                    <div style={{ fontSize:11, color:"#9ca3af" }}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{ height:8, background:"#f3f4f6", borderRadius:10, overflow:"hidden", marginBottom:8 }}>
                <div style={{ height:"100%", width:`${Math.min(100,u.kpi*10)}%`, background:kc, borderRadius:10 }} />
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:kc, textAlign:"center", padding:"5px", background:kb, borderRadius:8 }}>
                {u.kpi>=9?"⭐ Xuất sắc":u.kpi>=7?"👍 Tốt":u.kpi>=5?"⚠️ Trung bình":"❌ Cần cải thiện"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leaderboard */}
      <div style={{ background:"#fff", borderRadius:18, padding:20, boxShadow:"0 1px 8px rgba(0,0,0,.07)" }}>
        <div style={{ fontWeight:800, fontSize:15, marginBottom:12, color:"#3730a3" }}>🏅 Bảng Xếp Hạng</div>
        {[...techs].sort((a,b)=>b.kpi-a.kpi).map((u,i) => {
          const kc = u.kpi>=8?"#059669":u.kpi>=5?"#d97706":"#dc2626";
          return (
            <div key={u.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:i<techs.length-1?"1px solid #f3f4f6":"none" }}>
              <span style={{ fontSize:22, width:30 }}>{["🥇","🥈","🥉"][i]||`#${i+1}`}</span>
              <div style={{ width:38, height:38, borderRadius:"50%", background:"#4f46e5", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>{u.name[0]}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700 }}>{u.name}</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>{orders.filter(o=>o.assigned_to===u.id).length} đơn</div>
              </div>
              <div style={{ fontSize:26, fontWeight:900, color:kc }}>{u.kpi}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════
function LoginForm({ onLogin, users }) {
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
      // Load all staff then filter client-side (avoid filter API issues)
      const staffList = await Staff.list();
      console.log("Staff list:", JSON.stringify(staffList));
      // Password stored as btoa(password) — same as StaffManager
      const hashedInput = btoa(unescape(encodeURIComponent(password.trim())));
      console.log("Username input:", username.trim());
      console.log("Hashed input:", hashedInput);
      const found = staffList.find(s => {
        console.log("Checking:", s.username, s.password_hash, s.is_active);
        return s.username === username.trim() &&
          s.password_hash === hashedInput &&
          s.is_active !== false;
      });
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
        else if (matchUser.password_hash !== hashedInput) setErr(`Sai mật khẩu! DB: ${matchUser.password_hash} | Input: ${hashedInput}`);
        else setErr("Tài khoản bị vô hiệu hóa!");
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
          <div style={{ fontWeight:900, fontSize:24, color:"#1e1b4b", marginTop:8 }}>Quản Lý Sửa Chữa v2</div>
          <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Hệ thống nội bộ</div>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>👤 Tên đăng nhập</label>
          <input
            value={username} onChange={e => { setUsername(e.target.value); setErr(""); }}
            onKeyDown={e => e.key==="Enter" && doLogin()}
            placeholder="Nhập username..."
            style={{ width:"100%", height:50, borderRadius:12, border:`2px solid ${err?"#ef4444":"#e5e7eb"}`, padding:"0 16px", fontSize:15, outline:"none", boxSizing:"border-box", transition:"border .2s" }}
            autoFocus
          />
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>🔑 Mật khẩu</label>
          <div style={{ position:"relative" }}>
            <input
              id="login-pw"
              value={password} onChange={e => { setPassword(e.target.value); setErr(""); }}
              onKeyDown={e => e.key==="Enter" && doLogin()}
              placeholder="Nhập mật khẩu..."
              style={{ width:"100%", height:50, borderRadius:12, border:`2px solid ${err?"#ef4444":"#e5e7eb"}`, padding:"0 50px 0 16px", fontSize:15, outline:"none", boxSizing:"border-box", WebkitTextSecurity: showPw ? "none" : "disc", letterSpacing: showPw ? "normal" : "0.1em" }}
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
          style={{ width:"100%", height:54, background:loading?"#a5b4fc":"#4f46e5", color:"#fff", border:"none", borderRadius:14, fontSize:18, fontWeight:800, cursor:loading?"not-allowed":"pointer", transition:"background .2s" }}>
          {loading ? "⏳ Đang kiểm tra..." : "🚀 Đăng Nhập"}
        </button>


      </div>
    </div>
  );
}


export { NewOrderModal, KPIPage, LoginPage: LoginForm, LoginScreen: LoginForm };
