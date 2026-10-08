/**
 * teamScope.js — quy tắc "ai thấy dữ liệu của ai" theo tổ.
 *
 *  - Vai trò quản trị/vận hành kho/kế toán: thấy tất cả.
 *  - Tổ viên: chỉ thấy của mình.
 *  - Tổ trưởng: của mình + của tổ viên trong tổ mình (KHÔNG thấy tổ khác).
 *
 * Tổ viên của 1 tổ trưởng = nhân viên (không phải tổ trưởng) cùng phòng ban có leader_id = tổ trưởng,
 * hoặc chưa gán leader_id → tính cho tổ trưởng đầu tiên của phòng (khớp StaffManager & MyTasksPage).
 */
export const SEE_ALL_ROLES = ["owner", "admin", "manager", "supervisor", "warehouse", "accountant", "cashier", "it"];

/** Danh sách id tổ viên của tổ trưởng `user` (không gồm chính họ) */
export function getTeamMemberIds(user, staffList = []) {
  if (!user?.is_leader || !staffList.length) return [];
  const dept = user.department_id || "";
  const firstLeaderId = staffList.find(s => s.is_leader && s.department_id === dept)?.id;
  return staffList
    .filter(s => !s.is_leader && s.department_id === dept &&
      (s.leader_id === user.id || (!s.leader_id && firstLeaderId === user.id)))
    .map(s => s.id);
}

/** true nếu user thấy toàn bộ (không cần lọc theo người) */
export function canSeeAll(user) {
  return SEE_ALL_ROLES.includes(user?.role);
}

/**
 * Lọc danh sách bản ghi theo phạm vi của user.
 * @param rows        mảng bản ghi
 * @param user        user hiện tại ({id, role, is_leader, department_id})
 * @param staffList   danh sách staff (để tính tổ viên)
 * @param ownerOf     (row) => id người sở hữu bản ghi (vd r => r.requested_by)
 */
export function scopeByTeam(rows, user, staffList, ownerOf) {
  if (!user?.id) return [];
  if (canSeeAll(user)) return rows;
  const allowed = new Set([user.id, ...getTeamMemberIds(user, staffList)]);
  return rows.filter(r => allowed.has(ownerOf(r)));
}
