/**
 * IntegrationsPage.jsx
 * Quản lý các tích hợp: Print Agent, VietQR, Zalo OA, Haravan
 * @version 2026-05-29-v1
 */
import React, { useState, useEffect } from "react";
import { AppSettings, logAction } from "./pb.jsx";

// ── Helpers ─────────────────────────────────────────────────
async function loadSettings() {
  try {
    const rows = await AppSettings.list({ limit: 200 });
    const map = {};
    (rows || []).forEach(r => { map[r.key] = r.value; });
    return map;
  } catch { return {}; }
}

async function saveSetting(key, value) {
  try {
    const rows = await AppSettings.filter({ key });
    if (rows && rows.length > 0) {
      await AppSettings.update(rows[0].id, { value: String(value) });
    } else {
      await AppSettings.create({ key, value: String(value) });
    }
  } catch (e) { console.error("saveSetting error:", e); throw e; }
}

// ── Card wrapper ─────────────────────────────────────────────
function IntCard({ icon, title, connected, children }) {
  return (
    <div style={{
      background:"#fff", borderRadius:20, padding:"18px 16px",
      marginBottom:16, border:"1.5px solid #e5e7eb",
      boxShadow:"0 2px 12px rgba(0,0,0,.05)",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <span style={{ fontSize:22 }}>{icon}</span>
        <div style={{ flex:1, fontWeight:800, fontSize:15, color:"#1e1b4b" }}>{title}</div>
        {connected === true  && <span style={{ background:"#dcfce7", color:"#065f46", borderRadius:99, padding:"2px 10px", fontSize:11, fontWeight:700 }}>🟢 Đã cài</span>}
        {connected === false && <span style={{ background:"#fee2e2", color:"#dc2626", borderRadius:99, padding:"2px 10px", fontSize:11, fontWeight:700 }}>🔴 Lỗi kết nối</span>}
        {connected === null  && <span style={{ background:"#f3f4f6", color:"#6b7280", borderRadius:99, padding:"2px 10px", fontSize:11, fontWeight:700 }}>⚪ Chưa cài</span>}
      </div>
      {children}
    </div>
  );
}

// ── Field row ────────────────────────────────────────────────
function Field({ label, value, onChange, type="text", placeholder="" }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width:"100%", height:42, borderRadius:10, border:"1.5px solid #e5e7eb",
          padding:"0 12px", fontSize:14, outline:"none", boxSizing:"border-box", background:"#fafafa" }}
      />
    </div>
  );
}

// ── Buttons ──────────────────────────────────────────────────
function SaveBtn({ loading, onClick, label="💾 Lưu" }) {
  return (
    <button disabled={loading} onClick={onClick}
      style={{ height:40, padding:"0 18px", background: loading?"#c7d2fe":"#4f46e5",
        color:"#fff", border:"none", borderRadius:10, fontWeight:800, fontSize:13, cursor:"pointer" }}>
      {loading ? "Đang lưu..." : label}
    </button>
  );
}
function TestBtn({ loading, onClick, label="🔌 Test" }) {
  return (
    <button disabled={loading} onClick={onClick}
      style={{ height:40, padding:"0 18px", background:"#f3f4f6", color:"#374151",
        border:"1.5px solid #e5e7eb", borderRadius:10, fontWeight:800, fontSize:13, cursor:"pointer" }}>
      {loading ? "⏳ Đang test..." : label}
    </button>
  );
}

// ════════════════════════════════════════════════════════════
// Block 1 — Print Agent
// ════════════════════════════════════════════════════════════
function PrintAgentBlock({ settings, onToast }) {
  const [server,  setServer]  = useState(settings["print_agent_server"]  || "http://localhost:7979");
  const [token,   setToken]   = useState(settings["print_agent_token"]   || "");
  const [saving,  setSaving]  = useState(false);
  const [testing, setTesting] = useState(false);
  const [conn,    setConn]    = useState(null);

  async function save() {
    setSaving(true);
    try {
      await saveSetting("print_agent_server", server);
      await saveSetting("print_agent_token",  token);
      onToast("✅ Đã lưu cài đặt Print Agent");
      setConn(null);
    } catch { onToast("❌ Lỗi lưu"); }
    setSaving(false);
  }

  async function test() {
    setTesting(true);
    try {
      const headers = token ? { Authorization: "Bearer " + token } : {};
      const r = await fetch(server + "/ping", { headers });
      if (r.ok) { setConn(true); onToast("✅ Kết nối Print Agent thành công"); }
      else { setConn(false); onToast("❌ Lỗi " + r.status); }
    } catch(e) { setConn(false); onToast("❌ Không kết nối được: " + e.message); }
    setTesting(false);
  }

  return (
    <IntCard icon="🖨️" title="Print Agent — Máy in nhiệt" connected={conn}>
      <Field label="Server URL" value={server} onChange={setServer}
        placeholder="http://localhost:7979" />
      <Field label="Token xác thực (tuỳ chọn)" value={token} onChange={setToken}
        type="password" placeholder="Bearer token nếu có..." />
      <div style={{ display:"flex", gap:8, marginTop:4 }}>
        <SaveBtn loading={saving} onClick={save} />
        <TestBtn loading={testing} onClick={test} />
      </div>
    </IntCard>
  );
}

// ════════════════════════════════════════════════════════════
// Block 2 — VietQR
// ════════════════════════════════════════════════════════════
function VietQRBlock({ settings, onToast }) {
  const [bankCode,   setBankCode]   = useState(settings["vietqr_bank_code"]   || "");
  const [accountNo,  setAccountNo]  = useState(settings["vietqr_account_no"]  || "");
  const [accountName,setAccountName]= useState(settings["vietqr_account_name"]|| "");
  const [saving, setSaving] = useState(false);

  const isSet = !!(bankCode && accountNo);

  async function save() {
    setSaving(true);
    try {
      await saveSetting("vietqr_bank_code",    bankCode);
      await saveSetting("vietqr_account_no",   accountNo);
      await saveSetting("vietqr_account_name", accountName);
      onToast("✅ Đã lưu VietQR");
    } catch { onToast("❌ Lỗi lưu"); }
    setSaving(false);
  }

  return (
    <IntCard icon="🏦" title="VietQR — Thanh toán QR" connected={isSet ? true : null}>
      <Field label="Mã ngân hàng (BIN/BIC)" value={bankCode} onChange={setBankCode}
        placeholder="VD: VCB, TCB, MB, ACB..." />
      <Field label="Số tài khoản" value={accountNo} onChange={setAccountNo}
        placeholder="0123456789..." />
      <Field label="Tên chủ tài khoản" value={accountName} onChange={setAccountName}
        placeholder="NGUYEN VAN A..." />
      <div style={{ marginTop:4 }}>
        <SaveBtn loading={saving} onClick={save} />
      </div>
      {isSet && (
        <div style={{ marginTop:12, background:"#f0fdf4", borderRadius:10, padding:"10px 12px" }}>
          <div style={{ fontSize:12, color:"#065f46", fontWeight:700 }}>
            QR hiện tại: {bankCode} · {accountNo}
          </div>
        </div>
      )}
    </IntCard>
  );
}

// ════════════════════════════════════════════════════════════
// Block 3 — Zalo OA
// ════════════════════════════════════════════════════════════
function ZaloBlock({ settings, onToast }) {
  const [oaId,        setOaId]        = useState(settings["zalo_oa_id"]                  || "");
  const [token,       setToken]       = useState(settings["zalo_access_token"]            || "");
  const [tplReceived, setTplReceived] = useState(settings["zalo_template_id_received"]    || "");
  const [tplDone,     setTplDone]     = useState(settings["zalo_template_id_done"]        || "");
  const [saving,  setSaving]  = useState(false);
  const [showTest,setShowTest]= useState(false);
  const [testSdt, setTestSdt] = useState("");
  const [testing, setTesting] = useState(false);

  const isSet = !!(oaId && token);

  async function save() {
    setSaving(true);
    try {
      await saveSetting("zalo_oa_id",                oaId);
      await saveSetting("zalo_access_token",         token);
      await saveSetting("zalo_template_id_received", tplReceived);
      await saveSetting("zalo_template_id_done",     tplDone);
      onToast("✅ Đã lưu cài đặt Zalo OA");
    } catch { onToast("❌ Lỗi lưu"); }
    setSaving(false);
  }

  async function sendTest() {
    if (!testSdt || testSdt.length !== 10) { onToast("SĐT không hợp lệ (10 số)"); return; }
    setTesting(true);
    try {
      const r = await fetch("https://business.openapi.zalo.me/message/template", {
        method: "POST",
        headers: { access_token: token, "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: testSdt,
          template_id: tplReceived,
          template_data: { order_code:"TEST-001", customer_name:"Khách Test", device_model:"iPhone Test" },
        }),
      });
      const j = await r.json();
      onToast(j.error === 0 ? "✅ Gửi Zalo thành công" : "❌ Lỗi: " + (j.message || JSON.stringify(j)));
    } catch(e) { onToast("❌ " + e.message); }
    setTesting(false);
  }

  return (
    <IntCard icon="📲" title="Zalo OA — ZNS" connected={isSet ? true : null}>
      <Field label="OA ID"        value={oaId}        onChange={setOaId}        placeholder="OA ID..." />
      <Field label="Access Token" value={token}        onChange={setToken}        type="password" placeholder="Token..." />
      <Field label="Template ID — Đã nhận máy" value={tplReceived} onChange={setTplReceived} placeholder="template_id..." />
      <Field label="Template ID — Máy xong, lấy được" value={tplDone} onChange={setTplDone} placeholder="template_id..." />
      <div style={{ display:"flex", gap:8, marginTop:4, flexWrap:"wrap" }}>
        <SaveBtn loading={saving} onClick={save} />
        <button onClick={() => setShowTest(v => !v)}
          style={{ height:40, padding:"0 16px", background:"#f3f4f6", color:"#374151",
            border:"1.5px solid #e5e7eb", borderRadius:10, fontWeight:800, fontSize:13, cursor:"pointer" }}>
          🧪 Gửi test
        </button>
      </div>

      {showTest && (
        <div style={{ marginTop:12, background:"#f9fafb", borderRadius:12, padding:14 }}>
          <label style={{ fontSize:12, fontWeight:700, color:"#374151", display:"block", marginBottom:6 }}>SĐT nhận test (10 số)</label>
          <div style={{ display:"flex", gap:8 }}>
            <input type="tel" value={testSdt} onChange={e => setTestSdt(e.target.value)}
              placeholder="0901234567" maxLength={10}
              style={{ flex:1, height:40, borderRadius:10, border:"1.5px solid #e5e7eb", padding:"0 12px", fontSize:14, outline:"none" }}
            />
            <button disabled={testing} onClick={sendTest}
              style={{ height:40, padding:"0 16px", background:"#22c55e", color:"#fff",
                border:"none", borderRadius:10, fontWeight:800, fontSize:13, cursor:"pointer" }}>
              {testing ? "⏳" : "Gửi"}
            </button>
          </div>
        </div>
      )}
    </IntCard>
  );
}

// ════════════════════════════════════════════════════════════
// Block 4 — Haravan
// ════════════════════════════════════════════════════════════
function HaravanBlock({ settings, onToast }) {
  const [apiKey,  setApiKey]  = useState(settings["haravan_api_key"]       || "");
  const [shopId,  setShopId]  = useState(settings["haravan_shop_id"]       || "");
  const [whId,    setWhId]    = useState(settings["haravan_warehouse_id"]  || "");
  const [saving,  setSaving]  = useState(false);
  const [testing, setTesting] = useState(false);
  const [conn,    setConn]    = useState(null);

  async function save() {
    setSaving(true);
    try {
      await saveSetting("haravan_api_key",      apiKey);
      await saveSetting("haravan_shop_id",      shopId);
      await saveSetting("haravan_warehouse_id", whId);
      onToast("✅ Đã lưu cài đặt Haravan");
      setConn(null);
    } catch { onToast("❌ Lỗi lưu"); }
    setSaving(false);
  }

  async function test() {
    setTesting(true);
    try {
      const r = await fetch("https://apis.haravan.com/com/ping", {
        headers: { Authorization: "Bearer " + apiKey },
      });
      if (r.ok) { setConn(true); onToast("✅ Kết nối Haravan thành công"); }
      else { setConn(false); onToast("❌ Lỗi " + r.status + ": " + r.statusText); }
    } catch(e) { setConn(false); onToast("❌ " + e.message); }
    setTesting(false);
  }

  return (
    <IntCard icon="📦" title="Haravan — Kết nối kho" connected={conn}>
      <Field label="API Key" value={apiKey} onChange={setApiKey} type="password" placeholder="Bearer token..." />
      <Field label="Shop ID" value={shopId} onChange={setShopId} placeholder="your-shop.myharavan.com" />
      <Field label="Warehouse ID" value={whId} onChange={setWhId} placeholder="WH-001" />
      <div style={{ display:"flex", gap:8, marginTop:4 }}>
        <SaveBtn loading={saving} onClick={save} />
        <TestBtn loading={testing} onClick={test} />
      </div>
    </IntCard>
  );
}

// ════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════
export default function IntegrationsPage({ user }) {
  const [settings, setSettings] = useState(null);
  const [toast,    setToast]    = useState("");

  useEffect(() => {
    loadSettings().then(s => setSettings(s));
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  if (!settings) return (
    <div style={{ padding:40, textAlign:"center", color:"#9ca3af" }}>⏳ Đang tải...</div>
  );

  return (
    <div style={{ padding:"16px 14px 100px", maxWidth:600, margin:"0 auto" }}>
      <div style={{ fontWeight:900, fontSize:18, color:"#1e1b4b", marginBottom:4 }}>🔌 Tích hợp</div>
      <div style={{ fontSize:13, color:"#6b7280", marginBottom:20 }}>
        Kết nối các dịch vụ bên ngoài đang sử dụng thực tế
      </div>

      <PrintAgentBlock settings={settings} onToast={showToast} />
      <VietQRBlock     settings={settings} onToast={showToast} />
      <ZaloBlock       settings={settings} onToast={showToast} />
      <HaravanBlock    settings={settings} onToast={showToast} />

      {toast && (
        <div style={{
          position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
          background:"#1e1b4b", color:"#fff", borderRadius:14,
          padding:"12px 24px", fontSize:14, fontWeight:700,
          zIndex:9999, boxShadow:"0 8px 24px rgba(0,0,0,.3)",
          whiteSpace:"nowrap",
        }}>{toast}</div>
      )}
    </div>
  );
}
