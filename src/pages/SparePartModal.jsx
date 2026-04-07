/* REBUILD_20260406_1408 */
/* v3-export-request-flow — fixed JSX */
import React, { useState, useEffect, useRef } from "react";
import { SparePart, SparePartUsage, RepairChat, RepairOrder, Notification, Staff, StockExportRequest } from "./pb.jsx";
import { syncKvProducts, createKvDeliveryOrder } from "./kiotviet.jsx";

function genCode() {
  const n = new Date();
  return `PX${n.getFullYear().toString().slice(2)}${String(n.getMonth()+1).padStart(2,"0")}${String(n.getDate()).padStart(2,"0")}-${Math.floor(Math.random()*9000+1000)}`;
}
function fmtMoney(n) { return (n||0).toLocaleString("vi-VN")+"đ"; }
function fmtDt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")} ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
}
function minsLeft(iso) {
  if (!iso) return null;
  return Math.floor((new Date(iso)-Date.now())/60000);
}

const ST = {
  pending:             {label:"⏳ Chờ kho xử lý", color:"#d97706", bg:"#fffbeb"},
  warehouse_confirmed: {label:"📦 Kho đã xuất",   color:"#2563eb", bg:"#eff6ff"},
  ktv_confirmed:       {label:"✅ KTV đã nhận",    color:"#059669", bg:"#f0fdf4"},
  returned:            {label:"↩ Đã trả",          color:"#6b7280", bg:"#f9fafb"},
  expired:             {label:"⌛ Hết hạn",        color:"#dc2626", bg:"#fff1f2"},
  cancelled:           {label:"✖ Đã hủy",          color:"#9ca3af", bg:"#f3f4f6"},
};

function RI({l,v,bold}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,gap:8}}>
      <span style={{color:"#6b7280",flexShrink:0}}>{l}</span>
      <span style={{fontWeight:bold?800:600,color:"#111",textAlign:"right"}}>{v}</span>
    </div>
  );
}

function CBlock({title,by,at,note,media}) {
  return (
    <div style={{background:"#f0fdf4",borderRadius:12,border:"1.5px solid #6ee7b7",padding:"10px 12px",marginTop:10,fontSize:13}}>
      <div style={{fontWeight:800,color:"#065f46",marginBottom:6}}>{title}</div>
      <RI l="Người XN" v={by}/>
      <RI l="Thời gian" v={fmtDt(at)}/>
      {note && <RI l="Ghi chú" v={note}/>}
      {media && media.split(",").filter(Boolean).length>0 && (
        <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
          {media.split(",").filter(Boolean).map((url,i)=>(
            <a key={i} href={url} target="_blank" rel="noreferrer">
              <img src={url} style={{width:56,height:56,borderRadius:8,objectFit:"cover"}} alt=""/>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TAB: Chọn linh kiện ───────────────────────────────────
function TabList({parts, cartItems, search, setSearch, addToCart, removeFromCart}) {
  return (
    <div>
      <div style={{padding:"12px 14px 8px",position:"sticky",top:0,background:"#fff",zIndex:1}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Tìm tên hoặc SKU..."
          style={{width:"100%",height:40,borderRadius:12,border:"1.5px solid #e5e7eb",padding:"0 14px",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
        {parts.length===0 && (
          <div style={{marginTop:8,background:"#fffbeb",borderRadius:10,padding:"8px 12px",fontSize:13,color:"#92400e",fontWeight:600}}>
            Chưa có LK. Nhấn KiotViet để đồng bộ.
          </div>
        )}
      </div>
      {parts.map(part=>{
        const inCart = cartItems.find(c=>c.part_id===part.id);
        return (
          <div key={part.id} style={{margin:"0 12px 8px",background:inCart?"#f0fdf4":"#fff",borderRadius:14,padding:"10px 12px",border:`1.5px solid ${inCart?"#6ee7b7":"#e5e7eb"}`,display:"flex",alignItems:"center",gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{part.name}</div>
              <div style={{fontSize:12,color:"#6b7280",marginTop:2,display:"flex",gap:8,flexWrap:"wrap"}}>
                {part.sku && <span>SKU: {part.sku}</span>}
                <span style={{color:(part.stock_qty||0)>0?"#059669":"#dc2626",fontWeight:700}}>Tồn: {part.stock_qty||0} {part.unit||"cái"}</span>
              </div>
              <div style={{fontSize:13,fontWeight:800,color:"#4f46e5",marginTop:2}}>{fmtMoney(part.price)}</div>
            </div>
            {inCart ? (
              <button onClick={()=>removeFromCart(part.id)}
                style={{height:36,padding:"0 10px",borderRadius:10,border:"1.5px solid #fca5a5",background:"#fff1f2",color:"#dc2626",fontWeight:800,fontSize:12,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",gap:4}}>
                <span className="material-icons" style={{fontSize:14}}>remove_circle</span>Bỏ
              </button>
            ) : (
              <button onClick={()=>addToCart(part)}
                style={{height:36,padding:"0 12px",borderRadius:10,border:"none",background:"#4f46e5",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",gap:4}}>
                <span className="material-icons" style={{fontSize:16}}>add</span>Thêm
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── TAB: Giỏ hàng ────────────────────────────────────────
function TabCart({cartItems, updateCartQty, removeFromCart, order, showForm, setShowForm, exportType, setExportType, dueMinutes, setDueMinutes, returnDays, setReturnDays, reqNote, setReqNote, submitting, handleSubmitRequest}) {
  const cartTotal = cartItems.reduce((s,c)=>s+c.total_price,0);
  if (cartItems.length===0) {
    return (
      <div style={{padding:"12px 14px"}}>
        <div style={{textAlign:"center",padding:"40px 20px",color:"#9ca3af"}}>
          <span className="material-icons" style={{fontSize:48,display:"block",marginBottom:8}}>shopping_cart</span>
          Giỏ trống — chọn LK từ tab bên trái
        </div>
      </div>
    );
  }
  return (
    <div style={{padding:"12px 14px"}}>
      {cartItems.map(c=>(
        <div key={c.part_id} style={{background:"#f9fafb",borderRadius:14,padding:"10px 12px",marginBottom:8,border:"1.5px solid #e5e7eb",display:"flex",alignItems:"center",gap:8}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.part_name}</div>
            {c.sku && <div style={{fontSize:12,color:"#6b7280"}}>SKU: {c.sku}</div>}
            <div style={{fontSize:13,fontWeight:800,color:"#4f46e5",marginTop:2}}>{fmtMoney(c.total_price)}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            <button onClick={()=>updateCartQty(c.part_id,c.qty-1)} style={{width:30,height:30,borderRadius:8,border:"1.5px solid #e5e7eb",background:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}}>−</button>
            <span style={{fontWeight:800,fontSize:15,minWidth:22,textAlign:"center"}}>{c.qty}</span>
            <button onClick={()=>updateCartQty(c.part_id,c.qty+1)} style={{width:30,height:30,borderRadius:8,border:"1.5px solid #e5e7eb",background:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}}>+</button>
            <button onClick={()=>removeFromCart(c.part_id)} style={{width:30,height:30,borderRadius:8,border:"none",background:"#fff1f2",color:"#dc2626",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span className="material-icons" style={{fontSize:16}}>delete</span>
            </button>
          </div>
        </div>
      ))}

      <div style={{background:"#eef2ff",borderRadius:14,padding:12,marginBottom:12,border:"1.5px solid #c7d2fe",display:"flex",justifyContent:"space-between",fontSize:14}}>
        <span style={{color:"#6b7280"}}>Linh kiện ({cartItems.length} loại)</span>
        <span style={{fontWeight:800,color:"#4f46e5"}}>{fmtMoney(cartTotal)}</span>
      </div>

      {!showForm ? (
        <button onClick={()=>setShowForm(true)}
          style={{width:"100%",height:48,borderRadius:14,border:"none",background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#fff",fontWeight:900,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span className="material-icons" style={{fontSize:20}}>send</span>
          Tạo đề nghị xuất kho
        </button>
      ) : (
        <div style={{background:"#fff",borderRadius:16,border:"1.5px solid #c7d2fe",padding:16}}>
          <div style={{fontWeight:800,fontSize:15,color:"#1e1b4b",marginBottom:12}}>📋 Tùy chọn phiếu xuất</div>

          <div style={{marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:6}}>Loại xuất</div>
            <div style={{display:"flex",gap:8}}>
              {[{v:"repair",l:"🔧 Xuất sửa"},{v:"borrow",l:"🔄 Xuất mượn"}].map(opt=>(
                <button key={opt.v} onClick={()=>setExportType(opt.v)}
                  style={{flex:1,padding:"10px 8px",borderRadius:12,border:`2px solid ${exportType===opt.v?"#4f46e5":"#e5e7eb"}`,background:exportType===opt.v?"#eef2ff":"#fff",fontWeight:700,fontSize:13,cursor:"pointer",color:exportType===opt.v?"#4f46e5":"#374151"}}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:6}}>⏰ Hạn kho xuất</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[15,30,60,120,240].map(m=>(
                <button key={m} onClick={()=>setDueMinutes(m)}
                  style={{padding:"6px 12px",borderRadius:10,border:`1.5px solid ${dueMinutes===m?"#4f46e5":"#e5e7eb"}`,background:dueMinutes===m?"#4f46e5":"#fff",color:dueMinutes===m?"#fff":"#374151",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                  {m<60?`${m}p`:`${m/60}h`}
                </button>
              ))}
            </div>
            <div style={{fontSize:12,color:"#6b7280",marginTop:6}}>
              Hạn: <b>{fmtDt(new Date(Date.now()+dueMinutes*60000).toISOString())}</b> · Kho nhận nhắc khi còn 15p
            </div>
          </div>

          {exportType==="borrow" && (
            <div style={{marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:6}}>📅 Hạn trả</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[1,2,3,5,7].map(d=>(
                  <button key={d} onClick={()=>setReturnDays(d)}
                    style={{padding:"6px 12px",borderRadius:10,border:`1.5px solid ${returnDays===d?"#7c3aed":"#e5e7eb"}`,background:returnDays===d?"#7c3aed":"#fff",color:returnDays===d?"#fff":"#374151",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                    {d} ngày
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea value={reqNote} onChange={e=>setReqNote(e.target.value)}
            placeholder="Ghi chú cho NV kho (tuỳ chọn)..."
            style={{width:"100%",minHeight:56,borderRadius:10,border:"1.5px solid #e5e7eb",padding:"8px 12px",fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box",marginBottom:12}}/>

          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowForm(false)}
              style={{flex:1,height:44,borderRadius:12,border:"1.5px solid #e5e7eb",background:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",color:"#6b7280"}}>Hủy</button>
            <button onClick={handleSubmitRequest} disabled={submitting}
              style={{flex:2,height:44,borderRadius:12,border:"none",background:"#4f46e5",color:"#fff",fontWeight:800,fontSize:14,cursor:submitting?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <span className="material-icons" style={{fontSize:18}}>send</span>
              {submitting?"Đang gửi...":"Gửi đề nghị"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: Phiếu xuất kho ──────────────────────────────────
function TabRequests({requests, setViewReq}) {
  if (requests.length===0) {
    return (
      <div style={{padding:"12px 14px"}}>
        <div style={{textAlign:"center",padding:"40px 20px",color:"#9ca3af"}}>
          <span className="material-icons" style={{fontSize:48,display:"block",marginBottom:8}}>assignment</span>
          Chưa có phiếu xuất nào
        </div>
      </div>
    );
  }
  return (
    <div style={{padding:"12px 14px"}}>
      {requests.map(req=>{
        const st = ST[req.status]||ST.pending;
        const mins = minsLeft(req.due_datetime);
        const urgent = mins!==null && mins>0 && mins<=15 && req.status==="pending";
        return (
          <div key={req.id} onClick={()=>setViewReq(req)}
            style={{background:urgent?"#fff7ed":"#f9fafb",borderRadius:14,padding:"12px 14px",marginBottom:8,border:`1.5px solid ${urgent?"#fb923c":"#e5e7eb"}`,cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:800,fontSize:14}}>{req.request_code}</div>
                <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>
                  {req.export_type==="borrow"?"🔄 Mượn":"🔧 Xuất sửa"} · {(Array.isArray(req.items)?req.items:JSON.parse(req.items||"[]")).length} LK · {fmtMoney(req.total_value)}
                </div>
                <div style={{fontSize:12,color:"#6b7280"}}>👤 {req.requested_by_name} · {fmtDt(req.created_date)}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                <div style={{background:st.bg,color:st.color,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>{st.label}</div>
                {req.status==="pending" && mins!==null && (
                  <div style={{fontSize:11,color:urgent?"#dc2626":"#6b7280",fontWeight:700,marginTop:4}}>
                    {mins>0?`⏰ còn ${mins}p`:"⌛ Hết hạn"}
                  </div>
                )}
              </div>
            </div>
            <div style={{fontSize:11,color:"#9ca3af",marginTop:6,display:"flex",alignItems:"center",gap:4}}>
              <span className="material-icons" style={{fontSize:12}}>touch_app</span>Tap để xem & xác nhận
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MODAL: Chi tiết phiếu ────────────────────────────────
function RequestDetailModal({viewReq, setViewReq, currentStaff, order, requests, setRequests, showToast}) {
  const [confirmMode, setConfirmMode] = useState(null);
  const [confirmNote, setConfirmNote] = useState("");
  const [confirmMedia, setConfirmMedia] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef(null);
  const isKho = currentStaff?.role==="Nhân viên kho";
  const isMgr = currentStaff?.role==="Quản lý";

  function close() { setViewReq(null); setConfirmMode(null); setConfirmNote(""); setConfirmMedia([]); }

  async function handleMediaUpload(e) {
    for (const file of Array.from(e.target.files)) {
      const reader = new FileReader();
      reader.onload = ev => setConfirmMedia(prev=>[...prev,{name:file.name,url:ev.target.result,type:file.type}]);
      reader.readAsDataURL(file);
    }
  }

  async function doWarehouse() {
    setConfirming(true);
    try {
      const mediaStr = confirmMedia.map(m=>m.url).join(",");
      await StockExportRequest.update(viewReq.id,{
        status:"warehouse_confirmed",
        warehouse_confirmed_by:currentStaff.id,
        warehouse_confirmed_by_name:currentStaff.full_name,
        warehouse_confirmed_at:new Date().toISOString(),
        warehouse_note:confirmNote, warehouse_media:mediaStr,
      });
      let kvCode="";
      try {
        const items=(Array.isArray(viewReq.items)?viewReq.items:JSON.parse(viewReq.items||"[]"));
        const res=await createKvDeliveryOrder({orderCode:viewReq.order_code,deviceModel:order.device_model||"?",technicianName:viewReq.requested_by_name,parts:items.map(i=>({kvProductId:i.part_id,sku:i.sku,name:i.part_name,qty:i.qty,price:i.unit_price}))});
        kvCode=res.transferCode||res.invoiceCode||"OK";
        await StockExportRequest.update(viewReq.id,{kiotviet_invoice_code:kvCode});
      } catch { kvCode="(KV lỗi)"; }
      await Notification.create({user_id:viewReq.requested_by,user_name:viewReq.requested_by_name,title:"📦 Kho đã xuất LK — Xác nhận nhận!",message:`Phiếu ${viewReq.request_code} | KV: ${kvCode}`,order_id:order.id,order_code:order.order_code||order.id,type:"export_ready",is_read:false});
      setViewReq(v=>({...v,status:"warehouse_confirmed",warehouse_confirmed_by_name:currentStaff.full_name,warehouse_confirmed_at:new Date().toISOString(),kiotviet_invoice_code:kvCode}));
      setRequests(p=>p.map(r=>r.id===viewReq.id?{...r,status:"warehouse_confirmed"}:r));
      setConfirmMode(null); setConfirmNote(""); setConfirmMedia([]);
      showToast("✅ Đã xác nhận xuất kho!");
    } catch(e){showToast(`Lỗi: ${e.message}`);}
    setConfirming(false);
  }

  async function doKtv() {
    setConfirming(true);
    try {
      const mediaStr=confirmMedia.map(m=>m.url).join(",");
      await StockExportRequest.update(viewReq.id,{status:"ktv_confirmed",ktv_confirmed_by:currentStaff.id,ktv_confirmed_by_name:currentStaff.full_name,ktv_confirmed_at:new Date().toISOString(),ktv_note:confirmNote,ktv_media:mediaStr});
      setViewReq(v=>({...v,status:"ktv_confirmed",ktv_confirmed_by_name:currentStaff.full_name,ktv_confirmed_at:new Date().toISOString()}));
      setRequests(p=>p.map(r=>r.id===viewReq.id?{...r,status:"ktv_confirmed"}:r));
      setConfirmMode(null); setConfirmNote(""); setConfirmMedia([]);
      showToast("✅ Đã xác nhận nhận linh kiện!");
    } catch(e){showToast(`Lỗi: ${e.message}`);}
    setConfirming(false);
  }

  async function doReturn() {
    setConfirming(true);
    try {
      await StockExportRequest.update(viewReq.id,{status:"returned",return_confirmed_by:currentStaff.id,return_confirmed_by_name:currentStaff.full_name,return_confirmed_at:new Date().toISOString(),return_note:confirmNote});
      setViewReq(v=>({...v,status:"returned",return_confirmed_by_name:currentStaff.full_name,return_confirmed_at:new Date().toISOString()}));
      setRequests(p=>p.map(r=>r.id===viewReq.id?{...r,status:"returned"}:r));
      setConfirmMode(null); setConfirmNote("");
      showToast("✅ Đã trả linh kiện cho kho!");
    } catch(e){showToast(`Lỗi: ${e.message}`);}
    setConfirming(false);
  }

  const st = ST[viewReq.status]||ST.pending;

  return (
    <div style={{position:"fixed",inset:0,zIndex:4000,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>{if(e.target===e.currentTarget)close();}}>
      <div style={{background:"#fff",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:600,maxHeight:"90vh",display:"flex",flexDirection:"column"}}>

        <div style={{background:"linear-gradient(135deg,#1e1b4b,#4f46e5)",padding:"16px 18px",borderRadius:"24px 24px 0 0",flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{color:"#fff",fontWeight:900,fontSize:16}}>📋 {viewReq.request_code}</div>
            <div style={{color:"#a5b4fc",fontSize:12,marginTop:2}}>{viewReq.export_type==="borrow"?"🔄 Mượn tạm":"🔧 Xuất sửa"} · {fmtDt(viewReq.created_date)}</div>
          </div>
          <button onClick={close} style={{background:"rgba(255,255,255,.2)",border:"1.5px solid rgba(255,255,255,.35)",color:"#fff",width:36,height:36,borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span className="material-icons" style={{fontSize:20}}>close</span>
          </button>
        </div>

        <div style={{overflowY:"auto",flex:1,padding:"14px 16px 24px"}}>
          <div style={{display:"inline-flex",background:st.bg,color:st.color,borderRadius:20,padding:"5px 14px",fontWeight:700,fontSize:13,marginBottom:14}}>{st.label}</div>

          <div style={{background:"#f9fafb",borderRadius:12,padding:12,marginBottom:12,fontSize:13}}>
            <RI l="Người đề nghị" v={viewReq.requested_by_name}/>
            <RI l="Hạn xuất" v={fmtDt(viewReq.due_datetime)}/>
            {viewReq.export_type==="borrow" && <RI l="Hạn trả" v={viewReq.return_due_date?fmtDt(viewReq.return_due_date):"—"}/>}
            <RI l="Tổng giá trị" v={fmtMoney(viewReq.total_value)} bold/>
            {viewReq.kiotviet_invoice_code && <RI l="Mã KiotViet" v={viewReq.kiotviet_invoice_code}/>}
          </div>

          <div style={{fontWeight:800,fontSize:14,color:"#1e1b4b",marginBottom:8}}>Danh sách linh kiện</div>
          {(Array.isArray(viewReq.items)?viewReq.items:JSON.parse(viewReq.items||"[]")).map((item,i)=>(
            <div key={i} style={{background:"#f3f4f6",borderRadius:10,padding:"8px 12px",marginBottom:6,display:"flex",justifyContent:"space-between",fontSize:13}}>
              <div>
                <div style={{fontWeight:700}}>{item.part_name}</div>
                {item.sku && <div style={{color:"#6b7280",fontSize:12}}>SKU: {item.sku}</div>}
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:800,color:"#4f46e5"}}>{fmtMoney(item.total_price)}</div>
                <div style={{color:"#6b7280",fontSize:12}}>×{item.qty}</div>
              </div>
            </div>
          ))}

          {viewReq.warehouse_confirmed_at && <CBlock title="📦 Kho đã xuất" by={viewReq.warehouse_confirmed_by_name} at={viewReq.warehouse_confirmed_at} note={viewReq.warehouse_note} media={viewReq.warehouse_media}/>}
          {viewReq.ktv_confirmed_at && <CBlock title="✅ KTV đã nhận" by={viewReq.ktv_confirmed_by_name} at={viewReq.ktv_confirmed_at} note={viewReq.ktv_note} media={viewReq.ktv_media}/>}
          {viewReq.return_confirmed_at && <CBlock title="↩ Đã trả kho" by={viewReq.return_confirmed_by_name} at={viewReq.return_confirmed_at} note={viewReq.return_note}/>}

          {confirmMode && (
            <div style={{background:"#f0fdf4",borderRadius:14,border:"1.5px solid #6ee7b7",padding:14,marginTop:12}}>
              <div style={{fontWeight:800,fontSize:14,color:"#065f46",marginBottom:10}}>
                {confirmMode==="warehouse"?"📦 Xác nhận đã xuất kho":confirmMode==="ktv"?"✅ Xác nhận đã nhận LK":"↩ Xác nhận trả linh kiện"}
              </div>
              <textarea value={confirmNote} onChange={e=>setConfirmNote(e.target.value)}
                placeholder="Ghi chú (tuỳ chọn)..."
                style={{width:"100%",minHeight:56,borderRadius:10,border:"1.5px solid #bbf7d0",padding:"8px 10px",fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box",marginBottom:10}}/>
              {confirmMode!=="return" && (
                <div style={{marginBottom:10}}>
                  <button onClick={()=>fileRef.current?.click()}
                    style={{height:36,padding:"0 14px",borderRadius:10,border:"1.5px solid #6ee7b7",background:"#fff",color:"#059669",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                    <span className="material-icons" style={{fontSize:16}}>add_a_photo</span>Chụp ảnh / Quay video
                  </button>
                  <input ref={fileRef} type="file" accept="image/*,video/*" multiple capture="environment" style={{display:"none"}} onChange={handleMediaUpload}/>
                  {confirmMedia.length>0 && (
                    <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                      {confirmMedia.map((m,i)=>(
                        <div key={i} style={{position:"relative"}}>
                          {m.type?.startsWith("video") ? <video src={m.url} style={{width:60,height:60,borderRadius:8,objectFit:"cover"}}/> : <img src={m.url} style={{width:60,height:60,borderRadius:8,objectFit:"cover"}} alt=""/>}
                          <button onClick={()=>setConfirmMedia(p=>p.filter((_,j)=>j!==i))} style={{position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:"50%",background:"#ef4444",border:"none",color:"#fff",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{setConfirmMode(null);setConfirmNote("");setConfirmMedia([]);}}
                  style={{flex:1,height:42,borderRadius:12,border:"1.5px solid #e5e7eb",background:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"}}>Hủy</button>
                <button onClick={confirmMode==="warehouse"?doWarehouse:confirmMode==="ktv"?doKtv:doReturn} disabled={confirming}
                  style={{flex:2,height:42,borderRadius:12,border:"none",background:"#059669",color:"#fff",fontWeight:800,fontSize:14,cursor:confirming?"not-allowed":"pointer"}}>
                  {confirming?"Đang xử lý...":"✅ Xác nhận"}
                </button>
              </div>
            </div>
          )}

          {!confirmMode && (
            <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:14}}>
              {(isKho||isMgr) && viewReq.status==="pending" && (
                <button onClick={()=>setConfirmMode("warehouse")}
                  style={{height:48,borderRadius:14,border:"none",background:"linear-gradient(135deg,#2563eb,#1d4ed8)",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  <span className="material-icons" style={{fontSize:20}}>inventory</span>Xác nhận đã xuất kho
                </button>
              )}
              {viewReq.status==="warehouse_confirmed" && (viewReq.requested_by===currentStaff?.id||isMgr) && !viewReq.ktv_confirmed_at && (
                <button onClick={()=>setConfirmMode("ktv")}
                  style={{height:48,borderRadius:14,border:"none",background:"linear-gradient(135deg,#059669,#047857)",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  <span className="material-icons" style={{fontSize:20}}>check_circle</span>Xác nhận đã nhận linh kiện
                </button>
              )}
              {viewReq.export_type==="borrow" && viewReq.status==="ktv_confirmed" && (viewReq.requested_by===currentStaff?.id||isMgr) && !viewReq.return_confirmed_at && (
                <button onClick={()=>setConfirmMode("return")}
                  style={{height:48,borderRadius:14,border:"none",background:"linear-gradient(135deg,#7c3aed,#6d28d9)",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  <span className="material-icons" style={{fontSize:20}}>assignment_return</span>Trả linh kiện cho kho
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────
export default function SparePartModal({order, currentStaff, onClose, onDone}) {
  const [parts, setParts]         = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("list");
  const [search, setSearch]       = useState("");
  const [toast, setToast]         = useState("");
  const [viewReq, setViewReq]     = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [exportType, setExportType] = useState("repair");
  const [dueMinutes, setDueMinutes] = useState(60);
  const [returnDays, setReturnDays] = useState(3);
  const [reqNote, setReqNote]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [kvSyncing, setKvSyncing]   = useState(false);
  const [kvMsg, setKvMsg]           = useState("");

  useEffect(()=>{loadAll();},[order.id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [p,r] = await Promise.all([
        SparePart.filter({is_active:true}),
        StockExportRequest.filter({order_id:order.id}),
      ]);
      setParts(p.sort((a,b)=>(a.name||"").localeCompare(b.name)));
      setRequests(r.sort((a,b)=>new Date(b.created_date||0)-new Date(a.created_date||0)));
    } catch(e){console.error(e);}
    setLoading(false);
  }

  async function handleSyncKv() {
    setKvSyncing(true); setKvMsg("⏳ KiotViet...");
    try {
      const res = await syncKvProducts((d,t)=>setKvMsg(`⏳ ${d}/${t}...`));
      setKvMsg(`✅ ${res.synced} SP!`);
      const p = await SparePart.filter({is_active:true});
      setParts(p.sort((a,b)=>(a.name||"").localeCompare(b.name)));
      setTimeout(()=>setKvMsg(""),3000);
    } catch(e){setKvMsg(`❌ ${e.message}`);setTimeout(()=>setKvMsg(""),4000);}
    setKvSyncing(false);
  }

  function addToCart(part) {
    if (cartItems.find(c=>c.part_id===part.id)){showToast("Đã có trong giỏ!");return;}
    setCartItems(prev=>[...prev,{part_id:part.id,part_name:part.name,sku:part.sku||"",qty:1,unit_price:part.price||0,total_price:part.price||0,unit:part.unit||"cái"}]);
    showToast(`✅ "${part.name}"`);
  }
  function removeFromCart(part_id){setCartItems(prev=>prev.filter(c=>c.part_id!==part_id));}
  function updateCartQty(part_id,qty){
    if(qty<1)return;
    setCartItems(prev=>prev.map(c=>c.part_id===part_id?{...c,qty,total_price:c.unit_price*qty}:c));
  }

  async function handleSubmitRequest() {
    if(cartItems.length===0){showToast("Giỏ trống!");return;}
    setSubmitting(true);
    try {
      const due=new Date(Date.now()+dueMinutes*60000).toISOString();
      const ret=exportType==="borrow"?new Date(Date.now()+returnDays*86400000).toISOString():null;
      const totalValue=cartItems.reduce((s,i)=>s+i.total_price,0);
      const code=genCode();
      const req=await StockExportRequest.create({request_code:code,order_id:order.id,order_code:order.order_code||order.id,export_type:exportType,items:cartItems,due_datetime:due,return_due_date:ret,status:"pending",requested_by:currentStaff.id,requested_by_name:currentStaff.full_name,total_value:totalValue,reminded_15min:false});
      const lines=cartItems.map(i=>`• ${i.part_name} ×${i.qty}`).join("\n");
      const lbl=exportType==="borrow"?"MƯỢN TẠM":"XUẤT SỬA";
      await RepairChat.create({order_id:order.id,order_code:order.order_code||order.id,sender_id:currentStaff.id,sender_name:currentStaff.full_name,message:`📦 [ĐỀ NGHỊ XUẤT KHO - ${lbl}]\n━━━━━━━━━━━━━━━━\nPhiếu: ${code}\nĐơn: ${order.order_code} | KTV: ${currentStaff.full_name}\nHạn: ${fmtDt(due)}\n${lines}`,message_type:"system"});
      try {
        const staffList=await Staff.filter({is_active:true});
        for(const ws of staffList.filter(s=>s.role==="Nhân viên kho")){
          await Notification.create({user_id:ws.id,user_name:ws.full_name,title:`📦 Đề nghị XK - ${lbl}`,message:`Phiếu ${code} | ${order.order_code} | Hạn: ${fmtDt(due)}`,order_id:order.id,order_code:order.order_code||order.id,type:"export_request",is_read:false});
        }
      } catch{}
      setRequests(prev=>[req,...prev]);
      setCartItems([]);
      setShowForm(false);
      setTab("requests");
      showToast(`✅ Đã gửi phiếu ${code}!`);
    } catch(e){showToast(`Lỗi: ${e.message}`);}
    setSubmitting(false);
  }



  function showToast(msg){setToast(msg);setTimeout(()=>setToast(""),4000);}

  const filteredParts=parts.filter(p=>!search||(p.name||"").toLowerCase().includes(search.toLowerCase())||(p.sku||"").toLowerCase().includes(search.toLowerCase()));
  const pendingCount=requests.filter(r=>r.status==="pending").length;

  return (
    <div style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:600,maxHeight:"94vh",display:"flex",flexDirection:"column"}}>

        {/* HEADER */}
        <div style={{background:"linear-gradient(135deg,#1e1b4b,#4f46e5)",padding:"16px 18px 14px",borderRadius:"24px 24px 0 0",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:"#fff",fontWeight:900,fontSize:17}}>🔧 Linh Kiện — {order.order_code}</div>
              <div style={{color:"#a5b4fc",fontSize:13,marginTop:2}}>{order.device_model||order.device_name||"?"} · {order.customer_name}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
              <button onClick={handleSyncKv} disabled={kvSyncing}
                style={{height:32,padding:"0 10px",background:"rgba(255,255,255,.2)",border:"1.5px solid rgba(255,255,255,.35)",color:"#fff",borderRadius:10,fontSize:11,fontWeight:700,cursor:kvSyncing?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:4}}>
                <span className="material-icons" style={{fontSize:14}}>sync</span>{kvSyncing?"...":"KiotViet"}
              </button>
              <button onClick={onClose}
                style={{background:"rgba(255,255,255,.2)",border:"1.5px solid rgba(255,255,255,.35)",color:"#fff",width:36,height:36,borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span className="material-icons" style={{fontSize:20}}>close</span>
              </button>
            </div>
          </div>
          {kvMsg && <div style={{marginTop:8,background:"rgba(255,255,255,.15)",borderRadius:10,padding:"6px 12px",fontSize:12,color:"#fff",fontWeight:600}}>{kvMsg}</div>}
        </div>

        {/* TABS */}
        <div style={{display:"flex",borderBottom:"2px solid #e5e7eb",flexShrink:0,background:"#fff"}}>
          {[
            {key:"list",  label:"Chọn LK",   icon:"inventory_2",   badge:0},
            {key:"cart",  label:"Giỏ",        icon:"shopping_cart",  badge:cartItems.length},
            {key:"requests",label:"Phiếu XK", icon:"assignment",     badge:pendingCount},
          ].map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              style={{flex:1,padding:"10px 4px",border:"none",background:"none",fontWeight:700,fontSize:12,cursor:"pointer",color:tab===t.key?"#4f46e5":"#6b7280",borderBottom:tab===t.key?"3px solid #4f46e5":"3px solid transparent",marginBottom:-2,display:"flex",alignItems:"center",justifyContent:"center",gap:4,position:"relative"}}>
              <span className="material-icons" style={{fontSize:16}}>{t.icon}</span>
              {t.label}
              {t.badge>0 && <span style={{background:"#ef4444",color:"#fff",borderRadius:999,padding:"1px 6px",fontSize:10,fontWeight:900,minWidth:16,textAlign:"center"}}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div style={{flex:1,overflowY:"auto",padding:"0 0 8px"}}>
          {loading ? (
            <div style={{textAlign:"center",padding:40,color:"#9ca3af"}}>⏳ Đang tải...</div>
          ) : tab==="list" ? (
            <TabList parts={filteredParts} cartItems={cartItems} search={search} setSearch={setSearch} addToCart={addToCart} removeFromCart={removeFromCart}/>
          ) : tab==="cart" ? (
            <TabCart cartItems={cartItems} updateCartQty={updateCartQty} removeFromCart={removeFromCart} order={order} showForm={showForm} setShowForm={setShowForm} exportType={exportType} setExportType={setExportType} dueMinutes={dueMinutes} setDueMinutes={setDueMinutes} returnDays={returnDays} setReturnDays={setReturnDays} reqNote={reqNote} setReqNote={setReqNote} submitting={submitting} handleSubmitRequest={handleSubmitRequest}/>
          ) : (
            <TabRequests requests={requests} setViewReq={setViewReq}/>
          )}
        </div>


      </div>

      {viewReq && (
        <RequestDetailModal
          viewReq={viewReq} setViewReq={setViewReq}
          currentStaff={currentStaff} order={order}
          requests={requests} setRequests={setRequests}
          showToast={showToast}
        />
      )}

      {toast && (
        <div style={{position:"fixed",bottom:110,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,.85)",color:"#fff",padding:"10px 20px",borderRadius:16,fontSize:14,fontWeight:700,zIndex:9999,whiteSpace:"pre-line",maxWidth:"80vw",textAlign:"center"}}>
          {toast}
        </div>
      )}
    </div>
  );
}
