import { useState, useMemo, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
//  初期データ
// ═══════════════════════════════════════════════════════════════
const INIT_PARTS = [];

const INIT_PURCHASES = [];

const INIT_DISPOSALS = [];

const INIT_PROCESSINGS = [];

const INIT_PRODUCTS = [];

const INIT_MADE = [];

const INIT_CONSIGNEES = [];

const INIT_CONSIGN_RECORDS = [];

const INIT_SALES = [];

const PART_CATS = [];
const INIT_CHANNELS = [];
const CH_PALETTE = ["#e8847a","#7ab5e8","#8ae8a8","#e8c87a","#b87ae8","#7ae8d8","#e87ab5","#a8e87a"];
const MIN_STOCK = {1:50,2:50,3:100,4:30,5:5,6:10,7:80,8:20,9:100,10:50};
const CONSIGN_TYPE_LABEL = { deliver:"納品", return:"返品", loss:"廃棄ロス", sale:"委託売上" };

// モジュールレベルの ID ジェネレーター（コンポーネント外 → purity ルール対象外）
let _idSeed = Date.now();
const nextId = () => ++_idSeed;
const today  = () => new Date().toISOString().slice(0,10);
const parseFraction = (str) => {
  const s = String(str).trim();
  if(s.includes("/")){ const [a,b]=s.split("/").map(Number); return b!==0?a/b:NaN; }
  if(s.endsWith("%")) return parseFloat(s)/100;
  return parseFloat(s);
};
const CONSIGN_TYPE_COL   = { deliver:"var(--accent)", return:"var(--warn)", loss:"var(--low)", sale:"var(--ok)" };

// ─── CSV / JSON データ管理ヘルパー ────────────────────────────────
const CSV_COLS = {
  parts:         { label:"部品マスター",    cols:["id","cat","name","variant","unit","hinban","minStock","type","parentId","location","currentStock","avgPrice"],      headers:["ID","カテゴリ","名前","バリアント","単位","品番","最低在庫","タイプ","親部品ID","保管場所","現在庫数","加重平均単価"],   jsonCols:[],
                   exportCols:   ["id","cat","name","variant","unit","hinban","minStock","type","parentId","location","currentStock","avgPrice"],
                   exportHeaders:["ID","カテゴリ","名前","バリアント","単位","品番","最低在庫","タイプ","親部品ID","保管場所","現在庫数","加重平均単価"] },
  purchases:     { label:"仕入記録",        cols:["id","partId","date","supplier","qty","totalPrice","unitPrice","note"],                                       headers:["ID","部品ID","日付","仕入先","部品数量","実購入額(税込)","単価(税抜)","メモ"],                          jsonCols:[] },
  disposals:     { label:"廃棄記録",        cols:["id","partId","date","qty","reason"],                                                                       headers:["ID","部品ID","日付","数量","理由"],                                                                    jsonCols:[] },
  processings:   { label:"加工記録",        cols:["id","date","inputPartId","inputQty","outputs","lossQty","note"],                                           headers:["ID","日付","母材ID","使用量","切り出し結果(JSON)","ロス量","メモ"],                                      jsonCols:["outputs"] },
  products:      { label:"作品マスター",    cols:["id","name","desc","cat","ingredients","shippingCost","laborCost","currentStock"],                          headers:["ID","名前","説明","カテゴリ","材料(JSON)","梱包送料","人件費","現在庫数"],                               jsonCols:["ingredients"] },
  made:          { label:"制作記録",        cols:["id","productId","date","qty","note"],                                                                       headers:["ID","作品ID","日付","数量","メモ"],                                                                    jsonCols:[] },
  consignees:    { label:"委託先マスター",  cols:["id","name","address","memo"],                                                                               headers:["ID","名前","住所","メモ"],                                                                             jsonCols:[] },
  consignRecords:{ label:"委託記録",        cols:["id","productId","consigneeId","date","type","qty","salePrice","feeRate","memo"],                            headers:["ID","作品ID","委託先ID","日付","種別","数量","販売価格","手数料率","メモ"],                              jsonCols:[] },
  sales:         { label:"売上記録",        cols:["id","productId","orderName","saleType","date","channel","qty","price","shippingActual","memo","feeRate","consignRecordId"], headers:["ID","作品ID","オーダー品名","種別","日付","チャネル","数量","価格","実送料","メモ","手数料率","委託記録ID"], jsonCols:[],
                   exportCols:   ["id","productId","orderName","saleType","productName","date","channel","qty","price","shippingActual","memo","feeRate","consignMemo"],
                   exportHeaders:["ID","作品ID","オーダー品名","種別","作品名","日付","チャネル","数量","価格","実送料","メモ","手数料率","委託記録メモ"] },
  channels:      { label:"チャネルマスター",cols:["id","name","feeRate","color"],                                                                              headers:["ID","名前","手数料率","カラー"],                                                                       jsonCols:[] },
  partUsages:    { label:"部品使用記録",    cols:["id","madeId","partId","date","qty","type"],                                                                 headers:["ID","制作記録ID","部品ID","日付","数量","タイプ"],                                                      jsonCols:[] },
};

const CSV_ID_COLS = new Set(["id","partId","productId","consigneeId","parentId","madeId","inputPartId","consignRecordId"]);

function csvCell(v, colName) {
  if (v == null) return "";
  // Excelが大きな整数IDを指数表記(1.77675E+12)に変換するのを防ぐため ="..." 形式で出力
  if (colName && CSV_ID_COLS.has(colName) && typeof v === "number") {
    return `="${v}"`;
  }
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function buildCSV(rows, cols, headers) {
  const lines = [headers.map(h => csvCell(h)).join(",")];
  for (const row of rows) {
    lines.push(cols.map(c => csvCell(row[c], c)).join(","));
  }
  return "\uFEFF" + lines.join("\r\n");
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseCSVText(text) {
  const t = text.replace(/^\uFEFF/, "");
  const rows = []; let row = [], cell = "", inQ = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQ) {
      if (c === '"' && t[i+1] === '"') { cell += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { cell += c; }
    } else {
      if      (c === '"')  { inQ = true; }
      else if (c === ',')  { row.push(cell); cell = ""; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ""; }
      else                 { cell += c; }
    }
  }
  if (row.length || cell) { row.push(cell); rows.push(row); }
  // 末尾の空行を除去
  while (rows.length && rows[rows.length-1].every(c=>c==="")) rows.pop();
  return rows;
}

function csvRowsToObjects(rows, colDef) {
  if (rows.length < 2) return [];
  const hdr = rows[0];
  const colIdx = colDef.cols.map(col => {
    const hi = hdr.indexOf(col);
    // ヘッダーが日本語の場合も対応
    return hi >= 0 ? hi : colDef.headers.indexOf(colDef.headers[colDef.cols.indexOf(col)]) >= 0
      ? hdr.indexOf(colDef.headers[colDef.cols.indexOf(col)])
      : -1;
  });
  return rows.slice(1).map(row => {
    const obj = {};
    colDef.cols.forEach((col, i) => {
      const idx = colIdx[i];
      let val = idx >= 0 ? (row[idx] ?? "") : "";
      if (colDef.jsonCols.includes(col)) {
        try { val = val ? JSON.parse(val) : []; } catch { val = []; }
      } else if (col === "id" || col === "partId" || col === "productId" || col === "consigneeId" || col === "parentId" || col === "madeId" || col === "inputPartId" || col === "consignRecordId") {
        // ="1776750000000" 形式（Excel指数表記対策）を剥がす
        const stripped = typeof val === "string" ? val.replace(/^="(.*)"$/, "$1") : val;
        val = stripped === "" ? undefined : Number(stripped);
      } else if (col === "qty" || col === "unitPrice" || col === "totalPrice" || col === "inputQty" || col === "lossQty" || col === "shippingCost" || col === "laborCost" || col === "price" || col === "shippingActual" || col === "feeRate" || col === "salePrice" || col === "minStock" || col === "currentStock" || col === "avgPrice") {
        val = val === "" ? undefined : Number(val);
      }
      if (val !== undefined && val !== "") obj[col] = val;
      else if (val === "") obj[col] = "";
    });
    return obj;
  });
}

// ─── ユーティリティ ───────────────────────────────────────────
const fmt      = n => Math.round(Number(n)).toLocaleString("ja-JP");
const fmtD     = n => Number(n).toFixed(1);
const fmtStock = n => parseFloat(Number(n).toFixed(2)); // 小数点以下2桁・四捨五入・末尾ゼロ除去
const pct  = (a,b) => b===0?0:Math.round((a/b)*100);

// ─── Google Drive 同期 ────────────────────────────────────────
// クライアントIDは .env.local の VITE_DRIVE_CLIENT_ID に設定してください
// （.env.local は *.local パターンで Git 管理外）
const DRIVE_CLIENT_ID = import.meta.env.VITE_DRIVE_CLIENT_ID ?? '';
const DRIVE_FILE_NAME = 'atelier-stock-data.json';
const DRIVE_SCOPE     = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_TOKEN_KEY = 'as_drive_token';

// sessionStorage にトークンをキャッシュ（約58分）
const getCachedDriveToken = () => {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRIVE_TOKEN_KEY) || 'null');
    if (d && d.exp > Date.now()) return d.tok;
    sessionStorage.removeItem(DRIVE_TOKEN_KEY);
  } catch { /* ignore */ }
  return null;
};
const setCachedDriveToken = (tok) =>
  sessionStorage.setItem(DRIVE_TOKEN_KEY, JSON.stringify({ tok, exp: Date.now() + 3500_000 }));
const clearCachedDriveToken = () => sessionStorage.removeItem(DRIVE_TOKEN_KEY);

async function driveFetch(url, token, init = {}) {
  const { headers: extraHdrs, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { Authorization: `Bearer ${token}`, ...(extraHdrs || {}) },
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Drive ${res.status}: ${t}`); }
  return res;
}

async function driveFindFile(token) {
  const q   = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and trashed=false`);
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`,
    token
  );
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

async function driveReadFile(token, fileId) {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    token
  );
  return res.json();
}

async function driveWriteFile(token, fileId, payload) {
  const body = JSON.stringify(payload);
  if (fileId) {
    await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      token,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body }
    );
    return fileId;
  }
  // 新規作成（multipart upload）
  const bd   = 'as_bnd_001';
  const meta = JSON.stringify({ name: DRIVE_FILE_NAME, mimeType: 'application/json' });
  const mp   = `--${bd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${bd}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${bd}--`;
  const res  = await driveFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    token,
    { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${bd}` }, body: mp }
  );
  const data = await res.json();
  return data.id;
}

// 母材/通常部品の加重平均単価を計算。priceAdjustmentsがあれば調整日以降の仕入のみ合算
function calcAvgPrice(partId, purchases, priceAdjustments) {
  const buys = purchases.filter(p=>p.partId===partId);
  const latestAdj = priceAdjustments
    .filter(a=>a.partId===partId)
    .sort((a,b)=>b.date.localeCompare(a.date))[0];
  if(latestAdj) {
    const newBuys = buys.filter(b=>b.date > latestAdj.date);
    const newQty = newBuys.reduce((s,p)=>s+p.qty,0);
    const newAmt = newBuys.reduce((s,p)=>s+p.qty*p.unitPrice,0);
    const totQty = latestAdj.stock + newQty;
    const totAmt = latestAdj.stock * latestAdj.avgPrice + newAmt;
    return totQty > 0 ? totAmt/totQty : latestAdj.avgPrice;
  }
  const totalQty = buys.reduce((s,p)=>s+p.qty,0);
  const totalAmt = buys.reduce((s,p)=>s+p.qty*p.unitPrice,0);
  return totalQty > 0 ? totalAmt/totalQty : 0;
}

function calcPartStock(partId, purchases, disposals, partUsages=[], processings=[], type=undefined, stockAdjustments=[], priceAdjustments=[]) {
  const disps   = disposals.filter(d=>d.partId===partId);
  const dispQty = disps.reduce((s,d)=>s+d.qty,0);
  const adjQty  = stockAdjustments.filter(a=>a.partId===partId).reduce((s,a)=>s+a.adjustQty,0);

  if(type==="material") {
    const buys    = purchases.filter(p=>p.partId===partId);
    const totalQty = buys.reduce((s,p)=>s+p.qty,0);
    const avgPrice = calcAvgPrice(partId, purchases, priceAdjustments);
    const usedInProc = processings.filter(pr=>pr.inputPartId===partId).reduce((s,pr)=>s+pr.inputQty,0);
    const supMap = new Map();
    buys.forEach(p=>supMap.set(p.supplier,p.unitPrice));
    return { stock: totalQty-usedInProc-dispQty+adjQty, avgPrice, supMap };
  }

  if(type==="part") {
    const usages  = partUsages.filter(u=>u.partId===partId);
    const usedQty = usages.reduce((s,u)=>s+u.qty,0);
    let totalOutputQty = 0;
    let totalCost = 0;
    processings.forEach(pr=>{
      const out = pr.outputs.find(o=>o.partId===partId);
      if(!out) return;
      totalOutputQty += out.qty;
      const inputAvg  = calcAvgPrice(pr.inputPartId, purchases, priceAdjustments);
      const allOutQty = pr.outputs.reduce((s,o)=>s+o.qty,0);
      const costPerUnit = allOutQty>0 ? (pr.inputQty*inputAvg)/allOutQty : 0;
      totalCost += out.qty * costPerUnit;
    });
    const avgPrice = totalOutputQty>0 ? totalCost/totalOutputQty : 0;
    return { stock: totalOutputQty-usedQty-dispQty+adjQty, avgPrice, supMap:new Map() };
  }

  const buys    = purchases.filter(p=>p.partId===partId);
  const usages  = partUsages.filter(u=>u.partId===partId);
  const totalQty = buys.reduce((s,p)=>s+p.qty,0);
  const usedQty  = usages.reduce((s,u)=>s+u.qty,0);
  const avgPrice = calcAvgPrice(partId, purchases, priceAdjustments);
  const supMap   = new Map();
  buys.forEach(p=>supMap.set(p.supplier,p.unitPrice));
  return { stock: totalQty-dispQty-usedQty+adjQty, avgPrice, supMap };
}

function calcProductCost(product, partStockMap, parts) {
  let partCost=0, packCost=0;
  const breakdown = product.ingredients.map(ing=>{
    const part = parts.find(p=>p.id===ing.partId);
    const { avgPrice } = partStockMap[ing.partId]||{avgPrice:0};
    const lineCost = avgPrice*ing.qty;
    if(part?.cat==="梱包材") packCost+=lineCost; else partCost+=lineCost;
    return { part, qty:ing.qty, unitPrice:avgPrice, lineCost };
  });
  const total = partCost+packCost+product.shippingCost+product.laborCost;
  return { breakdown, partCost, packCost, shippingCost:product.shippingCost, laborCost:product.laborCost, total };
}

// 作品の手元在庫 = 制作数 - 直販売上 - 委託納品 + 委託返品 + 棚卸調整
function calcProductStock(productId, made, sales, consignRecords, productAdjustments=[]) {
  const madeQty    = made.filter(m=>m.productId===productId).reduce((s,m)=>s+m.qty,0);
  const soldQty    = sales.filter(s=>s.productId===productId).reduce((s,sale)=>s+sale.qty,0);
  const deliverQty = consignRecords.filter(r=>r.productId===productId&&r.type==="deliver").reduce((s,r)=>s+r.qty,0);
  const returnQty  = consignRecords.filter(r=>r.productId===productId&&r.type==="return").reduce((s,r)=>s+r.qty,0);
  const adjQty     = productAdjustments.filter(a=>a.productId===productId).reduce((s,a)=>s+a.adjustQty,0);
  const hand = madeQty - soldQty - deliverQty + returnQty + adjQty;
  return { madeQty, soldQty, deliverQty, returnQty, hand };
}

// 委託先ごとの在庫 = 納品 - 委託売上 - 返品 - 廃棄ロス
function calcConsigneeStock(productId, consigneeId, records) {
  const r = records.filter(r=>r.productId===productId&&r.consigneeId===consigneeId);
  const deliver = r.filter(x=>x.type==="deliver").reduce((s,x)=>s+x.qty,0);
  const sale    = r.filter(x=>x.type==="sale").reduce((s,x)=>s+x.qty,0);
  const ret     = r.filter(x=>x.type==="return").reduce((s,x)=>s+x.qty,0);
  const loss    = r.filter(x=>x.type==="loss").reduce((s,x)=>s+x.qty,0);
  return { deliver, sale, ret, loss, stock: deliver-sale-ret-loss };
}

function calcSaleProfit(sale, productCostMap, chFeeMap={}) {
  const costInfo = productCostMap[sale.productId];
  const cost = costInfo?.total||0;
  const estimatedShipping = costInfo?.shippingCost||0;
  const revenue = sale.price*sale.qty;
  const feeRate = sale.feeRate!=null ? sale.feeRate : (chFeeMap[sale.channel]??0);
  const channelFee = Math.round(sale.price*(feeRate/100))*sale.qty;
  // 実送料が入力済みの場合のみ差額を計上。未入力(0)は想定送料をそのまま使用
  const shippingAdj = sale.shippingActual > 0
    ? ((sale.shippingActual - estimatedShipping) * sale.qty)
    : 0;
  const profit = revenue - cost*sale.qty - channelFee - shippingAdj;
  return { revenue, totalCost:cost*sale.qty, channelFee, shippingAdj, estimatedShipping, profit, profitRate:pct(profit,revenue), feeRate };
}

// ═══════════════════════════════════════════════════════════════
//  CSS
// ═══════════════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@300;400;500;700&family=DM+Serif+Display&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

/* ═══════════════════════════════════════════════
   MD3 Design Tokens — Light scheme (Terracotta)
═══════════════════════════════════════════════ */
:root{
  /* Primary */
  --md-p:  #9C4A23;
  --md-op: #FFFFFF;
  --md-pc: #FFDBC9;
  --md-opc:#380E00;
  /* Secondary */
  --md-s:  #775748;
  --md-os: #FFFFFF;
  --md-sec-c:#FFDBD1;
  --md-osec:#2C1510;
  /* Tertiary (gold) */
  --md-tc: #F8E287;
  --md-otc:#221B00;
  /* Error */
  --md-e:  #BA1A1A;
  --md-oe: #FFFFFF;
  --md-ec: #FFDAD6;
  --md-oec:#410002;
  /* Warn / OK (custom) */
  --md-wc: #FFEFC5;
  --md-ow: #7A5900;
  --md-okc:#B7F1CE;
  --md-ook:#276A3E;
  /* Surface */
  --md-bg:   #FFF8F5;
  --md-surf: #FFF8F5;
  --md-osf:  #201A17;
  --md-sv:   #F5DDD5;
  --md-osv:  #53433F;
  --md-ol:   #857370;
  --md-olv:  #D8C2BC;
  /* Surface containers */
  --md-sc0:  #FFFFFF;
  --md-sc1:  #FCF0EC;
  --md-sc2:  #F6E9E5;
  --md-sc3:  #F0E3DF;
  --md-sc4:  #EAE0DC;
  /* Elevation */
  --md-e1: 0 1px 2px rgba(0,0,0,.1),0 1px 4px rgba(0,0,0,.07);
  --md-e2: 0 2px 4px rgba(0,0,0,.12),0 2px 8px rgba(0,0,0,.08);
  --md-e3: 0 4px 8px rgba(0,0,0,.12),0 4px 16px rgba(0,0,0,.08);
  /* Shape */
  --r-xs:4px; --r-sm:8px; --r:12px; --r-lg:16px; --r-xl:28px;
  /* Legacy aliases used by inline styles in JSX */
  --bg:var(--md-bg); --sf:var(--md-sc0); --s2:var(--md-sc1);
  --bd:var(--md-olv); --tx:var(--md-osf); --t2:var(--md-osv);
  --ac:var(--md-p);  --gold:#D4A853;
  --low:var(--md-e); --low-bg:var(--md-ec);
  --warn:var(--md-ow); --warn-bg:var(--md-wc);
  --ok:var(--md-ook); --ok-bg:var(--md-okc);
  --r:var(--r); --sh:var(--md-e1);
}

body{font-family:'Zen Kaku Gothic New',sans-serif;background:var(--md-bg);color:var(--md-osf);min-height:100vh;}
.app{max-width:900px;margin:0 auto;padding:0 0 80px;}

/* ─── TOP APP BAR ─── */
.header{
  background:var(--md-p);
  padding:13px 16px 11px;
  display:flex;justify-content:space-between;align-items:center;
  position:sticky;top:0;z-index:50;
}
.h-logo{font-family:'DM Serif Display',serif;color:#fff;font-size:22px;letter-spacing:.3px;}
.h-sub{color:rgba(255,255,255,.65);font-size:11px;margin-top:1px;}
.h-mgmt-btn{
  background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);
  border-radius:var(--r-sm);color:#fff;font-size:12px;cursor:pointer;
  padding:6px 11px;font-family:inherit;display:flex;align-items:center;gap:5px;
  white-space:nowrap;flex-shrink:0;font-weight:500;transition:background .15s;
}
.h-mgmt-btn:hover{background:rgba(255,255,255,.22);}
.h-mgmt-btn.open{background:rgba(255,255,255,.28);}

/* ─── MANAGEMENT MENU ─── */
.mgmt-menu{
  position:absolute;top:calc(100% + 8px);right:0;
  background:var(--md-sc0);border:1px solid var(--md-olv);
  border-radius:var(--r-lg);box-shadow:var(--md-e3);
  z-index:150;min-width:180px;overflow:hidden;
}
.mgmt-menu-item{
  display:flex;align-items:center;gap:12px;padding:14px 18px;
  cursor:pointer;border:none;background:none;font-family:inherit;
  font-size:14px;color:var(--md-osf);width:100%;text-align:left;
  border-bottom:1px solid var(--md-olv);transition:background .1s;
}
.mgmt-menu-item:last-child{border-bottom:none;}
.mgmt-menu-item:hover{background:var(--md-sc1);}
.mgmt-menu-item:active{background:var(--md-pc);}
.mgmt-page{position:fixed;inset:0;z-index:180;background:var(--md-bg);overflow-y:auto;animation:slideInRight .2s ease;}
@keyframes slideInRight{from{transform:translateX(24px);opacity:0;}to{transform:translateX(0);opacity:1;}}
.mgmt-ph{
  background:var(--md-p);padding:12px 16px;
  display:flex;align-items:center;gap:12px;
  position:sticky;top:0;z-index:10;
}
.mgmt-ph-title{font-family:'DM Serif Display',serif;color:#fff;font-size:20px;}
.mgmt-ph-back{background:none;border:none;color:#fff;cursor:pointer;font-size:20px;padding:0;display:flex;align-items:center;line-height:1;}

/* ─── DATA MANAGEMENT PAGE ─── */
.dm-section{margin-bottom:24px;}
.dm-section-title{font-size:13px;font-weight:700;color:var(--md-osv);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;}
.dm-row{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--md-sc0);border:1px solid var(--md-olv);border-radius:var(--r);margin-bottom:6px;}
.dm-row-label{font-size:13px;color:var(--md-osf);display:flex;align-items:center;gap:8px;}
.dm-row-label i{color:var(--md-p);width:16px;text-align:center;}
.dm-btn-sm{font-size:12px;padding:5px 14px;border-radius:var(--r-xl);border:none;cursor:pointer;font-family:inherit;font-weight:600;white-space:nowrap;transition:opacity .15s;}
.dm-btn-sm:active{opacity:.7;}
.dm-btn-exp{background:var(--md-pc);color:var(--md-opc);}
.dm-btn-imp{background:var(--md-sec-c);color:var(--md-osec);}
.dm-btn-danger{background:var(--md-ec);color:var(--md-e);}
.dm-feedback{padding:10px 14px;border-radius:var(--r);font-size:13px;margin-bottom:12px;display:flex;align-items:center;gap:8px;}
.dm-feedback.ok{background:#e8f5e9;color:#2e7d32;}
.dm-feedback.err{background:var(--md-ec);color:var(--md-e);}
.dm-confirm{background:var(--md-sc1);border:1px solid var(--md-olv);border-radius:var(--r-lg);padding:14px;margin-bottom:12px;}
.dm-confirm-msg{font-size:13px;color:var(--md-osf);margin-bottom:12px;line-height:1.6;}
.dm-confirm-btns{display:flex;gap:8px;justify-content:flex-end;}
.dm-csv-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.dm-import-form{background:var(--md-sc1);border:1px solid var(--md-olv);border-radius:var(--r-lg);padding:14px;}
.dm-import-form select,.dm-import-form input[type=file]{width:100%;margin-bottom:10px;}
.dm-file-label{display:block;padding:8px 12px;background:var(--md-sc0);border:1px dashed var(--md-ol);border-radius:var(--r);font-size:12px;color:var(--md-osv);cursor:pointer;text-align:center;}
.dm-file-label:hover{background:var(--md-sc3);}

/* ─── NAVIGATION BAR (MD3) ─── */
.nav{
  position:fixed;bottom:0;left:0;right:0;z-index:100;
  background:var(--md-sc1);border-top:1px solid var(--md-olv);
  display:flex;box-shadow:0 -2px 8px rgba(0,0,0,.07);
}
.nb{
  flex:1;padding:10px 2px 12px;display:flex;flex-direction:column;
  align-items:center;gap:3px;background:none;border:none;cursor:pointer;
  color:var(--md-osv);font-family:inherit;font-size:10px;transition:color .2s;
}
.nb.on{color:var(--md-p);}
.ni{
  font-size:18px;width:52px;height:30px;display:flex;
  align-items:center;justify-content:center;
  border-radius:var(--r-xl);transition:background .2s;
}
.nb.on .ni{background:var(--md-pc);}

/* ─── SECTION ─── */
.sec{padding:16px 14px;}
.sec-title{font-family:'DM Serif Display',serif;font-size:22px;margin-bottom:14px;letter-spacing:.2px;}
.sec-sub{font-size:12px;color:var(--md-osv);margin-bottom:10px;margin-top:-8px;}

/* ─── KPI CARDS ─── */
.kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}
.kpi{
  background:var(--md-sc0);border:1px solid var(--md-olv);
  border-radius:var(--r-lg);padding:14px 13px;box-shadow:var(--md-e1);
}
.kl{font-size:11px;color:var(--md-osv);margin-bottom:4px;font-weight:500;}
.kv{font-family:'DM Serif Display',serif;font-size:26px;}
.ks{font-size:11px;color:var(--md-osv);margin-top:2px;}
.kpi.ac{background:var(--md-p);border-color:var(--md-p);}
.kpi.ac .kl,.kpi.ac .kv,.kpi.ac .ks{color:#fff;}

/* ─── ALERT BOX ─── */
.alert-box{
  background:var(--md-ec);border:1px solid rgba(186,26,26,.25);
  border-radius:var(--r-lg);padding:12px 14px;margin-bottom:14px;
}
.alert-ttl{font-size:12px;color:var(--md-e);font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px;}
.alert-row{font-size:12px;padding:4px 0;border-bottom:1px solid rgba(186,26,26,.15);}
.alert-row:last-child{border:none;}

/* ─── CHART CARD ─── */
.chart-card{
  background:var(--md-sc0);border:1px solid var(--md-olv);
  border-radius:var(--r-lg);padding:14px;margin-bottom:14px;box-shadow:var(--md-e1);
}
.chart-ttl{font-size:11px;color:var(--md-osv);margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em;font-weight:600;}
.bar-row{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.bar-lbl{font-size:11px;width:52px;color:var(--md-osv);}
.bar-tr{flex:1;height:10px;background:var(--md-sc4);border-radius:5px;overflow:hidden;}
.bar-f{height:100%;border-radius:5px;transition:width .4s ease;}
.bar-v{font-size:12px;width:60px;text-align:right;font-weight:600;}

/* ─── FILTER CHIPS (MD3) ─── */
.filter-row{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;align-items:center;}
.chip{
  padding:6px 13px;border-radius:var(--r-sm);font-size:12px;font-family:inherit;
  border:1px solid var(--md-ol);background:transparent;cursor:pointer;
  color:var(--md-osv);transition:all .15s;display:inline-flex;align-items:center;gap:4px;font-weight:500;
}
.chip:hover{background:rgba(156,74,35,.07);border-color:var(--md-p);color:var(--md-p);}
.chip.on{background:var(--md-sec-c);border-color:transparent;color:var(--md-osec);}
.si{
  flex:1;min-width:100px;padding:8px 14px;
  border:1px solid var(--md-ol);border-radius:var(--r-xl);
  font-family:inherit;font-size:13px;background:transparent;
  outline:none;color:var(--md-osf);transition:border .15s;
}
.si:focus{border-color:var(--md-p);border-width:2px;}

/* ─── PART CARD (MD3 Elevated) ─── */
.pc{
  background:var(--md-sc0);border:1px solid var(--md-olv);
  border-radius:var(--r-lg);padding:14px 12px;margin-bottom:9px;
  box-shadow:var(--md-e1);display:flex;justify-content:space-between;
  align-items:flex-start;gap:10px;
}
.pc.low{border-left:4px solid var(--md-e);}
.pc.warn{border-left:4px solid #C97800;}
.pc.ok{border-left:4px solid var(--md-ook);}
.pn{font-size:14px;font-weight:700;}
.pv{font-size:12px;color:var(--md-osv);margin-top:2px;}
.pbadge{
  display:inline-block;font-size:10px;padding:2px 8px;
  border-radius:var(--r-sm);background:var(--md-sc3);color:var(--md-osv);margin-top:5px;font-weight:500;
}
.price-avg{font-size:12px;color:var(--md-p);font-weight:700;margin-top:6px;}
.price-row{font-size:11px;color:var(--md-osv);margin-top:3px;}
.psb{text-align:right;flex-shrink:0;}
.psn{font-family:'DM Serif Display',serif;font-size:28px;}
.psn.low{color:var(--md-e);}
.psn.warn{color:#C97800;}
.psn.ok{color:var(--md-ook);}
.psu{font-size:11px;color:var(--md-osv);}
.psm{font-size:10px;color:var(--md-osv);margin-top:2px;}
.sbadge{display:inline-block;font-size:10px;padding:3px 9px;border-radius:var(--r-sm);margin-top:4px;font-weight:700;}
.sbadge.low{background:var(--md-ec);color:var(--md-e);}
.sbadge.warn{background:var(--md-wc);color:var(--md-ow);}
.sbadge.ok{background:var(--md-okc);color:var(--md-ook);}

/* ─── PRODUCT STOCK CARD ─── */
.prod-stk-card{
  background:var(--md-sc0);border:1px solid var(--md-olv);
  border-radius:var(--r-lg);margin-bottom:10px;box-shadow:var(--md-e1);overflow:hidden;
}
.prod-stk-header{padding:14px;display:flex;justify-content:space-between;align-items:flex-start;cursor:pointer;}
.prod-stk-name{font-size:15px;font-weight:700;}
.prod-stk-desc{font-size:12px;color:var(--md-osv);margin-top:3px;}
.prod-stk-right{text-align:right;flex-shrink:0;}
.prod-stk-total{font-family:'DM Serif Display',serif;font-size:28px;}
.prod-stk-lbl{font-size:10px;color:var(--md-osv);}
.prod-stk-toggle{font-size:11px;color:var(--md-osv);margin-top:4px;}
.prod-stk-body{border-top:1px solid var(--md-olv);padding:12px 14px;background:var(--md-sc1);}
.stk-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:13px;}
.stk-row-lbl{color:var(--md-osv);}
.stk-row-val{font-weight:700;}
.stk-divider{height:1px;background:var(--md-olv);margin:6px 0;}

/* ─── CONSIGNEE BLOCK ─── */
.consignee-block{
  background:var(--md-sc0);border:1px solid var(--md-olv);
  border-radius:var(--r);padding:12px 14px;margin-top:10px;box-shadow:var(--md-e1);
}
.consignee-name{font-size:13px;font-weight:700;color:var(--md-p);margin-bottom:8px;}
.consignee-row{display:flex;justify-content:space-between;font-size:12px;padding:3px 0;}
.consignee-lbl{color:var(--md-osv);}
.consignee-val{font-weight:600;}
.consignee-stock-big{font-family:'DM Serif Display',serif;font-size:22px;}
.consignee-memo{font-size:11px;color:var(--md-osv);margin-top:6px;padding-top:5px;border-top:1px solid var(--md-olv);}

/* ─── RECIPE CARD ─── */
.recipe-card{
  background:var(--md-sc0);border:1px solid var(--md-olv);
  border-radius:var(--r-lg);margin-bottom:10px;box-shadow:var(--md-e1);overflow:hidden;
}
.recipe-header{padding:14px;display:flex;justify-content:space-between;align-items:flex-start;cursor:pointer;}
.recipe-name{font-size:15px;font-weight:700;}
.recipe-desc{font-size:12px;color:var(--md-osv);margin-top:3px;}
.recipe-cost{text-align:right;flex-shrink:0;}
.recipe-total{font-family:'DM Serif Display',serif;font-size:22px;color:var(--md-p);}
.recipe-lbl{font-size:10px;color:var(--md-osv);}
.recipe-toggle{font-size:11px;color:var(--md-osv);margin-top:4px;}
.recipe-body{border-top:1px solid var(--md-olv);padding:12px 14px;background:var(--md-sc1);}
.cost-sec-lbl{font-size:10px;color:var(--md-osv);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;margin-top:10px;font-weight:600;}
.cost-sec-lbl:first-child{margin-top:0;}
.cost-row{display:flex;justify-content:space-between;font-size:12px;padding:3px 0;}
.cost-sub{font-size:11px;color:var(--md-osv);margin-left:6px;}
.cost-div{height:1px;background:var(--md-olv);margin:7px 0;}
.cost-total-row{display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:var(--md-p);}

/* ─── SUB TABS (MD3 Segmented) ─── */
.sub-tabs{
  display:flex;background:var(--md-sc1);
  border:1px solid var(--md-olv);border-radius:var(--r-lg);
  overflow:hidden;margin-bottom:14px;padding:3px;gap:3px;
}
.stab{
  flex:1;padding:8px;font-family:inherit;font-size:13px;
  background:none;border:none;cursor:pointer;color:var(--md-osv);
  font-weight:500;border-radius:var(--r);transition:all .15s;
}
.stab.on{background:var(--md-sc0);color:var(--md-p);font-weight:700;box-shadow:var(--md-e1);}

/* ─── RECORD CARDS ─── */
.rc{
  background:var(--md-sc0);border:1px solid var(--md-olv);
  border-radius:var(--r-lg);padding:13px 14px;margin-bottom:8px;box-shadow:var(--md-e1);
}
.rc-top{display:flex;justify-content:space-between;align-items:flex-start;}
.rc-name{font-size:13px;font-weight:700;}
.rc-meta{font-size:11px;color:var(--md-osv);margin-top:2px;}
.rc-amt{font-size:14px;font-weight:700;color:var(--md-p);text-align:right;}
.rc-qty{font-size:11px;color:var(--md-osv);text-align:right;margin-top:2px;}
.rc-note{font-size:11px;color:var(--md-osv);margin-top:6px;padding-top:5px;border-top:1px solid var(--md-olv);}
.dc{
  background:var(--md-ec);border:1px solid rgba(186,26,26,.25);
  border-radius:var(--r-lg);padding:13px 14px;margin-bottom:8px;
}
.dc-reason{font-size:11px;color:var(--md-e);margin-top:4px;}

/* ─── SALES ─── */
.sc-list{display:flex;gap:8px;margin-bottom:14px;overflow-x:auto;padding-bottom:2px;}
.sc{
  flex-shrink:0;background:var(--md-sc0);border:1px solid var(--md-olv);
  border-radius:var(--r-lg);padding:10px 13px;text-align:center;
  box-shadow:var(--md-e1);cursor:pointer;transition:all .15s;
}
.sc.active{
  border-color:var(--md-p);border-width:2px;
  background:var(--md-pc);
}
.sc-ch{font-size:11px;color:var(--md-osv);}
.sc-v{font-size:15px;font-weight:700;}
.sc-cnt{font-size:10px;color:var(--md-osv);margin-top:2px;}
.sale-card{
  background:var(--md-sc0);border:1px solid var(--md-olv);
  border-radius:var(--r-lg);margin-bottom:9px;box-shadow:var(--md-e1);overflow:hidden;
}
.sale-main{padding:13px 14px;display:flex;justify-content:space-between;align-items:flex-start;cursor:pointer;}
.sale-name{font-size:14px;font-weight:700;}
.sale-meta{font-size:11px;color:var(--md-osv);margin-top:2px;}
.sale-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;}
.sale-rev{font-size:15px;font-weight:700;text-align:right;}
.sale-margin{font-size:11px;margin-top:2px;text-align:right;}
.sale-toggle{font-size:11px;color:var(--md-osv);margin-top:4px;text-align:right;}
.sale-detail{border-top:1px solid var(--md-olv);padding:10px 14px;background:var(--md-sc1);}
.sd-row{display:flex;justify-content:space-between;font-size:12px;padding:3px 0;}
.sd-lbl{color:var(--md-osv);}
.sd-val{font-weight:600;}
.sd-div{height:1px;background:var(--md-olv);margin:6px 0;}
.sd-total{display:flex;justify-content:space-between;font-size:13px;font-weight:700;padding-top:2px;}
.sd-memo{font-size:11px;color:var(--md-osv);margin-top:6px;padding-top:5px;border-top:1px solid var(--md-olv);}

/* ─── FAB (MD3 Standard) ─── */
.fab{
  position:fixed;right:16px;bottom:82px;z-index:200;
  width:56px;height:56px;border-radius:var(--r-lg);
  background:var(--md-pc);color:var(--md-opc);border:none;font-size:24px;
  cursor:pointer;box-shadow:var(--md-e3);display:flex;align-items:center;justify-content:center;
  transition:box-shadow .2s,background .15s;
}
.fab:hover{background:#F0C8B0;box-shadow:var(--md-e2);}
.fab:active{background:#E0B8A0;}

/* ─── BOTTOM SHEET (MD3) ─── */
.ov{position:fixed;inset:0;background:rgba(32,26,22,.54);z-index:300;display:flex;align-items:flex-end;justify-content:center;}
.modal{
  background:var(--md-sc1);border-radius:28px 28px 0 0;
  padding:0 16px 44px;width:100%;max-width:600px;
  animation:suUp .26s cubic-bezier(.2,.8,.4,1);
  max-height:92vh;overflow-y:auto;
}
.modal::before{
  content:'';display:block;width:32px;height:4px;
  background:var(--md-olv);border-radius:2px;margin:12px auto 16px;
}
@keyframes suUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
.modal-title{font-family:'DM Serif Display',serif;font-size:20px;margin-bottom:14px;}
.modal-sub{font-size:12px;color:var(--md-osv);margin-top:-8px;margin-bottom:13px;}
.fr{margin-bottom:11px;}
.fl{font-size:14px;color:var(--md-osv);margin-bottom:4px;display:block;font-weight:500;}
.fi,.fs{
  width:100%;padding:9px 12px;
  border:1px solid var(--md-ol);border-radius:var(--r-sm);
  font-family:inherit;font-size:13px;background:var(--md-sc0);
  color:var(--md-osf);outline:none;transition:border-color .15s;
}
.fi:focus,.fs:focus{border-color:var(--md-p);border-width:2px;background:var(--md-sc0);}
.fr2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.fr3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
.div{height:1px;background:var(--md-olv);margin:12px 0;}
.sec-label{font-size:11px;color:var(--md-osv);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;margin-top:6px;}

/* ─── RECIPE ROWS ─── */
.ing-row{display:flex;gap:6px;align-items:center;margin-bottom:7px;}
.ing-row .fs{flex:2;}
.ing-row .fi{flex:1;}
.ing-del{background:none;border:none;color:var(--md-e);font-size:16px;cursor:pointer;padding:0 2px;flex-shrink:0;}
.part-chip-used{
  display:inline-flex;align-items:center;gap:5px;padding:7px 14px;
  border-radius:var(--r-sm);background:var(--md-p);color:var(--md-op);
  border:none;font-family:inherit;font-size:12px;cursor:pointer;
  margin:3px;font-weight:500;transition:background .15s;
}
.part-chip-unused{
  display:inline-flex;align-items:center;gap:5px;padding:7px 14px;
  border-radius:var(--r-sm);background:transparent;color:var(--md-osv);
  border:1px solid var(--md-ol);font-family:inherit;font-size:12px;
  cursor:pointer;margin:3px;transition:all .15s;
}
.part-chips{display:flex;flex-wrap:wrap;margin-bottom:6px;}
.made-sec{margin-top:16px;}
.made-sec-ttl{font-size:12px;font-weight:700;color:var(--md-osv);margin-bottom:8px;display:flex;align-items:center;gap:6px;}
.add-row-btn{
  background:none;border:1px dashed var(--md-ol);border-radius:var(--r-sm);
  color:var(--md-osv);font-family:inherit;font-size:12px;cursor:pointer;
  padding:7px 12px;width:100%;margin-top:3px;transition:all .15s;
}
.add-row-btn:hover{border-color:var(--md-p);color:var(--md-p);}
.add-ing-btn{
  font-size:12px;color:var(--md-opc);background:var(--md-pc);
  border:none;border-radius:var(--r-sm);padding:8px 12px;
  font-family:inherit;cursor:pointer;width:100%;
  margin-bottom:9px;font-weight:500;transition:background .15s;
}
.add-ing-btn:hover{background:#F0C8B0;}

/* ─── PREVIEW BOX ─── */
.preview-box{background:var(--md-sc3);border-radius:var(--r);padding:11px 13px;margin-bottom:8px;}
.prev-row{display:flex;justify-content:space-between;font-size:12px;padding:3px 0;}
.prev-lbl{color:var(--md-osv);}
.prev-val{font-weight:600;}
.prev-div{height:1px;background:var(--md-olv);margin:6px 0;}
.prev-total{display:flex;justify-content:space-between;font-size:13px;font-weight:700;}

/* ─── BUTTONS (MD3) ─── */
.btn-p{
  width:100%;padding:13px;border-radius:var(--r-xl);
  background:var(--md-p);color:var(--md-op);border:none;
  font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;
  margin-top:8px;letter-spacing:.02em;transition:box-shadow .15s,background .15s;
}
.btn-p:hover{background:#883E18;box-shadow:var(--md-e2);}
.btn-c{
  width:100%;padding:12px;border-radius:var(--r-xl);
  background:transparent;color:var(--md-p);
  border:1px solid var(--md-ol);font-family:inherit;
  font-size:13px;cursor:pointer;margin-top:6px;
  font-weight:500;transition:background .15s;
}
.btn-c:hover{background:rgba(156,74,35,.07);}
.btn-d{
  width:100%;padding:12px;border-radius:var(--r-xl);
  background:transparent;color:var(--md-e);
  border:1px solid var(--md-e);font-family:inherit;
  font-size:13px;cursor:pointer;margin-top:10px;
  font-weight:500;transition:background .15s;
}
.btn-d:hover{background:var(--md-ec);}
.empty{text-align:center;color:var(--md-osv);font-size:13px;padding:32px 0;}

/* ─── DRIVE SYNC ─── */
.h-drive-wrap{display:flex;align-items:center;gap:5px;margin-right:4px;}
.h-drive-signin{
  background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);
  border-radius:var(--r-sm);color:#fff;font-size:12px;cursor:pointer;
  padding:6px 10px;font-family:inherit;display:flex;align-items:center;gap:5px;
  white-space:nowrap;flex-shrink:0;font-weight:500;transition:background .15s;
}
.h-drive-signin:hover{background:rgba(255,255,255,.22);}
.h-drive-pic{width:24px;height:24px;border-radius:50%;border:1.5px solid rgba(255,255,255,.5);object-fit:cover;flex-shrink:0;}
.h-drive-init{
  width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.25);
  color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;
  border:1.5px solid rgba(255,255,255,.5);flex-shrink:0;
}
.h-drive-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;border:1.5px solid rgba(0,0,0,.12);}
.h-drive-dot.ds-idle{background:#9e9e9e;}
.h-drive-dot.ds-loading,.h-drive-dot.ds-syncing{background:#ffc107;animation:ds-pulse .8s ease-in-out infinite;}
.h-drive-dot.ds-ok{background:#4caf50;}
.h-drive-dot.ds-error{background:#f44336;}
@keyframes ds-pulse{0%,100%{opacity:1;}50%{opacity:.25;}}
.h-drive-out{
  background:none;border:none;color:rgba(255,255,255,.65);cursor:pointer;
  padding:2px 3px;font-size:13px;line-height:1;transition:color .15s;flex-shrink:0;
}
.h-drive-out:hover{color:#fff;}
`;

// ═══════════════════════════════════════════════════════════════
//  LocalStorage フック
// ═══════════════════════════════════════════════════════════════
function useLS(key, init) {
  const [val, setVal] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : init;
    } catch { return init; }
  });
  const set = updater => {
    setVal(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  return [val, set];
}

// ═══════════════════════════════════════════════════════════════
//  App
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [parts,          setParts]          = useLS("as_parts",           INIT_PARTS);
  const [purchases,      setPurchases]      = useLS("as_purchases",       INIT_PURCHASES);
  const [disposals,      setDisposals]      = useLS("as_disposals",       INIT_DISPOSALS);
  const [products,       setProducts]       = useLS("as_products",        INIT_PRODUCTS);
  const [made,           setMade]           = useLS("as_made",            INIT_MADE);
  const [consignees,     setConsignees]     = useLS("as_consignees",      INIT_CONSIGNEES);
  const [consignRecords, setConsignRecords] = useLS("as_consign_records", INIT_CONSIGN_RECORDS);
  const [sales,          setSales]          = useLS("as_sales",           INIT_SALES);
  const [channels,       setChannels]       = useLS("as_channels",        INIT_CHANNELS);
  const [partUsages,     setPartUsages]     = useLS("as_part_usages",     []);
  const [processings,    setProcessings]    = useLS("as_processings",     INIT_PROCESSINGS);
  const [partCatMaster,  setPartCatMaster]  = useLS("as_part_cats",       ["金具","チェーン","ビーズ","梱包材"]);
  const [productCatMaster,setProductCatMaster]= useLS("as_product_cats",  ["ピアス","イヤリング","ネックレス","ブレスレット","リング","その他"]);
  const [partLocMaster,  setPartLocMaster]  = useLS("as_part_locations",  ["棚A","棚B","引き出し"]);
  const [stockAdjustments,   setStockAdjustments]   = useLS("as_stock_adjustments",   []);
  const [productAdjustments, setProductAdjustments] = useLS("as_product_adjustments", []);
  const [priceAdjustments,   setPriceAdjustments]   = useLS("as_price_adjustments",   []);

  const [tab,    setTab]    = useState("dashboard");
  const [subTab,  setSubTab]  = useState("purchase");
  const [subTab2, setSubTab2] = useState("stock"); // prodstock: "stock" | "recipe"
  const [cat,    setCat]    = useState("すべて");
  const [q,      setQ]      = useState("");
  const [modal,  setModal]  = useState(null);
  const [open,   setOpen]   = useState({});
  const [selectedConsigneeId, setSelectedConsigneeId] = useState(null); // 委託先詳細ページ用
  const [mgmtPage, setMgmtPage] = useState(null); // null | "parts_master" | "category_setting" | "history"
  const [showMgmtMenu, setShowMgmtMenu] = useState(false);
  const [partsAddTab, setPartsAddTab] = useState("purchase"); // "purchase" | "part"
  const [historyTab, setHistoryTab] = useState("purchase"); // "purchase" | "disposal"
  const [newPartCatInput,    setNewPartCatInput]    = useState("");
  const [newProductCatInput, setNewProductCatInput] = useState("");
  const [partSort, setPartSort] = useState("name"); // "name" | "stock" | "update"
  const [partSortDir, setPartSortDir] = useState("asc"); // "asc" | "desc"
  // 保管場所
  const [showNewPartLoc,  setShowNewPartLoc]  = useState(false);
  const [newPartLocInput, setNewPartLocInput] = useState("");
  // カテゴリ編集
  const [editingPartCatName,    setEditingPartCatName]    = useState(null);
  const [editPartCatInput,      setEditPartCatInput]      = useState("");
  const [editingProductCatName, setEditingProductCatName] = useState(null);
  const [editProductCatInput,   setEditProductCatInput]   = useState("");
  // 委託先編集
  const [editingConsigneeId, setEditingConsigneeId] = useState(null);
  const [consigneeEditForm,  setConsigneeEditForm]  = useState({name:"",address:"",memo:""});
  // レシピ部品フィルタ
  const [recipeCatFilter, setRecipeCatFilter] = useState("");

  // フォーム
  const [pf,  setPf]  = useState({ partId:"",   date:today(),   supplier:"",   qty:"",  totalPrice:"", note:"" });
  const [pfCat, setPfCat] = useState("");
  const [df,  setDf]  = useState({ partId:"",   date:today(),   qty:"",        reason:"" });
  const [editingPurchaseId,  setEditingPurchaseId]  = useState(null);
  const [editingDisposalId,  setEditingDisposalId]  = useState(null);
  const SF_ITEM_INIT = { saleType:"product", productId:"", orderName:"", qty:"1", price:"", shippingActual:"" };
  const [sf,  setSf]  = useState({ date:today(), channel:"Minne", memo:"", items:[{...SF_ITEM_INIT}] });
  const MF_INIT = { productId:"", date:today(), qty:"1", note:"", checkedParts:{}, extraParts:[], lossParts:[] };
  const [mf,  setMf]  = useState(MF_INIT);
  const [cf,  setCf]  = useState({ productId:"", consigneeId:"", date:today(), type:"deliver", qty:"1", salePrice:"", feeRate:"30", memo:"" });
  // レシピ登録フォーム
  const [rf, setRf]   = useState({ name:"", desc:"", cat:"", shippingCost:"", laborCost:"", ingredients:[{partId:"",qty:""}] });
  const [prodCatFilter, setProdCatFilter] = useState("すべて");
  const [showNewProdCat,  setShowNewProdCat]  = useState(false);
  const [newProdCatInput, setNewProdCatInput] = useState("");

  // データ管理（エクスポート/インポート）
  const [importFeedback,    setImportFeedback]    = useState(null); // {type:"ok"|"err", msg}
  const [jsonImportConfirm, setJsonImportConfirm] = useState(null); // {obj, fileName}
  const [csvImportTable,    setCsvImportTable]    = useState("parts");
  const [csvImportPreview,  setCsvImportPreview]  = useState(null); // {key, rows}

  // Google Drive 同期
  const [driveUser,     setDriveUser]     = useState(null);    // {name, email, picture} サインイン中は非null
  const [driveStatus,   setDriveStatus]   = useState('idle');  // idle|loading|syncing|ok|error
  const [driveLastSync, setDriveLastSync] = useState(null);
  const [driveFileId,   setDriveFileId]   = useLS('as_drive_file_id', null);
  // mutable な Drive 状態をまとめて管理（stale closure 対策）
  const driveRef = useRef({
    token: null, fileId: null, timer: null,
    startupDone: false, skipSync: false,
    tokenClient: null,
    buildPayload: null, applyData: null,
  });

  const tog = key => setOpen(p=>({...p,[key]:!p[key]}));

  // ── チャネル derived ──────────────────────────────────────────
  const chFeeMap = useMemo(()=>Object.fromEntries(channels.map(c=>[c.name,c.feeRate])),[channels]);
  const chColMap = useMemo(()=>Object.fromEntries(channels.map(c=>[c.name,c.color])),[channels]);

  // ── 計算 ──────────────────────────────────────────────────────
  const partStockMap = useMemo(()=>{
    const m={};
    parts.forEach(p=>{ m[p.id]=calcPartStock(p.id,purchases,disposals,partUsages,processings,p.type,stockAdjustments,priceAdjustments); });
    return m;
  },[parts,purchases,disposals,partUsages,processings,stockAdjustments,priceAdjustments]);

  const productCostMap = useMemo(()=>{
    const m={};
    products.forEach(pr=>{ m[pr.id]=calcProductCost(pr,partStockMap,parts); });
    return m;
  },[products,partStockMap,parts]);

  const productStockMap = useMemo(()=>{
    const m={};
    products.forEach(pr=>{ m[pr.id]=calcProductStock(pr.id,made,sales,consignRecords,productAdjustments); });
    return m;
  },[products,made,sales,consignRecords,productAdjustments]);

  const partMinStock = (p) => p.minStock ?? MIN_STOCK[p.id] ?? 10;

  const partSt = (id,stock)=>{
    const p = parts.find(pt=>pt.id===id);
    const min = p ? partMinStock(p) : (MIN_STOCK[id]||10);
    return stock<min?"low":stock<min*1.5?"warn":"ok";
  };

  const filteredParts = useMemo(()=>{
    const base = parts.filter(p=>(cat==="すべて"||p.cat===cat)&&(p.name.includes(q)||(p.variant||"").includes(q)));
    const dir = partSortDir==="asc" ? 1 : -1;
    const lastDateOf = id => {
      const rs = purchases.filter(p=>p.partId===id);
      return rs.length ? rs.reduce((mx,p)=>p.date>mx?p.date:mx,"") : "";
    };
    const sortFn = (a,b) => {
      if(partSort==="name")     return dir * a.name.localeCompare(b.name,"ja");
      if(partSort==="stock")    return dir * ((partStockMap[a.id]?.stock||0)-(partStockMap[b.id]?.stock||0));
      if(partSort==="update")   return dir * lastDateOf(a.id).localeCompare(lastDateOf(b.id));
      if(partSort==="location") return dir * (a.location||"").localeCompare(b.location||"","ja");
      return 0;
    };
    // 中間材を除いたトップレベル（母材・通常）をソート
    const topLevel = base.filter(p=>!(p.type==="part"&&p.parentId));
    topLevel.sort(sortFn);
    // フィルタに一致するが親がトップレベルにない孤立中間材を末尾に追加
    const topIds = new Set(topLevel.map(p=>p.id));
    const orphans = base.filter(p=>p.type==="part"&&p.parentId&&!topIds.has(p.parentId));
    orphans.sort(sortFn);
    return [...topLevel, ...orphans];
  },[parts,cat,q,partSort,partSortDir,partStockMap,purchases]);

  const alerts = parts.filter(p=>partStockMap[p.id].stock<partMinStock(p));

  // 今月集計（動的）
  const THIS_MONTH  = today().slice(0,7); // "YYYY-MM"
  const ms          = sales.filter(s=>s.date?.startsWith(THIS_MONTH));
  const totalRev    = ms.reduce((a,s)=>a+s.price*s.qty,0);
  const totalProfit = ms.reduce((a,s)=>a+calcSaleProfit(s,productCostMap,chFeeMap).profit,0);
  const byChannel   = channels
    .map(ch=>({ ch:ch.name, rev:ms.filter(s=>s.channel===ch.name).reduce((a,s)=>a+s.price*s.qty,0) }))
    .filter(b=>b.rev>0);
  const maxRev      = Math.max(...byChannel.map(b=>b.rev),1);

  const prodName = id => products.find(p=>p.id===id)?.name||`商品ID:${id}`;
  const cneeName = id => consignees.find(c=>c.id===id)?.name||`委託先ID:${id}`;

  // 売上タブ：年度・チャネルフィルタ
  const [selectedChannel, setSelectedChannel] = useState(null);

  const salesYears = useMemo(()=>{
    const ys = [...new Set(sales.map(s=>s.date?.slice(0,4)).filter(Boolean))].sort((a,b)=>b-a);
    return ys.length ? ys : [String(new Date().getFullYear())];
  },[sales]);

  const [selectedYear, setSelectedYear] = useState(()=>{
    const ys = [...new Set(sales.map(s=>s.date?.slice(0,4)).filter(Boolean))].sort((a,b)=>b-a);
    return ys[0] || String(new Date().getFullYear());
  });

  const yearSales = useMemo(()=>
    sales.filter(s=>s.date?.startsWith(selectedYear))
  ,[sales,selectedYear]);

  const byChannelAll = useMemo(()=>{
    const names = [...new Set([...channels.map(c=>c.name),...yearSales.map(s=>s.channel).filter(Boolean)])];
    return names.map(ch=>({
      ch,
      rev: yearSales.filter(s=>s.channel===ch).reduce((a,s)=>a+s.price*s.qty,0),
      cnt: yearSales.filter(s=>s.channel===ch).length,
    }));
  },[channels,yearSales]);

  const displayedSales = useMemo(()=>{
    const sorted = [...yearSales].reverse();
    return selectedChannel ? sorted.filter(s=>s.channel===selectedChannel) : sorted;
  },[yearSales,selectedChannel]);

  // 売上モーダル プレビュー（アイテム別）
  const salePreview = useMemo(()=>{
    const feeRate = chFeeMap[sf.channel]??0;
    return sf.items.map(item=>{
      if(!item.price||!item.qty) return null;
      if(item.saleType!=="order"&&!item.productId) return null;
      const costInfo = item.saleType!=="order" ? productCostMap[+item.productId] : null;
      const cost = costInfo?.total||0;
      const estimatedShipping = costInfo?.shippingCost||0;
      const rev  = +item.price * +item.qty;
      const fee  = Math.round(+item.price*(feeRate/100))*(+item.qty);
      const shippingAdj = +item.shippingActual > 0
        ? ((+item.shippingActual - estimatedShipping) * (+item.qty))
        : 0;
      const profit = rev - cost*(+item.qty) - fee - shippingAdj;
      return { rev, cost:cost*(+item.qty), fee, shippingAdj, estimatedShipping, profit, feeRate };
    });
  },[sf,productCostMap,chFeeMap]);

  // ── データ管理：エクスポート/インポート ────────────────────────
  const dataSetterMap = {
    parts:              setParts,
    purchases:          setPurchases,
    disposals:          setDisposals,
    processings:        setProcessings,
    products:           setProducts,
    made:               setMade,
    consignees:         setConsignees,
    consignRecords:     setConsignRecords,
    sales:              setSales,
    channels:           setChannels,
    partUsages:         setPartUsages,
    stockAdjustments:   setStockAdjustments,
    productAdjustments: setProductAdjustments,
    priceAdjustments:   setPriceAdjustments,
  };
  const dataValueMap = () => ({
    parts, purchases, disposals, processings,
    products, made, consignees, consignRecords,
    sales, channels, partUsages,
    stockAdjustments, productAdjustments, priceAdjustments,
  });

  const handleExportJSON = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        ...dataValueMap(),
        settings: { partCatMaster, productCatMaster, partLocMaster },
      },
    };
    downloadBlob(JSON.stringify(payload, null, 2), `atelier-stock-${today()}.json`, "application/json");
  };

  const handleExportCSV = (key) => {
    const def = CSV_COLS[key];
    let rows  = dataValueMap()[key] ?? [];
    if (key === "sales") {
      rows = rows.map(s => ({
        ...s,
        productName: products.find(p => p.id === s.productId)?.name ?? "",
        consignMemo: s.consignRecordId != null
          ? (consignRecords.find(r => r.id === s.consignRecordId)?.memo ?? "")
          : "",
      }));
    }
    // 棚卸用：現在庫数・加重平均単価を付与
    if (key === "parts") {
      rows = rows.map(p => ({
        ...p,
        currentStock: fmtStock(partStockMap[p.id]?.stock ?? 0),
        avgPrice: Math.round((partStockMap[p.id]?.avgPrice ?? 0) * 100) / 100,
      }));
    }
    if (key === "products") {
      rows = rows.map(p => ({ ...p, currentStock: productStockMap[p.id]?.hand ?? 0 }));
    }
    const cols    = def.exportCols    ?? def.cols;
    const headers = def.exportHeaders ?? def.headers;
    downloadBlob(buildCSV(rows, cols, headers), `as_${key}_${today()}.csv`, "text/csv;charset=utf-8");
  };

  const handleJSONFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const obj = JSON.parse(ev.target.result);
        if (!obj || !obj.data) throw new Error("フォーマット不正（dataキーが見つかりません）");
        setJsonImportConfirm({ obj, fileName: file.name });
        setImportFeedback(null);
      } catch(err) {
        setImportFeedback({ type:"err", msg:"JSONの読み込みに失敗: " + err.message });
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const applyJSONImport = () => {
    const d = jsonImportConfirm.obj.data;
    Object.entries(dataSetterMap).forEach(([key, setter]) => {
      if (Array.isArray(d[key])) setter(d[key].map(r => r.id ? r : { ...r, id: nextId() }));
    });
    if (d.settings?.partCatMaster)    setPartCatMaster(d.settings.partCatMaster);
    if (d.settings?.productCatMaster) setProductCatMaster(d.settings.productCatMaster);
    if (d.settings?.partLocMaster)    setPartLocMaster(d.settings.partLocMaster);
    setJsonImportConfirm(null);
    setImportFeedback({ type:"ok", msg:"JSONデータをインポートしました（既存データを上書き）" });
  };

  const handleCSVFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const def = CSV_COLS[csvImportTable];
    if (!def) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSVText(ev.target.result);
        const objs = csvRowsToObjects(rows, def);
        if (objs.length === 0) throw new Error("データが0件です（ヘッダー行のみ、または空ファイル）");
        setCsvImportPreview({ key: csvImportTable, rows: objs, fileName: file.name });
        setImportFeedback(null);
      } catch(err) {
        setImportFeedback({ type:"err", msg:"CSVの読み込みに失敗: " + err.message });
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const applyCSVImport = (mode) => {
    // mode: "merge"（IDが同じなら上書き、なければ追加）| "overwrite"（テーブル全置き換え）
    const { key, rows } = csvImportPreview;
    const setter = dataSetterMap[key];
    if (!setter) return;
    let assigned = rows.map(r => r.id ? r : { ...r, id: nextId() });

    // 棚卸調整：マージ時のみ・現在庫数列が含まれる場合に差分を調整レコードとして積む
    // 全置換はマスターデータの差し替えが目的なので在庫調整は行わない
    if (mode === "merge") {
      if (key === "parts") {
        const newAdjs = [];
        const newPriceAdjs = [];
        assigned.forEach(row => {
          const partType = row.type || parts.find(p => p.id === row.id)?.type;
          const { stock: cur, avgPrice: curAvg } = calcPartStock(row.id, purchases, disposals, partUsages, processings, partType, stockAdjustments, priceAdjustments);
          if (row.currentStock != null && !isNaN(+row.currentStock)) {
            const delta = +row.currentStock - cur;
            if (Math.abs(delta) > 0.0001) newAdjs.push({ id: nextId(), partId: row.id, date: today(), adjustQty: delta, note: "棚卸調整" });
          }
          // 加重平均単価の上書き（中間材は親の加工コストから算出するため対象外）
          if (partType !== "part" && row.avgPrice != null && !isNaN(+row.avgPrice) && +row.avgPrice > 0) {
            if (Math.abs(+row.avgPrice - curAvg) > 0.01) {
              const baseStock = row.currentStock != null ? +row.currentStock : cur;
              newPriceAdjs.push({ id: nextId(), partId: row.id, date: today(), avgPrice: +row.avgPrice, stock: baseStock, note: "棚卸調整" });
            }
          }
        });
        if (newAdjs.length > 0) setStockAdjustments(prev => [...prev, ...newAdjs]);
        if (newPriceAdjs.length > 0) setPriceAdjustments(prev => [...prev, ...newPriceAdjs]);
      }
      if (key === "products") {
        const newAdjs = [];
        assigned.forEach(row => {
          if (row.currentStock == null || isNaN(+row.currentStock)) return;
          const { hand: cur } = calcProductStock(row.id, made, sales, consignRecords, productAdjustments);
          const delta = +row.currentStock - cur;
          if (Math.abs(delta) > 0.0001) newAdjs.push({ id: nextId(), productId: row.id, date: today(), adjustQty: delta, note: "棚卸調整" });
        });
        if (newAdjs.length > 0) setProductAdjustments(prev => [...prev, ...newAdjs]);
      }
    }

    // currentStock / avgPrice はマスターデータに保存しない
    if (key === "parts" || key === "products") {
      assigned = assigned.map(r => { const out = {...r}; delete out.currentStock; delete out.avgPrice; return out; });
    }

    if (mode === "overwrite") {
      setter(assigned);
    } else {
      setter(prev => {
        const prevMap = new Map(prev.map(x => [x.id, x]));
        assigned.forEach(r => prevMap.set(r.id, r));
        return [...prevMap.values()];
      });
    }
    setCsvImportPreview(null);
    setImportFeedback({ type:"ok", msg:`${CSV_COLS[key].label}を${rows.length}件インポートしました（${mode==="overwrite"?"全置換":"マージ"}）` });
  };

  // ── Google Drive 同期 ──────────────────────────────────────────

  // 全データをシリアライズ（render ごとに最新版を driveRef に格納）
  const buildDrivePayload = () => ({
    version: 2,
    lastSavedAt: new Date().toISOString(),
    data: {
      parts, purchases, disposals, processings, partUsages,
      products, made, consignees, consignRecords, sales, channels,
      stockAdjustments, productAdjustments, priceAdjustments,
      partCatMaster, productCatMaster, partLocMaster,
    },
  });
  driveRef.current.buildPayload = buildDrivePayload;

  // Drive から読み込んだデータを全 state に適用
  const applyDriveData = (d) => {
    driveRef.current.skipSync = true; // この state 変化では自動保存をスキップ
    if (Array.isArray(d.parts))            setParts(d.parts);
    if (Array.isArray(d.purchases))        setPurchases(d.purchases);
    if (Array.isArray(d.disposals))        setDisposals(d.disposals);
    if (Array.isArray(d.processings))      setProcessings(d.processings);
    if (Array.isArray(d.partUsages))       setPartUsages(d.partUsages);
    if (Array.isArray(d.products))         setProducts(d.products);
    if (Array.isArray(d.made))             setMade(d.made);
    if (Array.isArray(d.consignees))       setConsignees(d.consignees);
    if (Array.isArray(d.consignRecords))   setConsignRecords(d.consignRecords);
    if (Array.isArray(d.sales))            setSales(d.sales);
    if (Array.isArray(d.channels))             setChannels(d.channels);
    if (Array.isArray(d.stockAdjustments))     setStockAdjustments(d.stockAdjustments);
    if (Array.isArray(d.productAdjustments))   setProductAdjustments(d.productAdjustments);
    if (Array.isArray(d.priceAdjustments))     setPriceAdjustments(d.priceAdjustments);
    if (Array.isArray(d.partCatMaster))        setPartCatMaster(d.partCatMaster);
    if (Array.isArray(d.productCatMaster)) setProductCatMaster(d.productCatMaster);
    if (Array.isArray(d.partLocMaster))    setPartLocMaster(d.partLocMaster);
    localStorage.setItem('as_local_saved_at', new Date().toISOString());
  };
  driveRef.current.applyData = applyDriveData;

  const handleDriveSignIn = () => {
    driveRef.current.tokenClient?.requestAccessToken({ prompt: 'consent' });
  };

  const handleDriveSignOut = () => {
    try { window.google?.accounts?.oauth2?.revoke(driveRef.current.token ?? '', () => { /* revoked */ }); } catch { /* ignore */ }
    driveRef.current.token       = null;
    driveRef.current.startupDone = false;
    clearCachedDriveToken();
    setDriveUser(null);
    setDriveStatus('idle');
  };

  // Drive ファイルID の state → ref 同期
  useEffect(() => { driveRef.current.fileId = driveFileId; }, [driveFileId]);

  // GIS スクリプト読み込み（マウント時一回）
  useEffect(() => {
    if (!DRIVE_CLIENT_ID) return;
    const ref = driveRef.current;
    // StrictMode の二重実行・スクリプト二重ロードを防止
    if (ref.gisLoaded) return;
    ref.gisLoaded = true;

    // トークン取得後の共通処理（キャッシュ経由・GIS コールバック共用）
    const handleToken = async (token) => {
      ref.token = token;
      setCachedDriveToken(token);
      // ユーザー情報取得
      try {
        const r    = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const info = await r.json();
        setDriveUser({ name: info.name, email: info.email, picture: info.picture });
      } catch { /* ユーザー情報取得失敗は無視 */ }
      // 起動時同期（初回のみ）
      if (!ref.startupDone) {
        ref.startupDone = true;
        setDriveStatus('loading');
        try {
          let fid = ref.fileId;
          if (!fid) {
            fid = await driveFindFile(token);
            if (fid) { setDriveFileId(fid); ref.fileId = fid; }
          }
          const localTs = (() => {
            try { return new Date(localStorage.getItem('as_local_saved_at') || 0).getTime(); } catch { return 0; }
          })();
          if (fid) {
            const driveData = await driveReadFile(token, fid);
            const driveTs   = driveData.lastSavedAt ? new Date(driveData.lastSavedAt).getTime() : 0;
            if (driveTs >= localTs) {
              ref.applyData(driveData.data);
            } else {
              await driveWriteFile(token, fid, ref.buildPayload());
              localStorage.setItem('as_local_saved_at', new Date().toISOString());
            }
          } else {
            const newFid = await driveWriteFile(token, null, ref.buildPayload());
            setDriveFileId(newFid); ref.fileId = newFid;
            localStorage.setItem('as_local_saved_at', new Date().toISOString());
          }
          setDriveStatus('ok');
          setDriveLastSync(new Date());
        } catch (err) {
          console.error('[Drive] 起動時同期エラー:', err);
          setDriveStatus('error');
        }
      }
    };

    const initGis = () => {
      if (ref.tokenClient) return;
      const tc = window.google.accounts.oauth2.initTokenClient({
        client_id: DRIVE_CLIENT_ID,
        scope:     DRIVE_SCOPE,
        callback:  async (resp) => {
          if (resp.error) { setDriveStatus('error'); return; }
          await handleToken(resp.access_token);
        },
      });
      ref.tokenClient = tc;

      // sessionStorage にキャッシュ済みトークンがあればダイアログなしで復元
      const cached = getCachedDriveToken();
      if (cached) {
        handleToken(cached);
      } else if (ref.fileId) {
        // 前回サインイン済み（fileId が LS に残っている）なら自動サインイン試行
        tc.requestAccessToken({ prompt: '' });
      }
    };

    if (window.google?.accounts?.oauth2) {
      initGis();
    } else {
      const GIS_URL = 'https://accounts.google.com/gsi/client';
      let script = document.querySelector(`script[src="${GIS_URL}"]`);
      if (!script) {
        script = document.createElement('script');
        script.src   = GIS_URL;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', initGis);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // データ変更時に Drive へ自動保存（2 秒デバウンス）
  useEffect(() => {
    const ref = driveRef.current;
    if (!ref.token) return;
    if (ref.skipSync) { ref.skipSync = false; return; }
    localStorage.setItem('as_local_saved_at', new Date().toISOString());
    if (ref.timer) clearTimeout(ref.timer);
    ref.timer = setTimeout(async () => {
      setDriveStatus('syncing');
      try {
        const payload = ref.buildPayload();
        const newFid  = await driveWriteFile(ref.token, ref.fileId, payload);
        if (newFid !== ref.fileId) { setDriveFileId(newFid); ref.fileId = newFid; }
        setDriveStatus('ok');
        setDriveLastSync(new Date());
      } catch (err) {
        console.error('[Drive] 自動保存エラー:', err);
        setDriveStatus('error');
      }
    }, 2000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, purchases, disposals, processings, partUsages, products, made,
      consignees, consignRecords, sales, channels, partCatMaster, productCatMaster, partLocMaster]);

  // ── 在庫補充（ダッシュボードのアラートから仕入モーダルを開く） ──
  const openReplenish = (p) => {
    setPfCat(p.cat||"");
    setPf({ partId:String(p.id), date:today(), supplier:"", qty:"", totalPrice:"", note:"" });
    setEditingPurchaseId(null);
    setModal("purchase");
  };

  // ── 在庫作成（中間材アラートから加工記録モーダルを開く） ──────
  const openStockCreate = (p) => {
    // p は type:"part"（中間材）。parentId が設定されていれば母材を自動選択
    setProcForm({
      date:        today(),
      inputPartId: p.parentId ? String(p.parentId) : "",
      inputQty:    "",
      outputs:     [{ partId: String(p.id), qty: "" }],
      lossQty:     "",
      note:        "",
    });
    setEditingProcId(null);
    setModal("processing");
  };

  // ── 追加ハンドラ ──────────────────────────────────────────────
  const closePurchaseModal = ()=>{
    setModal(null);
    setEditingPurchaseId(null);
    setShowNewSupplier(false);
    setPfCat("");
    setPf({partId:"",date:today(),supplier:"",qty:"",totalPrice:"",note:""});
  };
  const openEditPurchase = (pu)=>{
    // 新形式は totalPrice を直接保存。旧データは unitPrice から逆算
    const totalPrice = pu.totalPrice != null ? pu.totalPrice : Math.round(pu.qty * pu.unitPrice * 1.1);
    const partCat = parts.find(p=>p.id===pu.partId)?.cat || "";
    setPfCat(partCat);
    setPf({ partId:String(pu.partId), date:pu.date, supplier:pu.supplier, qty:String(pu.qty), totalPrice:String(totalPrice), note:pu.note });
    setEditingPurchaseId(pu.id);
    setShowNewSupplier(false);
    setModal("purchase");
  };
  const savePurchase = ()=>{
    if(!pf.partId||!pf.date||!pf.qty||!pf.totalPrice) return;
    const qty = +pf.qty;
    const totalPrice = +pf.totalPrice;
    const unitPrice = Math.round(totalPrice / qty / 1.1 * 100) / 100;
    if(editingPurchaseId) {
      setPurchases(ps=>ps.map(pu=>pu.id===editingPurchaseId ? {...pu,partId:+pf.partId,date:pf.date,supplier:pf.supplier,qty,unitPrice,totalPrice,note:pf.note} : pu));
    } else {
      setPurchases(p=>[...p,{id:nextId(),partId:+pf.partId,date:pf.date,supplier:pf.supplier,qty,unitPrice,totalPrice,note:pf.note}]);
    }
    closePurchaseModal();
  };
  const deletePurchase = (id)=>{
    if(confirm("この仕入記録を削除しますか？")) {
      setPurchases(p=>p.filter(pu=>pu.id!==id));
      closePurchaseModal();
    }
  };

  const closeDisposalModal = ()=>{
    setModal(null);
    setEditingDisposalId(null);
    setDf({partId:"",date:today(),qty:"",reason:""});
  };
  const openEditDisposal = (d)=>{
    setDf({ partId:String(d.partId), date:d.date, qty:String(d.qty), reason:d.reason });
    setEditingDisposalId(d.id);
    setModal("disposal");
  };
  const saveDisposal = ()=>{
    if(!df.partId||!df.date||!df.qty) return;
    if(editingDisposalId) {
      setDisposals(ds=>ds.map(d=>d.id===editingDisposalId ? {...d,partId:+df.partId,date:df.date,qty:+df.qty,reason:df.reason} : d));
    } else {
      setDisposals(p=>[...p,{id:nextId(),partId:+df.partId,date:df.date,qty:+df.qty,reason:df.reason}]);
    }
    closeDisposalModal();
  };
  const deleteDisposal = (id)=>{
    if(confirm("この廃棄記録を削除しますか？")) {
      setDisposals(d=>d.filter(di=>di.id!==id));
      closeDisposalModal();
    }
  };
  // ── チャネル追加 ──────────────────────────────────────────────
  const [showNewChannel,  setShowNewChannel]  = useState(false);
  const [newChannelInput, setNewChannelInput] = useState({ name:"", feeRate:"" });

  const addChannel = ()=>{
    const name = newChannelInput.name.trim();
    if(!name || channels.some(c=>c.name===name)) return;
    const color = CH_PALETTE[channels.length % CH_PALETTE.length];
    setChannels(cs=>[...cs,{ id:nextId(), name, feeRate:+newChannelInput.feeRate||0, color }]);
    setSf(f=>({...f, channel:name}));
    setNewChannelInput({ name:"", feeRate:"" });
    setShowNewChannel(false);
  };

  // ── チャネル編集 ────────────────────────────────────────────
  const [editingChannelId,  setEditingChannelId]  = useState(null);
  const [channelEditForm,   setChannelEditForm]   = useState({ name:"", feeRate:"", color:"" });

  const openEditChannel = (ch)=>{
    setChannelEditForm({ name:ch.name, feeRate:String(ch.feeRate), color:ch.color });
    setEditingChannelId(ch.id);
    setModal("channel_edit");
  };

  const saveChannel = ()=>{
    const newName = channelEditForm.name.trim();
    if(!newName) return;
    const oldName = channels.find(c=>c.id===editingChannelId)?.name;
    setChannels(cs=>cs.map(c=>c.id===editingChannelId
      ? {...c, name:newName, feeRate:+channelEditForm.feeRate||0, color:channelEditForm.color}
      : c));
    // 売上レコードのチャネル名も一括更新
    if(oldName && oldName!==newName)
      setSales(ss=>ss.map(s=>s.channel===oldName ? {...s,channel:newName} : s));
    setModal(null);
    setEditingChannelId(null);
  };

  const deleteChannel = (id)=>{
    const ch = channels.find(c=>c.id===id);
    const cnt = sales.filter(s=>s.channel===ch?.name).length;
    const msg = cnt>0
      ? `「${ch?.name}」を削除しますか？\n紐づく売上記録 ${cnt} 件のチャネルは空白になります。`
      : `「${ch?.name}」を削除しますか？`;
    if(confirm(msg)) {
      setChannels(cs=>cs.filter(c=>c.id!==id));
      setModal(null);
      setEditingChannelId(null);
    }
  };

  const [editingSaleId, setEditingSaleId] = useState(null);

  const closeSaleModal = ()=>{
    setModal(null);
    setEditingSaleId(null);
    setShowNewChannel(false);
    setNewChannelInput({name:"",feeRate:""});
    setSf({ date:today(), channel:channels[0]?.name||"Minne", memo:"", items:[{saleType:"product",productId:"",orderName:"",qty:"1",price:"",shippingActual:""}] });
  };

  const openEditSale = (s)=>{
    setSf({
      date: s.date, channel: s.channel, memo: s.memo||"",
      items:[{
        saleType: s.saleType||"product",
        productId: s.saleType!=="order" ? String(s.productId||"") : "",
        orderName: s.saleType==="order" ? (s.orderName||"") : "",
        qty: String(s.qty), price: String(s.price), shippingActual: String(s.shippingActual||""),
      }],
    });
    setEditingSaleId(s.id);
    setModal("sale");
  };

  const addSale = ()=>{
    if(!sf.date) return;
    if(editingSaleId) {
      const item = sf.items[0];
      if(!item.price||!item.qty) return;
      if(item.saleType==="order"&&!item.orderName) return;
      if(item.saleType!=="order"&&!item.productId) return;
      const base = {
        saleType: item.saleType==="order"?"order":undefined,
        productId: item.saleType!=="order"?+item.productId:undefined,
        orderName: item.saleType==="order"?item.orderName:undefined,
        date:sf.date, channel:sf.channel, qty:+item.qty, price:+item.price, shippingActual:+item.shippingActual||0, memo:sf.memo,
      };
      setSales(ss=>ss.map(s=>s.id===editingSaleId?{...s,...base}:s));
    } else {
      const validItems = sf.items.filter(item=>
        item.price&&item.qty&&(item.saleType==="order"?item.orderName:item.productId)
      );
      if(validItems.length===0) return;
      const newRecords = validItems.map(item=>({
        id:nextId(),
        saleType: item.saleType==="order"?"order":undefined,
        productId: item.saleType!=="order"?+item.productId:undefined,
        orderName: item.saleType==="order"?item.orderName:undefined,
        date:sf.date, channel:sf.channel, qty:+item.qty, price:+item.price, shippingActual:+item.shippingActual||0, memo:sf.memo,
      }));
      setSales(p=>[...p,...newRecords]);
    }
    closeSaleModal();
  };

  const deleteSale = (id)=>{
    if(confirm("この売上記録を削除しますか？")) {
      setSales(ss=>ss.filter(s=>s.id!==id));
      closeSaleModal();
    }
  };
  const addMade = ()=>{
    if(!mf.productId||!mf.date||!mf.qty) return;
    const madeId = nextId();
    setMade(p=>[...p,{id:madeId,productId:+mf.productId,date:mf.date,qty:+mf.qty,note:mf.note}]);
    // 部品使用記録を生成
    const usageRows = [];
    const prod = products.find(p=>p.id===+mf.productId);
    if(prod) {
      prod.ingredients.forEach(ing=>{
        if(mf.checkedParts[ing.partId]) {
          usageRows.push({ id:nextId(), madeId, partId:ing.partId, date:mf.date, qty:ing.qty*(+mf.qty), type:"recipe" });
        }
      });
    }
    mf.extraParts.forEach(ep=>{
      if(ep.partId&&+ep.qty>0)
        usageRows.push({ id:nextId(), madeId, partId:+ep.partId, date:mf.date, qty:+ep.qty, type:"extra" });
    });
    mf.lossParts.forEach(lp=>{
      if(lp.partId&&+lp.qty>0)
        usageRows.push({ id:nextId(), madeId, partId:+lp.partId, date:mf.date, qty:+lp.qty, type:"loss" });
    });
    if(usageRows.length>0) setPartUsages(u=>[...u,...usageRows]);
    setMf(MF_INIT);
    setModal(null);
  };
  const [editingConsignId, setEditingConsignId] = useState(null);

  const closeConsignModal = ()=>{
    setModal(null);
    setEditingConsignId(null);
    setShowNewCnee(false);
    setNewCneeInput({name:"",address:"",memo:""});
    setCf({productId:"",consigneeId:"",date:today(),type:"deliver",qty:"1",salePrice:"",feeRate:"30",memo:""});
  };

  const openEditConsign = (r)=>{
    setCf({ productId:String(r.productId), consigneeId:String(r.consigneeId), date:r.date, type:r.type, qty:String(r.qty), salePrice:String(r.salePrice||""), feeRate:String(r.feeRate||""), memo:r.memo||"" });
    setEditingConsignId(r.id);
    setModal("consign");
  };

  const openQuickSale = (pr, cnId, currentStock)=>{
    // 直近の納品記録から販売価格・手数料を取得
    const lastDeliver = [...consignRecords]
      .filter(r=>r.productId===pr.id && r.consigneeId===cnId && r.type==="deliver")
      .sort((a,b)=>b.date.localeCompare(a.date))[0];
    setCf({
      productId: String(pr.id),
      consigneeId: String(cnId),
      date: today(),
      type: "sale",
      qty: String(currentStock > 0 ? currentStock : 1),
      salePrice: String(lastDeliver?.salePrice || ""),
      feeRate: String(lastDeliver?.feeRate ?? 30),
      memo: "",
    });
    setEditingConsignId(null);
    setShowNewCnee(false);
    setModal("consign");
  };

  const saveConsign = ()=>{
    if(!cf.productId||!cf.consigneeId||!cf.date||!cf.qty) return;
    const base = {productId:+cf.productId,consigneeId:+cf.consigneeId,date:cf.date,type:cf.type,qty:+cf.qty,salePrice:+cf.salePrice||0,feeRate:+cf.feeRate||0,memo:cf.memo};
    const cnee = consignees.find(c=>c.id===+cf.consigneeId);
    const isSale = cf.type==="sale";
    const linkedSaleFields = {productId:+cf.productId,date:cf.date,channel:cnee?.name||`委託先ID:${cf.consigneeId}`,qty:+cf.qty,price:+cf.salePrice||0,feeRate:+cf.feeRate||0,shippingActual:0,memo:cf.memo};
    if(editingConsignId) {
      setConsignRecords(ps=>ps.map(r=>r.id===editingConsignId?{...r,...base}:r));
      if(isSale) {
        setSales(ss=>{
          const e=ss.find(s=>s.consignRecordId===editingConsignId);
          if(e) return ss.map(s=>s.consignRecordId===editingConsignId?{...s,...linkedSaleFields}:s);
          return [...ss,{id:nextId(),...linkedSaleFields,consignRecordId:editingConsignId}];
        });
      } else {
        setSales(ss=>ss.filter(s=>s.consignRecordId!==editingConsignId));
      }
    } else {
      const newConsign = {id:nextId(),...base};
      setConsignRecords(p=>[...p,newConsign]);
      if(isSale) {
        setSales(ss=>[...ss,{id:nextId(),...linkedSaleFields,consignRecordId:newConsign.id}]);
      }
    }
    closeConsignModal();
  };

  const deleteConsign = (id)=>{
    if(confirm("この委託記録を削除しますか？")) {
      setConsignRecords(p=>p.filter(r=>r.id!==id));
      setSales(ss=>ss.filter(s=>s.consignRecordId!==id));
      closeConsignModal();
    }
  };
  const [editingRecipeId, setEditingRecipeId] = useState(null);

  const closeRecipeModal = ()=>{
    setModal(null);
    setEditingRecipeId(null);
    setRf({name:"",desc:"",cat:"",shippingCost:"",laborCost:"",ingredients:[{partId:"",qty:""}]});
    setShowNewProdCat(false);
    setNewProdCatInput("");
    setRecipeCatFilter("");
  };

  const openEditRecipe = (pr)=>{
    setRf({
      name: pr.name,
      desc: pr.desc||"",
      cat:  pr.cat||"",
      shippingCost: String(pr.shippingCost||""),
      laborCost: String(pr.laborCost||""),
      ingredients: pr.ingredients.map(i=>({partId:String(i.partId),qty:String(i.qty)})),
    });
    setEditingRecipeId(pr.id);
    setModal("recipe");
  };

  const addRecipe = ()=>{
    if(!rf.name||rf.ingredients.some(i=>!i.partId||!i.qty)) return;
    const data = {
      name: rf.name,
      desc: rf.desc,
      cat:  rf.cat||"",
      ingredients: rf.ingredients.map(i=>({partId:+i.partId,qty:+i.qty})),
      shippingCost: +rf.shippingCost||0,
      laborCost: +rf.laborCost||0,
    };
    if(editingRecipeId) {
      setProducts(ps=>ps.map(p=>p.id===editingRecipeId ? {...p,...data} : p));
    } else {
      setProducts(p=>[...p,{id:nextId(),...data}]);
    }
    closeRecipeModal();
  };

  const deleteRecipe = (id)=>{
    const linked = made.filter(m=>m.productId===id).length;
    const msg = linked>0
      ? `このレシピを削除しますか？\n紐づく制作記録 ${linked} 件があります。`
      : "このレシピを削除しますか？";
    if(confirm(msg)){
      setProducts(ps=>ps.filter(p=>p.id!==id));
      closeRecipeModal();
    }
  };

  // ── 部品カテゴリ（マスター管理 + 既存データからのフォールバック） ──
  const partCats = useMemo(()=>{
    const fromParts = parts.map(p=>p.cat).filter(c=>c&&!partCatMaster.includes(c));
    return [...partCatMaster, ...new Set(fromParts)];
  },[parts, partCatMaster]);

  // ── 作品カテゴリ（マスター管理 + 既存データからのフォールバック） ──
  const productCats = useMemo(()=>{
    const fromProds = products.map(p=>p.cat).filter(c=>c&&!productCatMaster.includes(c));
    return [...productCatMaster, ...new Set(fromProds)];
  },[products, productCatMaster]);

  const suppliers = useMemo(()=>{
    const base = purchases.map(p=>p.supplier).filter(s=>s&&s.trim());
    return [...new Set(base)].sort();
  },[purchases]);

  // ── 部品マスタ追加・編集 ────────────────────────────────────────────
  const [partForm,      setPartForm]      = useState({ cat:"金具", name:"", variant:"", unit:"個", hinban:"", minStock:"10", type:"", parentId:"", location:"" });
  const [newCatInput,   setNewCatInput]   = useState("");   // カテゴリ新規入力欄
  const [showNewCat,    setShowNewCat]    = useState(false);
  const [editingPartId, setEditingPartId] = useState(null); // null=新規, id=編集中

  // ── 仕入先入力管理 ────────────────────────────────────────────
  const [showNewSupplier, setShowNewSupplier] = useState(false);

  const openEditPart = (p) => {
    setPartForm({ cat: p.cat, name: p.name, variant: p.variant, unit: p.unit, hinban: p.hinban||"", minStock: String(p.minStock ?? MIN_STOCK[p.id] ?? 10), type: p.type ?? "", parentId: p.parentId ? String(p.parentId) : "", location: p.location||"" });
    setEditingPartId(p.id);
    setShowNewCat(false);
    setNewCatInput("");
    setModal("part");
  };

  const closePartModal = () => {
    setModal(null);
    setEditingPartId(null);
    setShowNewCat(false);
    setNewCatInput("");
    setShowNewPartLoc(false);
    setNewPartLocInput("");
  };

  const addPart = () => {
    const cat = showNewCat ? newCatInput.trim() : partForm.cat;
    if(!partForm.name || !cat) return;
    const minStock = +partForm.minStock || 10;
    const type = partForm.type || undefined;
    const parentId = type === "part" && partForm.parentId ? +partForm.parentId : undefined;
    const location = partForm.location || undefined;
    if(editingPartId) {
      setParts(ps => ps.map(p => p.id===editingPartId ? { ...p, cat, name: partForm.name, variant: partForm.variant, unit: partForm.unit, hinban: partForm.hinban, minStock, type, parentId, location } : p));
    } else {
      const newPart = { id: nextId(), cat, name: partForm.name, variant: partForm.variant, unit: partForm.unit, hinban: partForm.hinban, minStock, type, parentId, location };
      setParts(p => [...p, newPart]);
    }
    setPartForm({ cat:"金具", name:"", variant:"", unit:"個", hinban:"", minStock:"10", type:"", parentId:"", location:"" });
    setNewCatInput("");
    setShowNewCat(false);
    setEditingPartId(null);
    setModal(null);
  };

  const deletePart = (id) => {
    if(confirm("この部品を削除しますか？\n関連する仕入・廃棄・使用記録は残ります。")) {
      setParts(ps => ps.filter(p => p.id !== id));
      closePartModal();
    }
  };

  // ── 加工記録 ──────────────────────────────────────────────────
  const PROC_INIT = { date:today(), inputPartId:"", inputQty:"", outputs:[{partId:"",qty:""}], lossQty:"", note:"" };
  const [procForm,       setProcForm]       = useState(PROC_INIT);
  const [editingProcId,  setEditingProcId]  = useState(null);

  const closeProcModal = () => {
    setModal(null);
    setEditingProcId(null);
    setProcForm(PROC_INIT);
  };

  const openEditProc = (pr) => {
    setProcForm({
      date:       pr.date,
      inputPartId:String(pr.inputPartId),
      inputQty:   String(pr.inputQty),
      outputs:    pr.outputs.map(o=>({partId:String(o.partId),qty:String(o.qty)})),
      lossQty:    pr.lossQty!=null ? String(pr.lossQty) : "",
      note:       pr.note||"",
    });
    setEditingProcId(pr.id);
    setModal("processing");
  };

  const saveProc = () => {
    if(!procForm.inputPartId||!procForm.inputQty||!procForm.date) return;
    const validOutputs = procForm.outputs.filter(o=>o.partId&&o.qty);
    if(validOutputs.length===0) return;
    const parsedInputQty = parseFraction(procForm.inputQty);
    if(isNaN(parsedInputQty)||parsedInputQty<=0) return;
    const record = {
      date:        procForm.date,
      inputPartId: +procForm.inputPartId,
      inputQty:    parsedInputQty,
      outputs:     validOutputs.map(o=>({partId:+o.partId,qty:+o.qty})),
      lossQty:     procForm.lossQty!=="" ? (()=>{ const v=parseFraction(procForm.lossQty); return isNaN(v)?0:v; })() : 0,
      note:        procForm.note,
    };
    if(editingProcId) {
      setProcessings(ps=>ps.map(p=>p.id===editingProcId ? {...record,id:editingProcId} : p));
    } else {
      setProcessings(ps=>[...ps,{...record,id:nextId()}]);
    }
    closeProcModal();
  };

  const deleteProc = (id) => {
    if(confirm("この加工記録を削除しますか？")) {
      setProcessings(ps=>ps.filter(p=>p.id!==id));
      closeProcModal();
    }
  };

  // ── 加工モーダル：残量プレビュー ─────────────────────────────────
  const procStockPreview = useMemo(()=>{
    if(!procForm.inputPartId) return null;
    const pid = +procForm.inputPartId;
    const current = partStockMap[pid]?.stock ?? 0;
    const parsed  = parseFraction(procForm.inputQty);
    if(isNaN(parsed)||parsed<=0) return { current, after:null, unit: parts.find(p=>p.id===pid)?.unit||"" };
    const after = current - parsed;
    return { current, parsed, after, unit: parts.find(p=>p.id===pid)?.unit||"", insufficient: after < 0 };
  },[procForm.inputPartId, procForm.inputQty, partStockMap, parts]);

  // ── 委託終了 ──────────────────────────────────────────────────
  const [consignEndData, setConsignEndData] = useState({ productId:"", consigneeId:"", qty:"", date:"", type:"return", memo:"" });

  const openConsignEnd = (pr, cnId, cs) => {
    setConsignEndData({ productId:String(pr.id), consigneeId:String(cnId), qty:String(cs), date:today(), type:"return", memo:"" });
    setModal("consign_end");
  };

  const saveConsignEnd = () => {
    const qty = +consignEndData.qty;
    if(!qty||!consignEndData.date) return;
    const rec = {
      id: nextId(),
      productId:   +consignEndData.productId,
      consigneeId: +consignEndData.consigneeId,
      date:        consignEndData.date,
      type:        consignEndData.type,
      qty,
      salePrice:   0,
      feeRate:     0,
      memo:        consignEndData.memo,
    };
    setConsignRecords(rs=>[...rs,rec]);
    setModal(null);
  };

  // ── 委託先新規追加 ────────────────────────────────────────────
  const [newCneeInput, setNewCneeInput] = useState({ name:"", address:"", memo:"" });
  const [showNewCnee,  setShowNewCnee]  = useState(false);

  const openEditConsignee = (cn) => {
    setConsigneeEditForm({ name:cn.name, address:cn.address||"", memo:cn.memo||"" });
    setEditingConsigneeId(cn.id);
    setModal("consignee_edit");
  };
  const saveConsignee = () => {
    if(!consigneeEditForm.name.trim()) return;
    setConsignees(cs=>cs.map(c=>c.id===editingConsigneeId ? {...c, name:consigneeEditForm.name.trim(), address:consigneeEditForm.address, memo:consigneeEditForm.memo} : c));
    setModal(null);
    setEditingConsigneeId(null);
  };
  const deleteConsignee = (id) => {
    const rec = consignRecords.filter(r=>r.consigneeId===id).length;
    const msg = rec>0
      ? `この委託先を削除しますか？\n紐づく委託記録 ${rec} 件も対象です。`
      : "この委託先を削除しますか？";
    if(confirm(msg)) {
      setConsignees(cs=>cs.filter(c=>c.id!==id));
      setConsignRecords(rs=>rs.filter(r=>r.consigneeId!==id));
      setSelectedConsigneeId(null);
      setModal(null);
      setEditingConsigneeId(null);
    }
  };

  const addConsignee = () => {
    if(!newCneeInput.name.trim()) return;
    const c = { id: nextId(), name: newCneeInput.name.trim(), address: newCneeInput.address, memo: newCneeInput.memo };
    setConsignees(p => [...p, c]);
    // 新しい委託先を cf にセット
    setCf(f => ({ ...f, consigneeId: String(c.id) }));
    setNewCneeInput({ name:"", address:"", memo:"" });
    setShowNewCnee(false);
  };

  const addIngRow    = ()=> setRf(f=>({...f,ingredients:[...f.ingredients,{partId:"",qty:""}]}));
  const removeIngRow = i  => setRf(f=>({...f,ingredients:f.ingredients.filter((_,j)=>j!==i)}));
  const updateIng    = (i,k,v)=> setRf(f=>({...f,ingredients:f.ingredients.map((r,j)=>j===i?{...r,[k]:v}:r)}));

  // ═══════════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="app">

        <div className="header">
          <div>
            <div className="h-logo">✦ Atelier Stock</div>
            <div className="h-sub">部品 管理システム</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
          {DRIVE_CLIENT_ID && (
            driveUser ? (
              <div className="h-drive-wrap">
                {driveUser.picture
                  ? <img src={driveUser.picture} className="h-drive-pic" alt={driveUser.name} title={driveUser.email}/>
                  : <span className="h-drive-init" title={driveUser.email}>{driveUser.name?.[0]}</span>
                }
                <span
                  className={`h-drive-dot ds-${driveStatus}`}
                  title={driveLastSync ? `最終同期: ${driveLastSync.toLocaleTimeString("ja-JP")}` : ({idle:"待機中",loading:"読み込み中",syncing:"同期中",ok:"同期済み",error:"同期エラー"}[driveStatus]||"")}
                />
                <button className="h-drive-out" onClick={handleDriveSignOut} title="Drive同期をサインアウト">
                  <i className="fal fa-sign-out-alt"/>
                </button>
              </div>
            ) : (
              <button className="h-drive-signin" onClick={handleDriveSignIn}>
                <i className="fab fa-google"/>同期
              </button>
            )
          )}
          <div style={{position:"relative"}}>
            <button className={`h-mgmt-btn${showMgmtMenu?" open":""}`} onClick={()=>setShowMgmtMenu(v=>!v)}>
              <i className="fal fa-cog"/>管理設定<i className={`fal fa-chevron-${showMgmtMenu?"up":"down"}`} style={{fontSize:9}}/>
            </button>
            {showMgmtMenu && (
              <>
                <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:149}} onClick={()=>setShowMgmtMenu(false)}/>
                <div className="mgmt-menu">
                  <button className="mgmt-menu-item" onClick={()=>{setMgmtPage("parts_master");setShowMgmtMenu(false);}}>
                    <i className="fal fa-boxes" style={{width:16,textAlign:"center"}}/>部品マスター
                  </button>
                  <button className="mgmt-menu-item" onClick={()=>{setMgmtPage("category_setting");setShowMgmtMenu(false);}}>
                    <i className="fal fa-tag" style={{width:16,textAlign:"center"}}/>カテゴリ設定
                  </button>
                  <button className="mgmt-menu-item" onClick={()=>{setMgmtPage("data_manage");setShowMgmtMenu(false);setImportFeedback(null);setJsonImportConfirm(null);setCsvImportPreview(null);}}>
                    <i className="fal fa-database" style={{width:16,textAlign:"center"}}/>データ管理
                  </button>
                </div>
              </>
            )}
          </div>
          </div>
        </div>

        {/* ════ DASHBOARD ════ */}
        {tab==="dashboard" && (
          <div className="sec">
            <div className="sec-title">今月のサマリー <span style={{fontSize:12,color:"var(--t2)",fontWeight:400}}>{THIS_MONTH.replace("-","年")}月</span></div>
            {alerts.length>0 && (
              <div className="alert-box">
                <div className="alert-ttl"><i className="fas fa-exclamation-triangle" style={{marginRight:6}}/>部品在庫アラート（{alerts.length}件）</div>
                {alerts.slice(0,4).map(p=>{
                  const {stock}=partStockMap[p.id];
                  const isMiddle = p.type==="part";
                  return (
                    <div className="alert-row" key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                      <span>
                        {p.name}（{p.variant}）
                        {p.type && <span style={{fontSize:9,marginLeft:4,padding:"1px 5px",borderRadius:4,background:"var(--s2)",color:"var(--ac)",border:"1px solid var(--bd)"}}>{isMiddle?"中間材":"母材"}</span>}
                        　残 <strong>{fmtStock(stock)}{p.unit}</strong> / 最低 {partMinStock(p)}{p.unit}
                      </span>
                      {isMiddle ? (
                        <button style={{flexShrink:0,fontSize:11,fontWeight:700,background:"var(--ok)",color:"#fff",border:"none",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontFamily:"inherit"}}
                          onClick={()=>openStockCreate(p)}><i className="fal fa-cut" style={{marginRight:4}}/>在庫作成</button>
                      ) : (
                        <button style={{flexShrink:0,fontSize:11,fontWeight:700,background:"var(--ac)",color:"#fff",border:"none",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontFamily:"inherit"}}
                          onClick={()=>openReplenish(p)}><i className="fal fa-cart-plus" style={{marginRight:4}}/>在庫補充</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* クイックアクションボタン */}
            <div class="sc-quickaction" style={{display:"flex",gap:6,marginBottom:13,flexWrap:"wrap"}}>
              {[
                {label:"仕入記録",  icon:"fal fa-cart-plus",   action:()=>setModal("purchase")},
                {label:"加工記録",  icon:"fal fa-cut",    action:()=>setModal("processing")},
                {label:"作品記録",  icon:"fal fa-gem",         action:()=>setModal("made")},
                {label:"売上記録",  icon:"fal fa-chart-line",  action:()=>setModal("sale")},
              ].map(b=>(
                <button class="btn-quickaction" key={b.label}
                  style={{flex:"1 1 auto",padding:"30px",border:"1px solid var(--bd)",borderRadius:8,background:"var(--sf)",color:"var(--tx)",fontSize:18,cursor:"pointer",fontFamily:"inherit",alignItems:"center",justifyContent:"center",gap:4,boxShadow:"var(--sh)"}}
                  onClick={b.action}>
                  <i className={b.icon} style={{display:"block",fontSize:30,marginBottom:8,color:"var(--ac)"}}/>
                  {b.label}
                </button>
              ))}
            </div>
            <div className="kpi-grid">
              <div className="kpi ac" style={{cursor:"pointer"}} onClick={()=>{setTab("sales");setSelectedYear(THIS_MONTH.slice(0,4));setSelectedChannel(null);}}>
                <div className="kl">今月の純利益</div>
                <div className="kv">¥{fmt(totalProfit)}</div>
                <div className="ks">手数料・送料差引後</div>
              </div>
              <div className="kpi" style={{cursor:"pointer"}} onClick={()=>{setTab("sales");setSelectedYear(THIS_MONTH.slice(0,4));setSelectedChannel(null);}}>
                <div className="kl">今月の売上</div>
                <div className="kv">¥{fmt(totalRev)}</div>
                <div className="ks">{ms.length}件</div>
              </div>
              <div className="kpi" style={{cursor:"pointer"}} onClick={()=>{setTab("sales");setSelectedYear(THIS_MONTH.slice(0,4));setSelectedChannel(null);}}>
                <div className="kl">利益率</div>
                <div className="kv">{pct(totalProfit,totalRev)}%</div>
                <div className="ks">売上比</div>
              </div>
              <div className="kpi" style={{cursor:"pointer"}} onClick={()=>setTab("parts")}>
                <div className="kl">要発注部品</div>
                <div className="kv" style={{color:alerts.length>0?"var(--low)":"var(--ok)"}}>{alerts.length}</div>
                <div className="ks">種類</div>
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-ttl">チャネル別 売上（今月）</div>
              {byChannel.length===0
                ? <div style={{color:"var(--t2)",fontSize:13,padding:"8px 0"}}>今月の売上データがありません</div>
                : byChannel.map(({ch,rev})=>(
                  <div className="bar-row" key={ch} style={{cursor:"pointer"}} onClick={()=>{setTab("sales");setSelectedYear(THIS_MONTH.slice(0,4));setSelectedChannel(ch);}}>
                    <div className="bar-lbl">{ch}</div>
                    <div className="bar-tr"><div className="bar-f" style={{width:`${pct(rev,maxRev)}%`,background:chColMap[ch]||"var(--t2)"}}/></div>
                    <div className="bar-v">¥{fmt(rev)}</div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ════ 部品在庫 ════ */}
        {tab==="parts" && (
          <div className="sec">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:13}}>
              <div className="sec-title" style={{marginBottom:0}}>部品在庫</div>
              <button style={{fontSize:11,background:"none",border:"1px solid var(--bd)",borderRadius:8,color:"var(--t2)",cursor:"pointer",padding:"5px 10px",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}} onClick={()=>{setHistoryTab("purchase");setMgmtPage("history");}}>
                <i className="fal fa-history"/>履歴参照
              </button>
            </div>
            <div className="filter-row">
              {["すべて",...partCats].map(c=><button key={c} className={`chip ${cat===c?"on":""}`} onClick={()=>setCat(c)}>{c}</button>)}
            </div>
            <div className="filter-row" style={{alignItems:"center"}}>
              <input className="si" placeholder="名前・バリエーションで検索" value={q} onChange={e=>setQ(e.target.value)}/>
            </div>
            <div className="filter-row" style={{marginBottom:8,flexWrap:"wrap",gap:4}}>
              <span style={{fontSize:10,color:"var(--t2)",whiteSpace:"nowrap"}}>並び順:</span>
              {[{val:"name",label:"名前順"},{val:"stock",label:"在庫順"},{val:"update",label:"更新順"},{val:"location",label:"保管場所順"}].map(s=>(
                <button key={s.val} className={`chip ${partSort===s.val?"on":""}`} onClick={()=>setPartSort(s.val)}>{s.label}</button>
              ))}
              <button
                className="chip"
                style={{marginLeft:4,minWidth:56,fontFamily:"inherit"}}
                onClick={()=>setPartSortDir(d=>d==="asc"?"desc":"asc")}
              >
                {partSortDir==="asc"
                  ? <><i className="fal fa-sort-amount-up-alt" style={{marginRight:3}}/>昇順</>
                  : <><i className="fal fa-sort-amount-down" style={{marginRight:3}}/>降順</>
                }
              </button>
            </div>
            {(()=>{
              // Build grouped list: 母材の直後に子（中間材）をソートして挿入
              const dir2 = partSortDir==="asc" ? 1 : -1;
              const lastDateOf2 = id => { const rs=purchases.filter(p=>p.partId===id); return rs.length?rs.reduce((mx,p)=>p.date>mx?p.date:mx,""):""; };
              const childSortFn = (a,b) => {
                if(partSort==="name")     return dir2 * a.name.localeCompare(b.name,"ja");
                if(partSort==="stock")    return dir2 * ((partStockMap[a.id]?.stock||0)-(partStockMap[b.id]?.stock||0));
                if(partSort==="update")   return dir2 * lastDateOf2(a.id).localeCompare(lastDateOf2(b.id));
                if(partSort==="location") return dir2 * (a.location||"").localeCompare(b.location||"","ja");
                return 0;
              };
              const shownIds = new Set();
              const rows = [];
              filteredParts.forEach(p=>{
                if(shownIds.has(p.id)) return;
                shownIds.add(p.id);
                if(p.type==="material"){
                  // 母材: 本体を追加し、子中間材を同じ基準でソートして直後に挿入
                  rows.push({p, isChild:false});
                  const children = parts.filter(c=>c.type==="part"&&c.parentId===p.id);
                  [...children].sort(childSortFn).forEach(child=>{
                    if(!shownIds.has(child.id)){
                      shownIds.add(child.id);
                      rows.push({p:child, isChild:true});
                    }
                  });
                } else if(p.type==="part" && p.parentId){
                  // 孤立中間材: 親が非表示でも isChild:true で表示
                  rows.push({p, isChild:true});
                } else {
                  // 通常の部品
                  rows.push({p, isChild:false});
                }
              });
              return rows.map(({p, isChild})=>{
                const {stock,avgPrice,supMap}=partStockMap[p.id]||{stock:0,avgPrice:0,supMap:new Map()};
                const st=partSt(p.id,stock);
                const totalBought = p.type==="material" ? purchases.filter(pu=>pu.partId===p.id).reduce((s,pu)=>s+pu.qty,0) : 0;
                const stockPct    = totalBought>0 ? Math.max(0,Math.min(100,Math.round(stock/totalBought*100))) : 0;
                const parentPart  = isChild ? parts.find(pp=>pp.id===p.parentId) : null;
                return (
                  <div key={p.id} style={isChild?{paddingLeft:16,position:"relative"}:{}}>
                    {isChild && <div style={{position:"absolute",left:8,top:0,bottom:0,width:2,background:"var(--bd)",borderRadius:2}}/>}
                    <div className={`pc ${st}`} style={isChild?{borderLeftColor:"var(--ac)",borderLeftWidth:3}:{}}>
                      <div style={{flex:1}}>
                        {isChild && parentPart && (
                          <div style={{fontSize:10,color:"var(--t2)",marginBottom:2,display:"flex",alignItems:"center",gap:4}}>
                            <span style={{color:"var(--ac)"}}>↳</span>
                            <span>{parentPart.name}{parentPart.hinban?` #${parentPart.hinban}`:""} の中間材</span>
                          </div>
                        )}
                        <div className="pn">{p.name} {p.hinban && <span style={{fontSize:"12px",color:"var(--t2)",fontWeight:400}}>#{p.hinban}</span>}</div>
                        <div className="pv">{p.variant}</div>
                        <span className="pbadge">{p.cat}</span>
                        {p.type && <span className="pbadge" style={{background:"var(--s2)",color:"var(--ac)",marginLeft:4}}>{p.type==="material"?"母材":p.type==="part"?"中間材":""}</span>}
                        <div className="price-avg">加重平均 ¥{fmtD(avgPrice)} / {p.unit}</div>
                        {p.type!=="part" && (supMap.size>1
                          ? <div className="price-row">{[...supMap.entries()].map(([s,pr])=><span key={s} style={{marginRight:8}}><i className="fal fa-box" style={{marginRight:3}}/>{s}：¥{pr}</span>)}</div>
                          : <div className="price-row"><i className="fal fa-box" style={{marginRight:4}}/>{[...supMap.keys()][0]||"—"}</div>
                        )}
                        {p.location && <div className="price-row"><i className="fal fa-map-marker-alt" style={{marginRight:4,color:"var(--ac)"}}/>{p.location}</div>}
                        {p.type==="material" && totalBought>0 && (
                          <div style={{marginTop:6}}>
                            <div style={{height:6,background:"var(--bd)",borderRadius:3,overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${stockPct}%`,background:stockPct>50?"var(--ok)":stockPct>20?"var(--warn)":"var(--low)",borderRadius:3,transition:"width .3s"}}/>
                            </div>
                            <div style={{fontSize:10,color:"var(--t2)",marginTop:2}}>{fmtStock(stock)}{p.unit} / {totalBought}{p.unit}（{stockPct}%）</div>
                          </div>
                        )}
                        <div style={{marginTop:6,display:"flex",gap:5,flexWrap:"wrap"}}>
                          <button style={{background:"none",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t2)",fontSize:12,cursor:"pointer",padding:"2px 8px",fontFamily:"inherit"}} onClick={()=>openEditPart(p)}><i className="fal fa-pen" style={{marginRight:4}}/>編集</button>
                          {p.type==="part"
                            ? <button style={{background:"var(--ok)",color:"#fff",border:"none",borderRadius:6,fontSize:12,cursor:"pointer",padding:"2px 8px",fontFamily:"inherit"}} onClick={()=>openStockCreate(p)}><i className="fal fa-cut" style={{marginRight:4}}/>加工</button>
                            : <button style={{background:"var(--ac)",color:"#fff",border:"none",borderRadius:6,fontSize:12,cursor:"pointer",padding:"2px 8px",fontFamily:"inherit"}} onClick={()=>openReplenish(p)}><i className="fal fa-cart-plus" style={{marginRight:4}}/>仕入</button>
                          }
                          <button style={{background:"none",color:"var(--low)",border:"1px solid var(--low)",borderRadius:6,fontSize:12,cursor:"pointer",padding:"2px 8px",fontFamily:"inherit"}} onClick={()=>{setDf({partId:String(p.id),date:today(),qty:"",reason:""});setEditingDisposalId(null);setModal("disposal");}}><i className="fal fa-trash" style={{marginRight:4}}/>廃棄</button>
                        </div>
                      </div>
                      <div className="psb">
                        <div className={`psn ${st}`}>{fmtStock(stock)}</div>
                        <div className="psu">{p.unit}</div>
                        <div className="psm">最低 {partMinStock(p)}</div>
                        <span className={`sbadge ${st}`}>{st==="low"?(p.type==="part"?"要加工":"要発注"):st==="warn"?"少なめ":"良好"}</span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* ════ 作品（在庫 + レシピ） ════ */}
        {tab==="prodstock" && (
          <div className="sec">
            <div className="sec-title">作品</div>
            <div className="sub-tabs">
              <button className={`stab ${subTab2==="stock"?"on":""}`} onClick={()=>setSubTab2("stock")}>在庫</button>
              <button className={`stab ${subTab2==="recipe"?"on":""}`} onClick={()=>setSubTab2("recipe")}>レシピ・原価</button>
            </div>
            {/* カテゴリフィルタ */}
            <div className="filter-row">
              {["すべて",...productCats.filter(c=>products.some(p=>p.cat===c))].map(c=>(
                <button key={c} className={`chip ${prodCatFilter===c?"on":""}`} onClick={()=>setProdCatFilter(c)}>{c}</button>
              ))}
            </div>

            {/* 作品在庫 */}
            {subTab2==="stock" && [...products].sort((a,b)=>(a.cat||"").localeCompare(b.cat||"")).filter(pr=>prodCatFilter==="すべて"||pr.cat===prodCatFilter).map(pr=>{
              const stk   = productStockMap[pr.id];
              const isOpen= open[`ps${pr.id}`];
              const cneeStocks = consignees.map(cn=>({
                cn, ...calcConsigneeStock(pr.id,cn.id,consignRecords),
              }));
              const totalConsign = cneeStocks.reduce((a,c)=>a+c.stock,0);
              const totalAll     = stk.hand + totalConsign;
              return (
                <div className="prod-stk-card" key={pr.id}>
                  <div className="prod-stk-header" onClick={()=>tog(`ps${pr.id}`)}>
                    <div>
                      <div className="prod-stk-name">{pr.name}{pr.cat&&<span className="pbadge" style={{marginLeft:6,fontSize:10}}>{pr.cat}</span>}</div>
                      <div className="prod-stk-desc">{pr.desc}</div>
                    </div>
                    <div className="prod-stk-right">
                      <div className="prod-stk-total">{totalAll}</div>
                      <div className="prod-stk-lbl">合計在庫（点）</div>
                      <div className="prod-stk-toggle">{isOpen?<><i className="fal fa-chevron-up" style={{marginRight:3}}/>閉じる</>:<><i className="fal fa-chevron-down" style={{marginRight:3}}/>内訳</>}</div>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="prod-stk-body">
                      <div className="stk-row"><span className="stk-row-lbl">制作累計</span><span className="stk-row-val">{stk.madeQty} 点</span></div>
                      <div className="stk-row"><span className="stk-row-lbl">直販済み</span><span className="stk-row-val" style={{color:"var(--t2)"}}>−{stk.soldQty} 点</span></div>
                      <div className="stk-row"><span className="stk-row-lbl">委託納品済み</span><span className="stk-row-val" style={{color:"var(--t2)"}}>−{stk.deliverQty} 点</span></div>
                      <div className="stk-row"><span className="stk-row-lbl">委託返品</span><span className="stk-row-val" style={{color:"var(--warn)"}}>＋{stk.returnQty} 点</span></div>
                      <div className="stk-divider"/>
                      <div className="stk-row" style={{fontWeight:700}}>
                        <span>手元在庫</span>
                        <span style={{fontFamily:"'DM Serif Display',serif",fontSize:20}}>{stk.hand} 点</span>
                      </div>
                      {/* 委託先ごとの在庫数のみ（詳細は委託タブへ） */}
                      {cneeStocks.filter(c=>c.stock>0).map(({cn,stock:cs})=>(
                        <div key={cn.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                          background:"var(--sf)",borderRadius:8,padding:"7px 10px",marginTop:7,
                          border:"1px solid var(--bd)"}}>
                          <span style={{fontSize:11,color:"var(--ac)",fontWeight:700}}><i className="fal fa-map-marker-alt" style={{marginRight:4}}/>{cn.name}</span>
                          <span style={{fontSize:11}}><strong style={{fontFamily:"'DM Serif Display',serif",fontSize:17}}>{cs}</strong> 点（委託中）</span>
                        </div>
                      ))}
                      {cneeStocks.filter(c=>c.stock>0).length===0 && (
                        <div style={{fontSize:11,color:"var(--t2)",marginTop:8}}>委託中の在庫はありません</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* レシピ・原価 */}
            {subTab2==="recipe" && [...products].sort((a,b)=>(a.cat||"").localeCompare(b.cat||"")).filter(pr=>prodCatFilter==="すべて"||pr.cat===prodCatFilter).map(pr=>{
              const cost  = productCostMap[pr.id];
              const isOpen= open[`rc${pr.id}`];
              const mats  = cost.breakdown.filter(b=>b.part?.cat!=="梱包材");
              const packs = cost.breakdown.filter(b=>b.part?.cat==="梱包材");
              return (
                <div className="recipe-card" key={pr.id}>
                  <div className="recipe-header" onClick={()=>tog(`rc${pr.id}`)}>
                    <div>
                      <div className="recipe-name">{pr.name}{pr.cat&&<span className="pbadge" style={{marginLeft:6,fontSize:10}}>{pr.cat}</span>}</div>
                      <div className="recipe-desc">{pr.desc}</div>
                    </div>
                    <div className="recipe-cost">
                      <div className="recipe-total">¥{fmt(cost.total)}</div>
                      <div className="recipe-lbl">原価合計</div>
                      <div className="recipe-toggle">{isOpen?<i className="fal fa-chevron-up"/>:<><i className="fal fa-chevron-down" style={{marginRight:3}}/>内訳</>}</div>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="recipe-body">
                      <div className="cost-sec-lbl">材料費</div>
                      {mats.map((b,i)=>(
                        <div className="cost-row" key={i}>
                          <span>{b.part?.name}<span className="cost-sub">× {b.qty}{b.part?.unit} @¥{fmtD(b.unitPrice)}</span></span>
                          <span>¥{fmt(b.lineCost)}</span>
                        </div>
                      ))}
                      <div className="cost-row" style={{justifyContent:"flex-end",fontSize:10,color:"var(--t2)"}}>小計 ¥{fmt(cost.partCost)}</div>
                      {packs.length>0 && <>
                        <div className="cost-sec-lbl" style={{marginTop:8}}>梱包費</div>
                        {packs.map((b,i)=>(
                          <div className="cost-row" key={i}>
                            <span>{b.part?.name}<span className="cost-sub">× {b.qty}{b.part?.unit} @¥{fmtD(b.unitPrice)}</span></span>
                            <span>¥{fmt(b.lineCost)}</span>
                          </div>
                        ))}
                        <div className="cost-row" style={{justifyContent:"flex-end",fontSize:10,color:"var(--t2)"}}>小計 ¥{fmt(cost.packCost)}</div>
                      </>}
                      <div className="cost-sec-lbl" style={{marginTop:8}}>その他</div>
                      <div className="cost-row"><span>想定送料</span><span>¥{fmt(cost.shippingCost)}</span></div>
                      <div className="cost-row"><span>人件費</span><span>¥{fmt(cost.laborCost)}</span></div>
                      <div className="cost-div"/>
                      <div className="cost-total-row"><span>原価合計</span><span>¥{fmt(cost.total)}</span></div>
                      <button style={{marginTop:10,width:"100%",padding:"7px 0",border:"1px solid var(--bd)",borderRadius:8,background:"none",color:"var(--t2)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>openEditRecipe(pr)}><i className="fal fa-pen" style={{marginRight:4}}/> レシピを編集</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ════ 委託管理 ════ */}
        {tab==="consign" && !selectedConsigneeId && (
          <div className="sec">
            <div className="sec-title">委託先一覧</div>
            {consignees.length===0 && <div className="empty">委託先が登録されていません</div>}
            {consignees.map(cn=>{
              const records = consignRecords.filter(r=>r.consigneeId===cn.id);
              const activeProds = products.map(pr=>({
                pr,
                ...calcConsigneeStock(pr.id,cn.id,consignRecords),
              })).filter(x=>x.stock>0);
              const totalStock = activeProds.reduce((a,x)=>a+x.stock,0);

              return (
                <div className="prod-stk-card" style={{cursor:"pointer"}} key={cn.id} onClick={()=>setSelectedConsigneeId(cn.id)}>
                  <div className="prod-stk-header">
                    <div>
                      <div className="prod-stk-name"><i className="fal fa-map-marker-alt" style={{marginRight:5}}/>{cn.name}</div>
                      {cn.address && <div className="prod-stk-desc">{cn.address}</div>}
                      {cn.memo && <div className="prod-stk-desc" style={{color:"var(--ac)"}}><i className="fal fa-sticky-note" style={{marginRight:4}}/>{cn.memo}</div>}
                    </div>
                    <div className="prod-stk-right">
                      <div className="prod-stk-total">{totalStock}</div>
                      <div className="prod-stk-lbl">委託在庫（点）</div>
                      <div className="prod-stk-toggle"><i className="fal fa-chevron-right" style={{marginRight:3}}/>詳細</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ════ 委託先詳細ページ ════ */}
        {tab==="consign" && selectedConsigneeId && (
          <div className="sec">
            {consignees.find(c=>c.id===selectedConsigneeId) && (()=>{
              const cn = consignees.find(c=>c.id===selectedConsigneeId);
              const records = [...consignRecords]
                .filter(r=>r.consigneeId===cn.id)
                .sort((a,b)=>b.date.localeCompare(a.date));
              const activeProds = products.map(pr=>({
                pr,
                ...calcConsigneeStock(pr.id,cn.id,consignRecords),
              })).filter(x=>x.stock>0);
              const totalStock = activeProds.reduce((a,x)=>a+x.stock,0);

              return (
                <>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
                    <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",padding:0}} onClick={()=>setSelectedConsigneeId(null)}><i className="fal fa-chevron-left"/></button>
                    <div style={{flex:1}}>
                      <div className="sec-title" style={{marginBottom:0}}><i className="fal fa-map-marker-alt" style={{marginRight:5}}/>{cn.name}</div>
                      {cn.address && <div className="prod-stk-desc">{cn.address}</div>}
                      {cn.memo && <div className="prod-stk-desc" style={{color:"var(--ac)"}}><i className="fal fa-sticky-note" style={{marginRight:4}}/>{cn.memo}</div>}
                    </div>
                    <button style={{flexShrink:0,background:"none",border:"1px solid var(--bd)",borderRadius:8,color:"var(--t2)",fontSize:11,cursor:"pointer",padding:"5px 10px",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}
                      onClick={()=>openEditConsignee(cn)}><i className="fal fa-pen"/>店舗編集</button>
                  </div>

                  {/* 在庫サマリ */}
                  <div className="chart-card" style={{marginBottom:16}}>
                    <div className="chart-ttl">現在庫（商品別）</div>
                    <div style={{fontSize:11,color:"var(--t2)",marginBottom:10}}>合計 <strong style={{fontSize:13,color:"var(--ac)"}}>{totalStock}点</strong></div>
                    {activeProds.length===0 ? (
                      <div style={{fontSize:11,color:"var(--t2)",textAlign:"center",padding:"12px 0"}}>委託中の在庫がありません</div>
                    ) : (
                      activeProds.map(({pr,deliver,sale,ret,loss,stock:cs})=>(
                        <div key={pr.id} style={{background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:8,padding:"9px 11px",marginBottom:7}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                            <span style={{fontSize:12,fontWeight:700}}>{pr.name}</span>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              {cs>0 && (
                                <button style={{fontSize:11,fontWeight:700,background:"var(--ac)",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit"}}
                                  onClick={()=>openQuickSale(pr,cn.id,cs)}>売上計上</button>
                              )}
                              {cs>0 && (
                                <button style={{fontSize:11,fontWeight:700,background:"none",color:"var(--low)",border:"1px solid var(--low)",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit"}}
                                  onClick={()=>openConsignEnd(pr,cn.id,cs)}><i className="fal fa-flag-checkered" style={{marginRight:4}}/>委託終了</button>
                              )}
                              <span style={{fontFamily:"'DM Serif Display',serif",fontSize:20}}>{cs}<span style={{fontSize:9,fontWeight:400,color:"var(--t2)",marginLeft:3}}>点</span></span>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:10,fontSize:9,color:"var(--t2)"}}>
                            <span>納品 <strong>{deliver}</strong></span>
                            <span style={{color:"var(--ok)"}}>売上 −<strong>{sale}</strong></span>
                            {ret>0 && <span style={{color:"var(--warn)"}}>返品 −<strong>{ret}</strong></span>}
                            {loss>0 && <span style={{color:"var(--low)"}}>ロス −<strong>{loss}</strong></span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* 入出庫履歴 */}
                  <div className="chart-card">
                    <div className="chart-ttl">入出庫履歴</div>
                    {records.length===0 ? (
                      <div style={{fontSize:11,color:"var(--t2)",textAlign:"center",padding:"12px 0"}}>記録がありません</div>
                    ) : (
                      records.map(r=>{
                        const pr = products.find(p=>p.id===r.productId);
                        const typeCol = CONSIGN_TYPE_COL[r.type]||"var(--t2)";
                        const typeLabel = CONSIGN_TYPE_LABEL[r.type]||r.type;
                        const isSale = r.type==="sale";
                        const isDeliver = r.type==="deliver";
                        return (
                          <div key={r.id} style={{background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:8,padding:"9px 11px",marginBottom:6}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                              <div>
                                <div style={{fontSize:12,fontWeight:700}}>{pr?.name||"—"}</div>
                                <div style={{fontSize:9,color:"var(--t2)",marginTop:2}}>{r.date}</div>
                              </div>
                              <div style={{textAlign:"right",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                                <span style={{fontSize:9,fontWeight:700,color:typeCol,background:`${typeCol}18`,padding:"2px 7px",borderRadius:6}}>{typeLabel}</span>
                                <div style={{fontSize:13,fontWeight:700}}>
                                  {r.type==="deliver"?"＋":r.type==="return"?"＋":"−"}{r.qty}点
                                </div>
                                <button style={{background:"none",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t2)",fontSize:11,cursor:"pointer",padding:"2px 8px",fontFamily:"inherit"}} onClick={()=>openEditConsign(r)}><i className="fal fa-pen" style={{marginRight:4}}/> 編集</button>
                              </div>
                            </div>
                            {(isSale||isDeliver) && r.salePrice>0 && (
                              <div style={{fontSize:9,color:"var(--t2)",marginTop:5,paddingTop:4,borderTop:"1px solid var(--bd)",display:"flex",gap:10}}>
                                <span>販売価格 ¥{fmt(r.salePrice)}</span>
                                <span>手数料 {r.feeRate}%</span>
                                {isSale && <span style={{color:"var(--ok)",fontWeight:700}}>入金 ¥{fmt(Math.round(r.salePrice*(1-r.feeRate/100))*r.qty)}</span>}
                              </div>
                            )}
                            {r.memo && <div style={{fontSize:9,color:"var(--t2)",marginTop:4}}><i className="fal fa-sticky-note" style={{marginRight:4}}/>{r.memo}</div>}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ════ 素材加工履歴 ════ */}
        {tab==="records" && (
          <div className="sec">
            <div className="sec-title">素材加工履歴</div>
            {processings.length===0 && <div className="empty">加工記録の履歴はありません</div>}
            {(()=>{
              // 母材ごとにグループ化（親素材の親子関係でソート）
              const sorted = [...processings].sort((a,b)=>b.date.localeCompare(a.date));
              const groups = [];
              const seen = new Map();
              sorted.forEach(pr=>{
                if(!seen.has(pr.inputPartId)){
                  seen.set(pr.inputPartId, groups.length);
                  groups.push({ inputPartId: pr.inputPartId, records: [] });
                }
                groups[seen.get(pr.inputPartId)].records.push(pr);
              });
              // 母材の parentId でソート（親素材を持つ母材を先に）
              groups.sort((a,b)=>{
                const pa = parts.find(p=>p.id===a.inputPartId);
                const pb = parts.find(p=>p.id===b.inputPartId);
                const nameA = (pa?.parentId?`0_${pa.parentId}_${pa.name}`:(`1_${pa?.name||""}`));
                const nameB = (pb?.parentId?`0_${pb.parentId}_${pb.name}`:(`1_${pb?.name||""}`));
                return nameA.localeCompare(nameB);
              });
              return groups.map(({inputPartId, records})=>{
                const inPart = parts.find(p=>p.id===inputPartId);
                const parentPart = inPart?.parentId ? parts.find(p=>p.id===inPart.parentId) : null;
                return (
                  <div key={inputPartId} style={{marginBottom:12}}>
                    <div style={{fontSize:11,fontWeight:700,color:"var(--ac)",padding:"4px 0 6px",borderBottom:"1px solid var(--bd)",marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
                      {parentPart && <span style={{color:"var(--t2)"}}>{parentPart.name} →</span>}
                      <span>{inPart?.name||"—"}</span>
                      {inPart?.hinban&&<span style={{color:"var(--t2)",fontWeight:400}}>#{inPart.hinban}</span>}
                      <span style={{color:"var(--t2)",fontWeight:400,marginLeft:"auto"}}>{records.length}件</span>
                    </div>
                    {records.map(pr=>(
                      <div className="rc" key={pr.id}>
                        <div className="rc-top">
                          <div>
                            <div className="rc-name">{inPart?.name||"—"}<span style={{fontSize:11,color:"var(--t2)",marginLeft:6}}>×{pr.inputQty}{inPart?.unit}</span></div>
                            <div className="rc-meta">{pr.date}</div>
                          </div>
                          <button style={{background:"none",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t2)",fontSize:12,cursor:"pointer",padding:"2px 8px",fontFamily:"inherit",flexShrink:0}} onClick={()=>openEditProc(pr)}><i className="fal fa-pen" style={{marginRight:4}}/> 編集</button>
                        </div>
                        <div style={{marginTop:6,display:"flex",flexWrap:"wrap",gap:4}}>
                          {pr.outputs.map((o,i)=>{
                            const op=parts.find(p=>p.id===o.partId);
                            return <span key={i} style={{fontSize:11,background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:4,padding:"1px 7px",color:"var(--tx)"}}>{op?.name||"?"} ×{o.qty}</span>;
                          })}
                          {pr.lossQty>0&&<span style={{fontSize:11,background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:4,padding:"1px 7px",color:"var(--low)"}}>ロス {pr.lossQty}{inPart?.unit}</span>}
                        </div>
                        {pr.note&&<div className="rc-note"><i className="fal fa-sticky-note" style={{marginRight:4}}/>{pr.note}</div>}
                      </div>
                    ))}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* ════ 売上一覧 ════ */}
        {tab==="sales" && (
          <div className="sec">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div className="sec-title" style={{marginBottom:0}}>売上一覧</div>
              <select className="fs" style={{width:"auto",fontSize:13,padding:"5px 10px"}}
                value={selectedYear}
                onChange={e=>{setSelectedYear(e.target.value);setSelectedChannel(null);}}>
                {salesYears.map(y=><option key={y} value={y}>{y}年</option>)}
              </select>
            </div>
            <div className="sc-list">
              <div className={`sc ${selectedChannel===null?"active":""}`} onClick={()=>setSelectedChannel(null)}>
                <div className="sc-ch">すべて</div>
                <div className="sc-v" style={{color:"var(--tx)"}}>¥{fmt(yearSales.reduce((a,s)=>a+s.price*s.qty,0))}</div>
                <div className="sc-cnt">{yearSales.length}件</div>
              </div>
              {byChannelAll.map(({ch,rev,cnt})=>(
                <div className={`sc ${selectedChannel===ch?"active":""}`} key={ch} onClick={()=>setSelectedChannel(prev=>prev===ch?null:ch)}>
                  <div className="sc-ch">{ch}</div>
                  <div className="sc-v" style={{color:chColMap[ch]||"var(--tx)"}}>{rev>0?`¥${fmt(rev)}`:"—"}</div>
                  <div className="sc-cnt">{cnt}件</div>
                </div>
              ))}
            </div>
            {selectedChannel && (()=>{
              const chObj = channels.find(c=>c.name===selectedChannel);
              return (
                <div style={{fontSize:11,color:"var(--ac)",fontWeight:700,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                  <span>{selectedChannel} · {displayedSales.length}件</span>
                  {chObj && <button style={{fontSize:10,background:"none",border:"1px solid var(--bd)",borderRadius:5,color:"var(--t2)",cursor:"pointer",padding:"1px 7px",fontFamily:"inherit"}} onClick={()=>openEditChannel(chObj)}><i className="fal fa-pen" style={{marginRight:4}}/> 編集</button>}
                  <button style={{fontSize:10,background:"none",border:"1px solid var(--bd)",borderRadius:5,color:"var(--t2)",cursor:"pointer",padding:"1px 7px",fontFamily:"inherit"}} onClick={()=>setSelectedChannel(null)}><i className="fal fa-times" style={{marginRight:3}}/>解除</button>
                </div>
              );
            })()}
            {displayedSales.map(s=>{
              const calc  = calcSaleProfit(s,productCostMap,chFeeMap);
              const isOpen= open[`s${s.id}`];
              return (
                <div className="sale-card" key={s.id}>
                  <div className="sale-main" onClick={()=>tog(`s${s.id}`)}>
                    <div>
                      <div className="sale-name"><span className="sale-dot" style={{background:chColMap[s.channel]||"var(--t2)"}}/>{s.saleType==="order"?(s.orderName||"オーダー品"):prodName(s.productId)}{s.saleType==="order"&&<span style={{fontSize:9,background:"var(--md-tc)",border:"1px solid var(--md-otc)",borderRadius:4,padding:"1px 5px",marginLeft:5,color:"var(--md-otc)"}}>受注</span>}{s.consignRecordId&&<span style={{fontSize:9,background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:4,padding:"1px 5px",marginLeft:5,color:"var(--t2)"}}><i className="fal fa-map-marker-alt" style={{marginRight:2}}/>委託</span>}</div>
                      <div className="sale-meta">{s.date} · {s.channel} · {s.qty}点</div>
                    </div>
                    <div>
                      <div className="sale-rev">¥{fmt(calc.revenue)}</div>
                      <div className="sale-margin" style={{color:calc.profit>=0?"var(--ok)":"var(--low)"}}>利益 ¥{fmt(calc.profit)}（{calc.profitRate}%）</div>
                      <div className="sale-toggle">{isOpen?<i className="fal fa-chevron-up"/>:<><i className="fal fa-chevron-down"/> 明細</>}</div>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="sale-detail">
                      <div className="sd-row"><span className="sd-lbl">販売価格</span><span className="sd-val">¥{fmt(s.price)} × {s.qty}点</span></div>
                      <div className="sd-row"><span className="sd-lbl">売上合計</span><span className="sd-val">¥{fmt(calc.revenue)}</span></div>
                      <div className="sd-div"/>
                      <div className="sd-row"><span className="sd-lbl">原価</span><span className="sd-val" style={{color:"var(--low)"}}>−¥{fmt(calc.totalCost)}</span></div>
                      <div className="sd-row"><span className="sd-lbl">チャネル手数料（{calc.feeRate}%）</span><span className="sd-val" style={{color:"var(--low)"}}>−¥{fmt(calc.channelFee)}</span></div>
                      {s.shippingActual>0&&calc.shippingAdj!==0&&(
                        <div className="sd-row">
                          <span className="sd-lbl">送料差額（実費¥{fmt(s.shippingActual)}−想定¥{fmt(calc.estimatedShipping)}）</span>
                          <span className="sd-val" style={{color:calc.shippingAdj>0?"var(--low)":"var(--ok)"}}>
                            {calc.shippingAdj>0?`−¥${fmt(calc.shippingAdj)}`:`+¥${fmt(-calc.shippingAdj)}`}
                          </span>
                        </div>
                      )}
                      {s.shippingActual>0&&calc.shippingAdj===0&&(
                        <div className="sd-row"><span className="sd-lbl">送料（実費=想定 ¥{fmt(s.shippingActual)}）</span><span className="sd-val" style={{color:"var(--md-osv)"}}>±¥0</span></div>
                      )}
                      <div className="sd-div"/>
                      <div className="sd-total"><span>純利益</span><span style={{color:calc.profit>=0?"var(--ok)":"var(--low)"}}>¥{fmt(calc.profit)}（{calc.profitRate}%）</span></div>
                      {s.memo&&<div className="sd-memo"><i className="fal fa-sticky-note" style={{marginRight:4}}/>{s.memo}</div>}
                      <button style={{marginTop:8,width:"100%",padding:"7px 0",border:"1px solid var(--bd)",borderRadius:8,background:"none",color:"var(--t2)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>openEditSale(s)}><i className="fal fa-pen" style={{marginRight:4}}/> 編集</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ════ Navigation ════ */}
        <nav className="nav">
          {[
            { id:"dashboard", icon:"fal fa-home",       label:"HOME" },
            { id:"parts",     icon:"fal fa-boxes",      label:"部品在庫" },
            { id:"records",   icon:"fal fa-cut",   label:"素材加工" },
            { id:"prodstock", icon:"fal fa-gem",        label:"作品" },
            { id:"consign",   icon:"fal fa-store",      label:"委託" },
            { id:"sales",     icon:"fal fa-chart-line", label:"売上" },
          ].map(t=>(
            <button key={t.id} className={`nb ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}>
              <i className={`ni ${t.icon}`}/>
              {t.label}
            </button>
          ))}
        </nav>

        {/* FAB */}
        {tab==="parts"     && <button className="fab" onClick={()=>{setPartsAddTab("purchase");setModal("parts_add");}}><i className="fas fa-plus"/></button>}
        {tab==="records"   && <button className="fab" onClick={()=>setModal("processing")}><i className="fas fa-plus"/></button>}
        {tab==="sales"     && <button className="fab" onClick={()=>setModal("sale")}><i className="fas fa-plus"/></button>}
        {tab==="prodstock" && <button className="fab" onClick={()=>subTab2==="recipe"?setModal("recipe"):setModal("made")}><i className="fas fa-plus"/></button>}
        {tab==="consign"   && !selectedConsigneeId && <button className="fab" onClick={()=>setModal("consign")}><i className="fas fa-plus"/></button>}
        {tab==="consign"   && selectedConsigneeId && <button className="fab" onClick={()=>{setCf(f=>({...f,consigneeId:String(selectedConsigneeId)}));setModal("consign");}}><i className="fas fa-plus"/></button>}


        {/* ════ 部品マスタ登録・編集モーダル ════ */}
        {modal==="part" && (
          <div className="ov" onClick={e=>e.target===e.currentTarget&&closePartModal()}>
            <div className="modal">
              <div className="modal-title">{editingPartId ? "部品を編集" : "部品を登録"}</div>
              {!editingPartId && <div className="modal-sub">登録後、仕入記録から在庫を追加できます</div>}
              <div className="fr">
                <label className="fl">部品タイプ</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {[
                    {val:"",       label:"通常",       desc:"仕入れてそのまま使用"},
                    {val:"material",label:"母材",   desc:"加工前の素材（布・紐など）"},
                    {val:"part",   label:"中間材", desc:"母材から切り出した部品"},
                  ].map(opt=>(
                    <button key={opt.val}
                      className={`chip ${partForm.type===opt.val?"on":""}`}
                      onClick={()=>setPartForm(f=>({...f,type:opt.val,parentId:opt.val==="part"?f.parentId:""}))}
                      title={opt.desc}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>
              {partForm.type==="part" && (
                <div className="fr">
                  <label className="fl">親の母材</label>
                  <select className="fs" value={partForm.parentId} onChange={e=>{
                    const pid = e.target.value;
                    let hinban = partForm.hinban;
                    if(pid){
                      const parent = parts.find(p=>p.id===+pid);
                      if(parent && parent.hinban){
                        const children = parts.filter(p=>p.parentId===+pid);
                        const maxNum = children.reduce((mx,c)=>{
                          const suffix = c.hinban?.slice(parent.hinban.length+1);
                          const n = parseInt(suffix,10);
                          return isNaN(n)?mx:Math.max(mx,n);
                        },0);
                        hinban = `${parent.hinban}-${String(maxNum+1).padStart(3,"0")}`;
                      }
                    }
                    setPartForm(f=>({...f,parentId:pid,hinban}));
                  }}>
                    <option value="">選択しない</option>
                    {parts.filter(p=>p.type==="material").map(p=>(
                      <option key={p.id} value={p.id}>{p.name}（{p.variant}）{p.hinban?` #${p.hinban}`:""}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="fr">
                <label className="fl">品番</label>
                <input className="fi" placeholder="例: C-001" value={partForm.hinban} onChange={e=>setPartForm(f=>({...f,hinban:e.target.value}))}/>
              </div>
              <div className="fr">
                <label className="fl">カテゴリ *</label>
                {!showNewCat ? (
                  <div style={{display:"flex",gap:6}}>
                    <select className="fs" style={{flex:1}} value={partForm.cat} onChange={e=>setPartForm(f=>({...f,cat:e.target.value}))}>
                      {partCats.map(c=><option key={c}>{c}</option>)}
                    </select>
                    <button style={{flexShrink:0,padding:"0 10px",border:"1px dashed var(--ac)",borderRadius:8,background:"none",color:"var(--ac)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                      onClick={()=>setShowNewCat(true)}>＋ 新規</button>
                  </div>
                ) : (
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <input className="fi" style={{flex:1}} placeholder="新しいカテゴリ名" value={newCatInput} onChange={e=>setNewCatInput(e.target.value)} autoFocus/>
                    <button style={{flexShrink:0,padding:"0 10px",border:"1px solid var(--bd)",borderRadius:8,background:"none",color:"var(--t2)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                      onClick={()=>{setShowNewCat(false);setNewCatInput("");}}>戻る</button>
                  </div>
                )}
              </div>
              <div className="fr">
                <label className="fl">部品名 *</label>
                <input className="fi" placeholder="例: Cカン、丸カン、OPP袋" value={partForm.name} onChange={e=>setPartForm(f=>({...f,name:e.target.value}))}/>
              </div>
              <div className="fr">
                <label className="fl">バリエーション（素材 / サイズ / 色など）</label>
                <input className="fi" placeholder="例: ゴールド / 8mm / 真鍮" value={partForm.variant} onChange={e=>setPartForm(f=>({...f,variant:e.target.value}))}/>
              </div>
              <div className="fr">
                <label className="fl">単位 *</label>
                <select className="fs" value={partForm.unit} onChange={e=>setPartForm(f=>({...f,unit:e.target.value}))}>
                  {["個","枚","本","m","cm","㎡","㎠","ml","セット","袋"].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="fr">
                <label className="fl">最低在庫数</label>
                <input className="fi" type="number" min="0" placeholder="10" value={partForm.minStock} onChange={e=>setPartForm(f=>({...f,minStock:e.target.value}))}/>
              </div>
              <div className="fr">
                <label className="fl">保管場所</label>
                {!showNewPartLoc ? (
                  <div style={{display:"flex",gap:6}}>
                    <select className="fs" style={{flex:1}} value={partForm.location} onChange={e=>setPartForm(f=>({...f,location:e.target.value}))}>
                      <option value="">未設定</option>
                      {partLocMaster.map(l=><option key={l}>{l}</option>)}
                    </select>
                    <button style={{flexShrink:0,padding:"0 10px",border:"1px dashed var(--ac)",borderRadius:8,background:"none",color:"var(--ac)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                      onClick={()=>setShowNewPartLoc(true)}>＋ 新規</button>
                  </div>
                ) : (
                  <div style={{display:"flex",gap:6}}>
                    <input className="fi" style={{flex:1}} placeholder="例: 棚A、引き出し2段目" value={newPartLocInput} onChange={e=>setNewPartLocInput(e.target.value)} autoFocus/>
                    <button style={{flexShrink:0,padding:"5px 10px",border:"none",borderRadius:8,background:"var(--ac)",color:"#fff",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                      onClick={()=>{ const v=newPartLocInput.trim(); if(v&&!partLocMaster.includes(v)){setPartLocMaster(m=>[...m,v]);} if(v){setPartForm(f=>({...f,location:v}));} setNewPartLocInput(""); setShowNewPartLoc(false); }}>追加</button>
                    <button style={{flexShrink:0,padding:"0 10px",border:"1px solid var(--bd)",borderRadius:8,background:"none",color:"var(--t2)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                      onClick={()=>{setShowNewPartLoc(false);setNewPartLocInput("");}}>戻る</button>
                  </div>
                )}
              </div>
              <div className="div"/>
              <button className="btn-p" onClick={addPart}>{editingPartId ? "保存する" : "登録する"}</button>
              <button className="btn-c" onClick={closePartModal}>キャンセル</button>
              {editingPartId && <button className="btn-d" onClick={()=>deletePart(editingPartId)}>この部品を削除する</button>}
            </div>
          </div>
        )}

        {/* ════ 仕入モーダル ════ */}
        {modal==="purchase" && (
          <div className="ov" onClick={e=>e.target===e.currentTarget&&closePurchaseModal()}>
            <div className="modal">
              <div className="modal-title">{editingPurchaseId ? "仕入れを編集" : "仕入れを記録"}</div>
              <div className="fr"><label className="fl">カテゴリ</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                  <button className={`chip ${pfCat===""?"on":""}`} onClick={()=>{setPfCat("");setPf(f=>({...f,partId:""}));}}>すべて</button>
                  {[...new Set(parts.filter(p=>p.type!=="part").map(p=>p.cat))].map(c=>(
                    <button key={c} className={`chip ${pfCat===c?"on":""}`} onClick={()=>{setPfCat(c);setPf(f=>({...f,partId:""}));}}>{c}</button>
                  ))}
                </div>
              </div>
              <div className="fr"><label className="fl">部品 *</label>
                <select className="fs" value={pf.partId} onChange={e=>setPf(f=>({...f,partId:e.target.value}))}>
                  <option value="">選択してください</option>
                  {parts.filter(p=>p.type!=="part"&&(pfCat===""||p.cat===pfCat)).map(p=><option key={p.id} value={p.id}>{p.name}（{p.variant}）</option>)}
                </select>
              </div>
              <div className="fr2">
                <div className="fr"><label className="fl">仕入れ日 *</label><input className="fi" type="date" value={pf.date} onChange={e=>setPf(f=>({...f,date:e.target.value}))}/></div>
              </div>
              <div className="fr">
                <label className="fl">仕入れ先</label>
                {!showNewSupplier ? (
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                    {suppliers.map(s=>(
                      <button
                        key={s}
                        className={`chip ${pf.supplier===s?"on":""}`}
                        onClick={()=>setPf(f=>({...f,supplier:s}))}
                      >{s}</button>
                    ))}
                    <button
                      className="chip"
                      style={{borderStyle:"dashed",background:"transparent",color:"var(--ac)"}}
                      onClick={()=>setShowNewSupplier(true)}
                    >＋ 新規</button>
                  </div>
                ) : (
                  <div style={{display:"flex",gap:6,marginBottom:8}}>
                    <input className="fi" placeholder="新しい店舗名" value={pf.supplier} onChange={e=>setPf(f=>({...f,supplier:e.target.value}))} autoFocus style={{flex:1}}/>
                    <button style={{flexShrink:0,padding:"7px 10px",border:"1px solid var(--bd)",borderRadius:8,background:"none",color:"var(--t2)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                      onClick={()=>{setShowNewSupplier(false);setPf(f=>({...f,supplier:""}));}}>戻る</button>
                  </div>
                )}
              </div>
              <div className="fr2">
                <div className="fr"><label className="fl">部品数量 *</label><input className="fi" type="number" placeholder="0" value={pf.qty} onChange={e=>setPf(f=>({...f,qty:e.target.value}))}/></div>
                <div className="fr"><label className="fl">実購入額（税込・円）*</label><input className="fi" type="number" placeholder="0" value={pf.totalPrice} onChange={e=>setPf(f=>({...f,totalPrice:e.target.value}))}/></div>
              </div>
              {pf.qty&&pf.totalPrice && (()=>{
                const qty = +pf.qty;
                const totalPrice = +pf.totalPrice;
                const pricePerUnit = totalPrice / qty;
                const tax = totalPrice - Math.round(totalPrice / 1.1);
                const nontaxTotal = totalPrice - tax;
                const unitPrice = Math.round(pricePerUnit / 1.1 * 100) / 100;
                return (
                  <div className="preview-box">
                    <div className="prev-row">
                      <span className="prev-lbl">1個あたり（税込）</span>
                      <span className="prev-val">¥{fmtD(pricePerUnit)}</span>
                    </div>
                    <div className="prev-row">
                      <span className="prev-lbl">1個あたり（税抜）</span>
                      <span className="prev-val" style={{color:"var(--ac)"}}>¥{fmtD(unitPrice)}</span>
                    </div>
                    <div className="prev-div"/>
                    <div className="prev-row">
                      <span className="prev-lbl">合計（税抜）</span>
                      <span className="prev-val">¥{fmt(nontaxTotal)}</span>
                    </div>
                    <div className="prev-row">
                      <span className="prev-lbl">消費税（10%）</span>
                      <span className="prev-val" style={{color:"var(--t2)"}}>¥{fmt(tax)}</span>
                    </div>
                    <div className="prev-total">
                      <span>実購入額（税込）</span>
                      <span style={{color:"var(--ok)"}}>¥{fmt(totalPrice)}</span>
                    </div>
                  </div>
                );
              })()}
              <div className="fr"><label className="fl">メモ</label><input className="fi" placeholder="例: まとめ買い割引、納期注意" value={pf.note} onChange={e=>setPf(f=>({...f,note:e.target.value}))}/></div>
              <div className="div"/>
              <button className="btn-p" onClick={savePurchase}>{editingPurchaseId ? "保存する" : "記録 → 在庫に自動加算"}</button>
              <button className="btn-c" onClick={closePurchaseModal}>キャンセル</button>
              {editingPurchaseId && <button className="btn-d" onClick={()=>deletePurchase(editingPurchaseId)}>この仕入記録を削除する</button>}
            </div>
          </div>
        )}

        {/* ════ 廃棄モーダル ════ */}
        {modal==="disposal" && (
          <div className="ov" onClick={e=>e.target===e.currentTarget&&closeDisposalModal()}>
            <div className="modal">
              <div className="modal-title">{editingDisposalId ? "廃棄記録を編集" : "廃棄を記録"}</div>
              <div className="fr"><label className="fl">部品 *</label>
                <select className="fs" value={df.partId} onChange={e=>setDf(f=>({...f,partId:e.target.value}))}>
                  <option value="">選択してください</option>
                  {parts.map(p=>{ const {stock}=partStockMap[p.id]; return <option key={p.id} value={p.id}>{p.name}（{p.variant}）　残{fmtStock(stock)}{p.unit}</option>; })}
                </select>
              </div>
              <div className="fr2">
                <div className="fr"><label className="fl">廃棄日 *</label><input className="fi" type="date" value={df.date} onChange={e=>setDf(f=>({...f,date:e.target.value}))}/></div>
                <div className="fr"><label className="fl">廃棄数量 *</label><input className="fi" type="number" placeholder="0" value={df.qty} onChange={e=>setDf(f=>({...f,qty:e.target.value}))}/></div>
              </div>
              <div className="fr"><label className="fl">廃棄理由</label><input className="fi" placeholder="例: 変色・劣化" value={df.reason} onChange={e=>setDf(f=>({...f,reason:e.target.value}))}/></div>
              <div className="div"/>
              <button className="btn-p" onClick={saveDisposal}>{editingDisposalId ? "保存する" : "記録 → 在庫から自動減算"}</button>
              <button className="btn-c" onClick={closeDisposalModal}>キャンセル</button>
              {editingDisposalId && <button className="btn-d" onClick={()=>deleteDisposal(editingDisposalId)}>この廃棄記録を削除する</button>}
            </div>
          </div>
        )}

        {/* ════ 加工記録モーダル ════ */}
        {modal==="processing" && (
          <div className="ov" onClick={e=>e.target===e.currentTarget&&closeProcModal()}>
            <div className="modal">
              <div className="modal-title">{editingProcId ? "中間材の加工記録を編集" : "中間材の加工記録"}</div>
              <div className="modal-sub">母材 → 中間材への変換を記録します</div>

              <div className="fr"><label className="fl">加工日 *</label>
                <input className="fi" type="date" value={procForm.date} onChange={e=>setProcForm(f=>({...f,date:e.target.value}))}/>
              </div>

              <div className="fr"><label className="fl">使用した母材 *</label>
                {parts.filter(p=>p.type==="material").length===0 ? (
                  <div style={{background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:8,padding:"10px 12px",fontSize:12,color:"var(--t2)",lineHeight:1.6}}>
                    「母材」タイプの部品が登録されていません。<br/>
                    部品在庫タブで部品を編集し、タイプを <strong style={{color:"var(--ac)"}}>「母材」</strong> に設定してください。
                  </div>
                ) : (
                  <select className="fs" value={procForm.inputPartId} onChange={e=>setProcForm(f=>({...f,inputPartId:e.target.value}))}>
                    <option value="">選択してください</option>
                    {parts.filter(p=>p.type==="material").map(p=>{
                      const {stock}=partStockMap[p.id]||{stock:0};
                      return <option key={p.id} value={p.id}>{p.name}（{p.variant}） 残{fmtStock(stock)}{p.unit}</option>;
                    })}
                  </select>
                )}
              </div>

              <div className="fr"><label className="fl">使用量 *（{procForm.inputPartId ? parts.find(p=>p.id===+procForm.inputPartId)?.unit||"" : "—"}）<span style={{fontSize:10,color:"var(--t2)",fontWeight:400,marginLeft:4}}>小数・分数・%で入力可</span></label>
                <input className="fi" type="text" inputMode="decimal" placeholder="例: 0.5 / 1/3 / 25%" value={procForm.inputQty} onChange={e=>setProcForm(f=>({...f,inputQty:e.target.value}))}/>
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                {["1/2","1/3","1/4","1/5","2/3","3/4"].map(frac=>(
                  <button key={frac} className={`chip ${procForm.inputQty===frac?"on":""}`}
                    onClick={()=>setProcForm(f=>({...f,inputQty:frac}))}>{frac}</button>
                ))}
              </div>
              {procStockPreview && procStockPreview.after!==null && (
                <div style={{background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:8,padding:"7px 12px",marginBottom:8,fontSize:12}}>
                  <span style={{color:"var(--t2)"}}>現在在庫 {procStockPreview.current}{procStockPreview.unit}</span>
                  <span style={{margin:"0 6px",color:"var(--t2)"}}>→</span>
                  <span style={{fontWeight:700,color:procStockPreview.insufficient?"var(--low)":"var(--ok)"}}>
                    使用後 {Math.round(procStockPreview.after*1000)/1000}{procStockPreview.unit}
                    {procStockPreview.insufficient&&<> <i className="fas fa-exclamation-triangle" style={{marginLeft:4}}/>在庫不足</>}
                  </span>
                </div>
              )}

              <div className="fr"><label className="fl">切り出し結果 *</label>
                <div style={{width:"100%"}}>
                  {procForm.outputs.map((out,i)=>(
                    <div key={i} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
                      <select className="fs" style={{flex:2}} value={out.partId} onChange={e=>setProcForm(f=>({...f,outputs:f.outputs.map((o,j)=>j===i?{...o,partId:e.target.value}:o)}))}>
                        <option value="">部品を選択</option>
                        {(()=>{
                          const matId = +procForm.inputPartId;
                          const children = parts.filter(p=>p.type==="part"&&p.parentId===matId);
                          const others   = parts.filter(p=>p.type==="part"&&p.parentId!==matId);
                          return <>
                            {children.length>0 && <optgroup label="↳ この母材の中間材">
                              {children.map(p=><option key={p.id} value={p.id}>{p.name}（{p.variant}）</option>)}
                            </optgroup>}
                            {others.length>0 && <optgroup label="その他の中間材">
                              {others.map(p=><option key={p.id} value={p.id}>{p.name}（{p.variant}）</option>)}
                            </optgroup>}
                          </>;
                        })()}
                      </select>
                      <input className="fi" type="number" placeholder="数量" style={{flex:1,minWidth:0}} value={out.qty} onChange={e=>setProcForm(f=>({...f,outputs:f.outputs.map((o,j)=>j===i?{...o,qty:e.target.value}:o)}))}/>
                      {procForm.outputs.length>1&&<button style={{flexShrink:0,padding:"4px 8px",border:"1px solid var(--bd)",borderRadius:6,background:"none",color:"var(--low)",cursor:"pointer",fontSize:13}} onClick={()=>setProcForm(f=>({...f,outputs:f.outputs.filter((_,j)=>j!==i)}))}><i className="fal fa-times"/></button>}
                    </div>
                  ))}
                  <button style={{width:"100%",padding:"6px 0",border:"1px dashed var(--ac)",borderRadius:8,background:"none",color:"var(--ac)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}
                    onClick={()=>setProcForm(f=>({...f,outputs:[...f.outputs,{partId:"",qty:""}]}))}>＋ 切り出し結果を追加</button>
                </div>
              </div>

              <div className="fr"><label className="fl">ロス量（廃棄・端切れ）<span style={{fontSize:10,color:"var(--t2)",fontWeight:400,marginLeft:4}}>小数・分数・%で入力可</span></label>
                <input className="fi" type="text" inputMode="decimal" placeholder="例: 0.05 / 1/20 / 5%" value={procForm.lossQty} onChange={e=>setProcForm(f=>({...f,lossQty:e.target.value}))}/>
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
                {["1/10","1/20","1/4","1/5","1/2","3/4"].map(frac=>(
                  <button key={frac} className={`chip ${procForm.lossQty===frac?"on":""}`}
                    onClick={()=>setProcForm(f=>({...f,lossQty:frac}))}>{frac}</button>
                ))}
              </div>
              <div className="fr"><label className="fl">メモ</label>
                <input className="fi" placeholder="例: A布 0.5m → 1cm角×100枚" value={procForm.note} onChange={e=>setProcForm(f=>({...f,note:e.target.value}))}/>
              </div>
              <div className="div"/>
              <button className="btn-p" onClick={saveProc}>{editingProcId ? "保存する" : "記録する"}</button>
              <button className="btn-c" onClick={closeProcModal}>キャンセル</button>
              {editingProcId && <button className="btn-d" onClick={()=>deleteProc(editingProcId)}>この加工記録を削除する</button>}
            </div>
          </div>
        )}

        {/* ════ 作品制作モーダル ════ */}
        {modal==="made" && (()=>{
          const selProd = products.find(p=>p.id===+mf.productId);
          const prodQty = +mf.qty||1;
          return (
          <div className="ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
            <div className="modal">
              <div className="modal-title">作品を制作</div>
              <div className="modal-sub">制作した分だけ作品在庫が増えます</div>
              <div className="fr"><label className="fl">商品 *</label>
                <select className="fs" value={mf.productId} onChange={e=>{
                  const prod = products.find(p=>p.id===+e.target.value);
                  const checkedParts = prod ? Object.fromEntries(prod.ingredients.map(ing=>[ing.partId,true])) : {};
                  setMf(f=>({...f,productId:e.target.value,checkedParts,extraParts:[],lossParts:[]}));
                }}>
                  <option value="">選択してください</option>
                  {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="fr2">
                <div className="fr"><label className="fl">制作日 *</label><input className="fi" type="date" value={mf.date} onChange={e=>setMf(f=>({...f,date:e.target.value}))}/></div>
                <div className="fr"><label className="fl">制作数 *</label><input className="fi" type="number" min="1" placeholder="1" value={mf.qty} onChange={e=>setMf(f=>({...f,qty:e.target.value}))}/></div>
              </div>

              {selProd && selProd.ingredients.length>0 && (
                <div className="made-sec">
                  <div className="made-sec-ttl">
                    <span>レシピ部品 - 使わなかったものをタップして解除</span>
                    <span style={{fontWeight:400,color:"var(--ac)"}}>チェック済 = 在庫から差し引き</span>
                  </div>
                  <div className="part-chips">
                    {selProd.ingredients.map(ing=>{
                      const part = parts.find(p=>p.id===ing.partId);
                      const used = !!mf.checkedParts[ing.partId];
                      const totalQty = ing.qty * prodQty;
                      return (
                        <button
                          key={ing.partId}
                          className={used ? "part-chip-used" : "part-chip-unused"}
                          onClick={()=>setMf(f=>({...f,checkedParts:{...f.checkedParts,[ing.partId]:!f.checkedParts[ing.partId]}}))}
                        >
                          {used ? "✓ " : ""}{part?.name||`ID:${ing.partId}`} × {totalQty}{part?.unit}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="made-sec">
                <div className="made-sec-ttl">追加した部品（レシピ外・多く使った分）</div>
                {mf.extraParts.map((ep,i)=>(
                  <div className="ing-row" key={i}>
                    <select className="fs" value={ep.partId} onChange={e=>setMf(f=>({...f,extraParts:f.extraParts.map((r,j)=>j===i?{...r,partId:e.target.value}:r)}))}>
                      <option value="">部品を選択</option>
                      {parts.map(p=>{ const {stock}=partStockMap[p.id]; return <option key={p.id} value={p.id}>{p.name}（{p.variant}）残{fmtStock(stock)}{p.unit}</option>; })}
                    </select>
                    <input className="fi" type="number" min="1" placeholder="数量" style={{width:64,flex:"none"}} value={ep.qty} onChange={e=>setMf(f=>({...f,extraParts:f.extraParts.map((r,j)=>j===i?{...r,qty:e.target.value}:r)}))}/>
                    {ep.partId && <span style={{fontSize:10,color:"var(--t2)"}}>{parts.find(p=>p.id===+ep.partId)?.unit}</span>}
                    <button className="ing-del" onClick={()=>setMf(f=>({...f,extraParts:f.extraParts.filter((_,j)=>j!==i)}))}><i className="fal fa-times"/></button>
                  </div>
                ))}
                <button className="add-row-btn" onClick={()=>setMf(f=>({...f,extraParts:[...f.extraParts,{partId:"",qty:""}]}))}>＋ 部品を追加</button>
              </div>

              <div className="made-sec">
                <div className="made-sec-ttl">ロス部品（失敗・廃棄した材料）</div>
                {mf.lossParts.map((lp,i)=>(
                  <div className="ing-row" key={i}>
                    <select className="fs" value={lp.partId} onChange={e=>setMf(f=>({...f,lossParts:f.lossParts.map((r,j)=>j===i?{...r,partId:e.target.value}:r)}))}>
                      <option value="">部品を選択</option>
                      {parts.map(p=>{ const {stock}=partStockMap[p.id]; return <option key={p.id} value={p.id}>{p.name}（{p.variant}）残{fmtStock(stock)}{p.unit}</option>; })}
                    </select>
                    <input className="fi" type="number" min="1" placeholder="数量" style={{width:64,flex:"none"}} value={lp.qty} onChange={e=>setMf(f=>({...f,lossParts:f.lossParts.map((r,j)=>j===i?{...r,qty:e.target.value}:r)}))}/>
                    {lp.partId && <span style={{fontSize:10,color:"var(--t2)"}}>{parts.find(p=>p.id===+lp.partId)?.unit}</span>}
                    <button className="ing-del" onClick={()=>setMf(f=>({...f,lossParts:f.lossParts.filter((_,j)=>j!==i)}))}><i className="fal fa-times"/></button>
                  </div>
                ))}
                <button className="add-row-btn" onClick={()=>setMf(f=>({...f,lossParts:[...f.lossParts,{partId:"",qty:""}]}))}>＋ 部品を追加</button>
              </div>

              <div className="fr" style={{marginTop:12}}><label className="fl">メモ</label><input className="fi" placeholder="例: 追加制作、試作品など" value={mf.note} onChange={e=>setMf(f=>({...f,note:e.target.value}))}/></div>
              <div className="div"/>
              <button className="btn-p" onClick={addMade}>記録 → 作品在庫に加算</button>
              <button className="btn-c" onClick={()=>{setMf(MF_INIT);setModal(null);}}>キャンセル</button>
            </div>
          </div>
          );
        })()}

        {/* ════ 委託記録モーダル ════ */}
        {modal==="consign" && (
          <div className="ov" onClick={e=>e.target===e.currentTarget&&closeConsignModal()}>
            <div className="modal">
              <div className="modal-title">{editingConsignId ? "委託記録を編集" : "委託記録を追加"}</div>
              <div className="fr"><label className="fl">商品 *</label>
                <select className="fs" value={cf.productId} onChange={e=>setCf(f=>({...f,productId:e.target.value}))}>
                  <option value="">選択してください</option>
                  {products.map(p=><option key={p.id} value={p.id}>{p.name}　（手元: {productStockMap[p.id]?.hand||0}点）</option>)}
                </select>
              </div>
              <div className="fr"><label className="fl">委託先 *</label>
                {!showNewCnee ? (
                  <div style={{display:"flex",gap:6}}>
                    <select className="fs" style={{flex:1}} value={cf.consigneeId} onChange={e=>setCf(f=>({...f,consigneeId:e.target.value}))}>
                      <option value="">選択してください</option>
                      {consignees.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button style={{flexShrink:0,padding:"0 10px",border:"1px dashed var(--ac)",borderRadius:8,background:"none",color:"var(--ac)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                      onClick={()=>setShowNewCnee(true)}>＋ 新規</button>
                  </div>
                ) : (
                  <div style={{background:"var(--s2)",borderRadius:9,padding:"10px 11px",marginTop:2}}>
                    <div style={{fontSize:10,color:"var(--ac)",fontWeight:700,marginBottom:8}}>新しい委託先を登録</div>
                    <div className="fr"><label className="fl">委託先名 *</label>
                      <input className="fi" placeholder="例: ギャラリーABC" value={newCneeInput.name} onChange={e=>setNewCneeInput(f=>({...f,name:e.target.value}))} autoFocus/>
                    </div>
                    <div className="fr"><label className="fl">住所・場所</label>
                      <input className="fi" placeholder="例: 札幌市中央区" value={newCneeInput.address} onChange={e=>setNewCneeInput(f=>({...f,address:e.target.value}))}/>
                    </div>
                    <div className="fr"><label className="fl">メモ（締め日・手数料率など）</label>
                      <input className="fi" placeholder="例: 月末締め翌月払い" value={newCneeInput.memo} onChange={e=>setNewCneeInput(f=>({...f,memo:e.target.value}))}/>
                    </div>
                    <div style={{display:"flex",gap:6,marginTop:4}}>
                      <button className="btn-p" style={{flex:1,marginTop:0,fontSize:12,padding:8}} onClick={addConsignee}>登録して選択</button>
                      <button className="btn-c" style={{flex:1,marginTop:0,fontSize:12,padding:8}} onClick={()=>{setShowNewCnee(false);setNewCneeInput({name:"",address:"",memo:""});}}>戻る</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="fr2">
                <div className="fr"><label className="fl">日付 *</label><input className="fi" type="date" value={cf.date} onChange={e=>setCf(f=>({...f,date:e.target.value}))}/></div>
                <div className="fr"><label className="fl">種別 *</label>
                  <select className="fs" value={cf.type} onChange={e=>setCf(f=>({...f,type:e.target.value}))}>
                    <option value="deliver">納品</option>
                    <option value="sale">委託売上</option>
                    <option value="return">返品</option>
                    <option value="loss">廃棄ロス</option>
                  </select>
                </div>
              </div>
              <div className="fr2">
                <div className="fr"><label className="fl">数量 *</label><input className="fi" type="number" placeholder="1" value={cf.qty} onChange={e=>setCf(f=>({...f,qty:e.target.value}))}/></div>
                {(cf.type==="deliver"||cf.type==="sale") && (
                  <div className="fr"><label className="fl">{cf.type==="deliver"?"委託販売価格":"販売価格"}（円）</label><input className="fi" type="number" placeholder="0" value={cf.salePrice} onChange={e=>setCf(f=>({...f,salePrice:e.target.value}))}/></div>
                )}
              </div>
              {(cf.type==="deliver"||cf.type==="sale") && (
                <div className="fr"><label className="fl">手数料率（%）</label><input className="fi" type="number" placeholder="30" value={cf.feeRate} onChange={e=>setCf(f=>({...f,feeRate:e.target.value}))}/></div>
              )}
              <div className="fr"><label className="fl">メモ</label><input className="fi" placeholder="例: 3月分報告、展示中破損" value={cf.memo} onChange={e=>setCf(f=>({...f,memo:e.target.value}))}/></div>
              <div className="div"/>
              <button className="btn-p" onClick={saveConsign}>{editingConsignId ? "保存する" : "記録する"}</button>
              <button className="btn-c" onClick={closeConsignModal}>キャンセル</button>
              {editingConsignId && <button className="btn-d" onClick={()=>deleteConsign(editingConsignId)}>この記録を削除する</button>}
            </div>
          </div>
        )}

        {/* ════ 売上モーダル ════ */}
        {modal==="sale" && (
          <div className="ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
            <div className="modal">
              <div className="modal-title">{editingSaleId ? "売上を編集" : "売上を記録"}</div>

              {/* 委託連動売上の場合は商品・チャネルを固定表示 */}
              {editingSaleId && sales.find(s=>s.id===editingSaleId)?.consignRecordId && (
                <div style={{background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:8,padding:"8px 12px",marginBottom:8,fontSize:12,color:"var(--t2)"}}>
                  <i className="fal fa-map-marker-alt" style={{marginRight:5}}/>委託連動売上 — 商品・チャネルは委託記録から引き継がれます
                  <div style={{marginTop:4,fontWeight:700,color:"var(--tx)"}}>{prodName(+sf.items[0]?.productId)} · {sf.channel}</div>
                </div>
              )}

              {/* 共通フィールド：日付・チャネル */}
              {!(editingSaleId && sales.find(s=>s.id===editingSaleId)?.consignRecordId) && (
                <div className="fr"><label className="fl">チャネル</label>
                  {!showNewChannel ? (
                    <div style={{display:"flex",gap:6}}>
                      <select className="fs" style={{flex:1}} value={sf.channel} onChange={e=>setSf(f=>({...f,channel:e.target.value}))}>
                        {channels.map(c=><option key={c.id} value={c.name}>{c.name}（{c.feeRate}%）</option>)}
                      </select>
                      <button style={{flexShrink:0,padding:"0 10px",border:"1px dashed var(--ac)",borderRadius:8,background:"none",color:"var(--ac)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                        onClick={()=>setShowNewChannel(true)}>＋ 新規</button>
                    </div>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      <div style={{display:"flex",gap:6}}>
                        <input className="fi" style={{flex:2}} placeholder="チャネル名（例: iichi）" value={newChannelInput.name} onChange={e=>setNewChannelInput(f=>({...f,name:e.target.value}))} autoFocus/>
                        <input className="fi" style={{flex:1}} type="number" placeholder="手数料%" value={newChannelInput.feeRate} onChange={e=>setNewChannelInput(f=>({...f,feeRate:e.target.value}))}/>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button style={{flex:1,padding:"7px 0",borderRadius:8,background:"var(--ac)",color:"#fff",border:"none",fontSize:12,cursor:"pointer",fontFamily:"inherit"}} onClick={addChannel}>追加</button>
                        <button style={{flex:1,padding:"7px 0",borderRadius:8,background:"none",color:"var(--t2)",border:"1px solid var(--bd)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>{setShowNewChannel(false);setNewChannelInput({name:"",feeRate:""});}}>戻る</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="fr"><label className="fl">販売日 *</label><input className="fi" type="date" value={sf.date} onChange={e=>setSf(f=>({...f,date:e.target.value}))}/></div>

              {/* 商品アイテムリスト */}
              {sf.items.map((item, idx)=>{
                const isConsignEdit = editingSaleId && sales.find(s=>s.id===editingSaleId)?.consignRecordId;
                const prev = salePreview[idx];
                const updItem = (patch) => setSf(f=>({ ...f, items: f.items.map((it,i)=>i===idx?{...it,...patch}:it) }));
                return (
                  <div key={idx} style={{border:"1px solid var(--md-olv)",borderRadius:12,padding:"10px 12px",marginBottom:8,background:"var(--md-sc1)"}}>
                    {/* 種別トグル（新規・非委託のみ） */}
                    {!isConsignEdit && (
                      <div style={{display:"flex",gap:6,marginBottom:8}}>
                        {["product","order"].map(t=>(
                          <button key={t} className={`chip${item.saleType===t?" on":""}`} style={{flex:1}}
                            onClick={()=>updItem({saleType:t,productId:"",orderName:""})}>
                            {t==="product"?"作品":"オーダー品"}
                          </button>
                        ))}
                        {sf.items.length>1&&(
                          <button style={{padding:"4px 10px",border:"1px solid var(--md-e)",borderRadius:8,background:"none",color:"var(--low)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                            onClick={()=>setSf(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}))}>
                            <i className="fal fa-times"/>
                          </button>
                        )}
                      </div>
                    )}
                    {/* 商品選択 or オーダー品名 */}
                    {!isConsignEdit && (
                      item.saleType==="order" ? (
                        <div className="fr"><label className="fl">オーダー品名 *</label>
                          <input className="fi" placeholder="例: 名入れネックレス" value={item.orderName} onChange={e=>updItem({orderName:e.target.value})}/>
                        </div>
                      ) : (
                        <div className="fr"><label className="fl">作品 *</label>
                          <select className="fs" value={item.productId} onChange={e=>{
                            const pr=products.find(p=>p.id===+e.target.value);
                            updItem({productId:e.target.value,shippingActual:pr?String(pr.shippingCost):item.shippingActual});
                          }}>
                            <option value="">選択してください</option>
                            {products.map(p=>{
                              const cost=productCostMap[p.id];
                              return <option key={p.id} value={p.id}>{p.name}（原価¥{fmt(cost.total)}）</option>;
                            })}
                          </select>
                        </div>
                      )
                    )}
                    <div className="fr3">
                      <div className="fr"><label className="fl">販売価格 *</label><input className="fi" type="number" placeholder="0" value={item.price} onChange={e=>updItem({price:e.target.value})}/></div>
                      <div className="fr"><label className="fl">数量 *</label><input className="fi" type="number" placeholder="1" value={item.qty} onChange={e=>updItem({qty:e.target.value})}/></div>
                      <div className="fr"><label className="fl">送料実費</label><input className="fi" type="number" placeholder="0" value={item.shippingActual} onChange={e=>updItem({shippingActual:e.target.value})}/></div>
                    </div>
                    {prev && (
                      <div className="preview-box" style={{marginTop:8}}>
                        <div className="prev-row"><span className="prev-lbl">売上合計</span><span className="prev-val">¥{fmt(prev.rev)}</span></div>
                        {item.saleType!=="order"&&<div className="prev-row"><span className="prev-lbl">原価（想定送料¥{fmt(prev.estimatedShipping)}込）</span><span className="prev-val" style={{color:"var(--low)"}}>−¥{fmt(prev.cost)}</span></div>}
                        <div className="prev-row"><span className="prev-lbl">手数料（{prev.feeRate}%）</span><span className="prev-val" style={{color:"var(--low)"}}>−¥{fmt(prev.fee)}</span></div>
                        {+item.shippingActual>0&&prev.shippingAdj!==0&&(
                          <div className="prev-row">
                            <span className="prev-lbl">送料差額（実費¥{fmt(+item.shippingActual)}−想定¥{fmt(prev.estimatedShipping)}）</span>
                            <span className="prev-val" style={{color:prev.shippingAdj>0?"var(--low)":"var(--ok)"}}>
                              {prev.shippingAdj>0?`−¥${fmt(prev.shippingAdj)}`:`+¥${fmt(-prev.shippingAdj)}`}
                            </span>
                          </div>
                        )}
                        {+item.shippingActual>0&&prev.shippingAdj===0&&(
                          <div className="prev-row"><span className="prev-lbl">送料（実費=想定）</span><span className="prev-val" style={{color:"var(--md-osv)"}}>±¥0</span></div>
                        )}
                        <div className="prev-div"/>
                        <div className="prev-total"><span>純利益</span><span style={{color:prev.profit>=0?"var(--ok)":"var(--low)"}}>¥{fmt(prev.profit)}（{pct(prev.profit,prev.rev)}%）</span></div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 商品を追加ボタン（新規のみ） */}
              {!editingSaleId && (
                <button style={{width:"100%",padding:"8px 0",border:"1px dashed var(--ac)",borderRadius:10,background:"none",color:"var(--ac)",fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}
                  onClick={()=>setSf(f=>({...f,items:[...f.items,{saleType:"product",productId:"",orderName:"",qty:"1",price:"",shippingActual:""}]}))}>
                  <i className="fas fa-plus" style={{marginRight:5}}/>商品を追加
                </button>
              )}

              <div className="fr"><label className="fl">メモ（注文番号・領収書番号など）</label><input className="fi" placeholder="例: MN-20250412" value={sf.memo} onChange={e=>setSf(f=>({...f,memo:e.target.value}))}/></div>
              <div className="div"/>
              <button className="btn-p" onClick={addSale}>{editingSaleId ? "保存する" : "記録する"}</button>
              <button className="btn-c" onClick={closeSaleModal}>キャンセル</button>
              {editingSaleId && <>
                <div className="div"/>
                <button className="btn btn-d" onClick={()=>deleteSale(editingSaleId)}>この売上記録を削除</button>
              </>}
            </div>
          </div>
        )}

        {/* ════ レシピ登録モーダル ════ */}
        {modal==="recipe" && (
          <div className="ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
            <div className="modal">
              <div className="modal-title">{editingRecipeId ? "レシピを編集" : "作品レシピを登録"}</div>
              <div className="fr">
                <label className="fl">カテゴリ</label>
                {!showNewProdCat ? (
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                    {productCats.map(c=>(
                      <button key={c} className={`chip ${rf.cat===c?"on":""}`}
                        onClick={()=>setRf(f=>({...f,cat:f.cat===c?"":c}))}>{c}</button>
                    ))}
                    <button style={{flexShrink:0,padding:"3px 10px",border:"1px dashed var(--ac)",borderRadius:8,background:"none",color:"var(--ac)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                      onClick={()=>setShowNewProdCat(true)}>＋ 新規</button>
                  </div>
                ) : (
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <input className="fi" style={{flex:1}} placeholder="新しいカテゴリ名" value={newProdCatInput}
                      onChange={e=>setNewProdCatInput(e.target.value)} autoFocus
                      onKeyDown={e=>{
                        if(e.key==="Enter"&&newProdCatInput.trim()){
                          setRf(f=>({...f,cat:newProdCatInput.trim()}));
                          setShowNewProdCat(false);
                          setNewProdCatInput("");
                        }
                      }}/>
                    <button style={{flexShrink:0,padding:"0 10px",border:"1px solid var(--ac)",borderRadius:8,background:"var(--ac)",color:"#fff",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                      onClick={()=>{
                        if(newProdCatInput.trim()){
                          setRf(f=>({...f,cat:newProdCatInput.trim()}));
                        }
                        setShowNewProdCat(false);
                        setNewProdCatInput("");
                      }}>決定</button>
                    <button style={{flexShrink:0,padding:"0 10px",border:"1px solid var(--bd)",borderRadius:8,background:"none",color:"var(--t2)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                      onClick={()=>{setShowNewProdCat(false);setNewProdCatInput("");}}>戻る</button>
                  </div>
                )}
                {rf.cat && <div style={{fontSize:11,color:"var(--ac)",marginTop:4}}>選択中: <strong>{rf.cat}</strong>
                  <button style={{marginLeft:6,background:"none",border:"none",color:"var(--t2)",cursor:"pointer",fontSize:11,padding:0}} onClick={()=>setRf(f=>({...f,cat:""}))}><i className="fal fa-times" style={{marginRight:3}}/>解除</button>
                </div>}
              </div>
              <div className="fr"><label className="fl">商品名 *</label><input className="fi" placeholder="例: パールピアス" value={rf.name} onChange={e=>setRf(f=>({...f,name:e.target.value}))}/></div>
              <div className="fr"><label className="fl">説明・メモ</label><input className="fi" placeholder="例: 淡水パール × Cカン × ポスト" value={rf.desc} onChange={e=>setRf(f=>({...f,desc:e.target.value}))}/></div>

              <div className="div"/>
              <div className="sec-label">使用部品</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
                <button className={`chip ${recipeCatFilter===""?"on":""}`} onClick={()=>setRecipeCatFilter("")}>すべて</button>
                {partCats.map(c=>(
                  <button key={c} className={`chip ${recipeCatFilter===c?"on":""}`} onClick={()=>setRecipeCatFilter(prev=>prev===c?"":c)}>{c}</button>
                ))}
              </div>
              {rf.ingredients.map((ing,i)=>(
                <div className="ing-row" key={i}>
                  <select className="fs" value={ing.partId} onChange={e=>updateIng(i,"partId",e.target.value)}>
                    <option value="">部品を選択</option>
                    {parts.filter(p=>!recipeCatFilter||p.cat===recipeCatFilter).map(p=><option key={p.id} value={p.id}>{p.name}（{p.variant}）@¥{fmtD(partStockMap[p.id]?.avgPrice||0)}/{p.unit}</option>)}
                  </select>
                  <input className="fi" type="number" placeholder="数量" style={{width:70,flex:"none"}} value={ing.qty} onChange={e=>updateIng(i,"qty",e.target.value)}/>
                  {ing.partId && <span style={{fontSize:10,color:"var(--t2)",whiteSpace:"nowrap"}}>{parts.find(p=>p.id===+ing.partId)?.unit}</span>}
                  {rf.ingredients.length>1 && <button className="ing-del" onClick={()=>removeIngRow(i)}><i className="fal fa-times"/></button>}
                </div>
              ))}
              <button className="add-ing-btn" onClick={addIngRow}>＋ 部品を追加</button>

              {/* リアルタイム原価プレビュー */}
              {rf.ingredients.some(i=>i.partId&&i.qty) && (()=>{
                let mat=0,pack=0;
                rf.ingredients.forEach(ing=>{
                  if(!ing.partId||!ing.qty) return;
                  const part=parts.find(p=>p.id===+ing.partId);
                  const {avgPrice}=partStockMap[+ing.partId]||{avgPrice:0};
                  const lc=avgPrice*+ing.qty;
                  if(part?.cat==="梱包材") pack+=lc; else mat+=lc;
                });
                const ship=+rf.shippingCost||0, labor=+rf.laborCost||0;
                const total=mat+pack+ship+labor;
                return (
                  <div className="preview-box" style={{marginBottom:9}}>
                    <div className="prev-row"><span className="prev-lbl">材料費</span><span className="prev-val">¥{fmt(mat)}</span></div>
                    <div className="prev-row"><span className="prev-lbl">梱包費</span><span className="prev-val">¥{fmt(pack)}</span></div>
                    <div className="prev-row"><span className="prev-lbl">送料</span><span className="prev-val">¥{fmt(ship)}</span></div>
                    <div className="prev-row"><span className="prev-lbl">人件費</span><span className="prev-val">¥{fmt(labor)}</span></div>
                    <div className="prev-div"/>
                    <div className="prev-total"><span>原価合計</span><span style={{color:"var(--ac)"}}>¥{fmt(total)}</span></div>
                  </div>
                );
              })()}

              <div className="div"/>
              <div className="sec-label">その他コスト</div>
              <div className="fr2">
                <div className="fr"><label className="fl">想定送料（円）</label><input className="fi" type="number" placeholder="220" value={rf.shippingCost} onChange={e=>setRf(f=>({...f,shippingCost:e.target.value}))}/></div>
                <div className="fr"><label className="fl">人件費（円）</label><input className="fi" type="number" placeholder="150" value={rf.laborCost} onChange={e=>setRf(f=>({...f,laborCost:e.target.value}))}/></div>
              </div>
              <div className="div"/>
              <button className="btn-p" onClick={addRecipe}>{editingRecipeId ? "保存する" : "レシピを登録"}</button>
              <button className="btn-c" onClick={closeRecipeModal}>キャンセル</button>
              {editingRecipeId && <>
                <div className="div"/>
                <button className="btn btn-d" onClick={()=>deleteRecipe(editingRecipeId)}>このレシピを削除</button>
              </>}
            </div>
          </div>
        )}

        {/* ════ 委託終了モーダル ════ */}
        {modal==="consign_end" && (()=>{
          const pr = products.find(p=>p.id===+consignEndData.productId);
          const cn = consignees.find(c=>c.id===+consignEndData.consigneeId);
          return (
            <div className="ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
              <div className="modal">
                <div className="modal-title"><i className="fal fa-flag-checkered" style={{marginRight:8}}/>委託終了</div>
                <div className="modal-sub">{pr?.name} — {cn?.name}</div>
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  {[{val:"return",label:"返品",color:"var(--warn)"},{val:"loss",label:"廃棄ロス",color:"var(--low)"}].map(opt=>(
                    <button key={opt.val}
                      style={{flex:1,padding:"10px 0",border:`2px solid ${consignEndData.type===opt.val?opt.color:"var(--bd)"}`,borderRadius:10,background:consignEndData.type===opt.val?`${opt.color}18`:"none",color:consignEndData.type===opt.val?opt.color:"var(--t2)",fontWeight:consignEndData.type===opt.val?700:400,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}
                      onClick={()=>setConsignEndData(f=>({...f,type:opt.val}))}>{opt.label}</button>
                  ))}
                </div>
                <div className="fr2">
                  <div className="fr"><label className="fl">終了日 *</label>
                    <input className="fi" type="date" value={consignEndData.date} onChange={e=>setConsignEndData(f=>({...f,date:e.target.value}))}/>
                  </div>
                  <div className="fr"><label className="fl">数量 *</label>
                    <input className="fi" type="number" min="1" value={consignEndData.qty} onChange={e=>setConsignEndData(f=>({...f,qty:e.target.value}))}/>
                  </div>
                </div>
                <div className="fr"><label className="fl">メモ</label>
                  <input className="fi" placeholder="例: 汚れにより廃棄" value={consignEndData.memo} onChange={e=>setConsignEndData(f=>({...f,memo:e.target.value}))}/>
                </div>
                <div className="div"/>
                <button className="btn-p" onClick={saveConsignEnd}>記録する</button>
                <button className="btn-c" onClick={()=>setModal(null)}>キャンセル</button>
              </div>
            </div>
          );
        })()}

        {modal==="channel_edit" && (
          <div className="ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
            <div className="modal">
              <div className="modal-title">チャネルを編集</div>
              <div className="fr"><label className="fl">チャネル名 *</label><input className="fi" value={channelEditForm.name} onChange={e=>setChannelEditForm(f=>({...f,name:e.target.value}))}/></div>
              <div className="fr"><label className="fl">手数料率（%）</label><input className="fi" type="number" step="0.1" value={channelEditForm.feeRate} onChange={e=>setChannelEditForm(f=>({...f,feeRate:e.target.value}))}/></div>
              <div className="fr" style={{flexDirection:"column",gap:6}}>
                <label className="fl">カラー</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {CH_PALETTE.map(col=>(
                    <button key={col} onClick={()=>setChannelEditForm(f=>({...f,color:col}))}
                      style={{width:26,height:26,borderRadius:"50%",background:col,border:channelEditForm.color===col?"3px solid var(--tx)":"2px solid transparent",cursor:"pointer",padding:0}}/>
                  ))}
                </div>
              </div>
              <button className="btn" style={{marginTop:12}} onClick={saveChannel}>保存</button>
              <div className="div"/>
              <button className="btn btn-d" onClick={()=>deleteChannel(editingChannelId)}>このチャネルを削除</button>
            </div>
          </div>
        )}

        {/* ════ 委託先編集モーダル ════ */}
        {modal==="consignee_edit" && (
          <div className="ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
            <div className="modal">
              <div className="modal-title"><i className="fal fa-map-marker-alt" style={{marginRight:8}}/>店舗情報を編集</div>
              <div className="fr"><label className="fl">委託先名 *</label><input className="fi" value={consigneeEditForm.name} onChange={e=>setConsigneeEditForm(f=>({...f,name:e.target.value}))}/></div>
              <div className="fr"><label className="fl">住所・場所</label><input className="fi" placeholder="例: 札幌市中央区" value={consigneeEditForm.address} onChange={e=>setConsigneeEditForm(f=>({...f,address:e.target.value}))}/></div>
              <div className="fr"><label className="fl">メモ（締め日・手数料率など）</label><input className="fi" placeholder="例: 月末締め翌月払い" value={consigneeEditForm.memo} onChange={e=>setConsigneeEditForm(f=>({...f,memo:e.target.value}))}/></div>
              <button className="btn-p" style={{marginTop:10}} onClick={saveConsignee}>保存する</button>
              <button className="btn-c" onClick={()=>setModal(null)}>キャンセル</button>
              <div className="div"/>
              <button className="btn-d" onClick={()=>deleteConsignee(editingConsigneeId)}>この委託先を削除する</button>
            </div>
          </div>
        )}

        {/* ════ 部品在庫 ＋ モーダル（仕入 / マスター 2タブ） ════ */}
        {modal==="parts_add" && (
          <div className="ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
            <div className="modal">
              <div className="sub-tabs" style={{marginBottom:13}}>
                <button className={`stab ${partsAddTab==="purchase"?"on":""}`} onClick={()=>setPartsAddTab("purchase")}>仕入</button>
                <button className={`stab ${partsAddTab==="part"?"on":""}`} onClick={()=>setPartsAddTab("part")}>マスター</button>
              </div>
              {partsAddTab==="purchase" && (()=>{
                // ── 仕入フォーム ──────────────────────────────────────
                const filtCats = pfCat ? [pfCat] : partCats;
                const filtParts = parts.filter(p=>p.type!=="part"&&(pfCat?p.cat===pfCat:true));
                return (
                  <>
                    <div className="modal-title">仕入を記録</div>
                    <div className="fr">
                      <label className="fl">カテゴリで絞り込み</label>
                      <div className="filter-row" style={{marginBottom:0}}>
                        {partCats.map(c=><button key={c} className={`chip ${pfCat===c?"on":""}`} onClick={()=>setPfCat(prev=>prev===c?"":c)}>{c}</button>)}
                      </div>
                    </div>
                    <div className="fr"><label className="fl">部品 *</label>
                      <select className="fs" value={pf.partId} onChange={e=>setPf(f=>({...f,partId:e.target.value}))}>
                        <option value="">選択してください</option>
                        {filtParts.map(p=><option key={p.id} value={p.id}>{p.name}（{p.variant}）</option>)}
                      </select>
                    </div>
                    <div className="fr"><label className="fl">仕入日 *</label><input className="fi" type="date" value={pf.date} onChange={e=>setPf(f=>({...f,date:e.target.value}))}/></div>
                    <div className="fr"><label className="fl">仕入先</label>
                      {!showNewSupplier ? (
                        <div style={{display:"flex",gap:6}}>
                          <select className="fs" style={{flex:1}} value={pf.supplier} onChange={e=>setPf(f=>({...f,supplier:e.target.value}))}>
                            <option value="">未選択</option>
                            {suppliers.map(s=><option key={s} value={s}>{s}</option>)}
                          </select>
                          <button style={{flexShrink:0,padding:"0 10px",border:"1px dashed var(--ac)",borderRadius:8,background:"none",color:"var(--ac)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setShowNewSupplier(true)}>＋新規</button>
                        </div>
                      ) : (
                        <div style={{display:"flex",gap:6}}>
                          <input className="fi" placeholder="新しい仕入先名" value={pf.supplier} onChange={e=>setPf(f=>({...f,supplier:e.target.value}))}/>
                          <button style={{flexShrink:0,padding:"0 10px",border:"1px solid var(--bd)",borderRadius:8,background:"none",color:"var(--t2)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setShowNewSupplier(false)}>戻る</button>
                        </div>
                      )}
                    </div>
                    <div className="fr2">
                      <div className="fr"><label className="fl">数量 *</label><input className="fi" type="number" placeholder="例: 100" value={pf.qty} onChange={e=>setPf(f=>({...f,qty:e.target.value}))}/></div>
                      <div className="fr"><label className="fl">実購入額（税込み）*</label><input className="fi" type="number" placeholder="例: 1980" value={pf.totalPrice} onChange={e=>setPf(f=>({...f,totalPrice:e.target.value}))}/></div>
                    </div>
                    <div className="fr"><label className="fl">メモ</label><input className="fi" placeholder="例: まとめ買い割引" value={pf.note} onChange={e=>setPf(f=>({...f,note:e.target.value}))}/></div>
                    <div className="div"/>
                    <button className="btn-p" onClick={savePurchase}>記録する</button>
                    <button className="btn-c" onClick={()=>setModal(null)}>キャンセル</button>
                  </>
                );
              })()}
              {partsAddTab==="part" && (()=>{
                // ── 部品マスター登録フォーム ──────────────────────────
                return (
                  <>
                    <div className="modal-title">部品を登録</div>
                    <div className="modal-sub">登録後、仕入記録から在庫を追加できます</div>
                    <div className="fr">
                      <label className="fl">部品タイプ</label>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {[
                          {val:"",       label:"通常",   desc:"仕入れてそのまま使用"},
                          {val:"material",label:"母材",  desc:"加工前の素材（布・紐など）"},
                          {val:"part",   label:"中間材", desc:"母材から切り出した部品"},
                        ].map(opt=>(
                          <button key={opt.val} className={`chip ${partForm.type===opt.val?"on":""}`}
                            onClick={()=>setPartForm(f=>({...f,type:opt.val,parentId:opt.val==="part"?f.parentId:""}))}
                            title={opt.desc}>{opt.label}</button>
                        ))}
                      </div>
                    </div>
                    {partForm.type==="part" && (
                      <div className="fr">
                        <label className="fl">親の母材</label>
                        <select className="fs" value={partForm.parentId} onChange={e=>{
                          const pid = e.target.value;
                          let hinban = partForm.hinban;
                          if(pid){
                            const parent = parts.find(p=>p.id===+pid);
                            if(parent?.hinban){
                              const children = parts.filter(p=>p.parentId===+pid);
                              const maxNum = children.reduce((mx,c)=>{ const s=c.hinban?.slice(parent.hinban.length+1); const n=parseInt(s,10); return isNaN(n)?mx:Math.max(mx,n); },0);
                              hinban = `${parent.hinban}-${String(maxNum+1).padStart(3,"0")}`;
                            }
                          }
                          setPartForm(f=>({...f,parentId:pid,hinban}));
                        }}>
                          <option value="">選択してください</option>
                          {parts.filter(p=>p.type==="material").map(p=><option key={p.id} value={p.id}>{p.name}（{p.variant}）</option>)}
                        </select>
                      </div>
                    )}
                    <div className="fr">
                      <label className="fl">カテゴリ *</label>
                      {!showNewCat ? (
                        <div style={{display:"flex",gap:6}}>
                          <select className="fs" style={{flex:1}} value={partForm.cat} onChange={e=>setPartForm(f=>({...f,cat:e.target.value}))}>
                            {partCats.map(c=><option key={c} value={c}>{c}</option>)}
                          </select>
                          <button style={{flexShrink:0,padding:"0 10px",border:"1px dashed var(--ac)",borderRadius:8,background:"none",color:"var(--ac)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setShowNewCat(true)}>＋新規</button>
                        </div>
                      ) : (
                        <div style={{display:"flex",gap:6}}>
                          <input className="fi" placeholder="新しいカテゴリ名" value={newCatInput} onChange={e=>setNewCatInput(e.target.value)}/>
                          <button style={{flexShrink:0,padding:"0 10px",border:"1px solid var(--bd)",borderRadius:8,background:"none",color:"var(--t2)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setShowNewCat(false)}>戻る</button>
                        </div>
                      )}
                    </div>
                    <div className="fr2">
                      <div className="fr"><label className="fl">品名 *</label><input className="fi" placeholder="例: Cカン" value={partForm.name} onChange={e=>setPartForm(f=>({...f,name:e.target.value}))}/></div>
                      <div className="fr"><label className="fl">バリエーション</label><input className="fi" placeholder="例: ゴールド / 8mm" value={partForm.variant} onChange={e=>setPartForm(f=>({...f,variant:e.target.value}))}/></div>
                    </div>
                    <div className="fr2">
                      <div className="fr"><label className="fl">単位</label><input className="fi" placeholder="例: 個" value={partForm.unit} onChange={e=>setPartForm(f=>({...f,unit:e.target.value}))}/></div>
                      <div className="fr"><label className="fl">品番</label><input className="fi" placeholder="例: C-001" value={partForm.hinban} onChange={e=>setPartForm(f=>({...f,hinban:e.target.value}))}/></div>
                    </div>
                    <div className="fr"><label className="fl">最低在庫数</label><input className="fi" type="number" placeholder="例: 50" value={partForm.minStock} onChange={e=>setPartForm(f=>({...f,minStock:e.target.value}))}/></div>
                    <div className="fr">
                      <label className="fl">保管場所</label>
                      {!showNewPartLoc ? (
                        <div style={{display:"flex",gap:6}}>
                          <select className="fs" style={{flex:1}} value={partForm.location} onChange={e=>setPartForm(f=>({...f,location:e.target.value}))}>
                            <option value="">未設定</option>
                            {partLocMaster.map(l=><option key={l}>{l}</option>)}
                          </select>
                          <button style={{flexShrink:0,padding:"0 10px",border:"1px dashed var(--ac)",borderRadius:8,background:"none",color:"var(--ac)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setShowNewPartLoc(true)}>＋新規</button>
                        </div>
                      ) : (
                        <div style={{display:"flex",gap:6}}>
                          <input className="fi" style={{flex:1}} placeholder="例: 棚A" value={newPartLocInput} onChange={e=>setNewPartLocInput(e.target.value)}/>
                          <button style={{flexShrink:0,padding:"5px 10px",border:"none",borderRadius:8,background:"var(--ac)",color:"#fff",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                            onClick={()=>{ const v=newPartLocInput.trim(); if(v&&!partLocMaster.includes(v)){setPartLocMaster(m=>[...m,v]);} if(v){setPartForm(f=>({...f,location:v}));} setNewPartLocInput(""); setShowNewPartLoc(false); }}>追加</button>
                          <button style={{flexShrink:0,padding:"0 10px",border:"1px solid var(--bd)",borderRadius:8,background:"none",color:"var(--t2)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>{setShowNewPartLoc(false);setNewPartLocInput("");}}>戻る</button>
                        </div>
                      )}
                    </div>
                    <div className="div"/>
                    <button className="btn-p" onClick={addPart}>登録する</button>
                    <button className="btn-c" onClick={()=>setModal(null)}>キャンセル</button>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ════ 仕入・廃棄 履歴ページ ════ */}
        {mgmtPage==="history" && (
          <div className="mgmt-page">
            <div className="mgmt-ph">
              <button className="mgmt-ph-back" onClick={()=>setMgmtPage(null)}><i className="fal fa-chevron-left"/></button>
              <div className="mgmt-ph-title"><i className="fal fa-history" style={{marginRight:8}}/>仕入・廃棄 履歴</div>
            </div>
            <div style={{padding:"14px 14px 0"}}>
              <div className="sub-tabs" style={{marginBottom:0}}>
                <button className={`stab ${historyTab==="purchase"?"on":""}`} onClick={()=>setHistoryTab("purchase")}>仕入記録（{purchases.length}）</button>
                <button className={`stab ${historyTab==="disposal"?"on":""}`} onClick={()=>setHistoryTab("disposal")}>廃棄記録（{disposals.length}）</button>
              </div>
            </div>
            <div style={{padding:"12px 14px"}}>
              {historyTab==="purchase" && (
                <>
                  {purchases.length===0 && <div className="empty">仕入記録はありません</div>}
                  {[...purchases].reverse().map(pu=>{
                    const p=parts.find(pt=>pt.id===pu.partId);
                    const unitPriceWithTax = pu.unitPrice * 1.1;
                    const totalPrice = pu.totalPrice ?? Math.round(pu.qty * pu.unitPrice * 1.1);
                    return (
                      <div className="rc" key={pu.id}>
                        <div className="rc-top">
                          <div><div className="rc-name">{p?.name||"—"}</div><div className="rc-meta">{p?.variant} · {pu.date} · <i className="fal fa-box" style={{marginRight:3}}/>{pu.supplier}</div></div>
                          <div>
                            <div className="rc-amt">¥{fmtD(unitPriceWithTax)}/{p?.unit}（税込）</div>
                            <div className="rc-qty">部品数量 {pu.qty} = ¥{fmt(totalPrice)}（税込）</div>
                            <button style={{background:"none",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t2)",fontSize:12,cursor:"pointer",padding:"2px 8px",fontFamily:"inherit",marginTop:4}} onClick={()=>openEditPurchase(pu)}><i className="fal fa-pen" style={{marginRight:4}}/>編集</button>
                          </div>
                        </div>
                        {pu.note&&<div className="rc-note"><i className="fal fa-sticky-note" style={{marginRight:4}}/>{pu.note}</div>}
                      </div>
                    );
                  })}
                </>
              )}
              {historyTab==="disposal" && (
                <>
                  {disposals.length===0 && <div className="empty">廃棄記録はありません</div>}
                  {[...disposals].reverse().map(d=>{
                    const p=parts.find(pt=>pt.id===d.partId);
                    return (
                      <div className="dc" key={d.id}>
                        <div className="rc-top">
                          <div><div className="rc-name">{p?.name||"—"}</div><div className="rc-meta">{p?.variant} · {d.date}</div></div>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                            <div className="rc-amt" style={{color:"var(--low)"}}>−{d.qty}{p?.unit}</div>
                            <button style={{background:"none",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t2)",fontSize:12,cursor:"pointer",padding:"2px 8px",fontFamily:"inherit"}} onClick={()=>openEditDisposal(d)}><i className="fal fa-pen" style={{marginRight:4}}/>編集</button>
                          </div>
                        </div>
                        {d.reason&&<div className="dc-reason">理由: {d.reason}</div>}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {/* ════ 管理設定ページ: 部品マスター ════ */}
        {mgmtPage==="parts_master" && (
          <div className="mgmt-page">
            <div className="mgmt-ph">
              <button className="mgmt-ph-back" onClick={()=>setMgmtPage(null)}><i className="fal fa-chevron-left"/></button>
              <div className="mgmt-ph-title"><i className="fal fa-boxes" style={{marginRight:8}}/>部品マスター</div>
            </div>
            <div style={{padding:"16px 14px"}}>
              <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
                <button style={{fontSize:12,background:"var(--ac)",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}
                  onClick={()=>{ setEditingPartId(null); setPartForm({cat:"金具",name:"",variant:"",unit:"個",hinban:"",minStock:"10",type:"",parentId:""}); setShowNewCat(false); setNewCatInput(""); setModal("part"); }}>
                  <i className="fas fa-plus"/>部品を追加
                </button>
              </div>
              {parts.length===0 && <div className="empty">部品が登録されていません</div>}
              {parts.map(p=>(
                <div className="pc" key={p.id} style={{cursor:"default"}}>
                  <div style={{flex:1}}>
                    <div className="pn">{p.name}{p.hinban&&<span style={{fontSize:"12px",color:"var(--t2)",fontWeight:400,marginLeft:6}}>#{p.hinban}</span>}</div>
                    <div className="pv">{p.variant}</div>
                    <span className="pbadge">{p.cat}</span>
                    {p.type&&<span className="pbadge" style={{background:"var(--s2)",color:"var(--ac)",marginLeft:4}}>{p.type==="material"?"母材":p.type==="part"?"中間材":""}</span>}
                  </div>
                  <div className="psb" style={{alignItems:"flex-end",gap:6}}>
                    <div className="psu">{p.unit}</div>
                    <button style={{background:"none",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t2)",fontSize:12,cursor:"pointer",padding:"2px 8px",fontFamily:"inherit"}} onClick={()=>openEditPart(p)}><i className="fal fa-pen" style={{marginRight:4}}/>編集</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ 管理設定ページ: データ管理 ════ */}
        {mgmtPage==="data_manage" && (
          <div className="mgmt-page">
            <div className="mgmt-ph">
              <button className="mgmt-ph-back" onClick={()=>setMgmtPage(null)}><i className="fal fa-chevron-left"/></button>
              <div className="mgmt-ph-title"><i className="fal fa-database" style={{marginRight:8}}/>データ管理</div>
            </div>
            <div style={{padding:"16px 14px"}}>

              {/* フィードバック */}
              {importFeedback && (
                <div className={`dm-feedback ${importFeedback.type}`}>
                  <i className={`fas ${importFeedback.type==="ok"?"fa-check-circle":"fa-exclamation-circle"}`}/>
                  {importFeedback.msg}
                  <button onClick={()=>setImportFeedback(null)} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"inherit",fontSize:15,lineHeight:1}}><i className="fal fa-times"/></button>
                </div>
              )}

              {/* ─── JSON 全データインポート確認 ─── */}
              {jsonImportConfirm && (
                <div className="dm-confirm">
                  <div className="dm-confirm-msg">
                    <strong><i className="fas fa-exclamation-triangle" style={{color:"var(--md-e)",marginRight:6}}/>既存データをすべて上書きします</strong><br/>
                    ファイル: <code>{jsonImportConfirm.fileName}</code><br/>
                    {Object.entries(jsonImportConfirm.obj.data)
                      .filter(([,v])=>Array.isArray(v)&&v.length>0)
                      .map(([key,v])=>`${CSV_COLS[key]?.label||key}: ${v.length}件`)
                      .join(" / ")}
                  </div>
                  <div className="dm-confirm-btns">
                    <button className="dm-btn-sm" style={{background:"var(--md-sc3)",color:"var(--md-osf)"}} onClick={()=>setJsonImportConfirm(null)}>キャンセル</button>
                    <button className="dm-btn-sm dm-btn-danger" onClick={applyJSONImport}><i className="fas fa-upload" style={{marginRight:4}}/>上書きインポート実行</button>
                  </div>
                </div>
              )}

              {/* ─── CSV インポート確認 ─── */}
              {csvImportPreview && (
                <div className="dm-confirm">
                  <div className="dm-confirm-msg">
                    <strong>{CSV_COLS[csvImportPreview.key].label}</strong> — <code>{csvImportPreview.fileName}</code> より <strong>{csvImportPreview.rows.length}件</strong> 読み込み済み<br/>
                    <span style={{color:"var(--md-osv)",fontSize:12}}>マージ：IDが一致すれば上書き・なければ追加 / 全置換：テーブルを完全に差し替え</span>
                  </div>
                  <div className="dm-confirm-btns">
                    <button className="dm-btn-sm" style={{background:"var(--md-sc3)",color:"var(--md-osf)"}} onClick={()=>setCsvImportPreview(null)}>キャンセル</button>
                    <button className="dm-btn-sm dm-btn-imp" onClick={()=>applyCSVImport("merge")}><i className="fas fa-code-merge" style={{marginRight:4}}/>マージ</button>
                    <button className="dm-btn-sm dm-btn-danger" onClick={()=>applyCSVImport("overwrite")}><i className="fas fa-retweet" style={{marginRight:4}}/>全置換</button>
                  </div>
                </div>
              )}

              {/* ─── エクスポート ─── */}
              <div className="dm-section">
                <div className="dm-section-title"><i className="fal fa-download" style={{marginRight:6}}/>エクスポート</div>

                {/* JSON 全データ */}
                <div className="dm-row">
                  <div className="dm-row-label"><i className="fal fa-file-code"/>全データ JSON バックアップ</div>
                  <button className="dm-btn-sm dm-btn-exp" onClick={handleExportJSON}>
                    <i className="fal fa-download" style={{marginRight:4}}/>JSON
                  </button>
                </div>

                {/* CSV テーブル別 */}
                <div style={{marginTop:10,marginBottom:6,fontSize:12,color:"var(--md-osv)"}}>テーブル別 CSV</div>
                <div className="dm-csv-grid">
                  {Object.entries(CSV_COLS).map(([key, def])=>(
                    <div className="dm-row" key={key} style={{padding:"8px 10px"}}>
                      <div className="dm-row-label" style={{fontSize:12}}><i className="fal fa-table"/>{def.label}</div>
                      <button className="dm-btn-sm dm-btn-exp" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>handleExportCSV(key)}>
                        <i className="fal fa-download" style={{marginRight:3}}/>CSV
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* ─── インポート ─── */}
              <div className="dm-section">
                <div className="dm-section-title"><i className="fal fa-upload" style={{marginRight:6}}/>インポート</div>

                {/* JSON 全データ */}
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:6,color:"var(--md-osf)"}}>JSON 全データ復元（上書き）</div>
                  <div style={{fontSize:12,color:"var(--md-osv)",marginBottom:8}}>バックアップした JSON ファイルからすべてのデータを復元します。既存データは上書きされます。</div>
                  <label className="dm-file-label">
                    <i className="fal fa-file-import" style={{marginRight:6}}/>JSON ファイルを選択…
                    <input type="file" accept=".json,application/json" style={{display:"none"}} onChange={handleJSONFileChange}/>
                  </label>
                </div>

                {/* CSV テーブル別 */}
                <div>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:6,color:"var(--md-osf)"}}>CSV インポート（テーブル別）</div>
                  <div style={{fontSize:12,color:"var(--md-osv)",marginBottom:8}}>インポートするテーブルを選択し、対応する CSV ファイルを読み込みます。</div>
                  <select className="fs" value={csvImportTable} onChange={e=>setCsvImportTable(e.target.value)} style={{marginBottom:10}}>
                    {Object.entries(CSV_COLS).map(([key,def])=>(
                      <option key={key} value={key}>{def.label}</option>
                    ))}
                  </select>
                  <label className="dm-file-label">
                    <i className="fal fa-file-csv" style={{marginRight:6}}/>CSV ファイルを選択…（{CSV_COLS[csvImportTable]?.label}）
                    <input type="file" accept=".csv,text/csv" style={{display:"none"}} onChange={handleCSVFileChange}/>
                  </label>
                </div>
              </div>

              {/* ─── ヒント ─── */}
              <div style={{fontSize:11,color:"var(--md-osv)",lineHeight:1.7,borderTop:"1px solid var(--md-olv)",paddingTop:12}}>
                <strong>ヒント</strong><br/>
                • JSON は全データを1ファイルにまとめたバックアップ。定期的に保存しておくと安心です。<br/>
                • CSV は Excel で開いて内容確認・編集できます（UTF-8 BOM付き）。<br/>
                • 材料・切り出し結果など配列項目は CSV セル内に JSON 文字列で保存されます。<br/>
                • インポート前に必ず JSON バックアップを取ることをお勧めします。
              </div>

            </div>
          </div>
        )}

        {/* ════ 管理設定ページ: カテゴリ設定 ════ */}
        {mgmtPage==="category_setting" && (
          <div className="mgmt-page">
            <div className="mgmt-ph">
              <button className="mgmt-ph-back" onClick={()=>setMgmtPage(null)}><i className="fal fa-chevron-left"/></button>
              <div className="mgmt-ph-title"><i className="fal fa-tag" style={{marginRight:8}}/>カテゴリ設定</div>
            </div>
            <div style={{padding:"16px 14px"}}>
              {/* 部品カテゴリ */}
              <div className="sec-label" style={{marginBottom:8}}>部品カテゴリ</div>
              <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:10}}>
                {partCatMaster.map(c=>(
                  editingPartCatName===c ? (
                    <div key={c} style={{display:"flex",gap:6}}>
                      <input className="fi" style={{flex:1}} value={editPartCatInput} onChange={e=>setEditPartCatInput(e.target.value)} autoFocus
                        onKeyDown={e=>{if(e.key==="Enter"){const v=editPartCatInput.trim();if(v&&v!==c&&!partCatMaster.includes(v)){setPartCatMaster(m=>m.map(x=>x===c?v:x));setParts(ps=>ps.map(p=>p.cat===c?{...p,cat:v}:p));}setEditingPartCatName(null);}}}/>
                      <button style={{padding:"4px 10px",border:"none",borderRadius:8,background:"var(--ac)",color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}
                        onClick={()=>{const v=editPartCatInput.trim();if(v&&v!==c&&!partCatMaster.includes(v)){setPartCatMaster(m=>m.map(x=>x===c?v:x));setParts(ps=>ps.map(p=>p.cat===c?{...p,cat:v}:p));}setEditingPartCatName(null);}}>保存</button>
                      <button style={{padding:"4px 10px",border:"1px solid var(--bd)",borderRadius:8,background:"none",color:"var(--t2)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setEditingPartCatName(null)}>戻る</button>
                    </div>
                  ) : (
                    <div key={c} style={{display:"flex",alignItems:"center",background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:8,padding:"6px 12px",gap:6}}>
                      <span style={{flex:1,fontSize:13}}>{c}</span>
                      <button style={{background:"none",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t2)",cursor:"pointer",fontSize:11,padding:"2px 8px",fontFamily:"inherit"}} onClick={()=>{setEditingPartCatName(c);setEditPartCatInput(c);}}><i className="fal fa-pen" style={{marginRight:3}}/>編集</button>
                      <button style={{background:"none",border:"none",color:"var(--t2)",cursor:"pointer",fontSize:15,padding:"0 2px",lineHeight:1}} onClick={()=>setPartCatMaster(m=>m.filter(x=>x!==c))}><i className="fal fa-times"/></button>
                    </div>
                  )
                ))}
              </div>
              <div style={{display:"flex",gap:6,marginBottom:24}}>
                <input className="fi" placeholder="新規カテゴリ名を追加" value={newPartCatInput} onChange={e=>setNewPartCatInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"){const v=newPartCatInput.trim();if(v&&!partCatMaster.includes(v)){setPartCatMaster(m=>[...m,v]);setNewPartCatInput("");}}}}/>
                <button style={{flexShrink:0,padding:"0 14px",border:"none",borderRadius:8,background:"var(--ac)",color:"#fff",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}
                  onClick={()=>{const v=newPartCatInput.trim();if(v&&!partCatMaster.includes(v)){setPartCatMaster(m=>[...m,v]);setNewPartCatInput("");}}}>追加</button>
              </div>

              {/* 作品カテゴリ */}
              <div className="sec-label" style={{marginBottom:8}}>作品カテゴリ</div>
              <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:10}}>
                {productCatMaster.map(c=>(
                  editingProductCatName===c ? (
                    <div key={c} style={{display:"flex",gap:6}}>
                      <input className="fi" style={{flex:1}} value={editProductCatInput} onChange={e=>setEditProductCatInput(e.target.value)} autoFocus
                        onKeyDown={e=>{if(e.key==="Enter"){const v=editProductCatInput.trim();if(v&&v!==c&&!productCatMaster.includes(v)){setProductCatMaster(m=>m.map(x=>x===c?v:x));setProducts(ps=>ps.map(p=>p.cat===c?{...p,cat:v}:p));}setEditingProductCatName(null);}}}/>
                      <button style={{padding:"4px 10px",border:"none",borderRadius:8,background:"var(--ac)",color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}
                        onClick={()=>{const v=editProductCatInput.trim();if(v&&v!==c&&!productCatMaster.includes(v)){setProductCatMaster(m=>m.map(x=>x===c?v:x));setProducts(ps=>ps.map(p=>p.cat===c?{...p,cat:v}:p));}setEditingProductCatName(null);}}>保存</button>
                      <button style={{padding:"4px 10px",border:"1px solid var(--bd)",borderRadius:8,background:"none",color:"var(--t2)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setEditingProductCatName(null)}>戻る</button>
                    </div>
                  ) : (
                    <div key={c} style={{display:"flex",alignItems:"center",background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:8,padding:"6px 12px",gap:6}}>
                      <span style={{flex:1,fontSize:13}}>{c}</span>
                      <button style={{background:"none",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t2)",cursor:"pointer",fontSize:11,padding:"2px 8px",fontFamily:"inherit"}} onClick={()=>{setEditingProductCatName(c);setEditProductCatInput(c);}}><i className="fal fa-pen" style={{marginRight:3}}/>編集</button>
                      <button style={{background:"none",border:"none",color:"var(--t2)",cursor:"pointer",fontSize:15,padding:"0 2px",lineHeight:1}} onClick={()=>setProductCatMaster(m=>m.filter(x=>x!==c))}><i className="fal fa-times"/></button>
                    </div>
                  )
                ))}
              </div>
              <div style={{display:"flex",gap:6}}>
                <input className="fi" placeholder="新規カテゴリ名を追加" value={newProductCatInput} onChange={e=>setNewProductCatInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"){const v=newProductCatInput.trim();if(v&&!productCatMaster.includes(v)){setProductCatMaster(m=>[...m,v]);setNewProductCatInput("");}}}}/>
                <button style={{flexShrink:0,padding:"0 14px",border:"none",borderRadius:8,background:"var(--ac)",color:"#fff",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}
                  onClick={()=>{const v=newProductCatInput.trim();if(v&&!productCatMaster.includes(v)){setProductCatMaster(m=>[...m,v]);setNewProductCatInput("");}}}>追加</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
