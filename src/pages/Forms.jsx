/* v3-rebuild-1774864528 */
import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";

const Staff = base44.entities.Staff;

import { timeAgo, genOrderId, getKpiTimerInfo } from "./Viewer";
import { QRScanModal } from "./QR";
import { kvGetCustomers } from "@/functions/kvGetCustomers";

function NewOrderModal({ onClose, onCreate, users, orders }) {
  const [form, setForm] = useState({ customer_name:"", customer_phone:"", device_model:"", imei_serial:"", passcode:"", qr_code:"", issues:[], notes:"", assigned_to:"" });
  const [custSearch, setCustSearch] = useState("");
  const [kvSuggestions, setKvSuggestions] = useState([]);
  const [kvSearching, setKvSearching] = useState(false);
  const [mediaFiles, setMediaFiles] = useState([]);
  const kvDebounceRef = useRef(null);
  const [showQRScan, setShowQRScan] = useState(false);
  const [qrMsg, setQrMsg] = useState(null);
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

  function handleKvSearch(value) {
    setCustSearch(value);
    if (kvDebounceRef.current) clearTimeout(kvDebounceRef.current);
    if (value.length < 2) { setKvSuggestions([]); return; }
    kvDebounceRef.current = setTimeout(async () => {
      setKvSearching(true);
      try {
        const res = await kvGetCustomers({ name: value });
        setKvSuggestions(res.data?.customers || []);
      } catch { setKvSuggestions([]); }
      setKvSearching(false);
    }, 400);
  }

  function selectKvCustomer(c) {
    set("customer_name", c.name);
    set("customer_phone", c.contactNumber || c.phone || "");
    setCustSearch(`${c.name} — ${c.contactNumber || c.phone || ""}`);
    setKvSuggestions([]);
  }

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
      set("qr_code", code);
      set("device_model", prevOrder.device_model);
      set("imei_serial", prevOrder.imei_serial || "");
      set("passcode", prevOrder.passcode || "");
      set("issues", [...(prevOrder.issues||[])]);
      set("notes", prevOrder.notes || "");
      if (prevOrder.customer_name) {
        set("customer_name", prevOrder.customer_name);
        set("customer_phone", prevOrder.customer_phone);
        setCustSearch(`${prevOrder.customer_name} — ${prevOrder.customer_phone}`);
      }
      setQrMsg({ type:"found", code, prevOrder });
    } else {
      set("qr_code", code);
      setQrMsg({ type:"new", code });
    }
  }

  function submit() {
    if (!form.customer_name || !form.device_model) { alert("Vui lòng nhập tên khách hàng và thiết bị!"); return; }
    const imgUrls = mediaFiles.map(m => m.type==="video" ? `video:${m.name}` : m.url);
    onCreate({
      ...form,
      id: genOrderId(),
      created: new Date().toISOString(),
      assigned_at: form.assigned_to ? new Date().toISOString() : null,
      accept_stage: 0,
      status: "Mới Nhận",
      images: imgUrls,
    });
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
          {/* QR */}
          <div style={{ ...sec, background:"#eef2ff", border:"1.5px solid #a5b4fc" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#3730a3", marginBottom:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>📲 Mã QR Máy (đã in sẵn)</span>
              <button onClick={() => setShowQRScan(true)}
                style={{ height:36, padding:"0 14px", borderRadius:10, background:"#4f46e5", color:"#fff", border:"none", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                📷 Quét QR
              </button>
            </div>
            <div style={{ fontSize:12, color:"#6b7280", marginBottom:8 }}>Quét mã QR đã in sẵn dán trên máy để gắn vào đơn. Khi quét QR máy cũ sẽ tự động điền lại thông tin.</div>
            <input value={form.qr_code} onChange={e => { set("qr_code", e.target.value); setQrMsg(null); }}
              placeholder="Quét hoặc nhập mã QR in sẵn trên máy..."
              style={{ ...inp, fontFamily:"monospace", background:form.qr_code?"#f0fdf4":"#fff", borderColor:form.qr_code?"#6ee7b7":"#e5e7eb" }} />
            {qrMsg?.type === "found" && (
              <div style={{ marginTop:10, background:"#fffbeb", borderRadius:12, padding:"10px 14px", border:"1.5px solid #fcd34d" }}>
                <div style={{ fontWeight:800, color:"#d97706" }}>⚡ Máy này đã có lịch sử — điền tự động thông tin cũ!</div>
                <div style={{ fontSize:12, color:"#92400e", marginTop:4 }}>Đơn cũ: {qrMsg.prevOrder?.id} · {qrMsg.prevOrder?.device_model}</div>
              </div>
            )}
            {qrMsg?.type === "new" && (
              <div style={{ marginTop:10, background:"#f0fdf4", borderRadius:12, padding:"10px 14px", border:"1.5px solid #6ee7b7" }}>
                <div style={{ fontWeight:800, color:"#059669" }}>✅ Mã QR mới — sẽ gắn vào đơn này</div>
              </div>
            )}
          </div>

          {/* Khách hàng */}
          <div style={{ ...sec, background:"#f0f9ff" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#0369a1", marginBottom:10 }}>👤 Khách Hàng</div>
            <label style={lbl}>Tên khách hàng *</label>
            <div style={{ position:"relative", marginBottom:10 }}>
              <input value={form.customer_name} onChange={e => { set("customer_name", e.target.value); handleKvSearch(e.target.value); }}
                placeholder="Nhập tên để tìm trong KiotViet..." style={{ ...inp }} />
              {kvSearching && <div style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"#9ca3af" }}>🔄</div>}
              {kvSuggestions.length > 0 && (
                <div style={{ position:"absolute", top:"110%", left:0, right:0, background:"#fff", border:"1.5px solid #c7d2fe", borderRadius:12, boxShadow:"0 8px 24px rgba(0,0,0,.15)", zIndex:100, maxHeight:200, overflowY:"auto" }}>
                  {kvSuggestions.map((c, i) => (
                    <div key={c.id || i} onClick={() => selectKvCustomer(c)}
                      style={{ padding:"10px 14px", cursor:"pointer", borderBottom:"1px solid #f3f4f6", fontSize:14 }}
                      onMouseEnter={e => e.currentTarget.style.background="#eef2ff"}
                      onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                      <div style={{ fontWeight:700 }}>{c.name}</div>
                      <div style={{ fontSize:12, color:"#6b7280" }}>📞 {c.contactNumber || c.phone || "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <label style={lbl}>Số điện thoại *</label>
            <input value={form.customer_phone} onChange={e => set("customer_phone", e.target.value)}
              placeholder="0901234567" style={inp} />
          </div>

          {/* Thiết bị */}
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

          {/* Lỗi */}
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

          {/* Hình ảnh */}
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

          {/* Giao KTV */}
          <div style={{ ...sec, background:"#fffbeb", border:"1.5px solid #fcd34d" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#d97706", marginBottom:10 }}>👨‍🔧 Giao Cho KTV</div>
            <select value={form.assigned_to} onChange={e => set("assigned_to", e.target.value)}
              style={{ ...inp, color:form.assigned_to?"#111":"#9ca3af" }}>
              <option value="">-- Chưa giao (giao sau) --</option>
              {users.filter(u => u.role==="technician" && u.is_active).map(u => (
                <option key={u.id} value={u.id}>{u.name} — KPI: {u.kpi}</option>
              ))}
            </select>
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

export { NewOrderModal, KPIPage };
export const _BUILD_TS = "1774864528-FORCE-V3";