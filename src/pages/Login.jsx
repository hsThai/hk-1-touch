import { useState } from "react";
import { Staff } from "@/api/entities";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Simple hash (sha256-like via btoa for demo — production dùng bcrypt backend)
  function simpleHash(str) {
    // dùng btoa để encode, đủ cho demo
    return btoa(unescape(encodeURIComponent(str)));
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const list = await Staff.filter({ username, is_active: true });
      if (!list || list.length === 0) { setError("Tài khoản không tồn tại hoặc đã bị khóa."); setLoading(false); return; }
      const staff = list[0];
      if (staff.password_hash !== simpleHash(password)) { setError("Mật khẩu không đúng."); setLoading(false); return; }
      onLogin(staff);
    } catch (err) {
      setError("Lỗi kết nối. Thử lại nhé!");
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1e1b4b 0%,#3730a3 50%,#1d4ed8 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:24, padding:40, width:"100%", maxWidth:400, boxShadow:"0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:48, marginBottom:8 }}>🔧</div>
          <div style={{ fontSize:22, fontWeight:900, color:"#1e1b4b" }}>Repair Manager</div>
          <div style={{ fontSize:13, color:"#6b7280", marginTop:4 }}>Hệ thống quản lý sửa chữa</div>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:6 }}>Tên đăng nhập</label>
            <input value={username} onChange={e=>setUsername(e.target.value)}
              placeholder="Nhập username..."
              style={{ width:"100%", height:48, borderRadius:12, border:"2px solid #e5e7eb", padding:"0 14px", fontSize:15, outline:"none", boxSizing:"border-box" }}
              onFocus={e=>e.target.style.borderColor="#4f46e5"}
              onBlur={e=>e.target.style.borderColor="#e5e7eb"} />
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:6 }}>Mật khẩu</label>
            <input value={password} onChange={e=>setPassword(e.target.value)}
              type="password" placeholder="Nhập mật khẩu..."
              style={{ width:"100%", height:48, borderRadius:12, border:"2px solid #e5e7eb", padding:"0 14px", fontSize:15, outline:"none", boxSizing:"border-box" }}
              onFocus={e=>e.target.style.borderColor="#4f46e5"}
              onBlur={e=>e.target.style.borderColor="#e5e7eb"} />
          </div>
          {error && <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#dc2626", marginBottom:16, fontWeight:600 }}>⚠️ {error}</div>}
          <button type="submit" disabled={loading}
            style={{ width:"100%", height:52, background: loading?"#9ca3af":"linear-gradient(135deg,#4f46e5,#7c3aed)", color:"#fff", border:"none", borderRadius:14, fontSize:16, fontWeight:800, cursor: loading?"not-allowed":"pointer" }}>
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
        <div style={{ textAlign:"center", marginTop:20, fontSize:12, color:"#9ca3af" }}>
          Quên mật khẩu? Liên hệ Quản lý để reset.
        </div>
      </div>
    </div>
  );
}
