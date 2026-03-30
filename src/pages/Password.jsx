/* v1774860462-2019 */
import { useState } from "react";
import { Staff } from "@/api/entities";

export default function ChangePassword({ staff, onDone }) {
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function simpleHash(str) { return btoa(unescape(encodeURIComponent(str))); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (newPass.length < 6) { setError("Mật khẩu phải ít nhất 6 ký tự."); return; }
    if (newPass !== confirm) { setError("Mật khẩu xác nhận không khớp."); return; }
    setLoading(true);
    try {
      await Staff.update(staff.id, { password_hash: simpleHash(newPass), must_change_password: false });
      onDone({ ...staff, password_hash: simpleHash(newPass), must_change_password: false });
    } catch { setError("Lỗi lưu mật khẩu. Thử lại!"); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1e1b4b,#3730a3)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:24, padding:40, width:"100%", maxWidth:420, boxShadow:"0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:44, marginBottom:8 }}>🔑</div>
          <div style={{ fontSize:20, fontWeight:900, color:"#1e1b4b" }}>Đổi mật khẩu lần đầu</div>
          <div style={{ fontSize:13, color:"#6b7280", marginTop:6 }}>
            Xin chào <b style={{color:"#4f46e5"}}>{staff.full_name}</b>! Vui lòng đặt mật khẩu mới trước khi sử dụng.
          </div>
        </div>
        <div style={{ background:"#fef9c3", border:"1px solid #fde68a", borderRadius:12, padding:"10px 14px", marginBottom:20, fontSize:13, color:"#92400e" }}>
          ⚠️ Mật khẩu mặc định do quản lý cấp cần được đổi ngay để bảo mật tài khoản.
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:6 }}>Mật khẩu mới</label>
            <input value={newPass} onChange={e=>setNewPass(e.target.value)}
              type="password" placeholder="Tối thiểu 6 ký tự..."
              style={{ width:"100%", height:48, borderRadius:12, border:"2px solid #e5e7eb", padding:"0 14px", fontSize:15, outline:"none", boxSizing:"border-box" }}
              onFocus={e=>e.target.style.borderColor="#4f46e5"}
              onBlur={e=>e.target.style.borderColor="#e5e7eb"} />
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:6 }}>Xác nhận mật khẩu</label>
            <input value={confirm} onChange={e=>setConfirm(e.target.value)}
              type="password" placeholder="Nhập lại mật khẩu..."
              style={{ width:"100%", height:48, borderRadius:12, border:"2px solid #e5e7eb", padding:"0 14px", fontSize:15, outline:"none", boxSizing:"border-box" }}
              onFocus={e=>e.target.style.borderColor="#4f46e5"}
              onBlur={e=>e.target.style.borderColor="#e5e7eb"} />
          </div>
          {error && <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#dc2626", marginBottom:16, fontWeight:600 }}>⚠️ {error}</div>}
          <button type="submit" disabled={loading}
            style={{ width:"100%", height:52, background:"linear-gradient(135deg,#4f46e5,#7c3aed)", color:"#fff", border:"none", borderRadius:14, fontSize:16, fontWeight:800, cursor:"pointer" }}>
            {loading ? "Đang lưu..." : "Xác nhận đổi mật khẩu"}
          </button>
        </form>
      </div>
    </div>
  );
}
