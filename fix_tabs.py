# -*- coding: utf-8 -*-
p = 'src/pages/RevenueReportPage.jsx'
s = open(p, encoding='utf-8', errors='replace').read()

# 1) bo 3 tab khoi DETAIL_TABS
old1 = '''    { key:"by_ktv",       label:"👨‍🔧 KTV" },
    { key:"services",     label:"🏆 Dịch vụ" },
'''
assert s.count(old1) == 1, 'tabs'
s = s.replace(old1, '', 1)
old1b = '''    { key:"stock_report", label:"📦 LK" },
'''
assert s.count(old1b) == 1, 'tab_lk'
s = s.replace(old1b, '', 1)

# 2) bo nhanh render cua 3 tab
old2 = '''        {detailTab==="by_ktv"       && <div style={{padding:16}}><TabByKTV orders={repairOrders} period={period} inPeriod={inPeriod} DONE_STATUS={DONE_STATUS} customFrom={customFrom} customTo={customTo} /></div>}
        {detailTab==="services"     && <div style={{padding:16}}><TabServices orders={repairOrders} period={period} inPeriod={inPeriod} DONE_STATUS={DONE_STATUS} customFrom={customFrom} customTo={customTo} /></div>}
'''
assert s.count(old2) == 1, 'render1'
s = s.replace(old2, '', 1)
old2b = '''        {detailTab==="stock_report" && <div style={{padding:16}}><TabStockReport period={period} startOf={startOf} customFrom={customFrom}/></div>}
'''
assert s.count(old2b) == 1, 'render2'
s = s.replace(old2b, '', 1)

# 3) exportExcel: bo 3 nhanh tuong ung
old3 = '''    } else if (detailTab === "by_ktv") {
      sheetName = "Doanh thu KTV";
      const byKtv = {};
      periodRepair.forEach(o=>{
        const name = o.assigned_to_name||"Chưa phân công";
        if (!byKtv[name]) byKtv[name] = { count:0, revenue:0 };
        byKtv[name].count++; byKtv[name].revenue += (o.final_cost||0);
      });
      const list = Object.values(byKtv).sort((a,b)=>b.revenue-a.revenue);
      rows = [["KTV","Số đơn","Doanh thu"], ...list.map(k=>[k.name, k.count, k.revenue])];
    } else if (detailTab === "services") {
      sheetName = "Dịch vụ";
      const svcMap = {};
      periodRepair.forEach(o=>{
        const issues = (o.issue_description||"").split(/[,.\\n;、]+/).map(x=>x.trim()).filter(x=>x.length>2&&x.length<60);
        issues.forEach(svc=>{
          if (!svcMap[svc]) svcMap[svc] = { count:0, revenue:0 };
          svcMap[svc].count++; svcMap[svc].revenue += (o.final_cost||0)/Math.max(issues.length,1);
        });
      });
      const list = Object.values(svcMap).sort((a,b)=>b.count-a.count).slice(0,20);
      rows = [["Dịch vụ","Lần","Doanh thu phân bổ"], ...list.map(k=>[k.name, k.count, Math.round(k.revenue)])];
    } else if (detailTab === "top_products") {'''
assert s.count(old3) == 1, 'exp1'
s = s.replace(old3, '''    } else if (detailTab === "top_products") {''', 1)

old4 = '''    } else if (detailTab === "stock_report") {
      sheetName = "Linh kiện";
      const [imp, exp] = await Promise.all([
        StockImport.list({ limit:200, sort:"-id" }).catch(()=>[]),
        StockExportRequest.list({ limit:200, sort:"-id" }).catch(()=>[]),
      ]);
      const start = startOf(period, customFrom);
      const fi = (imp||[]).filter(i=>new Date(i.created_date||i.created)>=start);
      const fe = (exp||[]).filter(e=>new Date(e.created_date||e.created)>=start);
      rows = [["Loại","Mã phiếu","Đơn vị / KTV","Mã đơn","Tổng giá trị","Trạng thái","Ngày"],
        ...fi.map(i=>["Nhập kho", i.import_code||"", i.supplier_name||"", "", i.total_value||0, i.status||"", dVN(i.created_date||i.created)]),
        ...fe.map(e=>["Xuất kho", e.request_code||"", e.requested_by_name||"", e.order_code||"", e.total_value||0, e.status||"", dVN(e.created_date||e.created)])];
    }'''
assert s.count(old4) == 1, 'exp2'
s = s.replace(old4, '', 1)

# 4) TAB_FILE: bo 3 key
old5 = '''    repair:"don-sua", sale:"ban-le", expense:"chi-phi", by_ktv:"ktv",
    services:"dich-vu", top_products:"sp-ban-chay", pl:"lai-lo",
    cash_journal:"so-quy", stock_report:"linh-kien",'''
assert s.count(old5) == 1, 'tabfile'
s = s.replace(old5, '''    repair:"don-sua", sale:"ban-le", expense:"chi-phi",
    top_products:"sp-ban-chay", pl:"lai-lo", cash_journal:"so-quy",''', 1)

open(p, 'w', encoding='utf-8').write(s)
print('patched ok')
