/* v1774860462-4890 */
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

const SparePart = base44.entities.SparePart;
const SparePartUsage = base44.entities.SparePartUsage;

let _qrLibLoaded = false;
let _qrLibCallbacks = [];

function loadQRLib(cb) {
  if (_qrLibLoaded) { cb(); return; }
  _qrLibCallbacks.push(cb);
  if (_qrLibCallbacks.length > 1) return;
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
  s.onload = () => {
    _qrLibLoaded = true;
    _qrLibCallbacks.forEach(f => f());
    _qrLibCallbacks = [];
  };
  s.onerror = () => {
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

function QRScanModal({ onClose, onFound, onResult, orders = [], mode = "search" }) {
  const videoRef = useRef();
  const canvasRef = useRef();
  const rafRef = useRef();
  const streamRef = useRef();
  const [camReady, setCamReady] = useState(false);
  const [libOk, setLibOk] = useState(false);
  const [err, setErr] = useState("");
  const [manual, setManual] = useState("");
  const isCapture = mode === "capture";

  useEffect(() => {
    loadJsQR(() => setLibOk(true));
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

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
    if (isCapture) {
      const cb = onFound || onResult;
      cb && cb({ type: "raw", code: raw });
      onClose();
      return;
    }
    const order = orders.find(o => o.id === raw || o.qr_code === raw);
    if (order) {
      const cb = onFound || onResult;
      cb && cb({ type: "order", data: order });
      onClose();
      return;
    }
    setErr(`Không tìm thấy mã "${raw}" trong hệ thống`);
  }

  function handleManual() {
    if (!manual.trim()) return;
    handleRaw(manual.trim());
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:4000, background:"rgba(0,0,0,.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ width:"100%", maxWidth:400 }}>
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

        <div style={{ position:"relative", borderRadius:18, overflow:"hidden", background:"#000", aspectRatio:"1", marginBottom:14 }}>
          <video ref={videoRef} playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          <canvas ref={canvasRef} style={{ display:"none" }} />
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
            <div style={{ width:"60%", height:"60%", position:"relative" }}>
              <div style={{ position:"absolute", inset:0, boxShadow:"0 0 0 9999px rgba(0,0,0,.5)", borderRadius:12 }} />
              <div style={{ position:"absolute", inset:0, border:"3px solid #a5b4fc", borderRadius:12 }} />
            </div>
          </div>
          <div style={{ position:"absolute", bottom:10, left:0, right:0, textAlign:"center" }}>
            {!libOk && <span style={{ background:"rgba(0,0,0,.7)", color:"#fcd34d", padding:"5px 14px", borderRadius:20, fontSize:12 }}>⏳ Đang tải thư viện QR...</span>}
            {libOk && !camReady && !err && <span style={{ background:"rgba(0,0,0,.7)", color:"#fff", padding:"5px 14px", borderRadius:20, fontSize:12 }}>📷 Đang mở camera...</span>}
            {libOk && camReady && !err && <span style={{ background:"rgba(0,0,0,.7)", color:"#a5b4fc", padding:"5px 14px", borderRadius:20, fontSize:12 }}>Đưa mã QR vào khung...</span>}
          </div>
        </div>

        {err && (
          <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:12, padding:"10px 14px", marginBottom:12, color:"#dc2626", fontSize:13, fontWeight:600, textAlign:"center" }}>
            {err}
            <div style={{ fontSize:12, color:"#6b7280", fontWeight:400, marginTop:4 }}>Thử nhập mã thủ công bên dưới</div>
          </div>
        )}

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

function QRPrintModal({ order, onClose }) {
  const qrRef = useRef();

  useEffect(() => {
    if (!qrRef.current || !order?.id) return;
    const el = qrRef.current;
    el.innerHTML = "";
    loadQRLib(() => {
      if (!el || !window.QRCode) return;
      el.innerHTML = "";
      try {
        new window.QRCode(el, {
          text: order.id,
          width: 200,
          height: 200,
          colorDark: "#1e1b4b",
          colorLight: "#ffffff",
          correctLevel: window.QRCode.CorrectLevel.M,
        });
      } catch(e) {}
    });
  }, [order?.id]);

  function handlePrint() {
    window.print();
  }

  if (!order) return null;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:5000, background:"rgba(0,0,0,.7)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:24, padding:32, width:"100%", maxWidth:360, textAlign:"center", boxShadow:"0 24px 64px rgba(0,0,0,.3)" }}>
        <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b", marginBottom:4 }}>🖨️ Phiếu QR Sửa Chữa</div>
        <div style={{ fontSize:13, color:"#6b7280", marginBottom:20 }}>Dán lên thiết bị để tra cứu nhanh</div>

        <div style={{ background:"#f9fafb", borderRadius:16, padding:20, marginBottom:20, border:"2px dashed #a5b4fc", display:"inline-block" }}>
          <div ref={qrRef} style={{ display:"inline-block" }} />
          <div style={{ fontWeight:900, fontSize:20, color:"#1e1b4b", marginTop:10 }}>{order.id}</div>
          <div style={{ fontSize:13, color:"#374151", marginTop:4 }}>{order.customer_name}</div>
          <div style={{ fontSize:12, color:"#6b7280" }}>{order.device_model}</div>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose}
            style={{ flex:1, height:48, background:"#f3f4f6", border:"none", borderRadius:12, fontWeight:700, fontSize:14, cursor:"pointer" }}>
            Đóng
          </button>
          <button onClick={handlePrint}
            style={{ flex:2, height:48, background:"#1e1b4b", color:"#fff", border:"none", borderRadius:12, fontWeight:800, fontSize:14, cursor:"pointer" }}>
            🖨️ In ngay
          </button>
        </div>
      </div>
    </div>
  );
}

export { loadQRLib, loadJsQR, QRCanvas, getQRDataUrl, QRScanModal, QRPrintModal };
export default QRScanModal;