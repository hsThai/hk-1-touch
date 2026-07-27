/**
 * PermissionContext.jsx — Hệ thống phân quyền động
 * 
 * Cách dùng:
 *   const { can, role, isLoaded } = usePermission();
 *   can("repair_order", "create")  → boolean
 *   can("spare_part", "approve")   → boolean
 *
 * Fallback an toàn: nếu DB chưa có dữ liệu → dùng STATIC_MATRIX hardcode
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Role, RolePermission } from "./pb.jsx";

// ══════════════════════════════════════════════════════════
// STATIC FALLBACK MATRIX (16 roles × resources × actions)
// Dùng khi DB chưa seed hoặc offline
// ══════════════════════════════════════════════════════════

// Tài nguyên hệ thống
const RESOURCES = [
  "repair_order",      // Đơn sửa chữa
  "repair_order_price",// Báo giá / duyệt giá
  "spare_part",        // Linh kiện
  "stock_export",      // Xuất kho
  "stock_import",      // Nhập kho
  "stock_transfer",    // Chuyển kho
  "stock_count",       // Kiểm kho
  "stock_ledger",      // Xem tồn kho
  "customer",          // Khách hàng
  "sale_order",        // Bán hàng lẻ
  "expense",           // Chi phí
  "revenue_report",    // Báo cáo doanh thu
  "staff",             // Quản lý nhân viên
  "kpi",               // KPI
  "settings",          // Cài đặt hệ thống
  "media_post",        // Bài đăng / media
  "notification",      // Thông báo
  "warehouse_mgr",     // Quản lý kho (cấu hình)
  "supplier",          // Nhà cung cấp
  "debt",              // Công nợ phải thu / phải trả
  "cash_journal",      // Sổ quỹ tiền mặt
  "department",        // Phòng ban
  "purchase_order",    // Đơn mua hàng NCC
  "profit_report",     // Báo cáo lợi nhuận
];

// Actions chuẩn
const ACTIONS = ["view","create","edit","delete","approve","export"];

// Hàm tạo permission object gọn
const p = (view=0, create=0, edit=0, del=0, approve=0, exp=0) =>
  ({ view:!!view, create:!!create, edit:!!edit, delete:!!del, approve:!!approve, export:!!exp });

// Ma trận phân quyền tĩnh: role → resource → actions
const STATIC_MATRIX = {
  // ── OWNER: toàn quyền ──────────────────────────────────
  owner: {
    repair_order:       p(1,1,1,1,1,1),
    repair_order_price: p(1,1,1,1,1,1),
    spare_part:         p(1,1,1,1,1,1),
    stock_export:       p(1,1,1,1,1,1),
    stock_import:       p(1,1,1,1,1,1),
    stock_transfer:     p(1,1,1,1,1,1),
    stock_count:        p(1,1,1,1,1,1),
    stock_ledger:       p(1,1,1,1,1,1),
    customer:           p(1,1,1,1,1,1),
    sale_order:         p(1,1,1,1,1,1),
    expense:            p(1,1,1,1,1,1),
    revenue_report:     p(1,0,0,0,0,1),
    staff:              p(1,1,1,1,1,0),
    kpi:                p(1,0,1,0,1,0),
    settings:           p(1,0,1,0,0,0),
    media_post:         p(1,1,1,1,1,1),
    notification:       p(1,1,0,1,0,0),
    warehouse_mgr:      p(1,1,1,1,1,0),
    supplier:          p(1,1,1,1,1,1),
    debt:              p(1,1,1,1,1,1),
    cash_journal:      p(1,1,1,1,1,1),
    department:        p(1,1,1,1,1,0),
    purchase_order:    p(1,1,1,1,1,1),
    profit_report:     p(1,0,0,0,0,1),
  },

  // ── ADMIN: giống owner, trừ một vài setting nhạy cảm ──
  admin: {
    repair_order:       p(1,1,1,1,1,1),
    repair_order_price: p(1,1,1,1,1,1),
    spare_part:         p(1,1,1,1,1,1),
    stock_export:       p(1,1,1,1,1,1),
    stock_import:       p(1,1,1,1,1,1),
    stock_transfer:     p(1,1,1,1,1,1),
    stock_count:        p(1,1,1,1,1,1),
    stock_ledger:       p(1,1,1,1,1,1),
    customer:           p(1,1,1,1,1,1),
    sale_order:         p(1,1,1,1,1,1),
    expense:            p(1,1,1,1,1,1),
    revenue_report:     p(1,0,0,0,0,1),
    staff:              p(1,1,1,0,1,0),
    kpi:                p(1,0,1,0,1,0),
    settings:           p(1,0,1,0,0,0),
    media_post:         p(1,1,1,1,0,1),
    notification:       p(1,1,0,1,0,0),
    warehouse_mgr:      p(1,1,1,1,1,0),
    supplier:          p(1,1,1,1,1,1),
    debt:              p(1,1,1,1,1,1),
    cash_journal:      p(1,1,1,1,1,1),
    department:        p(1,1,1,1,1,0),
    purchase_order:    p(1,1,1,1,1,1),
    profit_report:     p(1,0,0,0,0,1),
  },

  // ── MANAGER: quản lý tổng ──────────────────────────────
  manager: {
    repair_order:       p(1,1,1,1,1,1),
    repair_order_price: p(1,1,1,0,1,0),
    spare_part:         p(1,1,1,0,1,1),
    stock_export:       p(1,1,1,0,1,1),
    stock_import:       p(1,1,0,0,1,1),
    stock_transfer:     p(1,1,1,0,1,0),
    stock_count:        p(1,1,1,0,1,0),
    stock_ledger:       p(1,0,0,0,0,1),
    customer:           p(1,1,1,0,0,1),
    sale_order:         p(1,1,1,0,1,1),
    expense:            p(1,1,1,0,1,1),
    revenue_report:     p(1,0,0,0,0,1),
    staff:              p(1,1,1,0,0,0),
    kpi:                p(1,0,1,0,0,0),
    settings:           p(1,0,0,0,0,0),
    media_post:         p(1,1,1,0,0,1),
    notification:       p(1,1,0,0,0,0),
    warehouse_mgr:      p(1,1,1,0,0,0),
    supplier:          p(1,1,1,0,1,1),
    debt:              p(1,1,1,0,1,1),
    cash_journal:      p(1,1,0,0,1,1),
    department:        p(1,1,1,0,0,0),
    purchase_order:    p(1,1,1,0,1,1),
    profit_report:     p(1,0,0,0,0,1),
  },

  // ── RECEPTIONIST: tiếp tân ─────────────────────────────
  receptionist: {
    repair_order:       p(1,1,1,0,0,1),
    repair_order_price: p(1,1,0,0,0,0),
    spare_part:         p(1,0,0,0,0,0),
    stock_export:       p(1,1,0,0,0,0),
    stock_import:       p(0,0,0,0,0,0),
    stock_transfer:     p(0,0,0,0,0,0),
    stock_count:        p(0,0,0,0,0,0),
    stock_ledger:       p(1,0,0,0,0,0),
    customer:           p(1,1,1,0,0,1),
    sale_order:         p(1,1,0,0,0,1),
    expense:            p(0,0,0,0,0,0),
    revenue_report:     p(0,0,0,0,0,0),
    staff:              p(0,0,0,0,0,0),
    kpi:                p(0,0,0,0,0,0),
    settings:           p(0,0,0,0,0,0),
    media_post:         p(1,0,0,0,0,0),
    notification:       p(1,0,0,0,0,0),
    warehouse_mgr:      p(0,0,0,0,0,0),
    supplier:          p(0,0,0,0,0,0),
    debt:              p(0,0,0,0,0,0),
    cash_journal:      p(0,0,0,0,0,0),
    department:        p(0,0,0,0,0,0),
    purchase_order:    p(0,0,0,0,0,0),
    profit_report:     p(0,0,0,0,0,0),
  },

  // ── TECHNICIAN: kỹ thuật viên ─────────────────────────
  technician: {
    repair_order:       p(1,0,1,0,0,0), // chỉ xem đơn được assign
    repair_order_price: p(1,1,0,0,0,0), // nhập giá, không duyệt
    spare_part:         p(1,0,0,0,0,0),
    stock_export:       p(1,1,0,0,0,0), // yêu cầu xuất kho
    stock_import:       p(0,0,0,0,0,0),
    stock_transfer:     p(0,0,0,0,0,0),
    stock_count:        p(1,0,1,0,0,0), // tham gia kiểm kho
    stock_ledger:       p(1,0,0,0,0,0),
    customer:           p(1,0,0,0,0,0),
    sale_order:         p(0,0,0,0,0,0),
    expense:            p(0,0,0,0,0,0),
    revenue_report:     p(0,0,0,0,0,0),
    staff:              p(0,0,0,0,0,0),
    kpi:                p(1,0,0,0,0,0), // xem KPI của mình
    settings:           p(0,0,0,0,0,0),
    media_post:         p(1,0,0,0,0,0),
    notification:       p(1,0,0,0,0,0),
    warehouse_mgr:      p(0,0,0,0,0,0),
    supplier:          p(0,0,0,0,0,0),
    debt:              p(0,0,0,0,0,0),
    cash_journal:      p(0,0,0,0,0,0),
    department:        p(0,0,0,0,0,0),
    purchase_order:    p(0,0,0,0,0,0),
    profit_report:     p(0,0,0,0,0,0),
  },

  mm_tech: {
    repair_order:       p(1,0,1,0,0,0), // chỉ xem đơn được assign
    repair_order_price: p(1,1,0,0,0,0), // nhập giá, không duyệt
    spare_part:         p(1,0,0,0,0,0),
    stock_export:       p(1,1,0,0,0,0), // yêu cầu xuất kho
    stock_import:       p(0,0,0,0,0,0),
    stock_transfer:     p(0,0,0,0,0,0),
    stock_count:        p(1,0,1,0,0,0), // tham gia kiểm kho
    stock_ledger:       p(1,0,0,0,0,0),
    customer:           p(1,0,0,0,0,0),
    sale_order:         p(0,0,0,0,0,0),
    expense:            p(0,0,0,0,0,0),
    revenue_report:     p(0,0,0,0,0,0),
    staff:              p(0,0,0,0,0,0),
    kpi:                p(1,0,0,0,0,0), // xem KPI của mình
    settings:           p(0,0,0,0,0,0),
    media_post:         p(1,0,0,0,0,0),
    notification:       p(1,0,0,0,0,0),
    warehouse_mgr:      p(0,0,0,0,0,0),
    supplier:          p(0,0,0,0,0,0),
    debt:              p(0,0,0,0,0,0),
    cash_journal:      p(0,0,0,0,0,0),
    department:        p(0,0,0,0,0,0),
    purchase_order:    p(0,0,0,0,0,0),
    profit_report:     p(0,0,0,0,0,0),
  },


  // ── WAREHOUSE: thủ kho ────────────────────────────────
  warehouse: {
    repair_order:       p(1,0,0,0,0,0),
    repair_order_price: p(0,0,0,0,0,0),
    spare_part:         p(1,1,1,0,0,1),
    stock_export:       p(1,0,1,0,1,1), // xác nhận xuất
    stock_import:       p(1,1,1,0,1,1),
    stock_transfer:     p(1,1,1,0,1,0),
    stock_count:        p(1,1,1,0,0,0),
    stock_ledger:       p(1,1,0,0,0,1),
    customer:           p(0,0,0,0,0,0),
    sale_order:         p(0,0,0,0,0,0),
    expense:            p(0,0,0,0,0,0),
    revenue_report:     p(0,0,0,0,0,0),
    staff:              p(0,0,0,0,0,0),
    kpi:                p(1,0,0,0,0,0),
    settings:           p(0,0,0,0,0,0),
    media_post:         p(1,0,0,0,0,0),
    notification:       p(1,0,0,0,0,0),
    warehouse_mgr:      p(1,0,0,0,0,0),
    supplier:          p(1,1,1,0,0,1),
    debt:              p(0,0,0,0,0,0),
    cash_journal:      p(0,0,0,0,0,0),
    department:        p(0,0,0,0,0,0),
    purchase_order:    p(1,1,1,0,1,1),
    profit_report:     p(0,0,0,0,0,0),
  },

  // ── CASHIER: thu ngân ────────────────────────────────
  cashier: {
    repair_order:       p(1,0,0,0,0,1),
    repair_order_price: p(1,0,0,0,0,0),
    spare_part:         p(1,0,0,0,0,0),
    stock_export:       p(0,0,0,0,0,0),
    stock_import:       p(0,0,0,0,0,0),
    stock_transfer:     p(0,0,0,0,0,0),
    stock_count:        p(0,0,0,0,0,0),
    stock_ledger:       p(1,0,0,0,0,0),
    customer:           p(1,1,0,0,0,1),
    sale_order:         p(1,1,1,0,0,1),
    expense:            p(1,1,0,0,0,0),
    revenue_report:     p(1,0,0,0,0,1),
    staff:              p(0,0,0,0,0,0),
    kpi:                p(0,0,0,0,0,0),
    settings:           p(0,0,0,0,0,0),
    media_post:         p(1,0,0,0,0,0),
    notification:       p(1,0,0,0,0,0),
    warehouse_mgr:      p(0,0,0,0,0,0),
    supplier:          p(0,0,0,0,0,0),
    debt:              p(1,1,1,0,0,1),
    cash_journal:      p(1,0,0,0,0,1),
    department:        p(0,0,0,0,0,0),
    purchase_order:    p(1,1,0,0,0,1),
    profit_report:     p(1,0,0,0,0,1),
  },

  // ── ACCOUNTANT: kế toán ──────────────────────────────
  accountant: {
    repair_order:       p(1,0,0,0,0,1),
    repair_order_price: p(1,0,0,0,0,0),
    spare_part:         p(1,0,0,0,0,1),
    stock_export:       p(1,0,0,0,0,1),
    stock_import:       p(1,0,0,0,0,1),
    stock_transfer:     p(0,0,0,0,0,0),
    stock_count:        p(1,0,0,0,0,1),
    stock_ledger:       p(1,0,0,0,0,1),
    customer:           p(1,0,0,0,0,1),
    sale_order:         p(1,1,1,0,0,1),
    expense:            p(1,1,1,1,0,1),
    revenue_report:     p(1,0,0,0,0,1),
    staff:              p(1,0,0,0,0,0),
    kpi:                p(1,0,0,0,0,0),
    settings:           p(0,0,0,0,0,0),
    media_post:         p(1,0,0,0,0,0),
    notification:       p(1,0,0,0,0,0),
    warehouse_mgr:      p(0,0,0,0,0,0),
    supplier:          p(1,1,1,0,0,1),
    debt:              p(1,1,1,0,1,1),
    cash_journal:      p(1,1,0,0,0,1),
    department:        p(0,0,0,0,0,0),
    purchase_order:    p(1,1,1,0,1,1),
    profit_report:     p(1,0,0,0,0,1),
  },

  // ── VIEWER: chỉ xem ──────────────────────────────────
  viewer: {
    repair_order:       p(1,0,0,0,0,0),
    repair_order_price: p(1,0,0,0,0,0),
    spare_part:         p(1,0,0,0,0,0),
    stock_export:       p(1,0,0,0,0,0),
    stock_import:       p(1,0,0,0,0,0),
    stock_transfer:     p(1,0,0,0,0,0),
    stock_count:        p(1,0,0,0,0,0),
    stock_ledger:       p(1,0,0,0,0,0),
    customer:           p(1,0,0,0,0,0),
    sale_order:         p(1,0,0,0,0,0),
    expense:            p(0,0,0,0,0,0),
    revenue_report:     p(1,0,0,0,0,0),
    staff:              p(0,0,0,0,0,0),
    kpi:                p(0,0,0,0,0,0),
    settings:           p(0,0,0,0,0,0),
    media_post:         p(1,0,0,0,0,0),
    notification:       p(0,0,0,0,0,0),
    warehouse_mgr:      p(0,0,0,0,0,0),
    supplier:          p(1,0,0,0,0,0),
    debt:              p(1,0,0,0,0,0),
    cash_journal:      p(1,0,0,0,0,0),
    department:        p(1,0,0,0,0,0),
    purchase_order:    p(1,0,0,0,0,0),
    profit_report:     p(1,0,0,0,0,0),
  },

  // ── SUPPORT: hỗ trợ kỹ thuật ─────────────────────────
  support: {
    repair_order:       p(1,1,1,0,0,0),
    repair_order_price: p(1,0,0,0,0,0),
    spare_part:         p(1,0,0,0,0,0),
    stock_export:       p(1,1,0,0,0,0),
    stock_import:       p(0,0,0,0,0,0),
    stock_transfer:     p(0,0,0,0,0,0),
    stock_count:        p(0,0,0,0,0,0),
    stock_ledger:       p(1,0,0,0,0,0),
    customer:           p(1,1,0,0,0,0),
    sale_order:         p(1,0,0,0,0,0),
    expense:            p(0,0,0,0,0,0),
    revenue_report:     p(0,0,0,0,0,0),
    staff:              p(0,0,0,0,0,0),
    kpi:                p(1,0,0,0,0,0),
    settings:           p(0,0,0,0,0,0),
    media_post:         p(1,1,0,0,0,0),
    notification:       p(1,0,0,0,0,0),
    warehouse_mgr:      p(0,0,0,0,0,0),
    supplier:          p(0,0,0,0,0,0),
    debt:              p(0,0,0,0,0,0),
    cash_journal:      p(0,0,0,0,0,0),
    department:        p(0,0,0,0,0,0),
    purchase_order:    p(0,0,0,0,0,0),
    profit_report:     p(0,0,0,0,0,0),
  },

  // ── DELIVERY: giao nhận ───────────────────────────────
  delivery: {
    repair_order:       p(1,0,1,0,0,0), // update done_date, handover
    repair_order_price: p(0,0,0,0,0,0),
    spare_part:         p(0,0,0,0,0,0),
    stock_export:       p(1,0,0,0,0,0),
    stock_import:       p(0,0,0,0,0,0),
    stock_transfer:     p(0,0,0,0,0,0),
    stock_count:        p(0,0,0,0,0,0),
    stock_ledger:       p(0,0,0,0,0,0),
    customer:           p(1,0,0,0,0,0),
    sale_order:         p(0,0,0,0,0,0),
    expense:            p(0,0,0,0,0,0),
    revenue_report:     p(0,0,0,0,0,0),
    staff:              p(0,0,0,0,0,0),
    kpi:                p(0,0,0,0,0,0),
    settings:           p(0,0,0,0,0,0),
    media_post:         p(0,0,0,0,0,0),
    notification:       p(1,0,0,0,0,0),
    warehouse_mgr:      p(0,0,0,0,0,0),
    supplier:          p(0,0,0,0,0,0),
    debt:              p(0,0,0,0,0,0),
    cash_journal:      p(0,0,0,0,0,0),
    department:        p(0,0,0,0,0,0),
    purchase_order:    p(0,0,0,0,0,0),
    profit_report:     p(0,0,0,0,0,0),
  },

  // ── MARKETING: marketing ─────────────────────────────
  marketing: {
    repair_order:       p(1,0,0,0,0,1),
    repair_order_price: p(0,0,0,0,0,0),
    spare_part:         p(1,0,0,0,0,0),
    stock_export:       p(0,0,0,0,0,0),
    stock_import:       p(0,0,0,0,0,0),
    stock_transfer:     p(0,0,0,0,0,0),
    stock_count:        p(0,0,0,0,0,0),
    stock_ledger:       p(0,0,0,0,0,0),
    customer:           p(1,1,1,0,0,1),
    sale_order:         p(1,0,0,0,0,1),
    expense:            p(0,0,0,0,0,0),
    revenue_report:     p(1,0,0,0,0,1),
    staff:              p(0,0,0,0,0,0),
    kpi:                p(0,0,0,0,0,0),
    settings:           p(0,0,0,0,0,0),
    media_post:         p(1,1,1,1,0,1),
    notification:       p(1,1,0,0,0,0),
    warehouse_mgr:      p(0,0,0,0,0,0),
    supplier:          p(0,0,0,0,0,0),
    debt:              p(0,0,0,0,0,0),
    cash_journal:      p(0,0,0,0,0,0),
    department:        p(0,0,0,0,0,0),
    purchase_order:    p(0,0,0,0,0,0),
    profit_report:     p(0,0,0,0,0,0),
  },

  // ── SUPERVISOR: giám sát ─────────────────────────────
  supervisor: {
    repair_order:       p(1,0,1,0,1,1),
    repair_order_price: p(1,0,0,0,1,0),
    spare_part:         p(1,0,0,0,0,1),
    stock_export:       p(1,0,1,0,1,1),
    stock_import:       p(1,0,0,0,1,1),
    stock_transfer:     p(1,0,0,0,1,0),
    stock_count:        p(1,0,1,0,1,0),
    stock_ledger:       p(1,0,0,0,0,1),
    customer:           p(1,0,1,0,0,1),
    sale_order:         p(1,0,0,0,1,1),
    expense:            p(1,0,0,0,0,1),
    revenue_report:     p(1,0,0,0,0,1),
    staff:              p(1,0,0,0,0,0),
    kpi:                p(1,0,1,0,1,0),
    settings:           p(1,0,0,0,0,0),
    media_post:         p(1,0,0,0,0,1),
    notification:       p(1,1,0,0,0,0),
    warehouse_mgr:      p(1,0,0,0,0,0),
    supplier:          p(1,0,0,0,0,1),
    debt:              p(1,0,0,0,1,1),
    cash_journal:      p(1,0,0,0,0,1),
    department:        p(1,0,0,0,0,0),
    purchase_order:    p(1,0,0,0,1,1),
    profit_report:     p(1,0,0,0,0,1),
  },

  // ── QA: kiểm soát chất lượng ──────────────────────────
  qa: {
    repair_order:       p(1,0,1,0,1,1),
    repair_order_price: p(1,0,0,0,0,0),
    spare_part:         p(1,0,0,0,0,0),
    stock_export:       p(1,0,0,0,0,0),
    stock_import:       p(0,0,0,0,0,0),
    stock_transfer:     p(0,0,0,0,0,0),
    stock_count:        p(1,1,1,0,0,0),
    stock_ledger:       p(1,0,0,0,0,0),
    customer:           p(1,0,0,0,0,0),
    sale_order:         p(0,0,0,0,0,0),
    expense:            p(0,0,0,0,0,0),
    revenue_report:     p(0,0,0,0,0,0),
    staff:              p(0,0,0,0,0,0),
    kpi:                p(1,0,1,0,0,0),
    settings:           p(0,0,0,0,0,0),
    media_post:         p(1,1,0,0,0,0),
    notification:       p(1,0,0,0,0,0),
    warehouse_mgr:      p(0,0,0,0,0,0),
    supplier:          p(0,0,0,0,0,0),
    debt:              p(0,0,0,0,0,0),
    cash_journal:      p(0,0,0,0,0,0),
    department:        p(0,0,0,0,0,0),
    purchase_order:    p(0,0,0,0,0,0),
    profit_report:     p(1,0,0,0,0,0),
  },

  // ── HR: nhân sự ──────────────────────────────────────
  hr: {
    repair_order:       p(0,0,0,0,0,0),
    repair_order_price: p(0,0,0,0,0,0),
    spare_part:         p(0,0,0,0,0,0),
    stock_export:       p(0,0,0,0,0,0),
    stock_import:       p(0,0,0,0,0,0),
    stock_transfer:     p(0,0,0,0,0,0),
    stock_count:        p(0,0,0,0,0,0),
    stock_ledger:       p(0,0,0,0,0,0),
    customer:           p(0,0,0,0,0,0),
    sale_order:         p(0,0,0,0,0,0),
    expense:            p(1,1,1,0,0,1), // lương, thưởng
    revenue_report:     p(0,0,0,0,0,0),
    staff:              p(1,1,1,1,0,1),
    kpi:                p(1,0,1,0,0,1),
    settings:           p(0,0,0,0,0,0),
    media_post:         p(1,1,0,0,0,0),
    notification:       p(1,1,0,0,0,0),
    warehouse_mgr:      p(0,0,0,0,0,0),
    supplier:          p(0,0,0,0,0,0),
    debt:              p(0,0,0,0,0,0),
    cash_journal:      p(0,0,0,0,0,0),
    department:        p(1,1,1,0,0,0),
  },

  // ── IT: IT/dev nội bộ ────────────────────────────────
  it: {
    repair_order:       p(1,0,0,0,0,1),
    repair_order_price: p(1,0,0,0,0,0),
    spare_part:         p(1,1,1,1,0,1),
    stock_export:       p(1,0,0,0,0,0),
    stock_import:       p(1,0,0,0,0,0),
    stock_transfer:     p(0,0,0,0,0,0),
    stock_count:        p(0,0,0,0,0,0),
    stock_ledger:       p(1,0,0,0,0,1),
    customer:           p(1,0,0,0,0,0),
    sale_order:         p(1,0,0,0,0,0),
    expense:            p(0,0,0,0,0,0),
    revenue_report:     p(1,0,0,0,0,1),
    staff:              p(1,1,1,0,0,0),
    kpi:                p(1,0,0,0,0,0),
    settings:           p(1,0,1,0,0,0),
    media_post:         p(1,1,1,0,0,0),
    notification:       p(1,1,0,0,0,0),
    warehouse_mgr:      p(1,1,1,0,0,0),
    supplier:          p(1,0,0,0,0,0),
    debt:              p(1,0,0,0,0,0),
    cash_journal:      p(1,0,0,0,0,0),
    department:        p(1,0,0,0,0,0),
  },

  // ── GUEST: khách ─────────────────────────────────────
  guest: {
    repair_order:       p(1,0,0,0,0,0), // chỉ xem đơn của mình (public link)
    repair_order_price: p(0,0,0,0,0,0),
    spare_part:         p(0,0,0,0,0,0),
    stock_export:       p(0,0,0,0,0,0),
    stock_import:       p(0,0,0,0,0,0),
    stock_transfer:     p(0,0,0,0,0,0),
    stock_count:        p(0,0,0,0,0,0),
    stock_ledger:       p(0,0,0,0,0,0),
    customer:           p(0,0,0,0,0,0),
    sale_order:         p(0,0,0,0,0,0),
    expense:            p(0,0,0,0,0,0),
    revenue_report:     p(0,0,0,0,0,0),
    staff:              p(0,0,0,0,0,0),
    kpi:                p(0,0,0,0,0,0),
    settings:           p(0,0,0,0,0,0),
    media_post:         p(1,0,0,0,0,0),
    notification:       p(0,0,0,0,0,0),
    warehouse_mgr:      p(0,0,0,0,0,0),
    supplier:          p(0,0,0,0,0,0),
    debt:              p(0,0,0,0,0,0),
    cash_journal:      p(0,0,0,0,0,0),
    department:        p(0,0,0,0,0,0),
  },
};

// Default empty permissions object
const EMPTY_PERMS = Object.fromEntries(
  RESOURCES.map(r => [r, p()])
);

// ══════════════════════════════════════════════════════════
// CONTEXT
// ══════════════════════════════════════════════════════════
const PermissionContext = createContext({
  can:      () => false,
  role:     null,
  roleData: null,
  isLoaded: false,
  dbRoles:  [],
  matrix:   STATIC_MATRIX,
});

export function PermissionProvider({ user, children }) {
  const [dbRoles,    setDbRoles]    = useState([]);
  const [dbMatrix,   setDbMatrix]   = useState(null); // null = not loaded yet
  const [isLoaded,   setIsLoaded]   = useState(false);

  const role = user?.role || null;

  useEffect(() => {
    if (!role) { setIsLoaded(true); return; }
    let cancelled = false;

    async function fetchPermissions() {
      try {
        const [roles, perms] = await Promise.all([
          Role.list({ limit: 100 }),
          RolePermission.list({ limit: 2000 }),
        ]);

        if (cancelled) return;

        setDbRoles(roles || []);

        if (!perms || perms.length === 0) {
          // DB chưa có dữ liệu → dùng static fallback
          setDbMatrix(null);
        } else {
          // Build matrix từ DB
          const matrix = {};
          (perms || []).forEach(p => {
            if (!matrix[p.role_key]) matrix[p.role_key] = {};
            matrix[p.role_key][p.resource] = {
              view:    !!p.can_view,
              create:  !!p.can_create,
              edit:    !!p.can_edit,
              delete:  !!p.can_delete,
              approve: !!p.can_approve,
              export:  !!p.can_export,
            };
          });
          setDbMatrix(matrix);
        }
      } catch (e) {
        // Lỗi mạng → fallback static, không crash
        console.warn("[PermissionContext] DB fetch failed, using static fallback:", e.message);
        setDbMatrix(null);
      }
      if (!cancelled) setIsLoaded(true);
    }

    fetchPermissions();
    return () => { cancelled = true; };
  }, [role]);

  // Lấy matrix đang dùng (DB ưu tiên, fallback static)
  const activeMatrix = dbMatrix || STATIC_MATRIX;

  const can = useCallback((resource, action = "view") => {
    if (!role) return false;
    const rolePerms = activeMatrix[role] || activeMatrix["guest"] || {};
    const resPerms  = rolePerms[resource] || EMPTY_PERMS[resource] || p();
    return !!resPerms[action];
  }, [role, activeMatrix]);

  // roleData: object mô tả role (từ DB hoặc static)
  const roleData = dbRoles.find(r => r.key === role) || null;

  return (
    <PermissionContext.Provider value={{
      can,
      role,
      roleData,
      isLoaded,
      dbRoles,
      matrix: activeMatrix,
    }}>
      {children}
    </PermissionContext.Provider>
  );
}

// ── Hook chính ────────────────────────────────────────────
export function usePermission() {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    // Fallback an toàn nếu dùng ngoài Provider
    return {
      can:      () => false,
      role:     null,
      roleData: null,
      isLoaded: true,
      dbRoles:  [],
      matrix:   STATIC_MATRIX,
    };
  }
  return ctx;
}

// ── Export thêm cho các component khác ───────────────────
export { STATIC_MATRIX, RESOURCES, ACTIONS };
export default PermissionContext;
