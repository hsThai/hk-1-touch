/* v1774860462-5727 */
import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import HandoverModal from "./HandoverModal.jsx";
import { printReceiptA5, printBillA5, previewBill, previewReceiptForm } from "../utils/printClient.js";
import EditOrderModal from "./EditOrderModal.jsx";
import PreCheckModal, { QT2Modal, CustomerConfirmModal } from "./PreCheckModal.jsx";
const SparePartModal = lazy(() => import("./SparePartModal").catch(() => ({ default: ({ onClose }) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{background:"#fff",borderRadius:16,padding:32,textAlign:"center"}}>
      <div style={{fontSize:32}}>⚠️</div>
      <div style={{fontWeight:700,marginTop:8}}>Không tải được module linh kiện</div>
      <button onClick={onClose} style={{marginTop:16,padding:"10px 24px",background:"#4f46e5",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>Đóng</button>
    </div>
  </div>
)})));
import { RepairChat, Notification, Staff, RepairOrder, SparePart, SparePartUsage, StockExportRequest, ActionLog, subscribeCollection, getPbUrl, getAuth, logHistory, logAction, pbSettings, DebtVoucher, DebtPayment, CashJournal, Customer, getLocalDate } from "./pb.jsx";
import { usePermission } from "./PermissionContext.jsx";
import { getNotifSound } from "./notifUtils.js";
import { uploadFile } from "./pb.jsx";

import { QRScanModal, QRPrintModal, QRCanvas, getQRDataUrl, loadQRLib } from "./QRComponents";
import { NewOrderModal } from "./OrderForms";
import { timeAgo, genOrderId, getKpiTimerInfo, MediaViewer, AcceptChecklistModal, AcceptTimer, STATUS_COLS, STATUS_PB, STATUS_DISPLAY, PRIORITY_PB, PRIORITY_DISPLAY } from "./MediaViewer";
import ShareOrderModal from "./ShareOrderModal.jsx";

// ── Play notification sound from settings ──────────────────
async function playNotifSound(type) {
  try {
    const master = await getNotifSound("notif_sound_master");
    if (master === "off") return;
    const soundKey = await getNotifSound(type);
    if (soundKey === "none") return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (soundKey === "beep") {
      osc.type = "square"; osc.frequency.value = 1000;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(); osc.stop(ctx.currentTime + 0.15);
    } else if (soundKey === "chime") {
      [523,659,784,1047].forEach((f,i) => setTimeout(() => { try {
        const c=new (window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();
        o.connect(g);g.connect(c.destination);o.type="triangle";o.frequency.value=f;
        g.gain.setValueAtTime(0.35,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.4);
        o.start();o.stop(c.currentTime+0.4);
      }catch{}},i*130));
    } else { // ding / bell (default)
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
      if (soundKey === "bell") {
        setTimeout(() => { try {
          const c2=new (window.AudioContext||window.webkitAudioContext)(),o2=c2.createOscillator(),g2=c2.createGain();
          o2.connect(g2);g2.connect(c2.destination);o2.type="sine";
          o2.frequency.setValueAtTime(880,c2.currentTime);o2.frequency.exponentialRampToValueAtTime(440,c2.currentTime+0.3);
          g2.gain.setValueAtTime(0.5,c2.currentTime);g2.gain.exponentialRampToValueAtTime(0.001,c2.currentTime+0.5);
          o2.start();o2.stop(c2.currentTime+0.5);
        }catch{}},400);
      }
    }
  } catch {}
}





// ── Auto ghi công nợ + sổ quỹ khi thu tiền đơn sửa ────────────────────────
async function autoCreateOrUpdateDebt(order, finalCost, deposit, payMethod, currentUser) {
  try {
    const existing = await DebtVoucher.filter({ origin_id: order.id });
    const totalAmt   = finalCost || order.final_cost || 0;
    const depositAmt = deposit   || order.deposit    || 0;
    const remaining  = Math.max(0, totalAmt - depositAmt);
    const pmKey      = payMethod === "Tiền mặt" ? "cash" : "transfer";

    if (existing && existing.length > 0) {
      const v = existing[0];
      await DebtVoucher.update(v.id, {
        total_amount: totalAmt, paid_amount: totalAmt, remaining: 0, status: "paid",
      });
      logAction(currentUser, "update", "debt_voucher", v.id, `Cập nhật công nợ: ${order.order_code||order.id} — ${totalAmt.toLocaleString("vi-VN")}đ`);
      if (remaining > 0) {
        await DebtPayment.create({
          voucher_id: v.id, voucher_code: v.voucher_code,
          party_name: order.customer_name, amount: remaining,
          payment_method: pmKey, paid_at: new Date().toISOString(),
          note: "Thu lần cuối khi giao máy",
          created_by_id: currentUser.id, created_by_name: currentUser.full_name || currentUser.name || "",
        });
      }
    } else {
      const voucherCode = "PT-" + String(Date.now()).slice(-6);
      const v = await DebtVoucher.create({
        voucher_code: voucherCode, voucher_type: "receivable",
        party_type: "customer", party_id: order.customer_phone || "",
        party_name: order.customer_name || "",
        origin_type: "repair_order", origin_id: order.id,
        origin_code: order.order_code || order.id,
        total_amount: totalAmt, paid_amount: totalAmt, remaining: 0, status: "paid",
        created_by_id: currentUser.id, created_by_name: currentUser.full_name || currentUser.name || "",
      });
      logAction(currentUser, "create", "debt_voucher", v.id, `Tạo phiếu công nợ: ${voucherCode} — ${order.customer_name} — ${totalAmt.toLocaleString("vi-VN")}đ`);
      if (depositAmt > 0) {
        await DebtPayment.create({
          voucher_id: v.id, voucher_code: voucherCode,
          party_name: order.customer_name, amount: depositAmt,
          payment_method: "cash",
          paid_at: order.received_date || new Date().toISOString(),
          note: "Đặt cọc khi tiếp nhận",
          created_by_id: currentUser.id, created_by_name: currentUser.full_name || currentUser.name || "",
        });
      }
      if (remaining > 0) {
        await DebtPayment.create({
          voucher_id: v.id, voucher_code: voucherCode,
          party_name: order.customer_name, amount: remaining,
          payment_method: pmKey, paid_at: new Date().toISOString(),
          note: "Thu lần cuối khi giao máy",
          created_by_id: currentUser.id, created_by_name: currentUser.full_name || currentUser.name || "",
        });
      }
    }

    if (pmKey === "cash" && remaining > 0) {
      const cj = await CashJournal.create({
        journal_date:    getLocalDate(),
        entry_type:      "receipt",
        amount:          remaining,
        ref_type:        "repair_order",
        ref_id:          order.id,
        ref_code:        order.order_code || order.id,
        description:     "Thu tiền sửa: " + (order.customer_name || "") + " - " + (order.device_model || ""),
        payment_method:  "cash",
        created_by_id:   currentUser.id,
        created_by_name: currentUser.full_name || currentUser.name || "",
      });
      logAction(currentUser, "confirm_payment", "cash_journal", cj.id, `Thu tiền sửa: ${order.order_code||order.id} — ${remaining.toLocaleString("vi-VN")}đ`);
    }

    await RepairOrder.update(order.id, {
      payment_status: "paid",
      paid_at:        new Date().toISOString(),
      paid_final:     remaining,
    });
    logAction(currentUser, "confirm_payment", "repair_order", order.id, `Giao máy + thanh toán: ${order.order_code||order.id} — ${totalAmt.toLocaleString("vi-VN")}đ`);
  } catch(e) {
    console.error("autoCreateOrUpdateDebt error:", e);
  }
}

function OrderDrawer({ order, onClose, currentUser, onUpdate, users, onShowQR, onGoToPendingAccept, canRepairEdit, canRepairDelete }) {
  const [chatInput, setChatInput] = useState("");
  const [chats, setChats] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatUploading, setChatUploading] = useState(false);
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionCursor, setMentionCursor] = useState(0);
  const [mentionList, setMentionList] = useState([]);
  const [pendingMentions, setPendingMentions] = useState([]); // [{id, name}]
  const [tab, setTab] = useState("info");
  const [exportReqs, setExportReqs] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [ktvConfirmingId, setKtvConfirmingId] = useState(null);
  const [ktvConfirmNote, setKtvConfirmNote]   = useState("");
  const [ktvSubmitting, setKtvSubmitting]     = useState(false);
  const [showHandover, setShowHandover]       = useState(false);
  const [showPreCheck, setShowPreCheck]       = useState(false);
  const [showQT2, setShowQT2]                 = useState(false);
  const [showCustConfirm, setShowCustConfirm] = useState(false);


  // Tự mở tab chat nếu được trigger từ notification click HOẶC _openTab prop
  useEffect(() => {
    if (order?._openTab) {
      setTab(order._openTab);
      // Clear _openTab sau khi đã dùng để không bị giữ lại
      if (onUpdate) {
        // Không gọi onUpdate để tránh side-effect, chỉ clear qua window flag
      }
      return;
    }
    if (window.__hk_open_chat) {
      const flag = window.__hk_open_chat;
      if (flag === order.id || flag === order._id || flag === order.qr_code) {
        setTab("chat");
        window.__hk_open_chat = null;
      }
    }
  }, [order?.id, order?._id, order?._openTab]);
  const chatInputRef = useRef();
  const [toast, setToast] = useState(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistTarget, setChecklistTarget] = useState(null); // {ord, stage}
  const [editMode, setEditMode] = useState(false); // KTV phải bấm "Sửa" mới đổi trạng thái
  const [showSparePart, setShowSparePart] = useState(false);
  const [mediaViewer, setMediaViewer] = useState(null); // {items, startIndex}
  const [showEditOrder, setShowEditOrder] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const chatRef = useRef();

  // Load count ngay khi mở đơn (để hiện số trên tab)
  useEffect(() => {
    if (!order?.id) return;
    let cancelled = false;
    RepairChat.filter({ order_id: order.id })
      .then(data => { if (!cancelled) setChats(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [order?.id]);

  // Load full chats + set loading khi vào tab chat
  useEffect(() => {
    if (tab !== "chat" || !order?.id) return;
    let cancelled = false;
    setChatLoading(true);
    RepairChat.filter({ order_id: order.id }, { sort: "id" })
      .then(data => { if (!cancelled) { setChats(data); setChatLoading(false); } })
      .catch(() => { if (!cancelled) setChatLoading(false); });
    return () => { cancelled = true; };
  }, [order?.id, tab]);

  // Load phiếu xuất khi mở tab exports (+ polling 8s)
  useEffect(() => {
    if (tab !== "exports" || !order?.id) return;
    let cancelled = false;
    let timer = null;
    const orderCode = order.order_code || order.id;

    async function loadExports() {
      if (cancelled) return;
      try {
        setExportLoading(prev => exportReqs.length === 0 ? true : prev);
        // filter theo order_code vì phiếu lưu order_id = order_code
        const byCode = await StockExportRequest.filter({ order_id: orderCode });
        // fallback: cũng thử filter theo PB id thật nếu khác
        let data = byCode;
        if (byCode.length === 0 && order._id && order._id !== orderCode) {
          const byId = await StockExportRequest.filter({ order_id: order._id });
          data = byId;
        }
        if (!cancelled) {
          setExportReqs(data.sort((a,b) => (b.id||"").localeCompare(a.id||"")));
          setExportLoading(false);
        }
      } catch { if (!cancelled) setExportLoading(false); }
      if (!cancelled) timer = setTimeout(loadExports, 8000);
    }

    loadExports();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [order?.id, order?._id, order?.order_code, tab]);


  // Polling chat 3s - đơn giản, ổn định, gần realtime
  useEffect(() => {
    if (tab !== "chat" || !order?.id) return;
    let cancelled = false;
    let timer = null;

    async function pollChats() {
      if (cancelled) return;
      try {
        const all = await RepairChat.filter({ order_id: order.id }, { sort: "id", limit: 200 });
        if (cancelled) return;
        setChats(prev => {
          const serverIds = new Set(all.map(r => r.id));
          const savedIds = new Set(prev.filter(m => !m.id?.startsWith("tmp_")).map(m => m.id));
          const hasNew = all.some(r => !savedIds.has(r.id));
          const hasDeleted = prev.filter(m => !m.id?.startsWith("tmp_")).some(m => !serverIds.has(m.id));
          if (!hasNew && !hasDeleted) return prev;
          const temps = prev.filter(m => m.id?.startsWith("tmp_"));
          return [...all, ...temps];
        });
      } catch {}
      if (!cancelled) timer = setTimeout(pollChats, 3000);
    }

    // Bắt đầu poll sau 3s (đã load lần đầu rồi)
    timer = setTimeout(pollChats, 3000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [tab, order?.id]);

  // Auto-scroll
  useEffect(() => { setTimeout(() => chatRef.current?.scrollIntoView({ behavior:"smooth" }), 80); }, [chats, tab]);

  // Build mention list from users related to this order
  const getMentionCandidates = useCallback(() => {
    const isSelf = (u) =>
      u.id === currentUser?.id ||
      (u.username && currentUser?.username && u.username === currentUser?.username);

    // 1. Manager/Admin + Receptionist (trừ bản thân)
    const mgr = (users||[]).filter(u => u && u.id && !isSelf(u) && ["manager","admin","owner","supervisor"].includes(u.role));
    const rec = (users||[]).filter(u => u && u.id && !isSelf(u) && u.role === "receptionist");

    // 2. KTV được giao đơn này (nếu không phải bản thân)
    const assignedKTV = order?.assigned_to
      ? (users||[]).filter(u => u && u.id && !isSelf(u) &&
          (u.id === order.assigned_to || u.username === order.assigned_to_name))
      : [];

    // 3. Nhân viên kho (để chat về linh kiện)
    const warehouse = (users||[]).filter(u => u && u.id && !isSelf(u) && u.role === "Nhân viên kho");

    // Gộp và dedup theo id
    const seen = new Set();
    const real = [...mgr, ...rec, ...assignedKTV, ...warehouse].filter(u => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });

    return [{ id:"__all__", name:"all", role:"__all__" }, ...real];
  }, [users, currentUser?.id, currentUser?.username, order?.assigned_to, order?.assigned_to_name]);

  function handleChatInputChange(e) {
    const val = e.target.value;
    setChatInput(val);
    // Detect @ trigger
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    // Regex nhận cả ký tự Unicode (tiếng Việt)
    const atMatch = textBefore.match(/@([^@\s]*)$/);
    if (atMatch) {
      const q = atMatch[1].toLowerCase();
      setMentionQuery(q);
      const candidates = getMentionCandidates();
      const filtered = candidates.filter(u => {
        if (u.id === "__all__") return true;
        const name = (u.name || u.full_name || "").toLowerCase();
        const uname = (u.username || "").toLowerCase();
        return name.includes(q) || uname.includes(q);
      });
      setMentionList(filtered);
      setMentionCursor(0);
      setShowMention(filtered.length > 0);
    } else {
      setShowMention(false);
    }
  }

  function pickMention(u) {
    // Replace @query with @Name in input
    const cursor = chatInputRef.current?.selectionStart || chatInput.length;
    const textBefore = chatInput.slice(0, cursor);
    const textAfter = chatInput.slice(cursor);
    const mentionText = u.id==="__all__" ? "all" : u.name;
    const replaced = textBefore.replace(/@(\w*)$/, `@${mentionText} `);
    const newText = replaced + textAfter;
    const newCursor = replaced.length;
    setChatInput(newText);
    setShowMention(false);
    // @all không thêm vào pending (xử lý khi gửi), user thật thì thêm
    if (u.id !== "__all__") {
      setPendingMentions(prev => prev.find(p => p.id===u.id) ? prev : [...prev, { id:u.id, name:u.name }]);
    }
    // Set cursor đúng vị trí sau tên user
    setTimeout(() => {
      const el = chatInputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(newCursor, newCursor);
      }
    }, 30);
  }

  async function sendChat(type="text", mediaUrl=null, mediaText=null) {
    const msgText = type==="text" ? chatInput.trim() : (mediaText||"");
    if (type==="text" && !msgText) return;
    const mentioned_ids = pendingMentions.map(m => m.id);
    const mentioned_names = pendingMentions.map(m => m.name);
    const newMsg = {
      order_id: order.id,
      order_code: order.id,
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      message: msgText,
      message_type: type,
      media_url: mediaUrl || "",
      mentioned_ids: JSON.stringify(mentioned_ids),
      mentioned_names: JSON.stringify(mentioned_names),
    };
    // Optimistic UI
    const tempId = "tmp_" + Math.random().toString(36);
    setChats(p => [...p, { ...newMsg, id: tempId, created_date: new Date().toISOString() }]);
    if (type==="text") { setChatInput(""); setPendingMentions([]); }
    try {
      const saved = await RepairChat.create(newMsg);
      setChats(p => p.map(m => m.id===tempId ? saved : m));
      // ── Notification + Sound logic ─────────────────────────────
      const msgPreview = (msgText||"").slice(0,80);
      // Resolve @all: gửi cho tất cả user liên quan đơn, trừ người gửi
      const isAllMention = (chatInput||"").includes("@all") || chatInput?.includes("@tất cả");
      let notifyIds = [...mentioned_ids];
      let notifyNames = [...mentioned_names];
      if (isAllMention) {
        // Thêm manager + receptionist + assigned_to + kho
        const allRelated = users.filter(u =>
          u.id !== currentUser.id &&
          (["manager","admin","receptionist","Nhân viên kho"].includes(u.role) || u.id === order.assigned_to)
        );
        allRelated.forEach(u => {
          if (!notifyIds.includes(u.id)) { notifyIds.push(u.id); notifyNames.push(u.name); }
        });
      }
      // Nếu không có mention cụ thể → notify tất cả người liên quan đơn (trừ người gửi)
      if (!isAllMention && notifyIds.length === 0) {
        const autoNotify = users.filter(u =>
          u.id !== currentUser.id &&
          (["manager","admin","owner","supervisor","receptionist"].includes(u.role) || u.id === order.assigned_to)
        );
        autoNotify.forEach(u => {
          if (!notifyIds.includes(u.id)) { notifyIds.push(u.id); notifyNames.push(u.name || u.full_name || ""); }
        });
      }
      if (notifyIds.length > 0) {
        const notifType = mentioned_ids.length > 0 ? "mention" : "chat";
        const notifTitle = mentioned_ids.length > 0
          ? `💬 ${order.order_code || order.id} — Được nhắc`
          : `💬 ${order.order_code || order.id} — Tin nhắn mới`;
        notifyIds.forEach((uid, i) => {
          Notification.create({
            user_id: uid,
            user_name: notifyNames[i] || "",
            title: notifTitle,
            message: `${currentUser.name || currentUser.full_name}: ${msgPreview}`,
            order_id: order._id || order.id,
            order_code: order.order_code || order.id,
            type: notifType,
            is_read: false,
            created_at: new Date().toISOString(),
          }).catch(() => {});
        });
        // Không phát sound ở đây - sound sẽ phát ở người NHẬN qua notification poll
      }
    } catch(err) {
      setChats(p => p.filter(m => m.id!==tempId));
      // sendChat error suppressed
      alert("Gửi thất bại: " + (err?.message || String(err)));
    }
  }

  // Nén ảnh trước khi upload: resize max 1280px, quality 0.82 JPEG
  async function compressImage(file, maxPx = 1280, quality = 0.82) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width <= maxPx && height <= maxPx) {
          // Không cần resize nhưng vẫn nén JPEG
          if (file.type === "image/jpeg" || file.type === "image/jpg") {
            resolve(file); // đã là JPEG, giữ nguyên
            return;
          }
        }
        const scale = Math.min(1, maxPx / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg"});
            resolve(compressed);
          },"image/jpeg",
          quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function handleMediaUpload(file, type) {
    if (!file) return;
    setChatUploading(true);
    try {
      // Nén ảnh trước khi upload
      const fileToUpload = (file.type?.startsWith("image")) ? await compressImage(file) : file;
      const url = await uploadFile(fileToUpload, order.id);
      const ext = file.name?.split(".").pop()?.toLowerCase() || "";
      const fileMime = file.type || "";
      let msgType = type;
      if (!msgType) {
        if (fileMime.startsWith("image")) msgType = "image";
        else if (fileMime.startsWith("video")) msgType = "video";
        else if (fileMime.startsWith("audio")) msgType = "audio";
        else msgType = "image";
      }
      // Nếu file thực là video/webm nhưng ghi âm → vẫn dùng msgType "audio"
      const msgText = msgType==="image" ? "Ảnh" : msgType==="audio" ? "Ghi âm" : "Video";
      await sendChat(msgType, url, msgText);
    } catch(e) {
      // upload error suppressed
      alert("Upload thất bại: " + (e.message || "Lỗi kết nối PocketBase. Kiểm tra server!"));
    } finally {
      setChatUploading(false);
    }
  }

  // Voice recording
  const [recording, setRecording] = useState(false);
  const mediaRecRef = useRef(null);
  const audioChunksRef = useRef([]);

  async function toggleRecording() {
    if (recording) {
      mediaRecRef.current?.stop();
      setRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Ưu tiên codec Opus (nén tốt, dung lượng nhỏ) + container webm (PB chấp nhận)
        const mimeTypes = [
          "audio/webm;codecs=opus",   // tốt nhất: Opus, ~6-10KB/s
          "audio/ogg;codecs=opus",    // fallback Opus OGG
          "video/webm;codecs=vp8,opus", // fallback: PB nhận video/webm
          "video/webm;codecs=opus",
          "video/webm",
          "audio/webm",
          "audio/mp4",
        ];
        const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || "";
        const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
        audioChunksRef.current = [];
        mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        mr.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          const actualMime = mr.mimeType || "audio/webm";
          const ext = actualMime.includes("mp4") ? "mp4" : actualMime.includes("ogg") ? "ogg" : "webm";
          const blob = new Blob(audioChunksRef.current, { type: actualMime });
          const file = new File([blob], "voice_" + Date.now() + "." + ext, { type: actualMime });
          await handleMediaUpload(file, "audio");
        };
        mr.start(500); // chunk mỗi 500ms để không mất data
        mediaRecRef.current = mr;
        setRecording(true);
      } catch(e) {
        // recording error suppressed
        alert("Không thể ghi âm: " + (e.message || "Kiểm tra quyền microphone!"));
      }
    }
  }

  const [printing, setPrinting] = useState(false);
  if (!order || !currentUser) return null;
  const cust = order.customer_name ? { full_name: order.customer_name, phone: order.customer_phone } : null;
  const assignee = (users||[]).find(u => u.id === order.assigned_to);
  const col = STATUS_COLS.find(s => s.key === order.status);
  const isKTV = currentUser.role === "technician";
  const isMyOrder = order.assigned_to === currentUser.id;
  const isReception = currentUser.role === "receptionist";

  function showToast(msg, type="success") { setToast({msg,type}); setTimeout(() => setToast(null), 3000); }

  function handleOpenChecklist(ord, stage) {
    setChecklistTarget({ ord, stage });
    setShowChecklist(true);
  }
  async function handleChecklistConfirm({ estMins, customDate, note: techNote, extraImages, extraVideos }) {
    const ord = checklistTarget.ord;
    const stage = checklistTarget.stage;
    const k = `stage${stage}_at`;

    // Tính thời điểm hoàn thành
    let estDate;
    if (customDate) {
      estDate = new Date(customDate).toISOString();
    } else {
      estDate = new Date(Date.now() + (estMins||0) * 60000).toISOString();
    }

    const newStatus = "Dang Sua"; // lần 2: khách đồng ý → bắt đầu sửa
    const now = new Date().toISOString();
    // assigned_at = thời điểm phân công (đã có) hoặc set ngay nếu chưa có
    const assignedAt = ord.assigned_at || now;

    // Upload media bổ sung lên PocketBase nếu có
    let newImages = [...(ord.images || [])];
    let newVideos = [...(ord.videos || [])];
    if ((extraImages?.length > 0 || extraVideos?.length > 0) && ord._id) {
      try {
        const formData = new FormData();
        (extraImages||[]).forEach(f => formData.append("images", f));
        (extraVideos||[]).forEach(f => formData.append("videos", f));
        const { token: pbToken } = getAuth();
        const res = await fetch(`${getPbUrl()}/api/collections/repair_orders/records/${ord._id}`, {
          method: "PATCH",
          headers: { Authorization: pbToken },
          body: formData,
        });
        if (res.ok) {
          const updated = await res.json();
          newImages = updated.images || newImages;
          newVideos = updated.videos || newVideos;
        }
      } catch(e) {
        console.warn("Upload media thất bại:", e);
      }
    }

    // stage1_at = thời điểm KTV confirm nhận → bắt đầu đếm 60'
    // accept_stage = 1 → timer stage 1 bắt đầu
    onUpdate(ord.id, {
      accept_stage: 2,
      stage2_at: now,
      assigned_at: assignedAt,
      status: "Dang Sua",
      estimated_done: estDate,
      estimated_done_date: estDate,
      technician_note: techNote || ord.technician_note || "",
      images: newImages,
      videos: newVideos,
    }, null);
    logHistory({ order_id:ord.id, order_code:ord.order_code||ord.id, action_type:"accepted_repair", action_label:"KTV nhận sửa — Bắt đầu sửa chữa", changed_by_id:currentUser?.id||"", changed_by_name:currentUser?.name||"", changed_by_role:currentUser?.role||"", new_value:"Đang Sửa" });
    setShowChecklist(false);
    showToast("✅ Đã nhận sửa! Bắt đầu sửa chữa.");
  }
  function handleMarkDone() {
    onUpdate(order.id, { status:"Hoàn Thành", accept_stage:3 }, { userId:order.assigned_to, delta:2, note:"Sửa xong +2 KPI" });
      logHistory({ order_id:order._id||order.id, order_code:order.order_code||order.id, action_type:"delivered", action_label:"Xác nhận hoàn thành", changed_by_id:currentUser?.id||"", changed_by_name:currentUser?.name||"", changed_by_role:currentUser?.role||"", old_value:order.status||"", new_value:"Hoàn Thành" });
    logAction(currentUser, "complete_order", "repair_order", order._id||order.id, order.order_code||order.id);
    showToast("Hoàn thành! +2 KPI");
    setEditMode(false);
    updateCustomerStats({ ...order, status:"Hoàn Thành" });
  }

  async function getShopInfo() {
    try {
      const keys = ["shop_name","shop_phone","shop_address","warranty_note","bank_account","bank_name"];
      const vals = await Promise.all(keys.map(k => pbSettings.get(k).catch(()=>"")));
      return Object.fromEntries(keys.map((k,i) => [k, vals[i]||""]));
    } catch { return {}; }
  }

  async function updateCustomerStats(ord) {
    if (!ord.customer_phone) return;
    try {
      const custs = await Customer.filter({ phone: ord.customer_phone });
      if (!custs || custs.length === 0) return;
      const cust = custs[0];
      await Customer.update(cust.id, {
        total_spent:  (cust.total_spent||0) + (ord.final_cost||ord.estimated_cost||0),
        total_orders: (cust.total_orders||0) + 1,
      });
      logAction(currentUser, "update", "customer", cust.id, `Cập nhật stats: ${cust.full_name||cust.phone} — +${ord.final_cost||ord.estimated_cost||0}đ`);
    } catch(e) { console.warn("updateCustomerStats:", e.message); }
  }

    async function handlePrintReceipt() {
    setPrinting(true);
    try {
      const shopInfo = await getShopInfo();
      await printReceiptA5(order, shopInfo);
    } catch (e) {
      const shopInfo = await getShopInfo();
      previewBill(order, [], shopInfo);
      alert("Print Agent không kết nối — mở preview để in thủ công.\n\n" + e.message);
    } finally { setPrinting(false); }
  }

  async function handlePrintReceiptForm() {
    setPrinting(true);
    try {
      const [shopInfo, parts] = await Promise.all([
        getShopInfo(),
        SparePartUsage.filter({ order_id: order.id }).catch(()=>[]),
      ]);
      await previewReceiptForm(order, parts, shopInfo);
    } catch (e) {
      alert("Lỗi in phiếu tiếp nhận: " + e.message);
    } finally { setPrinting(false); }
  }

  async function handlePrintBill() {
    setPrinting(true);
    try {
      const [shopInfo, parts] = await Promise.all([
        getShopInfo(),
        SparePartUsage.filter({ order_id: order.id }).catch(()=>[]),
      ]);
      await printBillA5(order, parts, shopInfo);
    } catch (e) {
      const shopInfo = await getShopInfo();
      previewBill(order, [], shopInfo);
      alert("Print Agent không kết nối — mở preview để in thủ công.\n\n" + e.message);
    } finally { setPrinting(false); }
  }

  const qrContent = order.id;

  return (
    <>
    <div style={{ position:"fixed", inset:0, zIndex:1000, display:"flex" }}>
      <div style={{ flex:1, background:"rgba(0,0,0,.45)" }} onClick={onClose} />
      <div style={{ width:Math.min(520,window.innerWidth), height:"100%", background:"#fff", display:"flex", flexDirection:"column", boxShadow:"-8px 0 40px rgba(0,0,0,.2)", overflowX:"hidden", position:"relative" }}>
        {toast && (
          <div style={{ position:"absolute", top:70, left:"50%", transform:"translateX(-50%)", background:toast.type==="success"?"#059669":"#dc2626", color:"#fff", padding:"12px 24px", borderRadius:14, fontWeight:700, zIndex:99, whiteSpace:"nowrap", boxShadow:"0 4px 20px rgba(0,0,0,.2)" }}>
            {toast.msg}
          </div>
        )}
        {/* Header */}
        <div style={{ padding:"14px 16px", background:"#3730a3", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ color:"#fff", fontWeight:800, fontSize:16 }}>  {order.id}</div>
            <span style={{ fontSize:11, background:col?.bg, color:col?.color, padding:"2px 10px", borderRadius:20, fontWeight:700 }}>{col?.icon} {order.status}</span>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {(["manager","admin","owner","supervisor"].includes(currentUser.role) || currentUser.role === "receptionist") && (
              <>
                <button onClick={() => setShowEditOrder(true)}
                  style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", height:34, padding:"0 12px", borderRadius:20, fontSize:13, fontWeight:700, cursor:"pointer"}}>  Sửa</button>
                <button onClick={() => setShowShareModal(true)}
                  style={{ background:"rgba(134,239,172,.3)", border:"none", color:"#fff", height:34, padding:"0 12px", borderRadius:20, fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>share</span> Share</button>
                {(["manager","admin","owner","supervisor"].includes(currentUser.role)) && (
                <button onClick={async () => {
                  if (!window.confirm("Xóa đơn " + order.id + "?\nThao tác này không thể hoàn tác!")) return;
                  const delId = order._id || order.id;
                  const orderCode = order.id || order.order_code;
                  try {
                    // 1. Xóa đơn khỏi PocketBase
                    // 1a. Hủy debt_voucher liên quan (nếu đơn sửa có ghi nợ khách) — tránh nợ ma
                    try {
                      const dvs = await DebtVoucher.filter({ origin_id: delId }).catch(()=>[]);
                      for (const v of (dvs||[])) {
                        if (v.status === "cancelled") continue;
                        await DebtVoucher.update(v.id, {
                          status: "cancelled", remaining: 0,
                          note: (v.note||"") + " | Hủy do xóa đơn " + orderCode,
                        });
                        logAction(currentUser, "cancel_debt", "debt_voucher", v.id, `Hủy nợ ${v.party_name} (${v.voucher_code}) do xóa đơn ${orderCode}`);
                      }
                    } catch(e) { console.error("Cancel debt_voucher on delete repair:", e); }
                    await RepairOrder.delete(delId);

                    // 1b. Ghi log lịch sử & thao tác trước khi xóa
                    logHistory({ order_id:"", order_code:orderCode, action_type:"deleted", action_label:"Xóa đơn sửa chữa", changed_by_id:currentUser?.id||"", changed_by_name:currentUser?.name||"", changed_by_role:currentUser?.role||"", old_value:order.status||"", new_value:"Đã xóa", note:`${order.customer_name||""} — ${order.device_model||""}` });
                    logAction(currentUser, "delete_order", "repair_order", delId, `Xóa đơn ${orderCode}: ${order.customer_name||""} — ${order.device_model||""}`);

                    // 2. Thông báo cho tất cả user liên quan
                    const relatedUsers = (users||[]).filter(u => {
                      if (!u?.id || u.id === currentUser.id) return false;
                      // KTV được giao, manager, admin, receptionist
                      return u.id === order.assigned_to ||
                             ["manager","admin","owner","supervisor","receptionist"].includes(u.role);
                    });
                    await Promise.allSettled(relatedUsers.map(u =>
                      Notification.create({
                        user_id:    u.id,
                        user_name:  u.name || u.full_name || "",
                        title:      `🗑️ Đơn đã bị xóa: ${orderCode}`,
                        message:    `${order.customer_name || ""} - ${order.device_model || order.device_name || ""} đã được xóa bởi ${currentUser.name || "Quản lý"}.`,
                        order_id:   "",
                        order_code: orderCode,
                        type:       "deleted",
                        is_read:    false,
                      }).catch(()=>{})
                    ));

                    // 3. Cập nhật UI
                    onClose();
                    onUpdate && onUpdate(order.id || order.order_code, null, null, "delete");
                  } catch(e) {
                    alert("Lỗi xóa: " + e.message);
                  }
                }} style={{ background:"rgba(220,38,38,.7)", border:"none", color:"#fff", height:34, padding:"0 12px", borderRadius:20, fontSize:13, fontWeight:700, cursor:"pointer"}}>  Xóa</button>
                )}
              </>
            )}
            <button onClick={handlePrintReceipt} disabled={printing}
              style={{ background:"#f0fdf4", border:"1px solid #86efac", color:"#15803d",
                       borderRadius:8, padding:"6px 12px", fontSize:13, cursor:"pointer",
                       display:"flex", alignItems:"center", gap:4 }}>
              <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>print</span>
              {printing ? "Đang in..." : "In Phiếu"}
            </button>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:34, height:34, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>close</span></button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid #e5e7eb" }}>
          {[["info","description","Thông tin"],...(!isReception && (["manager","admin","owner","supervisor"].includes(currentUser.role)||isMyOrder)?[["parts","build","Linh kiện"]]:[]),["exports","outbox","Phiếu xuất"],["chat","forum","Chat"]].map(([t,icon,lbl]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex:1, padding:"8px 4px", border:"none", background:"none", fontWeight:700, fontSize:12, cursor:"pointer", borderBottom:tab===t?"3px solid #4f46e5":"3px solid transparent", color:tab===t?"#4f46e5":"#6b7280", position:"relative", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
              <span className="material-icons" style={{fontSize:18,lineHeight:1,fontFamily:"Material Icons",color:tab===t?"#4f46e5":"#9ca3af"}}>{icon}</span>
              <span style={{whiteSpace:"nowrap"}}>{lbl}</span>
              {t==="chat" && chats.length > 0 && (
                <span style={{ position:"absolute", top:4, right:"calc(50% - 22px)", background:"#4f46e5", color:"#fff", borderRadius:10, fontSize:10, fontWeight:800, padding:"1px 5px", minWidth:16, lineHeight:"14px" }}>
                  {chats.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <div style={{ flex:1, overflowY:"auto", padding:18 }}>
            {/* ── Nút Nhận Kiểm (lần 1) khi status = Chờ KTV ─── */}
            {order.status === "Chờ KTV" && isMyOrder && (
              <div style={{ background:"linear-gradient(135deg,#0369a1,#0284c7)", borderRadius:16, padding:20, marginBottom:14, textAlign:"center" }}>
                <div style={{ color:"#fff", fontWeight:800, fontSize:17, marginBottom:6 }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22,verticalAlign:"middle",marginRight:6}}>manage_search</span>
                  Đơn chờ bạn nhận kiểm!
                </div>
                <div style={{ color:"rgba(255,255,255,.8)", fontSize:13, marginBottom:14 }}>
                  {order.device_model} — {order.customer_name}
                </div>
                <button onClick={() => setShowQT2(true)}
                  style={{ width:"100%", height:58, borderRadius:16, border:"2px solid rgba(255,255,255,.5)", background:"rgba(255,255,255,.15)", color:"#fff", fontWeight:900, fontSize:18, cursor:"pointer", backdropFilter:"blur(4px)" }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22,verticalAlign:"middle",marginRight:8}}>fact_check</span>
                  Nhận Kiểm Tra
                </button>
              </div>
            )}
            {/* ── Nút Nhận Sửa (lần 2) khi status = Chờ KTV Sửa ─── */}
            {order.status === "Chờ KTV Sửa" && isMyOrder && (
              <div style={{ background:"linear-gradient(135deg,#6d28d9,#7c3aed)", borderRadius:16, padding:20, marginBottom:14, textAlign:"center" }}>
                <div style={{ color:"#fff", fontWeight:800, fontSize:17, marginBottom:6 }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22,verticalAlign:"middle",marginRight:6}}>build</span>
                  Khách đã đồng ý — Bắt đầu sửa!
                </div>
                <div style={{ color:"rgba(255,255,255,.8)", fontSize:13, marginBottom:14 }}>
                  {order.device_model} — {order.customer_name}
                </div>
                <button onClick={() => handleOpenChecklist(order, 2)}
                  style={{ width:"100%", height:58, borderRadius:16, border:"2px solid rgba(255,255,255,.5)", background:"rgba(255,255,255,.15)", color:"#fff", fontWeight:900, fontSize:18, cursor:"pointer", backdropFilter:"blur(4px)" }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22,verticalAlign:"middle",marginRight:8}}>construction</span>
                  Nhận Sửa
                </button>
              </div>
            )}
            {/* Manager thấy trạng thái Chờ KTV */}
            {["Chờ KTV","Chờ KTV Sửa"].includes(order.status) && !isMyOrder && ["manager","admin","owner","supervisor"].includes(currentUser.role) && (
              <div style={{ background:"#fef3c7", border:"2px solid #fcd34d", borderRadius:14, padding:14, marginBottom:14 }}>
                <div style={{ fontWeight:800, fontSize:14, color:"#92400e" }}>⏳ {order.status === "Chờ KTV Sửa" ? "Đơn chờ KTV bắt đầu sửa" : "Đơn chờ KTV nhận kiểm"}</div>
                <div style={{ fontSize:13, color:"#78350f", marginTop:4 }}>KTV: {order.assigned_to_name || "Chưa phân công"}</div>
              </div>
            )}
            <AcceptTimer order={order} currentUser={currentUser} onUpdate={onUpdate} />
            {/* Banner KTV xem đơn người khác */}
            {isKTV && !isMyOrder && (
              <div style={{ background:"#f1f5f9", border:"1.5px solid #cbd5e1", borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
                <span className="material-icons" style={{fontSize:20,color:"#64748b",fontFamily:"Material Icons"}}>info</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:"#475569" }}>Đơn của {order.assigned_to_name||"KTV khác"}</div>
                  <div style={{ fontSize:11, color:"#94a3b8", marginTop:1 }}>Bạn chỉ có thể xem và nhắn tin</div>
                </div>
              </div>
            )}
            {/* Customer */}
            <div style={{ background:"#eef2ff", borderRadius:14, padding:14, marginBottom:14 }}>
              <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>  {cust?.full_name}</div>
              <a href={`tel:${cust?.phone}`} style={{ color:"#4f46e5", fontWeight:700, fontSize:15 }}>  {cust?.phone}</a>
            </div>
            {/* Grid info */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[
                { label:"Thiết bị", val:order.device_model },
                { label:"‍  KTV",    val:assignee?.name||"—" },
                { label:"IMEI",        val:order.imei_serial||"—", mono:true },
                { label:"Mã PIN",   val:order.passcode||"—", hi:!!order.passcode },
                ...(order.qr_code ? [{ label:"Mã QR", val:order.qr_code, mono:true }] : []),
              ].map(f => (
                <div key={f.label} style={{ background:f.hi?"#fffbeb":"#f9fafb", borderRadius:12, padding:12 }}>
                  <div style={{ fontSize:11, color:"#9ca3af", marginBottom:4 }}>{f.label}</div>
                  <div style={{ fontWeight:700, fontSize:13, fontFamily:f.mono?"monospace":"inherit", color:f.hi?"#b45309":"#111", wordBreak:"break-all" }}>{f.val}</div>
                </div>
              ))}
            </div>
            {/* Issues */}
            {(order.issues||[]).length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, color:"#9ca3af", marginBottom:6 }}>  Lỗi báo cáo:</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {(order.issues||[]).map(i => <span key={i} style={{ background:"#fee2e2", color:"#991b1b", fontSize:12, padding:"4px 10px", borderRadius:20, fontWeight:600 }}>{i}</span>)}
                </div>
              </div>
            )}
            {order.notes && <div style={{ background:"#fffbeb", borderRadius:12, padding:12, marginBottom:14, fontSize:14, color:"#92400e"}}>  {order.notes}</div>}
            {/* Images — bấm mở to */}
            {order.images?.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, color:"#9ca3af", marginBottom:6 }}>  Hình ảnh & video ({order.images.length}):</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {order.images.map((url,i) => (
                    <div key={i} onClick={() => setMediaViewer({ items:order.images, startIndex:i })}
                      style={{ width:84, height:84, borderRadius:12, overflow:"hidden", cursor:"pointer", border:"2px solid #e0e7ff", position:"relative", flexShrink:0, background:"#1f2937" }}>
                      {url.startsWith("video:")
                        ? <div style={{ width:"100%", height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4 }}>
                            <span style={{ fontSize:28 }}> </span>
                            <span style={{ fontSize:10, color:"#9ca3af" }}>Video</span>
                          </div>
                        : <img src={url} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" />
                      }
                      {/* Play overlay */}
                      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0)", display:"flex", alignItems:"center", justifyContent:"center", transition:"background .15s" }}
                        onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,.3)"}
                        onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,0)"}>
                        <span style={{ fontSize:20, color:"#fff", textShadow:"0 1px 4px rgba(0,0,0,.8)", opacity:.85 }}>{url.startsWith("video:")?"▶":"search"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* ── Giao KTV / Giao Việc Lại ─────────────────────────────
                Hiện khi:
                1. Chưa có KTV (assigned_to rỗng)
                2. needs_reassign = true (KTV quá hạn bị ngừng)
                3. Đơn đã nhận nhưng hết 120 phút chưa sửa (kpi_stage2_penalized)
            ─── */}
            {["manager","admin","owner"].includes(currentUser.role) && !["Hoàn Thành","Đã Giao","Hủy"].includes(order.status) && (
              (() => {
                const noKTV      = !order.assigned_to;
                const overdue    = order.needs_reassign || order.kpi_stage2_penalized || order.kpi_stage1_penalized;
                if (!noKTV && !overdue) return null;

                // Mode: "assign" = giao mới, "reassign" = giao lại
                const mode = noKTV ? "assign" : "reassign";
                const borderColor = noKTV ? "#f59e0b" : "#ef4444";
                const bgColor     = noKTV ? "#fffbeb" : "#fef2f2";
                const iconColor   = noKTV ? "#d97706" : "#dc2626";
                const icon        = noKTV ? "person_add" : "assignment_late";
                const title       = noKTV ? "Chưa phân công KTV" : "⚠️ Cần Giao Việc Lại!";
                const subtitle    = noKTV
                  ? "Đơn này chưa có KTV xử lý — chọn KTV để giao việc"
                  : order.needs_reassign
                    ? `KTV ${order.assigned_to_name||"?"} quá hạn → -3 KPI & ngừng nhận việc`
                  : order.kpi_stage2_penalized
                    ? `KTV ${order.assigned_to_name||"?"} quá 120 phút chưa bắt đầu sửa`
                  : `KTV ${order.assigned_to_name||"?"} quá 60 phút chưa nhận đơn — cân nhắc giao lại`;

                // Nếu reassign: loại KTV hiện tại ra; nếu assign mới: hiện tất cả
                const availableKTVs = users.filter(u =>
                  u.role === "technician" &&
                  u.is_active !== false &&
                  (noKTV ? true : u.id !== order.assigned_to)
                );

                return (
                  <div style={{ background:bgColor, border:`2.5px solid ${borderColor}`, borderRadius:16, padding:"16px", marginBottom:14 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                      <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:24,color:iconColor}}>{icon}</span>
                      <div>
                        <div style={{ fontWeight:900, fontSize:15, color:iconColor }}>{title}</div>
                        <div style={{ fontSize:12, color:"#9ca3af" }}>{subtitle}</div>
                      </div>
                    </div>

                    <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:8 }}>
                      <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:14,verticalAlign:"middle",marginRight:4}}>engineering</span>
                      {mode === "assign" ? "Chọn KTV để giao đơn:" : "Chọn KTV mới để giao:"}
                    </div>

                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {availableKTVs.length === 0 && (
                        <div style={{ fontSize:13, color:"#9ca3af", fontStyle:"italic", padding:"10px 0" }}>Không có KTV khả dụng</div>
                      )}
                      {availableKTVs.map(u => (
                        <button key={u.id}
                          onClick={async () => {
                            const now = new Date().toISOString();
                            onUpdate(order.id, {
                              assigned_to:           u.id,
                              assigned_to_name:      u.name || u.full_name,
                              assigned_at:           now,
                              accept_stage:          0,
                              stage1_at:             null,
                              stage2_at:             null,
                              kpi_manually_accepted: false,
                              kpi_stage1_penalized:  false,
                              kpi_stage2_penalized:  false,
                              needs_reassign:        false,
                              status:                "Cho KTV",
                            }, null);
                            showToast(`✅ Đã giao đơn cho ${u.name || u.full_name}`);
                          }}
                          style={{
                            display:"flex", alignItems:"center", justifyContent:"space-between",
                            padding:"12px 14px", borderRadius:12,
                            border:`2px solid ${mode==="assign"?"#f59e0b":"#4f46e5"}`,
                            background: mode==="assign" ? "#fef3c7" : "#eef2ff",
                            fontWeight:700, fontSize:14, cursor:"pointer", textAlign:"left"
                          }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,color:mode==="assign"?"#d97706":"#4f46e5"}}>engineering</span>
                            <span style={{ color: mode==="assign"?"#92400e":"#1e1b4b" }}>{u.name || u.full_name}</span>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ fontSize:12, color:"#6b7280" }}>KPI: {u.kpi??0}</span>
                            <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,color:mode==="assign"?"#d97706":"#4f46e5"}}>arrow_forward</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()
            )}

            {/* Status + Actions — KTV cần bấm "Chỉnh" để edit */}
            {/* Ẩn với KTV khi đang ở trạng thái chờ action từ TT/KH */}
            {["Cho KTV","Cho Bao Gia","Cho Xac Nhan","Cho KTV Sua"].includes(order.status) && isKTV && (
              <div style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:12, padding:"12px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
                <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,color:"#16a34a",verticalAlign:"middle"}}>hourglass_empty</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:"#166534" }}>
                    {order.status === "Cho Bao Gia" ? "Đang chờ Giao dịch viên báo giá khách" :
                      order.status === "Cho Xac Nhan" ? "Đang chờ khách xác nhận" :
                      order.status === "Cho KTV Sua" ? "Khách đồng ý — Bấm Nhận Sửa bên trên" :
                      "Đang chờ bạn nhận kiểm — Bấm nút bên trên"}
                  </div>
                  <div style={{ fontSize:11, color:"#4ade80", marginTop:2 }}>Bước tiếp theo sẽ tự cập nhật</div>
                </div>
              </div>
            )}
            {!["Hoàn Thành","Đã Giao","Hủy",..."Cho KTV","Cho Bao Gia","Cho Xac Nhan","Cho KTV Sua"].some(s => s===order.status) || ["manager","admin","owner","supervisor"].includes(currentUser.role) ? (
            <span style={{display:"none"}} />) : null}
            {!["Hoàn Thành","Đã Giao","Hủy"].includes(order.status) && !(["Cho KTV","Cho Bao Gia","Cho Xac Nhan","Cho KTV Sua"].includes(order.status) && isKTV) && (["manager","admin","owner","supervisor"].includes(currentUser.role) || isMyOrder) && (
              <div style={{ marginBottom:14 }}>
                {/* KTV chưa nhận đơn → disable toàn bộ status picker */}
                {isKTV && isMyOrder && (order.accept_stage||0) < 1 && !["Chờ KTV","Chờ KTV Sửa"].includes(order.status) && (
                  <div style={{ padding:"14px 16px", background:"#fef3c7", border:"2px solid #fcd34d", borderRadius:14, textAlign:"center", marginBottom:8 }}>
                    <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,verticalAlign:"middle",marginRight:6,color:"#92400e"}}>lock</span>
                    <span style={{ fontWeight:700, color:"#92400e", fontSize:14 }}>Nhận đơn trước khi đổi trạng thái</span>
                  </div>
                )}
                {/* Toggle edit mode for KTV (chỉ khi đã nhận) */}
                {isKTV && !editMode && (order.accept_stage||0) >= 1 && (
                  <button onClick={() => setEditMode(true)}
                    style={{ width:"100%", height:52, borderRadius:14, border:"2px solid #4f46e5", background:"#eef2ff", color:"#4f46e5", fontWeight:800, fontSize:16, cursor:"pointer", marginBottom:8 }}>
                      Cập nhật trạng thái
                  </button>
                )}
                {(!isKTV || (editMode && (order.accept_stage||0) >= 1)) && (
                  <>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"#374151"}}>  Chọn trạng thái:</div>
                      {isKTV && <button onClick={() => setEditMode(false)} style={{ background:"none", border:"none", color:"#9ca3af", fontSize:13, cursor:"pointer"}}>  Đóng</button>}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                      {STATUS_COLS.filter(c => !["Đã Giao","Chờ KTV","Chờ KTV Sửa"].includes(c.key)).map(c => (
                        <button key={c.key} onClick={() => {
  if(c.key==="Hoàn Thành") { handleMarkDone(); }
  else {
    onUpdate(order.id,{status:c.key},null);
    // Log lịch sử đổi trạng thái
    logHistory({
      order_id:        order._id || order.id,
      order_code:      order.order_code || order.id,
      action_type:     "status_changed",
      action_label:    "Đổi trạng thái",
      changed_by_id:   currentUser?.id || "",
      changed_by_name: currentUser?.name || "",
      changed_by_role: currentUser?.role || "",
      old_value:       order.status || "",
      new_value:       c.key,
    });
    setEditMode(false);
    // Notify manager/admin + receptionist khi KTV đổi trạng thái
    const notifyUsers = users.filter(u => ["manager","admin","owner","supervisor","receptionist"].includes(u.role));
    notifyUsers.forEach(u => {
      Notification.create({
        user_id: u.id,
        user_name: u.name || "",
        title: `🔧 ${currentUser.name} cập nhật ${order.id}`,
        message: `Trạng thái: ${c.key}`,
        order_id: order._id || order.id,
        order_code: order.id,
        type:"status_change",
        is_read: false,
        created_at: new Date().toISOString(),
      }).catch(()=>{});
    });
    // Sound phát ở người NHẬN notification
  }
}}
                          style={{ padding:"12px 8px", borderRadius:12, border:`2px solid ${order.status===c.key?c.color:"#e5e7eb"}`, background:order.status===c.key?c.bg:"#fff", color:order.status===c.key?c.color:"#374151", fontWeight:700, fontSize:13, cursor:"pointer", textAlign:"center" }}>
                          <div style={{ fontSize:18 }}>{c.icon}</div>
                          <div style={{ fontSize:12, marginTop:2 }}>{c.key}</div>
                        </button>
                      ))}
                    </div>
                    <button onClick={handleMarkDone}
                      style={{ width:"100%", height:54, borderRadius:14, background:"#059669", color:"#fff", border:"none", fontWeight:800, fontSize:17, cursor:"pointer"}}>
                        Sửa Xong! (+2 KPI)
                    </button>
                  </>
                )}
              </div>
            )}
            {/* ── Giá tiền summary ── */}
            {(order.estimated_cost > 0 || order.final_cost > 0 || order.deposit > 0) && (
              <div style={{ background:"linear-gradient(135deg,#fef9c3,#fff7ed)", border:"2px solid #fcd34d", borderRadius:14, padding:"12px 14px", marginBottom:14 }}>
                <div style={{ fontWeight:800, fontSize:13, color:"#92400e", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16,color:"#d97706",verticalAlign:"middle"}}>receipt_long</span>
                  Tài Chính Đơn
                </div>
                <div style={{ display:"flex", gap:0, borderRadius:10, overflow:"hidden", border:"1px solid #fde68a" }}>
                  {[
                    { label:"Báo giá", value:order.estimated_cost, color:"#92400e", bg:"#fef3c7" },
                    { label:"Đặt cọc", value:order.deposit,        color:"#166534", bg:"#dcfce7" },
                    { label:"Còn lại", value:(order.estimated_cost||0)-(order.deposit||0), color:"#1e40af", bg:"#dbeafe" },
                  ].map((item, i) => (
                    <div key={i} style={{ flex:1, textAlign:"center", padding:"10px 6px", background:item.bg, borderRight: i<2?"1px solid rgba(0,0,0,.08)":"none" }}>
                      <div style={{ fontSize:10, fontWeight:700, color:item.color, marginBottom:3, opacity:0.7 }}>{item.label}</div>
                      <div style={{ fontSize:13, fontWeight:900, color:item.color }}>
                        {item.value > 0 ? `${Number(item.value).toLocaleString("vi-VN")}đ` : "—"}
                      </div>
                    </div>
                  ))}
                </div>
                {order.final_cost > 0 && (
                  <div style={{ marginTop:8, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 10px", background:"#f0fdf4", borderRadius:8, border:"1px solid #86efac" }}>
                    <span style={{ fontSize:12, fontWeight:700, color:"#065f46" }}>✅ Thanh toán thực tế:</span>
                    <span style={{ fontSize:14, fontWeight:900, color:"#059669" }}>{Number(order.final_cost).toLocaleString("vi-VN")}đ</span>
                  </div>
                )}
                {(order.final_cost > 0 || order.estimated_cost > 0) && (
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <button onClick={handlePrintReceiptForm} disabled={printing}
                      style={{ flex:1, background:"#0f766e", border:"none", color:"#fff",
                               borderRadius:8, padding:"8px 12px", fontSize:12, cursor:"pointer",
                               display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                      <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:15,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>assignment</span>
                      {printing ? "..." : "Phiếu tiếp nhận"}
                    </button>
                    <button onClick={handlePrintBill} disabled={printing}
                      style={{ flex:1, background:"#1e1b4b", border:"none", color:"#fff",
                               borderRadius:8, padding:"8px 12px", fontSize:12, cursor:"pointer",
                               display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                      <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:15,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>receipt</span>
                      {printing ? "..." : "Hóa đơn SC"}
                    </button>
                  </div>
                )}

                {/* Lịch sử thanh toán */}
                <div style={{ background:"#f0fdf4", borderRadius:10, padding:12, marginTop:8 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:"#15803d", marginBottom:8 }}>💳 Lịch sử thanh toán</div>
                  {order.deposit > 0 && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"4px 0", borderBottom:"1px dashed #bbf7d0" }}>
                      <span style={{ color:"#6b7280" }}>Đặt cọc {order.received_date ? new Date(order.received_date).toLocaleDateString("vi-VN") : ""}</span>
                      <span style={{ fontWeight:700, color:"#166534" }}>+{Number(order.deposit).toLocaleString("vi-VN")}đ</span>
                    </div>
                  )}
                  {order.final_cost > 0 && ["Đã Thanh Toán","Hoàn Thành","Đã Giao"].includes(order.status) && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"4px 0" }}>
                      <span style={{ color:"#6b7280" }}>Thanh toán {order.done_date ? new Date(order.done_date).toLocaleDateString("vi-VN") : ""}</span>
                      <span style={{ fontWeight:700, color:"#166534" }}>+{Number(Math.max(0,(order.final_cost||0)-(order.deposit||0))).toLocaleString("vi-VN")}đ</span>
                    </div>
                  )}
                  {order.payment_method && (
                    <div style={{ fontSize:12, color:"#9ca3af", marginTop:4 }}>Hình thức: {order.payment_method}</div>
                  )}
                </div>
              </div>
            )}

            {/* Thời gian dự kiến */}
            {order.estimated_done && (
              <div style={{ background:"#f0fdf4", borderRadius:12, padding:"10px 14px", marginBottom:14, fontSize:13 }}>
                <span style={{ color:"#059669", fontWeight:700 }}>⏱ Dự kiến xong: </span>
                <span style={{ fontWeight:600 }}>{new Date(order.estimated_done).toLocaleString("vi-VN",{dateStyle:"short",timeStyle:"short"})}</span>
              </div>
            )}

            {/* ── NÚT BÀN GIAO MÁY — chỉ Giao dịch viên và Manager, khi đơn Hoàn Thành ── */}
            {order.status === "Hoàn Thành" && (isReception || ["manager","admin","owner","supervisor"].includes(currentUser.role)) && (
              <div style={{ marginTop:8, marginBottom:4 }}>
                <button onClick={() => setShowHandover(true)}
                  style={{ width:"100%", height:58, borderRadius:16, background:"linear-gradient(135deg,#0369a1,#0891b2)", color:"#fff", border:"none", fontWeight:900, fontSize:17, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow:"0 4px 16px rgba(3,105,161,.35)" }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:24}}>handshake</span>
                  Bàn Giao Máy
                </button>
              </div>
            )}
            {order.status === "Đã Giao" && (
              <div style={{ background:"#f0fdf4", border:"2px solid #86efac", borderRadius:14, padding:"12px 16px", marginTop:8, display:"flex", alignItems:"center", gap:10 }}>
                <span className="material-icons" style={{fontSize:22,color:"#059669",fontFamily:"Material Icons"}}>check_circle</span>
                <div>
                  <div style={{ fontWeight:800, fontSize:14, color:"#065f46" }}>Đã bàn giao máy</div>
                  {order.handover_at && <div style={{ fontSize:12, color:"#059669", marginTop:2 }}>{new Date(order.handover_at).toLocaleString("vi-VN",{dateStyle:"short",timeStyle:"short"})} · {order.handover_by_name||""}</div>}
                </div>
              </div>
            )}

            {/* ── QT1: Giao dịch viên kiểm ngoại quan ── */}
            {order.status === "Cho KTV" && !order.qt1_checklist && (isReception || ["manager","admin","owner","supervisor"].includes(currentUser.role)) && (
              <div style={{ marginTop:8 }}>
                <button onClick={() => setShowPreCheck(true)}
                  style={{ width:"100%", height:56, borderRadius:16, background:"linear-gradient(135deg,#0369a1,#0284c7)", border:"none", color:"#fff", fontWeight:900, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow:"0 4px 16px rgba(3,105,161,.3)" }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22}}>search</span>
                  Bắt đầu Kiểm Ngoại Quan (QT1)
                </button>
              </div>
            )}
            {order.qt1_checklist && (
              <div style={{ marginTop:8, background:"#e0f2fe", border:"1.5px solid #7dd3fc", borderRadius:12, padding:"10px 14px", fontSize:13, color:"#0c4a6e" }}>
                <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16,verticalAlign:"middle",marginRight:6}}>info</span>
                Đã có kết quả QT1 — chờ chuyển KTV
              </div>
            )}

            {/* ── QT2: KTV kiểm tra sâu ── */}
            {order.status === "Chờ KTV" && (order.assigned_to === currentUser.id || ["manager","admin","owner","supervisor"].includes(currentUser.role)) && (
              <div style={{ marginTop:8 }}>
                <button onClick={() => setShowQT2(true)}
                  style={{ width:"100%", height:56, borderRadius:16, background:"linear-gradient(135deg,#6d28d9,#7c3aed)", border:"none", color:"#fff", fontWeight:900, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow:"0 4px 16px rgba(109,40,217,.3)" }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22}}>manage_search</span>
                  Bắt đầu Kiểm Tra KTV (QT2)
                </button>
              </div>
            )}
            {order.qt2_checklist && order.status !== "Cho KTV" && (
              <div style={{ marginTop:8, background:"#f5f3ff", border:"1.5px solid #ddd6fe", borderRadius:12, padding:"10px 14px", fontSize:13, color:"#4c1d95" }}>
                <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16,verticalAlign:"middle",marginRight:6}}>check</span>
                Đã có kết quả QT2 — chờ gửi về Giao dịch viên
              </div>
            )}

            {/* ── Chờ Báo Giá: TT xác nhận KH ── */}
            {order.status === "Chờ Báo Giá" && (isReception || ["manager","admin","owner","supervisor"].includes(currentUser.role)) && (
              <div style={{ marginTop:8 }}>
                <div style={{ background:"#fffbeb", border:"2px solid #fcd34d", borderRadius:14, padding:"12px 14px", marginBottom:10 }}>
                  <div style={{ fontWeight:800, fontSize:14, color:"#92400e", marginBottom:4 }}>
                    <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16,verticalAlign:"middle",marginRight:6}}>request_quote</span>
                    KTV đã kiểm xong — Báo giá cho khách
                  </div>
                  <div style={{ fontSize:12, color:"#78350f" }}>KTV: {order.assigned_to_name} · {order.qt2_note || "Không có ghi chú"}</div>
                </div>
                <button onClick={() => setShowCustConfirm(true)}
                  style={{ width:"100%", height:56, borderRadius:16, background:"linear-gradient(135deg,#db2777,#ec4899)", border:"none", color:"#fff", fontWeight:900, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow:"0 4px 16px rgba(219,39,119,.3)" }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22}}>pending_actions</span>
                  Xác Nhận Khách Hàng
                </button>
              </div>
            )}
            {order.status === "Chờ Báo Giá" && !isReception && currentUser.role === "technician" && (
              <div style={{ marginTop:8, background:"#fdf2f8", border:"1.5px solid #fbcfe8", borderRadius:12, padding:"12px 14px", fontSize:13, color:"#9d174d" }}>
                <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16,verticalAlign:"middle",marginRight:6}}>hourglass_top</span>
                Đang chờ Giao dịch viên báo giá và xác nhận với khách
              </div>
            )}

            {/* ── Chờ Xác Nhận: hiển thị info ── */}
            {order.status === "Chờ Xác Nhận" && (
              <div style={{ marginTop:8, background:"#fdf2f8", border:"1.5px solid #fbcfe8", borderRadius:12, padding:"12px 14px" }}>
                <div style={{ fontWeight:800, fontSize:14, color:"#9d174d", marginBottom:4 }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16,verticalAlign:"middle",marginRight:6}}>pending_actions</span>
                  Chờ khách xác nhận
                </div>
                <div style={{ fontSize:12, color:"#831843" }}>Giao dịch viên đang trao đổi với khách hàng</div>
              </div>
            )}
          </div>
        )}

        {tab === "chat" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0, position:"relative" }}>

            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:10, background:"#f1f5f9" }}>
              {chatLoading && <div style={{ textAlign:"center", color:"#9ca3af", marginTop:32, fontSize:13 }}>⏳ Đang tải...</div>}
              {!chatLoading && chats.length===0 && <div style={{ textAlign:"center", color:"#9ca3af", marginTop:32, fontSize:13 }}>Chưa có tin nhắn nào</div>}
              {(() => {
                let lastDateStr = null;
                const fmtDate = (d) => {
                  if (!d) return "";
                  const dt = new Date(d);
                  const now = new Date();
                  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const yesterday = new Date(today - 86400000);
                  const msgDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
                  if (msgDay >= today) return "Hôm nay";
                  if (msgDay >= yesterday) return "Hôm qua";
                  return dt.toLocaleDateString("vi-VN", { weekday:"long", day:"2-digit", month:"2-digit", year:"numeric" });
                };
                const fmtTime = (d) => {
                  if (!d) return "";
                  const dt = new Date(d);
                  return dt.toLocaleTimeString("vi-VN", { hour:"2-digit", minute:"2-digit", hour12:false });
                };
                return chats.map(msg => {
                  const isMe = msg.sender_id === currentUser.id;
                  const isSystem = msg.message_type === "system";
                  const isManager = ["manager","admin","owner","supervisor"].includes(currentUser.role);
                  const canEditOrder = canRepairEdit || isManager;
                  const canDeleteOrder = canRepairDelete || isManager;
                  const msgTs = msg.created || msg.created_date;
                  const msgDateStr = msgTs ? fmtDate(msgTs) : null;
                  const showDateSep = msgDateStr && msgDateStr !== lastDateStr;
                  if (showDateSep) lastDateStr = msgDateStr;

                  if (isSystem) return (
                    <React.Fragment key={msg.id}>
                      {showDateSep && (
                        <div style={{ textAlign:"center", fontSize:11, color:"#9ca3af", padding:"6px 0 2px" }}>
                          <span style={{ background:"#e2e8f0", padding:"3px 14px", borderRadius:12, fontWeight:600 }}>{msgDateStr}</span>
                        </div>
                      )}
                      <div style={{ textAlign:"center", fontSize:12, color:"#9ca3af", padding:"4px 0" }}>
                        <span style={{ background:"#e5e7eb", padding:"3px 12px", borderRadius:12 }}>{msg.message}</span>
                      </div>
                    </React.Fragment>
                  );

                  const hasMention = msg.mentioned_names?.length > 0;
                  return (
                    <React.Fragment key={msg.id}>
                      {showDateSep && (
                        <div style={{ textAlign:"center", fontSize:11, color:"#9ca3af", padding:"6px 0 2px" }}>
                          <span style={{ background:"#e2e8f0", padding:"3px 14px", borderRadius:12, fontWeight:600 }}>{msgDateStr}</span>
                        </div>
                      )}
                      <div style={{ display:"flex", justifyContent:isMe?"flex-end":"flex-start", gap:8, alignItems:"flex-end" }}>
                        {!isMe && (
                          <div style={{ width:32, height:32, borderRadius:"50%", background:"#818cf8", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13, flexShrink:0 }}>
                            {(msg.sender_name||"?")[0]}
                          </div>
                        )}
                        <div style={{ maxWidth:"78%" }}>
                          {!isMe && <div style={{ fontSize:11, color:"#4f46e5", fontWeight:700, marginBottom:3 }}>{msg.sender_name}</div>}
                          {hasMention && !isMe && (
                            <div style={{ fontSize:11, color:"#f59e0b", fontWeight:600, marginBottom:3 }}>
                                {msg.mentioned_names.map(n=>`@${n}`).join(" ")}
                            </div>
                          )}
                          <div
                            style={{ padding: msg.message_type==="text"?"10px 14px":"6px", borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px", background:isMe?"#4f46e5":"#fff", color:isMe?"#fff":"#111", fontSize:14, border:isMe?"none":"1px solid #e5e7eb", boxShadow:"0 1px 3px rgba(0,0,0,.06)", position:"relative" }}>
                            {msg.message_type === "image" && msg.media_url && (
                              <div style={{ position:"relative", display:"inline-block" }}>
                                <img src={msg.media_url} alt="ảnh" style={{ maxWidth:220, maxHeight:220, borderRadius:10, display:"block", cursor:"pointer", objectFit:"cover" }} onClick={() => setMediaViewer({ items:[msg.media_url], startIndex:0 })} />
                                {isManager && (
                                  <button
                                    onClick={(e)=>{ e.stopPropagation(); if(window.confirm("Xóa ảnh này?")) RepairChat.delete(msg.id).then(()=>setChats(p=>p.filter(m=>m.id!==msg.id))); }}
                                    style={{ position:"absolute", top:4, right:4, background:"rgba(220,38,38,.85)", border:"none", borderRadius:"50%", width:26, height:26, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:10 }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:15,verticalAlign:"middle",lineHeight:1}}>delete</span></button>
                                )}
                              </div>
                            )}
                            {msg.message_type === "video" && msg.media_url && (
                              <div style={{ position:"relative", display:"inline-block" }}>
                                <video src={msg.media_url} controls style={{ maxWidth:220, borderRadius:10, display:"block" }} />
                                {isManager && (
                                  <button
                                    onClick={(e)=>{ e.stopPropagation(); if(window.confirm("Xóa video này?")) RepairChat.delete(msg.id).then(()=>setChats(p=>p.filter(m=>m.id!==msg.id))); }}
                                    style={{ position:"absolute", top:4, right:4, background:"rgba(220,38,38,.85)", border:"none", borderRadius:"50%", width:26, height:26, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}>
                                    <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:15,verticalAlign:"middle",lineHeight:1}}>delete</span>
                                  </button>
                                )}
                              </div>
                            )}
                            {msg.message_type === "audio" && msg.media_url && (
                              <div style={{ position:"relative", display:"inline-block" }}>
                                <audio src={msg.media_url} controls style={{ maxWidth:220 }} />
                                {isManager && (
                                  <button
                                    onClick={(e)=>{ e.stopPropagation(); if(window.confirm("Xóa ghi âm này?")) RepairChat.delete(msg.id).then(()=>setChats(p=>p.filter(m=>m.id!==msg.id))); }}
                                    style={{ position:"absolute", top:-10, right:-6, background:"rgba(220,38,38,.85)", border:"none", borderRadius:"50%", width:26, height:26, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                                    <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:15,verticalAlign:"middle",lineHeight:1}}>delete</span>
                                  </button>
                                )}
                              </div>
                            )}
                            {(msg.message_type === "text" || !msg.media_url) && (
                              <span style={{ whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
                                {(msg.message||"").split(/(@\S+)/g).map((part,i) =>
                                  part.startsWith("@")
                                    ? <span key={i} style={{ color:isMe?"#c7d2fe":"#4f46e5", fontWeight:700 }}>{part}</span>
                                    : part
                                )}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize:11, color:"#9ca3af", marginTop:2, textAlign:isMe?"right":"left" }}>{fmtTime(msgTs)}</div>
                        </div>
                        {isMe && (
                          <div style={{ width:32, height:32, borderRadius:"50%", background:"#4f46e5", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13, flexShrink:0 }}>
                            {(currentUser.name||"?")[0]}
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                });
              })()}
              <div ref={chatRef} />
            </div>

            {/* @mention popup */}
            {showMention && mentionList.length > 0 && (
              <div style={{ position:"absolute", bottom:70, left:14, right:14, background:"#fff", borderRadius:14, boxShadow:"0 8px 32px rgba(0,0,0,.18)", border:"1.5px solid #e5e7eb", zIndex:100, overflow:"hidden", maxHeight:320, overflowY:"auto" }}>
                <div style={{ padding:"8px 14px", fontSize:12, color:"#6b7280", fontWeight:700, background:"#f9fafb", borderBottom:"1px solid #f3f4f6", position:"sticky", top:0 }}>Chọn người nhắc đến</div>
                {mentionList.map((u, idx) => (
                  <div key={u.id} onClick={() => pickMention(u)}
                    style={{ padding:"12px 14px", cursor:"pointer", background:idx===mentionCursor?"#eef2ff":"#fff", borderBottom:"1px solid #f9fafb", display:"flex", gap:10, alignItems:"center" }}>
                    {u.id==="__all__"
                      ? <div style={{ width:32, height:32, borderRadius:"50%", background:"#f59e0b", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18}}>groups</span></div>
                      : <div style={{ width:32, height:32, borderRadius:"50%", background:["manager","admin","owner","supervisor"].includes(u.role)?"#7c3aed":u.role==="receptionist"?"#0369a1":u.role==="technician"?"#2563eb":"#059669", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13 }}>{(u.name||"?")[0]}</div>
                    }
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{u.id==="__all__"?"@all — Tất cả":u.name}</div>
                      <div style={{ fontSize:12, color:"#9ca3af" }}>
                        {u.id==="__all__"?"Thông báo mọi người"
                          :u.role==="owner"?"Chủ cơ sở"
                          :u.role==="manager"?"Quản lý"
                          :u.role==="admin"?"Admin"
                          :u.role==="supervisor"?"Giám sát"
                          :u.role==="technician"?"KTV ĐT"
                          :u.role==="receptionist"?"Giao dịch viên"
                          :u.role==="cashier"?"Thu ngân"
                          :u.role==="warehouse"?"Thủ kho"
                          :u.role==="warehouse"?"Kho"
                          :"Nhân viên"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pending mentions tags */}
            {pendingMentions.length > 0 && (
              <div style={{ padding:"6px 14px", background:"#eef2ff", display:"flex", flexWrap:"wrap", gap:6, borderTop:"1px solid #e5e7eb" }}>
                {pendingMentions.map(m => (
                  <span key={m.id} style={{ background:"#4f46e5", color:"#fff", borderRadius:20, padding:"2px 10px", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:4 }}>
                    @{m.name}
                    <span onClick={() => setPendingMentions(p=>p.filter(x=>x.id!==m.id))} style={{ cursor:"pointer", opacity:.7, fontWeight:900 }}> </span>
                  </span>
                ))}
              </div>
            )}

            {/* Input bar */}
            <div style={{ padding:"10px 12px", borderTop:"1px solid #e5e7eb", background:"#fff", display:"flex", flexDirection:"column", gap:8, flexShrink:0 }}>
              {/* Media buttons row */}
              <div style={{ display:"flex", gap:8 }}>
                {/* Camera / Photo */}
                <label style={{ flex:1, height:40, borderRadius:10, border:"1.5px solid #e5e7eb", background:"#f9fafb", display:"flex", alignItems:"center", justifyContent:"center", gap:4, cursor:"pointer", fontSize:13, fontWeight:600, color:"#374151"}}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,verticalAlign:"middle",lineHeight:1}}>photo_camera</span> Ảnh
                  <input type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={e => e.target.files[0] && handleMediaUpload(e.target.files[0], "image")} />
                </label>
                {/* Video */}
                <label style={{ flex:1, height:40, borderRadius:10, border:"1.5px solid #e5e7eb", background:"#f9fafb", display:"flex", alignItems:"center", justifyContent:"center", gap:4, cursor:"pointer", fontSize:13, fontWeight:600, color:"#374151"}}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,verticalAlign:"middle",lineHeight:1}}>videocam</span> Video
                  <input type="file" accept="video/*" capture="environment" style={{ display:"none" }} onChange={e => e.target.files[0] && handleMediaUpload(e.target.files[0], "video")} />
                </label>
                {/* Voice */}
                <button onClick={toggleRecording}
                  style={{ flex:1, height:40, borderRadius:10, border:`1.5px solid ${recording?"#dc2626":"#e5e7eb"}`, background:recording?"#fef2f2":"#f9fafb", color:recording?"#dc2626":"#374151", cursor:"pointer", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  {recording ? <>{<span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,verticalAlign:"middle",lineHeight:1}}>stop</span>} Dừng</> : <>{<span className="material-icons" style={{fontFamily:"Material Icons",fontSize:18,verticalAlign:"middle",lineHeight:1}}>mic</span>} Ghi âm</>}
                </button>
              </div>
              {/* Text row */}
              <div style={{ display:"flex", gap:8, alignItems:"center", position:"relative" }}>
                {chatUploading && (
                  <div style={{ position:"absolute", inset:0, background:"rgba(255,255,255,.8)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", zIndex:10, fontSize:13, color:"#4f46e5", fontWeight:700 }}>⏳ Đang gửi...</div>
                )}
                <input
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={handleChatInputChange}
                  onKeyDown={e => {
                    if (showMention) {
                      if (e.key==="ArrowDown") { e.preventDefault(); setMentionCursor(c=>Math.min(c+1,mentionList.length-1)); }
                      else if (e.key==="ArrowUp") { e.preventDefault(); setMentionCursor(c=>Math.max(c-1,0)); }
                      else if (e.key==="Enter") { e.preventDefault(); if(mentionList[mentionCursor]) pickMention(mentionList[mentionCursor]); }
                      else if (e.key==="Escape") setShowMention(false);
                    } else if (e.key==="Enter" && !e.shiftKey) {
                      e.preventDefault(); sendChat();
                    }
                  }}
                  placeholder="Nhắn tin... (@ để nhắc người)"
                  style={{ flex:1, height:46, borderRadius:24, border:"1.5px solid #e5e7eb", padding:"0 16px", fontSize:14, outline:"none" }}
                />
                <button onClick={() => sendChat()}
                  style={{ width:46, height:46, borderRadius:"50%", background:"#4f46e5", border:"none", color:"#fff", fontSize:20, cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,verticalAlign:"middle",lineHeight:1}}>send</span></button>
              </div>
            </div>
          </div>
        )}


        {tab === "exports" && (
          <div style={{ flex:1, overflowY:"auto", padding:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ fontWeight:800, fontSize:15, color:"#1e1b4b" }}>📦 Phiếu xuất linh kiện</div>
              <button onClick={() => { setExportLoading(true); StockExportRequest.filter({ order_id: order.order_code || order.id }).then(d => { setExportReqs(d.sort((a,b) => new Date(b.due_datetime||0)-new Date(a.due_datetime||0))); setExportLoading(false); }).catch(() => setExportLoading(false)); }}
                style={{ background:"#f3f4f6", border:"none", borderRadius:8, padding:"6px 12px", fontSize:12, cursor:"pointer", fontWeight:600, color:"#374151", display:"flex", alignItems:"center", gap:4 }}>
                <span className="material-icons" style={{fontSize:14,fontFamily:"Material Icons"}}>refresh</span> Tải lại
              </button>
            </div>
            {exportLoading ? (
              <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}>⏳ Đang tải...</div>
            ) : exportReqs.length === 0 ? (
              <div style={{ textAlign:"center", padding:40 }}>
                <span className="material-icons" style={{ fontSize:48, color:"#d1d5db", display:"block", marginBottom:8, fontFamily:"Material Icons" }}>inventory_2</span>
                <div style={{ color:"#9ca3af", fontSize:14 }}>Chưa có phiếu xuất nào</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {exportReqs.map(req => {
                  const STATUS_MAP = {
                    pending:             { label:"Chờ kho xuất",    bg:"#fef9c3", color:"#92400e", icon:"hourglass_empty" },
                    warehouse_confirmed: { label:"Kho đã xuất",     bg:"#dcfce7", color:"#065f46", icon:"check_circle" },
                    ktv_confirmed:       { label:"KTV đã nhận",     bg:"#dbeafe", color:"#1d4ed8", icon:"handshake" },
                    returned:            { label:"Đã hoàn trả",     bg:"#f3f4f6", color:"#6b7280", icon:"undo" },
                    cancelled:           { label:"Đã hủy",          bg:"#fee2e2", color:"#991b1b", icon:"cancel" },
                  };
                  const st = STATUS_MAP[req.status] || { label: req.status, bg:"#f3f4f6", color:"#374151", icon:"info" };
                  const isBorrow = req.export_type === "borrow";
                  let items = [];
                  try { items = typeof req.items === "string" ? JSON.parse(req.items) : (req.items || []); } catch {}
                  const dueDate = req.due_datetime ? new Date(req.due_datetime) : null;
                  const returnDate = req.return_due_date ? new Date(req.return_due_date) : null;
                  const now = new Date();
                  const isOverdue = isBorrow && returnDate && returnDate < now && req.status !== "returned" && req.status !== "cancelled";
                  return (
                    <div key={req.id} style={{ background:"#fff", borderRadius:14, border:`1.5px solid ${isOverdue?"#fca5a5":"#e5e7eb"}`, boxShadow:"0 1px 4px rgba(0,0,0,.06)", overflow:"hidden" }}>
                      {/* Header phiếu */}
                      <div style={{ padding:"12px 14px 8px", borderBottom:"1px solid #f3f4f6" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                          <div>
                            <div style={{ fontWeight:800, fontSize:13, color:"#1e1b4b" }}>{req.request_code}</div>
                            <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{(() => { const d = req.due_datetime ? new Date(req.due_datetime) : null; return d && !isNaN(d) ? `Hạn: ${d.toLocaleString("vi-VN",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}` : req.request_code ? "" : ""; })()}</div>
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                            <span style={{ background:st.bg, color:st.color, fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:10 }}>{st.label}</span>
                            <span style={{ background:isBorrow?"#f0fdf4":"#eff6ff", color:isBorrow?"#166534":"#1d4ed8", fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:8 }}>
                              {isBorrow?"🔄 Mượn tạm":"🔧 Xuất sửa"}
                            </span>
                          </div>
                        </div>
                        {isOverdue && (
                          <div style={{ background:"#fee2e2", color:"#991b1b", fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:8, marginTop:8, display:"flex", alignItems:"center", gap:4 }}>
                            <span className="material-icons" style={{fontSize:13,fontFamily:"Material Icons"}}>warning</span>
                            QUÁ HẠN TRẢ — {returnDate.toLocaleDateString("vi-VN")}
                          </div>
                        )}
                      </div>
                      {/* Danh sách linh kiện */}
                      <div style={{ padding:"8px 14px" }}>
                        {items.length > 0 ? (
                          <div>
                            <div style={{ fontSize:11, fontWeight:700, color:"#6b7280", marginBottom:6, textTransform:"uppercase", letterSpacing:.5 }}>Linh kiện</div>
                            {items.map((item, i) => (
                              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom: i < items.length-1 ? "1px dashed #f3f4f6" : "none" }}>
                                <div style={{ fontSize:12, color:"#374151", fontWeight:600 }}>{item.name || item.part_name}</div>
                                <div style={{ fontSize:12, color:"#6b7280" }}>×{item.qty || item.qty_requested || 1} · {((item.unit_price||0)*(item.qty||item.qty_requested||1)).toLocaleString()}đ</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {/* Thông tin người xuất & KTV */}
                        <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:"4px 14px" }}>
                          <div style={{ fontSize:11, color:"#9ca3af" }}>📤 Yêu cầu: <b style={{color:"#374151"}}>{req.requested_by_name||"?"}</b></div>
                          {req.warehouse_confirmed_by_name && <div style={{ fontSize:11, color:"#9ca3af" }}>🏭 Kho: <b style={{color:"#374151"}}>{req.warehouse_confirmed_by_name}</b></div>}
                          {req.ktv_confirmed_by_name && <div style={{ fontSize:11, color:"#9ca3af" }}>🔧 KTV: <b style={{color:"#374151"}}>{req.ktv_confirmed_by_name}</b></div>}
                          {dueDate && <div style={{ fontSize:11, color:"#9ca3af" }}>🕐 Hạn xuất: <b style={{color:"#374151"}}>{dueDate.toLocaleString("vi-VN",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</b></div>}
                          {returnDate && <div style={{ fontSize:11, color: isOverdue?"#dc2626":"#9ca3af" }}>↩️ Hạn trả: <b style={{color:isOverdue?"#dc2626":"#374151"}}>{returnDate.toLocaleDateString("vi-VN")}</b></div>}
                          {req.total_value > 0 && <div style={{ fontSize:11, color:"#9ca3af" }}>💰 Tổng: <b style={{color:"#059669"}}>{(req.total_value||0).toLocaleString()}đ</b></div>}
                        </div>
                        {/* Ghi chú kho / KTV */}
                        {req.warehouse_note && <div style={{ marginTop:6, background:"#f9fafb", borderRadius:8, padding:"6px 10px", fontSize:11, color:"#6b7280" }}>🏭 Kho: {req.warehouse_note}</div>}
                        {req.ktv_note && <div style={{ marginTop:4, background:"#f9fafb", borderRadius:8, padding:"6px 10px", fontSize:11, color:"#6b7280" }}>🔧 KTV: {req.ktv_note}</div>}
                        {/* NÚT XÁC NHẬN NHẬN LINH KIỆN — chỉ hiện khi kho đã xuất + KTV là người của đơn */}
                        {req.status === "warehouse_confirmed" && (isMyOrder || ["manager","admin","owner","supervisor"].includes(currentUser.role)) && (
                          <div style={{ marginTop:12, borderTop:"1px solid #e5e7eb", paddingTop:12 }}>
                            {ktvConfirmingId === req.id ? (
                              <div>
                                <textarea
                                  value={ktvConfirmNote}
                                  onChange={e => setKtvConfirmNote(e.target.value)}
                                  placeholder="Ghi chú khi nhận (không bắt buộc)..."
                                  rows={2}
                                  style={{ width:"100%", borderRadius:10, border:"1.5px solid #e5e7eb", padding:"8px 10px", fontSize:12, resize:"none", boxSizing:"border-box", outline:"none", marginBottom:8 }}
                                />
                                <div style={{ display:"flex", gap:8 }}>
                                  <button onClick={() => { setKtvConfirmingId(null); setKtvConfirmNote(""); }}
                                    style={{ flex:1, height:40, background:"#f3f4f6", border:"none", borderRadius:10, fontSize:13, fontWeight:700, color:"#6b7280", cursor:"pointer" }}>
                                    Hủy
                                  </button>
                                  <button disabled={ktvSubmitting} onClick={async () => {
                                    setKtvSubmitting(true);
                                    try {
                                      await StockExportRequest.update(req.id, {
                                        status: "ktv_confirmed",
                                        ktv_confirmed_by: currentUser.id,
                                        ktv_confirmed_by_name: currentUser.name,
                                        ktv_confirmed_at: new Date().toISOString(),
                                        ktv_note: ktvConfirmNote,
                                      });
                                      logAction(currentUser, "export_stock", "stock_export", req.id, req.request_code||req.id);
                                      // Cập nhật local list
                                      setExportReqs(prev => prev.map(r => r.id === req.id ? {...r, status:"ktv_confirmed", ktv_confirmed_by_name:currentUser.name, ktv_note:ktvConfirmNote} : r));
                                      setKtvConfirmingId(null);
                                      setKtvConfirmNote("");
                                    } catch(e) { alert("Lỗi: " + e.message); }
                                    setKtvSubmitting(false);
                                  }}
                                    style={{ flex:2, height:40, background:"#059669", border:"none", borderRadius:10, fontSize:13, fontWeight:800, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, opacity:ktvSubmitting?0.6:1 }}>
                                    <span className="material-icons" style={{fontSize:16,fontFamily:"Material Icons"}}>check_circle</span>
                                    {ktvSubmitting ? "Đang xử lý..." : "Xác nhận đã nhận"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => { setKtvConfirmingId(req.id); setKtvConfirmNote(""); }}
                                style={{ width:"100%", height:44, background:"linear-gradient(135deg,#059669,#047857)", border:"none", borderRadius:12, fontSize:14, fontWeight:800, color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 3px 10px rgba(5,150,105,.3)" }}>
                                <span className="material-icons" style={{fontSize:18,fontFamily:"Material Icons"}}>check_circle</span>
                                Xác nhận đã nhận linh kiện
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab ==="parts" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
            <div style={{ fontSize:40, marginBottom:12 }}> </div>
            <div style={{ fontWeight:800, fontSize:16, color:"#1e1b4b", marginBottom:6 }}>Quản lý linh kiện</div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:20, textAlign:"center" }}>Chọn linh kiện, auto chat kho,<br/>trả linh kiện và bấm Sửa Xong.</div>
            <button onClick={() => setShowSparePart(true)}
              style={{ height:52, padding:"0 32px", background:"linear-gradient(135deg,#4f46e5,#7c3aed)", color:"#fff", border:"none", borderRadius:16, fontWeight:800, fontSize:16, cursor:"pointer", boxShadow:"0 4px 16px rgba(79,70,229,.4)"}}>
                Mở màn hình linh kiện
            </button>
          </div>
        )}

        {showPreCheck && (
          <PreCheckModal
            order={order}
            currentUser={currentUser}
            users={users}
            onClose={() => setShowPreCheck(false)}
            onDone={async (data) => {
              await onUpdate(order.id, {
                status: "Cho KTV",
                qt1_checklist: data.qt1_checklist,
                qt1_note: data.qt1_note,
                assigned_to: data.assigned_to,
                assigned_to_name: data.assigned_to_name,
                assigned_at: new Date().toISOString(),
                accept_stage: 0,
              }, null);
              logHistory({ order_id:order.id, order_code:order.order_code||order.id, action_type:"qt1_done", action_label:"Hoàn tất QT1 — Ngoại quan", changed_by_id:currentUser?.id||"", changed_by_name:currentUser?.name||"", changed_by_role:currentUser?.role||"", new_value:`KTV: ${data.assigned_to_name}` });
              const notifyUsers = users.filter(u => u.id === data.assigned_to || ["manager","admin","owner","supervisor"].includes(u.role));
              notifyUsers.forEach(u => Notification.create({ user_id:u.id, user_name:u.name||"", title:`🔍 Đơn ${order.order_code||order.id} chờ KTV nhận kiểm`, message:`Thiết bị: ${order.device_model} · ${order.customer_name} — KTV: ${data.assigned_to_name}`, order_id:order.id, order_code:order.order_code||order.id, type:"status_change", is_read:false }).catch(()=>{}));
              setShowPreCheck(false);
              showToast("✅ Đã chuyển KTV kiểm QT2!");
            }}
          />
        )}

        {showQT2 && (
          <QT2Modal
            order={order}
            currentUser={currentUser}
            onClose={() => setShowQT2(false)}
            onDone={async (data) => {
              // Upload ảnh/video QT2 lên PocketBase nếu có
              let qt2ImgUrls = [];
              if (data.qt2_images?.length > 0 && order._id) {
                try {
                  const formData = new FormData();
                  data.qt2_images.forEach(f => formData.append("qt2_images", f));
                  const { token: pbToken } = getAuth();
                  const res = await fetch(`${getPbUrl()}/api/collections/repair_orders/records/${order._id}`, {
                    method: "PATCH", headers: { Authorization: pbToken }, body: formData,
                  });
                  if (res.ok) { const updated = await res.json(); qt2ImgUrls = updated.qt2_images || []; }
                } catch(e) { console.warn("Upload QT2 media thất bại:", e); }
              }
              await onUpdate(order.id, {
                status: "Cho Bao Gia",
                qt2_checklist: data.qt2_checklist,
                qt2_note: data.qt2_note,
                qt2_de_xuat: JSON.stringify(data.qt2_de_xuat || []),
                qt2_total: data.qt2_total || 0,
                accept_stage: 1,
                stage1_at: order.stage1_at || new Date().toISOString(),
              }, null);
              logHistory({ order_id:order.id, order_code:order.order_code||order.id, action_type:"qt2_done", action_label:"KTV hoàn tất kiểm QT2 — Chờ báo giá", changed_by_id:currentUser?.id||"", changed_by_name:currentUser?.name||"", changed_by_role:currentUser?.role||"", new_value:"Chờ Báo Giá" });
              const notifyUsers = users.filter(u => ["receptionist","manager","admin"].includes(u.role));
              notifyUsers.forEach(u => Notification.create({ user_id:u.id, user_name:u.name||"", title:`📋 ${order.order_code||order.id} — KTV đã kiểm xong`, message:`${order.device_model} · ${order.customer_name} — Chờ báo giá KH`, order_id:order.id, order_code:order.order_code||order.id, type:"status_change", is_read:false }).catch(()=>{}));
              setShowQT2(false);
              showToast("✅ Đã gửi kết quả về Giao dịch viên!");
            }}
          />
        )}

        {showCustConfirm && (
          <CustomerConfirmModal
            order={order}
            currentUser={currentUser}
            onClose={() => setShowCustConfirm(false)}
            onApprove={async (pricing = {}) => {
              await onUpdate(order.id, {
                status: "Cho KTV Sua",
                accept_stage: 0,
                estimated_cost: pricing.estimated_cost || order.estimated_cost || 0,
                deposit: pricing.deposit ?? order.deposit ?? 0,
              }, null);
              logHistory({
                order_id: order.id, order_code: order.order_code||order.id,
                action_type: "approved", action_label: "Khách đồng ý — Lên đơn sửa",
                changed_by_id: currentUser?.id||"", changed_by_name: currentUser?.name||"", changed_by_role: currentUser?.role||"",
                new_value: `Báo giá: ${(pricing.estimated_cost||0).toLocaleString("vi-VN")}đ${pricing.deposit ? ` · Cọc: ${pricing.deposit.toLocaleString("vi-VN")}đ` : ""}`,
              });
              const notifyKtv = users.filter(u => u.id === order.assigned_to);
              const giaStr = pricing.estimated_cost ? ` · Báo giá: ${pricing.estimated_cost.toLocaleString("vi-VN")}đ` : "";
              notifyKtv.forEach(u => Notification.create({ user_id:u.id, user_name:u.name||"", title:`✅ Đơn ${order.order_code||order.id} đã được duyệt!`, message:`${order.device_model} · ${order.customer_name}${giaStr} — Bấm Nhận Đơn để bắt đầu`, order_id:order.id, order_code:order.order_code||order.id, type:"status_change", is_read:false }).catch(()=>{}));
              setShowCustConfirm(false);
              showToast(`✅ Đã lên đơn — Báo giá ${pricing.estimated_cost ? pricing.estimated_cost.toLocaleString("vi-VN")+"đ" : "chưa có"}`);
            }}
            onReject={async (reason) => {
              await onUpdate(order.id, { status:"Hủy", technician_note:(order.technician_note||"") + `
[Hủy] ${reason}` }, null);
              logHistory({ order_id:order.id, order_code:order.order_code||order.id, action_type:"cancelled", action_label:"Khách không đồng ý — Hủy đơn", changed_by_id:currentUser?.id||"", changed_by_name:currentUser?.name||"", changed_by_role:currentUser?.role||"", new_value:`Lý do: ${reason}` });
              setShowCustConfirm(false);
              showToast("Đơn đã được lưu trạng thái Hủy");
            }}
          />
        )}

        {showHandover && (
          <HandoverModal
            order={order}
            currentUser={currentUser}
            onClose={() => setShowHandover(false)}
            onDone={(handoverData) => {
              onUpdate(order.id, {
                status: "Đã Giao",
                handover_at: handoverData.handover_at,
                handover_by: currentUser.id,
                handover_by_name: currentUser.name,
                handover_checklist: JSON.stringify(handoverData.checklist),
                handover_note: handoverData.note,
                handover_signature: handoverData.signature,
                handover_media: handoverData.media,
                final_cost: handoverData.final_cost,
              }, null);
              updateCustomerStats({ ...order, final_cost: handoverData.final_cost, status:"Đã Giao" });
              autoCreateOrUpdateDebt(order, handoverData.final_cost, order.deposit, handoverData.payment_method || "Tiền mặt", currentUser);
              logHistory({
                order_id: order._id||order.id,
                order_code: order.order_code||order.id,
                action_type: "delivered",
                action_label: "Bàn giao máy",
                changed_by_id: currentUser?.id||"",
                changed_by_name: currentUser?.name||"",
                changed_by_role: currentUser?.role||"",
                old_value: "Hoàn Thành",
                new_value: "Đã Giao",
                note: handoverData.note,
              });
              logAction(currentUser, "handover", "repair_order", order._id||order.id, "Ban giao don " + (order.order_code||order.id) + " cho khach");
              setShowHandover(false);
              showToast("✅ Bàn giao thành công!");
            }}
          />
        )}

        {showSparePart && (
          <Suspense fallback={<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:"#fff",fontSize:18}}>⏳ Đang tải...</div></div>}>
            <SparePartModal
              order={order}
              currentStaff={currentUser}
              onClose={() => setShowSparePart(false)}
              onDone={() => { setShowSparePart(false); onUpdate(order.id, { status:"Hoàn Thành" }, { userId:order.assigned_to, delta:2, note:"Sửa xong +2 KPI" }); onClose(); }}
            />
          </Suspense>
        )}

        {tab === "qr" && (
          <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ fontWeight:800, fontSize:16, marginBottom:4, textAlign:"center"}}>  Mã QR Phiếu Sửa</div>
            <div style={{ color:"#6b7280", fontSize:13, marginBottom:16, textAlign:"center" }}>Dán lên máy để tra cứu nhanh</div>
            <div style={{ background:"#f9fafb", borderRadius:20, padding:24, marginBottom:16, textAlign:"center", border:"2px dashed #a5b4fc" }}>
              <QRCanvas key={qrContent} text={qrContent} size={180} />
              <div style={{ fontWeight:800, fontSize:18, color:"#1e1b4b", marginTop:10 }}>{order.id}</div>
              {order.qr_code && <div style={{ fontSize:12, color:"#818cf8", fontFamily:"monospace" }}>Mã QR máy: {order.qr_code}</div>}
              <div style={{ fontSize:13, color:"#6b7280" }}>{cust?.full_name} · {order.device_model}</div>
            </div>

            <div style={{ fontSize:12, color:"#9ca3af", textAlign:"center", marginTop:10 }}>QR chứa mã đơn: <strong>{qrContent}</strong></div>
          </div>
        )}
      </div>
    </div>
    {showChecklist && checklistTarget && (
      <AcceptChecklistModal
        order={checklistTarget.ord}
        onConfirm={handleChecklistConfirm}
        onClose={() => setShowChecklist(false)}
      />
    )}
    {mediaViewer && (
      <MediaViewer
        items={mediaViewer.items}
        startIndex={mediaViewer.startIndex}
        onClose={() => setMediaViewer(null)}
        onSendAnnotated={async (file) => {
          await handleMediaUpload(file, "image");
          setMediaViewer(null);
        }}
      />
    )}
    {showEditOrder && (
      <EditOrderModal
        order={order}
        users={users}
        currentUser={currentUser}
        onClose={() => setShowEditOrder(false)}
        onSave={(updated) => {
          setShowEditOrder(false);
          // updated là PB record — dùng order_code làm app-id để onUpdate tìm đúng đơn
          const appId = updated.order_code || order.id;
          const patch = {
            customer_name:       updated.customer_name,
            customer_phone:      updated.customer_phone,
            device_name:         updated.device_name,
            device_model:        updated.device_model,
            imei:                updated.imei,
            passcode:            updated.passcode,
            issue_description:   updated.issue_description,
            technician_note:     updated.technician_note,
            assigned_to:         updated.assigned_to,
            assigned_to_name:    updated.assigned_to_name,
            status:              updated.status,
            priority:            updated.priority,
            estimated_cost:      updated.estimated_cost,
            final_cost:          updated.final_cost,
            deposit:             updated.deposit,
            warranty_days:       updated.warranty_days,
            received_date:       updated.received_date,
            estimated_done_date: updated.estimated_done_date,
            done_date:           updated.done_date,
            _pbSaved:            true,
          };
          onUpdate && onUpdate(appId, patch, null);
        }}
      />
    )}
    {/* ── Share Modal ── */}
    {showShareModal && (
      <ShareOrderModal order={order} onClose={() => setShowShareModal(false)} />
    )}
    </>
  );
}


export { OrderDrawer };


// ══════════════════════════════════════════════
//  SHARE ORDER MODAL
// ══════════════════════════════════════════════
const PUBLIC_URL = "https://hk-app-copy-4cefbb7c.base44.app/OrderPublic";

// Inline QR loader — không phụ thuộc module scope của QRComponents
// Wrapper: inject permission vào props
function OrderDrawerWithPerm(props) {
  const { can } = usePermission();
  return <OrderDrawer {...props} canRepairEdit={can("repair_order","edit")} canRepairDelete={can("repair_order","delete")} />;
}
export default OrderDrawerWithPerm;