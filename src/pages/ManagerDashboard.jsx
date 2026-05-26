/* ManagerDashboard.jsx — KPI Dashboard cho Manager */
import React, { useState, useEffect, useMemo } from "react";
import { SparePartUsage } from "./pb.jsx";

// ── Helpers ────────────────────────────────────────────────
function startOf(period) {
  const now = new Date();
  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === "7days") {
    const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d;
  }
  if (period === "30days") {
    const d = new Date(now); d.setDate(d.getDate() - 29); d.setHours(0,0,0,0); return d;
  }
  if (period === "thismonth") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(0);
}

function inPeriod(dateStr, period) {
  if (!dateStr) return false;
  return new Date(dateStr) >= startOf(period);
}

function fmtMoney(n) {
  if (!n) return "0đ";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0","") + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return n.toLocaleString("vi-VN") + "đ";
}

function fmtFull(n) {
  return (n || 0).toLocaleString("vi-VN") + "đ";
}

const PERIOD_TABS = [
  { key:"today",     label:"Hôm nay" },
  { key:"7days",     label:"7 ngày" },
  { key:"30days",    label:"30 ngày" },
  { key:"thismonth", label:"Tháng này" },
];

const DONE_STATUSES = ["Hoàn Thành", "Đã Giao", "Hoàn thành", "Đã giao"];
const ACTIVE_STATUSES = ["Mới Nhận", "Đang Kiểm Tra", "Chờ Linh Kiện", "Đang Sửa"];

// ── Main Component ──────────────────────────────────────────
export function ManagerDashboard({ currentUser, orders = [], users = [] }) {
  const [period, setPeriod]     = useState("today");
  const [usages, setUsages]     = useState([]);
  const [loadingUsage, setLoadingUsage] = useState(true);

  // Load SparePartUsage
  useEffect(() => {
    async function load() {
      setLoadingUsage(true);
      try {
        const list = await SparePartUsage.list({ limit: 500 });
        setUsages(list || []);
      } catch { setUsages([]); }
      setLoadingUsage(false);
    }
    load();
  }, []);

  // ── Filter orders theo kỳ ──
  const periodOrders = useMemo(() =>
    orders.filter(o => inPeriod(o.created || o.received_date || o.created_date, period)),
    [orders, period]
  );

  const periodUsages = useMemo(() =>
    usages.filter(u => inPeriod(u.created_date || u.created, period)),
    [usages, period]
  );

  // ── Stats ──
  const stats = useMemo(() => {
    const done     = periodOrders.filter(o => DONE_STATUSES.includes(o.status));
    const active   = periodOrders.filter(o => ACTIVE_STATUSES.includes(o.status));
    const overdue  = periodOrders.filter(o => {
      const due = o.estimated_done_date || o.estimated_completion_date;
      return due && new Date(due) < new Date() && !DONE_STATUSES.includes(o.status);
    });
    const revenue  = done.reduce((s, o) => s + (o.final_cost || o.actual_cost || 0), 0);
    const partsCost= periodUsages
      .filter(u => u.status === "finalized" || u.status === "issued")
      .reduce((s, u) => s + (u.total_price || 0), 0);

    return { total: periodOrders.length, done: done.length, active: active.length, overdue: overdue.length, revenue, partsCost };
  }, [periodOrders, periodUsages]);

  // ── KTV stats ──
  const ktvStats = useMemo(() => {
    const techUsers = users.filter(u => u.role === "technician" || u.role === "ktv");
    return techUsers.map(u => {
      const myOrders   = periodOrders.filter(o => o.assigned_to === u.id);
      const myDone     = myOrders.filter(o => DONE_STATUSES.includes(o.status));
      const myRevenue  = myDone.reduce((s, o) => s + (o.final_cost || o.actual_cost || 0), 0);
      const kpiScore   = u.kpi ?? u.kpi_score ?? 100;
      return { ...u, myTotal: myOrders.length, myDone: myDone.length, myRevenue, kpiScore };
    }).sort((a, b) => b.kpiScore - a.kpiScore);
  }, [users, periodOrders]);

  // ── Biểu đồ 7 ngày ──
  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const dayOrders = orders.filter(o => {
        const t = new Date(o.created || o.received_date || o.created_date);
        return t >= d && t < next;
      });
      days.push({
        label: i === 0 ? "Hôm nay" : `${d.getDate()}/${d.getMonth()+1}`,
        done:   dayOrders.filter(o => DONE_STATUSES.includes(o.status)).length,
        active: dayOrders.filter(o => ACTIVE_STATUSES.includes(o.status)).length,
        total:  dayOrders.length,
      });
    }
    return days;
  }, [orders]);

  const maxBar = Math.max(...chartData.map(d => d.total), 1);

  // ── Top linh kiện ──
  const topParts = useMemo(() => {
    const map = {};
    periodUsages.forEach(u => {
      if (!u.part_name) return;
      map[u.part_name] = (map[u.part_name] || 0) + (u.qty_used || u.qty_requested || 1);
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [periodUsages]);

  const maxPart = Math.max(...topParts.map(p => p.count), 1);

  // ── KPI badge ──
  function kpiBadge(score) {
    if (score >= 90) return { label: "Xuất sắc", bg: "#dcfce7", color: "#065f46" };
    if (score >= 70) return { label: "Tốt",      bg: "#dbeafe", color: "#1d4ed8" };
    return            { label: "Cần cải thiện",  bg: "#fee2e2", color: "#dc2626" };
  }

  // ── Render ──────────────────────────────────────────────
  return (
    <div style={{ padding: "16px 14px 100px", maxWidth: 640, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#1e1b4b", marginBottom: 4 }}>
          📊 KPI Dashboard
        </div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          {new Date().toLocaleDateString("vi-VN", { weekday:"long", day:"2-digit", month:"2-digit", year:"numeric" })}
        </div>
      </div>

      {/* ── Period tabs ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {PERIOD_TABS.map(t => (
          <button key={t.key} onClick={() => setPeriod(t.key)}
            style={{
              padding: "8px 16px", borderRadius: 99, border: "none", cursor: "pointer",
              background: period === t.key ? "#4f46e5" : "#f3f4f6",
              color:      period === t.key ? "#fff"    : "#374151",
              fontWeight: period === t.key ? 800       : 600,
              fontSize: 13, transition: "all .15s",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Doanh thu lớn ── */}
      <div style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", borderRadius: 20, padding: "20px 24px", marginBottom: 20, color: "#fff" }}>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>💰 Doanh thu kỳ này</div>
        <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1 }}>
          {fmtFull(stats.revenue)}
        </div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
          {stats.done} đơn hoàn thành · LK: {fmtMoney(stats.partsCost)}
        </div>
      </div>

      {/* ── Cards 2 cột ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[
          { icon:"📋", label:"Tổng đơn",      value: stats.total,    bg:"#eef2ff", color:"#4f46e5", border:"#c7d2fe" },
          { icon:"✅", label:"Hoàn thành",     value: stats.done,     bg:"#f0fdf4", color:"#059669", border:"#86efac" },
          { icon:"⚙️", label:"Đang xử lý",    value: stats.active,   bg:"#fffbeb", color:"#d97706", border:"#fcd34d" },
          { icon:"⏱️", label:"Trễ hạn",       value: stats.overdue,  bg:"#fef2f2", color:"#dc2626", border:"#fca5a5" },
        ].map((c, i) => (
          <div key={i} style={{
            background: c.bg, borderRadius: 16, padding: "16px 14px",
            border: `2px solid ${c.border}`,
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: c.color, lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, fontWeight: 600 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* ── Biểu đồ 7 ngày ── */}
      <div style={{ background: "#fff", borderRadius: 20, padding: "20px 16px", marginBottom: 20, boxShadow: "0 2px 12px rgba(0,0,0,.07)" }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#1e1b4b", marginBottom: 16 }}>
          📈 Đơn hàng 7 ngày gần nhất
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
          {chartData.map((d, i) => {
            const heightDone   = d.done   > 0 ? Math.max(8,  (d.done   / maxBar) * 96) : 0;
            const heightActive = d.active > 0 ? Math.max(8,  (d.active / maxBar) * 96) : 0;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                {/* Count label */}
                <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", minHeight: 16 }}>
                  {d.total > 0 ? d.total : ""}
                </div>
                {/* Stacked bars */}
                <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                  {heightActive > 0 && (
                    <div style={{ width: "80%", height: heightActive, background: "#fb923c", borderRadius: "4px 4px 0 0" }} />
                  )}
                  {heightDone > 0 && (
                    <div style={{ width: "80%", height: heightDone, background: "#22c55e", borderRadius: heightActive > 0 ? 0 : "4px 4px 0 0" }} />
                  )}
                  {d.total === 0 && (
                    <div style={{ width: "80%", height: 4, background: "#e5e7eb", borderRadius: 4 }} />
                  )}
                </div>
                {/* Day label */}
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, textAlign: "center" }}>{d.label}</div>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div style={{ display: "flex", gap: 16, marginTop: 12, justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6b7280" }}>
            <div style={{ width: 10, height: 10, background: "#22c55e", borderRadius: 3 }} /> Hoàn thành
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6b7280" }}>
            <div style={{ width: 10, height: 10, background: "#fb923c", borderRadius: 3 }} /> Đang xử lý
          </div>
        </div>
      </div>

      {/* ── KTV Table ── */}
      <div style={{ background: "#fff", borderRadius: 20, padding: "20px 16px", marginBottom: 20, boxShadow: "0 2px 12px rgba(0,0,0,.07)" }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#1e1b4b", marginBottom: 16 }}>
          🔧 KPI Kỹ thuật viên
        </div>

        {ktvStats.length === 0 && (
          <div style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0", fontSize: 14 }}>
            Chưa có KTV nào
          </div>
        )}

        {ktvStats.map((ktv, i) => {
          const badge = kpiBadge(ktv.kpiScore);
          const roleIcon = ktv.role === "manager" ? "👑" : ktv.role === "receptionist" ? "🎧" : ktv.role === "warehouse" ? "📦" : "🔧";
          return (
            <div key={ktv.id || i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 0", borderBottom: i < ktvStats.length - 1 ? "1px solid #f3f4f6" : "none",
            }}>
              {/* Avatar */}
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, flexShrink: 0,
              }}>
                {ktv.avatar_url
                  ? <img src={ktv.avatar_url} alt="" style={{ width:44, height:44, borderRadius:"50%", objectFit:"cover" }} />
                  : roleIcon}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1e1b4b", marginBottom: 2 }}>
                  {ktv.name || ktv.full_name}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {ktv.myDone}/{ktv.myTotal} đơn · {fmtMoney(ktv.myRevenue)}
                </div>
              </div>

              {/* KPI Score + badge */}
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#1e1b4b", lineHeight: 1 }}>
                  {ktv.kpiScore}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px",
                  borderRadius: 99, marginTop: 4,
                  background: badge.bg, color: badge.color,
                }}>
                  {badge.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Top linh kiện ── */}
      <div style={{ background: "#fff", borderRadius: 20, padding: "20px 16px", boxShadow: "0 2px 12px rgba(0,0,0,.07)" }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: "#1e1b4b", marginBottom: 16 }}>
          🔩 Top linh kiện hay dùng
          {loadingUsage && <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>⏳</span>}
        </div>

        {topParts.length === 0 && !loadingUsage && (
          <div style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0", fontSize: 14 }}>
            Chưa có dữ liệu linh kiện
          </div>
        )}

        {topParts.map((p, i) => (
          <div key={p.name} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", flex: 1, marginRight: 8 }}>
                {i + 1}. {p.name}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#4f46e5", flexShrink: 0 }}>
                {p.count} lần
              </div>
            </div>
            <div style={{ height: 8, background: "#f3f4f6", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                width: `${(p.count / maxPart) * 100}%`,
                background: "linear-gradient(90deg,#4f46e5,#7c3aed)",
                transition: "width .4s ease",
              }} />
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

export default ManagerDashboard;
