/* LoginV2 - standalone login component connecting to Staff entity */
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
const Staff = base44.entities.Staff;

export default function LoginV2({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = async () => {
    if (!username.trim() || !password.trim()) { setErr("Vui lòng nhập đầy đủ thông tin!"); return; }
    setLoading(true); setErr("");
    try {
      const staffList = await Staff.list();
      const hashedInput = btoa(unescape(encodeURIComponent(password.trim())));
      const found = staffList.find(s =>
        s.username === username.trim() &&
        s.password_hash === hashedInput &&
        s.is_active !== false
      );
      if (found) {
        onLogin({
          id: found.id, name: found.full_name, username: found.username,
          role: found.role, kpi: found.kpi_score || 0,
          phone: found.phone || "", must_change_password: found.must_change_password,
          avatar_url: found.avatar_url || "",
        });
      } else {
        const matchUser = staffList.find(s => s.username === username.trim());
        if (!matchUser) setErr("Không tìm thấy username!");
        else if (matchUser.is_active === false) setErr("Tài khoản đã bị vô hiệu hóa!");
        else setErr("Sai mật khẩu!");
        setLoading(false);
      }
    } catch(e) {
      const msg = e?.message || JSON.stringify(e);
      if (msg.includes("private") || msg.includes("access")) {
        // App chưa login Base44 — redirect to login
        base44.auth.redirectToLogin(window.location.href);
      } else {
        setErr("Lỗi kết nối: " + msg);
      }
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1e1b4b,#4f46e5,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:24, padding:40, width:"100%", maxWidth:400, boxShadow:"0 24px 64px rgba(0,0,0,.3)" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:56 }}>🔧</div>
          <div style={{ fontWeight:900, fontSize:24, color:"#1e1b4b", marginTop:8 }}>Quản Lý Sửa Chữa</div>
          <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Hệ thống nội bộ — v2025</div>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>👤 Tên đăng nhập</label>
          <input value={username} onChange={e => { setUsername(e.target.value); setErr(""); }}
            onKeyDown={e => e.key==="Enter" && doLogin()}
            placeholder="Nhập username..." autoFocus
            style={{ width:"100%", height:50, borderRadius:12, border:`2px solid ${err?"#ef4444":"#e5e7eb"}`, padding:"0 16px", fontSize:15, outline:"none", boxSizing:"border-box" }} />
        </div>
        <div style={{ marginBottom:20 }}>
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
        {err && (
          <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#dc2626", fontWeight:600 }}>
            ⚠️ {err}
          </div>
        )}
        <button onClick={doLogin} disabled={loading}
          style={{ width:"100%", height:54, background:loading?"#a5b4fc":"#4f46e5", color:"#fff", border:"none", borderRadius:14, fontSize:18, fontWeight:800, cursor:loading?"not-allowed":"pointer" }}>
          {loading?"⏳ Đang kiểm tra...":"🚀 Đăng Nhập"}
        </button>
      </div>
    </div>
  );
}