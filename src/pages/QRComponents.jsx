/* v1774860462-4890 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { RepairChat, Notification, Staff, RepairOrder, Customer, SparePart, SparePartUsage } from "./pb.jsx";
import { uploadFile } from "./pb.jsx";


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
function QRScanModal({ onClose, onFound: onFoundProp, onResult, orders = [], mode = "search" }) {
  const onFound = onFoundProp || onResult || (() => {});
  const videoRef = useRef();
  const canvasRef = useRef();
  const [manual, setManual] = useState("");
  const doneRef = useRef(false);
  const isCapture = mode === "capture";

  // Engine dùng chung: BarcodeDetector → ZXing → jsQR
  const engine = useScannerEngine({ videoRef, canvasRef, squareCrop: true, onResult: (raw) => handleRaw(String(raw).trim()) });
  const { status, errMsg, streamRef } = engine;

  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, []);

  function close() { try { engine.stop(); } catch {} onClose(); }

  function handleRaw(raw) {
    if (!raw || doneRef.current) return;
    doneRef.current = true;
    try { engine.stop(); } catch {}
    if (isCapture) { onFound({ type: "raw", code: raw }); onClose(); return; }

    // Tìm theo product_qr trước (QR dán trên máy → lịch sử sửa chữa)
    const byProductQR = (orders || []).filter(o => o.product_qr && o.product_qr === raw);
    if (byProductQR.length > 0) {
      onFound({ type: "product_history", qr: raw, orders: byProductQR });
      onClose();
      return;
    }

    (async () => {
      try {
        const stockItems = await SparePart.filter({ sku: raw, category: "device_stock" });
        if (stockItems && stockItems.length > 0) {
          onFound({ type: "warehouse_stock", data: stockItems[0], qr: raw });
          onClose();
          return;
        }
      } catch {}
      const byOrderId = (orders || []).find(o => o.id === raw || o.qr_code === raw || o.order_code === raw);
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
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div>
            <div style={{ color:"#fff", fontWeight:800, fontSize:20 }}>
              {isCapture ? "Quét Mã QR Máy" : "Quét QR Sản Phẩm"}
            </div>
            <div style={{ color:"#a5b4fc", fontSize:12, marginTop:2 }}>
              {isCapture ? "Lấy mã QR dán lên máy → điền vào đơn" : "QR đã gán: xem lịch sử · QR mới: gán cho đơn này"}
            </div>
          </div>
          <button onClick={close}
            style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:40, height:40, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22,verticalAlign:"middle",lineHeight:1}}>close</span></button>
        </div>

        <div style={{ position:"relative", borderRadius:18, overflow:"hidden", background:"#000", aspectRatio:"1", marginBottom:14 }}>
          <video ref={videoRef} playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          <canvas ref={canvasRef} style={{ display:"none" }} />
          <TorchButton stream={streamRef.current} />
          <CameraControls engine={engine} />
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
            <div style={{ width:"70%", height:"70%", position:"relative" }}>
              <div style={{ position:"absolute", inset:0, boxShadow:"0 0 0 9999px rgba(0,0,0,.5)", borderRadius:12 }} />
              <div style={{ position:"absolute", inset:0, border:"3px solid #a5b4fc", borderRadius:12 }} />
            </div>
          </div>
          <div style={{ position:"absolute", bottom:10, left:0, right:0, textAlign:"center" }}>
            {status === "loading" && <span style={{ background:"rgba(0,0,0,.7)", color:"#fff", padding:"5px 14px", borderRadius:20, fontSize:12 }}>Đang mở camera...</span>}
            {status === "scanning" && <span style={{ background:"rgba(0,0,0,.7)", color:"#a5b4fc", padding:"5px 14px", borderRadius:20, fontSize:12 }}>Đưa mã QR vào khung, giữ máy ổn định...</span>}
          </div>
        </div>

        {status === "error" && (
          <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:12, padding:"10px 14px", marginBottom:12, color:"#dc2626", fontSize:13, fontWeight:600, textAlign:"center" }}>
            {errMsg}
            <div style={{ fontSize:12, color:"#6b7280", fontWeight:400, marginTop:4 }}>Thử nhập mã thủ công bên dưới</div>
          </div>
        )}

        <div style={{ background:"rgba(255,255,255,.08)", borderRadius:14, padding:14 }}>
          <div style={{ color:"#e5e7eb", fontSize:13, fontWeight:600, marginBottom:8 }}>
            {isCapture ? "Hoặc nhập mã QR thủ công:" : "Hoặc nhập mã đơn thủ công:"}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input value={manual} onChange={e => setManual(e.target.value)}
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


// ══════════════════════════════════════════════════════════
// Helpers dùng chung cho MỌI màn quét mã trong app (đèn pin, lấy nét, crop khung ngắm)
// ══════════════════════════════════════════════════════════

// Mở camera sau — thử độ phân giải cao + lấy nét liên tục, tự hạ cấp nếu máy không hỗ trợ
export async function openScannerStream(deviceId) {
  const base = { width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: "continuous" }] };
  const attempts = [];
  if (deviceId) attempts.push({ deviceId: { exact: deviceId }, ...base });
  attempts.push(
    { facingMode: { ideal: "environment" }, ...base },
    { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 }, advanced: [{ focusMode: "continuous" }] },
    { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
    { facingMode: "environment" },
    true,
  );
  let lastErr;
  for (const video of attempts) {
    try { return await navigator.mediaDevices.getUserMedia({ video }); } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("Không mở được camera");
}

// Chờ video có khung hình thật (tránh màn hình đen)
export function waitForFrame(video, timeoutMs = 1500) {
  return new Promise(resolve => {
    const t0 = performance.now();
    (function check() {
      if (video && video.readyState >= 2 && video.videoWidth > 0) { resolve(true); return; }
      if (performance.now() - t0 > timeoutMs) { resolve(false); return; }
      requestAnimationFrame(check);
    })();
  });
}

// Liệt kê camera sau & chọn camera "chính" (bỏ góc siêu rộng / tele / depth / macro).
// Phải gọi SAU khi đã được cấp quyền camera thì label mới có.
export async function listBackCameras() {
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput");
    const back = devs.filter(d => /back|rear|environment|sau/i.test(d.label) || !/front|user|trước/i.test(d.label));
    const bad = /ultra|wide|tele|depth|macro|siêu|góc rộng/i;
    const main = back.find(d => !bad.test(d.label) && /(camera2 0|camera 0|back camera$|rear)/i.test(d.label))
              || back.find(d => !bad.test(d.label))
              || back[0];
    return { cameras: back, mainId: main?.deviceId || null };
  } catch { return { cameras: [], mainId: null }; }
}

// Đặt zoom phần cứng
export async function setZoom(stream, value) {
  const track = stream?.getVideoTracks?.()[0];
  if (!track) return false;
  try { await track.applyConstraints({ advanced: [{ zoom: value }] }); return true; } catch { return false; }
}

// Lấy nét tại điểm chạm (nếu máy hỗ trợ)
export async function focusAt(stream, x, y) {
  const track = stream?.getVideoTracks?.()[0];
  if (!track) return;
  try { await track.applyConstraints({ advanced: [{ focusMode: "single-shot", pointsOfInterest: [{ x, y }] }] }); } catch {}
  setTimeout(() => { try { track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }); } catch {} }, 1500);
}

// Kiểm tra thiết bị có hỗ trợ đèn pin / zoom quang không
export function getTrackCapabilities(stream) {
  const track = stream?.getVideoTracks?.()[0];
  if (!track) return { track: null, torch: false, zoom: null };
  let caps = {};
  try { caps = track.getCapabilities?.() || {}; } catch {}
  return { track, torch: !!caps.torch, zoom: caps.zoom || null };
}

// Bật/tắt đèn pin (torch) trên camera sau — chỉ hoạt động trên HTTPS + Chrome Android
export async function setTorch(stream, on) {
  const track = stream?.getVideoTracks?.()[0];
  if (!track) return false;
  try { await track.applyConstraints({ advanced: [{ torch: on }] }); return true; } catch { return false; }
}

// Crop đúng vùng khung ngắm (khung vàng) ra canvas riêng trước khi quét
// → bỏ nhiễu xung quanh, "zoom số" vào mã, tăng mạnh tỉ lệ quét thành công
// QUAN TRỌNG: video hiển thị bằng object-fit:cover nên nếu tỉ lệ khung hình
// camera thực tế (videoWidth/videoHeight) khác tỉ lệ khung CSS (thường 16:9),
// phần nhìn thấy trên màn hình đã bị cắt lệch khỏi khung gốc — phải trừ đúng
// phần bị cắt (offsetX/offsetY) mới map đúng toạ độ, nếu không sẽ cắt nhầm vùng.
export function cropViewfinder(video, canvas, widthPct = 0.85, heightPx = 72) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return null;
  const rect = video.getBoundingClientRect();
  const dispW = rect.width || vw, dispH = rect.height || vh;
  if (!dispW || !dispH) return null;

  // Phần khung hình camera thực sự hiển thị trên màn hình sau object-fit:cover
  const videoAspect = vw / vh, dispAspect = dispW / dispH;
  let visW, visH, offX = 0, offY = 0;
  if (videoAspect > dispAspect) { // camera rộng hơn khung hiển thị → cắt 2 bên
    visH = vh; visW = vh * dispAspect; offX = (vw - visW) / 2;
  } else { // camera cao hơn khung hiển thị → cắt trên/dưới
    visW = vw; visH = vw / dispAspect; offY = (vh - visH) / 2;
  }
  const scaleX = visW / dispW, scaleY = visH / dispH;

  const boxW = dispW * widthPct;
  const boxH = heightPx;
  const boxX = (dispW - boxW) / 2;
  const boxY = (dispH - boxH) / 2;

  const sx = Math.max(0, offX + boxX * scaleX);
  const sy = Math.max(0, offY + boxY * scaleY);
  const sw = Math.min(vw - sx, boxW * scaleX) || vw;
  const sh = Math.min(vh - sy, boxH * scaleY) || vh;

  canvas.width = sw; canvas.height = sh;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  return ctx;
}


// Thanh điều khiển zoom + đổi camera — dùng chung cho mọi modal quét
export function CameraControls({ engine }) {
  const { streamRef, status, cameras, deviceId, switchCamera } = engine;
  const [zoomCap, setZoomCap] = React.useState(null);
  const [zoom, setZoomVal] = React.useState(1);
  React.useEffect(() => {
    if (status !== "scanning") return;
    const { zoom: z } = getTrackCapabilities(streamRef.current);
    if (z && z.max > z.min) {
      setZoomCap(z);
      const target = Math.min(z.max, Math.max(z.min, 2)); // mặc định 2x cho QR nhỏ
      setZoomVal(target); setZoom(streamRef.current, target);
    } else setZoomCap(null);
  }, [status, deviceId]);
  if (status !== "scanning") return null;
  return (
    <div style={{ position:"absolute", left:10, right:10, bottom:44, zIndex:5, display:"flex", alignItems:"center", gap:8 }}>
      {zoomCap && (
        <div style={{ flex:1, display:"flex", alignItems:"center", gap:8, background:"rgba(0,0,0,.55)", borderRadius:20, padding:"6px 12px" }}>
          <span style={{ color:"#fff", fontSize:12, fontWeight:700, minWidth:34 }}>{zoom.toFixed(1)}x</span>
          <input type="range" min={zoomCap.min} max={zoomCap.max} step={zoomCap.step || 0.1} value={zoom}
            onChange={e => { const v = parseFloat(e.target.value); setZoomVal(v); setZoom(streamRef.current, v); }}
            style={{ flex:1, accentColor:"#a5b4fc" }} />
        </div>
      )}
      {cameras && cameras.length > 1 && (
        <button onClick={switchCamera}
          style={{ width:40, height:40, borderRadius:"50%", border:"none", background:"rgba(0,0,0,.55)", color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:22 }}>flip_camera_android</span>
        </button>
      )}
    </div>
  );
}

// Nút bật/tắt đèn pin — tự ẩn nếu máy không hỗ trợ
export function TorchButton({ stream, style }) {
  const [supported, setSupported] = React.useState(false);
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const { torch } = getTrackCapabilities(stream);
    setSupported(torch);
    return () => { if (stream) setTorch(stream, false); };
  }, [stream]);
  if (!supported) return null;
  return (
    <button onClick={async () => { const next = !on; const ok = await setTorch(stream, next); if (ok) setOn(next); }}
      style={{
        position:"absolute", top:10, right:10, zIndex:5,
        width:40, height:40, borderRadius:"50%", border:"none", cursor:"pointer",
        background: on ? "#fbbf24" : "rgba(0,0,0,.5)", color: on ? "#1e1b4b" : "#fff",
        display:"flex", alignItems:"center", justifyContent:"center",
        ...style,
      }}>
      <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:20 }}>{on ? "flash_on" : "flash_off"}</span>
    </button>
  );
}

// ══════════════════════════════════════════════════════════
// ZXing JS — engine dự phòng cho thiết bị KHÔNG có BarcodeDetector native
// (thường là tablet không có Google Play Services đầy đủ, VD: Lenovo tablet)
// ZXing đọc được cả mã vạch 1D (Code128, EAN...) mà jsQR không đọc được.
// ══════════════════════════════════════════════════════════
let _zxLoaded = false;
let _zxCbs = [];
export function loadZxing(cb) {
  if (_zxLoaded) { cb(!!window.ZXing); return; }
  _zxCbs.push(cb);
  if (_zxCbs.length > 1) return; // đang load rồi
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";
  s.onload = () => { _zxLoaded = true; _zxCbs.forEach(f => f(!!window.ZXing)); _zxCbs = []; };
  s.onerror = () => { _zxCbs.forEach(f => f(false)); _zxCbs = []; };
  document.head.appendChild(s);
}

// Trả về hàm decode(canvas) → text | null. Tự chọn API theo phiên bản ZXing.
export function makeZxingDecoder() {
  const ZX = window.ZXing;
  if (!ZX) return null;
  if (ZX.BrowserMultiFormatReader && ZX.BrowserMultiFormatReader.prototype.decodeFromCanvas) {
    const r = new ZX.BrowserMultiFormatReader();
    return (canvas) => {
      const res = r.decodeFromCanvas(canvas);
      return res ? (res.getText ? res.getText() : String(res)) : null;
    };
  }
  const reader = new ZX.MultiFormatReader();
  return (canvas) => {
    try { reader.reset(); } catch {}
    const luminance = new ZX.HTMLCanvasElementLuminanceSource(canvas);
    const bitmap = new ZX.BinaryBitmap(new ZX.HybridBinarizer(luminance));
    const res = reader.decode(bitmap);
    return res ? (res.getText ? res.getText() : String(res)) : null;
  };
}

const ZXING_FORMATS = ["code_128","code_39","ean_13","ean_8","qr_code","data_matrix","itf","upc_a","upc_e"];

/* useScannerEngine — hook quét mã dùng chung cho mọi màn:
 * - Engine chain: BarcodeDetector native → ZXing (1D+2D) → jsQR (QR/DataMatrix)
 * - Tự động chuyển từ native sang ZXing nếu quét engineTimeoutMs không ra kết quả
 *   (một số máy có API native nhưng bị hỏng, không bao giờ detect được)
 * - Quét ưu tiên vùng crop khung ngắm, có dự phòng toàn khung hình
 * Trả về: { start, stop, status, errMsg, streamRef, engineRef } */
export function useScannerEngine({ videoRef, canvasRef, onResult, engineTimeoutMs = 8000, squareCrop = false }) {
  const streamRef   = React.useRef(null);
  const rafRef      = React.useRef(null);
  const detectorRef = React.useRef(null);
  const zxingDecodeRef = React.useRef(null);
  const engineRef   = React.useRef("loading");
  const engineStartRef = React.useRef(0);
  const lastHeavyRef = React.useRef(0);
  const [status, setStatus] = React.useState("loading");
  const [errMsg, setErrMsg] = React.useState("");
  const [cameras, setCameras] = React.useState([]);
  const [deviceId, setDeviceId] = React.useState(null);
  const deviceIdRef = React.useRef(null);
  const camsRef = React.useRef([]);

  React.useEffect(() => () => { stop(); }, []);

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }

  function doCrop(v, c) {
    if (squareCrop) {
      const w = v.getBoundingClientRect().width || 300;
      return cropViewfinder(v, c, 0.70, w * 0.70);
    }
    return cropViewfinder(v, c, 0.85, 72);
  }

  function done(raw) { stop(); onResult(String(raw || "").trim()); }

  function tryInitZxing() {
    return new Promise(resolve => {
      loadZxing(ok => {
        if (!ok) { resolve(false); return; }
        try { zxingDecodeRef.current = makeZxingDecoder(); resolve(!!zxingDecodeRef.current); }
        catch { resolve(false); }
      });
    });
  }

  async function openCam(id) {
    const stream = await openScannerStream(id);
    streamRef.current = stream;
    const v = videoRef.current;
    if (!v) return;
    v.srcObject = stream;
    await v.play();
    return stream;
  }

  async function switchCamera() {
    const cams = camsRef.current;
    if (cams.length < 2) return;
    const idx = cams.findIndex(c => c.deviceId === deviceIdRef.current);
    const next = cams[(idx + 1) % cams.length];
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setStatus("loading");
    try {
      await openCam(next.deviceId);
      if (!(await waitForFrame(videoRef.current, 1500))) throw new Error("no-frame");
      deviceIdRef.current = next.deviceId; setDeviceId(next.deviceId);
      engineStartRef.current = performance.now();
      setStatus("scanning");
      scanLoop();
    } catch {
      // Camera đích không ra hình → mở lại camera mặc định
      try {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        await openCam();
        engineStartRef.current = performance.now();
        setStatus("scanning"); scanLoop();
      } catch { setStatus("error"); setErrMsg("Không đổi được camera."); }
    }
  }

  async function start() {
    setStatus("loading"); setErrMsg("");
    engineRef.current = "loading";

    // 1. BarcodeDetector native
    if (window.BarcodeDetector) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats().catch(() => ZXING_FORMATS);
        detectorRef.current = new window.BarcodeDetector({ formats: formats.length ? formats : ZXING_FORMATS });
        engineRef.current = "native";
      } catch {}
    }
    // 2. ZXing — đọc được cả mã vạch 1D (quan trọng cho tablet)
    if (engineRef.current === "loading") {
      if (await tryInitZxing()) engineRef.current = "zxing";
    }
    // 3. jsQR — chỉ QR/DataMatrix (cứ để dành cho trường hợp cực hiếm)
    if (engineRef.current === "loading") {
      await new Promise(res => loadJsQR(res));
      if (window.jsQR) engineRef.current = "jsqr";
    }
    if (engineRef.current === "loading") {
      setStatus("error"); setErrMsg("Thiết bị không hỗ trợ quét mã — vui lòng nhập thủ công.");
      return;
    }

    try {
      await openCam();
      // Sau khi có quyền → liệt kê camera, nếu đang không phải camera chính thì thử chuyển.
      // Nếu camera chính không ra hình (đen) → quay lại camera mặc định, không để màn hình đen.
      const { cameras: cams, mainId } = await listBackCameras();
      camsRef.current = cams; setCameras(cams);
      let curId = streamRef.current?.getVideoTracks?.()[0]?.getSettings?.().deviceId || null;
      deviceIdRef.current = curId; setDeviceId(curId);
      if (mainId && curId && mainId !== curId) {
        const fallbackId = curId;
        try {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
          await openCam(mainId);
          const ok = await waitForFrame(videoRef.current, 1500);
          if (!ok) throw new Error("no-frame");
          deviceIdRef.current = mainId; setDeviceId(mainId);
        } catch {
          try { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); } catch {}
          streamRef.current = null;
          await openCam(fallbackId).catch(() => openCam());
          deviceIdRef.current = fallbackId; setDeviceId(fallbackId);
        }
      }
      engineStartRef.current = performance.now();
      setStatus("scanning");
      scanLoop();
    } catch (e) {
      setStatus("error");
      setErrMsg("Không mở được camera. Nhập thủ công bên dưới.");
    }
  }

  function scanLoop() {
    rafRef.current = requestAnimationFrame(async () => {
      const v = videoRef.current; const c = canvasRef.current;
      if (!v || !c || v.readyState < 2) { scanLoop(); return; }
      let found = false;
      const eng = engineRef.current;

      if (eng === "native" && detectorRef.current) {
        const ctx = doCrop(v, c);
        try {
          if (ctx) {
            const bars = await detectorRef.current.detect(c);
            if (bars.length > 0) { found = true; done(bars[0].rawValue); return; }
          }
          // Dự phòng: quét cả khung hình (đề phòng crop lệch)
          const full = await detectorRef.current.detect(v);
          if (full.length > 0) { found = true; done(full[0].rawValue); return; }
        } catch {}
        // Tự chuyển sang ZXing nếu native "có mà không làm việc" sau engineTimeoutMs
        if (!found && performance.now() - engineStartRef.current > engineTimeoutMs && !zxingDecodeRef.current) {
          if (await tryInitZxing()) { engineRef.current = "zxing"; engineStartRef.current = performance.now(); }
        }
      } else if (eng === "zxing" && zxingDecodeRef.current) {
        const now = performance.now();
        if (now - lastHeavyRef.current > 300) { // decode ZXing nặng → throttle
          lastHeavyRef.current = now;
          const ctx = doCrop(v, c);
          try {
            if (ctx) {
              const txt = zxingDecodeRef.current(c);
              if (txt) { found = true; done(txt); return; }
            }
          } catch {}
          if (!found) {
            try {
              c.width = v.videoWidth; c.height = v.videoHeight;
              c.getContext("2d").drawImage(v, 0, 0);
              const txt2 = zxingDecodeRef.current(c);
              if (txt2) { found = true; done(txt2); return; }
            } catch {}
          }
        }
      } else if (eng === "jsqr" && window.jsQR) {
        const now = performance.now();
        if (now - lastHeavyRef.current > 300) {
          lastHeavyRef.current = now;
          const ctx = doCrop(v, c);
          try {
            if (ctx) {
              const img = ctx.getImageData(0, 0, c.width, c.height);
              const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
              if (code?.data) { found = true; done(code.data.trim()); return; }
            }
          } catch {}
          if (!found) {
            try {
              c.width = v.videoWidth; c.height = v.videoHeight;
              const ctx2 = c.getContext("2d"); ctx2.drawImage(v, 0, 0);
              const img2 = ctx2.getImageData(0, 0, c.width, c.height);
              const code2 = window.jsQR(img2.data, img2.width, img2.height, { inversionAttempts: "attemptBoth" });
              if (code2?.data) { found = true; done(code2.data.trim()); return; }
            } catch {}
          }
        }
      }
      scanLoop();
    });
  }

  return { start, stop, status, errMsg, streamRef, engineRef, cameras, deviceId, switchCamera };
}

// ── IMEIScanModal — quét barcode 1D/2D để lấy IMEI ──────────────────────────
// Ưu tiên: BarcodeDetector (native) → ZXing (wasm) → jsQR fallback
export function IMEIScanModal({ onClose, onFound: onFoundProp, onResult }) {
  const onFound = onFoundProp || onResult || (() => {});
  const videoRef = React.useRef();
  const canvasRef = React.useRef();
  const [manual, setManual] = React.useState("");
  const [detected, setDetected] = React.useState("");
  const [done, setDone] = React.useState(false);

  const engine = useScannerEngine({
    videoRef, canvasRef,
    onResult: (raw) => {
      // Lọc lấy phần số IMEI (15 số) nếu có trong chuỗi
      const imeiMatch = raw.match(/\b\d{14,16}\b/);
      setDetected(imeiMatch ? imeiMatch[0] : raw);
      setDone(true);
    },
  });
  const { status, errMsg, streamRef } = engine;

  React.useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, []);

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
          <button onClick={() => { engine.stop(); onClose(); }}
            style={{ background:"rgba(255,255,255,.15)", border:"none", color:"#fff", width:38, height:38, borderRadius:"50%", fontSize:18, cursor:"pointer"}}> </button>
        </div>

        {/* Camera view */}
        {!done && (
          <div style={{ position:"relative", borderRadius:16, overflow:"hidden", background:"#000", aspectRatio:"16/9", marginBottom:14 }}>
            <video ref={videoRef} muted playsInline style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            <canvas ref={canvasRef} style={{ display:"none" }} />
            <TorchButton stream={streamRef.current} />
            <CameraControls engine={engine} />

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
        {done && (
          <div style={{ background:"#f0fdf4", borderRadius:14, padding:18, marginBottom:14, border:"2px solid #6ee7b7", textAlign:"center" }}>
            <div style={{ fontSize:13, color:"#065f46", fontWeight:700, marginBottom:6 }}>  Đã quét được:</div>
            <input value={detected} onChange={e => setDetected(e.target.value)}
              style={{ width:"100%", background:"#fff", border:"1.5px solid #6ee7b7", borderRadius:10, padding:"10px 14px", fontSize:16, fontWeight:800, textAlign:"center", fontFamily:"monospace", boxSizing:"border-box", outline:"none" }} />
            <div style={{ fontSize:11, color:"#6b7280", marginTop:6 }}>Chỉnh sửa nếu cần rồi nhấn Xác Nhận</div>
          </div>
        )}

        {/* Nút action */}
        {done ? (
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => { setDone(false); setDetected(""); engine.start(); }}
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

/* ══════════════════════════════════════════════════════════
 * ScanCodeModal — quét mã vạch / QR bất kỳ, trả về GIÁ TRỊ THÔ
 * (không lọc IMEI như IMEIScanModal)
 * Props: { title, hint, onFound(raw), onClose }
 * ══════════════════════════════════════════════════════════ */
export function ScanCodeModal({ title = "▦ Quét mã", hint = "Hướng camera vào mã vạch / QR", onFound, onClose }) {
  const videoRef    = React.useRef();
  const canvasRef   = React.useRef();
  const [manual, setManual]   = React.useState("");

  const engine = useScannerEngine({ videoRef, canvasRef, onResult: onFound });
  const { status, errMsg, streamRef } = engine;

  React.useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, []);

  function finish(raw) {
    engine.stop();
    onFound(String(raw).trim());
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:4500, background:"rgba(0,0,0,.95)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ width:"100%", maxWidth:420 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div>
            <div style={{ color:"#fff", fontWeight:900, fontSize:20 }}>{title}</div>
            <div style={{ color:"#94a3b8", fontSize:12, marginTop:2 }}>{hint}</div>
          </div>
          <button onClick={() => { engine.stop(); onClose(); }}
            style={{ background:"rgba(255,255,255,.15)", border:"none", color:"#fff", width:38, height:38, borderRadius:"50%", fontSize:18, cursor:"pointer" }}>✕</button>
        </div>

        <div style={{ position:"relative", borderRadius:16, overflow:"hidden", background:"#000", aspectRatio:"16/9", marginBottom:14 }}>
          <video ref={videoRef} muted playsInline style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          <canvas ref={canvasRef} style={{ display:"none" }} />
          <TorchButton stream={streamRef.current} />
          <CameraControls engine={engine} />
          {status === "scanning" && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
              <div style={{ width:"85%", height:72, border:"2.5px solid #fbbf24", borderRadius:8, boxShadow:"0 0 0 2000px rgba(0,0,0,.35)", position:"relative" }}>
                <div style={{ position:"absolute", left:0, right:0, height:2, background:"#fbbf24", top:"50%", animation:"scanline 1.5s ease-in-out infinite", opacity:.8 }} />
              </div>
            </div>
          )}
          {status === "loading" && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:14 }}>⏳ Đang khởi động camera...</div>
          )}
          {status === "error" && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,.7)" }}>
              <div style={{ color:"#f87171", fontSize:13, textAlign:"center", padding:16 }}>⚠️ {errMsg}</div>
            </div>
          )}
        </div>

        <div style={{ display:"flex", gap:8 }}>
          <input value={manual} onChange={e => setManual(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && manual.trim()) { finish(manual.trim()); } }}
            placeholder="...hoặc nhập mã thủ công rồi Enter"
            style={{ flex:1, padding:"12px 14px", borderRadius:10, border:"1px solid #475569", background:"#1e293b", color:"#fff", fontSize:14 }} />
          <button onClick={() => manual.trim() && finish(manual.trim())}
            style={{ padding:"12px 16px", borderRadius:10, border:"none", background:"#4f46e5", color:"#fff", fontWeight:800, fontSize:13 }}>Xác nhận</button>
        </div>
        <style>{`@keyframes scanline { 0%,100%{top:10%} 50%{top:90%} }`}</style>
      </div>
    </div>
  );
}
