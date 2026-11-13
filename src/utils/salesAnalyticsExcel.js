import "exceljs";

  // ── Xuất Excel có định dạng đầy đủ (tiêu đề, kỳ báo cáo, dòng tổng, kẻ khung)
export async function buildSalesAnalyticsXlsx({ tab, TABS, headers, displayed, totals, from, to, user, fmtMoney, fmtNum }) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = user?.full_name || user?.name || "HK One Touch";
    wb.created = new Date();
    const wsName = TABS.find(t => t.key === tab)?.label.slice(0, 28) || "Bao cao";
    const ws = wb.addWorksheet(wsName, { views: [{ state: "frozen", ySplit: 9 }] });

    const dm = (iso) => { const [y, m, d] = String(iso).split("-"); return `${d}/${m}/${y}`; };
    const now = new Date();
    const stamp = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

    const nCols = headers.length;
    const lastCol = String.fromCharCode(64 + nCols); // A..H

    // ── Khối tiêu đề
    ws.mergeCells(`A1:${lastCol}1`);
    ws.getCell("A1").value = tab === "item" ? "BÁO CÁO DANH SÁCH KHÁCH HÀNG THEO HÀNG BÁN"
      : tab === "customer" ? "BÁO CÁO DANH SÁCH KHÁCH HÀNG"
      : tab === "seller" ? "BÁO CÁO HÀNG BÁN THEO NHÂN VIÊN"
      : "BÁO CÁO DOANH THU THEO NGÀY";
    ws.getCell("A1").font = { bold: true, size: 15, color: { argb: "FF1E1B4B" } };
    ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 26;

    const meta = [
      ["Kỳ báo cáo:", `${dm(from)} - ${dm(to)}`],
      ["Mục báo cáo:", TABS.find(t => t.key === tab)?.label || ""],
      ["Số dòng dữ liệu:", fmtNum(displayed.length)],
      ["Doanh thu kỳ:", `${fmtMoney(totals.revenue)}  ·  Giá trị trả: ${fmtMoney(totals.retValue)}  ·  Doanh thu thuần: ${fmtMoney(totals.net)}`],
      ["Người xuất:", user?.full_name || user?.name || ""],
      ["Thời điểm xuất:", stamp],
    ];
    meta.forEach(([k, v], i) => {
      const r = i + 2;
      ws.getCell(`A${r}`).value = k;
      ws.getCell(`A${r}`).font = { bold: true, size: 10.5, color: { argb: "FF374151" } };
      ws.mergeCells(`B${r}:${lastCol}${r}`);
      ws.getCell(`B${r}`).value = v;
      ws.getCell(`B${r}`).font = { size: 10.5, color: { argb: "FF111827" } };
      ws.getCell(`B${r}`).alignment = { horizontal: "left", vertical: "middle" };
    });

    ws.getCell("A8").value = tab === "customer"
      ? "(Đã phân bổ giảm giá hóa đơn, giảm giá phiếu trả)"
      : "(Đã phân bổ giảm giá hóa đơn)";
    ws.getCell("A8").font = { italic: true, size: 10, color: { argb: "FF6B7280" } };

    // ── Dòng tiêu đề bảng
    const headRow = ws.getRow(9);
    headers.forEach(([h], i) => {
      const cell = headRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
      cell.alignment = { horizontal: i === 0 ? "left" : (headers[i][1] === "right" ? "right" : "center"), vertical: "middle", wrapText: true };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });
    headRow.height = 24;

    // ── Dữ liệu
    const startRow = 10;
    const moneyFmt = '#,##0"đ"';
    displayed.forEach((r, ri) => {
      const row = ws.getRow(startRow + ri);
      const vals = (() => {
        if (tab === "item") return [r.key, r.name || "—", r.customerCount, r.qty, r.revenue, r.retQty, r.retValue, r.net];
        if (tab === "customer") return [r.name || "—", r.phone || "", r.orderCount, r.qty, r.revenue, r.retQty, r.retValue, r.net];
        if (tab === "seller") return [r.name || "—", r.orderCount, r.qty, r.revenue];
        return [r.key, r.orderCount, r.qty, r.revenue, r.retValue, r.net];
      })();
      const moneyIdx = (() => {
        if (tab === "item") return [4, 6, 7];
        if (tab === "customer") return [4, 6, 7];
        if (tab === "seller") return [3];
        return [3, 4, 5];
      })();
      vals.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        cell.font = { size: 10.5 };
        cell.alignment = { horizontal: headers[i][1] === "right" ? "right" : "left",
          vertical: "middle", wrapText: i === 1 };
        if (moneyIdx.includes(i)) cell.numFmt = moneyFmt;
        else if (typeof v === "number") cell.numFmt = "#,##0";
        cell.border = { top: { style: "hair" }, left: { style: "hair" }, bottom: { style: "hair" }, right: { style: "hair" } };
        if (ri % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
      });
    });

    // ── Dòng tổng
    const totalRow = ws.getRow(startRow + displayed.length);
    totalRow.values = (() => {
      const base = new Array(nCols).fill("");
      base[0] = "TỔNG CỘNG";
      if (tab === "item" || tab === "customer") {
        base[1] = `${fmtNum(displayed.length)} mặt hàng`;
        base[2] = tab === "item" ? displayed.reduce((a, r) => a + r.customerCount, 0) : displayed.reduce((a, r) => a + r.orderCount, 0);
        base[3] = totals.qty; base[4] = totals.revenue; base[5] = totals.retQty; base[6] = totals.retValue; base[7] = totals.net;
      } else if (tab === "seller") {
        base[1] = displayed.reduce((a, r) => a + r.orderCount, 0);
        base[2] = totals.qty; base[3] = totals.revenue;
      } else {
        base[1] = displayed.reduce((a, r) => a + r.orderCount, 0);
        base[2] = totals.qty; base[3] = totals.revenue; base[4] = totals.retValue; base[5] = totals.net;
      }
      return base;
    })();
    totalRow.eachCell((cell, i) => {
      cell.font = { bold: true, size: 11, color: { argb: "FF1E1B4B" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
      cell.border = { top: { style: "medium" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      cell.alignment = { horizontal: headers[i - 1] && headers[i - 1][1] === "right" ? "right" : "left", vertical: "middle" };
    });
    if (tab === "item" || tab === "customer") {
      for (const idx of [5, 7, 8]) totalRow.getCell(idx).numFmt = moneyFmt;
    } else if (tab === "seller") {
      totalRow.getCell(4).numFmt = moneyFmt;
    } else {
      for (const idx of [4, 5, 6]) totalRow.getCell(idx).numFmt = moneyFmt;
    }

    // ── Độ rộng cột
    const widths = tab === "item" ? [16, 46, 13, 11, 16, 10, 15, 17]
      : tab === "customer" ? [30, 15, 10, 11, 16, 10, 15, 17]
      : tab === "seller" ? [26, 10, 13, 18]
      : [13, 10, 13, 16, 15, 17];
    ws.columns.forEach((col, i) => { col.width = widths[i] || 14; });

    const buf = await wb.xlsx.writeBuffer();
    return { buffer: buf, fileName: `PhanTichBanHang_${tab}_${from}_${to}.xlsx` };
}

