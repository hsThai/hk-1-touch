import React, { useState, useEffect } from "react";
import { Warehouse, StockLedger, StockMovement } from "./pb.jsx";

function fmtMoney(n) {
  if (!n) return "0đ";
  return Number(n).toLocaleString("vi-VN") + "đ";
}

function getMonthRange(ym) {
  const [y, m] = ym.split("-").map(Number);
  const from = `${ym}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${ym}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export default function StockReportNXT({ user }) {
  const now = new Date();
  const defaultYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  const [ym, setYm]                   = useState(defaultYM);
  const [warehouseId, setWarehouseId] = useState("all");
  const [warehouses, setWarehouses]   = useState([]);
  const [rows, setRows]               = useState([]);
  const [summary, setSummary]         = useState({ in:0, out:0, stock:0 });
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [selectedItem,  setSelectedItem]  = useState(null);
  const [itemHistory,   setItemHistory]   = useState([]);
  const [histLoading,   setHistLoading]   = useState(false);

  useEffect(() => {
    Warehouse.list({ sort:"name", limit:50 })
      .then(setWarehouses).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [ym, warehouseId]);

  async function load() {
    setLoading(true);
    try {
      const { from, to } = getMonthRange(ym);

      // Ledger (tồn hiện tại)
      const ledgerFilter = warehouseId !== "all" ? `warehouse_id="${warehouseId}"` : "";
      const ledgers = await StockLedger.list({
        filter: ledgerFilter,
        sort: "part_name",
        limit: 500,
      });

      // Movements trong tháng
      const mvParts = [
        `created_date>="${from}"`,
        `created_date<="${to} 23:59:59"`,
      ];
      if (warehouseId !== "all") mvParts.push(`warehouse_id="${warehouseId}"`);
      const movements = await StockMovement.list({
        filter: mvParts.join(" && "),
        limit: 500,
      }).catch(() => []);

      // Group movements
      const mvMap = {};
      for (const mv of movements) {
        const key = mv.sku || mv.part_name || mv.id;
        if (!mvMap[key]) mvMap[key] = { in:0, out:0 };
        const mtype = mv.movement_type || mv.type || "";
        const qty = Number(mv.qty_change || mv.qty || mv.quantity || 0);
        if (mtype === "import" || mtype === "in"  || mtype === "receive") mvMap[key].in  += Math.abs(qty);
        if (mtype === "export" || mtype === "out" || mtype === "issue" || mtype === "sale") mvMap[key].out += Math.abs(qty);
      }

      // Tạo rows
      const result = ledgers.map(l => {
        const key = l.sku || l.part_name || l.id;
        const mv = mvMap[key] || { in:0, out:0 };
        return {
          sku:       l.sku || "—",
          name:      l.part_name || l.name || "—",
          category:  l.category || "",
          unit:      l.unit || "cái",
          stock_in:  mv.in,
          stock_out: mv.out,
          stock_now: Number(l.qty_on_hand || l.qty_available || 0),
          unit_price:Number(l.cost_price || l.unit_price || 0),
        };
      });

      setRows(result);
      setSummary({
        in:    result.reduce((s,r) => s + r.stock_in,  0),
        out:   result.reduce((s,r) => s + r.stock_out, 0),
        stock: result.reduce((s,r) => s + r.stock_now, 0),
      });
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadItemHistory(item) {
    setSelectedItem(item);
    setItemHistory([]);
    setHistLoading(true);
    try {
      const hist = await StockMovement.list({
        filter: `part_id="${item.part_id||item.spare_part_id||item.id}"`,
        sort: "-id",
        limit: 200,
      });
      setItemHistory(hist || []);
    } catch { setItemHistory([]); }
    setHistLoading(false);
  }

  const displayed = rows.filter(r =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.sku.toLowerCase().includes(search.toLowerCase())
  );

  function SummaryCard({ icon, label, value, bg, color }) {
    return (
      <div style={{ flex:1, minWidth:110, background:bg, borderRadius:12,
        padding:"14px 16px", textAlign:"center" }}>
        <div style={{ fontSize:22 }}>{icon}</div>
        <div style={{ fontSize:20, fontWeight:800, color, marginTop:4 }}>{value}</div>
        <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{label}</div>
      </div>
    );
  }

  return (
    <div style={{ padding:16, maxWidth:1060, margin:"0 auto" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <span className="material-icons"
          style={{ fontFamily:"Material Icons", fontSize:24, color:"#4f46e5" }}>
          inventory_2
        </span>
        <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:"#1e1b4b" }}>
          Báo cáo Nhập - Xuất - Tồn
        </h2>
      </div>

      {/* Filters */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
        <input type="month" value={ym} onChange={e => setYm(e.target.value)}
          style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #e5e7eb", fontSize:14 }} />
        <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
          style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #e5e7eb",
            fontSize:14, minWidth:140 }}>
          <option value="all">📦 Tất cả kho</option>
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <input
          placeholder="🔍 Tìm SKU hoặc tên hàng..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex:1, minWidth:160, padding:"8px 12px", borderRadius:8,
            border:"1px solid #e5e7eb", fontSize:14 }}
        />
      </div>

      {/* Summary cards */}
      <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <SummaryCard icon="📥" label="Tổng nhập tháng" value={summary.in + " sp"}
          bg="#f0fdf4" color="#059669" />
        <SummaryCard icon="📤" label="Tổng xuất tháng" value={summary.out + " sp"}
          bg="#fef2f2" color="#dc2626" />
        <SummaryCard icon="📦" label="Tồn hiện tại" value={summary.stock + " sp"}
          bg="#eff6ff" color="#1d4ed8" />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>⏳ Đang tải...</div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign:"center", padding:48, color:"#9ca3af" }}>
          <span className="material-icons"
            style={{ fontFamily:"Material Icons", fontSize:48, display:"block", marginBottom:10 }}>
            inventory_2
          </span>
          <div style={{ fontWeight:600, fontSize:15, color:"#374151" }}>Không có dữ liệu</div>
        </div>
      ) : (
        <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid #e5e7eb" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {[
                  ["SKU","left"],["Tên hàng","left"],["ĐV","center"],
                  ["Nhập tháng","right"],["Xuất tháng","right"],["Tồn hiện tại","right"],
                  ["Đơn giá","right"],["Thẻ kho","center"],
                ].map(([h, align]) => (
                  <th key={h} style={{ padding:"10px 12px", textAlign:align,
                    fontWeight:700, color:"#374151", borderBottom:"1px solid #e5e7eb",
                    whiteSpace:"nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((r, i) => (
                <tr key={i} style={{ background: i%2===0 ? "#fff" : "#f9fafb",
                  borderBottom:"1px solid #f3f4f6" }}>
                  <td style={{ padding:"9px 12px", color:"#6b7280",
                    fontFamily:"monospace", whiteSpace:"nowrap" }}>{r.sku}</td>
                  <td style={{ padding:"9px 12px", fontWeight:600, color:"#1f2937" }}>
                    {r.name}
                    {r.category && (
                      <span style={{ marginLeft:6, fontSize:11, color:"#9ca3af",
                        background:"#f3f4f6", borderRadius:4, padding:"1px 5px" }}>
                        {r.category}
                      </span>
                    )}
                  </td>
                  <td style={{ padding:"9px 12px", textAlign:"center", color:"#6b7280" }}>
                    {r.unit}
                  </td>
                  <td style={{ padding:"9px 12px", textAlign:"right",
                    color: r.stock_in>0 ? "#059669" : "#9ca3af", fontWeight:600 }}>
                    {r.stock_in > 0 ? `+${r.stock_in}` : "—"}
                  </td>
                  <td style={{ padding:"9px 12px", textAlign:"right",
                    color: r.stock_out>0 ? "#dc2626" : "#9ca3af", fontWeight:600 }}>
                    {r.stock_out > 0 ? `-${r.stock_out}` : "—"}
                  </td>
                  <td style={{ padding:"9px 12px", textAlign:"right",
                    fontWeight:700, color:"#1d4ed8" }}>
                    {r.stock_now}
                  </td>
                  <td style={{ padding:"9px 12px", textAlign:"right", color:"#6b7280" }}>
                    {r.unit_price ? fmtMoney(r.unit_price) : "—"}
                  </td>
                  <td style={{ padding:"9px 12px", textAlign:"center" }}>
                    <button onClick={() => loadItemHistory(r)} style={{
                      padding:"4px 10px", borderRadius:8, border:"1.5px solid #e0e7ff",
                      background: selectedItem?.part_id===r.part_id ? "#e0e7ff" : "#f5f3ff",
                      color:"#7c3aed", fontSize:11, fontWeight:600, cursor:"pointer"
                    }}>📋 Thẻ kho</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background:"#f1f5f9", fontWeight:700 }}>
                <td colSpan={3} style={{ padding:"10px 12px", color:"#374151" }}>
                  Tổng ({displayed.length} mặt hàng)
                </td>
                <td style={{ padding:"10px 12px", textAlign:"right", color:"#059669" }}>
                  +{displayed.reduce((s,r)=>s+r.stock_in,0)}
                </td>
                <td style={{ padding:"10px 12px", textAlign:"right", color:"#dc2626" }}>
                  -{displayed.reduce((s,r)=>s+r.stock_out,0)}
                </td>
                <td style={{ padding:"10px 12px", textAlign:"right", color:"#1d4ed8" }}>
                  {displayed.reduce((s,r)=>s+r.stock_now,0)}
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Panel Thẻ kho */}
      {selectedItem && (
        <div style={{ marginTop:16, background:"#fff", borderRadius:16, border:"1.5px solid #6366f1", padding:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <div style={{ fontWeight:800, fontSize:15 }}>📋 Thẻ kho: {selectedItem.name}</div>
              <div style={{ fontSize:12, color:"#6b7280" }}>SKU: {selectedItem.sku || "—"}</div>
            </div>
            <button onClick={() => setSelectedItem(null)} style={{
              width:32, height:32, borderRadius:"50%", border:"none",
              background:"#f3f4f6", cursor:"pointer", fontSize:16
            }}>✕</button>
          </div>

          {histLoading && <div style={{ textAlign:"center", padding:16, color:"#6b7280" }}>⏳ Đang tải...</div>}

          {!histLoading && itemHistory.length === 0 && (
            <div style={{ textAlign:"center", padding:24, color:"#9ca3af" }}>Chưa có lịch sử giao dịch</div>
          )}

          {!histLoading && itemHistory.length > 0 && (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ background:"#f3f4f6" }}>
                    <th style={{ padding:"8px 10px", textAlign:"left" }}>Ngày</th>
                    <th style={{ padding:"8px 10px", textAlign:"left" }}>Loại</th>
                    <th style={{ padding:"8px 10px", textAlign:"left" }}>Ghi chú</th>
                    <th style={{ padding:"8px 10px", textAlign:"right" }}>SL thay đổi</th>
                    <th style={{ padding:"8px 10px", textAlign:"right" }}>Tồn sau</th>
                  </tr>
                </thead>
                <tbody>
                  {itemHistory.map(h => (
                    <tr key={h.id} style={{ borderBottom:"1px solid #f3f4f6" }}>
                      <td style={{ padding:"8px 10px" }}>
                        {new Date(h.created_date||h.created).toLocaleDateString("vi-VN")}
                      </td>
                      <td style={{ padding:"8px 10px" }}>
                        <span style={{
                          padding:"2px 8px", borderRadius:12, fontSize:11, fontWeight:700,
                          background: h.movement_type==="in"?"#dcfce7": h.movement_type==="out"?"#fee2e2":"#fef9c3",
                          color:      h.movement_type==="in"?"#059669": h.movement_type==="out"?"#dc2626":"#ca8a04",
                        }}>
                          {h.movement_type==="in"?"📥 Nhập": h.movement_type==="out"?"📤 Xuất":"🔄 Điều chuyển"}
                        </span>
                      </td>
                      <td style={{ padding:"8px 10px", color:"#6b7280" }}>{h.note || h.reason || "—"}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:700,
                        color: h.movement_type==="in"?"#059669":"#dc2626" }}>
                        {h.movement_type==="in"?"+":"-"}{Math.abs(h.qty_change||h.quantity||0)}
                      </td>
                      <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:600 }}>
                        {h.qty_after ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
