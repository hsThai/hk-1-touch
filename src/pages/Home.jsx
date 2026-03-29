import { lazy, Suspense, useState, useEffect, useRef } from "react";
const SparePartModal = lazy(() => import("./SparePartModal").catch(() => ({ default: ({ onClose }) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{background:"#fff",borderRadius:16,padding:32,textAlign:"center"}}>
      <div style={{fontSize:32}}>⚠️</div>
      <div style={{fontWeight:700,marginTop:8}}>Module không tải được</div>
      <button onClick={onClose} style={{marginTop:16,padding:"10px 24px",background:"#4f46e5",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>Đóng</button>
    </div>
  </div>
)})));

// ══════════════════════════════════════════════
//  QR CODE — qrcodejs từ CDN (load 1 lần)
// ══════════════════════════════════════════════
let _qrLibLoaded = false;
let _qrLibCallbacks = [];
function loadQRLib(cb) {
  if (_qrLibLoaded) { cb(); return; }
  _qrLibCallbacks.push(cb);
  if (_qrLibCallbacks.length > 1) return; // đang load rồi
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
  s.onload = () => {
    _qrLibLoaded = true;
    _qrLibCallbacks.forEach(f => f());
    _qrLibCallbacks = [];
  };
  s.onerror = () => {
    // fallback
    const s2 = document.createElement("script");
    s2.src = "https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs@master/qrcode.min.js";
    s2.onload = () => {
      _qrLibLoaded = true;
      _qrLibCallbacks.forEach(f => f());
      _qrLibCallbacks = [];
    };
    document.head.appendChild(s2);
  };
  document.head.appendChild(s);
}

let _jsQRLoaded = false;
let _jsQRCallbacks = [];
function loadJsQR(cb) {
  if (_jsQRLoaded && window.jsQR) { cb(); return; }
  _jsQRCallbacks.push(cb);
  if (_jsQRCallbacks.length > 1) return;
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
  s.onload = () => {
    _jsQRLoaded = true;
    _jsQRCallbacks.forEach(f => f());
    _jsQRCallbacks = [];
  };
  s.onerror = () => { _jsQRCallbacks = []; };
  document.head.appendChild(s);
}

// QRCanvas — mỗi text khác nhau → QR khác nhau
// QUAN TRỌNG: luôn truyền key={text} từ cha để force remount
function QRCanvas({ text, size = 160 }) {
  const divRef = useRef();
  useEffect(() => {
    if (!divRef.current || !text) return;
    const el = divRef.current;
    el.innerHTML = "";
    loadQRLib(() => {
      if (!el || !window.QRCode) return;
      el.innerHTML = "";
      try {
        new window.QRCode(el, {
          text,
          width: size,
          height: size,
          colorDark: "#1e1b4b",
          colorLight: "#ffffff",
          correctLevel: window.QRCode.CorrectLevel.M,
        });
      } catch (e) {
        el.innerHTML = `<div style="width:${size}px;height:${size}px;background:#f3f4f6;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:8px;font-size:11px;color:#6b7280;text-align:center;padding:6px"><div style="font-size:24px">📱</div><div style="font-weight:700;margin-top:4px;word-break:break-all">${text}</div></div>`;
      }
    });
  }, [text, size]);
  return <div ref={divRef} style={{ display: "inline-block", lineHeight: 0 }} />;
}

function getQRDataUrl(containerEl) {
  const canvas = containerEl?.querySelector("canvas");
  return canvas ? canvas.toDataURL() : "";
}

// ══════════════════════════════════════════════
//  QR SCANNER — camera + nhập tay
//  mode="search"  → tìm đơn theo mã quét được
//  mode="capture" → chỉ trả về chuỗi raw, không tìm
// ══════════════════════════════════════════════
function QRScanModal({ onClose, onFound, orders = [], mode = "search" }) {
  const videoRef = useRef();
  const canvasRef = useRef();
  const rafRef = useRef();
  const streamRef = useRef();
  const [camReady, setCamReady] = useState(false);
  const [libOk, setLibOk] = useState(false);
  const [err, setErr] = useState("");
  const [manual, setManual] = useState("");
  const isCapture = mode === "capture";

  // load jsQR
  useEffect(() => {
    loadJsQR(() => setLibOk(true));
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // start camera khi lib xong
  useEffect(() => {
    if (!libOk) return;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment", width: 640, height: 640 } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => { setCamReady(true); scan(); });
        }
      })
      .catch(() => setErr("Không mở được camera. Dùng nhập thủ công bên dưới."));
  }, [libOk]);

  function scan() {
    rafRef.current = requestAnimationFrame(() => {
      const v = videoRef.current; const c = canvasRef.current;
      if (!v || !c || !window.jsQR || v.readyState < 2) { scan(); return; }
      c.width = v.videoWidth; c.height = v.videoHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(v, 0, 0);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
      if (code?.data) {
        streamRef.current?.getTracks().forEach(t => t.stop());
        handleRaw(code.data.trim());
        return;
      }
      scan();
    });
  }

  function handleRaw(raw) {
    if (isCapture) { onFound({ type: "raw", code: raw }); onClose(); return; }
    // search mode
    const order = orders.find(o => o.id === raw || o.qr_code === raw);
    if (order) { onFound({ type: "order", data: order }); onClose(); return; }
    setErr(`Không tìm thấy mã "${raw}" trong hệ thống`);
  }

  function handleManual() {
    if (!manual.trim()) return;
    handleRaw(manual.trim());
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:4000, background:"rgba(0,0,0,.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div>
            <div style={{ color:"#fff", fontWeight:800, fontSize:20 }}>
              {isCapture ? "📷 Quét Mã QR Máy" : "🔍 Quét QR Tìm Đơn"}
            </div>
            <div style={{ color:"#a5b4fc", fontSize:12, marginTop:2 }}>
              {isCapture ? "Lấy mã QR dán lên máy → điền vào đơn" : "Quét QR phiếu sửa để tìm đơn hàng"}
            </div>
          </div>
          <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onClose(); }}
            style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:40, height:40, borderRadius:"50%", fontSize:18, cursor:"pointer" }}>✕</button>
        </div>

        {/* Camera */}
        <div style={{ position:"relative", borderRadius:18, overflow:"hidden", background:"#000", aspectRatio:"1", marginBottom:14 }}>
          <video ref={videoRef} playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          <canvas ref={canvasRef} style={{ display:"none" }} />
          {/* Overlay */}
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
            <div style={{ width:"60%", height:"60%", position:"relative" }}>
              <div style={{ position:"absolute", inset:0, boxShadow:"0 0 0 9999px rgba(0,0,0,.5)", borderRadius:12 }} />
              <div style={{ position:"absolute", inset:0, border:"3px solid #a5b4fc", borderRadius:12 }} />
              {/* corners */}
              {[[0,0],[0,1],[1,0],[1,1]].map(([t,r],i) => (
                <div key={i} style={{ position:"absolute", width:20, height:20,
                  ...(t===0 ? {top:-2} : {bottom:-2}), ...(r===0 ? {left:-2} : {right:-2}),
                  borderTop: t===0?"3px solid #818cf8":"none", borderBottom: t===1?"3px solid #818cf8":"none",
                  borderLeft: r===0?"3px solid #818cf8":"none", borderRight: r===1?"3px solid #818cf8":"none",
                  borderRadius: `${t===0&&r===0?"4":t===0&&r===1?"0":t===1&&r===0?"0":"0"}px ${t===0&&r===1?"4":"0"}px ${t===1&&r===1?"4":"0"}px ${t===1&&r===0?"4":"0"}px`
                }} />
              ))}
            </div>
          </div>
          {/* Status */}
          <div style={{ position:"absolute", bottom:10, left:0, right:0, textAlign:"center" }}>
            {!libOk && <span style={{ background:"rgba(0,0,0,.7)", color:"#fcd34d", padding:"5px 14px", borderRadius:20, fontSize:12 }}>⏳ Đang tải thư viện QR...</span>}
            {libOk && !camReady && !err && <span style={{ background:"rgba(0,0,0,.7)", color:"#fff", padding:"5px 14px", borderRadius:20, fontSize:12 }}>📷 Đang mở camera...</span>}
            {libOk && camReady && !err && <span style={{ background:"rgba(0,0,0,.7)", color:"#a5b4fc", padding:"5px 14px", borderRadius:20, fontSize:12 }}>Đưa mã QR vào khung...</span>}
          </div>
        </div>

        {/* Error */}
        {err && (
          <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:12, padding:"10px 14px", marginBottom:12, color:"#dc2626", fontSize:13, fontWeight:600, textAlign:"center" }}>
            {err}
            <div style={{ fontSize:12, color:"#6b7280", fontWeight:400, marginTop:4 }}>Thử nhập mã thủ công bên dưới</div>
          </div>
        )}

        {/* Manual */}
        <div style={{ background:"rgba(255,255,255,.08)", borderRadius:14, padding:14 }}>
          <div style={{ color:"#e5e7eb", fontSize:13, fontWeight:600, marginBottom:8 }}>
            {isCapture ? "Hoặc nhập mã QR thủ công:" : "Hoặc nhập mã đơn thủ công:"}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input value={manual} onChange={e => { setManual(e.target.value); setErr(""); }}
              onKeyDown={e => e.key === "Enter" && handleManual()}
              placeholder={isCapture ? "Nhập mã QR trên máy..." : "SC240001..."}
              style={{ flex:1, height:48, borderRadius:12, border:"1.5px solid rgba(255,255,255,.3)", background:"rgba(255,255,255,.1)", color:"#fff", padding:"0 14px", fontSize:15, outline:"none" }} />
            <button onClick={handleManual}
              style={{ height:48, padding:"0 20px", borderRadius:12, background:"#4f46e5", color:"#fff", border:"none", fontWeight:800, fontSize:15, cursor:"pointer" }}>OK</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  QR PRINT MODAL
// ══════════════════════════════════════════════
function QRPrintModal({ order, onClose }) {
  const cust = MOCK_CUSTOMERS.find(c => c.id === order.customer_id);
  const printRef = useRef();

  function doPrint() {
    const dataUrl = getQRDataUrl(printRef.current);
    const w = window.open("", "_blank", "width=420,height=520");
    w.document.write(`<html><head><title>${order.id}</title>
    <style>body{font-family:sans-serif;padding:24px;text-align:center;color:#1e1b4b;}
    .box{border:2px solid #1e1b4b;border-radius:14px;padding:20px;display:inline-block;min-width:280px;}
    h2{margin:0 0 2px;font-size:20px;} img{width:160px;height:160px;margin:10px 0;}
    table{width:100%;text-align:left;font-size:13px;border-collapse:collapse;}
    td{padding:4px 2px;} td:first-child{color:#6b7280;width:80px;} strong{color:#1e1b4b;}
    .footer{margin-top:14px;font-size:11px;color:#9ca3af;}
    @media print{body{margin:0;}}</style></head><body>
    <div class="box">
      <h2>🔧 ${order.id}</h2>
      <div style="color:#6b7280;font-size:13px;margin-bottom:4px">Phiếu Sửa Chữa</div>
      ${dataUrl ? `<img src="${dataUrl}"/>` : "<p>QR</p>"}
      <table>
        <tr><td>Khách:</td><td><strong>${cust?.full_name || "—"}</strong></td></tr>
        <tr><td>SĐT:</td><td><strong>${cust?.phone || "—"}</strong></td></tr>
        <tr><td>Máy:</td><td><strong>${order.device_model}</strong></td></tr>
        ${order.qr_code ? `<tr><td>Mã QR:</td><td><strong style="font-family:monospace">${order.qr_code}</strong></td></tr>` : ""}
        ${order.imei_serial ? `<tr><td>IMEI:</td><td><strong style="font-size:11px;font-family:monospace">${order.imei_serial}</strong></td></tr>` : ""}
        ${order.passcode ? `<tr><td>PIN:</td><td><strong>${order.passcode}</strong></td></tr>` : ""}
        <tr><td>Lỗi:</td><td><strong>${order.issues.join(", ") || "—"}</strong></td></tr>
        <tr><td>Ngày:</td><td><strong>${new Date(order.created).toLocaleDateString("vi-VN")}</strong></td></tr>
      </table>
      <div class="footer">Quét QR để tra cứu · ${new Date().toLocaleString("vi-VN")}</div>
    </div>
    <script>window.onload=()=>window.print();</script></body></html>`);
    w.document.close();
  }

  // QR chứa mã đơn (order.id) — đây là nội dung QR duy nhất
  const qrContent = order.id;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:3000, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:24, padding:28, width:"100%", maxWidth:340, boxShadow:"0 24px 64px rgba(0,0,0,.3)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div style={{ fontWeight:800, fontSize:18 }}>🖨️ In Mã QR</div>
          <button onClick={onClose} style={{ background:"#f3f4f6", border:"none", width:34, height:34, borderRadius:"50%", fontSize:16, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ textAlign:"center", background:"#f9fafb", borderRadius:16, padding:20, marginBottom:16 }}>
          <div style={{ fontWeight:800, fontSize:16, color:"#1e1b4b", marginBottom:2 }}>{order.id}</div>
          <div style={{ fontSize:13, color:"#6b7280", marginBottom:14 }}>{cust?.full_name} · {order.device_model}</div>
          <div ref={printRef} style={{ display:"inline-block" }}>
            <QRCanvas key={qrContent} text={qrContent} size={170} />
          </div>
          <div style={{ fontSize:11, color:"#9ca3af", marginTop:8 }}>Nội dung QR: <strong>{qrContent}</strong></div>
        </div>
        <div style={{ background:"#f3f4f6", borderRadius:12, padding:"10px 14px", marginBottom:16, fontSize:13 }}>
          <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:"3px 10px" }}>
            <span style={{ color:"#9ca3af" }}>Lỗi:</span><span style={{ fontWeight:600 }}>{order.issues.join(", ") || "—"}</span>
            <span style={{ color:"#9ca3af" }}>Trạng thái:</span><span style={{ fontWeight:600 }}>{order.status}</span>
            {order.qr_code && <><span style={{ color:"#9ca3af" }}>Mã QR:</span><span style={{ fontWeight:700, fontFamily:"monospace" }}>{order.qr_code}</span></>}
            {order.passcode && <><span style={{ color:"#9ca3af" }}>PIN:</span><span style={{ fontWeight:700, color:"#b45309" }}>{order.passcode}</span></>}
          </div>
        </div>
        <button onClick={doPrint} style={{ width:"100%", height:52, borderRadius:14, background:"#1e1b4b", color:"#fff", border:"none", fontWeight:800, fontSize:17, cursor:"pointer" }}>
          🖨️ In Phiếu QR
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  MOCK DATA
// ══════════════════════════════════════════════
const MOCK_USERS = [
  { id:"u1", name:"Nguyễn Quản Lý",  username:"admin",   password:"admin123",  role:"manager",      kpi:10, phone:"", note:"" },
  { id:"u2", name:"Trần Tiếp Tân",   username:"tieptan", password:"123456",    role:"receptionist", kpi:0,  phone:"", note:"" },
  { id:"u3", name:"Lê Kỹ Thuật",     username:"ktv1",    password:"123456",    role:"technician",   kpi:8,  phone:"", note:"" },
  { id:"u4", name:"Phạm KTV 2",       username:"ktv2",    password:"123456",    role:"technician",   kpi:6,  phone:"", note:"" },
];
const MOCK_CUSTOMERS = [
  { id:"c1", phone:"0901234567", full_name:"Nguyễn Văn A" },
  { id:"c2", phone:"0912345678", full_name:"Trần Thị B"   },
  { id:"c3", phone:"0923456789", full_name:"Lê Văn C"     },
];
const T0 = Date.now();
const MOCK_ORDERS_INIT = [
  { id:"SC240001", qr_code:"QR-A1B2C3", customer_id:"c1", device_model:"iPhone 15 Pro Max", imei_serial:"358001234567890", passcode:"1234",   issues:["Bể kính","Hư pin"],  status:"Đang Sửa",      notes:"Vỡ góc dưới", assigned_to:"u3", assigned_at:new Date(T0-8*60000).toISOString(),  accept_stage:0, created:new Date(T0-30*60000).toISOString(),    images:[] },
  { id:"SC240002", qr_code:"",          customer_id:"c2", device_model:"Samsung S24 Ultra",  imei_serial:"",               passcode:"0000",   issues:["Mất nguồn"],         status:"Chờ Linh Kiện", notes:"Order IC nguồn", assigned_to:"u4", assigned_at:new Date(T0-90*60000).toISOString(), accept_stage:1, stage1_at:new Date(T0-80*60000).toISOString(), created:new Date(T0-120*60000).toISOString(), images:[] },
  { id:"SC240003", qr_code:"QR-X9Y8Z7", customer_id:"c3", device_model:"Xiaomi 14 Pro",      imei_serial:"358009876543210",passcode:"",       issues:["Lỗi FaceID"],        status:"Mới Nhận",      notes:"", assigned_to:"u3", assigned_at:new Date(T0-5*60000).toISOString(), accept_stage:0, created:new Date(T0-5*60000).toISOString(), images:[] },
  { id:"SC240004", qr_code:"",          customer_id:"c1", device_model:"iPad Air M2",        imei_serial:"",               passcode:"6789",   issues:["Bể kính"],           status:"Hoàn Thành",    notes:"Đã thay kính", assigned_to:"u3", accept_stage:3, created:new Date(T0-2*86400000).toISOString(), images:[] },
];

const STATUS_COLS = [
  { key:"Mới Nhận",      icon:"📋", color:"#4f46e5", bg:"#eef2ff", border:"#a5b4fc" },
  { key:"Đang Sửa",      icon:"🔧", color:"#d97706", bg:"#fffbeb", border:"#fcd34d" },
  { key:"Chờ Linh Kiện", icon:"⏳", color:"#dc2626", bg:"#fef2f2", border:"#fca5a5" },
  { key:"Hoàn Thành",    icon:"✅", color:"#059669", bg:"#ecfdf5", border:"#6ee7b7" },
  { key:"Đã Giao",       icon:"📦", color:"#2563eb", bg:"#eff6ff", border:"#93c5fd" },
];
const ISSUE_OPTIONS = ["Bể kính","Hư pin","Mất nguồn","Lỗi FaceID","Vô nước","Lỗi micro/loa","Mất sóng","Hỏng camera","Lỗi sạc","Khác"];
const ROLE_LABELS = { manager:"👑 Quản lý", receptionist:"🗂️ Tiếp tân", technician:"🔧 Kỹ thuật" };

function timeAgo(d) {
  const diff = Math.floor((Date.now()-new Date(d))/60000);
  if(diff<1) return"Vừa xong"; if(diff<60) return`${diff}p trước`;
  if(diff<1440) return`${Math.floor(diff/60)}h trước`; return`${Math.floor(diff/1440)}ng trước`;
}
function genOrderId() { return "SC24"+String(Math.floor(Math.random()*9000)+1000); }

function getAcceptDeadline(order) {
  const s = order.accept_stage||0;
  if(s===0&&order.assigned_at) return{label:"Nhận máy lần 1",deadline:new Date(new Date(order.assigned_at).getTime()+15*60000),stage:1};
  if(s===1&&order.stage1_at)   return{label:"Xác nhận lần 2", deadline:new Date(new Date(order.stage1_at).getTime()+60*60000),stage:2};
  if(s===2&&order.stage2_at)   return{label:"Xác nhận lần 3", deadline:new Date(new Date(order.stage2_at).getTime()+1500*60000),stage:3};
  return null;
}

// ══════════════════════════════════════════════
//  MEDIA VIEWER — fullscreen lightbox
// ══════════════════════════════════════════════
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
      // Thử Web Share API (native share sheet — Zalo, Facebook, v.v.)
      if (navigator.share) {
        if (navigator.canShare && url.startsWith("blob:")) {
          // Share as file
          const res = await fetch(url);
          const blob = await res.blob();
          const ext = isVideo ? "mp4" : "jpg";
          const file = new File([blob], `repair_media.${ext}`, { type: blob.type });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: "Ảnh/Video sửa chữa" });
            setShareStatus("✅ Đã mở menu chia sẻ!");
            return;
          }
        }
        // Share URL
        await navigator.share({ url, title: "Ảnh/Video sửa chữa" });
        setShareStatus("✅ Đã mở menu chia sẻ!");
      } else {
        // Fallback: copy link
        await navigator.clipboard.writeText(url);
        setShareStatus("✅ Đã copy link! Dán vào Zalo/Messenger.");
      }
    } catch (e) {
      if (e.name !== "AbortError") setShareStatus("❌ Không chia sẻ được. Thử tải về máy.");
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
      setShareStatus("✅ Đang tải về máy...");
    } catch {
      // fallback: open in new tab
      window.open(url, "_blank");
    }
    setTimeout(() => setShareStatus(""), 3000);
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:6000, background:"rgba(0,0,0,.95)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}
      onClick={onClose}>
      {/* Header */}
      <div style={{ position:"absolute", top:0, left:0, right:0, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", background:"linear-gradient(rgba(0,0,0,.7),transparent)", zIndex:1 }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ color:"#fff", fontSize:13, fontWeight:600 }}>{idx+1} / {items.length}</div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={handleShare}
            style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", height:36, padding:"0 14px", borderRadius:20, fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
            📤 Chia sẻ
          </button>
          <button onClick={handleDownload}
            style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", height:36, padding:"0 14px", borderRadius:20, fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
            ⬇️ Tải về
          </button>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:38, height:38, borderRadius:"50%", fontSize:18, cursor:"pointer" }}>✕</button>
        </div>
      </div>

      {/* Status toast */}
      {shareStatus && (
        <div style={{ position:"absolute", top:70, left:"50%", transform:"translateX(-50%)", background:"#1e1b4b", color:"#fff", padding:"10px 20px", borderRadius:12, fontSize:13, fontWeight:700, zIndex:10, whiteSpace:"nowrap" }}>
          {shareStatus}
        </div>
      )}

      {/* Media */}
      <div onClick={e=>e.stopPropagation()} style={{ maxWidth:"100vw", maxHeight:"80vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
        {isVideo ? (
          videoSrc && videoSrc.startsWith("blob:") ? (
            <video src={videoSrc} controls autoPlay playsInline
              style={{ maxWidth:"100vw", maxHeight:"78vh", borderRadius:12 }} />
          ) : (
            <div style={{ textAlign:"center", color:"#fff" }}>
              <div style={{ fontSize:72, marginBottom:16 }}>🎥</div>
              <div style={{ fontSize:14, color:"#9ca3af" }}>Video: {item.replace("video:","")}</div>
            </div>
          )
        ) : (
          <img src={imgSrc} style={{ maxWidth:"96vw", maxHeight:"78vh", objectFit:"contain", borderRadius:12, boxShadow:"0 4px 40px rgba(0,0,0,.5)" }} alt="" />
        )}
      </div>

      {/* Prev / Next */}
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

      {/* Thumbnails */}
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

      {/* Bottom share bar */}
      <div onClick={e=>e.stopPropagation()} style={{ position:"absolute", bottom: items.length>1 ? 90 : 20, left:0, right:0, display:"flex", justifyContent:"center", gap:10 }}>
        <button onClick={handleShare}
          style={{ height:44, padding:"0 24px", background:"#0068ff", color:"#fff", border:"none", borderRadius:22, fontWeight:800, fontSize:14, cursor:"pointer", boxShadow:"0 4px 16px rgba(0,104,255,.4)" }}>
          📤 Chia sẻ qua Zalo / App khác
        </button>
        <button onClick={handleDownload}
          style={{ height:44, padding:"0 20px", background:"rgba(255,255,255,.15)", color:"#fff", border:"1.5px solid rgba(255,255,255,.3)", borderRadius:22, fontWeight:700, fontSize:14, cursor:"pointer" }}>
          ⬇️ Tải về
        </button>
      </div>
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

function AcceptTimer({ order, onAccept, onOpenChecklist, currentUser }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  if (!order.assigned_to || order.accept_stage >= 3) return null;
  if (order.assigned_to !== currentUser.id && currentUser.role !== "manager") return null;
  const info = getAcceptDeadline(order);
  if (!info) return null;
  const rem = Math.max(0, info.deadline - now);
  const mins = Math.floor(rem/60000), secs = Math.floor((rem%60000)/1000);
  const urgent = rem < 3*60000, expired = rem === 0;
  // Stage 1 → mở checklist; stage 2,3 → bấm trực tiếp
  const handleClick = () => info.stage === 1 ? onOpenChecklist(order, info.stage) : onAccept(order, info.stage);
  return (
    <div style={{ background:expired?"#fef2f2":urgent?"#fffbeb":"#f0fdf4", border:`2px solid ${expired?"#fca5a5":urgent?"#fcd34d":"#6ee7b7"}`, borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:14, color:expired?"#dc2626":"#374151" }}>{expired?"⚠️ Quá hạn KPI!":"⏰ "+info.label}</div>
          <div style={{ fontSize:12, color:"#6b7280" }}>{expired?"Đã trừ KPI, báo quản lý":`Còn ${mins}:${secs.toString().padStart(2,"0")} — bấm ngay!`}</div>
        </div>
        {!expired && <div style={{ fontSize:24, fontWeight:900, fontFamily:"monospace", color:urgent?"#d97706":"#059669", flexShrink:0 }}>{mins}:{secs.toString().padStart(2,"0")}</div>}
      </div>
      <button onClick={handleClick}
        style={{ width:"100%", height:54, borderRadius:14, border:"none", background:expired?"#dc2626":"#4f46e5", color:"#fff", fontWeight:800, fontSize:18, cursor:"pointer" }}>
        ✋ {info.stage===1?"Nhận Máy + Checklist":info.label}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════
//  ORDER DRAWER
// ══════════════════════════════════════════════
function OrderDrawer({ order, onClose, currentUser, onUpdate, users, onShowQR }) {
  const [chatInput, setChatInput] = useState("");
  const [chats, setChats] = useState([]);
  const [tab, setTab] = useState("info");
  const [toast, setToast] = useState(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistTarget, setChecklistTarget] = useState(null); // {ord, stage}
  const [editMode, setEditMode] = useState(false); // KTV phải bấm "Sửa" mới đổi trạng thái
  const [showSparePart, setShowSparePart] = useState(false);
  const [mediaViewer, setMediaViewer] = useState(null); // {items, startIndex}
  const chatRef = useRef();

  useEffect(() => { setTimeout(() => chatRef.current?.scrollIntoView({ behavior:"smooth" }), 100); }, [chats, tab]);

  const cust = MOCK_CUSTOMERS.find(c => c.id === order.customer_id);
  const assignee = users.find(u => u.id === order.assigned_to);
  const col = STATUS_COLS.find(s => s.key === order.status);
  const isKTV = currentUser.role === "technician";
  const isMyOrder = order.assigned_to === currentUser.id;

  function showToast(msg, type="success") { setToast({msg,type}); setTimeout(() => setToast(null), 3000); }

  function handleAccept(ord, stage) {
    const k = `stage${stage}_at`;
    onUpdate(ord.id, { accept_stage:stage, [k]:new Date().toISOString() }, null);
    showToast(`✅ Nhận máy lần ${stage} thành công!`);
  }
  function handleOpenChecklist(ord, stage) {
    setChecklistTarget({ ord, stage });
    setShowChecklist(true);
  }
  function handleChecklistConfirm({ checklist, estMins, note: techNote }) {
    const ord = checklistTarget.ord;
    const stage = checklistTarget.stage;
    const k = `stage${stage}_at`;
    const estDate = new Date(Date.now() + estMins * 60000).toISOString();
    onUpdate(ord.id, {
      accept_stage: stage,
      [k]: new Date().toISOString(),
      status: "Đang Sửa",
      checklist_done: checklist,
      estimated_done: estDate,
      technician_note: techNote || ord.technician_note || "",
    }, null);
    setShowChecklist(false);
    showToast("✅ Đã nhận máy! Bắt đầu sửa chữa.");
  }
  function handleMarkDone() {
    onUpdate(order.id, { status:"Hoàn Thành", accept_stage:3 }, { userId:order.assigned_to, delta:2, note:"Sửa xong +2 KPI" });
    showToast("🎉 Hoàn thành! +2 KPI");
    setEditMode(false);
  }
  function sendChat() {
    if (!chatInput.trim()) return;
    setChats(p => [...p, { id:Math.random().toString(36), sender_id:currentUser.id, sender_name:currentUser.name, message:chatInput.trim(), created:new Date().toISOString() }]);
    setChatInput("");
  }

  const qrContent = order.id;

  return (
    <>
    <div style={{ position:"fixed", inset:0, zIndex:1000, display:"flex" }}>
      <div style={{ flex:1, background:"rgba(0,0,0,.45)" }} onClick={onClose} />
      <div style={{ width:Math.min(520,window.innerWidth), background:"#fff", display:"flex", flexDirection:"column", boxShadow:"-8px 0 40px rgba(0,0,0,.2)", overflow:"hidden", position:"relative" }}>
        {toast && (
          <div style={{ position:"absolute", top:70, left:"50%", transform:"translateX(-50%)", background:toast.type==="success"?"#059669":"#dc2626", color:"#fff", padding:"12px 24px", borderRadius:14, fontWeight:700, zIndex:99, whiteSpace:"nowrap", boxShadow:"0 4px 20px rgba(0,0,0,.2)" }}>
            {toast.msg}
          </div>
        )}
        {/* Header */}
        <div style={{ padding:"14px 16px", background:"#3730a3", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ color:"#fff", fontWeight:800, fontSize:16 }}>📋 {order.id}</div>
            <span style={{ fontSize:11, background:col?.bg, color:col?.color, padding:"2px 10px", borderRadius:20, fontWeight:700 }}>{col?.icon} {order.status}</span>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => onShowQR(order)} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", height:34, padding:"0 12px", borderRadius:8, fontWeight:700, fontSize:12, cursor:"pointer" }}>🖨️ In QR</button>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:34, height:34, borderRadius:"50%", fontSize:17, cursor:"pointer" }}>✕</button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid #e5e7eb" }}>
          {[["info","📄 Thông tin"],["parts","🔩 Linh kiện"],["chat",`💬 Chat(${chats.length})`],["qr","📱 QR"]].map(([t,lbl]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex:1, padding:"11px", border:"none", background:"none", fontWeight:700, fontSize:13, cursor:"pointer", borderBottom:tab===t?"3px solid #4f46e5":"3px solid transparent", color:tab===t?"#4f46e5":"#6b7280" }}>
              {lbl}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <div style={{ flex:1, overflowY:"auto", padding:18 }}>
            <AcceptTimer order={order} onAccept={handleAccept} onOpenChecklist={handleOpenChecklist} currentUser={currentUser} />
            {/* Customer */}
            <div style={{ background:"#eef2ff", borderRadius:14, padding:14, marginBottom:14 }}>
              <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>👤 {cust?.full_name}</div>
              <a href={`tel:${cust?.phone}`} style={{ color:"#4f46e5", fontWeight:700, fontSize:15 }}>📞 {cust?.phone}</a>
            </div>
            {/* Grid info */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[
                { label:"📱 Thiết bị", val:order.device_model },
                { label:"👨‍🔧 KTV",    val:assignee?.name||"—" },
                { label:"IMEI",        val:order.imei_serial||"—", mono:true },
                { label:"🔑 Mã PIN",   val:order.passcode||"—", hi:!!order.passcode },
                ...(order.qr_code ? [{ label:"📲 Mã QR", val:order.qr_code, mono:true }] : []),
              ].map(f => (
                <div key={f.label} style={{ background:f.hi?"#fffbeb":"#f9fafb", borderRadius:12, padding:12 }}>
                  <div style={{ fontSize:11, color:"#9ca3af", marginBottom:4 }}>{f.label}</div>
                  <div style={{ fontWeight:700, fontSize:13, fontFamily:f.mono?"monospace":"inherit", color:f.hi?"#b45309":"#111", wordBreak:"break-all" }}>{f.val}</div>
                </div>
              ))}
            </div>
            {/* Issues */}
            {order.issues.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, color:"#9ca3af", marginBottom:6 }}>🛠️ Lỗi báo cáo:</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {order.issues.map(i => <span key={i} style={{ background:"#fee2e2", color:"#991b1b", fontSize:12, padding:"4px 10px", borderRadius:20, fontWeight:600 }}>{i}</span>)}
                </div>
              </div>
            )}
            {order.notes && <div style={{ background:"#fffbeb", borderRadius:12, padding:12, marginBottom:14, fontSize:14, color:"#92400e" }}>📝 {order.notes}</div>}
            {/* Images — bấm mở to */}
            {order.images?.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, color:"#9ca3af", marginBottom:6 }}>📸 Hình ảnh & video ({order.images.length}):</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {order.images.map((url,i) => (
                    <div key={i} onClick={() => setMediaViewer({ items:order.images, startIndex:i })}
                      style={{ width:84, height:84, borderRadius:12, overflow:"hidden", cursor:"pointer", border:"2px solid #e0e7ff", position:"relative", flexShrink:0, background:"#1f2937" }}>
                      {url.startsWith("video:")
                        ? <div style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4 }}>
                            <span style={{ fontSize:28 }}>🎥</span>
                            <span style={{ fontSize:10, color:"#9ca3af" }}>Video</span>
                          </div>
                        : <img src={url} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" />
                      }
                      {/* Play overlay */}
                      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0)", display:"flex", alignItems:"center", justifyContent:"center", transition:"background .15s" }}
                        onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,.3)"}
                        onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,0)"}>
                        <span style={{ fontSize:20, color:"#fff", textShadow:"0 1px 4px rgba(0,0,0,.8)", opacity:.85 }}>{url.startsWith("video:")?"▶":"🔍"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Status + Actions — KTV cần bấm "Chỉnh" để edit */}
            {!["Hoàn Thành","Đã Giao"].includes(order.status) && (currentUser.role==="manager" || isMyOrder) && (
              <div style={{ marginBottom:14 }}>
                {/* Toggle edit mode for KTV */}
                {isKTV && !editMode && (
                  <button onClick={() => setEditMode(true)}
                    style={{ width:"100%", height:52, borderRadius:14, border:"2px solid #4f46e5", background:"#eef2ff", color:"#4f46e5", fontWeight:800, fontSize:16, cursor:"pointer", marginBottom:8 }}>
                    ✏️ Cập nhật trạng thái
                  </button>
                )}
                {(!isKTV || editMode) && (
                  <>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"#374151" }}>⚙️ Chọn trạng thái:</div>
                      {isKTV && <button onClick={() => setEditMode(false)} style={{ background:"none", border:"none", color:"#9ca3af", fontSize:13, cursor:"pointer" }}>✕ Đóng</button>}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                      {STATUS_COLS.filter(c => c.key !== "Đã Giao").map(c => (
                        <button key={c.key} onClick={() => { if(c.key==="Hoàn Thành") handleMarkDone(); else { onUpdate(order.id,{status:c.key},null); setEditMode(false); } }}
                          style={{ padding:"12px 8px", borderRadius:12, border:`2px solid ${order.status===c.key?c.color:"#e5e7eb"}`, background:order.status===c.key?c.bg:"#fff", color:order.status===c.key?c.color:"#374151", fontWeight:700, fontSize:13, cursor:"pointer", textAlign:"center" }}>
                          <div style={{ fontSize:18 }}>{c.icon}</div>
                          <div style={{ fontSize:12, marginTop:2 }}>{c.key}</div>
                        </button>
                      ))}
                    </div>
                    <button onClick={handleMarkDone}
                      style={{ width:"100%", height:54, borderRadius:14, background:"#059669", color:"#fff", border:"none", fontWeight:800, fontSize:17, cursor:"pointer" }}>
                      ✅ Sửa Xong! (+2 KPI)
                    </button>
                  </>
                )}
              </div>
            )}
            {/* Thời gian dự kiến */}
            {order.estimated_done && (
              <div style={{ background:"#f0fdf4", borderRadius:12, padding:"10px 14px", marginBottom:14, fontSize:13 }}>
                <span style={{ color:"#059669", fontWeight:700 }}>⏱️ Dự kiến xong: </span>
                <span style={{ fontWeight:600 }}>{new Date(order.estimated_done).toLocaleString("vi-VN",{dateStyle:"short",timeStyle:"short"})}</span>
              </div>
            )}
          </div>
        )}

        {tab === "chat" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ flex:1, overflowY:"auto", padding:14, display:"flex", flexDirection:"column", gap:10, background:"#f9fafb" }}>
              {chats.length===0 && <div style={{ textAlign:"center", color:"#9ca3af", marginTop:32, fontSize:13 }}>Chưa có tin nhắn</div>}
              {chats.map(msg => {
                const isMe = msg.sender_id === currentUser.id;
                return (
                  <div key={msg.id} style={{ display:"flex", justifyContent:isMe?"flex-end":"flex-start", gap:8, alignItems:"flex-end" }}>
                    {!isMe && <div style={{ width:30, height:30, borderRadius:"50%", background:"#818cf8", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:12, flexShrink:0 }}>{msg.sender_name[0]}</div>}
                    <div style={{ maxWidth:"75%" }}>
                      {!isMe && <div style={{ fontSize:11, color:"#4f46e5", fontWeight:700, marginBottom:2 }}>{msg.sender_name}</div>}
                      <div style={{ padding:"10px 14px", borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px", background:isMe?"#4f46e5":"#fff", color:isMe?"#fff":"#111", fontSize:14, border:isMe?"none":"1px solid #e5e7eb" }}>
                        {msg.message}
                      </div>
                      <div style={{ fontSize:11, color:"#9ca3af", marginTop:2, textAlign:isMe?"right":"left" }}>{timeAgo(msg.created)}</div>
                    </div>
                    {isMe && <div style={{ width:30, height:30, borderRadius:"50%", background:"#4f46e5", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:12, flexShrink:0 }}>{currentUser.name[0]}</div>}
                  </div>
                );
              })}
              <div ref={chatRef} />
            </div>
            <div style={{ padding:"10px 14px", borderTop:"1px solid #e5e7eb", display:"flex", gap:8, background:"#fff" }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key==="Enter"&&sendChat()}
                placeholder="Nhắn tin..." style={{ flex:1, height:46, borderRadius:24, border:"1.5px solid #e5e7eb", padding:"0 16px", fontSize:14, outline:"none" }} />
              <button onClick={sendChat} style={{ width:46, height:46, borderRadius:"50%", background:"#4f46e5", border:"none", color:"#fff", fontSize:18, cursor:"pointer" }}>➤</button>
            </div>
          </div>
        )}
        {tab === "parts" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔩</div>
            <div style={{ fontWeight:800, fontSize:16, color:"#1e1b4b", marginBottom:6 }}>Quản lý linh kiện</div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:20, textAlign:"center" }}>Chọn linh kiện, auto chat kho,<br/>trả linh kiện và bấm Sửa Xong.</div>
            <button onClick={() => setShowSparePart(true)}
              style={{ height:52, padding:"0 32px", background:"linear-gradient(135deg,#4f46e5,#7c3aed)", color:"#fff", border:"none", borderRadius:16, fontWeight:800, fontSize:16, cursor:"pointer", boxShadow:"0 4px 16px rgba(79,70,229,.4)" }}>
              🔩 Mở màn hình linh kiện
            </button>
          </div>
        )}

        {showSparePart && (
          <Suspense fallback={<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:"#fff",fontSize:18}}>⏳ Đang tải...</div></div>}>
            <SparePartModal
              order={order}
              currentStaff={currentUser}
              onClose={() => setShowSparePart(false)}
              onDone={() => { setShowSparePart(false); onUpdate(order.id, { status:"Hoàn Thành" }, { userId:order.assigned_to, delta:2, note:"Sửa xong +2 KPI" }); onClose(); }}
            />
          </Suspense>
        )}

        {tab === "qr" && (
          <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ fontWeight:800, fontSize:16, marginBottom:4, textAlign:"center" }}>📱 Mã QR Phiếu Sửa</div>
            <div style={{ color:"#6b7280", fontSize:13, marginBottom:16, textAlign:"center" }}>Dán lên máy để tra cứu nhanh</div>
            <div style={{ background:"#f9fafb", borderRadius:20, padding:24, marginBottom:16, textAlign:"center", border:"2px dashed #a5b4fc" }}>
              <QRCanvas key={qrContent} text={qrContent} size={180} />
              <div style={{ fontWeight:800, fontSize:18, color:"#1e1b4b", marginTop:10 }}>{order.id}</div>
              {order.qr_code && <div style={{ fontSize:12, color:"#818cf8", fontFamily:"monospace" }}>Mã QR máy: {order.qr_code}</div>}
              <div style={{ fontSize:13, color:"#6b7280" }}>{cust?.full_name} · {order.device_model}</div>
            </div>
            <button onClick={() => onShowQR(order)} style={{ width:"100%", height:52, borderRadius:14, background:"#1e1b4b", color:"#fff", border:"none", fontWeight:800, fontSize:16, cursor:"pointer" }}>
              🖨️ In Phiếu QR
            </button>
            <div style={{ fontSize:12, color:"#9ca3af", textAlign:"center", marginTop:10 }}>QR chứa mã đơn: <strong>{qrContent}</strong></div>
          </div>
        )}
      </div>
    </div>
    {showChecklist && checklistTarget && (
      <AcceptChecklistModal
        order={checklistTarget.ord}
        onConfirm={handleChecklistConfirm}
        onClose={() => setShowChecklist(false)}
      />
    )}
    {mediaViewer && (
      <MediaViewer
        items={mediaViewer.items}
        startIndex={mediaViewer.startIndex}
        onClose={() => setMediaViewer(null)}
      />
    )}
    </>
  );
}

// ══════════════════════════════════════════════
//  NEW ORDER MODAL
//  Logic QR:
//  - Quét QR → tìm đơn cũ theo qr_code
//    → Có: hiện thông tin cũ, hỏi tạo đơn mới
//    → Không: ghi nhận mã QR đó vào đơn mới
// ══════════════════════════════════════════════
function NewOrderModal({ onClose, onCreate, users, orders }) {
  const [form, setForm] = useState({ customer_id:"", device_model:"", imei_serial:"", passcode:"", qr_code:"", issues:[], notes:"", assigned_to:"" });
  const [custSearch, setCustSearch] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [showQRScan, setShowQRScan] = useState(false);
  const [qrMsg, setQrMsg] = useState(null); // { type:"new"|"found", code, prevOrder }
  const photoRef = useRef(); const videoRef = useRef(); const fileRef = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]:v }));
  const filteredCusts = custSearch.length > 1
    ? MOCK_CUSTOMERS.filter(c => c.full_name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch))
    : [];

  function handleFiles(e) {
    const items = Array.from(e.target.files).map(f => ({ id:Math.random().toString(36), file:f, type:f.type.startsWith("video/")?"video":"image", url:URL.createObjectURL(f), name:f.name }));
    setMediaFiles(p => [...p, ...items]); e.target.value = "";
  }

  function handleQRResult(result) {
    setShowQRScan(false);
    if (result.type !== "raw") return;
    const code = result.code;
    // Tìm đơn cũ theo qr_code
    const prevOrder = orders.find(o => o.qr_code === code);
    if (prevOrder) {
      // Đã có data → load thông tin vào form, báo cho user
      const cust = MOCK_CUSTOMERS.find(c => c.id === prevOrder.customer_id);
      set("qr_code", code);
      set("device_model", prevOrder.device_model);
      set("imei_serial", prevOrder.imei_serial || "");
      set("passcode", prevOrder.passcode || "");
      set("issues", [...prevOrder.issues]);
      set("notes", prevOrder.notes || "");
      if (cust) { set("customer_id", prevOrder.customer_id); setCustSearch(`${cust.full_name} — ${cust.phone}`); }
      setQrMsg({ type:"found", code, prevOrder });
    } else {
      // Chưa có → ghi nhận mã QR mới vào đơn
      set("qr_code", code);
      setQrMsg({ type:"new", code });
    }
  }

  function submit() {
    if (!form.customer_id || !form.device_model) { alert("Vui lòng chọn khách hàng và nhập thiết bị!"); return; }
    const imgUrls = mediaFiles.map(m => m.type==="video" ? `video:${m.name}` : m.url);
    onCreate({ ...form, id:genOrderId(), created:new Date().toISOString(), assigned_at:form.assigned_to?new Date().toISOString():null, accept_stage:0, status:"Mới Nhận", images:imgUrls });
    onClose();
  }

  const inp = { width:"100%", height:48, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:15, outline:"none", boxSizing:"border-box" };
  const lbl = { fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:6 };
  const sec = { background:"#f9fafb", borderRadius:16, padding:16, marginBottom:14 };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:22, width:"100%", maxWidth:540, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,.25)" }}>
        {/* Header */}
        <div style={{ position:"sticky", top:0, background:"#3730a3", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", borderRadius:"22px 22px 0 0" }}>
          <div style={{ color:"#fff", fontWeight:800, fontSize:18 }}>➕ Tạo Đơn Mới</div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:34, height:34, borderRadius:"50%", fontSize:16, cursor:"pointer" }}>✕</button>
        </div>

        <div style={{ padding:"20px 20px 8px" }}>
          {/* ── QR SECTION ── */}
          <div style={{ ...sec, background:"#eef2ff", border:"1.5px solid #a5b4fc" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#3730a3", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>📲 Mã QR Máy</span>
              <button onClick={() => setShowQRScan(true)}
                style={{ height:36, padding:"0 14px", borderRadius:10, background:"#4f46e5", color:"#fff", border:"none", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                📷 Quét QR
              </button>
            </div>
            <input value={form.qr_code} onChange={e => { set("qr_code", e.target.value); setQrMsg(null); }}
              placeholder="Quét hoặc nhập mã QR trên máy..."
              style={{ ...inp, fontFamily:"monospace", background:form.qr_code?"#f0fdf4":"#fff", borderColor:form.qr_code?"#6ee7b7":"#e5e7eb" }} />

            {/* QR result message */}
            {qrMsg?.type === "found" && (
              <div style={{ marginTop:10, background:"#fffbeb", borderRadius:12, padding:"10px 14px", border:"1.5px solid #fcd34d" }}>
                <div style={{ fontWeight:800, color:"#d97706", marginBottom:4 }}>⚡ Đã tìm thấy dữ liệu cũ — điền tự động!</div>
                <div style={{ fontSize:13, color:"#374151" }}>Đơn gần nhất: <strong>{qrMsg.prevOrder.id}</strong> · {qrMsg.prevOrder.status}</div>
                <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>Thông tin thiết bị đã được tải vào form. Kiểm tra lại rồi tạo đơn mới.</div>
              </div>
            )}
            {qrMsg?.type === "new" && (
              <div style={{ marginTop:10, background:"#f0fdf4", borderRadius:12, padding:"10px 14px", border:"1.5px solid #6ee7b7" }}>
                <div style={{ fontWeight:800, color:"#059669", marginBottom:2 }}>✅ Mã QR mới — sẽ gắn vào đơn này</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>Mã: <strong style={{fontFamily:"monospace"}}>{qrMsg.code}</strong></div>
              </div>
            )}
          </div>

          {/* ── KHÁCH HÀNG ── */}
          <div style={{ ...sec, background:"#f0f9ff" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#0369a1", marginBottom:10 }}>👤 Khách Hàng</div>
            <label style={lbl}>Tìm theo SĐT hoặc tên *</label>
            <input value={custSearch} onChange={e => { setCustSearch(e.target.value); if(!e.target.value) set("customer_id",""); }}
              placeholder="🔍 0901234567 hoặc Nguyễn..." style={inp} />
            {filteredCusts.length > 0 && (
              <div style={{ marginTop:6, border:"1px solid #bae6fd", borderRadius:10, overflow:"hidden" }}>
                {filteredCusts.map(c => (
                  <div key={c.id} onClick={() => { set("customer_id", c.id); setCustSearch(`${c.full_name} — ${c.phone}`); }}
                    style={{ padding:"12px 14px", cursor:"pointer", background:form.customer_id===c.id?"#e0f2fe":"#fff", borderBottom:"1px solid #f3f4f6", fontSize:14 }}>
                    <div style={{ fontWeight:700 }}>{c.full_name}</div>
                    <div style={{ color:"#6b7280", fontSize:12 }}>{c.phone}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── THIẾT BỊ ── */}
          <div style={sec}>
            <div style={{ fontWeight:800, fontSize:14, color:"#3730a3", marginBottom:10 }}>📱 Thiết Bị</div>
            <label style={lbl}>Tên / Model máy *</label>
            <input value={form.device_model} onChange={e => set("device_model", e.target.value)}
              placeholder="iPhone 15 Pro Max, Samsung S24..." style={{ ...inp, marginBottom:10 }} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <label style={lbl}>IMEI / Serial</label>
                <input value={form.imei_serial} onChange={e => set("imei_serial", e.target.value)} placeholder="358..." style={inp} />
              </div>
              <div>
                <label style={lbl}>🔑 Mã PIN</label>
                <input value={form.passcode} onChange={e => set("passcode", e.target.value)} placeholder="1234" style={inp} />
              </div>
            </div>
          </div>

          {/* ── TÌNH TRẠNG ── */}
          <div style={sec}>
            <div style={{ fontWeight:800, fontSize:14, color:"#3730a3", marginBottom:10 }}>🛠️ Tình Trạng Lỗi</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
              {ISSUE_OPTIONS.map(issue => (
                <button key={issue} onClick={() => set("issues", form.issues.includes(issue)?form.issues.filter(i=>i!==issue):[...form.issues,issue])}
                  style={{ padding:"14px 10px", borderRadius:12, border:`2px solid ${form.issues.includes(issue)?"#4f46e5":"#e5e7eb"}`, background:form.issues.includes(issue)?"#eef2ff":"#fff", color:form.issues.includes(issue)?"#4f46e5":"#374151", fontSize:14, fontWeight:form.issues.includes(issue)?800:500, cursor:"pointer", textAlign:"left", minHeight:48 }}>
                  {form.issues.includes(issue)?"✓ ":""}{issue}
                </button>
              ))}
            </div>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Ghi chú thêm..." rows={2}
              style={{ ...inp, height:"auto", padding:"12px 14px", resize:"vertical" }} />
          </div>

          {/* ── ẢNH / VIDEO ── */}
          <div style={{ ...sec, background:"#f0fdf4", border:"1.5px solid #6ee7b7" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#065f46", marginBottom:10 }}>📸 Hình Ảnh & Video Tình Trạng</div>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" multiple style={{ display:"none" }} onChange={handleFiles} />
            <input ref={videoRef} type="file" accept="video/*" capture="environment" style={{ display:"none" }} onChange={handleFiles} />
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display:"none" }} onChange={handleFiles} />
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <button onClick={() => photoRef.current?.click()} style={{ flex:1, height:60, borderRadius:14, border:"2px dashed #6ee7b7", background:"#f0fdf4", color:"#065f46", fontWeight:700, cursor:"pointer", fontSize:13 }}>📷 Chụp ảnh</button>
              <button onClick={() => videoRef.current?.click()} style={{ flex:1, height:60, borderRadius:14, border:"2px dashed #6ee7b7", background:"#f0fdf4", color:"#065f46", fontWeight:700, cursor:"pointer", fontSize:13 }}>🎥 Quay video</button>
            </div>
            <button onClick={() => fileRef.current?.click()} style={{ width:"100%", height:44, borderRadius:12, border:"1.5px solid #e5e7eb", background:"#f9fafb", color:"#6b7280", fontWeight:600, cursor:"pointer", fontSize:13 }}>📎 Chọn từ thư viện</button>
            {mediaFiles.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:10 }}>
                {mediaFiles.map(m => (
                  <div key={m.id} style={{ position:"relative", width:72, height:72 }}>
                    {m.type==="video"
                      ? <div style={{ width:72, height:72, borderRadius:10, background:"#1f2937", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, border:"2px solid #6ee7b7" }}>🎥</div>
                      : <img src={m.url} style={{ width:72, height:72, objectFit:"cover", borderRadius:10, border:"2px solid #6ee7b7" }} alt="" />
                    }
                    <button onClick={() => setMediaFiles(p => p.filter(x => x.id!==m.id))}
                      style={{ position:"absolute", top:-6, right:-6, width:20, height:20, borderRadius:"50%", background:"#ef4444", color:"#fff", border:"none", fontSize:11, fontWeight:900, cursor:"pointer" }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── PHÂN CÔNG ── */}
          <div style={sec}>
            <div style={{ fontWeight:800, fontSize:14, color:"#3730a3", marginBottom:10 }}>👨‍🔧 Phân Công KTV</div>
            <select value={form.assigned_to} onChange={e => set("assigned_to", e.target.value)} style={{ ...inp, background:"#fff" }}>
              <option value="">-- Chọn kỹ thuật viên --</option>
              {users.filter(u => u.role==="technician").map(u => <option key={u.id} value={u.id}>{u.name} (KPI: {u.kpi})</option>)}
            </select>
            {form.assigned_to && (
              <div style={{ marginTop:8, background:"#fffbeb", borderRadius:10, padding:"10px 12px", fontSize:13, color:"#92400e", fontWeight:600 }}>
                ⏰ KTV có <strong>15 phút</strong> để bấm nhận máy. Nếu không bấm sẽ <strong>−1 KPI</strong>.
              </div>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display:"flex", gap:10, marginBottom:20 }}>
            <button onClick={onClose} style={{ flex:1, height:52, borderRadius:14, border:"1.5px solid #e5e7eb", background:"#fff", fontSize:16, cursor:"pointer" }}>Huỷ</button>
            <button onClick={submit} style={{ flex:2, height:56, borderRadius:14, background:"#4f46e5", color:"#fff", border:"none", fontSize:16, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>🚀 Tạo Đơn</button>
          </div>
        </div>
      </div>

      {showQRScan && (
        <QRScanModal
          onClose={() => setShowQRScan(false)}
          onFound={handleQRResult}
          orders={orders}
          mode="capture"
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
//  KPI PAGE
// ══════════════════════════════════════════════
function KPIPage({ users, orders }) {
  const techs = users.filter(u => u.role === "technician");
  return (
    <div style={{ maxWidth:700, margin:"0 auto" }}>
      <div style={{ fontWeight:800, fontSize:22, marginBottom:4 }}>🏆 Đánh Giá KPI Kỹ Thuật</div>
      <div style={{ color:"#6b7280", fontSize:13, marginBottom:20 }}>Theo dõi hiệu suất nhận và xử lý đơn sửa chữa</div>

      {/* Rules */}
      <div style={{ background:"#fff", borderRadius:18, padding:20, marginBottom:20, boxShadow:"0 1px 8px rgba(0,0,0,.07)" }}>
        <div style={{ fontWeight:800, fontSize:15, marginBottom:12, color:"#3730a3" }}>📋 Quy Tắc KPI</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr style={{ background:"#eef2ff" }}>
            <th style={{ padding:"9px 12px", textAlign:"left", fontWeight:700 }}>Sự kiện</th>
            <th style={{ padding:"9px 12px", textAlign:"center", color:"#059669", fontWeight:700 }}>Đúng hạn</th>
            <th style={{ padding:"9px 12px", textAlign:"center", color:"#dc2626", fontWeight:700 }}>Quá hạn</th>
          </tr></thead>
          <tbody>
            {[
              ["Nhận máy lần 1 (0–15 phút)","+0","−1 KPI"],
              ["Nhận máy lần 2 (0–60 phút sau lần 1)","+0","−1 KPI + giao lại quản lý"],
              ["Nhận máy lần 3 (1300–1500 phút sau lần 2)","+0","−2 KPI"],
              ["Sửa hoàn thành","+2 KPI","—"],
            ].map(([l,ok,bad],i) => (
              <tr key={i} style={{ borderBottom:"1px solid #f3f4f6" }}>
                <td style={{ padding:"9px 12px", fontWeight:600 }}>{l}</td>
                <td style={{ padding:"9px 12px", textAlign:"center", color:"#059669", fontWeight:700 }}>{ok}</td>
                <td style={{ padding:"9px 12px", textAlign:"center", color:"#dc2626", fontWeight:700 }}>{bad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))", gap:16, marginBottom:20 }}>
        {techs.map(u => {
          const myOrd = orders.filter(o => o.assigned_to===u.id);
          const kc = u.kpi>=8?"#059669":u.kpi>=5?"#d97706":"#dc2626";
          const kb = u.kpi>=8?"#ecfdf5":u.kpi>=5?"#fffbeb":"#fef2f2";
          return (
            <div key={u.id} style={{ background:"#fff", borderRadius:18, padding:20, boxShadow:"0 1px 8px rgba(0,0,0,.07)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <div style={{ width:50, height:50, borderRadius:"50%", background:"#4f46e5", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:20 }}>{u.name[0]}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800, fontSize:16 }}>{u.name}</div>
                  <div style={{ fontSize:12, color:"#6b7280" }}>{ROLE_LABELS[u.role]}</div>
                </div>
                <div style={{ textAlign:"center", background:kb, borderRadius:12, padding:"8px 14px", border:`2px solid ${kc}` }}>
                  <div style={{ fontSize:26, fontWeight:900, color:kc, lineHeight:1 }}>{u.kpi}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:kc }}>KPI</div>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                {[{l:"Đang làm",v:myOrd.filter(o=>!["Đã Giao","Hoàn Thành"].includes(o.status)).length,c:"#d97706"},{l:"Đã xong",v:myOrd.filter(o=>["Hoàn Thành","Đã Giao"].includes(o.status)).length,c:"#059669"},{l:"Tổng",v:myOrd.length,c:"#4f46e5"}].map(s=>(
                  <div key={s.l} style={{ background:"#f9fafb", borderRadius:10, padding:"8px 6px", textAlign:"center" }}>
                    <div style={{ fontSize:20, fontWeight:900, color:s.c }}>{s.v}</div>
                    <div style={{ fontSize:11, color:"#9ca3af" }}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{ height:8, background:"#f3f4f6", borderRadius:10, overflow:"hidden", marginBottom:8 }}>
                <div style={{ height:"100%", width:`${Math.min(100,u.kpi*10)}%`, background:kc, borderRadius:10 }} />
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:kc, textAlign:"center", padding:"5px", background:kb, borderRadius:8 }}>
                {u.kpi>=9?"⭐ Xuất sắc":u.kpi>=7?"👍 Tốt":u.kpi>=5?"⚠️ Trung bình":"❌ Cần cải thiện"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leaderboard */}
      <div style={{ background:"#fff", borderRadius:18, padding:20, boxShadow:"0 1px 8px rgba(0,0,0,.07)" }}>
        <div style={{ fontWeight:800, fontSize:15, marginBottom:12, color:"#3730a3" }}>🏅 Bảng Xếp Hạng</div>
        {[...techs].sort((a,b)=>b.kpi-a.kpi).map((u,i) => {
          const kc = u.kpi>=8?"#059669":u.kpi>=5?"#d97706":"#dc2626";
          return (
            <div key={u.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:i<techs.length-1?"1px solid #f3f4f6":"none" }}>
              <span style={{ fontSize:22, width:30 }}>{["🥇","🥈","🥉"][i]||`#${i+1}`}</span>
              <div style={{ width:38, height:38, borderRadius:"50%", background:"#4f46e5", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>{u.name[0]}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700 }}>{u.name}</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>{orders.filter(o=>o.assigned_to===u.id).length} đơn</div>
              </div>
              <div style={{ fontSize:26, fontWeight:900, color:kc }}>{u.kpi}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════
function LoginPage({ onLogin, users }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = () => {
    if (!username.trim() || !password.trim()) { setErr("Vui lòng nhập đầy đủ thông tin!"); return; }
    setLoading(true);
    setErr("");
    setTimeout(() => {
      const found = users.find(u => u.username === username.trim() && u.password === password.trim() && u.active !== false);
      if (found) {
        onLogin(found);
      } else {
        setErr("Tên đăng nhập hoặc mật khẩu không đúng!");
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1e1b4b,#4f46e5,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:24, padding:40, width:"100%", maxWidth:400, boxShadow:"0 24px 64px rgba(0,0,0,.3)" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:56 }}>🔧</div>
          <div style={{ fontWeight:900, fontSize:24, color:"#1e1b4b", marginTop:8 }}>Quản Lý Sửa Chữa</div>
          <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Hệ thống nội bộ</div>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>👤 Tên đăng nhập</label>
          <input
            value={username} onChange={e => { setUsername(e.target.value); setErr(""); }}
            onKeyDown={e => e.key==="Enter" && doLogin()}
            placeholder="Nhập username..."
            style={{ width:"100%", height:50, borderRadius:12, border:`2px solid ${err?"#ef4444":"#e5e7eb"}`, padding:"0 16px", fontSize:15, outline:"none", boxSizing:"border-box", transition:"border .2s" }}
            autoFocus
          />
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>🔑 Mật khẩu</label>
          <div style={{ position:"relative" }}>
            <input
              id="login-pw"
              value={password} onChange={e => { setPassword(e.target.value); setErr(""); }}
              onKeyDown={e => e.key==="Enter" && doLogin()}
              placeholder="Nhập mật khẩu..."
              style={{ width:"100%", height:50, borderRadius:12, border:`2px solid ${err?"#ef4444":"#e5e7eb"}`, padding:"0 50px 0 16px", fontSize:15, outline:"none", boxSizing:"border-box", WebkitTextSecurity: showPw ? "none" : "disc", letterSpacing: showPw ? "normal" : "0.1em" }}
            />
            <button onClick={() => setShowPw(v=>!v)} type="button"
              style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#9ca3af" }}>
              {showPw ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        {err && (
          <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#dc2626", fontWeight:600 }}>
            ⚠️ {err}
          </div>
        )}

        <button onClick={doLogin} disabled={loading}
          style={{ width:"100%", height:54, background:loading?"#a5b4fc":"#4f46e5", color:"#fff", border:"none", borderRadius:14, fontSize:18, fontWeight:800, cursor:loading?"not-allowed":"pointer", transition:"background .2s" }}>
          {loading ? "⏳ Đang kiểm tra..." : "🚀 Đăng Nhập"}
        </button>

        <div style={{ marginTop:20, padding:14, background:"#f8fafc", borderRadius:12, fontSize:12, color:"#6b7280" }}>
          <div style={{ fontWeight:700, marginBottom:6 }}>💡 Tài khoản demo:</div>
          <div>👑 admin / admin123 — Quản lý</div>
          <div>🗂️ tieptan / 123456 — Tiếp tân</div>
          <div>🔧 ktv1 / 123456 — Kỹ thuật viên</div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════
export default function Home() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState(MOCK_ORDERS_INIT);
  const [users, setUsers] = useState(MOCK_USERS);
  const [page, setPage] = useState("board");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [qrOrder, setQrOrder] = useState(null);
  const [showQRScan, setShowQRScan] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [createdOrder, setCreatedOrder] = useState(null); // toast xác nhận tạo đơn

  if (!user) return <LoginPage users={users} onLogin={u => { setUser(u); setPage(u.role==="technician"?"tasks":u.role==="receptionist"?"new":"dashboard"); }} />;

  function updateOrder(id, patch, kpiEvent) {
    setOrders(p => p.map(o => o.id===id ? {...o,...patch} : o));
    if (selectedOrder?.id===id) setSelectedOrder(p => ({...p,...patch}));
    if (kpiEvent) setUsers(p => p.map(u => u.id===kpiEvent.userId ? {...u, kpi:Math.max(0,u.kpi+kpiEvent.delta)} : u));
  }
  function createOrder(data) {
    setOrders(p => [data, ...p]);
    if (data.assigned_to) {
      const ktv = users.find(u => u.id===data.assigned_to);
      setNotifications(n => [{ id:Math.random().toString(36), msg:`🔔 Đơn ${data.id} giao cho ${ktv?.name}. 15 phút nhận máy!`, time:new Date().toISOString() }, ...n.slice(0,9)]);
    }
    setCreatedOrder(data);
    setPage("board");
  }
  function goToPendingAccept() {
    setPage("tasks");
    const p = orders.find(o => o.assigned_to===user.id && o.accept_stage<3 && o.assigned_at);
    if (p) { setHighlightId(p.id); setTimeout(() => setHighlightId(null), 3000); }
  }
  function handleGlobalQRScan(result) {
    setShowQRScan(false);
    if (result.type === "order") setSelectedOrder(result.data);
  }

  const myOrders = user.role==="technician" ? orders.filter(o => o.assigned_to===user.id) : orders;
  const filtered = myOrders.filter(o => {
    if (!search) return true;
    const c = MOCK_CUSTOMERS.find(x => x.id===o.customer_id);
    return c?.full_name.toLowerCase().includes(search.toLowerCase()) || c?.phone.includes(search) || o.device_model.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase()) || (o.qr_code||"").toLowerCase().includes(search.toLowerCase());
  });
  const pendingAccepts = orders.filter(o => o.assigned_to===user.id && o.accept_stage<3 && o.assigned_at && !["Hoàn Thành","Đã Giao"].includes(o.status));

  const navItems = [
    ...(user.role==="manager"?[{key:"dashboard",icon:"📊",label:"Tổng quan"}]:[]),
    ...(user.role!=="technician"?[{key:"board",icon:"📋",label:"Bảng theo dõi"},{key:"new",icon:"➕",label:"Tạo đơn mới"}]:[]),
    {key:"tasks",icon:"✅",label:user.role==="manager"?"Tất cả việc":"Việc của tôi"},
    ...(user.role!=="receptionist"?[{key:"kpi",icon:"🏆",label:"KPI Kỹ thuật"}]:[]),
    ...(user.role!=="technician"?[{key:"customers",icon:"👥",label:"Khách hàng"}]:[]),
    ...(user.role==="manager"?[{key:"staff",icon:"👨‍💼",label:"Nhân viên"},{key:"settings",icon:"⚙️",label:"Cài đặt"}]:[]),
  ];

  const Sidebar = () => (
    <div style={{ width:220, background:"#1e1b4b", height:"100%", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"20px 16px", borderBottom:"1px solid rgba(255,255,255,.1)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:28 }}>🔧</div>
          <div><div style={{ color:"#fff", fontWeight:800, fontSize:15 }}>Sửa Chữa</div><div style={{ color:"#a5b4fc", fontSize:11 }}>Quản lý đơn hàng</div></div>
        </div>
      </div>
      <div style={{ flex:1, padding:"12px 0", overflowY:"auto" }}>
        {navItems.map(item => (
          <div key={item.key} onClick={() => { setPage(item.key); setSidebarOpen(false); }}
            style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 20px", cursor:"pointer", background:page===item.key?"rgba(255,255,255,.12)":"transparent", borderLeft:page===item.key?"3px solid #a5b4fc":"3px solid transparent" }}>
            <span style={{ fontSize:18 }}>{item.icon}</span>
            <span style={{ color:page===item.key?"#fff":"#c7d2fe", fontWeight:page===item.key?700:400, fontSize:14 }}>{item.label}</span>
            {item.key==="tasks" && pendingAccepts.length>0 && user.role==="technician" && (
              <span style={{ marginLeft:"auto", background:"#ef4444", color:"#fff", fontSize:11, fontWeight:800, padding:"1px 7px", borderRadius:20 }}>{pendingAccepts.length}</span>
            )}
          </div>
        ))}
      </div>
      <div style={{ padding:16, borderTop:"1px solid rgba(255,255,255,.1)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:"#4f46e5", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, color:"#fff" }}>{user.name[0]}</div>
          <div>
            <div style={{ color:"#fff", fontWeight:700, fontSize:13 }}>{user.name}</div>
            <div style={{ color:"#a5b4fc", fontSize:11 }}>{ROLE_LABELS[user.role]} · KPI {users.find(u=>u.id===user.id)?.kpi}</div>
          </div>
        </div>
        <button onClick={() => setUser(null)} style={{ width:"100%", height:36, borderRadius:10, background:"rgba(239,68,68,.2)", border:"1px solid rgba(239,68,68,.4)", color:"#fca5a5", fontWeight:700, cursor:"pointer", fontSize:13 }}>🚪 Đăng xuất</button>
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <style>{`@media(min-width:1024px){.lg-sb{display:flex!important;flex-shrink:0}.mob-h{display:none!important}}`}</style>
      <div style={{ display:"none" }} className="lg-sb"><Sidebar /></div>
      {sidebarOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:500, display:"flex" }}>
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.5)" }} onClick={() => setSidebarOpen(false)} />
          <div style={{ position:"relative", width:240 }}><Sidebar /></div>
        </div>
      )}

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Mobile header */}
        <div className="mob-h" style={{ background:"#1e1b4b", padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background:"none", border:"none", color:"#fff", fontSize:22, cursor:"pointer" }}>☰</button>
          <span style={{ color:"#fff", fontWeight:800, flex:1, fontSize:16 }}>🔧 Sửa Chữa</span>
          <div style={{ width:32, height:32, borderRadius:"50%", background:"#4f46e5", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700 }}>{user.name[0]}</div>
        </div>

        {/* Topbar */}
        <div style={{ background:"#fff", borderBottom:"1px solid #e5e7eb", padding:"10px 16px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm khách, SĐT, mã đơn, mã QR..."
            style={{ flex:1, minWidth:150, height:42, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:14, outline:"none" }} />
          <button onClick={() => setShowQRScan(true)}
            style={{ height:42, padding:"0 14px", borderRadius:10, border:"1.5px solid #4f46e5", background:"#eef2ff", color:"#4f46e5", fontWeight:700, fontSize:13, cursor:"pointer", whiteSpace:"nowrap" }}>
            📷 Quét QR
          </button>
          {/* Notifications */}
          <div style={{ position:"relative" }}>
            <button onClick={() => setShowNotif(v => !v)}
              style={{ position:"relative", height:42, padding:"0 12px", borderRadius:10, border:"1.5px solid #e5e7eb", background:"#fff", cursor:"pointer", fontSize:18 }}>
              🔔{notifications.length>0 && <span style={{ position:"absolute", top:-4, right:-4, background:"#ef4444", color:"#fff", fontSize:10, fontWeight:800, padding:"1px 5px", borderRadius:20 }}>{notifications.length}</span>}
            </button>
            {showNotif && (
              <>
                {/* Overlay bấm ngoài → đóng */}
                <div style={{ position:"fixed", inset:0, zIndex:299 }} onClick={() => setShowNotif(false)} />
                <div style={{ position:"absolute", right:0, top:48, width:300, background:"#fff", borderRadius:14, boxShadow:"0 8px 32px rgba(0,0,0,.18)", border:"1px solid #e5e7eb", zIndex:300, overflow:"hidden" }}>
                  <div style={{ padding:"12px 16px", fontWeight:800, borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span>🔔 Thông báo</span>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      {notifications.length>0 && <button onClick={() => setNotifications([])} style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:12, fontWeight:700 }}>Xoá hết</button>}
                      <button onClick={() => setShowNotif(false)} style={{ background:"#f3f4f6", border:"none", width:26, height:26, borderRadius:"50%", cursor:"pointer", fontSize:13 }}>✕</button>
                    </div>
                  </div>
                  {notifications.length===0
                    ? <div style={{ padding:24, textAlign:"center", color:"#9ca3af", fontSize:13 }}>
                        <div style={{ fontSize:32, marginBottom:8 }}>🔕</div>Không có thông báo
                      </div>
                    : notifications.map(n => (
                      <div key={n.id} style={{ padding:"12px 16px", borderBottom:"1px solid #f9fafb", fontSize:13, display:"flex", gap:10, alignItems:"flex-start" }}>
                        <span style={{ fontSize:18, flexShrink:0 }}>🔔</span>
                        <div>
                          <div style={{ fontWeight:600, lineHeight:1.4 }}>{n.msg}</div>
                          <div style={{ color:"#9ca3af", fontSize:11, marginTop:2 }}>{timeAgo(n.time)}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
          {user.role !== "technician" && (
            <button onClick={() => setShowNewOrder(true)}
              style={{ height:42, padding:"0 16px", background:"#4f46e5", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:14, cursor:"pointer", whiteSpace:"nowrap" }}>
              ＋ Tạo đơn
            </button>
          )}
        </div>

        {/* Pending alert */}
        {user.role==="technician" && pendingAccepts.length>0 && (
          <div style={{ background:"#fef2f2", borderBottom:"2px solid #fca5a5", padding:"10px 16px", display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:18 }}>⚠️</span>
            <div style={{ flex:1 }}><span style={{ fontWeight:800, color:"#dc2626", fontSize:14 }}>Bạn có {pendingAccepts.length} đơn chờ bấm nhận máy!</span></div>
            <button onClick={goToPendingAccept} style={{ background:"#dc2626", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", fontWeight:800, cursor:"pointer", fontSize:14 }}>Xem ngay →</button>
          </div>
        )}

        {/* ── CONTENT ── */}
        <div style={{ flex:1, overflowY:"auto", padding:16, background:"#f3f4f6" }}>

          {/* DASHBOARD */}
          {page==="dashboard" && (
            <div>
              <div style={{ fontWeight:800, fontSize:20, marginBottom:16 }}>📊 Tổng Quan</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:12, marginBottom:20 }}>
                {[
                  {l:"Tổng đơn",v:orders.length,c:"#4f46e5"},
                  {l:"Đang xử lý",v:orders.filter(o=>["Mới Nhận","Đang Sửa","Chờ Linh Kiện"].includes(o.status)).length,c:"#d97706"},
                  {l:"Hoàn thành",v:orders.filter(o=>o.status==="Hoàn Thành").length,c:"#059669"},
                  {l:"Đã giao",v:orders.filter(o=>o.status==="Đã Giao").length,c:"#2563eb"},
                ].map(s => (
                  <div key={s.l} style={{ background:"#fff", borderRadius:14, padding:"14px 16px", boxShadow:"0 1px 4px rgba(0,0,0,.06)", borderTop:`3px solid ${s.c}` }}>
                    <div style={{ fontSize:12, color:"#6b7280", marginBottom:2 }}>{s.l}</div>
                    <div style={{ fontSize:30, fontWeight:900, color:s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:"#fff", borderRadius:16, padding:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
                <div style={{ fontWeight:700, marginBottom:12 }}>🕐 Đơn gần đây</div>
                {orders.slice(0,8).map(o => {
                  const c = MOCK_CUSTOMERS.find(x => x.id===o.customer_id);
                  const col = STATUS_COLS.find(s => s.key===o.status);
                  return (
                    <div key={o.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid #f3f4f6", cursor:"pointer" }} onClick={() => setSelectedOrder(o)}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:14 }}>{c?.full_name} — {o.device_model}</div>
                        <div style={{ fontSize:12, color:"#818cf8" }}>{o.id}{o.qr_code ? ` · QR: ${o.qr_code}` : ""} · {timeAgo(o.created)}</div>
                      </div>
                      <span style={{ fontSize:11, background:col?.bg, color:col?.color, padding:"3px 10px", borderRadius:20, fontWeight:700 }}>{col?.icon} {o.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* KPI */}
          {page==="kpi" && <KPIPage users={users} orders={orders} />}

          {/* BOARD */}
          {page==="board" && (
            <div>
              <div style={{ fontWeight:800, fontSize:20, marginBottom:16 }}>📋 Bảng Theo Dõi</div>
              <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:12, alignItems:"flex-start" }}>
                {STATUS_COLS.map(col => {
                  const colOrders = filtered.filter(o => o.status===col.key);
                  return (
                    <div key={col.key} style={{ flexShrink:0, width:280 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                        <span style={{ fontSize:18 }}>{col.icon}</span>
                        <span style={{ fontWeight:800, fontSize:14, color:"#374151", flex:1 }}>{col.key}</span>
                        <span style={{ background:"#fff", border:"1px solid #e5e7eb", fontSize:12, fontWeight:700, padding:"1px 8px", borderRadius:20, color:"#6b7280" }}>{colOrders.length}</span>
                      </div>
                      <div style={{ minHeight:60 }}>
                        {colOrders.map(o => {
                          const cust = MOCK_CUSTOMERS.find(c => c.id===o.customer_id);
                          const needsAction = o.assigned_to===user.id && o.accept_stage<3 && o.assigned_at;
                          return (
                            <div key={o.id} onClick={() => setSelectedOrder(o)}
                              style={{ background:"#fff", borderRadius:14, padding:14, border:`1.5px solid ${needsAction?"#fca5a5":"#f3f4f6"}`, marginBottom:10, cursor:"pointer", boxShadow:highlightId===o.id?"0 0 0 3px #4f46e5":"0 1px 4px rgba(0,0,0,.06)", transition:"box-shadow .4s" }}>
                              {needsAction && <div style={{ background:"#fef2f2", borderRadius:8, padding:"4px 8px", marginBottom:6, fontSize:12, color:"#dc2626", fontWeight:700 }}>⚠️ Cần nhận máy!</div>}
                              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                                <div>
                                  <div style={{ fontWeight:800, fontSize:14 }}>{cust?.full_name}</div>
                                  <div style={{ fontSize:11, color:"#818cf8" }}>{o.id}{o.qr_code ? ` · ${o.qr_code}` : ""}</div>
                                </div>
                              </div>
                              <div style={{ fontSize:13, fontWeight:600, color:"#374151", marginBottom:4 }}>📱 {o.device_model}</div>
                              {o.issues.length>0 && <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:4 }}>{o.issues.slice(0,2).map(i => <span key={i} style={{ fontSize:11, background:"#f3f4f6", padding:"2px 8px", borderRadius:20 }}>{i}</span>)}</div>}
                              <div style={{ fontSize:11, color:"#9ca3af" }}>{timeAgo(o.created)}</div>
                            </div>
                          );
                        })}
                        {colOrders.length===0 && <div style={{ border:"2px dashed #e5e7eb", borderRadius:14, padding:"20px 16px", textAlign:"center", color:"#d1d5db", fontSize:13 }}>Không có đơn</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NEW PAGE */}
          {page==="new" && user.role!=="technician" && (
            <div style={{ maxWidth:540, margin:"0 auto" }}>
              <div style={{ fontWeight:800, fontSize:20, marginBottom:16 }}>➕ Tạo Đơn Mới</div>
              <div style={{ background:"#fff", borderRadius:20, padding:24, textAlign:"center" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
                <button onClick={() => setShowNewOrder(true)} style={{ width:"100%", height:56, background:"#4f46e5", color:"#fff", border:"none", borderRadius:14, fontSize:18, fontWeight:800, cursor:"pointer" }}>➕ Mở Form Tạo Đơn</button>
              </div>
            </div>
          )}

          {/* TASKS */}
          {page==="tasks" && (
            <div style={{ maxWidth:600, margin:"0 auto" }}>
              <div style={{ fontWeight:800, fontSize:20, marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
                {user.role==="manager" ? "📋 Tất cả việc" : "🔧 Việc của tôi"}
                <span style={{ background:"#4f46e5", color:"#fff", fontSize:13, padding:"2px 10px", borderRadius:20, fontWeight:700 }}>
                  {filtered.filter(o => o.status!=="Đã Giao").length}
                </span>
              </div>
              {pendingAccepts.length>0 && user.role==="technician" && (
                <div style={{ background:"#fef2f2", border:"2px solid #fca5a5", borderRadius:14, padding:"12px 16px", marginBottom:14 }}>
                  <div style={{ fontWeight:800, color:"#dc2626", marginBottom:4 }}>⚠️ {pendingAccepts.length} đơn cần bấm nhận ngay!</div>
                </div>
              )}
              {filtered.map(order => {
                const cust = MOCK_CUSTOMERS.find(c => c.id===order.customer_id);
                const col = STATUS_COLS.find(s => s.key===order.status);
                const isHL = highlightId===order.id;
                const needAccept = order.assigned_to===user.id && order.accept_stage<3 && order.assigned_at;
                return (
                  <div key={order.id} onClick={() => setSelectedOrder(order)}
                    style={{ background:"#fff", borderRadius:14, padding:"14px 16px", marginBottom:10, cursor:"pointer", borderLeft:`4px solid ${col?.color}`, boxShadow:isHL?"0 0 0 3px #4f46e5,0 4px 24px rgba(79,70,229,.4)":"0 1px 4px rgba(0,0,0,.06)", transition:"box-shadow .4s" }}>
                    {needAccept && (
                      <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, padding:"6px 10px", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:16 }}>⚠️</span>
                        <span style={{ fontSize:13, color:"#dc2626", fontWeight:800 }}>Cần bấm nhận máy ngay!</span>
                      </div>
                    )}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:6 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:800, fontSize:15, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{cust?.full_name}</div>
                        <div style={{ fontSize:11, color:"#818cf8" }}>{order.id}{order.qr_code ? ` · ${order.qr_code}` : ""}</div>
                      </div>
                      <span style={{ fontSize:11, background:col?.bg, color:col?.color, padding:"3px 10px", borderRadius:20, fontWeight:700, flexShrink:0 }}>{col?.icon} {order.status}</span>
                    </div>
                    <div style={{ fontSize:14, fontWeight:600, marginBottom:order.estimated_done?6:8, color:"#374151" }}>📱 {order.device_model}</div>
                    {order.estimated_done && <div style={{ fontSize:12, color:"#059669", fontWeight:600, marginBottom:8 }}>⏱️ Dự kiến: {new Date(order.estimated_done).toLocaleString("vi-VN",{dateStyle:"short",timeStyle:"short"})}</div>}
                    {/* KTV: chỉ hiện nút khi là đơn của mình, manager thấy hết */}
                    {(user.role === "manager") && (
                      <div onClick={e => e.stopPropagation()} style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                        {STATUS_COLS.filter(c => c.key!==order.status).map(c => (
                          <button key={c.key} onClick={() => updateOrder(order.id, {status:c.key}, c.key==="Hoàn Thành"?{userId:order.assigned_to,delta:2,note:"+2 KPI"}:null)}
                            style={{ padding:"8px 12px", borderRadius:9, border:`1.5px solid ${c.border}`, background:"#fff", color:c.color, fontSize:12, fontWeight:700, cursor:"pointer" }}>
                            {c.icon} {c.key}
                          </button>
                        ))}
                      </div>
                    )}
                    {user.role === "technician" && (
                      <div style={{ fontSize:12, color:"#9ca3af", fontStyle:"italic" }}>👆 Bấm vào đơn để xem chi tiết và cập nhật</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* CUSTOMERS */}
          {page==="customers" && (
            <div>
              <div style={{ fontWeight:800, fontSize:20, marginBottom:16 }}>👥 Quản Lý Khách Hàng</div>
              <div style={{ background:"#fff", borderRadius:16, padding:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)", marginBottom:12 }}>
                <input placeholder="🔍 Tìm tên, SĐT khách hàng..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:14, outline:"none", boxSizing:"border-box" }} />
              </div>
              {MOCK_CUSTOMERS.filter(c =>
                c.full_name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
              ).map(cust => {
                const custOrders = orders.filter(o => o.customer_id === cust.id);
                return (
                  <div key={cust.id} style={{ background:"#fff", borderRadius:14, padding:"14px 16px", marginBottom:10, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:16 }}>👤 {cust.full_name}</div>
                        <div style={{ fontSize:13, color:"#6b7280", marginTop:3 }}>📞 {cust.phone}</div>
                        {cust.address && <div style={{ fontSize:13, color:"#6b7280" }}>📍 {cust.address}</div>}
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ background:"#eef2ff", color:"#4f46e5", fontSize:12, fontWeight:700, padding:"4px 12px", borderRadius:20 }}>
                          {custOrders.length} đơn
                        </div>
                      </div>
                    </div>
                    {custOrders.length > 0 && (
                      <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #f3f4f6" }}>
                        <div style={{ fontSize:12, color:"#9ca3af", marginBottom:6 }}>Đơn gần đây:</div>
                        {custOrders.slice(0,3).map(o => {
                          const col = STATUS_COLS.find(s => s.key===o.status);
                          return (
                            <div key={o.id} onClick={() => setSelectedOrder(o)}
                              style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", cursor:"pointer", borderBottom:"1px solid #f9fafb" }}>
                              <div>
                                <div style={{ fontSize:13, fontWeight:700 }}>{o.device_model}</div>
                                <div style={{ fontSize:11, color:"#818cf8" }}>{o.id}</div>
                              </div>
                              <span style={{ fontSize:11, background:col?.bg, color:col?.color, padding:"3px 10px", borderRadius:20, fontWeight:700 }}>{col?.icon} {o.status}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* STAFF MANAGEMENT */}
          {page==="staff" && user.role==="manager" && (() => {
            const [staffForm, setStaffForm] = React.useState({ name:"", username:"", password:"", role:"technician", phone:"", note:"" });
            const [editId, setEditId] = React.useState(null);
            const [showForm, setShowForm] = React.useState(false);
            const [showPw, setShowPw] = React.useState(false);
            const [confirmDel, setConfirmDel] = React.useState(null);

            const openAdd = () => { setStaffForm({ name:"", username:"", password:"", role:"technician", phone:"", note:"" }); setEditId(null); setShowForm(true); setShowPw(false); };
            const openEdit = (u) => { setStaffForm({ name:u.name, username:u.username, password:u.password, role:u.role, phone:u.phone||"", note:u.note||"" }); setEditId(u.id); setShowForm(true); setShowPw(false); };
            const saveStaff = () => {
              if (!staffForm.name.trim() || !staffForm.username.trim() || !staffForm.password.trim()) { alert("Vui lòng nhập đủ Tên, Username và Mật khẩu!"); return; }
              const dup = users.find(u => u.username===staffForm.username.trim() && u.id!==editId);
              if (dup) { alert("Username đã tồn tại!"); return; }
              if (editId) {
                setUsers(prev => prev.map(u => u.id===editId ? {...u, ...staffForm, name:staffForm.name.trim(), username:staffForm.username.trim() } : u));
              } else {
                const newId = "u"+Date.now();
                setUsers(prev => [...prev, { id:newId, name:staffForm.name.trim(), username:staffForm.username.trim(), password:staffForm.password.trim(), role:staffForm.role, kpi:10, phone:staffForm.phone, note:staffForm.note, active:true }]);
              }
              setShowForm(false);
            };
            const deleteStaff = (id) => { setUsers(prev => prev.filter(u => u.id!==id)); setConfirmDel(null); };
            const toggleActive = (id) => { setUsers(prev => prev.map(u => u.id===id ? {...u, active: u.active===false ? true : false} : u)); };

            return (
              <div style={{ maxWidth:600, margin:"0 auto" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div style={{ fontWeight:800, fontSize:20 }}>👨‍💼 Quản Lý Nhân Viên</div>
                  <button onClick={openAdd}
                    style={{ height:40, padding:"0 18px", background:"#4f46e5", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:14, cursor:"pointer" }}>
                    ＋ Thêm nhân viên
                  </button>
                </div>

                {users.map(u => (
                  <div key={u.id} style={{ background:"#fff", borderRadius:14, padding:"14px 16px", marginBottom:10, boxShadow:"0 1px 4px rgba(0,0,0,.06)", opacity:u.active===false?0.55:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:44, height:44, borderRadius:"50%", background:u.active===false?"#9ca3af":"#4f46e5", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:18, flexShrink:0 }}>{u.name[0]}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ fontWeight:800, fontSize:15 }}>{u.name}</div>
                          {u.active===false && <span style={{ background:"#f3f4f6", color:"#9ca3af", fontSize:10, padding:"2px 8px", borderRadius:20, fontWeight:700 }}>Ngừng HĐ</span>}
                        </div>
                        <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>
                          {ROLE_LABELS[u.role]} · @{u.username} · KPI: {u.kpi}
                        </div>
                        {u.phone && <div style={{ fontSize:12, color:"#6b7280" }}>📞 {u.phone}</div>}
                      </div>
                      <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                        <button onClick={() => openEdit(u)}
                          style={{ height:34, padding:"0 12px", background:"#eef2ff", color:"#4f46e5", border:"none", borderRadius:8, fontWeight:700, fontSize:13, cursor:"pointer" }}>✏️</button>
                        <button onClick={() => toggleActive(u.id)}
                          style={{ height:34, padding:"0 12px", background:u.active===false?"#ecfdf5":"#fef2f2", color:u.active===false?"#059669":"#dc2626", border:"none", borderRadius:8, fontWeight:700, fontSize:12, cursor:"pointer" }}>
                          {u.active===false?"✅ Kích hoạt":"⛔ Khóa"}
                        </button>
                        {u.id!==user.id && (
                          <button onClick={() => setConfirmDel(u.id)}
                            style={{ height:34, padding:"0 12px", background:"#fef2f2", color:"#dc2626", border:"none", borderRadius:8, fontWeight:700, fontSize:13, cursor:"pointer" }}>🗑️</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Form thêm/sửa */}
                {showForm && (
                  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
                    <div style={{ background:"#fff", borderRadius:20, padding:28, width:"100%", maxWidth:420, maxHeight:"90vh", overflowY:"auto" }}>
                      <div style={{ fontWeight:800, fontSize:18, marginBottom:20 }}>{editId?"✏️ Sửa nhân viên":"➕ Thêm nhân viên"}</div>
                      {[
                        { label:"👤 Họ tên *", key:"name", placeholder:"Nguyễn Văn A" },
                        { label:"🔑 Username *", key:"username", placeholder:"username đăng nhập" },
                        { label:"📞 Số điện thoại", key:"phone", placeholder:"0901234567" },
                        { label:"📝 Ghi chú", key:"note", placeholder:"..." },
                      ].map(f => (
                        <div key={f.key} style={{ marginBottom:14 }}>
                          <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>{f.label}</label>
                          <input value={staffForm[f.key]} onChange={e => setStaffForm(p=>({...p,[f.key]:e.target.value}))}
                            placeholder={f.placeholder}
                            style={{ width:"100%", height:46, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:14, outline:"none", boxSizing:"border-box" }} />
                        </div>
                      ))}
                      <div style={{ marginBottom:14 }}>
                        <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>🔒 Mật khẩu *</label>
                        <div style={{ position:"relative" }}>
                          <input type={showPw?"text":"password"} value={staffForm.password} onChange={e => setStaffForm(p=>({...p,password:e.target.value}))}
                            placeholder="Nhập mật khẩu..."
                            style={{ width:"100%", height:46, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 46px 0 14px", fontSize:14, outline:"none", boxSizing:"border-box" }} />
                          <button onClick={() => setShowPw(v=>!v)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:18 }}>{showPw?"🙈":"👁️"}</button>
                        </div>
                      </div>
                      <div style={{ marginBottom:20 }}>
                        <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>🎭 Vai trò *</label>
                        <select value={staffForm.role} onChange={e => setStaffForm(p=>({...p,role:e.target.value}))}
                          style={{ width:"100%", height:46, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:14, outline:"none", background:"#fff" }}>
                          <option value="manager">👑 Quản lý</option>
                          <option value="receptionist">🗂️ Tiếp tân</option>
                          <option value="technician">🔧 Kỹ thuật viên</option>
                        </select>
                      </div>
                      <div style={{ display:"flex", gap:10 }}>
                        <button onClick={() => setShowForm(false)} style={{ flex:1, height:46, borderRadius:10, border:"1.5px solid #e5e7eb", background:"#fff", fontWeight:700, cursor:"pointer", fontSize:14 }}>Huỷ</button>
                        <button onClick={saveStaff} style={{ flex:2, height:46, borderRadius:10, border:"none", background:"#4f46e5", color:"#fff", fontWeight:800, cursor:"pointer", fontSize:14 }}>💾 Lưu</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Confirm xóa */}
                {confirmDel && (
                  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:1100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
                    <div style={{ background:"#fff", borderRadius:20, padding:28, maxWidth:340, width:"100%", textAlign:"center" }}>
                      <div style={{ fontSize:48, marginBottom:12 }}>🗑️</div>
                      <div style={{ fontWeight:800, fontSize:17, marginBottom:8 }}>Xoá nhân viên?</div>
                      <div style={{ fontSize:14, color:"#6b7280", marginBottom:20 }}>Hành động này không thể khôi phục.</div>
                      <div style={{ display:"flex", gap:10 }}>
                        <button onClick={() => setConfirmDel(null)} style={{ flex:1, height:46, borderRadius:10, border:"1.5px solid #e5e7eb", background:"#fff", fontWeight:700, cursor:"pointer" }}>Huỷ</button>
                        <button onClick={() => deleteStaff(confirmDel)} style={{ flex:1, height:46, borderRadius:10, border:"none", background:"#dc2626", color:"#fff", fontWeight:800, cursor:"pointer" }}>Xoá</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* SETTINGS */}
          {page==="settings" && user.role==="manager" && (
            <div style={{ maxWidth:600, margin:"0 auto" }}>
              <div style={{ fontWeight:800, fontSize:20, marginBottom:16 }}>⚙️ Cài Đặt Hệ Thống</div>

              {/* Nhân viên */}
              <div style={{ background:"#fff", borderRadius:16, padding:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)", marginBottom:16 }}>
                <div style={{ fontWeight:800, fontSize:15, marginBottom:12 }}>👨‍💼 Danh Sách Nhân Viên</div>
                {users.map(u => (
                  <div key={u.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid #f3f4f6" }}>
                    <div style={{ width:40, height:40, borderRadius:"50%", background:"#4f46e5", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:16 }}>{u.name[0]}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14 }}>{u.name}</div>
                      <div style={{ fontSize:12, color:"#6b7280" }}>{ROLE_LABELS[u.role]}</div>
                    </div>
                    <div style={{ background:"#f3f4f6", borderRadius:20, padding:"3px 12px", fontSize:12, fontWeight:700, color:"#374151" }}>
                      KPI: {u.kpi}
                    </div>
                  </div>
                ))}
              </div>

              {/* Trạng thái đơn */}
              <div style={{ background:"#fff", borderRadius:16, padding:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)", marginBottom:16 }}>
                <div style={{ fontWeight:800, fontSize:15, marginBottom:12 }}>📋 Trạng Thái Đơn Hàng</div>
                {STATUS_COLS.map(s => (
                  <div key={s.key} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #f3f4f6" }}>
                    <span style={{ fontSize:20 }}>{s.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14 }}>{s.key}</div>
                    </div>
                    <span style={{ background:s.bg, color:s.color, fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:700 }}>{s.icon} {s.key}</span>
                  </div>
                ))}
              </div>

              {/* Quy tắc KPI */}
              <div style={{ background:"#fff", borderRadius:16, padding:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)", marginBottom:16 }}>
                <div style={{ fontWeight:800, fontSize:15, marginBottom:12 }}>🏆 Quy Tắc KPI</div>
                {[
                  { icon:"⚠️", rule:"Không nhận máy sau 15 phút", delta:"-1 KPI", color:"#d97706" },
                  { icon:"🔄", rule:"Bị reassign sau 60 phút", delta:"-1 KPI", color:"#d97706" },
                  { icon:"🚨", rule:"Đơn quá 1300-1500 phút", delta:"-2 KPI", color:"#dc2626" },
                  { icon:"✅", rule:"Hoàn thành đơn hàng", delta:"+2 KPI", color:"#059669" },
                ].map((r, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:"1px solid #f3f4f6" }}>
                    <span style={{ fontSize:20 }}>{r.icon}</span>
                    <div style={{ flex:1, fontSize:14 }}>{r.rule}</div>
                    <span style={{ fontWeight:800, color:r.color, fontSize:14 }}>{r.delta}</span>
                  </div>
                ))}
              </div>

              {/* API Keys */}
              {(() => {
                const API_KEYS_DEFAULT = [
                  { id:"kiotviet",  label:"KiotViet",      icon:"🛒", hint:"Client ID / Secret", fields:[{key:"client_id",label:"Client ID"},{key:"client_secret",label:"Client Secret"},{key:"retailer",label:"Retailer (tên cửa hàng)"}] },
                  { id:"zalo",      label:"Zalo OA",        icon:"💬", hint:"Access Token / OA ID",  fields:[{key:"access_token",label:"Access Token"},{key:"oa_id",label:"OA ID"}] },
                  { id:"sms",       label:"SMS Gateway",    icon:"📱", hint:"API Key gửi SMS",        fields:[{key:"api_key",label:"API Key"},{key:"brand_name",label:"Brand Name"}] },
                  { id:"custom",    label:"Tuỳ chỉnh",      icon:"🔌", hint:"API tích hợp khác",      fields:[{key:"name",label:"Tên dịch vụ"},{key:"api_key",label:"API Key"},{key:"endpoint",label:"Endpoint URL"}] },
                ];
                const [apiKeys, setApiKeys] = React.useState(() => {
                  try { return JSON.parse(localStorage.getItem("api_keys")||"{}"); } catch{ return {}; }
                });
                const [expanded, setExpanded] = React.useState(null);
                const [edited, setEdited] = React.useState({});
                const [saved, setSaved] = React.useState(null);
                const [showSecret, setShowSecret] = React.useState({});

                const toggleExpand = (id) => { setExpanded(v => v===id?null:id); setEdited(apiKeys[id]||{}); };
                const saveKey = (id) => {
                  const next = {...apiKeys, [id]: edited};
                  setApiKeys(next);
                  localStorage.setItem("api_keys", JSON.stringify(next));
                  setSaved(id); setTimeout(()=>setSaved(null), 2000);
                };
                const clearKey = (id) => {
                  const next = {...apiKeys}; delete next[id];
                  setApiKeys(next);
                  localStorage.setItem("api_keys", JSON.stringify(next));
                  setExpanded(null);
                };

                const isConfigured = (id) => apiKeys[id] && Object.values(apiKeys[id]).some(v=>v?.trim());

                return (
                  <div style={{ background:"#fff", borderRadius:16, padding:16, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
                    <div style={{ fontWeight:800, fontSize:15, marginBottom:4 }}>🔑 API Keys & Tích Hợp</div>
                    <div style={{ fontSize:12, color:"#9ca3af", marginBottom:14 }}>Kết nối hệ thống với các dịch vụ bên ngoài</div>

                    {API_KEYS_DEFAULT.map(svc => (
                      <div key={svc.id}>
                        <div onClick={() => toggleExpand(svc.id)}
                          style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:"1px solid #f3f4f6", cursor:"pointer", userSelect:"none" }}>
                          <span style={{ fontSize:24 }}>{svc.icon}</span>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:14 }}>{svc.label}</div>
                            <div style={{ fontSize:11, color:"#9ca3af" }}>{svc.hint}</div>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            {isConfigured(svc.id)
                              ? <span style={{ background:"#ecfdf5", color:"#059669", fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:700 }}>✅ Đã cấu hình</span>
                              : <span style={{ background:"#f3f4f6", color:"#9ca3af", fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:600 }}>Chưa cấu hình</span>
                            }
                            <span style={{ color:"#9ca3af", fontSize:16 }}>{expanded===svc.id?"▲":"▼"}</span>
                          </div>
                        </div>

                        {expanded===svc.id && (
                          <div style={{ background:"#f8fafc", borderRadius:12, padding:16, margin:"8px 0 4px", border:"1px solid #e5e7eb" }}>
                            {svc.fields.map(f => (
                              <div key={f.key} style={{ marginBottom:12 }}>
                                <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#374151", marginBottom:5 }}>{f.label}</label>
                                <div style={{ position:"relative" }}>
                                  <input
                                    type={showSecret[svc.id+f.key] ? "text" : (f.key.includes("secret")||f.key.includes("token")||f.key.includes("api_key") ? "password" : "text")}
                                    value={edited[f.key]||""}
                                    onChange={e => setEdited(p=>({...p,[f.key]:e.target.value}))}
                                    placeholder={`Nhập ${f.label}...`}
                                    style={{ width:"100%", height:42, borderRadius:9, border:"1.5px solid #e5e7eb", padding:"0 40px 0 12px", fontSize:13, outline:"none", boxSizing:"border-box", background:"#fff" }}
                                  />
                                  {(f.key.includes("secret")||f.key.includes("token")||f.key.includes("api_key")) && (
                                    <button onClick={() => setShowSecret(p=>({...p,[svc.id+f.key]:!p[svc.id+f.key]}))} type="button"
                                      style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:16, color:"#9ca3af" }}>
                                      {showSecret[svc.id+f.key]?"🙈":"👁️"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                            <div style={{ display:"flex", gap:8, marginTop:4 }}>
                              {isConfigured(svc.id) && (
                                <button onClick={() => clearKey(svc.id)}
                                  style={{ height:38, padding:"0 14px", borderRadius:9, border:"1.5px solid #fca5a5", background:"#fef2f2", color:"#dc2626", fontWeight:700, cursor:"pointer", fontSize:13 }}>
                                  🗑️ Xoá
                                </button>
                              )}
                              <button onClick={() => saveKey(svc.id)}
                                style={{ flex:1, height:38, borderRadius:9, border:"none", background: saved===svc.id?"#059669":"#4f46e5", color:"#fff", fontWeight:800, cursor:"pointer", fontSize:14, transition:"background .3s" }}>
                                {saved===svc.id ? "✅ Đã lưu!" : "💾 Lưu"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}

            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedOrder && <OrderDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} currentUser={user} onUpdate={updateOrder} users={users} onShowQR={setQrOrder} />}
      {showNewOrder && <NewOrderModal onClose={() => setShowNewOrder(false)} onCreate={createOrder} users={users} orders={orders} />}
      {qrOrder && <QRPrintModal order={qrOrder} onClose={() => setQrOrder(null)} />}
      {showQRScan && <QRScanModal onClose={() => setShowQRScan(false)} onFound={handleGlobalQRScan} orders={orders} mode="search" />}
      {/* Toast xác nhận tạo đơn */}
      {createdOrder && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", zIndex:5000, background:"#1e1b4b", color:"#fff", borderRadius:20, padding:"16px 24px", boxShadow:"0 8px 32px rgba(0,0,0,.35)", display:"flex", flexDirection:"column", alignItems:"center", gap:6, minWidth:280, maxWidth:360, animation:"slideUp .3s ease" }}>
          <style>{`@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
          <div style={{ fontSize:36 }}>🎉</div>
          <div style={{ fontWeight:800, fontSize:17 }}>Tạo đơn thành công!</div>
          <div style={{ fontSize:14, color:"#a5b4fc", fontWeight:600 }}>{createdOrder.id}</div>
          {(() => { const c = MOCK_CUSTOMERS.find(x=>x.id===createdOrder.customer_id); return c ? <div style={{ fontSize:13, color:"#c7d2fe" }}>👤 {c.full_name} · 📱 {createdOrder.device_model}</div> : null; })()}
          {createdOrder.assigned_to && (() => { const u = MOCK_USERS.find(x=>x.id===createdOrder.assigned_to); return <div style={{ fontSize:13, color:"#fcd34d" }}>⏰ Đã giao {u?.name} — 15 phút nhận máy!</div>; })()}
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button onClick={() => { setSelectedOrder(createdOrder); setCreatedOrder(null); }}
              style={{ padding:"8px 18px", borderRadius:10, background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.3)", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13 }}>
              Xem đơn
            </button>
            <button onClick={() => setCreatedOrder(null)}
              style={{ padding:"8px 18px", borderRadius:10, background:"#4f46e5", border:"none", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13 }}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
