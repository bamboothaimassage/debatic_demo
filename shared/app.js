/* =========================================================
   DEBATIC — shared demo data & helpers, used by every page.
   Plain <script> include (no bundler, no modules) so every
   page that loads this file gets the same globals.

   IMPORTANT — this is a front-end-only prototype:
   every page seeds its own fresh copy of the demo data when
   it loads, and everything you do (log in, deposit, bet,
   create a market, resolve a market) lives in that page's
   JS variables only. Nothing is written to a database or a
   server, and nothing is shared between pages — navigating
   to another page starts that page's demo state over from
   the same seed. That's intentional for this phase: it's
   here to demonstrate function and layout, not to be a real
   session. Your backend developer replaces these in-memory
   variables with real API calls / a real session per page.
   ========================================================= */

const DEMO_ACCOUNT = {
  username: 'demo', password: 'demo1234',
  name: 'Kim Chayun', handle: '@kim', avatarLetter: 'K', avatarColor: '#1652F0', joined: 'ม.ค. 2026'
};
const ADMIN_ACCOUNT = {
  username: 'admin', password: 'admin1234',
  name: 'Site Owner', handle: '@owner', avatarLetter: 'S', avatarColor: '#0E1114'
};

/* ---------- persistence layer ----------
   A thin localStorage-backed layer used ONLY for two things that must be
   shared across pages/tabs for the demo to make sense: (1) whether you're
   logged in, and (2) the queue of player-suggested markets waiting on
   admin approval (plus markets the admin has approved/created, so they can
   actually show up on the player-facing markets page). Every other piece
   of demo data still reseeds fresh per page load exactly as before — this
   is intentionally the smallest slice of "shared state" needed. Wrapped in
   try/catch so it degrades harmlessly (acts logged-out, no pending items)
   if storage is ever unavailable. Your backend developer swaps this layer
   for real sessions + a real API. */
const Store = {
  get(key, fallback){
    try{ const raw = localStorage.getItem('debatic:'+key); return raw===null ? fallback : JSON.parse(raw); }
    catch(e){ return fallback; }
  },
  set(key, value){ try{ localStorage.setItem('debatic:'+key, JSON.stringify(value)); }catch(e){} }
};
const Session = {
  // avatarImage lives in its own Store slot (see loadProfileAvatarImage below) rather than
  // inside the session record itself, so an uploaded photo survives logout/login the same
  // way every other "your account" setting does in this single-account demo.
  current(){ const s = Store.get('session', null); return s ? { ...s, avatarImage: loadProfileAvatarImage() } : null; },
  isLoggedIn(){ return !!this.current(); },
  login(account){ Store.set('session', { username:account.username, name:account.name, handle:account.handle, avatarLetter:account.avatarLetter, avatarColor:account.avatarColor, joined:account.joined }); },
  logout(){ Store.set('session', null); }
};
/* ---------- profile avatar photo + bank account (settings.html, demo-persisted) ---------- */
function loadProfileAvatarImage(){ return Store.get('profileAvatarImage', null); }
function saveProfileAvatarImage(v){ Store.set('profileAvatarImage', v); }
function seedBankAccount(){ return { bank:'', accountNumber:'', accountName:'' }; }
function loadBankAccount(){ const v = Store.get('bankAccount', null); return v===null ? seedBankAccount() : v; }
function saveBankAccount(v){ Store.set('bankAccount', v); }
// Renders either the uploaded photo (cropped to fill the circle) or the colored-letter
// fallback, so every "avatar" div across the app can opt in with one extra argument.
function avatarStyle(color, image){ return image ? `background-image:url('${image}');background-size:cover;background-position:center;` : `background:${color};`; }
function avatarLabel(letter, image){ return image ? '' : esc(letter); }
/* ---------- light/dark theme ----------
   One shared preference (site-wide, trader pages and admin console alike) persisted
   the same way as everything else in Store. applyTheme() runs immediately below, the
   moment this script loads, so the <html data-theme> attribute is set before the page
   body renders — avoids a flash of the wrong palette on load. */
function loadTheme(){ return Store.get('theme', 'light'); }
function saveTheme(t){ Store.set('theme', t); }
function applyTheme(){ document.documentElement.setAttribute('data-theme', loadTheme()); }
function toggleTheme(){
  const next = loadTheme()==='dark' ? 'light' : 'dark';
  saveTheme(next);
  document.documentElement.setAttribute('data-theme', next);
  document.querySelectorAll('.theme-toggle-icon').forEach(el=> el.textContent = next==='dark' ? '☀' : '☾');
  document.querySelectorAll('.theme-switch').forEach(el=> el.classList.toggle('on', next==='dark'));
}
applyTheme();

function requireLogin(){
  if(Session.isLoggedIn()) return true;
  const next = location.pathname.split('/').pop() + location.search;
  location.href = 'login.html?next=' + encodeURIComponent(next);
  return false;
}
function logoutTrader(){ Session.logout(); location.href = 'index.html'; }
function loadPendingSuggestions(){ return Store.get('pendingSuggestions', []); }
function savePendingSuggestions(list){ Store.set('pendingSuggestions', list); }
function loadApprovedMarkets(){ return Store.get('approvedMarkets', []); }
function saveApprovedMarkets(list){ Store.set('approvedMarkets', list); }
// A player's "ฝากเงิน"/"ถอนเงิน" click no longer touches the wallet balance directly — it
// just files a request here (same shape/spirit as pendingSuggestions for market creation).
// Only once a Superadmin+ approves it from "จัดการการเงิน" does the balance actually move.
// { id, playerId ('kim' for the one real demo login), player (display name, 'You' for kim),
//   type: 'deposit'|'withdraw', amount, time, status: 'pending' }
function loadFinanceRequests(){ return Store.get('financeRequests', []); }
function saveFinanceRequests(list){ Store.set('financeRequests', list); }
function loadSettings(){ const v = Store.get('settings', null); return v===null ? seedPlatformSettings() : v; }
function saveSettings(s){ Store.set('settings', s); }

/* ---------- personal market tags (per-browser "interesting" list, Polymarket-style) ----------
   A lightweight tag icon on every market card lets you mark markets you want to track;
   "ตลาดที่ติดแท็ก" then filters the markets page down to just those. Persisted the same
   way as everything else here — one flat list of market ids in Store. */
function loadTaggedMarkets(){ return Store.get('taggedMarkets', []); }
function saveTaggedMarkets(list){ Store.set('taggedMarkets', list); }
function isTagged(id){ return loadTaggedMarkets().includes(id); }
function toggleTag(id){
  const list = loadTaggedMarkets();
  const wasTagged = list.includes(id);
  const next = wasTagged ? list.filter(x=>x!==id) : list.concat([id]);
  saveTaggedMarkets(next);
  // Card, rail count, and header live on different DOM chunks a page rebuilds together
  // via its own draw() — broadcasting lets every page that cares just listen once and
  // redraw, instead of this shared helper having to know each page's own render function.
  window.dispatchEvent(new CustomEvent('debatic:tagchange', { detail:{ id, tagged:!wasTagged } }));
  return !wasTagged;
}
function mcTagBtn(id){
  const tagged = isTagged(id);
  return `<button class="mc-tag-btn ${tagged?'tagged':''}" onclick="event.stopPropagation(); toggleTag('${id}')" title="${tagged?'เอาออกจากตลาดที่ติดแท็ก':'ติดแท็กตลาดนี้'}">🏷️</button>`;
}

/* ---------- persisted trading state ----------
   Everything below used to be re-seeded from scratch on every page load (balance,
   positions, market prices/volume/history, admin's player list, wallet transactions,
   the activity feed) which made the app feel disconnected — an admin credit, a trade,
   or a market resolution would vanish the moment you left the page. These loaders read
   the saved value if one exists (falling back to the original seed data the first time),
   and the matching savers write straight back to the same localStorage-backed Store used
   above for session/pendingSuggestions/approvedMarkets — still just a browser-only demo
   stand-in, not a real database, but now consistent across every page and reload. */
function loadBalance(){ const v = Store.get('balance', null); return v===null ? 2500.00 : v; }
function saveBalance(v){ Store.set('balance', v); }
function loadPositions(){ const v = Store.get('positions', null); return v===null ? seedPositions() : v; }
function savePositions(list){ Store.set('positions', list); }
// Mark-to-market value of one open position — shares × the current price of the side you
// hold. This is what "Portfolio" means in the top bar (and on portfolio.html/profile.html):
// it moves with the market's odds, same as real Polymarket's Portfolio figure, as opposed to
// cost basis (what you paid) which only changes when you actually buy or sell.
function positionCurrentValue(p, markets){
  const m = markets.find(x=>x.id===p.marketId);
  if(!m) return 0;
  const price = p.side==='yes' ? m.yesPrice/100 : (100-m.yesPrice)/100;
  return p.shares*price;
}
function portfolioValue(){
  const markets = loadMarkets();
  return loadPositions().filter(p=>!p.settled).reduce((s,p)=>s+positionCurrentValue(p, markets), 0);
}
// Unrealized profit/loss on open positions: current mark-to-market value minus what you
// actually paid for them. This is what decides whether the top-bar "Portfolio" figure is
// shown green (up) or red (down) — the value itself still shows current value, not the pnl.
function portfolioPnl(){
  const markets = loadMarkets();
  const open = loadPositions().filter(p=>!p.settled);
  const value = open.reduce((s,p)=>s+positionCurrentValue(p, markets), 0);
  const cost = open.reduce((s,p)=>s+p.cost, 0);
  return value - cost;
}
function loadMarkets(){
  const v = Store.get('markets', null);
  const list = v!==null ? v : seedMarkets().concat(loadApprovedMarkets());
  // Backfill "frequency" on any market saved before this field existed (older demo sessions
  // already have a markets snapshot in this browser) — deterministic per market id, so it
  // doesn't reshuffle every load, and spreads existing markets across all three filters
  // instead of dumping them all into one bucket.
  let changed = false;
  list.forEach(m=>{ if(!m.frequency){ m.frequency = FREQUENCIES[hashStr(m.id)%FREQUENCIES.length]; changed = true; } });
  if(changed) saveMarkets(list);
  return list;
}
function saveMarkets(list){ Store.set('markets', list); }
function loadPlayers(){
  const v = Store.get('players', null);
  const list = v===null ? seedPlayers() : v;
  // 'kim' is the one seeded player that maps to the actual demo login (username 'demo'),
  // so its balance/volume/pnl are always recomputed live from the real wallet + positions
  // instead of the frozen snapshot other (fictional) players use — this keeps the admin
  // console's player row and the trader-facing account showing the exact same numbers.
  const kim = list.find(p=>p.id==='kim');
  if(kim){
    const positions = loadPositions();
    const markets = loadMarkets();
    const curVal = p => { const m = markets.find(x=>x.id===p.marketId); return m ? p.shares*priceFor(m,p.side) : 0; };
    kim.balance = loadBalance();
    kim.volume = positions.reduce((s,p)=>s+p.cost,0);
    kim.pnl = positions.filter(p=>p.settled).reduce((s,p)=>{ const m=markets.find(x=>x.id===p.marketId); return s+((m&&m.outcome===p.side?p.shares:0)-p.cost); },0)
            + positions.filter(p=>!p.settled).reduce((s,p)=>s+(curVal(p)-p.cost),0);
  }
  return list;
}
function savePlayers(list){ Store.set('players', list); }
function loadTransactions(){ const v = Store.get('transactions', null); return v===null ? seedTransactions() : v; }
function saveTransactions(list){ Store.set('transactions', list); }
function loadActivityLog(){ const v = Store.get('activity', null); return v===null ? seedActivity() : v; }
function saveActivityLog(list){ Store.set('activity', list); }
function loadNotifications(){ const v = Store.get('notifications', null); return v===null ? seedNotifications() : v; }
function saveNotifications(list){ Store.set('notifications', list); }
// Called once a market is resolved (from "จัดการตลาด") — walks the demo trader's own
// still-open positions in that market, credits winning shares to the wallet balance at $1
// each (same payout math the portfolio history tab already assumes), marks every position in
// the market settled either way, and leaves a paper trail (ledger + transaction history +
// a real notification) so the payout is actually visible instead of silently vanishing.
// Only the one real demo login ('kim') has a tracked positions list in this single-account
// demo, so this always settles against that shared wallet — same scope as everything else
// balance-related in this app.
function settleMarketPositions(m){
  const positions = loadPositions();
  const mine = positions.filter(p=>p.marketId===m.id && !p.settled);
  if(!mine.length) return { payout:0, count:0 };
  let payout = 0;
  mine.forEach(p=>{ const won = m.outcome===p.side; payout += won ? p.shares : 0; p.settled = true; });
  savePositions(positions);
  if(payout > 0){
    saveBalance(loadBalance()+payout);
    const tx = loadTransactions();
    tx.unshift({ type:'payout', amount:payout, note:'จ่ายผลตอบแทนจากตลาด “'+m.question+'”', time:'เมื่อสักครู่' });
    saveTransactions(tx);
    const ledger = loadTransactionsLedger();
    ledger.unshift({ player:'You', type:'payout', amount:payout, time:'เมื่อสักครู่' });
    saveTransactionsLedger(ledger);
  }
  const notifications = loadNotifications();
  notifications.unshift({
    text: payout > 0
      ? ('ตลาด “'+m.question+'” ตัดสินผลแล้ว — คุณได้รับเงินจ่ายผลตอบแทน '+money(payout))
      : ('ตลาด “'+m.question+'” ตัดสินผลแล้ว — น่าเสียดายที่โพซิชันของคุณในตลาดนี้ไม่ถูกต้อง'),
    time:'เมื่อสักครู่', read:false
  });
  saveNotifications(notifications);
  return { payout, count: mine.length };
}

/* Wipes every piece of saved demo state (session, balance, positions, markets, players,
   pending suggestions, transactions, activity) so the app is back to a clean first-run
   state — handy for resetting before a fresh investor walkthrough. */
function resetDemoData(){
  try{
    Object.keys(localStorage).filter(k=>k.indexOf('debatic:')===0).forEach(k=>localStorage.removeItem(k));
  }catch(e){}
}

const CATEGORIES = ['Politics','Crypto','Finance','Sports','Economy','Culture','Weather'];
const CATEGORY_TH = { Politics:'การเมือง', Crypto:'คริปโต', Finance:'การเงิน', Sports:'กีฬา', Economy:'เศรษฐกิจ', Culture:'วัฒนธรรม', Weather:'สภาพอากาศ' };
const CATEGORY_COLOR = { Politics:'#7C3AED', Crypto:'#F59E0B', Finance:'#1652F0', Sports:'#0FA968', Economy:'#0E7490', Culture:'#DB2777', Weather:'#64748B' };
const CATEGORY_LETTER = { Politics:'ก', Crypto:'ค', Finance:'฿', Sports:'ฬ', Economy:'ศ', Culture:'ว', Weather:'อ' };

// "frequency" is how often a market's own question naturally recurs/resolves (used by the
// รายวัน/รายสัปดาห์/รายเดือน filter on the markets page). It's independent of the market's
// actual closing date. Admins set/change it per market from the "จัดการตลาด" page.
const FREQUENCIES = ['daily','weekly','monthly'];
const FREQUENCY_TH = { daily:'รายวัน', weekly:'รายสัปดาห์', monthly:'รายเดือน' };
function freqTh(f){ return FREQUENCY_TH[f] || FREQUENCY_TH.monthly; }
function catTh(cat){ return CATEGORY_TH[cat] || cat; }

/* ---------- seed builders ---------- */
function seedHistory(endYes){
  const pts=[]; let v = Math.max(5, Math.min(95, endYes + (Math.random()*24-12)));
  for(let i=0;i<28;i++){
    v += (endYes-v)*0.12 + (Math.random()*6-3);
    v = Math.max(2, Math.min(98, v));
    pts.push({ t:i, yes: Math.round(v) });
  }
  pts.push({t:28, yes:endYes});
  return pts;
}
function mk(id,cat,q,yes,vol,closes,rules,frequency){
  return { id, category:cat, question:q, yesPrice:yes, yesPriceExact:yes, volume:vol, closes, rules,
    createdBy:'MayFutures', status:'open', history:seedHistory(yes), isNew:false, traders: 40+Math.round(vol/4000), featured:false, frequency:frequency||'monthly' };
}
function mkResolved(id,cat,q,vol,closes,outcome,frequency){
  const finalYes = outcome==='yes'?100:0;
  return { id, category:cat, question:q, yesPrice:finalYes, yesPriceExact:finalYes, volume:vol, closes, rules:'ตัดสินผลตามผลลัพธ์จริงจากแหล่งที่มาที่ระบุไว้',
    createdBy:'TraderJo', status:'resolved', outcome, history:seedHistory(outcome==='yes'?62:38).concat([{t:30,yes:finalYes}]), isNew:false, traders: 40+Math.round(vol/4000), featured:false, frequency:frequency||'monthly' };
}

function seedMarkets(){
  const list = [
    mk('m1','Politics','นายกรัฐมนตรีคนใหม่ของไทยจะได้รับการแต่งตั้งก่อนเดือนมกราคม 2027 หรือไม่?',57,182400,'2026-12-20','ตัดสินว่า "ใช่" หากมีนายกรัฐมนตรีคนใหม่เข้ารับตำแหน่งก่อนเวลา 00:00 น. ตามเวลาไทย วันที่ 1 มกราคม 2027 โดยอ้างอิงจากราชกิจจานุเบกษา หากไม่เป็นไปตามนี้ให้ตัดสินว่า "ไม่"','monthly'),
    mk('m2','Crypto','บิตคอยน์จะปิดที่ราคาสูงกว่า $150,000 ก่อนปี 2027 หรือไม่?',31,964200,'2026-12-31','ตัดสินว่า "ใช่" หากราคาปิดรายวันของ BTC/USD บน Coinbase สูงกว่า $150,000 ในวันใดวันหนึ่งก่อนวันที่ 1 มกราคม 2027','monthly'),
    mk('m3','Finance','เฟดจะปรับลดอัตราดอกเบี้ยอีกครั้งในเดือนธันวาคม 2026 หรือไม่?',68,541800,'2026-12-18','ตัดสินว่า "ใช่" หาก FOMC ปรับลดอัตราดอกเบี้ยเป้าหมายในการประชุมเดือนธันวาคม 2026','weekly'),
    mk('m4','Sports','แมนเชสเตอร์ ซิตี จะคว้าแชมป์พรีเมียร์ลีก ฤดูกาล 2026/27 หรือไม่?',24,213700,'2027-05-24','ตัดสินว่า "ใช่" หากแมนเชสเตอร์ ซิตี จบฤดูกาลด้วยอันดับ 1 ของตารางพรีเมียร์ลีก 2026/27','monthly'),
    mk('m5','Economy','GDP ของไทยปี 2026 จะเติบโตเกิน 3% หรือไม่?',44,88300,'2027-02-15','ตัดสินว่า "ใช่" หากตัวเลขประมาณการ GDP ทั้งปี 2026 ของ สศช. (รายงานฉบับแรก) สูงกว่า 3.0%','monthly'),
    mk('m6','Culture','ภาพยนตร์ไทยจะได้รับรางวัลใหญ่จากเทศกาลคานส์ 2027 หรือไม่?',12,15400,'2027-05-25','ตัดสินว่า "ใช่" หากภาพยนตร์ที่กำกับหรือผลิตโดยคนไทยได้รับรางวัลสายประกวดหลักจากเทศกาลภาพยนตร์เมืองคานส์ 2027','monthly'),
    mk('m7','Weather','กรุงเทพฯ จะได้รับผลกระทบจากพายุที่มีชื่อในเดือนตุลาคม 2026 หรือไม่?',19,9600,'2026-11-01','ตัดสินว่า "ใช่" หากกรมอุตุนิยมวิทยาออกประกาศเตือนพายุที่มีชื่อซึ่งส่งผลกระทบโดยตรงต่อกรุงเทพฯ ในเดือนตุลาคม 2026','weekly'),
    mk('m8','Crypto','อีเธอเรียมจะมีมูลค่าตลาดแซงหน้าบิตคอยน์ก่อนปี 2028 หรือไม่?',6,302100,'2027-12-31','ตัดสินว่า "ใช่" หากมูลค่าตลาดรวมของ ETH สูงกว่า BTC ในวันใดวันหนึ่งก่อนวันที่ 1 มกราคม 2028','monthly'),
    mk('m9','Politics','การเลือกตั้งทั่วไปครั้งหน้าของไทยจะมีผู้มาใช้สิทธิเกิน 75% หรือไม่?',52,41200,'2027-06-30','ตัดสินว่า "ใช่" หากตัวเลขผู้มาใช้สิทธิอย่างเป็นทางการจาก กกต. ในการเลือกตั้งทั่วไปครั้งถัดไปสูงกว่า 75%','monthly'),
    mk('m10','Finance','ดัชนี SET จะปิดเหนือ 1,500 จุดก่อนสิ้นปี 2026 หรือไม่?',39,126700,'2026-12-31','ตัดสินว่า "ใช่" หากดัชนี SET ปิดเหนือ 1,500.00 จุดในวันซื้อขายใดวันหนึ่งของปี 2026','daily'),
  ];
  list[0].featured = true; list[2].featured = true;
  list.push(mkResolved('r1','Sports','ทีมชาติไทยผ่านเข้ารอบชิงชนะเลิศ AFF Championship 2026 หรือไม่?',985300,'2026-01-04','yes','weekly'));
  list.push(mkResolved('r2','Crypto','บิตคอยน์แตะราคา $200,000 ก่อนเดือนกันยายน 2026 หรือไม่?',441200,'2026-08-28','no','monthly'));
  return list;
}

function seedPositions(){
  return [
    { marketId:'m3', side:'yes', shares:120, avgPrice:0.60, cost:72.00 },
    { marketId:'m2', side:'no', shares:80, avgPrice:0.65, cost:52.00 },
    { marketId:'r1', side:'yes', shares:50, avgPrice:0.70, cost:35.00, settled:true },
    { marketId:'r2', side:'no', shares:40, avgPrice:0.58, cost:23.20, settled:true },
  ];
}
function seedTransactions(){
  return [{ type:'deposit', amount:2500, note:'เงินทดลองที่ได้รับตอนเปิดบัญชี', time:'6 วันที่แล้ว' }];
}
function seedActivity(){
  return [
    { user:'MayFutures', action:'bought', side:'yes', marketId:'m3', amount:210, time:'2 นาทีที่แล้ว' },
    { user:'CryptoBirdy', action:'bought', side:'no', marketId:'m2', amount:640, time:'11 นาทีที่แล้ว' },
    { user:'SomChaiBets', action:'created', marketId:'m9', time:'38 นาทีที่แล้ว' },
    { user:'NattapongK', action:'bought', side:'yes', marketId:'m1', amount:88, time:'1 ชม.ที่แล้ว' },
    { user:'PloyOdds', action:'bought', side:'no', marketId:'m8', amount:150, time:'2 ชม.ที่แล้ว' },
    { user:'ArthitYield', action:'bought', side:'yes', marketId:'m10', amount:320, time:'3 ชม.ที่แล้ว' },
    { user:'LindaLong', action:'sold', side:'yes', marketId:'m4', amount:75, time:'5 ชม.ที่แล้ว' },
    { user:'You', action:'bought', side:'no', marketId:'m2', amount:52, time:'1 วันที่แล้ว' },
    { user:'You', action:'bought', side:'yes', marketId:'m3', amount:72, time:'1 วันที่แล้ว' },
    { user:'TraderJo', action:'resolved', marketId:'r1', outcome:'yes', time:'2 วันที่แล้ว' },
    { user:'CryptoBirdy', action:'bought', side:'yes', marketId:'m6', amount:19, time:'2 วันที่แล้ว' },
    { user:'MayFutures', action:'resolved', marketId:'r2', outcome:'no', time:'18 วันที่แล้ว' },
  ];
}
function seedNotifications(){
  return [
    { text:'โพซิชัน "เฟดปรับลดดอกเบี้ย" ของคุณกำไรขึ้น 8% วันนี้', time:'24 นาทีที่แล้ว', read:false },
    { text:'ตลาด AFF Championship ตัดสินผลเป็น "ใช่" — คุณได้รับเงิน $50.00', time:'2 วันที่แล้ว', read:false },
    { text:'ปริมาณการเทรดตลาด "อีเธอเรียมแซงบิตคอยน์" พุ่งขึ้น 40% ในวันที่ผ่านมา', time:'3 วันที่แล้ว', read:false },
    { text:'มีตลาดใหม่ในหมวดวัฒนธรรม: เทศกาลคานส์ 2027', time:'5 วันที่แล้ว', read:true },
    { text:'ตลาดดัชนี SET จะปิดรับในอีก 6 วัน', time:'6 วันที่แล้ว', read:true },
  ];
}
function seedPlayers(){
  return [
    { id:'nattapong', name:'NattapongK', handle:'@nattapong', balance:6820, volume:48200, pnl:6120, winRate:0.71, status:'active', joined:'ก.พ. 2026' },
    { id:'mayf', name:'MayFutures', handle:'@mayf', balance:5210, volume:39850, pnl:4310, winRate:0.64, status:'active', joined:'ม.ค. 2026' },
    { id:'cbirdy', name:'CryptoBirdy', handle:'@cbirdy', balance:3980, volume:31200, pnl:2870, winRate:0.58, status:'active', joined:'มี.ค. 2026' },
    { id:'traderjo', name:'TraderJo', handle:'@traderjo', balance:1120, volume:27600, pnl:-540, winRate:0.47, status:'active', joined:'ม.ค. 2026' },
    { id:'ployodds', name:'PloyOdds', handle:'@ployodds', balance:2790, volume:21100, pnl:1980, winRate:0.61, status:'active', joined:'เม.ย. 2026' },
    { id:'arthity', name:'ArthitYield', handle:'@arthity', balance:1980, volume:18700, pnl:990, winRate:0.55, status:'active', joined:'ก.พ. 2026' },
    { id:'somchai', name:'SomChaiBets', handle:'@somchai', balance:640, volume:15300, pnl:-1120, winRate:0.42, status:'suspended', joined:'พ.ค. 2026' },
    { id:'lindal', name:'LindaLong', handle:'@lindal', balance:1410, volume:9800, pnl:410, winRate:0.53, status:'active', joined:'มิ.ย. 2026' },
    { id:'kim', name:'Kim Chayun', handle:'@kim', balance:2500, volume:200, pnl:0, winRate:0, status:'active', joined:'ม.ค. 2026' },
  ];
}
function seedAdminLog(){
  return [
    { text:'ตัดสินผลตลาด “ทีมชาติไทยผ่านเข้ารอบชิงชนะเลิศ AFF Championship 2026 หรือไม่?” เป็น “ใช่”', time:'2 วันที่แล้ว' },
    { text:'ตัดสินผลตลาด “บิตคอยน์แตะราคา $200,000 ก่อนเดือนกันยายน 2026 หรือไม่?” เป็น “ไม่”', time:'18 วันที่แล้ว' },
    { text:'ระงับบัญชีผู้เล่น SomChaiBets เนื่องจากพบความเคลื่อนไหวที่น่าสงสัย', time:'21 วันที่แล้ว' },
    { text:'สร้างตลาดใหม่: “ดัชนี SET จะปิดเหนือ 1,500 จุดก่อนสิ้นปี 2026 หรือไม่?”', time:'30 วันที่แล้ว' },
    { text:'ปรับค่าธรรมเนียมแพลตฟอร์มจาก 1.5% เป็น 2%', time:'44 วันที่แล้ว' },
  ];
}
function seedTransactionsLedger(){
  return [
    { player:'NattapongK', type:'deposit', amount:2000, time:'3 ชม.ที่แล้ว' },
    { player:'CryptoBirdy', type:'trade_fee', amount:12.8, time:'5 ชม.ที่แล้ว' },
    { player:'You', type:'deposit', amount:2500, time:'6 วันที่แล้ว' },
    { player:'TraderJo', type:'withdraw', amount:500, time:'1 วันที่แล้ว' },
    { player:'PloyOdds', type:'trade_fee', amount:3.0, time:'2 ชม.ที่แล้ว' },
    { player:'MayFutures', type:'payout', amount:71.4, time:'2 วันที่แล้ว' },
    { player:'SomChaiBets', type:'withdraw', amount:200, time:'20 วันที่แล้ว' },
  ];
}
// Persisted the same way as everything else here — previously this ledger was reseeded
// fresh on every visit to "จัดการการเงิน", so an approved deposit/withdrawal (or anything
// else) never actually stuck. Now it's a normal Store-backed loader/saver.
function loadTransactionsLedger(){ const v = Store.get('transactionsLedger', null); return v===null ? seedTransactionsLedger() : v; }
function saveTransactionsLedger(list){ Store.set('transactionsLedger', list); }
function seedPlatformSettings(){
  return { siteName:'Debatic', supportEmail:'support@debatic.app', feePct:2, sellFeePct:2, maintenanceMode:false, minDeposit:10, minBet:1, referralReferrerPct:10, referralFriendPct:5, newUserBonusPct:2 };
}
const LB_USERS = [
  { name:'NattapongK', handle:'@nattapong', volume:48200, pnl:6120, winRate:0.71 },
  { name:'MayFutures', handle:'@mayf', volume:39850, pnl:4310, winRate:0.64 },
  { name:'CryptoBirdy', handle:'@cbirdy', volume:31200, pnl:2870, winRate:0.58 },
  { name:'TraderJo', handle:'@traderjo', volume:27600, pnl:-540, winRate:0.47 },
  { name:'PloyOdds', handle:'@ployodds', volume:21100, pnl:1980, winRate:0.61 },
  { name:'ArthitYield', handle:'@arthity', volume:18700, pnl:990, winRate:0.55 },
  { name:'SomChaiBets', handle:'@somchai', volume:15300, pnl:-1120, winRate:0.42 },
  { name:'LindaLong', handle:'@lindal', volume:9800, pnl:410, winRate:0.53 },
];

/* ---------- generic helpers ---------- */
function money(n){ const neg = n<0; n=Math.abs(n); return (neg?'-':'')+'$'+n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function pct(n){ return Math.round(n)+'%'; }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function syncBalancePill(balance){
  const cashEl = document.querySelector('.topbar-stat.cash .v');
  if(cashEl) cashEl.textContent = money(balance);
  const portEl = document.querySelector('.topbar-stat.portfolio .v');
  if(portEl){
    portEl.textContent = money(portfolioValue());
    portEl.classList.toggle('pnl-pos', portfolioPnl()>=0);
    portEl.classList.toggle('pnl-neg', portfolioPnl()<0);
  }
}
function qs(name){ return new URLSearchParams(location.search).get(name); }
function initials(name){ return name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase(); }
function userColor(name){
  const colors=['#1652F0','#B5241D','#0B8654','#B7791A','#7C3AED','#0E7490'];
  let h=0; for(const c of name) h=(h*31+c.charCodeAt(0))%colors.length;
  return colors[h];
}
function priceFor(m, side){ return side==='yes' ? m.yesPrice/100 : (100-m.yesPrice)/100; }

/* ---------- trade pricing: a simple linear bonding-curve AMM ----------
   Trading against the platform's own liquidity instead of a fake order book. Each side's
   price is a straight line in "cents per share traded" (AMM_SLOPE): buying walks the price
   up as you buy, share by share; selling walks the exact same line back down. Because both
   directions use the same line, the average price you pay/receive is just the midpoint of
   the price before and after your trade — which makes an immediate buy-then-sell of the
   same quantity land back on the same money (before fees): selling retraces exactly the
   path buying carved out, instead of the old model where your own trade's price impact
   only ever hurt the *next* person, letting you buy then instantly sell for free profit. */
const AMM_SLOPE = 0.01; // cents the side's own price moves per 1 share traded
const AMM_MIN_PRICE = 2, AMM_MAX_PRICE = 98;
// m.yesPrice is always a rounded whole cent for display (used everywhere in the UI).
// m.yesPriceExact carries the same value at full precision so consecutive trades keep
// walking the *exact* curve instead of compounding display-rounding error trade after
// trade (which would let a quick buy-then-sell drift away from "just the fee").
function sidePriceCents(m, side){
  const exact = (m.yesPriceExact!=null) ? m.yesPriceExact : m.yesPrice;
  return side==='yes' ? exact : 100-exact;
}
function applySidePriceCents(m, side, cents){
  cents = Math.max(AMM_MIN_PRICE, Math.min(AMM_MAX_PRICE, cents));
  const exactYes = side==='yes' ? cents : 100-cents;
  m.yesPriceExact = exactYes;
  m.yesPrice = Math.round(exactYes);
}
// netAmount = dollars actually going into the curve (i.e. after any platform fee is already
// deducted). Returns the shares that buys and the side's price after the trade.
function ammBuyQuote(m, side, netAmount){
  const c0 = sidePriceCents(m, side);
  const s = AMM_SLOPE;
  const shares = netAmount>0 ? (-c0 + Math.sqrt(c0*c0 + 2*s*100*netAmount)) / s : 0;
  return { shares, newSideCents: c0 + s*shares };
}
// Returns the dollars received for selling `shares` and the side's price after the trade.
function ammSellQuote(m, side, shares){
  const c0 = sidePriceCents(m, side);
  const s = AMM_SLOPE;
  const newCents = c0 - s*shares;
  const avgCents = (c0 + newCents) / 2;
  return { proceeds: shares>0 ? avgCents*shares/100 : 0, newSideCents: newCents };
}
function currentValue(pos, markets){
  const m = markets.find(x=>x.id===pos.marketId);
  if(!m) return 0;
  return pos.shares * priceFor(m, pos.side);
}
function toast(msg, warn){
  let el = document.getElementById('toastEl');
  if(!el){ el = document.createElement('div'); el.id='toastEl'; el.className='toast'; el.hidden=true; document.body.appendChild(el); }
  el.textContent = msg; el.className = 'toast'+(warn?' warn':''); el.hidden=false;
  clearTimeout(toast._t); toast._t = setTimeout(()=>{ el.hidden=true; }, 2600);
}
function emptyState(glyph, title, sub){
  return `<div class="empty-state"><div class="glyph">${glyph}</div><div style="font-weight:700;font-size:16px;color:var(--text)">${title}</div><div>${sub||''}</div></div>`;
}
function defaultFutureDate(days){ const d=new Date(); d.setDate(d.getDate()+(days||30)); return d.toISOString().slice(0,10); }
// Small inline-SVG icons for compact admin table-row buttons (edit / delete) — stroke uses
// currentColor so they pick up whatever text color the surrounding button has.
function iconGear(){
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82A1.65 1.65 0 0 0 3 13.09H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
}
function iconTrash(){
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
}
/* catIcon(m) — a market's logo tile: the admin-uploaded image if one was set (m.image),
   otherwise the same colored category-letter tile as always. Takes the whole market
   object (not just the category) so it can check for an uploaded image. */
function catIcon(m){
  const cat = (m && m.category) || '';
  if(m && m.image) return `<div class="mc-icon" style="padding:0;overflow:hidden;"><img src="${m.image}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"></div>`;
  return `<div class="mc-icon" style="background:${CATEGORY_COLOR[cat]||'#64748B'}">${CATEGORY_LETTER[cat]||(cat?cat[0]:'?')}</div>`;
}

/* ---------- price chart: blue line + soft area fill, optional range slice ---------- */
function priceChart(history, opts){
  opts = opts || {};
  const range = opts.range || 'all';
  const sliceMap = { '1w':7, '1m':14, all:history.length };
  const n = Math.min(history.length, sliceMap[range] || history.length);
  const pts = history.slice(history.length - n);
  const w = opts.w||620, h = opts.h||220, pad=20;
  const maxT = Math.max(1, pts.length-1);
  const x = i => pad + (i/maxT) * (w-pad*2);
  const y = v => (h-pad) - (v/100) * (h-pad*2);
  let line = pts.map((p,i)=> (i===0?'M':'L')+x(i).toFixed(1)+','+y(p.yes).toFixed(1)).join(' ');
  const area = line + ` L${x(pts.length-1).toFixed(1)},${(h-pad).toFixed(1)} L${x(0).toFixed(1)},${(h-pad).toFixed(1)} Z`;
  const last = pts[pts.length-1];
  const gridY = [0,25,50,75,100];
  const grid = gridY.map(v=>`<line x1="${pad}" y1="${y(v).toFixed(1)}" x2="${w-pad}" y2="${y(v).toFixed(1)}" style="stroke:var(--border);stroke-width:1"/>`+
    `<text x="2" y="${(y(v)+3).toFixed(1)}" style="font-family:var(--font-mono);font-size:10px;fill:var(--faint)">${v}%</text>`).join('');
  const gid = 'g'+Math.random().toString(36).slice(2,8);
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="ความน่าจะเป็นฝั่งใช่ตามช่วงเวลา">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:var(--accent);stop-opacity:0.18"/>
      <stop offset="100%" style="stop-color:var(--accent);stop-opacity:0"/>
    </linearGradient></defs>
    ${grid}
    <path d="${area}" style="fill:url(#${gid});stroke:none"/>
    <path d="${line}" style="fill:none;stroke:var(--accent);stroke-width:2.25px;stroke-linecap:round;stroke-linejoin:round"/>
    <circle cx="${x(pts.length-1).toFixed(1)}" cy="${y(last.yes).toFixed(1)}" r="4" style="fill:var(--accent)"/>
  </svg>`;
}

/* ---------- market card, Polymarket-style ---------- */
function marketCard(m, hotTag){
  const closed = m.status==='resolved';
  const badges = [];
  if(hotTag) badges.push('<span class="badge">🔥 มาแรง</span>');
  if(m.featured) badges.push('<span class="badge badge-accent">แนะนำ</span>');
  const badgeGroup = badges.length ? `<div style="display:flex;gap:6px;margin-left:auto;">${badges.join('')}</div>` : '';
  return `<div class="card market-card" onclick="location.href='market-detail.html?id=${m.id}'">
    ${mcTagBtn(m.id)}
    <div class="mc-top">
      ${catIcon(m)}
      <div class="mc-q">${esc(m.question)}</div>
    </div>
    ${closed ? `<div><span class="badge ${m.outcome==='yes'?'badge-yes':'badge-no'}">ตัดสินผลแล้ว: ${m.outcome==='yes'?'ใช่':'ไม่'}</span></div>` : `
    <div class="mc-prob">
      <span class="n" style="color:${m.yesPrice>=50?'var(--yes-strong)':'var(--no-strong)'}">${pct(m.yesPrice)}</span>
      <span style="color:var(--muted);font-size:12.5px">โอกาส</span>
      ${badgeGroup}
    </div>
    <div class="mc-bar"><span style="width:${m.yesPrice}%"></span></div>
    <div class="mc-actions">
      <button class="btn btn-yes-outline" onclick="event.stopPropagation(); location.href='market-detail.html?id=${m.id}&side=yes'">ใช่ ${m.yesPrice}¢</button>
      <button class="btn btn-no-outline" onclick="event.stopPropagation(); location.href='market-detail.html?id=${m.id}&side=no'">ไม่ ${100-m.yesPrice}¢</button>
    </div>`}
    <div class="mc-foot"><span>${catTh(m.category)}</span><span>ปริมาณ ${money(m.volume).replace('.00','')}</span></div>
  </div>`;
}

/* ---------- hero section: hot-markets carousel + ad rail + hot list ----------
   Shown only on the default "ทั้งหมด" markets view (index.html), above the market grid.
   Ranking: admin's existing "แนะนำ" (featured) toggle always gets a guaranteed slot (tagged
   "แนะนำ" so it's clear it was admin-forced); the rest of the slots fill automatically with
   the highest-volume markets (tagged "มาแรง"). The combined set then displays sorted by
   volume, so a featured market still lands roughly where its real traffic would put it. */
const HERO_HOT_SLOTS = 5;
function hotMarkets(markets){
  const open = markets.filter(m=>m.status!=='resolved');
  const featured = open.filter(m=>m.featured);
  const rest = open.filter(m=>!m.featured).sort((a,b)=>b.volume-a.volume);
  const autoCount = Math.max(0, HERO_HOT_SLOTS - featured.length);
  const combined = featured.map(m=>({m, tag:'admin'})).concat(rest.slice(0, autoCount).map(m=>({m, tag:'auto'})));
  combined.sort((a,b)=>b.m.volume-a.m.volume);
  return combined;
}
// Lookup used by marketCard() to know which markets are in the หัวข้อฮิต list (and
// whether admin-featured or auto-picked by volume), so the grid can show the same 🔥
// signal as the hero section's hot list — not just the hero carousel itself.
function hotMarketTagById(markets){
  const map = {};
  hotMarkets(markets).forEach(h=>{ map[h.m.id] = h.tag; });
  return map;
}

/* ---------- hero ad banners (admin-uploadable, demo-persisted like everything else) ---------- */
function placeholderPromoSvg(line1, line2, c1, c2){
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="225" viewBox="0 0 600 225">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="600" height="225" fill="url(#g)"/>
    <text x="30" y="105" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#fff">${line1}</text>
    <text x="30" y="140" font-family="Arial, sans-serif" font-size="15" fill="rgba(255,255,255,.85)">${line2}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
// Named "promo" everywhere (not "ad"/"ads") on purpose: browser ad-blockers cosmetically
// hide any element whose class/id matches generic ad-pattern filters like ##.ad, ##.ads,
// ##[class*="-ad"] — which "hero-ad"/"hero-ads" matched exactly. That's why these boxes
// could silently vanish in Chrome (with an ad-blocking extension) while looking fine in
// Safari or a browser without one — nothing was wrong with the app or the data, the class
// name itself was the trigger. Keep this naming (promo, not ad) for anything user-visible.
function seedHeroPromos(){
  return [
    { img: placeholderPromoSvg('พื้นที่โฆษณาของคุณ', 'ตัวอย่าง — อัปโหลดได้ที่หน้าจัดการระบบ', '#1652F0', '#7C3AED'), label:'ตัวอย่างโฆษณา 1' },
    { img: placeholderPromoSvg('โปรโมทที่นี่', 'ตัวอย่าง — อัปโหลดได้ที่หน้าจัดการระบบ', '#0FA968', '#0E7490'), label:'ตัวอย่างโฆษณา 2' },
  ];
}
function loadHeroPromos(){ const v = Store.get('heroPromos', null); return v===null ? seedHeroPromos() : v; }
function saveHeroPromos(v){ Store.set('heroPromos', v); }

function heroSectionHtml(markets, activeSlide){
  const hot = hotMarkets(markets);
  if(!hot.length) return '';
  const idx = ((activeSlide||0) % hot.length + hot.length) % hot.length;
  const promos = loadHeroPromos();
  const slides = hot.map((h,i)=>{
    const m = h.m;
    return `<div class="hero-slide ${i===idx?'active':''}" onclick="location.href='market-detail.html?id=${m.id}'">
      <div class="hero-slide-head">
        ${catIcon(m)}
        <div>
          <div class="hero-slide-cat">${catTh(m.category)} ${h.tag==='admin' ? '<span class="badge badge-accent">แนะนำ</span>' : '<span class="badge">🔥 มาแรง</span>'}</div>
          <div class="hero-slide-q">${esc(m.question)}</div>
        </div>
      </div>
      <div class="hero-slide-prob"><span class="n" style="color:${m.yesPrice>=50?'var(--yes-strong)':'var(--no-strong)'}">${pct(m.yesPrice)}</span><span class="sub">โอกาสที่จะเป็น “ใช่”</span></div>
      <div class="hero-slide-chart">${priceChart(m.history, {range:'all', h:230})}</div>
      <div class="hero-slide-pills">
        <div class="btn btn-yes">ใช่ ${m.yesPrice}¢</div>
        <div class="btn btn-no">ไม่ ${100-m.yesPrice}¢</div>
      </div>
      <div class="hero-slide-foot"><span>${catTh(m.category)}</span><span>ปริมาณ ${money(m.volume).replace('.00','')}</span></div>
    </div>`;
  }).join('');
  const dots = hot.map((_,i)=>`<button class="hero-dot ${i===idx?'active':''}" onclick="event.stopPropagation(); setHeroSlide(${i})" aria-label="สไลด์ ${i+1}"></button>`).join('');
  const promoCol = promos.map(a=>`<div class="hero-promo" style="background-image:url('${a.img}')" title="${esc(a.label||'')}"></div>`).join('');
  const hotList = hot.map((h,i)=>`<div class="hero-hot-row" onclick="location.href='market-detail.html?id=${h.m.id}'">
      <span class="hero-hot-rank">${i+1}</span>
      <span class="hero-hot-q">${esc(h.m.question)}</span>
      ${h.tag==='admin' ? '<span class="badge badge-accent">แนะนำ</span>' : ''}
      <span class="hero-hot-vol mono">${money(h.m.volume).replace('.00','')}</span>
    </div>`).join('');
  return `<div class="hero-section">
    <div class="hero-carousel card">
      <div class="hero-slides-wrap">
        ${hot.length>1 ? `<button class="hero-arrow prev" onclick="event.stopPropagation(); heroPrev()" aria-label="ก่อนหน้า">‹</button>
        <button class="hero-arrow next" onclick="event.stopPropagation(); heroNext()" aria-label="ถัดไป">›</button>` : ''}
        <div class="hero-slides">${slides}</div>
      </div>
      ${hot.length>1 ? `<div class="hero-dots">${dots}</div>` : ''}
    </div>
    <div class="hero-side">
      <div class="hero-promos">${promoCol}</div>
      <div class="hero-hotlist card">
        <div class="hero-hotlist-head">🔥 หัวข้อฮิต</div>
        ${hotList}
      </div>
    </div>
  </div>`;
}

/* ---------- site footer (admin-manageable links, demo-persisted like everything else) ---------- */
function seedFooterLinks(){
  return [
    { label:'ตลาดทั้งหมด', url:'index.html' },
    { label:'ลีดเดอร์บอร์ด', url:'leaderboard.html' },
    { label:'กิจกรรม', url:'activity.html' },
    { label:'คำถามที่พบบ่อย', url:'faq.html' },
    { label:'ข้อกำหนดการใช้งาน', url:'legal.html' },
    { label:'นโยบายความเป็นส่วนตัว', url:'legal.html?tab=privacy' },
  ];
}
function loadFooterLinks(){ const v = Store.get('footerLinks', null); return v===null ? seedFooterLinks() : v; }
function saveFooterLinks(v){ Store.set('footerLinks', v); }

function seedFooterSocial(){
  return [
    { label:'ฝ่ายสนับสนุน', url:'mailto:support@debatic.app' },
    { label:'X (Twitter)', url:'#' },
    { label:'Discord', url:'#' },
    { label:'Telegram', url:'#' },
  ];
}
function loadFooterSocial(){ const v = Store.get('footerSocial', null); return v===null ? seedFooterSocial() : v; }
function saveFooterSocial(v){ Store.set('footerSocial', v); }

// Demo-appropriate legal disclaimer — Debatic is a prototype, not a regulated trading venue,
// so this deliberately avoids echoing real platforms' entity/regulator claims. Links point at
// this site's own placeholder Terms/Privacy content in legal.html.
function footerDisclaimerHtml(){
  return `<span class="badge badge-warn" style="margin-right:6px;">เนื้อหาตัวอย่าง</span>Debatic เป็นระบบสาธิต (demo) ที่จัดทำขึ้นเพื่อทดลองและนำเสนอแนวคิดตลาดทำนายผลแบบใช่/ไม่เท่านั้น ไม่ใช่แพลตฟอร์มการเทรดจริง ไม่มีการใช้เงินจริง และไม่ได้อยู่ภายใต้การกำกับดูแลของหน่วยงานใด ยอดคงเหลือ ราคาตลาด และธุรกรรมทั้งหมดที่แสดงเป็นเพียงข้อมูลจำลองเพื่อการนำเสนอ เมื่อพัฒนาต่อเป็นระบบใช้งานจริง ทีมพัฒนาจะระบุนิติบุคคล เขตอำนาจศาล และหน่วยงานกำกับดูแลที่เกี่ยวข้องไว้ในส่วนนี้ อ่าน <a href="legal.html">ข้อกำหนดการใช้งาน</a> และ <a href="legal.html?tab=privacy">นโยบายความเป็นส่วนตัว</a> ของเรา (เนื้อหาตัวอย่างสำหรับสาธิตเช่นกัน)`;
}
function footerHtml(){
  const links = loadFooterLinks();
  const social = loadFooterSocial();
  return `<footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-top">
        <div class="footer-left">
          <div class="footer-brand-row">
            <div class="brand" style="pointer-events:none;"><div class="mark">D</div><div class="name">Debatic</div></div>
            <p class="sub footer-tagline">ตลาดทำนายผลแบบใช่ / ไม่ สำหรับสาธิต — เทรดตามมุมมองของคุณต่อเหตุการณ์ต่าง ๆ</p>
          </div>
          ${links.length ? `<div class="footer-links-row">${links.map(l=>`<a href="${esc(l.url)}">${esc(l.label)}</a>`).join('')}</div>` : ''}
        </div>
        ${social.length ? `<div class="footer-social">
          <div class="footer-social-label">ฝ่ายสนับสนุนและโซเชียล</div>
          <div class="footer-social-btns">${social.map(s=>`<a class="btn btn-sm btn-outline" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('')}</div>
        </div>` : ''}
      </div>
      <div class="footer-sep"></div>
      <p class="footer-disclaimer">${footerDisclaimerHtml()}</p>
    </div>
  </footer>`;
}

function activityItem(a, markets){
  const m = markets.find(x=>x.id===a.marketId);
  const label = a.action==='created' ? 'สร้างตลาดใหม่'
    : a.action==='resolved' ? `ตัดสินผลตลาดเป็น “${a.outcome==='yes'?'ใช่':'ไม่'}”`
    : `${a.action==='bought'?'ซื้อ':'ขาย'} ${money(a.amount)} ฝั่ง “${a.side==='yes'?'ใช่':'ไม่'}”`;
  const ic = a.action==='created' || a.action==='resolved' ? 'sys' : a.side;
  const glyph = a.action==='created' ? '+' : a.action==='resolved' ? '✓' : (a.side==='yes'?'Y':'N');
  return `<div class="activity-item">
    <div class="act-ic ${ic}">${glyph}</div>
    <div class="act-body"><b>${esc(a.user)}</b> ${label}${m?` ในตลาด “<a href="market-detail.html?id=${m.id}">${esc(m.question)}</a>”`:''}</div>
    <div class="act-time">${a.time}</div>
  </div>`;
}

/* ---------- comments (per-market, Facebook-style: post + reply) ----------
   Stored as { [marketId]: [ {id,user,avatarLetter,avatarColor,text,ts,likes,liked,replies:[...]} ] } */
function loadComments(){ const v = Store.get('comments', null); return v===null ? {} : v; }
function saveComments(v){ Store.set('comments', v); }
function timeAgo(ts){
  const s = Math.max(0, Math.floor((Date.now()-ts)/1000));
  if(s<60) return 'เมื่อสักครู่';
  const mins = Math.floor(s/60); if(mins<60) return mins+'นาทีที่แล้ว';
  const hrs = Math.floor(mins/60); if(hrs<24) return hrs+'ชม ที่แล้ว';
  const days = Math.floor(hrs/24); if(days<30) return days+'วันที่แล้ว';
  return new Date(ts).toLocaleDateString('th-TH');
}

/* ---------- fake top-holders / positions (demo-only) ----------
   The player-facing app only has ONE real logged-in account, so there is no real order
   book of other traders to show here. To still make the "ผู้ถือรายใหญ่"/"สถานะ" tabs look
   populated for an investor demo, this deterministically fabricates a holder list per
   market+side from a simple string hash — same list every render (no Math.random, so it
   doesn't reshuffle every time you trade), scaled by the market's own price. Your backend
   developer replaces this with the real per-user position table. */
const FAKE_HOLDER_NAMES = ['CryptoKanya','SiamTrader','BullRunBoy','ThaiWhale','MoneyMakerX','LuckyDragon','BangkokBetter','NightOwlTrade','RiceFieldRon','SapphireSlan','JConfirm','PolyFanatic','GreenCandleGuy','MoonShotMint','QuietWhale','FarSideFlip'];
function hashStr(s){ let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h; }
function fakeHolders(m, side, count){
  count = count || 6;
  const list = [];
  for(let i=0;i<count;i++){
    const seed = hashStr(m.id+':'+side+':'+i);
    const name = FAKE_HOLDER_NAMES[(seed+i*7)%FAKE_HOLDER_NAMES.length] + (seed%89);
    const shares = 300 + (seed % 40000);
    const avgPrice = 8 + (Math.floor(seed/7) % 84); // 8..91 cents
    list.push({ name, shares, avgPrice });
  }
  // The one REAL position in this demo (the logged-in trader's own) is not part of the
  // fabricated list above, so splice it in here — otherwise a real trade wouldn't show up
  // in "ผู้ถือรายใหญ่"/"สถานะ" at all, which looked like the app forgot about your position.
  const pos = loadPositions().find(p=>p.marketId===m.id && p.side===side && !p.settled);
  if(pos && pos.shares>0){
    const me = Session.current();
    list.push({ name:(me?me.name:'คุณ')+' (คุณ)', shares:pos.shares, avgPrice:Math.round((pos.avgPrice||0)*100), isYou:true });
  }
  return list.sort((a,b)=>b.shares-a.shares);
}
function topHoldersHtml(m){
  const col = (side, label) => `<div class="holders-col"><h4>${label} ผู้ถือ</h4>${fakeHolders(m,side,6).map(h=>`
    <div class="holder-row${h.isYou?' you':''}">
      <div class="holder-name"><span class="avatar" style="width:22px;height:22px;font-size:10px;background:${userColor(h.name)}">${esc(h.name[0].toUpperCase())}</span><span class="n">${esc(h.name)}</span></div>
      <span class="mono">${Math.round(h.shares).toLocaleString()}</span>
    </div>`).join('')}</div>`;
  return `<div class="holders-grid">${col('yes','Yes')}${col('no','No')}</div>
    <p class="sub" style="margin-top:10px;font-size:11.5px;">รายชื่อผู้ถือจำลองสำหรับการสาธิตเท่านั้น (ยกเว้นแถวของคุณซึ่งเป็นข้อมูลจริง)</p>`;
}
function holderStatusHtml(m){
  const col = (side, label) => {
    const curCents = side==='yes' ? m.yesPrice : 100-m.yesPrice;
    return `<div class="holders-col"><h4>${label}</h4>${fakeHolders(m,side,6).map(h=>{
      const pnl = h.shares*(curCents-h.avgPrice)/100;
      return `<div class="holder-row${h.isYou?' you':''}">
        <div class="holder-name"><span class="n">${esc(h.name)}</span><span class="holder-avg">เฉลี่ย ${h.avgPrice}¢</span></div>
        <span class="holder-val ${pnl>=0?'pos':'neg'} mono">${money(pnl)}</span>
      </div>`;
    }).join('')}</div>`;
  };
  return `<div class="holders-grid">${col('yes','Yes')}${col('no','No')}</div>
    <p class="sub" style="margin-top:10px;font-size:11.5px;">กำไร/ขาดทุนจำลองสำหรับการสาธิตเท่านั้น</p>`;
}

/* ---------- friend-referral program ----------
   The referrer earns settings.referralReferrerPct% of a referred friend's first deposit
   once that friend has signed up AND placed their first trade; the friend gets
   settings.referralFriendPct% of that same first deposit as a welcome bonus. A signup with
   no referrer at all instead gets settings.newUserBonusPct% of their own first deposit —
   a smaller, no-referral-needed welcome bonus so every new signup gets *something*, just
   less than someone who came through a friend's link. All three rates are admin-adjustable
   (see admin-settings.html), same pattern as the trading fees. This is a settings field
   only for the demo — no signup flow actually pays it out yet.
   This demo only ever has one login account, so there's no real second person who could
   sign up through a referral link — the list below is a deterministic seeded stand-in
   (same trick as fakeHolders) so the dashboard has something to show, and it reacts
   live to the admin's rate. referral.html also offers a "simulate a friend" action that
   appends to this same persisted list, to demo the payout math changing in real time.
   Your backend developer wires this up against real signups later. */
function seedReferrals(){
  const me = Session.current();
  const seedBase = hashStr((me && me.handle) || 'guest');
  const list = [];
  for(let i=0;i<5;i++){
    const seed = hashStr(seedBase+'-ref-'+i);
    const name = FAKE_HOLDER_NAMES[(seed+i*11)%FAKE_HOLDER_NAMES.length];
    const qualified = (seed%10) < 8; // most have already placed their first trade
    const firstDeposit = 50 + (seed % 950);
    const daysAgo = 2 + (seed % 40);
    list.push({ id:'ref'+i, name, joined: daysAgo+' วันที่แล้ว', qualified, firstDeposit });
  }
  return list;
}
function loadReferrals(){ const v = Store.get('referrals', null); return v===null ? seedReferrals() : v; }
function saveReferrals(list){ Store.set('referrals', list); }
function referralStats(list, pct){
  const qualified = list.filter(r=>r.qualified);
  const totalReward = qualified.reduce((s,r)=> s + r.firstDeposit*(pct||0)/100, 0);
  return { count: qualified.length, totalReward };
}
function referralCode(user){
  if(!user) return 'FRIEND';
  return (user.handle || user.name || 'friend').replace('@','').toUpperCase();
}

/* ---------- shared trade panel + closed panel (used by market-detail.html) ---------- */
function closedPanelHtml(m){
  return `<h3 style="font-size:16px;margin-bottom:10px;">ตลาดนี้ตัดสินผลแล้ว</h3>
    <div class="badge ${m.outcome==='yes'?'badge-yes':'badge-no'}" style="font-size:12.5px;padding:8px 14px;">ผลสรุป: ${m.outcome==='yes'?'ใช่':'ไม่'}</div>
    <p class="sub" style="margin-top:12px;">หุ้นฝั่งที่ชนะจ่ายหุ้นละ $1.00 การซื้อขายในตลาดนี้ปิดแล้ว</p>
    <a class="btn btn-block" style="margin-top:12px;" href="portfolio.html?tab=history">ดูในพอร์ตของฉัน →</a>`;
}
function tradeSummaryHtml(m, side, amount){
  const feePct = loadSettings().feePct || 0;
  const fee = amount>0 ? amount*feePct/100 : 0;
  const net = Math.max(0, amount - fee);
  const quote = ammBuyQuote(m, side, net);
  const sideTh = side==='yes' ? 'ใช่' : 'ไม่';
  return `<div class="row"><span>ราคาต่อหุ้น (เริ่มต้น)</span><span class="mono">$${(sidePriceCents(m,side)/100).toFixed(2)}</span></div>
    ${feePct>0 ? `<div class="row"><span>ค่าธรรมเนียมแพลตฟอร์ม (ซื้อ, ${feePct}%)</span><span class="mono">-$${fee.toFixed(2)}</span></div>` : ''}
    <div class="row"><span>จำนวนหุ้นที่จะได้รับ</span><span class="mono">${quote.shares.toFixed(2)}</span></div>
    <div class="row"><span>ผลตอบแทนหากฝั่ง “${sideTh}” ชนะ</span><span class="mono">$${quote.shares.toFixed(2)}</span></div>`;
}
function sellSummaryHtml(m, side, qty, ownedShares){
  qty = Math.max(0, Math.min(qty||0, ownedShares||0));
  const quote = ammSellQuote(m, side, qty);
  const sellFeePct = loadSettings().sellFeePct || 0;
  const fee = quote.proceeds>0 ? quote.proceeds*sellFeePct/100 : 0;
  const net = Math.max(0, quote.proceeds - fee);
  return `<div class="row"><span>ราคาต่อหุ้น (เริ่มต้น)</span><span class="mono">$${(sidePriceCents(m,side)/100).toFixed(2)}</span></div>
    <div class="row"><span>จำนวนหุ้นที่จะขาย</span><span class="mono">${qty.toFixed(2)}</span></div>
    ${sellFeePct>0 ? `<div class="row"><span>ค่าธรรมเนียมแพลตฟอร์ม (ขาย, ${sellFeePct}%)</span><span class="mono">-$${fee.toFixed(2)}</span></div>` : ''}
    <div class="row"><span>เงินที่จะได้รับ</span><span class="mono">$${net.toFixed(2)}</span></div>`;
}
function tradePanelHtml(m, side, balance, lastAmt, mode, ownedShares){
  mode = mode || 'buy';
  ownedShares = ownedShares || 0;
  const actionLabel = mode==='buy' ? 'ซื้อ' : 'ขาย';
  const canSell = mode!=='sell' || ownedShares>0;
  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">${catIcon(m)}<div style="font-weight:700;font-size:13.75px;line-height:1.3;">${esc(m.question)}</div></div>
    <div class="tabbar" style="width:100%;">
      <button class="${mode==='buy'?'active':''}" style="flex:1;" onclick="setMode('${m.id}','buy')">ซื้อ</button>
      <button class="${mode==='sell'?'active':''}" style="flex:1;" onclick="setMode('${m.id}','sell')">ขาย</button>
    </div>
    <div class="side-toggle">
      <button class="${side==='yes'?'sel-yes':''}" onclick="setSide('${m.id}','yes')">ใช่ · ${m.yesPrice}¢</button>
      <button class="${side==='no'?'sel-no':''}" onclick="setSide('${m.id}','no')">ไม่ · ${100-m.yesPrice}¢</button>
    </div>
    ${mode==='buy' ? `
    <div class="field"><label for="tradeAmt">จำนวนเงิน</label>
      <input id="tradeAmt" type="number" min="1" step="1" placeholder="$0" value="${lastAmt||''}" oninput="lastTradeAmt=this.value; updateSummary('${m.id}')">
    </div>
    <div class="amt-chips">
      ${[1,5,10,100].map(v=>`<button onclick="setAmt(${v})">+$${v}</button>`).join('')}
    </div>
    <div class="trade-summary" id="tradeSummary">${tradeSummaryHtml(m, side, Number(lastAmt)||0)}</div>
    ` : `
    <div class="field"><label for="tradeAmt">${canSell?`จำนวนหุ้นที่จะขาย (ถืออยู่ ${ownedShares.toFixed(2)} หุ้น)`:'คุณยังไม่มีโพซิชันฝั่งนี้'}</label>
      <input id="tradeAmt" type="number" min="0" max="${ownedShares}" step="0.01" placeholder="0.00" value="${lastAmt||''}" oninput="lastTradeAmt=this.value; updateSummary('${m.id}')" ${canSell?'':'disabled'}>
    </div>
    <div class="amt-chips">
      <button onclick="setAmt(${ownedShares})" ${canSell?'':'disabled'}>ขายทั้งหมด</button>
      <button onclick="setAmt(${(ownedShares/2).toFixed(2)})" ${canSell?'':'disabled'}>ขายครึ่งหนึ่ง</button>
    </div>
    <div class="trade-summary" id="tradeSummary">${sellSummaryHtml(m, side, Number(lastAmt)||0, ownedShares)}</div>
    `}
    <button class="btn btn-block btn-primary" onclick="placeTrade('${m.id}')" ${canSell?'':'disabled'}>${actionLabel}</button>
    <p class="trade-disclaimer">ยอดคงเหลือ <span class="mono">${money(balance)}</span> · เป็นเงินทดลองเท่านั้น การเทรดถือว่าคุณยอมรับ<a href="legal.html">ข้อกำหนดการใช้งาน</a></p>
  `;
}
function orderBookHtml(m){
  const mid = m.yesPrice;
  const asks = [mid+9, mid+6, mid+3].filter(v=>v<100).sort((a,b)=>a-b);
  const bids = [mid-1, mid-4, mid-7].filter(v=>v>0).sort((a,b)=>b-a);
  const row = (p, sizeSeed, cls) => {
    const size = Math.max(20, Math.round((sizeSeed*37)%400+40));
    return `<tr><td class="${cls} mono">${p}¢</td><td class="mono">${size} หุ้น</td><td style="width:40%;"><div class="ob-bar" style="width:${Math.min(100,size/4)}%;background:${cls==='ob-ask'?'var(--no-soft)':'var(--yes-soft)'}"></div></td></tr>`;
  };
  return `
    <div class="orderbook card">
      <div class="orderbook-head" onclick="const b=this.nextElementSibling; b.hidden=!b.hidden; this.querySelector('.sub').textContent = b.hidden ? 'แสดง +' : 'ซ่อน −';">
        <b>สมุดคำสั่ง</b><span class="sub">แสดง +</span>
      </div>
      <div style="padding:0 14px 14px;" hidden>
        <table class="ob-table">
          ${asks.map((p,i)=>row(p, p+i, 'ob-ask')).join('')}
          <tr><td colspan="3" style="padding:6px 8px;font-weight:700;">${mid}¢ ล่าสุด</td></tr>
          ${bids.map((p,i)=>row(p, p+i, 'ob-bid')).join('')}
        </table>
        <p class="sub" style="margin-top:6px;font-size:11.5px;">สมุดคำสั่งจำลองสำหรับการสาธิตเท่านั้น — นักพัฒนาฝั่งเซิร์ฟเวอร์ของคุณจะเชื่อมส่วนนี้เข้ากับระบบจับคู่คำสั่งจริงหรือ AMM</p>
      </div>
    </div>`;
}

/* ---------- category top tabs + filter rail (Markets page) ---------- */
function catTabsHtml(active){
  const all = ['All', ...CATEGORIES];
  return `<nav class="cat-tabs">${all.map(c=>`<a class="cat-tab ${(!active&&c==='All')||active===c?'active':''}" href="index.html${c==='All'?'':'?cat='+encodeURIComponent(c)}">${c==='All'?'ทั้งหมด':catTh(c)}</a>`).join('')}</nav>`;
}
function filterRailHtml(markets, activeCat, activeRange, activeTagged){
  const counts = {};
  CATEGORIES.forEach(c=> counts[c] = markets.filter(m=>m.status!=='resolved' && m.category===c).length);
  const openTotal = markets.filter(m=>m.status!=='resolved').length;
  const rangeCounts = {};
  FREQUENCIES.forEach(f=> rangeCounts[f] = markets.filter(m=>m.status!=='resolved' && m.frequency===f).length);
  const ranges = [['all','ทั้งหมด',openTotal],['daily','รายวัน',rangeCounts.daily],['weekly','รายสัปดาห์',rangeCounts.weekly],['monthly','รายเดือน',rangeCounts.monthly]];
  // qs(extra) builds an index.html link carrying whatever of cat/range/tagged is still
  // active, so toggling one filter (e.g. tagged) never drops the other two.
  const qs_ = (extra) => {
    const parts = Object.assign({ cat:activeCat||'', range:(activeRange&&activeRange!=='all')?activeRange:'', tagged:activeTagged?'1':'' }, extra);
    const pairs = Object.keys(parts).filter(k=>parts[k]).map(k=>`${k}=${encodeURIComponent(parts[k])}`);
    return 'index.html' + (pairs.length ? '?'+pairs.join('&') : '');
  };
  const taggedCount = markets.filter(m=>m.status!=='resolved' && isTagged(m.id)).length;
  return `
    <a class="rail-item ${activeTagged?'active':''}" href="${qs_({tagged: activeTagged ? '' : '1'})}"><span>🏷️ ตลาดที่ติดแท็ก</span><span class="n">${taggedCount}</span></a>
    <div class="rail-sep"></div>
    <div class="rail-label">ช่วงเวลา</div>
    ${ranges.map(r=>`<a class="rail-item ${(!activeRange&&r[0]==='all')||activeRange===r[0]?'active':''}" href="${qs_({range:r[0]==='all'?'':r[0]})}"><span>${r[1]}</span><span class="n">${r[2]}</span></a>`).join('')}
    <div class="rail-sep"></div>
    <div class="rail-label">หมวดหมู่</div>
    <a class="rail-item ${!activeCat?'active':''}" href="${qs_({cat:''})}"><span>ตลาดทั้งหมด</span><span class="n">${openTotal}</span></a>
    ${CATEGORIES.map(c=>`<a class="rail-item ${activeCat===c?'active':''}" href="${qs_({cat:c})}"><span>${catTh(c)}</span><span class="n">${counts[c]}</span></a>`).join('')}
  `;
}

/* ---------- shell chrome (top nav), trader side ---------- */
function traderShell(activeCat, user, balance, unread){
  const howToPlay = `<button class="btn btn-ghost" onclick="openHowToPlay()" style="gap:6px;"><span style="font-size:13px;">ⓘ</span>วิธีการเล่น</button>`;
  const authed = user ? `
      <div class="topbar-stats">
        <a class="topbar-stat portfolio" href="portfolio.html" title="พอร์ตของฉัน — มูลค่าปัจจุบันของโพซิชันที่เปิดอยู่"><span class="k">พอร์ต</span><span class="v mono ${portfolioPnl()>=0?'pnl-pos':'pnl-neg'}">${money(portfolioValue())}</span></a>
        <a class="topbar-stat cash" href="wallet.html" title="กระเป๋าเงิน — เงินสดคงเหลือ"><span class="k">กระเป๋าเงิน</span><span class="v mono pnl-pos">${money(balance)}</span></a>
      </div>
      <div class="icon-btn" onclick="location.href='referral.html'" title="แนะนำเพื่อน & รางวัล">🎁</div>
      <div class="icon-btn" onclick="toggleNotif(notifications)" title="การแจ้งเตือน">🔔${unread?'<span class="unread"></span>':''}</div>
      <div class="menu-wrap">
        <div class="avatar" style="${avatarStyle(user.avatarColor, user.avatarImage)}" onclick="toggleMenu()" title="เมนู">${avatarLabel(user.avatarLetter, user.avatarImage)}</div>
        <div id="accountMenu" class="dropdown-menu" hidden>
          <a href="profile.html?id=me"><span class="ic">☺</span>โปรไฟล์</a>
          <a href="portfolio.html"><span class="ic">◔</span>พอร์ตของฉัน</a>
          <a href="referral.html"><span class="ic">🎁</span>แนะนำเพื่อน & รางวัล</a>
          <a href="wallet.html"><span class="ic">$</span>กระเป๋าเงิน</a>
          <a href="create-market.html"><span class="ic">+</span>แนะนำกระทู้ใหม่</a>
          <div class="dropdown-toggle-row"><span class="row-label"><span class="ic">☾</span>โหมดมืด</span><button class="toggle-switch theme-switch ${loadTheme()==='dark'?'on':''}" onclick="toggleTheme()" title="สลับโหมดมืด/สว่าง"><span class="knob"></span></button></div>
          <div class="sep"></div>
          <a href="leaderboard.html"><span class="ic">#</span>ลีดเดอร์บอร์ด</a>
          <a href="activity.html"><span class="ic">≡</span>กิจกรรม</a>
          <a href="settings.html"><span class="ic">⚙</span>ตั้งค่า</a>
          <button onclick="openHowToPlay()"><span class="ic">?</span>วิธีการเล่น</button>
          <a href="legal.html"><span class="ic">§</span>ข้อกำหนดการใช้งาน</a>
          <div class="sep"></div>
          <button onclick="logoutTrader()"><span class="ic">←</span>ออกจากระบบ</button>
        </div>
      </div>
  ` : `
      <button class="btn btn-outline" onclick="location.href='login.html'">เข้าสู่ระบบ</button>
      <button class="btn btn-primary" onclick="location.href='login.html'">สมัครสมาชิก</button>
      <div class="menu-wrap">
        <div class="icon-btn" onclick="toggleMenu()" title="เมนู">≡</div>
        <div id="accountMenu" class="dropdown-menu" hidden>
          <div class="dropdown-toggle-row"><span class="row-label"><span class="ic">☾</span>โหมดมืด</span><button class="toggle-switch theme-switch ${loadTheme()==='dark'?'on':''}" onclick="toggleTheme()" title="สลับโหมดมืด/สว่าง"><span class="knob"></span></button></div>
          <div class="sep"></div>
          <a href="leaderboard.html"><span class="ic">#</span>ลีดเดอร์บอร์ด</a>
          <a href="activity.html"><span class="ic">≡</span>กิจกรรม</a>
          <button onclick="openHowToPlay()"><span class="ic">?</span>วิธีการเล่น</button>
          <a href="legal.html"><span class="ic">§</span>ข้อกำหนดการใช้งาน</a>
        </div>
      </div>
  `;

  return `
  <div class="topnav">
    <div class="topnav-row">
      <a class="brand" href="index.html" style="text-decoration:none;color:inherit;cursor:pointer;"><div class="mark">D</div><div class="name">Debatic</div></a>
      <div class="search-box"><span class="ic">⌕</span><input id="searchInput" type="text" placeholder="ค้นหาตลาด…"></div>
      <div class="topbar-spacer"></div>
      ${howToPlay}
      <div style="display:flex;align-items:center;gap:8px;">${authed}</div>
    </div>
    ${catTabsHtml(activeCat)}
  </div>
  <main id="view" class="view"></main>
  ${footerHtml()}
  <nav class="bottom-nav">
    <a href="index.html"><span class="ic">◧</span>ตลาด</a>
    <a href="leaderboard.html"><span class="ic">#</span>อันดับ</a>
    <a href="portfolio.html"><span class="ic">◔</span>พอร์ต</a>
    <a href="wallet.html"><span class="ic">$</span>กระเป๋าเงิน</a>
    <a href="profile.html?id=me"><span class="ic">☺</span>โปรไฟล์</a>
  </nav>
  <div id="notifPanel" class="notif-panel" hidden></div>`;
}

/* ---------- "How to play" pop-up, opened from the top-nav info button ---------- */
/* One step per screen (Polymarket-style walkthrough): a mock-UI illustration on top,
   progress dots, a title + description, and a "ถัดไป" button that advances the step. */
const HTP_STEPS = [
  ['เลือกกระทู้ที่สนใจ', 'ทุกกระทู้เป็นคำถามแบบ ใช่ / ไม่ เท่านั้น ดูโอกาสปัจจุบันได้จากเปอร์เซ็นต์บนการ์ด'],
  ['ซื้อฝั่ง “ใช่” หรือ “ไม่”', 'ราคาต่อหุ้นสะท้อนโอกาสที่ตลาดให้ไว้ในตอนนั้น — ยิ่งคุณคิดถูก ยิ่งได้ผลตอบแทนดีขึ้น'],
  ['รอผลตัดสิน', 'เมื่อเหตุการณ์จริงเกิดขึ้น ผู้ดูแลระบบจะตัดสินกระทู้เป็น “ใช่” หรือ “ไม่” ตามกติกาที่ระบุไว้'],
  ['รับเงินอัตโนมัติ', 'หุ้นฝั่งที่ชนะจะจ่ายหุ้นละ $1.00 เข้ายอดคงเหลือของคุณทันที'],
];
let htpStep = 0;
function htpVisual(step){
  if(step===0) return `
    <div class="htp-mockcard">
      <div class="htp-mc-top"><span class="htp-mc-dot" style="background:#8B5CF6;"></span><span class="htp-mc-cat">การเมือง</span></div>
      <div class="htp-mc-q">นายกฯ คนใหม่จะได้รับการแต่งตั้งก่อน ม.ค. 2027 หรือไม่?</div>
      <div class="htp-mc-pct">57%<span>โอกาส</span></div>
      <div class="htp-mc-bar"><span style="width:57%"></span></div>
      <div class="htp-mc-btns"><span class="htp-mc-btn yes">ใช่ 57¢</span><span class="htp-mc-btn no">ไม่ 43¢</span></div>
    </div>`;
  if(step===1) return `
    <div class="htp-stack">
      <div class="htp-mockamt no"><div class="htp-amt-top"><span>$100</span><span class="htp-amt-plus">+</span></div><div class="htp-amt-win">คืน $128 หากชนะ</div><div class="htp-amt-btn no">ซื้อฝั่งไม่</div></div>
      <div class="htp-mockamt yes"><div class="htp-amt-top"><span>$100</span><span class="htp-amt-plus">+</span></div><div class="htp-amt-win">คืน $163 หากชนะ</div><div class="htp-amt-btn yes">ซื้อฝั่งใช่</div></div>
    </div>`;
  if(step===2) return `
    <div class="htp-resolve">
      <div class="htp-resolve-badge">✓</div>
      <div class="htp-resolve-label">ตัดสินผลแล้ว</div>
      <span class="badge badge-yes" style="margin-top:2px;">ผล: ใช่</span>
    </div>`;
  return `
    <div class="htp-payout">
      <div class="htp-payout-pill"><span class="dot"></span>ยอดคงเหลือ <b>$2,663.93</b></div>
      <div class="htp-payout-tag">+$163.93</div>
    </div>`;
}
function howToPlayModalHtml(step){
  step = step||0;
  const last = step===HTP_STEPS.length-1;
  const [title, desc] = HTP_STEPS[step];
  return `
    <div class="modal-backdrop" id="howToPlayBackdrop" onclick="if(event.target===this) closeHowToPlay()">
      <div class="modal-card htp-wizard" role="dialog" aria-label="วิธีการเล่น">
        <button class="icon-btn htp-close" onclick="closeHowToPlay()" title="ปิด">✕</button>
        <div class="htp-visual">${htpVisual(step)}</div>
        <div class="htp-dots">${HTP_STEPS.map((_,i)=>`<span class="${i===step?'active':''}"></span>`).join('')}</div>
        <div class="htp-body">
          <h3>${step+1}. ${title}</h3>
          <p class="sub">${desc}</p>
        </div>
        <button class="btn btn-block btn-primary" onclick="${last?'closeHowToPlay()':'htpNext()'}">${last?'เริ่มเทรดเลย':'ถัดไป'}</button>
        ${last?`<a class="htp-faq-link" href="faq.html">ดูคำถามที่พบบ่อยทั้งหมด</a>`:''}
      </div>
    </div>`;
}
function openHowToPlay(){
  if(document.getElementById('howToPlayBackdrop')) return;
  htpStep = 0;
  document.body.insertAdjacentHTML('beforeend', howToPlayModalHtml(htpStep));
  document.addEventListener('keydown', howToPlayEscHandler);
}
function htpNext(){
  htpStep = Math.min(htpStep+1, HTP_STEPS.length-1);
  const el = document.getElementById('howToPlayBackdrop');
  if(el) el.outerHTML = howToPlayModalHtml(htpStep);
}
function closeHowToPlay(){
  const el = document.getElementById('howToPlayBackdrop');
  if(el) el.remove();
  document.removeEventListener('keydown', howToPlayEscHandler);
}
function howToPlayEscHandler(e){ if(e.key==='Escape') closeHowToPlay(); }

function toggleMenu(){
  const m = document.getElementById('accountMenu');
  if(!m) return;
  const willOpen = m.hidden;
  m.hidden = !willOpen;
  if(willOpen){
    setTimeout(()=>{
      document.addEventListener('click', function h(e){
        if(!m.contains(e.target) && !e.target.closest('.menu-wrap')){ m.hidden = true; document.removeEventListener('click', h); }
      });
    },0);
  }
}
function wireSearch(){
  const input = document.getElementById('searchInput');
  if(!input) return;
  input.addEventListener('input', ()=>{
    clearTimeout(wireSearch._t);
    wireSearch._t = setTimeout(()=>{ location.href = 'index.html'+(input.value?('?q='+encodeURIComponent(input.value)):''); }, 500);
  });
}
function toggleNotif(list){
  const panel = document.getElementById('notifPanel');
  if(!panel) return;
  if(!panel.hidden){ panel.hidden = true; return; }
  panel.innerHTML = `<div class="notif-panel-head"><b>การแจ้งเตือน</b><a class="sub" href="notifications.html">ดูทั้งหมด</a></div>` +
    (list||[]).slice(0,5).map(n=>`<div class="notif-item"><div class="notif-dot" style="background:${n.read?'var(--border-strong)':'var(--accent)'}"></div><div>${esc(n.text)}<div class="sub" style="margin-top:2px;">${n.time}</div></div></div>`).join('');
  panel.hidden = false;
  setTimeout(()=>{
    document.addEventListener('click', function h(e){
      if(!panel.contains(e.target) && !e.target.closest('.icon-btn')){ panel.hidden = true; document.removeEventListener('click', h); }
    });
  },0);
}

/* ---------- staff roles & permissions (demo-only) ----------
   Three staff tiers, lowest to highest rank: admin < superadmin < owner. This demo only
   ever has one real admin login (ADMIN_ACCOUNT, treated as the owner), so instead of
   building separate logins per role we add a "preview role" the owner can switch in the
   admin header — it changes what the console shows/allows, exactly as if a staff member
   of that tier were signed in, without needing a second password. Nothing here enforces
   security (it's all client-side localStorage) — it's purely so the demo can be reviewed
   and adjusted before any of this becomes a real backend permission system.
   Rank rules, as specified:
   - Owner: full access everywhere. Can promote/demote/ban/remove anyone except another
     owner (owner rows are treated as protected/immutable in this demo's staff page).
   - Superadmin: same day-to-day access as owner (markets, finance, full settings,
     customers), except it cannot act on an owner. It can manage Admin accounts, but not
     fellow superadmins (peers can't act on peers) — only Owner reaches "sideways/up".
   - Admin: customer management (including ban/suspend) and market creation/editing, but
     no resolving outcomes or featuring markets (those are "decisions for the market" and
     stay Superadmin+), no finance access at all, and only the low-risk settings cards
     (categories, footer links, hero ads) — not fees/referral %/min amounts/demo reset. */
const STAFF_ROLES = ['admin','superadmin','owner']; // ascending rank — index doubles as rank
const ROLE_LABELS_TH = { owner:'เจ้าของระบบ', superadmin:'ผู้ดูแลระดับสูง', admin:'ผู้ดูแลระบบ' };
function roleRank(role){ return STAFF_ROLES.indexOf(role); }
function roleAtLeast(role, min){ return roleRank(role) >= roleRank(min); }
function loadPreviewRole(){ return Store.get('adminPreviewRole', 'owner'); }
function savePreviewRole(r){ Store.set('adminPreviewRole', r); }
function setPreviewRole(r){ savePreviewRole(r); location.reload(); }
// Whether `actorRole` (the currently-previewed role) is allowed to change the role of, ban,
// or remove a staff row currently holding `targetRole`. Owner rows are never editable here.
function canActOnStaffRole(actorRole, targetRole){
  if(targetRole==='owner') return false;
  if(actorRole==='owner') return true;
  if(actorRole==='superadmin') return targetRole==='admin';
  return false;
}
// What roles `actorRole` is allowed to set a staff member to — used both for the role
// dropdown on an existing row (governed by canActOnStaffRole above) and for the "add staff"
// form. Only Owner can mint another owner or a superadmin; Superadmin can only add/keep
// people at the Admin tier.
function assignableRoles(actorRole){
  if(actorRole==='owner') return ['admin','superadmin','owner'];
  if(actorRole==='superadmin') return ['admin'];
  return [];
}
function canResolveMarkets(role){ return roleAtLeast(role, 'superadmin'); }
function canFeatureMarkets(role){ return roleAtLeast(role, 'superadmin'); }
function canAccessFinance(role){ return roleAtLeast(role, 'superadmin'); }
function canAccessFullSettings(role){ return roleAtLeast(role, 'superadmin'); }
function canAccessActivityLog(role){ return roleAtLeast(role, 'superadmin'); }
function canAccessStaffPage(role){ return roleAtLeast(role, 'superadmin'); }
// A small seeded staff roster so the "จัดการทีมงาน" page has something to manage in the
// demo — Kim's own admin login stands in for the owner row, the rest are fictional
// placeholders. Demo-persisted the same way as everything else (Store-backed).
function seedStaff(){
  return [
    { id:'st1', name:ADMIN_ACCOUNT.name, email:'kim@debatic.app', role:'owner', status:'active' },
    { id:'st2', name:'Nueng Superadmin', email:'nueng@debatic.app', role:'superadmin', status:'active' },
    { id:'st3', name:'Ploy Support', email:'ploy@debatic.app', role:'admin', status:'active' },
    { id:'st4', name:'Beam Support', email:'beam@debatic.app', role:'admin', status:'active' },
  ];
}
function loadStaff(){ const v = Store.get('staff', null); return v===null ? seedStaff() : v; }
function saveStaff(v){ Store.set('staff', v); }
// Shared "you can't be here" screen for an admin page a role isn't allowed to open —
// reached either via the nav (which already hides the link) or a stale/typed-in URL.
function adminAccessDeniedHtml(pageLabel){
  return emptyState('🔒','ไม่มีสิทธิ์เข้าถึงหน้านี้',
    `บทบาทปัจจุบัน “${ROLE_LABELS_TH[loadPreviewRole()]}” ไม่มีสิทธิ์เข้าถึง${pageLabel?'หน้า'+pageLabel:'หน้านี้'} — สลับมุมมองเป็นเจ้าของระบบหรือผู้ดูแลระดับสูงที่แถบด้านบนเพื่อดูหน้านี้`);
}
// Call right after rendering adminShell(). Returns true and does nothing further if the
// current preview role clears `minRole`; otherwise paints the access-denied screen into
// #view and returns false so the caller can skip its own draw()/data setup.
function guardAdminRole(minRole, pageLabel){
  if(roleAtLeast(loadPreviewRole(), minRole)) return true;
  document.getElementById('view').innerHTML = adminAccessDeniedHtml(pageLabel);
  return false;
}
/* ---------- shell chrome, admin side — a visually separate back-office product ---------- */
const ADMIN_NAV = [
  ['admin-dashboard.html','▤','หน้าหลัก','Home'],
  ['admin-players.html','☴','จัดการสมาชิก','Players'],
  ['admin-markets.html','◧','จัดการตลาด','Markets'],
  ['admin-transactions.html','$','จัดการการเงิน','Transactions','superadmin'],
  ['admin-settings.html','⚙','ตั้งค่าระบบ','Settings'],
  ['admin-staff.html','♛','จัดการทีมงาน','Staff','superadmin'],
  ['admin-activity.html','≡','ประวัติการดำเนินการ','Activity','superadmin'],
];
function adminShell(active, admin){
  const role = loadPreviewRole();
  const visibleNav = ADMIN_NAV.filter(n => !n[4] || roleAtLeast(role, n[4]));
  const current = ADMIN_NAV.find(n=>n[0]===active) || ADMIN_NAV[0];
  const links = visibleNav.map(n=>`<a class="nav-link ${active===n[0]?'active':''}" href="${n[0]}"><span class="ic">${n[1]}</span>${n[2]}</a>`).join('');
  const roleSwitcher = `
    <div class="icon-btn" style="border:1px solid var(--border-strong);width:auto;padding:0 10px;gap:6px;" title="ดูมุมมองตามบทบาท (สำหรับสาธิต — บัญชีจริงมีเพียงบัญชีเดียว)">
      <span style="font-size:13px;">👁</span>
      <select onchange="setPreviewRole(this.value)" style="border:none;background:transparent;font-family:inherit;font-size:12.5px;font-weight:600;color:var(--text);cursor:pointer;padding:0;">
        ${STAFF_ROLES.slice().reverse().map(r=>`<option value="${r}" ${role===r?'selected':''}>มุมมอง: ${ROLE_LABELS_TH[r]}</option>`).join('')}
      </select>
    </div>`;
  return `
  <div style="display:flex; min-height:100vh;">
    <aside class="sidebar-admin">
      <a class="brand" href="admin-dashboard.html" style="padding:6px 10px 22px;text-decoration:none;color:inherit;cursor:pointer;"><div class="mark">D</div><div class="name">Debatic</div></a>
      <div class="rail-label" style="padding-left:10px;">เมนูจัดการระบบ</div>
      ${links}
      <div class="nav-sep"></div>
      <a class="nav-link" href="index.html"><span class="ic">←</span>มุมมองผู้เล่น</a>
      <div class="sidebar-foot">เข้าสู่ระบบในนาม ${admin.name}<br>มุมมองปัจจุบัน: ${ROLE_LABELS_TH[role]}<br>ไม่มีเงินจริง ไม่มีเซิร์ฟเวอร์จริง</div>
    </aside>
    <div class="main-col">
      <header class="topnav-row" style="border-bottom:1px solid var(--border);">
        <div class="icon-btn" style="border:1px solid var(--border-strong);">☰</div>
        <div style="font-size:14px;"><b>${current[3]}</b> <span class="sub">|</span> <span class="sub">${current[2]}</span></div>
        <div class="topbar-spacer"></div>
        ${roleSwitcher}
        <button class="icon-btn" style="border:1px solid var(--border-strong);" onclick="toggleTheme()" title="สลับโหมดมืด/สว่าง"><span class="theme-toggle-icon">${loadTheme()==='dark'?'☀':'☾'}</span></button>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="avatar" style="background:${admin.avatarColor}">${admin.avatarLetter}</div>
          <button class="btn btn-ghost btn-sm" onclick="location.href='admin-login.html'">ออกจากระบบ</button>
        </div>
      </header>
      <main id="view" class="view"></main>
      <a href="admin-settings.html" class="btn btn-primary" style="position:fixed;bottom:24px;right:24px;width:46px;height:46px;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:var(--shadow);z-index:40;" title="ตั้งค่าระบบ">⚙</a>
    </div>
  </div>`;
}
