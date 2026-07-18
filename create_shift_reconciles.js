const PB_URL = "https://pb.hk1touch.online";
const PB_ADMIN = "goodshop3105@gmail.com";
const PB_PASS = "admin123";

async function main() {
  // Login as admin (PocketBase 0.23+)
  const loginRes = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: PB_ADMIN, password: PB_PASS }),
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  if (!token) { console.log("Login failed:", JSON.stringify(loginData)); return; }

  // Create collection
  const schema = {
    name: "shift_reconciles",
    type: "base",
    schema: [
      { name: "reconcile_date", type: "text", required: true },
      { name: "sys_cash", type: "number", required: false },
      { name: "sys_bank", type: "number", required: false },
      { name: "actual_cash", type: "number", required: false },
      { name: "actual_bank", type: "number", required: false },
      { name: "cash_diff", type: "number", required: false },
      { name: "bank_diff", type: "number", required: false },
      { name: "total_revenue", type: "number", required: false },
      { name: "total_expense", type: "number", required: false },
      { name: "profit", type: "number", required: false },
      { name: "status", type: "text", required: false },
      { name: "cashier_id", type: "text", required: false },
      { name: "cashier_name", type: "text", required: false },
      { name: "confirmed_by_id", type: "text", required: false },
      { name: "confirmed_by_name", type: "text", required: false },
      { name: "confirmed_at", type: "date", required: false },
      { name: "note", type: "text", required: false },
    ],
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
  };

  const res = await fetch(`${PB_URL}/api/collections`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": token },
    body: JSON.stringify(schema),
  });
  const data = await res.json();
  if (res.ok) console.log("✅ Collection created:", data.name);
  else console.log("Response:", JSON.stringify(data));
}
main();
