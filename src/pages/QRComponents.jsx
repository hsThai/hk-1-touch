/* v1774860462-4890 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { RepairChat, Notification, Staff, RepairOrder, Customer, SparePart, SparePartUsage } from "./pb.jsx";
import { uploadFile } from "./pb.jsx";


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
        el.innerHTML = `<div style="width:${size}px;height:${size}px;background:#f3f4f6;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:8px;font-size:11px;color:#6b7280;text-align:center;padding:6px"><div style="font-size:24px"> </div><div style="font-weight:700;margin-top:4px;word-break:break-all">${text}</div></div>`;
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

    // Tìm theo product_qr trước (QR dán trên máy → lịch sử sửa chữa)
    const byProductQR = (orders || []).filter(o => o.product_qr && o.product_qr === raw);
    if (byProductQR.length > 0) {
      onFound({ type: "product_history", qr: raw, orders: byProductQR });
      onClose();
      return;
    }

    // Kiểm tra hàng trong kho (máy nhập kho chưa bán)
    // SparePart có category="device_stock" và sku=raw → hàng trong kho
    // Dùng async check — wrap trong async IIFE
    (async () => {
      try {
        const { SparePart } = await import("./pb.jsx");
        const stockItems = await SparePart.filter({ sku: raw, category: "device_stock" });
        if (stockItems && stockItems.length > 0) {
          const sp = stockItems[0];
          onFound({ type: "warehouse_stock", data: sp, qr: raw });
          onClose();
          return;
        }
      } catch {}

      // Tìm theo mã đơn
      const byOrderId = (orders || []).find(o => o.id === raw || o.qr_code === raw);
      if (byOrderId) { onFound({ type: "order", data: byOrderId }); onClose(); return; }
      onFound({ type: "assign_qr", qr: raw });
      onClose();
    })();
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
              {isCapture ? "Quét Mã QR Máy" : "Quét QR Sản Phẩm"}
            </div>
            <div style={{ color:"#a5b4fc", fontSize:12, marginTop:2 }}>
              {isCapture ? "Lấy mã QR dán lên máy → điền vào đơn" : "QR đã gán: xem lịch sử · QR mới: gán cho đơn này"}
            </div>
          </div>
          <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onClose(); }}
            style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:40, height:40, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22,verticalAlign:"middle",lineHeight:1}}>close</span></button>
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
            {libOk && !camReady && !err && <span style={{ background:"rgba(0,0,0,.7)", color:"#fff", padding:"5px 14px", borderRadius:20, fontSize:12 }}>  Đang mở camera...</span>}
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
  const qrRef = useRef();
  if (!order) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:5000, background:"rgba(0,0,0,.85)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:20, padding:28, maxWidth:340, width:"100%", textAlign:"center"}}>
        <div style={{ fontWeight:800, fontSize:18, marginBottom:4 }}>  In Phiếu QR</div>
        <div style={{ color:"#6b7280", fontSize:13, marginBottom:16 }}>Đơn: {order.id || order.order_code}</div>
        <div ref={qrRef} style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
          <QRCanvas key={order.id || order.order_code} text={order.id || order.order_code} size={180} />
        </div>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>{order.customer_name || order.customer_id}</div>
        <div style={{ color:"#6b7280", fontSize:13, marginBottom:16 }}>{order.device_model}</div>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={onClose} style={{ padding:"10px 24px", borderRadius:12, border:"1.5px solid #e5e7eb", background:"#f9fafb", fontWeight:700, cursor:"pointer" }}>Đóng</button>
          <button onClick={() => window.print()} style={{ padding:"10px 24px", borderRadius:12, background:"#4f46e5", color:"#fff", border:"none", fontWeight:700, cursor:"pointer"}}>  In</button>
        </div>
      </div>
    </div>
  );
}

export { loadQRLib, loadJsQR, QRCanvas, getQRDataUrl, QRScanModal, QRPrintModal };

export default function QRComponentsPage() { return null; }

// ── IMEIScanModal — quét barcode 1D/2D để lấy IMEI ──────────────────────────
// Ưu tiên: BarcodeDetector (native) → ZXing (wasm) → jsQR fallback
export function IMEIScanModal({ onClose, onFound }) {
  const videoRef = React.useRef();
  const canvasRef = React.useRef();
  const rafRef = React.useRef();
  const streamRef = React.useRef();
  const detectorRef = React.useRef(null);
  const [status, setStatus] = React.useState("loading"); // loading | scanning | error
  const [errMsg, setErrMsg] = React.useState("");
  const [manual, setManual] = React.useState("");
  const [detected, setDetected] = React.useState("");

  React.useEffect(() => {
    initDetector();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  async function initDetector() {
    // 1. Thử BarcodeDetector native (Chrome Android hỗ trợ tốt)
    if (window.BarcodeDetector) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats().catch(() => ["code_128","code_39","ean_13","ean_8","qr_code","data_matrix"]);
        detectorRef.current = new window.BarcodeDetector({ formats });
        startCamera("native");
        return;
      } catch {}
    }
    // 2. Fallback jsQR (QR code + DataMatrix)
    loadJsQR(() => { startCamera("jsqr"); });
  }

  async function startCamera(detectorType) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play();
      setStatus("scanning");
      scanLoop(detectorType);
    } catch (e) {
      setStatus("error");
      setErrMsg("Không mở được camera. Nhập IMEI thủ công bên dưới.");
    }
  }

  function scanLoop(type) {
    rafRef.current = requestAnimationFrame(async () => {
      const v = videoRef.current; const c = canvasRef.current;
      if (!v || !c || v.readyState < 2) { scanLoop(type); return; }

      if (type === "native" && detectorRef.current) {
        try {
          const barcodes = await detectorRef.current.detect(v);
          if (barcodes.length > 0) {
            const raw = barcodes[0].rawValue;
            handleDetected(raw); return;
          }
        } catch {}
      } else if (type === "jsqr" && window.jsQR) {
        c.width = v.videoWidth; c.height = v.videoHeight;
        const ctx = c.getContext("2d");
        ctx.drawImage(v, 0, 0);
        const img = ctx.getImageData(0, 0, c.width, c.height);
        const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
        if (code?.data) { handleDetected(code.data.trim()); return; }
      }
      scanLoop(type);
    });
  }

  function handleDetected(raw) {
    // Lọc lấy phần số IMEI (15 số) nếu có trong chuỗi
    const imeiMatch = raw.match(/\b\d{14,16}\b/);
    const imei = imeiMatch ? imeiMatch[0] : raw.trim();
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    setDetected(imei);
    setStatus("done");
  }

  function confirmImei(val) {
    if (!val.trim()) return;
    onFound(val.trim());
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:4500, background:"rgba(0,0,0,.95)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ width:"100%", maxWidth:420 }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div>
            <div style={{ color:"#fff", fontWeight:900, fontSize:20 }}>▦ Quét Barcode IMEI</div>
            <div style={{ color:"#94a3b8", fontSize:12, marginTop:2 }}>Hướng camera vào mã vạch trên máy</div>
          </div>
          <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onClose(); }}
            style={{ background:"rgba(255,255,255,.15)", border:"none", color:"#fff", width:38, height:38, borderRadius:"50%", fontSize:18, cursor:"pointer"}}> </button>
        </div>

        {/* Camera view */}
        {status !=="done" && (
          <div style={{ position:"relative", borderRadius:16, overflow:"hidden", background:"#000", aspectRatio:"16/9", marginBottom:14 }}>
            <video ref={videoRef} muted playsInline style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            <canvas ref={canvasRef} style={{ display:"none" }} />

            {/* Viewfinder — khung ngang cho barcode 1D */}
            {status === "scanning" && (
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                <div style={{ width:"85%", height:72, border:"2.5px solid #fbbf24", borderRadius:8, boxShadow:"0 0 0 2000px rgba(0,0,0,.35)", position:"relative" }}>
                  {/* scan line animation */}
                  <div style={{ position:"absolute", left:0, right:0, height:2, background:"#fbbf24", top:"50%", animation:"scanline 1.5s ease-in-out infinite", opacity:.8 }} />
                </div>
              </div>
            )}

            {status === "loading" && (
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:14 }}>
                ⏳ Đang khởi động camera...
              </div>
            )}
            {status === "error" && (
              <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,.7)", borderRadius:16 }}>
                <div style={{ color:"#f87171", fontSize:13, textAlign:"center", padding:16 }}>  {errMsg}</div>
              </div>
            )}
          </div>
        )}

        {/* Kết quả đã quét */}
        {status ==="done" && (
          <div style={{ background:"#f0fdf4", borderRadius:14, padding:18, marginBottom:14, border:"2px solid #6ee7b7", textAlign:"center" }}>
            <div style={{ fontSize:13, color:"#065f46", fontWeight:700, marginBottom:6 }}>  Đã quét được:</div>
            <input value={detected} onChange={e => setDetected(e.target.value)}
              style={{ width:"100%", background:"#fff", border:"1.5px solid #6ee7b7", borderRadius:10, padding:"10px 14px", fontSize:16, fontWeight:800, textAlign:"center", fontFamily:"monospace", boxSizing:"border-box", outline:"none" }} />
            <div style={{ fontSize:11, color:"#6b7280", marginTop:6 }}>Chỉnh sửa nếu cần rồi nhấn Xác Nhận</div>
          </div>
        )}

        {/* Nút action */}
        {status === "done" ? (
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => { setStatus("loading"); setDetected(""); initDetector(); }}
              style={{ flex:1, height:48, background:"rgba(255,255,255,.1)", border:"1.5px solid rgba(255,255,255,.3)", color:"#fff", borderRadius:12, fontWeight:700, cursor:"pointer"}}>
                Quét lại
            </button>
            <button onClick={() => confirmImei(detected)}
              style={{ flex:2, height:48, background:"#4f46e5", border:"none", color:"#fff", borderRadius:12, fontWeight:800, fontSize:15, cursor:"pointer"}}>
                Xác Nhận IMEI
            </button>
          </div>
        ) : (
          <div>
            <div style={{ color:"#94a3b8", fontSize:12, textAlign:"center", marginBottom:8 }}>— hoặc nhập thủ công —</div>
            <div style={{ display:"flex", gap:8 }}>
              <input value={manual} onChange={e => setManual(e.target.value)}
                placeholder="Nhập IMEI / Serial số..."
                inputMode="numeric"
                onKeyDown={e => { if (e.key === "Enter" && manual.trim()) confirmImei(manual); }}
                style={{ flex:1, height:46, borderRadius:12, border:"1.5px solid rgba(255,255,255,.2)", background:"rgba(255,255,255,.1)", color:"#fff", padding:"0 14px", fontSize:14, outline:"none" }} />
              <button onClick={() => confirmImei(manual)} disabled={!manual.trim()}
                style={{ height:46, padding:"0 16px", background:manual.trim()?"#4f46e5":"rgba(255,255,255,.1)", border:"none", color:"#fff", borderRadius:12, fontWeight:700, cursor:manual.trim()?"pointer":"default" }}>
                OK
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes scanline { 0%,100%{top:10%} 50%{top:90%} }`}</style>
    </div>
  );
}
