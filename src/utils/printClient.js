/**
 * printClient.js — Gửi lệnh in tới Print Agent (localhost:7979)
 */
const PRINT_AGENT_URL = "http://localhost:7979";
const TOKEN = "hk-print-2026";

async function callPrintAgent(endpoint, body) {
  try {
    const res = await fetch(`${PRINT_AGENT_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Print Agent lỗi: ${res.status}`);
    return await res.json();
  } catch (e) {
    if (e.name === "AbortError" || e.message.includes("fetch"))
      throw new Error("Không kết nối được Print Agent. Kiểm tra app đang chạy trên PC.");
    throw e;
  }
}

export async function printReceiptA5(order, shopInfo = {}) {
  return callPrintAgent("/print/receipt", {
    type: "receipt_a5",
    order: {
      order_code:          order.order_code || order.id,
      received_date:       order.received_date || order.created,
      customer_name:       order.customer_name || "",
      customer_phone:      order.customer_phone || "",
      device_name:         order.device_name || order.device_model || "",
      device_model:        order.device_model || "",
      imei:                order.imei || "",
      passcode:            order.passcode || "",
      issue_description:   order.issue_description || "",
      estimated_cost:      order.estimated_cost || 0,
      deposit:             order.deposit || 0,
      estimated_done_date: order.estimated_done_date || "",
      assigned_to_name:    order.assigned_to_name || "",
      warranty_days:       order.warranty_days || 0,
    },
    shop: {
      name:          shopInfo.shop_name || "Hoàng Khánh Mobile",
      phone:         shopInfo.shop_phone || "",
      address:       shopInfo.shop_address || "",
      warranty_note: shopInfo.warranty_note || "",
    },
  });
}

export async function printBillA5(order, parts = [], shopInfo = {}) {
  const remaining = Math.max(0, (order.final_cost || order.estimated_cost || 0) - (order.deposit || 0));
  const vietqrUrl = shopInfo.bank_account && shopInfo.bank_name
    ? `https://img.vietqr.io/image/${shopInfo.bank_name}-${shopInfo.bank_account}-compact2.png?amount=${remaining}&addInfo=${encodeURIComponent("HK " + (order.order_code || order.id))}&accountName=${encodeURIComponent(shopInfo.shop_name || "Hoang Khanh")}`
    : null;

  return callPrintAgent("/print/bill", {
    type: "bill_a5",
    order: {
      order_code:     order.order_code || order.id,
      done_date:      order.done_date || new Date().toISOString(),
      customer_name:  order.customer_name || "",
      customer_phone: order.customer_phone || "",
      device_model:   order.device_model || order.device_name || "",
      final_cost:     order.final_cost || order.estimated_cost || 0,
      deposit:        order.deposit || 0,
      remaining,
      warranty_days:  order.warranty_days || 0,
      payment_method: order.payment_method || "Tiền mặt",
    },
    parts: (parts || []).map(p => ({
      part_name:   p.part_name || p.name || "",
      qty_used:    p.qty_used || 1,
      unit_price:  p.unit_price || 0,
      total_price: p.total_price || 0,
    })),
    vietqr_url: vietqrUrl,
    shop: {
      name:          shopInfo.shop_name || "Hoàng Khánh Mobile",
      phone:         shopInfo.shop_phone || "",
      address:       shopInfo.shop_address || "",
      warranty_note: shopInfo.warranty_note || "",
    },
  });
}

export function previewBill(order, parts = [], shopInfo = {}) {
  const remaining = Math.max(0, (order.final_cost || order.estimated_cost || 0) - (order.deposit || 0));
  const vietqrUrl = shopInfo.bank_account && shopInfo.bank_name
    ? `https://img.vietqr.io/image/${shopInfo.bank_name}-${shopInfo.bank_account}-compact2.png?amount=${remaining}&addInfo=${encodeURIComponent("HK " + (order.order_code || order.id))}&accountName=${encodeURIComponent(shopInfo.shop_name || "")}`
    : null;

  const partsHTML = (parts || []).filter(p => p.qty_used > 0).map(p =>
    `<tr><td>${p.part_name || ""}</td><td style="text-align:right">${p.qty_used}</td><td style="text-align:right">${Number(p.unit_price || 0).toLocaleString("vi-VN")}đ</td><td style="text-align:right">${Number(p.total_price || 0).toLocaleString("vi-VN")}đ</td></tr>`
  ).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bill ${order.order_code || order.id}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:13px;padding:20px;max-width:500px;margin:0 auto}
    h2{text-align:center;margin:0;font-size:16px}
    .center{text-align:center}
    .sep{border-top:1px dashed #999;margin:8px 0}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#f3f4f6;padding:6px;text-align:left}
    td{padding:5px 6px;border-bottom:1px solid #f0f0f0}
    .total{font-weight:bold;font-size:14px}
    .qr{text-align:center;margin-top:12px}
    .qr img{width:150px;height:150px}
    @media print{body{padding:0}}
  </style>
  </head><body>
  <h2>${shopInfo.shop_name || "Hoàng Khánh Mobile"}</h2>
  <p class="center" style="margin:4px 0;font-size:12px">${shopInfo.shop_phone || ""} | ${shopInfo.shop_address || ""}</p>
  <p class="center" style="font-weight:bold;font-size:15px;margin:8px 0">HÓA ĐƠN THANH TOÁN</p>
  <div class="sep"></div>
  <p><b>Mã phiếu:</b> ${order.order_code || order.id}</p>
  <p><b>Khách hàng:</b> ${order.customer_name || ""} — ${order.customer_phone || ""}</p>
  <p><b>Thiết bị:</b> ${order.device_model || order.device_name || ""}</p>
  <p><b>Ngày:</b> ${new Date().toLocaleDateString("vi-VN")}</p>
  <div class="sep"></div>
  ${partsHTML ? `<p><b>Linh kiện đã dùng:</b></p><table><tr><th>Tên LK</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>${partsHTML}</table>` : ""}
  <div class="sep"></div>
  <p class="total">Tổng tiền: ${Number(order.final_cost || order.estimated_cost || 0).toLocaleString("vi-VN")}đ</p>
  <p>Đã cọc: ${Number(order.deposit || 0).toLocaleString("vi-VN")}đ</p>
  <p class="total" style="color:#dc2626">Còn lại: ${Number(remaining).toLocaleString("vi-VN")}đ</p>
  <p><b>Hình thức:</b> ${order.payment_method || "Tiền mặt"}</p>
  ${vietqrUrl ? `<div class="qr"><p style="font-weight:bold;margin-bottom:4px">Quét QR để chuyển khoản:</p><img src="${vietqrUrl}" onerror="this.style.display='none'"/></div>` : ""}
  <div class="sep"></div>
  <p class="center" style="font-size:11px">Bảo hành: ${order.warranty_days || 0} ngày | ${shopInfo.warranty_note || ""}</p>
  <p class="center" style="font-size:11px">Cảm ơn quý khách!</p>
  <script>window.onload=()=>window.print()</script>
  </body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  window.open(URL.createObjectURL(blob), "_blank");
}
