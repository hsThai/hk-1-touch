/* ReportDebtPage.jsx — Báo cáo công nợ khách hàng (tổng hợp theo khách) */
import React, { useState, useEffect, useMemo } from "react";
import { DebtVoucher, DebtPayment, getLocalDate } from "./pb.jsx";

function fmtMoney(n) { return Number(n || 0).toLocaleString("vi-VN") + "đ"; }
function dVN(s) {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d)) return "";
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
}
function daysBetween(a, b) {
  const d1 = new Date(a), d2 = new Date(b);
  if (isNaN(d1) || isNaN(d2)) return 0;
  return Math.floor((d2 - d1) / 86400000);
}

export default function ReportDebtPage({ user }) {
  const [isPC, setIsPC] = React.useState(window.innerWidth >= 1024);
  useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const [vouchers, setVouchers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("summary"); // summary | overdue | paid
  const [sortBy, setSortBy] = useState("remaining");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [v, p] = await Promise.all([
          DebtVoucher.list({ limit: 2000, sort: "-id" }).catch(() => []),
          DebtPayment.list({ limit: 2000, sort: "-id" }).catch(() => []),
        ]);
        setVouchers((v || []).filter(x => (x.party_type || "customer") !== "supplier"));
        setPayments(p || []);
      } catch { }
      setLoading(false);
    })();
  }, []);

  const today = getLocalDate();

  // Tổng hợp theo khách hàng
  const customers = useMemo(() => {
    const map = {};
    vouchers.forEach(v => {
      const key = (v.party_name || "Khách lẻ").trim() + "|" + (v.party_id || "");
      const g = map[key] || (map[key] = {
        name: v.party_name || "Khách lẻ", partyId: v.party_id || "",
        total: 0, paid: 0, remaining: 0, vouchers: 0, overdue: 0, overdueAmount: 0,
        lastPayDate: "", dueSoonest: "",
      });
      g.total += Number(v.total_amount || 0);
      g.paid += Number(v.paid_amount || 0);
      g.remaining += Number(v.remaining || 0);
      g.vouchers += 1;
      if (Number(v.remaining || 0) > 0 && v.due_date) {
        if (v.due_date < today) {
          g.overdue += 1;
          g.overdueAmount += Number(v.remaining || 0);
        }
        if (!g.dueSoonest || v.due_date < g.dueSoonest) g.dueSoonest = v.due_date;
      }
    });
    payments.forEach(p => {
      const key = (p.party_name || "Khách lẻ").trim() + "|";
      Object.values(map).forEach(g => {
        if (g.name === (p.party_name || "Khách lẻ")) {
          const d = p.paid_at || p.created_date || "";
          if (d && d > g.lastPayDate) g.lastPayDate = d;
        }
      });
    });
    return Object.values(map);
  }, [vouchers, payments, today]);

  const totals = useMemo(() => ({
    total: customers.reduce((s, c) => s + c.total, 0),
    paid: customers.reduce((s, c) => s + c.paid, 0),
    remaining: customers.reduce((s, c) => s + c.remaining, 0),
    overdueAmount: customers.reduce((s, c) => s + c.overdueAmount, 0),
    debtors: customers.filter(c => c.remaining > 0).length,
    overdueDebtors: customers.filter(c => c.overdue > 0).length,
  }), [customers]);

  const rows = useMemo(() => {
    let list = customers.filter(c => !q.trim()
      || c.name.toLowerCase().includes(q.trim().toLowerCase()));
    if (tab === "overdue") list = list.filter(c => c.overdue > 0);
    if (tab === "paid") list = list.filter(c => c.remaining <= 0 && c.total > 0);
    return list.sort((a, b) =>
      sortBy === "name" ? a.name.localeCompare(b.name, "vi")
        : sortBy === "overdue" ? b.overdueAmount - a.overdueAmount
          : b.remaining - a.remaining
    );
  }, [customers, q, tab, sortBy]);

  // Chi tiết phiếu nợ của 1 khách khi bấm
  const [detail, setDetail] = useState(null);
  const detailVouchers = useMemo(() => {
    if (!detail) return [];
    return vouchers.filter(v => (v.party_name || "Khách lẻ").trim() === detail.name)
      .sort((a, b) => (a.due_date || "") < (b.due_date || "") ? -1 : 1);
  }, [detail, vouchers]);

  if (loading) return <div style={{ textAlign: "center", padding: 48, color: "#9ca3af" }}>⏳ Đang tải...</div>;

  return (
    <div style={{ padding: isPC ? "24px 32px 40px" : "16px 14px 80px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ fontWeight: 900, fontSize: 18, color: "#1e1b4b", marginBottom: 4 }}>💳 Báo cáo công nợ khách hàng</div>
      <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 16 }}>Cập nhật {dVN(new Date().toISOString())} · Chỉ tính công nợ phải thu của khách</div>

      {/* Thẻ tổng hợp */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Tổng phát sinh", val: fmtMoney(totals.total), color: "#1d4ed8", bg: "#eff6ff" },
          { label: "Đã thu", val: fmtMoney(totals.paid), color: "#059669", bg: "#f0fdf4" },
          { label: "Còn nợ", val: fmtMoney(totals.remaining), color: "#dc2626", bg: "#fef2f2" },
          { label: "Nợ quá hạn", val: fmtMoney(totals.overdueAmount), color: "#b45309", bg: "#fffbeb" },
          { label: "Khách còn nợ", val: totals.debtors + " KH", color: "#7c3aed", bg: "#f5f3ff" },
        ].map((c, i) => (
          <div key={i} style={{ background: c.bg, borderRadius: 14, border: "1.5px solid #e5e7eb", padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: c.color }}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Lọc */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Tìm khách hàng..."
          style={{ flex: 1, minWidth: 180, height: 38, borderRadius: 10, border: "1.5px solid #e5e7eb", paddingLeft: 44, paddingRight: 12, fontSize: 13 }} />
        {[["summary", "Tất cả"], ["overdue", "Quá hạn"], ["paid", "Đã tất toán"]].map(([k, lb]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: "0 14px", height: 38, borderRadius: 10, border: "1.5px solid", cursor: "pointer",
            borderColor: tab === k ? "#dc2626" : "#e5e7eb", background: tab === k ? "#fef2f2" : "#fff",
            color: tab === k ? "#dc2626" : "#6b7280", fontWeight: 700, fontSize: 12,
          }}>{lb}</button>
        ))}
        {[["remaining", "Nợ giảm dần"], ["overdue", "Quá hạn"], ["name", "Tên A-Z"]].map(([k, lb]) => (
          <button key={"s" + k} onClick={() => setSortBy(k)} style={{
            padding: "0 12px", height: 38, borderRadius: 10, border: "1.5px solid", cursor: "pointer",
            borderColor: sortBy === k ? "#4f46e5" : "#e5e7eb", background: sortBy === k ? "#ede9fe" : "#fff",
            color: sortBy === k ? "#4f46e5" : "#6b7280", fontWeight: 700, fontSize: 12,
          }}>{lb}</button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>📭 Không có công nợ nào</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e5e7eb", overflow: "hidden" }}>
          {rows.map((c, i) => (
            <div key={c.name + i} onClick={() => setDetail(c)}
              style={{ padding: "12px 14px", borderBottom: "1px solid #f3f4f6", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: "#1f2937" }}>{c.name}
                  {c.overdue > 0 && <span style={{ marginLeft: 6, fontSize: 10.5, background: "#fef3c7", color: "#b45309", borderRadius: 99, padding: "2px 8px", fontWeight: 800 }}>Quá hạn {c.overdue}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2 }}>
                  {c.vouchers} phiếu · Đã thu {fmtMoney(c.paid)}
                  {c.dueSoonest && c.remaining > 0 ? ` · Hạn gần nhất ${dVN(c.dueSoonest)}` : ""}
                  {c.lastPayDate ? ` · Thu gần nhất ${dVN(c.lastPayDate)}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 14, color: c.remaining > 0 ? "#dc2626" : "#059669" }}>
                  {fmtMoney(c.remaining)}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>tổng {fmtMoney(c.total)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chi tiết từng phiếu nợ của khách */}
      {detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 20, width: "min(560px,95vw)", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16, color: "#1e1b4b" }}>{detail.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Còn nợ {fmtMoney(detail.remaining)} / {fmtMoney(detail.total)}</div>
              </div>
              <button onClick={() => setDetail(null)} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "#f3f4f6", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            {detailVouchers.map(v => {
              const od = Number(v.remaining || 0) > 0 && v.due_date && v.due_date < today;
              return (
                <div key={v.id} style={{ padding: "10px 0", borderBottom: "1px dashed #f1f5f9", fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 700 }}>{v.voucher_code || v.origin_code || "—"}
                      <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>{v.voucher_type || ""}</span>
                    </div>
                    <div style={{ fontWeight: 800, color: Number(v.remaining || 0) > 0 ? (od ? "#dc2626" : "#b45309") : "#059669" }}>
                      {fmtMoney(v.remaining)}
                    </div>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>
                    Tổng {fmtMoney(v.total_amount)} · Đã trả {fmtMoney(v.paid_amount)}
                    {v.due_date ? ` · Hạn ${dVN(v.due_date)}` : ""}
                    {od ? ` · Quá ${daysBetween(v.due_date, today)} ngày` : ""}
                    {v.origin_code ? ` · Đơn ${v.origin_code}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
