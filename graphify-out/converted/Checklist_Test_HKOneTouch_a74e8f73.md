<!-- converted from Checklist_Test_HKOneTouch.xlsx -->

## Sheet: 📋 TỔNG HỢP
| HK ONE TOUCH — CHECKLIST TEST TỔNG HỢP |  |  |  |  |
| --- | --- | --- | --- | --- |
| Role | Tổng test case | 👍 Tốt | 👎 Chưa được | Tỷ lệ đạt |
| 👑 Quản lý | 0 | 0 | 0 | 0% |
| 🎧 Tiếp tân | 0 | 0 | 0 | 0% |
| 🔧 Kỹ thuật viên | 0 | 0 | 0 | 0% |
| 📦 Nhân viên kho | 0 | 0 | 0 | 0% |
| 💰 Thu ngân / Kế toán | 0 | 0 | 0 | 0% |
| TỔNG |  |  |  |  |
## Sheet: Quan ly
| CHECKLIST TEST — 👑 Quản lý |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- |
| STT | Module | Tính năng | Mô tả test case | 👍 Tốt | 👎 Chưa được | Nhận xét / Góp ý |
| ── 📊 TỔNG QUAN & DASHBOARD ── |  |  |  |  |  |  |
| 1 | Dashboard | Xem dashboard tổng quan | Hiển thị: đơn sửa, bán hàng, doanh thu, tồn kho | ☐ | ☐ |  |
| 2 | Việc của tôi | Trang 'Việc của tôi' theo role | 3 cấp: 🔴 Khẩn cấp / 🟡 Cần xử lý / 🟢 Đang chờ | ☐ | ☐ |  |
| 3 | Thống kê | Báo cáo thống kê tổng | Số đơn hoàn thành, doanh thu, KPI nhân viên | ☐ | ☐ |  |
| 4 | Sidebar | Accordion navigation 8 nhóm | Sửa chữa, Bán hàng, Kho, Mua hàng, KH, Kế toán, BC, Thiết lập | ☐ | ☐ |  |
| ── 🔧 SỬA CHỮA — Toàn quyền ── |  |  |  |  |  |  |
| 5 | Đơn sửa chữa | Tạo đơn sửa chữa mới | KH, SĐT, thiết bị, IMEI, passcode, lỗi, ảnh | ☐ | ☐ |  |
| 6 | Đơn sửa chữa | Phân công kỹ thuật viên | Chọn KTV, ưu tiên, dự kiến xong | ☐ | ☐ |  |
| 7 | Đơn sửa chữa | Chỉnh sửa đơn | Sửa thông tin, cập nhật trạng thái, giá | ☐ | ☐ |  |
| 8 | Đơn sửa chữa | Xóa đơn sửa chữa | Chỉ manager có quyền xóa | ☐ | ☐ |  |
| 9 | Đơn sửa chữa | Bàn giao máy cho khách | QT1 → QT2 → Handover, ký tên, media | ☐ | ☐ |  |
| 10 | Đơn sửa chữa | In phiếu tiếp nhận (A5) | In nhiệt localhost:7979, có QR code | ☐ | ☐ |  |
| 11 | Đơn sửa chữa | In hóa đơn sửa chữa (A5) | Layout gọn, QR code, liệt kê linh kiện | ☐ | ☐ |  |
| 12 | Đơn sửa chữa | Lịch sử thay đổi (OrderHistory) | Ghi log mọi thay đổi trạng thái, giá, phân công | ☐ | ☐ |  |
| 13 | Chat đơn hàng | Chat trong đơn sửa chữa | Tin nhắn, ảnh, voice, @mention KTV | ☐ | ☐ |  |
| 14 | Bảo hành | Theo dõi bảo hành | warranty_days, Product QR truy xuất lịch sử | ☐ | ☐ |  |
| ── 🛒 BÁN HÀNG — Toàn quyền ── |  |  |  |  |  |  |
| 15 | POS Bán hàng | Tạo đơn bán hàng | Chọn sản phẩm, số lượng, KH, giảm giá | ☐ | ☐ |  |
| 16 | POS Bán hàng | Xác nhận thanh toán | Thu ngân confirm: tiền mặt/CK, ghi CashJournal | ☐ | ☐ |  |
| 17 | POS Bán hàng | In hóa đơn bán lẻ (A5) | In nhiệt A5 có QR code | ☐ | ☐ |  |
| 18 | POS Bán hàng | Trừ tồn kho khi bán | SparePart.stock_qty + StockLedger.qty_on_hand giảm | ☐ | ☐ |  |
| 19 | Lịch sử bán | Xem lịch sử bán hàng | Lọc theo ngày, xem chi tiết, in lại | ☐ | ☐ |  |
| 20 | Báo cáo | Báo cáo lợi nhuận | Doanh thu - chi phí nhập - chi phí linh kiện | ☐ | ☐ |  |
| ── 📦 KHO — Toàn quyền ── |  |  |  |  |  |  |
| 21 | Nhập hàng | Tạo phiếu nhập hàng | Chọn kho, NCC, loại (TB/LK), thêm mặt hàng | ☐ | ☐ |  |
| 22 | Nhập hàng | Nhập theo Đơn mua (PO) | Chọn PO → fill items, cập nhật qty_received | ☐ | ☐ |  |
| 23 | Nhập hàng | Cập nhật tồn kho khi nhập | SparePart + StockLedger + StockMovement | ☐ | ☐ |  |
| 24 | Nhập hàng | Nhập thiết bị có IMEI | Mỗi IMEI = 1 record SparePart riêng | ☐ | ☐ |  |
| 25 | Nhập hàng | Xóa phiếu nhập (rollback) | Trừ stock_qty + trừ ledger + ghi movement | ☐ | ☐ |  |
| 26 | Nhập hàng | Xem chi tiết phiếu nhập | Bottom sheet: items, SKU, IMEI, QR, thành tiền | ☐ | ☐ |  |
| 27 | Xuất LK | Tạo phiếu xuất LK (sửa) | KTV đề nghị → Kho xác nhận → KTV nhận | ☐ | ☐ |  |
| 28 | Xuất LK | Tạo phiếu xuất LK (mượn) | Có hạn trả, nhắc nhở tự động | ☐ | ☐ |  |
| 29 | Xuất LK | Reserve stock khi đề xuất | qty_reserved tăng, qty_available giảm | ☐ | ☐ |  |
| 30 | Xuất LK | Trừ tồn kho khi giao | qty_on_hand giảm, qty_reserved giảm, ghi movement | ☐ | ☐ |  |
| 31 | Xuất LK | Hoàn trả linh kiện mượn | Cập nhật qty_used, qty_returned | ☐ | ☐ |  |
| 32 | Chuyển kho | Tạo phiếu chuyển kho | Chọn kho xuất/nhận, chọn LK, reserve stock | ☐ | ☐ |  |
| 33 | Chuyển kho | Xác nhận chuyển kho | Trừ kho nguồn + cộng kho nhận + 2 movements | ☐ | ☐ |  |
| 34 | Chuyển kho | Hủy phiếu chuyển | Release reserved stock | ☐ | ☐ |  |
| 35 | Kiểm kho | Tạo phiếu kiểm kho | Theo zone/toàn kho, tạo count items từ ledger | ☐ | ☐ |  |
| 36 | Kiểm kho | Nhập số lượng thực tế | Tính chênh lệch qty_diff, diff_value | ☐ | ☐ |  |
| 37 | Kiểm kho | Duyệt kiểm kho | Cập nhật ledger theo số thực, ghi movement | ☐ | ☐ |  |
| 38 | Thẻ kho | Xem StockLedger | Lọc theo kho, tìm kiếm, tổng giá trị tồn | ☐ | ☐ |  |
| 39 | Thẻ kho | Điều chỉnh tồn kho thủ công | Nhập qty thực, ghi movement adjust | ☐ | ☐ |  |
| 40 | Thẻ kho | Xem StockMovement history | Lọc: import/sale/transfer/usage/adjust/count | ☐ | ☐ |  |
| 41 | Linh kiện | Quản lý SparePart | Thêm, sửa, xóa LK, SKU, giá, tồn kho | ☐ | ☐ |  |
| 42 | Linh kiện | Báo lỗi LK (defect) | Ghi movement defect, trừ tồn kho | ☐ | ☐ |  |
| ── 🛒 MUA HÀNG (PO) ── |  |  |  |  |  |  |
| 43 | Đơn mua hàng | Tạo Đơn đặt hàng NCC (PO) | Chọn NCC, thêm items, số lượng, đơn giá | ☐ | ☐ |  |
| 44 | Đơn mua hàng | Nhập hàng theo PO | Nhập nhiều lần, cộng dồn qty_received | ☐ | ☐ |  |
| 45 | Đơn mua hàng | Thanh toán NCC | Tạo DebtVoucher + CashJournal entry | ☐ | ☐ |  |
| 46 | Đơn mua hàng | Theo dõi trạng thái PO | pending → partial → received → closed | ☐ | ☐ |  |
| ── 👥 KHÁCH HÀNG ── |  |  |  |  |  |  |
| 47 | Khách hàng | Xem danh sách KH | Tìm kiếm, lọc, xem lịch sử mua/sửa | ☐ | ☐ |  |
| 48 | Khách hàng | Thêm khách hàng mới | Tên, SĐT, địa chỉ | ☐ | ☐ |  |
| 49 | Khách hàng | Chỉnh sửa thông tin KH | Cập nhật địa chỉ, ghi chú | ☐ | ☐ |  |
| 50 | Khách hàng | Xem lịch sử đơn của KH | Tổng đơn, tổng chi tiêu | ☐ | ☐ |  |
| ── 💰 KẾ TOÁN ── |  |  |  |  |  |  |
| 51 | Sổ quỹ | Xem CashJournal | Thu/chi tiền mặt, lọc theo ngày | ☐ | ☐ |  |
| 52 | Sổ quỹ | Tạo entry thủ công | Ghi thu/chi với lý do, số tiền | ☐ | ☐ |  |
| 53 | Công nợ NCC | Xem DebtVoucher | Danh sách nợ NCC, số dư còn lại | ☐ | ☐ |  |
| 54 | Công nợ NCC | Thanh toán nợ NCC | DebtPayment + cập nhật balance + CashJournal | ☐ | ☐ |  |
| 55 | Chi phí | Quản lý Expense | Thêm, sửa, xóa chi phí | ☐ | ☐ |  |
| 56 | Báo cáo | Báo cáo lợi nhuận | Doanh thu - chi phí, lọc theo tháng | ☐ | ☐ |  |
| 57 | Thu ngân | Xác nhận thu tiền bán hàng | Tiền mặt/CK, ghi sổ quỹ | ☐ | ☐ |  |
| ── 📊 BÁO CÁO ── |  |  |  |  |  |  |
| 58 | Báo cáo NXT | Báo cáo Nhập-Xuất-Tồn | Lọc theo kho, thời gian, chi tiết movements | ☐ | ☐ |  |
| 59 | Báo cáo KPI | Báo cáo KPI nhân viên | Thời gian phản hồi, đơn hoàn thành, điểm KPI | ☐ | ☐ |  |
| 60 | Báo cáo doanh thu | Báo cáo doanh thu bán hàng | Theo ngày/tháng, so sánh | ☐ | ☐ |  |
| 61 | Báo cáo chi phí | Báo cáo chi phí nhập hàng | Theo NCC, theo tháng | ☐ | ☐ |  |
| ── ⚙️ THIẾT LẬP ── |  |  |  |  |  |  |
| 62 | Nhân viên | Quản lý Staff | Thêm, sửa, xóa, active/deactive | ☐ | ☐ |  |
| 63 | Nhân viên | Reset mật khẩu | Set must_change_password=true | ☐ | ☐ |  |
| 64 | Phân quyền | Cấu hình Role Permissions | Ma trận phân quyền, toggle từng tài nguyên | ☐ | ☐ |  |
| 65 | Kho | Quản lý Warehouse | Thêm, sửa kho, manager, zone, location | ☐ | ☐ |  |
| 66 | Mẫu in | Tùy chỉnh mẫu in nhiệt | Edit HTML template, lưu app_settings, reset | ☐ | ☐ |  |
| 67 | Cài đặt | AppSettings | Tên shop, địa chỉ, SĐT, logo, cấu hình | ☐ | ☐ |  |
| 68 | Telegram | Cấu hình Telegram Bot | Token, chat ID, test thông báo | ☐ | ☐ |  |
## Sheet: Tiep tan
| CHECKLIST TEST — 🎧 Tiếp tân |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- |
| STT | Module | Tính năng | Mô tả test case | 👍 Tốt | 👎 Chưa được | Nhận xét / Góp ý |
| ── 📊 TỔNG QUAN ── |  |  |  |  |  |  |
| 1 | Việc của tôi | Trang 'Việc của tôi' | Đơn mới, đơn chờ tiếp nhận, việc cần làm | ☐ | ☐ |  |
| 2 | Thông báo | Nhận thông báo realtime (SSE) | Đơn mới, chuyển trạng thái, @mention | ☐ | ☐ |  |
| 3 | Thông báo | Vuốt xóa thông báo | Swipe-to-delete notification | ☐ | ☐ |  |
| ── 🔧 SỬA CHỮA ── |  |  |  |  |  |  |
| 4 | Đơn sửa chữa | Tạo đơn sửa chữa mới | KH, SĐT, thiết bị, IMEI, passcode, lỗi, ảnh | ☐ | ☐ |  |
| 5 | Đơn sửa chữa | Quét mã vạch IMEI/QR | BarcodeDetector + jsQR fallback | ☐ | ☐ |  |
| 6 | Đơn sửa chữa | Chụp ảnh thiết bị | Máy trước, máy sau, video tình trạng | ☐ | ☐ |  |
| 7 | Đơn sửa chữa | Đánh dấu tình trạng ngoại quan | Tag pill: trầy, móp, ướt, nứt... | ☐ | ☐ |  |
| 8 | Đơn sửa chữa | In phiếu tiếp nhận (A5) | In nhiệt, QR code, tag lỗi ngoại quan | ☐ | ☐ |  |
| 9 | Đơn sửa chữa | Phân công KTV | Chọn kỹ thuật viên, độ ưu tiên | ☐ | ☐ |  |
| 10 | Đơn sửa chữa | Cập nhật trạng thái cơ bản | Tiếp nhận → Đang sửa, không xóa/sửa giá | ☐ | ☐ |  |
| 11 | Đơn sửa chữa | Xem danh sách đơn | Lọc theo trạng thái, tìm kiếm | ☐ | ☐ |  |
| 12 | Đơn sửa chữa | Chat trong đơn | Tin nhắn, ảnh, @mention KTV/quản lý | ☐ | ☐ |  |
| ── 👥 KHÁCH HÀNG ── |  |  |  |  |  |  |
| 13 | Khách hàng | Thêm khách hàng mới | Tên, SĐT, địa chỉ | ☐ | ☐ |  |
| 14 | Khách hàng | Tìm kiếm khách hàng | Theo SĐT, tên | ☐ | ☐ |  |
| 15 | Khách hàng | Xem lịch sử sửa chữa | Theo product_qr hoặc SĐT | ☐ | ☐ |  |
| ── 🛒 BÁN HÀNG (nếu có quyền) ── |  |  |  |  |  |  |
| 16 | POS | Tạo đơn bán hàng | Chọn sản phẩm, số lượng (nếu được cấp quyền) | ☐ | ☐ |  |
| 17 | POS | In hóa đơn | In nhiệt A5 | ☐ | ☐ |  |
## Sheet: Ky thuat vien
| CHECKLIST TEST — 🔧 Kỹ thuật viên |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- |
| STT | Module | Tính năng | Mô tả test case | 👍 Tốt | 👎 Chưa được | Nhận xét / Góp ý |
| ── 📊 TỔNG QUAN ── |  |  |  |  |  |  |
| 1 | Việc của tôi | Trang 'Việc của tôi' | Đơn phân công theo 3 cấp ưu tiên | ☐ | ☐ |  |
| 2 | Thông báo | Nhận thông báo khi được phân công | SSE realtime, âm báo | ☐ | ☐ |  |
| 3 | Thông báo | Nhận @mention trong chat | Highlight notification | ☐ | ☐ |  |
| ── 🔧 SỬA CHỮA ── |  |  |  |  |  |  |
| 4 | Đơn sửa chữa | Xem đơn được phân công | Danh sách đơn trạng thái 'Đang sửa' | ☐ | ☐ |  |
| 5 | Đơn sửa chữa | Nhận/Chấp nhận đơn | Tiếp nhận → Đang sửa | ☐ | ☐ |  |
| 6 | Đơn sửa chữa | Kiểm tra QT1 (chẩn đoán) | Checklist chẩn đoán, ghi note, chụp ảnh | ☐ | ☐ |  |
| 7 | Đơn sửa chữa | Đề xuất linh kiện sửa | Chọn LK, số lượng → tạo StockExportRequest | ☐ | ☐ |  |
| 8 | Đơn sửa chữa | Nhận linh kiện từ kho | Xác nhận ktv_confirmed + media | ☐ | ☐ |  |
| 9 | Đơn sửa chữa | Kiểm tra QT2 (QC) | Checklist sau sửa, ghi note, chụp ảnh | ☐ | ☐ |  |
| 10 | Đơn sửa chữa | Cập nhật ghi chú kỹ thuật | technician_note, mô tả lỗi, cách xử lý | ☐ | ☐ |  |
| 11 | Đơn sửa chữa | Cập nhật giá dự kiến/final_cost | Chi phí sửa chữa, linh kiện | ☐ | ☐ |  |
| 12 | Đơn sửa chữa | Đánh dấu hoàn thành | Đang sửa → Hoàn thành → chờ bàn giao | ☐ | ☐ |  |
| 13 | Đơn sửa chữa | Chat trong đơn | Trao đổi với tiếp tân/quản lý, gửi ảnh lỗi | ☐ | ☐ |  |
| 14 | Đơn sửa chữa | Xem lịch sử sửa (Product QR) | Truy xuất lịch sử theo serial/IMEI | ☐ | ☐ |  |
| 15 | Đơn sửa chữa | KPI thời gian phản hồi | -1 KPI >15p, -1 KPI >60p, -2 KPI >1300p | ☐ | ☐ |  |
| ── 📦 LINH KIỆN ── |  |  |  |  |  |  |
| 16 | Xuất LK | Đề nghị xuất LK sửa | Chọn LK, số lượng, loại: sửa | ☐ | ☐ |  |
| 17 | Xuất LK | Đề nghị xuất LK mượn | Có hạn trả, note lý do mượn | ☐ | ☐ |  |
| 18 | Xuất LK | Xác nhận nhận hàng từ kho | ktv_confirmed + chụp ảnh/video | ☐ | ☐ |  |
| 19 | Xuất LK | Hoàn trả LK mượn | Cập nhật qty_used, qty_returned | ☐ | ☐ |  |
| 20 | Xuất LK | Xem danh sách phiếu xuất của mình | Lọc theo trạng thái, theo đơn | ☐ | ☐ |  |
## Sheet: Nhan vien kho
| CHECKLIST TEST — 📦 Nhân viên kho |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- |
| STT | Module | Tính năng | Mô tả test case | 👍 Tốt | 👎 Chưa được | Nhận xét / Góp ý |
| ── 📊 TỔNG QUAN ── |  |  |  |  |  |  |
| 1 | Việc của tôi | Trang 'Việc của tôi' | Phiếu xuất chờ xác nhận, phiếu nhập, kiểm kho | ☐ | ☐ |  |
| 2 | Thông báo | Nhận thông báo xuất LK | Khi KTV đề nghị xuất → kho nhận thông báo | ☐ | ☐ |  |
| 3 | Thông báo | Nhắc hạn trả LK mượn | Tự động nhắc khi đến hạn | ☐ | ☐ |  |
| ── 📦 NHẬP HÀNG ── |  |  |  |  |  |  |
| 4 | Nhập hàng | Tạo phiếu nhập hàng | Chọn kho, NCC, loại, thêm mặt hàng | ☐ | ☐ |  |
| 5 | Nhập hàng | Nhập theo PO | Chọn PO → fill items, cập nhật qty_received | ☐ | ☐ |  |
| 6 | Nhập hàng | Chụp ảnh linh kiện nhập | Photo/video cho từng item | ☐ | ☐ |  |
| 7 | Nhập hàng | Quét QR/SKU linh kiện | BarcodeDetector quét nhanh | ☐ | ☐ |  |
| 8 | Nhập hàng | Cập nhật tồn kho tự động | SparePart + StockLedger + StockMovement | ☐ | ☐ |  |
| 9 | Nhập hàng | Xem chi tiết phiếu nhập | Bottom sheet: items, SKU, IMEI, QR, thành tiền | ☐ | ☐ |  |
| 10 | Nhập hàng | Xóa phiếu nhập (rollback) | Trừ tồn kho, ghi movement adjust | ☐ | ☐ |  |
| ── 📦 XUẤT LINH KIỆN ── |  |  |  |  |  |  |
| 11 | Xuất LK | Xác nhận phiếu xuất từ KTV | warehouse_confirmed + media + note | ☐ | ☐ |  |
| 12 | Xuất LK | Giao linh kiện cho KTV | Trừ tồn kho, release reserved, ghi movement | ☐ | ☐ |  |
| 13 | Xuất LK | Xác nhận hoàn trả LK mượn | return_confirmed + cập nhật qty | ☐ | ☐ |  |
| 14 | Xuất LK | Xem danh sách phiếu xuất | Lọc theo trạng thái, thời gian, loại | ☐ | ☐ |  |
| ── 📦 CHUYỂN KHO ── |  |  |  |  |  |  |
| 15 | Chuyển kho | Tạo phiếu chuyển kho | Chọn kho nguồn/đích, chọn LK, reserve | ☐ | ☐ |  |
| 16 | Chuyển kho | Xác nhận nhận chuyển kho | Cộng kho nhận + trừ kho nguồn + 2 movements | ☐ | ☐ |  |
| 17 | Chuyển kho | Hủy phiếu chuyển | Release reserved stock | ☐ | ☐ |  |
| 18 | Chuyển kho | Xem danh sách phiếu chuyển | Lọc theo trạng thái | ☐ | ☐ |  |
| ── 📦 KIỂM KHO ── |  |  |  |  |  |  |
| 19 | Kiểm kho | Tạo phiếu kiểm kho | Chọn kho/zone, tạo count items từ ledger | ☐ | ☐ |  |
| 20 | Kiểm kho | Đếm số lượng thực tế | Nhập qty_actual, tính chênh lệch | ☐ | ☐ |  |
| 21 | Kiểm kho | Duyệt kiểm kho (nếu quyền) | Cập nhật ledger + ghi movement count_adjust | ☐ | ☐ |  |
| 22 | Kiểm kho | Xem danh sách phiếu kiểm | Lọc theo trạng thái, kho | ☐ | ☐ |  |
| ── 📦 THẺ KHO & LINH KIỆN ── |  |  |  |  |  |  |
| 23 | Thẻ kho | Xem StockLedger | Lọc theo kho, tìm kiếm, tổng giá trị | ☐ | ☐ |  |
| 24 | Thẻ kho | Điều chỉnh tồn kho | Nhập qty thực, ghi movement adjust | ☐ | ☐ |  |
| 25 | Thẻ kho | Xem lịch sử StockMovement | Lọc: import/transfer/usage/adjust | ☐ | ☐ |  |
| 26 | Linh kiện | Xem danh sách SparePart | Tìm kiếm, lọc theo category | ☐ | ☐ |  |
| 27 | Linh kiện | Báo lỗi LK (defect) | Ghi movement defect, trừ tồn kho | ☐ | ☐ |  |
| 28 | Linh kiện | Xem LK đang reserve | Danh sách qty_reserved > 0 | ☐ | ☐ |  |
## Sheet: Thu ngan Ke toan
| CHECKLIST TEST — 💰 Thu ngân / Kế toán |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- |
| STT | Module | Tính năng | Mô tả test case | 👍 Tốt | 👎 Chưa được | Nhận xét / Góp ý |
| ── 📊 TỔNG QUAN ── |  |  |  |  |  |  |
| 1 | Việc của tôi | Trang 'Việc của tôi' | Đơn chờ thu tiền, nợ đến hạn | ☐ | ☐ |  |
| 2 | Thông báo | Nhận thông báo đơn hoàn thành | Khi đơn sửa xong → thu ngân chuẩn bị thu | ☐ | ☐ |  |
| ── 🛒 BÁN HÀNG & THU NGÂN ── |  |  |  |  |  |  |
| 3 | POS | Tạo đơn bán hàng | Chọn sản phẩm, số lượng, KH, giảm giá | ☐ | ☐ |  |
| 4 | POS | Xác nhận thanh toán | Tiền mặt/CK, ghi CashJournal entry | ☐ | ☐ |  |
| 5 | POS | In hóa đơn bán lẻ (A5) | In nhiệt A5 có QR code | ☐ | ☐ |  |
| 6 | POS | In hóa đơn sửa chữa (A5) | Layout gọn, liệt kê LK + chi phí | ☐ | ☐ |  |
| 7 | Lịch sử | Xem lịch sử bán hàng | Lọc theo ngày, in lại hóa đơn | ☐ | ☐ |  |
| 8 | Lịch sử | Xem chi tiết đơn bán | Items, giá, thanh toán, khách hàng | ☐ | ☐ |  |
| ── 💰 SỔ QUỸ ── |  |  |  |  |  |  |
| 9 | Sổ quỹ | Xem CashJournal | Danh sách thu/chi, lọc theo ngày, tổng dư | ☐ | ☐ |  |
| 10 | Sổ quỹ | Tạo phiếu thu thủ công | Ghi khoản thu với lý do, số tiền | ☐ | ☐ |  |
| 11 | Sổ quỹ | Tạo phiếu chi thủ công | Ghi khoản chi với lý do, số tiền | ☐ | ☐ |  |
| 12 | Sổ quỹ | Tự động ghi sổ khi bán hàng | Confirm thu tiền → CashJournal entry_type=receipt | ☐ | ☐ |  |
| 13 | Sổ quỹ | Tự động ghi sổ khi nhập hàng | Thanh toán NCC → CashJournal entry_type=payment | ☐ | ☐ |  |
| ── 💰 CÔNG NỢ NCC ── |  |  |  |  |  |  |
| 14 | Công nợ | Xem danh sách DebtVoucher | NCC, số nợ, số đã trả, còn lại | ☐ | ☐ |  |
| 15 | Công nợ | Tạo phiếu thanh toán nợ | DebtPayment + cập nhật balance + CashJournal | ☐ | ☐ |  |
| 16 | Công nợ | Xem lịch sử thanh toán | Danh sách DebtPayment theo NCC | ☐ | ☐ |  |
| ── 💰 CHI PHÍ ── |  |  |  |  |  |  |
| 17 | Chi phí | Thêm chi phí | Loại, số tiền, ngày, ghi chú | ☐ | ☐ |  |
| 18 | Chi phí | Sửa chi phí | Cập nhật thông tin | ☐ | ☐ |  |
| 19 | Chi phí | Xóa chi phí | Xóa — chỉ manager/accountant | ☐ | ☐ |  |
| 20 | Chi phí | Xem danh sách chi phí | Lọc theo tháng, loại | ☐ | ☐ |  |
| ── 📊 BÁO CÁO ── |  |  |  |  |  |  |
| 21 | Báo cáo | Báo cáo doanh thu | Theo ngày/tháng, so sánh | ☐ | ☐ |  |
| 22 | Báo cáo | Báo cáo chi phí | Theo loại, theo tháng | ☐ | ☐ |  |
| 23 | Báo cáo | Báo cáo lợi nhuận | Doanh thu - chi phí nhập - chi phí LK | ☐ | ☐ |  |