/* LoginV2 - PocketBase Auth + RememberMe + AutoLogin */
import React, { useState, useEffect } from "react";
import { Staff, pbAuth, getPbUrl, setPbUrl, testConnection, logAction } from "./pb.jsx";

// Inject Material Icons font
(function injectMaterialIcons() {
  if (document.getElementById('material-icons-font')) return;
  const link = document.createElement('link');
  link.id = 'material-icons-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
  document.head.appendChild(link);
  // Global style
  const style = document.createElement('style');
  style.textContent = '.material-icons { font-family: "Material Icons"; font-weight: normal; font-style: normal; display: inline-block; line-height: 1; text-transform: none; letter-spacing: normal; word-wrap: normal; white-space: nowrap; direction: ltr; -webkit-font-smoothing: antialiased; }';
  document.head.appendChild(style);
})();


// Inject PWA manifest + meta tags động
(function injectPWA() {
  const ICON192 = "/logo.png";
  const ICON512 = "/icon-v2-512.png";

  // Manifest blob
  const manifest = {
    name: "HK One Touch",
    short_name: "HK One Touch",
    description: "HK One Touch",
    start_url: "/MainApp",
    display: "standalone",
    background_color: "#1e1b4b",
    theme_color: "#1e1b4b",
    orientation: "portrait",
    prefer_related_applications: false,
    categories: ["productivity", "utilities"],
    icons: [
      { src: ICON192, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: ICON192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: ICON512, sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: ICON512, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
  const blobUrl = URL.createObjectURL(blob);

  // Xóa manifest cũ nếu có
  document.querySelectorAll('link[rel="manifest"]').forEach(el => el.remove());

  const link = document.createElement("link");
  link.rel = "manifest"; link.href = blobUrl;
  document.head.appendChild(link);

  // Apple/mobile meta
  const metas = [
    { name: "apple-mobile-web-app-capable",          content: "yes" },
    { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
    { name: "apple-mobile-web-app-title",            content: "HK One Touch" },
    { name: "theme-color",                           content: "#1e1b4b" },
    { name: "mobile-web-app-capable",                content: "yes" },
  ];
  metas.forEach(({ name, content }) => {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) { el = document.createElement("meta"); el.name = name; document.head.appendChild(el); }
    el.content = content;
  });

  // Apple touch icon
  let touchIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (!touchIcon) { touchIcon = document.createElement("link"); touchIcon.rel = "apple-touch-icon"; document.head.appendChild(touchIcon); }
  touchIcon.href = "/icon-v2-192.png";

  // Favicon
  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) { favicon = document.createElement("link"); favicon.rel = "icon"; document.head.appendChild(favicon); }
  favicon.href = "/icon-v2-192.png";
  favicon.type = "image/png";

  // Page title
  document.title = "HK One Touch";

  // Đăng ký inline Service Worker để cho phép showNotification trên Android PWA
  if ("serviceWorker" in navigator) {
    const swCode = `
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type:"window" }).then(cs => {
    if (cs.length) { cs[0].focus(); } else { self.clients.openWindow("/"); }
  }));
});
self.addEventListener("push", e => {
  const d = e.data ? e.data.json() : { title:"HK One Touch", body:"Thông báo mới" };
  e.waitUntil(self.registration.showNotification(d.title || "HK One Touch", {
    body: d.body || "",
    icon: d.icon || "/logo.png",
    tag: d.tag || "hkapp",
    renotify: true,
    vibrate: [200, 100, 200]
  }));
});
`;
    try {
      const swBlob = new Blob([swCode], { type: "application/javascript" });
      const swUrl  = URL.createObjectURL(swBlob);
      navigator.serviceWorker.register(swUrl, { scope: "/" })
        .catch(e => {
          // Blob SW không cho phép trên một số trình duyệt → thử path cố định
          console.warn("[SW] blob fail, skip:", e.message);
        });
    } catch(e) { console.warn("[SW] err:", e); }
  }
})();

// Lưu/đọc credential dùng cả 3 nơi để tránh mất do cache bust
const SK = "hkapp_cred";
function saveCred(u, p) {
  const v = JSON.stringify({ u, p, t: Date.now() });
  try { localStorage.setItem(SK, v); } catch {}
  try { sessionStorage.setItem(SK, v); } catch {}
  try { document.cookie = `${SK}=${encodeURIComponent(v)};max-age=31536000;path=/;SameSite=Lax`; } catch {}
}
function loadCred() {
  for (const src of [
    () => localStorage.getItem(SK),
    () => sessionStorage.getItem(SK),
    () => { const m = document.cookie.match(new RegExp(`${SK}=([^;]+)`)); return m ? decodeURIComponent(m[1]) : null; }
  ]) {
    try {
      const raw = src();
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj?.u && obj?.p) {
          try { localStorage.setItem(SK, raw); } catch {}
          try { sessionStorage.setItem(SK, raw); } catch {}
          return obj;
        }
      }
    } catch {}
  }
  return null;
}
function clearCred() {
  try { localStorage.removeItem(SK); } catch {}
  try { sessionStorage.removeItem(SK); } catch {}
  try { document.cookie = `${SK}=;max-age=0;path=/`; } catch {}
}

const LOGO = "/logo.png";

function useBreakpoint() {
  const [bp, setBp] = React.useState(() => {
    const w = window.innerWidth;
    if (w >= 1200) return "pc";
    if (w >= 768)  return "tablet";
    return "mobile";
  });
  React.useEffect(() => {
    const fn = () => {
      const w = window.innerWidth;
      setBp(w >= 1200 ? "pc" : w >= 768 ? "tablet" : "mobile");
    };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return bp;
}

const SPLASH = "/logo.png";
// Preload ảnh ngay khi JS parse (không chờ render)
(function() { const img = new window.Image(); img.src = SPLASH; })();
const APP_ICON = "/logo.png";

// ── Web Notification API (thông báo hệ thống HĐH) ───────────
export async function requestNotifPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function showSystemNotif(title, body, opts={}) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const payload = {
    body: body || "",
    icon: APP_ICON,
    badge: APP_ICON,
    tag: opts.tag || "hkapp-notif",
    renotify: true,
    vibrate: [200, 100, 200],
    ...opts,
  };
  // Ưu tiên dùng ServiceWorker (hoạt động trên Android PWA)
  try {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, payload);
      }).catch(() => {
        // Fallback: Notification API thường
        try { new Notification(title, payload); } catch {}
      });
      return;
    }
  } catch {}
  // Fallback
  try { new Notification(title, payload); } catch(e) { console.warn("Notif:", e); }
}

export default function LoginV2({ onLogin, loggedOut }) {
  const bp = useBreakpoint();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [pbUrl, setPbUrlState] = useState(getPbUrl());
  const [showConfig, setShowConfig] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [connStatus, setConnStatus] = useState(null);
  const [autoLogging, setAutoLogging] = useState(false);

  // Auto-login khi vào app (trừ khi vừa logout)
  useEffect(() => {
    if (loggedOut) return;
    const saved = loadCred();
    if (!saved?.u || !saved?.p) return;
    setUsername(saved.u);
    setRememberMe(true);
    setAutoLogging(true);
    doLogin(saved.u, saved.p, true);
  }, []);

  const doLogin = async (u, p, isAuto = false) => {
    const uname = (u || username).trim().toLowerCase();
    const pwd   = (p || password).trim();
    if (!uname || !pwd) { setErr("Vui lòng nhập đầy đủ thông tin!"); return; }
    setLoading(true); setErr("");
    try {
      let userInfo = null;
      try {
        const authData = await pbAuth.loginStaff(uname, pwd);
        const rec = authData.record;
        if (rec && rec.is_active !== false) {
          userInfo = {
            id: rec.id, name: rec.full_name, username: rec.username,
            role: rec.role, kpi: rec.kpi_score || 0,
            phone: rec.phone || "", must_change_password: rec.must_change_password,
            avatar_url: rec.avatar_url || "",
            warehouse_ids: rec.warehouse_ids || [],
          };
        }
      } catch {
        try {
          const staffList = await Staff.list();
          const hashedInput = btoa(unescape(encodeURIComponent(pwd)));
          const found = staffList.find(s =>
            s.username?.toLowerCase() === uname && s.password_hash === hashedInput && s.is_active !== false
          );
          if (found) {
            userInfo = {
              id: found.id, name: found.full_name, username: found.username,
              role: found.role, kpi: found.kpi_score || 0,
              phone: found.phone || "", must_change_password: found.must_change_password,
              avatar_url: found.avatar_url || "",
              warehouse_ids: found.warehouse_ids || [],
            };
            // Thử lấy token qua pbAuth để SSE realtime hoạt động
            try { await pbAuth.loginStaff(uname, pwd); } catch {}
          } else {
            const matchUser = staffList.find(s => s.username?.toLowerCase() === uname);
            if (!matchUser)                      setErr("Không tìm thấy username!");
            else if (matchUser.is_active===false) setErr("Tài khoản đã bị vô hiệu hóa!");
            else                                  setErr("Sai mật khẩu!");
          }
        } catch {
          setErr(`  Không kết nối được PocketBase!\nKiểm tra server: ${getPbUrl()}`);
          setShowConfig(true);
        }
      }

      if (userInfo) {
        if (rememberMe) saveCred(uname, pwd);
        else clearCred();
        // Chỉ ghi log khi user thực sự nhập tay (không log khi auto-restore session từ cookie)
        if (!isAuto) {
          logAction(userInfo, "login", "auth", userInfo.id, `Đăng nhập: ${userInfo.full_name||uname}`);
        }
        onLogin(userInfo);
        return;
      }
    } catch(e) {
      if (e.message?.includes("fetch") || e.message?.includes("network") || e.message?.includes("Failed")) {
        setErr(`  Không kết nối được PocketBase!\nKiểm tra server: ${getPbUrl()}`);
        setShowConfig(true);
      } else {
        setErr(e.message ||"Lỗi kết nối, thử lại!");
      }
    } finally {
      setLoading(false);
      setAutoLogging(false);
    }
  };

  const doTestConn = async () => {
    setTestingConn(true); setConnStatus(null);
    const ok = await testConnection(pbUrl);
    setConnStatus(ok ? "ok" : "fail");
    setTestingConn(false);
  };

  const savePbUrl = () => { setPbUrl(pbUrl); setShowConfig(false); setConnStatus(null); };

  // Khi đang tự đăng nhập → hiện loading nhỏ
  if (autoLogging) return (
    <div style={{ minHeight:"100vh", background:"#fff", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
      <img src={SPLASH} alt="HK" style={{ width:120, objectFit:"contain" }} />
      <div style={{ fontWeight:800, fontSize:20, color:"#1e1b4b" }}>HK One Touch</div>
      <div style={{ display:"flex", gap:8 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:8, height:8, borderRadius:"50%", background:"#4f46e5",
            animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}`}</style>
    </div>
  );


  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#0f172a 0%,#1e1b4b 50%,#312e81 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <form onSubmit={e=>{e.preventDefault();doLogin();}}
        style={{ background:"#fff", borderRadius:28,
          padding: bp==="tablet" ? "40px 48px" : bp==="pc" ? "36px 32px" : "28px 20px",
          width:"100%",
          maxWidth: bp==="tablet" ? 480 : 420,
          boxShadow:"0 32px 80px rgba(0,0,0,.4)" }}>

        {/* Logo + tên app */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:10 }}>
            <img src={SPLASH} alt="HK Robot" style={{ width: bp==="tablet"?120:bp==="pc"?110:90, height: bp==="tablet"?120:bp==="pc"?110:90, objectFit:"contain", display:"block" }} />
          </div>
          <div style={{ fontWeight:900, fontSize: bp==="mobile"?22:26, color:"#1e1b4b", letterSpacing:"-0.5px" }}>HK One Touch</div>
          <div style={{ color:"#6b7280", fontSize:13, marginTop:4, fontStyle:"italic" }}>Quản lý với một chạm !</div>
        </div>

        {/* Config PocketBase — chỉ hiện khi lỗi */}
        {showConfig && (
          <div style={{ background:"#fef3c7", borderRadius:14, padding:14, border:"1.5px solid #fbbf24", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <span style={{ fontWeight:800, fontSize:13, color:"#92400e"}}>  Cấu hình PocketBase</span>
              <button onClick={() => { setShowConfig(false); setConnStatus(null); }}
                style={{ fontSize:13, color:"#92400e", background:"none", border:"none", cursor:"pointer", fontWeight:700 }}> </button>
            </div>
            <input value={pbUrl} onChange={e => { setPbUrlState(e.target.value); setConnStatus(null); }}
              placeholder="http://192.168.1.234:8090"
              style={{ width:"100%", height:42, borderRadius:10, border:"1.5px solid #7dd3fc", padding:"0 12px", fontSize:13, outline:"none", boxSizing:"border-box", fontFamily:"monospace" }} />
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <button onClick={doTestConn} disabled={testingConn}
                style={{ flex:1, height:36, background:"#0ea5e9", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:13, cursor:"pointer" }}>
                {testingConn ? "⏳..." : "Test"}
              </button>
              <button onClick={savePbUrl}
                style={{ flex:1, height:36, background:"#059669", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:13, cursor:"pointer"}}>
                  Lưu
              </button>
            </div>
            {connStatus ==="ok"   && <div style={{ marginTop:8, color:"#059669", fontWeight:700, fontSize:13, textAlign:"center"}}>  Kết nối thành công!</div>}
            {connStatus ==="fail" && <div style={{ marginTop:8, color:"#dc2626", fontWeight:700, fontSize:13, textAlign:"center"}}>  Không kết nối được!</div>}
          </div>
        )}

        {/* Username */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>  Tên đăng nhập</label>
          <input value={username} onChange={e => { setUsername(e.target.value); setErr(""); }}
            placeholder="Nhập username..." autoFocus
            style={{ width:"100%", height:50, borderRadius:12, border:`2px solid ${err?"#ef4444":"#e5e7eb"}`, padding:"0 16px", fontSize:15, outline:"none", boxSizing:"border-box" }} />
        </div>

        {/* Password */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>  Mật khẩu</label>
          <div style={{ position:"relative" }}>
            <input value={password} onChange={e => { setPassword(e.target.value); setErr(""); }}
              placeholder="Nhập mật khẩu..." type={showPw?"text":"password"}
              style={{ width:"100%", height:50, borderRadius:12, border:`2px solid ${err?"#ef4444":"#e5e7eb"}`, padding:"0 50px 0 16px", fontSize:15, outline:"none", boxSizing:"border-box" }} />
            <button onClick={() => setShowPw(v=>!v)} type="button"
              style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#9ca3af" }}>
              {showPw ? <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,verticalAlign:"middle",lineHeight:1}}>visibility_off</span> : <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,verticalAlign:"middle",lineHeight:1}}>visibility</span>}
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
          <div onClick={() => setRememberMe(v=>!v)}
            style={{ width:44, height:24, borderRadius:99, background:rememberMe?"#4f46e5":"#d1d5db", cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}>
            <div style={{ position:"absolute", top:2, left:rememberMe?22:2, width:20, height:20, borderRadius:"50%", background:"#fff", boxShadow:"0 1px 4px rgba(0,0,0,.3)", transition:"left .2s" }} />
          </div>
          <span onClick={() => setRememberMe(v=>!v)} style={{ fontSize:13, fontWeight:600, color:"#374151", cursor:"pointer", userSelect:"none" }}>
            Ghi nhớ — tự động đăng nhập lần sau
          </span>
        </div>

        {/* Error */}
        {err && (
          <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:13, color:"#dc2626", fontWeight:600, whiteSpace:"pre-line"}}>
              {err}
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={loading}
          style={{ width:"100%", height:54, background:loading?"#a5b4fc":"linear-gradient(135deg,#4f46e5,#7c3aed)", color:"#fff", border:"none", borderRadius:14, fontSize:18, fontWeight:800, cursor:loading?"not-allowed":"pointer", boxShadow:"0 4px 16px rgba(79,70,229,.4)" }}>
          {loading ? "⏳ Đang đăng nhập..." : <><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,verticalAlign:"middle",lineHeight:1}}>login</span> Đăng Nhập</>}
        </button>
      </form>
    </div>
  );
}
