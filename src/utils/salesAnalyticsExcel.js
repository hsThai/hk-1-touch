/**
 * salesAnalyticsExcel.js — Xuất Excel "Phân tích bán hàng" THEO MẪU CÓ SẴN.
 *
 * Chỉ đổ dữ liệu vào mẫu khai báo trong excelTemplates.js rồi trả file.
 * Không gọi AI/agent, không gọi mạng — chạy hoàn toàn trên máy người dùng.
 */
import {
  SALE_ANALYTICS_TEMPLATE,
  renderTemplateToXlsx,
  stampNow,
} from "./excelTemplates.js";

export async function buildSalesAnalyticsXlsx({ tab, rows, totals, from, to, user, fmtMoney, fmtNum, tabLabel }) {
  const ExcelJS = (await import("exceljs")).default;
  const template = SALE_ANALYTICS_TEMPLATE;

  const wb = await renderTemplateToXlsx({
    template,
    tabKey: tab,
    ctx: {
      rows,
      totals,
      from,
      to,
      tabLabel,
      userName: user?.full_name || user?.name || "",
      stamp: stampNow(),
      fmtMoney: fmtMoney || ((n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ"),
      fmtNum: fmtNum || ((n) => (Number(n) || 0).toLocaleString("vi-VN")),
    },
    ExcelJS,
  });

  const buffer = await wb.xlsx.writeBuffer();
  return {
    buffer,
    fileName: `${template.filePrefix}_${tab}_${from}_${to}.xlsx`,
  };
}
