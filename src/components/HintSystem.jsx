/**
 * HintSystem.jsx — Trợ giúp nhanh trong app
 *
 * Cách dùng:
 *   <HelpButton page="cashier_home" />        // nút ? trên header: mở danh sách gợi ý của trang
 *   <HintDot page="cashier_home" id="collect" /> // dấu ? nhỏ cạnh một mục: bấm xem gợi ý
 *   <HintArea page="cashier_home" id="collect">{...}</HintArea> // bấm giữ 3 giây vào vùng đó
 *
 * Nội dung gợi ý khai báo ở HINTS bên dưới — muốn sửa chữ chỉ cần sửa ở đây.
 */
import React, { useEffect, useRef, useState } from "react";

export const HINTS = {
  // ── SỬA CHỮA ────────────────────────────────────────────────
  my_tasks: { title: "Việc của tôi", items: [
    { id: "list", t: "Danh sách việc", d: "Việc chia 3 mức: 🔴 khẩn cấp, 🟡 cần xử lý, 🟢 đang chờ. Bấm vào một việc để mở đúng đơn hoặc đúng màn hình cần làm." },
    { id: "overdue", t: "Việc quá hạn", d: "Đơn chưa nhận quá 60 phút sẽ báo tổ trưởng, quá 120 phút báo cả quản lý. Tổ trưởng có thể chia lại việc cho tổ viên." },
    { id: "kpi", t: "KPI", d: "Phản hồi chậm bị trừ điểm: quá 15 phút -1, quá 60 phút -1 và chuyển việc, quá 1300-1500 phút -2." },
  ]},
  dashboard: { title: "Tổng quan quản lý", items: [
    { id: "cards", t: "Các thẻ số liệu", d: "Bấm vào thẻ để mở danh sách chi tiết tương ứng: đơn đang sửa, chờ linh kiện, chờ thu tiền, doanh thu hôm nay." },
    { id: "period", t: "Chọn kỳ", d: "Chọn hôm nay, tuần này, tháng này hoặc khoảng ngày tự chọn. Số liệu tính theo ngày tạo của đơn." },
  ]},
  ktv_home: { title: "Góc kỹ thuật viên", items: [
    { id: "receive", t: "Nhận đơn", d: "Bấm nhận đơn để đơn chuyển sang trạng thái của bạn. Đơn liên quan linh kiện chờ nhập sẽ không bắt nhận và không tính KPI." },
    { id: "status", t: "Cập nhật trạng thái", d: "Khi cập nhật trạng thái thủ công, app hiện danh sách người sẽ nhận thông báo để anh kiểm tra trước khi xác nhận." },
  ]},
  rec_home: { title: "Tiếp nhận", items: [
    { id: "new", t: "Tạo đơn", d: "Quét mã máy để tra lịch sử sửa chữa theo mã sản phẩm, nhập lỗi và tình trạng ngoại quan, in phiếu tiếp nhận A5 kèm mã QR." },
    { id: "photo", t: "Ảnh & video", d: "Chụp ảnh hoặc quay video tình trạng máy lúc nhận để đối chiếu khi trả máy. Ảnh được lưu theo đơn." },
  ]},
  board: { title: "Theo dõi đơn sửa (Kanban)", items: [
    { id: "drag", t: "Kéo thả", d: "Kéo thẻ đơn sang cột khác để đổi trạng thái. Cột được giữ vị trí cuộn khi cập nhật." },
    { id: "filter", t: "Lọc", d: "Lọc theo kỹ thuật viên, trạng thái, mức ưu tiên để xem nhanh đơn của từng người." },
  ]},
  tasks: { title: "Danh sách đơn", items: [
    { id: "search", t: "Tìm đơn", d: "Tìm theo mã đơn, tên khách, số điện thoại hoặc IMEI. Nháy đôi mã đơn trên PC (bấm giữ trên mobile) để copy nhanh." },
    { id: "detail", t: "Chi tiết đơn", d: "Mở đơn để xem lịch sử xử lý, chat nội bộ, linh kiện đã dùng và báo giá. Nút Thu tiền chỉ hiện khi đơn chưa thu và bạn có quyền thu." },
  ]},
  new: { title: "Tạo đơn sửa chữa", items: [
    { id: "quote", t: "Báo giá ngay", d: "Chọn 'Tạo Đơn & Báo Giá Ngay' khi cần báo giá trước khi sửa. Linh kiện chưa có hàng thì tick 'Chờ nhập' kèm ngày dự kiến về." },
    { id: "waiting", t: "Chờ linh kiện", d: "Đơn có linh kiện chờ nhập không bắt kỹ thuật viên nhận, không tính KPI và chưa gửi thông báo cho tới khi kho xác nhận hàng về." },
  ]},
  wh_orders: { title: "Đơn kho", items: [
    { id: "list", t: "Danh sách đơn", d: "Các đơn cần kho xử lý: cấp linh kiện, nhận hàng về, xác nhận xuất kho. Bấm vào đơn để xem chi tiết và xác nhận." },
  ]},

  // ── BÁN HÀNG ────────────────────────────────────────────────
  cashier_home: { title: "Thu ngân (POS)", items: [
    { id: "sale", t: "Bán hàng", d: "Chọn hàng, chọn khách rồi bấm Tạo đơn. Đơn tại quầy vẫn phải qua bước soạn hàng. Khách trả ngay thì chọn Tiền mặt hoặc Chuyển khoản." },
    { id: "orders", t: "Đơn hàng", d: "Xem lại mọi đơn đã tạo. Đơn còn 'Chờ thu tiền' có nút Thu tiền (nếu có quyền) và nút Xem hoá đơn để kiểm tra hàng trước khi thu." },
    { id: "collect", t: "Thu tiền", d: "Danh sách đơn chờ thu. Bấm Xem hóa đơn để kiểm tra hàng, giá, giảm giá; bấm Xác nhận Thu tiền để ghi nhận và in hoá đơn." },
    { id: "reconcile", t: "Đối soát", d: "Cuối ca nhập tiền đầu ca, tiền mặt thực tế và chuyển khoản, app tự tính chênh lệch để nộp kế toán." },
    { id: "invoice", t: "Xem hóa đơn", d: "Hiện đầy đủ hàng hoá, số lượng, đơn giá, giảm giá và số tiền khách phải trả trước khi thu. Có nút In riêng nếu khách cần." },
  ]},
  sale_order: { title: "Quản lý đơn bán hàng", items: [
    { id: "create", t: "Tạo đơn", d: "Chọn khách (có thể tạo mới ngay bằng nút +), chọn hàng theo SKU, chọn hình thức giao: Tại quầy, ĐVVC hoặc nhân viên giao." },
    { id: "status", t: "Trạng thái đơn", d: "Chờ thu tiền → Đã thu → Soạn hàng → Bàn giao/Khách đã nhận. Mọi đơn đã thu đều phải qua soạn hàng, kể cả khách lấy tại quầy." },
    { id: "print", t: "In", d: "In hoá đơn A5 có mã QR dẫn tới đơn. Đơn còn 'Chờ báo giá' khi in sẽ có watermark IN NHÁP." },
  ]},
  sale_history: { title: "Lịch sử bán hàng", items: [
    { id: "filter", t: "Lọc", d: "Lọc theo khoảng ngày, nhân viên bán, hình thức thanh toán và trạng thái đơn." },
    { id: "detail", t: "Chi tiết", d: "Bấm một đơn để xem hàng hoá và các nút Thu tiền / In lại hoá đơn / Đổi trả (tuỳ quyền và trạng thái đơn)." },
  ]},
  return_order: { title: "Xử lý đổi trả", items: [
    { id: "lookup", t: "Tra đơn gốc", d: "Nhập mã đơn gốc để app tự điền khách, hàng và giá đã bán, tránh nhập tay sai." },
    { id: "stock", t: "Nhập lại kho", d: "Chọn kho nhập lại hàng trả: kho bán (hàng còn bán được) hoặc kho lỗi. App kiểm tra tồn và cảnh báo nếu đơn đã từng đổi trả." },
    { id: "money", t: "Tiền trả khách", d: "Phiếu trả tự giảm doanh thu và ghi sổ quỹ theo hình thức hoàn tiền đã chọn." },
  ]},
  price_policy: { title: "Chính sách giá", items: [
    { id: "rule", t: "Quy tắc giá", d: "Đặt giá bán theo nhóm khách hoặc nhóm hàng. Giá áp dụng sẽ tự điền khi tạo đơn, vẫn sửa tay được từng dòng." },
  ]},
  product_mgr: { title: "Danh mục hàng hóa", items: [
    { id: "add", t: "Thêm hàng", d: "Nhập tên, SKU, đơn vị, giá vốn, giá bán và ảnh. SKU trùng sẽ bị chặn để tránh lệch tồn kho." },
    { id: "hide", t: "Ẩn/hiện", d: "Bấm biểu tượng con mắt để ẩn hàng ngừng kinh doanh nhưng vẫn giữ lịch sử bán và tồn kho." },
    { id: "import", t: "Nhập Excel", d: "Dùng Nhập/Xuất Excel để cập nhật hàng loạt. Tải file mẫu trước rồi điền theo đúng cột." },
  ]},
  combo: { title: "Combo sản phẩm", items: [
    { id: "build", t: "Tạo combo", d: "Chọn các linh kiện con và số lượng. Khi bán combo, app tự trừ tồn từng món con và ghi thẻ kho riêng." },
  ]},

  // ── KHO ─────────────────────────────────────────────────────
  wh_home: { title: "Kho tổng quan", items: [
    { id: "todo", t: "Việc cần làm", d: "Các phiếu chờ kho xác nhận: xuất linh kiện, nhập hàng về, chuyển kho. Bấm vào để xử lý ngay." },
  ]},
  wh_manager: { title: "Quản lý kho", items: [
    { id: "transfer", t: "Tạo phiếu chuyển kho", d: "Chọn kho xuất trước, rồi chọn kho nhận. Kho xuất là nơi lấy hàng, kho nhận là nơi nhận hàng; hai kho phải khác nhau." },
    { id: "transfer_item", t: "Chọn hàng để chuyển", d: "Gõ tên hoặc SKU để tìm. Hàng còn tồn trong kho xuất hiện trước kèm chip Tồn; hàng hết tồn không cho chuyển." },
    { id: "transfer_qty", t: "Số lượng (SL)", d: "Không được lớn hơn tồn hiện có của kho xuất. Nếu lớn hơn, app báo vàng và chặn khi bấm tạo phiếu." },
    { id: "transfer_price", t: "Đơn giá", d: "Giá vốn của hàng, dùng tính tổng giá trị phiếu và bút toán sổ kho. Chọn hàng xong app tự điền." },
    { id: "kho16", t: "Kho 16 là kho chính", d: "Hàng NCC về phải nhập vào Kho 16 trước, sau đó mới chuyển sang Kho BH hoặc Kho Haravan để bán." },
  ]},
  wh_ledger: { title: "Tồn kho", items: [
    { id: "stock", t: "Xem tồn", d: "Tồn mặc định tính theo Kho BH; các kho khác xem trong bong bóng thông tin (i) cạnh số lượng." },
    { id: "adjust", t: "Điều chỉnh tồn", d: "Sửa số lượng thực tế khi phát hiện lệch. Mọi điều chỉnh đều ghi vào thẻ kho và nhật ký thao tác kèm số cũ - số mới." },
  ]},
  wh_export: { title: "Xuất kho", items: [
    { id: "request", t: "Phiếu xuất", d: "Phiếu xuất sửa hoặc xuất mượn (có hạn trả). Cần xác nhận hai chiều Kho - KTV kèm ảnh/video để đối chứng." },
    { id: "return", t: "Nhắc trả", d: "Phiếu mượn tới hạn chưa trả sẽ được nhắc tự động. Tra cứu lại trong mục phiếu xuất." },
  ]},
  wh_import: { title: "Nhập kho", items: [
    { id: "create", t: "Tạo phiếu nhập", d: "Chọn kho nhận (hàng NCC về nhập Kho 16 trước), nhập hàng, số lượng, giá vốn và ảnh chứng từ." },
    { id: "confirm", t: "Xác nhận", d: "Khi xác nhận, app cộng tồn, ghi thẻ kho và ghi sổ quỹ/công nợ theo nhà cung cấp." },
  ]},
  wh_defect: { title: "Linh kiện lỗi / RMA", items: [
    { id: "defect", t: "Ghi nhận lỗi", d: "Ghi nhận linh kiện hỏng để trừ khỏi tồn bán được, vẫn giữ lịch sử để đối chiếu với NCC." },
    { id: "rma", t: "Trả NCC", d: "Tạo phiếu trả hàng NCC (RMA) sẽ giảm tồn và giảm công nợ phải trả NCC. Huỷ phiếu thì cộng lại tồn, không xoá phiếu." },
  ]},
  wh_shipping: { title: "Vận đơn", items: [
    { id: "track", t: "Theo dõi", d: "Theo dõi đơn đã giao ĐVVC: đang giao, đã nhận, giao lỗi. Cập nhật trạng thái để đơn về đúng luồng." },
  ]},
  wh_report: { title: "Báo cáo kho", items: [
    { id: "report", t: "Báo cáo", d: "Tổng hợp nhập xuất tồn, giá trị tồn và hàng bán chạy. Cần xem chi tiết theo loại phát sinh thì dùng mục Xuất Nhập Tồn." },
  ]},
  pack_ship: { title: "Soạn hàng & Giao nhận", items: [
    { id: "pick", t: "Soạn hàng", d: "Mọi đơn đã thu tiền đều phải soạn, kể cả khách lấy tại quầy. Quét mã SKU để tự đánh dấu đã lấy đủ." },
    { id: "handover", t: "Bàn giao", d: "Đơn tại quầy kết thúc bằng 'Khách đã nhận'; đơn giao thì bàn giao cho ĐVVC hoặc nhân viên giao kèm ảnh xác thực." },
  ]},
  stock_nxt: { title: "Thẻ kho (Nhập - Xuất - Tồn)", items: [
    { id: "month", t: "Chọn tháng", d: "Báo cáo tính phát sinh nhập và xuất trong tháng đã chọn; cột Tồn hiện tại luôn là tồn đến bây giờ." },
    { id: "warehouse", t: "Lọc kho", d: "Chọn 'Tất cả kho' để cộng gộp mọi kho theo từng mã hàng, hoặc chọn một kho để xem riêng kho đó." },
    { id: "kind_all", t: "Lọc Tất cả", d: "Hiện toàn bộ phát sinh: nhập kho, bán hàng, chuyển kho, hàng lỗi, trả NCC, khách trả, điều chỉnh." },
    { id: "kind_sale", t: "Lọc Bán hàng", d: "Chỉ tính hàng bán ra từ đơn bán lẻ, bỏ qua chuyển kho và loại khác. Cột đổi thành Bán ra." },
    { id: "kind_transfer", t: "Lọc Điều chuyển", d: "Chỉ tính phiếu chuyển kho: Chuyển đến là hàng kho đang xem nhận về, Chuyển đi là hàng xuất sang kho khác." },
    { id: "kind_other", t: "Lọc Khác", d: "Gồm hàng lỗi, trả NCC, khách trả hàng, xuất combo và điều chỉnh kiểm kho." },
    { id: "card", t: "Nút Thẻ kho", d: "Xem lịch sử phát sinh của một mã hàng: ngày, loại, ghi chú, số lượng thay đổi và tồn sau mỗi lần." },
  ]},
  stock_count: { title: "Kiểm kê kho", items: [
    { id: "start", t: "Bắt đầu kiểm", d: "Chọn kho, khu vực để tạo phiếu kiểm. Hệ thống hiện tồn sổ để anh nhập tồn thực tế từng kệ." },
    { id: "approve", t: "Duyệt", d: "Duyệt phiếu sẽ điều chỉnh tồn theo số thực tế và ghi thẻ kho cho các dòng lệch." },
  ]},

  // ── MUA HÀNG ────────────────────────────────────────────────
  purchase_order: { title: "Đặt hàng NCC", items: [
    { id: "create", t: "Tạo đơn đặt", d: "Chọn nhà cung cấp và hàng cần đặt. Có thể tạo từ danh sách hàng sắp hết trong Dự báo mua hàng." },
    { id: "receive", t: "Nhận hàng", d: "Khi hàng về, tạo phiếu nhập từ đơn đặt để tự điền hàng và giá, tránh nhập lại từ đầu." },
  ]},
  purchase_forecast: { title: "Dự báo mua hàng", items: [
    { id: "calc", t: "Cách tính", d: "Dựa trên tốc độ bán gần đây và tồn hiện tại để gợi ý số lượng nên nhập, ưu tiên hàng sắp hết." },
  ]},
  wh_import_ncc: { title: "Nhập hàng từ NCC", items: [
    { id: "form", t: "Phiếu nhập", d: "Chọn kho nhận, nhà cung cấp, nhập hàng theo đơn hoặc nhập nhanh. Chọn kho bằng dropdown để không nhập nhầm kho." },
    { id: "debt", t: "Công nợ", d: "Nhập hàng chưa trả tiền sẽ tự tăng công nợ phải trả NCC tương ứng." },
  ]},
  rma: { title: "Trả hàng NCC (RMA)", items: [
    { id: "ticket", t: "Phiếu trả", d: "Liên kết phiếu nhập gốc để lấy đúng giá vốn, hoặc dùng trả nhanh. Tạo phiếu sẽ giảm tồn và giảm công nợ phải trả NCC." },
    { id: "cancel", t: "Huỷ phiếu", d: "Huỷ phiếu sẽ cộng lại tồn và chuyển chứng từ công nợ sang đã huỷ, không xoá dữ liệu." },
  ]},
  suppliers: { title: "Nhà cung cấp", items: [
    { id: "add", t: "Thêm NCC", d: "Nhập tên, điện thoại, địa chỉ. Dùng gợi ý có sẵn để tránh tạo trùng nhà cung cấp." },
    { id: "debt", t: "Công nợ", d: "Xem nhanh dư nợ phải trả của từng NCC, bấm vào để mở chi tiết công nợ." },
  ]},
  debt_ncc: { title: "Công nợ NCC", items: [
    { id: "voucher", t: "Chứng từ", d: "Mỗi lần nhập hàng tạo một khoản phải trả, mỗi lần trả tiền tạo phiếu chi làm giảm nợ. Phiếu trả hàng NCC tạo chứng từ giảm nợ." },
    { id: "pay", t: "Trả tiền", d: "Bấm trả nợ để ghi phiếu chi; sổ quỹ và công nợ cập nhật ngay, tránh lệch số." },
  ]},

  // ── KHÁCH HÀNG & KẾ TOÁN ────────────────────────────────────
  customers: { title: "Khách hàng", items: [
    { id: "add", t: "Thêm khách", d: "Nhập tên và số điện thoại là đủ để tra cứu sau này. Có thể nhập/xuất Excel khi cần chuyển dữ liệu." },
    { id: "history", t: "Lịch sử", d: "Mở khách để xem tổng đơn, tổng chi tiêu và công nợ (nếu mua chịu)." },
  ]},
  cash_journal: { title: "Sổ quỹ", items: [
    { id: "entry", t: "Phiếu thu/chi", d: "Mọi khoản tiền mặt vào ra đều ghi ở đây: thu tiền bán, thu nợ, chi nhập hàng, chi phí." },
    { id: "balance", t: "Số dư", d: "Số dư đầu kỳ cộng thu trừ chi ra số dư hiện tại. Chênh lệch thì kiểm tra lại phiếu thu chi trong kỳ." },
  ]},
  debts: { title: "Công nợ khách hàng", items: [
    { id: "voucher", t: "Chứng từ nợ", d: "Đơn bán ghi nợ tạo khoản phải thu; khách trả tiền tạo phiếu thu làm giảm nợ." },
    { id: "pay", t: "Thu nợ", d: "Bấm thu nợ để ghi nhận tiền khách trả; sổ quỹ và công nợ cập nhật cùng lúc." },
  ]},
  expense: { title: "Chi phí", items: [
    { id: "add", t: "Thêm chi phí", d: "Chọn loại chi phí, số tiền, ngày và người chi. Chi phí đã duyệt mới được tính vào báo cáo lợi nhuận." },
    { id: "approve", t: "Duyệt", d: "Người có quyền duyệt mới đưa khoản chi vào sổ quỹ và báo cáo." },
  ]},

  // ── BÁO CÁO ─────────────────────────────────────────────────
  revenue: { title: "Doanh thu", items: [
    { id: "period", t: "Chọn kỳ", d: "Chọn hôm nay, tuần, tháng hoặc khoảng ngày. Doanh thu tính trên đơn đã hoàn tất theo ngày tạo." },
    { id: "detail", t: "Chi tiết", d: "Tách doanh thu sửa chữa và bán lẻ để so sánh. Bấm số liệu để xem danh sách đơn tương ứng." },
  ]},
  report_profit: { title: "Báo cáo lợi nhuận", items: [
    { id: "formula", t: "Cách tính", d: "Lợi nhuận = doanh thu thuần - giá vốn hàng bán - chi phí đã duyệt. Giá vốn lấy theo giá nhập của linh kiện." },
    { id: "period", t: "Chọn kỳ", d: "So sánh giữa các kỳ để biết tháng nào lãi mỏng, thường do giảm giá nhiều hoặc chi phí tăng." },
  ]},
  report_staff: { title: "KPI nhân viên", items: [
    { id: "kpi", t: "Điểm KPI", d: "Điểm trừ khi phản hồi chậm hoặc để việc quá hạn. Quản lý có thể đặt lại điểm nhưng phải xác nhận để tránh nhầm." },
    { id: "scope", t: "Phạm vi", d: "Tổ trưởng chỉ xem được nhân viên trong tổ của mình; quản lý xem toàn bộ." },
  ]},
  report_debt: { title: "Báo cáo công nợ khách hàng", items: [
    { id: "aging", t: "Tuổi nợ", d: "Nợ chia theo số ngày chưa thanh toán để biết khoản nào cần đòi trước." },
    { id: "detail", t: "Chi tiết", d: "Bấm vào khách để xem từng đơn còn nợ và lịch sử thanh toán." },
  ]},
  sale_analytics: { title: "Phân tích bán hàng", items: [
    { id: "item", t: "Hàng bán theo khách hàng", d: "Mỗi dòng là một mã hàng: bao nhiêu khách khác nhau đã mua, tổng số lượng bán, doanh thu, số lượng và giá trị trả, doanh thu thuần." },
    { id: "customer", t: "Khách hàng theo hàng bán", d: "Mỗi dòng là một khách: số đơn, số hàng đã mua, doanh thu, giá trị trả và doanh thu thuần." },
    { id: "seller", t: "Hàng bán theo nhân viên", d: "Mỗi dòng là một nhân viên bán: số đơn, số lượng hàng và doanh thu họ mang về." },
    { id: "day", t: "Doanh thu theo ngày", d: "Doanh thu từng ngày trong khoảng đã chọn, kèm giá trị trả và doanh thu thuần." },
    { id: "paid", t: "Chỉ đơn đã thu", d: "Bật để chỉ tính đơn đã thu tiền. Tắt thì tính cả đơn đang chờ thu, chỉ bỏ đơn nháp và đơn huỷ." },
    { id: "export", t: "Xuất Excel", d: "Xuất đúng tab đang xem theo mẫu có sẵn: tiêu đề, kỳ báo cáo, dòng tổng, định dạng tiền." },
  ]},

  // ── THIẾT LẬP ───────────────────────────────────────────────
  staff: { title: "Nhân viên", items: [
    { id: "add", t: "Thêm nhân viên", d: "Tạo tài khoản, chọn vai trò và phòng ban. Nhân viên mới sẽ được yêu cầu đổi mật khẩu khi đăng nhập lần đầu." },
    { id: "kpi", t: "KPI", d: "Đặt lại điểm KPI cần xác nhận qua hộp thoại để tránh xoá nhầm." },
  ]},
  department: { title: "Phòng ban", items: [
    { id: "team", t: "Tổ và tổ trưởng", d: "Gán nhân viên vào tổ để tổ trưởng xem và chia việc trong phạm vi tổ của mình." },
  ]},
  role_perm: { title: "Vai trò & Phân quyền", items: [
    { id: "matrix", t: "Ma trận quyền", d: "Mỗi dòng là một quyền, mỗi cột là một vai trò. Tích ô để cấp quyền xem/Thêm/Sửa/Xoá/Duyệt/Xuất." },
    { id: "menu", t: "Quyền menu", d: "Quyền menu quyết định mục nào hiện trên sidebar, ví dụ Menu Xuất Nhập Tồn, Menu Thu tiền POS." },
    { id: "seed", t: "Nút Seed", d: "Khôi phục bộ quyền mặc định. Phải gõ RESET để xác nhận vì thao tác này ghi đè cấu hình tay." },
  ]},
  action_log: { title: "Nhật ký thao tác", items: [
    { id: "what", t: "Ghi gì", d: "Mọi thao tác quan trọng: tạo, sửa, xoá, duyệt, thu tiền, chuyển kho, xuất báo cáo Excel, đều được lưu kèm người làm và thời điểm." },
    { id: "filter", t: "Lọc", d: "Lọc theo người dùng, loại đối tượng và khoảng ngày để truy vết khi có sai lệch số liệu." },
  ]},
  integrations: { title: "Tích hợp", items: [
    { id: "keys", t: "Kết nối", d: "Khai báo thông tin kết nối dịch vụ ngoài (ví dụ KiotViet, in hoá đơn). Kiểm tra trạng thái kết nối trước khi dùng." },
  ]},
  settings: { title: "Cài đặt cửa hàng", items: [
    { id: "info", t: "Thông tin cửa hàng", d: "Tên, địa chỉ, điện thoại, logo dùng để in hoá đơn và hiển thị trong app." },
    { id: "tabs", t: "Các tab", d: "Cài đặt cửa hàng, mẫu in, tích hợp và nhật ký thao tác được gom trong cùng nhóm Thiết lập." },
  ]},
  print_settings: { title: "Mẫu in & Cài đặt", items: [
    { id: "template", t: "Mẫu in", d: "Chọn mẫu phiếu tiếp nhận, hoá đơn sửa chữa, hoá đơn bán lẻ. Tất cả khổ A5 và có mã QR dẫn tới đơn." },
    { id: "restore", t: "Khôi phục", d: "Sửa mẫu hỏng thì bấm khôi phục mặc định để lấy lại mẫu chuẩn của hệ thống." },
  ]},
  print_template: { title: "Xem trước mẫu in", items: [
    { id: "preview", t: "Xem trước", d: "Xem đúng bố cục sẽ in ra, kèm mã QR. Nên xem trước sau mỗi lần sửa mẫu." },
  ]},
};

/** Mở hộp thoại gợi ý */
function HintModal({ page, focusId, onClose }) {
  const data = HINTS[page] || null;
  const items = data ? (focusId ? data.items.filter(i => i.id === focusId) : data.items) : [];
  const list = items.length ? items : (data ? data.items : []);
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(17,24,39,.55)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "min(520px, 96vw)", maxHeight: "82vh",
        overflowY: "auto", padding: "16px 18px 20px", boxShadow: "0 24px 60px rgba(0,0,0,.3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 22, color: "#4f46e5" }}>lightbulb</span>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#1e1b4b" }}>
              {data ? data.title : "Gợi ý sử dụng"}
            </div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "#f3f4f6", width: 30, height: 30,
            borderRadius: "50%", cursor: "pointer", fontSize: 15 }}>✕</button>
        </div>

        {!data && (
          <div style={{ fontSize: 13.5, color: "#6b7280", lineHeight: 1.6 }}>
            Màn hình này chưa có gợi ý riêng. Anh/chị cứ bấm vào các mục có dấu <b>?</b> hoặc bấm giữ 3 giây
            ở khu vực cần hỏi để xem hướng dẫn.
          </div>
        )}

        {list.map(it => (
          <div key={it.id} style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12,
            padding: "10px 12px", marginBottom: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: "#312e81", marginBottom: 3 }}>{it.t}</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.55 }}>{it.d}</div>
          </div>
        ))}

        <div style={{ marginTop: 10, fontSize: 11.5, color: "#9ca3af", textAlign: "center" }}>
          Mẹo: trên điện thoại, bấm giữ 3 giây vào một khu vực để xem gợi ý của khu vực đó.
        </div>
      </div>
    </div>
  );
}

/** Nút ? trên header — mở danh sách gợi ý của trang hiện tại */
export function HelpButton({ page, style }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} title="Gợi ý sử dụng"
        style={{ background: "rgba(255,255,255,.18)", border: "none", borderRadius: 10, color: "#fff",
          width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", ...(style || {}) }}>
        <span className="material-icons" style={{ fontFamily: "Material Icons", fontSize: 22, lineHeight: 1 }}>help_outline</span>
      </button>
      {open && <HintModal page={page} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Dấu ? nhỏ cạnh nhãn/mục */
export function HintDot({ page, id, color = "#4f46e5", size = 16 }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="Xem gợi ý"
        style={{ width: size, height: size, borderRadius: "50%", border: `1.5px solid ${color}`,
          background: "#fff", color, fontSize: size - 5, fontWeight: 900, lineHeight: 1,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0, padding: 0, marginLeft: 6, verticalAlign: "middle" }}>?</button>
      {open && <HintModal page={page} focusId={id} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Bấm giữ 3 giây vào vùng bọc để mở gợi ý */
export function HintArea({ page, id, children, disabled }) {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const startPt = useRef(null);

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  const onDown = (e) => {
    if (disabled) return;
    const p = e.touches ? e.touches[0] : e;
    startPt.current = { x: p.clientX, y: p.clientY };
    clear();
    timer.current = setTimeout(() => setOpen(true), 3000);
  };
  const onMove = (e) => {
    if (!startPt.current) return;
    const p = e.touches ? e.touches[0] : e;
    const dx = Math.abs(p.clientX - startPt.current.x);
    const dy = Math.abs(p.clientY - startPt.current.y);
    if (dx > 12 || dy > 12) clear();   // vuốt/scroll thì huỷ
  };

  useEffect(() => clear, []);

  return (
    <div onPointerDown={onDown} onPointerUp={clear} onPointerLeave={clear} onPointerCancel={clear}
      onPointerMove={onMove} style={{ display: "contents" }}>
      {children}
      {open && <HintModal page={page} focusId={id} onClose={() => setOpen(false)} />}
    </div>
  );
}
