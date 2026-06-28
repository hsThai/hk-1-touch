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


/**
 * Tự động load shopInfo từ PocketBase app_settings
 * Fallback về thông tin mặc định nếu chưa cài đặt
 */
async function loadShopInfo() {
  try {
    const pbUrl = localStorage.getItem("pb_url") || "https://pb.hk1touch.online";
    const res = await fetch(`${pbUrl}/api/collections/app_settings/records?perPage=200`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error("settings fetch failed");
    const data = await res.json();
    const map  = {};
    (data.items || []).forEach(r => { map[r.key] = r.value; });
    return {
      shop_name:     map.shop_name     || "Hoàng Khánh Mobile",
      shop_phone:    map.shop_phone    || "",
      shop_address:  map.shop_address  || "",
      warranty_note: map.warranty_note || "",
      bank_name:     map.bank_name     || "",
      bank_account:  map.bank_account  || "",
      bank_holder:   map.bank_holder   || "",
    };
  } catch {
    return {
      shop_name:     "Hoàng Khánh Mobile",
      shop_phone:    "",
      shop_address:  "",
      warranty_note: "",
      bank_name:     "",
      bank_account:  "",
      bank_holder:   "",
    };
  }
}

/**
 * Load HTML template từ app_settings.
 * Nếu chưa customize → trả về defaultHtml (template gốc).
 * Nếu bị disabled (tắt) → trả về null.
 */
async function loadTemplate(key, defaultHtml) {
  try {
    const pbUrl = localStorage.getItem("pb_url") || "https://pb.hk1touch.online";
    const res = await fetch(
      `${pbUrl}/api/collections/app_settings/records?filter=(key%3D'print_tpl_${key}'%20||%20key%3D'print_tpl_${key}_disabled')&perPage=5`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return defaultHtml;
    const data = await res.json();
    const map  = {};
    (data.items || []).forEach(r => { map[r.key] = r.value; });
    if (map[`print_tpl_${key}_disabled`] === "1") return null;
    if (map[`print_tpl_${key}`]) return map[`print_tpl_${key}`];
    return defaultHtml;
  } catch {
    return defaultHtml;
  }
}

export async function printReceiptA5(order, shopInfo = null) {
  if (!shopInfo || Object.keys(shopInfo).length === 0) { shopInfo = await loadShopInfo(); }
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

export async function printBillA5(order, parts = [], shopInfo = null) {
  if (!shopInfo || Object.keys(shopInfo).length === 0) { shopInfo = await loadShopInfo(); }
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

export async function previewBill(order, parts = [], shopInfo = {}) {
  if (!shopInfo || !shopInfo.shop_name) shopInfo = await loadShopInfo();
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

  const finalHtml = await loadTemplate("bill", html);
  if (!finalHtml) { alert("Mẫu hóa đơn SC đã bị tắt."); return; }
  const blob = new Blob([finalHtml], { type: "text/html" });
  window.open(URL.createObjectURL(blob), "_blank");
}

/**
 * In hóa đơn bán lẻ A5 qua Print Agent, fallback sang previewSaleReceipt
 */
export async function printSaleReceiptA5(saleOrder, shopInfo = null) {
  if (!shopInfo || Object.keys(shopInfo).length === 0) { shopInfo = await loadShopInfo(); }
  try {
    return await callPrintAgent("/print/sale-receipt", {
      type: "sale_receipt_a5",
      order: {
        order_code:     saleOrder.order_code || "",
        created:        saleOrder.created || new Date().toISOString(),
        customer_name:  saleOrder.customer_name || "Khách lẻ",
        customer_phone: saleOrder.customer_phone || "",
        cashier_name:   saleOrder.cashier_name || "",
        payment_method: saleOrder.payment_method || "cash",
        subtotal:       saleOrder.subtotal || 0,
        discount:       saleOrder.discount || 0,
        total:          saleOrder.total || 0,
        items:          saleOrder.items || [],
      },
      shop: {
        name:    shopInfo.shop_name    || "Hoàng Khánh Mobile",
        phone:   shopInfo.shop_phone   || "",
        address: shopInfo.shop_address || "",
      },
    });
  } catch (e) {
    previewSaleReceipt(saleOrder, shopInfo);
    throw e;
  }
}

/**
 * Preview hóa đơn bán lẻ trong tab mới (fallback)
 */
export async function previewSaleReceipt(saleOrder, shopInfo = {}) {
  if (!shopInfo || !shopInfo.shop_name) shopInfo = await loadShopInfo();
  const fmtMoney = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";
  const fmtDate  = (s) => s ? new Date(s).toLocaleString("vi-VN", { hour12: false }) : "";
  const PM_LABELS = { cash:"Tiền mặt", transfer:"Chuyển khoản", combo:"Kết hợp", credit:"Bán chịu" };

  const itemsHTML = (saleOrder.items || []).map(it =>
    `<tr>
      <td>${it.part_name || it.name || ""}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">${fmtMoney(it.unit_price)}</td>
      <td style="text-align:right;font-weight:bold">${fmtMoney(it.total_price)}</td>
    </tr>`
  ).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>HĐ Bán lẻ ${saleOrder.order_code || ""}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;padding:16px;max-width:148mm;margin:0 auto;color:#111}
    h2{text-align:center;font-size:15px;margin-bottom:2px}
    .sub{text-align:center;font-size:11px;color:#555;margin-bottom:8px}
    .title{text-align:center;font-weight:bold;font-size:14px;letter-spacing:1px;margin:8px 0}
    .sep{border:none;border-top:1px dashed #999;margin:8px 0}
    .row{display:flex;justify-content:space-between;margin:3px 0;font-size:12px}
    table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0}
    th{background:#f3f4f6;padding:5px 8px;text-align:left;font-size:11px;border-bottom:1px solid #e5e7eb}
    td{padding:5px 8px;border-bottom:1px solid #f5f5f5}
    .total-row{font-weight:bold;font-size:13px}
    .final{font-size:15px;font-weight:bold;color:#059669}
    .footer{text-align:center;font-size:11px;color:#666;margin-top:10px}
    @media print{body{padding:4px}}
  </style>
  </head><body>
  <h2>${shopInfo.shop_name || "HOÀNG KHÁNH MOBILE"}</h2>
  <div class="sub">${[shopInfo.shop_phone, shopInfo.shop_address].filter(Boolean).join(" | ")}</div>
  <div class="title">─── HÓA ĐƠN BÁN HÀNG ───</div>
  <hr class="sep"/>
  <div class="row"><span>Mã đơn:</span><span><b>${saleOrder.order_code || ""}</b></span></div>
  <div class="row"><span>Ngày bán:</span><span>${fmtDate(saleOrder.created || saleOrder.created_date)}</span></div>
  <div class="row"><span>Thu ngân:</span><span>${saleOrder.cashier_name || "—"}</span></div>
  <div class="row"><span>Khách hàng:</span><span>${saleOrder.customer_name || "Khách lẻ"}${saleOrder.customer_phone ? " — " + saleOrder.customer_phone : ""}</span></div>
  <div class="row"><span>HTTT:</span><span>${PM_LABELS[saleOrder.payment_method] || saleOrder.payment_method || "Tiền mặt"}</span></div>
  <hr class="sep"/>
  <table>
    <thead><tr>
      <th>Sản phẩm</th>
      <th style="text-align:center">SL</th>
      <th style="text-align:right">Đ.Giá</th>
      <th style="text-align:right">T.Tiền</th>
    </tr></thead>
    <tbody>${itemsHTML}</tbody>
  </table>
  <hr class="sep"/>
  ${(saleOrder.subtotal && saleOrder.subtotal !== saleOrder.total)
    ? `<div class="row"><span>Tạm tính:</span><span>${fmtMoney(saleOrder.subtotal)}</span></div>` : ""}
  ${(saleOrder.discount > 0)
    ? `<div class="row" style="color:#dc2626"><span>Giảm giá:</span><span>-${fmtMoney(saleOrder.discount)}</span></div>` : ""}
  <div class="row total-row"><span>TỔNG THANH TOÁN:</span><span class="final">${fmtMoney(saleOrder.total)}</span></div>
  <hr class="sep"/>
  <div class="footer">Cảm ơn quý khách! Hẹn gặp lại 🙏</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
  </body></html>`;

  const finalHtml = await loadTemplate("sale_receipt", html);
  if (!finalHtml) { alert("Mẫu hóa đơn bán lẻ đã bị tắt."); return; }
  const blob = new Blob([finalHtml], { type: "text/html" });
  window.open(URL.createObjectURL(blob), "_blank");
}

/**
 * Preview tem bảo hành 50×30mm
 */
export async function previewWarrantyLabel(order, shopInfo = {}) {
  if (!shopInfo || !shopInfo.shop_name) shopInfo = await loadShopInfo();
  const expireDate = new Date();
  expireDate.setDate(expireDate.getDate() + (order.warranty_days || 30));
  const fmtDate = (d) => d.toLocaleDateString("vi-VN");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Tem BH ${order.order_code}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:50mm;height:30mm;font-family:Arial,sans-serif;font-size:9px;overflow:hidden;padding:2mm}
    .shop{font-weight:bold;font-size:10px;margin-bottom:1mm}
    .code{font-size:11px;font-weight:bold;color:#1e1b4b;margin-bottom:1mm}
    .row{display:flex;justify-content:space-between;font-size:8px;margin-bottom:0.5mm}
    .bh{font-size:8px;color:#dc2626;font-weight:bold}
    @media print{@page{size:50mm 30mm;margin:0}body{padding:2mm}}
  </style>
  </head><body>
  <div class="shop">${shopInfo.shop_name || "HK Mobile"}</div>
  <div class="code">${order.order_code || order.id}</div>
  <div class="row"><span>${order.customer_name || ""}</span></div>
  <div class="row"><span>${order.device_model || order.device_name || ""}</span></div>
  <div class="bh">BH: ${fmtDate(new Date())} → ${fmtDate(expireDate)} (${order.warranty_days || 30}N)</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
  </body></html>`;

  const finalHtml = await loadTemplate("warranty", html);
  if (!finalHtml) { alert("Mẫu tem bảo hành đã bị tắt."); return; }
  const blob = new Blob([finalHtml], { type: "text/html" });
  window.open(URL.createObjectURL(blob), "_blank");
}

/**
 * Preview tem mã vạch linh kiện 50×25mm
 */
export async function previewSparePartLabel(part, qty = 1) {
  const labels = Array.from({ length: qty }, (_, i) => `
    <div class="label">
      <div class="name">${part.name || ""}</div>
      <div class="sku">SKU: ${part.sku || "—"}</div>
      <div class="row">
        <span class="price">${Number(part.price || 0).toLocaleString("vi-VN")}đ</span>
        <span class="wh">${part.warehouse_name || ""}</span>
      </div>
    </div>
  `).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Tem LK</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:#fff}
    .label{width:50mm;height:25mm;border:0.5px solid #ccc;padding:2mm;display:inline-block;
      page-break-after:always;vertical-align:top;overflow:hidden}
    .name{font-size:9px;font-weight:bold;line-height:1.3;margin-bottom:1mm;
      overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .sku{font-size:9px;font-weight:bold;color:#4f46e5;margin-bottom:1mm;letter-spacing:0.5px}
    .row{display:flex;justify-content:space-between;align-items:flex-end}
    .price{font-size:10px;font-weight:bold;color:#059669}
    .wh{font-size:8px;color:#9ca3af}
    @media print{@page{size:50mm 25mm;margin:0}body{padding:0}.label{border:none;page-break-after:always}}
  </style>
  </head><body>
  ${labels}
  <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
  </body></html>`;

  const finalHtml = await loadTemplate("spare_label", html);
  if (!finalHtml) { alert("Mẫu tem linh kiện đã bị tắt."); return; }
  const blob = new Blob([finalHtml], { type: "text/html" });
  window.open(URL.createObjectURL(blob), "_blank");
}

/**
 * Trả về HTML mặc định của từng template key (không fetch PocketBase).
 * Dùng trong editor để hiển thị bản gốc khi chưa có bản custom.
 */
export function getDefaultTemplate(key, shopInfo = {}) {
  const shop = {
    shop_name:    shopInfo.shop_name    || "Hoàng Khánh Mobile",
    shop_phone:   shopInfo.shop_phone   || "0901 234 567",
    shop_address: shopInfo.shop_address || "",
    warranty_note:shopInfo.warranty_note|| "Bảo hành linh kiện 30 ngày",
    bank_name:    shopInfo.bank_name    || "",
    bank_account: shopInfo.bank_account || "",
  };
  const order = {
    order_code:"HK-250628-001", customer_name:"Nguyễn Văn A",
    customer_phone:"0901234567", device_model:"iPhone 13 Pro Max",
    final_cost:1500000, estimated_cost:1500000, deposit:300000,
    warranty_days:30, payment_method:"cash",
  };
  const saleOrder = {
    order_code:"BH-001", customer_name:"Trần Thị B",
    cashier_name:"Thu ngân Lan", payment_method:"transfer",
    subtotal:730000, discount:0, total:730000,
    items:[
      { part_name:"Cường lực iPhone 15", qty:1, unit_price:150000, total_price:150000 },
      { part_name:"Ốp lưng Samsung A55", qty:1, unit_price:180000, total_price:180000 },
    ],
  };

  if (key === "bill") {
    const remaining = Math.max(0, order.final_cost - order.deposit);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bill ${order.order_code}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:13px;padding:20px;max-width:500px;margin:0 auto}
    h2{text-align:center;margin:0;font-size:16px}
    .center{text-align:center}
    .sep{border-top:1px dashed #999;margin:8px 0}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#f3f4f6;padding:6px;text-align:left}
    td{padding:5px 6px;border-bottom:1px solid #f0f0f0}
    .total{font-weight:bold;font-size:14px}
    @media print{body{padding:0}}
  </style>
  </head><body>
  <h2>${shop.shop_name}</h2>
  <p class="center" style="margin:4px 0;font-size:12px">${shop.shop_phone} | ${shop.shop_address}</p>
  <p class="center" style="font-weight:bold;font-size:15px;margin:8px 0">HÓA ĐƠN THANH TOÁN</p>
  <div class="sep"></div>
  <p><b>Mã phiếu:</b> ${order.order_code}</p>
  <p><b>Khách hàng:</b> ${order.customer_name} — ${order.customer_phone}</p>
  <p><b>Thiết bị:</b> ${order.device_model}</p>
  <p><b>Ngày:</b> ${new Date().toLocaleDateString("vi-VN")}</p>
  <div class="sep"></div>
  <p class="total">Tổng tiền: ${order.final_cost.toLocaleString("vi-VN")}đ</p>
  <p>Đã cọc: ${order.deposit.toLocaleString("vi-VN")}đ</p>
  <p class="total" style="color:#dc2626">Còn lại: ${remaining.toLocaleString("vi-VN")}đ</p>
  <p class="center" style="font-size:11px">Bảo hành: ${order.warranty_days} ngày | ${shop.warranty_note}</p>
  <p class="center" style="font-size:11px">Cảm ơn quý khách!</p>
  </body></html>`;
  }

  if (key === "sale_receipt") {
    const fmtMoney = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";
    const itemsHTML = saleOrder.items.map(it =>
      `<tr><td>${it.part_name}</td><td style="text-align:center">${it.qty}</td>` +
      `<td style="text-align:right">${fmtMoney(it.unit_price)}</td>` +
      `<td style="text-align:right;font-weight:bold">${fmtMoney(it.total_price)}</td></tr>`
    ).join("");
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>HĐ Bán lẻ ${saleOrder.order_code}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;padding:16px;max-width:148mm;margin:0 auto;color:#111}
    h2{text-align:center;font-size:15px;margin-bottom:2px}
    .sub{text-align:center;font-size:11px;color:#555;margin-bottom:8px}
    .title{text-align:center;font-weight:bold;font-size:14px;letter-spacing:1px;margin:8px 0}
    .sep{border:none;border-top:1px dashed #999;margin:8px 0}
    .row{display:flex;justify-content:space-between;margin:3px 0;font-size:12px}
    table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0}
    th{background:#f3f4f6;padding:5px 8px;text-align:left;font-size:11px}
    td{padding:5px 8px;border-bottom:1px solid #f5f5f5}
    .final{font-size:15px;font-weight:bold;color:#059669}
    .footer{text-align:center;font-size:11px;color:#666;margin-top:10px}
    @media print{body{padding:4px}}
  </style>
  </head><body>
  <h2>${shop.shop_name}</h2>
  <div class="sub">${shop.shop_phone} | ${shop.shop_address}</div>
  <div class="title">─── HÓA ĐƠN BÁN HÀNG ───</div>
  <hr class="sep"/>
  <div class="row"><span>Mã đơn:</span><span><b>${saleOrder.order_code}</b></span></div>
  <div class="row"><span>Thu ngân:</span><span>${saleOrder.cashier_name}</span></div>
  <div class="row"><span>Khách hàng:</span><span>${saleOrder.customer_name}</span></div>
  <hr class="sep"/>
  <table><thead><tr><th>Sản phẩm</th><th>SL</th><th>Đ.Giá</th><th>T.Tiền</th></tr></thead>
  <tbody>${itemsHTML}</tbody></table>
  <hr class="sep"/>
  <div class="row" style="font-weight:bold;font-size:14px"><span>TỔNG:</span><span class="final">${fmtMoney(saleOrder.total)}</span></div>
  <hr class="sep"/>
  <div class="footer">Cảm ơn quý khách! 🙏</div>
  </body></html>`;
  }

  if (key === "warranty") {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + order.warranty_days);
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Tem BH ${order.order_code}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:50mm;height:30mm;font-family:Arial,sans-serif;font-size:9px;overflow:hidden;padding:2mm}
    .shop{font-weight:bold;font-size:10px;margin-bottom:1mm}
    .code{font-size:11px;font-weight:bold;color:#1e1b4b;margin-bottom:1mm}
    .row{display:flex;justify-content:space-between;font-size:8px;margin-bottom:0.5mm}
    .bh{font-size:8px;color:#dc2626;font-weight:bold}
    @media print{@page{size:50mm 30mm;margin:0}body{padding:2mm}}
  </style>
  </head><body>
  <div class="shop">${shop.shop_name}</div>
  <div class="code">${order.order_code}</div>
  <div class="row"><span>${order.customer_name}</span></div>
  <div class="row"><span>${order.device_model}</span></div>
  <div class="bh">BH: ${new Date().toLocaleDateString("vi-VN")} → ${expDate.toLocaleDateString("vi-VN")} (${order.warranty_days}N)</div>
  </body></html>`;
  }

  if (key === "spare_label") {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Tem LK</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:#fff}
    .label{width:50mm;height:25mm;border:0.5px solid #ccc;padding:2mm;display:inline-block;overflow:hidden}
    .name{font-size:9px;font-weight:bold;line-height:1.3;margin-bottom:1mm}
    .sku{font-size:9px;font-weight:bold;color:#4f46e5;margin-bottom:1mm}
    .row{display:flex;justify-content:space-between;align-items:flex-end}
    .price{font-size:10px;font-weight:bold;color:#059669}
    .wh{font-size:8px;color:#9ca3af}
    @media print{@page{size:50mm 25mm;margin:0}body{padding:0}.label{border:none}}
  </style>
  </head><body>
  <div class="label">
    <div class="name">Màn hình iPhone 13 Pro Max</div>
    <div class="sku">SKU: SCRN-IP13-001</div>
    <div class="row"><span class="price">950.000đ</span><span class="wh">Kho 1</span></div>
  </div>
  </body></html>`;
  }

  return "";
}
