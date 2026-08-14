/* Stock Export Request Flow - KTV tạo đề nghị xuất */
import React, { useState } from "react";
import { StockExportRequest, SparePartUsage, RepairChat, StockLedger, StockMovement, logAction } from "./pb.jsx";

export async function createExportRequest({
  order,
  currentStaff,
  usages, // SparePartUsage list
  exportType, // "repair" | "borrow"
  dueDateTime,
  returnDueDate,
  note,
}) {
  // Gom lại items từ usages
  const items = usages
    .filter(u => u.status === "pending")
    .map(u => ({
      part_id: u.part_id,
      part_name: u.part_name,
      sku: u.sku,
      qty_requested: u.qty_requested || 1,
      unit_price: u.unit_price || 0,
      total_price: u.total_price || 0,
    }));

  if (items.length === 0) {
    throw new Error("Không có linh kiện nào để xuất!");
  }

  const totalValue = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  
  // Tạo request_code tự động
  const timestamp = Date.now().toString(36).toUpperCase();
  const requestCode = `EXP-${order.order_code}-${timestamp}`;

  try {
    // Tạo phiếu xuất
    const request = await StockExportRequest.create({
      request_code: requestCode,
      order_id: order.id,
      order_code: order.order_code,
      export_type: exportType,
      items: JSON.stringify(items),
      due_datetime: dueDateTime,
      return_due_date: exportType === "borrow" ? returnDueDate : null,
      status: "pending",
      requested_by: currentStaff.id,
      requested_by_name: currentStaff.full_name,
      total_value: totalValue,
      reminded_15min: false,
    });
    logAction(currentStaff, "create_export", "stock_export", request.id, `Tạo phiếu xuất ${requestCode}: ${items.length} LK — ${totalValue.toLocaleString("vi-VN")}đ`);

    // Gửi notif cho tất cả NV kho
    // (backend sẽ handle)

    // Gửi chat thông báo
    await RepairChat.create({
      order_id: order.id,
      order_code: order.order_code,
      sender_id: currentStaff.id,
      sender_name: currentStaff.full_name,
      message: `[ĐỀ NGHỊ XUẤT HÀNG]\n━━━━━━━━━━━━━━━━\n🔧 Loại: ${exportType === "repair" ? "Xuất sửa" : "Xuất mượn"}\n📦 ${items.length} loại linh kiện\n💰 Tổng: ${totalValue.toLocaleString()}đ\n⏰ Hạn xuất: ${new Date(dueDateTime).toLocaleString("vi-VN")}\n📝 Ghi chú: ${note || "không"}`,
      message_type: "system",
    });

    return request;
  } catch (e) {
    console.error("Lỗi tạo phiếu xuất:", e);
    throw e;
  }
}

export async function confirmWarehouseExport({
  requestId,
  warehouseStaff,
  note,
  mediaUrls, // ảnh/video
  usages,    // SparePartUsage list liên quan (optional — để trừ tồn)
}) {
  try {
    const updated = await StockExportRequest.update(requestId, {
      status: "warehouse_confirmed",
      warehouse_confirmed_by: warehouseStaff.id,
      warehouse_confirmed_by_name: warehouseStaff.full_name,
      warehouse_confirmed_at: new Date().toISOString(),
      warehouse_note: note,
      warehouse_media: JSON.stringify(mediaUrls || []),
    });

    logAction(warehouseStaff, "confirm_export", "stock_export", requestId, `Kho xác nhận xuất: ${requestCode||requestId}`);
    // Trừ tồn kho thật + bỏ reserved + tạo stock_movement cho từng usage
    if (usages && usages.length > 0) {
      for (const usage of usages) {
        if (!usage.ledger_id) continue; // usage cũ không có ledger_id → bỏ qua
        try {
          const ledger = await StockLedger.get(usage.ledger_id).catch(()=>null);
          if (ledger) {
            const qtyUsed       = usage.qty_used || usage.qty_requested || 0;
            const newQtyOnHand  = Math.max(0, (ledger.qty_on_hand||0) - qtyUsed);
            const newQtyReserved = Math.max(0, (ledger.qty_reserved||0) - qtyUsed);
            await StockLedger.update(ledger.id, {
              qty_on_hand:   newQtyOnHand,
              qty_reserved:  newQtyReserved,
              qty_available: Math.max(0, newQtyOnHand - newQtyReserved),
              last_movement_at: new Date().toISOString(),
            });
            await StockMovement.create({
              movement_code:  "USE-" + Date.now() + "-" + Math.floor(Math.random()*9999),
              movement_type:  "usage",
              warehouse_id:   ledger.warehouse_id,
              warehouse_name: usage.warehouse_name || ledger.warehouse_name || "",
              part_id:        usage.part_id,
              part_name:      usage.part_name,
              sku:            usage.sku || "",
              qty_before:     ledger.qty_on_hand || 0,
              qty_change:     -qtyUsed,
              qty_after:      newQtyOnHand,
              unit_price:     usage.unit_price || 0,
              ref_type:       "spare_part_usage",
              ref_id:         usage.id,
              ref_code:       usage.order_code || "",
              note:           `Giao LK đơn ${usage.order_code || usage.order_id}`,
              created_by_name: warehouseStaff.full_name || "",
              created_date:   new Date().toISOString().replace("T"," ").split(".")[0],
            });
          }
        } catch(err) {
          console.warn("Lỗi update ledger cho usage", usage.id, err?.message);
        }
      }
    }

    return updated;
  } catch (e) {
    console.error("Lỗi xác nhận xuất:", e);
    throw e;
  }
}

export async function confirmKtvReceived({
  requestId,
  ktvStaff,
  note,
  mediaUrls,
}) {
  try {
    const updated = await StockExportRequest.update(requestId, {
      status: "ktv_confirmed",
      ktv_confirmed_by: ktvStaff.id,
      ktv_confirmed_by_name: ktvStaff.full_name,
      ktv_confirmed_at: new Date().toISOString(),
      ktv_note: note,
      ktv_media: JSON.stringify(mediaUrls || []),
    });
    logAction(ktvStaff, "receive_parts", "stock_export", requestId, `KTV xác nhận nhận: ${requestId}`);
    return updated;
  } catch (e) {
    console.error("Lỗi xác nhận nhận:", e);
    throw e;
  }
}

export async function returnBorrowedParts({
  requestId,
  warehouseStaff,
  note,
}) {
  try {
    const updated = await StockExportRequest.update(requestId, {
      status: "returned",
      return_confirmed_by: warehouseStaff.id,
      return_confirmed_by_name: warehouseStaff.full_name,
      return_confirmed_at: new Date().toISOString(),
      return_note: note,
    });

    return updated;
  } catch (e) {
    console.error("Lỗi xác nhận trả:", e);
    throw e;
  }
}

export default function StockExportFlow() { return null; }
