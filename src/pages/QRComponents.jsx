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
/* Chuẩn hóa nội dung mã quét: QR in trên phiếu là URL (vd https://hk-1-touch.vercel.app?sale=BL-261006-9641
 * hoặc ?order=SC240001) → tách lấy mã trần để tra đơn. Mã không phải URL giữ nguyên.
 * Trả về { code, kind } với kind: "sale" | "order" | null */
export function normalizeScanCode(raw) {
  const txt = String(raw || "").trim();
  if (!/^https?:\/\//i.test(txt) && !/^[\w.-]+\.[a-z]{2,}\/?\?/i.test(txt)) return { code: txt, kind: null };
  try {
    const u = new URL(/^https?:/i.test(txt) ? txt : "https://" + txt);
    const sale = u.searchParams.get("sale");
    if (sale) return { code: sale.trim(), kind: "sale" };
    const ord = u.searchParams.get("order") || u.searchParams.get("code");
    if (ord) return { code: ord.trim(), kind: "order" };
  } catch {}
  return { code: txt, kind: null };
}

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

  function handleRaw(rawIn) {
    const raw = isCapture ? String(rawIn || "").trim() : normalizeScanCode(rawIn).code;
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
    <ScannerShell engine={engine} videoRef={videoRef} canvasRef={canvasRef}
      title={isCapture ? "Quét mã QR dán trên máy" : "Quét QR sản phẩm"}
      hint={isCapture ? "Lấy mã QR dán lên máy → điền vào đơn" : "QR đã gán: xem lịch sử · QR mới: gán cho đơn"}
      frame="square" manual={manual} setManual={setManual} onManual={handleManual}
      manualPlaceholder={isCapture ? "Nhập mã QR trên máy" : "Nhập mã đơn / QR"} onClose={onClose} />
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


/* ══════════════════════════════════════════════════════════
 * ScannerShell — giao diện quét TOÀN MÀN HÌNH kiểu Zalopay (dùng chung)
 *  - Camera phủ kín, vùng ngoài khung ngắm làm tối
 *  - Trên: X (trái) · chip zoom "1x" (giữa, bấm để đổi mức) · đèn pin (phải)
 *  - Khung ngắm 4 góc bo trắng; frame="square" cho QR, "wide" cho mã vạch
 *  - Thanh zoom nằm DƯỚI khung ngắm → không che khung
 *  - Dưới: tiêu đề/gợi ý, ô nhập tay, nút đổi camera
 * ══════════════════════════════════════════════════════════ */
const ZOOM_STEPS = [1, 2, 3, 5];

function ScannerCorners({ w, h }) {
  const L = 34, T = 4, R = 14, C = "#fff";
  const c = (pos, bs) => <div style={{ position:"absolute", width:L, height:L, ...pos, ...bs }} />;
  return (
    <div style={{ position:"relative", width:w, height:h }}>
      {c({top:0,left:0},  { borderTop:`${T}px solid ${C}`, borderLeft:`${T}px solid ${C}`,  borderTopLeftRadius:R })}
      {c({top:0,right:0}, { borderTop:`${T}px solid ${C}`, borderRight:`${T}px solid ${C}`, borderTopRightRadius:R })}
      {c({bottom:0,left:0},  { borderBottom:`${T}px solid ${C}`, borderLeft:`${T}px solid ${C}`,  borderBottomLeftRadius:R })}
      {c({bottom:0,right:0}, { borderBottom:`${T}px solid ${C}`, borderRight:`${T}px solid ${C}`, borderBottomRightRadius:R })}
    </div>
  );
}

export function ScannerShell({ engine, videoRef, canvasRef, title, hint, frame = "square",
  compact = false,
  manual, setManual, onManual, manualPlaceholder = "Nhập mã thủ công", onClose, children }) {
  const { status, errMsg, streamRef, cameras, switchCamera, deviceId } = engine;
  const [zoomCap, setZoomCap] = React.useState(null);
  const [zoom, setZoomVal]    = React.useState(1);
  const [torchOn, setTorchOn] = React.useState(false);
  const [torchOk, setTorchOk] = React.useState(false);
  const [showManual, setShowManual] = React.useState(false);

  React.useEffect(() => {
    if (status !== "scanning") return;
    const caps = getTrackCapabilities(streamRef.current);
    setTorchOk(!!caps.torch); setTorchOn(false);
    const z = caps.zoom;
    if (z && z.max > z.min) {
      setZoomCap(z);
      // QR nhỏ in trên thân máy → mặc định phóng 2x (nếu máy hỗ trợ)
      const target = Math.min(z.max, Math.max(z.min, 2));
      setZoomVal(target); setZoom(streamRef.current, target);
    } else setZoomCap(null);
  }, [status, deviceId]);

  function applyZoom(v) {
    if (!zoomCap) return;
    const val = Math.min(zoomCap.max, Math.max(zoomCap.min, v));
    setZoomVal(val); setZoom(streamRef.current, val);
  }
  function cycleZoom() {
    if (!zoomCap) return;
    const steps = ZOOM_STEPS.filter(x => x >= zoomCap.min && x <= zoomCap.max);
    const next = steps.find(x => x > zoom + 0.05) ?? steps[0] ?? zoomCap.min;
    applyZoom(next);
  }
  async function toggleTorch() {
    const nx = !torchOn;
    if (await setTorch(streamRef.current, nx)) setTorchOn(nx);
  }
  function close() { try { engine.stop(); } catch {} onClose(); }

  const fw = frame === "wide" ? "82vw" : "68vw";
  const fh = frame === "wide" ? "30vw" : "68vw";
  const iconBtn = { width:44, height:44, borderRadius:"50%", border:"none", cursor:"pointer", color:"#fff",
    background:"rgba(0,0,0,.35)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 };
  const mi = (n, size=24) => <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:size, lineHeight:1 }}>{n}</span>;

  return (
    <div style={compact
      ? { position:"fixed", top:0, left:0, right:0, height:"34vh", zIndex:4500, background:"#000", display:"flex", flexDirection:"column", overflow:"hidden", borderBottomLeftRadius:16, borderBottomRightRadius:16, boxShadow:"0 6px 18px rgba(0,0,0,.45)" }
      : { position:"fixed", inset:0, zIndex:4500, background:"#000", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Camera phủ kín */}
      <video ref={videoRef} muted playsInline style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
      <canvas ref={canvasRef} style={{ display:"none" }} />

      {/* Lớp tối + khung ngắm ở giữa vùng nhìn */}
      {status === "scanning" && (
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none", paddingBottom: compact ? "8%" : "8vh" }}>
          <div style={{ position:"relative", width:fw, height:fh, boxShadow:"0 0 0 100vmax rgba(0,0,0,.55)", borderRadius:R_FRAME }}>
            <ScannerCorners w="100%" h="100%" />
            <div style={{ position:"absolute", left:"6%", right:"6%", height:2, background:"rgba(255,255,255,.75)", top:"50%", animation:"hkscanline 1.8s ease-in-out infinite", borderRadius:2 }} />
          </div>
        </div>
      )}

      {/* Thanh trên: X · chip zoom · đèn pin */}
      <div style={{ position:"relative", zIndex:6, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"calc(env(safe-area-inset-top,0px) + 14px) 16px 0" }}>
        <button onClick={close} style={iconBtn} aria-label="Đóng">{mi("close", 26)}</button>
        {zoomCap ? (
          <button onClick={cycleZoom} style={{ ...iconBtn, width:"auto", padding:"0 16px", gap:6, borderRadius:24, height:40, fontWeight:800, fontSize:15 }}>
            {mi("photo_camera", 20)} {Number.isInteger(zoom) ? zoom : zoom.toFixed(1)}x
          </button>
        ) : <div style={{ width:44 }} />}
        {torchOk ? (
          <button onClick={toggleTorch} style={{ ...iconBtn, background: torchOn ? "#fbbf24" : "rgba(0,0,0,.35)", color: torchOn ? "#1e1b4b" : "#fff" }}>{mi(torchOn ? "flash_on" : "flash_off", 24)}</button>
        ) : <div style={{ width:44 }} />}
      </div>

      {/* Trạng thái giữa màn hình */}
      {status === "loading" && (
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:15, pointerEvents:"none" }}>Đang mở camera...</div>
      )}
      {status === "error" && (
        <div style={{ position:"absolute", left:24, right:24, top:"38%", background:"rgba(0,0,0,.7)", borderRadius:14, padding:16, color:"#fca5a5", fontSize:14, textAlign:"center", zIndex:6 }}>{errMsg}</div>
      )}

      <div style={{ flex:1 }} />

      {compact ? (
        <div style={{ position:"relative", zIndex:6, background:"linear-gradient(to top, rgba(0,0,0,.85) 60%, rgba(0,0,0,0))", padding:"8px 12px 10px" }}>
          {children}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <input value={manual} onChange={e => setManual(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onManual()}
              placeholder={manualPlaceholder}
              style={{ flex:1, height:38, borderRadius:19, border:"1.5px solid rgba(255,255,255,.35)", background:"rgba(255,255,255,.12)", color:"#fff", padding:"0 14px", fontSize:14, outline:"none" }} />
            {cameras && cameras.length > 1 && (
              <button onClick={switchCamera} style={{ ...iconBtn, width:38, height:38 }}>{mi("flip_camera_android", 20)}</button>
            )}
          </div>
        </div>
      ) : (
      <>

      {/* Vùng dưới: gợi ý + zoom + nhập tay */}
      <div style={{ position:"relative", zIndex:6, background:"linear-gradient(to top, rgba(0,0,0,.92) 55%, rgba(0,0,0,0))", padding:"40px 16px calc(env(safe-area-inset-bottom,0px) + 16px)" }}>
        <div style={{ textAlign:"center", color:"#fff", fontWeight:800, fontSize:17 }}>{title}</div>
        {hint && <div style={{ textAlign:"center", color:"#cbd5e1", fontSize:12.5, marginTop:4, marginBottom:12 }}>{hint}</div>}

        {zoomCap && status === "scanning" && (
          <div style={{ display:"flex", alignItems:"center", gap:10, margin:"0 4px 12px" }}>
            <span style={{ color:"#fff", fontSize:12, fontWeight:700 }}>1x</span>
            <input type="range" min={zoomCap.min} max={zoomCap.max} step={zoomCap.step || 0.1} value={zoom}
              onChange={e => applyZoom(parseFloat(e.target.value))} style={{ flex:1, accentColor:"#fff" }} />
            <span style={{ color:"#fff", fontSize:12, fontWeight:700 }}>{Math.round(zoomCap.max)}x</span>
          </div>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {showManual ? (
            <>
              <input autoFocus value={manual} onChange={e => setManual(e.target.value)}
                onKeyDown={e => e.key === "Enter" && onManual()}
                placeholder={manualPlaceholder}
                style={{ flex:1, height:48, borderRadius:24, border:"1.5px solid rgba(255,255,255,.35)", background:"rgba(255,255,255,.12)", color:"#fff", padding:"0 18px", fontSize:15, outline:"none" }} />
              <button onClick={onManual} style={{ height:48, padding:"0 20px", borderRadius:24, border:"none", background:"#4f46e5", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>OK</button>
            </>
          ) : (
            <button onClick={() => setShowManual(true)}
              style={{ flex:1, height:48, borderRadius:24, border:"1.5px solid rgba(255,255,255,.3)", background:"rgba(255,255,255,.1)", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              {mi("keyboard", 20)} Nhập mã thủ công
            </button>
          )}
          {cameras && cameras.length > 1 && (
            <button onClick={switchCamera} style={{ ...iconBtn, width:48, height:48, background:"rgba(255,255,255,.15)" }}>{mi("flip_camera_android", 24)}</button>
          )}
        </div>
        {children}
      </div>
      </>
      )}
      <style>{`@keyframes hkscanline { 0%,100%{top:8%} 50%{top:92%} }`}</style>
    </div>
  );
}
const R_FRAME = 18;

// Crop vùng (boxW x boxH px màn hình) quanh tâm video, lệch dọc dy px — xử lý object-fit:cover
export function cropRegion(video, canvas, boxW, boxH, dy = 0) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return null;
  const rect = video.getBoundingClientRect();
  const dispW = rect.width || vw, dispH = rect.height || vh;
  const videoAspect = vw / vh, dispAspect = dispW / dispH;
  let visW, visH, offX = 0, offY = 0;
  if (videoAspect > dispAspect) { visH = vh; visW = vh * dispAspect; offX = (vw - visW) / 2; }
  else { visW = vw; visH = vw / dispAspect; offY = (vh - visH) / 2; }
  const scaleX = visW / dispW, scaleY = visH / dispH;
  // thêm 12% viền an toàn quanh khung
  const bw = Math.min(dispW, boxW * 1.12), bh = Math.min(dispH, boxH * 1.12);
  const bx = (dispW - bw) / 2, by = (dispH - bh) / 2 + dy;
  const sx = Math.max(0, offX + bx * scaleX), sy = Math.max(0, offY + by * scaleY);
  const sw = Math.min(vw - sx, bw * scaleX) || vw, sh = Math.min(vh - sy, bh * scaleY) || vh;
  canvas.width = sw; canvas.height = sh;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  return ctx;
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
export function useScannerEngine({ videoRef, canvasRef, onResult, engineTimeoutMs = 8000, squareCrop = false, continuous = false }) {
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
  const onResultRef = React.useRef(onResult);
  onResultRef.current = onResult;
  const pauseUntilRef = React.useRef(0);
  const lastCodeRef = React.useRef({ code: "", at: 0 });

  React.useEffect(() => () => { stop(); }, []);

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }

  function doCrop(v, c) {
    // Khớp đúng khung ngắm của ScannerShell (toàn màn hình, khung nằm cao hơn tâm 4vh)
    // Kich thuoc phan tu video (toan man hinh = window; compact = khung nho) -> crop luon dung khung ngam
    const ew = v.clientWidth || window.innerWidth, eh = v.clientHeight || window.innerHeight;
    const boxW = squareCrop ? ew * 0.68 : ew * 0.82;
    const boxH = squareCrop ? ew * 0.68 : ew * 0.30;
    return cropRegion(v, c, boxW, boxH, eh * -0.04);
  }

  function done(raw) {
    const code = String(raw || "").trim();
    if (!continuous) { stop(); onResultRef.current(code); return; }
    // Che do lien tuc (soan hang): giu camera, quet tiep sau khi nghi ngan
    const now = performance.now();
    if (!code) return;
    if (lastCodeRef.current.code === code && now - lastCodeRef.current.at < 1500) return; // cung ma -> bo qua
    lastCodeRef.current = { code, at: now };
    pauseUntilRef.current = now + 700;
    onResultRef.current(code);
  }

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
      if (continuous && performance.now() < pauseUntilRef.current) { scanLoop(); return; }
      let found = false;
      const eng = engineRef.current;

      if (eng === "native" && detectorRef.current) {
        const ctx = doCrop(v, c);
        try {
          if (ctx) {
            const bars = await detectorRef.current.detect(c);
            if (bars.length > 0) { found = true; done(bars[0].rawValue); if (continuous) scanLoop(); return; }
          }
          // Dự phòng: quét cả khung hình (đề phòng crop lệch)
          const full = await detectorRef.current.detect(v);
          if (full.length > 0) { found = true; done(full[0].rawValue); if (continuous) scanLoop(); return; }
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
              if (txt) { found = true; done(txt); if (continuous) scanLoop(); return; }
            }
          } catch {}
          if (!found) {
            try {
              c.width = v.videoWidth; c.height = v.videoHeight;
              c.getContext("2d").drawImage(v, 0, 0);
              const txt2 = zxingDecodeRef.current(c);
              if (txt2) { found = true; done(txt2); if (continuous) scanLoop(); return; }
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
              if (code?.data) { found = true; done(code.data.trim()); if (continuous) scanLoop(); return; }
            }
          } catch {}
          if (!found) {
            try {
              c.width = v.videoWidth; c.height = v.videoHeight;
              const ctx2 = c.getContext("2d"); ctx2.drawImage(v, 0, 0);
              const img2 = ctx2.getImageData(0, 0, c.width, c.height);
              const code2 = window.jsQR(img2.data, img2.width, img2.height, { inversionAttempts: "attemptBoth" });
              if (code2?.data) { found = true; done(code2.data.trim()); if (continuous) scanLoop(); return; }
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

  // Chưa quét xong → giao diện quét toàn màn hình kiểu Zalopay
  if (!done) {
    return (
      <ScannerShell engine={engine} videoRef={videoRef} canvasRef={canvasRef}
        title="Quét mã vạch IMEI" hint="Đưa mã vạch trên máy vào khung" frame="wide"
        manual={manual} setManual={setManual}
        onManual={() => manual.trim() && confirmImei(manual)}
        manualPlaceholder="Nhập IMEI / Serial" onClose={onClose} />
    );
  }

  // Đã quét → xác nhận / sửa số
  return (
    <div style={{ position:"fixed", inset:0, zIndex:4500, background:"rgba(0,0,0,.95)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ width:"100%", maxWidth:420 }}>
        <div style={{ background:"#f0fdf4", borderRadius:14, padding:18, marginBottom:14, border:"2px solid #6ee7b7", textAlign:"center" }}>
          <div style={{ fontSize:13, color:"#065f46", fontWeight:700, marginBottom:6 }}>Đã quét được:</div>
          <input value={detected} onChange={e => setDetected(e.target.value)}
            style={{ width:"100%", background:"#fff", border:"1.5px solid #6ee7b7", borderRadius:10, padding:"10px 14px", fontSize:16, fontWeight:800, textAlign:"center", fontFamily:"monospace", boxSizing:"border-box", outline:"none" }} />
          <div style={{ fontSize:11, color:"#6b7280", marginTop:6 }}>Chỉnh sửa nếu cần rồi nhấn Xác Nhận</div>
        </div>
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
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
 * ScanCodeModal — quét mã vạch / QR bất kỳ, trả về GIÁ TRỊ THÔ
 * (không lọc IMEI như IMEIScanModal)
 * Props: { title, hint, onFound(raw), onClose }
 * ══════════════════════════════════════════════════════════ */
export function ScanCodeModal({ title = "Quét mã", hint = "Hướng camera vào mã vạch / QR", frame = "wide", onFound, onClose }) {
  const videoRef    = React.useRef();
  const canvasRef   = React.useRef();
  const [manual, setManual]   = React.useState("");

  const engine = useScannerEngine({ videoRef, canvasRef, squareCrop: frame === "square", onResult: onFound });
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
    <ScannerShell engine={engine} videoRef={videoRef} canvasRef={canvasRef}
      title={title} hint={hint} frame={frame}
      manual={manual} setManual={setManual}
      onManual={() => manual.trim() && finish(manual.trim())}
      manualPlaceholder="Nhập mã thủ công" onClose={onClose} />
  );
}
