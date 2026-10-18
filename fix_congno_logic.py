# -*- coding: utf-8 -*-
import io
p = 'src/pages/DebtNccPage.jsx'
s = io.open(p, encoding='utf-8', errors='replace').read()

# 1) after load(): build map tong chung tu theo phieu
old1 = '''      const pays = await DebtPayment.list({ sort:"-id", limit:500 }).catch(()=>[]);
      setPayments((pays||[]).filter(p => ids.has(p.voucher_id)));'''
assert s.count(old1) == 1, 'a1'
new1 = old1 + '''
      // Nghiệp vụ kế toán: sổ chi tiết (chứng từ thanh toán) là nguồn sự thật.
      // Số đã trả / còn nợ được TÍNH LẠI từ chứng từ, không tin field paid_amount trên phiếu (dễ bị sửa tay lệch sổ).
      const byV = {};
      (pays||[]).forEach(px => { byV[px.voucher_id] = (byV[px.voucher_id]||0) + (Number(px.amount)||0); });
      setPaidByVoucher(byV);'''
s = s.replace(old1, new1, 1)

# 2) state
old2 = "  const [payments, setPayments] = useState([]);"
assert s.count(old2) == 1, 'a2'
s = s.replace(old2, old2 + "\n  const [paidByVoucher, setPaidByVoucher] = useState({});", 1)

# 3) helper rem(v) — dùng sau khi vouchers/payments có dữ liệu
old3 = '''  // Nhóm theo NCC (party_name) — chỉ tính các phiếu chưa hủy'''
assert s.count(old3) == 1, 'a3'
s = s.replace(old3, '''  // Số còn nợ của 1 phiếu = tổng nợ − tổng chứng từ đã trả (nguồn: sổ thanh toán)
  const rem = v => Math.max(0, Number(v.total_amount||0) - (paidByVoucher[v.id]||0));

''' + old3, 1)

# 4) bySupplier: totalDebt theo rem(v) thay field remaining
old4 = 'bySupplier[key].totalDebt += Number(v.remaining || 0);'
assert s.count(old4) == 1, 'a4'
s = s.replace(old4, 'bySupplier[key].totalDebt += rem(v);', 1)

# 5) tong the: remaining theo rem(v); totalPaidEver theo chung tu
old5 = '''// "Lũy kế" = nợ CÒN phải trả (phiếu đã trả xong không tính) — khớp với danh sách NCC còn nợ
const totalDebtEver = remaining;
const totalPaidEver = vouchers.filter(v=>v.status!=="cancelled").reduce((s,v) => s + Number(v.paid_amount||0), 0);'''
assert s.count(old5) == 1, 'a5'
s = s.replace(old5, '''// "Lũy kế" = nợ CÒN phải trả (phiếu đã trả xong không tính) — khớp với danh sách NCC còn nợ
const remainingCalc = vouchers.filter(v=>v.status!=="cancelled").reduce((s,v) => s + rem(v), 0);
const totalDebtEver  = remainingCalc;
// Đã trả (lũy kế) theo SỔ CHỨNG TỪ thanh toán — không theo field trên phiếu
const totalPaidEver = Object.values(paidByVoucher).reduce((s,x) => s + Number(x||0), 0);''', 1)

# 6) openVouchers + hien thi tung phieu theo rem(v)
old6 = 'const openVouchers = s.vouchers.filter(v => (v.remaining||0) > 0).sort((a,b)=>(a.id>b.id?1:-1));'
assert s.count(old6) == 1, 'a6'
s = s.replace(old6, 'const openVouchers = s.vouchers.filter(v => rem(v) > 0).sort((a,b)=>(a.id>b.id?1:-1));', 1)
old7 = '{fmt(v.remaining)}</div>'
assert s.count(old7) == 1, 'a7'
s = s.replace(old7, '{fmt(rem(v))}</div>', 1)

# 7) PaymentModal: validation & hien thi theo rem (truyen voucher da gan _rem)
old8 = 'const [amount, setAmount] = useState(String(voucher.remaining || 0));'
assert s.count(old8) == 1, 'a8'
s = s.replace(old8, 'const vRem = voucher._rem != null ? voucher._rem : Math.max(0, Number(voucher.remaining||0));\n    const [amount, setAmount] = useState(String(vRem));', 1)
old9 = 'if (amt > (voucher.remaining || 0)) { setErr("Số tiền vượt quá số còn lại của phiếu này"); '
assert s.count(old9) == 1, 'a9'
s = s.replace(old9, 'if (amt > vRem) { setErr("Số tiền vượt quá số còn lại của phiếu này"); ', 1)
old10 = 'Còn nợ phiếu này: {fmt(voucher.remaining)}'
assert s.count(old10) == 1, 'a10'
s = s.replace(old10, 'Còn nợ phiếu này: {fmt(vRem)}', 1)

# 8) khi mo modal, gan _rem tu rem(v)
import re
m = re.search(r'setPayVoucher\(([a-z]|v)\)', s)
print('payVoucher setter usage:', s[m.start()-100:m.end()].replace('\n',' ') if m else 'not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('patched ok')
