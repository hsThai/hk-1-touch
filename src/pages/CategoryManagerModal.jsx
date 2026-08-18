/**
 * CategoryManagerModal.jsx — Quản lý danh mục hàng hóa (CRUD)
 * @version 2026-08-18-v1
 */
import React, { useState, useEffect, useCallback } from "react";
import { ProductCategory, SparePart, logAction } from "./pb.jsx";

const INP = {
  width: "100%", height: 40, borderRadius: 10, border: "1.5px solid #e5e7eb",
  padding: "0 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
};
const LBL = { fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block" };

const COLOR_OPTIONS = ["#6366f1","#8b5cf6","#ef4444","#f59e0b","#059669","#2563eb","#0ea5e9","#db2777","#7c3aed","#ca8a04","#0d9488","#dc2626","#6b7280","#9ca3af"];

function CategoryFormRow({ cat, onSave, onCancel, isNew }) {
  const [name, setName]   = useState(cat?.name || "");
  const [code, setCode]   = useState(cat?.code || "");
  const [icon, setIcon]   = useState(cat?.icon || "📦");
  const [color, setColor] = useState(cat?.color || "#6366f1");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) { alert("Nhập tên danh mục!"); return; }
    if (!code.trim()) { alert("Nhập mã danh mục!"); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), code: code.trim(), icon: icon.trim() || "📦", color });
    } finally { setSaving(false); }
  }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"70px 1fr 1fr 90px auto", gap:8, alignItems:"center", padding:"10px 12px", background: isNew ? "#f5f3ff" : "#fff", borderRadius:10, border: isNew ? "1.5px dashed #c4b5fd" : "1px solid #f3f4f6" }}>
      <input value={icon} onChange={e=>setIcon(e.target.value)} placeholder="🔧" style={{ ...INP, textAlign:"center", padding:0 }} />
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Tên danh mục" style={INP} autoFocus={isNew} />
      <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Mã (code)" style={{ ...INP, fontFamily:"monospace", fontSize:12 }} />
      <select value={color} onChange={e=>setColor(e.target.value)} style={{ ...INP, padding:"0 6px" }}>
        {COLOR_OPTIONS.map(c => <option key={c} value={c} style={{ background:c }}>{c}</option>)}
      </select>
      <div style={{ display:"flex", gap:6 }}>
        <button onClick={save} disabled={saving} style={{ padding:"6px 10px", borderRadius:8, border:"none", background:"#059669", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
          {saving ? "..." : "✓"}
        </button>
        <button onClick={onCancel} style={{ padding:"6px 10px", borderRadius:8, border:"1.5px solid #e5e7eb", background:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>✕</button>
      </div>
    </div>
  );
}

export default function CategoryManagerModal({ user, onClose, onChanged }) {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [addingNew, setAddingNew] = useState(false);
  const [usageCount, setUsageCount] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catData, parts] = await Promise.all([
        ProductCategory.list({ limit: 200, sort: "sort_order,name" }),
        SparePart.list({ limit: 500 }),
      ]);
      setCats(catData || []);
      const usage = {};
      (parts || []).forEach(p => {
        const c = p.category || "";
        usage[c] = (usage[c] || 0) + 1;
      });
      setUsageCount(usage);
    } catch { setCats([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(data) {
    try {
      const maxSort = cats.reduce((m, c) => Math.max(m, c.sort_order || 0), 0);
      const rec = await ProductCategory.create({ ...data, sort_order: maxSort + 1, is_active: true, note: "" });
      logAction(user, "create", "product_category", rec.id, "Tạo danh mục: " + data.name + " (" + data.code + ")");
      setAddingNew(false);
      load();
      onChanged && onChanged();
    } catch (e) { alert("Lỗi: " + e.message); }
  }

  async function handleUpdate(cat, data) {
    try {
      await ProductCategory.update(cat.id, data);
      logAction(user, "update", "product_category", cat.id, "Sửa danh mục: " + cat.name + " → " + data.name);
      setEditingId(null);
      load();
      onChanged && onChanged();
    } catch (e) { alert("Lỗi: " + e.message); }
  }

  async function handleDelete(cat) {
    const count = usageCount[cat.code] || 0;
    const msg = count > 0
      ? "Danh mục \"" + cat.name + "\" đang được dùng bởi " + count + " hàng hóa.\n\nXóa danh mục sẽ KHÔNG xóa hàng hóa, nhưng hàng hóa sẽ mất phân loại.\n\nVẫn xóa?"
      : "Xóa danh mục \"" + cat.name + "\"?";
    if (!window.confirm(msg)) return;
    try {
      await ProductCategory.delete(cat.id);
      logAction(user, "delete", "product_category", cat.id, "Xóa danh mục: " + cat.name + " (" + cat.code + ")");
      load();
      onChanged && onChanged();
    } catch (e) { alert("Lỗi: " + e.message); }
  }

  async function toggleActive(cat) {
    try {
      const newVal = !cat.is_active;
      await ProductCategory.update(cat.id, { is_active: newVal });
      logAction(user, newVal ? "activate" : "deactivate", "product_category", cat.id,
        (newVal ? "Kích hoạt" : "Vô hiệu hóa") + " danh mục: " + cat.name);
      load();
      onChanged && onChanged();
    } catch (e) { alert("Lỗi: " + e.message); }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1100, display:"flex", alignItems:"flex-start", justifyContent:"center", overflowY:"auto", padding:"20px 0" }}>
      <div style={{ background:"#fff", borderRadius:20, padding:28, width:"min(640px,95vw)", margin:"20px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
          <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b" }}>🏷️ Quản lý danh mục hàng hóa</div>
          <button onClick={onClose} style={{ border:"none", background:"none", fontSize:20, cursor:"pointer", color:"#9ca3af" }}>✕</button>
        </div>
        <div style={{ fontSize:13, color:"#9ca3af", marginBottom:16 }}>
          Thêm, sửa, xóa các nhóm phân loại hàng hóa.
        </div>

        {!addingNew && (
          <button onClick={()=>setAddingNew(true)} style={{
            width:"100%", height:44, borderRadius:12, border:"1.5px dashed #c4b5fd", background:"#f5f3ff",
            color:"#6366f1", fontWeight:700, fontSize:13, cursor:"pointer", marginBottom:14,
            display:"flex", alignItems:"center", justifyContent:"center", gap:6,
          }}>
            <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:18 }}>add</span>
            Thêm danh mục mới
          </button>
        )}

        {addingNew && (
          <div style={{ marginBottom:14 }}>
            <CategoryFormRow isNew onSave={handleCreate} onCancel={()=>setAddingNew(false)} />
          </div>
        )}

        {loading && <div style={{ textAlign:"center", padding:30, color:"#9ca3af" }}>⏳ Đang tải...</div>}

        {!loading && (
          <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:400, overflowY:"auto" }}>
            {cats.length === 0 && (
              <div style={{ textAlign:"center", padding:30, color:"#9ca3af", fontSize:13 }}>Chưa có danh mục nào</div>
            )}
            {cats.map(cat => (
              editingId === cat.id ? (
                <CategoryFormRow key={cat.id} cat={cat}
                  onSave={(data)=>handleUpdate(cat, data)}
                  onCancel={()=>setEditingId(null)} />
              ) : (
                <div key={cat.id} style={{
                  display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                  background: cat.is_active === false ? "#f9fafb" : "#fff",
                  border:"1px solid #f3f4f6", borderRadius:10,
                  opacity: cat.is_active === false ? 0.55 : 1,
                }}>
                  <span style={{ fontSize:18 }}>{cat.icon || "📦"}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:"#1f2937" }}>{cat.name}</div>
                    <div style={{ fontSize:11, color:"#9ca3af", fontFamily:"monospace" }}>
                      {cat.code} · {usageCount[cat.code] || 0} hàng hóa
                    </div>
                  </div>
                  <span style={{ width:14, height:14, borderRadius:"50%", background: cat.color || "#6366f1", display:"inline-block" }} />
                  <button onClick={()=>setEditingId(cat.id)} title="Sửa"
                    style={{ padding:"4px 8px", borderRadius:8, border:"1.5px solid #e0e7ff", background:"#ede9fe", color:"#6366f1", fontSize:11, fontWeight:700, cursor:"pointer" }}>✏️</button>
                  <button onClick={()=>toggleActive(cat)} title={cat.is_active === false ? "Hiện" : "Ẩn"}
                    style={{ padding:"4px 8px", borderRadius:8, border:"1.5px solid #e5e7eb", background:"#f9fafb", color:"#6b7280", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                    {cat.is_active === false ? "👁️" : "🙈"}
                  </button>
                  <button onClick={()=>handleDelete(cat)} title="Xóa"
                    style={{ padding:"4px 8px", borderRadius:8, border:"1.5px solid #fecaca", background:"#fef2f2", color:"#dc2626", fontSize:11, fontWeight:700, cursor:"pointer" }}>🗑️</button>
                </div>
              )
            ))}
          </div>
        )}

        <div style={{ display:"flex", gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{ flex:1, height:44, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#fff", fontWeight:700, cursor:"pointer" }}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
