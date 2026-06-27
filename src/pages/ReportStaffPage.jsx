/* ReportStaffPage.jsx — KPI Nhân viên — HK One Touch */
import React, { useState, useEffect, useCallback } from "react";
import { RepairOrder, SaleOrder, Staff } from "./pb.jsx";

const fmt  = (n) => (n || 0).toLocaleString("vi-VN");
const fmtD = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

function getRange(period, customFrom, customTo) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  if (period === "week") {
    const day = now.getDay() || 7;
    const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: toISO(mon), to: toISO(sun) };
  } else if (period === "month") {
    const last = new Date(now.getFullYear(), now.getMonth()+1, 0);
    return { from: `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`, to: toISO(last) };
  }
  return { from: customFrom, to: customTo };
}

function RankBadge({ rank }) {
  if (rank === 1) return <span style={{ fontSize: 18 }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize: 18 }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize: 18 }}>🥉</span>;
  return <span style={{ color: "#9ca3af", fontWeight: 700 }}>#{rank}</span>;
}

export default function ReportStaffPage({ user }) {

  const [isPC, setIsPC] = React.useState(window.innerWidth >= 1024);
  React.useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);  const [period,     setPeriod]     = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo,   setCustomTo]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [ktvData,    setKtvData]    = useState([]);
  const [saleData,   setSaleData]   = useState([]);
  const [filterDept, setFilterDept] = useState("all");
  const [allStaff,   setAllStaff]   = useState([]);

  useEffect(() => {
    Staff.list({ limit: 200 }).then(r => setAllStaff(r || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const { from, to } = getRange(period, customFrom, customTo);
    if (!from || !to) return;
    setLoading(true);
    try {
      const fromDT = from + "T00:00:00Z";
      const toDT   = to   + "T23:59:59Z";

      // Đơn sửa chữa done
      const repairs = await RepairOrder.list({
        filter: `status="done" && done_date>="${from}" && done_date<="${to}"`,
        limit: 2000
      }).catch(() => []);

      // Đơn bán hàng completed
      const sales = await SaleOrder.list({
        filter: `status="completed" && created>="${fromDT}" && created<="${toDT}"`,
        limit: 2000
      }).catch(() => []);

      // KTV stats
      const ktvMap = {};
      for (const r of (repairs || [])) {
        const id   = r.assigned_to   || "__unassigned__";
        const name = r.assigned_to_name || "Chưa phân công";
        if (!ktvMap[id]) ktvMap[id] = { id, name, orders: 0, revenue: 0, totalTime: 0, timeCnt: 0 };
        ktvMap[id].orders++;
        ktvMap[id].revenue += Number(r.final_cost || r.estimated_cost || 0);
        if (r.received_date && r.done_date) {
          const ms = new Date(r.done_date) - new Date(r.received_date);
          if (ms > 0) { ktvMap[id].totalTime += ms / 60000; ktvMap[id].timeCnt++; }
        }
      }
      const ktvArr = Object.values(ktvMap)
        .map(k => ({ ...k, avgTime: k.timeCnt ? Math.round(k.totalTime / k.timeCnt) : 0 }))
        .sort((a,b) => b.orders - a.orders);

      // Sale stats
      const saleMap = {};
      for (const s of (sales || [])) {
        const id   = s.created_by   || "__unassigned__";
        const name = s.created_by_name || "Chưa rõ";
        if (!saleMap[id]) saleMap[id] = { id, name, orders: 0, revenue: 0 };
        saleMap[id].orders++;
        saleMap[id].revenue += Number(s.total_amount || s.final_amount || 0);
      }
      const saleArr = Object.values(saleMap).sort((a,b) => b.revenue - a.revenue);

      setKtvData(ktvArr);
      setSaleData(saleArr);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [period, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  // Lọc theo dept nếu cần — match với allStaff
  const getStaffDept = (id) => allStaff.find(s => s.id === id)?.department || "";

  const filteredKtv  = filterDept === "all" ? ktvData  : ktvData.filter(k  => getStaffDept(k.id)  === filterDept);
  const filteredSale = filterDept === "all" ? saleData : saleData.filter(s => getStaffDept(s.id) === filterDept);

  const depts = [...new Set(allStaff.map(s => s.department).filter(Boolean))];

  return (
    <div style={{ padding: isPC ? "24px 32px 40px" : "16px 14px 80px", maxWidth: isPC ? 1200 : "100%", margin:"0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#1e1b4b" }}>👥 KPI Nhân viên</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>Hiệu suất làm việc theo kỳ</div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        {[["week","Tuần này"],["month","Tháng này"],["custom","Tùy chọn"]].map(([k,l]) => (
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
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13 }} />
            <span style={{ color: "#6b7280" }}>—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13 }} />
            <button onClick={load} style={{ padding: "7px 16px", borderRadius: 8, background: "#4f46e5", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>Xem</button>
          </>
        )}
        {depts.length > 0 && (
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 13 }}>
            <option value="all">Tất cả phòng ban</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>⏳ Đang tải...</div>
      ) : (
        <>
          {/* Bảng KTV */}
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: "#374151" }}>🔧 Kỹ thuật viên</div>
          {filteredKtv.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", marginBottom: 20 }}>Không có dữ liệu</div>
          ) : (
            <div style={{ overflowX: "auto", marginBottom: 28 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["#","Nhân viên","Số đơn hoàn thành","Doanh thu","TG xử lý TB (phút)"].map((h,i) => (
                      <th key={i} style={{ padding: "9px 10px", textAlign: i<2?"left":"right",
                        fontWeight: 600, color: "#6b7280", borderBottom: "1.5px solid #e5e7eb", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredKtv.map((k, idx) => (
                    <tr key={k.id} style={{ borderBottom: "1px solid #f3f4f6",
                      background: idx === 0 ? "#fffbeb" : idx === 1 ? "#f0f9ff" : "#fff" }}>
                      <td style={{ padding: "9px 10px", width: 40 }}><RankBadge rank={idx+1} /></td>
                      <td style={{ padding: "9px 10px", fontWeight: 600, color: "#1e1b4b" }}>{k.name}</td>
                      <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 700, color: "#4f46e5" }}>{fmt(k.orders)}</td>
                      <td style={{ padding: "9px 10px", textAlign: "right", color: "#059669", fontWeight: 600 }}>{fmtD(k.revenue)}</td>
                      <td style={{ padding: "9px 10px", textAlign: "right", color: "#6b7280" }}>
                        {k.avgTime > 0 ? fmt(k.avgTime) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Bảng Sales */}
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: "#374151" }}>🛒 Nhân viên Bán hàng</div>
          {filteredSale.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>Không có dữ liệu</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["#","Nhân viên","Số đơn bán","Doanh thu"].map((h,i) => (
                      <th key={i} style={{ padding: "9px 10px", textAlign: i<2?"left":"right",
                        fontWeight: 600, color: "#6b7280", borderBottom: "1.5px solid #e5e7eb" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSale.map((s, idx) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6",
                      background: idx === 0 ? "#fffbeb" : idx === 1 ? "#f0f9ff" : "#fff" }}>
                      <td style={{ padding: "9px 10px", width: 40 }}><RankBadge rank={idx+1} /></td>
                      <td style={{ padding: "9px 10px", fontWeight: 600, color: "#1e1b4b" }}>{s.name}</td>
                      <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 700, color: "#4f46e5" }}>{fmt(s.orders)}</td>
                      <td style={{ padding: "9px 10px", textAlign: "right", color: "#059669", fontWeight: 700 }}>{fmtD(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
