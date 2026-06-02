/* RevenueReportPage.jsx — Báo cáo doanh thu */
import React, { useState, useEffect, useMemo } from "react";
import { RepairOrder, SaleOrder, Expense, StockImport, StockExportRequest, CashJournal } from "./pb.jsx";

function fmtMoney(n) { return (n||0).toLocaleString("vi-VN") + "đ"; }
function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return String(d.getDate()).padStart(2,"0") + "/" + String(d.getMonth()+1).padStart(2,"0") + "/" + d.getFullYear();
}

const DONE_STATUS = ["Hoàn Thành","Đã Giao","Đã Thanh Toán"];
const PERIOD_TABS = [
  { key:"today",     label:"Hôm nay" },
  { key:"7days",     label:"7 ngày" },
  { key:"30days",    label:"30 ngày" },
  { key:"thismonth", label:"Tháng này" },
];

function startOf(period) {
  const now = new Date();
  if (period==="today")     return new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if (period==="7days")     { const d=new Date(now); d.setDate(d.getDate()-6); d.setHours(0,0,0,0); return d; }
  if (period==="30days")    { const d=new Date(now); d.setDate(d.getDate()-29); d.setHours(0,0,0,0); return d; }
  if (period==="thismonth") return new Date(now.getFullYear(),now.getMonth(),1);
  return new Date(0);
}
function inPeriod(dateStr, period) {
  if (!dateStr) return false;
  return new Date(dateStr) >= startOf(period);
}

const EXP_LABELS = { salary:"Lương", rent:"Thuê mặt bằng", utility:"Điện nước", supply:"Vật tư", other:"Khác" };
const EXP_COLORS = { salary:"#7c3aed", rent:"#dc2626", utility:"#2563eb", supply:"#d97706", other:"#6b7280" };

const TH = { padding:"10px 12px", background:"#f9fafb", fontWeight:800, fontSize:12, color:"#374151", textAlign:"left", borderBottom:"1.5px solid #e5e7eb" };
const TD = { padding:"10px 12px", fontSize:13, borderBottom:"1px solid #f3f4f6", verticalAlign:"middle" };

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components cho RevenueReportPage
// ─────────────────────────────────────────────────────────────────────────────

function TabByKTV({ orders, period, inPeriod, DONE_STATUS }) {
  const filtered = orders.filter(o=>DONE_STATUS.includes(o.status)&&inPeriod(o.done_date||o.updated_date||o.updated,period));
  const byKtv = {};
  filtered.forEach(o=>{
    const name = o.assigned_to_name||"Chưa phân công";
    if(!byKtv[name]) byKtv[name]={name,count:0,revenue:0};
    byKtv[name].count++; byKtv[name].revenue+=(o.final_cost||0);
  });
  const list = Object.values(byKtv).sort((a,b)=>b.revenue-a.revenue);
  const maxRev = Math.max(...list.map(x=>x.revenue),1);
  return (
    <div>
      <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Doanh thu theo Kỹ thuật viên</div>
      {list.length===0 && <div style={{color:"#9ca3af",textAlign:"center",padding:20}}>Không có dữ liệu</div>}
      {list.map(k=>(
        <div key={k.name} style={{background:"#fff",borderRadius:10,padding:12,marginBottom:8,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontWeight:700,fontSize:14}}>{k.name}</span>
            <span style={{fontWeight:700,color:"#4f46e5"}}>{Number(k.revenue).toLocaleString("vi-VN")}đ</span>
          </div>
          <div style={{height:8,background:"#f3f4f6",borderRadius:4}}>
            <div style={{height:"100%",background:"#4f46e5",borderRadius:4,width:`${(k.revenue/maxRev*100).toFixed(1)}%`}}/>
          </div>
          <div style={{fontSize:12,color:"#6b7280",marginTop:4}}>{k.count} đơn hoàn thành</div>
        </div>
      ))}
    </div>
  );
}

function TabServices({ orders, period, inPeriod, DONE_STATUS }) {
  const filtered = orders.filter(o=>DONE_STATUS.includes(o.status)&&inPeriod(o.done_date||o.updated_date||o.updated,period));
  const svcMap = {};
  filtered.forEach(o=>{
    const issues = (o.issue_description||"").split(/[,\n;、]+/).map(s=>s.trim()).filter(s=>s.length>2&&s.length<60);
    issues.forEach(svc=>{
      if(!svcMap[svc]) svcMap[svc]={name:svc,count:0,revenue:0};
      svcMap[svc].count++; svcMap[svc].revenue+=(o.final_cost||0)/Math.max(issues.length,1);
    });
  });
  const list = Object.values(svcMap).sort((a,b)=>b.count-a.count).slice(0,20);
  return (
    <div>
      <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Dịch vụ phổ biến nhất</div>
      {list.length===0 && <div style={{color:"#9ca3af",textAlign:"center",padding:20}}>Không có dữ liệu</div>}
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr>
          <th style={{padding:"8px 10px",background:"#f9fafb",fontWeight:800,fontSize:12,textAlign:"left",borderBottom:"1.5px solid #e5e7eb"}}>Dịch vụ</th>
          <th style={{padding:"8px 10px",background:"#f9fafb",fontWeight:800,fontSize:12,textAlign:"right",borderBottom:"1.5px solid #e5e7eb"}}>Lần</th>
          <th style={{padding:"8px 10px",background:"#f9fafb",fontWeight:800,fontSize:12,textAlign:"right",borderBottom:"1.5px solid #e5e7eb"}}>~Doanh thu</th>
        </tr></thead>
        <tbody>{list.map((s,i)=>(
          <tr key={s.name}>
            <td style={{padding:"8px 10px",fontSize:13,borderBottom:"1px solid #f3f4f6"}}>{i+1}. {s.name}</td>
            <td style={{padding:"8px 10px",fontSize:13,borderBottom:"1px solid #f3f4f6",textAlign:"right",fontWeight:700}}>{s.count}</td>
            <td style={{padding:"8px 10px",fontSize:13,borderBottom:"1px solid #f3f4f6",textAlign:"right",color:"#059669"}}>{Number(s.revenue).toLocaleString("vi-VN")}đ</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function TabDebt({ orders }) {
  const debtOrders = orders.filter(o=>!["Đã Thanh Toán","Hoàn Thành","Đã Giao","Hủy"].includes(o.status)&&o.estimated_cost>0);
  const byCustomer = {};
  debtOrders.forEach(o=>{
    const key = o.customer_phone||o.customer_name||o.id;
    if(!byCustomer[key]) byCustomer[key]={name:o.customer_name,phone:o.customer_phone,orders:[],totalDebt:0};
    byCustomer[key].orders.push(o);
    byCustomer[key].totalDebt+=Math.max(0,(o.estimated_cost||0)-(o.deposit||0));
  });
  const list = Object.values(byCustomer).filter(c=>c.totalDebt>0).sort((a,b)=>b.totalDebt-a.totalDebt);
  return (
    <div>
      <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Công nợ khách hàng</div>
      <div style={{fontSize:12,color:"#9ca3af",marginBottom:12}}>Đơn chưa hoàn thành / chưa thu đủ</div>
      {list.length===0 && <div style={{color:"#9ca3af",textAlign:"center",padding:20}}>Không có công nợ 🎉</div>}
      {list.map(c=>(
        <div key={c.phone||c.name} style={{background:"#fff",borderRadius:10,padding:12,marginBottom:8,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <div>
              <div style={{fontWeight:700,fontSize:14}}>{c.name}</div>
              <div style={{fontSize:12,color:"#6b7280"}}>{c.phone}</div>
            </div>
            <div style={{fontWeight:800,fontSize:15,color:"#dc2626"}}>{Number(c.totalDebt).toLocaleString("vi-VN")}đ</div>
          </div>
          {c.orders.map(o=>(
            <div key={o.id} style={{fontSize:12,color:"#9ca3af",marginTop:4}}>
              {o.order_code||o.id} · {o.device_model} · {o.status}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Tab Sổ quỹ ───────────────────────────────────────────
function CashJournalTab() {
  const [month,    setMonth]   = useState(new Date().toISOString().slice(0,7));
  const [journals, setJournals]= useState([]);
  const [loading,  setLoading] = useState(true);
  const [filter,   setFilter]  = useState("all"); // all | receipt | payment

  useEffect(() => {
    setLoading(true);
    CashJournal.list({ limit:500, sort:"-journal_date" })
      .then(d => setJournals(d||[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const monthData = journals.filter(j => (j.journal_date||"").startsWith(month));
  const totalIn   = monthData.filter(j=>j.entry_type==="receipt").reduce((s,j)=>s+(j.amount||0),0);
  const totalOut  = monthData.filter(j=>j.entry_type==="payment").reduce((s,j)=>s+(j.amount||0),0);
  const net       = totalIn - totalOut;
  const display   = filter==="all" ? monthData : monthData.filter(j=>j.entry_type===filter);

  return (
    <div style={{ padding:16 }}>
      {/* Filter */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)}
          style={{ border:"1.5px solid #e5e7eb", borderRadius:8, padding:"6px 10px", fontSize:13 }}/>
        {[["all","Tất cả"],["receipt","🟢 Thu"],["payment","🔴 Chi"]].map(([k,l])=>(
          <button key={k} onClick={()=>setFilter(k)}
            style={{ padding:"5px 12px", borderRadius:99, border:"1.5px solid", fontSize:12, fontWeight:700, cursor:"pointer",
              borderColor:filter===k?"#4f46e5":"#e5e7eb", background:filter===k?"#eef2ff":"#fff", color:filter===k?"#4f46e5":"#6b7280" }}>
            {l}
          </button>
        ))}
      </div>
      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
        {[
          { label:"Tổng thu", val:totalIn,  color:"#059669", bg:"#f0fdf4" },
          { label:"Tổng chi", val:totalOut, color:"#dc2626", bg:"#fef2f2" },
          { label:"Chênh lệch", val:net,   color:net>=0?"#059669":"#dc2626", bg:net>=0?"#dcfce7":"#fee2e2" },
        ].map(c=>(
          <div key={c.label} style={{ background:c.bg, borderRadius:12, padding:"10px 12px" }}>
            <div style={{ fontSize:10, color:c.color, fontWeight:700 }}>{c.label}</div>
            <div style={{ fontSize:14, fontWeight:900, color:c.color, marginTop:2 }}>{fmtMoney(c.val)}</div>
          </div>
        ))}
      </div>
      {/* Table */}
      {loading ? <div style={{textAlign:"center",color:"#9ca3af",padding:20}}>⏳ Đang tải...</div> :
      display.length === 0 ? <div style={{textAlign:"center",color:"#9ca3af",padding:20}}>Không có dữ liệu</div> :
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead>
            <tr>
              <th style={TH}>Ngày</th><th style={TH}>Loại</th>
              <th style={TH}>Mô tả</th><th style={TH}>H.thức</th>
              <th style={{...TH,textAlign:"right"}}>Số tiền</th>
            </tr>
          </thead>
          <tbody>
            {display.map((j,i)=>(
              <tr key={j.id||i} style={{ background:j.entry_type==="receipt"?"#f0fdf4":"#fef2f2" }}>
                <td style={TD}>{j.journal_date||"—"}</td>
                <td style={TD}>
                  {j.entry_type==="receipt"
                    ? <span style={{background:"#dcfce7",color:"#059669",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:700}}>🟢 Thu</span>
                    : <span style={{background:"#fee2e2",color:"#dc2626",borderRadius:99,padding:"2px 8px",fontSize:11,fontWeight:700}}>🔴 Chi</span>}
                </td>
                <td style={TD}>{j.description||j.ref_code||"—"}</td>
                <td style={TD}>{j.payment_method==="cash"?"💵 TM":"🏦 CK"}</td>
                <td style={{...TD,textAlign:"right",fontWeight:800,color:j.entry_type==="receipt"?"#059669":"#dc2626"}}>{fmtMoney(j.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  );
}


// ── Tab Top sản phẩm bán chạy ─────────────────────────────
function TopProductsTab({ repairOrders, saleOrders }) {
  // Phân tích từ repair_orders + sale_orders
  const productMap = {};

  (repairOrders || []).forEach(o => {
    const name = o.device_model || o.device_name || "Không rõ";
    if (!productMap[name]) productMap[name] = { name, countRepair:0, countSale:0, revenue:0 };
    productMap[name].countRepair++;
    productMap[name].revenue += (o.final_cost || o.estimated_cost || 0);
  });

  (saleOrders || []).forEach(o => {
    const name = o.product_name || o.item_name || o.name || "Không rõ";
    if (!productMap[name]) productMap[name] = { name, countRepair:0, countSale:0, revenue:0 };
    productMap[name].countSale++;
    productMap[name].revenue += (o.total || o.total_amount || o.price || 0);
  });

  const sorted = Object.values(productMap)
    .map(p => ({ ...p, count: p.countRepair + p.countSale }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  if (!sorted.length) return (
    <div style={{textAlign:"center",padding:60,color:"#9ca3af",fontSize:15}}>
      📭 Chưa có dữ liệu
    </div>
  );

  const maxCount = sorted[0]?.count || 1;

  return (
    <div style={{ padding:16 }}>
      <div style={{fontWeight:800,fontSize:15,color:"#1e1b4b",marginBottom:12}}>
        🏅 Top 20 sản phẩm / dịch vụ bán chạy
      </div>
      {sorted.map((p, i) => (
        <div key={p.name} style={{background:"#fff",borderRadius:12,padding:"12px 16px",
          marginBottom:8,border:"1.5px solid #e5e7eb",
          display:"flex",alignItems:"center",gap:14}}>
          {/* Rank badge */}
          <div style={{width:32,height:32,borderRadius:10,flexShrink:0,
            background: i===0?"#fbbf24":i===1?"#9ca3af":i===2?"#cd7c3c":"#f3f4f6",
            color: i<3?"#fff":"#374151",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontWeight:900,fontSize:14}}>
            {i+1}
          </div>
          {/* Info */}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14,color:"#1e1b4b",
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {p.name}
            </div>
            {/* Progress bar */}
            <div style={{height:4,background:"#f3f4f6",borderRadius:99,marginTop:6,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:99,
                background:i===0?"#fbbf24":i===1?"#9ca3af":i===2?"#cd7c3c":"#4f46e5",
                width:`${Math.round(p.count/maxCount*100)}%`,transition:"width .3s"}} />
            </div>
            <div style={{fontSize:11,color:"#6b7280",marginTop:3}}>
              {p.countRepair > 0 && `🔧 ${p.countRepair} sửa `}
              {p.countSale   > 0 && `🛒 ${p.countSale} bán`}
            </div>
          </div>
          {/* Stats */}
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontWeight:900,fontSize:18,color:"#4f46e5"}}>{p.count}</div>
            <div style={{fontSize:11,color:"#9ca3af"}}>lượt</div>
            {p.revenue > 0 && (
              <div style={{fontSize:11,color:"#059669",marginTop:2,fontWeight:600}}>
                {p.revenue.toLocaleString("vi-VN")}đ
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab Lãi lỗ (P&L) ─────────────────────────────────────
function ProfitLossTab({ repairOrders, saleOrders, expenses }) {
  const [period, setPeriod] = useState("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd,   setCustomEnd]   = useState("");
  const [stockExps,   setStockExps]   = useState([]);

  useEffect(() => {
    StockExportRequest.list({ limit:500, sort:"-updated" })
      .then(d => setStockExps(d||[])).catch(()=>{});
  }, []);

  function inP(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d)) return false;
    const now = new Date();
    if (period === "today") {
      return d.toDateString() === now.toDateString();
    } else if (period === "week") {
      const w = new Date(now); w.setDate(now.getDate()-7);
      return d >= w;
    } else if (period === "month") {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      return d >= m;
    } else if (period === "prev_month") {
      const s = new Date(now.getFullYear(), now.getMonth()-1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59);
      return d >= s && d <= e;
    } else if (period === "custom" && customStart && customEnd) {
      return d >= new Date(customStart) && d <= new Date(customEnd+"T23:59:59");
    }
    return true;
  }

  const DONE_ST = ["Đã Thanh Toán","Hoàn Thành","Đã Giao"];
  const repairRev = repairOrders.filter(o=>DONE_ST.includes(o.status)&&inP(o.paid_at||o.done_date)).reduce((s,o)=>s+(o.final_cost||0),0);
  const saleRev   = saleOrders.filter(o=>o.status==="paid"&&inP(o.created||o.created_date)).reduce((s,o)=>s+(o.total||0),0);
  const totalRev  = repairRev + saleRev;

  const partsCost = stockExps.filter(x=>x.status==="approved"&&inP(x.updated_date||x.updated)).reduce((s,x)=>s+(x.total_value||0),0);
  const grossProfit = totalRev - partsCost;

  const approvedExp = expenses.filter(e=>e.status==="approved"&&inP(e.expense_date||e.created));
  const EXP_CATS = ["salary","rent","utilities","supplies","other"];
  const EXP_LBL  = { salary:"Lương", rent:"Thuê MB", utilities:"Điện nước", supplies:"Vật tư", other:"Khác" };
  const expByCat = EXP_CATS.map(cat=>({
    cat, label:EXP_LBL[cat]||cat,
    total: approvedExp.filter(e=>(e.category||"other")===cat).reduce((s,e)=>s+(e.amount||0),0),
  })).filter(x=>x.total>0);
  const totalOpEx = approvedExp.reduce((s,e)=>s+(e.amount||0),0);
  const netProfit = grossProfit - totalOpEx;

  const PERIOD_OPTS = [
    {v:"today",label:"Hôm nay"},{v:"week",label:"7 ngày"},
    {v:"month",label:"Tháng này"},{v:"prev_month",label:"Tháng trước"},
    {v:"custom",label:"Tùy chỉnh"},
  ];

  const ROW = ({label,val,indent=false,bold=false,big=false,color}) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:indent?"6px 8px 6px 24px":"8px 8px",
      borderBottom:"1px solid #f3f4f6",
    }}>
      <span style={{ fontSize:indent?12:13, color:color||"#374151", fontWeight:bold?800:indent?500:600 }}>{label}</span>
      <span style={{ fontSize:big?18:indent?12:14, fontWeight:bold||big?900:600, color:color||(val>=0?"#1e1b4b":"#dc2626") }}>
        {fmtMoney(val)}
      </span>
    </div>
  );

  return (
    <div style={{ padding:16 }}>
      {/* Period filter */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
        {PERIOD_OPTS.map(o=>(
          <button key={o.v} onClick={()=>setPeriod(o.v)}
            style={{ padding:"5px 12px", borderRadius:99, border:"1.5px solid", fontSize:12, fontWeight:700, cursor:"pointer",
              borderColor:period===o.v?"#4f46e5":"#e5e7eb", background:period===o.v?"#eef2ff":"#fff", color:period===o.v?"#4f46e5":"#6b7280" }}>
            {o.label}
          </button>
        ))}
      </div>
      {period==="custom" && (
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)}
            style={{ flex:1, border:"1.5px solid #e5e7eb", borderRadius:8, padding:"6px 10px", fontSize:12 }}/>
          <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)}
            style={{ flex:1, border:"1.5px solid #e5e7eb", borderRadius:8, padding:"6px 10px", fontSize:12 }}/>
        </div>
      )}

      {/* P&L Table */}
      <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #e5e7eb", overflow:"hidden", marginBottom:10 }}>
        <div style={{ background:"#1e1b4b", padding:"10px 12px", color:"#fff", fontWeight:800, fontSize:13 }}>📊 BÁO CÁO LÃI LỖ</div>
        {/* Doanh thu */}
        <div style={{ background:"#f0fdf4", padding:"6px 8px 2px", fontSize:11, fontWeight:800, color:"#059669", textTransform:"uppercase", letterSpacing:1 }}>DOANH THU</div>
        <ROW label="Sửa chữa" val={repairRev} indent color="#374151"/>
        <ROW label="Bán lẻ"   val={saleRev}   indent color="#374151"/>
        <ROW label="Tổng doanh thu" val={totalRev} bold color="#059669"/>
        {/* Giá vốn */}
        <div style={{ background:"#fef2f2", padding:"6px 8px 2px", fontSize:11, fontWeight:800, color:"#dc2626", textTransform:"uppercase", letterSpacing:1 }}>GIÁ VỐN</div>
        <ROW label="Linh kiện xuất dùng" val={partsCost} indent color="#374151"/>
        <ROW label="Tổng giá vốn" val={partsCost} bold color="#dc2626"/>
        {/* LN gộp */}
        <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 8px", background:grossProfit>=0?"#dcfce7":"#fee2e2", borderBottom:"1px solid #e5e7eb" }}>
          <span style={{ fontWeight:800, fontSize:14, color:grossProfit>=0?"#059669":"#dc2626" }}>LỢI NHUẬN GỘP</span>
          <span style={{ fontWeight:900, fontSize:16, color:grossProfit>=0?"#059669":"#dc2626" }}>{fmtMoney(grossProfit)}</span>
        </div>
        {/* Chi phí */}
        <div style={{ background:"#fffbeb", padding:"6px 8px 2px", fontSize:11, fontWeight:800, color:"#d97706", textTransform:"uppercase", letterSpacing:1 }}>CHI PHÍ HOẠT ĐỘNG</div>
        {expByCat.map(x=><ROW key={x.cat} label={x.label} val={x.total} indent color="#374151"/>)}
        {expByCat.length===0 && <div style={{padding:"8px 24px",fontSize:12,color:"#9ca3af"}}>Chưa có chi phí được duyệt</div>}
        <ROW label="Tổng chi phí" val={totalOpEx} bold color="#d97706"/>
        {/* LN ròng */}
        <div style={{ display:"flex", justifyContent:"space-between", padding:"14px 8px", background:netProfit>=0?"#f0fdf4":"#fef2f2" }}>
          <span style={{ fontWeight:900, fontSize:15, color:netProfit>=0?"#065f46":"#991b1b" }}>LỢI NHUẬN RÒNG</span>
          <span style={{ fontWeight:900, fontSize:20, color:netProfit>=0?"#059669":"#dc2626" }}>{fmtMoney(netProfit)}</span>
        </div>
      </div>
      <div style={{ fontSize:11, color:"#9ca3af", textAlign:"center" }}>* Chi phí chỉ tính các khoản đã được duyệt</div>
    </div>
  );
}

function TabStockReport({ period, startOf }) {
  const [imports,  setImports]  = useState([]);
  const [exports_, setExports]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(()=>{
    Promise.all([
      StockImport.list({ limit:200, sort:"-id" }),
      StockExportRequest.list({ limit:200, sort:"-id" }),
    ]).then(([imp,exp])=>{ setImports(imp||[]); setExports(exp||[]); })
      .catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  const start = startOf(period);
  const filtImp = imports.filter(i=>new Date(i.created_date||i.created)>=start);
  const filtExp = exports_.filter(e=>new Date(e.created_date||e.created)>=start);
  const totalImpVal = filtImp.reduce((s,i)=>s+(i.total_value||0),0);
  const totalExpVal = filtExp.reduce((s,e)=>s+(e.total_value||0),0);

  return (
    <div>
      <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Linh kiện nhập / xuất theo kỳ</div>
      {loading && <div style={{color:"#9ca3af",textAlign:"center",padding:20}}>Đang tải...</div>}
      {!loading && (<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          <div style={{background:"#f0fdf4",borderRadius:10,padding:12,textAlign:"center"}}>
            <div style={{fontWeight:700,color:"#059669",fontSize:13}}>Nhập kho</div>
            <div style={{fontWeight:900,fontSize:20,color:"#059669"}}>{filtImp.length} phiếu</div>
            <div style={{fontSize:12,color:"#6b7280"}}>{Number(totalImpVal).toLocaleString("vi-VN")}đ</div>
          </div>
          <div style={{background:"#fff7ed",borderRadius:10,padding:12,textAlign:"center"}}>
            <div style={{fontWeight:700,color:"#d97706",fontSize:13}}>Xuất kho</div>
            <div style={{fontWeight:900,fontSize:20,color:"#d97706"}}>{filtExp.length} phiếu</div>
            <div style={{fontSize:12,color:"#6b7280"}}>{Number(totalExpVal).toLocaleString("vi-VN")}đ</div>
          </div>
        </div>
        <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>Phiếu nhập gần đây</div>
        {filtImp.slice(0,10).map(i=>(
          <div key={i.id} style={{background:"#fff",borderRadius:8,padding:10,marginBottom:6,boxShadow:"0 1px 3px rgba(0,0,0,.05)"}}>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontWeight:700,fontSize:13}}>{i.import_code||i.id}</span>
              <span style={{fontWeight:700,color:"#059669"}}>{Number(i.total_value||0).toLocaleString("vi-VN")}đ</span>
            </div>
            <div style={{fontSize:12,color:"#6b7280"}}>{i.supplier_name||""} · {i.status}</div>
          </div>
        ))}
        {filtImp.length===0 && <div style={{color:"#9ca3af",fontSize:13}}>Không có phiếu nhập trong kỳ</div>}
      </>)}
    </div>
  );
}


export default function RevenueReportPage({ user }) {
  const [period,      setPeriod]      = useState("today");
  const [detailTab,   setDetailTab]   = useState("repair");
  const [repairOrders,setRepairOrders]= useState([]);
  const [saleOrders,  setSaleOrders]  = useState([]);
  const [expenses,    setExpenses]    = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [ro,so,ex] = await Promise.all([
          RepairOrder.list({ limit:500, sort:"-received_date" }),
          SaleOrder.list({ limit:500, sort:"-id" }),
          Expense.list({ limit:500, sort:"-expense_date" }),
        ]);
        setRepairOrders(ro||[]); setSaleOrders(so||[]); setExpenses(ex||[]);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const periodRepair = useMemo(() =>
    repairOrders.filter(o => DONE_STATUS.includes(o.status) && inPeriod(o.done_date||o.updated, period)),
    [repairOrders, period]);
  const periodSale = useMemo(() =>
    saleOrders.filter(o => o.status==="paid" && inPeriod(o.created||o.created_date, period)),
    [saleOrders, period]);
  const periodExp = useMemo(() =>
    expenses.filter(e => inPeriod(e.expense_date||e.created, period)),
    [expenses, period]);

  const repairRev = periodRepair.reduce((s,o) => s+(o.final_cost||0), 0);
  const saleRev   = periodSale.reduce((s,o)   => s+(o.total||0), 0);
  const totalRev  = repairRev + saleRev;
  const totalExp  = periodExp.reduce((s,e)    => s+(e.amount||0), 0);
  const profit    = totalRev - totalExp;

  function exportCSV() {
    const BOM = "\uFEFF";
    const rows = [
      ["BÁO CÁO DOANH THU — " + period.toUpperCase(),"","",""],
      ["Doanh thu sửa",repairRev,"Doanh thu bán",saleRev,"Tổng",totalRev],
      ["Chi phí",totalExp,"Lợi nhuận",totalRev-totalExp],
      [],
      ["CHI TIẾT ĐƠN SỬA"],
      ["Mã phiếu","Khách hàng","SĐT","Thiết bị","KTV","Giá cuối","Đã cọc","Còn lại","Ngày xong"],
      ...periodRepair.map(o=>[
        o.order_code||o.id, o.customer_name||"", o.customer_phone||"",
        o.device_model||"", o.assigned_to_name||"",
        o.final_cost||0, o.deposit||0, Math.max(0,(o.final_cost||0)-(o.deposit||0)),
        o.done_date ? new Date(o.done_date).toLocaleDateString("vi-VN") : ""
      ]),
      [],
      ["CHI TIẾT BÁN LẺ"],
      ["Mã đơn","Ghi chú","Tổng","Hình thức","Ngày"],
      ...periodSale.map(o=>[
        o.order_code||o.id, o.note||"", o.total||0, o.payment_method||"",
        new Date(o.created||o.created_date).toLocaleDateString("vi-VN")
      ]),
      [],
      ["CHI PHÍ"],
      ["Loại","Mô tả","Số tiền","Ngày"],
      ...periodExp.map(e=>[
        e.category||"Khác", e.description||"", e.amount||0,
        e.expense_date ? new Date(e.expense_date).toLocaleDateString("vi-VN") : ""
      ]),
    ];
    const blob = new Blob([BOM+rows.map(r=>r.join(",")).join("\n")],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download="BaoCao_"+period+"_"+new Date().toISOString().slice(0,10)+".csv"; a.click();
  }

  const SUMMARY_CARDS = [
    { icon:"💰", label:"Doanh thu sửa chữa",  value:fmtMoney(repairRev), bg:"#eff6ff", border:"#bfdbfe", color:"#1d4ed8" },
    { icon:"🛒", label:"Doanh thu bán lẻ",     value:fmtMoney(saleRev),   bg:"#f0fdf4", border:"#86efac", color:"#059669" },
    { icon:"📦", label:"Tổng doanh thu",        value:fmtMoney(totalRev),  bg:"#fefce8", border:"#fde68a", color:"#ca8a04" },
    { icon:"💸", label:"Chi phí",               value:fmtMoney(totalExp),  bg:"#fef2f2", border:"#fca5a5", color:"#dc2626" },
    { icon:"📈", label:"Lợi nhuận ước tính",    value:fmtMoney(profit),    bg:profit>=0?"#f0fdf4":"#fef2f2", border:profit>=0?"#86efac":"#fca5a5", color:profit>=0?"#059669":"#dc2626" },
    { icon:"🧾", label:"Số đơn",                value:(periodRepair.length+periodSale.length)+" đơn", bg:"#fdf4ff", border:"#e9d5ff", color:"#7c3aed" },
  ];

  const DETAIL_TABS = [
    { key:"repair",       label:"🔧 Đơn sửa" },
    { key:"sale",         label:"🛒 Bán lẻ" },
    { key:"expense",      label:"💸 Chi phí" },
    { key:"by_ktv",       label:"👨‍🔧 KTV" },
    { key:"services",     label:"🏆 Dịch vụ" },
    { key:"top_products", label:"🏅 SP bán chạy" },
    { key:"pl",           label:"📊 Lãi lỗ" },
    { key:"cash_journal", label:"💰 Sổ quỹ" },
    { key:"stock_report", label:"📦 LK" },
  ];

  if (loading) return <div style={{ textAlign:"center", padding:48, color:"#9ca3af" }}>⏳ Đang tải...</div>;

  return (
    <div style={{ padding:"16px 14px 100px" }}>
      <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b", marginBottom:16 }}>📊 Báo cáo doanh thu</div>

      {/* Period tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {PERIOD_TABS.map(t => (
          <button key={t.key} onClick={()=>setPeriod(t.key)}
            style={{ padding:"8px 16px", borderRadius:99, border:"none", cursor:"pointer",
              background:period===t.key?"#059669":"#f3f4f6",
              color:period===t.key?"#fff":"#374151",
              fontWeight:period===t.key?800:600, fontSize:13 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
        {SUMMARY_CARDS.map((c,i) => (
          <div key={i} style={{ background:c.bg, border:"2px solid "+c.border, borderRadius:16, padding:"14px 12px" }}>
            <div style={{ fontSize:20, marginBottom:4 }}>{c.icon}</div>
            <div style={{ fontSize:16, fontWeight:900, color:c.color, lineHeight:1.2 }}>{c.value}</div>
            <div style={{ fontSize:11, color:"#6b7280", marginTop:4, fontWeight:600 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Detail section */}
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb", overflow:"hidden" }}>
        {/* Tab header */}
        <div style={{ display:"flex", borderBottom:"1.5px solid #e5e7eb" }}>
          {DETAIL_TABS.map(t => (
            <button key={t.key} onClick={()=>setDetailTab(t.key)}
              style={{ flex:1, padding:"12px 8px", border:"none", cursor:"pointer",
                background:detailTab===t.key?"#f0fdf4":"#fff",
                color:detailTab===t.key?"#059669":"#6b7280",
                fontWeight:detailTab===t.key?800:500, fontSize:13,
                borderBottom:detailTab===t.key?"2px solid #059669":"2px solid transparent" }}>
              {t.label}
            </button>
          ))}
        </div>
        {/* Export button */}
        <div style={{ padding:"10px 16px", borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"flex-end" }}>
          <button onClick={exportCSV}
            style={{ padding:"8px 16px", background:"#4f46e5", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:12, cursor:"pointer" }}>
            📥 Xuất CSV
          </button>
        </div>

        {/* Tab: Đơn sửa */}
        {detailTab==="repair" && (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={TH}>Mã đơn</th><th style={TH}>Khách hàng</th>
                  <th style={TH}>Thiết bị</th><th style={TH}>Ngày HT</th>
                  <th style={{...TH,textAlign:"right"}}>Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {periodRepair.length===0
                  ? <tr><td colSpan={5} style={{...TD,textAlign:"center",color:"#9ca3af"}}>Không có dữ liệu</td></tr>
                  : periodRepair.map(o => (
                    <tr key={o.id}>
                      <td style={{...TD,fontWeight:700}}>{o.order_code}</td>
                      <td style={TD}>{o.customer_name||"-"}</td>
                      <td style={TD}>{o.device_model||"-"}</td>
                      <td style={TD}>{fmtDate(o.done_date)}</td>
                      <td style={{...TD,textAlign:"right",fontWeight:800,color:"#059669"}}>{fmtMoney(o.final_cost)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}

        {/* Tab: Bán lẻ */}
        {detailTab==="sale" && (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={TH}>Mã đơn</th><th style={TH}>Khách</th>
                  <th style={{...TH,textAlign:"center"}}>Số SP</th>
                  <th style={{...TH,textAlign:"right"}}>Tổng tiền</th>
                  <th style={TH}>HTTT</th><th style={TH}>Ngày bán</th>
                </tr>
              </thead>
              <tbody>
                {periodSale.length===0
                  ? <tr><td colSpan={6} style={{...TD,textAlign:"center",color:"#9ca3af"}}>Không có dữ liệu</td></tr>
                  : periodSale.map(o => (
                    <tr key={o.id}>
                      <td style={{...TD,fontWeight:700}}>{o.order_code}</td>
                      <td style={TD}>{o.customer_name||"Khách lẻ"}</td>
                      <td style={{...TD,textAlign:"center"}}>{(o.items||[]).length}</td>
                      <td style={{...TD,textAlign:"right",fontWeight:800,color:"#059669"}}>{fmtMoney(o.total)}</td>
                      <td style={TD}>{o.payment_method}</td>
                      <td style={TD}>{fmtDate(o.created||o.created_date)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}

        {/* Tab: Chi phí */}
        {detailTab==="expense" && (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={TH}>Danh mục</th><th style={TH}>Mô tả</th>
                  <th style={{...TH,textAlign:"right"}}>Số tiền</th>
                  <th style={TH}>Ngày</th><th style={TH}>Người tạo</th>
                </tr>
              </thead>
              <tbody>
                {periodExp.length===0
                  ? <tr><td colSpan={5} style={{...TD,textAlign:"center",color:"#9ca3af"}}>Không có dữ liệu</td></tr>
                  : periodExp.map(e => (
                    <tr key={e.id}>
                      <td style={TD}>
                        <span style={{ background:(EXP_COLORS[e.category]||"#6b7280")+"22",
                          color:EXP_COLORS[e.category]||"#6b7280",
                          borderRadius:99, padding:"2px 10px", fontSize:11, fontWeight:700 }}>
                          {EXP_LABELS[e.category]||e.category||"-"}
                        </span>
                      </td>
                      <td style={TD}>{e.description||"-"}</td>
                      <td style={{...TD,textAlign:"right",fontWeight:800,color:"#dc2626"}}>{fmtMoney(e.amount)}</td>
                      <td style={TD}>{fmtDate(e.expense_date)}</td>
                      <td style={TD}>{e.created_by_name||"-"}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}

        {detailTab==="by_ktv"       && <div style={{padding:16}}><TabByKTV orders={repairOrders} period={period} inPeriod={inPeriod} DONE_STATUS={DONE_STATUS}/></div>}
        {detailTab==="services"     && <div style={{padding:16}}><TabServices orders={repairOrders} period={period} inPeriod={inPeriod} DONE_STATUS={DONE_STATUS}/></div>}
        {detailTab==="top_products" && <TopProductsTab repairOrders={repairOrders} saleOrders={saleOrders} />}
        {detailTab==="pl"           && <ProfitLossTab repairOrders={repairOrders} saleOrders={saleOrders} expenses={expenses}/>}
        {detailTab==="cash_journal" && <CashJournalTab/>}
        {detailTab==="stock_report" && <div style={{padding:16}}><TabStockReport period={period} startOf={startOf}/></div>}
      </div>
    </div>
  );
}
