/* CashierApp.jsx — App 3: Kế toán & Bán hàng lẻ */
import React, { useState, useEffect } from "react";
import { RepairOrder, SaleOrder, SaleOrderItem, Expense, CashJournal, ShiftReconcile } from "./pb.jsx";

const ALLOWED_ROLES = ["accountant", "cashier", "manager", "admin", "owner", "sales", "team_leader"];
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
          SaleOrder.list({ limit: 500, sort: "-id" }),
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
  const saleToday     = saleOrders.filter(o => isToday(o.created_date || o.created));
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

// NAV_TABS dynamic theo role — xem bên trong CashierApp component


// ─────────────────────────────────────────────────────────────────────────────
// ShiftReconcile — Đối soát ca ngày
// ─────────────────────────────────────────────────────────────────────────────
function ShiftReconcilePage({ user }) {
  const [date, setDate]       = useState(new Date().toISOString().slice(0,10));
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [actualCash, setActualCash] = useState("");   // Tiền mặt thực đếm
  const [actualBank, setActualBank] = useState("");   // Tiền CK thực
  const [reconcileRecord, setReconcileRecord] = useState(null); // Bản ghi đối soát đã lưu
  const [saving, setSaving] = useState(false);
  const isManager = user && ["manager","admin"].includes(user.role);

  useEffect(() => { load(); }, [date]);

  async function load() {
    setLoading(true);
    try {
      const [repairs, sales, exps, journals, reconciles] = await Promise.all([
        RepairOrder.list({ limit:500 }),
        SaleOrder.list({ limit:500 }),
        Expense.list({ limit:200 }),
        CashJournal.list({ limit:1000, sort:"-id" }),
        ShiftReconcile.list({ limit:50, sort:"-id" }),
      ]);

      // Tìm bản ghi đối soát đã lưu cho ngày này
      const rec = (reconciles||[]).find(r => (r.reconcile_date||"") === date);
      setReconcileRecord(rec || null);
      if (rec) {
        setActualCash(rec.actual_cash != null ? String(rec.actual_cash) : "");
        setActualBank(rec.actual_bank != null ? String(rec.actual_bank) : "");
      } else {
        setActualCash(""); setActualBank("");
      }

      const dayJournals = (journals||[]).filter(j => (j.journal_date||"").startsWith(date));
      const cashIn  = dayJournals.filter(j => j.entry_type==="receipt" && (j.payment_method==="cash"||j.payment_method==="Tiền mặt")).reduce((s,j)=>s+(j.amount||0),0);
      const cashOut = dayJournals.filter(j => j.entry_type==="payment" && (j.payment_method==="cash"||j.payment_method==="Tiền mặt")).reduce((s,j)=>s+(j.amount||0),0);

      const repairJournals = dayJournals.filter(j => j.ref_type==="repair_order");
      const saleJournals   = dayJournals.filter(j => j.ref_type==="sale_order");

      const isCash = m => !m || m==="cash" || m==="Tiền mặt";
      const isBank = m => m==="transfer" || m==="Chuyển khoản" || m==="bank_transfer";

      const repairCash = repairJournals.filter(j=>isCash(j.payment_method)).reduce((s,j)=>s+(j.amount||0),0);
      const repairBank = repairJournals.filter(j=>isBank(j.payment_method)).reduce((s,j)=>s+(j.amount||0),0);
      const saleCash   = saleJournals.filter(j=>isCash(j.payment_method)).reduce((s,j)=>s+(j.amount||0),0);
      const saleBank   = saleJournals.filter(j=>isBank(j.payment_method)).reduce((s,j)=>s+(j.amount||0),0);
      const repairRev  = repairCash + repairBank;
      const saleRev    = saleCash + saleBank;
      const totalRev   = repairRev + saleRev;

      const start = new Date(date); start.setHours(0,0,0,0);
      const end   = new Date(date); end.setHours(23,59,59,999);
      const inDay = d => d && new Date(d) >= start && new Date(d) <= end;
      const dayExp = (exps||[]).filter(e => inDay(e.expense_date||e.created_date||e.created));
      const totalExp = dayExp.reduce((s,e)=>s+(e.amount||0),0);

      const repairIds = new Set(repairJournals.map(j=>j.ref_id).filter(Boolean));
      const saleIds   = new Set(saleJournals.map(j=>j.ref_id).filter(Boolean));
      const doneRepairs = (repairs||[]).filter(o => repairIds.has(o.id));
      const paidSales   = (sales||[]).filter(o => saleIds.has(o.id));

      const sysCash = repairCash + saleCash;
      const sysBank = repairBank + saleBank;

      setData({ doneRepairs, paidSales, dayExp,
        repairRev, saleRev, totalRev, totalExp,
        profit: totalRev - totalExp,
        sysCash, sysBank,
        repairCash, repairBank, saleCash, saleBank,
        deposits: doneRepairs.reduce((s,o)=>s+(o.deposit||0),0),
        cashIn, cashOut, cashNet: cashIn - cashOut,
      });
    } catch(e){ alert("Lỗi tải đối soát: "+e.message); }
    setLoading(false);
  }

  const fmt = n => Number(n||0).toLocaleString("vi-VN")+"đ";
  const parseNum = s => { const n = parseInt(String(s).replace(/[^\d]/g,"")); return isNaN(n)?0:n; };

  const actualCashNum = parseNum(actualCash);
  const actualBankNum = parseNum(actualBank);
  const cashDiff = data ? actualCashNum - data.sysCash : 0;
  const bankDiff = data ? actualBankNum - data.sysBank : 0;
  const isLocked = reconcileRecord && reconcileRecord.status === "confirmed";

  async function saveReconcile(status) {
    if (!data) return;
    setSaving(true);
    try {
      const payload = {
        reconcile_date: date,
        sys_cash: data.sysCash,
        sys_bank: data.sysBank,
        actual_cash: actualCashNum,
        actual_bank: actualBankNum,
        cash_diff: cashDiff,
        bank_diff: bankDiff,
        total_revenue: data.totalRev,
        total_expense: data.totalExp,
        profit: data.profit,
        status: status, // "draft" hoặc "confirmed"
        cashier_id: user.id || "",
        cashier_name: user.full_name || user.name || "",
        confirmed_by_id: status === "confirmed" ? (user.id||"") : "",
        confirmed_by_name: status === "confirmed" ? (user.full_name||user.name||"") : "",
        confirmed_at: status === "confirmed" ? new Date().toISOString() : "",
        note: "",
      };
      if (reconcileRecord) {
        await ShiftReconcile.update(reconcileRecord.id, payload);
      } else {
        await ShiftReconcile.create(payload);
      }
      alert(status === "confirmed" ? "✅ Đã xác nhận đối soát ca!" : "Đã lưu nháp");
      load();
    } catch(e) { alert("Lỗi lưu: "+e.message); }
    setSaving(false);
  }

  function exportCSV() {
    if (!data) return;
    const BOM = "\uFEFF";
    const rows = [
      ["DOI SOAT CA — " + date], [],
      ["DOANH THU"], ["Sua chua",data.repairRev,"Ban le",data.saleRev,"Tong",data.totalRev],
      [], ["THANH TOAN"],
      ["TM sua",data.repairCash,"TM ban",data.saleCash,"Tong TM",data.sysCash],
      ["CK sua",data.repairBank,"CK ban",data.saleBank,"Tong CK",data.sysBank],
      [], ["THUC TE"], ["TM thuc",actualCashNum,"CK thuc",actualBankNum],
      ["Chenh lech TM",cashDiff,"Chenh lech CK",bankDiff],
      [], ["Chi phi",data.totalExp,"Loi nhuan",data.profit], [],
      ["DON SUA"], ["Ma phieu","KH","SDT","Thiet bi","Tong","Coc","Con lai","TT"],
      ...(data.doneRepairs.map(o=>[o.order_code||o.id,o.customer_name,o.customer_phone,o.device_model,o.final_cost||0,o.deposit||0,Math.max(0,(o.final_cost||0)-(o.deposit||0)),o.payment_method||"TM"])),
      [], ["BAN LE"], ["Ma","Ghi chu","Tong","TT"],
      ...(data.paidSales.map(o=>[o.order_code||o.id,o.note||"",o.total||0,o.payment_method||"TM"])),
      [], ["CHI PHI"], ["Loai","Mo ta","So tien"],
      ...(data.dayExp.map(e=>[e.category||"Khac",e.description||"",e.amount||0])),
    ];
    const blob = new Blob([BOM+rows.map(r=>r.join(",")).join("\n")],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download="DoiSoatCa_"+date+".csv"; a.click();
  }

  const inputStyle = { flex:1, border:"1.5px solid #e5e7eb", borderRadius:8, padding:"8px 10px", fontSize:14, outline:"none", textAlign:"right", minWidth:0, boxSizing:"border-box" };
  const labelStyle = { fontSize:11, color:"#9ca3af", marginBottom:3 };

  return (
    <div style={{ padding:"10px 14px 100px" }}>
      <div style={{ marginBottom:12 }}>
        <div style={{ fontWeight:800, fontSize:17, marginBottom:6, display:"flex", alignItems:"center", gap:8 }}>
          <span className="material-icons" style={{fontSize:20,fontFamily:"Material Icons"}}>balance</span>
          Đối soát ca
          {isLocked && <span style={{fontSize:11,background:"#059669",color:"#fff",padding:"2px 8px",borderRadius:20,fontWeight:700}}>Đã chốt</span>}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} disabled={isLocked}
            style={{ flex:1, border:"1.5px solid #e5e7eb", borderRadius:8, padding:"6px 10px", fontSize:13, minWidth:0, boxSizing:"border-box" }}/>
          <button onClick={exportCSV} style={{ background:"#4f46e5", color:"#fff", border:"none", borderRadius:8, padding:"7px 12px", fontSize:13, cursor:"pointer", whiteSpace:"nowrap" }}>
            <span className="material-icons" style={{fontSize:16,fontFamily:"Material Icons",verticalAlign:"middle"}}>download</span> CSV
          </button>
        </div>
      </div>

      {loading && <div style={{textAlign:"center",padding:40,color:"#9ca3af"}}>Đang tải...</div>}

      {data && !loading && (<>
        {/* 4 thẻ tổng quan */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
          {[
            {label:"Doanh thu", value:fmt(data.totalRev), color:"#4f46e5", bg:"#eef2ff"},
            {label:"Chi phí",   value:fmt(data.totalExp), color:"#dc2626", bg:"#fee2e2"},
            {label:"Lợi nhuận", value:fmt(data.profit),   color:"#059669", bg:"#f0fdf4"},
            {label:"Tổng TM hệ thống", value:fmt(data.sysCash), color:"#d97706", bg:"#fffbeb"},
          ].map(c=>(
            <div key={c.label} style={{background:c.bg,borderRadius:12,padding:12}}>
              <div style={{fontSize:12,color:c.color,fontWeight:700}}>{c.label}</div>
              <div style={{fontSize:18,fontWeight:900,color:c.color}}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Phân loại thanh toán */}
        <div style={{background:"#fff",borderRadius:12,padding:14,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>
            <span className="material-icons" style={{fontSize:18,fontFamily:"Material Icons",verticalAlign:"middle"}}>payments</span>
            Phân loại thanh toán
          </div>
          {[
            {label:"Sửa chữa — Tiền mặt",     v:data.repairCash},
            {label:"Sửa chữa — Chuyển khoản", v:data.repairBank},
            {label:"Bán lẻ — Tiền mặt",       v:data.saleCash},
            {label:"Bán lẻ — Chuyển khoản",   v:data.saleBank},
          ].map(r=>(
            <div key={r.label} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"5px 0",borderBottom:"1px solid #f3f4f6"}}>
              <span style={{color:"#6b7280"}}>{r.label}</span>
              <span style={{fontWeight:700}}>{fmt(r.v)}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:14,padding:"8px 0 0",fontWeight:800,color:"#4f46e5"}}>
            <span>Tổng tiền mặt (HT)</span><span>{fmt(data.sysCash)}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:14,padding:"4px 0 0",fontWeight:800,color:"#0369a1"}}>
            <span>Tổng chuyển khoản (HT)</span><span>{fmt(data.sysBank)}</span>
          </div>
        </div>

        {/* NHẬP TIỀN THỰC TẾ — Thu ngân nhập */}
        <div style={{background:"#fff",borderRadius:12,padding:14,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,.06)", border: isLocked ? "2px solid #059669" : "1.5px solid #e5e7eb"}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
            <span className="material-icons" style={{fontSize:18,fontFamily:"Material Icons"}}>point_of_sale</span>
            Kiểm đếm thực tế
            {isLocked && <span style={{fontSize:11,color:"#059669",fontWeight:700}}>🔒 Đã chốt</span>}
          </div>

          {/* Tiền mặt thực */}
          <div style={{marginBottom:12}}>
            <div style={labelStyle}>Tiền mặt thực đếm</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input type="text" inputMode="numeric" placeholder="0" value={actualCash ? actualCash.toLocaleString("vi-VN") : ""}
                onChange={e=>setActualCash(e.target.value)} disabled={isLocked}
                style={{...inputStyle, borderColor: cashDiff!==0 && actualCash!=="" ? "#f59e0b" : inputStyle.borderColor }}/>
            </div>
            {data && actualCash !== "" && (
              <div style={{fontSize:12,marginTop:4,color:cashDiff===0?"#059669":"#f59e0b",fontWeight:600}}>
                {cashDiff===0 ? "Khớp" : (cashDiff>0 ? `Thừa ${fmt(cashDiff)}` : `Thiếu ${fmt(Math.abs(cashDiff))}`)}
              </div>
            )}
          </div>

          {/* Tiền CK thực */}
          <div style={{marginBottom:12}}>
            <div style={labelStyle}>Chuyển khoản thực tế</div>
            <input type="text" inputMode="numeric" placeholder="0" value={actualBank ? actualBank.toLocaleString("vi-VN") : ""}
              onChange={e=>setActualBank(e.target.value)} disabled={isLocked}
              style={{...inputStyle, borderColor: bankDiff!==0 && actualBank!=="" ? "#f59e0b" : inputStyle.borderColor }}/>
            {data && actualBank !== "" && (
              <div style={{fontSize:12,marginTop:4,color:bankDiff===0?"#059669":"#f59e0b",fontWeight:600}}>
                {bankDiff===0 ? "Khớp" : (bankDiff>0 ? `Thừa ${fmt(bankDiff)}` : `Thiếu ${fmt(Math.abs(bankDiff))}`)}
              </div>
            )}
          </div>

          {/* Nút lưu/xác nhận */}
          {!isLocked && (
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>saveReconcile("draft")} disabled={saving}
                style={{flex:1,background:"#f3f4f6",border:"1.5px solid #e5e7eb",borderRadius:8,padding:"10px",fontSize:13,cursor:"pointer",fontWeight:600}}>
                Lưu nháp
              </button>
              {isManager && (
                <button onClick={()=>saveReconcile("confirmed")} disabled={saving}
                  style={{flex:1,background:"#059669",border:"none",borderRadius:8,padding:"10px",fontSize:13,cursor:"pointer",fontWeight:700,color:"#fff"}}>
                  Xác nhận & chốt ca
                </button>
              )}
            </div>
          )}
          {!isManager && !isLocked && (
            <div style={{fontSize:11,color:"#9ca3af",marginTop:8,textAlign:"center"}}>Chỉ quản lý mới có quyền chốt ca</div>
          )}
        </div>

        {/* Sổ quỹ tiền mặt */}
        <div style={{background:"#fff",borderRadius:12,padding:14,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>
            <span className="material-icons" style={{fontSize:18,fontFamily:"Material Icons",verticalAlign:"middle"}}>account_balance_wallet</span>
            Sổ quỹ tiền mặt
          </div>
          {[
            {label:"Thu tiền mặt",  v:data.cashIn,  color:"#059669"},
            {label:"Chi tiền mặt",  v:data.cashOut, color:"#dc2626"},
          ].map(r=>(
            <div key={r.label} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"5px 0",borderBottom:"1px solid #f3f4f6"}}>
              <span style={{color:"#6b7280"}}>{r.label}</span>
              <span style={{fontWeight:700,color:r.color}}>{fmt(r.v)}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:14,padding:"8px 0 0",fontWeight:800,color:data.cashNet>=0?"#059669":"#dc2626"}}>
            <span>Chênh lệch quỹ</span>
            <span>{data.cashNet>=0?"+":""}{fmt(data.cashNet)}</span>
          </div>
        </div>

        {/* Đơn sửa */}
        <div style={{background:"#fff",borderRadius:12,padding:14,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>
            <span className="material-icons" style={{fontSize:18,fontFamily:"Material Icons",verticalAlign:"middle"}}>build</span>
            Đơn sửa ({data.doneRepairs.length})
          </div>
          {data.doneRepairs.length===0 && <div style={{color:"#9ca3af",fontSize:13}}>Chưa có đơn nào</div>}
          {data.doneRepairs.map(o=>(
            <div key={o.id} style={{padding:"8px 0",borderBottom:"1px solid #f3f4f6"}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontWeight:700,fontSize:13}}>{o.order_code||o.id}</span>
                <span style={{fontWeight:700,color:"#059669"}}>{fmt(o.final_cost)}</span>
              </div>
              <div style={{fontSize:12,color:"#6b7280"}}>{o.customer_name} · {o.device_model}</div>
              <div style={{fontSize:11,color:"#9ca3af"}}>{o.payment_method||"Tiền mặt"}</div>
            </div>
          ))}
        </div>

        {/* Bán lẻ */}
        <div style={{background:"#fff",borderRadius:12,padding:14,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>
            <span className="material-icons" style={{fontSize:18,fontFamily:"Material Icons",verticalAlign:"middle"}}>shopping_bag</span>
            Bán lẻ ({data.paidSales.length})
          </div>
          {data.paidSales.length===0 && <div style={{color:"#9ca3af",fontSize:13}}>Chưa có đơn nào</div>}
          {data.paidSales.map(o=>(
            <div key={o.id} style={{padding:"8px 0",borderBottom:"1px solid #f3f4f6"}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontWeight:700,fontSize:13}}>{o.order_code||o.id}</span>
                <span style={{fontWeight:700,color:"#059669"}}>{fmt(o.total)}</span>
              </div>
              <div style={{fontSize:11,color:"#9ca3af"}}>{o.payment_method||"Tiền mặt"}{o.seller_name?" · "+o.seller_name:""}</div>
            </div>
          ))}
        </div>

        {/* Thông tin chốt ca */}
        {reconcileRecord && reconcileRecord.confirmed_by_name && (
          <div style={{marginTop:12,padding:10,background:"#f0fdf4",borderRadius:8,fontSize:12,color:"#059669",textAlign:"center"}}>
            Ca đã chốt bởi {reconcileRecord.confirmed_by_name}
            {reconcileRecord.confirmed_at ? " · "+new Date(reconcileRecord.confirmed_at).toLocaleString("vi-VN") : ""}
          </div>
        )}
      </>)}
    </div>
  );
}


export default function CashierApp({ user, onNotif, onQRScan, notifCount=0, forceTab="", onTabChange }) {
  const defaultTab = ["cashier","accountant"].includes(user?.role) ? "confirm" : "sale";
  const [tab, setTab] = useState(defaultTab);
  const [SaleOrderPage, setSaleOrderPage]             = useState(null);
  const [CashierConfirmPage, setCashierConfirmPage]   = useState(null);
  const [SaleHistoryPage, setSaleHistoryPage]         = useState(null);

  // NAV_TABS dynamic theo role
  const NAV_TABS = React.useMemo(() => {
    const tabs = [];
    if(["sales","team_leader","manager","admin","owner"].includes(user?.role)){
      tabs.push({ key:"sale",    label:"Bán hàng",  icon:"storefront" });
    }
    tabs.push({ key:"history", label:"Đơn hàng",  icon:"receipt_long" });
    if(["cashier","accountant","manager","admin","owner"].includes(user?.role)){
      tabs.push({ key:"confirm", label:"Thu tiền",  icon:"payments" });
    }
    tabs.push({ key:"shift", label:"Đối soát", icon:"balance" });
    return tabs;
  }, [user?.role]);

  // forceTab từ MainApp (MyTasksPage "Chờ thu" → "confirm")
  useEffect(() => {
    if(forceTab && NAV_TABS.some(t => t.key === forceTab)) {
      setTab(forceTab);
    }
    if(onTabChange) onTabChange("");  // reset để lần sau vẫn trigger
  }, [forceTab, NAV_TABS]);

  useEffect(() => {
    import("./SaleOrderPage.jsx").then(m => setSaleOrderPage(() => m.default)).catch(()=>{});
    import("./CashierConfirmPage.jsx").then(m => setCashierConfirmPage(() => m.default)).catch(()=>{});
    import("./SaleHistoryPage.jsx").then(m => setSaleHistoryPage(() => m.default)).catch(()=>{});
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

  const Fallback = () => (
    <div style={{ textAlign:"center", padding:48, color:"#9ca3af" }}>⏳ Đang tải...</div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f9fafb" }}>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#059669,#047857)", color:"#fff",
        padding:"14px 24px 12px", display:"flex", alignItems:"center",
        justifyContent:"space-between" }}>
        <div>
          <div style={{ fontWeight:900, fontSize:17 }}>🏪 Thu ngân (POS)</div>
          <div style={{ fontSize:12, opacity:0.85, marginTop:2 }}>
            {user.full_name || user.name} · {todayStr()}
          </div>
        </div>
        {/* Utility buttons — góc phải header */}
        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
          {onQRScan && (
            <button onClick={onQRScan}
              style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:10,
                color:"#fff", width:38, height:38, display:"flex", alignItems:"center",
                justifyContent:"center", cursor:"pointer" }}>
              <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22,lineHeight:1}}>qr_code_scanner</span>
            </button>
          )}
          {onNotif && (
            <button onClick={onNotif}
              style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:10,
                color:"#fff", width:38, height:38, display:"flex", alignItems:"center",
                justifyContent:"center", cursor:"pointer", position:"relative" }}>
              <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22,lineHeight:1}}>notifications</span>
              {notifCount > 0 && (
                <span style={{ position:"absolute", top:4, right:4, background:"#ef4444",
                  color:"#fff", borderRadius:"50%", width:15, height:15, fontSize:9,
                  display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800 }}>
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Windows-style tabs — icon trên, chữ dưới, chia đều, dính nội dung */}
      <div style={{
        display:"flex", background:"#f0fdf4",
        borderBottom:"none", padding:"8px 8px 0", gap:4,
      }}>
        {NAV_TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                flex:1, display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center",
                gap:2, padding:"7px 4px 8px", cursor:"pointer",
                border: active ? "1.5px solid #d1fae5" : "1.5px solid transparent",
                borderBottom: active ? "2px solid #fff" : "1.5px solid #d1fae5",
                borderRadius:"10px 10px 0 0",
                background: active ? "#fff" : "transparent",
                color: active ? "#059669" : "#6b7280",
                fontWeight: active ? 800 : 500,
                fontSize:11, lineHeight:1.2,
                transition:"all .15s",
                marginBottom: active ? "-1px" : 0,
                zIndex: active ? 2 : 1, position:"relative",
              }}>
              <span className="material-icons" style={{
                fontSize:20, lineHeight:1, fontFamily:"Material Icons",
                color: active ? "#059669" : "#9ca3af",
              }}>{t.icon}</span>
              <span style={{ whiteSpace:"nowrap", fontSize:11 }}>{t.label}</span>
            </button>
          );
        })}
      </div>
      {/* Đường viền nối tab với nội dung */}
      <div style={{ height:1, background:"#d1fae5", position:"relative", zIndex:1 }} />

      {/* Nội dung tab */}
      <div style={{ maxWidth: tab==="shift" ? 900 : "100%", margin:"0 auto", padding: (tab==="sale") ? 0 : "20px 24px 60px" }}>
        {tab === "sale"    && (SaleOrderPage     ? <SaleOrderPage user={user} />     : <Fallback />)}
        {tab === "history" && (SaleHistoryPage    ? <SaleHistoryPage user={user} />     : <Fallback />)}
        {tab === "confirm" && (CashierConfirmPage ? <CashierConfirmPage user={user} /> : <Fallback />)}
        {tab === "shift"   && <ShiftReconcilePage user={user} />}
      </div>

    </div>
  );
}