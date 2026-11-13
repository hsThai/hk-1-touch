/**
 * SalesAnalyticsPage.jsx — Phân tích bán hàng
 * Báo cáo kiểu KiotViet: hàng bán theo khách hàng, khách hàng theo hàng bán,
 * hàng bán theo nhân viên, và doanh thu theo ngày.
 * Nguồn: sale_orders (đơn đã thu) + sale_order_items + return_orders (phiếu trả).
 */
import React, { useEffect, useMemo, useState } from "react";
import { SaleOrder, SaleOrderItem, ReturnOrder } from "./pb.jsx";
import { usePermission } from "./PermissionContext.jsx";
import * as XLSX from "xlsx";
import ExportConfirmModal, { buildExcelResult } from "./ExportConfirm.jsx";

function fmtMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("vi-VN") + "đ";
}
function fmtNum(n) { return (Number(n) || 0).toLocaleString("vi-VN"); }
function dayStr(s) { return String(s || "").slice(0, 10); }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

const TABS = [
  { key: "item",     label: "Hàng bán theo khách hàng", icon: "inventory_2" },
  { key: "customer", label: "Khách hàng theo hàng bán", icon: "group" },
  { key: "seller",   label: "Hàng bán theo nhân viên",  icon: "badge" },
  { key: "day",      label: "Doanh thu theo ngày",      icon: "calendar_month" },
];

export default function SalesAnalyticsPage({ user }) {
  const { can } = usePermission();
  const canExport = !!can("pos_orders", "export") || !!can("revenue_report", "export");

  const [isPC, setIsPC] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 900);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const today = todayISO();
  const [from, setFrom]     = useState(addDays(today, -6));
  const [to, setTo]         = useState(today);
  const [tab, setTab]       = useState("item");
  const [search, setSearch] = useState("");
  const [onlyPaid, setOnlyPaid] = useState(false); // chỉ tính đơn đã thu tiền
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [items, setItems]   = useState([]);
  const [returns, setReturns] = useState([]);
  const [exportDone, setExportDone] = useState(null);

  useEffect(() => { load(); }, [from, to, onlyPaid]);

  async function load() {
    setLoading(true);
    try {
      const untilExclusive = addDays(to, 1);
      const [os, its, ros] = await Promise.all([
        SaleOrder.listAll({
          // Đơn đã bán = đã thu tiền hoặc đang chờ thu; bỏ nháp và đơn huỷ
          filter: `status!="cancelled" && status!="draft" && created_date>="${from}" && created_date<="${untilExclusive}"`,
          sort: "-created_date",
        }).catch(() => []),
        SaleOrderItem.listAll({ sort: "-id" }).catch(() => []),
        ReturnOrder.listAll({ sort: "-id" }).catch(() => []),
      ]);
      setOrders((os || []).filter(o => {
        const d = dayStr(o.created_date || o.created);
        if (d < from || d > to) return false;
        if (onlyPaid) return o.status === "completed";
        return o.status === "completed" || o.status === "pending_payment";
      }));
      setItems(its || []);
      setReturns((ros || []).filter(r => {
        const d = dayStr(r.return_date || r.created_date);
        const st = String(r.status || "").toLowerCase();
        return d >= from && d <= to && st !== "cancelled" && st !== "huy";
      }));
    } catch {
      setOrders([]); setItems([]); setReturns([]);
    } finally {
      setLoading(false);
    }
  }

  // ── Ghép dòng hàng của các đơn trong kỳ + phân bổ giảm giá về từng dòng
  const lines = useMemo(() => {
    const orderById = {};
    orders.forEach(o => { orderById[o.id] = o; });
    const out = [];
    (items || []).forEach(it => {
      const o = orderById[it.sale_order_id];
      if (!o) return;
      const lineTotal = Number(it.total_price) || (Number(it.unit_price) || 0) * (Number(it.qty) || 0);
      const sub = Number(o.subtotal) || 0;
      const disc = Number(o.discount) || 0;
      const share = sub > 0 ? (lineTotal / sub) * disc : 0;
      out.push({
        sku: it.sku || "—",
        name: it.part_name || "—",
        qty: Number(it.qty) || 0,
        revenue: lineTotal - share,
        order: o,
        custKey: (o.customer_phone || o.customer_name || "khach-le").trim().toLowerCase(),
        customer: o.customer_name || "Khách lẻ",
        seller: o.seller_name || "—",
        day: dayStr(o.created_date || o.created),
      });
    });
    return out;
  }, [orders, items]);

  // ── Trả hàng theo SKU / khách / ngày
  const returnLines = useMemo(() => {
    const out = [];
    (returns || []).forEach(r => {
      let list = r.items;
      if (typeof list === "string") { try { list = JSON.parse(list); } catch { list = []; } }
      if (!Array.isArray(list) || list.length === 0) return;
      list.forEach(it => {
        out.push({
          sku: it.sku || "—",
          name: it.part_name || "—",
          qty: Number(it.qty) || 0,
          value: Number(it.total_price) || (Number(it.unit_price) || 0) * (Number(it.qty) || 0),
          customer: r.customer_name || "Khách lẻ",
          custKey: (r.customer_phone || r.customer_name || "khach-le").trim().toLowerCase(),
          day: dayStr(r.return_date || r.created_date),
        });
      });
    });
    return out;
  }, [returns]);

  // ── Tổng hợp theo từng tab
  const aggregated = useMemo(() => {
    const blank = () => ({ customers: new Set(), orders: new Set(), qty: 0, revenue: 0, retQty: 0, retValue: 0 });
    const map = new Map();
    const get = (k) => {
      if (!map.has(k)) map.set(k, { key: k, ...blank() });
      return map.get(k);
    };

    if (tab === "item") {
      lines.forEach(l => {
        const g = get(l.sku);
        g.name = l.name;
        g.customers.add(l.custKey);
        g.qty += l.qty;
        g.revenue += l.revenue;
      });
      returnLines.forEach(r => {
        const g = map.get(r.sku);
        if (!g) return;
        g.retQty += r.qty;
        g.retValue += r.value;
      });
    } else if (tab === "customer") {
      lines.forEach(l => {
        const g = get(l.custKey);
        g.name = l.customer;
        g.phone = l.order.customer_phone || "";
        g.orders.add(l.order.id);
        g.qty += l.qty;
        g.revenue += l.revenue;
      });
      returnLines.forEach(r => {
        const g = map.get(r.custKey);
        if (!g) return;
        g.retQty += r.qty;
        g.retValue += r.value;
      });
    } else if (tab === "seller") {
      lines.forEach(l => {
        const k = (l.seller || "—").trim().toLowerCase();
        const g = get(k);
        g.name = l.seller || "—";
        g.orders.add(l.order.id);
        g.qty += l.qty;
        g.revenue += l.revenue;
      });
    } else {
      lines.forEach(l => {
        const g = get(l.day);
        g.name = l.day;
        g.orders.add(l.order.id);
        g.qty += l.qty;
        g.revenue += l.revenue;
      });
      returnLines.forEach(r => {
        const g = map.get(r.day);
        if (!g) return;
        g.retQty += r.qty;
        g.retValue += r.value;
      });
    }

    const rows = [...map.values()].map(g => ({
      ...g,
      customerCount: g.customers ? g.customers.size : 0,
      orderCount: g.orders ? g.orders.size : 0,
      net: g.revenue - g.retValue,
    }));
    rows.sort((a, b) => (tab === "day" ? b.key.localeCompare(a.key) : b.revenue - a.revenue));
    return rows;
  }, [lines, returnLines, tab]);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? aggregated.filter(r => (r.name || "").toLowerCase().includes(q) || (r.key || "").toLowerCase().includes(q) || (r.phone || "").includes(q))
      : aggregated;
    return rows.slice(0, 800);
  }, [aggregated, search]);

  const totals = useMemo(() => displayed.reduce((a, r) => ({
    qty: a.qty + r.qty,
    revenue: a.revenue + r.revenue,
    retQty: a.retQty + r.retQty,
    retValue: a.retValue + r.retValue,
    net: a.net + r.net,
    count: a.count + 1,
  }), { qty: 0, revenue: 0, retQty: 0, retValue: 0, net: 0, count: 0 }), [displayed]);

  const headers = tab === "item"
    ? [["SKU", "left"], ["Tên hàng", "left"], ["SL khách hàng", "right"], ["SL mua", "right"],
       ["Doanh thu", "right"], ["SL trả", "right"], ["Giá trị trả", "right"], ["Doanh thu thuần", "right"]]
    : tab === "customer"
    ? [["Khách hàng", "left"], ["Số điện thoại", "left"], ["SL đơn", "right"], ["SL mua", "right"],
       ["Doanh thu", "right"], ["SL trả", "right"], ["Giá trị trả", "right"], ["Doanh thu thuần", "right"]]
    : tab === "seller"
    ? [["Nhân viên", "left"], ["SL đơn", "right"], ["SL hàng bán", "right"], ["Doanh thu", "right"]]
    : [["Ngày", "left"], ["SL đơn", "right"], ["SL hàng bán", "right"], ["Doanh thu", "right"],
       ["Giá trị trả", "right"], ["Doanh thu thuần", "right"]];

  function cells(r) {
    if (tab === "item") return [r.key, r.name || "—", fmtNum(r.customerCount), fmtNum(r.qty), fmtMoney(r.revenue), fmtNum(r.retQty), r.retValue ? "-" + fmtMoney(r.retValue) : "—", fmtMoney(r.net)];
    if (tab === "customer") return [r.name || "—", r.phone || "—", fmtNum(r.orderCount), fmtNum(r.qty), fmtMoney(r.revenue), fmtNum(r.retQty), r.retValue ? "-" + fmtMoney(r.retValue) : "—", fmtMoney(r.net)];
    if (tab === "seller") return [r.name || "—", fmtNum(r.orderCount), fmtNum(r.qty), fmtMoney(r.revenue)];
    return [r.key, fmtNum(r.orderCount), fmtNum(r.qty), fmtMoney(r.revenue), r.retValue ? "-" + fmtMoney(r.retValue) : "—", fmtMoney(r.net)];
  }

  function exportExcel() {
    const head = headers.map(h => h[0]);
    const data = displayed.map(r => {
      const row = {};
      const lineItems = [];
      if (tab === "item") {
        lineItems.push(r.key, r.name || "—", r.customerCount, r.qty, r.revenue, r.retQty, r.retValue, r.net);
      } else if (tab === "customer") {
        lineItems.push(r.name || "—", r.phone || "", r.orderCount, r.qty, r.revenue, r.retQty, r.retValue, r.net);
      } else if (tab === "seller") {
        lineItems.push(r.name || "—", r.orderCount, r.qty, r.revenue);
      } else {
        lineItems.push(r.key, r.orderCount, r.qty, r.revenue, r.retValue, r.net);
      }
      head.forEach((h, i) => { row[h] = lineItems[i]; });
      return row;
    });
    const totalRow = {};
    head.forEach(h => { totalRow[h] = ""; });
    totalRow[head[0]] = "TỔNG CỘNG";
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.sheet_add_json(ws, [totalRow], { skipHeader: true, origin: -1 });
    ws["!cols"] = head.map(h => ({ wch: h === "Tên hàng" || h === "Khách hàng" ? 40 : 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Phan tich ban hang");
    setExportDone(buildExcelResult(wb, `phan-tich-ban-hang_${from}_${to}.xlsx`));
  }

  const chip = (bg, color, text) => (
    <span style={{ background: bg, color, fontWeight: 800, fontSize: 11, padding: "3px 9px", borderRadius: 20 }}>{text}</span>
  );

  return (
    <div style={{ padding: isPC ? 20 : 12, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 24, color: "#4f46e5" }}>insights</span>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1e1b4b" }}>Phân tích bán hàng</h2>
        {loading && <span style={{ fontSize: 12, color: "#9ca3af" }}>⏳ Đang tải…</span>}
      </div>

      {/* Bộ lọc */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }} />
        <span style={{ color: "#9ca3af" }}>→</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }} />
        <button onClick={() => setOnlyPaid(v => !v)}
          style={{ padding: "7px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12.5, fontWeight: 700,
            border: `1.5px solid ${onlyPaid ? "#047857" : "#e5e7eb"}`,
            background: onlyPaid ? "#047857" : "#fff", color: onlyPaid ? "#fff" : "#374151" }}>
          {onlyPaid ? "✓ " : ""}Chỉ đơn đã thu
        </button>
        {[
          { l: "Hôm nay", f: today, t: today },
          { l: "7 ngày", f: addDays(today, -6), t: today },
          { l: "30 ngày", f: addDays(today, -29), t: today },
        ].map(q => (
          <button key={q.l} onClick={() => { setFrom(q.f); setTo(q.t); }}
            style={{ padding: "7px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12.5, fontWeight: 700,
              border: `1.5px solid ${from === q.f && to === q.t ? "#4f46e5" : "#e5e7eb"}`,
              background: from === q.f && to === q.t ? "#4f46e5" : "#fff",
              color: from === q.f && to === q.t ? "#fff" : "#374151" }}>{q.l}</button>
        ))}
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <span className="material-icons" style={{ fontFamily: "Material Icons", position: "absolute", left: 12,
            top: "50%", transform: "translateY(-50%)", fontSize: 18, color: "#9ca3af" }}>search</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tab === "customer" ? "Tìm khách hàng, số điện thoại…" : "Tìm SKU hoặc tên hàng…"}
            style={{ width: "100%", padding: "9px 12px 9px 44px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }} />
        </div>
        {canExport && (
          <button onClick={exportExcel}
            style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: "#059669", color: "#fff",
              fontWeight: 800, fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap" }}>⬇️ Xuất Excel</button>
        )}
      </div>

      {/* Tab */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10,
                whiteSpace: "nowrap", cursor: "pointer", fontSize: 13, fontWeight: 800,
                border: `1.5px solid ${active ? "#4f46e5" : "#e5e7eb"}`,
                background: active ? "#eef2ff" : "#fff", color: active ? "#4338ca" : "#4b5563" }}>
              <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 17 }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Thẻ tổng hợp */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {[
          { label: tab === "item" ? "Mặt hàng" : tab === "customer" ? "Khách hàng" : tab === "seller" ? "Nhân viên" : "Số ngày", value: fmtNum(totals.count), bg: "#eef2ff", color: "#4338ca" },
          { label: "SL bán", value: fmtNum(totals.qty), bg: "#ecfdf5", color: "#059669" },
          { label: "Doanh thu", value: fmtMoney(totals.revenue), bg: "#eff6ff", color: "#1d4ed8" },
          { label: "Giá trị trả", value: fmtMoney(totals.retValue), bg: "#fef2f2", color: "#dc2626" },
          { label: "Doanh thu thuần", value: fmtMoney(totals.net), bg: "#f0fdf4", color: "#047857" },
        ].map(c => (
          <div key={c.label} style={{ flex: "1 1 150px", background: c.bg, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: isPC ? 18 : 16, fontWeight: 900, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Bảng */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>⏳ Đang tính toán…</div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>📭</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#374151" }}>Không có dữ liệu trong khoảng ngày này</div>
          <div style={{ fontSize: 12.5, marginTop: 4 }}>{onlyPaid ? "Chỉ tính đơn đã thu tiền." : "Tính đơn đã bán (đã thu + chờ thu), bỏ đơn nháp/huỷ."}</div>
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {headers.map(([h, align], i) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: align, fontWeight: 700, color: "#374151",
                    borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap",
                    position: i === 0 ? "sticky" : undefined, left: i === 0 ? 0 : undefined,
                    background: i === 0 ? "#f8fafc" : undefined, zIndex: i === 0 ? 2 : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((r, idx) => (
                <tr key={r.key} style={{ background: idx % 2 ? "#f9fafb" : "#fff", borderBottom: "1px solid #f3f4f6" }}>
                  {cells(r).map((v, i) => (
                    <td key={i} style={{
                      padding: "9px 12px",
                      textAlign: headers[i][1],
                      color: i === 0 ? "#1e1b4b" : "#374151",
                      fontWeight: i === 0 ? 700 : (i === headers.length - 1 ? 800 : 500),
                      fontFamily: i === 0 && tab === "item" ? "monospace" : undefined,
                      whiteSpace: i === 0 ? "nowrap" : undefined,
                      maxWidth: i === 1 && tab === "item" ? 320 : undefined,
                      background: i === 0 ? (idx % 2 ? "#f9fafb" : "#fff") : undefined,
                      position: i === 0 ? "sticky" : undefined, left: i === 0 ? 0 : undefined,
                    }}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {displayed.length >= 800 && (
        <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 10 }}>
          Đang hiện 800 dòng đầu. Thu hẹp khoảng ngày hoặc dùng ô tìm kiếm để xem tiếp.
        </div>
      )}

      {exportDone && (
        <ExportConfirmModal fileName={exportDone.fileName} url={exportDone.url}
          onClose={() => { URL.revokeObjectURL(exportDone.url); setExportDone(null); }} />
      )}
    </div>
  );
}
