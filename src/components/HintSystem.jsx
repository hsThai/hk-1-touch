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
  cashier_home: {
    title: "Thu ngân (POS)",
    items: [
      { id: "sale", t: "Bán hàng", d: "Chọn hàng, chọn khách rồi bấm Tạo đơn. Đơn tại quầy vẫn phải qua bước soạn hàng. Khách trả tiền ngay thì chọn Tiền mặt hoặc Chuyển khoản." },
      { id: "orders", t: "Đơn hàng", d: "Xem lại mọi đơn đã tạo. Đơn còn 'Chờ thu tiền' sẽ có nút Thu tiền (nếu bạn có quyền) và nút Xem hoá đơn để kiểm tra hàng trước khi thu." },
      { id: "collect", t: "Thu tiền", d: "Danh sách đơn chờ thu. Bấm Xem hóa đơn để kiểm tra hàng, giá, giảm giá; bấm Xác nhận Thu tiền để ghi nhận và in hoá đơn." },
      { id: "reconcile", t: "Đối soát", d: "Cuối ca nhập tiền đầu ca, tiền mặt thực tế và chuyển khoản, app tự tính chênh lệch để nộp kế toán." },
      { id: "invoice", t: "Xem hóa đơn", d: "Hiện đầy đủ hàng hoá, số lượng, đơn giá, giảm giá và số tiền khách phải trả trước khi thu. Có nút In riêng nếu khách cần." },
    ],
  },
  wh_manager: {
    title: "Quản lý kho",
    items: [
      { id: "transfer", t: "Tạo phiếu chuyển kho", d: "Chọn kho xuất trước, rồi chọn kho nhận. Kho xuất là nơi lấy hàng, kho nhận là nơi nhận hàng; hai kho phải khác nhau." },
      { id: "transfer_item", t: "Chọn hàng để chuyển", d: "Gõ tên hoặc SKU để tìm. Hàng còn tồn trong kho xuất hiện trước kèm chip Tồn; hàng hết tồn không cho chuyển." },
      { id: "transfer_qty", t: "Số lượng (SL)", d: "Không được lớn hơn tồn hiện có của kho xuất. Nếu lớn hơn, app báo vàng và chặn khi bấm tạo phiếu." },
      { id: "transfer_price", t: "Đơn giá", d: "Giá vốn của hàng, dùng để tính tổng giá trị phiếu chuyển và bút toán sổ kho. Chọn hàng xong app tự điền." },
      { id: "kho16", t: "Kho 16 là kho chính", d: "Hàng NCC về phải nhập vào Kho 16 trước, sau đó mới chuyển sang Kho BH hoặc Kho Haravan để bán." },
    ],
  },
  stock_nxt: {
    title: "Thẻ kho (Nhập - Xuất - Tồn)",
    items: [
      { id: "month", t: "Chọn tháng", d: "Báo cáo tính phát sinh nhập và xuất trong tháng đã chọn; cột Tồn hiện tại luôn là tồn đến bây giờ." },
      { id: "warehouse", t: "Lọc kho", d: "Chọn 'Tất cả kho' để cộng gộp mọi kho theo từng mã hàng, hoặc chọn một kho để xem riêng kho đó." },
      { id: "kind_all", t: "Lọc Tất cả", d: "Hiện toàn bộ phát sinh: nhập kho, bán hàng, chuyển kho, hàng lỗi, trả NCC, khách trả, điều chỉnh." },
      { id: "kind_sale", t: "Lọc Bán hàng", d: "Chỉ tính hàng bán ra từ đơn bán lẻ, bỏ qua chuyển kho và các loại khác. Cột đổi thành Bán ra." },
      { id: "kind_transfer", t: "Lọc Điều chuyển", d: "Chỉ tính phiếu chuyển kho: Chuyển đến là hàng nhận về kho đang xem, Chuyển đi là hàng xuất sang kho khác." },
      { id: "kind_other", t: "Lọc Khác", d: "Gồm hàng lỗi, trả NCC, khách trả hàng, xuất combo và điều chỉnh kiểm kho." },
      { id: "card", t: "Nút Thẻ kho", d: "Xem lịch sử phát sinh của một mã hàng: ngày, loại, ghi chú, số lượng thay đổi và tồn sau mỗi lần." },
    ],
  },
  sale_analytics: {
    title: "Phân tích bán hàng",
    items: [
      { id: "item", t: "Hàng bán theo khách hàng", d: "Mỗi dòng là một mã hàng: có bao nhiêu khách khác nhau đã mua, tổng số lượng bán, doanh thu, số lượng và giá trị trả, doanh thu thuần." },
      { id: "customer", t: "Khách hàng theo hàng bán", d: "Mỗi dòng là một khách: số đơn, số hàng đã mua, doanh thu, giá trị trả và doanh thu thuần." },
      { id: "seller", t: "Hàng bán theo nhân viên", d: "Mỗi dòng là một nhân viên bán: số đơn, số lượng hàng và doanh thu họ mang về." },
      { id: "day", t: "Doanh thu theo ngày", d: "Doanh thu từng ngày trong khoảng đã chọn, kèm giá trị trả và doanh thu thuần." },
      { id: "paid", t: "Chỉ đơn đã thu", d: "Bật để chỉ tính đơn đã thu tiền. Tắt thì tính cả đơn đang chờ thu, chỉ bỏ đơn nháp và đơn huỷ." },
      { id: "export", t: "Xuất Excel", d: "Xuất đúng tab đang xem, theo mẫu báo cáo có sẵn: tiêu đề, kỳ báo cáo, dòng tổng, định dạng tiền." },
    ],
  },
  pack_ship: {
    title: "Soạn hàng & Giao nhận",
    items: [
      { id: "pick", t: "Soạn hàng", d: "Mọi đơn đã thu tiền đều phải soạn, kể cả khách lấy tại quầy. Quét mã SKU để tự đánh dấu đã lấy đủ." },
      { id: "handover", t: "Bàn giao", d: "Đơn tại quầy kết thúc bằng 'Khách đã nhận'; đơn giao thì bàn giao cho ĐVVC hoặc nhân viên giao kèm ảnh xác thực." },
    ],
  },
  my_tasks: {
    title: "Việc của tôi",
    items: [
      { id: "list", t: "Danh sách việc", d: "Việc chia 3 mức: 🔴 khẩn cấp, 🟡 cần xử lý, 🟢 đang chờ. Bấm vào một việc để mở đúng đơn hoặc đúng màn hình cần làm." },
      { id: "overdue", t: "Việc quá hạn", d: "Đơn chưa nhận quá 60 phút sẽ báo tổ trưởng, quá 120 phút báo cả quản lý." },
    ],
  },
  new: {
    title: "Tạo đơn sửa chữa",
    items: [
      { id: "quote", t: "Báo giá ngay", d: "Chọn 'Tạo Đơn & Báo Giáo Ngay' khi cần báo giá trước khi sửa. Linh kiện chưa có hàng thì tick 'Chờ nhập' kèm ngày dự kiến về." },
      { id: "waiting", t: "Chờ linh kiện", d: "Đơn có linh kiện chờ nhập không bắt kỹ thuật viên nhận, không tính KPI và chưa gửi thông báo cho tới khi kho xác nhận hàng về." },
    ],
  },
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
