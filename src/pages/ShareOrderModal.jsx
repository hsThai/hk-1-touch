/**
 * ShareOrderModal.jsx
 * Modal chia sẻ đơn hàng qua QR / link
 * Tách từ OrderDrawer.jsx
 */
import React, { useState, useEffect } from "react";
import { getPbUrl, pbSettings } from "./pb.jsx";

const PUBLIC_URL = "https://hk-app-copy-4cefbb7c.base44.app/OrderPublic";

// ── PASTE NGUYÊN SI từ OrderDrawer.jsx ──────────────────────

let _shareQrLoaded = false, _shareQrCbs = [];
function loadShareQR(cb) {
  if (_shareQrLoaded && window.QRCode) { cb(); return; }
  _shareQrCbs.push(cb);
  if (_shareQrCbs.length > 1) return;
  const tryLoad = (url) => {
    const s = document.createElement("script");
    s.src = url;
    s.onload = () => { _shareQrLoaded = true; _shareQrCbs.forEach(f => f()); _shareQrCbs = []; };
    s.onerror = url.includes("cloudflare") ? () => tryLoad("https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs@master/qrcode.min.js") : () => { _shareQrCbs = []; };
    document.head.appendChild(s);
  };
  tryLoad("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js");
}

function ShareOrderModal({ order, onClose }) {
  const [qrReady, setQrReady] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [shopInfo, setShopInfo] = React.useState({ name:"", phone:"", address:"" });
  const qrRef = React.useRef(null);
  const code = order.order_code || order.id;
  const link = `${PUBLIC_URL}?code=${encodeURIComponent(code)}`;

  // Load shop info từ AppSettings
  React.useEffect(() => {
    Promise.all([
      pbSettings.get("shop_name"),
      pbSettings.get("shop_phone"),
      pbSettings.get("shop_address"),
    ]).then(([name, phone, address]) => {
      setShopInfo({ name: name||"", phone: phone||"", address: address||"" });
    }).catch(() => {});
  }, []);

  // Load QR
  React.useEffect(() => {
    loadShareQR(() => {
      setTimeout(() => {
        if (qrRef.current && window.QRCode) {
          qrRef.current.innerHTML = "";
          try {
            new window.QRCode(qrRef.current, {
              text: link, width: 200, height: 200,
              colorDark:"#1e1b4b", colorLight:"#ffffff",
              correctLevel: window.QRCode.CorrectLevel.M,
            });
            setQrReady(true);
          } catch(e) { setQrReady(false); }
        }
      }, 150);
    });
  }, [link]);

  function copyLink() {
    const fallback = () => {
      const t = document.createElement("textarea"); t.value = link;
      document.body.appendChild(t); t.select(); document.execCommand("copy");
      document.body.removeChild(t);
    };
    (navigator.clipboard?.writeText(link) || Promise.reject()).then(() => {}).catch(fallback);
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }

  function shareViaWeb() {
    if (navigator.share) {
      navigator.share({
        title: `Theo dõi đơn sửa chữa #${code}`,
        text: `${shopInfo.name ? shopInfo.name + " — " : ""}Xem tiến độ sửa máy của bạn`,
        url: link,
      }).catch(() => copyLink());
    } else { copyLink(); }
  }

  const MI2 = ({ name, style }) => (
    <span className="material-icons" style={{ fontFamily:"Material Icons", userSelect:"none", lineHeight:1, verticalAlign:"middle", ...style }}>{name}</span>
  );

  return (
    <div style={{ position:"fixed", inset:0, zIndex:6000, background:"rgba(0,0,0,.65)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:24, width:"100%", maxWidth:380, overflow:"hidden", boxShadow:"0 24px 64px rgba(0,0,0,.35)" }}>

        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#1e1b4b,#4338ca)", padding:"18px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ color:"#fff", fontWeight:800, fontSize:16, display:"flex", alignItems:"center", gap:6 }}>
              <MI2 name="share" style={{ fontSize:20, color:"#fff" }} /> Chia sẻ với khách
            </div>
            <div style={{ color:"rgba(255,255,255,.7)", fontSize:12, marginTop:2 }}>Đơn #{code}</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:34, height:34, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <MI2 name="close" style={{ fontSize:20, color:"#fff" }} />
          </button>
        </div>

        <div style={{ padding:"20px 20px 24px" }}>
          {/* QR Code */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:18 }}>
            <div style={{ padding:12, background:"#f8fafc", borderRadius:16, border:"2px solid #e5e7eb", display:"flex", alignItems:"center", justifyContent:"center", minWidth:224, minHeight:224 }}>
              <div ref={qrRef} />
              {!qrReady && (
                <div style={{ width:200, height:200, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, color:"#9ca3af" }}>
                  <MI2 name="qr_code_2" style={{ fontSize:48, color:"#c4b5fd" }} />
                  <div style={{ fontSize:12 }}>Đang tạo QR...</div>
                </div>
              )}
            </div>
            <div style={{ fontSize:12, color:"#6b7280", marginTop:8, textAlign:"center" }}>Khách quét QR để tự xem tiến độ</div>
          </div>

          {/* Thông tin cửa hàng */}
          {(shopInfo.name || shopInfo.phone) && (
            <div style={{ background:"#f0f9ff", borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"flex-start", gap:10 }}>
              <MI2 name="store" style={{ fontSize:18, color:"#0369a1", marginTop:1, flexShrink:0 }} />
              <div>
                {shopInfo.name && <div style={{ fontWeight:700, fontSize:13, color:"#0c4a6e" }}>{shopInfo.name}</div>}
                {shopInfo.phone && <div style={{ fontSize:12, color:"#0369a1", marginTop:2 }}>📞 {shopInfo.phone}</div>}
                {shopInfo.address && <div style={{ fontSize:11, color:"#6b7280", marginTop:1 }}>📍 {shopInfo.address}</div>}
              </div>
            </div>
          )}

          {/* Link */}
          <div style={{ background:"#f1f5f9", borderRadius:12, padding:"10px 12px", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
            <MI2 name="link" style={{ fontSize:16, color:"#818cf8", flexShrink:0 }} />
            <div style={{ flex:1, fontSize:11, color:"#475569", wordBreak:"break-all", lineHeight:"1.5" }}>{link}</div>
          </div>

          {/* Buttons */}
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={copyLink} style={{ flex:1, height:46, borderRadius:12, border:"1.5px solid #818cf8", background:"#fff", color:"#4f46e5", fontWeight:700, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <MI2 name={copied ? "check_circle" : "content_copy"} style={{ fontSize:18, color: copied?"#059669":"#4f46e5" }} />
              {copied ? "Đã copy!" : "Copy link"}
            </button>
            <button onClick={shareViaWeb} style={{ flex:1, height:46, borderRadius:12, border:"none", background:"#4f46e5", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <MI2 name="ios_share" style={{ fontSize:18, color:"#fff" }} />
              Chia sẻ
            </button>
          </div>

          <div style={{ fontSize:11, color:"#9ca3af", textAlign:"center", marginTop:12 }}>
            Khách không cần tài khoản để xem tiến độ
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShareOrderModal;