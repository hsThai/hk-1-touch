import React, { useState } from "react";
import { base44 } from "@/api/base44Client";

export default function ExportDocs() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleExport() {
    setLoading(true);
    setDone(false);
    try {
      const response = await fetch(
        `/api/functions/exportAppDocs`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      if (!response.ok) throw new Error("Lỗi tạo file");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "HK_OneTouch_TaiLieu.xls";
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch (e) {
      alert("Lỗi: " + e.message);
    }
    setLoading(false);
  }

  async function handleExportSDK() {
    setLoading(true);
    setDone(false);
    try {
      const res = await base44.functions.invoke("exportAppDocs", {});
      // Nếu SDK không hỗ trợ blob, dùng cách khác
      alert("Sử dụng nút Download ở dưới để tải file Excel");
    } catch (e) {
      alert("Lỗi: " + e.message);
    }
    setLoading(false);
  }

  const sections = [
    { icon: "📋", title: "1. Tổng quan", desc: "Mô tả app, nền tảng, tích hợp, vai trò người dùng" },
    { icon: "👥", title: "2. Vai trò", desc: "Chi tiết 4 vai trò: Manager, Tiếp tân, KTV, NV Kho" },
    { icon: "🔄", title: "3. Workflow", desc: "Quy trình sửa chữa 10 bước, workflow linh kiện, nhập hàng" },
    { icon: "🗄️", title: "4. Database", desc: "14 collections PocketBase với đầy đủ fields và kiểu dữ liệu" },
    { icon: "⚙️", title: "5. Tính năng", desc: "47 tính năng phân theo nhóm: Đơn, KPI, Chat, Kho, QR, Thông báo..." },
    { icon: "🏆", title: "6. KPI", desc: "Quy tắc KPI: stages, hạn giờ, trừ điểm, nhắc tự động" },
    { icon: "🔔", title: "7. Thông báo", desc: "14 loại thông báo, cơ chế polling, push notification, âm thanh" },
    { icon: "📦", title: "8. Phiếu Xuất Kho", desc: "Workflow xuất sửa vs mượn, trạng thái" },
    { icon: "🎨", title: "9. Trạng thái", desc: "Mapping Display ↔ DB ↔ màu sắc cho 9 trạng thái đơn" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#1e1b4b,#4f46e5)", padding: "24px 16px", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>📊</div>
          <h1 style={{ color: "#fff", fontWeight: 900, fontSize: 26, margin: 0 }}>Xuất Tài Liệu Excel</h1>
          <p style={{ color: "#c7d2fe", fontSize: 15, marginTop: 8 }}>
            HK One Touch — Tài liệu kỹ thuật đầy đủ
          </p>
        </div>

        {/* Nội dung file */}
        <div style={{ background: "rgba(255,255,255,.08)", borderRadius: 20, padding: 20, marginBottom: 24, border: "1.5px solid rgba(255,255,255,.15)" }}>
          <div style={{ color: "#e0e7ff", fontWeight: 800, fontSize: 15, marginBottom: 16 }}>
            📁 File Excel gồm {sections.length} sheet:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sections.map((s, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,.06)", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(255,255,255,.1)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{s.icon}</span>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{s.title}</div>
                    <div style={{ color: "#a5b4fc", fontSize: 12, marginTop: 3 }}>{s.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nút tải */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <a
            href="/api/functions/exportAppDocs"
            download="HK_OneTouch_TaiLieu.xls"
            onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 2000); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              height: 60, borderRadius: 16, textDecoration: "none",
              background: loading ? "rgba(255,255,255,.3)" : "linear-gradient(135deg,#059669,#047857)",
              color: "#fff", fontWeight: 900, fontSize: 18,
              boxShadow: "0 4px 20px rgba(5,150,105,.4)",
              border: "none", cursor: "pointer"
            }}
          >
            <span style={{ fontSize: 24 }}>⬇️</span>
            {loading ? "Đang tạo file..." : done ? "✅ Đã tải xong!" : "Tải File Excel"}
          </a>

          <div style={{ background: "rgba(255,255,255,.08)", borderRadius: 14, padding: "14px 16px", border: "1px solid rgba(255,255,255,.1)" }}>
            <div style={{ color: "#fcd34d", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>💡 Hướng dẫn mở file</div>
            <div style={{ color: "#c7d2fe", fontSize: 12, lineHeight: 1.7 }}>
              • File định dạng <b>.xls</b> (SpreadsheetML) — mở được bằng Microsoft Excel, LibreOffice Calc, Google Sheets<br/>
              • Nếu cảnh báo bảo mật khi mở → chọn <b>"Enable Editing"</b> / "Cho phép chỉnh sửa"<br/>
              • Mỗi sheet là 1 chủ đề, có header màu xanh để phân biệt
            </div>
          </div>
        </div>

        {/* Back button */}
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <a href="/MainApp" style={{ color: "#a5b4fc", fontSize: 14, textDecoration: "none", fontWeight: 600 }}>
            ← Quay về ứng dụng
          </a>
        </div>
      </div>
    </div>
  );
}