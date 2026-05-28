/* CashierApp.jsx — App 3: Kế toán & Bán hàng lẻ */
import React, { useState, useEffect } from "react";
import { RepairOrder, SaleOrder, SaleOrderItem, Expense } from "./pb.jsx";

const ALLOWED_ROLES = ["accountant", "cashier", "manager", "admin"];
const DONE_STATUS   = ["Hoàn Thành", "Đã Giao", "Đã Thanh Toán"];

function fmtMoney(n) { return (n || 0).toLocaleString("vi-VN") + "đ"; }
function todayStr() {
  const d = new Date();
  return String(d.getDate()).padStart(2,"0") + "/" + String(d.getMonth()+1).padStart(2,"0") + "/" + d.getFullYear();
}
function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr); const now = new Date();
  return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate();
}

function OverviewTab({ user }) {
  const [repairOrders, setRepairOrders] = useState([]);
  const [saleOrders,   setSaleOrders]   = useState([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [ro, so] = await Promise.all([
          RepairOrder.list({ limit: 500, sort: "-received_date" }),
          SaleOrder.list({ limit: 500, sort: "-created" }),
        ]);
        setRepairOrders(ro || []);
        setSaleOrders(so || []);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const repairDone    = repairOrders.filter(o => DONE_STATUS.includes(o.status) && isToday(o.done_date || o.updated));
  const repairRevenue = repairDone.reduce((s, o) => s + (o.final_cost || 0), 0);
  const saleToday     = saleOrders.filter(o => isToday(o.created || o.created_date));
  const saleRevenue   = saleToday.reduce((s, o) => s + (o.total || 0), 0);

  const cards = [
    { icon:"🔧", label:"Đơn sửa hoàn thành",   value: repairDone.length,      sub:"đơn", bg:"#eff6ff", border:"#bfdbfe", color:"#1d4ed8" },
    { icon:"💰", label:"Doanh thu sửa hôm nay", value: fmtMoney(repairRevenue), sub:"",   bg:"#f0fdf4", border:"#86efac", color:"#059669" },
    { icon:"🛒", label:"Đơn bán lẻ hôm nay",   value: saleToday.length,       sub:"đơn", bg:"#fefce8", border:"#fde68a", color:"#ca8a04" },
    { icon:"💵", label:"Doanh thu bán lẻ",       value: fmtMoney(saleRevenue),  sub:"",   bg:"#fdf4ff", border:"#e9d5ff", color:"#7c3aed" },
  ];

  if (loading) return React.createElement("div", { style:{textAlign:"center",padding:48,color:"#9ca3af"} }, "⏳ Đang tải...");

  return React.createElement("div", { style:{padding:"16px 14px 100px"} },
    React.createElement("div", { style:{fontWeight:900,fontSize:18,color:"#1e1b4b",marginBottom:20} }, "📊 Tổng quan hôm nay"),
    React.createElement("div", { style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12} },
      ...cards.map((c,i) => React.createElement("div", { key:i,
        style:{background:c.bg,border:"2px solid "+c.border,borderRadius:16,padding:"16px 14px"} },
        React.createElement("div",{style:{fontSize:24,marginBottom:6}},c.icon),
        React.createElement("div",{style:{fontSize:c.sub?28:20,fontWeight:900,color:c.color,lineHeight:1.1}},c.value),
        React.createElement("div",{style:{fontSize:12,color:"#6b7280",marginTop:6,fontWeight:600}},c.label)
      ))
    ),
    React.createElement("div",{style:{background:"#f9fafb",borderRadius:16,padding:"16px",marginTop:20,border:"1px solid #e5e7eb"}},
      React.createElement("div",{style:{fontWeight:800,fontSize:14,color:"#374151",marginBottom:8}},"💡 Tổng doanh thu hôm nay"),
      React.createElement("div",{style:{fontSize:32,fontWeight:900,color:"#059669"}},fmtMoney(repairRevenue+saleRevenue)),
      React.createElement("div",{style:{fontSize:12,color:"#9ca3af",marginTop:4}},"Sửa chữa + Bán lẻ")
    )
  );
}

const NAV_TABS = [
  { key:"sale",     icon:"point_of_sale", label:"Bán hàng" },
  { key:"revenue",  icon:"bar_chart",     label:"Doanh thu" },
  { key:"expense",  icon:"receipt_long",  label:"Chi phí" },
  { key:"overview", icon:"dashboard",     label:"Tổng quan" },
];

export default function CashierApp({ user }) {
  const [tab, setTab] = useState("sale");
  const [SaleOrderPage,     setSaleOrderPage]     = useState(null);
  const [RevenueReportPage, setRevenueReportPage] = useState(null);
  const [ExpensePage,       setExpensePage]       = useState(null);

  useEffect(() => {
    import("./SaleOrderPage.jsx").then(m => setSaleOrderPage(() => m.default)).catch(()=>{});
    import("./RevenueReportPage.jsx").then(m => setRevenueReportPage(() => m.default)).catch(()=>{});
    import("./ExpensePage.jsx").then(m => setExpensePage(() => m.default)).catch(()=>{});
  }, []);

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div style={{ padding:48, textAlign:"center", color:"#6b7280" }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🔒</div>
        <div style={{ fontSize:18, fontWeight:700, color:"#dc2626" }}>Không có quyền truy cập</div>
        <div style={{ fontSize:14, marginTop:8 }}>Chức năng này chỉ dành cho Kế toán, Thu ngân và Quản lý.</div>
      </div>
    );
  }

  const Fallback = () => <div style={{ textAlign:"center", padding:48, color:"#9ca3af" }}>⏳ Đang tải...</div>;

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:"#f9fafb" }}>
      <div style={{ background:"linear-gradient(135deg,#059669,#047857)", color:"#fff", padding:"14px 16px 12px", flexShrink:0 }}>
        <div style={{ fontWeight:900, fontSize:17 }}>🏪 Kế toán & Bán hàng</div>
        <div style={{ fontSize:12, opacity:0.85, marginTop:2 }}>{user.full_name || user.name} · {todayStr()}</div>
      </div>

      <div style={{ flex:1, overflowY:"auto" }}>
        {tab === "sale"     && (SaleOrderPage     ? <SaleOrderPage user={user} />     : <Fallback />)}
        {tab === "revenue"  && (RevenueReportPage  ? <RevenueReportPage user={user} />  : <Fallback />)}
        {tab === "expense"  && (ExpensePage        ? <ExpensePage user={user} />        : <Fallback />)}
        {tab === "overview" && <OverviewTab user={user} />}
      </div>

      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#fff", borderTop:"1.5px solid #e5e7eb", display:"flex", zIndex:100, paddingBottom:"env(safe-area-inset-bottom)" }}>
        {NAV_TABS.map(n => {
          const active = tab === n.key;
          return (
            <button key={n.key} onClick={() => setTab(n.key)}
              style={{ flex:1, border:"none", background:"none", cursor:"pointer", padding:"10px 4px 8px",
                display:"flex", flexDirection:"column", alignItems:"center", gap:3, position:"relative",
                color: active ? "#059669" : "#9ca3af" }}>
              {active && <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:32, height:2, background:"#059669", borderRadius:2 }} />}
              <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:24, lineHeight:1, color: active ? "#059669" : "#9ca3af" }}>{n.icon}</span>
              <span style={{ fontSize:10, fontWeight: active ? 800 : 500 }}>{n.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
