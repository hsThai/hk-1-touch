import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Build Excel XML (SpreadsheetML format — mở được bằng Excel/LibreOffice)
    const sheets = buildSheets();
    const xml = buildExcelXml(sheets);

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": 'attachment; filename="HK_OneTouch_TaiLieu.xls"',
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function e(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSheets() {
  return [
    sheetOverview(),
    sheetRoles(),
    sheetWorkflow(),
    sheetDatabase(),
    sheetFeatures(),
    sheetKPI(),
    sheetNotifications(),
    sheetStockFlow(),
    sheetStatusList(),
  ];
}

// ══════════════════════════════════════════════════════════════
// SHEET 1: Tổng quan
// ══════════════════════════════════════════════════════════════
function sheetOverview() {
  const rows = [
    ["HK ONE TOUCH — TÀI LIỆU HỆ THỐNG", "", "", ""],
    ["", "", "", ""],
    ["Mục", "Nội dung", "", ""],
    ["Tên ứng dụng", "HK One Touch", "", ""],
    ["Mục đích", "Quản lý quy trình sửa chữa điện thoại & linh kiện nội bộ", "", ""],
    ["Nền tảng", "Web App (PWA) — chạy trên điện thoại & máy tính", "", ""],
    ["Backend chính", "PocketBase (self-hosted, mạng LAN)", "", ""],
    ["Backend phụ", "Base44 (cloud, lưu Staff entity)", "", ""],
    ["Tích hợp", "KiotViet POS — đồng bộ linh kiện & xuất hóa đơn", "", ""],
    ["Realtime", "PocketBase SSE (Server-Sent Events) + Polling 8-10s", "", ""],
    ["Thông báo", "In-app notification + System Push Notification (Web)", "", ""],
    ["", "", "", ""],
    ["Vai trò người dùng", "Số lượng màn hình", "Quyền chính", ""],
    ["manager / admin", "Tất cả màn hình", "Toàn quyền: đọc/ghi/xóa mọi đơn, phân công KTV, xem KPI", ""],
    ["receptionist (Tiếp tân)", "Tạo đơn, theo dõi, bàn giao", "Tạo đơn, QT1, báo giá khách, bàn giao máy", ""],
    ["technician (KTV)", "Đơn của mình, chat, linh kiện", "Nhận đơn, sửa, đổi trạng thái, yêu cầu linh kiện", ""],
    ["warehouse (NV Kho)", "Kho, phiếu xuất/nhập, tồn kho", "Xác nhận xuất, nhập hàng, tra cứu tồn kho", ""],
  ];
  return { name: "1.Tổng quan", rows };
}

// ══════════════════════════════════════════════════════════════
// SHEET 2: Vai trò
// ══════════════════════════════════════════════════════════════
function sheetRoles() {
  const rows = [
    ["VAI TRÒ NHÂN VIÊN", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["Vai trò", "Tên hiển thị", "Menu chính", "Quyền đặc biệt", "Hạn chế", ""],
    ["manager", "Quản lý", "Dashboard, Bảng theo dõi, Tạo đơn, Danh sách, KPI, Khách hàng, Nhân viên, Cài đặt", "Xóa đơn, Giao lại KTV, Xem tất cả đơn, Đặt KPI", "—", ""],
    ["admin", "Admin", "Giống manager", "Giống manager", "—", ""],
    ["receptionist", "Tiếp tân", "Trang chủ, Tạo đơn, Danh sách, Khách hàng", "Tạo đơn, QT1 kiểm ngoại quan, Xác nhận khách, Bàn giao máy", "Không xem KPI, không vào Settings", ""],
    ["technician", "Kỹ thuật viên", "Trang chủ, Danh sách đơn của mình, KPI", "Nhận đơn, Đổi trạng thái, Chat, Yêu cầu linh kiện, QT2", "Không tạo đơn, không thấy đơn của KTV khác", ""],
    ["warehouse", "Nhân viên kho", "Trang chủ kho, Chat đơn, Phiếu xuất, Nhập hàng, Tồn kho", "Xác nhận xuất kho, Nhập hàng, Tra cứu tồn", "Không quản lý đơn sửa chữa", ""],
    ["", "", "", "", "", ""],
    ["Ghi chú: KPI chỉ áp dụng cho technician và manager", "", "", "", "", ""],
  ];
  return { name: "2.Vai trò", rows };
}

// ══════════════════════════════════════════════════════════════
// SHEET 3: Workflow
// ══════════════════════════════════════════════════════════════
function sheetWorkflow() {
  const rows = [
    ["QUY TRÌNH SỬA CHỮA (WORKFLOW CHÍNH)", "", "", "", ""],
    ["", "", "", "", ""],
    ["Bước", "Trạng thái PB", "Trạng thái Hiển thị", "Người thực hiện", "Mô tả hành động"],
    ["1", "Cho KTV", "Chờ KTV", "Tiếp tân / Manager", "Tạo đơn mới, kiểm ngoại quan (QT1), chọn KTV, hệ thống gửi thông báo cho KTV"],
    ["2", "Cho KTV", "Chờ KTV", "KTV", "KTV nhận thông báo đơn mới. Có 60 phút để bấm Nhận Kiểm. Nếu quá giờ bị trừ KPI"],
    ["3", "KTV Dang Kiem", "KTV Đang Kiểm", "KTV", "KTV bấm 'Nhận Kiểm' → bắt đầu kiểm tra sâu (QT2): lỗi thực tế, đề xuất sửa, chi phí dự kiến"],
    ["4", "Cho Bao Gia", "Chờ Báo Giá", "KTV → Tiếp tân", "KTV hoàn tất QT2, gửi kết quả về Tiếp tân để báo giá cho khách"],
    ["5", "Cho Xac Nhan", "Chờ Xác Nhận", "Tiếp tân", "Tiếp tân liên hệ khách: thông báo chi phí, chờ khách đồng ý/từ chối"],
    ["6a", "Huy", "Hủy", "Tiếp tân", "Khách từ chối → đơn chuyển Hủy, ghi lý do"],
    ["6b", "Cho KTV Sua", "Chờ KTV Sửa", "Tiếp tân", "Khách đồng ý → đơn chuyển Chờ KTV Sửa, cập nhật báo giá, đặt cọc"],
    ["7", "Cho KTV Sua", "Chờ KTV Sửa", "KTV", "KTV nhận lệnh sửa: bấm 'Nhận Sửa', chọn thời gian dự kiến hoàn thành, chụp ảnh máy"],
    ["8", "Dang Sua", "Đang Sửa", "KTV", "KTV đang sửa. Có thể yêu cầu xuất linh kiện từ kho (Phiếu Xuất Kho)"],
    ["8a", "Cho Linh Kien", "Chờ Linh Kiện", "KTV", "KTV đang chờ linh kiện — trạng thái phụ, không bắt buộc"],
    ["9", "Hoan Thanh", "Hoàn Thành", "KTV", "KTV bấm 'Sửa Xong' → +2 KPI, thông báo Tiếp tân & Manager"],
    ["10", "Da Giao", "Đã Giao", "Tiếp tân / Manager", "Tiếp tân bàn giao máy: checklist kiểm tra, chữ ký, thanh toán, ghi ảnh/video"],
    ["", "", "", "", ""],
    ["QUY TRÌNH LINH KIỆN", "", "", "", ""],
    ["", "", "", "", ""],
    ["Bước", "Người", "Hành động", "", ""],
    ["LK-1", "KTV", "Vào tab Linh Kiện trong đơn → chọn linh kiện từ danh sách KiotViet", "", ""],
    ["LK-2", "KTV", "Bấm 'Tạo đề nghị xuất kho' → chọn loại (Xuất sửa / Xuất mượn) + hạn kho xuất", "", ""],
    ["LK-3", "NV Kho", "Nhận thông báo → vào Phiếu xuất kho → xác nhận đã xuất (chụp ảnh)", "", ""],
    ["LK-4", "KTV", "Xác nhận đã nhận linh kiện (trong tab Phiếu xuất của đơn)", "", ""],
    ["LK-5 (mượn)", "KTV/Kho", "KTV trả lại kho sau khi sửa xong (nếu loại Xuất mượn)", "", ""],
    ["", "", "", "", ""],
    ["QUY TRÌNH NHẬP HÀNG (KHO)", "", "", "", ""],
    ["", "", "", "", ""],
    ["Bước", "Người", "Hành động", "", ""],
    ["NK-1", "NV Kho", "Vào Nhập hàng → Tạo phiếu → chọn loại (Linh kiện / Máy móc)", "", ""],
    ["NK-2", "NV Kho", "Nhập thông tin từng mặt hàng: tên, SKU, IMEI (máy), giá nhập, số lượng, ảnh", "", ""],
    ["NK-3", "NV Kho", "Lưu phiếu (trạng thái Draft) → tồn kho tự cộng vào SparePart", "", ""],
    ["NK-4", "Manager", "Xác nhận phiếu nhập (tùy quy trình cửa hàng)", "", ""],
  ];
  return { name: "3.Workflow", rows };
}

// ══════════════════════════════════════════════════════════════
// SHEET 4: Database
// ══════════════════════════════════════════════════════════════
function sheetDatabase() {
  const rows = [
    ["DATABASE & COLLECTIONS (PocketBase)", "", "", "", ""],
    ["", "", "", "", ""],
    ["Collection", "Field", "Kiểu dữ liệu", "Mô tả", ""],
    // repair_orders
    ["repair_orders", "order_code", "text", "Mã đơn (SC24xxxx)", ""],
    ["repair_orders", "customer_name", "text", "Tên khách hàng", ""],
    ["repair_orders", "customer_phone", "text", "Số điện thoại khách", ""],
    ["repair_orders", "device_name", "text", "Tên thiết bị", ""],
    ["repair_orders", "device_model", "text", "Model thiết bị (iPhone 15 Pro...)", ""],
    ["repair_orders", "imei", "text", "IMEI / Serial number", ""],
    ["repair_orders", "passcode", "text", "Mã PIN máy", ""],
    ["repair_orders", "product_qr", "text", "Mã QR dán trên máy (lịch sử sửa chữa)", ""],
    ["repair_orders", "issue_description", "text", "Mô tả lỗi khách báo (comma-separated)", ""],
    ["repair_orders", "technician_note", "text", "Ghi chú kỹ thuật viên", ""],
    ["repair_orders", "status", "text (enum)", "Trạng thái PB: Cho KTV / KTV Dang Kiem / Cho Bao Gia / Cho Xac Nhan / Cho KTV Sua / Dang Sua / Cho Linh Kien / Hoan Thanh / Da Giao / Huy", ""],
    ["repair_orders", "priority", "text (enum)", "Thuong / Gap / VIP", ""],
    ["repair_orders", "assigned_to", "text", "ID staff được giao", ""],
    ["repair_orders", "assigned_to_name", "text", "Tên KTV được giao (cache)", ""],
    ["repair_orders", "assigned_at", "datetime", "Thời điểm phân công (ISO)", ""],
    ["repair_orders", "accept_stage", "number", "0=chưa nhận 1=đang kiểm 2=đang sửa 3=hoàn tất", ""],
    ["repair_orders", "stage1_at", "datetime", "Thời điểm hết hạn 60p đầu (KPI stage 0→1)", ""],
    ["repair_orders", "stage2_at", "datetime", "Thời điểm bắt đầu sửa", ""],
    ["repair_orders", "kpi_stage1_penalized", "boolean", "Đã bị trừ -1 KPI (stage 0 quá hạn)", ""],
    ["repair_orders", "kpi_stage2_penalized", "boolean", "Đã bị trừ -2 KPI (stage 1 quá hạn)", ""],
    ["repair_orders", "kpi_manually_accepted", "boolean", "KTV tự bấm nhận (dừng đếm KPI)", ""],
    ["repair_orders", "needs_reassign", "boolean", "Cần giao lại KTV (sau -2 KPI)", ""],
    ["repair_orders", "estimated_cost", "number", "Giá báo cho khách (đ)", ""],
    ["repair_orders", "final_cost", "number", "Giá thanh toán thực tế (đ)", ""],
    ["repair_orders", "deposit", "number", "Số tiền cọc (đ)", ""],
    ["repair_orders", "warranty_days", "number", "Số ngày bảo hành", ""],
    ["repair_orders", "received_date", "datetime", "Ngày tiếp nhận", ""],
    ["repair_orders", "estimated_done", "datetime", "Dự kiến hoàn thành", ""],
    ["repair_orders", "done_date", "datetime", "Ngày hoàn thành thực tế", ""],
    ["repair_orders", "images", "json array", "Danh sách URL ảnh đính kèm", ""],
    ["repair_orders", "videos", "json array", "Danh sách URL video", ""],
    ["repair_orders", "qt1_checklist", "json", "Kết quả kiểm ngoại quan (QT1)", ""],
    ["repair_orders", "qt1_note", "text", "Ghi chú QT1", ""],
    ["repair_orders", "qt2_checklist", "json", "Kết quả kiểm kỹ thuật (QT2)", ""],
    ["repair_orders", "qt2_note", "text", "Ghi chú QT2", ""],
    ["repair_orders", "qt2_de_xuat", "json", "Đề xuất sửa + chi phí từ KTV", ""],
    ["repair_orders", "handover_at", "datetime", "Thời điểm bàn giao", ""],
    ["repair_orders", "handover_by", "text", "ID người bàn giao", ""],
    ["repair_orders", "handover_by_name", "text", "Tên người bàn giao", ""],
    ["repair_orders", "handover_signature", "text/url", "Chữ ký điện tử khách", ""],
    ["repair_orders", "handover_note", "text", "Ghi chú bàn giao", ""],
    ["", "", "", "", ""],
    // staff
    ["staff", "full_name", "text", "Họ tên nhân viên", ""],
    ["staff", "username", "text", "Tên đăng nhập", ""],
    ["staff", "password_hash", "text", "Mật khẩu base64 encoded", ""],
    ["staff", "role", "text (enum)", "manager / receptionist / technician / warehouse", ""],
    ["staff", "phone", "text", "Số điện thoại", ""],
    ["staff", "is_active", "boolean", "Đang hoạt động", ""],
    ["staff", "kpi_score", "number", "Điểm KPI hiện tại (default 100)", ""],
    ["staff", "must_change_password", "boolean", "Bắt buộc đổi mật khẩu lần đầu", ""],
    ["staff", "avatar_url", "text", "URL ảnh đại diện", ""],
    ["", "", "", "", ""],
    // repair_chats
    ["repair_chats", "order_id", "text", "ID đơn sửa chữa", ""],
    ["repair_chats", "order_code", "text", "Mã đơn (cache)", ""],
    ["repair_chats", "sender_id", "text", "ID người gửi", ""],
    ["repair_chats", "sender_name", "text", "Tên người gửi", ""],
    ["repair_chats", "message", "text", "Nội dung tin nhắn", ""],
    ["repair_chats", "message_type", "text", "text / image / video / audio / system", ""],
    ["repair_chats", "media_url", "text", "URL file đính kèm", ""],
    ["repair_chats", "mentioned_ids", "json", "Danh sách ID được @mention", ""],
    ["repair_chats", "mentioned_names", "json", "Danh sách tên được @mention", ""],
    ["", "", "", "", ""],
    // notifications
    ["notifications", "user_id", "text", "ID người nhận thông báo", ""],
    ["notifications", "user_name", "text", "Tên người nhận", ""],
    ["notifications", "title", "text", "Tiêu đề thông báo", ""],
    ["notifications", "message", "text", "Nội dung thông báo", ""],
    ["notifications", "order_id", "text", "ID đơn liên quan", ""],
    ["notifications", "order_code", "text", "Mã đơn liên quan", ""],
    ["notifications", "type", "text", "assign / status_change / chat / mention / kpi_reminder / kpi_penalty / export_ready / new_order / deleted", ""],
    ["notifications", "is_read", "boolean", "Đã đọc chưa", ""],
    ["", "", "", "", ""],
    // spare_parts
    ["spare_parts", "name", "text", "Tên linh kiện", ""],
    ["spare_parts", "sku", "text", "Mã SKU / IMEI (cho máy móc)", ""],
    ["spare_parts", "kv_id", "text", "ID sản phẩm trên KiotViet", ""],
    ["spare_parts", "category", "text", "Danh mục (device_stock / Linh kiện...)", ""],
    ["spare_parts", "price", "number", "Giá bán (đ)", ""],
    ["spare_parts", "stock_qty", "number", "Số lượng tồn kho", ""],
    ["spare_parts", "unit", "text", "Đơn vị (cái / bộ...)", ""],
    ["spare_parts", "is_active", "boolean", "Đang kinh doanh", ""],
    ["", "", "", "", ""],
    // stock_export_requests
    ["stock_export_requests", "request_code", "text", "Mã phiếu (EXP-SC24xxxx-xxx)", ""],
    ["stock_export_requests", "order_id", "text", "Mã đơn sửa liên quan", ""],
    ["stock_export_requests", "export_type", "text", "repair (xuất sửa) / borrow (mượn tạm)", ""],
    ["stock_export_requests", "items", "json", "Danh sách linh kiện [{part_id, name, sku, qty, unit_price, total_price}]", ""],
    ["stock_export_requests", "due_datetime", "datetime", "Hạn kho phải xuất", ""],
    ["stock_export_requests", "return_due_date", "date", "Hạn trả (nếu mượn)", ""],
    ["stock_export_requests", "status", "text", "pending / warehouse_confirmed / ktv_confirmed / returned / cancelled", ""],
    ["stock_export_requests", "requested_by", "text", "ID KTV yêu cầu", ""],
    ["stock_export_requests", "requested_by_name", "text", "Tên KTV yêu cầu", ""],
    ["stock_export_requests", "total_value", "number", "Tổng giá trị linh kiện (đ)", ""],
    ["stock_export_requests", "warehouse_confirmed_by_name", "text", "Tên NV kho xác nhận xuất", ""],
    ["stock_export_requests", "warehouse_confirmed_at", "datetime", "Thời điểm kho xác nhận", ""],
    ["stock_export_requests", "warehouse_note", "text", "Ghi chú kho", ""],
    ["stock_export_requests", "warehouse_media", "text", "URL ảnh xác nhận xuất", ""],
    ["stock_export_requests", "ktv_confirmed_by_name", "text", "Tên KTV xác nhận nhận", ""],
    ["stock_export_requests", "ktv_confirmed_at", "datetime", "Thời điểm KTV nhận", ""],
    ["stock_export_requests", "kiotviet_invoice_code", "text", "Mã hóa đơn KiotViet", ""],
    ["stock_export_requests", "reminded_15min", "boolean", "Đã gửi nhắc 15 phút", ""],
    ["", "", "", "", ""],
    // stock_imports
    ["stock_imports", "import_code", "text", "Mã phiếu nhập (PNyymmdd-xxxx)", ""],
    ["stock_imports", "import_type", "text", "spare_part / device", ""],
    ["stock_imports", "supplier_name", "text", "Tên nhà cung cấp", ""],
    ["stock_imports", "supplier_phone", "text", "SĐT nhà cung cấp", ""],
    ["stock_imports", "total_items", "number", "Số mặt hàng", ""],
    ["stock_imports", "total_value", "number", "Tổng giá trị (đ)", ""],
    ["stock_imports", "status", "text", "draft / confirmed / synced_kv", ""],
    ["stock_imports", "created_by_name", "text", "Người tạo phiếu", ""],
    ["", "", "", "", ""],
    // stock_import_items
    ["stock_import_items", "import_id", "text", "ID phiếu nhập", ""],
    ["stock_import_items", "name", "text", "Tên mặt hàng", ""],
    ["stock_import_items", "sku", "text", "Mã SKU", ""],
    ["stock_import_items", "serial_imei", "text", "IMEI / Serial (quan trọng cho máy móc)", ""],
    ["stock_import_items", "qr_code", "text", "Mã QR sản phẩm", ""],
    ["stock_import_items", "qty", "number", "Số lượng", ""],
    ["stock_import_items", "unit_price", "number", "Giá nhập/cái (đ)", ""],
    ["stock_import_items", "total_price", "number", "Tổng giá (đ)", ""],
    ["stock_import_items", "condition", "text", "new / refurb / used", ""],
    ["stock_import_items", "photos", "json", "URL ảnh hàng", ""],
    ["stock_import_items", "videos", "json", "URL video hàng", ""],
    ["", "", "", "", ""],
    // order_history
    ["order_history", "order_id", "text", "ID đơn", ""],
    ["order_history", "order_code", "text", "Mã đơn", ""],
    ["order_history", "action_type", "text", "created / status_changed / reassigned / cost_updated / delivered / cancelled / qt1_done / qt2_done / accepted_repair / other", ""],
    ["order_history", "action_label", "text", "Mô tả hành động", ""],
    ["order_history", "changed_by_name", "text", "Người thực hiện", ""],
    ["order_history", "changed_by_role", "text", "Vai trò người thực hiện", ""],
    ["order_history", "old_value", "text", "Giá trị cũ", ""],
    ["order_history", "new_value", "text", "Giá trị mới", ""],
    ["order_history", "note", "text", "Ghi chú thêm", ""],
    ["", "", "", "", ""],
    // app_settings
    ["app_settings", "key", "text", "Tên cài đặt", ""],
    ["app_settings", "value", "text", "Giá trị cài đặt", ""],
    ["app_settings", "label", "text", "Nhãn hiển thị", ""],
    ["app_settings", "group", "text", "Nhóm: shop / kiotviet / notification", ""],
    ["", "", "", "", ""],
    // customers
    ["customers", "full_name", "text", "Tên khách hàng", ""],
    ["customers", "phone", "text", "Số điện thoại", ""],
    ["", "", "", "", ""],
    // media_files
    ["media_files", "file", "file", "File ảnh hoặc video đính kèm", ""],
    ["media_files", "type", "text", "image / video", ""],
    ["media_files", "order_id", "text", "ID đơn liên quan", ""],
    ["media_files", "name", "text", "Tên file gốc", ""],
  ];
  return { name: "4.Database", rows };
}

// ══════════════════════════════════════════════════════════════
// SHEET 5: Tính năng
// ══════════════════════════════════════════════════════════════
function sheetFeatures() {
  const rows = [
    ["DANH SÁCH TÍNH NĂNG", "", "", ""],
    ["", "", "", ""],
    ["Nhóm", "Tính năng", "Vai trò sử dụng", "Mô tả chi tiết"],
    ["Đơn sửa chữa", "Tạo đơn mới", "Manager, Receptionist", "Nhập thông tin khách, thiết bị, lỗi, chọn KTV, chụp ảnh, kiểm ngoại quan QT1 ngay khi tạo"],
    ["Đơn sửa chữa", "Bảng Kanban theo trạng thái", "Manager, Receptionist", "9 cột trạng thái, kéo xem, highlight đơn cần xử lý, animation nhấp nháy đỏ"],
    ["Đơn sửa chữa", "Danh sách đơn (TaskList)", "Tất cả", "Tìm kiếm theo tên/SĐT/IMEI/mã đơn, lọc theo trạng thái, badge giá tiền"],
    ["Đơn sửa chữa", "Chi tiết đơn (Drawer)", "Tất cả", "Xem thông tin đầy đủ, đổi trạng thái, chat, linh kiện, lịch sử phiếu xuất"],
    ["Đơn sửa chữa", "Sửa đơn (Edit Modal)", "Manager, Receptionist", "Chỉnh sửa mọi trường: khách hàng, thiết bị, KTV, giá, thời gian"],
    ["Đơn sửa chữa", "Xóa đơn", "Manager, Admin", "Xóa đơn + thông báo cho tất cả người liên quan"],
    ["Đơn sửa chữa", "Share link theo dõi", "Manager, Receptionist", "Tạo QR + link public cho khách tự xem tiến độ (không cần đăng nhập)"],
    ["Kiểm tra", "QT1 — Kiểm ngoại quan", "Tiếp tân, Manager", "11 hạng mục kiểm tra: màn hình, lưng, viền, cảm ứng, camera, loa, wifi..."],
    ["Kiểm tra", "QT2 — KTV kiểm kỹ thuật", "KTV", "Checklist lỗi sâu, đề xuất sửa + chi phí, chụp ảnh/video kiểm tra"],
    ["KPI", "Hệ thống KPI tự động", "Hệ thống", "Stage 0: 60p nhận đơn (-1 KPI quá hạn). Stage 1: 60p tiếp (-2 KPI). Stage 2+: không giới hạn"],
    ["KPI", "Đồng hồ đếm ngược", "KTV", "Hiển thị thời gian còn lại, thanh tiến trình, màu theo urgency"],
    ["KPI", "Tự động giao lại", "Hệ thống", "KTV quá 120p: bị đánh dấu needs_reassign, Manager thấy và giao cho KTV khác"],
    ["KPI", "Bảng KPI", "Manager, KTV", "Xếp hạng KTV theo điểm, hiển thị số đơn hoàn thành vs đang làm"],
    ["Chat", "Chat nội bộ theo đơn", "Tất cả", "Tin nhắn text, ảnh, video, ghi âm giọng nói. Polling 3s khi đang xem"],
    ["Chat", "@Mention", "Tất cả", "Gõ @ để mention người cụ thể, @all để thông báo tất cả. Dropdown gợi ý"],
    ["Chat", "Vẽ lên ảnh", "Tất cả", "Bút vẽ, hình chữ nhật, hình oval, nhiều màu, undo, gửi ảnh có chú thích"],
    ["Chat", "Xem ảnh/video toàn màn hình", "Tất cả", "Pinch zoom, vuốt chuyển ảnh, tải về, chia sẻ"],
    ["Linh kiện", "Danh sách linh kiện từ KiotViet", "KTV, Manager", "Đồng bộ tồn kho thực tế từ KiotViet API"],
    ["Linh kiện", "Tạo phiếu xuất kho", "KTV", "Chọn LK, số lượng, loại xuất (sửa/mượn), hạn xuất, hạn trả"],
    ["Linh kiện", "Xác nhận xuất — NV Kho", "NV Kho", "Xem phiếu, xuất hàng thực tế, chụp ảnh xác nhận, tạo hóa đơn KiotViet"],
    ["Linh kiện", "Xác nhận nhận — KTV", "KTV", "KTV xác nhận đã nhận linh kiện từ kho"],
    ["Linh kiện", "Trả linh kiện", "KTV, Kho", "KTV trả lại kho sau sửa (áp dụng cho phiếu mượn)"],
    ["Kho", "Tồn kho linh kiện", "NV Kho", "Tra cứu tên/SKU, lọc theo mức tồn (đủ/thấp/hết)"],
    ["Kho", "Nhập hàng", "NV Kho", "Tạo phiếu nhập cho linh kiện & máy móc. Quét IMEI barcode. Chụp ảnh hàng nhập"],
    ["Kho", "Máy trong kho", "NV Kho", "Máy nhập vào SparePart với category=device_stock. Quét QR ra 'Hàng trong kho'"],
    ["Kho", "Nhắc hạn xuất", "Hệ thống", "Tự động nhắc NV kho 15 phút trước hạn xuất. Nhắc hàng ngày nếu quá hạn trả mượn"],
    ["Bàn giao", "Bàn giao máy", "Tiếp tân, Manager", "Checklist bàn giao, ghi chú, chữ ký điện tử, ảnh/video, thanh toán cuối"],
    ["QR Code", "QR mã đơn", "Tất cả", "Mỗi đơn có QR → quét để mở đơn trực tiếp"],
    ["QR Code", "QR dán máy", "Tất cả", "Quét QR dán trên máy → xem lịch sử sửa chữa theo máy đó"],
    ["QR Code", "QR scan toàn cục", "Tất cả", "Nút scan QR ở header → tìm đơn / gán QR vào đơn mới / xem lịch sử máy"],
    ["QR Code", "Quét IMEI barcode", "Tất cả", "Dùng camera quét barcode 1D để lấy IMEI (BarcodeDetector API + jsQR fallback)"],
    ["Thông báo", "In-app notification", "Tất cả", "Chuông + panel thông báo, vuốt xóa từng noti, đọc tất cả"],
    ["Thông báo", "System Push Notification", "Tất cả", "Web Push API — nhận kể cả khi app ở background"],
    ["Thông báo", "Âm thanh thông báo", "Tất cả", "Tùy chọn: ding/beep/chime/bell/custom. Web Audio API không cần file âm thanh"],
    ["Khách hàng", "Danh sách khách", "Manager, Receptionist", "Tổng hợp từ lịch sử đơn: số đơn, lần gần nhất"],
    ["Khách hàng", "Tìm kiếm KiotViet", "Manager, Receptionist", "Tìm khách từ KiotViet khi tạo đơn (tên / SĐT)"],
    ["Khách hàng", "Trang theo dõi công khai", "Khách hàng", "URL /OrderPublic?code=SC24xxxx — khách tự xem tiến độ không cần đăng nhập"],
    ["Cài đặt", "Thông tin cửa hàng", "Manager, Admin", "Tên, SĐT, địa chỉ, cam kết bảo hành (dùng trong bàn giao & share link)"],
    ["Cài đặt", "KiotViet API", "Manager, Admin", "Cấu hình Client ID, Secret, Retailer để tích hợp POS"],
    ["Cài đặt", "PocketBase URL", "Manager, Admin", "Cấu hình địa chỉ server PocketBase (tự động fallback về DDNS nếu dùng LAN)"],
    ["Cài đặt", "Đổi mật khẩu", "Tất cả", "Đổi mật khẩu tài khoản hiện tại"],
    ["Nhân viên", "Quản lý Staff", "Manager, Admin", "Thêm/sửa/xóa/kích hoạt nhân viên, đặt lại mật khẩu, xem KPI"],
    ["Bảo mật", "Đăng nhập nội bộ", "Tất cả", "Username + password (base64 hash). Lưu token localStorage, auto-login lần sau"],
    ["Bảo mật", "Bắt đổi mật khẩu lần đầu", "Tất cả", "Flag must_change_password → bắt buộc đổi trước khi vào app"],
    ["Mobile", "PWA (Progressive Web App)", "Tất cả", "Cài như app native trên Android/iOS, icon, fullscreen, màu theme"],
    ["Mobile", "Chặn kéo refresh", "Tất cả", "Pull-to-refresh và F5 bị chặn để tránh mất dữ liệu form"],
    ["Mobile", "Chặn nút Back Android", "Tất cả", "Nút Back đóng drawer/sidebar thay vì thoát app"],
  ];
  return { name: "5.Tính năng", rows };
}

// ══════════════════════════════════════════════════════════════
// SHEET 6: KPI
// ══════════════════════════════════════════════════════════════
function sheetKPI() {
  const rows = [
    ["QUY TẮC KPI KỸ THUẬT VIÊN", "", "", ""],
    ["", "", "", ""],
    ["Sự kiện", "Thay đổi KPI", "Thời điểm", "Ghi chú"],
    ["Được giao đơn", "0", "Ngay khi giao", "Bắt đầu đếm 60 phút (Stage 0)"],
    ["Quá 60 phút chưa bấm Nhận Đơn", "-1 KPI", "Hết 60 phút", "Hệ thống tự chuyển sang Stage 1, đếm tiếp 60 phút"],
    ["Quá 120 phút tổng cộng chưa nhận", "-2 KPI", "Hết 60 phút Stage 1", "Đánh dấu needs_reassign, báo Manager giao lại"],
    ["KTV tự bấm Nhận (bất cứ lúc nào)", "0 (dừng KPI)", "Ngay khi bấm", "Không bị trừ thêm, chờ bấm Bắt Đầu Sửa"],
    ["Sửa xong (Hoàn Thành)", "+2 KPI", "Khi đổi trạng thái Hoàn Thành", ""],
    ["", "", "", ""],
    ["Stage", "Từ khi nào", "Hạn", "Hành động nếu quá hạn"],
    ["Stage 0 — Chưa nhận đơn", "Thời điểm phân công (assigned_at)", "60 phút", "-1 KPI + tự chuyển Stage 1"],
    ["Stage 1 — Tự động (chưa nhận)", "Hết 60p Stage 0 (stage1_at)", "60 phút", "-2 KPI + needs_reassign=true"],
    ["Stage 1 — KTV tự nhận", "KTV bấm Nhận", "Không giới hạn", "Không bị trừ KPI thêm"],
    ["Stage 2 — Đang sửa", "KTV bấm Bắt Đầu Sửa", "Không giới hạn", "Không có timer bắt buộc"],
    ["Stage 3 — Hoàn tất", "KTV bấm Sửa Xong", "—", "+2 KPI"],
    ["", "", "", ""],
    ["Nhắc nhở tự động", "", "", ""],
    ["Còn 20 phút trong Stage 0", "Gửi notification nhắc KTV", "", ""],
    ["Còn 10 phút trong Stage 0", "Gửi notification ⚠️ cấp bách", "", ""],
    ["Còn 5 phút trong Stage 0", "Gửi notification 🚨 khẩn", "", ""],
    ["Quá hạn Stage 0", "Gửi notification cho KTV + Manager", "", ""],
    ["Còn 20 phút trong Stage 1", "Gửi notification khẩn cho KTV", "", ""],
    ["Quá hạn Stage 1", "Gửi notification cho KTV + Manager về needs_reassign", "", ""],
    ["", "", "", ""],
    ["Interval kiểm tra KPI", "Mỗi 15 phút (setInterval)", "", "Chạy client-side, cập nhật cả PocketBase"],
  ];
  return { name: "6.KPI", rows };
}

// ══════════════════════════════════════════════════════════════
// SHEET 7: Thông báo
// ══════════════════════════════════════════════════════════════
function sheetNotifications() {
  const rows = [
    ["HỆ THỐNG THÔNG BÁO", "", "", ""],
    ["", "", "", ""],
    ["Loại (type)", "Người nhận", "Khi nào gửi", "Mô tả"],
    ["assign", "KTV được giao", "Tạo đơn mới / Giao lại KTV", "KTV nhận biết có đơn cần xử lý"],
    ["new_order", "Manager, Receptionist (trừ người tạo)", "Tạo đơn mới", "Thông báo đơn mới cho quản lý"],
    ["status_change", "Manager, Receptionist", "KTV đổi trạng thái đơn", "Theo dõi tiến độ"],
    ["chat", "Tất cả liên quan đơn (trừ người gửi)", "Gửi tin nhắn chat", "Khi không có mention cụ thể"],
    ["mention", "Người được @mention", "Gửi tin nhắn có @tên", "Notify người được tag trực tiếp"],
    ["export_request", "NV Kho", "KTV tạo phiếu xuất kho", "Yêu cầu xuất linh kiện"],
    ["export_ready", "KTV yêu cầu", "Kho xác nhận đã xuất", "Đến lấy linh kiện"],
    ["export_deadline", "NV Kho, Manager", "Phiếu còn 15 phút hết hạn", "Nhắc xử lý gấp"],
    ["export_overdue", "NV Kho, Manager", "Phiếu mượn quá hạn trả", "Nhắc thu hồi linh kiện (1 lần/ngày)"],
    ["kpi_reminder", "KTV", "Còn 20/10/5 phút nhận đơn", "Nhắc nhận đơn trước khi bị trừ KPI"],
    ["kpi_penalty", "KTV + Manager", "Quá hạn Stage 0 hoặc Stage 1", "Thông báo đã bị trừ KPI"],
    ["needs_reassign", "Manager", "Quá 120p tổng, needs_reassign=true", "Cần phân công lại KTV"],
    ["deleted", "Tất cả liên quan đơn", "Manager xóa đơn", "Thông báo đơn đã bị xóa"],
    ["", "", "", ""],
    ["Cơ chế thông báo", "", "", ""],
    ["In-app polling", "Mỗi 10s (foreground) / 30s (background)", "", "Đọc Notification collection với filter user_id + is_read=false"],
    ["System Push", "Web Notification API", "", "requestNotificationPermission() → showNotification() khi có notif mới"],
    ["Âm thanh", "Web Audio API (không file âm thanh)", "", "Oscillator nodes tạo âm thanh trực tiếp. Unlock sau gesture đầu tiên"],
    ["Panel thông báo", "Dropdown từ bell icon", "", "Merge local + DB, sort mới nhất, vuốt để xóa từng noti"],
    ["Đọc thông báo", "Bấm vào noti → navigate đến đơn", "", "Tự mở đúng tab (chat/info/exports) theo loại thông báo"],
  ];
  return { name: "7.Thông báo", rows };
}

// ══════════════════════════════════════════════════════════════
// SHEET 8: Quy trình xuất kho
// ══════════════════════════════════════════════════════════════
function sheetStockFlow() {
  const rows = [
    ["QUY TRÌNH PHIẾU XUẤT KHO CHI TIẾT", "", "", ""],
    ["", "", "", ""],
    ["Loại", "Xuất sửa (repair)", "Xuất mượn (borrow)", ""],
    ["Mục đích", "Dùng linh kiện để sửa, không cần trả", "Mượn tạm, phải trả lại sau khi sửa xong", ""],
    ["KiotViet", "Tạo hóa đơn xuất hàng", "Tạo hóa đơn xuất hàng", ""],
    ["Hạn trả", "Không có", "Có (1-7 ngày, tùy chọn)", ""],
    ["", "", "", ""],
    ["Trạng thái phiếu xuất", "Mô tả", "", ""],
    ["pending", "Chờ kho xử lý. Đang đếm ngược hạn xuất", "", ""],
    ["warehouse_confirmed", "Kho đã xuất hàng thực tế. Chờ KTV xác nhận nhận", "", ""],
    ["ktv_confirmed", "KTV đã nhận linh kiện. Đơn mượn: chờ trả lại", "", ""],
    ["returned", "KTV đã trả linh kiện cho kho (chỉ loại mượn)", "", ""],
    ["cancelled", "Phiếu bị hủy", "", ""],
    ["", "", "", ""],
    ["Nhắc tự động", "Khi nào", "Ai nhận", "Cách nhắc"],
    ["Còn 15 phút hạn xuất", "Phiếu status=pending, còn 15 phút", "Tất cả NV Kho", "Notification trong app + sound"],
    ["Quá hạn trả mượn", "Phiếu borrow+ktv_confirmed, quá return_due_date", "Tất cả NV Kho", "1 lần/ngày (localStorage flag)"],
    ["", "", "", ""],
    ["Tích hợp KiotViet", "", "", ""],
    ["Khi kho xác nhận xuất", "Gọi createKvDeliveryOrder()", "Tạo phiếu xuất hàng trên KiotViet POS", ""],
    ["Lưu mã phiếu KV", "kiotviet_invoice_code", "Hiển thị trong chi tiết phiếu", ""],
    ["Lỗi KiotViet", "Ghi (KV lỗi) vào field", "Phiếu vẫn được tạo trong hệ thống", ""],
  ];
  return { name: "8.PhiếuXuấtKho", rows };
}

// ══════════════════════════════════════════════════════════════
// SHEET 9: Danh sách trạng thái
// ══════════════════════════════════════════════════════════════
function sheetStatusList() {
  const rows = [
    ["DANH SÁCH TRẠNG THÁI ĐƠN & MÀU SẮC", "", "", "", ""],
    ["", "", "", "", ""],
    ["Hiển thị (Display)", "PocketBase (DB)", "Màu chữ", "Màu nền", "Ý nghĩa"],
    ["Chờ KTV", "Cho KTV", "#dc2626 (đỏ)", "#fef2f2", "Đơn vừa tạo, chờ KTV nhận kiểm"],
    ["KTV Đang Kiểm", "KTV Dang Kiem", "#0369a1 (xanh dương)", "#e0f2fe", "KTV đang kiểm tra sâu (QT2)"],
    ["Chờ Báo Giá", "Cho Bao Gia", "#d97706 (vàng)", "#fffbeb", "KTV đã kiểm xong, chờ tiếp tân báo giá khách"],
    ["Chờ Xác Nhận", "Cho Xac Nhan", "#db2777 (hồng)", "#fdf2f8", "Tiếp tân đang xác nhận với khách"],
    ["Chờ KTV Sửa", "Cho KTV Sua", "#7c3aed (tím)", "#f5f3ff", "Khách đồng ý, chờ KTV nhận sửa"],
    ["Đang Sửa", "Dang Sua", "#6d28d9 (tím đậm)", "#ede9fe", "KTV đang sửa chữa"],
    ["Chờ Linh Kiện", "Cho Linh Kien", "#ea580c (cam)", "#fff7ed", "Đang chờ linh kiện về"],
    ["Hoàn Thành", "Hoan Thanh", "#059669 (xanh lá)", "#dcfce7", "Sửa xong, chờ bàn giao máy cho khách"],
    ["Đã Giao", "Da Giao", "#64748b (xám)", "#f1f5f9", "Đã bàn giao máy cho khách, kết thúc đơn"],
    ["Hủy", "Huy", "#9ca3af (xám nhạt)", "#f9fafb", "Đơn bị hủy (khách từ chối hoặc hỏng không sửa được)"],
    ["", "", "", "", ""],
    ["Mức ưu tiên", "PocketBase", "Hiển thị", "", ""],
    ["Bình thường", "Thuong", "⚪ Bình thường", "", ""],
    ["Gấp", "Gap", "🔴 Khẩn cấp", "", ""],
    ["VIP", "VIP", "⭐ VIP", "", ""],
  ];
  return { name: "9.TrạngThái", rows };
}

// ══════════════════════════════════════════════════════════════
// Build Excel XML
// ══════════════════════════════════════════════════════════════
function buildExcelXml(sheets) {
  const sheetsXml = sheets.map(sheet => {
    const rowsXml = sheet.rows.map((row, ri) => {
      const cellsXml = row.map((cell, ci) => {
        const addr = colLetter(ci) + (ri + 1);
        const val = e(cell);
        const isHeader = ri === 0 || (typeof cell === "string" && cell === cell.toUpperCase() && cell.length > 3 && !cell.includes(" ") === false && ri < 3);
        const style = (ri === 0) ? ' ss:StyleID="h1"' : (ri === 2 && ci < 4) ? ' ss:StyleID="h2"' : "";
        return `<Cell${style}><Data ss:Type="String">${val}</Data></Cell>`;
      }).join("");
      return `<Row>${cellsXml}</Row>`;
    }).join("");
    return `<Worksheet ss:Name="${e(sheet.name)}"><Table>${rowsXml}</Table></Worksheet>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>
    <Style ss:ID="h1">
      <Font ss:Bold="1" ss:Size="14" ss:Color="#1E1B4B"/>
      <Interior ss:Color="#C7D2FE" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="h2">
      <Font ss:Bold="1" ss:Color="#374151"/>
      <Interior ss:Color="#EEF2FF" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  ${sheetsXml}
</Workbook>`;
}

function colLetter(n) {
  let s = "";
  n++;
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}