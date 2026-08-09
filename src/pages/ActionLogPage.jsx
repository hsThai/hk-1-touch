import React, { useState, useEffect } from "react";
import { getPbUrl, getAuth } from "./pb.jsx";

async function fetchLogs({ page, perPage, search, dateFrom, dateTo }) {
  const base = getPbUrl();
  const { token } = getAuth();
  const filters = [];
  if (search)   filters.push(`(staff_name~"${search}"||action~"${search}"||target_type~"${search}")`);
  if (dateFrom) filters.push(`created_date>="${dateFrom} 00:00:00"`);
  if (dateTo)   filters.push(`created_date<="${dateTo} 23:59:59"`);
  const params = new URLSearchParams({
    page, perPage,
    sort: "-id",
  });
  if (filters.length) params.set("filter", filters.join(" && "));
  const res = await fetch(
    `${base}/api/collections/action_logs/records?${params}`,
    { headers: token ? { Authorization: token } : {} }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // { items, totalItems, totalPages }
}

function fmtDate(s) {
  if (!s) return "";
  const d = new Date(s);
  return (
    d.toLocaleDateString("vi-VN", { day:"2-digit", month:"2-digit" }) +
    " " +
    d.toLocaleTimeString("vi-VN", { hour:"2-digit", minute:"2-digit" })
  );
}

const ACTION_COLOR = {
  create:         { bg:"#dcfce7", color:"#15803d" },
  create_order:   { bg:"#dcfce7", color:"#15803d" },
  create_staff:   { bg:"#dcfce7", color:"#15803d" },
  create_sale:    { bg:"#dcfce7", color:"#15803d" },
  create_return:  { bg:"#fef3c7", color:"#d97706" },
  update:         { bg:"#fef9c3", color:"#b45309" },
  update_order:   { bg:"#fef9c3", color:"#b45309" },
  delete:         { bg:"#fee2e2", color:"#dc2626" },
  delete_order:   { bg:"#fee2e2", color:"#dc2626" },
  login:          { bg:"#eff6ff", color:"#1d4ed8" },
  complete_order: { bg:"#dcfce7", color:"#15803d" },
  export_stock:   { bg:"#fef9c3", color:"#b45309" },
  import_stock:   { bg:"#dbeafe", color:"#1d4ed8" },
  transfer_stock: { bg:"#e9d5ff", color:"#7c3aed" },
  count_stock:    { bg:"#fef3c7", color:"#d97706" },
  pay_debt:       { bg:"#dcfce7", color:"#15803d" },
  add_expense:    { bg:"#fee2e2", color:"#dc2626" },
  create_po:      { bg:"#dbeafe", color:"#1d4ed8" },
  handover:       { bg:"#dcfce7", color:"#15803d" },
  confirm_payment:{ bg:"#dcfce7", color:"#15803d" },
};

export default function ActionLogPage({ user }) {

  const [isPC, setIsPC] = React.useState(window.innerWidth >= 1024);
  React.useEffect(() => {
    const fn = () => setIsPC(window.innerWidth >= 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [search, setSearch]   = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]   = useState("");
  const PER_PAGE = 50;

  useEffect(() => { load(); }, [page, search, dateFrom, dateTo]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLogs({ page, perPage: PER_PAGE, search, dateFrom, dateTo });
      setLogs(data.items || []);
      setTotal(data.totalItems || 0);
    } catch (e) {
      setLogs([]);
      setError("Chưa có dữ liệu hoặc collection chưa tồn tại");
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div style={{ padding: isPC ? "24px 32px 40px" : "16px 14px 80px", maxWidth: isPC ? 1200 : "100%", margin:"0 auto" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <span className="material-icons"
          style={{ fontFamily:"Material Icons", fontSize:24, color:"#4f46e5" }}>history</span>
        <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:"#1e1b4b" }}>
          Nhật ký thao tác
        </h2>
        <span style={{ marginLeft:"auto", fontSize:12, color:"#9ca3af" }}>
          {total > 0 ? `${total} bản ghi` : ""}
        </span>
      </div>

      {/* Filters */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
        <input
          placeholder="🔍 Tìm nhân viên, hành động..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ flex:1, minWidth:160, padding:"8px 12px", borderRadius:8,
            border:"1px solid #e5e7eb", fontSize:14 }}
        />
        <input type="date" value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); if(!dateTo) setDateTo(e.target.value); setPage(1); }}
          style={{ padding:"8px 10px", borderRadius:8, border:"1px solid #e5e7eb", fontSize:13 }}
        />
        <span style={{ lineHeight:"34px", color:"#9ca3af", fontSize:13 }}>→</span>
        <input type="date" value={dateTo}
          onChange={e => { setDateTo(e.target.value); if(!dateFrom) setDateFrom(e.target.value); setPage(1); }}
          style={{ padding:"8px 10px", borderRadius:8, border:"1px solid #e5e7eb", fontSize:13 }}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>⏳ Đang tải...</div>
      ) : error || logs.length === 0 ? (
        <div style={{ textAlign:"center", padding:48, color:"#9ca3af" }}>
          <span className="material-icons"
            style={{ fontFamily:"Material Icons", fontSize:48, display:"block", marginBottom:10 }}>
            history
          </span>
          <div style={{ fontWeight:600, fontSize:15, color:"#374151", marginBottom:6 }}>
            Chưa có nhật ký nào
          </div>
          <div style={{ fontSize:13 }}>{error || "Thử thay đổi bộ lọc để xem kết quả"}</div>
        </div>
      ) : (
        <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid #e5e7eb" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["Thời gian","Nhân viên","Hành động","Đối tượng","Ghi chú"].map(h => (
                  <th key={h} style={{ padding:"10px 12px", textAlign:"left",
                    fontWeight:700, color:"#374151", borderBottom:"1px solid #e5e7eb",
                    whiteSpace:"nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => {
                const actionKey = (log.action||"").toLowerCase();
                const ac = ACTION_COLOR[actionKey] || { bg:"#eef2ff", color:"#4f46e5" };
                return (
                  <tr key={log.id || i}
                    style={{ background: i%2===0 ? "#fff" : "#f9fafb",
                      borderBottom:"1px solid #f3f4f6" }}>
                    <td style={{ padding:"9px 12px", color:"#6b7280", whiteSpace:"nowrap" }}>
                      {fmtDate(log.created_date)}
                    </td>
                    <td style={{ padding:"9px 12px", fontWeight:600, color:"#1f2937" }}>
                      {log.staff_name || "—"}
                    </td>
                    <td style={{ padding:"9px 12px" }}>
                      <span style={{ background:ac.bg, color:ac.color,
                        borderRadius:6, padding:"2px 8px", fontSize:12, fontWeight:600,
                        whiteSpace:"nowrap" }}>
                        {log.action || "—"}
                      </span>
                    </td>
                    <td style={{ padding:"9px 12px", color:"#374151" }}>
                      {log.target_type
                        ? `${log.target_type}${log.target_id ? " #" + log.target_id : ""}`
                        : "—"}
                    </td>
                    <td style={{ padding:"9px 12px", color:"#6b7280", maxWidth:200,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {log.note || ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display:"flex", justifyContent:"center", alignItems:"center",
          gap:10, marginTop:16 }}>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
            style={{ padding:"6px 16px", borderRadius:8, border:"1px solid #e5e7eb",
              background: page===1 ? "#f3f4f6" : "#fff",
              cursor: page===1 ? "default" : "pointer",
              color: page===1 ? "#9ca3af" : "#374151", fontWeight:600 }}>
            ← Trước
          </button>
          <span style={{ fontSize:13, color:"#6b7280" }}>
            Trang {page}/{totalPages} · {total} bản ghi
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
            style={{ padding:"6px 16px", borderRadius:8, border:"1px solid #e5e7eb",
              background: page===totalPages ? "#f3f4f6" : "#fff",
              cursor: page===totalPages ? "default" : "pointer",
              color: page===totalPages ? "#9ca3af" : "#374151", fontWeight:600 }}>
            Sau →
          </button>
        </div>
      )}
    </div>
  );
}
