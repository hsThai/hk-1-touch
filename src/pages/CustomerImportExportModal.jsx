/**
 * CustomerImportExportModal.jsx — Nhập/Xuất file Excel cho Danh sách khách hàng
 * Xuất: toàn bộ khách hàng hiện có ra .xlsx để chỉnh sửa hàng loạt.
 * Nhập: đọc .xlsx/.csv → khớp theo SỐ ĐIỆN THOẠI (đã có SĐT thì cập nhật, chưa có thì tạo mới).
 * @version 2026-10-20-v1
 */
import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { Customer, logAction } from "./pb.jsx";

const TEMPLATE_HEADERS = ["Họ tên", "Số điện thoại", "Địa chỉ", "Ghi chú"];

function normPhone(p) {
  return String(p || "").replace(/[\s.\-()\u202F]/g, "").trim();
}
function parseNum(v) {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[.,\s]/g, m => (m === "," ? "." : "")).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

export default function CustomerImportExportModal({ user, customers, onClose, onImported }) {
  const [mode, setMode] = useState("menu"); // menu | preview | importing | done
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  // ── XUẤT FILE ─────────────────────────────────────────────
  function exportExcel() {
    const data = customers.map(c => ({
      "Họ tên": c.full_name || "",
      "Số điện thoại": c.phone || "",
      "Địa chỉ": c.address || "",
      "Ghi chú": c.note || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data, { header: TEMPLATE_HEADERS });
    ws["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 36 }, { wch: 28 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh sách khách hàng");
    XLSX.writeFile(wb, `danh-sach-khach-hang_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function downloadTemplate() {
    const sample = [{
      "Họ tên": "Nguyễn Văn A", "Số điện thoại": "0901234567",
      "Địa chỉ": "123 Lê Lợi, Q1", "Ghi chú": "Khách quen",
    }];
    const ws = XLSX.utils.json_to_sheet(sample, { header: TEMPLATE_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mẫu nhập khách hàng");
    XLSX.writeFile(wb, "mau-nhap-khach-hang.xlsx");
  }

  // ── ĐỌC FILE NHẬP ─────────────────────────────────────────
  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
        processRows(json);
      } catch (err) {
        alert("Không đọc được file. Vui lòng dùng đúng file .xlsx / .csv theo mẫu.\n" + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function processRows(json) {
    const errs = [];
    const phoneIndex = {};
    customers.forEach(c => {
      const p = normPhone(c.phone);
      if (p) phoneIndex[p] = c;
    });
    const seenInFile = {};

    const parsed = json.map((r, idx) => {
      const rowNo = idx + 2;
      const name = String(r["Họ tên"] || r["Ho ten"] || r["Họ và tên"] || "").trim();
      const phone = normPhone(r["Số điện thoại"] || r["So dien thoai"] || r["SĐT"] || r["Điện thoại"] || "");
      const address = String(r["Địa chỉ"] || r["Dia chi"] || "").trim();
      const note = String(r["Ghi chú"] || r["Ghi chu"] || "").trim();

      if (!name && !phone) return null; // dòng trống hoàn toàn — bỏ qua lặng lẽ
      if (!name)  { errs.push(`Dòng ${rowNo}: thiếu "Họ tên" — bỏ qua`); return null; }
      if (!phone) { errs.push(`Dòng ${rowNo}: thiếu "Số điện thoại" — bỏ qua`); return null; }
      if (!/^[0-9+]{8,15}$/.test(phone)) { errs.push(`Dòng ${rowNo}: SĐT "${phone}" không hợp lệ — bỏ qua`); return null; }
      if (seenInFile[phone] !== undefined) { errs.push(`Dòng ${rowNo}: SĐT ${phone} bị lặp (đã có ở dòng ${seenInFile[phone]}) — chỉ lấy dòng đầu`); return null; }
      seenInFile[phone] = rowNo;

      return { rowNo, name, phone, address, note, existing: phoneIndex[phone] || null };
    }).filter(Boolean);

    setErrors(errs);
    setRows(parsed);
    setMode("preview");
  }

  const summary = useMemo(() => ({
    toCreate: rows.filter(r => !r.existing).length,
    toUpdate: rows.filter(r => r.existing).length,
    total: rows.length,
  }), [rows]);

  // ── THỰC HIỆN NHẬP ────────────────────────────────────────
  async function confirmImport() {
    setBusy(true);
    setMode("importing");
    let created = 0, updated = 0, failed = 0;
    try {
      for (const r of rows) {
        try {
          const payload = { full_name: r.name, phone: r.phone, address: r.address, note: r.note };
          if (r.existing) {
            await Customer.update(r.existing.id, payload);
            logAction(user, "update", "customer", r.existing.id, `Cập nhật KH (nhập file): ${r.name} - ${r.phone}`);
            updated++;
          } else {
            const rec = await Customer.create(payload);
            logAction(user, "create", "customer", rec.id, `Tạo KH mới (nhập file): ${r.name} - ${r.phone}`);
            created++;
          }
        } catch (e) { failed++; }
      }
      setResult({ created, updated, failed });
      setMode("done");
      onImported?.();
    } catch (e) {
      alert("Lỗi khi nhập file: " + e.message);
      setMode("preview");
    }
    setBusy(false);
  }

  const BTN = { padding: "10px 14px", borderRadius: 12, border: "none", fontWeight: 700, fontSize: 13.5, cursor: "pointer" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1200,
      display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 24, width: "min(680px,95vw)", margin: "10px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: "#1e1b4b" }}>👥 Nhập / Xuất file danh sách khách hàng</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>✕</button>
        </div>

        {mode === "menu" && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
              Xuất file để chỉnh sửa hàng loạt (thêm/sửa địa chỉ, ghi chú...), rồi nhập lại — hệ thống tự khớp theo <strong>Số điện thoại</strong>: SĐT đã có thì cập nhật, chưa có thì tạo mới.
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <button onClick={exportExcel} style={{ ...BTN, background: "#059669", color: "#fff" }}>
                ⬇️ Xuất Excel danh sách hiện có ({customers.length} khách)
              </button>
              <label style={{ ...BTN, background: "#4f46e5", color: "#fff", display: "block", textAlign: "center" }}>
                ⬆️ Chọn file Excel để nhập (.xlsx / .csv)
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile}
                  style={{ display: "none" }} onClick={e => e.target.value = ""} />
              </label>
              <button onClick={downloadTemplate} style={{ ...BTN, background: "#f3f4f6", color: "#374151", border: "1.5px solid #e5e7eb" }}>
                📄 Tải file mẫu
              </button>
            </div>
          </div>
        )}

        {mode === "preview" && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>📄 {fileName}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, margin: "12px 0" }}>
              <div style={{ background: "#eef2ff", borderRadius: 10, padding: 10, textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#4f46e5" }}>{summary.total}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Dòng hợp lệ</div>
              </div>
              <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 10, textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#059669" }}>{summary.toCreate}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Tạo mới</div>
              </div>
              <div style={{ background: "#fffbeb", borderRadius: 10, padding: 10, textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#d97706" }}>{summary.toUpdate}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Cập nhật theo SĐT</div>
              </div>
            </div>

            {errors.length > 0 && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 10, fontSize: 12, color: "#dc2626", marginBottom: 12, maxHeight: 140, overflowY: "auto" }}>
                {errors.map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            )}

            <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #f3f4f6", borderRadius: 10, marginBottom: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f9fafb", position: "sticky", top: 0 }}>
                    {["Họ tên", "SĐT", "Địa chỉ", ""].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#374151" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map(r => (
                    <tr key={r.rowNo} style={{ borderBottom: "1px solid #f9fafb" }}>
                      <td style={{ padding: "7px 10px" }}>{r.name}</td>
                      <td style={{ padding: "7px 10px" }}>{r.phone}</td>
                      <td style={{ padding: "7px 10px", color: "#6b7280" }}>{r.address || "—"}</td>
                      <td style={{ padding: "7px 10px", fontWeight: 700, color: r.existing ? "#d97706" : "#059669", whiteSpace: "nowrap" }}>
                        {r.existing ? "✏️ Cập nhật" : "➕ Mới"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setMode("menu"); setRows([]); setErrors([]); }}
                style={{ ...BTN, background: "#f3f4f6", color: "#374151", flex: 1 }}>↩️ Chọn lại file</button>
              <button onClick={confirmImport} disabled={busy || summary.total === 0}
                style={{ ...BTN, background: "#4f46e5", color: "#fff", flex: 2, opacity: busy || summary.total === 0 ? .6 : 1 }}>
                {busy ? "Đang nhập..." : `✅ Nhập ${summary.total} khách hàng`}
              </button>
            </div>
          </div>
        )}

        {mode === "importing" && (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>⏳ Đang nhập dữ liệu, vui lòng chờ...</div>
        )}

        {mode === "done" && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#1e1b4b", marginBottom: 12 }}>Nhập hoàn tất!</div>
            <div style={{ fontSize: 13, color: "#059669", fontWeight: 700 }}>➕ Tạo mới: {result?.created} khách</div>
            <div style={{ fontSize: 13, color: "#d97706", fontWeight: 700 }}>✏️ Cập nhật: {result?.updated} khách</div>
            {result?.failed > 0 && <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 700 }}>⚠️ Lỗi: {result.failed} dòng</div>}
            <button onClick={onClose} style={{ ...BTN, background: "#4f46e5", color: "#fff", marginTop: 16, padding: "10px 40px" }}>Xong</button>
          </div>
        )}
      </div>
    </div>
  );
}
