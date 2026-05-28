/* RevenueReportPage.jsx — Báo cáo doanh thu */
import React, { useState, useEffect, useMemo } from "react";
import { RepairOrder, SaleOrder, Expense, StockImport, StockExportRequest } from "./pb.jsx";

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

function TabStockReport({ period, startOf }) {
  const [imports,  setImports]  = useState([]);
  const [exports_, setExports]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(()=>{
    Promise.all([
      StockImport.list({ limit:200, sort:"-created_date" }),
      StockExportRequest.list({ limit:200, sort:"-created_date" }),
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
    { key:"by_ktv",       label:"👨‍🔧 Theo KTV" },
    { key:"services",     label:"🏆 Dịch vụ PB" },
    { key:"debt",         label:"⚠️ Công nợ" },
    { key:"stock_report", label:"📦 LK nhập/xuất" },
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
        {detailTab==="debt"         && <div style={{padding:16}}><TabDebt orders={repairOrders}/></div>}
        {detailTab==="stock_report" && <div style={{padding:16}}><TabStockReport period={period} startOf={startOf}/></div>}
      </div>
    </div>
  );
}
