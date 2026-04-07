import React, { useState, useRef } from "react";

// ── Checklist QT1 — Ngoại quan (Tiếp tân) ──────────────────────────
const QT1_ITEMS = [
  { key:"vien_cong_mop",      label:"Viền cong / móp",           hasNote:false },
  { key:"can_mop_goc",        label:"Cấn móp góc",               hasNote:false },
  { key:"vo_kinh_man",        label:"Vỡ kính màn hình",          hasNote:false },
  { key:"vo_kinh_lung",       label:"Vỡ kính lưng",              hasNote:false },
  { key:"tray_xuoc_nhe",      label:"Trầy xước nhẹ",             hasNote:false },
  { key:"cam_ung_loi",        label:"Cảm ứng lỗi",               hasNote:false },
  { key:"cam_ung_delay",      label:"Cảm ứng đa điểm delay",     hasNote:false },
  { key:"faceid_touch_loi",   label:"FaceID / Touch lỗi",        hasNote:false },
  { key:"camera",             label:"Camera trước / sau",        hasNote:true,  notePlaceholder:"Mô tả tình trạng camera..." },
  { key:"loa_mic",            label:"Loa / Mic & thoại / video", hasNote:true,  notePlaceholder:"Mô tả tình trạng loa, mic..." },
  { key:"wifi_bt",            label:"Wifi / Bluetooth",          hasNote:true,  notePlaceholder:"Mô tả tình trạng wifi, BT..." },
];

// ── Checklist QT2 — KTV kiểm tra sâu ──────────────────────────────
export const QT2_SECTIONS = [
  {
    key: "lcd",
    label: "1. LCD",
    type: "multi",
    options: ["ám","đốm","sọc","mực","điểm chết","hở keo","bọt","chạm màn"],
  },
  {
    key: "nhiet_do",
    label: "2. Nhiệt độ",
    type: "single",
    options: ["bình thường","bóng"],
  },
  {
    key: "baseband",
    label: "3. Baseband",
    type: "single",
    options: ["có","không"],
  },
  {
    key: "sac_pin",
    label: "4. Sạc / Pin",
    type: "multi",
    options: ["sạc nhanh","sạc chậm","% pin lên đều","pin >80%","pin >90%","pin <80%"],
  },
  {
    key: "dong_tieu_thu",
    label: "5. Dòng tiêu thụ",
    type: "inputs",
    fields: [
      { key:"standby",   label:"Standby",   placeholder:"mA" },
      { key:"bat_man",   label:"Bật màn",   placeholder:"mA" },
      { key:"sac",       label:"Sạc",       placeholder:"mA" },
    ],
  },
];

const MI = ({ name, style = {} }) => (
  <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:20, verticalAlign:"middle", lineHeight:1, userSelect:"none", ...style }}>{name}</span>
);

// ══════════════════════════════════════════════
//  PreCheckModal — QT1 Tiếp tân
// ══════════════════════════════════════════════
export default function PreCheckModal({ order, currentUser, users, onClose, onDone }) {
  const [qt1, setQt1]       = useState({}); // { key: { checked, note } }
  const [note, setNote]      = useState("");
  const [images, setImages]  = useState([]);
  const [ktv, setKtv]        = useState("");
  const [saving, setSaving]  = useState(false);
  const [error, setError]    = useState("");
  const fileRef = useRef();

  const ktvList = users.filter(u => u.role === "technician" && u.is_active !== false);

  function toggleItem(key) {
    setQt1(p => ({ ...p, [key]: { ...(p[key]||{}), checked: !(p[key]?.checked) } }));
  }
  function setItemNote(key, val) {
    setQt1(p => ({ ...p, [key]: { ...(p[key]||{}), note: val } }));
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files);
    for (const f of files) {
      const reader = new FileReader();
      await new Promise(res => { reader.onload = ev => { setImages(p => [...p, ev.target.result]); res(); }; reader.readAsDataURL(f); });
    }
  }

  async function handleSubmit() {
    if (!ktv) { setError("Vui lòng chọn KTV phụ trách"); return; }
    setSaving(true);
    try {
      const selectedKtv = ktvList.find(u => u.id === ktv);
      await onDone({
        qt1_checklist: JSON.stringify(qt1),
        qt1_note: note,
        qt1_images: images,
        assigned_to: ktv,
        assigned_to_name: selectedKtv?.name || selectedKtv?.full_name || "",
        status: "Cho KTV",
      });
    } catch(e) { setError(e.message); }
    setSaving(false);
  }

  const checkedCount = QT1_ITEMS.filter(i => qt1[i.key]?.checked).length;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,.65)", display:"flex", alignItems:"flex-end" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:"100%", maxHeight:"94vh", background:"#fff", borderRadius:"24px 24px 0 0", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#0369a1,#0284c7)", padding:"16px 18px", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <div style={{ color:"#fff", fontWeight:900, fontSize:17, display:"flex", alignItems:"center", gap:8 }}>
              <MI name="search" style={{ fontSize:22, color:"#fff" }} />
              QT1 — Kiểm Ngoại Quan
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:32, height:32, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <MI name="close" style={{ fontSize:18, color:"#fff" }} />
            </button>
          </div>
          <div style={{ color:"rgba(255,255,255,.8)", fontSize:13 }}>
            {order.order_code || order.id} · {order.customer_name} · {order.device_model}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", padding:"16px 16px 0" }}>

          {/* Progress */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
            <div style={{ flex:1, height:6, background:"#e5e7eb", borderRadius:6, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(checkedCount/QT1_ITEMS.length)*100}%`, background:"#0369a1", borderRadius:6, transition:"width .3s" }} />
            </div>
            <span style={{ fontSize:12, fontWeight:700, color:"#0369a1", whiteSpace:"nowrap" }}>{checkedCount}/{QT1_ITEMS.length} mục</span>
          </div>

          {/* Checklist */}
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
            {QT1_ITEMS.map(item => (
              <div key={item.key} style={{ background: qt1[item.key]?.checked ? "#fff7ed" : "#f9fafb", borderRadius:12, border:`1.5px solid ${qt1[item.key]?.checked ? "#fb923c" : "#e5e7eb"}`, overflow:"hidden", transition:"all .15s" }}>
                <label style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", cursor:"pointer" }}
                  onClick={() => toggleItem(item.key)}>
                  <div style={{ width:24, height:24, borderRadius:6, border:`2px solid ${qt1[item.key]?.checked ? "#ea580c" : "#d1d5db"}`, background: qt1[item.key]?.checked ? "#ea580c" : "#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .15s" }}>
                    {qt1[item.key]?.checked && <MI name="check" style={{ fontSize:16, color:"#fff" }} />}
                  </div>
                  <span style={{ fontSize:14, fontWeight: qt1[item.key]?.checked ? 700 : 500, color: qt1[item.key]?.checked ? "#9a3412" : "#374151", flex:1 }}>
                    {item.label}
                  </span>
                  {qt1[item.key]?.checked && <span style={{ fontSize:10, background:"#fff7ed", color:"#ea580c", padding:"2px 6px", borderRadius:6, fontWeight:700 }}>CÓ LỖI</span>}
                </label>
                {item.hasNote && qt1[item.key]?.checked && (
                  <div style={{ padding:"0 14px 12px" }}>
                    <input value={qt1[item.key]?.note || ""} onChange={e => setItemNote(item.key, e.target.value)}
                      placeholder={item.notePlaceholder}
                      style={{ width:"100%", borderRadius:8, border:"1.5px solid #fed7aa", padding:"8px 10px", fontSize:13, boxSizing:"border-box", outline:"none", background:"#fff" }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Ghi chú tổng */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>Ghi chú thêm</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Ghi chú tình trạng máy, yêu cầu khách..."
              style={{ width:"100%", borderRadius:12, border:"1.5px solid #e5e7eb", padding:"10px 12px", fontSize:13, resize:"none", boxSizing:"border-box", outline:"none" }} />
          </div>

          {/* Ảnh */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:8 }}>Chụp ảnh ngoại quan</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button onClick={() => { fileRef.current.accept="image/*"; fileRef.current.capture="environment"; fileRef.current.click(); }}
                style={{ width:72, height:72, borderRadius:12, border:"2px dashed #93c5fd", background:"#eff6ff", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, cursor:"pointer", color:"#1d4ed8", fontSize:11, fontWeight:700 }}>
                <MI name="photo_camera" style={{ fontSize:26, color:"#1d4ed8" }} />Chụp
              </button>
              {images.map((img, i) => (
                <div key={i} style={{ width:72, height:72, borderRadius:12, overflow:"hidden", position:"relative" }}>
                  <img src={img} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" />
                  <button onClick={() => setImages(p => p.filter((_,j)=>j!==i))}
                    style={{ position:"absolute", top:2, right:2, background:"rgba(0,0,0,.55)", border:"none", borderRadius:"50%", width:18, height:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <MI name="close" style={{ fontSize:12, color:"#fff" }} />
                  </button>
                </div>
              ))}
            </div>
            <input ref={fileRef} type="file" multiple accept="image/*" style={{ display:"none" }} onChange={handleFiles} />
          </div>

          {/* Chọn KTV */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#374151", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
              <MI name="engineering" style={{ fontSize:16, color:"#7c3aed" }} />
              Chọn KTV phụ trách <span style={{ color:"#dc2626" }}>*</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {ktvList.map(u => (
                <button key={u.id} onClick={() => setKtv(u.id)}
                  style={{ padding:"10px 12px", borderRadius:12, border:`2px solid ${ktv===u.id ? "#7c3aed" : "#e5e7eb"}`, background: ktv===u.id ? "#f5f3ff" : "#fff", cursor:"pointer", display:"flex", alignItems:"center", gap:8, transition:"all .15s" }}>
                  <span style={{ fontSize:18 }}>🔧</span>
                  <div style={{ textAlign:"left" }}>
                    <div style={{ fontSize:13, fontWeight:700, color: ktv===u.id ? "#6d28d9" : "#374151" }}>{u.name||u.full_name}</div>
                    <div style={{ fontSize:11, color:"#6b7280" }}>KTV · KPI: {u.kpi_score||0}</div>
                  </div>
                  {ktv===u.id && <MI name="check_circle" style={{ fontSize:18, color:"#7c3aed", marginLeft:"auto" }} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ margin:"0 16px 8px", padding:"10px 14px", background:"#fff1f2", border:"1.5px solid #fca5a5", borderRadius:10, fontSize:13, color:"#dc2626", fontWeight:600 }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding:"12px 16px 20px", borderTop:"1px solid #f3f4f6", flexShrink:0 }}>
          <button onClick={handleSubmit} disabled={saving || !ktv}
            style={{ width:"100%", height:56, borderRadius:16, background: ktv ? "linear-gradient(135deg,#0369a1,#0284c7)" : "#e5e7eb", border:"none", color: ktv ? "#fff" : "#9ca3af", fontWeight:900, fontSize:17, cursor: ktv ? "pointer" : "not-allowed", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow: ktv ? "0 4px 16px rgba(3,105,161,.35)" : "none" }}>
            <MI name="send" style={{ fontSize:22, color: ktv ? "#fff" : "#9ca3af" }} />
            {saving ? "Đang lưu..." : "Hoàn tất QT1 → Chuyển KTV"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  QT2Modal — KTV kiểm tra sâu
// ══════════════════════════════════════════════
export function QT2Modal({ order, currentUser, onClose, onDone }) {
  const [qt2, setQt2]       = useState({});
  const [note, setNote]     = useState("");
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState([]);   // { url, file }
  const [videos, setVideos] = useState([]);   // { url, file }
  const imgRef = React.useRef();
  const vidRef = React.useRef();

  async function handleImg(e) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5*1024*1024) { alert("Ảnh tối đa 5MB"); return; }
    const url = URL.createObjectURL(file);
    setImages(p => [...p, { url, file }]);
    e.target.value = "";
  }
  async function handleVid(e) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 50*1024*1024) { alert("Video tối đa 50MB"); return; }
    const url = URL.createObjectURL(file);
    setVideos(p => [...p, { url, file }]);
    e.target.value = "";
  }

  function toggleOption(sectionKey, opt) {
    setQt2(p => {
      const sec = p[sectionKey] || { options: [], inputs: {} };
      const opts = sec.options || [];
      const has = opts.includes(opt);
      return { ...p, [sectionKey]: { ...sec, options: has ? opts.filter(o=>o!==opt) : [...opts, opt] } };
    });
  }
  function setSingle(sectionKey, opt) {
    setQt2(p => ({ ...p, [sectionKey]: { ...(p[sectionKey]||{}), options: [opt] } }));
  }
  function setInput(sectionKey, fieldKey, val) {
    setQt2(p => {
      const sec = p[sectionKey] || { options: [], inputs: {} };
      return { ...p, [sectionKey]: { ...sec, inputs: { ...(sec.inputs||{}), [fieldKey]: val } } };
    });
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await onDone({
        qt2_checklist: JSON.stringify(qt2),
        qt2_note: note,
        qt2_images: images.map(i => i.file),
        status: "Cho Bao Gia",
      });
    } catch(e) { alert(e.message); }
    setSaving(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,.65)", display:"flex", alignItems:"flex-end" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:"100%", maxHeight:"94vh", background:"#fff", borderRadius:"24px 24px 0 0", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#6d28d9,#7c3aed)", padding:"16px 18px", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <div style={{ color:"#fff", fontWeight:900, fontSize:17, display:"flex", alignItems:"center", gap:8 }}>
              <MI name="manage_search" style={{ fontSize:22, color:"#fff" }} />
              Quy Trình 2 — KTV Kiểm Tra
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:32, height:32, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <MI name="close" style={{ fontSize:18, color:"#fff" }} />
            </button>
          </div>
          <div style={{ color:"rgba(255,255,255,.8)", fontSize:13 }}>
            {order.order_code || order.id} · {order.customer_name} · {order.device_model}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", padding:"16px 16px 0" }}>
          {QT2_SECTIONS.map(section => {
            const sec = qt2[section.key] || { options: [], inputs: {} };
            return (
              <div key={section.key} style={{ marginBottom:18 }}>
                <div style={{ fontSize:14, fontWeight:800, color:"#4c1d95", marginBottom:10, borderBottom:"2px solid #ede9fe", paddingBottom:6 }}>
                  {section.label}
                </div>

                {(section.type === "multi" || section.type === "single") && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                    {section.options.map(opt => {
                      const active = (sec.options||[]).includes(opt);
                      return (
                        <button key={opt}
                          onClick={() => section.type === "multi" ? toggleOption(section.key, opt) : setSingle(section.key, opt)}
                          style={{ padding:"8px 14px", borderRadius:20, border:`2px solid ${active ? "#7c3aed" : "#e5e7eb"}`, background: active ? "#7c3aed" : "#f9fafb", color: active ? "#fff" : "#374151", fontWeight: active ? 700 : 500, fontSize:13, cursor:"pointer", transition:"all .15s" }}>
                          {active && "✓ "}{opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {section.type === "inputs" && (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                    {section.fields.map(field => (
                      <div key={field.key}>
                        <div style={{ fontSize:11, fontWeight:700, color:"#6b7280", marginBottom:4 }}>{field.label}</div>
                        <input
                          value={(sec.inputs||{})[field.key] || ""}
                          onChange={e => setInput(section.key, field.key, e.target.value)}
                          placeholder={field.placeholder}
                          style={{ width:"100%", borderRadius:10, border:"1.5px solid #ddd6fe", padding:"8px 10px", fontSize:14, boxSizing:"border-box", outline:"none", textAlign:"center", fontWeight:700 }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Ảnh / Video */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
              <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16,color:"#7c3aed",verticalAlign:"middle"}}>photo_camera</span>
              Ảnh / Video đính kèm
            </div>
            {/* Thumbs */}
            {(images.length > 0 || videos.length > 0) && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:8 }}>
                {images.map((img,i) => (
                  <div key={i} style={{ position:"relative", width:72, height:72 }}>
                    <img src={img.url} style={{ width:72, height:72, objectFit:"cover", borderRadius:10, border:"2px solid #ddd6fe" }} />
                    <button onClick={() => setImages(p => p.filter((_,idx)=>idx!==i))}
                      style={{ position:"absolute", top:-6, right:-6, width:20, height:20, borderRadius:"50%", background:"#ef4444", border:"none", color:"#fff", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>✕</button>
                  </div>
                ))}
                {videos.map((v,i) => (
                  <div key={i} style={{ position:"relative", width:72, height:72 }}>
                    <video src={v.url} style={{ width:72, height:72, objectFit:"cover", borderRadius:10, border:"2px solid #ddd6fe" }} />
                    <span style={{ position:"absolute", bottom:2, right:4, fontSize:9, background:"rgba(0,0,0,.6)", color:"#fff", borderRadius:4, padding:"1px 4px" }}>VID</span>
                    <button onClick={() => setVideos(p => p.filter((_,idx)=>idx!==i))}
                      style={{ position:"absolute", top:-6, right:-6, width:20, height:20, borderRadius:"50%", background:"#ef4444", border:"none", color:"#fff", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            {/* Buttons */}
            <div style={{ display:"flex", gap:8 }}>
              <input ref={imgRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={handleImg} />
              <input ref={vidRef} type="file" accept="video/*" capture="environment" style={{ display:"none" }} onChange={handleVid} />
              <button onClick={() => imgRef.current?.click()}
                style={{ flex:1, height:44, borderRadius:12, border:"2px dashed #ddd6fe", background:"#faf5ff", color:"#7c3aed", fontWeight:700, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,verticalAlign:"middle"}}>add_a_photo</span>
                Chụp ảnh
              </button>
              <button onClick={() => vidRef.current?.click()}
                style={{ flex:1, height:44, borderRadius:12, border:"2px dashed #ddd6fe", background:"#faf5ff", color:"#7c3aed", fontWeight:700, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,verticalAlign:"middle"}}>videocam</span>
                Quay video
              </button>
            </div>
          </div>

          {/* Ghi chú */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>Ghi chú KTV</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              placeholder="Ghi chú thêm về tình trạng máy, đề xuất sửa chữa..."
              style={{ width:"100%", borderRadius:12, border:"1.5px solid #e5e7eb", padding:"10px 12px", fontSize:13, resize:"none", boxSizing:"border-box", outline:"none" }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:"12px 16px 20px", borderTop:"1px solid #f3f4f6", flexShrink:0 }}>
          <button onClick={handleSubmit} disabled={saving}
            style={{ width:"100%", height:56, borderRadius:16, background:"linear-gradient(135deg,#6d28d9,#7c3aed)", border:"none", color:"#fff", fontWeight:900, fontSize:17, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow:"0 4px 16px rgba(109,40,217,.35)" }}>
            <MI name="send" style={{ fontSize:22, color:"#fff" }} />
            {saving ? "Đang lưu..." : "Hoàn tất QT2 → Gửi về Tiếp Tân"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  CustomerConfirmModal — TT báo giá & xác nhận KH
// ══════════════════════════════════════════════
export function CustomerConfirmModal({ order, currentUser, onClose, onApprove, onReject }) {
  const [rejectReason, setRejectReason] = useState("");
  const [mode, setMode]                 = useState(""); // "approve" | "reject"
  const [saving, setSaving]             = useState(false);

  // Parse qt1 và qt2 để hiển thị tóm tắt
  let qt1 = {};
  let qt2 = {};
  try { qt1 = JSON.parse(order.qt1_checklist || "{}"); } catch {}
  try { qt2 = JSON.parse(order.qt2_checklist || "{}"); } catch {}

  const qt1Issues = Object.entries(qt1).filter(([,v]) => v?.checked).map(([k,v]) => {
    const item = [
      { key:"vien_cong_mop", label:"Viền cong/móp" }, { key:"can_mop_goc", label:"Cấn móp góc" },
      { key:"vo_kinh_man", label:"Vỡ kính màn" }, { key:"vo_kinh_lung", label:"Vỡ kính lưng" },
      { key:"tray_xuoc_nhe", label:"Trầy xước nhẹ" }, { key:"cam_ung_loi", label:"Cảm ứng lỗi" },
      { key:"cam_ung_delay", label:"Cảm ứng delay" }, { key:"faceid_touch_loi", label:"FaceID/Touch lỗi" },
      { key:"camera", label:"Camera" }, { key:"loa_mic", label:"Loa/Mic" }, { key:"wifi_bt", label:"Wifi/BT" },
    ].find(i => i.key === k);
    return (item?.label || k) + (v?.note ? `: ${v.note}` : "");
  });

  async function handleApprove() {
    setSaving(true);
    try { await onApprove(); } catch(e) { alert(e.message); }
    setSaving(false);
  }
  async function handleReject() {
    if (!rejectReason.trim()) { alert("Vui lòng nhập lý do hủy"); return; }
    setSaving(true);
    try { await onReject(rejectReason); } catch(e) { alert(e.message); }
    setSaving(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,.65)", display:"flex", alignItems:"flex-end" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:"100%", maxHeight:"92vh", background:"#fff", borderRadius:"24px 24px 0 0", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#db2777,#ec4899)", padding:"16px 18px", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <div style={{ color:"#fff", fontWeight:900, fontSize:17, display:"flex", alignItems:"center", gap:8 }}>
              <MI name="pending_actions" style={{ fontSize:22, color:"#fff" }} />
              Xác Nhận Khách Hàng
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:32, height:32, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <MI name="close" style={{ fontSize:18, color:"#fff" }} />
            </button>
          </div>
          <div style={{ color:"rgba(255,255,255,.8)", fontSize:13 }}>
            {order.order_code || order.id} · {order.customer_name} · {order.device_model}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:"auto", padding:"16px 16px 0" }}>

          {/* Tóm tắt QT1 */}
          {qt1Issues.length > 0 && (
            <div style={{ background:"#fff7ed", border:"1.5px solid #fed7aa", borderRadius:14, padding:"12px 14px", marginBottom:12 }}>
              <div style={{ fontWeight:800, fontSize:13, color:"#9a3412", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                <MI name="search" style={{ fontSize:16, color:"#ea580c" }} /> Lỗi ngoại quan (QT1)
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {qt1Issues.map((issue, i) => (
                  <span key={i} style={{ background:"#ffedd5", color:"#9a3412", padding:"4px 10px", borderRadius:20, fontSize:12, fontWeight:600 }}>{issue}</span>
                ))}
              </div>
              {order.qt1_note && <div style={{ fontSize:12, color:"#78350f", marginTop:8, fontStyle:"italic" }}>"{order.qt1_note}"</div>}
            </div>
          )}

          {/* Tóm tắt QT2 */}
          {Object.keys(qt2).length > 0 && (
            <div style={{ background:"#f5f3ff", border:"1.5px solid #ddd6fe", borderRadius:14, padding:"12px 14px", marginBottom:12 }}>
              <div style={{ fontWeight:800, fontSize:13, color:"#4c1d95", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                <MI name="manage_search" style={{ fontSize:16, color:"#7c3aed" }} /> Kết quả kiểm tra KTV (QT2)
              </div>
              {Object.entries(qt2).map(([k, v]) => {
                if (!v) return null;
                const section = [
                  { key:"lcd", label:"LCD" }, { key:"nhiet_do", label:"Nhiệt độ" },
                  { key:"baseband", label:"Baseband" }, { key:"sac_pin", label:"Sạc/Pin" },
                  { key:"dong_tieu_thu", label:"Dòng tiêu thụ" },
                ].find(s => s.key === k);
                const opts = v.options || [];
                const inputs = v.inputs || {};
                return (
                  <div key={k} style={{ marginBottom:6 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:"#6d28d9" }}>{section?.label || k}: </span>
                    {opts.length > 0 && <span style={{ fontSize:12, color:"#374151" }}>{opts.join(", ")}</span>}
                    {Object.entries(inputs).filter(([,val])=>val).map(([fk, fv]) => (
                      <span key={fk} style={{ fontSize:12, color:"#374151" }}> {fk}: {fv}</span>
                    ))}
                  </div>
                );
              })}
              {order.qt2_note && <div style={{ fontSize:12, color:"#4c1d95", marginTop:6, fontStyle:"italic" }}>"{order.qt2_note}"</div>}
            </div>
          )}

          {/* Chọn đồng ý / hủy */}
          {!mode && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
              <button onClick={() => setMode("approve")}
                style={{ height:72, borderRadius:16, background:"linear-gradient(135deg,#059669,#047857)", border:"none", color:"#fff", fontWeight:900, fontSize:15, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, boxShadow:"0 4px 16px rgba(5,150,105,.3)" }}>
                <MI name="check_circle" style={{ fontSize:26, color:"#fff" }} />
                Đồng Ý Sửa
              </button>
              <button onClick={() => setMode("reject")}
                style={{ height:72, borderRadius:16, background:"linear-gradient(135deg,#dc2626,#b91c1c)", border:"none", color:"#fff", fontWeight:900, fontSize:15, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, boxShadow:"0 4px 16px rgba(220,38,38,.3)" }}>
                <MI name="cancel" style={{ fontSize:26, color:"#fff" }} />
                Không Sửa / Hủy
              </button>
            </div>
          )}

          {/* Xác nhận đồng ý */}
          {mode === "approve" && (
            <div style={{ background:"#f0fdf4", border:"2px solid #86efac", borderRadius:16, padding:"16px", marginBottom:16 }}>
              <div style={{ fontWeight:800, fontSize:15, color:"#065f46", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                <MI name="check_circle" style={{ fontSize:20, color:"#059669" }} /> Khách đồng ý sửa chữa
              </div>
              <div style={{ fontSize:13, color:"#374151", marginBottom:14 }}>
                KTV <b>{order.assigned_to_name}</b> sẽ được thông báo nhận đơn ngay.
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => setMode("")} style={{ flex:1, height:44, borderRadius:12, background:"#f3f4f6", border:"none", fontWeight:700, fontSize:14, cursor:"pointer", color:"#6b7280" }}>Quay lại</button>
                <button onClick={handleApprove} disabled={saving}
                  style={{ flex:2, height:44, borderRadius:12, background:"#059669", border:"none", color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer" }}>
                  {saving ? "Đang lưu..." : "✅ Xác nhận & Lên Đơn"}
                </button>
              </div>
            </div>
          )}

          {/* Nhập lý do hủy */}
          {mode === "reject" && (
            <div style={{ background:"#fff1f2", border:"2px solid #fca5a5", borderRadius:16, padding:"16px", marginBottom:16 }}>
              <div style={{ fontWeight:800, fontSize:15, color:"#991b1b", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                <MI name="cancel" style={{ fontSize:20, color:"#dc2626" }} /> Khách không đồng ý sửa
              </div>
              <div style={{ fontSize:13, color:"#374151", marginBottom:10 }}>Đơn sẽ được lưu trạng thái <b>"Hủy"</b> kèm lý do.</div>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
                placeholder="Nhập lý do khách không đồng ý (giá cao, không có linh kiện, tự sửa...)"
                style={{ width:"100%", borderRadius:12, border:"1.5px solid #fca5a5", padding:"10px 12px", fontSize:13, resize:"none", boxSizing:"border-box", outline:"none", marginBottom:10 }} />
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => setMode("")} style={{ flex:1, height:44, borderRadius:12, background:"#f3f4f6", border:"none", fontWeight:700, fontSize:14, cursor:"pointer", color:"#6b7280" }}>Quay lại</button>
                <button onClick={handleReject} disabled={saving || !rejectReason.trim()}
                  style={{ flex:2, height:44, borderRadius:12, background: rejectReason.trim() ? "#dc2626" : "#e5e7eb", border:"none", color: rejectReason.trim() ? "#fff" : "#9ca3af", fontWeight:800, fontSize:15, cursor: rejectReason.trim() ? "pointer" : "not-allowed" }}>
                  {saving ? "Đang lưu..." : "🚫 Lưu Đơn Hủy"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
