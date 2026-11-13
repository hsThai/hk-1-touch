import React, { useState, useEffect } from "react";
import { Warehouse, StockLedger, StockMovement } from "./pb.jsx";
import * as XLSX from "xlsx";
import ExportConfirmModal, { buildExcelResult } from "./ExportConfirm.jsx";
import { usePermission } from "./PermissionContext.jsx";

const MV_LABELS = {
  import:      { label: "📥 Nhập kho",      bg: "#dcfce7", color: "#059669" },
  in:          { label: "📥 Nhập kho",      bg: "#dcfce7", color: "#059669" },
  receive:     { label: "📥 Nhập kho",      bg: "#dcfce7", color: "#059669" },
  sale:        { label: "🛒 Bán hàng",      bg: "#fee2e2", color: "#dc2626" },
  export:      { label: "📤 Xuất kho",      bg: "#fee2e2", color: "#dc2626" },
  out:         { label: "📤 Xuất kho",      bg: "#fee2e2", color: "#dc2626" },
  issue:       { label: "📤 Xuất kho",      bg: "#fee2e2", color: "#dc2626" },
  transfer_in: { label: "🔄 Nhận chuyển",   bg: "#dbeafe", color: "#1d4ed8" },
  transfer_out:{ label: "🔄 Chuyển đi",     bg: "#ede9fe", color: "#6d28d9" },
  defect:      { label: "⚠️ Hàng lỗi",      bg: "#fef3c7", color: "#b45309" },
  rma_out:     { label: "📤 Trả NCC",       bg: "#fee2e2", color: "#b91c1c" },
  rma_cancel:  { label: "↩️ Huỷ trả NCC",   bg: "#dcfce7", color: "#059669" },
  return_in:   { label: "↩️ Khách trả",     bg: "#d1fae5", color: "#047857" },
  adjust:      { label: "⚖️ Điều chỉnh",    bg: "#fef9c3", color: "#ca8a04" },
  count_adjust:{ label: "⚖️ Kiểm kê",       bg: "#fef9c3", color: "#ca8a04" },
  combo_pick:  { label: "🎁 Xuất combo",    bg: "#fce7f3", color: "#be185d" },
};
function mvInfo(t) {
  const k = String(t || "").toLowerCase();
  return MV_LABELS[k] || { label: "• " + (t || "Khác"), bg: "#f3f4f6", color: "#6b7280" };
}

function fmtNum(n) { return (Number(n) || 0).toLocaleString("vi-VN"); }

function fmtMoney(n) {
  if (!n) return "0đ";
  return Number(n).toLocaleString("vi-VN") + "đ";
}

function addDays(iso, n) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function getMonthRange(ym) {
  const [y, m] = ym.split("-").map(Number);
  const from = `${ym}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${ym}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

// Phân loại phát sinh theo loại chứng từ
const KIND_SALE = ["sale", "sale_out", "export", "out", "issue"];
const KIND_TRANSFER = ["transfer_in", "transfer_out", "transfer"];
function classify(mtype, qty) {
  const t = String(mtype||"").toLowerCase();
  const dir = Number(qty) < 0 ? "out" : "in";
  if (KIND_SALE.includes(t)) return "sale_" + (dir === "out" ? "out" : "in");
  if (KIND_TRANSFER.includes(t)) return t === "transfer_in" ? "transfer_in" : (t === "transfer_out" ? "transfer_out" : "transfer_" + dir);
  return "other_" + dir;
}

export default function StockReportNXT({ user }) {
  const { can: canPerm } = usePermission();
  const canExportNXT = !!canPerm("stock_card","export");
  const [exportDone, setExportDone] = useState(null);
  const [isPC, setIsPC] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 900);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const now = new Date();
  const defaultYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  const [ym, setYm]                   = useState(defaultYM);
  const [warehouseId, setWarehouseId] = useState("all");
  const [warehouses, setWarehouses]   = useState([]);
  const [rows, setRows]               = useState([]);
  const [summary, setSummary]         = useState({ in:0, out:0, stock:0 });
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [kind, setKind]               = useState("all"); // all | sale | transfer | other
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
      const ledgers = await StockLedger.listAll({ filter: ledgerFilter, sort: "part_name" });

      // Movements trong tháng
      const mvParts = [
        `created_date>="${from}"`,
        `created_date<="${addDays(to, 1)}"`,
      ];
      if (warehouseId !== "all") mvParts.push(`warehouse_id="${warehouseId}"`);
      const movementsAll = await StockMovement.listAll({
        filter: mvParts.join(" && "),
        sort: "-created_date",
      }).catch(() => []);
      // Lọc lại theo đúng ngày ở client (dữ liệu có thể ở dạng "YYYY-MM-DD HH:mm:ss" hoặc ISO)
      const movements = (movementsAll || []).filter(mv => {
        const d = String(mv.created_date || mv.created || "").slice(0, 10);
        return d >= from && d <= to;
      });

      // Group movements
      const mvMap = {};
      for (const mv of movements) {
        const key = mv.sku || mv.part_name || mv.id;
        if (!mvMap[key]) mvMap[key] = {
          in_all:0, out_all:0,
          sale_in:0, sale_out:0,
          transfer_in:0, transfer_out:0,
          other_in:0, other_out:0,
        };
        const mtype = mv.movement_type || mv.type || "";
        const qty = Number(mv.qty_change || mv.qty || mv.quantity || 0);
        const abs = Math.abs(qty);
        const g = classify(mtype, qty);
        mvMap[key][g] = (mvMap[key][g] || 0) + abs;
        if (Number(qty) < 0) mvMap[key].out_all += abs; else mvMap[key].in_all += abs;
      }

      // Gộp tồn kho theo SKU (khi xem "Tất cả kho", một SKU có thể nằm ở nhiều kho)
      const ledgerMap = new Map();
      for (const l of (ledgers || [])) {
        const key = l.sku || l.part_name || l.id;
        const cur = ledgerMap.get(key);
        const qty = Number(l.qty_on_hand || l.qty_available || 0);
        if (!cur) {
          ledgerMap.set(key, {
            id: l.id,
            part_id: l.part_id || l.id,
            sku: l.sku || "—",
            name: l.part_name || l.name || "—",
            category: l.category || "",
            unit: l.unit || "cái",
            stock_now: qty,
            unit_price: Number(l.cost_price || l.unit_price || 0),
          });
        } else {
          cur.stock_now += qty;
          if (!cur.unit_price) cur.unit_price = Number(l.cost_price || l.unit_price || 0);
        }
      }

      // Tạo rows
      const result = [...ledgerMap.values()].map(l => {
        const key = l.sku || l.name || l.id;
        const mv = mvMap[key] || {};
        return {
          ...l,
          stock_in:  mv.in_all  || 0,
          stock_out: mv.out_all || 0,
          sale_in:   mv.sale_in || 0,        sale_out:   mv.sale_out || 0,
          transfer_in: mv.transfer_in || 0,  transfer_out: mv.transfer_out || 0,
          other_in:  mv.other_in || 0,       other_out:  mv.other_out || 0,
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
        filter: `part_id="${item.part_id||item.spare_part_id||item.id}"${item.sku && item.sku !== "—" ? ` || sku="${item.sku}"` : ""}`,
        sort: "-id",
        limit: 200,
      });
      const list = (hist || []).filter(mv => {
        if (kind === "all") return true;
        const g = classify(mv.movement_type || mv.type || "", Number(mv.qty_change||0));
        return g.startsWith(kind);
      });
      setItemHistory(list);
    } catch { setItemHistory([]); }
    setHistLoading(false);
  }

  function exportExcel() {
    const whName = warehouseId === "all" ? "Tất cả kho"
      : (warehouses.find(w => w.id === warehouseId)?.name || warehouseId);
    const data = displayed.map(r => ({
      "SKU": r.sku || "",
      "Tên hàng": r.name || "",
      "Danh mục": r.category || "",
      "ĐV": r.unit || "",
      ...Object.fromEntries(qtyCols.map(c => [c.label, Number(r[c.key])||0])),
      "Tồn hiện tại": r.stock_now || 0,
      "Đơn giá": r.unit_price || 0,
    }));
    data.push({
      "SKU": "", "Tên hàng": "TỔNG CỘNG", "Danh mục": "", "ĐV": "",
      ...Object.fromEntries(qtyCols.map(c => [c.label, displayed.reduce((s2,r) => s2 + (Number(r[c.key])||0), 0)])),
      "Tồn hiện tại": displayed.reduce((s2,r) => s2 + (r.stock_now||0), 0),
      "Đơn giá": "",
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch:14 },{ wch:34 },{ wch:16 },{ wch:6 },{ wch:11 },{ wch:11 },{ wch:13 },{ wch:12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "NXT " + ym);
    const fileName = `bao-cao-nxt_${ym}_${warehouseId === "all" ? "tat-ca-kho" : whName.replace(/\s+/g,"-").toLowerCase()}.xlsx`;
    setExportDone(buildExcelResult(wb, fileName));
  }

  const sumBy = (field) => rows.reduce((a,r) => a + (Number(r[field])||0), 0);

  // Bộ lọc phân loại: chỉ giữ mặt hàng có phát sinh đúng loại đang chọn
  const kindRows = rows.filter(r => {
    if (kind === "all") return true;
    if (kind === "sale")     return (r.sale_out||0) > 0 || (r.sale_in||0) > 0;
    if (kind === "transfer") return (r.transfer_in||0) > 0 || (r.transfer_out||0) > 0;
    return (r.other_in||0) > 0 || (r.other_out||0) > 0;
  });

  const MAX_ROWS = 400;
  const allDisplayed = kindRows.filter(r =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.sku.toLowerCase().includes(search.toLowerCase())
  );
  const displayed = allDisplayed.slice(0, MAX_ROWS);

  // Cột số lượng thay đổi theo bộ lọc phân loại
  const qtyCols = kind === "sale"
    ? [{ key:"sale_out",   label:"Bán ra",      color:"#dc2626", sign:"-" }]
    : kind === "transfer"
    ? [{ key:"transfer_in", label:"Chuyển đến", color:"#059669", sign:"+" },
       { key:"transfer_out",label:"Chuyển đi",  color:"#1d4ed8", sign:"-" }]
    : kind === "other"
    ? [{ key:"other_in",   label:"Nhập khác",   color:"#059669", sign:"+" },
       { key:"other_out",  label:"Xuất khác",   color:"#dc2626", sign:"-" }]
    : [{ key:"stock_in",   label:"Nhập tháng",  color:"#059669", sign:"+" },
       { key:"stock_out",  label:"Xuất tháng",  color:"#dc2626", sign:"-" }];

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
        {canExportNXT && (
          <button onClick={exportExcel}
            style={{ padding:"8px 14px", borderRadius:8, border:"none",
              background:"#059669", color:"#fff", fontWeight:700, fontSize:13.5,
              cursor:"pointer", whiteSpace:"nowrap" }}>
            ⬇️ Xuất Excel
          </button>
        )}
      </div>

      {/* Lọc phân loại phát sinh */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        {[
          { k:"all",      label:"Tất cả",      icon:"all_inclusive", color:"#4f46e5" },
          { k:"sale",     label:"Bán hàng",    icon:"point_of_sale", color:"#dc2626" },
          { k:"transfer", label:"Điều chuyển", icon:"swap_horiz",    color:"#1d4ed8" },
          { k:"other",    label:"Khác (lỗi, trả, điều chỉnh)", icon:"more_horiz", color:"#6b7280" },
        ].map(t => {
          const active = kind === t.k;
          return (
            <button key={t.k} onClick={()=>setKind(t.k)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px",
                borderRadius:20, cursor:"pointer", fontSize:13, fontWeight:800,
                border:`1.5px solid ${active ? t.color : "#e5e7eb"}`,
                background: active ? t.color : "#fff",
                color: active ? "#fff" : "#374151" }}>
              <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:16 }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Summary cards */}
      <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        {kind !== "sale" && (
          <SummaryCard icon="📥" label={kind==="transfer" ? "Chuyển đến" : kind==="other" ? "Nhập khác" : "Tổng nhập tháng"}
            value={(kind==="transfer" ? sumBy("transfer_in") : kind==="other" ? sumBy("other_in") : summary.in) + " sp"}
            bg="#f0fdf4" color="#059669" />
        )}
        <SummaryCard icon="📤" label={kind==="sale" ? "Tổng bán ra" : kind==="transfer" ? "Chuyển đi" : kind==="other" ? "Xuất khác" : "Tổng xuất tháng"}
          value={(kind==="sale" ? sumBy("sale_out") : kind==="transfer" ? sumBy("transfer_out") : kind==="other" ? sumBy("other_out") : summary.out) + " sp"}
          bg="#fef2f2" color="#dc2626" />
        <SummaryCard icon="📦" label="Tồn hiện tại" value={summary.stock + " sp"}
          bg="#eff6ff" color="#1d4ed8" />
      </div>

      {/* Table */}
      {!loading && allDisplayed.length > displayed.length && (
        <div style={{ textAlign:"center", fontSize:12, color:"#9ca3af", marginBottom:8 }}>
          Đang hiện {MAX_ROWS} trong {fmtNum(allDisplayed.length)} mặt hàng — dùng ô tìm kiếm để lọc tiếp.
        </div>
      )}

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
                  ...qtyCols.map(c => [c.label,"right"]),
                  ["Tồn hiện tại","right"],
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
                  {qtyCols.map(c => {
                    const v = Number(r[c.key]) || 0;
                    return (
                      <td key={c.key} style={{ padding:"9px 12px", textAlign:"right",
                        color: v > 0 ? c.color : "#9ca3af", fontWeight:600, whiteSpace:"nowrap" }}>
                        {v > 0 ? `${c.sign}${v}` : "—"}
                      </td>
                    );
                  })}
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
                      background: selectedItem?.id===r.id ? "#e0e7ff" : "#f5f3ff",
                      color:"#7c3aed", fontSize:11, fontWeight:600, cursor:"pointer"
                    }}>📋 Thẻ kho</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background:"#f1f5f9", borderTop:"2px solid #e2e8f0" }}>
                <td colSpan={3} style={{ padding:"10px 12px", fontWeight:800, color:"#1e1b4b" }}>
                  Tổng ({fmtNum(displayed.length)} mặt hàng)
                </td>
                {qtyCols.map(c => {
                  const v = displayed.reduce((a, r) => a + (Number(r[c.key]) || 0), 0);
                  return (
                    <td key={c.key} style={{ padding:"10px 12px", textAlign:"right", fontWeight:800,
                      color: v ? c.color : "#9ca3af" }}>
                      {v ? `${c.sign}${fmtNum(v)}` : "—"}
                    </td>
                  );
                })}
                <td style={{ padding:"10px 12px", textAlign:"right", fontWeight:800, color:"#1d4ed8" }}>
                  {fmtNum(displayed.reduce((a, r) => a + (Number(r.stock_now) || 0), 0))}
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Bottom-sheet Modal: Thẻ kho (luôn nổi giữa màn hình, không phụ thuộc vị trí scroll) */}
      {selectedItem && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:9999,
          display:"flex", alignItems:isPC?"center":"flex-end", justifyContent:"center", padding:isPC?20:0 }}
          onClick={() => setSelectedItem(null)}>
          <div style={{ background:"#fff", borderRadius:isPC?16:"20px 20px 0 0", padding:"20px 16px 32px",
            width:"100%", maxWidth:560, maxHeight:isPC?"85vh":"80vh", overflowY:"auto", boxShadow:isPC?"0 24px 70px rgba(0,0,0,.3)":"none" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:15 }}>📋 Thẻ kho: {selectedItem.name}</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>SKU: {selectedItem.sku || "—"}</div>
              </div>
              <button onClick={() => setSelectedItem(null)} style={{
                width:32, height:32, borderRadius:"50%", border:"none",
                background:"#f3f4f6", cursor:"pointer", fontSize:16, flexShrink:0
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
                          {(() => {
                            const info = mvInfo(h.movement_type);
                            return (
                              <span style={{
                                padding:"2px 8px", borderRadius:12, fontSize:11, fontWeight:700,
                                background: info.bg, color: info.color, whiteSpace:"nowrap",
                              }}>{info.label}</span>
                            );
                          })()}
                        </td>
                        <td style={{ padding:"8px 10px", color:"#6b7280" }}>{h.note || h.reason || "—"}</td>
                        <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:700,
                          color: Number(h.qty_change||0) < 0 ? "#dc2626" : "#059669" }}>
                          {Number(h.qty_change||0) < 0 ? "-" : "+"}{Math.abs(Number(h.qty_change||h.quantity||0))}
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
        </div>
      )}
      {exportDone && <ExportConfirmModal fileName={exportDone.fileName} url={exportDone.url}
        onClose={() => { URL.revokeObjectURL(exportDone.url); setExportDone(null); }} />}
    </div>
  );
}