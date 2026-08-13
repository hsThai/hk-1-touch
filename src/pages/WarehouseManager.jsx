/**
 * WarehouseManager.jsx
 * @version 2026-05-28-v3 — fix StockReportTab filter limit→perPage
 * Quản lý kho đa điểm — Kho / Zone / Kệ / Tồn kho / Nhập / Xuất / Chuyển / Kiểm kho
 */
import React, { useState, useEffect, useCallback } from "react";
import { getPbUrl, getAuth, logAction } from "./pb.jsx";
import StockCountPage from "./StockCountPage.jsx";
import PurchaseOrderPage from "./PurchaseOrderPage.jsx";
import RMAPage from "./RMAPage.jsx";
import { SaleOrder, RepairOrder } from "./pb.jsx";

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
    list:   (p={})   => {
      const { limit, sort, ...rest } = p;
      const qp = { perPage: limit||500, ...rest };
      if (sort) qp.sort = sort;
      return pbFetch(`collections/${colName}/records?${new URLSearchParams(qp)}`).then(r=>r.items||[]);
    },
    filter: (f,p={}) => {
      const { limit, sort, ...rest } = p;
      const params = new URLSearchParams({ perPage: limit||500, ...(sort?{sort}:{}), ...rest });
      return pbFetch(`collections/${colName}/records?filter=${encodeURIComponent(f)}&${params}`).then(r=>r.items||[]);
    },
    create: (d)      => pbFetch(`collections/${colName}/records`, { method:"POST", body:JSON.stringify(d) }),
    update: (id,d)   => pbFetch(`collections/${colName}/records/${id}`, { method:"PATCH", body:JSON.stringify(d) }),
    delete: (id)     => pbFetch(`collections/${colName}/records/${id}`, { method:"DELETE" }),
    get:    (id)     => pbFetch(`collections/${colName}/records/${id}`),
  };
}

const WH    = makeWHCol("warehouses");
const Zone  = makeWHCol("warehouse_zones");
const Loc   = makeWHCol("warehouse_locations");

// Lọc kho theo quyền: admin/owner/manager thấy tất cả, còn lại chỉ thấy kho được gán
function filterWarehousesByUser(warehouses, user) {
  const isWhAdmin = ["admin","owner","manager"].includes(user?.role);
  if (isWhAdmin) return warehouses;
  const allowed = user?.warehouse_ids || [];
  return warehouses.filter(w => allowed.includes(w.id));
}
const Ledger= makeWHCol("stock_ledgers");
const Move  = makeWHCol("stock_movements");
const Trans = makeWHCol("stock_transfers");
const Catalog  = makeWHCol("product_catalog");
const Usage    = makeWHCol("spare_part_usages");
const Notif    = makeWHCol("notifications");
const Imports  = makeWHCol("stock_imports");
const Count    = makeWHCol("stock_counts");
const CountItem= makeWHCol("stock_count_items");
const Supplier = makeWHCol("suppliers");

// ─── Styles ───────────────────────────────────────────────
const S = {
  page:    { minHeight:"100vh", background:"#f8fafc", fontFamily:"system-ui,sans-serif" },
  hdr:     { background:"linear-gradient(135deg,#1e1b4b,#4f46e5)", color:"#fff", padding:"16px 20px", display:"flex", alignItems:"center", gap:12 },
  hdrTitle:{ fontWeight:800, fontSize:20 },
  hdrSub:  { fontSize:12, color:"#c7d2fe", marginTop:2 },
  tabs:    { display:"flex", gap:0, background:"#fff", borderBottom:"2px solid #e5e7eb", overflowX:"auto" },
  tab:     (a)=>({ padding:"12px 18px", fontWeight:600, fontSize:13, cursor:"pointer", whiteSpace:"nowrap",
    borderBottom: a?"3px solid #4f46e5":"3px solid transparent",
    color: a?"#4f46e5":"#6b7280", background:"none", border:"none" }),
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
    try { const all = await WH.list(); setWarehouses(filterWarehousesByUser(all, user)); } finally { setLoading(false); }
  }, [user]);

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

  useEffect(() => { WH.list().then(r=>{ const filtered = filterWarehousesByUser(r, user); setWarehouses(filtered); if(filtered.length) setSelWH(filtered[0].id); }); }, [user]);

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

  useEffect(() => { WH.list().then(r=>{ const filtered = filterWarehousesByUser(r, user); setWarehouses(filtered); if(filtered.length) setSelWH(filtered[0].id); }); }, [user]);

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
        unit_price: l.cost_price||0,
        note: adjForm.note || "Điều chỉnh thủ công",
        created_by_id: user?.id||"", created_by_name: user?.name||"",
        created_date: new Date().toISOString().replace("T"," ").split(".")[0],
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
  const [items, setItems] = useState([{ part_id:"", part_name:"", sku:"", qty:1, unit_price:0 }]);
  const [detailModal, setDetailModal] = useState(null);
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [openDrop, setOpenDrop] = useState(-1); // index item đang mở dropdown
  const [dropSearch, setDropSearch] = useState({}); // { [i]: "search text" }

  useEffect(() => {
    WH.list().then(r => setWarehouses(filterWarehousesByUser(r, user)));
    load();
  }, [user]);

  useEffect(() => {
    if (!form.from_warehouse_id) { setPartSuggestions([]); return; }
    Ledger.list({ limit:500 }).then(ledgers => {
      const filtered = ledgers
        .filter(l => l.warehouse_id === form.from_warehouse_id && (l.qty_on_hand||0) > 0)
        .map(l => ({ part_id: l.part_id||"", name: l.part_name||"", sku: l.sku||"", qty: l.qty_on_hand||0, cost: l.cost_price||0 }));
      setPartSuggestions(filtered);
    }).catch(() => setPartSuggestions([]));
  }, [form.from_warehouse_id]);

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
      // Reserve stock tại kho nguồn — tránh bán trùng
      for (const item of items) {
        const partId = item.part_id || "";
        if (!partId && item.sku) {
          try {
            const bySku = await Ledger.filter(`sku="${item.sku}" && warehouse_id="${form.from_warehouse_id}"`);
            if (bySku && bySku[0]) { item.part_id = bySku[0].part_id; }
          } catch {}
        }
        const resolvedId = item.part_id || "";
        if (resolvedId) {
          try {
            const fromLedgers = await Ledger.filter(`warehouse_id="${form.from_warehouse_id}" && part_id="${resolvedId}"`);
            if (fromLedgers && fromLedgers[0]) {
              const fl = fromLedgers[0];
              const newReserved = (Number(fl.qty_reserved)||0) + Number(item.qty);
              await Ledger.update(fl.id, {
                qty_reserved: newReserved,
                qty_available: Math.max(0, (Number(fl.qty_on_hand)||0) - newReserved),
              });
            }
          } catch {}
        }
      }
      logAction(user, "transfer_stock", "stock_transfer", "", `Tạo phiếu chuyển kho`);
      await Trans.create({
        transfer_code: genCode("TR"),
        from_warehouse_id: form.from_warehouse_id, from_warehouse_name: fromWH?.name||"",
        to_warehouse_id: form.to_warehouse_id, to_warehouse_name: toWH?.name||"",
        items: items.map(i=>({ part_id:i.part_id||"", part_name:i.part_name, sku:i.sku||"", qty:Number(i.qty), unit_price:Number(i.unit_price||0), total_price:Number(i.qty)*Number(i.unit_price||0) })),
        status: "sent", total_items: items.length, total_value: totalValue,
        note: form.note||"",
        requested_by_id: user?.id||"", requested_by_name: user?.name||"",
      });
      toast.show("Đã tạo phiếu chuyển kho");
      setModal(false); setItems([{ part_id:"", part_name:"", sku:"", qty:1, unit_price:0 }]);
      load();
    } catch(e) { toast.show(e.message,"error"); }
  }

  async function confirm(t) {
    try {
      // 1. Cập nhật trạng thái phiếu
      logAction(user, "transfer_stock", "stock_transfer", t.id, `Xác nhận nhận chuyển kho ${t.transfer_code||t.id}`);
      await Trans.update(t.id, { status:"received", confirmed_by_id:user?.id||"", confirmed_by_name:user?.name||"", confirmed_at:new Date().toISOString() });

      // 2. Cập nhật stock_ledgers + ghi stock_movements
      const items = Array.isArray(t.items) ? t.items : (typeof t.items==="string" ? JSON.parse(t.items||"[]") : []);
      const now = new Date().toISOString();
      const mvCode = "TR-" + Date.now() + "-" + Math.floor(Math.random()*900+100);

      for (const item of items) {
        const partId   = item.part_id || "";
        const qty      = Number(item.qty) || 0;
        const costPrice= Number(item.unit_price||item.cost_price) || 0;

        // Fallback: nếu không có part_id, tìm theo sku
        let resolvedPartId = partId;
        if (!resolvedPartId && item.sku) {
          try {
            const bySku = await Ledger.filter(`sku="${item.sku}" && warehouse_id="${t.from_warehouse_id}"`);
            if (bySku && bySku[0]) resolvedPartId = bySku[0].part_id || "";
          } catch {}
        }

        // -- Trừ kho xuất --
        const fromLedgers = resolvedPartId
          ? await Ledger.filter(`warehouse_id='${t.from_warehouse_id}' && part_id='${resolvedPartId}'`)
          : await Ledger.filter(`warehouse_id='${t.from_warehouse_id}' && sku='${item.sku||""}'`);
        let fromQtyBefore = 0;
        let fromQtyAfter = 0;
        if (fromLedgers.length > 0) {
          const fl = fromLedgers[0];
          fromQtyBefore = Number(fl.qty_on_hand)||0;
          fromQtyAfter = Math.max(0, fromQtyBefore - qty);
          const fromReserved = Math.max(0, (Number(fl.qty_reserved)||0) - qty);
          await Ledger.update(fl.id, {
            qty_on_hand: fromQtyAfter,
            qty_reserved: fromReserved,
            qty_available: Math.max(0, fromQtyAfter - fromReserved),
            last_movement_at: now,
          });
        }

        // Ghi movement: xuất từ kho nguồn
        try {
          await Move.create({
            movement_code:  mvCode + "-OUT",
            movement_type:  "transfer_out",
            warehouse_id:   t.from_warehouse_id,
            warehouse_name: t.from_warehouse_name || "",
            part_id:        resolvedPartId,
            part_name:      item.part_name||"",
            sku:            item.sku||"",
            qty_before:     fromQtyBefore,
            qty_change:     -qty,
            qty_after:      fromQtyAfter,
            unit_price:     costPrice,
            ref_type:       "stock_transfer",
            ref_id:         t.id,
            ref_code:       t.transfer_code,
            note:           `Chuyển kho → ${t.to_warehouse_name||""}`,
            created_by_id:  user?.id||"",
            created_by_name:user?.name||"",
            created_date:   now.replace("T"," ").split(".")[0],
          });
        } catch {}

        // -- Cộng kho nhận --
        const toLedgers = resolvedPartId
          ? await Ledger.filter(`warehouse_id='${t.to_warehouse_id}' && part_id='${resolvedPartId}'`)
          : await Ledger.filter(`warehouse_id='${t.to_warehouse_id}' && sku='${item.sku||""}'`);
        let toQtyBefore = 0;
        let toQtyAfter = 0;
        if (toLedgers.length > 0) {
          const tl = toLedgers[0];
          toQtyBefore = Number(tl.qty_on_hand)||0;
          toQtyAfter = toQtyBefore + qty;
          await Ledger.update(tl.id, {
            qty_on_hand: toQtyAfter,
            qty_available: Math.max(0, toQtyAfter - (tl.qty_reserved||0)),
            last_movement_at: now,
          });
        } else {
          toQtyBefore = 0;
          toQtyAfter = qty;
          await Ledger.create({
            warehouse_id: t.to_warehouse_id,
            warehouse_name: t.to_warehouse_name || "",
            part_id: resolvedPartId,
            part_name: item.part_name||"",
            sku: item.sku||"",
            category: item.category||"",
            unit: item.unit||"Cái",
            cost_price: costPrice,
            qty_on_hand: toQtyAfter,
            qty_reserved: 0,
            qty_available: toQtyAfter,
            min_qty: 0,
            location_id: "",
            location_code: "",
            last_movement_at: now,
          });
        }

        // Ghi movement: nhập vào kho nhận
        try {
          await Move.create({
            movement_code:  mvCode + "-IN",
            movement_type:  "transfer_in",
            warehouse_id:   t.to_warehouse_id,
            warehouse_name: t.to_warehouse_name || "",
            part_id:        resolvedPartId,
            part_name:      item.part_name||"",
            sku:            item.sku||"",
            qty_before:     toQtyBefore,
            qty_change:     qty,
            qty_after:      toQtyAfter,
            unit_price:     costPrice,
            ref_type:       "stock_transfer",
            ref_id:         t.id,
            ref_code:       t.transfer_code,
            note:           `Nhận chuyển từ ${t.from_warehouse_name||""}`,
            created_by_id:  user?.id||"",
            created_by_name:user?.name||"",
            created_date:   now.replace("T"," ").split(".")[0],
          });
        } catch {}
      }

      toast.show("✅ Đã xác nhận — tồn kho đã được cập nhật"); load();
    } catch(e) { console.error(e); toast.show(e.message,"error"); }
  }

  async function cancel(t) {
    if (!confirm("Hủy phiếu chuyển kho?")) return;
    try {
      // Release reserved stock tại kho nguồn
      const tItems = Array.isArray(t.items) ? t.items : (typeof t.items==="string" ? JSON.parse(t.items||"[]") : []);
      for (const item of tItems) {
        const partId = item.part_id || "";
        if (partId) {
          try {
            const fromLedgers = await Ledger.filter(`warehouse_id="${t.from_warehouse_id}" && part_id="${partId}"`);
            if (fromLedgers && fromLedgers[0]) {
              const fl = fromLedgers[0];
              const newReserved = Math.max(0, (Number(fl.qty_reserved)||0) - Number(item.qty));
              await Ledger.update(fl.id, {
                qty_reserved: newReserved,
                qty_available: Math.max(0, (Number(fl.qty_on_hand)||0) - newReserved),
              });
            }
          } catch {}
        }
      }
      logAction(user, "update", "stock_transfer", t.id, `Hủy phiếu chuyển kho ${t.transfer_code||t.id}`);
      await Trans.update(t.id, { status:"cancelled" });
      toast.show("Đã hủy"); load();
    } catch(e) { toast.show(e.message,"error"); }
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
                    <td style={S.td}>{(() => {
  if (t.confirmed_at) return new Date(t.confirmed_at).toLocaleDateString("vi-VN");
  const m = (t.transfer_code||"").match(/TR-(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
})()}</td>
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
              <div style={{ position:"relative" }}>
                <label style={S.label}>Tên hàng *</label>
                <input
                  style={{ ...S.input, paddingRight: 32 }}
                  value={dropSearch[i] !== undefined ? dropSearch[i] : item.part_name}
                  onChange={e => {
                    setDropSearch(p => ({ ...p, [i]: e.target.value }));
                    setOpenDrop(i);
                  }}
                  onFocus={() => {
                    setDropSearch(p => ({ ...p, [i]: item.part_name }));
                    setOpenDrop(i);
                  }}
                  onBlur={() => setTimeout(() => setOpenDrop(v => v === i ? -1 : v), 180)}
                  placeholder="Gõ để tìm linh kiện..."
                  autoComplete="off"
                />
                {/* arrow icon */}
                <span style={{ position:"absolute", right:10, top:30, fontSize:12, color:"#9ca3af", pointerEvents:"none" }}>▼</span>

                {/* Custom dropdown list */}
                {openDrop === i && (() => {
                  const q = (dropSearch[i] || "").toLowerCase();
                  const filtered = partSuggestions.filter(p =>
                    !q || p.name.toLowerCase().includes(q) || (p.sku||"").toLowerCase().includes(q)
                  ).slice(0, 20);
                  if (filtered.length === 0) return null;
                  return (
                    <div style={{
                      position:"absolute", top:"100%", left:0, right:0, zIndex:10000,
                      background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:10,
                      boxShadow:"0 8px 24px rgba(0,0,0,.12)", maxHeight:220, overflowY:"auto",
                      marginTop:2,
                    }}>
                      {filtered.map((p, idx) => (
                        <div key={idx}
                          onMouseDown={() => {
                            setItems(prev => prev.map((x, j) => j !== i ? x : {
                              ...x,
                              part_name: p.name,
                              sku: p.sku || x.sku,
                              unit_price: p.cost || x.unit_price,
                            }));
                            setDropSearch(prev => ({ ...prev, [i]: undefined }));
                            setOpenDrop(-1);
                          }}
                          style={{
                            padding:"10px 14px", cursor:"pointer", borderBottom:"1px solid #f3f4f6",
                            transition:"background .1s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.background="#f5f3ff"}
                          onMouseLeave={e => e.currentTarget.style.background="#fff"}
                        >
                          <div style={{ fontWeight:600, fontSize:13, color:"#1e1b4b", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>
                            {p.sku ? `SKU: ${p.sku}  •  ` : ""}Tồn: {p.qty}  •  {(p.cost||0).toLocaleString("vi")}đ
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
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
// ─────────────────────────────────────────────────────────────────────────────
// DefectTab — LK lỗi / Trả NCC
// ─────────────────────────────────────────────────────────────────────────────
// ─── PartNameInput — Autocomplete tên linh kiện ─────────────────────────────
function PartNameInput({ value, onChange, parts=[], placeholder="Tên linh kiện...", style={} }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value||"");

  useEffect(() => { setQ(value||""); }, [value]);

  const filtered = (parts||[]).filter(p =>
    !q || p.name?.toLowerCase().includes(q.toLowerCase()) || (p.sku||"").toLowerCase().includes(q.toLowerCase())
  ).slice(0, 15);

  return (
    <div style={{ position:"relative" }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); onChange(e.target.value, null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder={placeholder}
        autoComplete="off"
        style={{ width:"100%", height:38, borderRadius:8, border:"1.5px solid #e5e7eb", padding:"0 10px", fontSize:13, outline:"none", boxSizing:"border-box", ...style }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position:"absolute", top:"100%", left:0, right:0, zIndex:10000,
          background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:10,
          boxShadow:"0 8px 24px rgba(0,0,0,.12)", maxHeight:200, overflowY:"auto", marginTop:2,
        }}>
          {filtered.map((p,i) => (
            <div key={i}
              onMouseDown={() => { setQ(p.name); onChange(p.name, p); setOpen(false); }}
              style={{ padding:"9px 14px", cursor:"pointer", borderBottom:"1px solid #f3f4f6" }}
              onMouseEnter={e=>e.currentTarget.style.background="#f5f3ff"}
              onMouseLeave={e=>e.currentTarget.style.background="#fff"}
            >
              <div style={{ fontWeight:600, fontSize:13 }}>{p.name}</div>
              <div style={{ fontSize:11, color:"#9ca3af" }}>
                {p.sku ? `SKU: ${p.sku}` : ""}
                {p.cost_price ? `  •  ${(p.cost_price||0).toLocaleString("vi")}đ` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SupplierNameInput — Autocomplete tên NCC ───────────────────────────────
function SupplierNameInput({ value, onChange, suppliers=[], placeholder="Nhà cung cấp...", style={} }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value||"");

  useEffect(() => { setQ(value||""); }, [value]);

  const filtered = (suppliers||[]).filter(s =>
    !q || s.name?.toLowerCase().includes(q.toLowerCase()) || (s.phone||"").includes(q)
  ).slice(0, 10);

  return (
    <div style={{ position:"relative" }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); onChange(e.target.value, null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder={placeholder}
        autoComplete="off"
        style={{ width:"100%", height:38, borderRadius:8, border:"1.5px solid #e5e7eb", padding:"0 10px", fontSize:13, outline:"none", boxSizing:"border-box", ...style }}
      />
      {open && q.trim() && filtered.length > 0 && (
        <div style={{
          position:"absolute", top:"100%", left:0, right:0, zIndex:10000,
          background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:10,
          boxShadow:"0 8px 24px rgba(0,0,0,.12)", maxHeight:200, overflowY:"auto", marginTop:2,
        }}>
          {filtered.map((s,i) => (
            <div key={s.id||i}
              onMouseDown={() => { setQ(s.name); onChange(s.name, s); setOpen(false); }}
              style={{ padding:"9px 14px", cursor:"pointer", borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"space-between", alignItems:"center" }}
              onMouseEnter={e=>e.currentTarget.style.background="#f5f3ff"}
              onMouseLeave={e=>e.currentTarget.style.background="#fff"}
            >
              <div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div>
              {s.phone && <div style={{ fontSize:11, color:"#9ca3af" }}>{s.phone}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DefectTab({ user, warehouses }) {
  const [list,      setList]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [parts,     setParts]     = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [saving,    setSaving]    = useState(false);
  const [form, setForm] = useState({ part_name:"", sku:"", qty:1, reason:"", supplier_name:"", note:"", warehouse_id:"" });

  useEffect(() => {
    Catalog.list({ limit:300 }).then(p=>setParts(p||[])).catch(()=>{});
    Supplier.list({ limit:300 }).then(s=>setSuppliers(s||[])).catch(()=>{});
    loadList();
  }, []);

  async function loadList() {
    setLoading(true);
    try {
      const mvs = await Move.list({ limit:200, sort:"-id" });
      setList((mvs||[]).filter(m=>m.movement_type==="defect"));
    } catch { setList([]); }
    setLoading(false);
  }

  async function submit() {
    if (!form.part_name.trim() || form.qty < 1) { alert("Nhập tên LK và số lượng"); return; }
    if (!form.warehouse_id) { alert("Vui lòng chọn kho trước khi ghi nhận lỗi"); return; }
    setSaving(true);
    try {
      // So khớp không phân biệt hoa/thường + khoảng trắng dư, tránh bỏ lỡ trừ tồn kho do gõ sai/thừa dấu cách
      const typedName = form.part_name.trim().toLowerCase();
      const part = parts.find(p => (p.name||"").trim().toLowerCase() === typedName);

      const defectQty = Math.abs(Number(form.qty)||0);
      let defectQtyBefore = 0;
      let ledgerRecord = null;
      if (part) {
        const ledgers = await Ledger.list({ limit:500 });
        ledgerRecord = (ledgers||[]).find(x=>x.part_id===part.id && x.warehouse_id===form.warehouse_id);
        defectQtyBefore = Number(ledgerRecord?.qty_on_hand)||0;
        if (defectQty > defectQtyBefore) {
          const proceed = confirm(`⚠️ Số lượng lỗi (${defectQty}) lớn hơn tồn kho hiện có (${defectQtyBefore}) của "${part.name}" tại kho này.\nHệ thống sẽ đưa tồn kho về 0. Vẫn tiếp tục?`);
          if (!proceed) { setSaving(false); return; }
        }
      } else {
        const proceed = confirm(`⚠️ Không tìm thấy "${form.part_name}" trong danh mục linh kiện/vật tư.\nGhi nhận sẽ được lưu làm nhật ký lỗi nhưng KHÔNG tự trừ tồn kho. Vẫn tiếp tục?`);
        if (!proceed) { setSaving(false); return; }
      }

      // Ghép ghi chú, bỏ các phần trống để tránh hiển thị "| NCC: |" xấu
      const noteParts = [`LK lỗi — ${form.reason?.trim() || "Không rõ lý do"}`];
      if (form.supplier_name?.trim()) noteParts.push(`NCC: ${form.supplier_name.trim()}`);
      if (form.note?.trim()) noteParts.push(form.note.trim());
      const fullNote = noteParts.join(" | ");

      await Move.create({
        movement_code: "DEF-"+Date.now(), movement_type:"defect",
        warehouse_id: form.warehouse_id,
        warehouse_name: warehouses.find(w=>w.id===form.warehouse_id)?.name||"",
        part_id: part?.id||"", part_name: form.part_name.trim(), sku: part?.sku||form.sku||"",
        qty_change: -defectQty, qty_before:defectQtyBefore, qty_after:Math.max(0,defectQtyBefore-defectQty),
        note: fullNote,
        created_by_name: user?.name||user?.full_name||"",
        created_date: new Date().toISOString().replace("T"," ").split(".")[0],
      });

      if (part && ledgerRecord) {
        await Ledger.update(ledgerRecord.id, {
          qty_on_hand:   Math.max(0,(ledgerRecord.qty_on_hand||0)-defectQty),
          qty_available: Math.max(0,(ledgerRecord.qty_available||0)-defectQty),
        });
      }

      logAction(user, "update", "stock_ledger", part?.id||"", `Ghi nhận LK lỗi/trả NCC: ${form.part_name.trim()} x${defectQty} — ${fullNote}`);

      alert("✅ Đã ghi nhận");
      setShowAdd(false);
      setForm({ part_name:"", sku:"", qty:1, reason:"", supplier_name:"", note:"", warehouse_id:"" });
      loadList();
    } catch(e) { alert("Lỗi: "+e.message); }
    setSaving(false);
  }

  return (
    <div style={{ padding:"16px 14px 100px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontWeight:800, fontSize:17 }}>⚠️ LK lỗi / Trả NCC</div>
        <button onClick={()=>setShowAdd(v=>!v)}
          style={{ background:"#dc2626", color:"#fff", border:"none", borderRadius:8, padding:"8px 14px", fontSize:13, cursor:"pointer" }}>
          + Ghi nhận lỗi
        </button>
      </div>

      {showAdd && (
        <div style={{ background:"#fff", borderRadius:12, padding:16, marginBottom:16, boxShadow:"0 2px 8px rgba(0,0,0,.1)" }}>
          <select value={form.warehouse_id} onChange={e=>setForm(v=>({...v,warehouse_id:e.target.value}))}
            style={{ width:"100%", border:"1.5px solid #e5e7eb", borderRadius:8, padding:"8px 10px", fontSize:13, marginBottom:8 }}>
            <option value="">-- Chọn kho --</option>
            {warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <PartNameInput
            value={form.part_name}
            parts={parts}
            placeholder="Tên linh kiện *"
            onChange={(name, part) => setForm(v => ({
              ...v,
              part_name: name,
              sku: part?.sku || v.sku,
            }))}
            style={{ marginBottom:8 }}
          />
          {[
            {ph:"SKU",          key:"sku"},
            {ph:"Lý do lỗi",    key:"reason"},
            {ph:"Ghi chú",      key:"note"},
          ].map(f=>(
            <input key={f.key} placeholder={f.ph} value={form[f.key]}
              onChange={e=>setForm(v=>({...v,[f.key]:e.target.value}))}
              style={{ width:"100%", border:"1.5px solid #e5e7eb", borderRadius:8, padding:"8px 10px", fontSize:13, marginBottom:8, boxSizing:"border-box" }}/>
          ))}
          <SupplierNameInput
            value={form.supplier_name}
            suppliers={suppliers}
            placeholder="Nhà cung cấp (gợi ý từ danh sách NCC)..."
            onChange={(name) => setForm(v => ({ ...v, supplier_name: name }))}
            style={{ marginBottom:8 }}
          />
          <input type="number" placeholder="Số lượng *" value={form.qty} min={1}
            onChange={e=>setForm(v=>({...v,qty:+e.target.value}))}
            style={{ width:"100%", border:"1.5px solid #e5e7eb", borderRadius:8, padding:"8px 10px", fontSize:13, marginBottom:12, boxSizing:"border-box" }}/>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={submit} disabled={saving}
              style={{ flex:1, background:"#dc2626", color:"#fff", border:"none", borderRadius:8, padding:10, fontSize:14, cursor:"pointer" }}>
              {saving?"Đang lưu...":"✅ Xác nhận"}
            </button>
            <button onClick={()=>setShowAdd(false)}
              style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"10px 16px", cursor:"pointer" }}>
              Hủy
            </button>
          </div>
        </div>
      )}

      {loading && <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>Đang tải...</div>}
      {!loading && list.length===0 && <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>Chưa có LK lỗi nào</div>}
      {list.map(m=>(
        <div key={m.id} style={{ background:"#fff", borderRadius:10, padding:12, marginBottom:8, boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <div style={{ fontWeight:700, fontSize:14 }}>{m.part_name}</div>
            <div style={{ fontWeight:700, color:"#dc2626" }}>x{Math.abs(m.qty_change||0)}</div>
          </div>
          <div style={{ fontSize:12, color:"#6b7280", marginTop:4 }}>{m.note}</div>
          <div style={{ fontSize:11, color:"#9ca3af" }}>{m.warehouse_name} · {new Date(m.created_date||m.created).toLocaleDateString("vi-VN")}</div>
        </div>
      ))}

      {/* Phần RMA — Trả hàng NCC chính thức (tạo phiếu, theo dõi đổi trả/hoàn tiền) */}
      <div style={{ height:10, background:"transparent" }} />
      <RMAPage user={user} />
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// ShippingTab — Vận đơn 3 chiều: Nhận hàng / Giao bán / Trả bảo hành
// ─────────────────────────────────────────────────────────────────────────────
function ShippingTab({ user }) {
  const [tab, setTab] = useState("inbound"); // inbound | sale | warranty
  const [imports,  setImports]  = useState([]);
  const [sales,    setSales]    = useState([]);
  const [repairs,  setRepairs]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editId,   setEditId]   = useState(null);
  const [editType, setEditType] = useState("");  // "import" | "sale" | "repair"
  const [form, setForm] = useState({ tracking_code:"", shipping_unit:"", shipping_note:"" });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [imp, sale, rep] = await Promise.all([
        Imports.list({ limit:200, sort:"-id" }).catch(()=>[]),
        SaleOrder.list({ limit:200, sort:"-id" }).catch(()=>[]),
        RepairOrder.list({ limit:200, sort:"-id" }).catch(()=>[]),
      ]);
      setImports(imp||[]);
      setSales(sale||[]);
      setRepairs(rep||[]);
    } catch {} finally { setLoading(false); }
  }

  async function saveTracking() {
    try {
      const updates = {
        tracking_code: form.tracking_code,
        shipping_unit: form.shipping_unit,
        shipping_note: form.shipping_note,
      };
      if (editType === "import") {
        const imp = imports.find(i=>i.id===editId);
        await Imports.update(editId, updates);
        logAction(user, "update", "stock_import", editId,
          `Cập nhật vận đơn: ${form.shipping_unit||""} ${form.tracking_code||""}`);
        setImports(p => p.map(i => i.id===editId ? {...i, ...updates} : i));
      } else if (editType === "sale") {
        await SaleOrder.update(editId, { ...updates, ship_status: form.tracking_code ? "shipped" : "" });
        logAction(user, "update", "sale_order", editId,
          `Giao hàng: ${form.shipping_unit||""} ${form.tracking_code||""}`);
        setSales(p => p.map(s => s.id===editId ? {...s, ...updates, ship_status: form.tracking_code ? "shipped" : ""} : s));
      } else if (editType === "repair") {
        await RepairOrder.update(editId, { ...updates, ship_status: form.tracking_code ? "shipped" : "" });
        logAction(user, "update", "repair_order", editId,
          `Gửi trả bảo hành: ${form.shipping_unit||""} ${form.tracking_code||""}`);
        setRepairs(p => p.map(r => r.id===editId ? {...r, ...updates, ship_status: form.tracking_code ? "shipped" : ""} : r));
      }
      setEditId(null); setEditType("");
      alert("✅ Đã cập nhật vận đơn");
    } catch(e) { alert("Lỗi: "+e.message); }
  }

  function startEdit(id, type, record) {
    setEditId(id); setEditType(type);
    setForm({
      tracking_code: record.tracking_code || "",
      shipping_unit: record.shipping_unit || "",
      shipping_note: record.shipping_note || "",
    });
  }

  // ── Filter logic ──
  const inboundList  = imports;  // all imports
  const saleShipList = sales.filter(s => s.tracking_code || s.ship_status === "shipped" || ["completed","pending_payment"].includes(s.status));
  const repairShipList = repairs.filter(r => r.tracking_code || r.ship_status === "shipped" || ["done","handover","completed"].includes(r.status));

  const STS_IN = { confirmed:"✅ Đã nhận", pending:"🚚 Đang vận chuyển", draft:"📝 Nháp" };
  const STC_IN = { confirmed:"#059669", pending:"#d97706", draft:"#9ca3af" };
  const STS_OUT = { shipped:"📦 Đã gửi", delivered:"✅ Đã giao", "":"⏳ Chưa gửi" };

  const TABS = [
    { key:"inbound",  label:"📥 Nhận hàng",  count: inboundList.length },
    { key:"sale",     label:"📤 Giao bán",   count: saleShipList.length },
    { key:"warranty", label:"🔧 Trả bảo hành", count: repairShipList.length },
  ];

  function renderTrackingForm() {
    return (
      <div style={{ marginTop:10, paddingTop:10, borderTop:"1px dashed #e5e7eb" }}>
        {[
          { ph:"Mã vận đơn (GHN123456...)",        key:"tracking_code" },
          { ph:"Đơn vị vận chuyển (GHN, GHTK...)", key:"shipping_unit" },
          { ph:"Ghi chú vận đơn",                   key:"shipping_note" },
        ].map(f=>(
          <input key={f.key} placeholder={f.ph} value={form[f.key]}
            onChange={e=>setForm(v=>({...v,[f.key]:e.target.value}))}
            style={{ width:"100%", border:"1.5px solid #e5e7eb", borderRadius:8, padding:"8px 10px", fontSize:13, marginBottom:6, boxSizing:"border-box" }}/>
        ))}
        <button onClick={saveTracking}
          style={{ background:"#4f46e5", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", fontSize:13, cursor:"pointer", width:"100%" }}>
          💾 Lưu vận đơn
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding:"16px 14px 100px" }}>
      {/* Tab switcher */}
      <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto" }}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>{ setTab(t.key); setEditId(null); }}
            style={{
              flex:"0 0 auto", padding:"8px 14px", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer",
              border: tab===t.key ? "2px solid #4f46e5" : "1.5px solid #e5e7eb",
              background: tab===t.key ? "#eef2ff" : "#fff",
              color: tab===t.key ? "#4f46e5" : "#6b7280",
              display:"flex", alignItems:"center", gap:6,
            }}>
            {t.label}
            <span style={{ background: tab===t.key ? "#4f46e5" : "#e5e7eb", color:"#fff", borderRadius:10, padding:"1px 7px", fontSize:11 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign:"center", padding:20, color:"#9ca3af" }}>Đang tải...</div>}

      {/* ── INBOUND: Nhận hàng từ NCC ── */}
      {!loading && tab==="inbound" && inboundList.map(imp=>{
        const isEdit = editId===imp.id && editType==="import";
        return (
          <div key={imp.id} style={{ background:"#fff", borderRadius:10, padding:14, marginBottom:10, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>{imp.import_code||imp.id}</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>{imp.supplier_name||"Chưa có NCC"} · {imp.total_items||0} mặt hàng</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                <span style={{ fontSize:11, fontWeight:700, color:STC_IN[imp.status]||"#9ca3af", background:"#f3f4f6", padding:"2px 8px", borderRadius:6 }}>
                  {STS_IN[imp.status]||imp.status||"Nháp"}
                </span>
                <button onClick={()=>{ isEdit ? (setEditId(null), setEditType("")) : startEdit(imp.id,"import",imp) }}
                  style={{ fontSize:11, color:"#4f46e5", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>
                  {isEdit?"Đóng":"✏️ Sửa vận đơn"}
                </button>
              </div>
            </div>
            {imp.tracking_code && (
              <div style={{ fontSize:13, color:"#4f46e5", marginTop:6 }}>
                📦 {imp.shipping_unit||""} — <b>{imp.tracking_code}</b>
                {imp.received_date && <span style={{ color:"#059669" }}> · Nhận {new Date(imp.received_date).toLocaleDateString("vi-VN")}</span>}
              </div>
            )}
            {isEdit && renderTrackingForm()}
          </div>
        );
      })}

      {/* ── OUTBOUND SALE: Giao bán cho khách xa ── */}
      {!loading && tab==="sale" && saleShipList.map(so=>{
        const isEdit = editId===so.id && editType==="sale";
        const shipSts = STS_OUT[so.ship_status] || STS_OUT[""];
        return (
          <div key={so.id} style={{ background:"#fff", borderRadius:10, padding:14, marginBottom:10, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>{so.order_code||so.id}</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>
                  {so.customer_name||"Khách lẻ"}{so.customer_phone ? " · "+so.customer_phone : ""}
                </div>
                <div style={{ fontSize:11, color:"#059669", marginTop:2 }}>{(so.total||0).toLocaleString("vi-VN")}đ</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                <span style={{ fontSize:11, fontWeight:700, color: so.ship_status==="shipped" ? "#0369a1" : "#9ca3af", background:"#f3f4f6", padding:"2px 8px", borderRadius:6 }}>
                  {shipSts}
                </span>
                <button onClick={()=>{ isEdit ? (setEditId(null), setEditType("")) : startEdit(so.id,"sale",so) }}
                  style={{ fontSize:11, color:"#4f46e5", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>
                  {isEdit?"Đóng":"✏️ Cập nhật vận đơn"}
                </button>
              </div>
            </div>
            {so.tracking_code && (
              <div style={{ fontSize:13, color:"#0369a1", marginTop:6 }}>
                📦 {so.shipping_unit||""} — <b>{so.tracking_code}</b>
                {so.shipping_note && <span style={{ color:"#6b7280" }}> · {so.shipping_note}</span>}
              </div>
            )}
            {!so.tracking_code && !isEdit && (
              <div style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>⏳ Chưa có vận đơn — nhấn "Cập nhật vận đơn" để thêm</div>
            )}
            {isEdit && renderTrackingForm()}
          </div>
        );
      })}

      {/* ── OUTBOUND WARRANTY: Trả bảo hành cho khách ── */}
      {!loading && tab==="warranty" && repairShipList.map(ro=>{
        const isEdit = editId===ro.id && editType==="repair";
        const shipSts = STS_OUT[ro.ship_status] || STS_OUT[""];
        return (
          <div key={ro.id} style={{ background:"#fff", borderRadius:10, padding:14, marginBottom:10, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>{ro.order_code||ro.id}</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>
                  {ro.customer_name||"Khách"}{ro.customer_phone ? " · "+ro.customer_phone : ""}
                </div>
                <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>
                  {ro.device_name||""} {ro.device_model||""} · {ro.status||""}
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                <span style={{ fontSize:11, fontWeight:700, color: ro.ship_status==="shipped" ? "#0369a1" : "#9ca3af", background:"#f3f4f6", padding:"2px 8px", borderRadius:6 }}>
                  {shipSts}
                </span>
                <button onClick={()=>{ isEdit ? (setEditId(null), setEditType("")) : startEdit(ro.id,"repair",ro) }}
                  style={{ fontSize:11, color:"#4f46e5", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>
                  {isEdit?"Đóng":"✏️ Cập nhật vận đơn"}
                </button>
              </div>
            </div>
            {ro.tracking_code && (
              <div style={{ fontSize:13, color:"#0369a1", marginTop:6 }}>
                📦 {ro.shipping_unit||""} — <b>{ro.tracking_code}</b>
                {ro.shipping_note && <span style={{ color:"#6b7280" }}> · {ro.shipping_note}</span>}
              </div>
            )}
            {!ro.tracking_code && !isEdit && (
              <div style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>⏳ Chưa có vận đơn — nhấn "Cập nhật vận đơn" để gửi trả</div>
            )}
            {isEdit && renderTrackingForm()}
          </div>
        );
      })}

      {!loading && (
        (tab==="inbound" && inboundList.length===0) ||
        (tab==="sale" && saleShipList.length===0) ||
        (tab==="warranty" && repairShipList.length===0)
      ) && <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>Chưa có đơn nào</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StockReportTab — Báo cáo tồn kho tổng hợp
// ─────────────────────────────────────────────────────────────────────────────
function StockReportTab({ warehouses }) {
  const [ledgers,   setLedgers]   = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [wh,        setWh]        = useState("");

  useEffect(() => { load(); }, [wh]);

  async function load() {
    setLoading(true);
    try {
      const filterStr = wh ? `warehouse_id='${wh}'` : "";
      const [l, m] = await Promise.allSettled([
        filterStr ? Ledger.filter(filterStr, { limit:1000 }) : Ledger.list({ limit:1000 }),
        filterStr ? Move.filter(filterStr, { limit:500 }) : Move.list({ limit:500 }),
      ]);
      setLedgers(l.status==="fulfilled" ? (l.value||[]) : null);
      setMovements(m.status==="fulfilled" ? (m.value||[]) : []);
    } catch(e) {
      console.error("StockReportTab load error:", e);
      setLedgers(null);
      setMovements([]);
    }
    setLoading(false);
  }

  const filtLedgers  = wh ? (ledgers||[]).filter(l=>l.warehouse_id===wh) : (ledgers||[]);
  const totalValue   = filtLedgers.reduce((s,l)=>s+(l.qty_on_hand||0)*(l.cost_price||0), 0);
  const lowStock     = filtLedgers.filter(l=>(l.qty_on_hand||0)<=(l.min_qty||2) && (l.qty_on_hand||0)>=0);
  const cutoff       = new Date(); cutoff.setDate(cutoff.getDate()-30);
  const recentExp    = movements.filter(m=>["export","use","defect"].includes(m.movement_type) && new Date(m.created_date||m.created)>=cutoff);
  const topParts     = {};
  recentExp.forEach(m=>{ const k=m.part_name||"?"; if(!topParts[k]) topParts[k]={name:k,qty:0}; topParts[k].qty+=Math.abs(m.qty_change||0); });
  const topList      = Object.values(topParts).sort((a,b)=>b.qty-a.qty).slice(0,10);

  function exportReport() {
    const BOM = "﻿";
    // Wrap mỗi field trong double-quote để tránh comma trong tên LK làm hỏng CSV
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["BÁO CÁO TỒN KHO — "+new Date().toLocaleDateString("vi-VN")],
      ["Tổng giá trị", totalValue],
      [],
      ["CHI TIẾT TỒN KHO"],
      ["Kho","Tên LK","SKU","Tồn thực","Reserve","Khả dụng","Tối thiểu","Giá vốn","Giá trị"],
      ...filtLedgers.map(l=>[
        l.warehouse_name||"", l.part_name||"", l.sku||"",
        l.qty_on_hand||0, l.qty_reserved||0, l.qty_available||0,
        l.min_qty||0, l.cost_price||0, (l.qty_on_hand||0)*(l.cost_price||0),
      ]),
      [],
      ["TOP LK XUẤT NHIỀU (30 ngày)"],
      ["Tên LK","Tổng xuất"],
      ...topList.map(p=>[p.name, p.qty]),
    ];
    const csv = rows.map(r => r.map(q).join(",")).join("\n");
    const blob = new Blob([BOM+csv], { type:"text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download = "TonKho_"+new Date().toISOString().slice(0,10)+".csv"; a.click();
  }

  return (
    <div style={{ padding:"16px 14px 100px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ fontWeight:800, fontSize:17 }}>📊 Báo cáo tồn kho</div>
        <button onClick={exportReport}
          style={{ background:"#4f46e5", color:"#fff", border:"none", borderRadius:8, padding:"7px 12px", fontSize:13, cursor:"pointer" }}>
          ⬇️ Xuất CSV
        </button>
      </div>
      <select value={wh} onChange={e=>setWh(e.target.value)}
        style={{ width:"100%", border:"1.5px solid #e5e7eb", borderRadius:8, padding:"8px 10px", fontSize:13, marginBottom:12 }}>
        <option value="">Tất cả kho</option>
        {warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      {loading && <div style={{ textAlign:"center", padding:20, color:"#9ca3af" }}>Đang tải...</div>}
      {!loading && (<>
        {ledgers === null && (
          <div style={{ textAlign:"center", padding:20, color:"#ef4444", fontWeight:600 }}>
            ⚠️ Không tải được dữ liệu — kiểm tra kết nối PocketBase.
          </div>
        )}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
          <div style={{ background:"#eef2ff", borderRadius:10, padding:12, textAlign:"center" }}>
            <div style={{ fontWeight:700, color:"#4f46e5", fontSize:12 }}>Tổng giá trị kho</div>
            <div style={{ fontWeight:900, fontSize:16, color:"#4f46e5" }}>{Number(totalValue).toLocaleString("vi-VN")}đ</div>
          </div>
          <div style={{ background:"#fee2e2", borderRadius:10, padding:12, textAlign:"center" }}>
            <div style={{ fontWeight:700, color:"#dc2626", fontSize:12 }}>Sắp hết hàng</div>
            <div style={{ fontWeight:900, fontSize:20, color:"#dc2626" }}>{lowStock.length}</div>
          </div>
        </div>

        {lowStock.length > 0 && (<>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:8, color:"#dc2626" }}>🔴 Cảnh báo sắp hết</div>
          {lowStock.map(l=>(
            <div key={l.id} style={{ background:"#fee2e2", borderRadius:8, padding:10, marginBottom:6, border:"1px solid #fca5a5" }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontWeight:700, fontSize:13 }}>{l.part_name}</span>
                <span style={{ fontWeight:700, color:"#dc2626" }}>Tồn: {l.qty_on_hand||0}</span>
              </div>
              <div style={{ fontSize:12, color:"#6b7280" }}>{l.warehouse_name} · Tối thiểu: {l.min_qty||2}</div>
            </div>
          ))}
        </>)}

        {topList.length > 0 && (<>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:8, marginTop:16, color:"#059669" }}>🏆 LK xuất nhiều nhất (30 ngày)</div>
          {topList.map((p,i)=>(
            <div key={p.name} style={{ background:"#fff", borderRadius:8, padding:10, marginBottom:6, boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontWeight:700, fontSize:13 }}>#{i+1} {p.name}</span>
                <span style={{ fontSize:13, color:"#059669", fontWeight:700 }}>x{p.qty}</span>
              </div>
              <div style={{ marginTop:4, height:6, background:"#f3f4f6", borderRadius:3 }}>
                <div style={{ height:"100%", background:"#059669", borderRadius:3, width:`${(p.qty/(topList[0]?.qty||1)*100).toFixed(0)}%` }}/>
              </div>
            </div>
          ))}
        </>)}
      </>)}
    </div>
  );
}


// ── Shared header cho các trang kho tách riêng ──
function WhPageHeader({ icon, title, subtitle }) {
  return (
    <div style={{ background:"linear-gradient(135deg,#4338ca,#6366f1)", padding:"14px 16px", borderRadius:"0 0 16px 16px", marginBottom:0 }}>
      <div style={{ fontWeight:800, fontSize:17, color:"#fff" }}>{icon} {title}</div>
      {subtitle && <div style={{ fontSize:12, color:"#e0e7ff", marginTop:2 }}>{subtitle}</div>}
    </div>
  );
}

// ── Standalone page wrappers (để render trong sidebar, không cần WarehouseManager full) ──
export function WhLedgerPage({ user }) {
  const toast = useToast();
  return (<><WhPageHeader icon="📊" title="Tồn kho" subtitle="Xem tồn thực tế theo vị trí kệ" /><StockLedgerTab user={user} toast={toast} /><toast.ToastContainer /></>);
}
export function WhDefectPage({ user }) {
  const [whList, setWhList] = useState([]);
  useEffect(()=>{ WH.list({limit:100}).then(d=>setWhList(d||[])).catch(()=>{}); },[]);
  return (<><WhPageHeader icon="⚠️" title="LK lỗi / RMA" subtitle="Linh kiện lỗi & Trả hàng NCC" /><DefectTab user={user} warehouses={whList} /></>);
}
export function WhShippingPage({ user }) {
  return (<><WhPageHeader icon="🚚" title="Vận đơn" subtitle="Nhận hàng NCC · Giao bán · Trả bảo hành" /><ShippingTab user={user} /></>);
}
export function WhReportPage({ user }) {
  const [whList, setWhList] = useState([]);
  useEffect(()=>{ WH.list({limit:100}).then(d=>setWhList(d||[])).catch(()=>{}); },[]);
  return (<><WhPageHeader icon="📊" title="Báo cáo kho" subtitle="Tổng hợp tồn kho & cảnh báo hết hàng" /><StockReportTab warehouses={whList} /></>);
}

export default function WarehouseManager({ user, onBack, initialTab }) {
  const _initTab = initialTab || sessionStorage.getItem("wm_initial_tab") || "warehouses";
  const [tab, setTab]       = useState(_initTab);
  useEffect(() => { sessionStorage.removeItem("wm_initial_tab"); }, []);
  const [whList, setWhList] = useState([]);
  const toast = useToast();

  useEffect(()=>{ WH.list({limit:100}).then(d=>setWhList(d||[])).catch(()=>{}); },[]);

  const TABS = [
    { key:"warehouses", icon:"🏭", label:"Danh sách kho" },
    { key:"zones",      icon:"📦", label:"Khu vực & Kệ" },
    { key:"transfer",   icon:"🔄", label:"Chuyển kho" },
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
        {tab==="transfer"   && <TransferTab user={user} toast={toast} />}
      </div>

      <toast.ToastContainer />
    </div>
  );
}
