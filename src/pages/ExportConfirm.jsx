/**
 * ExportConfirm.jsx — Modal xác nhận sau khi xuất file Excel
 * Hiển thị tên file + link bấm để mở/tải lại file, kèm ghi chú thư mục Tải về.
 */
import React from "react";
import * as XLSX from "xlsx";

// Tạo blob .xlsx từ workbook + object URL để hiển thị link mở file
export function buildExcelResult(wb, fileName) {
  const bin = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([bin], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return { fileName, url: URL.createObjectURL(blob) };
}

export default function ExportConfirmModal({ fileName, url, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1300,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "min(420px, 95vw)", textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 6 }}>✅</div>
        <div style={{ fontWeight: 900, fontSize: 16, color: "#1e1b4b", marginBottom: 4 }}>
          Đã xuất file thành công!
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16, wordBreak: "break-all" }}>
          📄 <strong>{fileName}</strong>
        </div>
        <a href={url} download={fileName}
          style={{ display: "block", textDecoration: "none", marginBottom: 10,
            padding: "12px 20px", borderRadius: 12, background: "#059669", color: "#fff",
            fontWeight: 800, fontSize: 14 }}>
          ⬇️ Mở file Excel
        </a>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>
          File cũng được trình duyệt lưu tự động vào thư mục <strong>Tải về</strong> nếu không bấm mở.
        </div>
        <button onClick={onClose}
          style={{ width: "100%", padding: "10px 0", borderRadius: 12, border: "1.5px solid #e5e7eb",
            background: "#fff", color: "#374151", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
          Đóng
        </button>
      </div>
    </div>
  );
}
