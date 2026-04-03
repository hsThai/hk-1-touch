/* LoginV2 - PocketBase Auth + RememberMe + AutoLogin */
import React, { useState, useEffect } from "react";
import { Staff, pbAuth, getPbUrl, setPbUrl, testConnection } from "./pb.jsx";

// Lưu/đọc credential dùng cả 3 nơi để tránh mất do cache bust
const SK = "hkapp_cred";
function saveCred(u, p) {
  const v = JSON.stringify({ u, p, t: Date.now() });
  try { localStorage.setItem(SK, v); } catch {}
  try { sessionStorage.setItem(SK, v); } catch {}
  try { document.cookie = `${SK}=${encodeURIComponent(v)};max-age=31536000;path=/;SameSite=Lax`; } catch {}
}
function loadCred() {
  // Thử localStorage trước, sau đó sessionStorage, cuối cookie
  for (const src of [
    () => localStorage.getItem(SK),
    () => sessionStorage.getItem(SK),
    () => {
      const m = document.cookie.match(new RegExp(`${SK}=([^;]+)`));
      return m ? decodeURIComponent(m[1]) : null;
    }
  ]) {
    try {
      const raw = src();
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj?.u && obj?.p) {
          // Sync lại vào các nơi còn thiếu
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

export default function LoginV2({ onLogin, loggedOut }) {
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
    if (loggedOut) return; // vừa logout → không tự đăng nhập
    const saved = loadCred();
    if (!saved?.u || !saved?.p) return;
    setUsername(saved.u);
    setRememberMe(true);
    setAutoLogging(true);
    doLogin(saved.u, saved.p, true);
  }, []);

  const doLogin = async (u, p, isAuto = false) => {
    const uname = (u || username).trim();
    const pwd   = (p || password).trim();
    if (!uname || !pwd) { setErr("Vui lòng nhập đầy đủ thông tin!"); return; }
    setLoading(true); setErr("");
    try {
      let userInfo = null;

      // Thử PocketBase auth collection
      try {
        const authData = await pbAuth.loginStaff(uname, pwd);
        const rec = authData.record;
        if (rec && rec.is_active !== false) {
          userInfo = {
            id: rec.id, name: rec.full_name, username: rec.username,
            role: rec.role, kpi: rec.kpi_score || 0,
            phone: rec.phone || "", must_change_password: rec.must_change_password,
            avatar_url: rec.avatar_url || "",
          };
        }
      } catch {
        // Fallback: tìm thủ công trong staff collection
        try {
          const staffList = await Staff.list();
          const hashedInput = btoa(unescape(encodeURIComponent(pwd)));
          const found = staffList.find(s =>
            s.username === uname &&
            s.password_hash === hashedInput &&
            s.is_active !== false
          );
          if (found) {
            userInfo = {
              id: found.id, name: found.full_name, username: found.username,
              role: found.role, kpi: found.kpi_score || 0,
              phone: found.phone || "", must_change_password: found.must_change_password,
              avatar_url: found.avatar_url || "",
            };
          } else {
            const matchUser = staffList.find(s => s.username === uname);
            if (!matchUser)                     setErr("Không tìm thấy username!");
            else if (matchUser.is_active===false) setErr("Tài khoản đã bị vô hiệu hóa!");
            else                                  setErr("Sai mật khẩu!");
          }
        } catch (e2) {
          // Lỗi kết nối PocketBase
          setErr(`❌ Không kết nối được PocketBase!\nKiểm tra server: ${getPbUrl()}`);
          setShowConfig(true); // tự mở cấu hình
        }
      }

      if (userInfo) {
        // Lưu thông tin nếu "ghi nhớ"
        if (rememberMe) {
          saveCred(uname, pwd);
        } else {
          clearCred();
        }
        onLogin(userInfo);
        return;
      }
    } catch(e) {
      if (e.message?.includes("fetch") || e.message?.includes("network") || e.message?.includes("Failed")) {
        setErr(`❌ Không kết nối được PocketBase!\nKiểm tra server: ${getPbUrl()}`);
        setShowConfig(true); // tự mở cấu hình khi lỗi mạng
      } else {
        setErr(e.message || "Lỗi kết nối, thử lại!");
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

  const savePbUrl = () => {
    setPbUrl(pbUrl);
    setShowConfig(false);
    setConnStatus(null);
  };

  // Màn hình loading auto-login
  if (autoLogging) return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1e1b4b,#4f46e5,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", color:"#fff" }}>
        <div style={{ fontSize:56, marginBottom:16 }}>🔧</div>
        <div style={{ fontWeight:800, fontSize:20, marginBottom:8 }}>Đang đăng nhập...</div>
        <div style={{ color:"rgba(255,255,255,.7)", fontSize:14 }}>Vui lòng chờ</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1e1b4b,#4f46e5,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:24, padding:40, width:"100%", maxWidth:400, boxShadow:"0 24px 64px rgba(0,0,0,.3)" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:56 }}>🔧</div>
          <div style={{ fontWeight:900, fontSize:24, color:"#1e1b4b", marginTop:8 }}>Quản Lý Sửa Chữa</div>
          <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Hệ thống nội bộ — v2025</div>
        </div>

        {/* Server config — ẩn bình thường, hiện khi có lỗi kết nối */}
        {showConfig && (
          <div style={{ background:"#fef3c7", borderRadius:14, padding:14, border:"1.5px solid #fbbf24", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <span style={{ fontWeight:800, fontSize:13, color:"#92400e" }}>⚙️ Cấu hình PocketBase</span>
              <button onClick={() => { setShowConfig(false); setConnStatus(null); }}
                style={{ fontSize:11, color:"#92400e", background:"none", border:"none", cursor:"pointer", fontWeight:700 }}>
                ✕ Đóng
              </button>
            </div>
            <label style={{ fontSize:12, fontWeight:700, color:"#0369a1", display:"block", marginBottom:6 }}>Địa chỉ server (IP:Port)</label>
            <input value={pbUrl} onChange={e => { setPbUrlState(e.target.value); setConnStatus(null); }}
              placeholder="http://192.168.1.234:8090"
              style={{ width:"100%", height:42, borderRadius:10, border:"1.5px solid #7dd3fc", padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box", fontFamily:"monospace" }} />
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <button onClick={doTestConn} disabled={testingConn}
                style={{ flex:1, height:36, background:"#0ea5e9", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:13, cursor:"pointer" }}>
                {testingConn ? "⏳ Đang test..." : "🔌 Test kết nối"}
              </button>
              <button onClick={savePbUrl}
                style={{ flex:1, height:36, background:"#059669", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:13, cursor:"pointer" }}>
                💾 Lưu
              </button>
            </div>
            {connStatus === "ok" && (
              <div style={{ marginTop:8, color:"#059669", fontWeight:700, fontSize:13, textAlign:"center" }}>✅ Kết nối thành công!</div>
            )}
            {connStatus === "fail" && (
              <div style={{ marginTop:8, color:"#dc2626", fontWeight:700, fontSize:13, textAlign:"center" }}>❌ Không kết nối được! Kiểm tra IP và server.</div>
            )}
          </div>
        )}

        {/* Username */}
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>👤 Tên đăng nhập</label>
          <input value={username} onChange={e => { setUsername(e.target.value); setErr(""); }}
            onKeyDown={e => e.key==="Enter" && doLogin()}
            placeholder="Nhập username..." autoFocus
            style={{ width:"100%", height:50, borderRadius:12, border:`2px solid ${err?"#ef4444":"#e5e7eb"}`, padding:"0 16px", fontSize:15, outline:"none", boxSizing:"border-box" }} />
        </div>

        {/* Password */}
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>🔑 Mật khẩu</label>
          <div style={{ position:"relative" }}>
            <input value={password} onChange={e => { setPassword(e.target.value); setErr(""); }}
              onKeyDown={e => e.key==="Enter" && doLogin()}
              placeholder="Nhập mật khẩu..." type={showPw?"text":"password"}
              style={{ width:"100%", height:50, borderRadius:12, border:`2px solid ${err?"#ef4444":"#e5e7eb"}`, padding:"0 50px 0 16px", fontSize:15, outline:"none", boxSizing:"border-box" }} />
            <button onClick={() => setShowPw(v=>!v)} type="button"
              style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:20, color:"#9ca3af" }}>
              {showPw?"🙈":"👁️"}
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
          <div onClick={() => setRememberMe(v=>!v)}
            style={{ width:44, height:24, borderRadius:99, background:rememberMe?"#4f46e5":"#d1d5db", cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}>
            <div style={{ position:"absolute", top:2, left: rememberMe ? 22 : 2, width:20, height:20, borderRadius:"50%", background:"#fff", boxShadow:"0 1px 4px rgba(0,0,0,.3)", transition:"left .2s" }} />
          </div>
          <span onClick={() => setRememberMe(v=>!v)} style={{ fontSize:13, fontWeight:600, color:"#374151", cursor:"pointer", userSelect:"none" }}>
            Ghi nhớ đăng nhập — tự động đăng nhập lần sau
          </span>
        </div>

        {/* Error */}
        {err && (
          <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#dc2626", fontWeight:600, whiteSpace:"pre-line" }}>
            ⚠️ {err}
          </div>
        )}

        {/* Submit */}
        <button onClick={() => doLogin()} disabled={loading}
          style={{ width:"100%", height:54, background:loading?"#a5b4fc":"#4f46e5", color:"#fff", border:"none", borderRadius:14, fontSize:18, fontWeight:800, cursor:loading?"not-allowed":"pointer" }}>
          {loading ? "⏳ Đang đăng nhập..." : "🚀 Đăng Nhập"}
        </button>
      </div>
    </div>
  );
}
