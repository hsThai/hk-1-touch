/* v2-kiotviet-sync */
import { useState, useEffect } from "react";
import { SparePart, SparePartUsage, RepairChat, RepairOrder } from "./pb.jsx";
import { syncKvProducts, createKvDeliveryOrder } from "./kiotviet.jsx";

// ── Màn hình linh kiện cho KTV ──
export default function SparePartModal({ order, currentStaff, onClose, onDone }) {
  const [parts, setParts]           = useState([]);
  const [usages, setUsages]         = useState([]);
  const [search, setSearch]         = useState("");
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState("list"); // "list" | "used"
  const [toast, setToast]           = useState("");
  const [confirming, setConfirming] = useState(false);
  const [finishing, setFinishing]   = useState(false);
  // KiotViet sync
  const [kvSyncing, setKvSyncing]   = useState(false);
  const [kvSyncMsg, setKvSyncMsg]   = useState("");
  // Xuất kho
  const [exporting, setExporting]   = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [exportResult, setExportResult] = useState(null);

  useEffect(() => { loadAll(); }, [order.id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [p, u] = await Promise.all([
        SparePart.filter({ is_active: true }),
        SparePartUsage.filter({ order_id: order.id }),
      ]);
      setParts(p.sort((a,b) => (a.name||"").localeCompare(b.name)));
      setUsages(u);
    } catch {}
    setLoading(false);
  }

  // ── Đồng bộ tồn kho từ KiotViet ──
  async function handleSyncKv() {
    setKvSyncing(true);
    setKvSyncMsg("⏳ Đang kết nối KiotViet...");
    try {
      const result = await syncKvProducts((done, total) => {
        setKvSyncMsg(`⏳ Đã tải ${done}/${total} sản phẩm...`);
      });
      setKvSyncMsg(`✅ Đồng bộ xong ${result.synced} sản phẩm!`);
      // Reload danh sách
      const p = await SparePart.filter({ is_active: true });
      setParts(p.sort((a,b) => (a.name||"").localeCompare(b.name)));
      setTimeout(() => setKvSyncMsg(""), 3000);
    } catch (e) {
      setKvSyncMsg(`❌ ${e.message || "Lỗi đồng bộ KiotViet"}`);
      setTimeout(() => setKvSyncMsg(""), 4000);
    }
    setKvSyncing(false);
  }

  // ── Thêm linh kiện vào đơn ──
  async function addPart(part) {
    const exist = usages.find(u => u.part_id === part.id && u.status !== "returned");
    if (exist) { showToast("⚠️ Linh kiện này đã được thêm vào đơn!"); return; }
    try {
      const usage = await SparePartUsage.create({
        order_id:      order.id,
        order_code:    order.order_code || order.id,
        part_id:       part.id,
        part_name:     part.name,
        sku:           part.sku || "",
        qty_requested: 1,
        qty_returned:  0,
        qty_used:      1,
        unit_price:    part.price || 0,
        total_price:   part.price || 0,
        status:        "pending",
        is_extra:      order.status === "Đang sửa",
      });
      await sendWarehouseChat(part, usage.id);
      setUsages(prev => [...prev, usage]);
      setTab("used");
      showToast(`✅ Đã thêm "${part.name}"`);
    } catch {
      showToast("❌ Lỗi thêm linh kiện!");
    }
  }

  // ── Đề nghị xuất hàng KiotViet ──
  async function handleRequestExport() {
    const pendingUsages = usages.filter(u => u.status === "pending" || u.status === "approved");
    if (pendingUsages.length === 0) {
      showToast("⚠️ Không có linh kiện nào cần xuất!");
      return;
    }

    // Gom các linh kiện có kiotviet_id
    const toExport = [];
    for (const u of pendingUsages) {
      const part = parts.find(p => p.id === u.part_id);
      if (!part) continue;
      toExport.push({
        kvProductId: part.kiotviet_id || "",
        sku:         part.sku || "",
        name:        part.name,
        qty:         u.qty_requested || 1,
        price:       u.unit_price || 0,
        usageId:     u.id,
      });
    }

    if (toExport.filter(p => p.kvProductId).length === 0) {
      // Không có sản phẩm KiotViet nào — chỉ ghi chat thông báo
      showToast("⚠️ Các linh kiện chưa có mã KiotViet. Đã gửi yêu cầu qua chat kho.");
      await sendBulkWarehouseChat(pendingUsages);
      return;
    }

    setExporting(true);
    try {
      const result = await createKvDeliveryOrder({
        orderCode:       order.order_code || order.id,
        deviceModel:     order.device_model || order.device_name || "?",
        technicianName:  currentStaff.full_name,
        parts:           toExport.filter(p => p.kvProductId),
      });

      // Cập nhật status usage → "requested"
      for (const p of toExport) {
        await SparePartUsage.update(p.usageId, { status: "approved", note: `KiotViet: ${result.transferCode || result.invoiceCode || "OK"}` });
      }
      setUsages(prev => prev.map(u => {
        const found = toExport.find(p => p.usageId === u.id);
        return found ? { ...u, status: "approved" } : u;
      }));

      setExportResult(result);
      setExportDone(true);

      // Gửi chat thông báo xuất thành công
      await RepairChat.create({
        order_id:     order.id,
        order_code:   order.order_code || order.id,
        sender_id:    currentStaff.id,
        sender_name:  currentStaff.full_name,
        message:      `✅ [ĐÃ TẠO PHIẾU XUẤT KHO KIOTVIET]\n━━━━━━━━━━━━━━━━\n📋 Đơn: ${order.order_code}\n📱 Máy: ${order.device_model || "?"}\n🔧 KTV: ${currentStaff.full_name}\n📦 Phiếu KV: ${result.transferCode || result.invoiceCode || result.transferId || "N/A"}\n📊 ${toExport.length} loại linh kiện`,
        message_type: "system",
      });

      showToast(`✅ Đã tạo phiếu xuất kho KiotViet!\nMã phiếu: ${result.transferCode || result.invoiceCode || "OK"}`);
    } catch (e) {
      // Nếu KiotViet lỗi, fallback gửi chat thủ công
      showToast(`⚠️ KiotViet lỗi: ${e.message}\nĐã gửi yêu cầu qua chat kho thay thế.`);
      await sendBulkWarehouseChat(pendingUsages);
    }
    setExporting(false);
  }

  async function sendBulkWarehouseChat(usageList) {
    const lines = usageList.map(u => `  • ${u.part_name} × ${u.qty_requested || 1} ${u.sku ? `(${u.sku})` : ""}`).join("\n");
    const msg = `📦 [YÊU CẦU XUẤT KHO]\n━━━━━━━━━━━━━━━━\n📋 Đơn: ${order.order_code || order.id}\n📱 Máy: ${order.device_model || "?"}\n🔧 KTV: ${currentStaff.full_name}\n\nDanh sách linh kiện:\n${lines}\n\n⏰ Vui lòng xuất kho và xác nhận!`;
    await RepairChat.create({
      order_id:     order.id,
      order_code:   order.order_code || order.id,
      sender_id:    currentStaff.id,
      sender_name:  currentStaff.full_name,
      message:      msg,
      message_type: "system",
    });
  }

  async function sendWarehouseChat(part, usageId) {
    const isExtra = order.status === "Đang sửa";
    const msg = `📦 [TỰ ĐỘNG] Yêu cầu xuất tạm linh kiện\n━━━━━━━━━━━━━━━━\n📋 Đơn: ${order.order_code}\n📱 Máy: ${order.device_model || "?"}\n🔧 KTV: ${currentStaff.full_name}\n📦 LK: ${part.name}${part.sku?` (${part.sku})`:""}\n📊 SL: 1 ${part.unit||"cái"}\n💰 Giá: ${(part.price||0).toLocaleString()}đ${isExtra?"\n⚠️ PHÁT SINH trong quá trình sửa":""}`;
    try {
      await RepairChat.create({
        order_id:     order.id,
        order_code:   order.order_code || order.id,
        sender_id:    currentStaff.id,
        sender_name:  currentStaff.full_name,
        message:      msg,
        message_type: "system",
      });
    } catch {}
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 4000); }

  // ── Hoàn tất sửa chữa ──
  async function handleFinish() {
    setFinishing(true);
    try {
      const activeUsages = usages.filter(u => u.status !== "returned");
      const totalParts = activeUsages.reduce((sum,u) => sum + (u.total_price||0), 0);
      const newFinal = (order.estimated_cost||0) + totalParts;
      await RepairOrder.update(order.id, { status:"Sửa Xong", done_date: new Date().toISOString(), final_cost: newFinal });
      await RepairChat.create({
        order_id:    order.id,
        order_code:  order.order_code || order.id,
        sender_id:   currentStaff.id,
        sender_name: currentStaff.full_name,
        message:     `✅ KTV ${currentStaff.full_name} đã hoàn tất sửa chữa!\n💰 Tổng bill: ${newFinal.toLocaleString()}đ (LK: ${totalParts.toLocaleString()}đ + Công: ${(order.estimated_cost||0).toLocaleString()}đ)`,
        message_type:"system",
      });
      if (onDone) onDone();
    } catch { showToast("❌ Lỗi cập nhật!"); }
    setFinishing(false);
    setConfirming(false);
  }

  const activeUsages   = usages.filter(u => u.status !== "returned");
  const pendingUsages  = usages.filter(u => u.status === "pending");
  const totalPartCost  = activeUsages.reduce((sum,u) => sum+(u.total_price||0), 0);
  const totalBill      = (order.estimated_cost||0) + totalPartCost;

  const filteredParts = parts.filter(p =>
    !search || (p.name||"").toLowerCase().includes(search.toLowerCase()) || (p.sku||"").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ position:"fixed", inset:0, zIndex:3000, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", width:"100%", maxWidth:600, maxHeight:"92vh", display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#1e1b4b,#4f46e5)", padding:"18px 20px", borderRadius:"24px 24px 0 0", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ color:"#fff", fontWeight:900, fontSize:17 }}>🔩 Linh Kiện — {order.order_code}</div>
              <div style={{ color:"#a5b4fc", fontSize:13, marginTop:2 }}>{order.device_model || order.device_name || "?"} · {order.customer_name}</div>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {/* Nút sync KiotViet */}
              <button onClick={handleSyncKv} disabled={kvSyncing}
                style={{ height:34, padding:"0 12px", background:"rgba(255,255,255,.2)", border:"1.5px solid rgba(255,255,255,.4)", color:"#fff", borderRadius:10, fontSize:12, fontWeight:700, cursor:kvSyncing?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:4 }}>
                {kvSyncing ? "⏳" : "🔄"} KiotViet
              </button>
              <button onClick={onClose}
                style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:36, height:36, borderRadius:"50%", fontSize:18, cursor:"pointer" }}>✕</button>
            </div>
          </div>
          {kvSyncMsg && (
            <div style={{ marginTop:8, background:"rgba(255,255,255,.15)", borderRadius:10, padding:"8px 12px", fontSize:12, color:"#fff", fontWeight:600 }}>
              {kvSyncMsg}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"2px solid #e5e7eb", flexShrink:0 }}>
          {[
            { key:"list", label:`📦 Chọn linh kiện (${filteredParts.length})` },
            { key:"used", label:`✅ Đã chọn (${activeUsages.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ flex:1, padding:"12px 0", border:"none", background:"none", fontWeight:700, fontSize:14, cursor:"pointer", color:tab===t.key?"#4f46e5":"#6b7280", borderBottom:tab===t.key?"3px solid #4f46e5":"3px solid transparent", marginBottom:-2 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:"auto", padding:"0 0 12px" }}>
          {loading ? (
            <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>⏳ Đang tải...</div>
          ) : tab === "list" ? (
            <>
              <div style={{ padding:"12px 16px 8px", position:"sticky", top:0, background:"#fff", zIndex:1 }}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="🔍 Tìm tên hoặc SKU linh kiện..."
                  style={{ width:"100%", height:42, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:14, outline:"none", boxSizing:"border-box" }} />
                {parts.length === 0 && (
                  <div style={{ marginTop:8, background:"#fffbeb", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#92400e", fontWeight:600 }}>
                    ⚠️ Chưa có linh kiện. Nhấn "🔄 KiotViet" để đồng bộ từ kho.
                  </div>
                )}
              </div>
              {filteredParts.map(part => {
                const inOrder = usages.find(u => u.part_id === part.id && u.status !== "returned");
                return (
                  <div key={part.id}
                    style={{ margin:"0 12px 8px", background:inOrder?"#f0fdf4":"#fff", borderRadius:14, padding:"12px 14px", border:`1.5px solid ${inOrder?"#6ee7b7":"#e5e7eb"}`, display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:"#111", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{part.name}</div>
                      <div style={{ fontSize:12, color:"#6b7280", marginTop:2, display:"flex", gap:8, flexWrap:"wrap" }}>
                        {part.sku && <span>SKU: {part.sku}</span>}
                        <span style={{ color: (part.stock_qty||0) > 0 ? "#059669" : "#dc2626", fontWeight:700 }}>
                          Tồn: {part.stock_qty||0} {part.unit||"cái"}
                        </span>
                        {part.category && <span style={{ color:"#6b7280" }}>{part.category}</span>}
                      </div>
                      <div style={{ fontSize:13, fontWeight:800, color:"#4f46e5", marginTop:2 }}>{(part.price||0).toLocaleString()}đ</div>
                    </div>
                    <button onClick={() => inOrder ? null : addPart(part)} disabled={!!inOrder}
                      style={{ height:38, padding:"0 14px", borderRadius:10, border:"none", background:inOrder?"#d1fae5":"#4f46e5", color:inOrder?"#059669":"#fff", fontWeight:800, fontSize:13, cursor:inOrder?"default":"pointer", flexShrink:0, minWidth:70 }}>
                      {inOrder ? "✓ Đã chọn" : "+ Thêm"}
                    </button>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div style={{ padding:"12px 16px 4px" }}>
                {activeUsages.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"30px 20px", color:"#9ca3af" }}>
                    <div style={{ fontSize:40, marginBottom:8 }}>📦</div>
                    <div>Chưa chọn linh kiện nào</div>
                  </div>
                ) : (
                  <>
                    {activeUsages.map(u => (
                      <div key={u.id} style={{ background:"#f9fafb", borderRadius:14, padding:"12px 14px", marginBottom:8, border:"1.5px solid #e5e7eb" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:14 }}>{u.part_name}</div>
                            {u.sku && <div style={{ fontSize:12, color:"#6b7280" }}>SKU: {u.sku}</div>}
                          </div>
                          <div style={{ textAlign:"right", flexShrink:0 }}>
                            <div style={{ fontSize:13, fontWeight:800, color:"#4f46e5" }}>{(u.total_price||0).toLocaleString()}đ</div>
                            <div style={{ fontSize:11, color: u.status==="approved"?"#059669":u.status==="pending"?"#d97706":"#6b7280", fontWeight:700, marginTop:2 }}>
                              {u.status==="approved" ? "✅ Đã xuất" : u.status==="pending" ? "⏳ Chờ xuất" : u.status}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize:12, color:"#6b7280", marginTop:4 }}>SL: {u.qty_requested||1} × {(u.unit_price||0).toLocaleString()}đ</div>
                      </div>
                    ))}

                    {/* Tổng */}
                    <div style={{ background:"#eef2ff", borderRadius:14, padding:14, marginTop:4, border:"1.5px solid #c7d2fe" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#374151", marginBottom:6 }}>
                        <span>💼 Công sửa (dự kiến)</span>
                        <span style={{ fontWeight:700 }}>{(order.estimated_cost||0).toLocaleString()}đ</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#374151", marginBottom:6 }}>
                        <span>🔩 Linh kiện ({activeUsages.length} loại)</span>
                        <span style={{ fontWeight:700 }}>{totalPartCost.toLocaleString()}đ</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:15, color:"#1e1b4b", fontWeight:900, paddingTop:8, borderTop:"1.5px solid #c7d2fe" }}>
                        <span>💰 Tổng bill dự kiến</span>
                        <span style={{ color:"#4f46e5" }}>{totalBill.toLocaleString()}đ</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding:"12px 16px 20px", borderTop:"1.5px solid #e5e7eb", flexShrink:0, display:"flex", flexDirection:"column", gap:10 }}>

          {/* Nút Đề nghị xuất hàng */}
          {tab === "used" && pendingUsages.length > 0 && (
            <button onClick={handleRequestExport} disabled={exporting}
              style={{ width:"100%", height:52, background: exporting ? "#9ca3af" : "linear-gradient(135deg,#f59e0b,#d97706)", border:"none", borderRadius:14, color:"#fff", fontWeight:900, fontSize:16, cursor:exporting?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 4px 16px rgba(245,158,11,.4)" }}>
              {exporting ? "⏳ Đang tạo phiếu KiotViet..." : `📤 Đề Nghị Xuất Hàng (${pendingUsages.length} LK)`}
            </button>
          )}

          {/* Kết quả xuất kho */}
          {exportDone && exportResult && (
            <div style={{ background:"#f0fdf4", borderRadius:12, padding:"10px 14px", border:"1.5px solid #6ee7b7", fontSize:13, fontWeight:700, color:"#065f46", textAlign:"center" }}>
              ✅ Phiếu KiotViet: {exportResult.transferCode || exportResult.invoiceCode || "Đã tạo"}
            </div>
          )}

          {/* Nút Sửa Xong */}
          {tab === "used" && (
            confirming ? (
              <div style={{ background:"#fef2f2", borderRadius:14, padding:14, border:"1.5px solid #fca5a5" }}>
                <div style={{ fontWeight:800, color:"#dc2626", marginBottom:10, textAlign:"center" }}>⚠️ Xác nhận hoàn tất sửa chữa?</div>
                <div style={{ fontSize:13, color:"#374151", marginBottom:12, textAlign:"center" }}>Tổng bill: <strong style={{color:"#4f46e5"}}>{totalBill.toLocaleString()}đ</strong></div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => setConfirming(false)} style={{ flex:1, height:46, background:"#f3f4f6", border:"none", borderRadius:12, fontWeight:700, cursor:"pointer" }}>Huỷ</button>
                  <button onClick={handleFinish} disabled={finishing}
                    style={{ flex:2, height:46, background:"#059669", border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:finishing?"not-allowed":"pointer" }}>
                    {finishing ? "⏳ Đang lưu..." : "✅ Xác nhận Sửa Xong"}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirming(true)}
                style={{ width:"100%", height:52, background:"linear-gradient(135deg,#059669,#047857)", border:"none", borderRadius:14, color:"#fff", fontWeight:900, fontSize:16, cursor:"pointer", boxShadow:"0 4px 16px rgba(5,150,105,.4)" }}>
                ✅ Sửa Xong — Tổng {totalBill.toLocaleString()}đ
              </button>
            )
          )}

          {tab === "list" && activeUsages.length > 0 && (
            <button onClick={() => setTab("used")}
              style={{ width:"100%", height:48, background:"#4f46e5", color:"#fff", border:"none", borderRadius:14, fontWeight:800, fontSize:14, cursor:"pointer" }}>
              Xem {activeUsages.length} LK đã chọn →
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ position:"fixed", bottom:100, left:"50%", transform:"translateX(-50%)", background:"#1e1b4b", color:"#fff", borderRadius:14, padding:"12px 24px", fontSize:14, fontWeight:700, zIndex:5000, whiteSpace:"pre-line", maxWidth:340, textAlign:"center" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
