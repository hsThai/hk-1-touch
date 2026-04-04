/* v1774860462-9241 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { RepairChat, Notification, Staff, RepairOrder, SparePart, SparePartUsage } from "./pb.jsx";
import { uploadFile } from "./pb.jsx";

function timeAgo(d) {
  const diff = Math.floor((Date.now()-new Date(d))/60000);
  if(diff<1) return"Vừa xong"; if(diff<60) return`${diff}p trước`;
  if(diff<1440) return`${Math.floor(diff/60)}h trước`; return`${Math.floor(diff/1440)}ng trước`;
}
function genOrderId() { return "SC24"+String(Math.floor(Math.random()*9000)+1000); }

// ── KPI Timeline per sơ đồ ──────────────────────
// accept_stage:
//   0 = vừa gán, chưa "Cập nhật" lần nào
//   1 = đã "Cập nhật" lần 1 (dừng đếm T=0→60)
//   2 = đã "Cập nhật" lần 2 (dừng đếm T=60→120)
//   3 = Hoàn tất
// kpi_stage1_penalized: true = đã bị -1 KPI mốc 60'
// kpi_stage2_penalized: true = đã bị -3 KPI mốc 120'
function getKpiTimerInfo(order) {
  if (!order.assigned_to || !order.assigned_at) return null;
  if (order.accept_stage >= 3) return null;
  const assignedAt = new Date(order.assigned_at).getTime();
  const stage = order.accept_stage || 0;
  // Giai đoạn 1: T=0 → T=60'  (chỉ hiện nếu stage=0, chưa Cập nhật lần 1)
  if (stage === 0) {
    const deadline = assignedAt + 60 * 60000;
    return { phase: 1, label: "Giai đoạn 1 (0→60')", deadline: new Date(deadline), penalized: !!order.kpi_stage1_penalized };
  }
  // Giai đoạn 2: T=60' → T=120' (chỉ hiện nếu stage=1, chưa Cập nhật lần 2)
  if (stage === 1 && order.stage1_at) {
    const deadline = assignedAt + 120 * 60000;
    return { phase: 2, label: "Giai đoạn 2 (60'→120')", deadline: new Date(deadline), penalized: !!order.kpi_stage2_penalized };
  }
  return null;
}

// ══════════════════════════════════════════════
//  MEDIA VIEWER — fullscreen lightbox with pinch-zoom + draw + share
// ══════════════════════════════════════════════
function MediaViewer({ items, startIndex, onClose, onSendAnnotated }) {
  const [idx, setIdx]         = useState(startIndex || 0);
  const [shareStatus, setShareStatus] = useState("");
  const [drawMode, setDrawMode]   = useState(false);
  const [drawColor, setDrawColor] = useState("#ff3b30");
  const [drawSize, setDrawSize]   = useState(4);
  const [drawTool, setDrawTool]   = useState("pen");
  const [sending, setSending]     = useState(false);

  const canvasRef    = useRef(null);
  const drawingRef   = useRef(false);
  const startPosRef  = useRef(null);
  const historyRef   = useRef([]);

  const imgWrapRef  = useRef(null);
  const imgElRef    = useRef(null);
  const scaleRef    = useRef(1);
  const offsetRef   = useRef({ x:0, y:0 });
  const lastDistRef = useRef(null);
  const lastTapRef  = useRef(0);
  const dragStartRef= useRef(null);

  const item    = items[idx];
  const isVideo = item?.startsWith("video:");
  const videoSrc= isVideo ? item.replace("video:","") : null;
  const imgSrc  = !isVideo ? item : null;

  function applyTransform() {
    if (!imgElRef.current) return;
    const {x,y}=offsetRef.current, s=scaleRef.current;
    imgElRef.current.style.transform=`scale(${s}) translate(${x/s}px,${y/s}px)`;
  }
  function clampOffset(s) {
    if (!imgElRef.current) return;
    const el=imgElRef.current;
    const mx=(el.offsetWidth*(s-1))/2, my=(el.offsetHeight*(s-1))/2;
    offsetRef.current.x=Math.max(-mx,Math.min(mx,offsetRef.current.x));
    offsetRef.current.y=Math.max(-my,Math.min(my,offsetRef.current.y));
  }

  useEffect(()=>{
    const el=imgWrapRef.current;
    if(!el||isVideo||drawMode) return;
    function dist(t){const dx=t[0].clientX-t[1].clientX,dy=t[0].clientY-t[1].clientY;return Math.sqrt(dx*dx+dy*dy);}
    function onStart(e){
      if(e.touches.length===2){lastDistRef.current=dist(e.touches);}
      else if(e.touches.length===1){
        const now=Date.now();
        if(now-lastTapRef.current<280){scaleRef.current=1;offsetRef.current={x:0,y:0};applyTransform();lastTapRef.current=0;return;}
        lastTapRef.current=now;
        if(scaleRef.current>1) dragStartRef.current={x:e.touches[0].clientX-offsetRef.current.x,y:e.touches[0].clientY-offsetRef.current.y};
      }
    }
    function onMove(e){
      if(e.touches.length===2){
        e.preventDefault();
        const d=dist(e.touches);
        if(lastDistRef.current){scaleRef.current=Math.min(5,Math.max(1,scaleRef.current*(d/lastDistRef.current)));clampOffset(scaleRef.current);applyTransform();}
        lastDistRef.current=d;
      } else if(e.touches.length===1&&dragStartRef.current&&scaleRef.current>1){
        e.preventDefault();
        offsetRef.current={x:e.touches[0].clientX-dragStartRef.current.x,y:e.touches[0].clientY-dragStartRef.current.y};
        clampOffset(scaleRef.current);applyTransform();
      }
    }
    function onEnd(e){if(e.touches.length<2)lastDistRef.current=null;if(e.touches.length===0)dragStartRef.current=null;}
    el.addEventListener("touchstart",onStart,{passive:true});
    el.addEventListener("touchmove", onMove, {passive:false});
    el.addEventListener("touchend",  onEnd,  {passive:true});
    return()=>{el.removeEventListener("touchstart",onStart);el.removeEventListener("touchmove",onMove);el.removeEventListener("touchend",onEnd);};
  },[isVideo,drawMode,idx]);

  useEffect(()=>{
    scaleRef.current=1;offsetRef.current={x:0,y:0};
    if(imgElRef.current) imgElRef.current.style.transform="";
    setDrawMode(false);historyRef.current=[];
  },[idx]);

  useEffect(()=>{
    const h=e=>{
      if(e.key==="Escape") onClose();
      if(!drawMode){if(e.key==="ArrowLeft")setIdx(i=>Math.max(0,i-1));if(e.key==="ArrowRight")setIdx(i=>Math.min(items.length-1,i+1));}
      if(drawMode&&(e.ctrlKey||e.metaKey)&&e.key==="z") handleUndo();
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[items.length,drawMode]);

  useEffect(()=>{
    if(!drawMode||!canvasRef.current||!imgSrc) return;
    const canvas=canvasRef.current,ctx=canvas.getContext("2d"),img=new Image();
    img.crossOrigin="anonymous";
    img.onload=()=>{
      canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
      ctx.drawImage(img,0,0);historyRef.current=[];
    };
    img.src=imgSrc;
  },[drawMode,imgSrc]);

  function getPos(e,canvas){
    const rect=canvas.getBoundingClientRect();
    const sx=canvas.width/rect.width,sy=canvas.height/rect.height;
    const cx=e.touches?e.touches[0].clientX:e.clientX,cy=e.touches?e.touches[0].clientY:e.clientY;
    return{x:(cx-rect.left)*sx,y:(cy-rect.top)*sy};
  }

  function saveSnap(){
    const canvas=canvasRef.current;if(!canvas)return;
    historyRef.current.push(canvasRef.current.getContext("2d").getImageData(0,0,canvas.width,canvas.height));
    if(historyRef.current.length>25) historyRef.current.shift();
  }

  function handleUndo(){
    const canvas=canvasRef.current;
    if(!canvas||historyRef.current.length===0) return;
    canvas.getContext("2d").putImageData(historyRef.current.pop(),0,0);
  }

  function onDrawStart(e){
    if(!drawMode) return; e.preventDefault();
    saveSnap(); drawingRef.current=true; startPosRef.current=getPos(e,canvasRef.current);
    if(drawTool==="pen"){const ctx=canvasRef.current.getContext("2d");ctx.beginPath();ctx.moveTo(startPosRef.current.x,startPosRef.current.y);}
  }

  function onDrawMove(e){
    if(!drawMode||!drawingRef.current) return; e.preventDefault();
    const canvas=canvasRef.current,ctx=canvas.getContext("2d"),pos=getPos(e,canvas);
    const lw=drawSize*(canvas.width/canvas.getBoundingClientRect().width);
    if(drawTool==="pen"){
      ctx.lineTo(pos.x,pos.y);ctx.strokeStyle=drawColor;ctx.lineWidth=lw;ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();
    } else {
      const snap=historyRef.current[historyRef.current.length-1];
      if(snap) ctx.putImageData(snap,0,0);
      const sx=startPosRef.current.x,sy=startPosRef.current.y,w=pos.x-sx,h=pos.y-sy;
      ctx.strokeStyle=drawColor;ctx.lineWidth=lw;ctx.lineCap="round";
      if(drawTool==="rect") ctx.strokeRect(sx,sy,w,h);
      else if(drawTool==="oval"){ctx.beginPath();ctx.ellipse(sx+w/2,sy+h/2,Math.abs(w/2),Math.abs(h/2),0,0,2*Math.PI);ctx.stroke();}
    }
  }
  function onDrawEnd(){drawingRef.current=false;}

  async function handleSendAnnotated(){
    if(!canvasRef.current||!onSendAnnotated) return;
    setSending(true);
    try{
      const blob=await new Promise(r=>canvasRef.current.toBlob(r,"image/jpeg",0.88));
      await onSendAnnotated(new File([blob],`annotated_${Date.now()}.jpg`,{type:"image/jpeg"}));
      setShareStatus("✅ Đã gửi ảnh vào chat!");
      setTimeout(()=>{setShareStatus("");setDrawMode(false);},2000);
    }catch{setShareStatus("❌ Gửi thất bại!");}
    finally{setSending(false);}
  }

  async function handleShare(){
    const url=isVideo?videoSrc:imgSrc;if(!url) return;
    try{
      if(navigator.share){
        const res=await fetch(url),blob=await res.blob(),ext=isVideo?"mp4":"jpg";
        const file=new File([blob],`repair_media.${ext}`,{type:blob.type});
        if(navigator.canShare&&navigator.canShare({files:[file]})) await navigator.share({files:[file],title:"Ảnh/Video sửa chữa"});
        else await navigator.share({url,title:"Ảnh/Video sửa chữa"});
        setShareStatus("✅ Đã chia sẻ!");
      } else { await navigator.clipboard.writeText(url);setShareStatus("✅ Đã copy link!"); }
    }catch(e){if(e.name!=="AbortError") setShareStatus("❌ Lỗi chia sẻ");}
    setTimeout(()=>setShareStatus(""),2500);
  }

  async function handleDownload(){
    const url=isVideo?videoSrc:imgSrc;if(!url)return;
    try{const res=await fetch(url),blob=await res.blob(),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`repair_${Date.now()}.${isVideo?"mp4":"jpg"}`;a.click();}
    catch{window.open(url,"_blank");}
  }

  const COLORS=["#ff3b30","#ff9500","#ffcc00","#34c759","#007aff","#af52de","#fff","#000"];
  const TOOLS=[{id:"pen",icon:"✏️"},{id:"rect",icon:"⬜"},{id:"oval",icon:"⭕"}];

  return(
    <div style={{position:"fixed",inset:0,zIndex:6000,background:"rgba(0,0,0,.97)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}
      onClick={!drawMode?onClose:undefined}>

      <div style={{position:"absolute",top:0,left:0,right:0,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"linear-gradient(rgba(0,0,0,.8),transparent)",zIndex:10}}
        onClick={e=>e.stopPropagation()}>
        <div style={{color:"#fff",fontSize:13,fontWeight:600}}>{idx+1} / {items.length}</div>
        <div style={{display:"flex",gap:6}}>
          {!isVideo&&<button onClick={()=>setDrawMode(d=>!d)} style={{background:drawMode?"#f59e0b":"rgba(255,255,255,.2)",border:"none",color:"#fff",height:34,padding:"0 12px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer"}}>{drawMode?"✏️ Đang vẽ":"✏️ Vẽ"}</button>}
          <button onClick={handleShare} style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",height:34,padding:"0 12px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer"}}>📤</button>
          <button onClick={handleDownload} style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",height:34,padding:"0 12px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer"}}>⬇️</button>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",width:36,height:36,borderRadius:"50%",fontSize:18,cursor:"pointer"}}>✕</button>
        </div>
      </div>

      {drawMode&&!isVideo&&(
        <div onClick={e=>e.stopPropagation()} style={{position:"absolute",bottom:items.length>1?96:16,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",gap:8,alignItems:"center",background:"rgba(0,0,0,.9)",padding:"12px 16px",borderRadius:20,zIndex:20,backdropFilter:"blur(10px)",minWidth:320}}>
          {/* Dòng 1: Tools + Undo + Gửi */}
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {TOOLS.map(t=>(
              <button key={t.id} onClick={()=>setDrawTool(t.id)}
                style={{background:drawTool===t.id?"#4f46e5":"rgba(255,255,255,.15)",border:`2px solid ${drawTool===t.id?"#818cf8":"transparent"}`,color:"#fff",width:40,height:40,borderRadius:10,fontSize:17,cursor:"pointer"}}>
                {t.icon}
              </button>
            ))}
            <div style={{width:1,height:30,background:"rgba(255,255,255,.25)",margin:"0 2px"}}/>
            <button onClick={handleUndo} title="Undo"
              style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",width:40,height:40,borderRadius:10,fontSize:17,cursor:"pointer"}}>↩️</button>
            <div style={{width:1,height:30,background:"rgba(255,255,255,.25)",margin:"0 2px"}}/>
            <button onClick={handleSendAnnotated} disabled={sending}
              style={{background:"#4f46e5",border:"none",color:"#fff",height:40,padding:"0 16px",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",minWidth:60}}>
              {sending?"⏳":"📨 Gửi"}
            </button>
          </div>
          {/* Dòng 2: Màu */}
          <div style={{display:"flex",gap:5,alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"rgba(255,255,255,.5)",fontSize:11,marginRight:2}}>Màu</span>
            {COLORS.map(c=>(
              <div key={c} onClick={()=>setDrawColor(c)}
                style={{width:24,height:24,borderRadius:"50%",background:c,border:`3px solid ${drawColor===c?"#fff":"rgba(255,255,255,.12)"}`,cursor:"pointer",flexShrink:0,
                  boxShadow:drawColor===c?"0 0 0 2px #818cf8, 0 0 0 4px rgba(129,140,248,.3)":"none",transition:"box-shadow .15s"}}/>
            ))}
          </div>
          {/* Dòng 3: Độ dày nét (thanh thẳng) */}
          <div style={{display:"flex",gap:8,alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"rgba(255,255,255,.5)",fontSize:11,marginRight:2}}>Nét</span>
            {[1,3,6,10,16].map(s=>(
              <div key={s} onClick={()=>setDrawSize(s)}
                style={{display:"flex",alignItems:"center",justifyContent:"center",width:40,height:30,borderRadius:8,
                  background:drawSize===s?"rgba(129,140,248,.3)":"rgba(255,255,255,.08)",
                  border:`1.5px solid ${drawSize===s?"#818cf8":"rgba(255,255,255,.12)"}`,cursor:"pointer"}}>
                <div style={{width:24,height:s,borderRadius:s/2,background:drawColor,transition:"background .15s"}}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {shareStatus&&(
        <div style={{position:"absolute",top:64,left:"50%",transform:"translateX(-50%)",background:"#1e1b4b",color:"#fff",padding:"10px 20px",borderRadius:12,fontSize:13,fontWeight:700,zIndex:30,whiteSpace:"nowrap"}}>{shareStatus}</div>
      )}

      <div ref={imgWrapRef} onClick={e=>e.stopPropagation()}
        style={{width:"100vw",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",position:"relative"}}>
        {isVideo?(
          videoSrc&&(videoSrc.startsWith("blob:")||videoSrc.startsWith("http"))?(
            <video src={videoSrc} controls autoPlay playsInline preload="metadata" style={{maxWidth:"96vw",maxHeight:"82vh",borderRadius:12,background:"#000"}}/>
          ):(
            <div style={{textAlign:"center",color:"#fff"}}><div style={{fontSize:72}}>🎥</div></div>
          )
        ):drawMode?(
          <canvas ref={canvasRef}
            style={{maxWidth:"96vw",maxHeight:"72vh",objectFit:"contain",borderRadius:12,touchAction:"none",cursor:drawTool==="pen"?"crosshair":"crosshair",display:"block"}}
            onMouseDown={onDrawStart} onMouseMove={onDrawMove} onMouseUp={onDrawEnd} onMouseLeave={onDrawEnd}
            onTouchStart={onDrawStart} onTouchMove={onDrawMove} onTouchEnd={onDrawEnd}/>
        ):(
          <img ref={imgElRef} src={imgSrc} alt=""
            style={{maxWidth:"96vw",maxHeight:"82vh",objectFit:"contain",borderRadius:12,transformOrigin:"center center",touchAction:"none",userSelect:"none",willChange:"transform"}}/>
        )}
      </div>

      {items.length>1&&!drawMode&&(
        <>
          {idx>0&&<button onClick={e=>{e.stopPropagation();setIdx(i=>Math.max(0,i-1));}} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,.2)",border:"none",color:"#fff",width:46,height:46,borderRadius:"50%",fontSize:22,cursor:"pointer",zIndex:5}}>‹</button>}
          {idx<items.length-1&&<button onClick={e=>{e.stopPropagation();setIdx(i=>Math.min(items.length-1,i+1));}} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,.2)",border:"none",color:"#fff",width:46,height:46,borderRadius:"50%",fontSize:22,cursor:"pointer",zIndex:5}}>›</button>}
        </>
      )}

      {items.length>1&&(
        <div onClick={e=>e.stopPropagation()} style={{position:"absolute",bottom:16,left:0,right:0,display:"flex",justifyContent:"center",gap:8,padding:"0 16px",flexWrap:"wrap",zIndex:5}}>
          {items.map((it,i)=>(
            <div key={i} onClick={()=>setIdx(i)} style={{width:50,height:50,borderRadius:10,overflow:"hidden",border:`2px solid ${i===idx?"#a5b4fc":"transparent"}`,cursor:"pointer",background:"#1f2937",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {it.startsWith("video:")?<span style={{fontSize:20}}>🎥</span>:<img src={it} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>}
            </div>
          ))}
        </div>
      )}

      {!isVideo&&!drawMode&&(
        <div style={{position:"absolute",bottom:items.length>1?96:20,left:"50%",transform:"translateX(-50%)",color:"rgba(255,255,255,.28)",fontSize:11,pointerEvents:"none",whiteSpace:"nowrap",zIndex:2}}>
          Chụm 2 ngón phóng to · 2x chạm reset
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
//  ACCEPT TIMER
// ══════════════════════════════════════════════
// ── Checklist modal khi nhận máy lần 1 ──
const EST_OPTIONS = [
  { label:"1 giờ",    value:60 },
  { label:"2 giờ",    value:120 },
  { label:"4 giờ",    value:240 },
  { label:"Hôm nay",  value:480 },
  { label:"Ngày mai", value:1440 },
  { label:"2 ngày",   value:2880 },
  { label:"3 ngày",   value:4320 },
  { label:"1 tuần",   value:10080 },
];
const CHECKLIST_ITEMS = [
  "Đã kiểm tra nguồn máy",
  "Đã kiểm tra màn hình",
  "Đã kiểm tra các nút bấm",
  "Đã kiểm tra camera",
  "Đã kiểm tra loa / micro",
  "Đã kiểm tra kết nối mạng",
  "Đã ghi nhận tình trạng vỏ máy",
  "Đã xác nhận lỗi với khách",
];

function AcceptChecklistModal({ order, onConfirm, onClose }) {
  const [checked, setChecked] = useState([]);
  const [estMins, setEstMins] = useState(null);
  const [note, setNote] = useState("");
  function toggle(item){ setChecked(p => p.includes(item) ? p.filter(x=>x!==item) : [...p, item]); }
  const canConfirm = estMins !== null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:4500, background:"rgba(0,0,0,.65)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 -8px 40px rgba(0,0,0,.25)" }}>
        {/* Handle */}
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:40, height:4, background:"#e5e7eb", borderRadius:4 }} />
        </div>
        <div style={{ padding:"0 20px 24px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <div style={{ fontWeight:800, fontSize:18 }}>✋ Nhận Máy Lần 1</div>
              <div style={{ fontSize:13, color:"#6b7280" }}>Kiểm tra và xác nhận trước khi nhận</div>
            </div>
            <button onClick={onClose} style={{ background:"#f3f4f6", border:"none", width:36, height:36, borderRadius:"50%", fontSize:17, cursor:"pointer" }}>✕</button>
          </div>

          {/* Checklist */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:10, color:"#374151" }}>☑️ Kiểm tra trước khi nhận:</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {CHECKLIST_ITEMS.map(item => (
                <div key={item} onClick={() => toggle(item)}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:12, border:`2px solid ${checked.includes(item)?"#4f46e5":"#e5e7eb"}`, background:checked.includes(item)?"#eef2ff":"#fff", cursor:"pointer" }}>
                  <div style={{ width:24, height:24, borderRadius:6, border:`2px solid ${checked.includes(item)?"#4f46e5":"#d1d5db"}`, background:checked.includes(item)?"#4f46e5":"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {checked.includes(item) && <span style={{ color:"#fff", fontSize:14, fontWeight:900 }}>✓</span>}
                  </div>
                  <span style={{ fontSize:14, fontWeight:checked.includes(item)?700:400, color:checked.includes(item)?"#3730a3":"#374151" }}>{item}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:12, color:"#9ca3af", marginTop:8 }}>{checked.length}/{CHECKLIST_ITEMS.length} mục đã kiểm tra</div>
          </div>

          {/* Thời gian dự kiến */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:10, color:"#374151" }}>⏱️ Thời gian dự kiến hoàn thành: <span style={{ color:"#dc2626" }}>*</span></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {EST_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setEstMins(opt.value)}
                  style={{ padding:"14px 10px", borderRadius:12, border:`2px solid ${estMins===opt.value?"#4f46e5":"#e5e7eb"}`, background:estMins===opt.value?"#eef2ff":"#fff", color:estMins===opt.value?"#4f46e5":"#374151", fontWeight:estMins===opt.value?800:500, fontSize:15, cursor:"pointer" }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ghi chú */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:8, color:"#374151" }}>📝 Ghi chú kỹ thuật:</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Tình trạng thực tế khi nhận máy..."
              rows={3} style={{ width:"100%", borderRadius:12, border:"1.5px solid #e5e7eb", padding:"12px 14px", fontSize:14, outline:"none", resize:"vertical", boxSizing:"border-box" }} />
          </div>

          <button onClick={() => canConfirm && onConfirm({ checklist:checked, estMins, note })}
            style={{ width:"100%", height:58, borderRadius:16, background:canConfirm?"#059669":"#d1d5db", color:"#fff", border:"none", fontWeight:800, fontSize:18, cursor:canConfirm?"pointer":"not-allowed" }}>
            {canConfirm ? "✅ Xác Nhận Nhận Máy" : "Chọn thời gian dự kiến để tiếp tục"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AcceptTimer({ order, currentUser, onUpdate }) {
  const [now, setNow] = useState(Date.now());
  const [done, setDone] = useState(false);
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);

  if (!order.assigned_to) return null;
  if (order.assigned_to !== currentUser.id && currentUser.role !== "manager") return null;

  // Giai đoạn 1 đã nhận (accept_stage>=1) — hiển thị trạng thái đã nhận mờ
  if ((order.accept_stage||0) >= 1 && (order.accept_stage||0) < 2) {
    return (
      <div style={{ background:"#f3f4f6", border:"2px solid #d1d5db", borderRadius:14, padding:"12px 14px", marginBottom:14, opacity:0.6 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:22 }}>✅</div>
          <div>
            <div style={{ fontWeight:800, fontSize:14, color:"#6b7280" }}>Đã nhận máy</div>
            <div style={{ fontSize:12, color:"#9ca3af" }}>Giai đoạn 1 hoàn tất — tiếp tục sửa chữa</div>
          </div>
        </div>
      </div>
    );
  }

  if (order.accept_stage >= 3) return null;

  const info = getKpiTimerInfo(order);
  if (!info) return null;

  const rem = Math.max(0, info.deadline - now);
  const mins = Math.floor(rem / 60000);
  const secs = Math.floor((rem % 60000) / 1000);
  const expired = rem === 0;
  const urgent = rem < 5 * 60000;
  const isMyOrder = order.assigned_to === currentUser.id;

  function handleNhanMay() {
    const stage = info.phase;
    const key = `stage${stage}_at`;
    setDone(true);
    onUpdate(order.id, { accept_stage: stage, [key]: new Date().toISOString() }, null);
  }

  return (
    <div style={{ background: expired ? "#fef2f2" : urgent ? "#fffbeb" : "#f0fdf4", border: `2px solid ${expired ? "#fca5a5" : urgent ? "#fcd34d" : "#6ee7b7"}`, borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: expired ? "#dc2626" : "#374151" }}>
            {expired ? (info.phase === 1 ? "⚠️ Quá mốc 60 phút!" : "🚨 Quá mốc 120 phút!") : `⏰ ${info.label}`}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {expired
              ? (info.penalized ? (info.phase === 1 ? "Đã trừ -1 KPI" : "Đã trừ -3 KPI") : "Đang xử lý KPI...")
              : `Còn ${mins}:${secs.toString().padStart(2, "0")} — bấm nhận máy ngay!`}
          </div>
        </div>
        {!expired && (
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "monospace", color: urgent ? "#d97706" : "#059669", flexShrink: 0 }}>
            {mins}:{secs.toString().padStart(2, "0")}
          </div>
        )}
      </div>
      {isMyOrder && (
        done ? (
          <div style={{ width:"100%", height:52, borderRadius:14, background:"#d1d5db", color:"#6b7280", fontWeight:800, fontSize:17, display:"flex", alignItems:"center", justifyContent:"center", opacity:0.7 }}>
            ✅ Đã nhận máy
          </div>
        ) : (
          <button onClick={handleNhanMay}
            style={{ width:"100%", height:52, borderRadius:14, border:"none", background: expired ? "#dc2626" : "#4f46e5", color:"#fff", fontWeight:800, fontSize:17, cursor:"pointer" }}>
            ✋ Nhận máy
          </button>
        )
      )}
      {!isMyOrder && currentUser.role === "manager" && info.phase === 2 && expired && (
        <div style={{ marginTop: 8, fontSize: 13, color: "#dc2626", fontWeight: 700, textAlign: "center" }}>
          🔔 Hệ thống đã báo quản lý — có thể "Đổi KTV" bên dưới
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
//  ORDER DRAWER
// ══════════════════════════════════════════════


// ══════════════════════════════════════════════
//  STATUS / PRIORITY MAPPING (PocketBase ↔ Display)
// ══════════════════════════════════════════════
const STATUS_PB = {
  "Mới Nhận":      "Moi Nhan",
  "Đang Kiểm Tra": "Dang Kiem Tra",
  "Đang Sửa":      "Dang Sua",
  "Chờ Linh Kiện": "Cho Linh Kien",
  "Hoàn Thành":    "Hoan Thanh",
  "Đã Giao":       "Da Giao",
  "Hủy":           "Huy",
};
const STATUS_DISPLAY = Object.fromEntries(
  Object.entries(STATUS_PB).map(([display, pb]) => [pb, display])
);
const PRIORITY_PB = {
  "Bình thường": "Thuong",
  "Gấp":         "Gap",
  "VIP":         "VIP",
};
const PRIORITY_DISPLAY = Object.fromEntries(
  Object.entries(PRIORITY_PB).map(([display, pb]) => [pb, display])
);
const STATUS_COLS = [
  { key:"Mới Nhận",      pb:"Moi Nhan",      color:"#2563eb", bg:"#dbeafe",  emoji:"📥" },
  { key:"Đang Kiểm Tra", pb:"Dang Kiem Tra", color:"#d97706", bg:"#fef3c7",  emoji:"🔍" },
  { key:"Đang Sửa",      pb:"Dang Sua",      color:"#7c3aed", bg:"#ede9fe",  emoji:"🔧" },
  { key:"Chờ Linh Kiện", pb:"Cho Linh Kien", color:"#db2777", bg:"#fce7f3",  emoji:"⏳" },
  { key:"Hoàn Thành",    pb:"Hoan Thanh",    color:"#059669", bg:"#dcfce7",  emoji:"✅" },
  { key:"Đã Giao",       pb:"Da Giao",       color:"#64748b", bg:"#f1f5f9",  emoji:"📦" },
];

export { timeAgo, genOrderId, getKpiTimerInfo, MediaViewer, AcceptChecklistModal, AcceptTimer, STATUS_PB, STATUS_DISPLAY, STATUS_COLS, PRIORITY_PB, PRIORITY_DISPLAY };

export default MediaViewer;
