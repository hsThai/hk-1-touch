/**
 * ProductManagerPage.jsx — Danh mục hàng hóa (CRUD)
 * Thêm / sửa / xóa / merge linh kiện — tham chiếu KiotViet Danh sách hàng hóa
 * @version 2026-08-18-v1
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { SparePart, logAction } from "./pb.jsx";

function fmtMoney(n) { return (n||0).toLocaleString("vi-VN") + "đ"; }

const ADMIN_ROLES = ["owner","admin","manager"];

const CATEGORY_LABELS = {
  "BỘ MÁY":              "🔧 Bộ máy",
  "MÁY HÀN, KHÒ, CẤP NGUỒN": "🔥 Máy hàn / Khò / Cấp nguồn",
  "MÁY MÓC KHÁC":         "📦 Máy móc khác",
  "MaAnt":                "📡 MaAnt",
  spare_part:            "🔩 Linh kiện",
  device_stock:          "📱 Máy / Thiết bị",
  screen:                "📱 Màn hình",
  battery:               "🔋 Pin",
  ic:                   "🔩 IC / Bo mạch",
  speaker:              "🔊 Loa / Mic",
  camera:               "📷 Camera",
  housing:              "🖼️ Vỏ máy",
  cable:                "🔌 Cáp / Sạc",
  accessory:            "🎧 Phụ kiện",
  service:              "🔧 Dịch vụ",
  other:                "📦 Khác",
};

const UNIT_OPTIONS = ["Cái", "Bộ", "Hộp", "Cuộn", "Mét", "Kg", "Lít", "Chai", "Gói", "Dây"];

const INP = {
  width: "100%", height: 44, borderRadius: 10, border: "1.5px solid #e5e7eb",
  padding: "0 12px", fontSize: 14, outline: "none", boxSizing: "border-box",
};
const LBL = { fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" };

// ── Add/Edit Modal ──────────────────────────────────────────
function ProductFormModal({ item, onSave, onClose }) {
  const isEdit = !!item?.id;
  const [form, setForm] = useState({
    name: item?.name || "",
    sku: item?.sku || "",
    category: item?.category || "spare_part",
    unit: item?.unit || "Cái",
    price: item?.price || item?.retail_price || 0,
    wholesale_price: item?.wholesale_price || 0,
    cost_price: item?.cost_price || 0,
    stock_qty: item?.stock_qty || 0,
    is_active: item?.is_active ?? true,
    note: item?.note || "",
    serial_imei: item?.serial_imei || "",
  });
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function save() {
    if (!form.name.trim()) { alert("Nhập tên hàng hóa!"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        category: form.category,
        unit: form.unit,
        price: Number(form.price) || 0,
        retail_price: Number(form.price) || 0,
        wholesale_price: Number(form.wholesale_price) || 0,
        cost_price: Number(form.cost_price) || 0,
        stock_qty: Number(form.stock_qty) || 0,
        is_active: form.is_active,
        note: form.note.trim(),
        serial_imei: form.serial_imei.trim(),
      };
      if (isEdit) {
        await SparePart.update(item.id, payload);
        logAction(window.__currentUser, "update", "spare_part", item.id,
          "Sửa hàng hóa: " + payload.name + " — SKU: " + (payload.sku || "—"));
      } else {
        const rec = await SparePart.create(payload);
        logAction(window.__currentUser, "create", "spare_part", rec.id,
          "Tạo hàng hóa mới: " + payload.name + " — SKU: " + (payload.sku || "—"));
      }
      onSave();
      onClose();
    } catch (e) { alert("Lỗi: " + e.message); }
    setSaving(false);
  }

  const margin = Number(form.price) > 0 && Number(form.cost_price) > 0
    ? Math.round((Number(form.price) - Number(form.cost_price)) / Number(form.price) * 100)
    : null;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1000, display:"flex", alignItems:"flex-start", justifyContent:"center", overflowY:"auto", padding:"20px 0" }}>
      <div style={{ background:"#fff", borderRadius:20, padding:28, width:"min(560px,95vw)", margin:"20px 0" }}>
        <div style={{ fontWeight:900, fontSize:18, marginBottom:4, color:"#1e1b4b" }}>
          {isEdit ? "✏️ Sửa hàng hóa" : "➕ Thêm hàng hóa mới"}
        </div>
        <div style={{ fontSize:13, color:"#9ca3af", marginBottom:20 }}>
          {isEdit ? "Đang sửa: " + item.name : "Nhập thông tin để tạo danh mục mới"}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <div style={{ gridColumn:"1 / -1" }}>
            <label style={LBL}>Tên hàng hóa *</label>
            <input value={form.name} onChange={e=>set("name", e.target.value)} placeholder="VD: Pin iPhone 14 Pro"
              style={{ ...INP, borderColor:"#c4b5fd" }} autoFocus />
          </div>

          <div>
            <label style={LBL}>Mã / SKU</label>
            <input value={form.sku} onChange={e=>set("sku", e.target.value)} placeholder="VD: PIN-IP14P"
              style={INP} />
          </div>

          <div>
            <label style={LBL}>IMEI / Serial (nếu có)</label>
            <input value={form.serial_imei} onChange={e=>set("serial_imei", e.target.value)} placeholder="Máy có IMEI"
              style={INP} />
          </div>

          <div>
            <label style={LBL}>Danh mục</label>
            <select value={form.category} onChange={e=>set("category", e.target.value)} style={INP}>
              {Object.entries(CATEGORY_LABELS).map(([k,v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={LBL}>Đơn vị tính</label>
            <select value={form.unit} onChange={e=>set("unit", e.target.value)} style={INP}>
              {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div>
            <label style={{ ...LBL, color:"#059669" }}>Giá bán lẻ (đ)</label>
            <input type="number" min={0} value={form.price} onChange={e=>set("price", e.target.value)}
              style={{ ...INP, borderColor:"#86efac" }} />
            <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{fmtMoney(Number(form.price))}</div>
          </div>

          <div>
            <label style={{ ...LBL, color:"#2563eb" }}>Giá bán sỉ (đ)</label>
            <input type="number" min={0} value={form.wholesale_price} onChange={e=>set("wholesale_price", e.target.value)}
              style={INP} />
            <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{fmtMoney(Number(form.wholesale_price))}</div>
          </div>

          <div>
            <label style={{ ...LBL, color:"#6b7280" }}>Giá vốn / nhập (đ)</label>
            <input type="number" min={0} value={form.cost_price} onChange={e=>set("cost_price", e.target.value)}
              style={INP} />
            <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{fmtMoney(Number(form.cost_price))}</div>
          </div>

          <div>
            <label style={LBL}>Tồn kho hiện tại</label>
            <input type="number" min={0} value={form.stock_qty} onChange={e=>set("stock_qty", e.target.value)}
              style={INP} disabled={isEdit}
              title={isEdit ? "Tồn kho tự động cập nhật khi nhập/xuất hàng" : ""} />
          </div>

          <div style={{ gridColumn:"1 / -1" }}>
            <label style={LBL}>Ghi chú</label>
            <textarea value={form.note} onChange={e=>set("note", e.target.value)} rows={2}
              style={{ ...INP, height:"auto", paddingTop:10 }} placeholder="Mô tả, xuất xứ, bảo hành..." />
          </div>

          {margin != null && (
            <div style={{ gridColumn:"1 / -1", padding:"8px 14px", background:"#f0fdf4", borderRadius:10, fontSize:12 }}>
              💹 Biên lợi nhuận lẻ:{" "}
              <strong style={{ color: margin>=30 ? "#059669" : margin>=10 ? "#ca8a04" : "#dc2626" }}>{margin}%</strong>
              {" "}({fmtMoney(Number(form.price) - Number(form.cost_price))})
            </div>
          )}

          <div style={{ gridColumn:"1 / -1" }}>
            <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
              <input type="checkbox" checked={form.is_active} onChange={e=>set("is_active", e.target.checked)}
                style={{ width:18, height:18, accentColor:"#6366f1" }} />
              <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>Kích hoạt (hiển thị khi bán / nhập)</span>
            </label>
          </div>
        </div>

        <div style={{ display:"flex", gap:10, marginTop:24 }}>
          <button onClick={onClose} style={{ flex:1, height:44, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#fff", fontWeight:700, cursor:"pointer" }}>Huỷ</button>
          <button onClick={save} disabled={saving} style={{ flex:2, height:44, borderRadius:12, border:"none", background:"#6366f1", color:"#fff", fontWeight:800, cursor:"pointer", opacity: saving?0.6:1 }}>
            {saving ? "Đang lưu..." : "💾 Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Merge Modal ─────────────────────────────────────────────
function MergeModal({ source, items, onMerge, onClose }) {
  const [targetId, setTargetId] = useState("");
  const [merging, setMerging] = useState(false);
  const targets = items.filter(i => i.id !== source?.id);

  async function doMerge() {
    if (!targetId) { alert("Chọn hàng hóa đích!"); return; }
    const target = items.find(i => i.id === targetId);
    if (!window.confirm(
      "Gộp \"" + source.name + "\" vào \"" + target.name + "\"?\n\n" +
      "• Tồn kho: " + (source.stock_qty||0) + " + " + (target.stock_qty||0) + " = " + ((source.stock_qty||0)+(target.stock_qty||0)) + "\n" +
      "• Giá sẽ giữ nguyên của hàng đích\n" +
      "• Hàng nguồn sẽ bị XÓA (để tránh trùng lặp)"
    )) return;
    setMerging(true);
    try {
      await SparePart.update(target.id, {
        stock_qty: (Number(source.stock_qty) || 0) + (Number(target.stock_qty) || 0),
      });
      await SparePart.delete(source.id);
      logAction(window.__currentUser, "merge", "spare_part", target.id,
        "Gộp \"" + source.name + "\" (SKU: " + (source.sku||"—") + ") → \"" + target.name + "\" (SKU: " + (target.sku||"—") + ")");
      onMerge();
      onClose();
    } catch (e) { alert("Lỗi: " + e.message); }
    setMerging(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:20, padding:28, width:"min(480px,95vw)" }}>
        <div style={{ fontWeight:900, fontSize:16, marginBottom:4 }}>🔀 Gộp hàng hóa</div>
        <div style={{ fontSize:13, color:"#9ca3af", marginBottom:16 }}>
          Gộp <strong style={{ color:"#1f2937" }}>"{source?.name}"</strong> (SKU: {source?.sku || "—"}) vào hàng hóa khác để loại bỏ trùng lặp.
        </div>
        <label style={LBL}>Chọn hàng hóa đích (giữ lại):</label>
        <select value={targetId} onChange={e=>setTargetId(e.target.value)} style={{ ...INP, height:120 }} size={5}>
          <option value="">— Chọn hàng hóa đích —</option>
          {targets.map(t => (
            <option key={t.id} value={t.id}>{t.name} — SKU: {t.sku || "—"} — Tồn: {t.stock_qty || 0}</option>
          ))}
        </select>
        <div style={{ fontSize:12, color:"#dc2626", marginTop:12, padding:"8px 12px", background:"#fef2f2", borderRadius:8 }}>
          ⚠️ Hàng nguồn sẽ bị xóa. Tồn kho sẽ cộng sang hàng đích.
        </div>
        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ flex:1, height:44, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#fff", fontWeight:700, cursor:"pointer" }}>Huỷ</button>
          <button onClick={doMerge} disabled={merging || !targetId} style={{ flex:2, height:44, borderRadius:12, border:"none", background:"#f59e0b", color:"#fff", fontWeight:800, cursor:"pointer", opacity: (merging || !targetId) ? 0.5 : 1 }}>
            {merging ? "Đang gộp..." : "🔀 Gộp"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function ProductManagerPage({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [merging, setMerging] = useState(null);

  const isAdmin = ADMIN_ROLES.includes(user?.role);

  useEffect(() => { window.__currentUser = user; }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await SparePart.list({ limit: 500, sort: "-id" });
      setItems(data || []);
    } catch { setItems([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    const set = new Set(items.map(i => i.category || "other"));
    return ["all", ...Array.from(set).sort()];
  }, [items]);

  const displayed = useMemo(() => {
    let filtered = items.filter(i => {
      const matchSearch = !search ||
        [i.name, i.sku, i.serial_imei, i.category, i.note]
          .some(v => (v || "").toLowerCase().includes(search.toLowerCase()));
      const matchCat = category === "all" || i.category === category;
      const matchActive = showInactive || i.is_active !== false;
      return matchSearch && matchCat && matchActive;
    });

    filtered.sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "stock") return (Number(b.stock_qty) || 0) - (Number(a.stock_qty) || 0);
      if (sortBy === "price") return (Number(b.price) || 0) - (Number(a.price) || 0);
      if (sortBy === "category") return (a.category || "").localeCompare(b.category || "");
      return 0;
    });

    return filtered;
  }, [items, search, category, showInactive, sortBy]);

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter(i => i.is_active !== false).length,
    outOfStock: items.filter(i => !i.stock_qty || i.stock_qty === 0).length,
    totalValue: items.reduce((s, i) => s + (Number(i.cost_price) || Number(i.price) || 0) * (Number(i.stock_qty) || 0), 0),
  }), [items]);

  async function handleDelete(item) {
    if (!window.confirm("Xóa \"" + item.name + "\"?\n\nTồn kho: " + (item.stock_qty || 0) + "\nThao tác này không thể hoàn tác!")) return;
    try {
      await SparePart.delete(item.id);
      logAction(user, "delete", "spare_part", item.id, "Xóa hàng hóa: " + item.name + " — SKU: " + (item.sku || "—"));
      load();
    } catch (e) { alert("Lỗi: " + e.message); }
  }

  async function toggleActive(item) {
    try {
      const newVal = !item.is_active;
      await SparePart.update(item.id, { is_active: newVal });
      logAction(user, newVal ? "activate" : "deactivate", "spare_part", item.id,
        (newVal ? "Kích hoạt" : "Vô hiệu hóa") + ": " + item.name);
      load();
    } catch (e) { alert("Lỗi: " + e.message); }
  }

  const CARD = {
    background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", padding:"16px 20px",
    display:"flex", flexDirection:"column", gap:4,
  };
  const STAT_NUM = { fontSize:22, fontWeight:900, color:"#1e1b4b" };
  const STAT_LBL = { fontSize:12, color:"#9ca3af", fontWeight:600 };

  return (
    <div style={{ padding:"20px 16px 80px", maxWidth:1200, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12, marginBottom:16 }}>
        <div>
          <div style={{ fontWeight:900, fontSize:20, color:"#1e1b4b", marginBottom:4 }}>📦 Danh mục hàng hóa</div>
          <div style={{ fontSize:13, color:"#9ca3af" }}>
            Quản lý sản phẩm / linh kiện / dịch vụ — thêm, sửa, xóa, gộp hàng trùng
          </div>
        </div>
        {isAdmin && (
          <button onClick={()=>{ setEditing(null); setShowForm(true); }} style={{
            height:44, padding:"0 20px", borderRadius:12, border:"none",
            background:"#6366f1", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer",
            display:"flex", alignItems:"center", gap:6,
          }}>
            <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:20 }}>add</span>
            Thêm hàng hóa
          </button>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:12, marginBottom:16 }}>
        <div style={CARD}>
          <span style={STAT_NUM}>{stats.total}</span>
          <span style={STAT_LBL}>Tổng hàng hóa</span>
        </div>
        <div style={CARD}>
          <span style={STAT_NUM}>{stats.active}</span>
          <span style={STAT_LBL}>Đang hoạt động</span>
        </div>
        <div style={CARD}>
          <span style={{ ...STAT_NUM, color: stats.outOfStock > 0 ? "#dc2626" : "#1e1b4b" }}>{stats.outOfStock}</span>
          <span style={STAT_LBL}>Hết hàng</span>
        </div>
        <div style={CARD}>
          <span style={STAT_NUM}>{fmtMoney(stats.totalValue)}</span>
          <span style={STAT_LBL}>Giá trị tồn kho</span>
        </div>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Tìm tên, SKU, IMEI, ghi chú..."
          style={{ flex:1, minWidth:200, height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 44px", fontSize:13, outline:"none" }} />
        <select value={category} onChange={e=>setCategory(e.target.value)} style={{ height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:13, fontWeight:600, cursor:"pointer", background:"#fff" }}>
          {categories.map(c => (
            <option key={c} value={c}>{c === "all" ? "Tất cả danh mục" : (CATEGORY_LABELS[c] || c)}</option>
          ))}
        </select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:13, fontWeight:600, cursor:"pointer", background:"#fff" }}>
          <option value="name">Sắp xếp: Tên A-Z</option>
          <option value="stock">Sắp xếp: Tồn kho ↓</option>
          <option value="price">Sắp xếp: Giá ↓</option>
          <option value="category">Sắp xếp: Danh mục</option>
        </select>
        {isAdmin && (
          <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", height:40, padding:"0 12px", borderRadius:10, border:"1.5px solid #e5e7eb", background:"#fff" }}>
            <input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)}
              style={{ width:16, height:16, accentColor:"#6366f1" }} />
            <span style={{ fontSize:12, fontWeight:600, color:"#6b7280" }}>Hiện ẩn</span>
          </label>
        )}
      </div>

      {loading && <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>⏳ Đang tải...</div>}

      {!loading && displayed.length === 0 && (
        <div style={{ textAlign:"center", padding:60, color:"#9ca3af" }}>
          <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:48, display:"block", marginBottom:8 }}>inventory_2</span>
          <div>Không tìm thấy hàng hóa nào</div>
          {isAdmin && <div style={{ fontSize:13, marginTop:8 }}>Bấm "Thêm hàng hóa" để tạo mới</div>}
        </div>
      )}

      {!loading && displayed.length > 0 && (
        <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden", overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                <th style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, color:"#374151" }}>Tên hàng hóa</th>
                <th style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, color:"#374151" }}>SKU / IMEI</th>
                <th style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, color:"#374151" }}>Danh mục</th>
                <th style={{ padding:"10px 14px", textAlign:"center", fontWeight:700, color:"#374151" }}>ĐVT</th>
                <th style={{ padding:"10px 14px", textAlign:"right", fontWeight:700, color:"#9ca3af" }}>Giá vốn</th>
                <th style={{ padding:"10px 14px", textAlign:"right", fontWeight:700, color:"#059669" }}>Giá lẻ</th>
                <th style={{ padding:"10px 14px", textAlign:"right", fontWeight:700, color:"#374151" }}>Tồn</th>
                {isAdmin && <th style={{ padding:"10px 14px", textAlign:"center", fontWeight:700, color:"#374151" }}>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {displayed.map(item => {
                const isActive = item.is_active !== false;
                const stock = Number(item.stock_qty) || 0;
                const cost = item.cost_price || 0;
                const retail = item.retail_price || item.price || 0;
                return (
                  <tr key={item.id} style={{
                    borderBottom:"1px solid #f3f4f6",
                    opacity: isActive ? 1 : 0.5,
                  }}>
                    <td style={{ padding:"10px 14px", fontWeight:600, color:"#1f2937" }}>
                      {item.name}
                      {!isActive && <span style={{ marginLeft:6, fontSize:11, color:"#dc2626" }}>(ẩn)</span>}
                      {item.note && <div style={{ fontSize:11, color:"#9ca3af", fontWeight:400, marginTop:2 }}>{item.note}</div>}
                    </td>
                    <td style={{ padding:"10px 14px", color:"#9ca3af", fontFamily:"monospace", fontSize:12 }}>
                      {item.sku || "—"}
                      {item.serial_imei && <div style={{ fontSize:11 }}>{item.serial_imei}</div>}
                    </td>
                    <td style={{ padding:"10px 14px", color:"#6b7280" }}>
                      {CATEGORY_LABELS[item.category] || item.category || "—"}
                    </td>
                    <td style={{ padding:"10px 14px", textAlign:"center", color:"#6b7280" }}>{item.unit || "Cái"}</td>
                    <td style={{ padding:"10px 14px", textAlign:"right", color:"#9ca3af" }}>
                      {cost > 0 ? fmtMoney(cost) : "—"}
                    </td>
                    <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:700, color:"#059669" }}>
                      {retail > 0 ? fmtMoney(retail) : "—"}
                    </td>
                    <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:700 }}>
                      <span style={{
                        padding:"2px 8px", borderRadius:8, fontSize:12,
                        background: stock === 0 ? "#fef2f2" : stock < 5 ? "#fef9c3" : "#f0fdf4",
                        color: stock === 0 ? "#dc2626" : stock < 5 ? "#ca8a04" : "#059669",
                      }}>
                        {stock}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ padding:"10px 14px", textAlign:"center" }}>
                        <div style={{ display:"flex", gap:4, justifyContent:"center", flexWrap:"wrap" }}>
                          <button onClick={()=>{ setEditing(item); setShowForm(true); }}
                            title="Sửa"
                            style={{ padding:"4px 8px", borderRadius:8, border:"1.5px solid #e0e7ff", background:"#ede9fe", color:"#6366f1", fontSize:11, fontWeight:700, cursor:"pointer" }}>✏️</button>
                          <button onClick={()=>setMerging(item)}
                            title="Gộp hàng trùng"
                            style={{ padding:"4px 8px", borderRadius:8, border:"1.5px solid #fef3c7", background:"#fffbeb", color:"#d97706", fontSize:11, fontWeight:700, cursor:"pointer" }}>🔀</button>
                          <button onClick={()=>toggleActive(item)}
                            title={isActive ? "Ẩn" : "Hiện"}
                            style={{ padding:"4px 8px", borderRadius:8, border:"1.5px solid #e5e7eb", background:"#f9fafb", color:"#6b7280", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                            {isActive ? "🙈" : "👁️"}
                          </button>
                          <button onClick={()=>handleDelete(item)}
                            title="Xóa"
                            style={{ padding:"4px 8px", borderRadius:8, border:"1.5px solid #fecaca", background:"#fef2f2", color:"#dc2626", fontSize:11, fontWeight:700, cursor:"pointer" }}>🗑️</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ProductFormModal
          item={editing}
          onSave={()=>load()}
          onClose={()=>{ setShowForm(false); setEditing(null); }}
        />
      )}
      {merging && (
        <MergeModal
          source={merging}
          items={items}
          onMerge={()=>load()}
          onClose={()=>setMerging(null)}
        />
      )}
    </div>
  );
}
