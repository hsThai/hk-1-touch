/* ManagerDashboard.jsx — App 4: Manager Dashboard (5 tabs) */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Staff, RepairOrder, SparePart, SaleOrder, Expense,
         StockLedger, Warehouse, Customer, AppSettings, StockImport, SparePartUsage } from "./pb.jsx";

// ── Constants ──────────────────────────────────────────────
const ALLOWED = ["manager","admin","owner"];
const DONE_ST = ["Hoàn Thành","Đã Giao","Đã Thanh Toán"];
const SKIP_ST = ["Hoàn Thành","Đã Giao","Huỷ","Đã Thanh Toán"];

const STATUS_COLORS = {
  "Mới Nhận":"#2563eb","Chờ KTV":"#7c3aed","KTV Đang Kiểm":"#0891b2",
  "Chờ Báo Giá":"#ca8a04","Chờ Xác Nhận":"#d97706","Chờ KTV Sửa":"#ea580c",
  "Đang Sửa":"#4f46e5","Chờ Linh Kiện":"#be185d","Hoàn Thành":"#059669",
  "Đã Giao":"#16a34a","Đã Thanh Toán":"#15803d","Huỷ":"#dc2626",
};

const ROLE_LABELS = { manager:"👑 Quản lý", admin:"⚙️ Admin", technician:"🔧 KTV",
  receptionist:"🎧 Lễ tân", warehouse:"📦 Kho", cashier:"💰 Thu ngân",
  accountant:"📊 Kế toán", owner:"🏢 Chủ" };
const ROLE_COLORS = { manager:"#7c3aed", admin:"#4f46e5", technician:"#059669",
  receptionist:"#0891b2", warehouse:"#d97706", cashier:"#dc2626",
  accountant:"#2563eb", owner:"#1e1b4b" };

// ── Helpers ────────────────────────────────────────────────
function fmtMoney(n) { return (n||0).toLocaleString("vi-VN") + "đ"; }
function fmtShort(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1).replace(".0","") + "tr";
  if (n >= 1_000)     return Math.round(n/1_000) + "k";
  return String(n);
}
function todayStr() {
  const d = new Date();
  return String(d.getDate()).padStart(2,"0") + "/" +
         String(d.getMonth()+1).padStart(2,"0") + "/" + d.getFullYear();
}
function isToday(ds) {
  if (!ds) return false;
  const d = new Date(ds), n = new Date();
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
}
function startOf(period) {
  const now = new Date();
  if (period==="today")     return new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if (period==="thisweek")  { const d=new Date(now); d.setDate(d.getDate()-d.getDay()+1); d.setHours(0,0,0,0); return d; }
  if (period==="7days")     { const d=new Date(now); d.setDate(d.getDate()-6); d.setHours(0,0,0,0); return d; }
  if (period==="30days")    { const d=new Date(now); d.setDate(d.getDate()-29); d.setHours(0,0,0,0); return d; }
  if (period==="thismonth") return new Date(now.getFullYear(),now.getMonth(),1);
  return new Date(0);
}
function inPeriod(ds, period) { return ds && new Date(ds) >= startOf(period); }
function timeAgo(ds) {
  if (!ds) return "";
  const diff = Date.now() - new Date(ds).getTime();
  const m = Math.floor(diff/60000);
  if (m < 1)  return "vừa xong";
  if (m < 60) return m + " phút trước";
  const h = Math.floor(m/60);
  if (h < 24) return h + " giờ trước";
  return Math.floor(h/24) + " ngày trước";
}

// Tạo mảng 7 ngày gần nhất
function last7Days() {
  return Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate() - (6-i)); d.setHours(0,0,0,0);
    return d;
  });
}
function sameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

// ── CSS Bar Chart ──────────────────────────────────────────
function useBreakpoint() {
  const [bp, setBp] = React.useState(() => {
    const w = window.innerWidth;
    if (w >= 1200) return "pc";
    if (w >= 768)  return "tablet";
    return "mobile";
  });
  React.useEffect(() => {
    const fn = () => {
      const w = window.innerWidth;
      setBp(w >= 1200 ? "pc" : w >= 768 ? "tablet" : "mobile");
    };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return bp;
}

function BarChart({ data, height=100 }) {
  // data: [{label, value}]
  const max = Math.max(...data.map(d=>d.value), 1);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:height, padding:"0 4px" }}>
      {data.map((d,i) => {
        const pct = Math.round((d.value/max)*100);
        return (
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <div style={{ fontSize:9, color:"#6b7280", fontWeight:600, minHeight:14 }}>
              {d.value > 0 ? fmtShort(d.value) : ""}
            </div>
            <div title={fmtMoney(d.value)}
              style={{ width:"100%", background:"#059669", borderRadius:"4px 4px 0 0",
                height: Math.max(pct, d.value>0?4:0) + "%", minHeight: d.value>0?4:0,
                transition:"height .3s", cursor:"default",
                boxShadow: d.value>0?"0 2px 4px rgba(5,150,105,.3)":"none" }} />
            <div style={{ fontSize:9, color:"#9ca3af", fontWeight:500, textAlign:"center" }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── TAB 1: Overview ────────────────────────────────────────
function OverviewTab({ repairOrders, saleOrders, spareParts, ledgerSummary=[] }) {
  const now = new Date();
  const bp = useBreakpoint();

  const active    = repairOrders.filter(o => !SKIP_ST.includes(o.status));
  const doneToday = repairOrders.filter(o => DONE_ST.includes(o.status) && isToday(o.done_date||o.updated));
  const saleToday = saleOrders.filter(o => o.status==="paid" && isToday(o.created||o.created_date));
  const revenue   = doneToday.reduce((s,o)=>s+(o.final_cost||0),0) + saleToday.reduce((s,o)=>s+(o.total||0),0);
  const overdue   = repairOrders.filter(o => !SKIP_ST.includes(o.status) && o.estimated_done_date && new Date(o.estimated_done_date) < now);

  const days7 = last7Days();
  const chartData = days7.map(day => {
    const lbl = String(day.getDate()).padStart(2,"0")+"/"+String(day.getMonth()+1).padStart(2,"0");
    const rv = repairOrders.filter(o=>DONE_ST.includes(o.status)&&o.done_date&&sameDay(new Date(o.done_date),day)).reduce((s,o)=>s+(o.final_cost||0),0);
    const sv = saleOrders.filter(o=>o.status==="paid"&&(o.created||o.created_date)&&sameDay(new Date(o.created||o.created_date),day)).reduce((s,o)=>s+(o.total||0),0);
    return { label:lbl, value:rv+sv };
  });

  const lowStock = ledgerSummary.filter(p => p.total_qty <= Math.max(p.min_qty, 2));
  const recent5  = [...repairOrders].sort((a,b)=>new Date(b.created||b.received_date)-new Date(a.created||a.received_date)).slice(0,5);

  const CARDS = [
    { icon:"🔧", label:"Đơn đang sửa",       value:active.length,     sub:"đơn", bg:"#eff6ff", bc:"#bfdbfe", cl:"#1d4ed8" },
    { icon:"✅", label:"Hoàn thành hôm nay",  value:doneToday.length,  sub:"đơn", bg:"#f0fdf4", bc:"#86efac", cl:"#059669" },
    { icon:"💰", label:"Doanh thu hôm nay",   value:fmtMoney(revenue), sub:"",    bg:"#fefce8", bc:"#fde68a", cl:"#ca8a04" },
    { icon:"⚠️", label:"Quá hạn",             value:overdue.length,    sub:"đơn", bg:"#fef2f2", bc:"#fca5a5", cl:"#dc2626" },
  ];

  return (
    <div style={{ padding: bp==="pc" ? "24px 32px 40px" : bp==="tablet" ? "20px 24px 80px" : "16px 14px 80px", maxWidth:1400, margin:"0 auto" }}>

      {/* === CARDS === */}
      <div style={{
        display:"grid",
        gridTemplateColumns: bp==="mobile" ? "1fr 1fr" : "repeat(4,1fr)",
        gap: bp==="mobile" ? 12 : 16,
        marginBottom: bp==="pc" ? 20 : 16,
      }}>
        {CARDS.map((c,i) => (
          <div key={i} style={{ background:c.bg, border:"2px solid "+c.bc, borderRadius:16,
            padding: bp==="mobile" ? "14px 12px" : "20px 18px" }}>
            <div style={{ fontSize: bp==="mobile" ? 22 : 26, marginBottom:4 }}>{c.icon}</div>
            <div style={{ fontSize: bp==="mobile" ? (c.sub?24:18) : 32, fontWeight:900, color:c.cl, lineHeight:1.1 }}>
              {c.value}{c.sub ? <span style={{fontSize: bp==="mobile"?13:16}}> {c.sub}</span> : ""}
            </div>
            <div style={{ fontSize: bp==="mobile"?11:13, color:"#6b7280", marginTop:5, fontWeight:600 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* === PC: Chart 60% | Đơn mới 40% | Mobile: dọc === */}
      <div style={{
        display:"grid",
        gridTemplateColumns: bp==="mobile" ? "1fr" : "3fr 2fr",
        gap:16,
        marginBottom:16,
        alignItems:"start",
      }}>
        {/* Chart */}
        <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", padding:16 }}>
          <div style={{ fontWeight:800, fontSize:14, color:"#374151", marginBottom:14 }}>📈 Doanh thu 7 ngày gần nhất</div>
          <BarChart data={chartData} height={bp==="mobile"?100:140} />
        </div>

        {/* Đơn mới nhất */}
        <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid #f3f4f6", fontWeight:800, fontSize:14 }}>🕐 Đơn mới nhất</div>
          {recent5.length===0 && <div style={{padding:"20px 16px",color:"#9ca3af",fontSize:13}}>Chưa có đơn nào</div>}
          {recent5.map(o => (
            <div key={o.id} style={{ padding:"10px 16px", borderBottom:"1px solid #f3f4f6",
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:13 }}>{o.order_code}</div>
                <div style={{ fontSize:11, color:"#6b7280", marginTop:1 }}>
                  {o.customer_name||"—"} · {o.device_model||"—"}
                </div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0, marginLeft:8 }}>
                <div style={{ fontSize:11, background:(STATUS_COLORS[o.status]||"#6b7280")+"22",
                  color:STATUS_COLORS[o.status]||"#6b7280", borderRadius:99, padding:"2px 8px", fontWeight:700 }}>
                  {o.status}
                </div>
                <div style={{ fontSize:10, color:"#9ca3af", marginTop:2 }}>{timeAgo(o.created||o.received_date)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* === Tồn kho sắp hết — full width === */}
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid #f3f4f6", fontWeight:800, fontSize:14 }}>⚠️ Tồn kho sắp hết</div>
        {lowStock.length === 0 ? (
          <div style={{ padding:"20px 16px", color:"#059669", fontSize:13, fontWeight:600 }}>✅ Tồn kho ổn định</div>
        ) : (
          <div style={{
            display:"grid",
            gridTemplateColumns: bp==="mobile" ? "1fr" : bp==="tablet" ? "1fr 1fr" : "repeat(3,1fr)",
          }}>
            {lowStock.slice(0, bp==="mobile"?8:12).map(p => (
              <div key={p.id} style={{ padding:"10px 16px", borderBottom:"1px solid #f3f4f6",
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>{p.name}</div>
                  <div style={{ fontSize:11, color:"#6b7280" }}>{p.sku||"—"}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontWeight:800, fontSize:14, color:"#dc2626" }}>{p.stock_qty||0}</span>
                  <span style={{ fontSize:11, background:"#fee2e2", color:"#dc2626",
                    borderRadius:99, padding:"2px 8px", fontWeight:700 }}>Sắp hết</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ── TAB 2: Revenue ─────────────────────────────────────────
function RevenueTab({ repairOrders, saleOrders, expenses }) {
  const [period, setPeriod] = useState("today");

  const pRepair = useMemo(() =>
    repairOrders.filter(o=>DONE_ST.includes(o.status)&&inPeriod(o.done_date||o.updated,period)),
    [repairOrders,period]);
  const pSale   = useMemo(() =>
    saleOrders.filter(o=>o.status==="paid"&&inPeriod(o.created||o.created_date,period)),
    [saleOrders,period]);
  const pExp    = useMemo(() =>
    expenses.filter(e=>inPeriod(e.expense_date||e.created,period)),
    [expenses,period]);

  const repairRev = pRepair.reduce((s,o)=>s+(o.final_cost||0),0);
  const saleRev   = pSale.reduce((s,o)=>s+(o.total||0),0);
  const totalRev  = repairRev+saleRev;
  const totalExp  = pExp.reduce((s,e)=>s+(e.amount||0),0);
  const profit    = totalRev-totalExp;

  const CARDS = [
    { icon:"💰", label:"DT Sửa chữa",     value:fmtMoney(repairRev),  bg:"#eff6ff", bc:"#bfdbfe", cl:"#1d4ed8" },
    { icon:"🛒", label:"DT Bán lẻ",        value:fmtMoney(saleRev),    bg:"#f0fdf4", bc:"#86efac", cl:"#059669" },
    { icon:"📦", label:"Tổng DT",          value:fmtMoney(totalRev),   bg:"#fefce8", bc:"#fde68a", cl:"#ca8a04" },
    { icon:"💸", label:"Chi phí",          value:fmtMoney(totalExp),   bg:"#fef2f2", bc:"#fca5a5", cl:"#dc2626" },
    { icon:"📈", label:"Lợi nhuận",        value:fmtMoney(profit),
      bg:profit>=0?"#f0fdf4":"#fef2f2", bc:profit>=0?"#86efac":"#fca5a5", cl:profit>=0?"#059669":"#dc2626" },
    { icon:"📋", label:"Tổng đơn",         value:(pRepair.length+pSale.length)+" đơn",
      bg:"#fdf4ff", bc:"#e9d5ff", cl:"#7c3aed" },
  ];

  // Chart data
  const days7 = last7Days();
  const chartData = days7.map(day => {
    const lbl = String(day.getDate()).padStart(2,"0")+"/"+String(day.getMonth()+1).padStart(2,"0");
    const rv = repairOrders.filter(o=>DONE_ST.includes(o.status)&&o.done_date&&sameDay(new Date(o.done_date),day))
                           .reduce((s,o)=>s+(o.final_cost||0),0);
    const sv = saleOrders.filter(o=>o.status==="paid"&&(o.created||o.created_date)&&sameDay(new Date(o.created||o.created_date),day))
                         .reduce((s,o)=>s+(o.total||0),0);
    return { label:lbl, value:rv+sv };
  });

  // Top 5 KTV
  const ktvMap = {};
  pRepair.forEach(o => {
    if (!o.assigned_to) return;
    if (!ktvMap[o.assigned_to]) ktvMap[o.assigned_to] = { name:o.assigned_to_name||"KTV", cnt:0, rev:0 };
    ktvMap[o.assigned_to].cnt++;
    ktvMap[o.assigned_to].rev += o.final_cost||0;
  });
  const top5 = Object.values(ktvMap).sort((a,b)=>b.rev-a.rev).slice(0,5);

  const TH = { padding:"10px 12px", background:"#f9fafb", fontWeight:800, fontSize:12, color:"#374151",
    textAlign:"left", borderBottom:"1.5px solid #e5e7eb" };
  const TD = { padding:"10px 12px", fontSize:13, borderBottom:"1px solid #f3f4f6" };

  return (
    <div style={{ padding:"16px 14px 110px" }}>
      {/* Period */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {["today","7days","30days","thismonth"].map((p,i)=>(
          <button key={p} onClick={()=>setPeriod(p)}
            style={{ padding:"8px 16px", borderRadius:99, border:"none", cursor:"pointer",
              background:period===p?"#059669":"#f3f4f6",
              color:period===p?"#fff":"#374151",
              fontWeight:period===p?800:600, fontSize:13 }}>
            {["Hôm nay","7 ngày","30 ngày","Tháng này"][i]}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
        {CARDS.map((c,i) => (
          <div key={i} style={{ background:c.bg, border:"2px solid "+c.bc, borderRadius:16, padding:"14px 12px" }}>
            <div style={{ fontSize:18, marginBottom:4 }}>{c.icon}</div>
            <div style={{ fontSize:16, fontWeight:900, color:c.cl, lineHeight:1.2 }}>{c.value}</div>
            <div style={{ fontSize:11, color:"#6b7280", marginTop:4, fontWeight:600 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", padding:"16px", marginBottom:20 }}>
        <div style={{ fontWeight:800, fontSize:14, color:"#374151", marginBottom:14 }}>📈 Doanh thu 7 ngày</div>
        <BarChart data={chartData} />
      </div>

      {/* Top 5 KTV */}
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid #f3f4f6", fontWeight:800, fontSize:14 }}>🏆 Top KTV doanh thu cao nhất</div>
        {top5.length===0 ? (
          <div style={{ padding:"24px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>Không có dữ liệu</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={TH}>Hạng</th><th style={TH}>Tên KTV</th>
                  <th style={{...TH,textAlign:"center"}}>Số đơn</th>
                  <th style={{...TH,textAlign:"right"}}>Doanh thu</th>
                  <th style={{...TH,textAlign:"right"}}>TB/đơn</th>
                </tr>
              </thead>
              <tbody>
                {top5.map((k,i) => (
                  <tr key={i}>
                    <td style={TD}>
                      <span style={{ fontSize:16 }}>{["🥇","🥈","🥉","4️⃣","5️⃣"][i]}</span>
                    </td>
                    <td style={{...TD,fontWeight:700}}>{k.name}</td>
                    <td style={{...TD,textAlign:"center"}}>{k.cnt}</td>
                    <td style={{...TD,textAlign:"right",fontWeight:800,color:"#059669"}}>{fmtMoney(k.rev)}</td>
                    <td style={{...TD,textAlign:"right",color:"#6b7280"}}>{fmtMoney(k.cnt?Math.round(k.rev/k.cnt):0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── TAB 3: Staff KPI ───────────────────────────────────────
function StaffKpiTab({ staff, repairOrders }) {
  const [period,    setPeriod]    = useState("thismonth");
  const [roleFilter,setRoleFilter]= useState("all");
  const [modal,     setModal]     = useState(null);

  const filteredStaff = staff.filter(s => {
    if (!s.is_active) return false;
    if (roleFilter==="ktv"    && s.role!=="technician")  return false;
    if (roleFilter==="letan"  && s.role!=="receptionist") return false;
    if (roleFilter==="thukho" && s.role!=="warehouse")   return false;
    return true;
  });

  function getStaffStats(s) {
    const myOrders = repairOrders.filter(o=>o.assigned_to===s.id);
    const done     = myOrders.filter(o=>DONE_ST.includes(o.status)&&inPeriod(o.done_date||o.updated,period));
    const revenue  = done.reduce((sum,o)=>sum+(o.final_cost||0),0);
    const late     = done.filter(o=>o.done_date&&o.estimated_done_date&&new Date(o.done_date)>new Date(o.estimated_done_date));
    return { done, revenue, late: late.length };
  }

  const TH = { padding:"10px 12px", background:"#f9fafb", fontWeight:800, fontSize:11, color:"#374151",
    textAlign:"left", borderBottom:"1.5px solid #e5e7eb", whiteSpace:"nowrap" };
  const TD = { padding:"10px 12px", fontSize:13, borderBottom:"1px solid #f3f4f6", verticalAlign:"middle" };

  return (
    <div style={{ padding:"16px 14px 110px" }}>
      {/* Filters */}
      <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
        {[["today","Hôm nay"],["thisweek","Tuần này"],["thismonth","Tháng này"]].map(([k,l])=>(
          <button key={k} onClick={()=>setPeriod(k)}
            style={{ padding:"7px 14px", borderRadius:99, border:"none", cursor:"pointer",
              background:period===k?"#4f46e5":"#f3f4f6",
              color:period===k?"#fff":"#374151",
              fontWeight:period===k?800:600, fontSize:13 }}>
            {l}
          </button>
        ))}
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {[["all","Tất cả"],["ktv","KTV"],["letan","Lễ tân"],["thukho","Thủ kho"]].map(([k,l])=>(
          <button key={k} onClick={()=>setRoleFilter(k)}
            style={{ padding:"6px 12px", borderRadius:99, border:"1.5px solid "+(roleFilter===k?"#4f46e5":"#e5e7eb"),
              cursor:"pointer", background:roleFilter===k?"#4f46e5":"#fff",
              color:roleFilter===k?"#fff":"#374151",
              fontWeight:roleFilter===k?700:500, fontSize:12 }}>
            {l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>
                <th style={TH}>Nhân viên</th>
                <th style={TH}>Role</th>
                <th style={{...TH,textAlign:"center"}}>Đơn HT</th>
                <th style={{...TH,textAlign:"right"}}>Doanh thu</th>
                <th style={{...TH,textAlign:"center"}}>KPI</th>
                <th style={{...TH,textAlign:"center"}}>Trễ</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length===0 ? (
                <tr><td colSpan={6} style={{...TD,textAlign:"center",color:"#9ca3af"}}>Không có dữ liệu</td></tr>
              ) : filteredStaff.map(s => {
                const st = getStaffStats(s);
                const kpi = s.kpi_score||0;
                const kpiPct = Math.max(0,Math.min(100,kpi));
                const kpiColor = kpi>=80?"#059669":kpi>=50?"#ca8a04":"#dc2626";
                return (
                  <tr key={s.id} onClick={()=>setModal(s)} style={{ cursor:"pointer" }}
                    onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <td style={TD}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        {s.avatar_url
                          ? <img src={s.avatar_url} alt="" style={{ width:30,height:30,borderRadius:"50%",objectFit:"cover" }}/>
                          : <div style={{ width:30,height:30,borderRadius:"50%",background:"#e5e7eb",
                              display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700 }}>
                              {(s.full_name||"?")[0]}
                            </div>
                        }
                        <span style={{ fontWeight:700, fontSize:13 }}>{s.full_name}</span>
                      </div>
                    </td>
                    <td style={TD}>
                      <span style={{ fontSize:11, background:(ROLE_COLORS[s.role]||"#6b7280")+"22",
                        color:ROLE_COLORS[s.role]||"#6b7280",
                        borderRadius:99, padding:"2px 8px", fontWeight:700 }}>
                        {ROLE_LABELS[s.role]||s.role}
                      </span>
                    </td>
                    <td style={{...TD,textAlign:"center",fontWeight:700}}>{st.done.length}</td>
                    <td style={{...TD,textAlign:"right",fontWeight:700,color:"#059669"}}>{fmtMoney(st.revenue)}</td>
                    <td style={{...TD,textAlign:"center"}}>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                        <span style={{ fontWeight:800, color:kpiColor, fontSize:13 }}>{kpi}</span>
                        <div style={{ width:60, height:5, background:"#e5e7eb", borderRadius:3, overflow:"hidden" }}>
                          <div style={{ width:kpiPct+"%", height:"100%", background:kpiColor, borderRadius:3 }} />
                        </div>
                      </div>
                    </td>
                    <td style={{...TD,textAlign:"center"}}>
                      {st.late>0
                        ? <span style={{ color:"#dc2626", fontWeight:700 }}>{st.late}</span>
                        : <span style={{ color:"#059669" }}>0</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal chi tiết */}
      {modal && (
        <StaffModal staff={modal} repairOrders={repairOrders} onClose={()=>setModal(null)} />
      )}
    </div>
  );
}

function StaffModal({ staff: s, repairOrders, onClose }) {
  const myOrders = repairOrders.filter(o=>o.assigned_to===s.id);
  const recent10 = [...myOrders].sort((a,b)=>new Date(b.created||b.received_date)-new Date(a.created||a.received_date)).slice(0,10);
  const statusCount = {};
  myOrders.forEach(o=>{ statusCount[o.status]=(statusCount[o.status]||0)+1; });
  const total = myOrders.length || 1;
  const kpi = s.kpi_score||0;
  const kpiColor = kpi>=80?"#059669":kpi>=50?"#ca8a04":"#dc2626";

  return (
    <div onClick={onClose}
      style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:300,display:"flex",alignItems:"flex-end" }}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:"#fff",borderRadius:"20px 20px 0 0",padding:"20px 16px 48px",
          width:"100%",maxHeight:"85vh",overflowY:"auto" }}>
        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:20 }}>
          <div style={{ width:48,height:48,borderRadius:"50%",background:"#e5e7eb",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700 }}>
            {(s.full_name||"?")[0]}
          </div>
          <div>
            <div style={{ fontWeight:900,fontSize:16 }}>{s.full_name}</div>
            <div style={{ fontSize:12,color:"#6b7280" }}>{ROLE_LABELS[s.role]||s.role}</div>
          </div>
          <button onClick={onClose}
            style={{ marginLeft:"auto",background:"#f3f4f6",border:"none",borderRadius:99,
              width:32,height:32,cursor:"pointer",fontSize:18 }}>×</button>
        </div>

        {/* KPI */}
        <div style={{ background:"#f9fafb",borderRadius:14,padding:14,marginBottom:16 }}>
          <div style={{ fontSize:12,color:"#6b7280",marginBottom:4 }}>KPI Score</div>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <span style={{ fontSize:28,fontWeight:900,color:kpiColor }}>{kpi}</span>
            <div style={{ flex:1,height:8,background:"#e5e7eb",borderRadius:4,overflow:"hidden" }}>
              <div style={{ width:Math.min(kpi,100)+"%",height:"100%",background:kpiColor,borderRadius:4 }} />
            </div>
          </div>
        </div>

        {/* Status breakdown */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontWeight:800,fontSize:14,marginBottom:10 }}>📊 Phân bố trạng thái ({myOrders.length} đơn)</div>
          {Object.entries(statusCount).sort((a,b)=>b[1]-a[1]).map(([st,cnt])=>(
            <div key={st} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:6 }}>
              <span style={{ fontSize:12,minWidth:130,color:STATUS_COLORS[st]||"#374151",fontWeight:600 }}>{st}</span>
              <div style={{ flex:1,height:6,background:"#f3f4f6",borderRadius:3,overflow:"hidden" }}>
                <div style={{ width:Math.round(cnt/total*100)+"%",height:"100%",
                  background:STATUS_COLORS[st]||"#9ca3af",borderRadius:3 }} />
              </div>
              <span style={{ fontSize:12,fontWeight:700,minWidth:40,textAlign:"right" }}>{Math.round(cnt/total*100)}%</span>
            </div>
          ))}
        </div>

        {/* Recent 10 */}
        <div style={{ fontWeight:800,fontSize:14,marginBottom:10 }}>🕐 10 đơn gần nhất</div>
        {recent10.map(o=>(
          <div key={o.id} style={{ padding:"8px 0",borderBottom:"1px solid #f3f4f6",
            display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <div>
              <div style={{ fontWeight:700,fontSize:13 }}>{o.order_code}</div>
              <div style={{ fontSize:11,color:"#6b7280" }}>{o.customer_name||"—"} · {o.device_model||"—"}</div>
            </div>
            <span style={{ fontSize:11,background:(STATUS_COLORS[o.status]||"#6b7280")+"22",
              color:STATUS_COLORS[o.status]||"#6b7280",borderRadius:99,padding:"2px 8px",fontWeight:700 }}>
              {o.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TAB 4: Inventory ───────────────────────────────────────
function InventoryTab({ spareParts, stockImports, ledgerSummary=[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);

  const active = spareParts.filter(p=>p.is_active!==false);
  // Tính từ ledgerSummary nếu có, fallback sang spareParts
  const effectiveParts = ledgerSummary.length > 0 ? ledgerSummary : active;
  const lowCnt = ledgerSummary.length > 0
    ? ledgerSummary.filter(p => p.total_qty <= Math.max(p.min_qty, 2)).length
    : active.filter(p=>(p.stock_qty||0)<=Math.max(p.min_stock||0,2)).length;
  const totalVal = ledgerSummary.length > 0
    ? ledgerSummary.reduce((s,p)=>s+p.total_value, 0)
    : active.reduce((s,p)=>s+(p.stock_qty||0)*(p.cost_price||p.price||0),0);
  const now = new Date();
  const importsCnt = stockImports.filter(i=>i.status==="confirmed"&&i.confirmed_at&&
    new Date(i.confirmed_at).getMonth()===now.getMonth()&&
    new Date(i.confirmed_at).getFullYear()===now.getFullYear()).length;

  const SCARDS = [
    { icon:"📦", label:"Tổng SKU",           value:(ledgerSummary.length>0?ledgerSummary.length:active.length)+" SKU", bg:"#eff6ff",bc:"#bfdbfe",cl:"#1d4ed8" },
    { icon:"⚠️", label:"Sắp hết hàng",       value:lowCnt+" SKU",          bg:"#fef2f2",bc:"#fca5a5",cl:"#dc2626" },
    { icon:"💰", label:"Giá trị tồn kho",     value:fmtMoney(totalVal),     bg:"#f0fdf4",bc:"#86efac",cl:"#059669" },
    { icon:"🔄", label:"Nhập kho tháng này",  value:importsCnt+" phiếu",    bg:"#fefce8",bc:"#fde68a",cl:"#ca8a04" },
  ];

  function toggleSort(k) {
    if (sortKey===k) setSortAsc(v=>!v);
    else { setSortKey(k); setSortAsc(true); }
  }

  const filtered = active.filter(p=>{
    const q = search.toLowerCase();
    return !q || (p.name||"").toLowerCase().includes(q) || (p.sku||"").toLowerCase().includes(q);
  }).sort((a,b)=>{
    let va, vb;
    if (sortKey==="name")  { va=a.name||""; vb=b.name||""; return sortAsc?va.localeCompare(vb):vb.localeCompare(va); }
    if (sortKey==="stock") { va=a.stock_qty||0; vb=b.stock_qty||0; }
    else                   { va=(a.stock_qty||0)*(a.cost_price||a.price||0); vb=(b.stock_qty||0)*(b.cost_price||b.price||0); }
    return sortAsc?va-vb:vb-va;
  });

  function badge(p) {
    const q = p.stock_qty||0;
    if (q===0)                         return { label:"🔴 Hết hàng", bg:"#fee2e2", cl:"#dc2626" };
    if (q<=Math.max(p.min_stock||0,2)) return { label:"🟡 Sắp hết",  bg:"#fefce8", cl:"#ca8a04" };
    return                                     { label:"🟢 Còn hàng", bg:"#f0fdf4", cl:"#059669" };
  }

  const TH = (k) => ({
    padding:"10px 12px", background:"#f9fafb", fontWeight:800, fontSize:11, color:"#374151",
    borderBottom:"1.5px solid #e5e7eb", cursor:"pointer", whiteSpace:"nowrap",
    textDecoration: sortKey===k?"underline":"none",
  });
  const TD = { padding:"10px 12px", fontSize:13, borderBottom:"1px solid #f3f4f6", verticalAlign:"middle" };

  return (
    <div style={{ padding:"16px 14px 110px" }}>
      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
        {SCARDS.map((c,i)=>(
          <div key={i} style={{ background:c.bg, border:"2px solid "+c.bc, borderRadius:16, padding:"14px 12px" }}>
            <div style={{ fontSize:20, marginBottom:4 }}>{c.icon}</div>
            <div style={{ fontSize:15, fontWeight:900, color:c.cl }}>{c.value}</div>
            <div style={{ fontSize:11, color:"#6b7280", marginTop:4, fontWeight:600 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position:"relative", marginBottom:16 }}>
        <span className="material-icons"
          style={{ fontFamily:"Material Icons",position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#9ca3af",fontSize:20 }}>
          search
        </span>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc SKU..."
          style={{ width:"100%",height:44,borderRadius:12,border:"1.5px solid #e5e7eb",
            paddingLeft:40,paddingRight:14,fontSize:14,outline:"none",boxSizing:"border-box" }} />
      </div>

      {/* Table */}
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>
                <th style={TH("name")} onClick={()=>toggleSort("name")}>
                  Tên SP {sortKey==="name"?(sortAsc?"↑":"↓"):""}
                </th>
                <th style={{ ...TH("sku"), cursor:"default" }}>SKU</th>
                <th style={{ ...TH("sku"), cursor:"default" }}>Danh mục</th>
                <th style={{...TH("stock"),textAlign:"center"}} onClick={()=>toggleSort("stock")}>
                  Tồn {sortKey==="stock"?(sortAsc?"↑":"↓"):""}
                </th>
                <th style={{...TH("value"),textAlign:"right"}} onClick={()=>toggleSort("value")}>
                  Giá trị {sortKey==="value"?(sortAsc?"↑":"↓"):""}
                </th>
                <th style={{...TH("sku"),cursor:"default",textAlign:"center"}}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 ? (
                <tr><td colSpan={6} style={{...TD,textAlign:"center",color:"#9ca3af"}}>Không có dữ liệu</td></tr>
              ) : filtered.map(p=>{
                const b = badge(p);
                const val = (p.stock_qty||0)*(p.cost_price||p.price||0);
                return (
                  <tr key={p.id}>
                    <td style={{...TD,fontWeight:700,maxWidth:160}}>{p.name}</td>
                    <td style={{...TD,fontSize:11,color:"#6b7280"}}>{p.sku||"—"}</td>
                    <td style={TD}>{p.category||"—"}</td>
                    <td style={{...TD,textAlign:"center",fontWeight:800}}>{p.stock_qty||0}</td>
                    <td style={{...TD,textAlign:"right",fontWeight:700,color:"#059669"}}>{fmtMoney(val)}</td>
                    <td style={{...TD,textAlign:"center"}}>
                      <span style={{ fontSize:11,background:b.bg,color:b.cl,borderRadius:99,padding:"2px 8px",fontWeight:700 }}>
                        {b.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── TAB 5: Settings Manager ────────────────────────────────
function SettingsMgrTab({ user, staff: staffList, repairOrders, customers, spareParts, ledgerSummary=[], onStaffUpdate }) {
  const [shopInfo,  setShopInfo]  = useState({});
  const [toast,     setToast]     = useState("");

  useEffect(() => {
    AppSettings.list({ limit:200 }).then(list => {
      const m = {}; (list||[]).forEach(s=>{ m[s.key]=s.value; });
      setShopInfo(m);
    }).catch(()=>{});
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(""),3000); }

  async function toggleActive(s) {
    try {
      await Staff.update(s.id, { is_active:!s.is_active });
      onStaffUpdate(s.id, { is_active:!s.is_active });
      showToast((s.is_active?"Đã khoá":"Đã mở khoá") + " tài khoản " + s.full_name);
    } catch(e) { showToast("❌ Lỗi: "+e.message); }
  }

  async function resetKpi(s) {
    if (!window.confirm("Đặt lại KPI của " + s.full_name + " về 0?")) return;
    try {
      await Staff.update(s.id, { kpi_score:0 });
      onStaffUpdate(s.id, { kpi_score:0 });
      showToast("✅ Đã đặt lại KPI của " + s.full_name);
    } catch(e) { showToast("❌ Lỗi: "+e.message); }
  }

  // System stats
  const firstOrder = repairOrders.length > 0
    ? repairOrders.reduce((min,o)=>{
        const d = new Date(o.created||o.received_date);
        return d < min ? d : min;
      }, new Date())
    : null;
  const daysActive = firstOrder
    ? Math.max(1, Math.round((Date.now()-firstOrder.getTime())/(1000*60*60*24)))
    : 0;

  const isAdmin = ["admin","owner"].includes(user.role);
  const TH = { padding:"10px 12px",background:"#f9fafb",fontWeight:800,fontSize:12,color:"#374151",
    textAlign:"left",borderBottom:"1.5px solid #e5e7eb" };
  const TD = { padding:"10px 12px",fontSize:13,borderBottom:"1px solid #f3f4f6",verticalAlign:"middle" };
  const INFO = { fontSize:13,color:"#374151",marginBottom:10,display:"flex",justifyContent:"space-between" };

  return (
    <div style={{ padding:"16px 14px 110px" }}>
      {/* Staff quick */}
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden", marginBottom:20 }}>
        <div style={{ padding:"12px 16px",borderBottom:"1px solid #f3f4f6",fontWeight:800,fontSize:14 }}>
          👥 Quản lý nhân viên nhanh
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <thead>
              <tr>
                <th style={TH}>Tên</th><th style={TH}>Role</th>
                <th style={{...TH,textAlign:"center"}}>KPI</th>
                <th style={{...TH,textAlign:"center"}}>Trạng thái</th>
                {isAdmin && <th style={{...TH,textAlign:"center"}}>Reset KPI</th>}
              </tr>
            </thead>
            <tbody>
              {staffList.filter(s=>!["admin","owner"].includes(s.role)||isAdmin).map(s=>(
                <tr key={s.id}>
                  <td style={{...TD,fontWeight:700}}>{s.full_name}</td>
                  <td style={TD}>
                    <span style={{ fontSize:11,background:(ROLE_COLORS[s.role]||"#6b7280")+"22",
                      color:ROLE_COLORS[s.role]||"#6b7280",borderRadius:99,padding:"2px 8px",fontWeight:700 }}>
                      {ROLE_LABELS[s.role]||s.role}
                    </span>
                  </td>
                  <td style={{...TD,textAlign:"center",fontWeight:800,
                    color:(s.kpi_score||0)>=80?"#059669":(s.kpi_score||0)>=50?"#ca8a04":"#dc2626"}}>
                    {s.kpi_score||0}
                  </td>
                  <td style={{...TD,textAlign:"center"}}>
                    <button onClick={()=>toggleActive(s)}
                      style={{ padding:"4px 12px", borderRadius:99, border:"none", cursor:"pointer",
                        background:s.is_active?"#dcfce7":"#fee2e2",
                        color:s.is_active?"#059669":"#dc2626",
                        fontWeight:700, fontSize:12 }}>
                      {s.is_active?"✅ Hoạt động":"🔴 Khoá"}
                    </button>
                  </td>
                  {isAdmin && (
                    <td style={{...TD,textAlign:"center"}}>
                      <button onClick={()=>resetKpi(s)}
                        style={{ padding:"4px 10px",borderRadius:8,border:"none",cursor:"pointer",
                          background:"#fef2f2",color:"#dc2626",fontWeight:700,fontSize:11 }}>
                        Đặt lại
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shop info */}
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", padding:"16px", marginBottom:20 }}>
        <div style={{ fontWeight:800,fontSize:14,marginBottom:14 }}>🏪 Thông tin cửa hàng</div>
        {[["shop_name","Tên cửa hàng"],["shop_phone","SĐT"],["shop_address","Địa chỉ"],["warranty_note","Ghi chú bảo hành"]]
          .map(([k,l])=>(
          <div key={k} style={INFO}>
            <span style={{ color:"#6b7280",minWidth:110 }}>{l}:</span>
            <span style={{ fontWeight:600,textAlign:"right" }}>{shopInfo[k]||"—"}</span>
          </div>
        ))}
        <div style={{ marginTop:8,fontSize:12,color:"#6b7280" }}>
          ✏️ Để sửa → vào <b>Cài đặt</b> trong menu sidebar
        </div>
      </div>

      {/* System stats */}
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", padding:"16px" }}>
        <div style={{ fontWeight:800,fontSize:14,marginBottom:14 }}>📊 Thống kê hệ thống</div>
        {[
          ["Tổng đơn sửa chữa",  repairOrders.length + " đơn"],
          ["Tổng khách hàng",    customers.length + " khách"],
          ["Tổng linh kiện",     (ledgerSummary.length>0?ledgerSummary.length:spareParts.filter(p=>p.is_active!==false).length) + " SKU"],
          ["Ngày hoạt động",     daysActive + " ngày"],
        ].map(([l,v])=>(
          <div key={l} style={INFO}>
            <span style={{ color:"#6b7280" }}>{l}:</span>
            <span style={{ fontWeight:700 }}>{v}</span>
          </div>
        ))}
      </div>

      {toast && (
        <div style={{ position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",
          background:"#1e1b4b",color:"#fff",borderRadius:14,padding:"12px 24px",
          fontSize:14,fontWeight:700,zIndex:500,whiteSpace:"nowrap" }}>
          {toast}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// PILL TABS COMPONENT (dùng chung)
// ══════════════════════════════════════════════════════════════
function PillTabs({ tabs, active, onChange }) {
  return (
    <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          style={{
            padding:"7px 18px", borderRadius:99, border:"none", cursor:"pointer",
            background: active===t.key ? "#4f46e5" : "#f3f4f6",
            color:       active===t.key ? "#fff"    : "#374151",
            fontWeight:  active===t.key ? 700       : 500,
            fontSize:    13,
            transition:  "all .15s",
          }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── TAB 2: Kinh doanh (Business) ──────────────────────────────
function DebtSubTab({ repairOrders }) {
  const debtMap = {};
  repairOrders
    .filter(o => (o.balance||0) > 0 && !["Huỷ"].includes(o.status))
    .forEach(o => {
      const k = o.customer_id || o.customer_name || "Không rõ";
      if (!debtMap[k]) debtMap[k] = { name: o.customer_name||k, phone: o.customer_phone||"", total:0, orders:0 };
      debtMap[k].total  += (o.balance||0);
      debtMap[k].orders += 1;
    });
  const list = Object.values(debtMap).sort((a,b) => b.total - a.total);

  if (list.length === 0) return (
    <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>
      <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
      <div>Không có công nợ khách hàng</div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {list.map((c,i) => (
        <div key={i} style={{ background:"#fff", border:"1.5px solid #fca5a5", borderRadius:14, padding:"14px 16px",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontWeight:800, fontSize:15 }}>{c.name}</div>
            <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{c.orders} đơn nợ</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ fontWeight:900, fontSize:16, color:"#dc2626" }}>{fmtMoney(c.total)}</div>
            {c.phone && (
              <a href={"tel:"+c.phone}
                style={{ background:"#4f46e5", color:"#fff", borderRadius:10, padding:"7px 14px",
                  fontSize:13, fontWeight:700, textDecoration:"none" }}>
                📞
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CashflowSubTab({ repairOrders, expenses, saleOrders }) {
  const now = new Date();
  const thisMonth = (d) => {
    const dt = new Date(d);
    return dt.getMonth()===now.getMonth() && dt.getFullYear()===now.getFullYear();
  };
  const DONE_ST = ["Hoàn Thành","Đã Giao","Đã Thanh Toán"];
  const repairRevenue = repairOrders
    .filter(o => DONE_ST.includes(o.status) && thisMonth(o.done_date||o.updated))
    .reduce((s,o) => s+(o.final_cost||0), 0);
  const saleRevenue = saleOrders
    .filter(o => thisMonth(o.created))
    .reduce((s,o) => s+(o.total||0), 0);
  const totalRevenue = repairRevenue + saleRevenue;
  const totalExpense = expenses
    .filter(e => thisMonth(e.expense_date||e.created))
    .reduce((s,e) => s+(e.amount||0), 0);
  const balance = totalRevenue - totalExpense;

  const ROWS = [
    { label:"💰 Thu sửa chữa", value:repairRevenue, color:"#059669" },
    { label:"🛒 Thu bán hàng",  value:saleRevenue,   color:"#0891b2" },
    { label:"📤 Chi phí",       value:-totalExpense,  color:"#dc2626" },
  ];

  return (
    <div>
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden", marginBottom:16 }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid #f3f4f6", fontWeight:800, fontSize:14 }}>
          📅 Tháng {now.getMonth()+1}/{now.getFullYear()}
        </div>
        {ROWS.map((r,i) => (
          <div key={i} style={{ padding:"12px 16px", borderBottom:"1px solid #f3f4f6",
            display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:14, color:"#374151" }}>{r.label}</span>
            <span style={{ fontWeight:800, color:r.color }}>{fmtMoney(Math.abs(r.value))}</span>
          </div>
        ))}
        <div style={{ padding:"14px 16px", background: balance>=0?"#f0fdf4":"#fef2f2",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontWeight:800, fontSize:15 }}>📊 Số dư</span>
          <span style={{ fontWeight:900, fontSize:18, color: balance>=0?"#059669":"#dc2626" }}>
            {balance>=0?"+":""}{fmtMoney(balance)}
          </span>
        </div>
      </div>
    </div>
  );
}

function BusinessTab({ repairOrders, saleOrders, expenses }) {
  const [sub, setSub] = useState("revenue");
  const SUB_TABS = [
    { key:"revenue",  label:"💰 Doanh thu" },
    { key:"debt",     label:"📋 Công nợ" },
    { key:"cashflow", label:"💵 Sổ quỹ" },
  ];
  return (
    <div style={{ padding:"16px 14px 110px" }}>
      <PillTabs tabs={SUB_TABS} active={sub} onChange={setSub} />
      {sub==="revenue"  && <RevenueTab repairOrders={repairOrders} saleOrders={saleOrders} expenses={expenses} />}
      {sub==="debt"     && <DebtSubTab repairOrders={repairOrders} />}
      {sub==="cashflow" && <CashflowSubTab repairOrders={repairOrders} expenses={expenses} saleOrders={saleOrders} />}
    </div>
  );
}

// ── TAB 3: Nhân viên ──────────────────────────────────────────
function initials(name) {
  return (name||"?").split(" ").slice(-2).map(w=>w[0]||"").join("").toUpperCase() || "?";
}

function StaffListSubTab({ staff: staffList, onStaffUpdate }) {
  const [toast, setToast] = useState("");
  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(""),3000); }

  async function toggleActive(s) {
    try {
      await Staff.update(s.id, { is_active:!s.is_active });
      onStaffUpdate(s.id, { is_active:!s.is_active });
      showToast((s.is_active?"Đã khoá":"Đã mở khoá")+" "+s.full_name);
    } catch(e) { showToast("❌ "+e.message); }
  }
  async function resetKpi(s) {
    if (!window.confirm("Đặt lại KPI của "+s.full_name+" về 0?")) return;
    try {
      await Staff.update(s.id, { kpi_score:0 });
      onStaffUpdate(s.id, { kpi_score:0 });
      showToast("✅ Đã đặt lại KPI "+s.full_name);
    } catch(e) { showToast("❌ "+e.message); }
  }

  return (
    <div>
      {toast && (
        <div style={{ position:"fixed",top:70,left:"50%",transform:"translateX(-50%)",
          background:"#1e1b4b",color:"#fff",borderRadius:12,padding:"10px 20px",
          fontSize:14,fontWeight:700,zIndex:999,whiteSpace:"nowrap" }}>{toast}</div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {staffList.map(s => {
          const roleColor = ROLE_COLORS[s.role]||"#6b7280";
          const init = initials(s.full_name);
          return (
            <div key={s.id} style={{ background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:14,
              padding:"12px 14px", display:"flex", alignItems:"center", gap:12 }}>
              {/* Avatar */}
              <div style={{ width:42, height:42, borderRadius:"50%", background:roleColor+"22",
                border:"2px solid "+roleColor, display:"flex", alignItems:"center", justifyContent:"center",
                fontWeight:900, fontSize:14, color:roleColor, flexShrink:0 }}>
                {init}
              </div>
              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:14, display:"flex", alignItems:"center", gap:8 }}>
                  {s.full_name}
                  {!s.is_active && <span style={{ fontSize:10, background:"#fee2e2",color:"#dc2626",
                    borderRadius:99, padding:"1px 7px", fontWeight:700 }}>Khoá</span>}
                </div>
                <div style={{ display:"flex", gap:6, marginTop:4, flexWrap:"wrap" }}>
                  <span style={{ fontSize:11, background:roleColor+"22", color:roleColor,
                    borderRadius:99, padding:"2px 8px", fontWeight:700 }}>
                    {ROLE_LABELS[s.role]||s.role}
                  </span>
                  <span style={{ fontSize:11, color:"#6b7280" }}>KPI: {s.kpi_score||0}</span>
                </div>
              </div>
              {/* Actions */}
              <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                <button onClick={()=>toggleActive(s)}
                  style={{ padding:"6px 12px", borderRadius:8, border:"1.5px solid #e5e7eb",
                    background:s.is_active?"#fef2f2":"#f0fdf4", color:s.is_active?"#dc2626":"#059669",
                    fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  {s.is_active?"Khoá":"Mở"}
                </button>
                <button onClick={()=>resetKpi(s)}
                  style={{ padding:"6px 12px", borderRadius:8, border:"1.5px solid #e5e7eb",
                    background:"#f9fafb", color:"#374151", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  ↺ KPI
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StaffTab({ staff, repairOrders, onStaffUpdate }) {
  const [sub, setSub] = useState("kpi");
  const SUB_TABS = [
    { key:"kpi",  label:"🏆 KPI" },
    { key:"list", label:"👥 Danh sách" },
  ];
  return (
    <div style={{ padding:"16px 14px 110px" }}>
      <PillTabs tabs={SUB_TABS} active={sub} onChange={setSub} />
      {sub==="kpi"  && <StaffKpiTab staff={staff} repairOrders={repairOrders} />}
      {sub==="list" && <StaffListSubTab staff={staff} onStaffUpdate={onStaffUpdate} />}
    </div>
  );
}

// ── TAB 4: Kho & Kế toán ─────────────────────────────────────
function ImportSubTab({ stockImports }) {
  const recent = [...stockImports].sort((a,b)=>new Date(b.created)-new Date(a.created)).slice(0,20);
  const STATUS_BADGE = {
    draft:      { label:"Nháp",     bg:"#f3f4f6", cl:"#6b7280" },
    confirmed:  { label:"Xác nhận", bg:"#f0fdf4", cl:"#059669" },
    cancelled:  { label:"Huỷ",      bg:"#fef2f2", cl:"#dc2626" },
  };
  if (recent.length===0) return (
    <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>Chưa có phiếu nhập nào</div>
  );
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {recent.map(imp => {
        const b = STATUS_BADGE[imp.status]||STATUS_BADGE.draft;
        return (
          <div key={imp.id} style={{ background:"#fff", border:"1.5px solid #e5e7eb", borderRadius:12, padding:"12px 14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontWeight:800, fontSize:13 }}>{imp.import_code||imp.id}</div>
                <div style={{ fontSize:12, color:"#6b7280", marginTop:3 }}>
                  {imp.supplier_name||"NCC"} · {imp.total_items||0} sản phẩm
                </div>
              </div>
              <span style={{ fontSize:11, background:b.bg, color:b.cl,
                borderRadius:99, padding:"3px 10px", fontWeight:700, flexShrink:0 }}>
                {b.label}
              </span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
              <span style={{ fontSize:12, color:"#9ca3af" }}>
                {imp.confirmed_at ? new Date(imp.confirmed_at).toLocaleDateString("vi-VN") :
                  new Date(imp.created).toLocaleDateString("vi-VN")}
              </span>
              <span style={{ fontWeight:800, color:"#059669", fontSize:13 }}>
                {fmtMoney(imp.total_value||0)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExportSubTab({ sparePartUsages, onApprove }) {
  const pending = sparePartUsages.filter(u => u.status==="pending" || u.status==="requested");
  if (pending.length===0) return (
    <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>
      <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
      <div>Không có yêu cầu xuất kho chờ duyệt</div>
    </div>
  );
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {pending.map(u => (
        <div key={u.id} style={{ background:"#fff", border:"1.5px solid #fde68a", borderRadius:12, padding:"12px 14px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:13 }}>{u.part_name||u.name||"Linh kiện"}</div>
              <div style={{ fontSize:12, color:"#6b7280", marginTop:3 }}>
                {u.warehouse_name||""} · KTV: {u.created_by_name||""} · SL: {u.qty_requested||u.qty||1}
              </div>
              <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>
                {new Date(u.created).toLocaleDateString("vi-VN")}
              </div>
            </div>
            <button onClick={() => onApprove(u.id)}
              style={{ padding:"8px 14px", background:"#4f46e5", color:"#fff", border:"none",
                borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
              Duyệt
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function InventoryWrapTab({ spareParts, stockImports, ledgerSummary, sparePartUsages, onApproveUsage }) {
  const [sub, setSub] = useState("stock");
  const SUB_TABS = [
    { key:"stock",  label:"📦 Tồn kho" },
    { key:"import", label:"📥 Nhập kho" },
    { key:"export", label:"📤 Xuất kho" },
  ];
  return (
    <div style={{ padding:"16px 14px 110px" }}>
      <PillTabs tabs={SUB_TABS} active={sub} onChange={setSub} />
      {sub==="stock"  && <InventoryTab spareParts={spareParts} stockImports={stockImports} ledgerSummary={ledgerSummary} />}
      {sub==="import" && <ImportSubTab stockImports={stockImports} />}
      {sub==="export" && <ExportSubTab sparePartUsages={sparePartUsages} onApprove={onApproveUsage} />}
    </div>
  );
}

// ── TAB 5: Cài đặt gọn ───────────────────────────────────────
function SettingsLiteTab({ user, repairOrders, customers, spareParts, ledgerSummary, onRefresh }) {
  const [shopInfo, setShopInfo] = useState({});
  useEffect(() => {
    AppSettings.list({ limit:200 }).then(list => {
      const m = {}; (list||[]).forEach(s=>{ m[s.key]=s.value; });
      setShopInfo(m);
    }).catch(()=>{});
  }, []);

  const firstOrder = repairOrders.length > 0
    ? repairOrders.reduce((min,o)=>{
        const d = new Date(o.created||o.received_date);
        return d < min ? d : min;
      }, new Date()) : null;
  const daysActive = firstOrder
    ? Math.max(1, Math.round((Date.now()-firstOrder.getTime())/(1000*60*60*24))) : 0;

  const STATS = [
    { label:"Tổng đơn",   value:repairOrders.length },
    { label:"Khách hàng", value:customers.length },
    { label:"Tổng SKU",   value:(ledgerSummary.length||spareParts.length) },
    { label:"Ngày HĐ",    value:daysActive },
  ];
  const INFO = { fontSize:13,color:"#374151",marginBottom:10,display:"flex",justifyContent:"space-between" };

  return (
    <div style={{ padding:"16px 14px 110px" }}>
      {/* Thống kê hệ thống */}
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", padding:"16px", marginBottom:16 }}>
        <div style={{ fontWeight:800, fontSize:14, marginBottom:14 }}>📊 Thống kê hệ thống</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {STATS.map((s,i) => (
            <div key={i} style={{ background:"#f9fafb", borderRadius:12, padding:"12px 14px" }}>
              <div style={{ fontSize:20, fontWeight:900, color:"#4f46e5" }}>{s.value}</div>
              <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Thông tin cửa hàng */}
      {shopInfo["shop_name"] && (
        <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", padding:"16px", marginBottom:16 }}>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:12 }}>🏪 Thông tin cửa hàng</div>
          <div style={INFO}><span>Tên</span><span style={{fontWeight:700}}>{shopInfo["shop_name"]||"—"}</span></div>
          <div style={INFO}><span>SĐT</span><span>{shopInfo["shop_phone"]||"—"}</span></div>
          <div style={INFO}><span>Địa chỉ</span><span style={{maxWidth:"60%",textAlign:"right"}}>{shopInfo["shop_address"]||"—"}</span></div>
          <div style={{ fontSize:12, color:"#9ca3af", marginTop:8 }}>
            💡 Để sửa thông tin → vào Cài đặt trong sidebar
          </div>
        </div>
      )}

      {/* Kết nối */}
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", padding:"16px", marginBottom:16 }}>
        <div style={{ fontWeight:800, fontSize:14, marginBottom:12 }}>🔗 Thông tin kết nối</div>
        <div style={INFO}>
          <span style={{color:"#6b7280"}}>PocketBase URL</span>
          <span style={{fontSize:11,color:"#4f46e5",wordBreak:"break-all",maxWidth:"60%",textAlign:"right"}}>
            {typeof window!=="undefined" ? (localStorage.getItem("pb_url")||"—") : "—"}
          </span>
        </div>
        <button onClick={onRefresh}
          style={{ width:"100%", padding:"10px", background:"linear-gradient(135deg,#4f46e5,#7c3aed)",
            color:"#fff", border:"none", borderRadius:12, fontWeight:700, fontSize:14, cursor:"pointer", marginTop:8 }}>
          🔄 Đồng bộ dữ liệu
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

const NAV_TABS = [
  { key:"overview",   icon:"dashboard",    label:"Tổng quan" },
  { key:"business",   icon:"bar_chart",    label:"Kinh doanh" },
  { key:"staff",      icon:"people",       label:"Nhân viên" },
  { key:"inventory",  icon:"inventory_2",  label:"Kho & KT" },
  { key:"settings",   icon:"settings",     label:"Cài đặt" },
];

export default function ManagerDashboard({ user }) {
  const bp = useBreakpoint();
  const [tab,            setTab]            = useState("overview");
  const [loading,        setLoading]        = useState(true);
  const [repairOrders,   setRepairOrders]   = useState([]);
  const [saleOrders,     setSaleOrders]     = useState([]);
  const [expenses,       setExpenses]       = useState([]);
  const [spareParts,     setSpareParts]     = useState([]);
  const [staff,          setStaff]          = useState([]);
  const [customers,      setCustomers]      = useState([]);
  const [stockImports,   setStockImports]   = useState([]);
  const [ledgerSummary,  setLedgerSummary]  = useState([]);
  const [sparePartUsages,setSparePartUsages]= useState([]);

  if (!user) return null;
  if (!ALLOWED.includes(user.role)) return (
    <div style={{ textAlign:"center", padding:80, color:"#dc2626" }}>
      <div style={{ fontSize:48 }}>🚫</div>
      <div style={{ fontWeight:700, fontSize:16, marginTop:12 }}>Không có quyền truy cập</div>
    </div>
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    const safe = (p) => p.catch(e => { console.warn("MD fetch warn:", e?.message); return []; });
    const [orders, sales, exps, parts, staffList, custs, imports, ledger, usages] = await Promise.all([
      safe(RepairOrder.list({ limit:500, sort:"-received_date" })),
      safe(SaleOrder.list({ limit:200, sort:"-created" })),
      safe(Expense.list({ limit:200, sort:"-expense_date" })),
      safe(SparePart.list({ limit:500 })),
      safe(Staff.list({ limit:100 })),
      safe(Customer.list({ limit:500 })),
      safe(StockImport.list({ limit:50, sort:"-created" })),
      safe(StockLedger.list({ limit:500 })),
      safe(SparePartUsage.list({ limit:100, sort:"-created" })),
    ]);

    // Aggregate ledger
    const ledgerMap = {};
    (ledger||[]).forEach(l => {
      const k = l.part_id||l.sku;
      if (!ledgerMap[k]) ledgerMap[k] = { ...l, total_qty:0, total_value:0 };
      ledgerMap[k].total_qty   += (l.qty_on_hand||0);
      ledgerMap[k].total_value += (l.qty_on_hand||0)*(l.cost_price||0);
    });

    setRepairOrders(orders||[]);
    setSaleOrders(sales||[]);
    setExpenses(exps||[]);
    setSpareParts(parts||[]);
    setStaff(staffList||[]);
    setCustomers(custs||[]);
    setStockImports(imports||[]);
    setLedgerSummary(Object.values(ledgerMap));
    setSparePartUsages(usages||[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function handleStaffUpdate(id, patch) {
    setStaff(prev => prev.map(s => s.id===id ? {...s,...patch} : s));
  }

  async function handleApproveUsage(id) {
    try {
      await SparePartUsage.update(id, { status:"approved" });
      setSparePartUsages(prev => prev.map(u => u.id===id ? {...u, status:"approved"} : u));
    } catch(e) { alert("Lỗi duyệt: "+e.message); }
  }

  function todayStr() {
    return new Date().toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"});
  }

  const renderContent = () => {
    if (loading) return (
      <div style={{ textAlign:"center", padding:64, color:"#9ca3af" }}>
        <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
        <div>Đang tải dữ liệu...</div>
      </div>
    );
    switch(tab) {
      case "overview":  return <OverviewTab repairOrders={repairOrders} saleOrders={saleOrders} spareParts={spareParts} ledgerSummary={ledgerSummary} />;
      case "business":  return <BusinessTab repairOrders={repairOrders} saleOrders={saleOrders} expenses={expenses} />;
      case "staff":     return <StaffTab staff={staff} repairOrders={repairOrders} onStaffUpdate={handleStaffUpdate} />;
      case "inventory": return <InventoryWrapTab spareParts={spareParts} stockImports={stockImports} ledgerSummary={ledgerSummary} sparePartUsages={sparePartUsages} onApproveUsage={handleApproveUsage} />;
      case "settings":  return <SettingsLiteTab user={user} repairOrders={repairOrders} customers={customers} spareParts={spareParts} ledgerSummary={ledgerSummary} onRefresh={loadData} />;
      default: return null;
    }
  };

  // PC: sidebar layout
  if (bp === "pc") return (
    <div style={{ display:"flex", height:"100vh", background:"#f9fafb" }}>
      {/* Sidebar */}
      <div style={{ width:200, background:"#1e1b4b", display:"flex", flexDirection:"column", flexShrink:0 }}>
        <div style={{ padding:"20px 16px 14px", borderBottom:"1px solid rgba(255,255,255,.1)" }}>
          <div style={{ fontWeight:900, fontSize:15, color:"#fff" }}>📊 Manager</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,.6)", marginTop:3 }}>{user.full_name||user.name}</div>
        </div>
        <nav style={{ flex:1, padding:"12px 8px" }}>
          {NAV_TABS.map(n => {
            const active = tab===n.key;
            return (
              <button key={n.key} onClick={()=>setTab(n.key)}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                  borderRadius:10, border:"none", cursor:"pointer", marginBottom:4,
                  background: active?"rgba(255,255,255,.15)":"transparent",
                  color: active?"#fff":"rgba(255,255,255,.65)", fontWeight:active?700:500, fontSize:14 }}>
                <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:20, lineHeight:1 }}>{n.icon}</span>
                {n.label}
              </button>
            );
          })}
        </nav>
        <div style={{ padding:"12px 8px", borderTop:"1px solid rgba(255,255,255,.1)", fontSize:10, color:"rgba(255,255,255,.4)", textAlign:"center" }}>
          {todayStr()}
        </div>
      </div>
      {/* Content */}
      <div style={{ flex:1, overflowY:"auto" }}>{renderContent()}</div>
    </div>
  );

  // Mobile/Tablet: header + bottom nav
  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:"#f9fafb" }}>
      <div style={{ background:"linear-gradient(135deg,#1e1b4b,#4f46e5)", color:"#fff",
        padding: bp==="tablet" ? "16px 24px 14px" : "14px 16px 12px", flexShrink:0 }}>
        <div style={{ fontWeight:900, fontSize: bp==="mobile"?16:18 }}>📊 Manager Dashboard</div>
        <div style={{ fontSize:12, opacity:0.8, marginTop:2 }}>
          {user.full_name||user.name} · {todayStr()}
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto" }}>{renderContent()}</div>
      {/* Bottom Nav */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#fff",
        borderTop:"1.5px solid #e5e7eb", display:"flex", zIndex:100,
        paddingBottom:"env(safe-area-inset-bottom)" }}>
        {NAV_TABS.map(n => {
          const active = tab===n.key;
          return (
            <button key={n.key} onClick={()=>setTab(n.key)}
              style={{ flex:1, border:"none", background:"none", cursor:"pointer",
                padding: bp==="tablet" ? "12px 4px 10px" : "10px 2px 8px",
                display:"flex", flexDirection:"column", alignItems:"center", gap:3,
                position:"relative", color:active?"#4f46e5":"#9ca3af" }}>
              {active && <div style={{ position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",
                width:32,height:2,background:"#4f46e5",borderRadius:2 }} />}
              <span className="material-icons"
                style={{ fontFamily:"Material Icons",fontSize:22,lineHeight:1,color:active?"#4f46e5":"#9ca3af" }}>
                {n.icon}
              </span>
              <span style={{ fontSize: bp==="tablet"?11:9, fontWeight:active?800:500 }}>{n.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
