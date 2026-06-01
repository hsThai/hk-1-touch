/**
 * PurchaseForecastPage.jsx — Mua hàng & Dự báo tồn kho
 * @version 2026-06-01-v1
 */
import React, { useState, useEffect, useMemo } from "react";
import { SparePart, StockImport } from "./pb.jsx";

function fmtMoney(n) { return (n||0).toLocaleString("vi-VN") + "đ"; }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString("vi-VN") : "—"; }

export default function PurchaseForecastPage({ user }) {
  const [parts,   setParts]   = useState([]);
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("forecast"); // forecast | history
  const [search,  setSearch]  = useState("");

  async function load() {
    setLoading(true);
    const [p, im] = await Promise.allSettled([
      SparePart.list({ limit:500 }),
      StockImport.list({ limit:200, sort:"-created" }),
    ]);
    setParts(p.status==="fulfilled" ? (p.value || []) : []);
    setImports(im.status==="fulfilled" ? (im.value || []) : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Dự báo: tồn ≤ min_qty (mặc định 2)
  const lowStock = useMemo(() => parts.filter(p => {
    const qty = p.qty_on_hand ?? p.quantity ?? p.stock_qty ?? 0;
    const min = p.min_qty ?? 2;
    return qty <= min;
  }).sort((a, b) => {
    const qa = a.qty_on_hand ?? a.quantity ?? a.stock_qty ?? 0;
    const qb = b.qty_on_hand ?? b.quantity ?? b.stock_qty ?? 0;
    return qa - qb;
  }), [parts]);

  const displayedForecast = useMemo(() => lowStock.filter(p =>
    !search || [p.name, p.sku].some(v => (v||"").toLowerCase().includes(search.toLowerCase()))
  ), [lowStock, search]);

  const displayedHistory = useMemo(() => imports.filter(im =>
    !search || [im.import_code, im.code, im.supplier_name, im.note]
      .some(v => (v||"").toLowerCase().includes(search.toLowerCase()))
  ), [imports, search]);

  const PILLS = [
    { key:"forecast", label:`📋 Cần đặt hàng (${lowStock.length})` },
    { key:"history",  label:"📦 Lịch sử nhập" },
  ];

  return (
    <div style={{ padding:"20px 16px 80px", maxWidth:1200, margin:"0 auto" }}>
      <div style={{ fontWeight:900, fontSize:20, color:"#1e1b4b", marginBottom:4 }}>🛒 Mua hàng & Dự báo</div>
      <div style={{ fontSize:13, color:"#6b7280", marginBottom:20 }}>
        Gợi ý đặt hàng khi tồn sắp hết — Lịch sử giá nhập từ NCC
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:20 }}>
        {[
          { label:"Cần đặt hàng",      val: lowStock.length + " SKU",
            color:"#dc2626", bg:"#fef2f2" },
          { label:"Hết hàng (= 0)",     val: parts.filter(p=>(p.qty_on_hand??p.quantity??p.stock_qty??0)===0).length + " SKU",
            color:"#9ca3af", bg:"#f3f4f6" },
          { label:"Lần nhập gần nhất",  val: imports[0] ? fmtDate(imports[0].created||imports[0].import_date) : "—",
            color:"#4f46e5", bg:"#eff6ff" },
          { label:"Tổng đơn nhập",      val: imports.length + " phiếu",
            color:"#059669", bg:"#f0fdf4" },
        ].map((c,i) => (
          <div key={i} style={{ background:c.bg, borderRadius:14, padding:"14px 16px", border:"1.5px solid #e5e7eb" }}>
            <div style={{ fontSize:11, color:"#6b7280", fontWeight:600, marginBottom:4 }}>{c.label}</div>
            <div style={{ fontSize:17, fontWeight:900, color:c.color }}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Tab pills */}
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {PILLS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSearch(""); }} style={{
            padding:"6px 18px", borderRadius:20, border:"none", cursor:"pointer", fontWeight:700, fontSize:13,
            background: tab===t.key ? "#4f46e5" : "#f3f4f6",
            color:      tab===t.key ? "#fff"    : "#374151",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder={tab==="forecast" ? "🔍 Tìm tên, SKU..." : "🔍 Tìm mã phiếu, NCC..."}
        style={{ width:"100%", height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:13, outline:"none", marginBottom:14, boxSizing:"border-box" }} />

      {loading && <div style={{ textAlign:"center", padding:40, color:"#6b7280" }}>⏳ Đang tải...</div>}

      {/* ── Tab: Dự báo đặt hàng ── */}
      {!loading && tab==="forecast" && (
        displayedForecast.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, color:"#22c55e" }}>
            <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:48, display:"block", marginBottom:8 }}>inventory</span>
            <div style={{ fontWeight:700 }}>✅ Tất cả hàng hóa đều đủ tồn kho</div>
          </div>
        ) : (
          <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden", overflowX:"auto" }}>
            <div style={{ padding:"10px 14px", background:"#fef2f2", borderBottom:"1px solid #fecaca", fontSize:13, color:"#dc2626", fontWeight:700 }}>
              ⚠️ {displayedForecast.length} mặt hàng cần đặt thêm
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#fafafa" }}>
                  {[["Sản phẩm","left"],["SKU","left"],["Tồn kho","right"],["Tồn tối thiểu","right"],["Giá nhập gần nhất","right"],["Mức độ","center"]]
                    .map(([h,a]) => (
                      <th key={h} style={{ padding:"10px 14px", textAlign:a, fontWeight:700, color:"#374151", borderBottom:"1px solid #e5e7eb", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {displayedForecast.map(p => {
                  const qty    = p.qty_on_hand ?? p.quantity ?? p.stock_qty ?? 0;
                  const min    = p.min_qty ?? 2;
                  const urgent = qty === 0;
                  return (
                    <tr key={p.id} style={{ borderBottom:"1px solid #f3f4f6", background: urgent ? "#fff5f5" : "#fff" }}>
                      <td style={{ padding:"10px 14px", fontWeight:600 }}>{p.name}</td>
                      <td style={{ padding:"10px 14px", color:"#9ca3af", fontFamily:"monospace" }}>{p.sku || "—"}</td>
                      <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:900,
                        color: urgent ? "#dc2626" : "#f59e0b" }}>
                        {qty}{urgent ? " ⚠️ HẾT" : ""}
                      </td>
                      <td style={{ padding:"10px 14px", textAlign:"right", color:"#6b7280" }}>{min}</td>
                      <td style={{ padding:"10px 14px", textAlign:"right", color:"#6b7280" }}>
                        {p.cost_price ? fmtMoney(p.cost_price) : "—"}
                      </td>
                      <td style={{ padding:"10px 14px", textAlign:"center" }}>
                        <span style={{
                          padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700,
                          background: urgent ? "#fee2e2" : "#fef9c3",
                          color:      urgent ? "#dc2626" : "#ca8a04",
                        }}>
                          {urgent ? "🔴 Khẩn" : "🟡 Sắp hết"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Tab: Lịch sử nhập ── */}
      {!loading && tab==="history" && (
        displayedHistory.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, color:"#9ca3af" }}>
            <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:48, display:"block", marginBottom:8 }}>inbox</span>
            <div>Chưa có lịch sử nhập hàng</div>
          </div>
        ) : (
          <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden", overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#f8fafc" }}>
                  {[["Mã phiếu","left"],["Nhà cung cấp","left"],["Ngày nhập","left"],["Tổng tiền","right"],["Ghi chú","left"],["Trạng thái","center"]]
                    .map(([h,a]) => (
                      <th key={h} style={{ padding:"10px 14px", textAlign:a, fontWeight:700, color:"#374151", borderBottom:"1.5px solid #e5e7eb", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {displayedHistory.map(im => (
                  <tr key={im.id} style={{ borderBottom:"1px solid #f3f4f6" }}>
                    <td style={{ padding:"10px 14px", fontWeight:700, color:"#6366f1" }}>
                      {im.import_code || im.code || im.id?.slice(-6)}
                    </td>
                    <td style={{ padding:"10px 14px" }}>{im.supplier_name || "—"}</td>
                    <td style={{ padding:"10px 14px", color:"#6b7280" }}>
                      {fmtDate(im.import_date || im.created)}
                    </td>
                    <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:700, color:"#059669" }}>
                      {fmtMoney(im.total_value || im.total_amount || 0)}
                    </td>
                    <td style={{ padding:"10px 14px", color:"#6b7280", fontSize:12 }}>
                      {im.note || "—"}
                    </td>
                    <td style={{ padding:"10px 14px", textAlign:"center" }}>
                      <span style={{
                        padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700,
                        background: im.status==="confirmed"||im.status==="completed" ? "#dcfce7" : "#fef9c3",
                        color:      im.status==="confirmed"||im.status==="completed" ? "#059669" : "#ca8a04",
                      }}>
                        {im.status==="confirmed"||im.status==="completed" ? "✅ Xong" : "⏳ Chờ"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
