/* RevenueReportPage.jsx — Báo cáo doanh thu */
import React, { useState, useEffect, useMemo } from "react";
import { RepairOrder, SaleOrder, Expense } from "./pb.jsx";

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
          SaleOrder.list({ limit:500, sort:"-created" }),
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
    let csv = "";
    const now = new Date();
    const fname = "BaoCao_" + String(now.getDate()).padStart(2,"0") + String(now.getMonth()+1).padStart(2,"0") + now.getFullYear() + ".csv";
    if (detailTab==="repair") {
      csv = BOM + "Mã đơn,Khách hàng,Thiết bị,Ngày hoàn thành,Doanh thu,Trạng thái\n";
      periodRepair.forEach(o => {
        csv += '"'+(o.order_code||"")+'","'+(o.customer_name||"")+'","'+(o.device_model||"")+'","'+fmtDate(o.done_date)+'","'+(o.final_cost||0)+'","'+(o.status||"")+'"\n';
      });
    } else if (detailTab==="sale") {
      csv = BOM + "Mã đơn,Khách hàng,Số SP,Tổng tiền,HTTT,Ngày bán\n";
      periodSale.forEach(o => {
        csv += '"'+(o.order_code||"")+'","'+(o.customer_name||"")+'","'+((o.items||[]).length)+'","'+(o.total||0)+'","'+(o.payment_method||"")+'","'+fmtDate(o.created||o.created_date)+'"\n';
      });
    } else {
      csv = BOM + "Danh mục,Mô tả,Số tiền,Ngày,Người tạo\n";
      periodExp.forEach(e => {
        csv += '"'+(EXP_LABELS[e.category]||e.category||"")+'","'+(e.description||"")+'","'+(e.amount||0)+'","'+fmtDate(e.expense_date)+'","'+(e.created_by_name||"")+'"\n';
      });
    }
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href=url; a.download=fname; a.click();
    URL.revokeObjectURL(url);
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
    { key:"repair",  label:"🔧 Đơn sửa" },
    { key:"sale",    label:"🛒 Bán lẻ" },
    { key:"expense", label:"💸 Chi phí" },
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
      </div>
    </div>
  );
}
