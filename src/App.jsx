import { useState, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
//  初期データ
// ═══════════════════════════════════════════════════════════════
const INIT_PARTS = [
  { id:1,  cat:"金具",    name:"Cカン",        variant:"ゴールド / 8mm / 真鍮",  unit:"個", hinban:"C-001" },
  { id:2,  cat:"金具",    name:"Cカン",        variant:"シルバー / 8mm / 鉄",    unit:"個", hinban:"C-002" },
  { id:3,  cat:"金具",    name:"丸カン",       variant:"ゴールド / 6mm",         unit:"個", hinban:"M-001" },
  { id:4,  cat:"金具",    name:"ピアスポスト", variant:"シルバー / チタン",      unit:"ペア", hinban:"P-001" },
  { id:5,  cat:"チェーン",name:"ボールチェーン",variant:"ゴールド / 1.5mm",      unit:"m", hinban:"CH-001" },
  { id:6,  cat:"チェーン",name:"アズキチェーン",variant:"シルバー / 2mm",        unit:"m", hinban:"CH-002" },
  { id:7,  cat:"ビーズ",  name:"淡水パール",   variant:"オフホワイト / 6mm",     unit:"個", hinban:"B-001" },
  { id:8,  cat:"ビーズ",  name:"天然石",       variant:"ローズクォーツ / 8mm",   unit:"個", hinban:"B-002" },
  { id:9,  cat:"梱包材",  name:"OPP袋",        variant:"60×90mm",               unit:"枚", hinban:"PK-001" },
  { id:10, cat:"梱包材",  name:"台紙",         variant:"ピアス用 白",            unit:"枚", hinban:"PK-002" },
];

const INIT_PURCHASES = [
  { id:1,  partId:1,  date:"2025-02-10", supplier:"パーツクラブ",  qty:100, unitPrice:8,   note:"" },
  { id:2,  partId:1,  date:"2025-03-01", supplier:"手芸の山久",    qty:80,  unitPrice:7,   note:"まとめ買い割引" },
  { id:3,  partId:1,  date:"2025-03-20", supplier:"パーツクラブ",  qty:50,  unitPrice:8,   note:"" },
  { id:4,  partId:2,  date:"2025-02-15", supplier:"手芸の山久",    qty:60,  unitPrice:5,   note:"" },
  { id:5,  partId:2,  date:"2025-03-10", supplier:"Beads & Parts", qty:40,  unitPrice:6,   note:"" },
  { id:6,  partId:3,  date:"2025-02-20", supplier:"パーツクラブ",  qty:200, unitPrice:4,   note:"" },
  { id:7,  partId:3,  date:"2025-03-15", supplier:"手芸の山久",    qty:150, unitPrice:3.5, note:"" },
  { id:8,  partId:4,  date:"2025-02-28", supplier:"Beads & Parts", qty:30,  unitPrice:18,  note:"" },
  { id:9,  partId:4,  date:"2025-03-18", supplier:"Beads & Parts", qty:20,  unitPrice:19,  note:"価格改定後" },
  { id:10, partId:5,  date:"2025-02-10", supplier:"手芸の山久",    qty:20,  unitPrice:120, note:"" },
  { id:11, partId:6,  date:"2025-02-10", supplier:"手芸の山久",    qty:30,  unitPrice:85,  note:"" },
  { id:12, partId:7,  date:"2025-02-05", supplier:"石と珠",        qty:150, unitPrice:45,  note:"" },
  { id:13, partId:7,  date:"2025-03-12", supplier:"石と珠",        qty:100, unitPrice:48,  note:"価格改定" },
  { id:14, partId:8,  date:"2025-02-05", supplier:"石と珠",        qty:30,  unitPrice:110, note:"" },
  { id:15, partId:9,  date:"2025-02-01", supplier:"資材屋さん",    qty:300, unitPrice:3,   note:"" },
  { id:16, partId:9,  date:"2025-03-01", supplier:"資材屋さん",    qty:200, unitPrice:3,   note:"" },
  { id:17, partId:10, date:"2025-02-01", supplier:"資材屋さん",    qty:100, unitPrice:12,  note:"" },
  { id:18, partId:10, date:"2025-03-01", supplier:"資材屋さん",    qty:50,  unitPrice:12,  note:"" },
];

const INIT_DISPOSALS = [
  { id:1, partId:1, date:"2025-03-05", qty:10, reason:"変色・劣化" },
  { id:2, partId:8, date:"2025-03-22", qty:3,  reason:"割れ・破損" },
];

const INIT_PROCESSINGS = [];

// 完成品マスタ（レシピ）
const INIT_PRODUCTS = [
  { id:1, name:"パールピアス",           desc:"淡水パール × Cカン × ピアスポスト",
    ingredients:[{partId:7,qty:4},{partId:1,qty:4},{partId:4,qty:1},{partId:9,qty:1},{partId:10,qty:1}],
    shippingCost:220, laborCost:150 },
  { id:2, name:"ゴールドチェーンネックレス", desc:"ボールチェーン × 丸カン",
    ingredients:[{partId:5,qty:0.4},{partId:3,qty:2},{partId:9,qty:1}],
    shippingCost:220, laborCost:100 },
  { id:3, name:"天然石ブレスレット",     desc:"ローズクォーツ × Cカン",
    ingredients:[{partId:8,qty:10},{partId:1,qty:2},{partId:9,qty:1}],
    shippingCost:310, laborCost:200 },
];

// 完成品の制作記録（これが在庫の源泉）
// productId, date, qty, note
const INIT_MADE = [
  { id:1, productId:1, date:"2025-02-20", qty:10, note:"" },
  { id:2, productId:2, date:"2025-02-25", qty:5,  note:"" },
  { id:3, productId:3, date:"2025-03-01", qty:4,  note:"" },
  { id:4, productId:1, date:"2025-03-10", qty:8,  note:"追加制作" },
];

// 委託先マスタ
const INIT_CONSIGNEES = [
  { id:1, name:"ギャラリーABC", address:"札幌市中央区", memo:"月末締め翌月払い" },
  { id:2, name:"雑貨店 Hana",   address:"札幌市北区",   memo:"販売手数料30%" },
];

// 委託記録（productId × consigneeId ごと）
// type: "deliver" | "return" | "loss" | "sale"（委託先での売上）
const INIT_CONSIGN_RECORDS = [
  { id:1, productId:1, consigneeId:1, date:"2025-03-05", type:"deliver", qty:5,  salePrice:1800, feeRate:30, memo:"" },
  { id:2, productId:2, consigneeId:1, date:"2025-03-05", type:"deliver", qty:3,  salePrice:3200, feeRate:30, memo:"" },
  { id:3, productId:1, consigneeId:2, date:"2025-03-10", type:"deliver", qty:4,  salePrice:2000, feeRate:30, memo:"" },
  { id:4, productId:1, consigneeId:1, date:"2025-03-25", type:"sale",    qty:2,  salePrice:1800, feeRate:30, memo:"3月分報告" },
  { id:5, productId:1, consigneeId:2, date:"2025-04-01", type:"sale",    qty:1,  salePrice:2000, feeRate:30, memo:"" },
  { id:6, productId:2, consigneeId:1, date:"2025-04-01", type:"sale",    qty:1,  salePrice:3200, feeRate:30, memo:"" },
  { id:7, productId:1, consigneeId:2, date:"2025-04-05", type:"loss",    qty:1,  salePrice:0,    feeRate:0,  memo:"展示中に破損" },
];

// 売上記録（直販）
const INIT_SALES = [
  { id:1, productId:1, date:"2025-03-08", channel:"実店舗", qty:3, price:1800, shippingActual:0,   memo:"" },
  { id:2, productId:2, date:"2025-03-05", channel:"BASE",   qty:1, price:3200, shippingActual:220, memo:"" },
  { id:3, productId:3, date:"2025-03-12", channel:"Creema", qty:1, price:4500, shippingActual:310, memo:"CR-20250312" },
  { id:4, productId:2, date:"2025-03-15", channel:"Minne",  qty:2, price:3200, shippingActual:220, memo:"" },
  { id:5, productId:3, date:"2025-03-25", channel:"実店舗", qty:2, price:4500, shippingActual:0,   memo:"" },
  { id:6, productId:1, date:"2025-04-02", channel:"Minne",  qty:4, price:1800, shippingActual:220, memo:"MN-20250402" },
  { id:7, productId:2, date:"2025-04-05", channel:"Creema", qty:1, price:3200, shippingActual:220, memo:"" },
  { id:8, productId:3, date:"2025-04-08", channel:"BASE",   qty:1, price:4500, shippingActual:310, memo:"" },
];

const PART_CATS = ["すべて","金具","チェーン","ビーズ","梱包材"];
const INIT_CHANNELS = [
  { id:1, name:"Minne",  feeRate:10,  color:"#e8847a" },
  { id:2, name:"Creema", feeRate:10,  color:"#7ab5e8" },
  { id:3, name:"BASE",   feeRate:6.6, color:"#8ae8a8" },
  { id:4, name:"実店舗", feeRate:0,   color:"#e8c87a" },
];
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

// ─── ユーティリティ ───────────────────────────────────────────
const fmt  = n => Math.round(Number(n)).toLocaleString("ja-JP");
const fmtD = n => Number(n).toFixed(1);
const pct  = (a,b) => b===0?0:Math.round((a/b)*100);

function calcPartStock(partId, purchases, disposals, partUsages=[], processings=[], type=undefined) {
  const disps   = disposals.filter(d=>d.partId===partId);
  const dispQty = disps.reduce((s,d)=>s+d.qty,0);

  if(type==="material") {
    // 原材料: 仕入累計 - 加工で使った量 - 廃棄累計
    const buys    = purchases.filter(p=>p.partId===partId);
    const totalQty = buys.reduce((s,p)=>s+p.qty,0);
    const totalAmt = buys.reduce((s,p)=>s+p.qty*p.unitPrice,0);
    const avgPrice = totalQty>0 ? totalAmt/totalQty : 0;
    const usedInProc = processings.filter(pr=>pr.inputPartId===partId).reduce((s,pr)=>s+pr.inputQty,0);
    const supMap = new Map();
    buys.forEach(p=>supMap.set(p.supplier,p.unitPrice));
    return { stock: totalQty-usedInProc-dispQty, avgPrice, supMap };
  }

  if(type==="part") {
    // 加工済み部品: 加工記録output累計 - 制作時使用累計 - 廃棄累計
    const usages  = partUsages.filter(u=>u.partId===partId);
    const usedQty = usages.reduce((s,u)=>s+u.qty,0);
    let totalOutputQty = 0;
    let totalCost = 0;
    processings.forEach(pr=>{
      const out = pr.outputs.find(o=>o.partId===partId);
      if(!out) return;
      totalOutputQty += out.qty;
      // 入力材料の加重平均単価を計算して按分
      const inputBuys   = purchases.filter(p=>p.partId===pr.inputPartId);
      const inputTotQty = inputBuys.reduce((s,p)=>s+p.qty,0);
      const inputTotAmt = inputBuys.reduce((s,p)=>s+p.qty*p.unitPrice,0);
      const inputAvg    = inputTotQty>0 ? inputTotAmt/inputTotQty : 0;
      const allOutQty   = pr.outputs.reduce((s,o)=>s+o.qty,0);
      const costPerUnit = allOutQty>0 ? (pr.inputQty*inputAvg)/allOutQty : 0;
      totalCost += out.qty * costPerUnit;
    });
    const avgPrice = totalOutputQty>0 ? totalCost/totalOutputQty : 0;
    return { stock: totalOutputQty-usedQty-dispQty, avgPrice, supMap:new Map() };
  }

  // 通常部品（type:undefined）: 仕入累計 - 廃棄累計 - 制作時使用累計
  const buys    = purchases.filter(p=>p.partId===partId);
  const usages  = partUsages.filter(u=>u.partId===partId);
  const totalQty = buys.reduce((s,p)=>s+p.qty,0);
  const totalAmt = buys.reduce((s,p)=>s+p.qty*p.unitPrice,0);
  const usedQty  = usages.reduce((s,u)=>s+u.qty,0);
  const avgPrice = totalQty>0 ? totalAmt/totalQty : 0;
  const supMap   = new Map();
  buys.forEach(p=>supMap.set(p.supplier,p.unitPrice));
  return { stock: totalQty-dispQty-usedQty, avgPrice, supMap };
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

// 完成品の手元在庫 = 制作数 - 直販売上 - 委託納品 + 委託返品
function calcProductStock(productId, made, sales, consignRecords) {
  const madeQty    = made.filter(m=>m.productId===productId).reduce((s,m)=>s+m.qty,0);
  const soldQty    = sales.filter(s=>s.productId===productId).reduce((s,sale)=>s+sale.qty,0);
  const deliverQty = consignRecords.filter(r=>r.productId===productId&&r.type==="deliver").reduce((s,r)=>s+r.qty,0);
  const returnQty  = consignRecords.filter(r=>r.productId===productId&&r.type==="return").reduce((s,r)=>s+r.qty,0);
  const hand = madeQty - soldQty - deliverQty + returnQty;
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
  const cost = productCostMap[sale.productId]?.total||0;
  const revenue = sale.price*sale.qty;
  const feeRate = sale.feeRate!=null ? sale.feeRate : (chFeeMap[sale.channel]??0);
  const channelFee = Math.round(sale.price*(feeRate/100))*sale.qty;
  const shipping = (sale.shippingActual||0)*sale.qty;
  const profit = revenue - cost*sale.qty - channelFee - shipping;
  return { revenue, totalCost:cost*sale.qty, channelFee, shipping, profit, profitRate:pct(profit,revenue), feeRate };
}

// ═══════════════════════════════════════════════════════════════
//  CSS
// ═══════════════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@300;400;500;700&family=DM+Serif+Display&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#faf8f5;--sf:#fff;--s2:#f4f1ec;--bd:#e8e3da;
  --tx:#2c2417;--t2:#8c7d6a;--ac:#c9773a;--gold:#d4a853;
  --low:#c94040;--low-bg:#fdf0f0;--warn:#b87d2a;--warn-bg:#fdf6e8;
  --ok:#3a8c5a;--ok-bg:#edf7f1;--r:12px;--sh:0 2px 14px rgba(44,36,23,.08);
}
body{font-family:'Zen Kaku Gothic New',sans-serif;background:var(--bg);color:var(--tx);min-height:100vh;}
.app{max-width:900px;margin:0 auto;padding:0 0 76px;}

.header{background:var(--tx);padding:17px 18px 13px;}
.h-logo{font-family:'DM Serif Display',serif;color:var(--gold);font-size:20px;}
.h-sub{color:#8c7d6a;font-size:11px;margin-top:1px;}

.nav{position:fixed;bottom:0;left:0;right:0;z-index:100;background:var(--sf);border-top:1px solid var(--bd);display:flex;box-shadow:0 -4px 18px rgba(44,36,23,.08);}
.nb{flex:1;padding:9px 2px 6px;display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:none;cursor:pointer;color:var(--t2);font-family:inherit;font-size:9px;transition:color .15s;}
.nb.on{color:var(--ac);}
.ni{font-size:16px;}

.sec{padding:16px 14px;}
.sec-title{font-family:'DM Serif Display',serif;font-size:19px;margin-bottom:13px;}
.sec-sub{font-size:11px;color:var(--t2);margin-bottom:10px;margin-top:-8px;}

.kpi-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;}
.kpi{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:13px 11px;box-shadow:var(--sh);}
.kl{font-size:10px;color:var(--t2);margin-bottom:3px;}
.kv{font-family:'DM Serif Display',serif;font-size:23px;}
.ks{font-size:10px;color:var(--t2);margin-top:1px;}
.kpi.ac{background:var(--ac);border-color:var(--ac);}
.kpi.ac .kl,.kpi.ac .kv,.kpi.ac .ks{color:#fff;}

.alert-box{background:var(--low-bg);border:1px solid #f5c6c6;border-radius:var(--r);padding:10px 12px;margin-bottom:13px;}
.alert-ttl{font-size:11px;color:var(--low);font-weight:700;margin-bottom:6px;}
.alert-row{font-size:11px;padding:3px 0;border-bottom:1px solid #f5c6c6;}
.alert-row:last-child{border:none;}

.chart-card{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:13px;margin-bottom:13px;box-shadow:var(--sh);}
.chart-ttl{font-size:10px;color:var(--t2);margin-bottom:9px;text-transform:uppercase;letter-spacing:.05em;}
.bar-row{display:flex;align-items:center;gap:7px;margin-bottom:7px;}
.bar-lbl{font-size:11px;width:52px;color:var(--t2);}
.bar-tr{flex:1;height:8px;background:var(--s2);border-radius:4px;overflow:hidden;}
.bar-f{height:100%;border-radius:4px;}
.bar-v{font-size:11px;width:58px;text-align:right;font-weight:500;}

.filter-row{display:flex;gap:5px;margin-bottom:11px;flex-wrap:wrap;align-items:center;}
.chip{padding:4px 10px;border-radius:20px;font-size:11px;font-family:inherit;border:1px solid var(--bd);background:var(--sf);cursor:pointer;color:var(--t2);transition:all .12s;}
.chip.on{background:var(--ac);border-color:var(--ac);color:#fff;}
.si{flex:1;min-width:100px;padding:5px 10px;border:1px solid var(--bd);border-radius:20px;font-family:inherit;font-size:11px;background:var(--sf);outline:none;color:var(--tx);}
.si:focus{border-color:var(--ac);}

/* 部品カード */
.pc{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:12px 11px;margin-bottom:7px;box-shadow:var(--sh);display:flex;justify-content:space-between;align-items:flex-start;gap:8px;}
.pc.low{border-left:3px solid var(--low);}
.pc.warn{border-left:3px solid var(--warn);}
.pc.ok{border-left:3px solid var(--ok);}
.pn{font-size:13px;font-weight:700;}
.pv{font-size:11px;color:var(--t2);margin-top:1px;}
.pbadge{display:inline-block;font-size:9px;padding:2px 7px;border-radius:8px;background:var(--s2);color:var(--t2);margin-top:4px;}
.price-avg{font-size:11px;color:var(--ac);font-weight:700;margin-top:5px;}
.price-row{font-size:10px;color:var(--t2);margin-top:2px;}
.psb{text-align:right;flex-shrink:0;}
.psn{font-family:'DM Serif Display',serif;font-size:25px;}
.psn.low{color:var(--low);}
.psn.warn{color:var(--warn);}
.psn.ok{color:var(--ok);}
.psu{font-size:10px;color:var(--t2);}
.psm{font-size:9px;color:var(--t2);margin-top:1px;}
.sbadge{display:inline-block;font-size:9px;padding:2px 6px;border-radius:7px;margin-top:3px;font-weight:700;}
.sbadge.low{background:var(--low-bg);color:var(--low);}
.sbadge.warn{background:var(--warn-bg);color:var(--warn);}
.sbadge.ok{background:var(--ok-bg);color:var(--ok);}

/* 完成品在庫カード */
.prod-stk-card{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);margin-bottom:10px;box-shadow:var(--sh);overflow:hidden;}
.prod-stk-header{padding:13px 13px 11px;display:flex;justify-content:space-between;align-items:flex-start;cursor:pointer;}
.prod-stk-name{font-size:14px;font-weight:700;}
.prod-stk-desc{font-size:11px;color:var(--t2);margin-top:2px;}
.prod-stk-right{text-align:right;flex-shrink:0;}
.prod-stk-total{font-family:'DM Serif Display',serif;font-size:26px;color:var(--tx);}
.prod-stk-lbl{font-size:9px;color:var(--t2);}
.prod-stk-toggle{font-size:10px;color:var(--t2);margin-top:3px;}

.prod-stk-body{border-top:1px solid var(--bd);padding:11px 13px;background:var(--s2);}
.stk-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px;}
.stk-row-lbl{color:var(--t2);}
.stk-row-val{font-weight:700;}
.stk-divider{height:1px;background:var(--bd);margin:5px 0;}

/* 委託先ブロック */
.consignee-block{background:var(--sf);border:1px solid var(--bd);border-radius:9px;padding:10px 11px;margin-top:8px;}
.consignee-name{font-size:12px;font-weight:700;color:var(--ac);margin-bottom:6px;}
.consignee-row{display:flex;justify-content:space-between;font-size:11px;padding:2px 0;}
.consignee-lbl{color:var(--t2);}
.consignee-val{font-weight:500;}
.consignee-stock-big{font-family:'DM Serif Display',serif;font-size:20px;color:var(--tx);}
.consignee-memo{font-size:10px;color:var(--t2);margin-top:5px;padding-top:4px;border-top:1px solid var(--bd);}

/* 完成品レシピカード */
.recipe-card{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);margin-bottom:10px;box-shadow:var(--sh);overflow:hidden;}
.recipe-header{padding:13px 13px 10px;display:flex;justify-content:space-between;align-items:flex-start;cursor:pointer;}
.recipe-name{font-size:14px;font-weight:700;}
.recipe-desc{font-size:11px;color:var(--t2);margin-top:2px;}
.recipe-cost{text-align:right;flex-shrink:0;}
.recipe-total{font-family:'DM Serif Display',serif;font-size:20px;color:var(--ac);}
.recipe-lbl{font-size:9px;color:var(--t2);}
.recipe-toggle{font-size:10px;color:var(--t2);margin-top:3px;}
.recipe-body{border-top:1px solid var(--bd);padding:10px 13px 12px;background:var(--s2);}
.cost-sec-lbl{font-size:9px;color:var(--t2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;margin-top:8px;}
.cost-sec-lbl:first-child{margin-top:0;}
.cost-row{display:flex;justify-content:space-between;font-size:11px;padding:3px 0;}
.cost-sub{font-size:10px;color:var(--t2);margin-left:5px;}
.cost-div{height:1px;background:var(--bd);margin:6px 0;}
.cost-total-row{display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--ac);}

/* 仕入・廃棄 */
.sub-tabs{display:flex;border:1px solid var(--bd);border-radius:10px;overflow:hidden;margin-bottom:13px;}
.stab{flex:1;padding:8px;font-family:inherit;font-size:12px;background:none;border:none;cursor:pointer;color:var(--t2);}
.stab.on{background:var(--ac);color:#fff;font-weight:700;}
.rc{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:11px 12px;margin-bottom:6px;box-shadow:var(--sh);}
.rc-top{display:flex;justify-content:space-between;align-items:flex-start;}
.rc-name{font-size:12px;font-weight:700;}
.rc-meta{font-size:10px;color:var(--t2);margin-top:1px;}
.rc-amt{font-size:13px;font-weight:700;color:var(--ac);text-align:right;}
.rc-qty{font-size:10px;color:var(--t2);text-align:right;margin-top:1px;}
.rc-note{font-size:10px;color:var(--t2);margin-top:5px;padding-top:4px;border-top:1px solid var(--bd);}
.dc{background:var(--sf);border:1px solid #f5c6c6;border-radius:var(--r);padding:11px 12px;margin-bottom:6px;box-shadow:var(--sh);}
.dc-reason{font-size:10px;color:var(--low);margin-top:3px;}

/* 売上 */
.sc-list{display:flex;gap:6px;margin-bottom:13px;overflow-x:auto;padding-bottom:2px;}
.sc{flex-shrink:0;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:8px 11px;text-align:center;box-shadow:var(--sh);cursor:pointer;transition:border-color .15s;}
.sc.active{border-color:var(--ac);border-left:3px solid var(--ac);background:var(--s2);}
.sc-ch{font-size:10px;color:var(--t2);}
.sc-v{font-size:14px;font-weight:700;}
.sc-cnt{font-size:9px;color:var(--t2);margin-top:1px;}
.sale-card{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);margin-bottom:8px;box-shadow:var(--sh);overflow:hidden;}
.sale-main{padding:11px 12px;display:flex;justify-content:space-between;align-items:flex-start;cursor:pointer;}
.sale-name{font-size:13px;font-weight:700;}
.sale-meta{font-size:10px;color:var(--t2);margin-top:2px;}
.sale-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:4px;}
.sale-rev{font-size:14px;font-weight:700;text-align:right;}
.sale-margin{font-size:10px;margin-top:2px;text-align:right;}
.sale-toggle{font-size:10px;color:var(--t2);margin-top:3px;text-align:right;}
.sale-detail{border-top:1px solid var(--bd);padding:9px 12px;background:var(--s2);}
.sd-row{display:flex;justify-content:space-between;font-size:11px;padding:2px 0;}
.sd-lbl{color:var(--t2);}
.sd-val{font-weight:500;}
.sd-div{height:1px;background:var(--bd);margin:5px 0;}
.sd-total{display:flex;justify-content:space-between;font-size:12px;font-weight:700;padding-top:2px;}
.sd-memo{font-size:10px;color:var(--t2);margin-top:5px;padding-top:4px;border-top:1px solid var(--bd);}

/* FAB */
.fab{position:fixed;right:16px;bottom:64px;z-index:200;width:48px;height:48px;border-radius:50%;background:var(--ac);color:#fff;border:none;font-size:22px;cursor:pointer;box-shadow:0 4px 14px rgba(201,119,58,.4);display:flex;align-items:center;justify-content:center;}

/* Modal */
.ov{position:fixed;inset:0;background:rgba(44,36,23,.52);z-index:300;display:flex;align-items:flex-end;justify-content:center;}
.modal{background:var(--sf);border-radius:20px 20px 0 0;padding:20px 16px 36px;width:100%;max-width:600px;animation:suUp .22s ease;max-height:90vh;overflow-y:auto;}
@keyframes suUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.modal-title{font-family:'DM Serif Display',serif;font-size:17px;margin-bottom:13px;}
.modal-sub{font-size:11px;color:var(--t2);margin-top:-8px;margin-bottom:11px;}
.fr{margin-bottom:9px;}
.fl{font-size:10px;color:var(--t2);margin-bottom:3px;display:block;}
.fi,.fs{width:100%;padding:7px 10px;border:1px solid var(--bd);border-radius:8px;font-family:inherit;font-size:12px;background:var(--s2);color:var(--tx);outline:none;}
.fi:focus,.fs:focus{border-color:var(--ac);background:#fff;}
.fr2{display:grid;grid-template-columns:1fr 1fr;gap:7px;}
.fr3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;}
.div{height:1px;background:var(--bd);margin:9px 0;}
.sec-label{font-size:10px;color:var(--t2);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:7px;margin-top:4px;}

/* レシピ行 */
.ing-row{display:flex;gap:6px;align-items:center;margin-bottom:6px;}
.ing-row .fs{flex:2;}
.ing-row .fi{flex:1;}
.ing-del{background:none;border:none;color:var(--low);font-size:16px;cursor:pointer;padding:0 2px;flex-shrink:0;}
.part-chip-used{display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:20px;background:var(--ac);color:#fff;border:none;font-family:inherit;font-size:12px;cursor:pointer;margin:3px;}
.part-chip-unused{display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:20px;background:none;color:var(--t2);border:1px solid var(--bd);font-family:inherit;font-size:12px;cursor:pointer;margin:3px;}
.part-chips{display:flex;flex-wrap:wrap;margin-bottom:4px;}
.made-sec{margin-top:14px;}
.made-sec-ttl{font-size:11px;font-weight:700;color:var(--t2);margin-bottom:6px;display:flex;align-items:center;gap:6px;}
.add-row-btn{background:none;border:1px dashed var(--bd);border-radius:8px;color:var(--t2);font-family:inherit;font-size:11px;cursor:pointer;padding:5px 10px;width:100%;margin-top:2px;}
.add-ing-btn{font-size:11px;color:var(--ac);background:none;border:1px dashed var(--ac);border-radius:8px;padding:5px 10px;font-family:inherit;cursor:pointer;width:100%;margin-bottom:8px;}

/* 損益プレビュー */
.preview-box{background:var(--s2);border-radius:9px;padding:9px 11px;margin-bottom:7px;}
.prev-row{display:flex;justify-content:space-between;font-size:11px;padding:2px 0;}
.prev-lbl{color:var(--t2);}
.prev-val{font-weight:500;}
.prev-div{height:1px;background:var(--bd);margin:5px 0;}
.prev-total{display:flex;justify-content:space-between;font-size:12px;font-weight:700;}

.btn-p{width:100%;padding:11px;border-radius:9px;background:var(--ac);color:#fff;border:none;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;margin-top:6px;}
.btn-c{width:100%;padding:9px;border-radius:9px;background:none;color:var(--t2);border:1px solid var(--bd);font-family:inherit;font-size:12px;cursor:pointer;margin-top:4px;}
.btn-d{width:100%;padding:9px;border-radius:9px;background:none;color:var(--low);border:1px solid var(--low);font-family:inherit;font-size:12px;cursor:pointer;margin-top:8px;}
.empty{text-align:center;color:var(--t2);font-size:12px;padding:28px 0;}
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

  const [tab,    setTab]    = useState("dashboard");
  const [subTab,  setSubTab]  = useState("purchase");
  const [subTab2, setSubTab2] = useState("stock"); // prodstock: "stock" | "recipe"
  const [cat,    setCat]    = useState("すべて");
  const [q,      setQ]      = useState("");
  const [modal,  setModal]  = useState(null);
  const [open,   setOpen]   = useState({});
  const [selectedConsigneeId, setSelectedConsigneeId] = useState(null); // 委託先詳細ページ用

  // フォーム
  const [pf,  setPf]  = useState({ partId:"",   date:today(),   supplier:"",   qty:"",  totalPrice:"", note:"" });
  const [pfCat, setPfCat] = useState("");
  const [df,  setDf]  = useState({ partId:"",   date:today(),   qty:"",        reason:"" });
  const [editingPurchaseId,  setEditingPurchaseId]  = useState(null);
  const [editingDisposalId,  setEditingDisposalId]  = useState(null);
  const [sf,  setSf]  = useState({ productId:"", date:today(),  channel:"Minne", qty:"1", price:"", shippingActual:"", memo:"" });
  const MF_INIT = { productId:"", date:today(), qty:"1", note:"", checkedParts:{}, extraParts:[], lossParts:[] };
  const [mf,  setMf]  = useState(MF_INIT);
  const [cf,  setCf]  = useState({ productId:"", consigneeId:"", date:today(), type:"deliver", qty:"1", salePrice:"", feeRate:"30", memo:"" });
  // レシピ登録フォーム
  const [rf, setRf]   = useState({ name:"", desc:"", cat:"", shippingCost:"", laborCost:"", ingredients:[{partId:"",qty:""}] });
  const [prodCatFilter, setProdCatFilter] = useState("すべて");
  const [showNewProdCat,  setShowNewProdCat]  = useState(false);
  const [newProdCatInput, setNewProdCatInput] = useState("");

  const tog = key => setOpen(p=>({...p,[key]:!p[key]}));

  // ── チャネル derived ──────────────────────────────────────────
  const chFeeMap = useMemo(()=>Object.fromEntries(channels.map(c=>[c.name,c.feeRate])),[channels]);
  const chColMap = useMemo(()=>Object.fromEntries(channels.map(c=>[c.name,c.color])),[channels]);

  // ── 計算 ──────────────────────────────────────────────────────
  const partStockMap = useMemo(()=>{
    const m={};
    parts.forEach(p=>{ m[p.id]=calcPartStock(p.id,purchases,disposals,partUsages,processings,p.type); });
    return m;
  },[parts,purchases,disposals,partUsages,processings]);

  const productCostMap = useMemo(()=>{
    const m={};
    products.forEach(pr=>{ m[pr.id]=calcProductCost(pr,partStockMap,parts); });
    return m;
  },[products,partStockMap,parts]);

  const productStockMap = useMemo(()=>{
    const m={};
    products.forEach(pr=>{ m[pr.id]=calcProductStock(pr.id,made,sales,consignRecords); });
    return m;
  },[products,made,sales,consignRecords]);

  const partMinStock = (p) => p.minStock ?? MIN_STOCK[p.id] ?? 10;

  const partSt = (id,stock)=>{
    const p = parts.find(pt=>pt.id===id);
    const min = p ? partMinStock(p) : (MIN_STOCK[id]||10);
    return stock<min?"low":stock<min*1.5?"warn":"ok";
  };

  const filteredParts = useMemo(()=>
    parts.filter(p=>(cat==="すべて"||p.cat===cat)&&(p.name.includes(q)||p.variant.includes(q)))
  ,[parts,cat,q]);

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

  // 売上モーダル プレビュー
  const salePreview = useMemo(()=>{
    if(!sf.productId||!sf.price||!sf.qty) return null;
    const cost = productCostMap[+sf.productId]?.total||0;
    const rev  = +sf.price * +sf.qty;
    const feeRate = chFeeMap[sf.channel]??0;
    const fee  = Math.round(+sf.price*(feeRate/100))*(+sf.qty);
    const ship = (+sf.shippingActual||0)*(+sf.qty);
    const profit = rev - cost*(+sf.qty) - fee - ship;
    return { rev, cost:cost*(+sf.qty), fee, ship, profit, feeRate };
  },[sf,productCostMap,chFeeMap]);

  // ── 在庫補充（ダッシュボードのアラートから仕入モーダルを開く） ──
  const openReplenish = (p) => {
    setPfCat(p.cat||"");
    setPf({ partId:String(p.id), date:today(), supplier:"", qty:"", totalPrice:"", note:"" });
    setEditingPurchaseId(null);
    setModal("purchase");
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
    const totalPrice = Math.round(pu.qty * pu.unitPrice * 1.1);
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
      setPurchases(ps=>ps.map(pu=>pu.id===editingPurchaseId ? {...pu,partId:+pf.partId,date:pf.date,supplier:pf.supplier,qty,unitPrice,note:pf.note} : pu));
    } else {
      setPurchases(p=>[...p,{id:nextId(),partId:+pf.partId,date:pf.date,supplier:pf.supplier,qty,unitPrice,note:pf.note}]);
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
    setSf({productId:"",date:today(),channel:channels[0]?.name||"",qty:"1",price:"",shippingActual:"",memo:""});
  };

  const openEditSale = (s)=>{
    setSf({ productId:String(s.productId), date:s.date, channel:s.channel, qty:String(s.qty), price:String(s.price), shippingActual:String(s.shippingActual||""), memo:s.memo||"" });
    setEditingSaleId(s.id);
    setModal("sale");
  };

  const addSale = ()=>{
    if(!sf.productId||!sf.date||!sf.price||!sf.qty) return;
    const base = { productId:+sf.productId, date:sf.date, channel:sf.channel, qty:+sf.qty, price:+sf.price, shippingActual:+sf.shippingActual||0, memo:sf.memo };
    if(editingSaleId) {
      setSales(ss=>ss.map(s=>s.id===editingSaleId ? {...s,...base} : s));
    } else {
      setSales(p=>[...p,{id:nextId(),...base}]);
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

  // ── 部品カテゴリ（動的・重複排除） ────────────────────────────
  const partCats = useMemo(()=>{
    const base = ["金具","チェーン","ビーズ","梱包材"];
    const fromParts = parts.map(p=>p.cat).filter(c=>!base.includes(c));
    return [...base, ...new Set(fromParts)];
  },[parts]);

  // ── 完成品カテゴリ（動的・重複排除） ──────────────────────────
  const productCats = useMemo(()=>{
    const base = ["ピアス","イヤリング","ネックレス","ブレスレット","リング","その他"];
    const fromProds = products.map(p=>p.cat).filter(c=>c&&!base.includes(c));
    return [...base, ...new Set(fromProds)];
  },[products]);

  const suppliers = useMemo(()=>{
    const base = purchases.map(p=>p.supplier).filter(s=>s&&s.trim());
    return [...new Set(base)].sort();
  },[purchases]);

  // ── 部品マスタ追加・編集 ────────────────────────────────────────────
  const [partForm,      setPartForm]      = useState({ cat:"金具", name:"", variant:"", unit:"個", hinban:"", minStock:"10", type:"", parentId:"" });
  const [newCatInput,   setNewCatInput]   = useState("");   // カテゴリ新規入力欄
  const [showNewCat,    setShowNewCat]    = useState(false);
  const [editingPartId, setEditingPartId] = useState(null); // null=新規, id=編集中

  // ── 仕入先入力管理 ────────────────────────────────────────────
  const [showNewSupplier, setShowNewSupplier] = useState(false);

  const openEditPart = (p) => {
    setPartForm({ cat: p.cat, name: p.name, variant: p.variant, unit: p.unit, hinban: p.hinban||"", minStock: String(p.minStock ?? MIN_STOCK[p.id] ?? 10), type: p.type ?? "", parentId: p.parentId ? String(p.parentId) : "" });
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
  };

  const addPart = () => {
    const cat = showNewCat ? newCatInput.trim() : partForm.cat;
    if(!partForm.name || !cat) return;
    const minStock = +partForm.minStock || 10;
    const type = partForm.type || undefined;
    const parentId = type === "part" && partForm.parentId ? +partForm.parentId : undefined;
    if(editingPartId) {
      setParts(ps => ps.map(p => p.id===editingPartId ? { ...p, cat, name: partForm.name, variant: partForm.variant, unit: partForm.unit, hinban: partForm.hinban, minStock, type, parentId } : p));
    } else {
      const newPart = { id: nextId(), cat, name: partForm.name, variant: partForm.variant, unit: partForm.unit, hinban: partForm.hinban, minStock, type, parentId };
      setParts(p => [...p, newPart]);
    }
    setPartForm({ cat:"金具", name:"", variant:"", unit:"個", hinban:"", minStock:"10", type:"", parentId:"" });
    setNewCatInput("");
    setShowNewCat(false);
    setEditingPartId(null);
    setModal(null);
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
          <div className="h-logo">✦ Atelier Stock</div>
          <div className="h-sub">部品 管理システム</div>
        </div>

        {/* ════ DASHBOARD ════ */}
        {tab==="dashboard" && (
          <div className="sec">
            <div className="sec-title">今月のサマリー <span style={{fontSize:12,color:"var(--t2)",fontWeight:400}}>{THIS_MONTH.replace("-","年")}月</span></div>
            {alerts.length>0 && (
              <div className="alert-box">
                <div className="alert-ttl">⚠ 部品在庫アラート（{alerts.length}件）</div>
                {alerts.slice(0,4).map(p=>{
                  const {stock}=partStockMap[p.id];
                  return (
                    <div className="alert-row" key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                      <span>{p.name}（{p.variant}）　残 <strong>{stock}{p.unit}</strong> / 最低 {partMinStock(p)}{p.unit}</span>
                      <button style={{flexShrink:0,fontSize:11,fontWeight:700,background:"var(--ac)",color:"#fff",border:"none",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontFamily:"inherit"}}
                        onClick={()=>openReplenish(p)}>在庫補充</button>
                    </div>
                  );
                })}
              </div>
            )}
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
            <div className="sec-title">部品在庫</div>
            <div className="filter-row">
              {["すべて",...partCats].map(c=><button key={c} className={`chip ${cat===c?"on":""}`} onClick={()=>setCat(c)}>{c}</button>)}
            </div>
            <div className="filter-row">
              <input className="si" placeholder="名前・バリエーションで検索" value={q} onChange={e=>setQ(e.target.value)}/>
            </div>
            {(()=>{
              // Build grouped list: 原材料の直後に子（加工済み部品）を表示
              const shownChildIds = new Set();
              const rows = [];
              filteredParts.forEach(p=>{
                if(shownChildIds.has(p.id)) return;
                rows.push({p, isChild:false});
                if(p.type==="material"){
                  // 同じ原材料を親に持つ加工済み部品を挿入（filteredParts内のみ + 全partsも含む）
                  parts.filter(c=>c.type==="part"&&c.parentId===p.id).forEach(child=>{
                    shownChildIds.add(child.id);
                    rows.push({p:child, isChild:true});
                  });
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
                            <span>{parentPart.name}{parentPart.hinban?` #${parentPart.hinban}`:""} の加工済み部品</span>
                          </div>
                        )}
                        <div className="pn">{p.name} {p.hinban && <span style={{fontSize:"12px",color:"var(--t2)",fontWeight:400}}>#{p.hinban}</span>}</div>
                        <div className="pv">{p.variant}</div>
                        <span className="pbadge">{p.cat}</span>
                        {p.type && <span className="pbadge" style={{background:"var(--s2)",color:"var(--ac)",marginLeft:4}}>{p.type==="material"?"原材料":p.type==="part"?"加工済み":""}</span>}
                        <div className="price-avg">加重平均 ¥{fmtD(avgPrice)} / {p.unit}</div>
                        {supMap.size>1
                          ? <div className="price-row">{[...supMap.entries()].map(([s,pr])=><span key={s} style={{marginRight:8}}>📦{s}：¥{pr}</span>)}</div>
                          : <div className="price-row">📦 {[...supMap.keys()][0]||"—"}</div>
                        }
                        {p.type==="material" && totalBought>0 && (
                          <div style={{marginTop:6}}>
                            <div style={{height:6,background:"var(--bd)",borderRadius:3,overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${stockPct}%`,background:stockPct>50?"var(--ok)":stockPct>20?"var(--warn)":"var(--low)",borderRadius:3,transition:"width .3s"}}/>
                            </div>
                            <div style={{fontSize:10,color:"var(--t2)",marginTop:2}}>{stock}{p.unit} / {totalBought}{p.unit}（{stockPct}%）</div>
                          </div>
                        )}
                        <button style={{marginTop:6,background:"none",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t2)",fontSize:12,cursor:"pointer",padding:"2px 8px",fontFamily:"inherit"}} onClick={()=>openEditPart(p)}>✏ 編集</button>
                      </div>
                      <div className="psb">
                        <div className={`psn ${st}`}>{stock}</div>
                        <div className="psu">{p.unit}</div>
                        <div className="psm">最低 {partMinStock(p)}</div>
                        <span className={`sbadge ${st}`}>{st==="low"?"要発注":st==="warn"?"少なめ":"良好"}</span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* ════ 完成品（在庫 + レシピ） ════ */}
        {tab==="prodstock" && (
          <div className="sec">
            <div className="sec-title">完成品</div>
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

            {/* 完成品在庫 */}
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
                      <div className="prod-stk-toggle">{isOpen?"▲ 閉じる":"▼ 内訳"}</div>
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
                          <span style={{fontSize:11,color:"var(--ac)",fontWeight:700}}>📍 {cn.name}</span>
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
                      <div className="recipe-toggle">{isOpen?"▲":"▼ 内訳"}</div>
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
                      <button style={{marginTop:10,width:"100%",padding:"7px 0",border:"1px solid var(--bd)",borderRadius:8,background:"none",color:"var(--t2)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>openEditRecipe(pr)}>✏ レシピを編集</button>
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
                      <div className="prod-stk-name">📍 {cn.name}</div>
                      {cn.address && <div className="prod-stk-desc">{cn.address}</div>}
                      {cn.memo && <div className="prod-stk-desc" style={{color:"var(--ac)"}}>📝 {cn.memo}</div>}
                    </div>
                    <div className="prod-stk-right">
                      <div className="prod-stk-total">{totalStock}</div>
                      <div className="prod-stk-lbl">委託在庫（点）</div>
                      <div className="prod-stk-toggle">▶ 詳細</div>
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
                    <button style={{background:"none",border:"none",fontSize:20,cursor:"pointer",padding:0}} onClick={()=>setSelectedConsigneeId(null)}>◀</button>
                    <div style={{flex:1}}>
                      <div className="sec-title" style={{marginBottom:0}}>📍 {cn.name}</div>
                      {cn.address && <div className="prod-stk-desc">{cn.address}</div>}
                      {cn.memo && <div className="prod-stk-desc" style={{color:"var(--ac)"}}>📝 {cn.memo}</div>}
                    </div>
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
                                  onClick={()=>openConsignEnd(pr,cn.id,cs)}>委託終了</button>
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
                                <button style={{background:"none",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t2)",fontSize:11,cursor:"pointer",padding:"2px 8px",fontFamily:"inherit"}} onClick={()=>openEditConsign(r)}>✏ 編集</button>
                              </div>
                            </div>
                            {(isSale||isDeliver) && r.salePrice>0 && (
                              <div style={{fontSize:9,color:"var(--t2)",marginTop:5,paddingTop:4,borderTop:"1px solid var(--bd)",display:"flex",gap:10}}>
                                <span>販売価格 ¥{fmt(r.salePrice)}</span>
                                <span>手数料 {r.feeRate}%</span>
                                {isSale && <span style={{color:"var(--ok)",fontWeight:700}}>入金 ¥{fmt(Math.round(r.salePrice*(1-r.feeRate/100))*r.qty)}</span>}
                              </div>
                            )}
                            {r.memo && <div style={{fontSize:9,color:"var(--t2)",marginTop:4}}>📝 {r.memo}</div>}
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

        {/* ════ 仕入・廃棄 ════ */}
        {tab==="records" && (
          <div className="sec">
            <div className="sec-title">仕入・廃棄記録</div>
            <div className="sub-tabs">
              <button className={`stab ${subTab==="purchase"?"on":""}`} onClick={()=>setSubTab("purchase")}>仕入（{purchases.length}）</button>
              <button className={`stab ${subTab==="disposal"?"on":""}`} onClick={()=>setSubTab("disposal")}>廃棄（{disposals.length}）</button>
              <button className={`stab ${subTab==="processing"?"on":""}`} onClick={()=>setSubTab("processing")}>加工（{processings.length}）</button>
              <button className={`stab ${subTab==="part"?"on":""}`} onClick={()=>setSubTab("part")}>部品マスタ（{parts.length}）</button>
            </div>
            {subTab==="purchase" && [...purchases].reverse().map(pu=>{
              const p=parts.find(p=>p.id===pu.partId);
              const unitPriceWithTax = pu.unitPrice * 1.1; // 税込単価
              const totalPrice = pu.qty * pu.unitPrice * 1.1; // 実購入額（税込み）
              return (
                <div className="rc" key={pu.id}>
                  <div className="rc-top">
                    <div><div className="rc-name">{p?.name||"—"}</div><div className="rc-meta">{p?.variant} · {pu.date} · 📦{pu.supplier}</div></div>
                    <div>
                      <div className="rc-amt">¥{fmtD(unitPriceWithTax)}/{p?.unit}（税込）</div>
                      <div className="rc-qty">×{pu.qty} = ¥{fmt(totalPrice)}</div>
                      <button style={{background:"none",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t2)",fontSize:12,cursor:"pointer",padding:"2px 8px",fontFamily:"inherit",marginTop:4}} onClick={()=>openEditPurchase(pu)}>✏ 編集</button>
                    </div>
                  </div>
                  {pu.note&&<div className="rc-note">📝 {pu.note}</div>}
                </div>
              );
            })}
            {subTab==="disposal" && (
              <>
                {disposals.length===0 && <div className="empty">廃棄記録はありません</div>}
                {[...disposals].reverse().map(d=>{
                  const p=parts.find(p=>p.id===d.partId);
                  return (
                    <div className="dc" key={d.id}>
                      <div className="rc-top">
                        <div><div className="rc-name">{p?.name||"—"}</div><div className="rc-meta">{p?.variant} · {d.date}</div></div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                          <div className="rc-amt" style={{color:"var(--low)"}}>−{d.qty}{p?.unit}</div>
                          <button style={{background:"none",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t2)",fontSize:12,cursor:"pointer",padding:"2px 8px",fontFamily:"inherit"}} onClick={()=>openEditDisposal(d)}>✏ 編集</button>
                        </div>
                      </div>
                      {d.reason&&<div className="dc-reason">理由: {d.reason}</div>}
                    </div>
                  );
                })}
              </>
            )}
            {subTab==="processing" && (
              <>
                {processings.length===0 && <div className="empty">加工記録はありません</div>}
                {(()=>{
                  // 原材料ごとにグループ化（親素材の親子関係でソート）
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
                  // 原材料の parentId でソート（親素材を持つ原材料を先に）
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
                              <button style={{background:"none",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t2)",fontSize:12,cursor:"pointer",padding:"2px 8px",fontFamily:"inherit",flexShrink:0}} onClick={()=>openEditProc(pr)}>✏ 編集</button>
                            </div>
                            <div style={{marginTop:6,display:"flex",flexWrap:"wrap",gap:4}}>
                              {pr.outputs.map((o,i)=>{
                                const op=parts.find(p=>p.id===o.partId);
                                return <span key={i} style={{fontSize:11,background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:4,padding:"1px 7px",color:"var(--tx)"}}>{op?.name||"?"} ×{o.qty}</span>;
                              })}
                              {pr.lossQty>0&&<span style={{fontSize:11,background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:4,padding:"1px 7px",color:"var(--low)"}}>ロス {pr.lossQty}{inPart?.unit}</span>}
                            </div>
                            {pr.note&&<div className="rc-note">📝 {pr.note}</div>}
                          </div>
                        ))}
                      </div>
                    );
                  });
                })()}
              </>
            )}
            {subTab==="part" && (
              <>
                {parts.length===0 && <div className="empty">部品が登録されていません</div>}
                {parts.map(p=>(
                  <div className="pc" key={p.id} style={{cursor:"default"}}>
                    <div style={{flex:1}}>
                      <div className="pn">{p.name}{p.hinban&&<span style={{fontSize:"12px",color:"var(--t2)",fontWeight:400,marginLeft:6}}>#{p.hinban}</span>}</div>
                      <div className="pv">{p.variant}</div>
                      <span className="pbadge">{p.cat}</span>
                      {p.type&&<span className="pbadge" style={{background:"var(--s2)",color:"var(--ac)",marginLeft:4}}>{p.type==="material"?"原材料":p.type==="part"?"加工済み":""}</span>}
                    </div>
                    <div className="psb" style={{alignItems:"flex-end",gap:6}}>
                      <div className="psu">{p.unit}</div>
                      <button style={{background:"none",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t2)",fontSize:12,cursor:"pointer",padding:"2px 8px",fontFamily:"inherit"}} onClick={()=>openEditPart(p)}>✏ 編集</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ════ 売上 ════ */}
        {tab==="sales" && (
          <div className="sec">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div className="sec-title" style={{marginBottom:0}}>売上記録</div>
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
                  {chObj && <button style={{fontSize:10,background:"none",border:"1px solid var(--bd)",borderRadius:5,color:"var(--t2)",cursor:"pointer",padding:"1px 7px",fontFamily:"inherit"}} onClick={()=>openEditChannel(chObj)}>✏ 編集</button>}
                  <button style={{fontSize:10,background:"none",border:"1px solid var(--bd)",borderRadius:5,color:"var(--t2)",cursor:"pointer",padding:"1px 7px",fontFamily:"inherit"}} onClick={()=>setSelectedChannel(null)}>✕ 解除</button>
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
                      <div className="sale-name"><span className="sale-dot" style={{background:chColMap[s.channel]||"var(--t2)"}}/>{prodName(s.productId)}{s.consignRecordId&&<span style={{fontSize:9,background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:4,padding:"1px 5px",marginLeft:5,color:"var(--t2)"}}>📍委託</span>}</div>
                      <div className="sale-meta">{s.date} · {s.channel} · {s.qty}点</div>
                    </div>
                    <div>
                      <div className="sale-rev">¥{fmt(calc.revenue)}</div>
                      <div className="sale-margin" style={{color:calc.profit>=0?"var(--ok)":"var(--low)"}}>利益 ¥{fmt(calc.profit)}（{calc.profitRate}%）</div>
                      <div className="sale-toggle">{isOpen?"▲":"▼ 明細"}</div>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="sale-detail">
                      <div className="sd-row"><span className="sd-lbl">販売価格</span><span className="sd-val">¥{fmt(s.price)} × {s.qty}点</span></div>
                      <div className="sd-row"><span className="sd-lbl">売上合計</span><span className="sd-val">¥{fmt(calc.revenue)}</span></div>
                      <div className="sd-div"/>
                      <div className="sd-row"><span className="sd-lbl">原価</span><span className="sd-val" style={{color:"var(--low)"}}>−¥{fmt(calc.totalCost)}</span></div>
                      <div className="sd-row"><span className="sd-lbl">チャネル手数料（{calc.feeRate}%）</span><span className="sd-val" style={{color:"var(--low)"}}>−¥{fmt(calc.channelFee)}</span></div>
                      <div className="sd-row"><span className="sd-lbl">送料実費</span><span className="sd-val" style={{color:"var(--low)"}}>−¥{fmt(calc.shipping)}</span></div>
                      <div className="sd-div"/>
                      <div className="sd-total"><span>純利益</span><span style={{color:calc.profit>=0?"var(--ok)":"var(--low)"}}>¥{fmt(calc.profit)}（{calc.profitRate}%）</span></div>
                      {s.memo&&<div className="sd-memo">📝 {s.memo}</div>}
                      <button style={{marginTop:8,width:"100%",padding:"7px 0",border:"1px solid var(--bd)",borderRadius:8,background:"none",color:"var(--t2)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>openEditSale(s)}>✏ 編集</button>
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
            { id:"dashboard", icon:"◈", label:"HOME" },
            { id:"parts",     icon:"⬡", label:"部品在庫" },
            { id:"prodstock", icon:"◻", label:"完成品" },
            { id:"records",   icon:"◎", label:"仕入・廃棄" },
            { id:"consign",   icon:"📍", label:"委託" },
            { id:"sales",     icon:"◉", label:"売上" },
          ].map(t=>(
            <button key={t.id} className={`nb ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}>
              <span className="ni">{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>

        {/* FAB */}
        {tab==="parts"     && <button className="fab" onClick={()=>setModal("part")}>＋</button>}
        {tab==="records"   && <button className="fab" onClick={()=>setModal(subTab==="purchase"?"purchase":subTab==="disposal"?"disposal":subTab==="processing"?"processing":"part")}>＋</button>}
        {tab==="sales"     && <button className="fab" onClick={()=>setModal("sale")}>＋</button>}
        {tab==="prodstock" && <button className="fab" onClick={()=>subTab2==="recipe"?setModal("recipe"):setModal("made")}>＋</button>}
        {tab==="consign"   && !selectedConsigneeId && <button className="fab" onClick={()=>setModal("consign")}>＋</button>}
        {tab==="consign"   && selectedConsigneeId && <button className="fab" onClick={()=>{setCf(f=>({...f,consigneeId:String(selectedConsigneeId)}));setModal("consign");}}>＋</button>}


        {/* ════ 部品マスタ登録・編集モーダル ════ */}
        {modal==="part" && (
          <div className="ov" onClick={e=>e.target===e.currentTarget&&closePartModal()}>
            <div className="modal">
              <div className="modal-title">{editingPartId ? "部品を編集" : "部品を登録"}</div>
              {!editingPartId && <div className="modal-sub">登録後、仕入記録から在庫を追加できます</div>}
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
                  {["個","枚","ペア","m","cm","セット","袋","本"].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="fr">
                <label className="fl">最低在庫数</label>
                <input className="fi" type="number" min="0" placeholder="10" value={partForm.minStock} onChange={e=>setPartForm(f=>({...f,minStock:e.target.value}))}/>
              </div>
              <div className="fr">
                <label className="fl">部品タイプ</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {[
                    {val:"",       label:"通常",       desc:"仕入れてそのまま使用"},
                    {val:"material",label:"原材料",     desc:"加工前の素材（布・紐など）"},
                    {val:"part",   label:"加工済み部品", desc:"原材料から切り出した部品"},
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
                  <label className="fl">親の原材料</label>
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
              <div className="div"/>
              <button className="btn-p" onClick={addPart}>{editingPartId ? "保存する" : "登録する"}</button>
              <button className="btn-c" onClick={closePartModal}>キャンセル</button>
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
                <div className="fr"><label className="fl">数量 *</label><input className="fi" type="number" placeholder="0" value={pf.qty} onChange={e=>setPf(f=>({...f,qty:e.target.value}))}/></div>
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
                  {parts.map(p=>{ const {stock}=partStockMap[p.id]; return <option key={p.id} value={p.id}>{p.name}（{p.variant}）　残{stock}{p.unit}</option>; })}
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
              <div className="modal-title">{editingProcId ? "加工記録を編集" : "加工を記録"}</div>
              <div className="modal-sub">原材料 → 加工済み部品への変換を記録します</div>

              <div className="fr"><label className="fl">加工日 *</label>
                <input className="fi" type="date" value={procForm.date} onChange={e=>setProcForm(f=>({...f,date:e.target.value}))}/>
              </div>

              <div className="fr"><label className="fl">使用した原材料 *</label>
                {parts.filter(p=>p.type==="material").length===0 ? (
                  <div style={{background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:8,padding:"10px 12px",fontSize:12,color:"var(--t2)",lineHeight:1.6}}>
                    「原材料」タイプの部品が登録されていません。<br/>
                    部品在庫タブで部品を編集し、タイプを <strong style={{color:"var(--ac)"}}>「原材料」</strong> に設定してください。
                  </div>
                ) : (
                  <select className="fs" value={procForm.inputPartId} onChange={e=>setProcForm(f=>({...f,inputPartId:e.target.value}))}>
                    <option value="">選択してください</option>
                    {parts.filter(p=>p.type==="material").map(p=>{
                      const {stock}=partStockMap[p.id]||{stock:0};
                      return <option key={p.id} value={p.id}>{p.name}（{p.variant}） 残{stock}{p.unit}</option>;
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
                    {procStockPreview.insufficient&&" ⚠ 在庫不足"}
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
                            {children.length>0 && <optgroup label="↳ この原材料の加工済み部品">
                              {children.map(p=><option key={p.id} value={p.id}>{p.name}（{p.variant}）</option>)}
                            </optgroup>}
                            {others.length>0 && <optgroup label="その他の加工済み部品">
                              {others.map(p=><option key={p.id} value={p.id}>{p.name}（{p.variant}）</option>)}
                            </optgroup>}
                          </>;
                        })()}
                      </select>
                      <input className="fi" type="number" placeholder="数量" style={{flex:1,minWidth:0}} value={out.qty} onChange={e=>setProcForm(f=>({...f,outputs:f.outputs.map((o,j)=>j===i?{...o,qty:e.target.value}:o)}))}/>
                      {procForm.outputs.length>1&&<button style={{flexShrink:0,padding:"4px 8px",border:"1px solid var(--bd)",borderRadius:6,background:"none",color:"var(--low)",cursor:"pointer",fontSize:13}} onClick={()=>setProcForm(f=>({...f,outputs:f.outputs.filter((_,j)=>j!==i)}))}>✕</button>}
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

        {/* ════ 完成品制作モーダル ════ */}
        {modal==="made" && (()=>{
          const selProd = products.find(p=>p.id===+mf.productId);
          const prodQty = +mf.qty||1;
          return (
          <div className="ov" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
            <div className="modal">
              <div className="modal-title">完成品を制作</div>
              <div className="modal-sub">制作した分だけ完成品在庫が増えます</div>
              <div className="fr"><label className="fl">商品 *</label>
                <select className="fs" value={mf.productId} onChange={e=>setMf(f=>({...f,productId:e.target.value,checkedParts:{},extraParts:[],lossParts:[]}))}>
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
                    <span>レシピ部品 - 使用したものをタップ</span>
                    <span style={{fontWeight:400,color:"var(--ac)"}}>使用済 = 在庫から差し引き</span>
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
                      {parts.map(p=>{ const {stock}=partStockMap[p.id]; return <option key={p.id} value={p.id}>{p.name}（{p.variant}）残{stock}{p.unit}</option>; })}
                    </select>
                    <input className="fi" type="number" min="1" placeholder="数量" style={{width:64,flex:"none"}} value={ep.qty} onChange={e=>setMf(f=>({...f,extraParts:f.extraParts.map((r,j)=>j===i?{...r,qty:e.target.value}:r)}))}/>
                    {ep.partId && <span style={{fontSize:10,color:"var(--t2)"}}>{parts.find(p=>p.id===+ep.partId)?.unit}</span>}
                    <button className="ing-del" onClick={()=>setMf(f=>({...f,extraParts:f.extraParts.filter((_,j)=>j!==i)}))}>✕</button>
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
                      {parts.map(p=>{ const {stock}=partStockMap[p.id]; return <option key={p.id} value={p.id}>{p.name}（{p.variant}）残{stock}{p.unit}</option>; })}
                    </select>
                    <input className="fi" type="number" min="1" placeholder="数量" style={{width:64,flex:"none"}} value={lp.qty} onChange={e=>setMf(f=>({...f,lossParts:f.lossParts.map((r,j)=>j===i?{...r,qty:e.target.value}:r)}))}/>
                    {lp.partId && <span style={{fontSize:10,color:"var(--t2)"}}>{parts.find(p=>p.id===+lp.partId)?.unit}</span>}
                    <button className="ing-del" onClick={()=>setMf(f=>({...f,lossParts:f.lossParts.filter((_,j)=>j!==i)}))}>✕</button>
                  </div>
                ))}
                <button className="add-row-btn" onClick={()=>setMf(f=>({...f,lossParts:[...f.lossParts,{partId:"",qty:""}]}))}>＋ 部品を追加</button>
              </div>

              <div className="fr" style={{marginTop:12}}><label className="fl">メモ</label><input className="fi" placeholder="例: 追加制作、試作品など" value={mf.note} onChange={e=>setMf(f=>({...f,note:e.target.value}))}/></div>
              <div className="div"/>
              <button className="btn-p" onClick={addMade}>記録 → 完成品在庫に加算</button>
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
              {(()=>{
                const isConsign = editingSaleId && sales.find(s=>s.id===editingSaleId)?.consignRecordId;
                return isConsign ? (
                  <div style={{background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:8,padding:"8px 12px",marginBottom:8,fontSize:12,color:"var(--t2)"}}>
                    📍 委託連動売上 — 商品・チャネルは委託記録から引き継がれます
                    <div style={{marginTop:4,fontWeight:700,color:"var(--tx)"}}>{prodName(+sf.productId)} · {sf.channel}</div>
                  </div>
                ) : (
                  <>
                    <div className="fr"><label className="fl">商品 *</label>
                      <select className="fs" value={sf.productId} onChange={e=>{
                        const pr=products.find(p=>p.id===+e.target.value);
                        setSf(f=>({...f,productId:e.target.value,shippingActual:pr?String(pr.shippingCost):""}));
                      }}>
                        <option value="">選択してください</option>
                        {products.map(p=>{
                          const cost=productCostMap[p.id];
                          return <option key={p.id} value={p.id}>{p.name}（原価¥{fmt(cost.total)}）</option>;
                        })}
                      </select>
                    </div>
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
                  </>
                );
              })()}
              <div className="fr"><label className="fl">販売日 *</label><input className="fi" type="date" value={sf.date} onChange={e=>setSf(f=>({...f,date:e.target.value}))}/></div>
              <div className="fr3">
                <div className="fr"><label className="fl">販売価格 *</label><input className="fi" type="number" placeholder="0" value={sf.price} onChange={e=>setSf(f=>({...f,price:e.target.value}))}/></div>
                <div className="fr"><label className="fl">数量 *</label><input className="fi" type="number" placeholder="1" value={sf.qty} onChange={e=>setSf(f=>({...f,qty:e.target.value}))}/></div>
                <div className="fr"><label className="fl">送料実費</label><input className="fi" type="number" placeholder="0" value={sf.shippingActual} onChange={e=>setSf(f=>({...f,shippingActual:e.target.value}))}/></div>
              </div>
              {salePreview && (
                <div className="preview-box">
                  <div className="prev-row"><span className="prev-lbl">売上合計</span><span className="prev-val">¥{fmt(salePreview.rev)}</span></div>
                  <div className="prev-row"><span className="prev-lbl">原価</span><span className="prev-val" style={{color:"var(--low)"}}>−¥{fmt(salePreview.cost)}</span></div>
                  <div className="prev-row"><span className="prev-lbl">手数料（{salePreview.feeRate}%）</span><span className="prev-val" style={{color:"var(--low)"}}>−¥{fmt(salePreview.fee)}</span></div>
                  <div className="prev-row"><span className="prev-lbl">送料実費</span><span className="prev-val" style={{color:"var(--low)"}}>−¥{fmt(salePreview.ship)}</span></div>
                  <div className="prev-div"/>
                  <div className="prev-total"><span>純利益</span><span style={{color:salePreview.profit>=0?"var(--ok)":"var(--low)"}}>¥{fmt(salePreview.profit)}（{pct(salePreview.profit,salePreview.rev)}%）</span></div>
                </div>
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
              <div className="modal-title">{editingRecipeId ? "レシピを編集" : "完成品レシピを登録"}</div>
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
                  <button style={{marginLeft:6,background:"none",border:"none",color:"var(--t2)",cursor:"pointer",fontSize:11,padding:0}} onClick={()=>setRf(f=>({...f,cat:""}))}>✕ 解除</button>
                </div>}
              </div>
              <div className="fr"><label className="fl">商品名 *</label><input className="fi" placeholder="例: パールピアス" value={rf.name} onChange={e=>setRf(f=>({...f,name:e.target.value}))}/></div>
              <div className="fr"><label className="fl">説明・メモ</label><input className="fi" placeholder="例: 淡水パール × Cカン × ポスト" value={rf.desc} onChange={e=>setRf(f=>({...f,desc:e.target.value}))}/></div>

              <div className="div"/>
              <div className="sec-label">使用部品</div>
              {rf.ingredients.map((ing,i)=>(
                <div className="ing-row" key={i}>
                  <select className="fs" value={ing.partId} onChange={e=>updateIng(i,"partId",e.target.value)}>
                    <option value="">部品を選択</option>
                    {parts.map(p=><option key={p.id} value={p.id}>{p.name}（{p.variant}）@¥{fmtD(partStockMap[p.id]?.avgPrice||0)}/{p.unit}</option>)}
                  </select>
                  <input className="fi" type="number" placeholder="数量" style={{width:70,flex:"none"}} value={ing.qty} onChange={e=>updateIng(i,"qty",e.target.value)}/>
                  {ing.partId && <span style={{fontSize:10,color:"var(--t2)",whiteSpace:"nowrap"}}>{parts.find(p=>p.id===+ing.partId)?.unit}</span>}
                  {rf.ingredients.length>1 && <button className="ing-del" onClick={()=>removeIngRow(i)}>✕</button>}
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
                <div className="modal-title">委託終了</div>
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

      </div>
    </>
  );
}
