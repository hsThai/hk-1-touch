/* ReportProfitPage.jsx — Báo cáo Lợi nhuận — HK One Touch */
import React, { useState, useEffect, useCallback } from "react";
import { RepairOrder, SaleOrder, Expense, StockMovement } from "./pb.jsx";

const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

function getRange(period, customFrom, customTo) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  let from, to;
  if (period === "today") {
    from = to = toISO(now);
  } else if (period === "week") {
    const day = now.getDay() || 7;
    const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    from = toISO(mon); to = toISO(sun);
  } else if (period === "month") {
    from = `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`;
    const last = new Date(now.getFullYear(), now.getMonth()+1, 0);
    to = toISO(last);
  } else {
    from = customFrom; to = customTo;
  }
  return { from, to };
}

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div style={{ background: bg || "#fff", border: `1.5px solid ${color}30`, borderRadius: 14,
      padding: "18px 20px", flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

export default function ReportProfitPage({ user }) {

  const [isPC, setIsPC] = React.useState(window.innerWidth >= 1024);
  React.useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);  const [period,     setPeriod]     = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo,   setCustomTo]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [data,       setData]       = useState(null);

  const load = useCallback(async () => {
    const { from, to } = getRange(period, customFrom, customTo);
    if (!from || !to) return;
    setLoading(true);
    try {
      const fromDT = from + "T00:00:00Z";
      const toDT   = to   + "T23:59:59Z";

      // Doanh thu sửa chữa (done)
      const repairs = await RepairOrder.list({
        filter: `status="done" && done_date>="${from}" && done_date<="${to}"`,
        limit: 2000
      }).catch(() => []);

      // Doanh thu bán hàng (completed)
      const sales = await SaleOrder.list({
        filter: `status="completed" && created>="${fromDT}" && created<="${toDT}"`,
        limit: 2000
      }).catch(() => []);

      // Chi phí (approved)
      const expenses = await Expense.list({
        filter: `status="approved" && created>="${fromDT}" && created<="${toDT}"`,
        limit: 2000
      }).catch(() => []);

      // Giá vốn linh kiện (xuất kho cho đơn sửa chữa)
      const movements = await StockMovement.list({
        filter: `movement_type="export" && created>="${fromDT}" && created<="${toDT}"`,
        limit: 2000
      }).catch(() => []);

      // Tổng hợp theo ngày
      const dayMap = {};
      const addDay = (dateStr, key, amt) => {
        const d = dateStr?.slice(0,10) || "";
        if (!d) return;
        if (!dayMap[d]) dayMap[d] = { date:d, repair:0, sale:0, expense:0, cogs:0 };
        dayMap[d][key] += amt;
      };

      let totalRepair = 0, totalSale = 0, totalExpense = 0, totalCogs = 0;

      for (const r of (repairs || [])) {
        const amt = Number(r.final_cost || r.estimated_cost || 0);
        totalRepair += amt;
        addDay(r.done_date, "repair", amt);
      }
      for (const s of (sales || [])) {
        const amt = Number(s.total_amount || s.final_amount || 0);
        totalSale += amt;
        addDay((s.created_date||s.created||"")?.slice(0,10), "sale", amt);
      }
      for (const e of (expenses || [])) {
        const amt = Number(e.amount || 0);
        totalExpense += amt;
        addDay((e.expense_date||e.created_date||e.created||"")?.slice(0,10), "expense", amt);
      }
      for (const m of (movements || [])) {
        const amt = Number(m.qty_change || 0) * Number(m.unit_price || 0);
        totalCogs += Math.abs(amt);
        addDay((m.created_date||m.created||"")?.slice(0,10), "cogs", Math.abs(amt));
      }

      const totalRevenue = totalRepair + totalSale;
      const totalCost = totalExpense + totalCogs;
      const profit = totalRevenue - totalCost;

      const days = Object.values(dayMap).sort((a,b) => b.date.localeCompare(a.date));

      setData({ totalRevenue, totalRepair, totalSale, totalCost, totalExpense, totalCogs, profit, days, from, to });
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [period, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: isPC ? "24px 32px 40px" : "16px 14px 80px", maxWidth: isPC ? 1200 : "100%", margin:"0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1e1b4b" }}>📈 Báo cáo Lợi nhuận</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>Doanh thu − Chi phí = Lợi nhuận gộp</div>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        {[["today","Hôm nay"],["week","Tuần này"],["month","Tháng này"],["custom","Tùy chọn"]].map(([k,l]) => (
          <button key={k} onClick={() => setPeriod(k)}
            style={{ padding: "7px 16px", borderRadius: 8,
              border: period===k ? "none" : "1.5px solid #e5e7eb",
              background: period===k ? "#4f46e5" : "#fff",
              color: period===k ? "#fff" : "#374151",
              fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            {l}
          </button>
        ))}
        {period === "custom" && (
          <>
            <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); if(!customTo) setCustomTo(e.target.value); }}
              style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13 }} />
            <span style={{ color: "#6b7280" }}>—</span>
            <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); if(!customFrom) setCustomFrom(e.target.value); }}
              style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13 }} />
            <button onClick={load} style={{ padding: "7px 16px", borderRadius: 8, background: "#4f46e5", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>Xem</button>
          </>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>⏳ Đang tải...</div>
      ) : !data ? null : (
        <>
          {/* Stat cards */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <StatCard icon="💰" label="Doanh thu" value={fmt(data.totalRevenue)} color="#059669" bg="#f0fdf4" />
            <StatCard icon="📉" label="Chi phí" value={fmt(data.totalCost)} color="#dc2626" bg="#fef2f2" />
            <StatCard icon="📈" label="Lợi nhuận gộp" value={fmt(data.profit)}
              color={data.profit >= 0 ? "#4f46e5" : "#dc2626"}
              bg={data.profit >= 0 ? "#eff6ff" : "#fef2f2"} />
          </div>

          {/* Sub-breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: isPC ? "repeat(auto-fit, minmax(200px,1fr))" : "1fr 1fr", gap: 10, marginBottom: 24 }}>
            {[
              { label: "Dịch vụ sửa chữa", val: data.totalRepair, color: "#059669" },
              { label: "Bán hàng",          val: data.totalSale,   color: "#0ea5e9" },
              { label: "Chi phí vận hành",  val: data.totalExpense,color: "#f59e0b" },
              { label: "Giá vốn linh kiện", val: data.totalCogs,   color: "#ef4444" },
            ].map(item => (
              <div key={item.label} style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{fmt(item.val)}</div>
              </div>
            ))}
          </div>

          {/* Bảng theo ngày */}
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "#374151" }}>Chi tiết theo ngày</div>
          {data.days.length === 0 ? (
            <div style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>Không có dữ liệu trong kỳ này</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["Ngày","Sửa chữa","Bán hàng","Chi phí","Giá vốn LK","Lợi nhuận"].map(h => (
                      <th key={h} style={{ padding: "9px 10px", textAlign: h==="Ngày"?"left":"right",
                        fontWeight: 600, color: "#6b7280", borderBottom: "1.5px solid #e5e7eb" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.days.map(d => {
                    const rev  = d.repair + d.sale;
                    const cost = d.expense + d.cogs;
                    const pnl  = rev - cost;
                    return (
                      <tr key={d.date} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#374151" }}>
                          {new Date(d.date).toLocaleDateString("vi-VN")}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#059669" }}>{(d.repair||0).toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#0ea5e9" }}>{(d.sale||0).toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#f59e0b" }}>{(d.expense||0).toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#ef4444" }}>{(d.cogs||0).toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700,
                          color: pnl >= 0 ? "#4f46e5" : "#dc2626" }}>
                          {pnl >= 0 ? "" : "−"}{Math.abs(pnl).toLocaleString("vi-VN")}đ
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f5f3ff", fontWeight: 700 }}>
                    <td style={{ padding: "10px 10px", color: "#374151" }}>Tổng</td>
                    <td style={{ padding: "10px 10px", textAlign: "right", color: "#059669" }}>{fmt(data.totalRepair)}</td>
                    <td style={{ padding: "10px 10px", textAlign: "right", color: "#0ea5e9" }}>{fmt(data.totalSale)}</td>
                    <td style={{ padding: "10px 10px", textAlign: "right", color: "#f59e0b" }}>{fmt(data.totalExpense)}</td>
                    <td style={{ padding: "10px 10px", textAlign: "right", color: "#ef4444" }}>{fmt(data.totalCogs)}</td>
                    <td style={{ padding: "10px 10px", textAlign: "right",
                      color: data.profit >= 0 ? "#4f46e5" : "#dc2626" }}>
                      {data.profit >= 0 ? "" : "−"}{Math.abs(data.profit).toLocaleString("vi-VN")}đ
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
