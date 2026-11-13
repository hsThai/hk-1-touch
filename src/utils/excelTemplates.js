/**
 * excelTemplates.js — KHO MẪU EXCEL (template tĩnh)
 *
 * Nguyên tắc: mẫu báo cáo được khai báo sẵn ở đây (tiêu đề, dòng mô tả, cột,
 * độ rộng, định dạng số, dòng tổng, style). Khi người dùng bấm "Xuất Excel",
 * app chỉ đổ dữ liệu vào mẫu rồi tải file — hoàn toàn chạy trên máy người dùng,
 * không gọi AI/agent và không gọi mạng.
 */

// ── Định dạng dùng chung ───────────────────────────────────────
export const MONEY_FMT = '#,##0"đ"';
export const INT_FMT = "#,##0";

const S = {
  title:    { bold: true, size: 15, color: { argb: "FF1E1B4B" } },
  metaKey:  { bold: true, size: 10.5, color: { argb: "FF374151" } },
  metaVal:  { size: 10.5, color: { argb: "FF111827" } },
  note:     { italic: true, size: 10, color: { argb: "FF6B7280" } },
  head:     { bold: true, size: 11, color: { argb: "FFFFFFFF" } },
  headFill: "FF4F46E5",
  cell:     { size: 10.5 },
  zebra:    "FFF9FAFB",
  totalFont:{ bold: true, size: 11, color: { argb: "FF1E1B4B" } },
  totalFill:"FFFEF3C7",
};

function dm(iso) { const [y, m, d] = String(iso).split("-"); return `${d}/${m}/${y}`; }
function two(n) { return String(n).padStart(2, "0"); }
function stampNow(d = new Date()) {
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/* ─────────────────────────────────────────────────────────────
 * MẪU: PHÂN TÍCH BÁN HÀNG  (4 tab)
 * Mỗi tab: tiêu đề in đậm ở dòng 1, 6 dòng mô tả (dòng 2-7),
 * ghi chú dòng 8, tiêu đề bảng dòng 9, dữ liệu từ dòng 10, tổng cuối.
 * ───────────────────────────────────────────────────────────── */
export const SALE_ANALYTICS_TEMPLATE = {
  filePrefix: "PhanTichBanHang",
  headerRows: 9,               // số dòng cố định trước bảng (để đóng băng)
  meta: [
    { label: "Kỳ báo cáo:",        get: (c) => `${dm(c.from)} - ${dm(c.to)}` },
    { label: "Mục báo cáo:",       get: (c) => c.tabLabel },
    { label: "Số dòng dữ liệu:",   get: (c) => c.fmtNum(c.rows.length) },
    { label: "Doanh thu kỳ:",      get: (c) => `${c.fmtMoney(c.totals.revenue)}  ·  Giá trị trả: ${c.fmtMoney(c.totals.retValue)}  ·  Doanh thu thuần: ${c.fmtMoney(c.totals.net)}` },
    { label: "Người xuất:",        get: (c) => c.userName },
    { label: "Thời điểm xuất:",    get: (c) => c.stamp },
  ],
  tabs: {
    item: {
      title: "BÁO CÁO DANH SÁCH KHÁCH HÀNG THEO HÀNG BÁN",
      note: "(Đã phân bổ giảm giá hóa đơn)",
      columns: [
        { key: "sku",           label: "Mã hàng",          align: "left",  width: 16, type: "text",  get: (r) => r.key },
        { key: "name",          label: "Tên hàng",         align: "left",  width: 46, type: "text",  get: (r) => r.name || "—" },
        { key: "customers",     label: "SL khách hàng",    align: "right", width: 13, type: "int",   get: (r) => r.customerCount, total: (rows) => rows.reduce((a, r) => a + r.customerCount, 0) },
        { key: "qty",           label: "SL mua",           align: "right", width: 11, type: "int",   get: (r) => r.qty,           total: (rows) => rows.reduce((a, r) => a + r.qty, 0) },
        { key: "revenue",       label: "Doanh thu",        align: "right", width: 16, type: "money", get: (r) => r.revenue,       total: (rows) => rows.reduce((a, r) => a + r.revenue, 0) },
        { key: "retQty",        label: "SL trả",           align: "right", width: 10, type: "int",   get: (r) => r.retQty,        total: (rows) => rows.reduce((a, r) => a + r.retQty, 0) },
        { key: "retValue",      label: "Giá trị trả",      align: "right", width: 15, type: "money", get: (r) => r.retValue,      total: (rows) => rows.reduce((a, r) => a + r.retValue, 0) },
        { key: "net",           label: "Doanh thu thuần",  align: "right", width: 17, type: "money", get: (r) => r.net,           total: (rows) => rows.reduce((a, r) => a + r.net, 0) },
      ],
      totalLabel: (c) => `${c.fmtNum(c.rows.length)} mặt hàng`,
    },
    customer: {
      title: "BÁO CÁO DANH SÁCH KHÁCH HÀNG",
      note: "(Đã phân bổ giảm giá hóa đơn, giảm giá phiếu trả)",
      columns: [
        { key: "name",      label: "Khách hàng",       align: "left",  width: 30, type: "text",  get: (r) => r.name || "—" },
        { key: "phone",     label: "Số điện thoại",    align: "left",  width: 15, type: "text",  get: (r) => r.phone || "" },
        { key: "orders",    label: "SL đơn",           align: "right", width: 10, type: "int",   get: (r) => r.orderCount, total: (rows) => rows.reduce((a, r) => a + r.orderCount, 0) },
        { key: "qty",       label: "SL mua",           align: "right", width: 11, type: "int",   get: (r) => r.qty,        total: (rows) => rows.reduce((a, r) => a + r.qty, 0) },
        { key: "revenue",   label: "Doanh thu",        align: "right", width: 16, type: "money", get: (r) => r.revenue,    total: (rows) => rows.reduce((a, r) => a + r.revenue, 0) },
        { key: "retQty",    label: "SL trả",           align: "right", width: 10, type: "int",   get: (r) => r.retQty,     total: (rows) => rows.reduce((a, r) => a + r.retQty, 0) },
        { key: "retValue",  label: "Giá trị trả",      align: "right", width: 15, type: "money", get: (r) => r.retValue,   total: (rows) => rows.reduce((a, r) => a + r.retValue, 0) },
        { key: "net",       label: "Doanh thu thuần",  align: "right", width: 17, type: "money", get: (r) => r.net,        total: (rows) => rows.reduce((a, r) => a + r.net, 0) },
      ],
      totalLabel: (c) => `${c.fmtNum(c.rows.length)} khách hàng`,
    },
    seller: {
      title: "BÁO CÁO HÀNG BÁN THEO NHÂN VIÊN",
      note: "(Đã phân bổ giảm giá hóa đơn)",
      columns: [
        { key: "name",     label: "Nhân viên",     align: "left",  width: 26, type: "text",  get: (r) => r.name || "—" },
        { key: "orders",   label: "SL đơn",        align: "right", width: 10, type: "int",   get: (r) => r.orderCount, total: (rows) => rows.reduce((a, r) => a + r.orderCount, 0) },
        { key: "qty",      label: "SL hàng bán",   align: "right", width: 13, type: "int",   get: (r) => r.qty,        total: (rows) => rows.reduce((a, r) => a + r.qty, 0) },
        { key: "revenue",  label: "Doanh thu",     align: "right", width: 18, type: "money", get: (r) => r.revenue,    total: (rows) => rows.reduce((a, r) => a + r.revenue, 0) },
      ],
      totalLabel: (c) => `${c.fmtNum(c.rows.length)} nhân viên`,
    },
    day: {
      title: "BÁO CÁO DOANH THU THEO NGÀY",
      note: "(Đã phân bổ giảm giá hóa đơn)",
      columns: [
        { key: "day",      label: "Ngày",              align: "left",  width: 13, type: "text",  get: (r) => r.key },
        { key: "orders",   label: "SL đơn",            align: "right", width: 10, type: "int",   get: (r) => r.orderCount, total: (rows) => rows.reduce((a, r) => a + r.orderCount, 0) },
        { key: "qty",      label: "SL hàng bán",       align: "right", width: 13, type: "int",   get: (r) => r.qty,        total: (rows) => rows.reduce((a, r) => a + r.qty, 0) },
        { key: "revenue",  label: "Doanh thu",         align: "right", width: 16, type: "money", get: (r) => r.revenue,    total: (rows) => rows.reduce((a, r) => a + r.revenue, 0) },
        { key: "retValue", label: "Giá trị trả",       align: "right", width: 15, type: "money", get: (r) => r.retValue,   total: (rows) => rows.reduce((a, r) => a + r.retValue, 0) },
        { key: "net",      label: "Doanh thu thuần",   align: "right", width: 17, type: "money", get: (r) => r.net,        total: (rows) => rows.reduce((a, r) => a + r.net, 0) },
      ],
      totalLabel: (c) => `${c.fmtNum(c.rows.length)} ngày`,
    },
  },
};

/* ─────────────────────────────────────────────────────────────
 * ENGINE: đổ dữ liệu vào mẫu (không phụ thuộc báo cáo cụ thể)
 * ───────────────────────────────────────────────────────────── */
export async function renderTemplateToXlsx({ template, tabKey, ctx, ExcelJS }) {
  const tab = template.tabs[tabKey];
  if (!tab) throw new Error("Không tìm thấy mẫu cho báo cáo này");

  const wb = new ExcelJS.Workbook();
  wb.creator = ctx.userName || "HK One Touch";
  wb.created = new Date();

  const ws = wb.addWorksheet(tab.title.slice(0, 28), {
    views: [{ state: "frozen", ySplit: template.headerRows }],
  });

  const nCols = tab.columns.length;
  const lastCol = String.fromCharCode(64 + nCols);

  // 1) Tiêu đề
  ws.mergeCells(`A1:${lastCol}1`);
  Object.assign(ws.getCell("A1"), {
    value: tab.title,
    font: S.title,
    alignment: { horizontal: "center", vertical: "middle" },
  });
  ws.getRow(1).height = 26;

  // 2) Dòng mô tả
  template.meta.forEach((m, i) => {
    const r = i + 2;
    Object.assign(ws.getCell(`A${r}`), { value: m.label, font: S.metaKey });
    ws.mergeCells(`B${r}:${lastCol}${r}`);
    Object.assign(ws.getCell(`B${r}`), {
      value: m.get(ctx),
      font: S.metaVal,
      alignment: { horizontal: "left", vertical: "middle" },
    });
  });

  // 3) Ghi chú
  const noteRow = template.meta.length + 2;
  Object.assign(ws.getCell(`A${noteRow}`), { value: tab.note || "", font: S.note });

  // 4) Tiêu đề bảng
  const headRow = ws.getRow(template.headerRows);
  tab.columns.forEach((c, i) => {
    const cell = headRow.getCell(i + 1);
    cell.value = c.label;
    cell.font = S.head;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: S.headFill } };
    cell.alignment = { horizontal: c.align === "right" ? "right" : (i === 0 ? "left" : "center"), vertical: "middle", wrapText: true };
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  });
  headRow.height = 24;

  // 5) Dữ liệu
  const startRow = template.headerRows + 1;
  ctx.rows.forEach((r, ri) => {
    const row = ws.getRow(startRow + ri);
    tab.columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = c.get(r);
      cell.font = S.cell;
      cell.alignment = { horizontal: c.align === "right" ? "right" : "left", vertical: "middle", wrapText: c.type === "text" && c.width >= 30 };
      if (c.type === "money") cell.numFmt = MONEY_FMT;
      else if (c.type === "int") cell.numFmt = INT_FMT;
      cell.border = { top: { style: "hair" }, left: { style: "hair" }, bottom: { style: "hair" }, right: { style: "hair" } };
      if (ri % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: S.zebra } };
    });
  });

  // 6) Dòng tổng
  const totalRow = ws.getRow(startRow + ctx.rows.length);
  tab.columns.forEach((c, i) => {
    const cell = totalRow.getCell(i + 1);
    if (i === 0) cell.value = "TỔNG CỘNG";
    else if (i === 1) cell.value = tab.totalLabel ? tab.totalLabel(ctx) : "";
    else if (c.total) cell.value = c.total(ctx.rows);
    cell.font = S.totalFont;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: S.totalFill } };
    cell.border = { top: { style: "medium" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    cell.alignment = { horizontal: c.align === "right" ? "right" : "left", vertical: "middle" };
    if (c.type === "money") cell.numFmt = MONEY_FMT;
    else if (c.type === "int") cell.numFmt = INT_FMT;
  });

  // 7) Độ rộng cột
  tab.columns.forEach((c, i) => { ws.getColumn(i + 1).width = c.width || 14; });

  return wb;
}

export { dm as formatDateVN, stampNow };
