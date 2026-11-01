/**
 * excelExport.js — Xuất Excel (.xlsx) chuẩn dùng chung cho toàn app HK One Touch
 *
 * Mọi file xuất ra đều có:
 *   - Dòng TIÊU ĐỀ (tên báo cáo)
 *   - Khối ĐIỀU KIỆN XUẤT (kỳ báo cáo, bộ lọc, người xuất, thời điểm xuất, quy mô dữ liệu)
 *   - Dòng tiêu đề cột + dữ liệu
 *
 * Dùng:
 *   exportSheet({ fileName, sheetName, title, conditions, rows, widths })
 *   exportTable({ fileName, sheetName, title, conditions, headers, rows, widths })
 */
import * as XLSX from "xlsx";

export function nowText(d) {
  const t = d || new Date();
  const p = n => String(n).padStart(2, "0");
  return `${p(t.getDate())}/${p(t.getMonth() + 1)}/${t.getFullYear()} ${p(t.getHours())}:${p(t.getMinutes())}`;
}

export function dayStamp(d) {
  const t = d || new Date();
  const p = n => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

function safeName(s) {
  return String(s || "bao-cao").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
}

/**
 * rows: mảng các dòng (mỗi dòng là array). Tiêu đề + điều kiện được chèn lên đầu.
 */
export function exportSheet({ fileName, sheetName = "Báo cáo", title, conditions = [], rows = [], widths }) {
  const body = (rows || []).filter(r => Array.isArray(r));
  const colCount = Math.max(
    1,
    ...body.map(r => r.length),
    (widths || []).length
  );

  const head = [];
  if (title) head.push([title]);
  (conditions || []).filter(Boolean).forEach(c => head.push([c]));
  if (head.length) head.push([]);

  const aoa = [...head, ...body];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Gộp ô cho dòng tiêu đề + từng dòng điều kiện để chữ không bị cắt
  const merges = [];
  for (let i = 0; i < head.length; i++) {
    if (head[i] && head[i].length === 1 && colCount > 1) {
      merges.push({ s: { r: i, c: 0 }, e: { r: i, c: colCount - 1 } });
    }
  }
  if (merges.length) ws["!merges"] = merges;

  // Độ rộng cột: ưu tiên cấu hình tay, không thì tự canh theo nội dung
  if (widths && widths.length) {
    ws["!cols"] = widths.map(w => ({ wch: w }));
  } else {
    const auto = [];
    for (let c = 0; c < colCount; c++) {
      let max = 10;
      for (let r = head.length; r < aoa.length; r++) {
        const v = aoa[r]?.[c];
        const len = v == null ? 0 : String(v).length;
        if (len > max) max = len;
      }
      auto.push({ wch: Math.min(max + 2, 42) });
    }
    ws["!cols"] = auto;
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, String(sheetName).slice(0, 31));
  XLSX.writeFile(wb, `${safeName(fileName)}.xlsx`);
}

/**
 * Bảng phẳng: headers (mảng tên cột) + rows (mảng dòng).
 */
export function exportTable({ fileName, sheetName, title, conditions = [], headers = [], rows = [], widths }) {
  const data = (rows || []).map(r => (Array.isArray(r) ? r : Object.values(r)));
  return exportSheet({
    fileName, sheetName, title, conditions,
    rows: headers.length ? [headers, ...data] : data,
    widths,
  });
}

/**
 * Tạo sẵn mảng điều kiện xuất chuẩn: kỳ/bộ lọc + người xuất + thời điểm xuất.
 * filters: mảng chuỗi mô tả bộ lọc đang áp dụng.
 */
export function buildConditions(user, filters = [], extra = []) {
  const who = user?.full_name || user?.name || user?.username || "—";
  return [
    ...filters.filter(Boolean),
    ...extra.filter(Boolean),
    `Người xuất: ${who}`,
    `Thời điểm xuất: ${nowText()}`,
  ];
}
