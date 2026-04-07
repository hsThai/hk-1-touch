/* v3-rebuild-1774864528 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { RepairChat, Notification, Staff, RepairOrder, Customer, SparePart, SparePartUsage } from "./pb.jsx";
import { uploadFile } from "./pb.jsx";

import { timeAgo, genOrderId, getKpiTimerInfo } from "./MediaViewer";
import { searchKvCustomers, createKvDeliveryOrder } from "./kiotviet.jsx";
import { QRScanModal, IMEIScanModal } from "./QRComponents.jsx";
// ── Checklist QT1 Ngoại quan ──────────────────────────
const QT1_ITEMS_FORM = [
  { key:"vien_cong_mop",    label:"Viền cong / móp" },
  { key:"can_mop_goc",      label:"Cấn móp góc" },
  { key:"vo_kinh_man",      label:"Vỡ kính màn hình" },
  { key:"vo_kinh_lung",     label:"Vỡ kính lưng" },
  { key:"tray_xuoc_nhe",    label:"Trầy xước nhẹ" },
  { key:"cam_ung_loi",      label:"Cảm ứng lỗi" },
  { key:"cam_ung_delay",    label:"Cảm ứng đa điểm delay" },
  { key:"faceid_touch_loi", label:"FaceID / Touch lỗi" },
  { key:"camera",           label:"Camera trước / sau",        hasNote:true, notePlaceholder:"Mô tả tình trạng camera..." },
  { key:"loa_mic",          label:"Loa / Mic & thoại / video", hasNote:true, notePlaceholder:"Mô tả tình trạng loa, mic..." },
  { key:"wifi_bt",          label:"Wifi / Bluetooth",          hasNote:true, notePlaceholder:"Mô tả tình trạng wifi, BT..." },
];

function NewOrderModal({ onClose, onCreate, users, orders, initialProductQR="" }) {
  const [form, setForm] = useState({
    customer_id:"", customer_name:"", customer_phone:"",
    device_model:"", imei_serial:"", passcode:"",
    qr_code:"", product_qr:"", notes:"",
  });

  const [qt1, setQt1]             = useState({});
  const [qt1Note, setQt1Note]     = useState("");
  const [selectedKtv, setSelectedKtv] = useState("");

  useEffect(() => {
    if (initialProductQR) set("product_qr", initialProductQR);
  }, [initialProductQR]);

  const [custSearch, setCustSearch] = useState("");
  const [dbCusts, setDbCusts]       = useState([]);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [showQRScan, setShowQRScan]   = useState(false);
  const [showIMEIScan, setShowIMEIScan] = useState(false);
  const [qrMsg, setQrMsg]           = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const photoRef    = useRef();
  const videoRef    = useRef();
  const fileRef     = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]:v }));
  const [kvSearching, setKvSearching] = React.useState(false);

  useEffect(() => {
    if (custSearch.length < 2) { setDbCusts([]); return; }
    const timer = setTimeout(async () => {
      setKvSearching(true);
      try {
        const kvResults = await searchKvCustomers(custSearch);
        if (kvResults.length > 0) { setDbCusts(kvResults); setKvSearching(false); return; }
      } catch {}
      try {
        const q = custSearch.toLowerCase();
        const items = await Customer.list({ limit:200 });
        const filtered = items.filter(c => (c.full_name||"").toLowerCase().includes(q) || (c.phone||"").includes(custSearch));
        if (filtered.length > 0) { setDbCusts(filtered); setKvSearching(false); return; }
      } catch {}
      if (orders) {
        const extra = []; const q = custSearch.toLowerCase();
        orders.forEach(o => { if (o.customer_name && o.customer_phone && !extra.find(c=>c.phone===o.customer_phone)) extra.push({ id:o.customer_id||o.customer_phone, full_name:o.customer_name, phone:o.customer_phone }); });
        setDbCusts(extra.filter(c => (c.full_name||"").toLowerCase().includes(q) || (c.phone||"").includes(custSearch)));
      }
      setKvSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [custSearch]);

  function handleFiles(e) {
    const items = Array.from(e.target.files).map(f => ({ id:Math.random().toString(36), file:f, type:f.type.startsWith("video/")?"video":"image", url:URL.createObjectURL(f), name:f.name }));
    setMediaFiles(p => [...p, ...items]); e.target.value = "";
  }

  function toggleQt1(key) {
    setQt1(p => ({ ...p, [key]:{ ...(p[key]||{}), checked:!(p[key]?.checked) } }));
  }
  function setQt1ItemNote(key, val) {
    setQt1(p => ({ ...p, [key]:{ ...(p[key]||{}), note:val } }));
  }

  function handleQRResult(result) {
    setShowQRScan(false);
    if (result.type === "assign_qr") { set("product_qr", result.qr); setQrMsg({ type:"new", code:result.qr }); return; }
    if (result.type === "product_history") {
      const sorted = [...result.orders].sort((a,b) => new Date(b.created||0) - new Date(a.created||0));
      const prev = sorted[0];
      set("product_qr", result.qr);
      if (prev) {
        set("device_model", prev.device_model||"");
        set("imei_serial", prev.imei_serial||"");
        if (prev.customer_name) { set("customer_name", prev.customer_name); set("customer_phone", prev.customer_phone||""); setCustSearch(`${prev.customer_name}${prev.customer_phone ? " — "+prev.customer_phone : ""}`); }
        setQrMsg({ type:"found", code:result.qr, prevOrder:prev });
      }
      return;
    }
    if (result.type === "raw") { set("product_qr", result.code); setQrMsg({ type:"new", code:result.code }); }
  }

  async function submit() {
    if (!form.device_model.trim()) { alert("Vui lòng nhập tên thiết bị!"); return; }
    let cName = form.customer_name;
    let cPhone = form.customer_phone;
    let cId = form.customer_id;
    if (!cId && custSearch.trim()) {
      const parts = custSearch.split(/[—\-]/);
      cName = parts[0].trim(); cPhone = (parts[1]||"").trim(); cId = "new_"+Date.now();
    }
    if (!cName) { alert("Vui lòng nhập tên hoặc SĐT khách hàng!"); return; }
    if (!selectedKtv) { alert("Vui lòng chọn KTV phụ trách!"); return; }

    setSubmitting(true);
    let imgUrls = [];
    try {
      for (const m of mediaFiles) {
        if (m.file) {
          const fileToUpload = m.type==="image" ? await compressImage(m.file) : m.file;
          const url = await uploadFile(fileToUpload);
          imgUrls.push(m.type==="video" ? `video:${url}` : url);
        } else if (m.url && !m.url.startsWith("blob:")) { imgUrls.push(m.url); }
      }
    } catch(e) { console.warn("Upload ảnh thất bại:", e); }
    setSubmitting(false);

    const ktvUser = users.find(u => u.id === selectedKtv);
    const newOrder = {
      ...form,
      id: genOrderId(),
      created: new Date().toISOString(),
      assigned_at: new Date().toISOString(),
      accept_stage: 0,
      status: "Cho KTV",
      images: imgUrls,
      customer_id: cId, customer_name: cName, customer_phone: cPhone,
      assigned_to: selectedKtv,
      assigned_to_name: ktvUser?.name || ktvUser?.full_name || "",
      qt1_checklist: JSON.stringify(qt1),
      qt1_note: qt1Note,
    };
    onCreate(newOrder);

    (async () => {
      try {
        await createKvDeliveryOrder({
          orderCode: newOrder.id, deviceModel: newOrder.device_model,
          technicianName: ktvUser?.name||ktvUser?.full_name||"Chưa giao",
          parts:[{ sku:"REPAIR_ORDER", kvProductId:null, name:`[${newOrder.id}] ${newOrder.device_model}`, qty:1, price:0 }],
        });
      } catch(e) { console.warn("[KiosThong] Gửi đơn thất bại:", e.message); }
    })();

    onClose();
  }

  const inp = { width:"100%", height:48, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:15, outline:"none", boxSizing:"border-box" };
  const lbl = { fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:6 };
  const MI  = ({ name, style={} }) => <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:20, verticalAlign:"middle", lineHeight:1, userSelect:"none", ...style }}>{name}</span>;

  const ktvList = users.filter(u => u.role==="technician" && u.is_active!==false);
  const qt1CheckedCount = QT1_ITEMS_FORM.filter(i => qt1[i.key]?.checked).length;
  const canSubmit = !!selectedKtv && form.device_model.trim() && (form.customer_name.trim() || custSearch.trim());

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:22, width:"100%", maxWidth:540, maxHeight:"93vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,.25)", display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ position:"sticky", top:0, zIndex:10, background:"#3730a3", padding:"14px 20px", borderRadius:"22px 22px 0 0", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ color:"#fff", fontWeight:800, fontSize:17, display:"flex", alignItems:"center", gap:8 }}>
              <MI name="add_circle" style={{ fontSize:22, color:"#fff" }} />
              Tạo Đơn Mới
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:34, height:34, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <MI name="close" style={{ fontSize:20, color:"#fff" }} />
            </button>
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"16px 20px 8px" }}>

          {/* ── QR ── */}
          <div style={{ background:"#eef2ff", border:"1.5px solid #a5b4fc", borderRadius:16, padding:14, marginBottom:14 }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#3730a3", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>Mã QR Sản Phẩm</span>
              <button onClick={() => setShowQRScan(true)} style={{ height:36, width:36, borderRadius:10, background:"#4f46e5", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <MI name="qr_code_scanner" style={{ fontSize:20, color:"#fff" }} />
              </button>
            </div>
            <input value={form.product_qr} onChange={e => { set("product_qr", e.target.value); setQrMsg(null); }}
              placeholder="Quét hoặc nhập mã QR dán trên máy..."
              style={{ ...inp, fontFamily:"monospace", background:form.product_qr?"#f0fdf4":"#fff", borderColor:form.product_qr?"#6ee7b7":"#e5e7eb" }} />
            {qrMsg?.type==="found" && (
              <div style={{ marginTop:8, background:"#fffbeb", borderRadius:10, padding:"8px 12px", border:"1.5px solid #fcd34d", fontSize:12 }}>
                <b style={{color:"#d97706"}}>Đã tìm thấy dữ liệu cũ — điền tự động!</b><br/>
                <span style={{color:"#374151"}}>Đơn gần nhất: {qrMsg.prevOrder.id} · {qrMsg.prevOrder.status}</span>
              </div>
            )}
          </div>

          {/* ── Khách hàng ── */}
          <div style={{ background:"#f0f9ff", border:"1.5px solid #bae6fd", borderRadius:16, padding:14, marginBottom:14 }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#0369a1", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>Khách Hàng</span>
              {kvSearching && <span style={{ fontSize:11, color:"#0369a1", fontWeight:700 }}>Đang tìm KiotViet...</span>}
            </div>
            <input value={custSearch} onChange={e => { setCustSearch(e.target.value); if(!e.target.value) { set("customer_id",""); set("customer_name",""); set("customer_phone",""); } }}
              placeholder="0901234567 hoặc Nguyễn Văn A..." style={inp} />
            {custSearch.length>=2 && !form.customer_id && dbCusts.length===0 && !kvSearching && (
              <div style={{ marginTop:6, background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:10, padding:"8px 12px", fontSize:12, color:"#92400e" }}>
                Không tìm thấy. Nhập tên/SĐT để thêm khách mới.
              </div>
            )}
            {dbCusts.length>0 && (
              <div style={{ marginTop:6, border:"1px solid #bae6fd", borderRadius:10, overflow:"hidden" }}>
                {dbCusts.map(c => (
                  <div key={c.id} onClick={() => { set("customer_id",c.id); set("customer_name",c.full_name||""); set("customer_phone",c.phone||""); setCustSearch(`${c.full_name} — ${c.phone}`); setDbCusts([]); }}
                    style={{ padding:"10px 14px", cursor:"pointer", background:form.customer_id===c.id?"#e0f2fe":"#fff", borderBottom:"1px solid #f3f4f6", fontSize:14 }}>
                    <div style={{ fontWeight:700 }}>{c.full_name}</div>
                    <div style={{ color:"#6b7280", fontSize:12 }}>{c.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Thiết bị ── */}
          <div style={{ background:"#f9fafb", border:"1.5px solid #e5e7eb", borderRadius:16, padding:14, marginBottom:14 }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#3730a3", marginBottom:10 }}>Thiết Bị</div>
            <div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"flex-end" }}>
              <div style={{ flex:1 }}>
                <label style={lbl}>Tên / Model máy *</label>
                <input value={form.device_model} onChange={e => set("device_model", e.target.value)} placeholder="iPhone 15 Pro Max, Samsung S24..." style={inp} />
              </div>
              <div style={{ width:86, flexShrink:0 }}>
                <label style={lbl}>Mã PIN</label>
                <input value={form.passcode} onChange={e => set("passcode", e.target.value)} placeholder="1234" maxLength={8} style={{ ...inp, textAlign:"center", letterSpacing:2, fontWeight:700 }} />
              </div>
            </div>
            <label style={lbl}>IMEI / Serial</label>
            <div style={{ display:"flex", gap:8 }}>
              <input value={form.imei_serial} onChange={e => set("imei_serial", e.target.value)} placeholder="358..." inputMode="numeric" style={{ ...inp, flex:1 }} />
              <button onClick={() => setShowIMEIScan(true)} style={{ width:46, height:46, flexShrink:0, background:"#4f46e5", border:"none", borderRadius:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none"><rect x="2" y="4" width="1.5" height="12" rx="0.5" fill="white"/><rect x="5" y="4" width="1" height="12" rx="0.5" fill="white"/><rect x="7.5" y="4" width="2" height="12" rx="0.5" fill="white"/><rect x="11" y="4" width="1" height="12" rx="0.5" fill="white"/><rect x="13.5" y="4" width="1.5" height="12" rx="0.5" fill="white"/><rect x="16.5" y="4" width="1" height="12" rx="0.5" fill="white"/><rect x="18.5" y="4" width="2" height="12" rx="0.5" fill="white"/><circle cx="17" cy="17" r="4" stroke="white" strokeWidth="1.8" fill="none"/><line x1="20" y1="20" x2="22.5" y2="22.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </button>
            </div>
          </div>

          {/* ── Ghi chú khách báo ── */}
          <div style={{ background:"#f9fafb", border:"1.5px solid #e5e7eb", borderRadius:16, padding:14, marginBottom:14 }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#3730a3", marginBottom:10 }}>Ghi Chú Khách Báo</div>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Mô tả lỗi khách phản ánh, yêu cầu đặc biệt..."
              rows={3} style={{ ...inp, height:"auto", padding:"12px 14px", resize:"vertical" }} />
          </div>

          {/* ── Ảnh/Video tình trạng ── */}
          <div style={{ background:"#f0fdf4", border:"1.5px solid #6ee7b7", borderRadius:16, padding:14, marginBottom:14 }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#065f46", marginBottom:10 }}>Hình Ảnh & Video Tình Trạng</div>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" multiple style={{ display:"none" }} onChange={handleFiles} />
            <input ref={videoRef} type="file" accept="video/*" capture="environment" style={{ display:"none" }} onChange={handleFiles} />
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display:"none" }} onChange={handleFiles} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom: mediaFiles.length>0?10:0 }}>
              <button onClick={() => photoRef.current.click()} style={{ padding:"12px 8px", background:"#f0fdf4", border:"2px dashed #6ee7b7", borderRadius:12, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <MI name="photo_camera" style={{ fontSize:24 }} /><div style={{fontSize:11,color:"#065f46"}}>Chụp ảnh</div>
              </button>
              <button onClick={() => videoRef.current.click()} style={{ padding:"12px 8px", background:"#fdf4ff", border:"2px dashed #d8b4fe", borderRadius:12, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <MI name="videocam" style={{ fontSize:24, color:"#7e22ce" }} /><div style={{fontSize:11,color:"#7e22ce"}}>Quay video</div>
              </button>
              <button onClick={() => fileRef.current.click()} style={{ padding:"12px 8px", background:"#f0f9ff", border:"2px dashed #bae6fd", borderRadius:12, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <MI name="folder_open" style={{ fontSize:24, color:"#0369a1" }} /><div style={{fontSize:11,color:"#0369a1"}}>Chọn file</div>
              </button>
            </div>
            {mediaFiles.length>0 && (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {mediaFiles.map(m => (
                  <div key={m.id} style={{ position:"relative", width:68, height:68 }}>
                    {m.type==="video" ? <div style={{ width:68, height:68, background:"#1e1b4b", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>🎬</div>
                      : <img src={m.url} style={{ width:68, height:68, objectFit:"cover", borderRadius:10 }} alt="" />}
                    <button onClick={() => setMediaFiles(p=>p.filter(x=>x.id!==m.id))} style={{ position:"absolute", top:-5, right:-5, width:20, height:20, background:"#ef4444", border:"none", borderRadius:"50%", color:"#fff", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ══ KIỂM NGOẠI QUAN QT1 ══ */}
          <div style={{ background:"#fff7ed", border:"2px solid #fb923c", borderRadius:16, padding:14, marginBottom:14 }}>
            <div style={{ fontWeight:900, fontSize:15, color:"#9a3412", marginBottom:6, display:"flex", alignItems:"center", gap:8 }}>
              <MI name="search" style={{ fontSize:20, color:"#ea580c" }} />
              Kiểm Tra Ngoại Quan
            </div>
            <div style={{ fontSize:12, color:"#78350f", marginBottom:12, background:"#ffedd5", borderRadius:8, padding:"6px 10px" }}>
              Tick vào các mục <b>có lỗi / bất thường</b>. Không tick = bình thường.
            </div>

            {/* Progress */}
            {qt1CheckedCount > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <div style={{ flex:1, height:5, background:"#fed7aa", borderRadius:6, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${(qt1CheckedCount/QT1_ITEMS_FORM.length)*100}%`, background:"#ea580c", borderRadius:6, transition:"width .3s" }} />
                </div>
                <span style={{ fontSize:11, fontWeight:800, color:"#ea580c", whiteSpace:"nowrap" }}>{qt1CheckedCount} mục có lỗi</span>
              </div>
            )}

            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {QT1_ITEMS_FORM.map(item => (
                <div key={item.key} style={{ background: qt1[item.key]?.checked ? "#ffedd5" : "#fff", borderRadius:11, border:`1.5px solid ${qt1[item.key]?.checked ? "#fb923c" : "#e5e7eb"}`, overflow:"hidden", transition:"all .15s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", cursor:"pointer" }} onClick={() => toggleQt1(item.key)}>
                    <div style={{ width:22, height:22, borderRadius:5, border:`2px solid ${qt1[item.key]?.checked ? "#ea580c" : "#d1d5db"}`, background: qt1[item.key]?.checked ? "#ea580c" : "#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .15s" }}>
                      {qt1[item.key]?.checked && <MI name="check" style={{ fontSize:14, color:"#fff" }} />}
                    </div>
                    <span style={{ fontSize:14, fontWeight: qt1[item.key]?.checked ? 700 : 400, color: qt1[item.key]?.checked ? "#9a3412" : "#374151", flex:1 }}>{item.label}</span>
                    {qt1[item.key]?.checked && <span style={{ fontSize:10, background:"#ea580c", color:"#fff", padding:"2px 7px", borderRadius:20, fontWeight:700, whiteSpace:"nowrap" }}>CÓ LỖI</span>}
                  </div>
                  {item.hasNote && qt1[item.key]?.checked && (
                    <div style={{ padding:"0 12px 10px" }}>
                      <input value={qt1[item.key]?.note||""} onChange={e => setQt1ItemNote(item.key, e.target.value)}
                        placeholder={item.notePlaceholder}
                        style={{ width:"100%", borderRadius:8, border:"1.5px solid #fed7aa", padding:"7px 10px", fontSize:13, boxSizing:"border-box", outline:"none", background:"#fff" }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Ghi chú ngoại quan */}
            <div style={{ marginTop:12 }}>
              <textarea value={qt1Note} onChange={e => setQt1Note(e.target.value)} rows={2}
                placeholder="Ghi chú ngoại quan thêm..."
                style={{ ...inp, height:"auto", padding:"10px 12px", resize:"none", background:"#fff" }} />
            </div>
          </div>

          {/* ── Chọn KTV ── */}
          <div style={{ background:"#f5f3ff", border:"2px solid #ddd6fe", borderRadius:16, padding:14, marginBottom:14 }}>
            <div style={{ fontWeight:900, fontSize:15, color:"#4c1d95", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
              <MI name="engineering" style={{ fontSize:20, color:"#7c3aed" }} />
              Chọn KTV Phụ Trách <span style={{ color:"#dc2626", fontSize:13 }}>*</span>
            </div>
            <select value={selectedKtv} onChange={e => setSelectedKtv(e.target.value)}
              style={{ width:"100%", height:50, borderRadius:13, border:`2px solid ${selectedKtv ? "#7c3aed" : "#e5e7eb"}`, padding:"0 14px", fontSize:15, fontWeight:600, color: selectedKtv ? "#4c1d95" : "#6b7280", background: selectedKtv ? "#ede9fe" : "#fff", outline:"none", cursor:"pointer", boxSizing:"border-box" }}>
              <option value="">-- Chọn KTV phụ trách --</option>
              {ktvList.map(u => (
                <option key={u.id} value={u.id}>🔧 {u.name||u.full_name}</option>
              ))}
            </select>
          </div>

          {/* ── Nút Tạo Đơn ── */}
          <div style={{ display:"flex", gap:10, marginBottom:24 }}>
            <button onClick={onClose} style={{ flex:1, height:52, borderRadius:14, background:"#f3f4f6", border:"none", fontWeight:700, fontSize:15, color:"#6b7280", cursor:"pointer" }}>Hủy</button>
            <button onClick={submit} disabled={submitting || !canSubmit}
              style={{ flex:2, height:52, borderRadius:14, background: canSubmit ? "linear-gradient(135deg,#0369a1,#0284c7)" : "#e5e7eb", border:"none", color: canSubmit ? "#fff" : "#9ca3af", fontWeight:900, fontSize:16, cursor: canSubmit ? "pointer" : "not-allowed", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <MI name="send" style={{ fontSize:22, color: canSubmit ? "#fff" : "#9ca3af" }} />
              {submitting ? "Đang tạo..." : "Tạo Đơn & Chuyển KTV"}
            </button>
          </div>
        </div>

        {showQRScan && <QRScanModal orders={orders||[]} onResult={handleQRResult} onClose={() => setShowQRScan(false)} />}
        {showIMEIScan && <IMEIScanModal onResult={imei => { set("imei_serial", imei); setShowIMEIScan(false); }} onClose={() => setShowIMEIScan(false)} />}
      </div>
    </div>
  );
}


const ISSUE_OPTIONS = [
  "Hao pin / Phồng pin","Màn hình vỡ / nứt","Loa / micro lỗi",
  "Sạc không vào","Camera mờ / hỏng","Vào nước","Nút bấm hỏng",
  "Mất sóng / wifi","Máy nóng","Không lên nguồn",
];

function KPIPage({ users, orders }) {
  const techs = users.filter(u => u.role==="technician");
  return (
    <div style={{ padding:16, maxWidth:800, margin:"0 auto" }}>
      <div style={{ fontWeight:900, fontSize:20, color:"#1e1b4b", marginBottom:16 }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22,verticalAlign:"middle",lineHeight:1}}>emoji_events</span> Bảng KPI Kỹ Thuật Viên</div>
      {techs.length === 0 && <div style={{ textAlign:"center", color:"#9ca3af", padding:40 }}>Chưa có KTV nào</div>}
      {techs.sort((a,b) => b.kpi - a.kpi).map((u, i) => {
        const myOrders = orders.filter(o => o.assigned_to === u.id);
        const done = myOrders.filter(o => ["Hoàn Thành","Đã Giao"].includes(o.status)).length;
        const pending = myOrders.filter(o => !["Hoàn Thành","Đã Giao"].includes(o.status)).length;
        const kpiColor = u.kpi >= 90 ? "#059669" : u.kpi >= 70 ? "#d97706" : "#dc2626";
        return (
          <div key={u.id} style={{ background:"#fff", borderRadius:16, padding:18, marginBottom:12, boxShadow:"0 2px 12px rgba(0,0,0,.08)", display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ fontSize:32, minWidth:40, textAlign:"center" }}>
              {i===0 ? <span style={{fontSize:28}}>🥇</span> : i===1 ? <span style={{fontSize:28}}>🥈</span> : i===2 ? <span style={{fontSize:28}}>🥉</span> : <span style={{fontSize:22,color:"#9ca3af",fontWeight:700}}>#{i+1}</span>}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:16, color:"#1e1b4b" }}>{u.name}</div>
              <div style={{ fontSize:13, color:"#6b7280", marginTop:2 }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:14,verticalAlign:"middle",lineHeight:1}}>check_circle</span> Hoàn thành: {done} · <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:14,verticalAlign:"middle",lineHeight:1}}>hourglass_empty</span> Đang làm: {pending}
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
          <div style={{ fontSize:56 }}> </div>
          <div style={{ fontWeight:900, fontSize:24, color:"#1e1b4b", marginTop:8 }}>Quản Lý Sửa Chữa</div>
          <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Hệ thống nội bộ</div>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>  Tên đăng nhập</label>
          <input id="login-user"
            value={username} onChange={e => { setUsername(e.target.value); setErr(""); }}
            onKeyDown={e => e.key==="Enter" && doLogin()}
            placeholder="Nhập username..."
            style={{ width:"100%", height:50, borderRadius:12, border:`2px solid ${err?"#ef4444":"#e5e7eb"}`, padding:"0 16px", fontSize:15, outline:"none", boxSizing:"border-box" }}
            autoFocus
          />
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>  Mật khẩu</label>
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
              {showPw ? "visibility_off" : "visibility"}
            </button>
          </div>
        </div>

        {err && (
          <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#dc2626", fontWeight:600 }}>
              {err}
          </div>
        )}

        <button id="login-btn" onClick={doLogin} disabled={loading}
          style={{ width:"100%", height:54, background:loading?"#a5b4fc":"#4f46e5", color:"#fff", border:"none", borderRadius:14, fontSize:18, fontWeight:800, cursor:loading?"not-allowed":"pointer" }}>
          {loading ? "⏳ Đang kiểm tra..." : "Đăng Nhập"}
        </button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════
//  PRODUCT HISTORY MODAL — Lịch sử sửa chữa theo QR sản phẩm
// ══════════════════════════════════════════════
function ProductHistoryModal({ qr, orders, onClose, onOpenOrder }) {
  const sorted = [...orders].sort((a,b) => new Date(b.created||0) - new Date(a.created||0));
  return (
    <div style={{ position:"fixed", inset:0, zIndex:5000, background:"rgba(0,0,0,.75)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480, maxHeight:"80vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Header */}
        <div style={{ padding:"18px 20px 12px", borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontWeight:800, fontSize:17, color:"#1f2937"}}>  Lịch sử sản phẩm</div>
            <div style={{ fontSize:12, color:"#6b7280", marginTop:2, fontFamily:"monospace" }}>QR: {qr}</div>
          </div>
          <button onClick={onClose} style={{ background:"#f3f4f6", border:"none", width:36, height:36, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>close</span></button>
        </div>
        {/* List */}
        <div style={{ overflowY:"auto", flex:1, padding:"12px 16px" }}>
          {sorted.length === 0 ? (
            <div style={{ textAlign:"center", color:"#9ca3af", padding:32, fontSize:14 }}>Chưa có lịch sử sửa chữa</div>
          ) : sorted.map((o,i) => (
            <div key={o.id} onClick={() => onOpenOrder(o)}
              style={{ background:i===0?"#f0f9ff":"#f9fafb", borderRadius:14, padding:"14px 16px", marginBottom:10, cursor:"pointer", border:"1.5px solid", borderColor:i===0?"#bae6fd":"#e5e7eb" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{ fontWeight:800, fontSize:15, color:"#1f2937" }}>{o.id}</span>
                <span style={{ fontSize:12, fontWeight:700, padding:"3px 10px", borderRadius:20,
                  background: o.status==="Hoàn Thành"||o.status==="Đã Giao" ? "#d1fae5" : "#fef3c7",
                  color: o.status==="Hoàn Thành"||o.status==="Đã Giao" ? "#065f46" : "#92400e" }}>
                  {o.status}
                </span>
              </div>
              <div style={{ fontSize:13, color:"#374151"}}>  {o.customer_name} ·   {o.customer_phone}</div>
              <div style={{ fontSize:13, color:"#6b7280", marginTop:3 }}>  {Array.isArray(o.issues)?o.issues.join(", "):o.issues}</div>
              <div style={{ fontSize:12, color:"#9ca3af", marginTop:4 }}>  {o.created ? new Date(o.created).toLocaleDateString("vi-VN") : ""}</div>
            </div>
          ))}
        </div>
        <div style={{ padding:"12px 16px 24px" }}>
          <div style={{ fontSize:12, color:"#9ca3af", textAlign:"center" }}>
            Tổng {sorted.length} lần sửa · Nhấn vào để xem chi tiết đơn
          </div>
        </div>
      </div>
    </div>
  );
}

export { NewOrderModal, KPIPage, LoginScreen, ProductHistoryModal };
export const _BUILD_TS = "1774864528-FORCE-V3";


// Nén ảnh: resize max 1280px, chuyển sang JPEG quality 0.82
async function compressImage(file, maxPx = 1280, quality = 0.82) {
  return new Promise((resolve) => {
    if (!file.type?.startsWith("image")) { resolve(file); return; }
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          const out = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg"});
          
          resolve(out);
        },"image/jpeg", quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file); };
    img.src = objUrl;
  });
}

export default function OrderFormsPage() { return null; }
