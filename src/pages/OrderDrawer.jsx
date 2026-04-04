/* v1774860462-5727 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { RepairChat, Notification, Staff, RepairOrder, SparePart, SparePartUsage } from "./pb.jsx";
import { uploadFile } from "./pb.jsx";

import { QRScanModal, QRPrintModal, QRCanvas, getQRDataUrl, loadQRLib } from "./QRComponents";
import { NewOrderModal } from "./OrderForms";
import { timeAgo, genOrderId, getKpiTimerInfo, MediaViewer, AcceptChecklistModal, AcceptTimer, STATUS_COLS, STATUS_PB, STATUS_DISPLAY, PRIORITY_PB, PRIORITY_DISPLAY } from "./MediaViewer";

function OrderDrawer({ order, onClose, currentUser, onUpdate, users, onShowQR }) {
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
  const chatInputRef = useRef();
  const [toast, setToast] = useState(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistTarget, setChecklistTarget] = useState(null); // {ord, stage}
  const [editMode, setEditMode] = useState(false); // KTV phải bấm "Sửa" mới đổi trạng thái
  const [showSparePart, setShowSparePart] = useState(false);
  const [mediaViewer, setMediaViewer] = useState(null); // {items, startIndex}
  const [showEditOrder, setShowEditOrder] = useState(false);
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
    RepairChat.filter({ order_id: order.id }, { sort: "received_date" })
      .then(data => { if (!cancelled) { setChats(data); setChatLoading(false); } })
      .catch(() => { if (!cancelled) setChatLoading(false); });
    return () => { cancelled = true; };
  }, [order.id, tab]);

  // Auto-scroll
  useEffect(() => { setTimeout(() => chatRef.current?.scrollIntoView({ behavior:"smooth" }), 80); }, [chats, tab]);

  // Build mention list from users related to this order
  const getMentionCandidates = useCallback(() => {
    return users.filter(u => {
      if (u.id === currentUser.id) return false;
      if (["manager","receptionist"].includes(u.role)) return true;
      if (u.role === "warehouse") return true;
      if (u.id === order.assigned_to) return true;
      return false;
    });
  }, [users, currentUser.id, order.assigned_to]);

  function handleChatInputChange(e) {
    const val = e.target.value;
    setChatInput(val);
    // Detect @ trigger
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      const q = atMatch[1].toLowerCase();
      setMentionQuery(q);
      const filtered = getMentionCandidates().filter(u =>
        u.name.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)
      );
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
    const replaced = textBefore.replace(/@(\w*)$/, `@${u.name} `);
    const newText = replaced + textAfter;
    const newCursor = replaced.length; // vị trí sau tên + khoảng trắng
    setChatInput(newText);
    setShowMention(false);
    setPendingMentions(prev => prev.find(p => p.id===u.id) ? prev : [...prev, { id:u.id, name:u.name }]);
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
      // Send notifications to mentioned users
      if (mentioned_ids.length > 0) {
        mentioned_ids.forEach((uid, i) => {
          Notification.create({
            user_id: uid,
            user_name: mentioned_names[i] || "",
            title: `  Bạn được nhắc đến trong ${order.id}`,
            message: `${currentUser.name}: ${msgText.slice(0,80)}`,
            order_id: order.id,
            order_code: order.id,
            type:"mention",
            is_read: false,
          }).catch(() => {});
        });
      }
    } catch(err) {
      setChats(p => p.filter(m => m.id!==tempId));
      console.error("sendChat error:", err, "payload:", JSON.stringify(newMsg));
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
            console.log(`  Nén ảnh: ${(file.size/1024).toFixed(0)}KB → ${(compressed.size/1024).toFixed(0)}KB`);
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
      console.error("Upload/send error:", e);
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
        console.error("Recording error:", e);
        alert("Không thể ghi âm: " + (e.message || "Kiểm tra quyền microphone!"));
      }
    }
  }

  const cust = order.customer_name ? { full_name: order.customer_name, phone: order.customer_phone } : null;
  const assignee = users.find(u => u.id === order.assigned_to);
  const col = STATUS_COLS.find(s => s.key === order.status);
  const isKTV = currentUser.role === "technician";
  const isMyOrder = order.assigned_to === currentUser.id;

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
  function handleChecklistConfirm({ checklist, estMins, note: techNote }) {
    const ord = checklistTarget.ord;
    const stage = checklistTarget.stage;
    const k = `stage${stage}_at`;
    const estDate = new Date(Date.now() + estMins * 60000).toISOString();
    onUpdate(ord.id, {
      accept_stage: stage,
      [k]: new Date().toISOString(),
      status:"Đang Sửa",
      checklist_done: checklist,
      estimated_done: estDate,
      technician_note: techNote || ord.technician_note || "",
    }, null);
    setShowChecklist(false);
    showToast("Đã nhận máy! Bắt đầu sửa chữa.");
  }
  function handleMarkDone() {
    onUpdate(order.id, { status:"Hoàn Thành", accept_stage:3 }, { userId:order.assigned_to, delta:2, note:"Sửa xong +2 KPI" });
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
            {(currentUser.role === "manager" || currentUser.role === "admin") && (
              <>
                <button onClick={() => setShowEditOrder(true)}
                  style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", height:34, padding:"0 12px", borderRadius:20, fontSize:13, fontWeight:700, cursor:"pointer"}}>  Sửa</button>
                <button onClick={() => {
                  if (window.confirm("Xóa đơn " + order.id + "? Thao tác này không thể hoàn tác!")) {
                    RepairOrder.delete(order.id).then(() => { onClose(); onUpdate && onUpdate(); }).catch(e => alert("Lỗi xóa: " + e.message));
                  }
                }} style={{ background:"rgba(220,38,38,.7)", border:"none", color:"#fff", height:34, padding:"0 12px", borderRadius:20, fontSize:13, fontWeight:700, cursor:"pointer"}}>  Xóa</button>
              </>
            )}
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:34, height:34, borderRadius:"50%", fontSize:17, cursor:"pointer"}}> </button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid #e5e7eb" }}>
          {[["info","Thông tin"],["parts","Linh kiện"],["chat","Chat"]].map(([t,lbl]) => (
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
            <AcceptTimer order={order} currentUser={currentUser} onUpdate={onUpdate} />
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
            {/* ── Cảnh báo Quản lý: Đơn cần chuyển KTV ─────── */}
            {order.needs_reassign && currentUser.role === "manager" && !["Hoàn Thành","Đã Giao"].includes(order.status) && (
              <div style={{ background:"#fef2f2", border:"2px solid #fca5a5", borderRadius:14, padding:"14px 16px", marginBottom:14 }}>
                <div style={{ fontWeight:800, fontSize:15, color:"#dc2626", marginBottom:6 }}>  Hệ thống chuyển việc cho Quản lý</div>
                <div style={{ fontSize:13, color:"#6b7280", marginBottom:12 }}>KTV đã quá 120 phút không Nhận máy. Cần phân công lại.</div>
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>Chọn KTV mới:</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {users.filter(u => u.role==="technician" && u.id !== order.assigned_to && u.is_active!==false).map(u => (
                      <button key={u.id} onClick={() => {
                        const newAssignAt = new Date().toISOString();
                        onUpdate(order.id, {
                          assigned_to: u.id,
                          assigned_to_name: u.name,
                          assigned_at: newAssignAt,
                          accept_stage: 0,
                          stage1_at: null,
                          stage2_at: null,
                          kpi_stage1_penalized: false,
                          kpi_stage2_penalized: false,
                          needs_reassign: false,
                        }, null);
                        showToast("Đã chuyển đơn cho " + u.name);
                      }}
                        style={{ padding:"10px 14px", borderRadius:10, border:"1.5px solid #e5e7eb", background:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", textAlign:"left"}}>
                          {u.name} <span style={{ color:"#6b7280", fontWeight:400, fontSize:12 }}>(KPI: {u.kpi})</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Status + Actions — KTV cần bấm "Chỉnh" để edit */}
            {!["Hoàn Thành","Đã Giao"].includes(order.status) && (currentUser.role==="manager" || isMyOrder) && (
              <div style={{ marginBottom:14 }}>
                {/* Toggle edit mode for KTV */}
                {isKTV && !editMode && (
                  <button onClick={() => setEditMode(true)}
                    style={{ width:"100%", height:52, borderRadius:14, border:"2px solid #4f46e5", background:"#eef2ff", color:"#4f46e5", fontWeight:800, fontSize:16, cursor:"pointer", marginBottom:8 }}>
                      Cập nhật trạng thái
                  </button>
                )}
                {(!isKTV || editMode) && (
                  <>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"#374151"}}>  Chọn trạng thái:</div>
                      {isKTV && <button onClick={() => setEditMode(false)} style={{ background:"none", border:"none", color:"#9ca3af", fontSize:13, cursor:"pointer"}}>  Đóng</button>}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                      {STATUS_COLS.filter(c => c.key !== "Đã Giao").map(c => (
                        <button key={c.key} onClick={() => { if(c.key==="Hoàn Thành") handleMarkDone(); else { onUpdate(order.id,{status:c.key},null); setEditMode(false); } }}
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
              <div style={{ position:"absolute", bottom:70, left:14, right:14, background:"#fff", borderRadius:14, boxShadow:"0 8px 32px rgba(0,0,0,.18)", border:"1.5px solid #e5e7eb", zIndex:100, overflow:"hidden", maxHeight:200 }}>
                <div style={{ padding:"8px 14px", fontSize:12, color:"#6b7280", fontWeight:700, background:"#f9fafb", borderBottom:"1px solid #f3f4f6"}}>  Chọn người nhắc đến</div>
                {mentionList.map((u, idx) => (
                  <div key={u.id} onClick={() => pickMention(u)}
                    style={{ padding:"12px 14px", cursor:"pointer", background:idx===mentionCursor?"#eef2ff":"#fff", borderBottom:"1px solid #f9fafb", display:"flex", gap:10, alignItems:"center" }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", background:u.role==="manager"?"#7c3aed":u.role==="technician"?"#2563eb":"#059669", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13 }}>{(u.name||"?")[0]}</div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{u.name}</div>
                      <div style={{ fontSize:12, color:"#9ca3af" }}>{u.role==="manager"?"Quản lý":u.role==="technician"?"Kỹ thuật":u.role==="receptionist"?"Tiếp tân":"Kho"}</div>
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
        onClose={() => setShowEditOrder(false)}
        onSave={(updated) => { setShowEditOrder(false); onUpdate && onUpdate(updated.id, updated); }}
      />
    )}
    </>
  );
}


// ══════════════════════════════════════════════
//  EDIT ORDER MODAL (Manager only)
// ══════════════════════════════════════════════
function EditOrderModal({ order, users, onClose, onSave }) {
  const ISSUES_LIST = [
    "Màn hình","Pin","Sạc","Camera","Loa","Mic","Nút bấm",
    "Wifi","Bluetooth","IC","Bo mạch","Vỏ máy","Khác"
  ];

  // Đọc issues từ issue_description (string CSV) hoặc array
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
    imei:                order.imei || "",
    passcode:            order.passcode || "",
    issues:              parseIssues(order.issue_description),
    issue_description:   order.issue_description || "",
    technician_note:     order.technician_note || "",
    assigned_to:         order.assigned_to || "",
    assigned_to_name:    order.assigned_to_name || "",
    status:              order.status || "Moi Nhan",
    priority:            order.priority || "Thuong",
    estimated_cost:      order.estimated_cost || "",
    final_cost:          order.final_cost || "",
    deposit:             order.deposit || "",
    warranty_days:       order.warranty_days || 0,
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

  const inp   = { width:"100%", height:46, borderRadius:12, border:"1.5px solid #e5e7eb", padding:"0 14px", fontSize:15, outline:"none", boxSizing:"border-box" };
  const lbl   = { fontSize:13, fontWeight:700, color:"#374151", display:"block", marginBottom:6 };
  const sec   = { background:"#f9fafb", borderRadius:16, padding:16, marginBottom:14 };
  const row2  = { display:"flex", gap:10, marginBottom:10 };

  const techs = (users||[]).filter(u => u.role === "technician" || u.role === "manager");

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
      const updated = await RepairOrder.update(order.id, payload);
      onSave(updated);
    } catch(e) {
      alert("Lỗi lưu: " + (e.message || JSON.stringify(e)));
    }
    setSaving(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:3000, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:22, width:"100%", maxWidth:520, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,.3)" }}>
        {/* Header */}
        <div style={{ position:"sticky", top:0, background:"#7c3aed", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", borderRadius:"22px 22px 0 0", zIndex:1 }}>
          <div style={{ color:"#fff", fontWeight:800, fontSize:17 }}>  Sửa đơn #{order.order_code||order.id}</div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.2)", border:"none", color:"#fff", width:34, height:34, borderRadius:"50%", fontSize:16, cursor:"pointer"}}> </button>
        </div>

        <div style={{ padding:"16px 16px 8px" }}>

          {/* ── KHÁCH HÀNG ── */}
          <div style={{ ...sec, background:"#f0f9ff" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#0369a1", marginBottom:10 }}>  Khách Hàng</div>
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
            <div style={{ fontWeight:800, fontSize:14, color:"#3730a3", marginBottom:10 }}>  Thiết Bị</div>
            <div style={row2}>
              <div style={{ flex:2 }}>
                <label style={lbl}>Hãng / Tên máy</label>
                <input value={form.device_name} onChange={e => set("device_name", e.target.value)} style={inp} placeholder="iPhone, Samsung..." />
              </div>
              <div style={{ flex:2 }}>
                <label style={lbl}>Model *</label>
                <input value={form.device_model} onChange={e => set("device_model", e.target.value)} style={inp} placeholder="iPhone 14 Pro..."/>
              </div>
              <div style={{ width:80 }}>
                <label style={lbl}>  PIN</label>
                <input value={form.passcode} onChange={e => set("passcode", e.target.value)} maxLength={8}
                  style={{ ...inp, textAlign:"center", letterSpacing:3, fontWeight:700 }} />
              </div>
            </div>
            <label style={lbl}>IMEI / Serial</label>
            <input value={form.imei} onChange={e => set("imei", e.target.value)} inputMode="numeric"
              style={{ ...inp, marginBottom:10 }} placeholder="15 số IMEI hoặc Serial" />
            <label style={lbl}>Lỗi khách báo</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
              {ISSUES_LIST.map(issue => (
                <button key={issue} onClick={() => toggleIssue(issue)}
                  style={{ padding:"8px 14px", borderRadius:20, border:"1.5px solid",
                    borderColor: form.issues.includes(issue)?"#4f46e5":"#e5e7eb",
                    background:  form.issues.includes(issue)?"#eef2ff":"#fff",
                    color:       form.issues.includes(issue)?"#4f46e5":"#6b7280",
                    fontWeight:700, fontSize:13, cursor:"pointer" }}>
                  {form.issues.includes(issue) ? "check" : ""}{issue}
                </button>
              ))}
            </div>
            <label style={lbl}>Ghi chú thêm</label>
            <textarea value={form.technician_note} onChange={e => set("technician_note", e.target.value)} rows={2}
              style={{ ...inp, height:"auto", padding:"10px 14px", resize:"vertical" }} placeholder="Tình trạng máy, phụ kiện kèm theo..." />
          </div>

          {/* ── PHÂN CÔNG & TRẠNG THÁI ── */}
          <div style={{ ...sec, background:"#fdf4ff" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#7c3aed", marginBottom:10 }}>  Phân công & Trạng thái</div>
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
                  <option value="Moi Nhan">  Mới Nhận</option>
                  <option value="Dang Kiem Tra">  Đang Kiểm Tra</option>
                  <option value="Dang Sua">  Đang Sửa</option>
                  <option value="Cho Linh Kien">⏳ Chờ Linh Kiện</option>
                  <option value="Hoan Thanh">  Hoàn Thành</option>
                  <option value="Da Giao">  Đã Giao</option>
                  <option value="Huy">  Hủy</option>
                </select>
              </div>
            </div>
            <label style={lbl}>Ưu tiên</label>
            <select value={form.priority} onChange={e => set("priority", e.target.value)} style={inp}>
              <option value="Thuong">  Bình thường</option>
              <option value="Gap">  Khẩn cấp</option>
              <option value="VIP">⭐ VIP</option>
            </select>
          </div>

          {/* ── THỜI GIAN ── */}
          <div style={{ ...sec, background:"#fff7ed" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#c2410c", marginBottom:10 }}>  Thời Gian</div>
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
            <input type="datetime-local" value={form.done_date} onChange={e => set("done_date", e.target.value)} style={{ ...inp }} />
          </div>

          {/* ── CHI PHÍ ── */}
          <div style={{ ...sec, background:"#f0fdf4" }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#059669", marginBottom:10 }}>  Chi Phí</div>
            <div style={row2}>
              <div style={{ flex:1 }}>
                <label style={lbl}>Dự kiến</label>
                <input value={form.estimated_cost} onChange={e => set("estimated_cost", e.target.value)} type="number" style={inp} placeholder="0" />
              </div>
              <div style={{ flex:1 }}>
                <label style={lbl}>Thực tế</label>
                <input value={form.final_cost} onChange={e => set("final_cost", e.target.value)} type="number" style={inp} placeholder="0" />
              </div>
              <div style={{ flex:1 }}>
                <label style={lbl}>Đặt cọc</label>
                <input value={form.deposit} onChange={e => set("deposit", e.target.value)} type="number" style={inp} placeholder="0" />
              </div>
            </div>
            <label style={lbl}>Bảo hành (ngày)</label>
            <input value={form.warranty_days} onChange={e => set("warranty_days", e.target.value)} type="number" min={0} style={inp} />
          </div>

        </div>

        {/* Footer */}
        <div style={{ position:"sticky", bottom:0, background:"#fff", padding:"12px 16px 20px", borderTop:"1px solid #f3f4f6", display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, height:48, borderRadius:14, border:"1.5px solid #e5e7eb", background:"#fff", color:"#6b7280", fontWeight:700, fontSize:15, cursor:"pointer" }}>Hủy</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex:2, height:48, borderRadius:14, border:"none", background:saving?"#a5b4fc":"#7c3aed", color:"#fff", fontWeight:800, fontSize:15, cursor:saving?"not-allowed":"pointer" }}>
            {saving ? "⏳ Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  NEW ORDER MODAL
//  Logic QR:
//  - Quét QR → tìm đơn cũ theo qr_code
//    → Có: hiện thông tin cũ, hỏi tạo đơn mới
//    → Không: ghi nhận mã QR đó vào đơn mới
// ══════════════════════════════════════════════

export { OrderDrawer };

export default OrderDrawer;
