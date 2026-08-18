/**
 * PricePolicyPage.jsx — Chính sách giá hàng hóa & dịch vụ
 * @version 2026-08-18-v2 — dropdown danh mục đầy đủ (ProductCategory entity)
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { SparePart, ProductCategory, logAction } from "./pb.jsx";

function fmtMoney(n) { return (n||0).toLocaleString("vi-VN") + "đ"; }

const ADMIN_ROLES = ["owner","admin","manager"];

function EditPriceModal({ item, onSave, onClose, user }) {
  const [retail,    setRetail]    = useState(item.retail_price  || item.price || 0);
  const [wholesale, setWholesale] = useState(item.wholesale_price || 0);
  const [cost,      setCost]      = useState(item.cost_price    || 0);
  const [saving,    setSaving]    = useState(false);

  async function save() {
    setSaving(true);
    try {
      await SparePart.update(item.id, {
        retail_price:    Number(retail),
        wholesale_price: Number(wholesale),
        cost_price:      Number(cost),
        price:           Number(retail),
      });
      logAction(user, "update_price", "spare_part", item.id, `Đổi giá: ${item.name||item.sku||""} → ${Number(retail).toLocaleString("vi-VN")}đ`);
      onSave();
    } catch(e) { alert("Lỗi: " + e.message); }
    setSaving(false);
  }

  const INP = {
    width:"100%", height:44, borderRadius:10, border:"1.5px solid #e5e7eb",
    padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box",
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:20, padding:28, width:"min(420px,95vw)" }}>
        <div style={{ fontWeight:900, fontSize:16, marginBottom:4 }}>✏️ Chỉnh giá</div>
        <div style={{ fontSize:13, color:"#6b7280", marginBottom:20 }}>
          {item.name} — SKU: {item.sku || "—"}
        </div>

        {[
          { label:"Giá bán lẻ (đ) *",  val:retail,    set:setRetail,    color:"#059669" },
          { label:"Giá bán sỉ (đ)",     val:wholesale, set:setWholesale, color:"#2563eb" },
          { label:"Giá vốn / nhập (đ)", val:cost,      set:setCost,      color:"#6b7280" },
        ].map(f => (
          <div key={f.label} style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, color:f.color, fontWeight:700 }}>{f.label}</label>
            <input type="number" min={0} value={f.val} onChange={e=>f.set(e.target.value)}
              style={{ ...INP, marginTop:4, borderColor: f.color==="#059669"?"#86efac":"#e5e7eb" }} />
            <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>= {fmtMoney(f.val)}</div>
          </div>
        ))}

        {Number(cost)>0 && Number(retail)>0 && (
          <div style={{ padding:"8px 14px", background:"#f0fdf4", borderRadius:10, marginBottom:16, fontSize:12 }}>
            💹 Biên lợi nhuận lẻ:{" "}
            <strong style={{ color:"#059669" }}>
              {Math.round((Number(retail)-Number(cost))/Number(retail)*100)}%
            </strong>
            {" "}({fmtMoney(Number(retail)-Number(cost))})
          </div>
        )}

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:44, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#fff", fontWeight:700, cursor:"pointer" }}>Huỷ</button>
          <button onClick={save} disabled={saving} style={{ flex:2, height:44, borderRadius:12, border:"none", background:"#059669", color:"#fff", fontWeight:800, cursor:"pointer" }}>
            {saving ? "Đang lưu..." : "💾 Lưu giá"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PricePolicyPage({ user }) {
  const [items,      setItems]      = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading,     setLoading]   = useState(true);
  const [search,      setSearch]    = useState("");
  const [category,    setCategory]  = useState("all");
  const [editing,     setEditing]   = useState(null);

  const isAdmin = ADMIN_ROLES.includes(user?.role);

  const catMap = useMemo(() => {
    const m = {};
    categories.forEach(c => { m[c.code] = c; });
    return m;
  }, [categories]);

  function catLabel(code) {
    const c = catMap[code];
    return c ? ((c.icon || "📦") + " " + c.name) : (code || "—");
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, catData] = await Promise.all([
        SparePart.list({ limit:500, sort:"category,name" }),
        ProductCategory.list({ limit: 200, sort: "sort_order,name" }),
      ]);
      setItems(data || []);
      setCategories((catData || []).filter(c => c.is_active !== false));
    } catch { setItems([]); setCategories([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = useMemo(() => items.filter(i => {
    const matchSearch = !search || [i.name, i.sku, i.category]
      .some(v => (v||"").toLowerCase().includes(search.toLowerCase()));
    const matchCat = category === "all" || i.category === category;
    return matchSearch && matchCat;
  }), [items, search, category]);

  return (
    <div style={{ padding:"20px 16px 80px", maxWidth:1200, margin:"0 auto" }}>
      <div style={{ fontWeight:900, fontSize:20, color:"#1e1b4b", marginBottom:4 }}>💰 Chính sách giá</div>
      <div style={{ fontSize:13, color:"#6b7280", marginBottom:20 }}>
        Quản lý bảng giá lẻ, giá sỉ và giá vốn từng sản phẩm/dịch vụ
      </div>

      {/* Filter */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Tìm tên, SKU..."
          style={{ flex:1, minWidth:180, height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 44px", fontSize:13, outline:"none" }} />
        <select value={category} onChange={e=>setCategory(e.target.value)} style={{
          height:40, minWidth:200, borderRadius:10, border:"1.5px solid #e5e7eb",
          padding:"0 12px", fontSize:13, fontWeight:600, cursor:"pointer", background:"#fff",
        }}>
          <option value="all">Tất cả danh mục</option>
          {categories.map(c => (
            <option key={c.id} value={c.code}>{c.icon || "📦"} {c.name}</option>
          ))}
        </select>
      </div>

      {loading && <div style={{ textAlign:"center", padding:40, color:"#6b7280" }}>⏳ Đang tải...</div>}

      {!loading && displayed.length === 0 && (
        <div style={{ textAlign:"center", padding:60, color:"#9ca3af" }}>
          <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:48, display:"block", marginBottom:8 }}>price_change</span>
          <div>Không tìm thấy sản phẩm nào</div>
        </div>
      )}

      {!loading && displayed.length > 0 && (
        <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden", overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                <th style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, color:"#374151" }}>Tên sản phẩm / dịch vụ</th>
                <th style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, color:"#374151" }}>SKU</th>
                <th style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, color:"#374151" }}>Danh mục</th>
                <th style={{ padding:"10px 14px", textAlign:"right", fontWeight:700, color:"#6b7280" }}>Giá vốn</th>
                <th style={{ padding:"10px 14px", textAlign:"right", fontWeight:700, color:"#2563eb" }}>Giá sỉ</th>
                <th style={{ padding:"10px 14px", textAlign:"right", fontWeight:700, color:"#059669" }}>Giá lẻ</th>
                <th style={{ padding:"10px 14px", textAlign:"right", fontWeight:700, color:"#059669" }}>Lãi</th>
                {isAdmin && <th style={{ padding:"10px 14px", textAlign:"center", fontWeight:700, color:"#374151" }}>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {displayed.map(item => {
                const retail    = item.retail_price    || item.price || 0;
                const wholesale = item.wholesale_price || 0;
                const cost      = item.cost_price      || 0;
                const margin    = retail > 0 && cost > 0
                  ? Math.round((retail - cost) / retail * 100)
                  : null;
                return (
                  <tr key={item.id} style={{ borderBottom:"1px solid #f3f4f6" }}>
                    <td style={{ padding:"10px 14px", fontWeight:600, color:"#1f2937" }}>{item.name}</td>
                    <td style={{ padding:"10px 14px", color:"#9ca3af", fontFamily:"monospace" }}>{item.sku || "—"}</td>
                    <td style={{ padding:"10px 14px", color:"#6b7280" }}>
                      {catLabel(item.category)}
                    </td>
                    <td style={{ padding:"10px 14px", textAlign:"right", color:"#9ca3af" }}>
                      {cost > 0 ? fmtMoney(cost) : "—"}
                    </td>
                    <td style={{ padding:"10px 14px", textAlign:"right", color:"#2563eb" }}>
                      {wholesale > 0 ? fmtMoney(wholesale) : "—"}
                    </td>
                    <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:700, color:"#059669" }}>
                      {fmtMoney(retail)}
                    </td>
                    <td style={{ padding:"10px 14px", textAlign:"right" }}>
                      {margin != null ? (
                        <span style={{
                          padding:"2px 8px", borderRadius:10, fontSize:11, fontWeight:700,
                          background: margin>=30 ? "#f0fdf4" : margin>=10 ? "#fef9c3" : "#fef2f2",
                          color:      margin>=30 ? "#059669" : margin>=10 ? "#ca8a04" : "#dc2626",
                        }}>{margin}%</span>
                      ) : "—"}
                    </td>
                    {isAdmin && (
                      <td style={{ padding:"10px 14px", textAlign:"center" }}>
                        <button onClick={() => setEditing(item)} style={{
                          padding:"4px 12px", borderRadius:8, border:"1.5px solid #e0e7ff",
                          background:"#ede9fe", color:"#6366f1", fontSize:12, fontWeight:700, cursor:"pointer",
                        }}>✏️ Sửa giá</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditPriceModal
          item={editing}
          user={user}
          onSave={() => { setEditing(null); load(); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
