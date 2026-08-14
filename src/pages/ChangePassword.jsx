/* ChangePassword - Đổi mật khẩu cho user hiện tại */
import React, { useState } from "react";
import { Staff, pbAuth, getPbUrl, getAuth, logAction } from "./pb.jsx";

export default function ChangePassword({ user, onClose, onSuccess, forceChange = false }) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);

  const doChange = async () => {
    setErr("");
    if (!forceChange && !oldPw.trim()) { setErr("Vui lòng nhập mật khẩu hiện tại!"); return; }
    if (!newPw.trim()) { setErr("Vui lòng nhập mật khẩu mới!"); return; }
    if (newPw.length < 6) { setErr("Mật khẩu mới phải ít nhất 6 ký tự!"); return; }
    if (newPw !== confirmPw) { setErr("Xác nhận mật khẩu không khớp!"); return; }

    setLoading(true);
    try {
      // Xác minh mật khẩu cũ (nếu không phải force change)
      if (!forceChange) {
        try {
          await pbAuth.loginStaff(user.username, oldPw.trim());
        } catch {
          // Fallback: check password_hash
          const staffList = await Staff.filter({ username: user.username });
          const staff = staffList[0];
          if (staff) {
            const hashedOld = btoa(unescape(encodeURIComponent(oldPw.trim())));
            if (staff.password_hash !== hashedOld) {
              setErr("Mật khẩu hiện tại không đúng!");
              setLoading(false);
              return;
            }
          }
        }
      }

      // Đổi mật khẩu mới qua PocketBase API
      try {
        const baseUrl = getPbUrl();
        const { token } = getAuth();
        await fetch(`${baseUrl}/api/collections/staff/records/${user.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: token } : {}),
          },
          body: JSON.stringify({
            password: newPw,
            passwordConfirm: newPw,
            must_change_password: false,
          }),
        });
      } catch {
        // Fallback: lưu hash vào password_hash field
        const hashedNew = btoa(unescape(encodeURIComponent(newPw.trim())));
        await Staff.update(user.id, {
          password_hash: hashedNew,
          must_change_password: false,
        });
        logAction(user, "update", "staff", user.id, `Đổi mật khẩu (fallback): ${user.full_name||user.name||""}`);
      }

      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      }, 1500);
    } catch (e) {
      setErr(e.message || "Có lỗi xảy ra, thử lại!");
    }
    setLoading(false);
  };

  if (success) return (
    <div style={{
      position: forceChange ? "fixed" : "relative",
      inset: forceChange ? 0 : undefined,
      background: forceChange ? "rgba(0,0,0,0.6)" : "transparent",
      zIndex: 9999, display:"flex", alignItems:"center", justifyContent:"center"
    }}>
      <div style={{ background:"#fff", borderRadius:20, padding:40, textAlign:"center", maxWidth:360, width:"100%"}}>
        <div style={{ fontSize:56 }}> </div>
        <div style={{ fontWeight:800, fontSize:18, color:"#059669", marginTop:12 }}>Đổi mật khẩu thành công!</div>
        <div style={{ color:"#6b7280", fontSize:13, marginTop:8 }}>Đang chuyển hướng...</div>
      </div>
    </div>
  );

  const content = (
    <div style={{ background:"#fff", borderRadius:20, padding:28, width:"100%", maxWidth:400, boxShadow: forceChange ? "0 24px 64px rgba(0,0,0,.3)" : "none" }}>
      <div style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ fontSize:40 }}> </div>
        <div style={{ fontWeight:900, fontSize:20, color:"#1e1b4b", marginTop:8 }}>
          {forceChange ? "Đặt mật khẩu mới" : "Đổi mật khẩu"}
        </div>
        {forceChange && (
          <div style={{ background:"#fef3c7", border:"1px solid #fcd34d", borderRadius:10, padding:"10px 14px", marginTop:12, fontSize:13, color:"#92400e"}}>
              Tài khoản yêu cầu đặt mật khẩu mới trước khi sử dụng
          </div>
        )}
        {!forceChange && (
          <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Xin chào, {user?.name}</div>
        )}
      </div>

      {!forceChange && (
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>  Mật khẩu hiện tại</label>
          <div style={{ position:"relative" }}>
            <input value={oldPw} onChange={e => { setOldPw(e.target.value); setErr(""); }}
              type={showOld ? "text" : "password"}
              placeholder="Nhập mật khẩu hiện tại..."
              style={{ width:"100%", height:48, borderRadius:12, border:`2px solid ${err?"#ef4444":"#e5e7eb"}`, padding:"0 50px 0 16px", fontSize:15, outline:"none", boxSizing:"border-box" }} />
            <button onClick={() => setShowOld(v=>!v)} type="button"
              style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:18, color:"#9ca3af" }}>
              {showOld ? <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,verticalAlign:"middle",lineHeight:1}}>visibility_off</span> : <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,verticalAlign:"middle",lineHeight:1}}>visibility</span>}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom:16 }}>
        <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>🆕 Mật khẩu mới</label>
        <div style={{ position:"relative" }}>
          <input value={newPw} onChange={e => { setNewPw(e.target.value); setErr(""); }}
            type={showNew ? "text" : "password"}
            placeholder="Ít nhất 6 ký tự..."
            style={{ width:"100%", height:48, borderRadius:12, border:`2px solid ${err?"#ef4444":"#e5e7eb"}`, padding:"0 50px 0 16px", fontSize:15, outline:"none", boxSizing:"border-box" }} />
          <button onClick={() => setShowNew(v=>!v)} type="button"
            style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:18, color:"#9ca3af" }}>
            {showNew ? <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,verticalAlign:"middle",lineHeight:1}}>visibility_off</span> : <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,verticalAlign:"middle",lineHeight:1}}>visibility</span>}
          </button>
        </div>
      </div>

      <div style={{ marginBottom:20 }}>
        <label style={{ display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:6 }}>  Xác nhận mật khẩu mới</label>
        <div style={{ position:"relative" }}>
          <input value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setErr(""); }}
            type={showConfirm ? "text" : "password"}
            placeholder="Nhập lại mật khẩu mới..."
            onKeyDown={e => e.key==="Enter" && doChange()}
            style={{ width:"100%", height:48, borderRadius:12, border:`2px solid ${confirmPw && confirmPw !== newPw ? "#ef4444" : confirmPw && confirmPw === newPw ? "#10b981" : "#e5e7eb"}`, padding:"0 50px 0 16px", fontSize:15, outline:"none", boxSizing:"border-box" }} />
          <button onClick={() => setShowConfirm(v=>!v)} type="button"
            style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:18, color:"#9ca3af" }}>
            {showConfirm ? <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,verticalAlign:"middle",lineHeight:1}}>visibility_off</span> : <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,verticalAlign:"middle",lineHeight:1}}>visibility</span>}
          </button>
        </div>
        {confirmPw && confirmPw === newPw && (
          <div style={{ fontSize:12, color:"#10b981", marginTop:4, fontWeight:600 }}>  Mật khẩu khớp</div>
        )}
      </div>

      {err && (
        <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#dc2626", fontWeight:600 }}>
            {err}
        </div>
      )}

      <div style={{ display:"flex", gap:10 }}>
        {!forceChange && onClose && (
          <button onClick={onClose}
            style={{ flex:1, height:48, background:"#f3f4f6", color:"#374151", border:"none", borderRadius:12, fontSize:15, fontWeight:700, cursor:"pointer" }}>
            Huỷ
          </button>
        )}
        <button onClick={doChange} disabled={loading}
          style={{ flex:2, height:48, background:loading?"#a5b4fc":"#4f46e5", color:"#fff", border:"none", borderRadius:12, fontSize:15, fontWeight:800, cursor:loading?"not-allowed":"pointer" }}>
          {loading ? "⏳ Đang lưu..." : <><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,verticalAlign:"middle",lineHeight:1}}>save</span> Đổi mật khẩu</>}
        </button>
      </div>
    </div>
  );

  if (forceChange) return (
    <div style={{ position:"fixed", inset:0, background:"linear-gradient(135deg,#1e1b4b,#4f46e5)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      {content}
    </div>
  );

  return content;
}
