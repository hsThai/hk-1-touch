// CashierConfirmPage.jsx — Trang xác nhận thu tiền cho Thu ngân
// HK One Touch
import React, { useState, useEffect } from "react";
import { SaleOrder, SaleOrderItem, CashJournal, DebtVoucher } from "./pb.jsx";
import { printSaleReceiptA5 } from "../utils/printClient.js";

const PM_COLORS = { cash:"#059669", transfer:"#0369a1", combined:"#7c3aed", credit:"#dc2626" };
const PM_LABELS = { cash:"💵 Tiền mặt", transfer:"🏦 Chuyển khoản", combined:"🔀 Kết hợp", credit:"💳 Ghi nợ" };

function fmtMoney(n){ return (n||0).toLocaleString("vi-VN")+"đ"; }
function fmtTime(s){
  if(!s) return "";
  const d=new Date(s);
  return d.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})+" "+d.toLocaleDateString("vi-VN");
}

export default function CashierConfirmPage({ user }) {
  const [tab,setTab]               = useState("pending");
  const [orders,setOrders]         = useState([]);
  const [items,setItems]           = useState({});
  const [confirming,setConfirming] = useState(null);
  const [payMethod,setPayMethod]   = useState("");
  const [loading,setLoading]       = useState(false);
  const [submitting,setSubmitting] = useState(false);

  useEffect(()=>{
    loadOrders();
    const t=setInterval(loadOrders,30000);
    return ()=>clearInterval(t);
  },[]);

  async function loadOrders(){
    setLoading(true);
    try{
      const [all, journals] = await Promise.all([
        SaleOrder.list({limit:200,sort:"-id"}),
        CashJournal.list({limit:500,sort:"-id",filter:`(journal_date="${getLocalDate()}")&&(ref_type="sale_order")`}),
      ]);
      setOrders(all||[]);
      // Lưu tập ref_id đã thu hôm nay theo journal (chính xác hơn dùng created_date)
      const todayPaidIds = new Set((journals||[]).map(j=>j.ref_id).filter(Boolean));
      setTodayPaidIds(todayPaidIds);
    }catch(e){console.warn("load orders:",e.message);}
    setLoading(false);
  }

  async function loadItems(orderId){
    if(items[orderId]) return;
    try{
      const its=await SaleOrderItem.list({limit:50,filter:`sale_order_id="${orderId}"`,sort:"-id"});
      setItems(prev=>({...prev,[orderId]:its||[]}));
    }catch{}
  }

  const today=getLocalDate();
  const pending  =orders.filter(o=>o.status==="pending_payment");
  // Dùng journal entries làm nguồn truth — chính xác hơn created_date (đơn cũ có thể thiếu field này)
  const doneToday = orders.filter(o => o.status === "completed" && todayPaidIds.has(o.id));

  function openConfirm(order){
    setConfirming(order);
    setPayMethod(order.payment_method||"cash");
    loadItems(order.id);
  }

  async function handleConfirm(){
    if(!confirming||!payMethod) return;
    setSubmitting(true);
    try{
      await SaleOrder.update(confirming.id,{
        status:"completed",
        cashier_id:   user.id||"",
        cashier_name: user.full_name||user.name||"",
        payment_method: payMethod,
      });
      if(payMethod==="credit"){
        await DebtVoucher.create({
          voucher_code:"PT-BL-"+String(Date.now()).slice(-6),
          voucher_type:"receivable",party_type:"customer",
          party_name:confirming.customer_name||"Khách lẻ",
          origin_type:"sale_order",origin_id:confirming.id,origin_code:confirming.order_code,
          total_amount:confirming.total,paid_amount:0,remaining:confirming.total,status:"open",
          created_by_id:user.id,created_by_name:user.full_name||user.name||"",
        });
      } else {
        await CashJournal.create({
          journal_date:today,entry_type:"receipt",amount:confirming.total,
          ref_type:"sale_order",ref_id:confirming.id,ref_code:confirming.order_code,
          description:"Bán lẻ: "+(confirming.customer_name||"Khách lẻ"),
          payment_method:payMethod,
          created_by_id:user.id,created_by_name:user.full_name||user.name||"",
        });
      }
      try{
        const orderItems = items[confirming.id] || [];
        await printSaleReceiptA5({...confirming,payment_method:payMethod,cashier_name:user.full_name||user.name||"",items:orderItems});
      }catch{}
      setConfirming(null);
      loadOrders();
    }catch(e){alert("Lỗi xác nhận: "+(e.message||JSON.stringify(e)));}
    setSubmitting(false);
  }

  const list=tab==="pending"?pending:doneToday;

  const CONFIRM_TABS = [
    { key:"pending", icon:"pending_actions", label:`Chờ xác nhận (${pending.length})` },
    { key:"done",    icon:"check_circle",     label:`Đã thu hôm nay (${doneToday.length})` },
  ];

  return (
    <div style={{paddingBottom:20}}>
      {/* Windows-style tabs */}
      <div style={{display:"flex",background:"#f0fdf4",padding:"8px 8px 0",gap:4}}>
        {CONFIRM_TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={()=>setTab(t.key)} style={{
              flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2,
              padding:"7px 4px 8px", cursor:"pointer",
              border: active ? "1.5px solid #d1fae5" : "1.5px solid transparent",
              borderBottom: active ? "2px solid #fff" : "1.5px solid #d1fae5",
              borderRadius:"10px 10px 0 0",
              background: active ? "#fff" : "transparent",
              color: active ? "#059669" : "#6b7280",
              fontWeight: active ? 800 : 500, fontSize:11, lineHeight:1.2,
              marginBottom: active ? "-1px" : 0, zIndex: active ? 2 : 1, position:"relative",
            }}>
              <span className="material-icons" style={{fontSize:20,lineHeight:1,fontFamily:"Material Icons",color:active?"#059669":"#9ca3af"}}>{t.icon}</span>
              <span style={{whiteSpace:"nowrap",fontSize:11}}>{t.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{height:1,background:"#d1fae5",position:"relative",zIndex:1}} />
      {/* Toolbar */}
      <div style={{display:"flex",justifyContent:"flex-end",padding:"8px 16px"}}>
        <button onClick={loadOrders} style={{background:"none",border:"1.5px solid #d1d5db",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,color:"#6b7280",cursor:"pointer"}}>
          <span className="material-icons" style={{fontSize:13,verticalAlign:"-2px",marginRight:3}}>refresh</span>Làm mới
        </button>
      </div>

      <div style={{padding:"12px 16px"}}>
        {loading&&<div style={{textAlign:"center",color:"#9ca3af",padding:24}}>⏳ Đang tải...</div>}
        {!loading&&list.length===0&&(
          <div style={{textAlign:"center",padding:"40px 20px",color:"#9ca3af"}}>
            <div style={{fontSize:40,marginBottom:12}}>{tab==="pending"?"📭":"✅"}</div>
            <div style={{fontWeight:700,fontSize:15,color:"#6b7280"}}>
              {tab==="pending"?"Không có đơn chờ xác nhận":"Chưa thu đơn nào hôm nay"}
            </div>
          </div>
        )}
        {list.map(o=>{
          const isPending=o.status==="pending_payment";
          const its=items[o.id]||[];
          return(
            <div key={o.id} style={{background:"#fff",borderRadius:16,border:"1.5px solid #e5e7eb",marginBottom:12,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
              {/* Card header */}
              <div style={{padding:"14px 16px",borderBottom:"1px solid #f3f4f6",display:"flex",justifyContent:"space-between",alignItems:"flex-start",cursor:isPending?"pointer":"default"}}
                onClick={()=>isPending&&loadItems(o.id)}>
                <div>
                  <div style={{fontWeight:900,fontSize:15,color:"#1e1b4b",marginBottom:3}}>{o.order_code}</div>
                  <div style={{fontSize:13,color:"#374151",marginBottom:2}}>👤 {o.customer_name||"Khách lẻ"}{o.customer_phone?" · "+o.customer_phone:""}</div>
                  <div style={{fontSize:12,color:"#9ca3af"}}>🕐 {fmtTime(o.created || o.created_date || "")}{o.seller_name?" · NV: "+o.seller_name:""}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:900,fontSize:20,color:"#059669"}}>{fmtMoney(o.total)}</div>
                  <div style={{marginTop:4}}>
                    {isPending
                      ?<span style={{background:"#fef3c7",color:"#92400e",fontWeight:800,fontSize:11,padding:"3px 10px",borderRadius:20}}>⏳ Chờ xác nhận</span>
                      :<span style={{background:"#d1fae5",color:"#065f46",fontWeight:800,fontSize:11,padding:"3px 10px",borderRadius:20}}>✅ Đã thu</span>}
                  </div>
                </div>
              </div>
              {/* HTTT */}
              <div style={{padding:"8px 16px",background:"#f9fafb",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:13,color:"#6b7280"}}>{PM_LABELS[o.payment_method]||o.payment_method||"—"}</span>
                {o.discount>0&&<span style={{fontSize:12,color:"#dc2626"}}>Giảm: -{fmtMoney(o.discount)}</span>}
              </div>
              {/* Items */}
              {its.length>0&&(
                <div style={{padding:"8px 16px 4px"}}>
                  {its.map((it,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#374151",padding:"4px 0",borderBottom:i<its.length-1?"1px solid #f3f4f6":"none"}}>
                      <span>{it.part_name} × {it.qty}</span>
                      <span style={{fontWeight:700}}>{fmtMoney(it.total_price)}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Nút xác nhận */}
              {isPending&&(
                <div style={{padding:"10px 16px 14px"}}>
                  <button onClick={()=>openConfirm(o)} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#059669,#047857)",color:"#fff",fontWeight:900,fontSize:15,cursor:"pointer",boxShadow:"0 4px 12px rgba(5,150,105,.3)"}}>
                    ✅ Xác nhận Thu tiền
                  </button>
                </div>
              )}
              {!isPending&&o.cashier_name&&(
                <div style={{padding:"6px 16px 12px",fontSize:12,color:"#9ca3af"}}>Thu bởi: 👤 {o.cashier_name}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal xác nhận */}
      {confirming&&(
        <div style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
          onClick={e=>e.target===e.currentTarget&&setConfirming(null)}>
          <div style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,padding:"20px 20px 32px",maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontWeight:900,fontSize:18,color:"#1e1b4b",marginBottom:16,textAlign:"center"}}>💰 Xác nhận Thu tiền</div>
            {/* Tóm tắt */}
            <div style={{background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:14,padding:"14px 16px",marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{color:"#6b7280",fontSize:13}}>Mã đơn</span>
                <span style={{fontWeight:700}}>{confirming.order_code}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{color:"#6b7280",fontSize:13}}>Khách hàng</span>
                <span style={{fontWeight:700}}>{confirming.customer_name||"Khách lẻ"}</span>
              </div>
              {(items[confirming.id]||[]).map((it,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#374151",padding:"3px 0"}}>
                  <span>{it.part_name} × {it.qty}</span>
                  <span style={{fontWeight:600}}>{fmtMoney(it.total_price)}</span>
                </div>
              ))}
              {confirming.discount>0&&(
                <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                  <span style={{color:"#dc2626",fontSize:13}}>Giảm giá</span>
                  <span style={{color:"#dc2626",fontWeight:700}}>-{fmtMoney(confirming.discount)}</span>
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,marginTop:6,borderTop:"1.5px solid #86efac"}}>
                <span style={{fontWeight:800,fontSize:15}}>Tổng thu</span>
                <span style={{fontWeight:900,fontSize:22,color:"#059669"}}>{fmtMoney(confirming.total)}</span>
              </div>
            </div>
            {/* HTTT */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:8}}>Hình thức thanh toán</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {Object.entries(PM_LABELS).map(([key,label])=>(
                  <button key={key} onClick={()=>setPayMethod(key)} style={{
                    padding:"10px 8px",borderRadius:10,
                    border:`2px solid ${payMethod===key?PM_COLORS[key]:"#e5e7eb"}`,
                    background:payMethod===key?PM_COLORS[key]:"#fff",
                    color:payMethod===key?"#fff":"#374151",
                    fontWeight:800,fontSize:13,cursor:"pointer",transition:"all .15s",
                  }}>{label}</button>
                ))}
              </div>
            </div>
            {/* Buttons */}
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirming(null)} style={{flex:1,padding:"13px",borderRadius:12,border:"1.5px solid #e5e7eb",background:"#fff",color:"#6b7280",fontWeight:700,fontSize:14,cursor:"pointer"}}>
                Huỷ
              </button>
              <button onClick={handleConfirm} disabled={submitting} style={{
                flex:2,padding:"13px",borderRadius:12,border:"none",
                background:submitting?"#e5e7eb":"linear-gradient(135deg,#059669,#047857)",
                color:submitting?"#9ca3af":"#fff",fontWeight:900,fontSize:15,
                cursor:submitting?"not-allowed":"pointer",
                boxShadow:submitting?"none":"0 4px 14px rgba(5,150,105,.35)",
              }}>
                {submitting?"Đang xử lý...":"✅ Xác nhận Thu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}