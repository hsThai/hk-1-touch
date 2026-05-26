/* v1774860462-9241 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { RepairChat, Notification, Staff, RepairOrder, SparePart, SparePartUsage } from "./pb.jsx";
import { uploadFile } from "./pb.jsx";

function timeAgo(d) {
  if (!d) return "";
  const t = new Date(d).getTime();
  if (isNaN(t)) return "";
  const diff = Math.floor((Date.now() - t) / 60000);
  if (diff < 1) return "Vừa xong";
  if (diff < 60) return `${diff}p trước`;
  if (diff < 1440) return `${Math.floor(diff/60)}h trước`;
  return `${Math.floor(diff/1440)}ng trước`;
}
function genOrderId() { return "SC24"+String(Math.floor(Math.random()*9000)+1000); }

// ── KPI Timeline ──────────────────────────────
// accept_stage:
//   0 = vừa assign, chưa nhận đơn  → đếm 15' (nhận đơn)
//   1 = đã nhận đơn (KTV bấm Nhận) → đếm 60' (bắt đầu sửa)
//   2 = đã bắt đầu sửa             → không cần timer nữa
//   3 = Hoàn tất
// assigned_at   = thời điểm phân công (bắt đầu đếm 15')
// stage1_at     = thời điểm nhận đơn (bắt đầu đếm 60')
// ── KPI Timeline ──────────────────────────────────────────────────────────
// Stage 0: vừa phân công → KTV nhận đơn trong 60'
//          → mỗi 15 giây gửi thông báo nhắc
//          → hết 60' chưa nhận → -1 KPI
// Stage 1: KTV đã nhận → bắt đầu sửa trong 60'
//          → mỗi 15 giây gửi thông báo nhắc
//          → hết 60' chưa bắt đầu sửa → -3 KPI + ngừng giao việc + báo quản lý
// Stage 2: đang sửa → không còn timer bắt buộc
function getKpiTimerInfo(order) {
  if (!order.assigned_to || !order.assigned_at) return null;
  if ((order.accept_stage||0) >= 2) return null;
  if (["Hoàn Thành","Đã Giao","Hủy","Hoan Thanh","Da Giao","Huy"].includes(order.status)) return null;

  const assignedAt = new Date(order.assigned_at).getTime();
  const stage = order.accept_stage || 0;

  // Stage 0: KTV chưa nhận, đếm 60p đầu
  if (stage === 0) {
    return {
      phase: 0,
      label: "Nhận đơn trong 60 phút",
      deadline: assignedAt + 60 * 60000,
      totalMs: 60 * 60000,
      penalized: !!order.kpi_stage1_penalized,
      actionLabel: "Nhận Đơn Ngay",
      kpiPenalty: -1,
      penaltyNote: "-1 KPI nếu không nhận",
      noTimer: false,
    };
  }

  // Stage 1 TỰ ĐỘNG (hệ thống chuyển sau 60p, KTV chưa nhận):
  //   → Đếm tiếp 60p, nếu không nhận → -2 KPI thêm
  //   → KTV vẫn được bấm "Nhận Đơn" để dừng đếm
  if (stage === 1 && !order.kpi_manually_accepted) {
    const stage1Start = order.stage1_at ? new Date(order.stage1_at).getTime() : assignedAt + 60 * 60000;
    return {
      phase: 1,
      label: "⚠️ Giai đoạn 2 — Nhận đơn ngay",
      deadline: stage1Start + 60 * 60000,
      totalMs: 60 * 60000,
      penalized: !!order.kpi_stage2_penalized,
      actionLabel: "Nhận Đơn Ngay",
      kpiPenalty: -2,
      penaltyNote: "-2 KPI + Ngừng giao việc",
      noTimer: false,
    };
  }

  // Stage 1 do KTV tự bấm nhận (kpi_manually_accepted = true):
  //   → Không đếm nữa, chờ bấm Bắt Đầu Sửa
  if (stage === 1 && order.kpi_manually_accepted) {
    return {
      phase: 1,
      label: null,
      deadline: null,
      totalMs: null,
      penalized: false,
      actionLabel: "Bắt Đầu Sửa",
      kpiPenalty: 0,
      penaltyNote: "",
      noTimer: true,
    };
  }

  return null;
}

// ══════════════════════════════════════════════
//  MEDIA VIEWER — fullscreen lightbox with pinch-zoom + draw + share
// ══════════════════════════════════════════════
function MediaViewer({ items, startIndex, onClose, onSendAnnotated }) {
  const safeItems = items || [];
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

  const item    = safeItems[idx] || null;
  const isVideo = item?.startsWith("video:") || false;
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
      if(!drawMode){if(e.key==="ArrowLeft")setIdx(i=>Math.max(0,i-1));if(e.key==="ArrowRight")setIdx(i=>Math.min(safeItems.length-1,i+1));}
      if(drawMode&&(e.ctrlKey||e.metaKey)&&e.key==="z") handleUndo();
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[safeItems.length,drawMode]);

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
      setShareStatus("Đã gửi ảnh vào chat!");
      setTimeout(()=>{setShareStatus("");setDrawMode(false);},2000);
    }catch{setShareStatus("Gửi thất bại!");}
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
        setShareStatus("Đã chia sẻ!");
      } else { await navigator.clipboard.writeText(url);setShareStatus("Đã copy link!"); }
    }catch(e){if(e.name!=="AbortError") setShareStatus("Lỗi chia sẻ");}
    setTimeout(()=>setShareStatus(""),2500);
  }

  async function handleDownload(){
    const url=isVideo?videoSrc:imgSrc;if(!url)return;
    try{const res=await fetch(url),blob=await res.blob(),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`repair_${Date.now()}.${isVideo?"mp4":"jpg"}`;a.click();}
    catch{window.open(url,"_blank");}
  }

  const COLORS=["#ff3b30","#ff9500","#ffcc00","#34c759","#007aff","#af52de","#fff","#000"];
  const TOOLS=[{id:"pen",icon:"edit"},{id:"rect",icon:"crop_square"},{id:"oval",icon:"radio_button_unchecked"}];

  if (!safeItems.length) return null;

  return(
    <div style={{position:"fixed",inset:0,zIndex:6000,background:"rgba(0,0,0,.97)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}
      onClick={!drawMode?onClose:undefined}>

      <div style={{position:"absolute",top:0,left:0,right:0,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"linear-gradient(rgba(0,0,0,.8),transparent)",zIndex:10}}
        onClick={e=>e.stopPropagation()}>
        <div style={{color:"#fff",fontSize:13,fontWeight:600}}>{idx+1} / {safeItems.length}</div>
        <div style={{display:"flex",gap:6}}>
          {!isVideo&&<button onClick={()=>setDrawMode(d=>!d)} style={{background:drawMode?"#f59e0b":"rgba(255,255,255,.2)",border:"none",color:"#fff",height:34,padding:"0 12px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer"}}>{drawMode ? <><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:14,verticalAlign:"middle",lineHeight:1}}>edit</span> Đang vẽ</> : <><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:14,verticalAlign:"middle",lineHeight:1}}>edit</span> Vẽ</>}</button>}
          <button onClick={handleShare} style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",height:34,width:36,borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20}}>share</span></button>
          <button onClick={handleDownload} style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",height:34,width:36,borderRadius:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20}}>download</span></button>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",width:36,height:36,borderRadius:"50%",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20}}>close</span></button>
        </div>
      </div>

      {drawMode&&!isVideo&&(
        <div onClick={e=>e.stopPropagation()} style={{position:"absolute",bottom:safeItems.length>1?96:16,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",gap:8,alignItems:"center",background:"rgba(0,0,0,.9)",padding:"12px 16px",borderRadius:20,zIndex:20,backdropFilter:"blur(10px)",minWidth:320}}>
          {/* Dòng 1: Tools + Undo + Gửi */}
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {TOOLS.map(t=>(
              <button key={t.id} onClick={()=>setDrawTool(t.id)}
                style={{background:drawTool===t.id?"#4f46e5":"rgba(255,255,255,.15)",border:`2px solid ${drawTool===t.id?"#818cf8":"transparent"}`,color:"#fff",width:40,height:40,borderRadius:10,fontSize:20,cursor:"pointer"}}>
                <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,verticalAlign:"middle",lineHeight:1}}>{t.icon}</span>
              </button>
            ))}
            <div style={{width:1,height:30,background:"rgba(255,255,255,.25)",margin:"0 2px"}}/>
            <button onClick={handleUndo} title="Undo"
              style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",width:40,height:40,borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22}}>undo</span></button>
            <div style={{width:1,height:30,background:"rgba(255,255,255,.25)",margin:"0 2px"}}/>
            <button onClick={handleSendAnnotated} disabled={sending}
              style={{background:"#4f46e5",border:"none",color:"#fff",height:40,padding:"0 16px",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",minWidth:60}}>
              {sending?"⏳":"Gửi"}
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
            <div style={{textAlign:"center",color:"#fff"}}><div style={{fontSize:72}}> </div></div>
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

      {safeItems.length>1&&!drawMode&&(
        <>
          {idx>0&&<button onClick={e=>{e.stopPropagation();setIdx(i=>Math.max(0,i-1));}} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,.2)",border:"none",color:"#fff",width:46,height:46,borderRadius:"50%",fontSize:22,cursor:"pointer",zIndex:5}}>‹</button>}
          {idx<safeItems.length-1&&<button onClick={e=>{e.stopPropagation();setIdx(i=>Math.min(safeItems.length-1,i+1));}} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,.2)",border:"none",color:"#fff",width:46,height:46,borderRadius:"50%",fontSize:22,cursor:"pointer",zIndex:5}}>›</button>}
        </>
      )}

      {safeItems.length>1&&(
        <div onClick={e=>e.stopPropagation()} style={{position:"absolute",bottom:16,left:0,right:0,display:"flex",justifyContent:"center",gap:8,padding:"0 16px",flexWrap:"wrap",zIndex:5}}>
          {safeItems.map((it,i)=>(
            <div key={i} onClick={()=>setIdx(i)} style={{width:50,height:50,borderRadius:10,overflow:"hidden",border:`2px solid ${i===idx?"#a5b4fc":"transparent"}`,cursor:"pointer",background:"#1f2937",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {it.startsWith("video:")?<span style={{fontSize:20}}> </span>:<img src={it} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>}
            </div>
          ))}
        </div>
      )}

      {!isVideo&&!drawMode&&(
        <div style={{position:"absolute",bottom:safeItems.length>1?96:20,left:"50%",transform:"translateX(-50%)",color:"rgba(255,255,255,.28)",fontSize:11,pointerEvents:"none",whiteSpace:"nowrap",zIndex:2}}>
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
function AcceptChecklistModal({ order, onConfirm, onClose, pb }) {
  const [estMins, setEstMins] = useState(null);
  const [customDate, setCustomDate] = useState("");
  const [note, setNote] = useState("");
  const [extraImages, setExtraImages] = useState([]);
  const [extraVideos, setExtraVideos] = useState([]);
  const imgRef = useRef();
  const vidRef = useRef();

  // Tính estMins từ customDate nếu có
  const effectiveEstMins = customDate
    ? Math.round((new Date(customDate) - Date.now()) / 60000)
    : estMins;
  const canConfirm = customDate
    ? new Date(customDate) > new Date()
    : estMins !== null;

  // Chụp hình / quay video
  async function handleMedia(file, isVideo) {
    if (!file) return;
    const MAX = isVideo ? 50*1024*1024 : 2*1024*1024;
    if (file.size > MAX) { alert(isVideo ? "Video tối đa 50MB" : "Ảnh tối đa 2MB"); return; }
    const reader = new FileReader();
    reader.onload = e => {
      if (isVideo) setExtraVideos(p => [...p, { url: e.target.result, file }]);
      else setExtraImages(p => [...p, { url: e.target.result, file }]);
    };
    reader.readAsDataURL(file);
  }

  function removeImg(i) { setExtraImages(p => p.filter((_,idx)=>idx!==i)); }
  function removeVid(i) { setExtraVideos(p => p.filter((_,idx)=>idx!==i)); }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:4500, background:"rgba(0,0,0,.65)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", width:"100%", maxWidth:520, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 -8px 40px rgba(0,0,0,.25)" }}>
        {/* Handle */}
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:40, height:4, background:"#e5e7eb", borderRadius:4 }} />
        </div>
        <div style={{ padding:"0 20px 28px" }}>
          {/* Header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <div>
              <div style={{ fontWeight:900, fontSize:20, color:"#1e1b4b", display:"flex", alignItems:"center", gap:8 }}>
                <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:24,color:"#4f46e5",verticalAlign:"middle"}}>engineering</span>
                KTV Nhận Máy
              </div>
              <div style={{ fontSize:13, color:"#6b7280", marginTop:2 }}>{order.device_model || order.device_name} — {order.customer_name}</div>
            </div>
            <button onClick={onClose}
              style={{ background:"#fee2e2", border:"none", width:40, height:40, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22,color:"#dc2626"}}>close</span>
            </button>
          </div>

          {/* Thời gian dự kiến */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:10, color:"#374151", display:"flex", alignItems:"center", gap:6 }}>
              <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,color:"#4f46e5",verticalAlign:"middle"}}>schedule</span>
              Thời gian dự kiến hoàn thành <span style={{ color:"#dc2626" }}>*</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
              {EST_OPTIONS.map(opt => (
                <button key={opt.value}
                  onClick={() => { setEstMins(opt.value); setCustomDate(""); }}
                  style={{ padding:"14px 10px", borderRadius:12, border:`2px solid ${estMins===opt.value&&!customDate?"#4f46e5":"#e5e7eb"}`, background:estMins===opt.value&&!customDate?"#eef2ff":"#fff", color:estMins===opt.value&&!customDate?"#4f46e5":"#374151", fontWeight:estMins===opt.value&&!customDate?800:500, fontSize:15, cursor:"pointer", transition:"all .15s" }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Chọn ngày cụ thể */}
            <div style={{ background:"#f8fafc", border:`2px solid ${customDate?"#4f46e5":"#e5e7eb"}`, borderRadius:12, padding:"12px 14px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16,color:"#6b7280",verticalAlign:"middle"}}>calendar_today</span>
                Hoặc chọn ngày cụ thể:
              </div>
              <input type="datetime-local" value={customDate}
                onChange={e => { setCustomDate(e.target.value); setEstMins(null); }}
                min={new Date().toISOString().slice(0,16)}
                style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid ${customDate?"#4f46e5":"#d1d5db"}`, fontSize:15, outline:"none", boxSizing:"border-box", color: customDate?"#4f46e5":"#374151", fontWeight: customDate?700:400 }} />
            </div>
          </div>

          {/* Ghi chú */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:8, color:"#374151", display:"flex", alignItems:"center", gap:6 }}>
              <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,color:"#4f46e5",verticalAlign:"middle"}}>notes</span>
              Ghi chú kỹ thuật:
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="Tình trạng thực tế khi nhận máy..."
              rows={3} style={{ width:"100%", borderRadius:12, border:"1.5px solid #e5e7eb", padding:"12px 14px", fontSize:14, outline:"none", resize:"vertical", boxSizing:"border-box" }} />
          </div>

          {/* Hình ảnh / Video bổ sung */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:10, color:"#374151", display:"flex", alignItems:"center", gap:6 }}>
              <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,color:"#4f46e5",verticalAlign:"middle"}}>perm_media</span>
              Hình ảnh / Video bổ sung:
            </div>

            {/* Preview grid */}
            {(extraImages.length > 0 || extraVideos.length > 0) && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:10 }}>
                {extraImages.map((img,i) => (
                  <div key={i} style={{ position:"relative", borderRadius:10, overflow:"hidden", aspectRatio:"1", background:"#f3f4f6" }}>
                    <img src={img.url} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    <button onClick={() => removeImg(i)} style={{ position:"absolute", top:4, right:4, background:"rgba(0,0,0,.55)", border:"none", borderRadius:"50%", width:24, height:24, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:14,color:"#fff"}}>close</span>
                    </button>
                  </div>
                ))}
                {extraVideos.map((vid,i) => (
                  <div key={i} style={{ position:"relative", borderRadius:10, overflow:"hidden", aspectRatio:"1", background:"#1e1b4b", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:32,color:"#a5b4fc"}}>videocam</span>
                    <button onClick={() => removeVid(i)} style={{ position:"absolute", top:4, right:4, background:"rgba(0,0,0,.55)", border:"none", borderRadius:"50%", width:24, height:24, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:14,color:"#fff"}}>close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Nút chụp / quay */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <button onClick={() => imgRef.current?.click()}
                style={{ height:48, borderRadius:12, border:"2px dashed #4f46e5", background:"#eef2ff", color:"#4f46e5", fontWeight:700, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20}}>add_a_photo</span>
                Chụp hình
              </button>
              <button onClick={() => vidRef.current?.click()}
                style={{ height:48, borderRadius:12, border:"2px dashed #7c3aed", background:"#f5f3ff", color:"#7c3aed", fontWeight:700, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20}}>videocam</span>
                Quay video
              </button>
            </div>
            <input ref={imgRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={e => handleMedia(e.target.files[0], false)} />
            <input ref={vidRef} type="file" accept="video/*" capture="environment" style={{ display:"none" }} onChange={e => handleMedia(e.target.files[0], true)} />
          </div>

          {/* Nút xác nhận */}
          <button
            onClick={() => canConfirm && onConfirm({ estMins: effectiveEstMins, customDate, note, extraImages: extraImages.map(x=>x.file), extraVideos: extraVideos.map(x=>x.file) })}
            style={{ width:"100%", height:60, borderRadius:16, background:canConfirm?"linear-gradient(135deg,#059669,#047857)":"#d1d5db", color:"#fff", border:"none", fontWeight:900, fontSize:18, cursor:canConfirm?"pointer":"not-allowed", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow:canConfirm?"0 4px 20px rgba(5,150,105,.35)":"none", transition:"all .2s" }}>
            <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:24}}>
              {canConfirm ? "check_circle" : "lock"}
            </span>
            {canConfirm ? "Xác Nhận Nhận Máy" : "Chọn thời gian dự kiến để tiếp tục"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AcceptTimer({ order, currentUser, onUpdate }) {
  const [now, setNow] = useState(Date.now());
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  if (!order.assigned_to) return null;
  const isMyOrder  = order.assigned_to === currentUser.id;
  const isManager  = currentUser.role === "manager";
  if (!isMyOrder && !isManager) return null;

  const stage = order.accept_stage || 0;

  // Stage >= 2 hoặc đơn xong → badge xanh gọn
  if (stage >= 2 || ["Hoàn Thành","Đã Giao","Hủy","Hoan Thanh","Da Giao","Huy"].includes(order.status)) {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:8, background:"#dcfce7", border:"2px solid #6ee7b7", borderRadius:12, padding:"10px 14px", marginBottom:14 }}>
        <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,color:"#059669"}}>verified</span>
        <div>
          <div style={{ fontWeight:800, fontSize:13, color:"#065f46" }}>KPI đang chạy bình thường</div>
          <div style={{ fontSize:12, color:"#047857" }}>Không còn mốc thời gian bắt buộc</div>
        </div>
      </div>
    );
  }

  const info = getKpiTimerInfo(order);
  if (!info) return null;

  // Stage 1: đã nhận rồi → chỉ hiện nút "Bắt Đầu Sửa", không đếm ngược KPI
  if (info.noTimer) {
    return (
      <div style={{ background:"#f5f3ff", border:"2px solid #ddd6fe", borderRadius:14, padding:"14px 16px", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,color:"#7c3aed"}}>verified_user</span>
          <div>
            <div style={{ fontWeight:800, fontSize:14, color:"#5b21b6" }}>Đã nhận đơn</div>
            <div style={{ fontSize:12, color:"#7c3aed" }}>Bắt đầu sửa khi sẵn sàng — không tính KPI</div>
          </div>
        </div>
        {isMyOrder && !order.needs_reassign && (
          <button onClick={handleActionStage1} disabled={acting}
            style={{ width:"100%", height:52, borderRadius:12, border:"none",
              background: acting ? "#d1d5db" : "#7c3aed",
              color:"#fff", fontWeight:800, fontSize:16, cursor: acting?"not-allowed":"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20}}>build_circle</span>
            {acting ? "Đang xử lý..." : "Bắt Đầu Sửa"}
          </button>
        )}
        {isManager && (
          <div style={{ marginTop:8, fontSize:12, color:"#6b7280", textAlign:"center" }}>
            KTV đã nhận đơn — chờ bắt đầu sửa chữa
          </div>
        )}
      </div>
    );
  }

  const rem      = Math.max(0, info.deadline - now);
  const percent  = Math.min(100, Math.round((1 - rem / info.totalMs) * 100));
  const mins     = Math.floor(rem / 60000);
  const secs     = Math.floor((rem % 60000) / 1000);
  const expired  = rem === 0;
  const urgent   = rem > 0 && rem < 5 * 60000;

  // Màu theo phase + trạng thái
  const colors = {
    0: { bg:"#fff7ed", border:"#fed7aa", timerC:"#c2410c", btnBg:"#ea580c" },
    1: { bg:"#f5f3ff", border:"#ddd6fe", timerC:"#7c3aed", btnBg:"#7c3aed" },
  };
  const c = expired
    ? { bg:"#fef2f2", border:"#fca5a5", timerC:"#dc2626", btnBg:"#dc2626" }
    : urgent
    ? { bg:"#fffbeb", border:"#fde68a", timerC:"#d97706", btnBg: colors[info.phase].btnBg }
    : colors[info.phase];

  async function handleActionStage1() {
    if (acting) return;
    setActing(true);
    const ts = new Date().toISOString();
    onUpdate(order.id, {
      accept_stage: 2,
      stage2_at: ts,
      status: "Đang Sửa",
    }, null);
    setTimeout(() => setActing(false), 2000);
  }

  async function handleAction() {
    if (acting) return;
    setActing(true);
    const ts = new Date().toISOString();
    if (info.actionLabel === "Nhận Đơn Ngay") {
      // KTV bấm nhận (phase 0 hoặc phase 1 tự động)
      // → set kpi_manually_accepted=true để dừng đếm KPI, chờ bấm Sửa
      onUpdate(order.id, {
        accept_stage: 1,
        stage1_at: order.stage1_at || ts,  // giữ stage1_at nếu đã có (phase 1)
        kpi_manually_accepted: true,
        status: "KTV Dang Kiem",
      }, null);
    } else {
      // KTV bắt đầu sửa → stage 1→2
      onUpdate(order.id, {
        accept_stage: 2,
        stage2_at: ts,
        status: "Đang Sửa",
      }, null);
    }
    setTimeout(() => setActing(false), 2000);
  }

  return (
    <div style={{ background:c.bg, border:`2px solid ${c.border}`, borderRadius:14, padding:"14px 16px", marginBottom:14 }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div style={{ flex:1, paddingRight:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
            <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,color:c.timerC}}>
              {expired ? "warning" : "timer"}
            </span>
            <span style={{ fontWeight:900, fontSize:14, color:c.timerC }}>
              {expired
                ? (info.phase===0 ? "⚠️ Quá 60 phút chưa nhận đơn!" : "⚠️ Quá 120 phút vẫn chưa nhận!")
                : info.label}
            </span>
          </div>
          <div style={{ fontSize:12, color:"#6b7280" }}>
            {expired
              ? (info.penalized ? `Đã trừ ${info.penaltyNote}` : `Sắp bị ${info.penaltyNote} — hành động ngay!`)
              : `Còn ${mins} phút ${String(secs).padStart(2,"0")} giây để hành động`}
          </div>
        </div>
        {/* Đồng hồ */}
        <div style={{ textAlign:"center", flexShrink:0 }}>
          <div style={{ fontSize:30, fontWeight:900, fontFamily:"monospace", color:c.timerC, lineHeight:1 }}>
            {expired ? "00:00" : `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`}
          </div>
          <div style={{ fontSize:10, color:"#9ca3af", marginTop:2 }}>/ 60:00</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height:7, background:"rgba(0,0,0,.08)", borderRadius:4, marginBottom:10, overflow:"hidden" }}>
        <div style={{
          height:"100%", width:`${percent}%`,
          background: expired ? "#dc2626" : urgent ? "#f59e0b" : c.btnBg,
          borderRadius:4, transition:"width .5s linear"
        }}/>
      </div>

      {/* KTV action button — chỉ hiện khi còn thời gian (expired dùng nút riêng bên dưới) */}
      {isMyOrder && !order.needs_reassign && !expired && (
        <button onClick={handleAction} disabled={acting}
          style={{ width:"100%", height:52, borderRadius:12, border:"none",
            background: acting ? "#d1d5db" : c.btnBg,
            color:"#fff", fontWeight:800, fontSize:16, cursor: acting?"not-allowed":"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20}}>
            {acting ? "hourglass_top" : (info.phase===0 ? "assignment_turned_in" : "build_circle")}
          </span>
          {acting ? "Đang xử lý..." : info.actionLabel}
        </button>
      )}

      {/* KTV bị ngừng giao việc — chỉ hiện cho đúng KTV bị ảnh hưởng VÀ needs_reassign vẫn true */}
      {isMyOrder && order.needs_reassign && order.assigned_to === currentUser.id && (
        <div style={{ padding:"10px 12px", background:"#fef2f2", borderRadius:10, border:"1px solid #fca5a5",
          display:"flex", alignItems:"center", gap:8 }}>
          <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,color:"#dc2626"}}>block</span>
          <div>
            <div style={{ fontWeight:800, fontSize:13, color:"#dc2626" }}>Đơn đã chuyển về Quản lý</div>
            <div style={{ fontSize:12, color:"#6b7280" }}>Quản lý sẽ giao cho KTV khác. Bạn không cần làm gì thêm.</div>
          </div>
        </div>
      )}

      {/* Stage 1 expired nhưng needs_reassign chưa kịp set → vẫn cho bấm Bắt Đầu Sửa */}
      {isMyOrder && !order.needs_reassign && expired && info.phase === 1 && (
        <button onClick={handleAction} disabled={acting}
          style={{ width:"100%", height:52, borderRadius:12, border:"2px solid #dc2626",
            background: acting ? "#d1d5db" : "#fff",
            color:"#dc2626", fontWeight:800, fontSize:15, cursor: acting?"not-allowed":"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20}}>
            {acting ? "hourglass_top" : "build_circle"}
          </span>
          {acting ? "Đang xử lý..." : "Bắt Đầu Sửa (Đã quá hạn)"}
        </button>
      )}

      {/* Manager: cảnh báo + nút Giao Việc Lại */}
      {isManager && (
        <div style={{ marginTop: (isMyOrder && !order.needs_reassign) ? 8 : 0 }}>
          {(expired || order.needs_reassign) && (
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 10px",
              background:"rgba(220,38,38,.08)", borderRadius:8, marginBottom: order.needs_reassign ? 8 : 0 }}>
              <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:15,color:"#dc2626"}}>error_outline</span>
              <span style={{ fontSize:12, color:"#dc2626", fontWeight:700 }}>
                {order.needs_reassign
                  ? "KTV đã bị ngừng giao việc — cần phân công lại!"
                  : "KTV đang quá hạn — cân nhắc giao việc lại"}
              </span>
            </div>
          )}
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
  "Chờ KTV":        "Cho KTV",
  "KTV Đang Kiểm":  "KTV Dang Kiem",
  "Chờ Báo Giá":    "Cho Bao Gia",
  "Chờ Xác Nhận":   "Cho Xac Nhan",
  "Chờ KTV Sửa":    "Cho KTV Sua",
  "Đang Sửa":       "Dang Sua",
  "Chờ Linh Kiện":  "Cho Linh Kien",
  "Hoàn Thành":     "Hoan Thanh",
  "Đã Giao":        "Da Giao",
  "Hủy":            "Huy",
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
  { key:"Chờ KTV",       pb:"Cho KTV",       color:"#dc2626", bg:"#fef2f2",  emoji:"schedule_send" },
  { key:"KTV Đang Kiểm", pb:"KTV Dang Kiem", color:"#0369a1", bg:"#e0f2fe",  emoji:"manage_search" },
  { key:"Chờ Báo Giá",   pb:"Cho Bao Gia",   color:"#d97706", bg:"#fffbeb",  emoji:"request_quote" },
  { key:"Chờ Xác Nhận",  pb:"Cho Xac Nhan",  color:"#db2777", bg:"#fdf2f8",  emoji:"pending_actions" },
  { key:"Chờ KTV Sửa",   pb:"Cho KTV Sua",   color:"#7c3aed", bg:"#f5f3ff",  emoji:"engineering" },
  { key:"Đang Sửa",      pb:"Dang Sua",      color:"#6d28d9", bg:"#ede9fe",  emoji:"build" },
  { key:"Chờ Linh Kiện", pb:"Cho Linh Kien", color:"#ea580c", bg:"#fff7ed",  emoji:"inventory" },
  { key:"Hoàn Thành",    pb:"Hoan Thanh",    color:"#059669", bg:"#dcfce7",  emoji:"check_circle" },
  { key:"Đã Giao",       pb:"Da Giao",       color:"#64748b", bg:"#f1f5f9",  emoji:"inventory_2" },
];

export { timeAgo, genOrderId, getKpiTimerInfo, MediaViewer, AcceptChecklistModal, AcceptTimer, STATUS_PB, STATUS_DISPLAY, STATUS_COLS, PRIORITY_PB, PRIORITY_DISPLAY };

export default MediaViewer;