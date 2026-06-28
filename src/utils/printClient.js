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

/**
 * Phiếu tiếp nhận máy — in khi nhận máy từ khách
 * Bao gồm: tình trạng ngoại quan QT1, báo giá linh kiện, ký xác nhận
 */
export async function previewReceiptForm(order, quotedParts = [], shopInfo = {}) {
  if (!shopInfo || !shopInfo.shop_name) shopInfo = await loadShopInfo();

  const QT1_LABELS = {
    vien_cong_mop:    "Viền cong / móp",
    can_mop_goc:      "Cấn móp góc",
    vo_kinh_man:      "Vỡ kính màn hình",
    vo_kinh_lung:     "Vỡ kính lưng",
    tray_xuoc_nhe:    "Trầy xước nhẹ",
    cam_ung_loi:      "Cảm ứng lỗi",
    cam_ung_delay:    "Cảm ứng đa điểm delay",
    faceid_touch_loi: "FaceID / Touch lỗi",
    camera:           "Camera trước / sau",
    loa_mic:          "Loa / Mic & thoại / video",
    wifi_bt:          "Wifi / Bluetooth",
  };

  // Parse qt1_checklist JSON
  let qt1 = {};
  try { qt1 = JSON.parse(order.qt1_checklist || "{}"); } catch {}
  const qt1Items = Object.entries(QT1_LABELS).map(([key, label]) => ({
    key, label,
    checked: qt1[key]?.checked || false,
    note:    qt1[key]?.note    || "",
  }));

  const fmtDt = (s) => s ? new Date(s).toLocaleString("vi-VN",{
    hour12:false,day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"
  }) : "—";
  const fmtMoney = (n) => Number(n||0).toLocaleString("vi-VN");

  // Chỉ lấy các mục đã được đánh dấu CÓ LỖI
  const checkedItems = qt1Items.filter(it => it.checked);
  const checklistInline = checkedItems.length > 0
    ? checkedItems.map(it =>
        `<span style="display:inline-block;background:#fff0f0;border:1px solid #fca5a5;border-radius:16px;
          padding:2px 10px;margin:2px 3px;font-size:12px;color:#991b1b;font-weight:600">`
        + it.label
        + (it.note ? ` <span style="font-size:10px;font-weight:400;color:#b91c1c">→ ${it.note}</span>` : "")
        + `</span>`
      ).join("")
    : `<span style="font-size:12px;color:#6b7280;font-style:italic">Không phát hiện lỗi ngoại quan</span>`;

  // Bảng báo giá linh kiện
  const quotedTotal = (quotedParts||[]).reduce((s,p) => s + (p.total_price||p.unit_price||0), 0);
  const quotedHTML = (quotedParts && quotedParts.length > 0)
    ? quotedParts.map((p,i) => `
      <tr>
        <td class="c">${i+1}</td>
        <td>${p.part_name||p.name||""}</td>
        <td class="c">${p.qty_used||p.qty||1}</td>
        <td class="r">${fmtMoney(p.unit_price)}</td>
        <td class="r" style="font-weight:bold">${fmtMoney(p.total_price||p.unit_price)}</td>
      </tr>`).join("")
    : `<tr><td colspan="5" style="text-align:center;color:#aaa;font-style:italic;padding:8px">Chưa có báo giá linh kiện</td></tr>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>PHIEU TIEP NHAN ${order.order_code||order.id}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:"Times New Roman",Times,serif;font-size:13px;max-width:190mm;margin:0 auto;
       padding:8mm 7mm;color:#111;background:#fff;line-height:1.55}
  .title-shop{font-size:15px;font-weight:bold;text-align:center;text-transform:uppercase;letter-spacing:.5px}
  .sub-shop{font-size:11px;text-align:center;color:#444;margin-bottom:1px}
  .doc-title{font-size:18px;font-weight:bold;text-align:center;margin:8px 0 2px;letter-spacing:2px;
             text-transform:uppercase;text-decoration:underline}
  .doc-sub{text-align:center;font-size:11px;color:#888;margin-bottom:6px}
  .sep-solid{border:none;border-top:2px solid #111;margin:6px 0}
  .sep-dash{border:none;border-top:1px dashed #777;margin:5px 0}
  /* 2 cột info */
  .info-2col{display:grid;grid-template-columns:1fr 1fr;gap:2px 20px;margin:6px 0}
  .info-row{display:flex;font-size:12px;gap:4px;margin:1px 0}
  .lbl{color:#555;white-space:nowrap;min-width:92px}
  .val{font-weight:700;flex:1}
  /* Tiêu đề section */
  .section-title{font-size:12px;font-weight:bold;background:#222;color:#fff;
                 padding:4px 8px;margin:8px 0 4px;letter-spacing:.5px}
  /* Bảng */
  table{width:100%;border-collapse:collapse;font-size:12px}
  thead th{background:#f0f0f0;border:1px solid #ccc;padding:4px 5px;font-size:11px;font-weight:bold}
  thead th.r{text-align:right} thead th.c{text-align:center}
  tbody td{border:1px solid #ddd;padding:4px 5px;vertical-align:top}
  tbody td.r{text-align:right} tbody td.c{text-align:center}
  tfoot td{border:1px solid #ccc;padding:5px;font-weight:bold;background:#f9f9f9}
  tfoot td.r{text-align:right}
  /* Tổng giá trị */
  .price-block{margin:6px 0;font-size:12px}
  .price-row{display:flex;justify-content:space-between;padding:2px 0}
  .grand-row{display:flex;justify-content:space-between;font-size:14px;font-weight:bold;
              border-top:2px solid #111;border-bottom:2px solid #111;padding:5px 0;margin:4px 0}
  /* Ghi chú */
  .note-box{border:1px solid #ccc;border-radius:3px;padding:6px 8px;font-size:11px;
            color:#444;min-height:42px;margin:4px 0;background:#fafafa}
  /* Xác nhận */
  .confirm-box{border:1.5px solid #333;border-radius:4px;padding:8px 10px;margin:6px 0;font-size:12px;
               background:#fffbf0}
  /* Ký tên */
  .sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 32px;margin-top:16px}
  .sign-box{text-align:center;border-top:1.5px solid #333;padding-top:4px}
  .sign-title{font-size:12px;font-weight:bold;margin-bottom:1px}
  .sign-note{font-size:10px;color:#777;font-style:italic;margin-bottom:48px}
  .sign-name{font-size:11px;font-style:italic;color:#666;border-top:1px dashed #ccc;
             padding-top:3px;margin-top:4px}
  .terms{font-size:10px;color:#666;margin-top:8px;line-height:1.7;
         border:1px dashed #ccc;padding:5px 8px;border-radius:3px;background:#fafafa}
  @media print{@page{size:A5 portrait;margin:6mm}body{padding:0}}
</style>
</head><body>

<!-- ══ HEADER ══ -->
<div class="title-shop">${shopInfo.shop_name||"HOÀNG KHÁNH MOBILE"}</div>
${shopInfo.shop_address?`<div class="sub-shop">📍 ${shopInfo.shop_address}</div>`:""}
${shopInfo.shop_phone  ?`<div class="sub-shop">📞 ${shopInfo.shop_phone}</div>`:""}
<hr class="sep-solid"/>
<div class="doc-title">Phiếu tiếp nhận máy</div>
<div class="doc-sub">Phiếu này là bằng chứng bàn giao thiết bị giữa khách hàng và cửa hàng</div>
<hr class="sep-dash"/>

<!-- ══ THÔNG TIN ĐƠN ══ -->
<div class="info-2col">
  <div>
    <div class="info-row"><span class="lbl">Mã phiếu:</span>
      <span class="val" style="font-size:15px;font-weight:900;border:2px solid #111;padding:0 6px">${order.order_code||order.id}</span></div>
    <div class="info-row"><span class="lbl">Ngày tiếp nhận:</span>
      <span class="val">${fmtDt(order.received_date)}</span></div>
    <div class="info-row"><span class="lbl">Ngày hẹn trả:</span>
      <span class="val" style="color:#dc2626;font-weight:900">${fmtDt(order.estimated_done_date)}</span></div>
    <div class="info-row"><span class="lbl">Nhân viên TN:</span>
      <span class="val">${order.assigned_to_name||"—"}</span></div>
  </div>
  <div>
    <div class="info-row"><span class="lbl">Khách hàng:</span><span class="val">${order.customer_name||"—"}</span></div>
    <div class="info-row"><span class="lbl">Số điện thoại:</span><span class="val">${order.customer_phone||"—"}</span></div>
    <div class="info-row"><span class="lbl">Thiết bị:</span><span class="val">${order.device_name||order.device_model||"—"}</span></div>
    <div class="info-row"><span class="lbl">Model:</span><span class="val">${order.device_model||"—"}</span></div>
    ${order.imei?`<div class="info-row"><span class="lbl">IMEI/SN:</span><span class="val">${order.imei}</span></div>`:""}
    ${order.passcode?`<div class="info-row"><span class="lbl">Mật khẩu MK:</span><span class="val">${order.passcode}</span></div>`:""}
  </div>
</div>
<div class="info-row" style="font-size:12px;margin:3px 0">
  <span class="lbl">Lỗi / Yêu cầu:</span>
  <span class="val" style="font-style:italic">${order.issue_description||"—"}</span>
</div>
<hr class="sep-dash"/>

<!-- ══ TÌNH TRẠNG NGOẠI QUAN KHI TIẾP NHẬN ══ -->
<div class="section-title">🔍 TÌNH TRẠNG NGOẠI QUAN KHI TIẾP NHẬN (QT1)</div>
<div style="padding:6px 4px;line-height:1.9">
  ${checklistInline}
</div>
${order.qt1_note?`
<div style="font-size:11px;font-weight:bold;margin:5px 0 2px">📝 Ghi chú ngoại quan:</div>
<div class="note-box">${order.qt1_note}</div>`:""}

<hr class="sep-dash"/>

<!-- ══ BÁO GIÁ LINH KIỆN / DỊCH VỤ ══ -->
<div class="section-title">💰 BÁO GIÁ LINH KIỆN / DỊCH VỤ DỰ KIẾN</div>
<table>
  <thead><tr>
    <th class="c" style="width:30px">#</th>
    <th>Tên linh kiện / Dịch vụ</th>
    <th class="c" style="width:40px">SL</th>
    <th class="r" style="width:110px">Đơn giá (đ)</th>
    <th class="r" style="width:120px">Thành tiền (đ)</th>
  </tr></thead>
  <tbody>${quotedHTML}</tbody>
  ${quotedParts&&quotedParts.length>0?`
  <tfoot><tr>
    <td colspan="4" class="r">Chi phí dự kiến:</td>
    <td class="r">${fmtMoney(order.estimated_cost||quotedTotal)}</td>
  </tr></tfoot>`:""}
</table>
${order.deposit>0?`
<div class="price-row" style="font-size:12px;margin-top:4px">
  <span>💵 Đặt cọc ban đầu:</span>
  <span style="font-weight:bold;color:#059669">${fmtMoney(order.deposit)} đ</span>
</div>`:""}
<div class="price-row" style="font-size:12px">
  <span>📋 Chi phí ước tính còn lại:</span>
  <span style="font-weight:bold;color:#dc2626">${fmtMoney(Math.max(0,(order.estimated_cost||0)-(order.deposit||0)))} đ</span>
</div>

<hr class="sep-dash"/>

<!-- ══ XÁC NHẬN KHÁCH HÀNG ══ -->
<div class="confirm-box">
  <div style="font-weight:bold;margin-bottom:4px;font-size:12px">✅ XÁC NHẬN CỦA KHÁCH HÀNG</div>
  <div style="font-size:11px;line-height:1.7">
    Tôi xác nhận đã bàn giao thiết bị với tình trạng ngoại quan như trên và đồng ý với mức báo giá dự kiến.
    Cửa hàng sẽ liên hệ xác nhận trước khi tiến hành sửa chữa nếu phát sinh thêm chi phí.
    Phí kiểm tra máy không được hoàn lại trong mọi trường hợp.
  </div>
</div>

<!-- ══ ĐIỀU KHOẢN ══ -->
<div class="terms">
  ⚠️ <b>Điều khoản bảo quản:</b>
  (1) Cửa hàng chịu trách nhiệm bảo quản thiết bị trong thời gian sửa chữa.
  (2) Máy không lấy sau <b>30 ngày</b> kể từ ngày hẹn trả, cửa hàng không chịu trách nhiệm.
  (3) Bảo hành linh kiện <b>${order.warranty_days||30} ngày</b> kể từ ngày giao máy.
  (4) Vui lòng mang phiếu này khi đến lấy máy.${shopInfo.warranty_note?" (5) "+shopInfo.warranty_note:""}
</div>

<!-- ══ KÝ TÊN ══ -->
<div class="sign-grid" style="margin-top:20px">
  <div class="sign-box">
    <div class="sign-title">KHÁCH HÀNG</div>
    <div class="sign-note">(Ký và ghi rõ họ tên)</div>
    <div class="sign-name">${order.customer_name||""}</div>
  </div>
  <div class="sign-box">
    <div class="sign-title">NHÂN VIÊN TIẾP NHẬN</div>
    <div class="sign-note">(Ký và ghi rõ họ tên)</div>
    <div class="sign-name">${order.assigned_to_name||""}</div>
  </div>
</div>

<script>window.onload=()=>window.print()</script>
</body></html>`;

  const finalHtml = await loadTemplate("receipt_form", html);
  if (!finalHtml) { alert("Mẫu phiếu tiếp nhận đã bị tắt."); return; }
  const blob = new Blob([finalHtml], { type:"text/html" });
  window.open(URL.createObjectURL(blob), "_blank");
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

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>HOA DON SC ${order.order_code||order.id}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:"Times New Roman",Times,serif;font-size:13px;max-width:148mm;margin:0 auto;
       padding:6mm 5mm;color:#111;background:#fff;line-height:1.55}
  .title-shop{font-size:15px;font-weight:bold;text-align:center;text-transform:uppercase;letter-spacing:.5px}
  .sub-shop{font-size:11px;text-align:center;color:#555;margin-bottom:1px}
  .doc-title{font-size:16px;font-weight:bold;text-align:center;margin:7px 0 2px;
             letter-spacing:1.5px;text-transform:uppercase}
  .doc-deco{text-align:center;font-size:13px;color:#333;letter-spacing:2px;margin-bottom:5px}
  .sep-solid{border:none;border-top:1.5px solid #111;margin:5px 0}
  .sep-dash{border:none;border-top:1px dashed #777;margin:4px 0}
  .meta{display:flex;justify-content:space-between;font-size:12px;margin:2px 0}
  .meta span:last-child{font-weight:700;text-align:right}
  .highlight-box{border:1.5px solid #111;display:inline-block;padding:1px 7px;
                 font-weight:900;font-size:13px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin:5px 0}
  thead th{background:#222;color:#fff;padding:4px 4px;text-align:left;font-size:11px;font-weight:bold}
  thead th.r{text-align:right} thead th.c{text-align:center}
  tbody tr:nth-child(even){background:#f9f9f9}
  tbody td{padding:5px 4px;border-bottom:1px dashed #e0e0e0;font-size:12px;vertical-align:top}
  tbody td.r{text-align:right} tbody td.c{text-align:center}
  .total-row{display:flex;justify-content:space-between;font-size:12px;padding:2px 0}
  .grand-row{display:flex;justify-content:space-between;font-size:15px;font-weight:bold;
             border-top:2px solid #111;border-bottom:2px solid #111;padding:5px 0;margin:4px 0}
  .remain-row{display:flex;justify-content:space-between;font-size:14px;font-weight:bold;
              color:#dc2626;padding:3px 0}
  .grand-val{color:#000}
  .qr-block{text-align:center;margin-top:7px}
  .qr-block img{width:110px;height:110px}
  .qr-note{font-size:10px;color:#888;margin-top:2px;font-style:italic}
  .footer{text-align:center;font-size:11px;color:#555;margin-top:7px;
          border-top:1px dashed #aaa;padding-top:5px}
  @media print{@page{size:A5 portrait;margin:6mm}body{padding:0}}
</style>
</head><body>

  <!-- HEADER -->
  <div class="title-shop">${shopInfo.shop_name||"HOÀNG KHÁNH MOBILE"}</div>
  ${shopInfo.shop_address?`<div class="sub-shop">📍 ${shopInfo.shop_address}</div>`:""}
  ${shopInfo.shop_phone  ?`<div class="sub-shop">📞 ${shopInfo.shop_phone}</div>`:""}
  <hr class="sep-solid"/>
  <div class="doc-deco">───────────────</div>
  <div class="doc-title">Hóa đơn sửa chữa</div>
  <div class="doc-deco">───────────────</div>
  <hr class="sep-dash"/>

  <!-- THÔNG TIN ĐƠN -->
  <div class="meta">
    <span>Hóa đơn:</span>
    <span><span class="highlight-box">${order.order_code||order.id}</span></span>
  </div>
  <div class="meta"><span>Ngày:</span><span>${new Date().toLocaleDateString("vi-VN")}</span></div>
  <div class="meta"><span>Khách hàng:</span><span>${order.customer_name||"Khách lẻ"}${order.customer_phone?" — "+order.customer_phone:""}</span></div>
  <div class="meta"><span>Thiết bị:</span><span>${order.device_name||order.device_model||"—"}</span></div>
  ${order.imei?`<div class="meta"><span>IMEI/SN:</span><span>${order.imei}</span></div>`:""}
  ${order.issue_description?`<div class="meta"><span>Lỗi:</span><span style="font-style:italic">${order.issue_description}</span></div>`:""}
  <hr class="sep-dash"/>

  <!-- BẢNG LINH KIỆN / DỊCH VỤ -->
  <table>
    <thead><tr>
      <th style="width:4%">#</th>
      <th>Hạng mục / Linh kiện</th>
      <th class="c" style="width:10%">SL</th>
      <th class="r" style="width:22%">Đơn giá</th>
      <th class="r" style="width:22%">T.Tiền</th>
    </tr></thead>
    <tbody>
      ${(parts&&parts.length>0)
        ? parts.filter(p=>p.qty_used>0).map((p,i)=>
            `<tr>
              <td class="c">${i+1}</td>
              <td>${p.part_name||""}</td>
              <td class="c">${p.qty_used}</td>
              <td class="r">${Number(p.unit_price||0).toLocaleString("vi-VN")}</td>
              <td class="r" style="font-weight:bold">${Number(p.total_price||0).toLocaleString("vi-VN")}</td>
            </tr>`).join("")
        : `<tr>
            <td class="c">1</td>
            <td>Dịch vụ sửa chữa</td>
            <td class="c">1</td>
            <td class="r">${Number(order.final_cost||order.estimated_cost||0).toLocaleString("vi-VN")}</td>
            <td class="r" style="font-weight:bold">${Number(order.final_cost||order.estimated_cost||0).toLocaleString("vi-VN")}</td>
          </tr>`
      }
    </tbody>
  </table>
  <hr class="sep-dash"/>

  <!-- TỔNG TIỀN -->
  ${order.deposit>0?`<div class="total-row"><span>Đặt cọc trước:</span><span style="color:#059669">- ${Number(order.deposit||0).toLocaleString("vi-VN")} đ</span></div>`:""}
  <div class="grand-row"><span>TỔNG THANH TOÁN:</span><span class="grand-val">${Number(order.final_cost||order.estimated_cost||0).toLocaleString("vi-VN")} đ</span></div>
  ${remaining>0?`<div class="remain-row"><span>CÒN LẠI:</span><span>${Number(remaining).toLocaleString("vi-VN")} đ</span></div>`:""}

  <!-- QR CHUYỂN KHOẢN -->
  ${vietqrUrl?`
  <div class="qr-block">
    <div style="font-size:11px;font-weight:bold;margin-bottom:3px">Quét QR thanh toán</div>
    <img src="${vietqrUrl}" onerror="this.style.display='none'"/>
    <div class="qr-note">${shopInfo.bank_name||""} — ${shopInfo.bank_account||""}</div>
  </div>`:""}

  <div class="footer">
    ${shopInfo.warranty_note?`<div>🛡️ BH: ${shopInfo.warranty_note}</div>`:""}
    <div style="margin-top:3px">Cảm ơn quý khách! Hẹn gặp lại 🙏</div>
  </div>

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

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>PHIEU THANH TOAN ${saleOrder.order_code || ""}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:"Times New Roman",Times,serif;font-size:13px;max-width:80mm;margin:0 auto;padding:6mm 4mm;color:#111;background:#fff}
  .title-shop{font-size:14px;font-weight:bold;text-align:center;text-transform:uppercase;margin-bottom:2px}
  .sub-shop{font-size:11px;text-align:center;margin-bottom:2px}
  .doc-title{font-size:15px;font-weight:bold;text-align:center;margin:6px 0 4px;letter-spacing:1px;text-transform:uppercase}
  .sep-solid{border:none;border-top:1.5px solid #222;margin:5px 0}
  .sep-dash{border:none;border-top:1px dashed #555;margin:4px 0}
  .meta{font-size:12px;margin:2px 0;display:flex;justify-content:space-between}
  .meta span:last-child{font-weight:bold;text-align:right}
  table{width:100%;border-collapse:collapse;font-size:12px;margin:4px 0}
  thead th{border-bottom:1px solid #555;padding:3px 2px;text-align:left;font-size:11px;font-weight:bold;background:#f5f5f5}
  thead th.r{text-align:right} thead th.c{text-align:center}
  tbody td{padding:4px 2px;vertical-align:top;font-size:12px;border-bottom:1px dashed #e0e0e0}
  tbody td.r{text-align:right} tbody td.c{text-align:center}
  .total-row{display:flex;justify-content:space-between;font-size:12px;margin:2px 0}
  .grand-total{display:flex;justify-content:space-between;font-size:15px;font-weight:bold;margin:4px 0}
  .grand-val{color:#059669}
  .discount-row{display:flex;justify-content:space-between;font-size:12px;margin:2px 0;color:#dc2626}
  .footer{text-align:center;font-size:11px;color:#555;margin-top:8px;border-top:1px dashed #aaa;padding-top:5px}
  .highlight-box{border:1.5px solid #222;display:inline-block;padding:1px 6px;font-weight:bold;font-size:13px}
  @media print{@page{size:80mm auto;margin:0}body{padding:4mm 3mm}}
</style>
</head><body>
  <!-- HEADER -->
  <div class="title-shop">${shopInfo.shop_name || "HOÀNG KHÁNH MOBILE"}</div>
  ${shopInfo.shop_address ? `<div class="sub-shop">${shopInfo.shop_address}</div>` : ""}
  ${shopInfo.shop_phone   ? `<div class="sub-shop">ĐT: ${shopInfo.shop_phone}</div>` : ""}

  <div class="doc-title">─── Phiếu thanh toán ───</div>
  <hr class="sep-solid"/>

  <!-- THÔNG TIN ĐƠN -->
  <div class="meta"><span>Hóa đơn:</span><span class="highlight-box">${saleOrder.order_code || ""}</span></div>
  <div class="meta"><span>Ngày bán:</span><span>${fmtDate(saleOrder.created_date || saleOrder.created)}</span></div>
  ${saleOrder.cashier_name ? `<div class="meta"><span>Thu ngân:</span><span>${saleOrder.cashier_name}</span></div>` : ""}
  ${saleOrder.seller_name  ? `<div class="meta"><span>Người bán:</span><span>${saleOrder.seller_name}</span></div>` : ""}
  <div class="meta"><span>Khách hàng:</span><span>${saleOrder.customer_name || "Khách lẻ"}${saleOrder.customer_phone ? " — " + saleOrder.customer_phone : ""}</span></div>
  <div class="meta"><span>Thanh toán:</span><span>${PM_LABELS[saleOrder.payment_method] || saleOrder.payment_method || "Tiền mặt"}</span></div>
  <hr class="sep-dash"/>

  <!-- BẢNG SẢN PHẨM -->
  <table>
    <thead><tr>
      <th style="width:44%">Sản phẩm</th>
      <th class="c" style="width:10%">SL</th>
      <th class="r" style="width:22%">Đ.Giá</th>
      <th class="r" style="width:24%">T.Tiền</th>
    </tr></thead>
    <tbody>${itemsHTML}</tbody>
  </table>

  <hr class="sep-dash"/>

  <!-- TỔNG -->
  ${(saleOrder.subtotal && saleOrder.subtotal !== saleOrder.total)
    ? `<div class="total-row"><span>Tạm tính:</span><span>${fmtMoney(saleOrder.subtotal)}</span></div>` : ""}
  ${(saleOrder.discount > 0)
    ? `<div class="discount-row"><span>Giảm giá:</span><span>- ${fmtMoney(saleOrder.discount)}</span></div>` : ""}
  <div class="grand-total"><span>TỔNG:</span><span class="grand-val">${fmtMoney(saleOrder.total)}</span></div>
  ${saleOrder.amount_paid > 0 && saleOrder.amount_paid !== saleOrder.total
    ? `<div class="total-row"><span>Tiền khách đưa:</span><span>${fmtMoney(saleOrder.amount_paid)}</span></div>
       <div class="total-row"><span>Tiền thừa:</span><span>${fmtMoney((saleOrder.amount_paid||0)-(saleOrder.total||0))}</span></div>` : ""}

  <div class="footer">
    <div>Cảm ơn quý khách! Hẹn gặp lại 🙏</div>
  </div>
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

  if (key === "receipt_form") {
    const fmtDt = (s) => s ? new Date(s).toLocaleDateString("vi-VN") : new Date().toLocaleDateString("vi-VN");
    const fmtMoney = (n) => Number(n||0).toLocaleString("vi-VN");
    const QT1_ALL = [
      {key:"vien_cong_mop",label:"Viền cong / móp"},{key:"can_mop_goc",label:"Cấn móp góc"},
      {key:"vo_kinh_man",label:"Vỡ kính màn hình"},{key:"vo_kinh_lung",label:"Vỡ kính lưng"},
      {key:"tray_xuoc_nhe",label:"Trầy xước nhẹ"},{key:"cam_ung_loi",label:"Cảm ứng lỗi"},
      {key:"cam_ung_delay",label:"Cảm ứng đa điểm delay"},{key:"faceid_touch_loi",label:"FaceID / Touch lỗi"},
      {key:"camera",label:"Camera trước / sau"},{key:"loa_mic",label:"Loa / Mic & thoại"},
      {key:"wifi_bt",label:"Wifi / Bluetooth"},
    ];

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>PHIEU TIEP NHAN</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:"Times New Roman",Times,serif;font-size:13px;max-width:190mm;margin:0 auto;padding:8mm 7mm;color:#111;background:#fff;line-height:1.55}
  .title-shop{font-size:15px;font-weight:bold;text-align:center;text-transform:uppercase}
  .sub-shop{font-size:11px;text-align:center;color:#444;margin-bottom:1px}
  .doc-title{font-size:18px;font-weight:bold;text-align:center;margin:8px 0 2px;letter-spacing:2px;text-transform:uppercase;text-decoration:underline}
  .sep-solid{border:none;border-top:2px solid #111;margin:6px 0}
  .sep-dash{border:none;border-top:1px dashed #777;margin:5px 0}
  .info-2col{display:grid;grid-template-columns:1fr 1fr;gap:2px 20px;margin:6px 0}
  .info-row{display:flex;font-size:12px;gap:4px;margin:1px 0}
  .lbl{color:#555;white-space:nowrap;min-width:92px}.val{font-weight:700;flex:1}
  .section-title{font-size:12px;font-weight:bold;background:#222;color:#fff;padding:4px 8px;margin:8px 0 4px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  thead th{background:#f0f0f0;border:1px solid #ccc;padding:4px 5px;font-size:11px;font-weight:bold}
  tbody td{border:1px solid #ddd;padding:4px 5px;vertical-align:top}
  tfoot td{border:1px solid #ccc;padding:5px;font-weight:bold;background:#f9f9f9;text-align:right}
  .sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 32px;margin-top:20px}
  .sign-box{text-align:center;border-top:1.5px solid #333;padding-top:4px}
  .sign-title{font-size:12px;font-weight:bold}
  .sign-note{font-size:10px;color:#777;font-style:italic;margin-bottom:48px}
  .terms{font-size:10px;color:#666;margin-top:8px;line-height:1.7;border:1px dashed #ccc;padding:5px 8px}
  @media print{@page{size:A5 portrait;margin:6mm}body{padding:0}}
</style></head><body>
  <div class="title-shop">${shop.shop_name}</div>
  ${shop.shop_address?`<div class="sub-shop">📍 ${shop.shop_address}</div>`:""}
  ${shop.shop_phone  ?`<div class="sub-shop">📞 ${shop.shop_phone}</div>`:""}
  <hr class="sep-solid"/>
  <div class="doc-title">Phiếu tiếp nhận máy</div>
  <div style="text-align:center;font-size:11px;color:#888;margin-bottom:6px">Phiếu này là bằng chứng bàn giao thiết bị giữa khách hàng và cửa hàng</div>
  <hr class="sep-dash"/>
  <div class="info-2col">
    <div>
      <div class="info-row"><span class="lbl">Mã phiếu:</span><span class="val" style="font-size:15px;border:2px solid #111;padding:0 6px">HK-250628-001</span></div>
      <div class="info-row"><span class="lbl">Ngày tiếp nhận:</span><span class="val">${fmtDt(new Date())}</span></div>
      <div class="info-row"><span class="lbl">Ngày hẹn trả:</span><span class="val" style="color:#dc2626;font-weight:900">—</span></div>
      <div class="info-row"><span class="lbl">Nhân viên TN:</span><span class="val">—</span></div>
    </div>
    <div>
      <div class="info-row"><span class="lbl">Khách hàng:</span><span class="val">Nguyễn Văn A</span></div>
      <div class="info-row"><span class="lbl">Số điện thoại:</span><span class="val">0901234567</span></div>
      <div class="info-row"><span class="lbl">Thiết bị:</span><span class="val">iPhone 13 Pro Max</span></div>
      <div class="info-row"><span class="lbl">IMEI/SN:</span><span class="val">—</span></div>
    </div>
  </div>
  <div class="info-row" style="font-size:12px;margin:3px 0"><span class="lbl">Lỗi / Yêu cầu:</span><span class="val" style="font-style:italic">Màn hình vỡ, pin yếu</span></div>
  <hr class="sep-dash"/>
  <div class="section-title">🔍 TÌNH TRẠNG NGOẠI QUAN KHI TIẾP NHẬN (QT1)</div>
  <div style="padding:6px 4px;line-height:1.9">
    <span style="display:inline-block;background:#fff0f0;border:1px solid #fca5a5;border-radius:16px;padding:2px 10px;margin:2px 3px;font-size:12px;color:#991b1b;font-weight:600">Vỡ kính màn hình</span>
    <span style="display:inline-block;background:#fff0f0;border:1px solid #fca5a5;border-radius:16px;padding:2px 10px;margin:2px 3px;font-size:12px;color:#991b1b;font-weight:600">Trầy xước nhẹ</span>
    <span style="display:inline-block;background:#fff0f0;border:1px solid #fca5a5;border-radius:16px;padding:2px 10px;margin:2px 3px;font-size:12px;color:#991b1b;font-weight:600">Camera trước / sau <span style="font-size:10px;font-weight:400">→ Camera sau mờ</span></span>
  </div>
  <div style="font-size:11px;font-weight:bold;margin:6px 0 2px">📝 Ghi chú ngoại quan:</div>
  <div style="border:1px solid #ccc;border-radius:3px;padding:6px 8px;min-height:42px;font-size:11px;background:#fafafa">&nbsp;</div>
  <hr class="sep-dash"/>
  <div class="section-title">💰 BÁO GIÁ LINH KIỆN / DỊCH VỤ DỰ KIẾN</div>
  <table>
    <thead><tr><th style="width:30px;text-align:center">#</th><th>Tên linh kiện / Dịch vụ</th><th style="width:40px;text-align:center">SL</th><th style="width:110px;text-align:right">Đơn giá (đ)</th><th style="width:120px;text-align:right">Thành tiền (đ)</th></tr></thead>
    <tbody>
      <tr><td style="text-align:center">1</td><td>Màn hình iPhone 13 Pro Max</td><td style="text-align:center">1</td><td style="text-align:right">950.000</td><td style="text-align:right;font-weight:bold">950.000</td></tr>
      <tr><td style="text-align:center">2</td><td>Pin iPhone 13 Pro Max</td><td style="text-align:center">1</td><td style="text-align:right">350.000</td><td style="text-align:right;font-weight:bold">350.000</td></tr>
    </tbody>
    <tfoot><tr><td colspan="4">Chi phí dự kiến:</td><td>1.500.000</td></tr></tfoot>
  </table>
  <div class="terms">⚠️ <b>Điều khoản:</b> (1) Máy không lấy sau 30 ngày, cửa hàng không chịu trách nhiệm. (2) Bảo hành linh kiện 30 ngày kể từ ngày giao. (3) Vui lòng mang phiếu này khi đến lấy máy.</div>
  <div class="sign-grid">
    <div class="sign-box"><div class="sign-title">KHÁCH HÀNG</div><div class="sign-note">(Ký và ghi rõ họ tên)</div><div style="font-size:11px;font-style:italic;color:#666;border-top:1px dashed #ccc;padding-top:3px">Nguyễn Văn A</div></div>
    <div class="sign-box"><div class="sign-title">NHÂN VIÊN TIẾP NHẬN</div><div class="sign-note">(Ký và ghi rõ họ tên)</div><div style="font-size:11px;font-style:italic;color:#666;border-top:1px dashed #ccc;padding-top:3px"></div></div>
  </div>
</body></html>`;
  }

  if (key === "bill") {
    const remaining = Math.max(0, order.final_cost - order.deposit);
    const today = new Date().toLocaleString("vi-VN",{hour12:false,day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
    const vietqrUrl = shop.bank_account && shop.bank_name
      ? `https://img.vietqr.io/image/${shop.bank_name}-${shop.bank_account}-compact2.png?amount=${remaining}&addInfo=${encodeURIComponent("HK " + order.order_code)}&accountName=${encodeURIComponent(shop.shop_name)}`
      : null;
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>HOA DON SC ${order.order_code}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:"Times New Roman",Times,serif;font-size:13px;max-width:148mm;margin:0 auto;padding:8mm 6mm;color:#111;background:#fff;line-height:1.5}
  .title-shop{font-size:15px;font-weight:bold;text-align:center;text-transform:uppercase;letter-spacing:.5px}
  .sub-shop{font-size:11px;text-align:center;color:#444;margin-bottom:1px}
  .doc-title{font-size:17px;font-weight:bold;text-align:center;margin:8px 0 2px;letter-spacing:2px;text-transform:uppercase;text-decoration:underline}
  .doc-sub{text-align:center;font-size:11px;color:#666;margin-bottom:6px}
  .sep-solid{border:none;border-top:2px solid #111;margin:6px 0}
  .sep-dash{border:none;border-top:1px dashed #777;margin:5px 0}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;margin:6px 0;font-size:12px}
  .info-row{display:flex;gap:4px}
  .info-label{color:#555;white-space:nowrap;min-width:80px}
  .info-val{font-weight:600;flex:1}
  table{width:100%;border-collapse:collapse;font-size:12px;margin:6px 0}
  thead th{background:#222;color:#fff;padding:5px 4px;text-align:left;font-size:11px;font-weight:bold}
  thead th.r{text-align:right} thead th.c{text-align:center}
  tbody tr:nth-child(even){background:#f9f9f9}
  tbody td{padding:5px 4px;border-bottom:1px solid #e5e5e5;font-size:12px;vertical-align:top}
  tbody td.r{text-align:right} tbody td.c{text-align:center}
  .total-row{display:flex;justify-content:space-between;padding:2px 0;font-size:12px}
  .grand-row{display:flex;justify-content:space-between;font-size:15px;font-weight:bold;padding:5px 0;border-top:2px solid #111;border-bottom:2px solid #111;margin:4px 0}
  .note-box{border:1px dashed #aaa;border-radius:4px;padding:6px 8px;margin:6px 0;font-size:11px;color:#444;min-height:36px}
  .sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-top:14px}
  .sign-box{text-align:center}
  .sign-title{font-size:12px;font-weight:bold;margin-bottom:2px}
  .sign-note{font-size:10px;color:#666;font-style:italic;margin-bottom:40px}
  .sign-line{border-top:1px solid #555;margin:0 12px;padding-top:3px}
  .sign-name{font-size:11px;font-style:italic;color:#555}
  .qr-block{text-align:center;margin-top:8px}
  .qr-block img{width:120px;height:120px}
  .terms{font-size:10px;color:#777;margin-top:8px;line-height:1.6;border-top:1px dashed #ccc;padding-top:6px}
  @media print{@page{size:A5 portrait;margin:8mm}body{padding:0}}
</style>
</head><body>
  <div class="title-shop">${shop.shop_name}</div>
  ${shop.shop_address ? `<div class="sub-shop">📍 ${shop.shop_address}</div>` : ""}
  ${shop.shop_phone   ? `<div class="sub-shop">📞 ${shop.shop_phone}</div>` : ""}
  <hr class="sep-solid"/>
  <div class="doc-title">Hóa đơn sửa chữa</div>
  <div class="doc-sub">Sửa chữa - Bảo hành - Kiểm tra</div>
  <hr class="sep-dash"/>
  <div class="info-grid">
    <div class="info-row"><span class="info-label">Mã phiếu:</span><span class="info-val" style="font-size:14px;font-weight:900">${order.order_code}</span></div>
    <div class="info-row"><span class="info-label">Ngày tiếp nhận:</span><span class="info-val">${today}</span></div>
    <div class="info-row"><span class="info-label">Khách hàng:</span><span class="info-val">${order.customer_name}</span></div>
    <div class="info-row"><span class="info-label">Ngày hẹn trả:</span><span class="info-val" style="color:#dc2626;font-weight:900">—</span></div>
    <div class="info-row"><span class="info-label">Điện thoại:</span><span class="info-val">${order.customer_phone}</span></div>
    <div class="info-row"><span class="info-label">KTV phụ trách:</span><span class="info-val">—</span></div>
    <div class="info-row"><span class="info-label">Thiết bị:</span><span class="info-val">${order.device_model}</span></div>
    <div class="info-row"><span class="info-label">IMEI/SN:</span><span class="info-val">—</span></div>
  </div>
  <div style="margin:4px 0;font-size:12px"><span style="font-weight:bold;color:#555">Lỗi / Yêu cầu:</span> ${order.issue_description || "—"}</div>
  <hr class="sep-dash"/>
  <table>
    <thead><tr>
      <th style="width:4%">#</th>
      <th style="width:46%">Hạng mục / Linh kiện</th>
      <th class="c" style="width:10%">SL</th>
      <th class="r" style="width:20%">Đơn giá</th>
      <th class="r" style="width:20%">Thành tiền</th>
    </tr></thead>
    <tbody>
      <tr><td class="c">1</td><td>Dịch vụ sửa chữa</td><td class="c">1</td>
        <td class="r">${order.final_cost.toLocaleString("vi-VN")}</td>
        <td class="r" style="font-weight:bold">${order.final_cost.toLocaleString("vi-VN")}</td></tr>
    </tbody>
  </table>
  <div class="total-row"><span>Chi phí sửa chữa:</span><span>${order.final_cost.toLocaleString("vi-VN")} đ</span></div>
  ${order.deposit > 0 ? `<div class="total-row"><span>Đặt cọc trước:</span><span style="color:#059669">- ${order.deposit.toLocaleString("vi-VN")} đ</span></div>` : ""}
  <div class="grand-row"><span>TỔNG THANH TOÁN:</span><span>${order.final_cost.toLocaleString("vi-VN")} đ</span></div>
  ${remaining > 0 ? `<div class="grand-row" style="border-top:none;border-bottom:none;margin-top:-4px"><span style="color:#dc2626">CÒN LẠI:</span><span style="color:#dc2626">${remaining.toLocaleString("vi-VN")} đ</span></div>` : ""}
  ${vietqrUrl ? `<div class="qr-block"><div style="font-size:11px;font-weight:bold;margin-bottom:3px">Quét QR thanh toán</div><img src="${vietqrUrl}" onerror="this.style.display='none'"/></div>` : ""}
  <hr class="sep-dash"/>
  <div style="font-size:11px;font-weight:bold;margin-bottom:2px">📝 Ghi chú / Tình trạng máy khi tiếp nhận:</div>
  <div class="note-box">&nbsp;</div>
  <div class="terms">⚠️ <b>Điều khoản:</b> (1) Máy không lấy sau 30 ngày kể từ ngày hẹn, cửa hàng không chịu trách nhiệm. (2) Bảo hành linh kiện <b>30 ngày</b> kể từ ngày giao máy. (3) Vui lòng mang phiếu này khi đến lấy máy.</div>
  <div class="sign-grid">
    <div class="sign-box">
      <div class="sign-title">KHÁCH HÀNG</div>
      <div class="sign-note">(Ký, ghi rõ họ tên)</div>
      <div class="sign-line"></div>
      <div class="sign-name">${order.customer_name}</div>
    </div>
    <div class="sign-box">
      <div class="sign-title">NHÂN VIÊN TIẾP NHẬN</div>
      <div class="sign-note">(Ký, ghi rõ họ tên)</div>
      <div class="sign-line"></div>
      <div class="sign-name"></div>
    </div>
  </div>
</body></html>`;
  }

  if (key === "sale_receipt") {
    const fmtMoney = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";
    const fmtDate  = (s) => s ? new Date(s).toLocaleDateString("vi-VN") : new Date().toLocaleDateString("vi-VN");
    const PM_LABELS = { cash:"Tiền mặt", transfer:"Chuyển khoản", combo:"Kết hợp", credit:"Bán chịu" };
    const itemsHTML = saleOrder.items.map((it, i) =>
      `<tr>
        <td>${i+1}. ${it.part_name || it.name || ""}</td>
        <td class="c">${it.qty}</td>
        <td class="r">${fmtMoney(it.unit_price)}</td>
        <td class="r" style="font-weight:bold">${fmtMoney(it.total_price)}</td>
      </tr>`
    ).join("");
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>PHIEU THANH TOAN ${saleOrder.order_code}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:"Times New Roman",Times,serif;font-size:13px;max-width:80mm;margin:0 auto;padding:6mm 4mm;color:#111;background:#fff}
  .title-shop{font-size:14px;font-weight:bold;text-align:center;text-transform:uppercase;margin-bottom:2px}
  .sub-shop{font-size:11px;text-align:center;margin-bottom:2px}
  .doc-title{font-size:15px;font-weight:bold;text-align:center;margin:6px 0 4px;letter-spacing:1px;text-transform:uppercase}
  .sep-solid{border:none;border-top:1.5px solid #222;margin:5px 0}
  .sep-dash{border:none;border-top:1px dashed #555;margin:4px 0}
  .meta{font-size:12px;margin:2px 0;display:flex;justify-content:space-between}
  .meta span:last-child{font-weight:bold}
  table{width:100%;border-collapse:collapse;font-size:12px;margin:4px 0}
  thead th{border-bottom:1px solid #555;padding:3px 2px;text-align:left;font-size:11px;font-weight:bold;background:#f5f5f5}
  thead th.r{text-align:right} thead th.c{text-align:center}
  tbody td{padding:4px 2px;vertical-align:top;border-bottom:1px dashed #e0e0e0}
  tbody td.r{text-align:right} tbody td.c{text-align:center}
  .grand-total{display:flex;justify-content:space-between;font-size:15px;font-weight:bold;margin:4px 0}
  .grand-val{color:#059669}
  .highlight-box{border:1.5px solid #222;display:inline-block;padding:1px 6px;font-weight:bold;font-size:13px}
  .footer{text-align:center;font-size:11px;color:#555;margin-top:8px;border-top:1px dashed #aaa;padding-top:5px}
  @media print{@page{size:80mm auto;margin:0}body{padding:4mm 3mm}}
</style>
</head><body>
  <div class="title-shop">${shop.shop_name}</div>
  ${shop.shop_address ? `<div class="sub-shop">${shop.shop_address}</div>` : ""}
  ${shop.shop_phone   ? `<div class="sub-shop">ĐT: ${shop.shop_phone}</div>` : ""}
  <div class="doc-title">─── Phiếu thanh toán ───</div>
  <hr class="sep-solid"/>
  <div class="meta"><span>Hóa đơn:</span><span class="highlight-box">${saleOrder.order_code}</span></div>
  <div class="meta"><span>Ngày bán:</span><span>${fmtDate(saleOrder.created_date)}</span></div>
  <div class="meta"><span>Thu ngân:</span><span>${saleOrder.cashier_name}</span></div>
  <div class="meta"><span>Khách hàng:</span><span>${saleOrder.customer_name}</span></div>
  <div class="meta"><span>Thanh toán:</span><span>${PM_LABELS[saleOrder.payment_method]||"Tiền mặt"}</span></div>
  <hr class="sep-dash"/>
  <table>
    <thead><tr>
      <th style="width:44%">Sản phẩm</th>
      <th class="c" style="width:10%">SL</th>
      <th class="r" style="width:22%">Đ.Giá</th>
      <th class="r" style="width:24%">T.Tiền</th>
    </tr></thead>
    <tbody>${itemsHTML}</tbody>
  </table>
  <hr class="sep-dash"/>
  ${saleOrder.discount > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:#dc2626"><span>Giảm giá:</span><span>-${fmtMoney(saleOrder.discount)}</span></div>` : ""}
  <div class="grand-total"><span>TỔNG:</span><span class="grand-val">${fmtMoney(saleOrder.total)}</span></div>
  <div class="footer"><div>Cảm ơn quý khách! Hẹn gặp lại 🙏</div></div>
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
