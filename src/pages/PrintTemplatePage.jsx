/**
 * PrintTemplatePage.jsx — Quản lý mẫu in ấn
 * @version 2026-06-01-v1
 */
import React from "react";

const TEMPLATES = [
  { key:"receipt",  icon:"receipt_long",   label:"Phiếu tiếp nhận",  desc:"In A5, có QR code tra cứu, IMEI, lỗi mô tả, tiền cọc" },
  { key:"invoice",  icon:"request_quote",  label:"Hóa đơn bán hàng", desc:"In A5, danh sách hàng, tổng tiền, VietQR thanh toán" },
  { key:"warranty", icon:"verified_user",  label:"Tem bảo hành",     desc:"In 5x3cm, mã đơn, ngày BH, QR tra cứu" },
  { key:"export",   icon:"output",         label:"Phiếu xuất kho",   desc:"In A5, danh sách linh kiện xuất, chữ ký KTV" },
];

export default function PrintTemplatePage({ user }) {
  return (
    <div style={{ padding:"24px 20px", maxWidth:900, margin:"0 auto" }}>
      <div style={{ fontWeight:900, fontSize:20, color:"#1e1b4b", marginBottom:6 }}>🖨️ Mẫu in ấn</div>
      <div style={{ fontSize:14, color:"#6b7280", marginBottom:24 }}>
        Thiết kế và tùy chỉnh các mẫu in phiếu tiếp nhận, hóa đơn, tem bảo hành
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:16, marginBottom:32 }}>
        {TEMPLATES.map(t => (
          <div key={t.key} style={{
            background:"#fff", borderRadius:16, border:"1.5px solid #e5e7eb",
            padding:20, cursor:"pointer", transition:"all .15s",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor="#6366f1"}
            onMouseLeave={e => e.currentTarget.style.borderColor="#e5e7eb"}
          >
            <span className="material-icons" style={{ fontFamily:"Material Icons", fontSize:36, color:"#6366f1", display:"block", marginBottom:12 }}>
              {t.icon}
            </span>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>{t.label}</div>
            <div style={{ fontSize:12, color:"#6b7280", lineHeight:1.5 }}>{t.desc}</div>
            <div style={{
              marginTop:12, padding:"6px 14px", borderRadius:20, display:"inline-block",
              background:"#f3f4f6", color:"#9ca3af", fontSize:11, fontWeight:600,
            }}>Đang phát triển</div>
          </div>
        ))}
      </div>

      <div style={{ padding:20, background:"#eff6ff", borderRadius:16, border:"1.5px solid #bfdbfe" }}>
        <div style={{ fontWeight:700, color:"#1d4ed8", marginBottom:8 }}>💡 Hiện tại</div>
        <div style={{ fontSize:13, color:"#374151", lineHeight:1.7 }}>
          In phiếu tiếp nhận và hóa đơn đang hoạt động qua <strong>Print Agent</strong> (Electron, port 7979).<br/>
          Tùy chỉnh mẫu in sẽ được cập nhật trong phiên bản tiếp theo.
        </div>
      </div>
    </div>
  );
}
