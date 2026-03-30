/* v1774860462-9241 */
import React, { useState, useEffect, useRef } from "react";

function timeAgo(d) {
  const diff = Math.floor((Date.now()-new Date(d))/60000);
  if(diff<1) return"Vừa xong"; if(diff<60) return`${diff}p trước`;
  if(diff<1440) return`${Math.floor(diff/60)}h trước`; return`${Math.floor(diff/1440)}ng trước`;
}
function genOrderId() { return "SC24"+String(Math.floor(Math.random()*9000)+1000); }

function getKpiTimerInfo(order) {
  if (!order.assigned_to || !order.assigned_at) return null;
  if (order.accept_stage >= 3) return null;
  const assignedAt = new Date(order.assigned_at).getTime();
  const stage = order.accept_stage || 0;
  const now = Date.now();
  let timeStr = "";
  let urgent = false;
  let label = "";
  let deadline;

  if (stage === 0) {
    deadline = assignedAt + 60 * 60000;
    label = "Giai đoạn 1 (0→60')";
  } else if (stage === 1 && order.stage1_at) {
    deadline = assignedAt + 120 * 60000;
    label = "Giai đoạn 2 (60'→120')";
  } else {
    return null;
  }

  const rem = Math.max(0, deadline - now);
  const mins = Math.floor(rem / 60000);
  const secs = Math.floor((rem % 60000) / 1000);
  urgent = rem < 5 * 60000;
  timeStr = rem === 0 ? "Quá hạn!" : `${mins}:${secs.toString().padStart(2,"0")}`;

  return { phase: stage === 0 ? 1 : 2, label, deadline: new Date(deadline), timeStr, urgent, penalized: stage === 0 ? !!order.kpi_stage1_penalized : !!order.kpi_stage2_penalized };
}

function MediaViewer({ items, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex || 0);
  const [shareStatus, setShareStatus] = useState("");
  const item = items[idx];
  const isVideo = item?.startsWith("video:");
  const videoSrc = isVideo ? item.replace("video:", "") : null;
  const imgSrc = !isVideo ? item : null;

  useEffect(() => {
    const handler = e => { if(e.key==="Escape") onClose(); if(e.key==="ArrowLeft") setIdx(i=>Math.max(0,i-1)); if(e.key==="ArrowRight") setIdx(i=>Math.min(items.length-1,i+1)); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [items.length]);

  async function handleShare() {
    const url = isVideo ? videoSrc : imgSrc;
    if (!url) { setShareStatus("❌ Không có file để chia sẻ"); return; }
    try {
      if (navigator.share) {
        await navigator.share({ url, title: "Ảnh/Video sửa chữa" });
        setShareStatus("✅ Đã mở menu chia sẻ!");
      } else {
        await navigator.clipboard.writeText(url);
        setShareStatus("✅ Đã copy link! Dán vào Zalo/Messenger.");
      }
    } catch (e) {
      if (e.name !== "AbortError") setShareStatus("❌ Không chia sẻ được.");
    }
    setTimeout(() => setShareStatus(""), 3000);
  }

  async function handleDownload() {
    const url = isVideo ? videoSrc : imgSrc;
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = isVideo ? "mp4" : "jpg";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `repair_${Date.now()}.${ext}`;
      a.click();
    } catch {
      window.open(url, "_blank");
    }
    setTimeout(() => setShareStatus(""), 3000);
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:6000, background:"rgba(0,0,0,.95)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}
      onClick={onClose}>
      <div style={{ position:"absolute", top:0, left:0, right:0, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", background:"linear-gradient(rgba(0,0,0,.7),transparent)", zIndex:1 }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ color:"#fff", fontSize:13, fontWeight:600 }}>{idx+1} / {items.length}</div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={handleShare}
            style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", height:36, padding:"0 14px", borderRadius:20, fontSize:13, fontWeight:700, cursor:"pointer" }}>
            📤 Chia sẻ
          </button>
          <button onClick={handleDownload}
            style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", height:36, padding:"0 14px", borderRadius:20, fontSize:13, fontWeight:700, cursor:"pointer" }}>
            ⬇️ Tải về
          </button>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:38, height:38, borderRadius:"50%", fontSize:18, cursor:"pointer" }}>✕</button>
        </div>
      </div>

      {shareStatus && (
        <div style={{ position:"absolute", top:70, left:"50%", transform:"translateX(-50%)", background:"#1e1b4b", color:"#fff", padding:"10px 20px", borderRadius:12, fontSize:13, fontWeight:700, zIndex:10, whiteSpace:"nowrap" }}>
          {shareStatus}
        </div>
      )}

      <div onClick={e=>e.stopPropagation()} style={{ maxWidth:"100vw", maxHeight:"80vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
        {isVideo ? (
          videoSrc && videoSrc.startsWith("blob:") ? (
            <video src={videoSrc} controls autoPlay playsInline
              style={{ maxWidth:"100vw", maxHeight:"78vh", borderRadius:12 }} />
          ) : (
            <div style={{ textAlign:"center", color:"#fff" }}>
              <div style={{ fontSize:72, marginBottom:16 }}>🎥</div>
            </div>
          )
        ) : (
          <img src={imgSrc} style={{ maxWidth:"96vw", maxHeight:"78vh", objectFit:"contain", borderRadius:12 }} alt="" />
        )}
      </div>

      {items.length > 1 && (
        <>
          {idx > 0 && (
            <button onClick={e=>{e.stopPropagation();setIdx(i=>i-1);}}
              style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:48, height:48, borderRadius:"50%", fontSize:22, cursor:"pointer", zIndex:2 }}>‹</button>
          )}
          {idx < items.length-1 && (
            <button onClick={e=>{e.stopPropagation();setIdx(i=>i+1);}}
              style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:48, height:48, borderRadius:"50%", fontSize:22, cursor:"pointer", zIndex:2 }}>›</button>
          )}
        </>
      )}

      {items.length > 1 && (
        <div onClick={e=>e.stopPropagation()} style={{ position:"absolute", bottom:16, left:0, right:0, display:"flex", justifyContent:"center", gap:8, padding:"0 16px", flexWrap:"wrap" }}>
          {items.map((it,i) => (
            <div key={i} onClick={()=>setIdx(i)}
              style={{ width:52, height:52, borderRadius:10, overflow:"hidden", border:`2px solid ${i===idx?"#a5b4fc":"transparent"}`, cursor:"pointer", background:"#1f2937", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              {it.startsWith("video:") ? <span style={{ fontSize:22 }}>🎥</span> : <img src={it} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
    </div>
  );
}

export { timeAgo, genOrderId, getKpiTimerInfo, MediaViewer, AcceptChecklistModal, AcceptTimer };