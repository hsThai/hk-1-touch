import React, { useState, useRef, useEffect } from "react";
import { SparePart, StockLedger } from "./pb.jsx";

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

// Danh mục linh kiện + công gợi ý
export const SPARE_SUGGESTIONS = [
  "Màn hình (LCD + cảm ứng)", "Màn hình zin", "Kính mặt trước", "Kính lưng",
  "Pin", "Sạc không dây", "Loa trong", "Loa ngoài", "Micro", "Camera trước",
  "Camera sau", "Nút home/Touch", "Nút nguồn", "Nút âm lượng",
  "Jack tai nghe", "Cổng sạc", "IC nguồn", "IC sạc", "Bo mạch sửa",
  "Công kiểm tra", "Công vệ sinh", "Công hàn", "Công thay linh kiện",
];

// Phí dịch vụ / công (KHÔNG gồm linh kiện — linh kiện chọn từ kho)
export const SERVICE_FEES = [
  "Công kiểm tra", "Công vệ sinh", "Công thay linh kiện", "Công hàn",
  "Công ép kính", "Công sửa main", "Công cài đặt phần mềm", "Công thay màn hình",
  "Công thay pin", "Phí khác",
];

const MI = ({ name, style = {} }) => (
  <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:20, verticalAlign:"middle", lineHeight:1, userSelect:"none", ...style }}>{name}</span>
);

// ══════════════════════════════════════════════
//  PreCheckModal — QT1 Tiếp tân
// ══════════════════════════════════════════════
export default function PreCheckModal({ order, currentUser, users, onClose, onDone }) {
  const [isPC, setIsPC] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 900);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const [qt1, setQt1]       = useState({}); // { key: { checked, note } }
  const [note, setNote]      = useState("");
  const [images, setImages]  = useState([]);
  const [ktv, setKtv]        = useState("");
  const [saving, setSaving]  = useState(false);
  const [error, setError]    = useState("");
  const fileRef = useRef();

  if (!order || !users) return null;
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
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,.65)", display:"flex", alignItems:isPC?"center":"flex-end", justifyContent:"center", padding:isPC?20:0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:"100%", maxWidth:isPC?560:"100%", maxHeight:isPC?"90vh":"92vh", background:"#fff", borderRadius:isPC?18:"24px 24px 0 0", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:isPC?"0 24px 70px rgba(0,0,0,.35)":"none" }}>

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
  const [isPC, setIsPC] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 900);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const [qt2, setQt2]       = useState({});
  const [note, setNote]     = useState("");
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const imgRef = useRef();
  const vidRef = useRef();

  // Đề xuất linh kiện + công
  const [deXuat, setDeXuat]         = useState([]); // [{ name, qty, price }]
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestFilter, setSuggestFilter] = useState("");

  function addItem(name = "") {
    setDeXuat(p => [...p, { name, qty: 1, price: "" }]);
    setShowSuggest(false);
    setSuggestFilter("");
  }
  function updateItem(i, field, val) {
    setDeXuat(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  }
  function removeItem(i) {
    setDeXuat(p => p.filter((_, idx) => idx !== i));
  }
  const totalDeXuat = deXuat.reduce((s, it) => s + (Number(it.price)||0) * (Number(it.qty)||1), 0);
  const filteredSuggest = SPARE_SUGGESTIONS.filter(s =>
    !suggestFilter || s.toLowerCase().includes(suggestFilter.toLowerCase())
  );

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
        qt2_de_xuat: deXuat,          // mảng linh kiện + công đề xuất
        qt2_total: totalDeXuat,       // tổng dự toán KTV
        status: "Cho Bao Gia",
      });
    } catch(e) { alert(e.message); }
    setSaving(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,.65)", display:"flex", alignItems:isPC?"center":"flex-end", justifyContent:"center", padding:isPC?20:0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:"100%", maxWidth:isPC?560:"100%", maxHeight:isPC?"90vh":"92vh", background:"#fff", borderRadius:isPC?18:"24px 24px 0 0", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:isPC?"0 24px 70px rgba(0,0,0,.35)":"none" }}>

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

          {/* ═══ Đề xuất linh kiện + công ═══ */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:8, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16,color:"#7c3aed",verticalAlign:"middle"}}>build</span>
                Đề xuất linh kiện + công
                {totalDeXuat > 0 && (
                  <span style={{ background:"#7c3aed", color:"#fff", borderRadius:20, padding:"2px 8px", fontSize:11, fontWeight:800 }}>
                    {totalDeXuat.toLocaleString("vi-VN")}đ
                  </span>
                )}
              </div>
              <button onClick={() => setShowSuggest(p=>!p)}
                style={{ background:"#7c3aed", border:"none", color:"#fff", borderRadius:10, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:14,verticalAlign:"middle"}}>add</span>
                Thêm
              </button>
            </div>

            {/* Dropdown gợi ý */}
            {showSuggest && (
              <div style={{ background:"#fff", border:"2px solid #ddd6fe", borderRadius:14, marginBottom:10, overflow:"hidden", boxShadow:"0 4px 20px rgba(124,58,237,.15)" }}>
                <div style={{ padding:"8px 10px", borderBottom:"1px solid #ede9fe" }}>
                  <input value={suggestFilter} onChange={e=>setSuggestFilter(e.target.value)}
                    placeholder="Tìm linh kiện/dịch vụ..."
                    autoFocus
                    style={{ width:"100%", border:"1.5px solid #ddd6fe", borderRadius:8, padding:"6px 10px", fontSize:13, outline:"none", boxSizing:"border-box" }} />
                </div>
                <div style={{ maxHeight:200, overflowY:"auto" }}>
                  {filteredSuggest.map(s => (
                    <button key={s} onClick={() => addItem(s)}
                      style={{ width:"100%", padding:"10px 14px", background:"none", border:"none", borderBottom:"1px solid #f5f3ff", textAlign:"left", fontSize:13, color:"#374151", cursor:"pointer", fontWeight:500 }}>
                      {s}
                    </button>
                  ))}
                  {suggestFilter && !filteredSuggest.some(s=>s.toLowerCase()===suggestFilter.toLowerCase()) && (
                    <button onClick={() => addItem(suggestFilter)}
                      style={{ width:"100%", padding:"10px 14px", background:"#faf5ff", border:"none", textAlign:"left", fontSize:13, color:"#7c3aed", cursor:"pointer", fontWeight:700 }}>
                      + Thêm "{suggestFilter}"
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Danh sách đề xuất */}
            {deXuat.length > 0 ? (
              <div style={{ border:"1.5px solid #ddd6fe", borderRadius:14, overflow:"hidden" }}>
                {/* Header */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 60px 90px 32px", gap:6, padding:"8px 10px", background:"#f5f3ff", borderBottom:"1px solid #ddd6fe" }}>
                  {["Tên linh kiện / dịch vụ","SL","Đơn giá",""].map((h,i)=>(
                    <div key={i} style={{ fontSize:11, fontWeight:700, color:"#7c3aed", textAlign: i===1?"center":i===2?"right":"left" }}>{h}</div>
                  ))}
                </div>
                {deXuat.map((it, i) => (
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 60px 90px 32px", gap:6, padding:"8px 10px", borderBottom: i<deXuat.length-1?"1px solid #f3f4f6":"none", alignItems:"center" }}>
                    <input value={it.name} onChange={e=>updateItem(i,"name",e.target.value)}
                      placeholder="Tên..."
                      style={{ border:"1px solid #e5e7eb", borderRadius:8, padding:"6px 8px", fontSize:13, outline:"none", width:"100%", boxSizing:"border-box" }} />
                    <input value={it.qty} onChange={e=>updateItem(i,"qty",e.target.value)}
                      type="number" min="1"
                      style={{ border:"1px solid #e5e7eb", borderRadius:8, padding:"6px 4px", fontSize:13, outline:"none", textAlign:"center", width:"100%", boxSizing:"border-box" }} />
                    <input value={it.price} onChange={e=>updateItem(i,"price",e.target.value)}
                      type="number" min="0" placeholder="0"
                      style={{ border:"1px solid #e5e7eb", borderRadius:8, padding:"6px 6px", fontSize:13, outline:"none", textAlign:"right", width:"100%", boxSizing:"border-box" }} />
                    <button onClick={()=>removeItem(i)}
                      style={{ background:"#fee2e2", border:"none", borderRadius:8, width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0 }}>
                      <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:14,color:"#dc2626"}}>close</span>
                    </button>
                  </div>
                ))}
                {/* Tổng */}
                <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:10, padding:"10px 12px", background:"#f5f3ff", borderTop:"2px solid #ddd6fe" }}>
                  <span style={{ fontSize:13, fontWeight:700, color:"#4c1d95" }}>Tổng dự toán KTV:</span>
                  <span style={{ fontSize:16, fontWeight:900, color:"#7c3aed" }}>{totalDeXuat.toLocaleString("vi-VN")}đ</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign:"center", padding:"14px", border:"1.5px dashed #ddd6fe", borderRadius:12, color:"#9ca3af", fontSize:13 }}>
                Chưa có đề xuất — bấm Thêm để khai báo
              </div>
            )}
          </div>

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
export function CustomerConfirmModal({ order, users = [], currentUser, onClose, onApprove, onReject, onSaveDraft }) {
  const [isPC, setIsPC] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 900);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const [rejectReason, setRejectReason] = useState("");
  const [selKtv, setSelKtv] = useState(order.assigned_to || "");
  const needKtv  = !order.assigned_to;                       // đơn tạo bằng "Báo Giá Ngay" — chưa có KTV
  const ktvList  = (users||[]).filter(u => u.role === "technician" && u.is_active !== false);
  const [mode, setMode]                 = useState(""); // "approve" | "reject"
  const [saving, setSaving]             = useState(false);

  // Báo giá: giảm giá + tổng tự động (tổng dòng − giảm giá)
  const [giamGia, setGiamGia]     = useState(order.quote_discount ? String(order.quote_discount) : "");

  // Parse qt1 và qt2 để hiển thị tóm tắt
  let qt1 = {};
  let qt2 = {};
  let deXuat = [];
  try { qt1 = JSON.parse(order.qt1_checklist || "{}"); } catch {}
  try { qt2 = JSON.parse(order.qt2_checklist || "{}"); } catch {}
  // deXuat có thể là JSON string hoặc array
  try {
    const raw = order.qt2_de_xuat;
    if (typeof raw === "string" && raw) deXuat = JSON.parse(raw);
    else if (Array.isArray(raw)) deXuat = raw;
  } catch {}
  const totalKTV = order.qt2_total || deXuat.reduce((s,it) => s + (Number(it.price)||0)*(Number(it.qty)||1), 0);

  // ── Báo giá chi tiết: GĐV chỉnh trực tiếp trên dòng linh kiện/dịch vụ ──
  const [lines, setLines] = useState(() => (deXuat || []).map((it, i) => ({
    key: "l" + i + "_" + Math.random().toString(36).slice(2, 7),
    name: it.name || "", sku: it.sku || "", part_id: it.part_id || "",
    is_service: !!it.is_service, qty: Number(it.qty) || 1,
    price: it.price !== undefined ? it.price : "",
    waiting: !!it.waiting, expected_date: it.expected_date || "", po_due_date: it.po_due_date || "",
  })));
  const [partSearch, setPartSearch] = useState("");
  const [partRes, setPartRes]     = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSvc, setShowSvc]     = useState(false);
  const [svcFilter, setSvcFilter] = useState("");
  const [stockByPart, setStockByPart] = useState({});

  // Tồn kho tổng theo part_id — tải 1 lần khi mở
  useEffect(() => {
    let dead = false;
    StockLedger.listAll({ fields: "id,part_id,qty_on_hand" }).then(ledgers => {
      if (dead) return;
      const map = {};
      (ledgers || []).forEach(l => { if (l.part_id) map[l.part_id] = (map[l.part_id] || 0) + (Number(l.qty_on_hand) || 0); });
      setStockByPart(map);
    }).catch(() => {});
    return () => { dead = true; };
  }, []);

  // Tìm linh kiện TRÊN SERVER toàn bộ catalog
  useEffect(() => {
    const term = partSearch.trim();
    if (!term) { setPartRes([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const q = term.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        const found = await SparePart.list({ filter: `is_active=true && (name~"${q}" || sku~"${q}" || serial_imei~"${q}")`, sort: "name", limit: 30 });
        setPartRes(found || []);
      } catch { setPartRes([]); }
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [partSearch]);

  function addPart(p) {
    const stock = stockByPart[p.id] ?? (Number(p.stock_qty) || 0);
    setLines(prev => [...prev, {
      key: "p" + p.id + "_" + Date.now(), name: p.name, sku: p.sku || "", part_id: p.id,
      is_service: false, qty: 1, price: p.price !== undefined ? p.price : "",
      waiting: stock <= 0, expected_date: "", po_due_date: "",
    }]);
    setPartSearch(""); setPartRes([]);
  }
  function addSvc(name) {
    setLines(prev => [...prev, {
      key: "s_" + Date.now() + Math.random().toString(36).slice(2, 5), name,
      sku: "", part_id: "", is_service: true, qty: 1, price: "",
      waiting: false, expected_date: "", po_due_date: "",
    }]);
    setShowSvc(false); setSvcFilter("");
  }
  function updLine(key, field, val) { setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: val } : l)); }
  function rmLine(key) { setLines(prev => prev.filter(l => l.key !== key)); }
  const validLines = lines.filter(l => l.name && l.name.trim());
  const totalLines = validLines.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.qty) || 1), 0);
  const hasWaiting  = validLines.some(l => l.waiting && !l.is_service);
  const giamGiaNum = Math.max(0, Number(giamGia) || 0);
  const finalTotal = Math.max(0, totalLines - giamGiaNum);

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
    if (!validLines.length) {
      alert("Thêm ít nhất 1 linh kiện hoặc phí dịch vụ trước khi xác nhận!");
      return;
    }
    setSaving(true);
    try {
      for (const l of validLines) {
        if (l.price === "" || Number(l.price) < 0) { alert(`Nhập giá cho "${l.name}"!`); setSaving(false); return; }
        if (l.waiting && !l.is_service && (!l.expected_date || !l.po_due_date)) {
          alert(`"${l.name}" là hàng chờ nhập: nhập ngày dự kiến về và hạn đặt NCC!`); setSaving(false); return;
        }
      }
      const hasWaitingLine = validLines.some(l => l.waiting && !l.is_service);
      if (needKtv && !hasWaitingLine && !selKtv) {
        alert("Chọn kỹ thuật viên phụ trách sửa máy trước khi xác nhận!");
        setSaving(false); return;
      }
      await onApprove({
        estimated_cost: finalTotal,
        quote_discount: giamGiaNum,
        deposit: 0,
        assigned_to: needKtv ? (selKtv || "") : (order.assigned_to || ""),
        assigned_to_name: needKtv ? ((ktvList.find(u=>u.id===selKtv)?.name) || (ktvList.find(u=>u.id===selKtv)?.full_name) || "") : (order.assigned_to_name || ""),
        quote_items: validLines.map(l => ({
          name: l.name.trim(), sku: l.sku, part_id: l.part_id, is_service: l.is_service,
          qty: Number(l.qty) || 1, price: Number(l.price) || 0,
          waiting: !!l.waiting && !l.is_service,
          expected_date: l.expected_date || "", po_due_date: l.po_due_date || "",
        })),
        quote_total: totalLines,
      });
    } catch(e) { alert(e.message); }
    setSaving(false);
  }
  // Lưu tạm: giữ bảng báo giá để khách suy nghĩ, chỉnh lại sau — KHÔNG đổi trạng thái đơn
  async function handleSaveDraft() {
    setSaving(true);
    try {
      await onSaveDraft?.({
        quote_items: validLines.map(l => ({
          name: l.name.trim(), sku: l.sku, part_id: l.part_id, is_service: l.is_service,
          qty: Number(l.qty) || 1, price: l.price === "" ? 0 : (Number(l.price) || 0),
          waiting: !!l.waiting && !l.is_service,
          expected_date: l.expected_date || "", po_due_date: l.po_due_date || "",
        })),
        quote_total: totalLines,
        quote_discount: giamGiaNum,
        estimated_cost: finalTotal,
      });
    } catch(e) { alert(e.message); }
    setSaving(false);
  }
  async function handleReject() {
    if (!rejectReason.trim()) { alert("Vui lòng nhập lý do hủy"); return; }
    setSaving(true);
    try { await onReject(rejectReason); } catch(e) { alert(e.message); }
    setSaving(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,.65)", display:"flex", alignItems:isPC?"center":"flex-end", justifyContent:"center", padding:isPC?20:0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:"100%", maxWidth:isPC?560:"100%", maxHeight:isPC?"90vh":"92vh", background:"#fff", borderRadius:isPC?18:"24px 24px 0 0", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:isPC?"0 24px 70px rgba(0,0,0,.35)":"none" }}>

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

          {/* ═══ Báo giá chi tiết — GĐV chỉnh trực tiếp ═══ */}
          <div style={{ background:"#faf5ff", border:"2px solid #c4b5fd", borderRadius:14, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ fontWeight:800, fontSize:13, color:"#4c1d95", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16,color:"#7c3aed",verticalAlign:"middle"}}>build</span>
                {order.quote_by_name ? `Báo giá: ${order.quote_by_name}` : (order.status === "Chờ Báo Giá" && !deXuat.length ? "Báo giá linh kiện & phí dịch vụ" : "Dự toán KTV")}
              </div>
              <span style={{ fontWeight:900, color:"#7c3aed", fontSize:14 }}>{totalLines.toLocaleString("vi-VN")}đ</span>
            </div>

            {/* Tìm linh kiện trong kho */}
            <div style={{ fontSize:11, fontWeight:800, color:"#6d28d9", marginBottom:4 }}>1. LINH KIỆN (chọn từ kho, có giá bán + tồn)</div>
            <div style={{ position:"relative", marginBottom:6 }}>
              <span className="material-icons" style={{ fontFamily:"Material Icons", position:"absolute", left:12, top:10, fontSize:20, color:"#7c3aed", pointerEvents:"none" }}>search</span>
              <input value={partSearch} onChange={e => setPartSearch(e.target.value)}
                placeholder="Gõ tên / SKU linh kiện (vd: màn ip11, pin...)"
                style={{ width:"100%", height:42, borderRadius:10, border:"2px solid #a78bfa", paddingLeft:44, paddingRight:10, fontSize:13, outline:"none", boxSizing:"border-box", background:"#fff" }} />
            </div>
            {searching && <div style={{ fontSize:12, color:"#7c3aed", marginBottom:6 }}>Đang tìm...</div>}
            {!searching && partSearch.trim() && partRes.length === 0 && (
              <div style={{ fontSize:12, color:"#b45309", background:"#fffbeb", borderRadius:8, padding:"6px 10px", marginBottom:6 }}>Không thấy linh kiện "{partSearch.trim()}" trong kho — thử từ khóa khác.</div>
            )}
            {partRes.length > 0 && (
              <div style={{ maxHeight:180, overflowY:"auto", background:"#fff", borderRadius:10, border:"1.5px solid #ddd6fe", marginBottom:8 }}>
                {partRes.map(p => {
                  const stock = stockByPart[p.id] ?? (Number(p.stock_qty) || 0);
                  return (
                    <button key={p.id} onClick={() => addPart(p)}
                      style={{ width:"100%", padding:"8px 12px", background:"none", border:"none", borderBottom:"1px solid #f5f3ff", textAlign:"left", cursor:"pointer", display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ flex:1, minWidth:0, overflow:"hidden" }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#0c4a6e", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
                        {p.sku && <div style={{ fontSize:10, color:"#64748b" }}>SKU: {p.sku}</div>}
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontSize:11, fontWeight:800, color:"#0369a1" }}>{(p.price||0).toLocaleString("vi-VN")}đ</div>
                        <div style={{ fontSize:10, fontWeight:700, color: stock > 0 ? "#059669" : "#dc2626" }}>{stock > 0 ? `Tồn: ${stock}` : "Hết hàng"}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Phí dịch vụ */}
            <div style={{ fontSize:11, fontWeight:800, color:"#6d28d9", margin:"4px 0" }}>2. PHÍ DỊCH VỤ / CÔNG</div>
            <button onClick={() => setShowSvc(v => !v)}
              style={{ width:"100%", height:36, borderRadius:10, background:"#7c3aed", border:"none", color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:4, marginBottom:8 }}>
              <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:15,verticalAlign:"middle"}}>add</span> Thêm phí dịch vụ / công
            </button>
            {showSvc && (
              <div style={{ background:"#fff", border:"1.5px solid #a5f3fc", borderRadius:10, overflow:"hidden", marginBottom:8 }}>
                <input value={svcFilter} onChange={e => setSvcFilter(e.target.value)} autoFocus
                  placeholder="Tìm hoặc nhập phí dịch vụ..."
                  style={{ width:"100%", padding:"8px 10px", border:"none", borderBottom:"1px solid #e0f2fe", fontSize:12, outline:"none", boxSizing:"border-box" }} />
                <div style={{ maxHeight:150, overflowY:"auto" }}>
                  {SERVICE_FEES.filter(x => !svcFilter || x.toLowerCase().includes(svcFilter.toLowerCase())).map(x => (
                    <button key={x} onClick={() => addSvc(x)}
                      style={{ width:"100%", padding:"7px 12px", background:"none", border:"none", borderBottom:"1px solid #f8fafc", textAlign:"left", fontSize:12, color:"#155e75", cursor:"pointer" }}>+ {x}</button>
                  ))}
                  {svcFilter.trim() && !SERVICE_FEES.some(x => x.toLowerCase() === svcFilter.trim().toLowerCase()) && (
                    <button onClick={() => addSvc(svcFilter.trim())}
                      style={{ width:"100%", padding:"7px 12px", background:"#ecfeff", border:"none", textAlign:"left", fontSize:12, color:"#0891b2", cursor:"pointer", fontWeight:700 }}>+ Thêm "{svcFilter.trim()}"</button>
                  )}
                </div>
              </div>
            )}

            {/* Danh sách dòng báo giá */}
            {validLines.length === 0 ? (
              <div style={{ textAlign:"center", padding:"12px 8px", color:"#94a3b8", fontSize:12 }}>
                Chưa có dòng nào — tìm linh kiện trong kho ở ô trên, hoặc thêm phí dịch vụ / công.
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {validLines.map(l => {
                  const sub = (Number(l.price)||0) * (Number(l.qty)||1);
                  const stock = l.part_id ? (stockByPart[l.part_id] ?? 0) : null;
                  return (
                    <div key={l.key} style={{ background:l.waiting ? "#fff7ed" : "#fff", border:`1.5px solid ${l.waiting ? "#fdba74" : "#e2e8f0"}`, borderRadius:10, padding:"8px 10px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:800, color:"#1e293b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {l.is_service && <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:13,color:"#0891b2",verticalAlign:"middle"}}>handyman</span>} {l.name}
                          </div>
                          <div style={{ fontSize:10, color:"#64748b" }}>
                            {l.sku ? `SKU: ${l.sku}` : (l.is_service ? "Phí dịch vụ" : "")}
                            {stock !== null && <span style={{ fontWeight:700, color: stock > 0 ? "#059669" : "#dc2626", marginLeft:6 }}>{stock > 0 ? `Tồn: ${stock}` : "Hết hàng"}</span>}
                          </div>
                        </div>
                        <span style={{ fontSize:12, fontWeight:800, color:"#4c1d95", flexShrink:0 }}>{sub.toLocaleString("vi-VN")}đ</span>
                        <button onClick={() => rmLine(l.key)} style={{ width:26, height:26, borderRadius:8, border:"none", background:"#fee2e2", color:"#dc2626", cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:14,color:"#dc2626"}}>delete</span>
                        </button>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:isPC ? "58px 1fr auto" : "58px 1fr", gap:6, marginTop:6, alignItems:"center" }}>
                        <input type="number" min="1" value={l.qty} onChange={e => updLine(l.key, "qty", e.target.value)}
                          placeholder="SL" style={{ width:"100%", height:32, borderRadius:8, border:"1.5px solid #e2e8f0", padding:"0 8px", fontSize:12, boxSizing:"border-box", outline:"none" }} />
                        <input type="number" min="0" value={l.price} onChange={e => updLine(l.key, "price", e.target.value)}
                          placeholder={l.is_service ? "Phí dịch vụ (đ)" : "Giá bán (đ)"} style={{ width:"100%", height:32, borderRadius:8, border:"1.5px solid #e2e8f0", padding:"0 8px", fontSize:12, boxSizing:"border-box", outline:"none" }} />
                        {!l.is_service && (
                          <label style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:700, color:l.waiting ? "#c2410c" : "#64748b", cursor:"pointer", whiteSpace:"nowrap" }}>
                            <input type="checkbox" checked={l.waiting} onChange={e => updLine(l.key, "waiting", e.target.checked)}
                              style={{ width:15, height:15, accentColor:"#ea580c", cursor:"pointer" }} />
                            Chờ nhập
                          </label>
                        )}
                      </div>
                      {l.waiting && !l.is_service && (
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:6, background:"#ffedd5", borderRadius:8, padding:6 }}>
                          <div>
                            <div style={{ fontSize:10, fontWeight:800, color:"#9a3412", marginBottom:2 }}>Dự kiến hàng về</div>
                            <input type="date" value={l.expected_date} onChange={e => updLine(l.key, "expected_date", e.target.value)}
                              style={{ width:"100%", height:30, borderRadius:8, border:"1.5px solid #fed7aa", padding:"0 6px", fontSize:11, boxSizing:"border-box", outline:"none" }} />
                          </div>
                          <div>
                            <div style={{ fontSize:10, fontWeight:800, color:"#9a3412", marginBottom:2 }}>Hạn đặt NCC</div>
                            <input type="date" value={l.po_due_date} onChange={e => updLine(l.key, "po_due_date", e.target.value)}
                              style={{ width:"100%", height:30, borderRadius:8, border:"1.5px solid #fed7aa", padding:"0 6px", fontSize:11, boxSizing:"border-box", outline:"none" }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{ padding:"6px 4px", textAlign:"right" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"#6d28d9" }}>Tổng dòng: {totalLines.toLocaleString("vi-VN")}đ</span>
                  {hasWaiting && <span style={{ fontSize:12, fontWeight:700, color:"#ea580c" }}> · có LK chờ nhập</span>}
                </div>
              </div>
            )}
          </div>

          {/* ═══ Tổng chi phí (tự động) ═══ */}
          <div style={{ background:"#fff7ed", border:"2px solid #fed7aa", borderRadius:14, padding:"14px", marginBottom:12 }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#9a3412", marginBottom:12, display:"flex", alignItems:"center", gap:6 }}>
              <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,color:"#ea580c",verticalAlign:"middle"}}>receipt_long</span>
              Tổng Chi Phí Sửa Chữa
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:10 }}>
              <span style={{ fontSize:13, fontWeight:700, color:"#92400e" }}>Tổng linh kiện + dịch vụ</span>
              <span style={{ fontSize:14, fontWeight:800, color:"#9a3412" }}>{totalLines.toLocaleString("vi-VN")}đ</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:10, background:"#fef3c7", borderRadius:10, padding:"8px 12px" }}>
              <label style={{ fontSize:13, fontWeight:700, color:"#92400e", flexShrink:0 }}>Giảm giá</label>
              <input
                value={giamGia}
                onChange={e => setGiamGia(e.target.value)}
                type="number" inputMode="numeric" min="0" max={totalLines}
                placeholder="0"
                style={{ width:130, borderRadius:10, border:"1.5px solid #fde68a", padding:"6px 10px", fontSize:14, fontWeight:700, boxSizing:"border-box", outline:"none", textAlign:"right", color:"#92400e" }} />
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, background:"#ffedd5", borderRadius:10, padding:"10px 14px", border:"1.5px solid #fdba74" }}>
              <span style={{ fontSize:13, fontWeight:800, color:"#9a3412" }}>THÀNH TIỀN KHÁCH TRẢ</span>
              <span style={{ fontSize:18, fontWeight:900, color:"#c2410c" }}>{finalTotal.toLocaleString("vi-VN")}đ</span>
            </div>
            <div style={{ fontSize:11, color:"#b45309", marginTop:8, fontStyle:"italic" }}>
              Khách trả tiền tại quầy thu ngân sau khi sửa xong (như bán hàng).
            </div>
          </div>

          {/* Chọn KTV sửa máy — chỉ hiện khi đơn chưa có KTV (tạo bằng "Báo Giá Ngay") */}
          {needKtv && !mode && (
            <div style={{ background:"#f5f3ff", border:"2px solid #ddd6fe", borderRadius:14, padding:12, marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:900, color:"#4c1d95", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                <MI name="engineering" style={{ fontSize:18, color:"#7c3aed" }} />
                KTV phụ trách sửa máy
              </div>
              <select value={selKtv} onChange={e => setSelKtv(e.target.value)}
                style={{ width:"100%", height:46, borderRadius:12, border:`2px solid ${selKtv ? "#7c3aed" : "#e5e7eb"}`, padding:"0 12px", fontSize:15, fontWeight:600, color: selKtv ? "#4c1d95" : "#6b7280", background:"#fff", outline:"none", cursor:"pointer", boxSizing:"border-box" }}>
                <option value="">-- Chọn KTV --</option>
                {ktvList.map(u => <option key={u.id} value={u.id}>🔧 {u.name || u.full_name}</option>)}
              </select>
              <div style={{ fontSize:11, color:"#7c3aed", marginTop:6, fontStyle:"italic" }}>
                Chọn trước khi khách đồng ý. Đơn có hàng chờ nhập thì chọn KTV sau khi hàng về.
              </div>
            </div>
          )}

          {/* Lưu tạm — để khách suy nghĩ, chỉnh lại sau */}
          {!mode && onSaveDraft && (
            <div style={{ marginBottom:12 }}>
              <button onClick={handleSaveDraft} disabled={saving}
                style={{ width:"100%", height:48, borderRadius:14, background:"#fffbeb", border:"2px solid #f59e0b", color:"#b45309", fontWeight:900, fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <MI name="bookmark" style={{ fontSize:22, color:"#d97706" }} />
                {saving ? "Đang lưu..." : "Lưu Tạm — Khách Suy Nghĩ"}
              </button>
              <div style={{ fontSize:11, color:"#92400e", textAlign:"center", marginTop:5 }}>Đơn vẫn ở "Chờ Báo Giá", mở lại để chỉnh sửa tiếp.</div>
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
              {validLines.length > 0 && (
                <div style={{ background:"#dcfce7", border:"1px solid #86efac", borderRadius:10, padding:"10px 12px", marginBottom:10 }}>
                  <div style={{ fontSize:12, color:"#166534" }}>💰 Thành tiền: <b style={{ fontSize:14 }}>{finalTotal.toLocaleString("vi-VN")}đ</b>
                    {giamGiaNum > 0 && <span> · Giảm giá: <b>{giamGiaNum.toLocaleString("vi-VN")}đ</b></span>}
                    {hasWaiting && <div style={{ fontSize:12, color:"#c2410c", marginTop:4, fontWeight:700 }}>Có linh kiện chờ nhập — đơn sẽ vào hàng chờ "Chờ Linh Kiện".</div>}
                  </div>
                </div>
              )}
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