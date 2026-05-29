/* StockCountPage.jsx — Kiểm kho đầy đủ (GĐ2-#7) */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { SparePart, Warehouse, WarehouseZone,
         StockLedger, StockMovement,
         StockCount, StockCountItem } from "./pb.jsx";

// ── Helpers ────────────────────────────────────────────────
function fmtMoney(n) { return (n||0).toLocaleString("vi-VN") + "đ"; }
function fmtDate(ds) {
  if (!ds) return "";
  const d = new Date(ds);
  return String(d.getDate()).padStart(2,"0") + "/" +
         String(d.getMonth()+1).padStart(2,"0") + "/" + d.getFullYear();
}
function fmtDateTime(ds) {
  if (!ds) return "";
  const d = new Date(ds);
  return fmtDate(ds) + " " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
}
function genCode() {
  const d = new Date();
  const ymd = String(d.getFullYear()).slice(2) +
              String(d.getMonth()+1).padStart(2,"0") +
              String(d.getDate()).padStart(2,"0");
  return "KK-" + ymd + "-" + String(Math.floor(Math.random()*9999)).padStart(4,"0");
}
function isThisMonth(ds) {
  if (!ds) return false;
  const d = new Date(ds), n = new Date();
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth();
}

const STATUS_LABEL = { draft:"📝 Nháp", counting:"🔍 Đang kiểm", completed:"⏳ Chờ duyệt", approved:"✅ Đã duyệt" };
const STATUS_COLOR = { draft:"#6b7280", counting:"#2563eb", completed:"#d97706", approved:"#059669" };
const SCOPE_LABEL  = { full:"Toàn bộ kho", zone:"Theo khu vực", category:"Theo danh mục" };
const MGMT_ROLES   = ["manager","admin","owner"];
const WH_ROLES     = ["warehouse","manager","admin","owner"];

// ── Shared styles ──────────────────────────────────────────
const INP = { width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb",
  padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box" };
const SEL = { ...{}, width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb",
  padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box", background:"#fff" };
const BTN = (bg="#059669", color="#fff") => ({
  height:42, padding:"0 18px", background:bg, color, border:"none",
  borderRadius:10, fontWeight:800, fontSize:13, cursor:"pointer", whiteSpace:"nowrap",
});
const TH = { padding:"10px 12px", background:"#f9fafb", fontWeight:800, fontSize:11,
  color:"#374151", textAlign:"left", borderBottom:"1.5px solid #e5e7eb", whiteSpace:"nowrap" };
const TD = { padding:"10px 12px", fontSize:13, borderBottom:"1px solid #f3f4f6", verticalAlign:"middle" };

// ── Toast ──────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  const bg = type==="error" ? "#dc2626" : type==="warn" ? "#d97706" : "#059669";
  return (
    <div style={{ position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)",
      background:bg, color:"#fff", borderRadius:14, padding:"12px 24px",
      fontSize:14, fontWeight:700, zIndex:1000, whiteSpace:"nowrap", boxShadow:"0 4px 16px rgba(0,0,0,.2)" }}>
      {msg}
    </div>
  );
}
function useToast() {
  const [state, setState] = useState({ msg:"", type:"ok" });
  const show = (msg, type="ok") => {
    setState({ msg, type });
    setTimeout(() => setState({ msg:"", type:"ok" }), 3000);
  };
  return { state, show };
}

// ── Modal wrapper ──────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:200,
        display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:"#fff", borderRadius:20, width:"100%",
          maxWidth: wide ? 760 : 480, maxHeight:"92vh", overflowY:"auto",
          padding:"20px 20px 28px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div style={{ fontWeight:900, fontSize:16 }}>{title}</div>
          <button onClick={onClose}
            style={{ background:"#f3f4f6", border:"none", borderRadius:99, width:32, height:32, cursor:"pointer", fontSize:18 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SCREEN 1: Danh sách phiếu kiểm kho
// ══════════════════════════════════════════════════════════
function CountList({ user, onOpen, onNew }) {
  const [counts,     setCounts]     = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filterSt,   setFilterSt]  = useState("");
  const [filterWh,   setFilterWh]  = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cs, whs] = await Promise.all([
        StockCount.list({ limit:200, sort:"-created" }),
        Warehouse.list({ limit:50 }),
      ]);
      setCounts(cs||[]);
      setWarehouses(whs||[]);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = counts.filter(c =>
    (!filterSt || c.status===filterSt) &&
    (!filterWh || c.warehouse_id===filterWh)
  );

  const canCreate = WH_ROLES.includes(user?.role);

  return (
    <div style={{ padding:"16px 14px 100px" }}>
      {/* Header + nút tạo */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b" }}>📋 Kiểm kho</div>
        {canCreate && (
          <button onClick={onNew} style={BTN()}>➕ Tạo phiếu</button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
        <select value={filterSt} onChange={e=>setFilterSt(e.target.value)} style={SEL}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterWh} onChange={e=>setFilterWh(e.target.value)} style={SEL}>
          <option value="">Tất cả kho</option>
          {warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign:"center", padding:48, color:"#9ca3af" }}>⏳ Đang tải...</div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:48, color:"#9ca3af", fontSize:13 }}>
          Chưa có phiếu kiểm kho nào
        </div>
      ) : filtered.map(c => {
        const stColor = STATUS_COLOR[c.status]||"#6b7280";
        return (
          <div key={c.id} onClick={()=>onOpen(c)}
            style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb",
              marginBottom:12, padding:"14px 16px", cursor:"pointer",
              borderLeft:"4px solid "+stColor }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontWeight:800, fontSize:14, color:"#1e1b4b" }}>{c.count_code}</div>
                <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>
                  {c.warehouse_name} · {SCOPE_LABEL[c.scope]||c.scope}
                </div>
                <div style={{ fontSize:11, color:"#9ca3af", marginTop:3 }}>
                  {c.started_by_name} · {fmtDate(c.created||c.created_date)}
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <span style={{ fontSize:12, background:stColor+"22", color:stColor,
                  borderRadius:99, padding:"3px 10px", fontWeight:700 }}>
                  {STATUS_LABEL[c.status]||c.status}
                </span>
                {(c.total_discrepancy_qty||0) > 0 && (
                  <div style={{ fontSize:12, color:"#dc2626", fontWeight:700, marginTop:4 }}>
                    ⚠️ Lệch {c.total_discrepancy_qty} SP
                  </div>
                )}
              </div>
            </div>
            {/* Progress */}
            {c.status==="counting" && c.total_locations > 0 && (
              <div style={{ marginTop:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#6b7280", marginBottom:4 }}>
                  <span>Tiến độ</span>
                  <span>{c.counted_locations||0}/{c.total_locations} SP</span>
                </div>
                <div style={{ height:4, background:"#e5e7eb", borderRadius:2, overflow:"hidden" }}>
                  <div style={{ height:"100%", background:"#059669", borderRadius:2,
                    width:Math.round((c.counted_locations||0)/(c.total_locations||1)*100)+"%" }} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SCREEN 2: Tạo phiếu mới
// ══════════════════════════════════════════════════════════
function CreateCountModal({ user, onClose, onCreated }) {
  const [warehouses,  setWarehouses]  = useState([]);
  const [zones,       setZones]       = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [form,        setForm]        = useState({ warehouse_id:"", scope:"full", zone_id:"", category:"", note:"" });
  const [submitting,  setSubmitting]  = useState(false);
  const toast = useToast();

  useEffect(() => {
    Promise.all([
      Warehouse.list({ limit:50 }),
      SparePart.list({ limit:500 }),
    ]).then(([whs, parts]) => {
      setWarehouses(whs||[]);
      const cats = [...new Set((parts||[]).filter(p=>p.category).map(p=>p.category))];
      setCategories(cats);
    });
  }, []);

  useEffect(() => {
    if (form.warehouse_id && form.scope==="zone") {
      WarehouseZone.list({ limit:100 }).then(zs => {
        setZones((zs||[]).filter(z=>z.warehouse_id===form.warehouse_id));
      });
    }
  }, [form.warehouse_id, form.scope]);

  async function handleCreate() {
    if (!form.warehouse_id) { toast.show("Vui lòng chọn kho","error"); return; }
    if (form.scope==="zone" && !form.zone_id) { toast.show("Vui lòng chọn khu vực","error"); return; }
    if (form.scope==="category" && !form.category) { toast.show("Vui lòng chọn danh mục","error"); return; }
    setSubmitting(true);
    try {
      const wh = warehouses.find(w=>w.id===form.warehouse_id);
      const zone = zones.find(z=>z.id===form.zone_id);
      const code = genCode();

      // Lấy danh sách product_catalog theo scope
      let parts = [];
      const allParts = await SparePart.list({ limit:500 });
      const activeParts = (allParts||[]).filter(p=>p.is_active!==false);
      if (form.scope==="full")     parts = activeParts;
      else if (form.scope==="category") parts = activeParts.filter(p=>p.category===form.category);
      else parts = activeParts; // zone: lấy tất cả (lọc theo ledger sau)

      if (parts.length===0) { toast.show("Không có linh kiện nào để kiểm","warn"); setSubmitting(false); return; }

      // Tạo phiếu kiểm
      const sc = await StockCount.create({
        count_code:   code,
        warehouse_id: form.warehouse_id,
        warehouse_name: wh?.name||"",
        zone_id:      form.zone_id||"",
        zone_name:    zone?.name||"",
        scope:        form.scope,
        status:       "counting",
        total_locations:    parts.length,
        counted_locations:  0,
        total_discrepancy_qty:   0,
        total_discrepancy_value: 0,
        note:            form.note||"",
        started_by_id:   user.id||"",
        started_by_name: user.full_name||user.name||"",
      });

      // Lấy stock_ledger để lấy qty_on_hand theo kho
      let ledgerMap = {};
      try {
        const ledgers = await StockLedger.list({ limit:1000 });
        (ledgers||[]).filter(l=>l.warehouse_id===form.warehouse_id)
                     .forEach(l=>{ ledgerMap[l.part_id] = l; });
      } catch {}

      // Tạo stock_count_items (batch, tối đa 20 cùng lúc)
      const BATCH = 20;
      for (let i=0; i<parts.length; i+=BATCH) {
        await Promise.all(parts.slice(i,i+BATCH).map(p => {
          const ledger   = ledgerMap[p.id];
          const qtySystem = ledger ? (ledger.qty_on_hand||0) : (p.stock_qty||0);
          return StockCountItem.create({
            count_id:   sc.id,
            count_code: code,
            part_id:    p.id,
            part_name:  p.name,
            sku:        p.sku||"",
            qty_system: qtySystem,
            qty_actual: 0,
            qty_diff:   0,
            unit_price: p.cost_price||p.price||0,
            diff_value: 0,
            status:     "pending",
          });
        }));
      }

      toast.show("✅ Đã tạo phiếu kiểm " + code);
      setTimeout(() => onCreated(sc), 800);
    } catch(e) {
      toast.show("❌ Lỗi: "+e.message, "error");
    }
    setSubmitting(false);
  }

  const wh = warehouses.find(w=>w.id===form.warehouse_id);

  return (
    <Modal title="📋 Tạo phiếu kiểm kho mới" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Kho cần kiểm *</label>
          <select value={form.warehouse_id} onChange={e=>setForm(p=>({...p,warehouse_id:e.target.value,zone_id:""}))} style={SEL}>
            <option value="">-- Chọn kho --</option>
            {warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:8 }}>Phạm vi kiểm *</label>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[["full","🏭 Toàn bộ kho — Kiểm tất cả linh kiện"],
              ["zone","📦 Theo khu vực — Chọn zone cụ thể"],
              ["category","🏷️ Theo danh mục — Lọc theo loại SP"]].map(([v,l])=>(
              <label key={v} style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer",
                padding:"10px 14px", borderRadius:10, border:"1.5px solid "+(form.scope===v?"#059669":"#e5e7eb"),
                background:form.scope===v?"#f0fdf4":"#f9fafb" }}>
                <input type="radio" name="scope" value={v} checked={form.scope===v}
                  onChange={()=>setForm(p=>({...p,scope:v,zone_id:"",category:""}))}
                  style={{ accentColor:"#059669" }} />
                <span style={{ fontSize:13, fontWeight:form.scope===v?700:400 }}>{l}</span>
              </label>
            ))}
          </div>
        </div>

        {form.scope==="zone" && (
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Khu vực *</label>
            <select value={form.zone_id} onChange={e=>setForm(p=>({...p,zone_id:e.target.value}))} style={SEL}>
              <option value="">-- Chọn khu vực --</option>
              {zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
            {zones.length===0 && form.warehouse_id && (
              <div style={{ fontSize:11, color:"#d97706", marginTop:4 }}>⚠️ Kho này chưa có khu vực nào</div>
            )}
          </div>
        )}

        {form.scope==="category" && (
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Danh mục *</label>
            <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} style={SEL}>
              <option value="">-- Chọn danh mục --</option>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        <div>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>Ghi chú</label>
          <textarea value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))}
            placeholder="Ghi chú kiểm kho định kỳ..."
            style={{ ...INP, height:72, resize:"none", paddingTop:10 }} />
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:4 }}>
          <button onClick={onClose}
            style={{ ...BTN("#f3f4f6","#374151"), fontWeight:600 }}>Hủy</button>
          <button onClick={handleCreate} disabled={submitting}
            style={{ ...BTN(), opacity:submitting?0.7:1 }}>
            {submitting ? "⏳ Đang tạo..." : "🔍 Bắt đầu kiểm kho"}
          </button>
        </div>
      </div>
      <Toast {...toast.state} />
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════
// SCREEN 3: Thực hiện kiểm kho (status=counting)
// ══════════════════════════════════════════════════════════
function CountingScreen({ count: initCount, user, onBack, onRefresh }) {
  const [count,      setCount]      = useState(initCount);
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState("all"); // all/pending/counted/diff
  const [search,     setSearch]     = useState("");
  const [saving,     setSaving]     = useState({});
  const [qtyInputs,  setQtyInputs]  = useState({});
  const toast = useToast();

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const list = await StockCountItem.list({ limit:1000, sort:"part_name" });
      const mine = (list||[]).filter(i=>i.count_id===count.id);
      setItems(mine);
      // Init inputs từ qty_actual đã lưu
      const inputs = {};
      mine.forEach(i => { inputs[i.id] = i.status==="counted" ? String(i.qty_actual) : ""; });
      setQtyInputs(inputs);
    } catch {}
    setLoading(false);
  }, [count.id]);

  useEffect(() => { loadItems(); }, [loadItems]);

  function handleQtyChange(itemId, val) {
    setQtyInputs(prev => ({ ...prev, [itemId]: val }));
  }

  async function confirmItem(item) {
    const rawVal = qtyInputs[item.id];
    if (rawVal === "" || rawVal === undefined) {
      toast.show("⚠️ Nhập số lượng thực tế", "warn"); return;
    }
    const qtyActual = Number(rawVal);
    if (isNaN(qtyActual) || qtyActual < 0) {
      toast.show("⚠️ Số lượng không hợp lệ", "warn"); return;
    }
    const diff      = qtyActual - (item.qty_system||0);
    const diffValue = diff * (item.unit_price||0);
    setSaving(prev => ({ ...prev, [item.id]: true }));
    try {
      await StockCountItem.update(item.id, {
        qty_actual:   qtyActual,
        qty_diff:     diff,
        diff_value:   diffValue,
        status:       "counted",
        counted_by_id:   user.id||"",
        counted_by_name: user.full_name||user.name||"",
        counted_at:      new Date().toISOString(),
      });
      // Update local state
      setItems(prev => prev.map(i => i.id===item.id
        ? {...i, qty_actual:qtyActual, qty_diff:diff, diff_value:diffValue, status:"counted",
           counted_by_name:user.full_name||user.name||""}
        : i
      ));
      // Update counted_locations trên phiếu
      const newItems = items.map(i => i.id===item.id ? {...i, status:"counted"} : i);
      const countedCnt = newItems.filter(i=>i.status==="counted").length;
      await StockCount.update(count.id, { counted_locations: countedCnt });
      setCount(prev => ({ ...prev, counted_locations: countedCnt }));
      toast.show("✅ Đã xác nhận");
    } catch(e) { toast.show("❌ "+e.message, "error"); }
    setSaving(prev => ({ ...prev, [item.id]: false }));
  }

  async function finishCounting() {
    const pending = items.filter(i=>i.status==="pending");
    if (pending.length > 0) {
      if (!window.confirm(`Còn ${pending.length} SP chưa kiểm. Vẫn hoàn tất?`)) return;
    }
    try {
      const totalDiffQty = items.reduce((s,i)=>s+Math.abs(i.qty_diff||0), 0);
      const totalDiffVal = items.reduce((s,i)=>s+Math.abs(i.diff_value||0), 0);
      await StockCount.update(count.id, {
        status: "completed",
        counted_locations: items.filter(i=>i.status==="counted").length,
        total_discrepancy_qty:   totalDiffQty,
        total_discrepancy_value: totalDiffVal,
      });
      toast.show("✅ Đã hoàn tất phiếu kiểm — chờ duyệt");
      setTimeout(() => { onRefresh(); onBack(); }, 1000);
    } catch(e) { toast.show("❌ "+e.message, "error"); }
  }

  // Filter & search
  const displayItems = items.filter(item => {
    const q = search.toLowerCase();
    const matchSearch = !q || (item.part_name||"").toLowerCase().includes(q) || (item.sku||"").toLowerCase().includes(q);
    const matchFilter =
      filter==="all"     ? true :
      filter==="pending" ? item.status==="pending" :
      filter==="counted" ? item.status==="counted" :
      filter==="diff"    ? (item.status==="counted" && item.qty_diff!==0) : true;
    return matchSearch && matchFilter;
  });

  const countedCnt  = items.filter(i=>i.status==="counted").length;
  const diffCnt     = items.filter(i=>i.status==="counted" && i.qty_diff!==0).length;
  const pct         = items.length ? Math.round(countedCnt/items.length*100) : 0;

  function itemBadge(item) {
    if (item.status==="pending") return { label:"Chưa kiểm", bg:"#f3f4f6", cl:"#6b7280" };
    if (item.qty_diff===0)       return { label:"✅ Khớp",   bg:"#dcfce7", cl:"#059669" };
    if (item.qty_diff < 0)       return { label:"🔴 Thiếu",  bg:"#fee2e2", cl:"#dc2626" };
    return                              { label:"🟡 Thừa",   bg:"#fefce8", cl:"#ca8a04" };
  }

  return (
    <div style={{ padding:"14px 14px 100px" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"#374151", padding:"4px 8px" }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:900, fontSize:16, color:"#1e1b4b" }}>{count.count_code}</div>
          <div style={{ fontSize:12, color:"#6b7280" }}>{count.warehouse_name} · {SCOPE_LABEL[count.scope]||count.scope}</div>
        </div>
        <button onClick={finishCounting}
          style={{ ...BTN("#d97706"), fontSize:12, padding:"8px 14px" }}>
          ⏹ Hoàn tất
        </button>
      </div>

      {/* Progress */}
      <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #e5e7eb", padding:"12px 16px", marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#6b7280", marginBottom:6 }}>
          <span>Tiến độ kiểm kho</span>
          <span style={{ fontWeight:800, color:"#059669" }}>{countedCnt}/{items.length} SP · {pct}%</span>
        </div>
        <div style={{ height:8, background:"#e5e7eb", borderRadius:4, overflow:"hidden" }}>
          <div style={{ height:"100%", background:"#059669", borderRadius:4, width:pct+"%", transition:"width .3s" }} />
        </div>
        <div style={{ display:"flex", gap:16, marginTop:8, fontSize:11, color:"#6b7280" }}>
          <span>✅ Khớp: {countedCnt-diffCnt}</span>
          <span>⚠️ Lệch: <b style={{ color:"#dc2626" }}>{diffCnt}</b></span>
          <span>⏳ Chưa kiểm: {items.length-countedCnt}</span>
        </div>
      </div>

      {/* Search + Filter */}
      <div style={{ marginBottom:12 }}>
        <div style={{ position:"relative", marginBottom:8 }}>
          <span className="material-icons"
            style={{ fontFamily:"Material Icons", position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9ca3af", fontSize:18 }}>
            search
          </span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Tìm theo tên SP hoặc SKU..."
            style={{ ...INP, paddingLeft:38 }} />
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {[["all","Tất cả"],["pending","Chưa kiểm"],["counted","Đã kiểm"],["diff","Lệch"]].map(([k,l])=>(
            <button key={k} onClick={()=>setFilter(k)}
              style={{ padding:"6px 12px", borderRadius:99, border:"1.5px solid "+(filter===k?"#059669":"#e5e7eb"),
                background:filter===k?"#059669":"#fff", color:filter===k?"#fff":"#374151",
                fontWeight:filter===k?700:500, fontSize:12, cursor:"pointer" }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Items list */}
      {loading ? (
        <div style={{ textAlign:"center", padding:48, color:"#9ca3af" }}>⏳ Đang tải...</div>
      ) : displayItems.length===0 ? (
        <div style={{ textAlign:"center", padding:32, color:"#9ca3af", fontSize:13 }}>Không có SP nào</div>
      ) : displayItems.map(item => {
        const badge = itemBadge(item);
        const inputVal = qtyInputs[item.id] ?? "";
        const previewDiff = inputVal !== "" && !isNaN(inputVal) && item.status==="pending"
          ? Number(inputVal) - item.qty_system : null;
        return (
          <div key={item.id}
            style={{ background:"#fff", borderRadius:14, border:"1.5px solid #e5e7eb",
              marginBottom:10, padding:"12px 14px",
              borderLeft:"4px solid "+(badge.cl) }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{item.part_name}</div>
                <div style={{ fontSize:11, color:"#6b7280" }}>{item.sku||"—"}</div>
              </div>
              <span style={{ fontSize:11, background:badge.bg, color:badge.cl,
                borderRadius:99, padding:"2px 8px", fontWeight:700, flexShrink:0, marginLeft:8 }}>
                {badge.label}
              </span>
            </div>

            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              {/* Tồn hệ thống */}
              <div style={{ textAlign:"center", minWidth:60 }}>
                <div style={{ fontSize:10, color:"#9ca3af", marginBottom:2 }}>Hệ thống</div>
                <div style={{ fontWeight:800, fontSize:16, color:"#374151" }}>{item.qty_system}</div>
              </div>

              <div style={{ color:"#d1d5db", fontSize:18 }}>→</div>

              {/* Input thực tế */}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:"#9ca3af", marginBottom:2 }}>Thực tế</div>
                {item.status==="counted" ? (
                  <div style={{ fontWeight:900, fontSize:18,
                    color:item.qty_diff===0?"#059669":item.qty_diff<0?"#dc2626":"#d97706" }}>
                    {item.qty_actual}
                  </div>
                ) : (
                  <input type="number" min={0} value={inputVal}
                    onChange={e=>handleQtyChange(item.id, e.target.value)}
                    placeholder="Nhập SL..."
                    style={{ ...INP, height:38, width:"100%", fontSize:16, fontWeight:700,
                      textAlign:"center",
                      borderColor: previewDiff!==null ? (previewDiff===0?"#059669":previewDiff<0?"#dc2626":"#d97706") : "#e5e7eb" }} />
                )}
              </div>

              {/* Preview diff */}
              {item.status==="pending" && previewDiff !== null && (
                <div style={{ minWidth:50, textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#9ca3af", marginBottom:2 }}>Lệch</div>
                  <div style={{ fontWeight:800, fontSize:14,
                    color:previewDiff===0?"#059669":previewDiff<0?"#dc2626":"#d97706" }}>
                    {previewDiff > 0 ? "+" : ""}{previewDiff}
                  </div>
                </div>
              )}

              {/* Diff (đã confirmed) */}
              {item.status==="counted" && (
                <div style={{ minWidth:50, textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#9ca3af", marginBottom:2 }}>Lệch</div>
                  <div style={{ fontWeight:800, fontSize:14,
                    color:item.qty_diff===0?"#059669":item.qty_diff<0?"#dc2626":"#d97706" }}>
                    {item.qty_diff > 0 ? "+" : ""}{item.qty_diff}
                  </div>
                </div>
              )}

              {/* Confirm button */}
              {item.status==="pending" && (
                <button onClick={()=>confirmItem(item)}
                  disabled={saving[item.id] || inputVal===""}
                  style={{ ...BTN(), height:38, padding:"0 12px", fontSize:12,
                    opacity:(saving[item.id]||inputVal==="")?0.5:1 }}>
                  {saving[item.id] ? "..." : "✅"}
                </button>
              )}
            </div>

            {/* Counted info */}
            {item.status==="counted" && (
              <div style={{ fontSize:10, color:"#9ca3af", marginTop:6 }}>
                ✔ {item.counted_by_name} · {fmtDateTime(item.counted_at)}
              </div>
            )}
          </div>
        );
      })}

      <Toast {...toast.state} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SCREEN 4: Duyệt kiểm kho (status=completed)
// ══════════════════════════════════════════════════════════
function ReviewScreen({ count, user, onBack, onRefresh }) {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [approving,setApproving]= useState(false);
  const toast = useToast();

  useEffect(() => {
    StockCountItem.list({ limit:1000, sort:"part_name" }).then(list => {
      setItems((list||[]).filter(i=>i.count_id===count.id));
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, [count.id]);

  const diffItems    = items.filter(i=>i.qty_diff!==0);
  const totalDiffQty = items.reduce((s,i)=>s+Math.abs(i.qty_diff||0),0);
  const totalDiffVal = items.reduce((s,i)=>s+Math.abs(i.diff_value||0),0);

  async function handleApprove() {
    if (!window.confirm("Duyệt và điều chỉnh tồn kho theo kết quả kiểm?")) return;
    setApproving(true);
    try {
      // Điều chỉnh từng item lệch
      const onlyDiff = items.filter(i=>i.qty_diff!==0);
      for (const item of onlyDiff) {
        // 1. Tìm & update stock_ledger
        try {
          const ledgers = await StockLedger.list({ limit:500 });
          const ledger  = (ledgers||[]).find(l=>l.part_id===item.part_id && l.warehouse_id===count.warehouse_id);
          if (ledger) {
            const newQty = (ledger.qty_on_hand||0) + item.qty_diff;
            await StockLedger.update(ledger.id, {
              qty_on_hand:  Math.max(0, newQty),
              qty_available:Math.max(0, newQty - (ledger.qty_reserved||0)),
              last_movement_at: new Date().toISOString(),
            });
          }
        } catch {}
        // 2. Update product_catalog.stock_qty
        try {
          const parts = await SparePart.list({ limit:1 });
          // Dùng filter để tìm đúng part
          const allParts = await SparePart.list({ limit:500 });
          const part = allParts.find(p=>p.id===item.part_id);
          if (part) {
            await SparePart.update(item.part_id, {
              stock_qty: Math.max(0, (part.stock_qty||0) + item.qty_diff),
            });
          }
        } catch {}
        // 3. Tạo stock_movement
        try {
          await StockMovement.create({
            movement_type:  "count_adjust",
            warehouse_id:   count.warehouse_id,
            warehouse_name: count.warehouse_name,
            part_id:        item.part_id,
            part_name:      item.part_name,
            sku:            item.sku||"",
            qty_before:     item.qty_system,
            qty_change:     item.qty_diff,
            qty_after:      item.qty_actual,
            unit_price:     item.unit_price||0,
            ref_type:       "stock_count",
            ref_id:         count.id,
            ref_code:       count.count_code,
            note:           "Điều chỉnh kiểm kho " + count.count_code,
            created_by_id:  user.id||"",
            created_by_name:user.full_name||user.name||"",
          });
        } catch {}
      }
      // 4. Update phiếu kiểm
      await StockCount.update(count.id, {
        status:             "approved",
        approved_by_id:     user.id||"",
        approved_by_name:   user.full_name||user.name||"",
        approved_at:        new Date().toISOString(),
        total_discrepancy_qty:   totalDiffQty,
        total_discrepancy_value: totalDiffVal,
      });
      toast.show("✅ Đã duyệt và điều chỉnh tồn kho thành công!");
      setTimeout(() => { onRefresh(); onBack(); }, 1200);
    } catch(e) {
      toast.show("❌ Lỗi: "+e.message, "error");
    }
    setApproving(false);
  }

  async function handleReject() {
    if (!window.confirm("Từ chối và trả về để kiểm lại?")) return;
    try {
      await StockCount.update(count.id, { status:"counting" });
      toast.show("↩️ Đã trả về kiểm lại");
      setTimeout(() => { onRefresh(); onBack(); }, 800);
    } catch(e) { toast.show("❌ "+e.message,"error"); }
  }

  const isManager = MGMT_ROLES.includes(user?.role);

  return (
    <div style={{ padding:"14px 14px 100px" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"#374151", padding:"4px 8px" }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:900, fontSize:16, color:"#1e1b4b" }}>{count.count_code}</div>
          <div style={{ fontSize:12, color:"#d97706", fontWeight:700 }}>⏳ Chờ phê duyệt</div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
        {[
          { icon:"📦", label:"Tổng SP kiểm", value:items.length,   cl:"#1d4ed8", bg:"#eff6ff", bc:"#bfdbfe" },
          { icon:"⚠️", label:"SP lệch",      value:diffItems.length, cl:"#dc2626", bg:"#fef2f2", bc:"#fca5a5" },
          { icon:"💰", label:"GT lệch",       value:fmtMoney(totalDiffVal), cl:"#d97706", bg:"#fefce8", bc:"#fde68a" },
        ].map((c,i)=>(
          <div key={i} style={{ background:c.bg, border:"2px solid "+c.bc, borderRadius:14, padding:"12px 10px", textAlign:"center" }}>
            <div style={{ fontSize:18 }}>{c.icon}</div>
            <div style={{ fontWeight:900, fontSize:16, color:c.cl, marginTop:2 }}>{c.value}</div>
            <div style={{ fontSize:10, color:"#6b7280", marginTop:3 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Action buttons (chỉ manager/admin) */}
      {isManager && (
        <div style={{ display:"flex", gap:10, marginBottom:16 }}>
          <button onClick={handleReject} disabled={approving}
            style={{ ...BTN("#f3f4f6","#374151"), flex:1 }}>
            ❌ Từ chối
          </button>
          <button onClick={handleApprove} disabled={approving}
            style={{ ...BTN("#059669"), flex:2, opacity:approving?0.7:1 }}>
            {approving ? "⏳ Đang xử lý..." : "✅ Duyệt & Điều chỉnh kho"}
          </button>
        </div>
      )}

      {/* Detail table */}
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid #f3f4f6", fontWeight:800, fontSize:14 }}>
          📋 Chi tiết kiểm kho ({items.length} SP, {diffItems.length} lệch)
        </div>
        {loading ? (
          <div style={{ textAlign:"center", padding:32, color:"#9ca3af" }}>⏳ Đang tải...</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={TH}>Tên SP</th>
                  <th style={TH}>SKU</th>
                  <th style={{...TH,textAlign:"center"}}>Tồn HT</th>
                  <th style={{...TH,textAlign:"center"}}>Tồn TT</th>
                  <th style={{...TH,textAlign:"center"}}>Lệch</th>
                  <th style={{...TH,textAlign:"right"}}>GT Lệch</th>
                </tr>
              </thead>
              <tbody>
                {items.length===0 ? (
                  <tr><td colSpan={6} style={{...TD,textAlign:"center",color:"#9ca3af"}}>Không có dữ liệu</td></tr>
                ) : items.map(item => {
                  const rowBg = item.qty_diff < 0 ? "#fff5f5" : item.qty_diff > 0 ? "#fffbeb" : "";
                  return (
                    <tr key={item.id} style={{ background:rowBg }}>
                      <td style={{...TD,fontWeight:700}}>{item.part_name}</td>
                      <td style={{...TD,fontSize:11,color:"#6b7280"}}>{item.sku||"—"}</td>
                      <td style={{...TD,textAlign:"center"}}>{item.qty_system}</td>
                      <td style={{...TD,textAlign:"center",fontWeight:700}}>{item.qty_actual}</td>
                      <td style={{...TD,textAlign:"center",fontWeight:800,
                        color:item.qty_diff===0?"#059669":item.qty_diff<0?"#dc2626":"#d97706"}}>
                        {item.qty_diff > 0 ? "+" : ""}{item.qty_diff}
                      </td>
                      <td style={{...TD,textAlign:"right",fontWeight:700,
                        color:item.diff_value===0?"#059669":"#dc2626"}}>
                        {item.qty_diff!==0 ? fmtMoney(Math.abs(item.diff_value||0)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Toast {...toast.state} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ROOT: StockCountPage
// ══════════════════════════════════════════════════════════
export default function StockCountPage({ user }) {
  const [screen,    setScreen]    = useState("list");   // list / counting / review
  const [activeCount, setActiveCount] = useState(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [refreshKey,  setRefreshKey]  = useState(0);

  function handleOpenCount(count) {
    setActiveCount(count);
    if (count.status==="counting")   setScreen("counting");
    else if (count.status==="completed" || count.status==="approved")
                                      setScreen("review");
    else                              setScreen("counting"); // draft → bắt đầu đếm
  }

  function handleCreated(newCount) {
    setShowCreate(false);
    setActiveCount(newCount);
    setScreen("counting");
    setRefreshKey(k=>k+1);
  }

  function handleBack() {
    setScreen("list");
    setActiveCount(null);
  }

  function handleRefresh() { setRefreshKey(k=>k+1); }

  if (!user || !WH_ROLES.includes(user.role)) {
    return (
      <div style={{ padding:48, textAlign:"center", color:"#6b7280" }}>
        <div style={{ fontSize:48 }}>🔒</div>
        <div style={{ fontSize:16, fontWeight:700, color:"#dc2626", marginTop:12 }}>Không có quyền truy cập</div>
      </div>
    );
  }

  return (
    <>
      {screen==="list" && (
        <CountList
          key={refreshKey}
          user={user}
          onOpen={handleOpenCount}
          onNew={()=>setShowCreate(true)}
        />
      )}
      {screen==="counting" && activeCount && (
        <CountingScreen
          count={activeCount}
          user={user}
          onBack={handleBack}
          onRefresh={handleRefresh}
        />
      )}
      {screen==="review" && activeCount && (
        <ReviewScreen
          count={activeCount}
          user={user}
          onBack={handleBack}
          onRefresh={handleRefresh}
        />
      )}
      {showCreate && (
        <CreateCountModal
          user={user}
          onClose={()=>setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
