/* v1774860462-5727 */
import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import HandoverModal from "./HandoverModal.jsx";
const SparePartModal = lazy(() => import("./SparePartModal").catch(() => ({ default: ({ onClose }) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{background:"#fff",borderRadius:16,padding:32,textAlign:"center"}}>
      <div style={{fontSize:32}}>⚠️</div>
      <div style={{fontWeight:700,marginTop:8}}>Không tải được module linh kiện</div>
      <button onClick={onClose} style={{marginTop:16,padding:"10px 24px",background:"#4f46e5",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>Đóng</button>
    </div>
  </div>
)})));
import { RepairChat, Notification, Staff, RepairOrder, SparePart, SparePartUsage, StockExportRequest, subscribeCollection, getPbUrl, getAuth, logHistory, pbSettings } from "./pb.jsx";
import { getNotifSound } from "./Settings";
import { uploadFile } from "./pb.jsx";

import { QRScanModal, QRPrintModal, QRCanvas, getQRDataUrl, loadQRLib } from "./QRComponents";
import { NewOrderModal } from "./OrderForms";
import { timeAgo, genOrderId, getKpiTimerInfo, MediaViewer, AcceptChecklistModal, AcceptTimer, STATUS_COLS, STATUS_PB, STATUS_DISPLAY, PRIORITY_PB, PRIORITY_DISPLAY } from "./MediaViewer";

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

function OrderDrawer({ order, onClose, currentUser, onUpdate, users, onShowQR, onGoToPendingAccept }) {
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


  // Tự mở tab chat nếu được trigger từ notification click HOẶC _openTab prop
  useEffect(() => {
    if (order._openTab) {
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
  }, [order.id, order._id, order._openTab]);
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
    let cancelled = false;
    RepairChat.filter({ order_id: order.id })
      .then(data => { if (!cancelled) setChats(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [order.id]);

  // Load full chats + set loading khi vào tab chat
  useEffect(() => {
    if (tab !== "chat") return;
    let cancelled = false;
    setChatLoading(true);
    RepairChat.filter({ order_id: order.id }, { sort: "id" })
      .then(data => { if (!cancelled) { setChats(data); setChatLoading(false); } })
      .catch(() => { if (!cancelled) setChatLoading(false); });
    return () => { cancelled = true; };
  }, [order.id, tab]);

  // Load phiếu xuất khi mở tab exports (+ polling 8s)
  useEffect(() => {
    if (tab !== "exports") return;
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
  }, [order.id, order._id, order.order_code, tab]);


  // Polling chat 3s - đơn giản, ổn định, gần realtime
  useEffect(() => {
    if (tab !== "chat") return;
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
  }, [tab, order.id]);

  // Auto-scroll
  useEffect(() => { setTimeout(() => chatRef.current?.scrollIntoView({ behavior:"smooth" }), 80); }, [chats, tab]);

  // Build mention list from users related to this order
  const getMentionCandidates = useCallback(() => {
    const isSelf = (u) =>
      u.id === currentUser.id ||
      (u.username && currentUser.username && u.username === currentUser.username);

    // 1. Manager/Admin + Receptionist (trừ bản thân)
    const mgr = (users||[]).filter(u => u && u.id && !isSelf(u) && ["manager","admin"].includes(u.role));
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
  }, [users, currentUser.id, currentUser.username, order?.assigned_to, order?.assigned_to_name]);

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
      if (notifyIds.length > 0) {
        notifyIds.forEach((uid, i) => {
          Notification.create({
            user_id: uid,
            user_name: notifyNames[i] || "",
            title: `💬 Được nhắc trong ${order.id}`,
            message: `${currentUser.name}: ${msgPreview}`,
            order_id: order._id || order.id,
            order_code: order.id,
            type:"mention",
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

  const cust = order.customer_name ? { full_name: order.customer_name, phone: order.customer_phone } : null;
  const assignee = users.find(u => u.id === order.assigned_to);
  const col = STATUS_COLS.find(s => s.key === order.status);
  const isKTV = currentUser.role === "technician";
  const isMyOrder = order.assigned_to === currentUser.id;
  const isReception = currentUser.role === "receptionist";

  function showToast(msg, type="success") { setToast({msg,type}); setTimeout(() => setToast(null), 3000); }

  function handleAccept(ord, stage) {
    const k = `stage${stage}_at`;
    onUpdate(ord.id, { accept_stage:stage, [k]:new Date().toISOString() }, null);
    showToast(`  Nhận máy lần ${stage} thành công!`);
  }
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

    const newStatus = (ord.status === "Chưa Nhận" || stage === 1) ? "Mới Nhận" : "Đang Sửa";
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
      accept_stage: 1,
      stage1_at: now,
      assigned_at: assignedAt,
      status: newStatus,
      estimated_done: estDate,
      estimated_done_date: estDate,
      technician_note: techNote || ord.technician_note || "",
      images: newImages,
      videos: newVideos,
    }, null);
    setShowChecklist(false);
    showToast("✅ Đã nhận đơn!");
  }
  function handleMarkDone() {
    onUpdate(order.id, { status:"Hoàn Thành", accept_stage:3 }, { userId:order.assigned_to, delta:2, note:"Sửa xong +2 KPI" });
      logHistory({ order_id:order._id||order.id, order_code:order.order_code||order.id, action_type:"delivered", action_label:"Xác nhận hoàn thành", changed_by_id:currentUser?.id||"", changed_by_name:currentUser?.name||"", changed_by_role:currentUser?.role||"", old_value:order.status||"", new_value:"Hoàn Thành" });
    showToast("Hoàn thành! +2 KPI");
    setEditMode(false);
  }
  // sendChat is now defined above in useEffect block

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
            {(currentUser.role === "manager" || currentUser.role === "admin" || currentUser.role === "receptionist") && (
              <>
                <button onClick={() => setShowEditOrder(true)}
                  style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", height:34, padding:"0 12px", borderRadius:20, fontSize:13, fontWeight:700, cursor:"pointer"}}>  Sửa</button>
                <button onClick={() => setShowShareModal(true)}
                  style={{ background:"rgba(134,239,172,.3)", border:"none", color:"#fff", height:34, padding:"0 12px", borderRadius:20, fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:16,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>share</span> Share</button>
                {(currentUser.role === "manager" || currentUser.role === "admin") && (
                <button onClick={async () => {
                  if (!window.confirm("Xóa đơn " + order.id + "?\nThao tác này không thể hoàn tác!")) return;
                  const delId = order._id || order.id;
                  const orderCode = order.id || order.order_code;
                  try {
                    // 1. Xóa đơn khỏi PocketBase
                    await RepairOrder.delete(delId);

                    // 2. Thông báo cho tất cả user liên quan
                    const relatedUsers = (users||[]).filter(u => {
                      if (!u?.id || u.id === currentUser.id) return false;
                      // KTV được giao, manager, admin, receptionist
                      return u.id === order.assigned_to ||
                             ["manager","admin","receptionist"].includes(u.role);
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
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:34, height:34, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><span className="material-icons" style={{fontFamily:"Material Icons",fontSize:20,verticalAlign:"middle",lineHeight:1,userSelect:"none"}}>close</span></button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid #e5e7eb" }}>
          {[["info","Thông tin"],...(!isReception && (currentUser.role==="manager"||currentUser.role==="admin"||isMyOrder)?[["parts","Linh kiện"]]:[]),["exports","Phiếu xuất"],["chat","Chat"]].map(([t,lbl]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex:1, padding:"11px", border:"none", background:"none", fontWeight:700, fontSize:13, cursor:"pointer", borderBottom:tab===t?"3px solid #4f46e5":"3px solid transparent", color:tab===t?"#4f46e5":"#6b7280", position:"relative" }}>
              {lbl}
              {t==="chat" && chats.length > 0 && (
                <span style={{ position:"absolute", top:6, right:"calc(50% - 22px)", background:"#4f46e5", color:"#fff", borderRadius:10, fontSize:10, fontWeight:800, padding:"1px 5px", minWidth:16, lineHeight:"14px" }}>
                  {chats.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <div style={{ flex:1, overflowY:"auto", padding:18 }}>
            {/* ── Nút Nhận Đơn khi status = Chưa Nhận ─── */}
            {order.status === "Chưa Nhận" && isMyOrder && (
              <div style={{ background:"linear-gradient(135deg,#4f46e5,#7c3aed)", borderRadius:16, padding:20, marginBottom:14, textAlign:"center" }}>
                <div style={{ color:"#fff", fontWeight:800, fontSize:17, marginBottom:6 }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22,verticalAlign:"middle",marginRight:6}}>assignment</span>
                  Đơn chờ bạn nhận!
                </div>
                <div style={{ color:"rgba(255,255,255,.8)", fontSize:13, marginBottom:14 }}>
                  {order.device_model} — {order.customer_name}
                </div>
                <button onClick={() => handleOpenChecklist(order, 1)}
                  style={{ width:"100%", height:58, borderRadius:16, border:"2px solid rgba(255,255,255,.5)", background:"rgba(255,255,255,.15)", color:"#fff", fontWeight:900, fontSize:18, cursor:"pointer", backdropFilter:"blur(4px)" }}>
                  <span className="material-icons" style={{fontFamily:"Material Icons",fontSize:22,verticalAlign:"middle",marginRight:8}}>check_circle</span>
                  Nhận Đơn
                </button>
              </div>
            )}
            {/* Manager thấy trạng thái Chưa Nhận */}
            {order.status === "Chưa Nhận" && !isMyOrder && currentUser.role === "manager" && (
              <div style={{ background:"#fef3c7", border:"2px solid #fcd34d", borderRadius:14, padding:14, marginBottom:14 }}>
                <div style={{ fontWeight:800, fontSize:14, color:"#92400e" }}>⏳ Đơn chờ KTV nhận</div>
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
            {currentUser.role === "manager" && !["Hoàn Thành","Đã Giao","Hủy"].includes(order.status) && (
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
                              status:                "Chưa Nhận",
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
            {!["Hoàn Thành","Đã Giao","Chưa Nhận"].includes(order.status) && (currentUser.role==="manager" || isMyOrder) && (
              <div style={{ marginBottom:14 }}>
                {/* KTV chưa nhận đơn → disable toàn bộ status picker */}
                {isKTV && isMyOrder && (order.accept_stage||0) < 1 && order.status !== "Chưa Nhận" && (
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
                      {STATUS_COLS.filter(c => !["Đã Giao","Chưa Nhận"].includes(c.key)).map(c => (
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
    const notifyUsers = users.filter(u => ["manager","admin","receptionist"].includes(u.role));
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
            {/* Thời gian dự kiến */}
            {order.estimated_done && (
              <div style={{ background:"#f0fdf4", borderRadius:12, padding:"10px 14px", marginBottom:14, fontSize:13 }}>
                <span style={{ color:"#059669", fontWeight:700 }}>⏱ Dự kiến xong: </span>
                <span style={{ fontWeight:600 }}>{new Date(order.estimated_done).toLocaleString("vi-VN",{dateStyle:"short",timeStyle:"short"})}</span>
              </div>
            )}

            {/* ── NÚT BÀN GIAO MÁY — chỉ Tiếp tân và Manager, khi đơn Hoàn Thành ── */}
            {order.status === "Hoàn Thành" && (isReception || currentUser.role === "manager" || currentUser.role === "admin") && (
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
                  const isManager = currentUser.role === "manager" || currentUser.role === "admin";
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
                      : <div style={{ width:32, height:32, borderRadius:"50%", background:["manager","admin"].includes(u.role)?"#7c3aed":u.role==="receptionist"?"#0369a1":u.role==="technician"?"#2563eb":"#059669", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13 }}>{(u.name||"?")[0]}</div>
                    }
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{u.id==="__all__"?"@all — Tất cả":u.name}</div>
                      <div style={{ fontSize:12, color:"#9ca3af" }}>
                        {u.id==="__all__"?"Thông báo mọi người"
                          :u.role==="manager"?"Quản lý"
                          :u.role==="technician"?"Kỹ thuật"
                          :u.role==="receptionist"?"Tiếp tân"
                          :u.role==="admin"?"Quản lý (Admin)"
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
                        {req.status === "warehouse_confirmed" && (isMyOrder || currentUser.role === "manager" || currentUser.role === "admin") && (
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


// ══════════════════════════════════════════════
//  EDIT ORDER MODAL (Manager only)
// ══════════════════════════════════════════════
function EditOrderModal({ order, users, currentUser, onClose, onSave }) {
  const ISSUES_LIST = ["Màn hình","Pin","Sạc","Camera","Loa","Mic","Nút bấm","Wifi","Bluetooth","IC","Bo mạch","Vỏ máy","Khác"];

  const parseIssues = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return raw.split(",").map(s => s.trim()).filter(Boolean);
  };

  const [form, setForm] = React.useState({
    customer_name:       order.customer_name || "",
    customer_phone:      order.customer_phone || "",
    device_name:         order.device_name || "",
    device_model:        order.device_model || "",
    imei:                order.imei || order.imei_serial || "",
    passcode:            order.passcode || "",
    issues:              parseIssues(order.issue_description),
    issue_description:   order.issue_description || "",
    technician_note:     order.technician_note || "",
    assigned_to:         order.assigned_to || "",
    assigned_to_name:    order.assigned_to_name || "",
    status:              order.status || "Chưa Nhận",
    priority:            order.priority || "Thuong",
    estimated_cost:      order.estimated_cost != null ? String(order.estimated_cost) : "",
    final_cost:          order.final_cost != null ? String(order.final_cost) : "",
    deposit:             order.deposit != null ? String(order.deposit) : "",
    warranty_days:       order.warranty_days != null ? String(order.warranty_days) : "0",
    received_date:       order.received_date ? order.received_date.substring(0,16) : "",
    estimated_done_date: order.estimated_done_date ? order.estimated_done_date.substring(0,16) : "",
    done_date:           order.done_date ? order.done_date.substring(0,16) : "",
  });
  const [saving, setSaving] = React.useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleIssue = (issue) => {
    const next = form.issues.includes(issue)
      ? form.issues.filter(x => x !== issue)
      : [...form.issues, issue];
    setForm(f => ({ ...f, issues: next, issue_description: next.join(", ") }));
  };

  const inp  = { width:"100%", height:46, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:15, outline:"none", boxSizing:"border-box", background:"#fff" };
  const lbl  = { fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:6 };
  const sec  = { background:"#f9fafb", borderRadius:16, padding:16, marginBottom:14 };
  const row2 = { display:"flex", gap:10, marginBottom:10 };

  const techs = (users||[]).filter(u => ["technician","manager","admin"].includes(u.role));

  async function handleSave() {
    if (!form.device_model.trim() && !form.device_name.trim()) {
      alert("Vui lòng nhập tên thiết bị!"); return;
    }
    setSaving(true);
    try {
      const payload = {
        customer_name:       form.customer_name,
        customer_phone:      form.customer_phone,
        device_name:         form.device_name,
        device_model:        form.device_model,
        imei:                form.imei,
        passcode:            form.passcode,
        issue_description:   form.issue_description,
        technician_note:     form.technician_note,
        assigned_to:         form.assigned_to,
        assigned_to_name:    form.assigned_to_name,
        status:              form.status,
        priority:            form.priority,
        estimated_cost:      form.estimated_cost === "" ? null : Number(form.estimated_cost),
        final_cost:          form.final_cost === "" ? null : Number(form.final_cost),
        deposit:             form.deposit === "" ? null : Number(form.deposit),
        warranty_days:       Number(form.warranty_days) || 0,
        received_date:       form.received_date || null,
        estimated_done_date: form.estimated_done_date || null,
        done_date:           form.done_date || null,
      };
      const pbId = order._id || order.id;
      const updated = await RepairOrder.update(pbId, payload);
      // Log lịch sử chỉnh sửa đơn
      const changes = [];
      if (form.assigned_to !== order.assigned_to) changes.push(`Reassign: ${order.assigned_to_name||"??"} → ${form.assigned_to_name||"??"}`);
      if (form.status !== order.status) changes.push(`Trạng thái: ${order.status} → ${form.status}`);
      if (String(form.estimated_cost) !== String(order.estimated_cost)) changes.push(`Báo giá: ${order.estimated_cost||0} → ${form.estimated_cost}`);
      if (String(form.final_cost) !== String(order.final_cost)) changes.push(`Thanh toán: ${order.final_cost||0} → ${form.final_cost}`);
      logHistory({
        order_id:        pbId,
        order_code:      order.order_code || order.id,
        action_type:     form.assigned_to !== order.assigned_to ? "reassigned" : changes.some(c=>c.startsWith("Báo giá")||c.startsWith("Thanh toán")) ? "cost_updated" : form.status !== order.status ? "status_changed" : "other",
        action_label:    "Cập nhật đơn",
        changed_by_id:   currentUser?.id || "",
        changed_by_name: currentUser?.name || "",
        changed_by_role: currentUser?.role || "",
        old_value:       order.status || "",
        new_value:       form.status || "",
        note:            changes.join("; "),
      });
      onSave(updated);
    } catch(e) {
      // edit order error suppressed
      alert("Lỗi lưu: " + (e?.message || JSON.stringify(e)));
    }
    setSaving(false);
  }

  const STATUS_OPTS = [
    { val:"Chưa Nhận",    label:"⏳ Chưa Nhận" },
    { val:"Mới Nhận",     label:"📥 Mới Nhận" },
    { val:"Đang Sửa",     label:"🔧 Đang Sửa" },
    { val:"Chờ Linh Kiện",label:"📦 Chờ Linh Kiện" },
    { val:"Hoàn Thành",   label:"✅ Hoàn Thành" },
    { val:"Đã Giao",      label:"🏠 Đã Giao" },
    { val:"Hủy",          label:"❌ Hủy" },
  ];

  return (
    <div style={{ position:"fixed", inset:0, zIndex:3000, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"12px 0 0", overflowY:"auto" }}>
      <div style={{ background:"#fff", borderRadius:22, width:"100%", maxWidth:520, marginBottom:24, boxShadow:"0 24px 64px rgba(0,0,0,.3)" }}>
        {/* Header */}
        <div style={{ position:"sticky", top:0, background:"#7c3aed", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", borderRadius:"22px 22px 0 0", zIndex:1 }}>
          <div>
            <div style={{ color:"#fff", fontWeight:800, fontSize:17 }}>✏️ Sửa đơn #{order.order_code||order.id}</div>
            <div style={{ color:"rgba(255,255,255,.7)", fontSize:12, marginTop:2 }}>{order.device_model} — {order.customer_name}</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:36, height:36, borderRadius:"50%", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>

        <div style={{ padding:"16px 16px 8px" }}>

          {/* ── KHÁCH HÀNG ── */}
          <div style={{ ...sec, background:"#f0f9ff" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#0369a1", marginBottom:10 }}>👤 Khách Hàng</div>
            <div style={row2}>
              <div style={{ flex:2 }}>
                <label style={lbl}>Tên khách</label>
                <input value={form.customer_name} onChange={e => set("customer_name", e.target.value)} style={inp} placeholder="Nguyễn Văn A" />
              </div>
              <div style={{ flex:1 }}>
                <label style={lbl}>Số điện thoại</label>
                <input value={form.customer_phone} onChange={e => set("customer_phone", e.target.value)} inputMode="tel" style={inp} placeholder="09xx..." />
              </div>
            </div>
          </div>

          {/* ── THIẾT BỊ ── */}
          <div style={sec}>
            <div style={{ fontWeight:800, fontSize:14, color:"#3730a3", marginBottom:10 }}>📱 Thiết Bị</div>
            <div style={row2}>
              <div style={{ flex:2 }}>
                <label style={lbl}>Hãng / Tên máy</label>
                <input value={form.device_name} onChange={e => set("device_name", e.target.value)} style={inp} placeholder="iPhone, Samsung..." />
              </div>
              <div style={{ flex:2 }}>
                <label style={lbl}>Model *</label>
                <input value={form.device_model} onChange={e => set("device_model", e.target.value)} style={inp} placeholder="iPhone 14 Pro..." />
              </div>
              <div style={{ width:80 }}>
                <label style={lbl}>🔑 PIN</label>
                <input value={form.passcode} onChange={e => set("passcode", e.target.value)} maxLength={8}
                  style={{ ...inp, width:"100%", textAlign:"center", letterSpacing:3, fontWeight:700 }} />
              </div>
            </div>
            <label style={lbl}>IMEI / Serial</label>
            <input value={form.imei} onChange={e => set("imei", e.target.value)} inputMode="numeric"
              style={{ ...inp, marginBottom:10 }} placeholder="15 số IMEI hoặc Serial" />
            <label style={lbl}>Lỗi khách báo</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
              {ISSUES_LIST.map(issue => (
                <button key={issue} onClick={() => toggleIssue(issue)} type="button"
                  style={{ padding:"8px 14px", borderRadius:20, border:"1.5px solid",
                    borderColor: form.issues.includes(issue)?"#4f46e5":"#e5e7eb",
                    background:  form.issues.includes(issue)?"#eef2ff":"#fff",
                    color:       form.issues.includes(issue)?"#4f46e5":"#6b7280",
                    fontWeight:700, fontSize:13, cursor:"pointer" }}>
                  {form.issues.includes(issue) ? "✓ " : ""}{issue}
                </button>
              ))}
            </div>
            <label style={lbl}>Ghi chú kỹ thuật</label>
            <textarea value={form.technician_note} onChange={e => set("technician_note", e.target.value)} rows={3}
              style={{ ...inp, height:"auto", padding:"10px 14px", resize:"vertical" }} placeholder="Tình trạng máy, phụ kiện kèm theo..." />
          </div>

          {/* ── PHÂN CÔNG & TRẠNG THÁI — ẩn với tiếp tân ── */}
          {(currentUser?.role !== "receptionist") && (
          <div style={{ ...sec, background:"#fdf4ff" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#7c3aed", marginBottom:10 }}>🧑‍🔧 Phân công & Trạng thái</div>
            <div style={row2}>
              <div style={{ flex:1 }}>
                <label style={lbl}>Kỹ thuật viên</label>
                <select value={form.assigned_to} onChange={e => {
                  const u = techs.find(t => t.id === e.target.value);
                  set("assigned_to", e.target.value);
                  set("assigned_to_name", u ? (u.full_name||u.name||"") : "");
                }} style={inp}>
                  <option value="">-- Chưa phân công --</option>
                  {techs.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name||u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div style={{ flex:1 }}>
                <label style={lbl}>Trạng thái</label>
                <select value={form.status} onChange={e => set("status", e.target.value)} style={inp}>
                  {STATUS_OPTS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <label style={lbl}>Ưu tiên</label>
            <select value={form.priority} onChange={e => set("priority", e.target.value)} style={inp}>
              <option value="Thuong">⚪ Bình thường</option>
              <option value="Gap">🔴 Khẩn cấp</option>
              <option value="VIP">⭐ VIP</option>
            </select>
          </div>

          )}
          {/* ── THỜI GIAN ── */}
          <div style={{ ...sec, background:"#fff7ed" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#c2410c", marginBottom:10 }}>📅 Thời Gian</div>
            <div style={row2}>
              <div style={{ flex:1 }}>
                <label style={lbl}>Ngày nhận</label>
                <input type="datetime-local" value={form.received_date} onChange={e => set("received_date", e.target.value)} style={inp} />
              </div>
              <div style={{ flex:1 }}>
                <label style={lbl}>Dự kiến xong</label>
                <input type="datetime-local" value={form.estimated_done_date} onChange={e => set("estimated_done_date", e.target.value)} style={inp} />
              </div>
            </div>
            <label style={lbl}>Ngày hoàn thành thực tế</label>
            <input type="datetime-local" value={form.done_date} onChange={e => set("done_date", e.target.value)} style={inp} />
          </div>

          {/* ── CHI PHÍ ── */}
          <div style={{ ...sec, background:"#f0fdf4" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#059669", marginBottom:10 }}>💰 Chi Phí</div>
            <div style={row2}>
              <div style={{ flex:1 }}>
                <label style={lbl}>Dự kiến</label>
                <input value={form.estimated_cost} onChange={e => set("estimated_cost", e.target.value)} type="number" inputMode="numeric" style={inp} placeholder="0" />
              </div>
              <div style={{ flex:1 }}>
                <label style={lbl}>Thực tế</label>
                <input value={form.final_cost} onChange={e => set("final_cost", e.target.value)} type="number" inputMode="numeric" style={inp} placeholder="0" />
              </div>
              <div style={{ flex:1 }}>
                <label style={lbl}>Đặt cọc</label>
                <input value={form.deposit} onChange={e => set("deposit", e.target.value)} type="number" inputMode="numeric" style={inp} placeholder="0" />
              </div>
            </div>
            <label style={lbl}>Bảo hành (ngày)</label>
            <input value={form.warranty_days} onChange={e => set("warranty_days", e.target.value)} type="number" min={0} inputMode="numeric" style={inp} />
          </div>

        </div>

        {/* Footer */}
        <div style={{ position:"sticky", bottom:0, background:"#fff", padding:"12px 16px 20px", borderTop:"1px solid #f3f4f6", display:"flex", gap:10 }}>
          <button onClick={onClose} type="button" style={{ flex:1, height:50, borderRadius:14, border:"1.5px solid #e5e7eb", background:"#fff", color:"#6b7280", fontWeight:700, fontSize:15, cursor:"pointer" }}>Hủy</button>
          <button onClick={handleSave} disabled={saving} type="button"
            style={{ flex:2, height:50, borderRadius:14, border:"none", background:saving?"#a5b4fc":"#7c3aed", color:"#fff", fontWeight:800, fontSize:16, cursor:saving?"not-allowed":"pointer" }}>
            {saving ? "⏳ Đang lưu..." : "💾 Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}


export { OrderDrawer };


// ══════════════════════════════════════════════
//  SHARE ORDER MODAL
// ══════════════════════════════════════════════
const PUBLIC_URL = "https://hk-app-copy-4cefbb7c.base44.app/OrderPublic";

// Inline QR loader — không phụ thuộc module scope của QRComponents
let _shareQrLoaded = false, _shareQrCbs = [];
function loadShareQR(cb) {
  if (_shareQrLoaded && window.QRCode) { cb(); return; }
  _shareQrCbs.push(cb);
  if (_shareQrCbs.length > 1) return;
  const tryLoad = (url) => {
    const s = document.createElement("script");
    s.src = url;
    s.onload = () => { _shareQrLoaded = true; _shareQrCbs.forEach(f => f()); _shareQrCbs = []; };
    s.onerror = url.includes("cloudflare") ? () => tryLoad("https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs@master/qrcode.min.js") : () => { _shareQrCbs = []; };
    document.head.appendChild(s);
  };
  tryLoad("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js");
}

function ShareOrderModal({ order, onClose }) {
  const [qrReady, setQrReady] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [shopInfo, setShopInfo] = React.useState({ name:"", phone:"", address:"" });
  const qrRef = React.useRef(null);
  const code = order.order_code || order.id;
  const link = `${PUBLIC_URL}?code=${encodeURIComponent(code)}`;

  // Load shop info từ AppSettings
  React.useEffect(() => {
    Promise.all([
      pbSettings.get("shop_name"),
      pbSettings.get("shop_phone"),
      pbSettings.get("shop_address"),
    ]).then(([name, phone, address]) => {
      setShopInfo({ name: name||"", phone: phone||"", address: address||"" });
    }).catch(() => {});
  }, []);

  // Load QR
  React.useEffect(() => {
    loadShareQR(() => {
      setTimeout(() => {
        if (qrRef.current && window.QRCode) {
          qrRef.current.innerHTML = "";
          try {
            new window.QRCode(qrRef.current, {
              text: link, width: 200, height: 200,
              colorDark:"#1e1b4b", colorLight:"#ffffff",
              correctLevel: window.QRCode.CorrectLevel.M,
            });
            setQrReady(true);
          } catch(e) { setQrReady(false); }
        }
      }, 150);
    });
  }, [link]);

  function copyLink() {
    const fallback = () => {
      const t = document.createElement("textarea"); t.value = link;
      document.body.appendChild(t); t.select(); document.execCommand("copy");
      document.body.removeChild(t);
    };
    (navigator.clipboard?.writeText(link) || Promise.reject()).then(() => {}).catch(fallback);
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }

  function shareViaWeb() {
    if (navigator.share) {
      navigator.share({
        title: `Theo dõi đơn sửa chữa #${code}`,
        text: `${shopInfo.name ? shopInfo.name + " — " : ""}Xem tiến độ sửa máy của bạn`,
        url: link,
      }).catch(() => copyLink());
    } else { copyLink(); }
  }

  const MI2 = ({ name, style }) => (
    <span className="material-icons" style={{ fontFamily:"Material Icons", userSelect:"none", lineHeight:1, verticalAlign:"middle", ...style }}>{name}</span>
  );

  return (
    <div style={{ position:"fixed", inset:0, zIndex:6000, background:"rgba(0,0,0,.65)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:24, width:"100%", maxWidth:380, overflow:"hidden", boxShadow:"0 24px 64px rgba(0,0,0,.35)" }}>

        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#1e1b4b,#4338ca)", padding:"18px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ color:"#fff", fontWeight:800, fontSize:16, display:"flex", alignItems:"center", gap:6 }}>
              <MI2 name="share" style={{ fontSize:20, color:"#fff" }} /> Chia sẻ với khách
            </div>
            <div style={{ color:"rgba(255,255,255,.7)", fontSize:12, marginTop:2 }}>Đơn #{code}</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:34, height:34, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <MI2 name="close" style={{ fontSize:20, color:"#fff" }} />
          </button>
        </div>

        <div style={{ padding:"20px 20px 24px" }}>
          {/* QR Code */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:18 }}>
            <div style={{ padding:12, background:"#f8fafc", borderRadius:16, border:"2px solid #e5e7eb", display:"inline-block", minWidth:224, minHeight:224, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div ref={qrRef} />
              {!qrReady && (
                <div style={{ width:200, height:200, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, color:"#9ca3af" }}>
                  <MI2 name="qr_code_2" style={{ fontSize:48, color:"#c4b5fd" }} />
                  <div style={{ fontSize:12 }}>Đang tạo QR...</div>
                </div>
              )}
            </div>
            <div style={{ fontSize:12, color:"#6b7280", marginTop:8, textAlign:"center" }}>Khách quét QR để tự xem tiến độ</div>
          </div>

          {/* Thông tin cửa hàng */}
          {(shopInfo.name || shopInfo.phone) && (
            <div style={{ background:"#f0f9ff", borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"flex-start", gap:10 }}>
              <MI2 name="store" style={{ fontSize:18, color:"#0369a1", marginTop:1, flexShrink:0 }} />
              <div>
                {shopInfo.name && <div style={{ fontWeight:700, fontSize:13, color:"#0c4a6e" }}>{shopInfo.name}</div>}
                {shopInfo.phone && <div style={{ fontSize:12, color:"#0369a1", marginTop:2 }}>📞 {shopInfo.phone}</div>}
                {shopInfo.address && <div style={{ fontSize:11, color:"#6b7280", marginTop:1 }}>📍 {shopInfo.address}</div>}
              </div>
            </div>
          )}

          {/* Link */}
          <div style={{ background:"#f1f5f9", borderRadius:12, padding:"10px 12px", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
            <MI2 name="link" style={{ fontSize:16, color:"#818cf8", flexShrink:0 }} />
            <div style={{ flex:1, fontSize:11, color:"#475569", wordBreak:"break-all", lineHeight:"1.5" }}>{link}</div>
          </div>

          {/* Buttons */}
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={copyLink} style={{ flex:1, height:46, borderRadius:12, border:"1.5px solid #818cf8", background:"#fff", color:"#4f46e5", fontWeight:700, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <MI2 name={copied ? "check_circle" : "content_copy"} style={{ fontSize:18, color: copied?"#059669":"#4f46e5" }} />
              {copied ? "Đã copy!" : "Copy link"}
            </button>
            <button onClick={shareViaWeb} style={{ flex:1, height:46, borderRadius:12, border:"none", background:"#4f46e5", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <MI2 name="ios_share" style={{ fontSize:18, color:"#fff" }} />
              Chia sẻ
            </button>
          </div>

          <div style={{ fontSize:11, color:"#9ca3af", textAlign:"center", marginTop:12 }}>
            Khách không cần tài khoản để xem tiến độ
          </div>
        </div>
      </div>
    </div>
  );
}


export default OrderDrawer;