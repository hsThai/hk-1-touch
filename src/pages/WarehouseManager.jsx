/**
 * WarehouseManager.jsx
 * Quản lý kho đa điểm — Kho / Zone / Kệ / Tồn kho / Nhập / Xuất / Chuyển / Kiểm kho
 */
import React, { useState, useEffect, useCallback } from "react";
import { getPbUrl, getAuth } from "./pb.jsx";
import StockCountPage from "./StockCountPage.jsx";

// ─── PocketBase helpers ───────────────────────────────────
function makeWHCol(colName) {
  async function pbFetch(path, options = {}) {
    const base = getPbUrl();
    const { token } = getAuth();
    const url = `${base}/api/${path}`;
    const headers = { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}), ...(options.headers || {}) };
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) { let d = {}; try { d = await res.json(); } catch {} throw new Error(d.message || `HTTP ${res.status}`); }
    if (res.status === 204) return null;
    return res.json();
  }
  return {
    list:   (p={})   => pbFetch(`collections/${colName}/records?perPage=500&${new URLSearchParams(p)}`).then(r=>r.items||[]),
    filter: (f,p={}) => pbFetch(`collections/${colName}/records?perPage=500&filter=${encodeURIComponent(f)}&${new URLSearchParams(p)}`).then(r=>r.items||[]),
    create: (d)      => pbFetch(`collections/${colName}/records`, { method:"POST", body:JSON.stringify(d) }),
    update: (id,d)   => pbFetch(`collections/${colName}/records/${id}`, { method:"PATCH", body:JSON.stringify(d) }),
    delete: (id)     => pbFetch(`collections/${colName}/records/${id}`, { method:"DELETE" }),
    get:    (id)     => pbFetch(`collections/${colName}/records/${id}`),
  };
}

const WH    = makeWHCol("warehouses");
const Zone  = makeWHCol("warehouse_zones");
const Loc   = makeWHCol("warehouse_locations");
const Ledger= makeWHCol("stock_ledgers");
const Move  = makeWHCol("stock_movements");
const Trans = makeWHCol("stock_transfers");
const Parts = makeWHCol("spare_parts");
const Count = makeWHCol("stock_counts");
const CountItem = makeWHCol("stock_count_items");

// ─── Styles ───────────────────────────────────────────────
const S = {
  page:    { minHeight:"100vh", background:"#f8fafc", fontFamily:"system-ui,sans-serif" },
  hdr:     { background:"linear-gradient(135deg,#1e1b4b,#4f46e5)", color:"#fff", padding:"16px 20px", display:"flex", alignItems:"center", gap:12 },
  hdrTitle:{ fontWeight:800, fontSize:20 },
  hdrSub:  { fontSize:12, color:"#c7d2fe", marginTop:2 },
  tabs:    { display:"flex", gap:0, background:"#fff", borderBottom:"2px solid #e5e7eb", overflowX:"auto" },
  tab:     (a)=>({ padding:"12px 18px", fontWeight:600, fontSize:13, cursor:"pointer", whiteSpace:"nowrap",
    borderBottom: a?"3px solid #4f46e5":"3px solid transparent",
    color: a?"#4f46e5":"#6b7280", background:"none", border:"none", borderBottom: a?"3px solid #4f46e5":"3px solid transparent" }),
  body:    { padding:"16px 12px", maxWidth:1100, margin:"0 auto" },
  card:    { background:"#fff", borderRadius:12, border:"1px solid #e5e7eb", marginBottom:12, overflow:"hidden" },
  cardHdr: { padding:"12px 16px", background:"#f9fafb", borderBottom:"1px solid #e5e7eb", display:"flex", alignItems:"center", justifyContent:"space-between" },
  cardTitle:{ fontWeight:700, fontSize:14, color:"#1e1b4b" },
  row:     { display:"flex", gap:8, flexWrap:"wrap" },
  col:     (n=1)=>({ flex:n, minWidth:120 }),
  label:   { fontSize:11, color:"#6b7280", fontWeight:600, marginBottom:4, display:"block" },
  input:   { width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #d1d5db", fontSize:13, outline:"none", boxSizing:"border-box" },
  select:  { width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #d1d5db", fontSize:13, background:"#fff", boxSizing:"border-box" },
  btn:     (c="#4f46e5")=>({ padding:"9px 16px", background:c, color:"#fff", border:"none", borderRadius:8, fontWeight:600, fontSize:13, cursor:"pointer", whiteSpace:"nowrap" }),
  btnSm:   (c="#4f46e5")=>({ padding:"5px 10px", background:c, color:"#fff", border:"none", borderRadius:6, fontWeight:600, fontSize:11, cursor:"pointer" }),
  btnGhost:(c="#4f46e5")=>({ padding:"7px 14px", background:"transparent", color:c, border:`1.5px solid ${c}`, borderRadius:8, fontWeight:600, fontSize:13, cursor:"pointer" }),
  table:   { width:"100%", borderCollapse:"collapse", fontSize:13 },
  th:      { padding:"10px 12px", background:"#f3f4f6", color:"#374151", fontWeight:700, textAlign:"left", borderBottom:"2px solid #e5e7eb" },
  td:      { padding:"10px 12px", borderBottom:"1px solid #f3f4f6", color:"#374151", verticalAlign:"middle" },
  badge:   (c)=>({ display:"inline-block", padding:"2px 8px", borderRadius:99, fontSize:11, fontWeight:700, background:c+"22", color:c }),
  modal:   { position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:16 },
  modalBox:{ background:"#fff", borderRadius:16, padding:24, width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto" },
  empty:   { padding:40, textAlign:"center", color:"#9ca3af" },
};

function genCode(prefix) {
  const d = new Date();
  const ts = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  return `${prefix}-${ts}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
}

// ─── Toast ────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type="success") => {
    const id = Math.random();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);
  const ToastContainer = () => (
    <div style={{ position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)", zIndex:99999, display:"flex", flexDirection:"column", gap:8, alignItems:"center" }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: t.type==="error"?"#fee2e2":t.type==="warn"?"#fffbeb":"#dcfce7", color:t.type==="error"?"#dc2626":t.type==="warn"?"#d97706":"#166534", padding:"10px 20px", borderRadius:99, fontWeight:600, fontSize:13, boxShadow:"0 4px 12px rgba(0,0,0,.15)", whiteSpace:"nowrap" }}>
          {t.type==="success"?"✅ ":t.type==="error"?"❌ ":"⚠️ "}{t.msg}
        </div>
      ))}
    </div>
  );
  return { show, ToastContainer };
}

// ─── Modal wrapper ────────────────────────────────────────
function Modal({ title, onClose, children, width=520 }) {
  return (
    <div style={S.modal} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ ...S.modalBox, maxWidth:width }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ fontWeight:800, fontSize:16, color:"#1e1b4b" }}>{title}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#6b7280" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div style={{ marginBottom:12 }}><label style={S.label}>{label}</label>{children}</div>;
}

// ═══════════════════════════════════════════════════════════
// TAB 1 — DANH SÁCH KHO
// ═══════════════════════════════════════════════════════════
function WarehouseTab({ user, toast }) {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | "create" | "edit"
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:"", code:"", address:"", phone:"", note:"" });

  const load = useCallback(async () => {
    setLoading(true);
    try { setWarehouses(await WH.list()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm({ name:"", code:"", address:"", phone:"", note:"" }); setEditing(null); setModal("form"); }
  function openEdit(w) { setForm({ name:w.name||"", code:w.code||"", address:w.address||"", phone:w.phone||"", note:w.note||"" }); setEditing(w); setModal("form"); }

  async function save() {
    if (!form.name.trim()) return toast.show("Vui lòng nhập tên kho","error");
    const code = form.code.trim() || form.name.trim().toUpperCase().replace(/\s+/g,"-");
    const data = { ...form, code, is_active:true };
    try {
      if (editing) { await WH.update(editing.id, data); toast.show("Đã cập nhật kho"); }
      else { await WH.create(data); toast.show("Đã tạo kho mới"); }
      setModal(null); load();
    } catch(e) { toast.show(e.message,"error"); }
  }

  async function toggleActive(w) {
    try { await WH.update(w.id, { is_active: !w.is_active }); load(); } catch(e) { toast.show(e.message,"error"); }
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:16, color:"#1e1b4b" }}>🏭 Danh sách kho</div>
        <button style={S.btn()} onClick={openCreate}>+ Thêm kho</button>
      </div>

      {loading ? <div style={S.empty}>⏳ Đang tải...</div> :
        warehouses.length === 0 ? (
          <div style={{ ...S.card, ...S.empty }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🏭</div>
            <div style={{ fontWeight:700, color:"#374151", marginBottom:8 }}>Chưa có kho nào</div>
            <div style={{ fontSize:13, marginBottom:16 }}>Tạo kho đầu tiên để bắt đầu quản lý</div>
            <button style={S.btn()} onClick={openCreate}>+ Tạo kho mới</button>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
            {warehouses.map(w => (
              <div key={w.id} style={{ ...S.card, opacity: w.is_active?1:0.6 }}>
                <div style={{ padding:"16px 16px 12px" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ fontWeight:800, fontSize:16, color:"#1e1b4b" }}>🏭 {w.name}</div>
                    <span style={S.badge(w.is_active?"#059669":"#6b7280")}>{w.is_active?"Hoạt động":"Tắt"}</span>
                  </div>
                  <div style={{ fontSize:12, color:"#6b7280", marginBottom:4 }}>📍 {w.address || "—"}</div>
                  <div style={{ fontSize:12, color:"#6b7280", marginBottom:4 }}>🔖 Mã: <b>{w.code}</b></div>
                  {w.phone && <div style={{ fontSize:12, color:"#6b7280" }}>📞 {w.phone}</div>}
                </div>
                <div style={{ padding:"10px 16px", borderTop:"1px solid #f3f4f6", display:"flex", gap:8 }}>
                  <button style={S.btnSm()} onClick={()=>openEdit(w)}>✏️ Sửa</button>
                  <button style={S.btnSm(w.is_active?"#dc2626":"#059669")} onClick={()=>toggleActive(w)}>
                    {w.is_active?"🔴 Tắt":"🟢 Bật"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {modal==="form" && (
        <Modal title={editing?"Sửa kho":"Thêm kho mới"} onClose={()=>setModal(null)}>
          <Field label="Tên kho *"><input style={S.input} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="VD: Kho 1, Kho HCM..." /></Field>
          <Field label="Mã kho (tự sinh nếu để trống)"><input style={S.input} value={form.code} onChange={e=>setForm(p=>({...p,code:e.target.value}))} placeholder="VD: KHO1" /></Field>
          <Field label="Địa chỉ"><input style={S.input} value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))} placeholder="Địa chỉ kho..." /></Field>
          <Field label="Số điện thoại"><input style={S.input} value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="0900..." /></Field>
          <Field label="Ghi chú"><textarea style={{...S.input,height:60,resize:"none"}} value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} /></Field>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <button style={S.btnGhost()} onClick={()=>setModal(null)}>Hủy</button>
            <button style={S.btn()} onClick={save}>💾 Lưu</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 2 — ZONE & KỆ (cây phân cấp)
// ═══════════════════════════════════════════════════════════
function ZoneLocationTab({ user, toast }) {
  const [warehouses, setWarehouses] = useState([]);
  const [selWH, setSelWH] = useState("");
  const [zones, setZones] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [editObj, setEditObj] = useState(null);
  const [form, setForm] = useState({});
  const [expandedZone, setExpandedZone] = useState(null);

  useEffect(() => { WH.list().then(r=>{ setWarehouses(r); if(r.length) setSelWH(r[0].id); }); }, []);

  useEffect(() => {
    if (!selWH) return;
    setLoading(true);
    Promise.all([
      Zone.filter(`warehouse_id='${selWH}'`),
      Loc.filter(`warehouse_id='${selWH}'`),
    ]).then(([z,l]) => { setZones(z); setLocations(l); }).finally(()=>setLoading(false));
  }, [selWH]);

  const wh = warehouses.find(w=>w.id===selWH);

  function openZoneCreate() { setForm({ name:"", code:"", description:"" }); setEditObj(null); setModal("zone"); }
  function openZoneEdit(z) { setForm({ name:z.name||"", code:z.code||"", description:z.description||"" }); setEditObj(z); setModal("zone"); }
  function openLocCreate(zone) { setForm({ zone_id:zone.id, zone_name:zone.name, row:"", column:"", level:"", capacity:"", note:"" }); setEditObj(null); setModal("location"); }
  function openLocEdit(l) { setForm({ zone_id:l.zone_id||"", zone_name:l.zone_name||"", row:l.row||"", column:l.column||"", level:l.level||"", capacity:l.capacity||"", note:l.note||"" }); setEditObj(l); setModal("location"); }

  function buildLocCode(f) {
    const z = zones.find(z=>z.id===f.zone_id);
    const zCode = z?.code || "Z";
    return `${zCode}-${f.row||"0"}-${f.column||"0"}-${f.level||"0"}`;
  }

  async function saveZone() {
    if (!form.name.trim()) return toast.show("Nhập tên khu vực","error");
    const code = form.code.trim() || form.name.replace(/\s+/g,"").toUpperCase().slice(0,4);
    const data = { warehouse_id:selWH, warehouse_name:wh?.name||"", name:form.name, code, description:form.description||"", is_active:true };
    try {
      if (editObj) { await Zone.update(editObj.id, data); toast.show("Đã cập nhật khu vực"); }
      else { await Zone.create(data); toast.show("Đã tạo khu vực"); }
      setModal(null);
      Zone.filter(`warehouse_id='${selWH}'`).then(setZones);
    } catch(e) { toast.show(e.message,"error"); }
  }

  async function saveLoc() {
    if (!form.zone_id) return toast.show("Chọn khu vực","error");
    if (!form.row || !form.column || !form.level) return toast.show("Nhập đủ Hàng / Cột / Tầng","error");
    const code = buildLocCode(form);
    const data = {
      warehouse_id: selWH, warehouse_name: wh?.name||"",
      zone_id: form.zone_id, zone_name: form.zone_name||"",
      code, name: code,
      row: form.row, column: form.column, level: form.level,
      capacity: Number(form.capacity)||0, note: form.note||"", is_active:true,
    };
    try {
      if (editObj) { await Loc.update(editObj.id, data); toast.show("Đã cập nhật vị trí"); }
      else { await Loc.create(data); toast.show("Đã tạo vị trí kệ"); }
      setModal(null);
      Loc.filter(`warehouse_id='${selWH}'`).then(setLocations);
    } catch(e) { toast.show(e.message,"error"); }
  }

  async function deleteZone(z) {
    const hasLoc = locations.some(l=>l.zone_id===z.id);
    if (hasLoc) return toast.show("Xóa hết vị trí trong khu vực trước","warn");
    if (!confirm(`Xóa khu vực "${z.name}"?`)) return;
    try { await Zone.delete(z.id); toast.show("Đã xóa"); Zone.filter(`warehouse_id='${selWH}'`).then(setZones); } catch(e){ toast.show(e.message,"error"); }
  }

  async function deleteLoc(l) {
    if (!confirm(`Xóa vị trí "${l.code}"?`)) return;
    try { await Loc.delete(l.id); toast.show("Đã xóa"); Loc.filter(`warehouse_id='${selWH}'`).then(setLocations); } catch(e){ toast.show(e.message,"error"); }
  }

  return (
    <div>
      {/* Chọn kho */}
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ fontWeight:700, color:"#1e1b4b" }}>🏭 Kho:</div>
        {warehouses.map(w=>(
          <button key={w.id} onClick={()=>setSelWH(w.id)}
            style={{ padding:"7px 14px", borderRadius:8, border:"2px solid", fontWeight:600, fontSize:13, cursor:"pointer",
              borderColor:selWH===w.id?"#4f46e5":"#e5e7eb",
              background:selWH===w.id?"#ede9fe":"#fff",
              color:selWH===w.id?"#4f46e5":"#374151" }}>
            {w.name}
          </button>
        ))}
        {warehouses.length===0 && <span style={{color:"#9ca3af",fontSize:13}}>Chưa có kho — tạo kho ở tab trước</span>}
      </div>

      {selWH && (
        <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontWeight:700, fontSize:15, color:"#1e1b4b" }}>Khu vực & Kệ — {wh?.name}</div>
            <button style={S.btn()} onClick={openZoneCreate}>+ Thêm khu vực</button>
          </div>

          {loading ? <div style={S.empty}>⏳ Đang tải...</div> :
            zones.length===0 ? (
              <div style={{ ...S.card, padding:32, textAlign:"center" }}>
                <div style={{ fontSize:40, marginBottom:8 }}>📦</div>
                <div style={{ fontWeight:700, marginBottom:8 }}>Chưa có khu vực nào</div>
                <button style={S.btn()} onClick={openZoneCreate}>+ Tạo khu vực đầu tiên</button>
              </div>
            ) : (
              zones.map(z => {
                const locs = locations.filter(l=>l.zone_id===z.id);
                const expanded = expandedZone===z.id;
                return (
                  <div key={z.id} style={S.card}>
                    <div style={{ ...S.cardHdr, cursor:"pointer" }} onClick={()=>setExpandedZone(expanded?null:z.id)}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontSize:18 }}>{expanded?"▼":"▶"}</span>
                        <div>
                          <div style={S.cardTitle}>📦 {z.name} <span style={{ fontWeight:400, color:"#9ca3af", fontSize:12 }}>({z.code})</span></div>
                          <div style={{ fontSize:12, color:"#6b7280" }}>{locs.length} vị trí kệ</div>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:6 }} onClick={e=>e.stopPropagation()}>
                        <button style={S.btnSm()} onClick={()=>openLocCreate(z)}>+ Thêm kệ</button>
                        <button style={S.btnSm("#6b7280")} onClick={()=>openZoneEdit(z)}>✏️</button>
                        <button style={S.btnSm("#dc2626")} onClick={()=>deleteZone(z)}>🗑️</button>
                      </div>
                    </div>
                    {expanded && (
                      <div style={{ padding:"12px 16px" }}>
                        {locs.length===0 ? (
                          <div style={{ textAlign:"center", color:"#9ca3af", padding:20, fontSize:13 }}>
                            Chưa có kệ — <button style={{ color:"#4f46e5", background:"none", border:"none", cursor:"pointer", fontWeight:600 }} onClick={()=>openLocCreate(z)}>+ Thêm kệ</button>
                          </div>
                        ) : (
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:8 }}>
                            {locs.map(l=>(
                              <div key={l.id} style={{ background:"#f8fafc", border:"1px solid #e5e7eb", borderRadius:8, padding:"10px 12px" }}>
                                <div style={{ fontWeight:700, fontSize:13, color:"#1e1b4b", marginBottom:4 }}>🗄️ {l.code}</div>
                                <div style={{ fontSize:11, color:"#6b7280" }}>Hàng: {l.row} | Cột: {l.column} | Tầng: {l.level}</div>
                                {l.capacity>0 && <div style={{ fontSize:11, color:"#6b7280" }}>Sức chứa: {l.capacity}</div>}
                                <div style={{ display:"flex", gap:4, marginTop:8 }}>
                                  <button style={S.btnSm()} onClick={()=>openLocEdit(l)}>✏️</button>
                                  <button style={S.btnSm("#dc2626")} onClick={()=>deleteLoc(l)}>🗑️</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )
          }
        </>
      )}

      {/* Modal Zone */}
      {modal==="zone" && (
        <Modal title={editObj?"Sửa khu vực":"Thêm khu vực"} onClose={()=>setModal(null)}>
          <Field label="Tên khu vực *"><input style={S.input} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="VD: Khu A, Kệ Chính, Zone Linh Kiện..." /></Field>
          <Field label="Mã (tự sinh nếu để trống)"><input style={S.input} value={form.code} onChange={e=>setForm(p=>({...p,code:e.target.value.toUpperCase()}))} placeholder="VD: A, B, KLC..." /></Field>
          <Field label="Mô tả"><input style={S.input} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} /></Field>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <button style={S.btnGhost()} onClick={()=>setModal(null)}>Hủy</button>
            <button style={S.btn()} onClick={saveZone}>💾 Lưu</button>
          </div>
        </Modal>
      )}

      {/* Modal Location */}
      {modal==="location" && (
        <Modal title={editObj?"Sửa vị trí kệ":"Thêm vị trí kệ"} onClose={()=>setModal(null)}>
          <Field label="Khu vực *">
            <select style={S.select} value={form.zone_id} onChange={e=>{
              const z=zones.find(z=>z.id===e.target.value);
              setForm(p=>({...p,zone_id:e.target.value,zone_name:z?.name||""}));
            }}>
              <option value="">-- Chọn khu vực --</option>
              {zones.map(z=><option key={z.id} value={z.id}>{z.name} ({z.code})</option>)}
            </select>
          </Field>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            <Field label="Hàng (Row) *"><input style={S.input} value={form.row} onChange={e=>setForm(p=>({...p,row:e.target.value}))} placeholder="01,02..." /></Field>
            <Field label="Cột (Col) *"><input style={S.input} value={form.column} onChange={e=>setForm(p=>({...p,column:e.target.value}))} placeholder="01,02..." /></Field>
            <Field label="Tầng (Level) *"><input style={S.input} value={form.level} onChange={e=>setForm(p=>({...p,level:e.target.value}))} placeholder="01,02..." /></Field>
          </div>
          {form.zone_id && form.row && form.column && form.level && (
            <div style={{ background:"#ede9fe", borderRadius:8, padding:"8px 12px", marginBottom:12, fontSize:13, fontWeight:700, color:"#4f46e5" }}>
              📍 Mã vị trí: {buildLocCode(form)}
            </div>
          )}
          <Field label="Sức chứa (bỏ trống = không giới hạn)"><input style={S.input} type="number" value={form.capacity} onChange={e=>setForm(p=>({...p,capacity:e.target.value}))} /></Field>
          <Field label="Ghi chú"><input style={S.input} value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} /></Field>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <button style={S.btnGhost()} onClick={()=>setModal(null)}>Hủy</button>
            <button style={S.btn()} onClick={saveLoc}>💾 Lưu</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 3 — TỒN KHO (Stock Ledger)
// ═══════════════════════════════════════════════════════════
function StockLedgerTab({ user, toast }) {
  const [warehouses, setWarehouses] = useState([]);
  const [selWH, setSelWH] = useState("");
  const [ledger, setLedger] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("ledger"); // ledger | movements
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjForm, setAdjForm] = useState({ qty:"", note:"" });

  useEffect(() => { WH.list().then(r=>{ setWarehouses(r); if(r.length) setSelWH(r[0].id); }); }, []);

  useEffect(() => {
    if (!selWH) return;
    setLoading(true);
    Promise.all([
      Ledger.filter(`warehouse_id='${selWH}'`),
      Move.filter(`warehouse_id='${selWH}'`),
    ]).then(([l,m]) => { setLedger(l); setMovements(m); }).finally(()=>setLoading(false));
  }, [selWH]);

  const wh = warehouses.find(w=>w.id===selWH);
  const filteredLedger = ledger.filter(l =>
    !search || l.part_name?.toLowerCase().includes(search.toLowerCase()) || l.sku?.toLowerCase().includes(search.toLowerCase()) || l.location_code?.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = filteredLedger.reduce((s,l)=>(s + (l.qty_on_hand||0)*(l.cost_price||0)),0);
  const lowStock = filteredLedger.filter(l=>l.min_qty>0 && l.qty_available<=l.min_qty).length;

  async function saveAdjust() {
    if (!adjForm.qty || isNaN(adjForm.qty)) return toast.show("Nhập số lượng thực tế","error");
    const l = adjustModal;
    const qty_actual = Number(adjForm.qty);
    const diff = qty_actual - l.qty_on_hand;
    try {
      await Ledger.update(l.id, { qty_on_hand: qty_actual, qty_available: Math.max(0, qty_actual - (l.qty_reserved||0)) });
      await Move.create({
        movement_code: genCode("MV"),
        movement_type: "adjust",
        warehouse_id: l.warehouse_id, warehouse_name: l.warehouse_name,
        location_id: l.location_id, location_code: l.location_code,
        part_id: l.part_id, part_name: l.part_name, sku: l.sku,
        qty_before: l.qty_on_hand, qty_change: diff, qty_after: qty_actual,
        note: adjForm.note || "Điều chỉnh thủ công",
        created_by_id: user?.id||"", created_by_name: user?.name||"",
      });
      toast.show("Đã điều chỉnh tồn kho");
      setAdjustModal(null);
      Ledger.filter(`warehouse_id='${selWH}'`).then(setLedger);
    } catch(e) { toast.show(e.message,"error"); }
  }

  const moveTypeLabel = { import:"📥 Nhập", export:"📤 Xuất", transfer_out:"🔄 Xuất chuyển", transfer_in:"🔄 Nhận chuyển", adjust:"⚖️ Điều chỉnh", count_adjust:"📋 Kiểm kho", borrow:"🤝 Mượn", return:"↩️ Hoàn trả" };

  return (
    <div>
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:12, flexWrap:"wrap" }}>
        <div style={{ fontWeight:700, color:"#1e1b4b" }}>🏭 Kho:</div>
        {warehouses.map(w=>(
          <button key={w.id} onClick={()=>setSelWH(w.id)}
            style={{ padding:"7px 14px", borderRadius:8, border:"2px solid", fontWeight:600, fontSize:13, cursor:"pointer",
              borderColor:selWH===w.id?"#4f46e5":"#e5e7eb",
              background:selWH===w.id?"#ede9fe":"#fff",
              color:selWH===w.id?"#4f46e5":"#374151" }}>
            {w.name}
          </button>
        ))}
      </div>

      {/* View toggle */}
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <button style={viewMode==="ledger"?S.btn():S.btnGhost()} onClick={()=>setViewMode("ledger")}>📊 Tồn kho</button>
        <button style={viewMode==="movements"?S.btn():S.btnGhost()} onClick={()=>setViewMode("movements")}>📜 Lịch sử biến động</button>
      </div>

      {/* Stats */}
      {viewMode==="ledger" && selWH && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10, marginBottom:16 }}>
          {[
            { label:"Tổng SKU", value:filteredLedger.length, color:"#4f46e5", icon:"📦" },
            { label:"Tổng giá trị", value:`${(totalValue/1e6).toFixed(1)}M`, color:"#059669", icon:"💰" },
            { label:"Sắp hết hàng", value:lowStock, color:lowStock>0?"#dc2626":"#059669", icon:"⚠️" },
          ].map(s=>(
            <div key={s.label} style={{ background:"#fff", borderRadius:10, border:`1.5px solid ${s.color}22`, padding:"12px 14px" }}>
              <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
              <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:11, color:"#6b7280" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      {viewMode==="ledger" && (
        <div style={{ marginBottom:12 }}>
          <input style={S.input} placeholder="🔍 Tìm linh kiện, SKU, vị trí kệ..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      )}

      {loading ? <div style={S.empty}>⏳ Đang tải...</div> : (
        <>
          {viewMode==="ledger" && (
            <div style={S.card}>
              <div style={{ overflowX:"auto" }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      {["Linh kiện","SKU","Vị trí","Tồn kho","Đặt sẵn","Khả dụng","Giá vốn","Tổng giá trị","Ngưỡng tối thiểu",""].map(h=>(
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.length===0 ? (
                      <tr><td colSpan={10} style={{ ...S.td, textAlign:"center", color:"#9ca3af", padding:32 }}>Chưa có dữ liệu tồn kho</td></tr>
                    ) : filteredLedger.map(l => {
                      const isLow = l.min_qty>0 && l.qty_available<=l.min_qty;
                      return (
                        <tr key={l.id} style={{ background:isLow?"#fff7ed":"#fff" }}>
                          <td style={S.td}><div style={{ fontWeight:600 }}>{l.part_name}</div>{isLow&&<span style={{ fontSize:10, color:"#dc2626" }}>⚠️ Sắp hết</span>}</td>
                          <td style={S.td}><code style={{ fontSize:11, background:"#f3f4f6", padding:"2px 6px", borderRadius:4 }}>{l.sku||"—"}</code></td>
                          <td style={S.td}><span style={S.badge("#4f46e5")}>{l.location_code||"—"}</span></td>
                          <td style={S.td}><b>{l.qty_on_hand||0}</b></td>
                          <td style={S.td}>{l.qty_reserved||0}</td>
                          <td style={S.td}><b style={{ color:isLow?"#dc2626":"#059669" }}>{l.qty_available||0}</b></td>
                          <td style={S.td}>{(l.cost_price||0).toLocaleString("vi")}</td>
                          <td style={S.td}>{((l.qty_on_hand||0)*(l.cost_price||0)).toLocaleString("vi")}</td>
                          <td style={S.td}>{l.min_qty||0}</td>
                          <td style={S.td}><button style={S.btnSm("#6b7280")} onClick={()=>{ setAdjustModal(l); setAdjForm({qty:String(l.qty_on_hand||0),note:""}); }}>⚖️ Điều chỉnh</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewMode==="movements" && (
            <div style={S.card}>
              <div style={{ overflowX:"auto" }}>
                <table style={S.table}>
                  <thead>
                    <tr>{["Mã","Loại","Linh kiện","Vị trí","Trước","Thay đổi","Sau","Ghi chú","Người tạo","Thời gian"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {movements.length===0 ? (
                      <tr><td colSpan={10} style={{ ...S.td, textAlign:"center", color:"#9ca3af", padding:32 }}>Chưa có biến động</td></tr>
                    ) : movements.map(m=>(
                      <tr key={m.id}>
                        <td style={S.td}><code style={{ fontSize:10 }}>{m.movement_code}</code></td>
                        <td style={S.td}>{moveTypeLabel[m.movement_type]||m.movement_type}</td>
                        <td style={S.td}>{m.part_name}</td>
                        <td style={S.td}><span style={S.badge("#4f46e5")}>{m.location_code||"—"}</span></td>
                        <td style={S.td}>{m.qty_before}</td>
                        <td style={S.td}><b style={{ color:m.qty_change>0?"#059669":"#dc2626" }}>{m.qty_change>0?"+":""}{m.qty_change}</b></td>
                        <td style={S.td}><b>{m.qty_after}</b></td>
                        <td style={S.td}>{m.note}</td>
                        <td style={S.td}>{m.created_by_name}</td>
                        <td style={S.td}>{new Date(m.created||m.created_date).toLocaleString("vi")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {adjustModal && (
        <Modal title={`⚖️ Điều chỉnh tồn — ${adjustModal.part_name}`} onClose={()=>setAdjustModal(null)}>
          <div style={{ background:"#f3f4f6", borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:13 }}>
            <b>Vị trí:</b> {adjustModal.location_code||"—"} | <b>Tồn hệ thống:</b> {adjustModal.qty_on_hand||0}
          </div>
          <Field label="Số lượng thực tế *"><input style={S.input} type="number" value={adjForm.qty} onChange={e=>setAdjForm(p=>({...p,qty:e.target.value}))} /></Field>
          {adjForm.qty !== "" && !isNaN(adjForm.qty) && (
            <div style={{ background: Number(adjForm.qty)>=(adjustModal.qty_on_hand||0)?"#dcfce7":"#fee2e2", borderRadius:8, padding:"8px 12px", marginBottom:12, fontSize:13, fontWeight:700, color:Number(adjForm.qty)>=(adjustModal.qty_on_hand||0)?"#166534":"#dc2626" }}>
              Chênh lệch: {Number(adjForm.qty)>=(adjustModal.qty_on_hand||0)?"+":""}{Number(adjForm.qty)-(adjustModal.qty_on_hand||0)}
            </div>
          )}
          <Field label="Lý do điều chỉnh"><textarea style={{...S.input,height:60,resize:"none"}} value={adjForm.note} onChange={e=>setAdjForm(p=>({...p,note:e.target.value}))} placeholder="Kiểm kho định kỳ, nhầm lẫn..." /></Field>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <button style={S.btnGhost()} onClick={()=>setAdjustModal(null)}>Hủy</button>
            <button style={S.btn()} onClick={saveAdjust}>💾 Lưu điều chỉnh</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 4 — CHUYỂN KHO
// ═══════════════════════════════════════════════════════════
function TransferTab({ user, toast }) {
  const [warehouses, setWarehouses] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ from_warehouse_id:"", to_warehouse_id:"", note:"" });
  const [items, setItems] = useState([{ part_name:"", sku:"", qty:1, unit_price:0 }]);
  const [detailModal, setDetailModal] = useState(null);

  useEffect(() => {
    WH.list().then(setWarehouses);
    load();
  }, []);

  async function load() {
    setLoading(true);
    try { setTransfers(await Trans.list()); } finally { setLoading(false); }
  }

  async function save() {
    if (!form.from_warehouse_id || !form.to_warehouse_id) return toast.show("Chọn kho xuất và kho nhận","error");
    if (form.from_warehouse_id===form.to_warehouse_id) return toast.show("Kho xuất và kho nhận phải khác nhau","error");
    if (items.some(i=>!i.part_name||!i.qty)) return toast.show("Điền đầy đủ thông tin hàng","error");
    const fromWH = warehouses.find(w=>w.id===form.from_warehouse_id);
    const toWH   = warehouses.find(w=>w.id===form.to_warehouse_id);
    const totalValue = items.reduce((s,i)=>s+Number(i.qty)*Number(i.unit_price||0),0);
    try {
      await Trans.create({
        transfer_code: genCode("TR"),
        from_warehouse_id: form.from_warehouse_id, from_warehouse_name: fromWH?.name||"",
        to_warehouse_id: form.to_warehouse_id, to_warehouse_name: toWH?.name||"",
        items: items.map(i=>({ part_name:i.part_name, sku:i.sku||"", qty:Number(i.qty), unit_price:Number(i.unit_price||0), total_price:Number(i.qty)*Number(i.unit_price||0) })),
        status: "sent", total_items: items.length, total_value: totalValue,
        note: form.note||"",
        requested_by_id: user?.id||"", requested_by_name: user?.name||"",
      });
      toast.show("Đã tạo phiếu chuyển kho");
      setModal(false); setItems([{ part_name:"", sku:"", qty:1, unit_price:0 }]);
      load();
    } catch(e) { toast.show(e.message,"error"); }
  }

  async function confirm(t) {
    try {
      await Trans.update(t.id, { status:"received", confirmed_by_id:user?.id||"", confirmed_by_name:user?.name||"", confirmed_at:new Date().toISOString() });
      toast.show("Đã xác nhận nhận hàng"); load();
    } catch(e) { toast.show(e.message,"error"); }
  }

  async function cancel(t) {
    if (!confirm("Hủy phiếu chuyển kho?")) return;
    try { await Trans.update(t.id, { status:"cancelled" }); toast.show("Đã hủy"); load(); } catch(e) { toast.show(e.message,"error"); }
  }

  const statusColor = { draft:"#6b7280", sent:"#2563eb", received:"#059669", cancelled:"#dc2626" };
  const statusLabel = { draft:"📝 Nháp", sent:"🚚 Đang vận chuyển", received:"✅ Đã nhận", cancelled:"❌ Đã hủy" };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:16, color:"#1e1b4b" }}>🔄 Chuyển kho</div>
        <button style={S.btn()} onClick={()=>setModal(true)}>+ Tạo phiếu chuyển</button>
      </div>

      {loading ? <div style={S.empty}>⏳ Đang tải...</div> : (
        <div style={S.card}>
          <div style={{ overflowX:"auto" }}>
            <table style={S.table}>
              <thead><tr>{["Mã phiếu","Từ kho","Sang kho","Số mặt hàng","Tổng giá trị","Trạng thái","Người tạo","Ngày","Hành động"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {transfers.length===0 ? <tr><td colSpan={9} style={{...S.td,textAlign:"center",color:"#9ca3af",padding:32}}>Chưa có phiếu chuyển kho</td></tr>
                : transfers.map(t=>(
                  <tr key={t.id}>
                    <td style={S.td}><code style={{fontSize:11}}>{t.transfer_code}</code></td>
                    <td style={S.td}>{t.from_warehouse_name}</td>
                    <td style={S.td}>{t.to_warehouse_name}</td>
                    <td style={S.td}>{t.total_items}</td>
                    <td style={S.td}>{(t.total_value||0).toLocaleString("vi")}</td>
                    <td style={S.td}><span style={S.badge(statusColor[t.status]||"#6b7280")}>{statusLabel[t.status]||t.status}</span></td>
                    <td style={S.td}>{t.requested_by_name}</td>
                    <td style={S.td}>{new Date(t.created||t.created_date).toLocaleDateString("vi")}</td>
                    <td style={S.td}>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        <button style={S.btnSm("#4f46e5")} onClick={()=>setDetailModal(t)}>👁️</button>
                        {t.status==="sent" && <button style={S.btnSm("#059669")} onClick={()=>confirm(t)}>✅ Nhận</button>}
                        {t.status==="sent" && <button style={S.btnSm("#dc2626")} onClick={()=>cancel(t)}>❌</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create modal */}
      {modal && (
        <Modal title="🔄 Tạo phiếu chuyển kho" onClose={()=>setModal(false)} width={640}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            <Field label="Kho xuất *">
              <select style={S.select} value={form.from_warehouse_id} onChange={e=>setForm(p=>({...p,from_warehouse_id:e.target.value}))}>
                <option value="">-- Chọn kho xuất --</option>
                {warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <Field label="Kho nhận *">
              <select style={S.select} value={form.to_warehouse_id} onChange={e=>setForm(p=>({...p,to_warehouse_id:e.target.value}))}>
                <option value="">-- Chọn kho nhận --</option>
                {warehouses.filter(w=>w.id!==form.from_warehouse_id).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
          </div>

          <div style={{fontWeight:700,fontSize:13,color:"#1e1b4b",marginBottom:8}}>Danh sách hàng chuyển</div>
          {items.map((item,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 1fr auto",gap:6,marginBottom:6,alignItems:"end"}}>
              <div><label style={S.label}>Tên hàng *</label><input style={S.input} value={item.part_name} onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,part_name:e.target.value}:x))} placeholder="Tên linh kiện..." /></div>
              <div><label style={S.label}>SKU</label><input style={S.input} value={item.sku} onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,sku:e.target.value}:x))} /></div>
              <div><label style={S.label}>SL *</label><input style={S.input} type="number" min="1" value={item.qty} onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,qty:e.target.value}:x))} /></div>
              <div><label style={S.label}>Đơn giá</label><input style={S.input} type="number" value={item.unit_price} onChange={e=>setItems(p=>p.map((x,j)=>j===i?{...x,unit_price:e.target.value}:x))} /></div>
              <button onClick={()=>setItems(p=>p.filter((_,j)=>j!==i))} style={{...S.btnSm("#dc2626"),marginBottom:2}}>✕</button>
            </div>
          ))}
          <button style={S.btnGhost()} onClick={()=>setItems(p=>[...p,{part_name:"",sku:"",qty:1,unit_price:0}])}>+ Thêm hàng</button>

          <Field label="Ghi chú" ><textarea style={{...S.input,height:60,resize:"none",marginTop:12}} value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} /></Field>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
            <button style={S.btnGhost()} onClick={()=>setModal(false)}>Hủy</button>
            <button style={S.btn()} onClick={save}>🚚 Tạo phiếu chuyển</button>
          </div>
        </Modal>
      )}

      {/* Detail modal */}
      {detailModal && (
        <Modal title={`📋 Chi tiết — ${detailModal.transfer_code}`} onClose={()=>setDetailModal(null)} width={560}>
          <div style={{background:"#f3f4f6",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:13}}>
            <b>Từ:</b> {detailModal.from_warehouse_name} → <b>Sang:</b> {detailModal.to_warehouse_name}<br/>
            <b>Trạng thái:</b> <span style={{color:statusColor[detailModal.status]}}>{statusLabel[detailModal.status]}</span><br/>
            {detailModal.note && <><b>Ghi chú:</b> {detailModal.note}</>}
          </div>
          <table style={S.table}>
            <thead><tr>{["Tên hàng","SKU","SL","Đơn giá","Thành tiền"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {(detailModal.items||[]).map((it,i)=>(
                <tr key={i}>
                  <td style={S.td}>{it.part_name}</td>
                  <td style={S.td}><code style={{fontSize:11}}>{it.sku||"—"}</code></td>
                  <td style={S.td}><b>{it.qty}</b></td>
                  <td style={S.td}>{(it.unit_price||0).toLocaleString("vi")}</td>
                  <td style={S.td}>{(it.total_price||0).toLocaleString("vi")}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} style={{...S.td,textAlign:"right",fontWeight:700}}>Tổng</td>
                <td style={{...S.td,fontWeight:700,color:"#1e1b4b"}}>{(detailModal.total_value||0).toLocaleString("vi")}</td>
              </tr>
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 5 — KIỂM KHO (Stock Count)
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function WarehouseManager({ user, onBack }) {
  const [tab, setTab] = useState("warehouses");
  const toast = useToast();

  const TABS = [
    { key:"warehouses", icon:"🏭", label:"Danh sách kho" },
    { key:"zones",      icon:"📦", label:"Khu vực & Kệ" },
    { key:"ledger",     icon:"📊", label:"Tồn kho" },
    { key:"transfer",   icon:"🔄", label:"Chuyển kho" },
    { key:"count",      icon:"📋", label:"Kiểm kho" },
  ];

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.hdr}>
        {onBack && <button onClick={onBack} style={{background:"none",border:"none",color:"#fff",fontSize:22,cursor:"pointer",padding:0}}>←</button>}
        <div>
          <div style={S.hdrTitle}>🏭 Quản lý kho</div>
          <div style={S.hdrSub}>Quản lý đa kho · Vị trí kệ · Tồn kho · Kiểm kho</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map(t=>(
          <button key={t.key} style={S.tab(tab===t.key)} onClick={()=>setTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={S.body}>
        {tab==="warehouses" && <WarehouseTab user={user} toast={toast} />}
        {tab==="zones"      && <ZoneLocationTab user={user} toast={toast} />}
        {tab==="ledger"     && <StockLedgerTab user={user} toast={toast} />}
        {tab==="transfer"   && <TransferTab user={user} toast={toast} />}
        {tab==="count"      && <StockCountPage user={user} />}
      </div>

      <toast.ToastContainer />
    </div>
  );
}
