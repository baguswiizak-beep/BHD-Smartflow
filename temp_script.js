
// ═══════════════════════════════════════════════════════
// API CLIENT — BHD SmartFlow Backend
// ═══════════════════════════════════════════════════════
// Deteksi cerdas: Jika ada di server cloud (Vercel/Render), pakai origin sekarang. Jika di localhost/file, pakai port 3001.
const API_BASE = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:')
  ? 'http://127.0.0.1:3001' 
  : window.location.origin;

let _useAPI = false;
let loginMode = 'masuk', loginAvatarBase64 = '';
let currentAdmin = null, adminList = [], activeUsers = [];
let heartbeatTimer = null;

// --- APP GLOBAL STATE & DATA ---
const LOGIN_USERNAME = 'admin', LOGIN_PASSWORD = 'bhd2024';
let FLEET_COUNT=6, isDark=false, fabOpen=false;
let isEditMode=false, currentEditId=null;
let currentPeriod='today', currentBarFilter='6m', lapFilter='bulan-ini';
let txnFilterTipe='all', txnSearch='', txnSort='newest', txnPage=5;
let currentDetailUnit=null;
let donutChart=null, barChart=null, miniChart=null;

// --- DATABASE LOKAL (INITIAL DATA) ---
let fleetData = [
  {id:'f1',nopol:'B 1234 CD',driver:'Budi Santoso',status:'jalan',pajak:'2025-07-20',kir:'2025-07-18'},
  {id:'f2',nopol:'B 5678 EF',driver:'Andi Pratama',status:'jalan',pajak:'2025-09-15',kir:'2025-10-01'},
  {id:'f3',nopol:'B 9012 GH',driver:'Rudi Hartono',status:'bengkel',pajak:'2025-08-05',kir:'2025-08-10'},
  {id:'f4',nopol:'B 3456 IJ',driver:'Sari Dewi',status:'antre',pajak:'2025-07-22',kir:'2025-07-25'},
  {id:'f5',nopol:'B 7890 KL',driver:'Hendra Wijaya',status:'jalan',pajak:'2025-12-01',kir:'2025-11-15'},
  {id:'f6',nopol:'B 2345 MN',driver:'Teguh Purnomo',status:'jalan',pajak:'2025-10-10',kir:'2025-09-20'},
];
let driverList = ['Budi Santoso','Andi Pratama','Rudi Hartono','Sari Dewi','Hendra Wijaya','Teguh Purnomo','Agus Setiawan','Dian Kusuma'];
let transactions = [];
let sparepartStock = [];
let gudangKategori = ['Ban','Oli','Filter','Spare','Aki','Rem','Lampu','Mesin','Baut','Tool'];
let gudangFilter = 'all', gudangSearch = '', gudangSort = 'stok-low';

// --- CORE UTILS (TOP PRIORITY) ---

// --- CORE UTILS (TOP PRIORITY) ---
function compressImage(file, callback){
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = e => {
    const img = new Image();
    img.src = e.target.result;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 80;
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      callback(canvas.toDataURL('image/jpeg', 0.8));
    };
  };
}

function startHeartbeat(){
  if(heartbeatTimer) clearInterval(heartbeatTimer);
  sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, 30000);
}

async function sendHeartbeat(){
  if(!currentAdmin) return;
  try {
    await apiFetch('/api/auth/heartbeat', { 
      method:'POST', 
      body: { username: currentAdmin.name, avatar: currentAdmin.avatar } 
    });
    const users = await apiFetch('/api/auth/active-users');
    if(Array.isArray(users)) {
      activeUsers = users;
      renderActiveUsers();
    }
  } catch(e){}
}

function renderAdminProfile(){
  const el = document.getElementById('current-admin-profile');
  if(!el || !currentAdmin) return;
  el.style.display = 'block';
  const name = currentAdmin.name;
  const avatar = currentAdmin.avatar;
  const initials = name.substring(0,2).toUpperCase();
  el.innerHTML = `
    <div class="sb-user-profile">
      <div class="avatar-circle">
        ${avatar ? `<img src="${avatar}">` : initials}
      </div>
      <div class="sb-user-name">${name}</div>
    </div>
  `;
}

function renderActiveUsers(){
  const el = document.getElementById('online-admins-list');
  if(!el) return;
  const others = activeUsers.filter(u => u.name !== currentAdmin?.name);
  if(others.length === 0) {
    el.innerHTML = '<div style="font-size:10px;color:var(--text3);margin-left:5px;">Hanya Anda</div>';
    return;
  }
  el.innerHTML = others.map(u => {
    const initials = u.name.substring(0,2).toUpperCase();
    return `
      <div class="avatar-circle avatar-mini" title="${u.name} (Online)">
        ${u.avatar ? `<img src="${u.avatar}">` : initials}
      </div>
    `;
  }).join('');
}

// --- LOGIN LOGIC ---
function toggleLoginMode(m){
  loginMode = m;
  const tM = document.getElementById('tab-masuk');
  const tD = document.getElementById('tab-daftar');
  const regSec = document.getElementById('login-reg-section');
  const btn = document.getElementById('login-main-btn');
  const err = document.getElementById('login-err');
  if(err) err.textContent = '';
  
  if(m==='masuk'){
    tM?.classList.add('active'); tD?.classList.remove('active');
    if(regSec) regSec.style.display = 'none';
    if(btn) btn.textContent = 'Masuk ke Dashboard ⛏️';
  } else {
    tD?.classList.add('active'); tM?.classList.remove('active');
    if(regSec) regSec.style.display = 'block';
    if(btn) btn.textContent = 'Daftar & Masuk ⛏️';
  }
}

function previewLoginAvatar(input){
  if(input.files && input.files[0]){
    compressImage(input.files[0], base64 => {
      loginAvatarBase64 = base64;
      const prev = document.getElementById('login-avatar-preview');
      if(prev) prev.innerHTML = `<img src="${base64}">`;
    });
  }
}

async function doLogin(){
  const u=document.getElementById('login-user')?.value?.trim();
  const p=document.getElementById('login-pass')?.value;
  const errEl=document.getElementById('login-err');
  const btn=document.getElementById('login-main-btn');
  if(!u||!p){ if(errEl)errEl.textContent='Lengkapi nama dan password'; return; }
  
  if(btn){btn.textContent='Memproses...';btn.disabled=true;}
  let ok=false;
  const serverUp = await apiPing();

  if(serverUp){
    try{
      if(loginMode === 'daftar'){
        await apiFetch('/api/admins', { method:'POST', body: { name:u, avatar:loginAvatarBase64 } });
      }
      const res = await apiFetch('/api/auth/login',{method:'POST',body:{username:u,password:p}});
      ok = res;
    } catch(e){ 
      ok=false; 
      if(errEl) errEl.textContent = e.message || 'Gagal terhubung';
    }
  } else {
    ok = (u===LOGIN_USERNAME && p===LOGIN_PASSWORD) ? {ok:true, username:'admin', avatar:''} : false;
  }
  
  if(btn){btn.textContent = loginMode==='masuk'?'Masuk ke Dashboard ⛏️':'Daftar & Masuk ⛏️'; btn.disabled=false;}
  
  if(ok && ok.ok){
    const overlay=document.getElementById('login-overlay');
    const app=document.getElementById('app');
    if(overlay){overlay.style.opacity='0';overlay.style.transition='opacity .4s';setTimeout(()=>{overlay.style.display='none';},400);}
    if(app){app.style.display='flex';}
    
    currentAdmin = { name: ok.username, avatar: ok.avatar };
    if(serverUp) startHeartbeat();

    const badge=document.getElementById('api-status-badge');
    if(badge){badge.textContent=serverUp?'🟢 Online':'🟡 Offline';}
    setTimeout(()=>{_appInit();},100);
  } else {
    if(errEl && !errEl.textContent) errEl.textContent = 'Username atau password salah.';
    const passEl=document.getElementById('login-pass');if(passEl){passEl.value='';passEl.focus();}
  }
}

async function apiPing(){
  const syncIcons = [document.getElementById('sync-icon'), document.getElementById('sync-icon-sb')];
  syncIcons.forEach(ico => ico?.parentElement.classList.add('spinning'));
  
  try{
    const r = await fetch(API_BASE+'/api/ping',{signal:AbortSignal.timeout(3000)});
    _useAPI = r.ok;
  } catch(e){ 
    _useAPI = false; 
  }
  
  const badges = [document.getElementById('api-status-badge'), document.getElementById('api-status-badge-sb')];
  badges.forEach(badge => {
    if(badge){
      badge.style.display = 'inline-block';
      badge.textContent = _useAPI ? '🟢 Online' : '🟡 Offline';
      badge.style.background = _useAPI ? 'rgba(34,197,94,.1)' : 'rgba(234,179,8,.1)';
      badge.style.color = _useAPI ? '#22C55E' : '#EAB308';
    }
  });
  
  syncIcons.forEach(ico => ico?.parentElement.classList.remove('spinning'));
  return _useAPI;
}

async function syncAllData(isAuto = false){
  const syncBtn = document.getElementById('sync-icon-sb')?.parentElement;
  if(isAuto && !syncBtn) return; // Skip if no sidebar yet
  
  if(await apiPing()){
    try {
      const data = await apiFetch('/api/sync-all');
      
      // Update local memory
      transactions = data.transactions.map(t=>({...t, amount:Number(t.amount)}));
      fleetData.length = 0;
      data.fleet.forEach(f=>fleetData.push(f));
      FLEET_COUNT = fleetData.length;
      driverList = [...data.drivers];
      sparepartStock.length = 0;
      data.inventory.forEach(sp=>sparepartStock.push(sp));
      
      if(data.settings.gudang_kategori) gudangKategori = JSON.parse(data.settings.gudang_kategori);
      if(data.admins) adminList = data.admins;
      if(data.activeUsers) { activeUsers = data.activeUsers; renderActiveUsers(); }
      
      // Update UI
      renderDashboard();
      renderAdminProfile();
      renderAdminManagement();
      renderGudangFilterChips();
      renderGudang();
      applyTxnFilters();
      renderLaporanTable();
      renderFleetUnits();
      
      const now = new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
      const timeEl = document.getElementById('sync-time-sb');
      if(timeEl) {
        timeEl.textContent = 'Terakhir Sync: ' + now;
        timeEl.classList.add('sync-pulse');
        setTimeout(() => timeEl.classList.remove('sync-pulse'), 3000);
      }
      
      if(!isAuto) showToast('Data berhasil disinkronkan 🚀');
    } catch (e) {
      console.error('Sync-all failed:', e);
      if(!isAuto) showToast('⚠️ Sinkronisasi gagal');
    }
  } else {
    if(!isAuto) showToast('⚠️ Gagal terhubung ke server');
  }
}

// Start background sync every 15 seconds for real-time feel
let syncInterval = setInterval(() => syncAllData(true), 15000);

// Smart-Sync: Instant sync when user returns to app (more aggressive than just visibilitychange)
['visibilitychange', 'focus', 'pageshow', 'load'].forEach(evt => {
  window.addEventListener(evt, () => {
    if (document.visibilityState === 'visible') {
      console.log('Smart-Sync triggered via:', evt);
      syncAllData(true);
    }
  });
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    syncAllData(true);
  }
});
window.addEventListener('focus', () => syncAllData(true));

async function apiFetch(path, opts={}){
  const sep = path.includes('?') ? '&' : '?';
  const finalPath = opts.method ? path : path + sep + '_t=' + Date.now();
  const r = await fetch(API_BASE + finalPath, {
    headers: {'Content-Type':'application/json'},
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e.error||r.statusText); }
  return r.json();
}

// redundant state removed and moved to top


// functions removed and moved to top


function getAdminAvatar(name){
  const a = adminList.find(x => x.name === name);
  return a ? a.avatar : '';
}

// compressImage removed and moved to top


let tempAdminAvatar = '';
function previewAdminAvatar(input){
  if(input.files && input.files[0]){
    compressImage(input.files[0], base64 => {
      tempAdminAvatar = base64;
      document.getElementById('new-admin-avatar-preview').innerHTML = `<img src="${base64}">`;
    });
  }
}

async function addAdminProcess(){
  const name = document.getElementById('new-admin-name')?.value?.trim();
  if(!name) { showToast('Nama admin diperlukan'); return; }
  
  try {
    await apiFetch('/api/admins', { 
      method:'POST', 
      body: { name, avatar: tempAdminAvatar } 
    });
    showToast('Admin "'+name+'" ditambahkan');
    document.getElementById('new-admin-name').value = '';
    document.getElementById('new-admin-avatar-preview').innerHTML = '+';
    tempAdminAvatar = '';
    syncAllData(); // Refresh list
  } catch(e) { showToast('Gagal menambah admin'); }
}

async function deleteAdminProcess(name){
  if(name === currentAdmin?.name) { showToast('Tidak bisa menghapus diri sendiri'); return; }
  if(!confirm('Hapus akses admin "'+name+'"?')) return;
  try {
    await apiFetch('/api/admins/' + encodeURIComponent(name), { method:'DELETE' });
    showToast('Admin dihapus');
    syncAllData();
  } catch(e) { showToast('Gagal hapus admin'); }
}

function renderAdminManagement(){
  const el = document.getElementById('admin-mgmt-list');
  if(!el) return;
  if(adminList.length === 0) {
    el.innerHTML = '<div style="font-size:11px;color:var(--text3);text-align:center;padding:10px;">Belum ada admin terdaftar</div>';
    return;
  }
  el.innerHTML = adminList.map(a => {
    const initials = a.name.substring(0,2).toUpperCase();
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg2);border-radius:12px;margin-bottom:6px;border:1px solid var(--card-b);">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="avatar-circle avatar-mini">
            ${a.avatar ? `<img src="${a.avatar}">` : initials}
          </div>
          <div style="font-size:13px;font-weight:600;">${a.name}</div>
        </div>
        <button onclick="deleteAdminProcess('${a.name}')" style="background:none;border:none;color:var(--danger);cursor:pointer;padding:5px;">🗑️</button>
      </div>
    `;
  }).join('');
}

// redundant local data removed and moved to top


// Monthly data computed from real transactions (see renderBarChart)


// ════════════════════════════════════════════════════════
// GUDANG, WA, LAPORAN helpers (moved from dead script block)
// ════════════════════════════════════════════════════════
// ════════════════════════════════════
// SPAREPART STOCK (terpisah dari transactions)
// ════════════════════════════════════
// redundant gudang state removed and moved to top
let waDataReady=false,waTextCache='';


// ════════════════════════════════════
// GUDANG HELPERS
// ════════════════════════════════════
function spStatus(sp){
  const pct=sp.stokSisa/sp.stokAwal;
  return pct>0.5?'fresh':pct>0.2?'warn':'critical';
}
function spStatusLabel(sp){
  const s=spStatus(sp);
  const map={fresh:'<span class="sp-status-badge fresh">Stok Aman</span>',
             warn:'<span class="sp-status-badge warn">Menipis</span>',
             critical:'<span class="sp-status-badge critical">Kritis</span>'};
  return map[s];
}
const spCatIconDefault={Ban:'🎡',Oli:'🛢️',Filter:'🌫️',Spare:'🔧',Aki:'🔋',Accu:'🔋',Rem:'🛑',Lampu:'💡',Mesin:'⚙️',Baut:'🔩',Tool:'🛠️'};
function getSpCatIcon(kat){
  if(!kat) return '📦';
  const k=kat.toLowerCase();
  if(k.includes('ban')) return '🎡';
  if(k.includes('oli')) return '🛢️';
  if(k.includes('aki')||k.includes('accu')) return '🔋';
  if(k.includes('filter')) return '🌫️';
  if(k.includes('lampu')) return '💡';
  if(k.includes('rem')) return '🛑';
  if(k.includes('mesin')) return '⚙️';
  if(k.includes('baut')) return '🔩';
  if(k.includes('kunci')||k.includes('tool')) return '🛠️';
  if(k.includes('spare')) return '🔧';
  return spCatIconDefault[kat]||'📦';
}

function setGudangFilter(f,btn){
  gudangFilter=f;
  document.querySelectorAll('#page-gudang .fs-chip').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderGudang();
}


// ════════════════════════════════════
// KATEGORI GUDANG - Dynamic Management
// ════════════════════════════════════
function getKategoriOpts(selectedKat=''){
  return gudangKategori.map(k=>`<option value="${k}"${k===selectedKat?' selected':''}>${getSpCatIcon(k)} ${k}</option>`).join('');
}

function _renderKatList(){
  const el=document.getElementById('kat-list');
  if(!el)return;
  const canDel=gudangKategori.length>1;
  el.innerHTML=gudangKategori.map(k=>{
    const delBtn=canDel
      ?`<button onclick="deleteKategori('${k}')" style="background:rgba(224,48,48,.1);color:var(--danger);border:none;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',-apple-system,sans-serif;">Hapus</button>`
      :'<span style="font-size:10px;color:var(--text3);">Min 1</span>';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:var(--bg3);border-radius:10px;margin-bottom:6px;">
      <span style="font-size:13px;font-weight:600;">${getSpCatIcon(k)} ${k}</span>
      ${delBtn}
    </div>`;
  }).join('');
}

function openGudangFilterPopup(){
  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('sm-body');
  tEl.textContent='Filter Berdasarkan Kategori';
  const cats = ['all', ...gudangKategori];
  body.innerHTML = `<div class="kat-filter-grid">
    ${cats.map(k => `
      <div class="kfg-item ${gudangFilter===k?'active':''}" onclick="setGudangFilterPop('${k}')">
        <span class="kfg-ico">${k==='all'?'📋':getSpCatIcon(k)}</span>
        <span class="kfg-lbl">${k==='all'?'Semua':k}</span>
      </div>
    `).join('')}
  </div>`;
  document.getElementById('sm-overlay').classList.add('open');
  vibrate(15);
}

function setGudangFilterPop(k){
  gudangFilter = k;
  renderGudangFilterChips(); // Keep chips in sync
  renderGudang();
  closeSm();
  vibrate(20);
}

function updateSliderDots() {
  const slider = document.getElementById('chart-slider');
  if(!slider) return;
  const dots = document.querySelectorAll('.slider-dot');
  const index = Math.round(slider.scrollLeft / slider.offsetWidth);
  dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
}

function openKategoriModal(){
  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('sm-body');
  tEl.textContent='Kelola Kategori Onderdil';
  body.innerHTML=`
    <div id="kat-list"></div>
    <div style="margin-top:10px;">
      <label class="form-label">Nama Kategori Baru</label>
      <div style="display:flex;gap:8px;">
        <input class="form-input" id="kat-new-name" placeholder="Contoh: Aki, Lampu..." style="flex:1;"/>
        <button onclick="addKategori()" style="padding:9px 14px;border-radius:11px;border:none;background:var(--green-bg);color:var(--green2);font-weight:700;font-size:12px;cursor:pointer;font-family:'Inter',-apple-system,sans-serif;white-space:nowrap;">+ Tambah</button>
      </div>
    </div>
    <div style="font-size:10.5px;color:var(--text3);margin-top:8px;padding:8px 10px;background:var(--bg3);border-radius:9px;">💡 Kategori yang dihapus tidak menghapus item yang sudah ada.</div>`;
  _renderKatList();
  document.getElementById('sm-overlay').classList.add('open');
}

function addKategori(){
  const input=document.getElementById('kat-new-name');
  const nama=(input?.value||'').trim();
  if(!nama){showToast('Nama kategori tidak boleh kosong');return;}
  if(gudangKategori.includes(nama)){showToast('Kategori sudah ada');return;}
  gudangKategori.push(nama);
  input.value='';
  // Re-render list in modal
  const listEl=document.getElementById('kat-list');
  if(listEl){
    listEl.innerHTML=gudangKategori.map(k=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:var(--bg3);border-radius:10px;margin-bottom:6px;">
        <span style="font-size:13px;font-weight:600;">${getSpCatIcon(k)} ${k}</span>
        ${gudangKategori.length>1?`<button onclick="deleteKategori('${k}')" style="background:rgba(224,48,48,.1);color:var(--danger);border:none;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',-apple-system,sans-serif;">Hapus</button>`:'<span style="font-size:10px;color:var(--text3);">Min 1</span>'}
      </div>`).join('');
  }
  renderGudangFilterChips();
  showToast('Kategori "'+nama+'" ditambahkan');vibrate(20);
}

function deleteKategori(nama){
  const inUse=sparepartStock.some(s=>s.kategori===nama);
  if(inUse){showToast('Kategori masih dipakai '+sparepartStock.filter(s=>s.kategori===nama).length+' item');return;}
  gudangKategori=gudangKategori.filter(k=>k!==nama);
  // Re-render list
  const listEl=document.getElementById('kat-list');
  if(listEl){
    listEl.innerHTML=gudangKategori.map(k=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:var(--bg3);border-radius:10px;margin-bottom:6px;">
        <span style="font-size:13px;font-weight:600;">${getSpCatIcon(k)} ${k}</span>
        ${gudangKategori.length>1?`<button onclick="deleteKategori('${k}')" style="background:rgba(224,48,48,.1);color:var(--danger);border:none;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',-apple-system,sans-serif;">Hapus</button>`:'<span style="font-size:10px;color:var(--text3);">Min 1</span>'}
      </div>`).join('');
  }
  renderGudangFilterChips();
  showToast('Kategori "'+nama+'" dihapus');vibrate(30);
}

function renderGudangFilterChips(){
  const el=document.getElementById('gudang-filter-chips');
  if(!el)return;
  let html=`<div class="fs-chip active" onclick="setGudangFilter('all',this)">Semua</div>`;
  gudangKategori.forEach(k=>{
    html+=`<div class="fs-chip" onclick="setGudangFilter('${k}',this)">${getSpCatIcon(k)} ${k}</div>`;
  });
  html+=`<div class="fs-chip" onclick="openKategoriModal()" style="background:var(--orange-bg);color:var(--orange);border-color:var(--orange-bd);">⚙️ Kelola</div>`;
  el.innerHTML=html;
}

function renderGudang(){
  const el=document.getElementById('sp-grid');if(!el)return;
  const list=gudangFilter==='all'?sparepartStock:sparepartStock.filter(s=>s.kategori===gudangFilter);
  const tot=sparepartStock.length;
  const inst=sparepartStock.filter(s=>s.installed.length>0).length;
  const crit=sparepartStock.filter(s=>spStatus(s)==='critical').length;
  const nilaiTotal=sparepartStock.reduce((s,sp)=>s+sp.stokSisa*sp.hargaSatuan,0);
  const ids=['gh-total','gh-installed','gh-critical'];
  [tot,inst,crit].forEach((v,i)=>{const e=document.getElementById(ids[i]);if(e)e.textContent=v;});
  const nilaiEl=document.getElementById('gh-nilai');if(nilaiEl)nilaiEl.textContent=fmt(nilaiTotal);
  ['sb-gudang-badge','bn-gudang-badge'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display=crit>0?'':'none';});
  el.innerHTML=list.length===0?'<div style="text-align:center;padding:32px;color:var(--text3);font-size:13px;">Tidak ada item untuk kategori ini</div>':list.map(sp=>{
    const st=spStatus(sp);
    const ico=getSpCatIcon(sp.kategori)||'📦';
    const pct=Math.round(sp.stokSisa/sp.stokAwal*100);
    const nilaiSisa=sp.stokSisa*sp.hargaSatuan;
    const instList=sp.installed.map(i=>{
      const f=fleetData.find(x=>x.nopol===i.armada);
      const freeze=f&&f.status==='bengkel';
      return '<div style="font-size:10px;color:var(--text3);display:flex;align-items:center;gap:5px;margin-top:3px;">'
        +'<span>🚛</span><span style="font-weight:600;">'+i.armada+'</span>'
        +(f?'<span style="color:var(--text3);">'+f.driver+'</span>':'')
        +(freeze?'<span class="ritase-freeze">❄ FREEZE</span>':'<span class="ritase-freeze" style="color:'+getRitaseStatusColor(i.ritase,sp.kategori)+';background:rgba(0,0,0,.05);">'+i.ritase+' / '+getRitaseThreshold(sp.kategori)+' ritase'+(i.ritase>=getRitaseThreshold(sp.kategori)?' ⚠️':'')+'</span>')
        +'</div>';
    }).join('');
    return '<div class="sp-card '+st+'">'
      +'<div class="sp-header"><div class="sp-icon-wrap '+st+'">'+ico+'</div>'+spStatusLabel(sp)+'</div>'
      +'<div class="sp-name">'+sp.nama+'</div>'
      +'<div class="sp-spec">🏷️ '+sp.spek+' · 🏪 '+sp.toko+'</div>'
      +(instList?'<div style="margin-bottom:8px;">'+instList+'</div>':'')
      +'<div class="sp-meta-grid">'
      +'<div class="sp-meta-item"><div class="sp-meta-label">📦 Sisa/Total</div><div class="sp-meta-val" style="color:'+(st==='fresh'?'var(--success)':st==='warn'?'var(--warning)':'var(--danger)')+';">'+sp.stokSisa+' / '+sp.stokAwal+'</div></div>'
      +'<div class="sp-meta-item"><div class="sp-meta-label">💰 Harga/unit</div><div class="sp-meta-val">'+fmt(sp.hargaSatuan)+'</div></div>'
      +'<div class="sp-meta-item"><div class="sp-meta-label">💵 Nilai Sisa</div><div class="sp-meta-val" style="color:var(--info);">'+fmt(nilaiSisa)+'</div></div>'
      +'<div class="sp-meta-item"><div class="sp-meta-label">📅 Tgl Masuk</div><div class="sp-meta-val">'+fmtDate(sp.tglMasuk)+'</div></div>'
      +'</div>'
      +'<div class="sp-progress-wrap">'
      +'<div class="sp-progress-label"><span>Sisa Stok</span><span>'+pct+'%</span></div>'
      +'<div class="sp-progress-bar"><div class="sp-progress-fill '+st+'" style="width:'+pct+'%"></div></div>'
      +'</div>'
      +(sp.catatan?'<div style="font-size:10px;color:var(--text3);background:var(--bg3);border-radius:8px;padding:6px 9px;margin-top:8px;">📝 '+sp.catatan+'</div>':'')
      +'<div class="sp-actions">'
      +(sp.stokSisa>0?'<div class="sp-act pasang" onclick="openPasangModal(\''+sp.id+'\')">🚛 Pasang</div>':'<div class="sp-act" style="opacity:.4;cursor:not-allowed;">🚫 Habis</div>')
      +'<div class="sp-act edit" onclick="openAddStockModal(\''+sp.id+'\')">✏️ Edit</div>'
      +'<div class="sp-act del" onclick="deleteSparepart(\''+sp.id+'\')">🗑️</div>'
      +'</div>'
      +'</div>';
  }).join('');
}

function openAddStockModal(editId){
  const sp=editId?sparepartStock.find(s=>s.id===editId):null;
  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('sm-body');
  tEl.textContent=sp?'Edit Item Stok':'Tambah Stok Baru';
  body.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;">'
    +'<div style="grid-column:1/-1;"><label class="form-label">📦 Nama Barang</label><input class="form-input" id="sp-nama" value="'+(sp?sp.nama:'')+'" placeholder="Nama onderdil..."/></div>'
    +'<div style="grid-column:1/-1;"><label class="form-label">🏷️ Spek / Tipe</label><input class="form-input" id="sp-spek" value="'+(sp?sp.spek:'')+'" placeholder="Ukuran, kode, merk..."/></div>'
    +'<div><label class="form-label">Kategori</label><select class="form-select" id="sp-kat">'
    +gudangKategori.map(k=>'<option value="'+k+'"'+(sp&&sp.kategori===k?' selected':'')+'>'+getSpCatIcon(k)+' '+k+'</option>').join('')
    +'</select></div>'
    +'<div><label class="form-label">🏪 Toko</label><input class="form-input" id="sp-toko" value="'+(sp?sp.toko:'')+'" placeholder="Nama toko..."/></div>'
    +'<div><label class="form-label">No. Nota</label><input class="form-input" id="sp-nota" value="'+(sp?sp.nota:'')+'" placeholder="SP-001"/></div>'
    +'<div><label class="form-label">📅 Tgl Masuk</label><input type="date" class="form-input" id="sp-tgl" value="'+(sp?sp.tglMasuk:today())+'"/></div>'
    +'<div><label class="form-label">Jumlah</label><input class="form-input" id="sp-jml" type="number" value="'+(sp?sp.stokAwal:'')+'" placeholder="Qty"/></div>'
    +'<div><label class="form-label">Harga/unit (Rp)</label><input class="form-input" id="sp-harga" value="'+(sp?new Intl.NumberFormat('id-ID').format(sp.hargaSatuan):'')+'" placeholder="0" inputmode="numeric"/></div>'
    +'</div>'
    +'<div style="font-size:10.5px;color:var(--text3);background:var(--bg3);border-radius:10px;padding:9px 11px;line-height:1.6;">💡 Stok masuk tanpa potong kas — sistem tempo.</div>'
    +'<button class="sm-btn orange" onclick="saveSparepart(\''+(editId||'')+'\')">'+(sp?'Simpan':'Tambah Stok')+'</button>'
    +(sp?'<button class="sm-btn danger" onclick="deleteSparepart(\''+sp.id+'\');closeSm()">Hapus Item</button>':'');
  setupCurrencyInput('sp-harga');
  document.getElementById('sm-overlay').classList.add('open');
}

function saveSparepart(editId){
  const nama=document.getElementById('sp-nama')?.value?.trim();
  const spek=document.getElementById('sp-spek')?.value?.trim();
  const kat=document.getElementById('sp-kat')?.value||'Spare';
  const toko=document.getElementById('sp-toko')?.value?.trim()||'';
  const nota=document.getElementById('sp-nota')?.value?.trim()||'';
  const tgl=document.getElementById('sp-tgl')?.value||today();
  // Parse jumlah: strip non-digits first then parseInt, fallback 0
  const jmlRaw=document.getElementById('sp-jml')?.value||'';
  const jml=parseInt(jmlRaw.toString().replace(/\D/g,''))||0;
  // Parse harga: use getRaw which already strips formatting
  const harga=getRaw('sp-harga')||0;
  if(!nama){showToast('Nama barang tidak boleh kosong');return;}
  if(!spek){showToast('Spek/tipe tidak boleh kosong');return;}
  if(jml<=0){showToast('Jumlah harus lebih dari 0');return;}
  if(editId){
    const sp=sparepartStock.find(s=>s.id===editId);
    if(sp){
      sp.nama=nama;sp.spek=spek;sp.kategori=kat;sp.toko=toko;
      sp.nota=nota;sp.tglMasuk=tgl;
      sp.stokAwal=jml;
      sp.stokSisa=Math.min(isNaN(sp.stokSisa)?jml:sp.stokSisa,jml);
      sp.hargaSatuan=isNaN(harga)?0:harga;
      if(_useAPI) apiFetch('/api/inventory/'+sp.id,{method:'PUT',body:sp}).catch(e=>console.warn(e));
    }
  } else {
    const spNew = {
      id:'sp'+Date.now(),nama,spek,kategori:kat,toko,nota,
      tglMasuk:tgl,stokAwal:jml,stokSisa:jml,
      hargaSatuan:isNaN(harga)?0:harga,
      installed:[],catatan:''
    };
    sparepartStock.push(spNew);
    if(_useAPI) apiFetch('/api/inventory',{method:'POST',body:spNew}).catch(e=>console.warn(e));
  }
  closeSm();renderGudang();showToast(editId?'Item diperbarui':'Stok ditambahkan');vibrate(30);
}

function deleteSparepart(id){
  const i=sparepartStock.findIndex(s=>s.id===id);if(i>-1)sparepartStock.splice(i,1);
  if(_useAPI) apiFetch('/api/inventory/'+id,{method:'DELETE'}).catch(e=>console.warn(e));
  renderGudang();showToast('Item dihapus');vibrate(40);
}

function openPasangModal(spId){
  const sp=sparepartStock.find(s=>s.id===spId);if(!sp)return;
  if(sp.stokSisa<=0){showToast('Stok habis!');return;}
  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('sm-body');
  tEl.textContent='Pasang ke Armada';
  const opts=fleetData.map(f=>'<option value="'+f.nopol+'">'+f.nopol+' - '+f.driver+'</option>').join('');
  body.innerHTML='<div style="background:var(--bg3);border-radius:11px;padding:10px 12px;margin-bottom:4px;">'
    +'<div style="font-size:13px;font-weight:700;color:var(--text);">'+sp.nama+'</div>'
    +'<div style="font-size:11px;color:var(--text3);">🏷️ '+sp.spek+' · Sisa: <b>'+sp.stokSisa+'</b></div>'
    +'</div>'
    +'<div><label class="form-label">Pilih Armada</label><select class="form-select" id="pasang-armada">'+opts+'</select></div>'
    +'<div><label class="form-label">Tanggal Pasang</label><input type="date" class="form-input" id="pasang-tgl" value="'+today()+'"/></div>'
    +'<div><label class="form-label">Jumlah Dipasang</label><input class="form-input" id="pasang-jml" type="number" value="1" min="1" max="'+sp.stokSisa+'"/></div>'
    +'<div style="font-size:10.5px;color:var(--text3);background:var(--orange-bg);border:1px solid var(--orange-bd);border-radius:10px;padding:9px 11px;">Pasang = potong stok + buat outflow Onderdil + tracking ritase.</div>'
    +'<button class="sm-btn orange" onclick="confirmPasang(\''+spId+'\')">Konfirmasi Pasang</button>';
  document.getElementById('sm-overlay').classList.add('open');
}

function confirmPasang(spId){
  const sp=sparepartStock.find(s=>s.id===spId);if(!sp)return;
  const armada=document.getElementById('pasang-armada')?.value;
  const tgl=document.getElementById('pasang-tgl')?.value;
  const jml=parseInt(document.getElementById('pasang-jml')?.value||'1');
  if(jml<1){showToast('Jumlah minimal 1');return;}
  if(jml>sp.stokSisa){showToast('Jumlah melebihi stok (sisa: '+sp.stokSisa+')');return;}
  const driver=fleetData.find(f=>f.nopol===armada)?.driver||'';
  sp.stokSisa-=jml;
  // Track each unit as separate installed entry
  for(let i=0;i<jml;i++){
    sp.installed.push({armada,tglPasang:tgl,ritase:0,txnId:Date.now()+i});
  }
  const newTxn = {
    id:'txn_'+Date.now(),type:'outflow',
    label:sp.nama+' ('+sp.spek+') — '+jml+' unit',
    sub:'No.Nota: '+sp.nota+' · '+sp.toko+' · '+driver,
    amount:sp.hargaSatuan*jml,date:tgl,
    armada,nota:sp.nota,toko:sp.toko,
    kategori:'Onderdil',driver,status:'lunas',sparepartId:spId,
    author: currentAdmin ? currentAdmin.name : 'Admin'
  };
  transactions.unshift(newTxn);
  if(_useAPI){
    apiFetch('/api/inventory/'+spId,{method:'PUT',body:sp}).catch(e=>console.warn(e));
    apiFetch('/api/transactions',{method:'POST',body:newTxn}).catch(e=>console.warn(e));
  }
  closeSm();renderGudang();renderDashboard();applyTxnFilters();renderLaporanTable();
  showToast(sp.nama+' ('+jml+' unit) dipasang ke '+armada);vibrate([30,50,30]);
}

// Ritase thresholds per kategori
const RITASE_THRESHOLDS={Ban:100,Oli:50,Filter:80,Spare:60};
function getRitaseThreshold(kategori){
  return RITASE_THRESHOLDS[kategori]||50;
}

// Dipanggil saat submitInflow — hitung ritase berdasarkan trip baru
// Tidak hitung jika armada sedang bengkel (status SEBELUM update)
function incrementRitaseForArmada(nopol, statusSebelum){
  // Jika armada sedang bengkel sebelum trip ini, skip
  if(statusSebelum==='bengkel') return;
  const warnings=[];
  sparepartStock.forEach(sp=>{
    sp.installed.forEach(i=>{
      if(i.armada!==nopol) return;
      i.ritase++;
      const threshold=getRitaseThreshold(sp.kategori);
      if(i.ritase===threshold||(i.ritase>threshold&&(i.ritase-threshold)%10===0)){
        warnings.push(sp.nama+': '+i.ritase+'/'+threshold+' ritase ⚠️');
      }
    });
  });
  if(warnings.length){
    setTimeout(()=>warnings.forEach(w=>showToast('🔧 '+w)),900);
  }
}

function getRitaseStatusColor(ritase,kategori){
  const t=getRitaseThreshold(kategori);
  if(ritase>=t) return 'var(--danger)';
  if(ritase>=t*0.8) return 'var(--warning)';
  return 'var(--success)';
}

function getActivePartsForArmada(nopol){
  const parts=[];
  sparepartStock.forEach(sp=>sp.installed.filter(i=>i.armada===nopol).forEach(i=>{
    const f=fleetData.find(x=>x.nopol===nopol);
    const freeze=f&&f.status==='bengkel';
    const daysSince=Math.ceil((new Date()-new Date(i.tglPasang))/86400000);
    parts.push({nama:sp.nama,spek:sp.spek,tglPasang:i.tglPasang,ritase:i.ritase,freeze,daysSince,kategori:sp.kategori});
  }));
  return parts;
}

// ════════════════════════════════════
// WA SUMMARY with Refresh
// ════════════════════════════════════


function buildWAText(){
  const now=new Date();
  const todayStr=today();
  const todayTxn=transactions.filter(t=>t.date===todayStr);
  const inf=totalInflow(todayTxn),out=totalOutflow(todayTxn),net=inf-out;
  const bulanIni=transactions.filter(t=>{const d=new Date(t.date+'T00:00:00');return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
  const bInf=totalInflow(bulanIni),bOut=totalOutflow(bulanIni),bNet=bInf-bOut;
  const cnt={jalan:0,antre:0,bengkel:0};
  fleetData.forEach(f=>cnt[f.status]=(cnt[f.status]||0)+1);
  const SEP='━'.repeat(22);
  // Per-armada summary for today
  const armadaTodayLines=fleetData.map(f=>{
    const fInf=todayTxn.filter(t=>t.type==='inflow'&&t.armada===f.nopol).reduce((s,t)=>s+t.amount,0);
    if(fInf===0) return null;
    return '  🚛 '+f.nopol+' ('+f.driver+'): +'+fmtFull(fInf);
  }).filter(Boolean);
  // Outflow today
  const outTodayLines=todayTxn.filter(t=>t.type==='outflow').map(t=>'  💸 '+t.label+' ['+t.kategori+']: -'+fmtFull(t.amount));
  const docW=fleetData.filter(f=>daysUntil(f.pajak)<=30||daysUntil(f.kir)<=30);
  const docTxt=docW.length?docW.map(f=>{
    const p=daysUntil(f.pajak),k=daysUntil(f.kir);
    let w='';if(p<=30)w+='Pajak '+f.nopol+' '+p+'h ';if(k<=30)w+='KIR '+f.nopol+' '+k+'h';
    return '  ⚠️ '+w.trim();
  }).join('\n'):'  ✅ Semua dokumen aman';
  const kritis=sparepartStock.filter(s=>spStatus(s)==='critical');
  const kritTxt=kritis.length?kritis.map(s=>'  ⚠️ '+s.nama+' - Sisa '+s.stokSisa+' unit').join('\n'):'  ✅ Stok dalam kondisi aman';
  const tglStr=now.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const lines=[
    '🚚 *LAPORAN BHD SmartFlow*',
    '📅 '+tglStr,SEP,
    '*📊 RINGKASAN HARI INI*',
    '  💰 Inflow  : '+fmtFull(inf),
    '  💸 Outflow : '+fmtFull(out),
    '  📈 Nett    : '+(net>=0?'✅ ':' ')+'*'+fmtFull(net)+'*',
  ];
  if(armadaTodayLines.length){lines.push('');lines.push('*Status Armada Hari Ini:*');}
  lines.push(SEP);
  lines.push('*🚛 STATUS ARMADA ('+fleetData.length+' unit)*');
  lines.push('  🟢 Jalan   : '+cnt.jalan+' unit');
  lines.push('  🟡 Antre   : '+cnt.antre+' unit');
  lines.push('  🔴 Bengkel : '+cnt.bengkel+' unit');
  lines.push(SEP);
  lines.push('*📅 KAS BULAN INI*');
  lines.push('  💰 Inflow  : '+fmtFull(bInf));
  lines.push('  💸 Outflow : '+fmtFull(bOut));
  lines.push('  📈 Nett    : '+(bNet>=0?'✅ ':' ')+'*'+fmtFull(bNet)+'*');
  lines.push(SEP);
  lines.push('*📋 URGENCY DOKUMEN*');lines.push(docTxt);
  lines.push(SEP);
  lines.push('*📦 STOK KRITIS*');lines.push(kritTxt);
  lines.push(SEP);
  lines.push('_BHD SmartFlow System - PT. Bagus Harya Dwiprima_');
  return lines.join('\n');
}

function refreshWAData(){
  const btn=document.querySelector('.wa-refresh-btn');
  const lbl=document.getElementById('wa-refresh-label');
  if(btn)btn.classList.add('spinning');
  if(lbl)lbl.textContent='Memperbarui...';
  vibrate(20);
  setTimeout(()=>{
    renderDashboard();renderLaporanTable();renderGudang();
    _buildAndShowWAPreview();
    if(btn)btn.classList.remove('spinning');
    if(lbl)lbl.textContent='Refresh Data';
    showToast('Data berhasil diperbarui');vibrate(30);
  },500);
}

function _buildAndShowWAPreview(){
  const now=new Date();
  waDataReady=true;
  waTextCache=buildWAText();
  const upEl=document.getElementById('wa-last-update');
  if(upEl){upEl.textContent='Update '+now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});upEl.classList.add('fresh');}
  const sendBtn=document.getElementById('wa-send-btn');
  if(sendBtn)sendBtn.disabled=false;
  const wp=document.getElementById('wa-preview');
  if(wp){wp.style.display='block';wp.textContent=waTextCache;}
  const cb=document.getElementById('wa-copy-btn');
  if(cb)cb.style.display='flex';
}

function sendWASummary(){
  try{
    waTextCache=buildWAText();
    if(!waTextCache){showToast('Tidak ada data untuk dikirim');return;}
    const url='https://api.whatsapp.com/send?text='+encodeURIComponent(waTextCache);
    window.open(url,'_blank');
    showToast('WhatsApp dibuka');vibrate(30);
  }catch(e){
    console.error('WA error:',e);
    showToast('Gagal membuka WhatsApp: '+e.message);
  }
}

function openWASummary(){sendWASummary();}

function copyWAText(){
  waTextCache=buildWAText();
  if(navigator.clipboard){
    navigator.clipboard.writeText(waTextCache).then(()=>showToast('Teks disalin!')).catch(()=>fallbackCopy());
  } else fallbackCopy();
}
function fallbackCopy(){
  const ta=document.createElement('textarea');ta.value=waTextCache;
  document.body.appendChild(ta);ta.select();document.execCommand('copy');
  document.body.removeChild(ta);showToast('Teks disalin!');
}

// ════════════════════════════════════
// LAPORAN: Per-Armada Table
// ════════════════════════════════════
function renderArmadaTable(txns){
  const tbody=document.getElementById('armada-tbody');
  const tfoot=document.getElementById('armada-tfoot');
  const periodEl=document.getElementById('lap-armada-period');
  if(!tbody||!tfoot)return;
  if(fleetData.length===0){
    tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3);">Belum ada armada terdaftar</td></tr>';
    tfoot.innerHTML='';return;
  }
  if(periodEl)periodEl.textContent=lapFilter==='bulan-ini'?'Bulan Ini':lapFilter==='bulan-lalu'?'Bulan Lalu':'Custom';
  const umum=txns.filter(t=>t.type==='outflow'&&t.kategori==='UMUM').reduce((s,t)=>s+t.amount,0);
  const bebanUmumPerUnit=FLEET_COUNT>0?umum/FLEET_COUNT:0;
  let totInf=0,totTunai=0,totOnderdil=0,totNet=0;
  tbody.innerHTML=fleetData.map(f=>{
    const fInf=txns.filter(t=>t.type==='inflow'&&t.armada===f.nopol).reduce((s,t)=>s+t.amount,0);
    const fTunai=txns.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&t.kategori==='Tunai').reduce((s,t)=>s+t.amount,0);
    const fOnderdil=txns.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&t.kategori==='Onderdil').reduce((s,t)=>s+t.amount,0);
    const fTotalOut=fTunai+fOnderdil+bebanUmumPerUnit;
    const fNet=fInf-fTotalOut;
    totInf+=fInf;totTunai+=fTunai;totOnderdil+=fOnderdil;totNet+=fNet;
    const maxInf=Math.max(...fleetData.map(x=>txns.filter(t=>t.type==='inflow'&&t.armada===x.nopol).reduce((s,t)=>s+t.amount,0)),1);
    const barPct=Math.round(fInf/maxInf*100);
    return '<tr>'
      +'<td><div class="ar-nopol">'+f.nopol+'</div><div class="ar-driver">'+f.driver+'</div>'
      +'<span class="ar-badge '+f.status+'">'+f.status.charAt(0).toUpperCase()+f.status.slice(1)+'</span></td>'
      +'<td><div class="ar-num pos">'+fmt(fInf)+'</div><div class="ar-bar"><div class="ar-bar-fill" style="width:'+barPct+'%;background:var(--success)"></div></div></td>'
      +'<td class="ar-num '+(fTunai>0?'neg':'zero')+'">'+fmt(fTunai)+'</td>'
      +'<td class="ar-num '+(fOnderdil>0?'neg':'zero')+'">'+fmt(fOnderdil)+'</td>'
      +'<td class="ar-num neg">'+fmt(bebanUmumPerUnit)+'</td>'
      +'<td class="ar-num neg">'+fmt(fTotalOut)+'</td>'
      +'<td class="ar-num '+(fNet>=0?'net-pos':'net-neg')+'">'+fmt(fNet)+'</td>'
      +'</tr>';
  }).join('');
  // UMUM row
  const umRow='<tr style="background:var(--bg3);">'
    +'<td><div class="ar-nopol" style="color:var(--text3);">UMUM / Bersama</div><div class="ar-driver">Dibagi '+FLEET_COUNT+' unit</div></td>'
    +'<td class="ar-num zero">-</td>'
    +'<td class="ar-num zero">-</td>'
    +'<td class="ar-num zero">-</td>'
    +'<td class="ar-num neg">'+fmt(umum)+'</td>'
    +'<td class="ar-num neg">'+fmt(umum)+'</td>'
    +'<td class="ar-num zero">-</td>'
    +'</tr>';
  tbody.innerHTML+=umRow;
  const totTotalOut=totTunai+totOnderdil+umum;
  tfoot.innerHTML='<tr>'
    +'<td style="font-weight:800;color:var(--text);">TOTAL PERIODE</td>'
    +'<td style="text-align:right;color:var(--success);font-weight:800;">'+fmt(totInf)+'</td>'
    +'<td style="text-align:right;color:var(--danger);font-weight:800;">'+fmt(totTunai)+'</td>'
    +'<td style="text-align:right;color:var(--danger);font-weight:800;">'+fmt(totOnderdil)+'</td>'
    +'<td style="text-align:right;color:var(--danger);font-weight:800;">'+fmt(umum)+'</td>'
    +'<td style="text-align:right;color:var(--danger);font-weight:800;">'+fmt(totTotalOut)+'</td>'
    +'<td style="text-align:right;color:var(--info);font-weight:800;">'+fmt(totNet)+'</td>'
    +'</tr>';
}


// ════════════════════════════════════
// GRAFIK: custom date chart
// ════════════════════════════════════
function renderCustomChart(){
  const fr=document.getElementById('chart-from')?.value;
  const to=document.getElementById('chart-to')?.value;
  if(!fr||!to){showToast('Pilih rentang tanggal');return;}
  renderBarChart(fr,to);
}
function resetChartFilter(){
  const fr=document.getElementById('chart-from');const to=document.getElementById('chart-to');
  if(fr)fr.value='';if(to)to.value='';renderBarChart(null,null);
}






function buildOutflowSpOpts(){
  return sparepartStock.map(sp=>'<option value="'+sp.id+'">['+sp.kategori+'] '+sp.nama+' - Sisa: '+sp.stokSisa+'</option>').join('');
}
function syncOutflowFromSparepart(){
  // Now handled by onGudangItemSelect()
  onGudangItemSelect();
}

// ════════════════════════════════════════════════════════
// END HELPERS
// ════════════════════════════════════════════════════════
// ═══════════════════════════════ UTILS ═══════════════════════════
function fmt(n){if(!n&&n!==0)return '—';const a=Math.abs(n);if(a>=1e9)return'Rp '+(n/1e9).toFixed(1)+'M';if(a>=1e6)return'Rp '+(n/1e6).toFixed(1)+'Jt';if(a>=1e3)return'Rp '+(n/1e3).toFixed(0)+'Rb';return'Rp '+n;}
function fmtFull(n){return'Rp '+new Intl.NumberFormat('id-ID').format(Math.round(n));}
function fmtDate(d){if(!d)return'—';return new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});}
function daysUntil(d){if(!d)return 9999;return Math.ceil((new Date(d)-new Date())/(86400000));}
function _ds(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function today(){return _ds(new Date());}

function animNum(el,target,dur=700){
  if(!el)return;let st=null;
  const step=ts=>{if(!st)st=ts;const p=Math.min((ts-st)/dur,1);const e=1-Math.pow(1-p,3);el.textContent=fmt(Math.round(e*target));if(p<1)requestAnimationFrame(step);};
  requestAnimationFrame(step);
}
function vibrate(ms=30){if(navigator.vibrate)navigator.vibrate(ms);}

// Currency formatter
function setupCurrencyInput(id){
  const el=document.getElementById(id);if(!el)return;
  el.addEventListener('input',function(){let r=this.value.replace(/\D/g,'');this.value=r?new Intl.NumberFormat('id-ID').format(parseInt(r)):''});
}
function getRaw(id){const el=document.getElementById(id);if(!el)return 0;return parseInt(el.value.replace(/\D/g,'')||'0');}
function getArmadaOpts(){return fleetData.map(f=>`<option value="${f.nopol}">${f.nopol}</option>`).join('');}
function getDriverOpts(sel=''){return[...new Set([...driverList,...fleetData.map(f=>f.driver)])].map(d=>`<option value="${d}"${d===sel?' selected':''}>${d}</option>`).join('');}

// ═══════════════════════════════ CLOCK ═══════════════════════════
function updateClocks(){
  const now=new Date();
  const hms=now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const ds=now.toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  ['sb-clock','tb-clock','hero-clock'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=hms;});
  const hd=document.getElementById('hero-date');if(hd)hd.textContent=ds;
  const sd=document.getElementById('sb-date');if(sd)sd.textContent=ds;
}
setInterval(updateClocks,1000);updateClocks();

// ═══════════════════════════════ PERIOD FILTER ═══════════════════
function setPeriod(p,btn){
  currentPeriod=p;
  document.querySelectorAll('.period-chip').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderDashboard();
}
function filterByPeriod(list){
  const now=new Date();
  const todayStr=today();
  return list.filter(t=>{
    const ds=t.date;
    const d=new Date(t.date+'T00:00:00');
    if(currentPeriod==='today') return ds===todayStr;
    if(currentPeriod==='week'){const s=new Date(now);s.setDate(s.getDate()-6);s.setHours(0,0,0,0);return d>=s;}
    if(currentPeriod==='month') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    if(currentPeriod==='last_month'){const lm=new Date(now.getFullYear(),now.getMonth()-1,1);return d.getMonth()===lm.getMonth()&&d.getFullYear()===lm.getFullYear();}
    return true;
  });
}

// ═══════════════════════════════ COMPUTED ════════════════════════
function totalInflow(list){return list.filter(t=>t.type==='inflow').reduce((s,t)=>s+t.amount,0);}
function totalOutflow(list){return list.filter(t=>t.type==='outflow').reduce((s,t)=>s+t.amount,0);}

// ═══════════════════════════════ DOC WARN ════════════════════════
function checkDocWarnings(){
  const w=fleetData.some(f=>daysUntil(f.pajak)<=7||daysUntil(f.kir)<=7);
  ['sb-armada-badge','bn-armada-badge'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display=w?'':'none';});
}

// ═══════════════════════════════ SKELETON ════════════════════════
function showSkeleton(){
  const sv=document.getElementById('skeleton-view');
  const rc=document.getElementById('real-content');
  if(sv)sv.classList.add('show');
  if(rc)rc.classList.add('hidden');
  setTimeout(()=>{
    if(sv)sv.classList.remove('show');
    if(rc)rc.classList.remove('hidden');
  },600);
}

// ═══════════════════════════════ PERIOD COMPARISON ═══════════════
function getPrevPeriodTxns(){
  const now=new Date();
  return transactions.filter(t=>{
    const d=new Date(t.date+'T00:00:00');
    if(currentPeriod==='today'){const y=new Date(now);y.setDate(y.getDate()-1);return t.date===_ds(y);}
    if(currentPeriod==='week'){const s=new Date(now);s.setDate(s.getDate()-13);const e=new Date(now);e.setDate(e.getDate()-7);s.setHours(0,0,0,0);e.setHours(23,59,59,999);return d>=s&&d<=e;}
    if(currentPeriod==='month'){const pm=new Date(now.getFullYear(),now.getMonth()-1,1);return d.getMonth()===pm.getMonth()&&d.getFullYear()===pm.getFullYear();}
    if(currentPeriod==='last_month'){const pm=new Date(now.getFullYear(),now.getMonth()-2,1);return d.getMonth()===pm.getMonth()&&d.getFullYear()===pm.getFullYear();}
    return false;
  });
}
// ═══════════════════════════════ RENDER DASHBOARD ════════════════
function renderDashboard(){
  const filtered=filterByPeriod(transactions);
  const inf=totalInflow(filtered),out=totalOutflow(filtered),prf=inf-out;
  const margin=inf>0?((prf/inf)*100).toFixed(1):0;
  const perUnit=Math.round(out/FLEET_COUNT);
  // Real comparison vs previous period
  const _prev=getPrevPeriodTxns();const _pi=totalInflow(_prev),_po=totalOutflow(_prev),_pp=_pi-_po;
  const _pct=(c,p)=>p!==0?((c-p)/Math.abs(p)*100).toFixed(0)+'%':c>0?'baru':'—';
  const cmpIn=_pct(inf,_pi),cmpOut=_pct(out,_po),cmpPrf=_pct(prf,_pp);

  setTimeout(()=>{
    ['h-in','kc-in','k-in'].forEach(id=>{const e=document.getElementById(id);if(e)animNum(e,inf);});
    ['h-out','kc-out','k-out'].forEach(id=>{const e=document.getElementById(id);if(e)animNum(e,out);});
    ['h-prf','kc-prf','k-prf'].forEach(id=>{const e=document.getElementById(id);if(e)animNum(e,prf);});
    const pu=document.getElementById('kc-per-unit');if(pu)pu.textContent=fmt(perUnit);
    const km=document.getElementById('kc-margin');if(km)km.textContent=margin+'%';
    // donut legend
    const dIn=document.getElementById('dl-in');if(dIn)dIn.textContent=fmt(inf);
    const dOut=document.getElementById('dl-out');if(dOut)dOut.textContent=fmt(out);
    const total=inf+out||1;
    const dip=document.getElementById('dl-in-pct');if(dip)dip.textContent=(inf/total*100).toFixed(0)+'%';
    const dop=document.getElementById('dl-out-pct');if(dop)dop.textContent=(out/total*100).toFixed(0)+'%';
    // comparison badges
    const ci=document.getElementById('cmp-in');if(ci){const _u=inf>=_pi;ci.textContent=(_u?'↑':'↓')+' '+cmpIn;ci.className='cmp-badge '+(_u?'up':'dn');}
    const co=document.getElementById('cmp-out');if(co){const _u=out>_po;co.textContent=(_u?'↑':'↓')+' '+cmpOut;co.className='cmp-badge '+(_u?'dn':'up');}
    const cp=document.getElementById('cmp-prf');if(cp){const _u=prf>=_pp;cp.textContent=(_u?'↑':'↓')+' '+cmpPrf;cp.className='cmp-badge '+(_u?'up':'dn');}
  },120);

  // fleet counts
  const counts={jalan:0,bengkel:0,antre:0};
  fleetData.forEach(f=>counts[f.status]=(counts[f.status]||0)+1);
  ['jalan','bengkel','antre'].forEach(s=>{
    ['fs-'+s,'al-'+s].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=counts[s]||0;});
  });
  const tc=document.getElementById('fleet-total-chip');if(tc)tc.textContent=FLEET_COUNT+' Unit';
  const ac=document.getElementById('armada-count-chip');if(ac)ac.textContent=FLEET_COUNT+' Unit';

  renderFleetRows('fleet-rows-dash',4);
  renderTxnCards('txn-dash',filtered.slice(0,4),false);
  applyTxnFilters();
  renderDonut(inf,out);
  renderMiniLine();
  renderBarChart(currentBarFilter);
  renderFleetUnits();
  renderLaporanTable();
  checkDocWarnings();
}

// ═══════════════════════════════ FLEET ROWS ══════════════════════
const sIcoFn=(s)=>{
  const icons={
    jalan:`<svg viewBox="0 0 24 24" width="11" height="11" style="vertical-align:middle;fill:none;stroke:var(--success);stroke-width:2;stroke-linecap:round;margin-right:2px"><path d="M1 3h15v11H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="17.5" r="2.5"/><circle cx="18.5" cy="17.5" r="2.5"/></svg>`,
    bengkel:`<svg viewBox="0 0 24 24" width="11" height="11" style="vertical-align:middle;fill:none;stroke:var(--orange);stroke-width:2;stroke-linecap:round;margin-right:2px"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
    antre:`<svg viewBox="0 0 24 24" width="11" height="11" style="vertical-align:middle;fill:none;stroke:#FAB400;stroke-width:2;stroke-linecap:round;margin-right:2px"><path d="M5 3h14M5 21h14M12 3v2M12 19v2"/><ellipse cx="12" cy="8" rx="4" ry="2.5"/><ellipse cx="12" cy="16" rx="4" ry="2.5"/></svg>`
  };
  return icons[s]||'';
};

function renderFleetRows(cId,max){
  const el=document.getElementById(cId);if(!el)return;
  el.innerHTML=fleetData.slice(0,max).map(f=>`
    <div class="fleet-row" onclick="openUnitDetail('${f.id}')">
      <span class="fb ${f.status}"></span>
      <span class="f-nopol">${f.nopol}</span>
      <span class="f-drv">${f.driver}</span>
      ${f.status==='antre'
        ?'<span class="antre-pulse"><span class="ap-dot"></span>Antre</span>'
        :`<span class="f-status ${f.status}">${sIcoFn(f.status)} ${f.status.charAt(0).toUpperCase()+f.status.slice(1)}</span>`}
    </div>`).join('');
}

// ═══════════════════════════════ TXN CARDS ═══════════════════════
function statusBadge(s){
  if(s==='lunas')return'<span class="txn-badge tb-lunas">✓ Lunas</span>';
  if(s==='proses')return'<span class="txn-badge tb-proses">⟳ Proses</span>';
  return'<span class="txn-badge tb-pending">⏳ Pending</span>';
}
const svgIn='<svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';
const svgOut='<svg viewBox="0 0 24 24"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>';

function renderTxnCards(elId,list,showActions=true){
  const el=document.getElementById(elId);if(!el)return;
  if(!list.length){el.innerHTML='<div style="text-align:center;padding:30px;color:var(--text3);font-size:12.5px;">Tidak ada transaksi ditemukan</div>';return;}
  el.innerHTML=list.map(t=>`
    <div class="txn-item" id="txn-${t.id}">
      <div class="txn-main" style="padding-bottom:12px;">
        <div class="txn-ico ${t.type==='inflow'?'in':'out'}" onclick="toggleTxn('${t.id}')">${t.type==='inflow'?svgIn:svgOut}</div>
        <div class="txn-body" onclick="toggleTxn('${t.id}')">
          <div class="txn-name">${t.label}</div>
          <div class="txn-meta">${t.sub || '—'} · ${fmtDate(t.date)}</div>
        </div>
        <div class="txn-right">
          <div class="txn-amt ${t.type==='inflow'?'in':'out'}">${t.type==='inflow'?'+':'-'}${fmt(t.amount)}</div>
          ${showActions?`
            <div class="txn-actions-inline">
              <button class="txn-act-btn-sm edit" onclick="editTxn('${t.id}')" title="Revisi"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button class="txn-act-btn-sm del" onclick="deleteTxn('${t.id}')" title="Hapus"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
            </div>
          `:statusBadge(t.status||'lunas')}
        </div>
      </div>
      <div class="txn-detail">
        <div class="txn-detail-grid" style="margin-top:0;border-top:1px solid var(--card-b);padding-top:10px;">
          <div class="tdg-item"><div class="tdg-label">Tanggal</div><div class="tdg-val">${fmtDate(t.date)}</div></div>
          <div class="tdg-item"><div class="tdg-label">Armada</div><div class="tdg-val">${t.armada||'—'}</div></div>
          ${t.driver?`<div class="tdg-item"><div class="tdg-label">Supir</div><div class="tdg-val">${t.driver}</div></div>`:''}
          ${t.muat?`<div class="tdg-item"><div class="tdg-label">Rute</div><div class="tdg-val" style="font-size:10px;">${t.muat} → ${t.bongkar}</div></div>`:''}
          ${t.nota&&t.nota!=='—'?`<div class="tdg-item"><div class="tdg-label">No. Nota</div><div class="tdg-val">${t.nota}</div></div>`:''}
        </div>
      </div>
    </div>`).join('');
}

function toggleTxn(id){
  const el=document.getElementById('txn-'+id);if(el)el.classList.toggle('expanded');
  vibrate(15);
}
function deleteTxn(id){
  const t = transactions.find(x => x.id == id);
  if(!t) return;

  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('modal-body'); // Reuse sm modal for beauty
  
  // Show beautiful confirmation modal
  const smOverlay = document.getElementById('sm-overlay');
  const smTitle = document.getElementById('sm-title-text');
  const smBody = document.getElementById('sm-body');
  
  smTitle.innerHTML = `<span style="color:var(--danger)">⚠️ Konfirmasi Hapus</span>`;
  smBody.innerHTML = `
    <div style="text-align:center;padding:10px 0;">
      <div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text);">Hapus transaksi ini?</div>
      <div style="font-size:11.5px;color:var(--text3);line-height:1.5;">
        ${t.label} - ${fmt(t.amount)}<br>
        ${t.sparepartId ? '<b style="color:var(--green2)">Catatan: Stok gudang akan otomatis dikembalikan (+1).</b>' : 'Tindakan ini tidak dapat dibatalkan.'}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
      <button class="sm-btn" onclick="closeSm()" style="background:var(--bg3);color:var(--text2);">Batal</button>
      <button class="sm-btn danger" onclick="executeDelete('${id}')" style="background:var(--danger);color:#fff;box-shadow:0 4px 12px rgba(224,48,48,0.25);">Ya, Hapus</button>
    </div>
  `;
  smOverlay.classList.add('open');
  vibrate(20);
}

function executeDelete(id) {
  const t = transactions.find(x => x.id == id);
  if(!t) { closeSm(); return; }

  // 1. Restore Inventory Stock if applicable
  if(t.sparepartId) {
    const sp = sparepartStock.find(s => s.id === t.sparepartId);
    if(sp) {
      sp.stokSisa++;
      // Remove the specific installation record if found
      sp.installed = sp.installed.filter(ins => ins.txnId !== id && ins.tglPasang !== t.date); 
      // Sync inventory change
      if(_useAPI) apiFetch('/api/inventory/'+sp.id, { method: 'PUT', body: sp }).catch(E => console.warn(E));
      showToast('Stok '+sp.nama+' dikembalikan');
    }
  }

  // 2. Remove Transaction
  transactions = transactions.filter(x => x.id !== id);
  if(_useAPI) apiFetch('/api/transactions/'+id, { method: 'DELETE' }).catch(e => console.warn(e));
  
  closeSm();
  renderDashboard(); applyTxnFilters(); renderGudang(); renderLaporanTable();
  showToast('Transaksi Berhasil Dihapus');
  vibrate(40);
}
function editTxn(id){
  const t = transactions.find(x => x.id == id);
  if(!t) return;
  
  isEditMode = true;
  currentEditId = id;
  
  if(t.type === 'inflow') {
    openModal('inflow');
    setTimeout(() => {
      const modalTitle = document.getElementById('mt-text');
      if(modalTitle) modalTitle.textContent = 'Revisi Inflow (Setoran)';
      
      const btn = document.querySelector('.form-btn.inflow');
      if(btn) btn.textContent = 'Simpan Perubahan';
      
      const armada = document.getElementById('inf-armada');
      const driver = document.getElementById('inf-driver');
      const amount = document.getElementById('inf-amount');
      const muat = document.getElementById('inf-muat');
      const bongkar = document.getElementById('inf-bongkar');
      const date = document.getElementById('inf-date');
      const antreRow = document.querySelector('#inf-antre')?.closest('.form-group');
      
      if(armada) armada.value = t.armada || '';
      if(driver) driver.value = t.driver || '';
      if(amount) amount.value = new Intl.NumberFormat('id-ID').format(t.amount);
      if(muat) muat.value = t.muat || '';
      if(bongkar) bongkar.value = t.bongkar || '';
      if(date) date.value = t.date;
      if(antreRow) antreRow.style.display = 'none'; // Sembunyikan status armada saat revisi
      
      setupCurrencyInput('inf-amount');
    }, 150);
  } else {
    openModal('outflow');
    setTimeout(() => {
      const modalTitle = document.getElementById('mt-text');
      if(modalTitle) modalTitle.textContent = 'Revisi Outflow (Pengeluaran)';
      
      const btn = document.querySelector('.form-btn.outflow');
      if(btn) btn.textContent = 'Simpan Perubahan';
      
      const cat = document.getElementById('out-cat');
      const label = document.getElementById('out-label');
      const amount = document.getElementById('out-amount');
      const date = document.getElementById('out-date');
      const toko = document.getElementById('out-toko');
      const nota = document.getElementById('out-nota');
      const armada = document.getElementById('out-armada');
      const driver = document.getElementById('out-driver');
      
      if(cat) { 
        cat.value = t.kategori || 'Kas'; 
        onOutCatChange();
      }
      if(label) label.value = t.label || '';
      if(amount) amount.value = new Intl.NumberFormat('id-ID').format(t.amount);
      if(date) date.value = t.date;
      if(toko) toko.value = t.toko || '';
      if(nota) nota.value = t.nota || '';
      if(armada) armada.value = t.armada || '';
      if(driver) driver.value = t.driver || '';
      
      setupCurrencyInput('out-amount');
    }, 150);
  }
}

// ═══════════════════════════════ FILTER & SEARCH ═════════════════
let txnFilterGroup='all';
function setTxnFilter(key,val,btn){
  if(key==='tipe'){txnFilterTipe=val;document.querySelectorAll('.fs-chip').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');}
  txnPage=5;applyTxnFilters();
}
function applyTxnFilters(){
  txnSearch=document.getElementById('txn-search')?.value?.toLowerCase()||'';
  txnSort=document.getElementById('txn-sort')?.value||'newest';
  let list=[...transactions];
  if(txnFilterTipe!=='all')list=list.filter(t=>t.type===txnFilterTipe);
  if(txnSearch)list=list.filter(t=>t.label.toLowerCase().includes(txnSearch)||t.sub.toLowerCase().includes(txnSearch)||(t.armada||'').toLowerCase().includes(txnSearch)||(t.driver||'').toLowerCase().includes(txnSearch));
  if(txnSort==='oldest')list.sort((a,b)=>new Date(a.date)-new Date(b.date));
  else if(txnSort==='biggest')list.sort((a,b)=>b.amount-a.amount);
  else if(txnSort==='smallest')list.sort((a,b)=>a.amount-b.amount);
  else list.sort((a,b)=>b.id-a.id);
  renderTxnCards('txn-full',list.slice(0,txnPage),true);
  const lm=document.getElementById('load-more-btn');
  if(lm)lm.style.display=list.length>txnPage?'block':'none';
}
function loadMoreTxn(){txnPage+=5;applyTxnFilters();}

// ═══════════════════════════════ CHARTS ══════════════════════════
function renderDonut(inf,out){
  if(typeof Chart==='undefined')return;
  const ctx=document.getElementById('donutChart');if(!ctx)return;
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  if(donutChart)donutChart.destroy();
  donutChart=new Chart(ctx,{type:'doughnut',data:{datasets:[{data:[inf||1,out||1],backgroundColor:[dark?'rgba(10,168,96,.7)':'rgba(10,168,96,.85)',dark?'rgba(224,48,48,.65)':'rgba(224,48,48,.8)'],borderColor:[dark?'rgba(10,168,96,.4)':'rgba(10,168,96,.3)',dark?'rgba(224,48,48,.4)':'rgba(224,48,48,.3)'],borderWidth:2,hoverOffset:4}]},
  options:{cutout:'72%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>fmtFull(c.raw)},backgroundColor:dark?'rgba(22,30,46,.95)':'rgba(255,255,255,.95)',titleColor:dark?'#DDE6F5':'#0B1220',bodyColor:dark?'#7DCE13':'#12A060',borderColor:'rgba(125,206,19,.2)',borderWidth:1,padding:9,cornerRadius:9}},animation:{animateRotate:true,duration:800}}});
}

function setBarFilter(f,btn){
  currentBarFilter=f;
  document.querySelectorAll('.cf-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderBarChart(f);
}

// Build real monthly data from transactions array
function buildMonthlyData(numMonths){
  if(typeof Chart==='undefined')return;
  const now=new Date();
  const labels=[],inflowData=[],outflowData=[];
  for(let i=numMonths-1;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const yr=d.getFullYear(),mo=d.getMonth();
    labels.push(d.toLocaleDateString('id-ID',{month:'short'}));
    const monthTxns=transactions.filter(t=>{
      const td=new Date(t.date+'T00:00:00');
      return td.getFullYear()===yr&&td.getMonth()===mo;
    });
    inflowData.push(totalInflow(monthTxns));
    outflowData.push(totalOutflow(monthTxns));
  }
  return{labels,inflow:inflowData,outflow:outflowData};
}

function renderBarChart(f){
  if(typeof Chart==='undefined')return;
  const ctx=document.getElementById('barChart');if(!ctx)return;
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  const gc=dark?'rgba(255,255,255,.04)':'rgba(0,0,0,.03)';
  const tc=dark?'#3A4D64':'#8494AA';
  const numMonths=f==='12m'?12:6;
  const d=buildMonthlyData(numMonths);
  if(barChart)barChart.destroy();
  barChart=new Chart(ctx,{type:'bar',data:{labels:d.labels,datasets:[
    {label:'Inflow',data:d.inflow,backgroundColor:dark?'rgba(10,168,96,.55)':'rgba(10,168,96,.72)',borderRadius:5,borderSkipped:false},
    {label:'Outflow',data:d.outflow,backgroundColor:dark?'rgba(224,48,48,.5)':'rgba(224,48,48,.65)',borderRadius:5,borderSkipped:false}
  ]},options:{responsive:true,plugins:{legend:{display:true,labels:{font:{family:'DM Sans',size:10},color:tc,boxWidth:10,boxHeight:10}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+fmtFull(c.raw)},backgroundColor:dark?'rgba(16,22,36,.97)':'rgba(255,255,255,.97)',titleColor:dark?'#DDE6F5':'#0B1220',bodyColor:dark?'#7DCE13':'#12A060',borderColor:'rgba(125,206,19,.2)',borderWidth:1,padding:9,cornerRadius:9}},
  scales:{x:{grid:{display:false},ticks:{font:{family:'DM Sans',size:10},color:tc}},y:{grid:{color:gc,drawBorder:false},ticks:{font:{family:'DM Sans',size:10},color:tc,callback:v=>{const abs=Math.abs(v);if(abs>=1e9)return(v/1e9).toFixed(1)+'M';if(abs>=1e6)return(v/1e6).toFixed(1)+'Jt';if(abs>=1e3)return(v/1e3).toFixed(0)+'Rb';return v;}}}},barPercentage:0.65,categoryPercentage:0.7}});
}

// ═══════════════════════════════ CASH FLOW TREND ═════════════════
let currentTrendFilter='7d',trendCustomFrom=null,trendCustomTo=null;

function setTrendFilter(f,btn){
  currentTrendFilter=f;
  // Hanya ubah tombol di dalam #trend-filter-btns agar tidak bentrok dengan bar chart
  const trendBtns=document.getElementById('trend-filter-btns');
  if(trendBtns)trendBtns.querySelectorAll('.cf-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  const cr=document.getElementById('trend-custom-range');
  if(cr)cr.style.display=f==='custom'?'flex':'none';
  if(f!=='custom') renderMiniLine();
}

function applyTrendCustom(){
  const fr=document.getElementById('trend-from')?.value;
  const to=document.getElementById('trend-to')?.value;
  if(!fr||!to){showToast('Pilih rentang tanggal terlebih dahulu');return;}
  if(fr>to){showToast('Tanggal awal harus sebelum tanggal akhir');return;}
  trendCustomFrom=fr;trendCustomTo=to;
  renderMiniLine();
}

function renderMiniLine(){
  if(typeof Chart==='undefined')return;
  const ctx=document.getElementById('miniLineChart');if(!ctx)return;
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  const gc=dark?'rgba(255,255,255,.05)':'rgba(0,0,0,.04)';
  const tc=dark?'#3A4D64':'#8494AA';
  const labels=[],profits=[],inflowArr=[],outflowArr=[];

  if(currentTrendFilter==='custom'){
    // Mode custom: build per-day dari trendCustomFrom ke trendCustomTo
    if(!trendCustomFrom||!trendCustomTo){
      // Belum ada range, render kosong saja
      _buildMiniLineChart(ctx,dark,gc,tc,[],[],[],[]);return;
    }
    const start=new Date(trendCustomFrom+'T00:00:00');
    const end=new Date(trendCustomTo+'T00:00:00');
    const totalDays=Math.round((end-start)/86400000)+1;
    const limitDays=Math.min(totalDays,60);
    for(let i=0;i<limitDays;i++){
      const d=new Date(start.getTime());d.setDate(start.getDate()+i);
      const ds=_ds(d);
      labels.push(d.toLocaleDateString('id-ID',{day:'numeric',month:'short'}));
      const dayTxns=transactions.filter(t=>t.date===ds);
      const inf=totalInflow(dayTxns),out=totalOutflow(dayTxns);
      inflowArr.push(inf);outflowArr.push(out);profits.push(inf-out);
    }
  } else {
    // Mode 7d / 30d: N hari terakhir dari hari ini
    const days=currentTrendFilter==='30d'?30:7;
    for(let i=days-1;i>=0;i--){
      const d=new Date();d.setDate(d.getDate()-i);d.setHours(0,0,0,0);
      const ds=_ds(d);
      const fmt7=days<=7
        ?d.toLocaleDateString('id-ID',{weekday:'short',day:'numeric'})
        :d.toLocaleDateString('id-ID',{day:'numeric',month:'short'});
      labels.push(fmt7);
      const dayTxns=transactions.filter(t=>t.date===ds);
      const inf=totalInflow(dayTxns),out=totalOutflow(dayTxns);
      inflowArr.push(inf);outflowArr.push(out);profits.push(inf-out);
    }
  }
  _buildMiniLineChart(ctx,dark,gc,tc,labels,profits,inflowArr,outflowArr);
}

function _buildMiniLineChart(ctx,dark,gc,tc,labels,profits,inflowArr,outflowArr){
  if(miniChart){miniChart.destroy();miniChart=null;}
  const hasAnyData=profits.some(v=>v!==0)||inflowArr.some(v=>v!==0);
  const maxTicks=labels.length>14?Math.ceil(labels.length/6):labels.length;
  miniChart=new Chart(ctx,{
    type:'line',
    data:{labels,datasets:[
      {
        label:'Net Profit',
        data:profits,
        borderColor:'#7DCE13',
        backgroundColor:(ctx2)=>{
          const c=ctx2.chart.ctx;
          const g=c.createLinearGradient(0,0,0,ctx2.chart.height);
          g.addColorStop(0,'rgba(125,206,19,.18)');g.addColorStop(1,'rgba(125,206,19,.01)');return g;
        },
        borderWidth:2.5,
        pointBackgroundColor:profits.map(v=>v>=0?'#7DCE13':'#E03030'),
        pointBorderColor:dark?'#131921':'#fff',
        pointBorderWidth:2,
        pointRadius:hasAnyData?(labels.length>20?0:3):0,
        pointHoverRadius:5,
        tension:0.4,
        fill:true,
        order:1
      },
      {
        label:'Inflow',
        data:inflowArr,
        borderColor:'rgba(10,168,96,.8)',
        backgroundColor:'transparent',
        borderWidth:1.5,
        borderDash:[5,4],
        pointRadius:0,
        pointHoverRadius:4,
        tension:0.4,
        fill:false,
        order:2
      },
      {
        label:'Outflow',
        data:outflowArr,
        borderColor:'rgba(224,48,48,.75)',
        backgroundColor:'transparent',
        borderWidth:1.5,
        borderDash:[5,4],
        pointRadius:0,
        pointHoverRadius:4,
        tension:0.4,
        fill:false,
        order:3
      }
    ]},
    options:{
      responsive:true,
      maintainAspectRatio:true,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{
          display:true,
          labels:{font:{family:'DM Sans',size:9},color:tc,boxWidth:8,boxHeight:8,padding:8}
        },
        tooltip:{
          callbacks:{
            title:items=>items[0].label,
            label:c=>' '+c.dataset.label+': '+fmtFull(c.raw)
          },
          backgroundColor:dark?'rgba(16,22,36,.97)':'rgba(255,255,255,.97)',
          titleColor:dark?'#DDE6F5':'#0B1220',
          bodyColor:dark?'#A8F040':'#12A060',
          borderColor:'rgba(125,206,19,.25)',
          borderWidth:1,padding:9,cornerRadius:9,
          titleFont:{family:'DM Sans',size:10,weight:'700'},
          bodyFont:{family:'DM Mono',size:10}
        }
      },
      scales:{
        x:{
          grid:{display:false},
          ticks:{font:{family:'DM Sans',size:9},color:tc,maxRotation:0,maxTicksLimit:maxTicks,autoSkip:true}
        },
        y:{
          grid:{color:gc,drawBorder:false},
          ticks:{font:{family:'DM Mono',size:9},color:tc,
            callback:v=>{
              const abs=Math.abs(v);
              if(abs>=1e9)return(v/1e9).toFixed(1)+'M';
              if(abs>=1e6)return(v/1e6).toFixed(1)+'Jt';
              if(abs>=1e3)return(v/1e3).toFixed(0)+'Rb';
              return v===0?'0':v;
            }
          }
        }
      }
    }
  });
}

// ═══════════════════════════════ ARMADA PERF CHART ═══════════════
let armadaPerfChart=null;
function renderArmadaPerfChart(txns){
  if(typeof Chart==='undefined')return;
  const ctx=document.getElementById('armadaPerfChart');if(!ctx)return;
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  const tc=dark?'#3A4D64':'#8494AA';
  const gc=dark?'rgba(255,255,255,.04)':'rgba(0,0,0,.03)';
  const umum=txns.filter(t=>t.type==='outflow'&&t.kategori==='UMUM').reduce((s,t)=>s+t.amount,0);
  const bebanPerUnit=FLEET_COUNT>0?umum/FLEET_COUNT:0;
  const periodEl=document.getElementById('lap-armada-period');
  if(periodEl)periodEl.textContent=lapFilter==='bulan-ini'?'Bulan Ini':lapFilter==='bulan-lalu'?'Bulan Lalu':'Custom';

  const labels=[],netData=[],ritaseData=[];
  fleetData.forEach(f=>{
    const inflow=txns.filter(t=>t.type==='inflow'&&t.armada===f.nopol).reduce((s,t)=>s+t.amount,0);
    const outTunai=txns.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&t.kategori==='Tunai').reduce((s,t)=>s+t.amount,0);
    const outOnderdil=txns.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&t.kategori==='Onderdil').reduce((s,t)=>s+t.amount,0);
    const nett=inflow-(outTunai+outOnderdil+bebanPerUnit);
    const ritase=txns.filter(t=>t.type==='inflow'&&t.armada===f.nopol).length;
    labels.push(f.nopol);netData.push(nett);ritaseData.push(ritase);
  });
  if(armadaPerfChart)armadaPerfChart.destroy();
  armadaPerfChart=new Chart(ctx,{type:'bar',data:{labels,datasets:[
    {label:'Net Income',data:netData,backgroundColor:netData.map(v=>v>=0?'rgba(10,168,96,.72)':'rgba(224,48,48,.65)'),borderRadius:6,yAxisID:'yNet'},
    {label:'Ritase',data:ritaseData,backgroundColor:'rgba(255,103,0,.55)',borderRadius:6,type:'bar',yAxisID:'yRit'}
  ]},options:{responsive:true,plugins:{legend:{display:true,labels:{font:{family:'DM Sans',size:10},color:tc,boxWidth:10,boxHeight:10}},
    tooltip:{callbacks:{label:c=>{if(c.dataset.label==='Ritase')return 'Ritase: '+c.raw+' trip';return c.dataset.label+': '+fmtFull(c.raw);}},
    backgroundColor:dark?'rgba(16,22,36,.97)':'rgba(255,255,255,.97)',titleColor:dark?'#DDE6F5':'#0B1220',bodyColor:dark?'#A8F040':'#12A060',borderColor:'rgba(125,206,19,.2)',borderWidth:1,padding:9,cornerRadius:9}},
  scales:{
    x:{grid:{display:false},ticks:{font:{family:'DM Sans',size:10},color:tc}},
    yNet:{position:'left',grid:{color:gc,drawBorder:false},ticks:{font:{family:'DM Sans',size:9},color:tc,callback:v=>{const abs=Math.abs(v);if(abs>=1e6)return(v/1e6).toFixed(1)+'Jt';if(abs>=1e3)return(v/1e3).toFixed(0)+'Rb';return v;}}},
    yRit:{position:'right',grid:{display:false},ticks:{font:{family:'DM Sans',size:9},color:'rgba(255,103,0,.7)'},title:{display:true,text:'Ritase',color:'rgba(255,103,0,.7)',font:{size:9}}}
  },barPercentage:0.65,categoryPercentage:0.7}});
}

// ═══════════════════════════════ LAPORAN ═════════════════════════
function setLapFilter(f,btn){
  lapFilter=f;document.querySelectorAll('.filter-chip').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');
  const cr=document.getElementById('lap-custom-range');if(cr)cr.style.display=f==='custom'?'flex':'none';
  if(f!=='custom')renderLaporanTable();
}
function getLapTxns(){
  const now=new Date();
  return transactions.filter(t=>{
    const d=new Date(t.date+'T00:00:00');
    if(lapFilter==='bulan-ini') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    if(lapFilter==='bulan-lalu'){const lm=new Date(now.getFullYear(),now.getMonth()-1,1);return d.getMonth()===lm.getMonth()&&d.getFullYear()===lm.getFullYear();}
    if(lapFilter==='custom'){
      const fr=document.getElementById('lap-from')?.value;
      const to=document.getElementById('lap-to')?.value;
      if(!fr||!to) return true;
      return t.date>=fr&&t.date<=to;
    }
    return true;
  });
}
let rekapSortCol='nopol', rekapSortDir=1;
function sortRekap(col){
  if(rekapSortCol===col){rekapSortDir*=-1;}else{rekapSortCol=col;rekapSortDir=1;}
  renderLaporanTable();
}
function renderLaporanTable(){
  const list=getLapTxns();
  const tbody=document.getElementById('lap-tbody');
  const tfoot=document.getElementById('lap-tfoot');
  const periodBadge=document.getElementById('rekap-period-badge');
  if(!tbody)return;
  // Compute human-readable period label + date range
  const _now=new Date();
  let _periodLabel='',_rangeLabel='';
  if(lapFilter==='bulan-ini'){
    _periodLabel='Bulan Ini';
    const _first=new Date(_now.getFullYear(),_now.getMonth(),1);
    const _last=new Date(_now.getFullYear(),_now.getMonth()+1,0);
    _rangeLabel=_first.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'})+' s/d '+_last.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'});
  } else if(lapFilter==='bulan-lalu'){
    _periodLabel='Bulan Lalu';
    const _first=new Date(_now.getFullYear(),_now.getMonth()-1,1);
    const _last=new Date(_now.getFullYear(),_now.getMonth(),0);
    _rangeLabel=_first.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'})+' s/d '+_last.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'});
  } else if(lapFilter==='custom'){
    _periodLabel='Custom';
    const _fr=document.getElementById('lap-from')?.value;
    const _to=document.getElementById('lap-to')?.value;
    if(_fr&&_to){
      _rangeLabel=new Date(_fr+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'})+' s/d '+new Date(_to+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'});
    }
  }
  if(periodBadge)periodBadge.textContent=_periodLabel;
  // Update date range label
  const _rangeEl=document.getElementById('rekap-date-range');
  if(_rangeEl)_rangeEl.textContent=_rangeLabel?'Periode: '+_rangeLabel:'';
  const umum=list.filter(t=>t.type==='outflow'&&t.kategori==='UMUM').reduce((s,t)=>s+t.amount,0);
  const bebanPerUnit=FLEET_COUNT>0?umum/FLEET_COUNT:0;
  // Build per-armada rows
  let rows=fleetData.map(f=>{
    const inflow=list.filter(t=>t.type==='inflow'&&t.armada===f.nopol).reduce((s,t)=>s+t.amount,0);
    const outTunai=list.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&t.kategori==='Tunai').reduce((s,t)=>s+t.amount,0);
    const outOnderdil=list.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&t.kategori==='Onderdil').reduce((s,t)=>s+t.amount,0);
    const outUmum=bebanPerUnit;
    const nett=inflow-(outTunai+outOnderdil+outUmum);
    return{nopol:f.nopol,driver:f.driver,status:f.status,inflow,outTunai,outOnderdil,outUmum,nett};
  });
  // Sort
  rows.sort((a,b)=>{
    let va=a[rekapSortCol],vb=b[rekapSortCol];
    if(typeof va==='string')return va.localeCompare(vb)*rekapSortDir;
    return(va-vb)*rekapSortDir;
  });
  // Update sort arrows
  ['nopol','driver','inflow','outTunai','outOnderdil','outUmum','nett'].forEach(col=>{
    const th=document.querySelector('#rekap-table th[data-col="'+col+'"]');
    const ar=document.getElementById('sa-'+col);
    if(th){th.classList.remove('sort-asc','sort-desc');if(col===rekapSortCol)th.classList.add(rekapSortDir===1?'sort-asc':'sort-desc');}
    if(ar){
      if(col!==rekapSortCol)ar.textContent='⇅';
      else ar.textContent=rekapSortDir===1?'↑':'↓';
    }
  });
  tbody.innerHTML=rows.map(r=>`<tr>
    <td><div class="ar-nopol">${r.nopol}</div><span class="ar-badge ${r.status}">${r.status.charAt(0).toUpperCase()+r.status.slice(1)}</span></td>
    <td style="font-size:12px;color:var(--text2);">${r.driver}</td>
    <td class="ar-num ${r.inflow>0?'pos':'zero'}">${fmt(r.inflow)}</td>
    <td class="ar-num ${r.outTunai>0?'neg':'zero'}">${r.outTunai>0?'-'+fmt(r.outTunai):'—'}</td>
    <td class="ar-num ${r.outOnderdil>0?'neg':'zero'}">${r.outOnderdil>0?'-'+fmt(r.outOnderdil):'—'}</td>
    <td class="ar-num ${r.outUmum>0?'neg':'zero'}">${r.outUmum>0?'-'+fmt(r.outUmum):'—'}</td>
    <td class="ar-num ${r.nett>=0?'net-pos':'net-neg'}" style="font-weight:800;">${fmt(r.nett)}</td>
  </tr>`).join('');
  // Footer totals
  const totInf=rows.reduce((s,r)=>s+r.inflow,0);
  const totTunai=rows.reduce((s,r)=>s+r.outTunai,0);
  const totOnderdil=rows.reduce((s,r)=>s+r.outOnderdil,0);
  const totNett=rows.reduce((s,r)=>s+r.nett,0);
  if(tfoot)tfoot.innerHTML=`<tr>
    <td colspan="2" style="font-weight:800;color:var(--text);">TOTAL PERIODE</td>
    <td style="text-align:right;color:var(--success);font-weight:800;">${fmt(totInf)}</td>
    <td style="text-align:right;color:var(--danger);font-weight:800;">-${fmt(totTunai)}</td>
    <td style="text-align:right;color:var(--danger);font-weight:800;">-${fmt(totOnderdil)}</td>
    <td style="text-align:right;color:var(--danger);font-weight:800;">-${fmt(umum)}</td>
    <td style="text-align:right;color:var(--info);font-weight:800;">${fmt(totNett)}</td>
  </tr>`;
  const s=document.getElementById('lap-sum');if(s)s.innerHTML=`<span class="rs-lbl">Net Profit Periode</span><span class="rs-val">${fmt(totNett)}</span>`;
  // Also refresh the Armada Performance Chart
  renderArmadaPerfChart(list);
}
function exportCSV(){
  const list=getLapTxns();
  const umum=list.filter(t=>t.type==='outflow'&&t.kategori==='UMUM').reduce((s,t)=>s+t.amount,0);
  const bebanPerUnit=FLEET_COUNT>0?umum/FLEET_COUNT:0;
  const rows=fleetData.map(f=>{
    const inflow=list.filter(t=>t.type==='inflow'&&t.armada===f.nopol).reduce((s,t)=>s+t.amount,0);
    const outTunai=list.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&t.kategori==='Tunai').reduce((s,t)=>s+t.amount,0);
    const outOnderdil=list.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&t.kategori==='Onderdil').reduce((s,t)=>s+t.amount,0);
    const outUmum=bebanPerUnit;
    const nett=inflow-(outTunai+outOnderdil+outUmum);
    return`"${f.nopol}","${f.driver}",${inflow},${outTunai},${outOnderdil},${Math.round(outUmum)},${Math.round(nett)}`;
  });
  const header='No. Pol,Nama Driver,Inflow,Out Tunai,Out Onderdil,Out Umum,Nett';
  const blob=new Blob([header+'\n'+rows.join('\n')],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='BHD_Rekap_Armada.csv';a.click();
  showToast('File CSV berhasil diunduh');vibrate(30);
}
function exportPDF(){
  const list=getLapTxns();
  const umum=list.filter(t=>t.type==='outflow'&&t.kategori==='UMUM').reduce((s,t)=>s+t.amount,0);
  const bebanPerUnit=FLEET_COUNT>0?umum/FLEET_COUNT:0;
  const dataRows=fleetData.map(f=>{
    const inflow=list.filter(t=>t.type==='inflow'&&t.armada===f.nopol).reduce((s,t)=>s+t.amount,0);
    const outTunai=list.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&t.kategori==='Tunai').reduce((s,t)=>s+t.amount,0);
    const outOnderdil=list.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&t.kategori==='Onderdil').reduce((s,t)=>s+t.amount,0);
    const outUmum=bebanPerUnit;
    const nett=inflow-(outTunai+outOnderdil+outUmum);
    return{nopol:f.nopol,driver:f.driver,inflow,outTunai,outOnderdil,outUmum,nett};
  });
  const totInf=dataRows.reduce((s,r)=>s+r.inflow,0);
  const totTunai=dataRows.reduce((s,r)=>s+r.outTunai,0);
  const totOnderdil=dataRows.reduce((s,r)=>s+r.outOnderdil,0);
  const totNett=dataRows.reduce((s,r)=>s+r.nett,0);
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>BHD Rekap Armada</title><style>
    body{font-family:Arial,sans-serif;padding:30px;color:#111;}
    h1{color:#5FA00D;margin-bottom:4px;}
    p{color:#666;font-size:12px;margin-bottom:18px;}
    table{width:100%;border-collapse:collapse;font-size:12px;}
    th{background:#f0f0f0;padding:9px 10px;border:1px solid #ddd;font-weight:700;text-align:left;}
    td{padding:8px 10px;border:1px solid #ddd;}
    .num{text-align:right;} .pos{color:#12A060;font-weight:700;} .neg{color:#E03030;font-weight:700;}
    .nett-pos{color:#2563EB;font-weight:800;} .nett-neg{color:#E03030;font-weight:800;}
    tfoot td{background:#f8f8f8;font-weight:800;border-top:2px solid #999;}
  </style></head><body>
  <h1>BHD Smart Flow — Rekap Per Armada</h1>
  <p>PT. BAGUS HARYA DWIPRIMA · Periode: ${lapFilter==='bulan-ini'?'Bulan Ini':lapFilter==='bulan-lalu'?'Bulan Lalu':'Custom'} · Dicetak: ${new Date().toLocaleDateString('id-ID')}</p>
  <table><thead><tr><th>No. Pol</th><th>Nama Driver</th><th class="num" style="color:#12A060;">Inflow</th><th class="num">Out Tunai</th><th class="num">Out Onderdil</th><th class="num">Out Umum</th><th class="num" style="color:#2563EB;">Nett</th></tr></thead>
  <tbody>${dataRows.map(r=>`<tr>
    <td><b>${r.nopol}</b></td><td>${r.driver}</td>
    <td class="num pos">${fmtFull(r.inflow)}</td>
    <td class="num neg">${r.outTunai>0?'-'+fmtFull(r.outTunai):'—'}</td>
    <td class="num neg">${r.outOnderdil>0?'-'+fmtFull(r.outOnderdil):'—'}</td>
    <td class="num neg">${r.outUmum>0?'-'+fmtFull(r.outUmum):'—'}</td>
    <td class="num ${r.nett>=0?'nett-pos':'nett-neg'}">${fmtFull(r.nett)}</td>
  </tr>`).join('')}</tbody>
  <tfoot><tr><td colspan="2">TOTAL PERIODE</td><td class="num pos">${fmtFull(totInf)}</td><td class="num neg">-${fmtFull(totTunai)}</td><td class="num neg">-${fmtFull(totOnderdil)}</td><td class="num neg">-${fmtFull(umum)}</td><td class="num nett-pos">${fmtFull(totNett)}</td></tr></tfoot>
  </table></body></html>`);
  w.document.close();w.print();showToast('Laporan PDF siap cetak');
}

// ═══════════════════════════════ ARMADA MANAGEMENT ═══════════════
function switchArmadaTab(tab,btn){
  document.getElementById('tab-unit-view').style.display=tab==='unit'?'block':'none';
  document.getElementById('tab-driver-view').style.display=tab==='driver'?'block':'none';
  document.querySelectorAll('.at-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  if(tab==='driver')renderDriverList();
}

function renderFleetUnits(){
  const el=document.getElementById('fleet-unit-list');if(!el)return;
  if(fleetData.length===0){
    el.innerHTML='<div style="text-align:center;padding:32px;color:var(--text3);font-size:13px;">Belum ada armada. Tambah unit baru di atas.</div>';
    return;
  }
  el.innerHTML=fleetData.map(f=>{
    const pW=daysUntil(f.pajak)<=7,kW=daysUntil(f.kir)<=7,aW=pW||kW;
    const status=f.status||'jalan';
    const initials=(f.nopol||'??').replace(/\s/g,'').slice(-4);
    const sl={jalan:'chip-green',bengkel:'chip-orange',antre:'chip-gray'};
    return `<div class="fleet-card-unit">
      <div class="fcu-av ${status}" onclick="openUnitDetail('${f.id}')">${initials}</div>
      <div class="fcu-info" onclick="openUnitDetail('${f.id}')">
        <div class="fcu-nopol">${f.nopol||'—'}</div>
        <div class="fcu-driver"><svg viewBox="0 0 24 24" width="10" height="10" style="fill:none;stroke:var(--text3);stroke-width:2;stroke-linecap:round;flex-shrink:0"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${f.driver||'—'}</div>
      </div>
      <div class="fcu-right">
        ${status==='antre'?'<span class="antre-pulse"><span class="ap-dot"></span>Antre</span>':`<span class="chip ${sl[status]||'chip-gray'}">${sIcoFn(status)} ${status.charAt(0).toUpperCase()+status.slice(1)}</span>`}
        ${aW?'<span class="doc-warn">⚠ Dokumen</span>':''}
        <button class="fcu-edit-btn" onclick="openSmModal('unit','${f.id}')"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      </div>
    </div>`;
  }).join('');
}

function renderDriverList(){
  const el=document.getElementById('driver-list-view');if(!el)return;
  const all=[...new Set([...driverList,...fleetData.map(f=>f.driver)])];
  el.innerHTML=all.map(d=>{
    const init=d.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const unit=fleetData.find(f=>f.driver===d);
    return `<div class="driver-card">
      <div class="drv-av">${init}</div>
      <div class="drv-info"><div class="drv-name">${d}</div><div class="drv-meta">${unit?'🚛 '+unit.nopol:'Tidak ada unit tetap'}</div></div>
      <div class="drv-actions">
        <button class="drv-btn edit" onclick="openSmModal('driver','${d}')"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="drv-btn del" onclick="deleteDriver('${d}')"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════ UNIT DETAIL ═════════════════════
function openUnitDetail(id){
  const f=fleetData.find(x=>x.id===id);if(!f)return;
  currentDetailUnit=f;
  document.getElementById('armada-list').style.display='none';
  document.getElementById('detail-panel').classList.add('active');
  // Use ALL transactions (no period filter) for unit detail
  const uIn=transactions.filter(t=>t.type==='inflow'&&t.armada===f.nopol).reduce((s,t)=>s+t.amount,0);
  const uOutTunai=transactions.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&t.kategori==='Tunai').reduce((s,t)=>s+t.amount,0);
  const uOutOnderdil=transactions.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&t.kategori==='Onderdil').reduce((s,t)=>s+t.amount,0);
  const beban=transactions.filter(t=>t.type==='outflow'&&t.kategori==='UMUM').reduce((s,t)=>s+t.amount/FLEET_COUNT,0);
  const net=uIn-(uOutTunai+uOutOnderdil+beban);
  const pD=daysUntil(f.pajak),kD=daysUntil(f.kir);
  // Active sparepart count
  const activeParts=sparepartStock.filter(sp=>sp.installed.some(i=>i.armada===f.nopol));
  document.getElementById('dp-hero').innerHTML=`
    <div style="display:flex;align-items:center;gap:11px;margin-bottom:12px;position:relative;z-index:1;">
      <div style="width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#CC5200,#FF6700,#FF9A40);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;">${f.nopol.replace(/\s/g,'').slice(-4)}</div>
      <div><div class="dp-nopol">${f.nopol}</div><div class="dp-driver">${f.driver}</div></div>
      <div style="margin-left:auto;">${f.status==='antre'?'<span class="antre-pulse"><span class="ap-dot"></span>Antre</span>':`<span class="chip ${f.status==='jalan'?'chip-green':'chip-orange'}">${sIcoFn(f.status)} ${f.status.charAt(0).toUpperCase()+f.status.slice(1)}</span>`}</div>
    </div>
    <div class="dp-stats" style="position:relative;z-index:1;">
      <div class="dp-stat"><div class="dp-stat-l">Total Inflow</div><div class="dp-stat-v gr">${fmt(uIn)}</div></div>
      <div class="dp-stat"><div class="dp-stat-l">Out Tunai</div><div class="dp-stat-v rd">${fmt(uOutTunai)}</div></div>
      <div class="dp-stat"><div class="dp-stat-l">Out Onderdil</div><div class="dp-stat-v rd">${fmt(uOutOnderdil)}</div></div>
      <div class="dp-stat"><div class="dp-stat-l">Beban Umum</div><div class="dp-stat-v rd">${fmt(beban)}</div></div>
      <div class="dp-stat"><div class="dp-stat-l">Laba Bersih</div><div class="dp-stat-v nt" style="font-size:14px;">${fmt(net)}</div></div>
      <div class="dp-stat"><div class="dp-stat-l">Onderdil Aktif</div><div class="dp-stat-v" style="color:var(--warning);">${activeParts.length} item</div></div>
    </div>
    <div class="dp-docs" style="position:relative;z-index:1;">
      <div class="dp-doc"><div class="dp-doc-lbl">Pajak</div><div class="dp-doc-val ${pD<=7?'near':pD<=30?'warn':''}">${fmtDate(f.pajak)} ${pD<=30?'('+pD+'h)':''}</div></div>
      <div class="dp-doc"><div class="dp-doc-lbl">KIR</div><div class="dp-doc-val ${kD<=7?'near':kD<=30?'warn':''}">${fmtDate(f.kir)} ${kD<=30?'('+kD+'h)':''}</div></div>
    </div>`;
  showTab('perjalanan',null);
}


function backToArmadaList(){
  document.getElementById('armada-list').style.display='block';
  document.getElementById('detail-panel').classList.remove('active');
  currentDetailUnit=null;
}

function showTab(name,btnEl){
  if(btnEl){document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));btnEl.classList.add('active');}
  else document.querySelectorAll('.tab-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
  ['perjalanan','biaya','dokumen'].forEach(t=>{const e=document.getElementById('tab-'+t);if(e)e.style.display=t===name?'block':'none';});
  if(!currentDetailUnit)return;const f=currentDetailUnit;
  if(name==='perjalanan'){
    const trips=transactions.filter(t=>t.type==='inflow'&&t.armada===f.nopol&&t.muat).sort((a,b)=>b.date.localeCompare(a.date));
    const parts=getActivePartsForArmada(f.nopol);
    const tripsHTML=trips.length
      ?trips.map(t=>`<div class="hist-item"><div class="hist-dot trip"></div><div class="txn-body"><div class="hist-main">${t.muat} → ${t.bongkar}</div><div class="hist-sub">${fmtDate(t.date)} · ${t.driver}</div></div><div class="hist-amt in">+${fmt(t.amount)}</div></div>`).join('')
      :'<div style="text-align:center;padding:24px;color:var(--text3);">Belum ada perjalanan tercatat</div>';
    const partsHTML=parts.length
      ?'<div class="sec-title" style="margin-top:14px;margin-bottom:8px;">🔧 Onderdil Aktif ('+parts.length+' item)</div>'
        +parts.map(p=>`<div class="ritase-row">
          <div style="font-size:18px;">${getSpCatIcon(p.kategori)||'🔧'}</div>
          <div class="ritase-info">
            <div class="ritase-label">${p.nama}</div>
            <div class="ritase-meta">${p.spek} · Dipasang: ${fmtDate(p.tglPasang)} (${p.daysSince} hari)</div>
            ${p.freeze?'<div class="ritase-freeze">❄ FREEZE — Armada di Bengkel</div>':''}
          </div>
          <div style="text-align:right;"><div class="ritase-count">${p.ritase}</div><div style="font-size:9px;color:var(--text3);">ritase</div></div>
        </div>`).join('')
      :'<div style="text-align:center;padding:14px;color:var(--text3);font-size:12px;">Tidak ada onderdil terpasang</div>';
    document.getElementById('tab-perjalanan').innerHTML=tripsHTML+partsHTML;
  }
  if(name==='biaya'){
    const unitCosts=transactions.filter(t=>t.type==='outflow'&&t.armada===f.nopol).sort((a,b)=>b.date.localeCompare(a.date));
    const umumCosts=transactions.filter(t=>t.type==='outflow'&&t.kategori==='UMUM').sort((a,b)=>b.date.localeCompare(a.date));
    const chipColor={Tunai:'chip-green',Onderdil:'chip-orange',UMUM:'chip-gray'};
    const renderItem=t=>`<div class="hist-item">
      <div class="hist-dot out"></div>
      <div class="txn-body">
        <div class="hist-main">${t.label} <span class="chip ${chipColor[t.kategori]||'chip-gray'}" style="font-size:8px;">${t.kategori}</span></div>
        <div class="hist-sub">${t.nota||'—'} · ${t.toko||'—'} · ${fmtDate(t.date)}</div>
      </div>
      <div class="hist-amt out">-${fmt(t.kategori==='UMUM'?t.amount/FLEET_COUNT:t.amount)}</div>
    </div>`;
    let html='';
    if(unitCosts.length){html+='<div class="sec-title" style="font-size:10px;margin-bottom:6px;">Biaya Unit Ini</div>'+unitCosts.map(renderItem).join('');}
    if(umumCosts.length){html+='<div class="sec-title" style="font-size:10px;margin-top:10px;margin-bottom:6px;">Beban Umum (porsi unit ini)</div>'+umumCosts.map(renderItem).join('');}
    if(!html)html='<div style="text-align:center;padding:30px;color:var(--text3);font-size:12.5px;">Belum ada biaya tercatat</div>';
    document.getElementById('tab-biaya').innerHTML=html;
  }
  if(name==='dokumen'){
    const pD=daysUntil(f.pajak),kD=daysUntil(f.kir);
    document.getElementById('tab-dokumen').innerHTML=`
      <div class="card" style="margin-bottom:10px;">
        <div class="card-hdr" style="margin-bottom:8px;"><span class="card-title">Edit Dokumen</span></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Tgl Pajak</label><input type="date" class="form-input" id="edit-pajak" value="${f.pajak||''}"/></div>
          <div class="form-group"><label class="form-label">Tgl KIR</label><input type="date" class="form-input" id="edit-kir" value="${f.kir||''}"/></div>
        </div>
        <button onclick="saveDocs('${f.id}')" class="form-btn inflow">Simpan Dokumen</button>
      </div>
      <div class="card">
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg3);border-radius:10px;">
            <span style="font-size:12px;font-weight:600;color:var(--text);">Pajak Kendaraan</span>
            <span class="chip ${pD<=7?'chip-danger':pD<=30?'chip-orange':'chip-green'}">${fmtDate(f.pajak)} (${pD}h)</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg3);border-radius:10px;">
            <span style="font-size:12px;font-weight:600;color:var(--text);">KIR</span>
            <span class="chip ${kD<=7?'chip-danger':kD<=30?'chip-orange':'chip-green'}">${fmtDate(f.kir)} (${kD}h)</span>
          </div>
        </div>
      </div>`;
  }
}

function saveDocs(id){
  const f=fleetData.find(x=>x.id===id);if(!f)return;
  f.pajak=document.getElementById('edit-pajak')?.value||f.pajak;
  f.kir=document.getElementById('edit-kir')?.value||f.kir;
  if(_useAPI) apiFetch('/api/fleet/'+id,{method:'PUT',body:{nopol:f.nopol,driver:f.driver,status:f.status,pajak:f.pajak,kir:f.kir}}).catch(e=>console.warn('Sync docs gagal:',e));
  showToast('Dokumen berhasil disimpan');openUnitDetail(id);checkDocWarnings();
}

// ═══════════════════════════════ SM MODAL (CRUD) ══════════════════
function openSmModal(type,val){
  closeFab();
  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('sm-body');
  if(type==='driver'){
    const isEdit=!!val;tEl.textContent=isEdit?'Edit Supir':'Tambah Supir Baru';
    body.innerHTML=`
      <div><label class="form-label">Nama Lengkap Supir</label><input class="form-input" id="sm-driver-name" value="${isEdit?val:''}" placeholder="Nama supir..."/></div>
      <button class="sm-btn orange" onclick="saveDriver('${val}')">${isEdit?'Simpan':'Tambah Supir'}</button>
      ${isEdit?`<button class="sm-btn danger" onclick="deleteDriver('${val}');closeSm()">Hapus Supir</button>`:''}`;
  } else {
    const isEdit=!!val;const u=isEdit?fleetData.find(f=>f.id===val):null;
    tEl.textContent=isEdit?'Edit Unit Armada':'Tambah Unit Baru';
    body.innerHTML=`
      <div><label class="form-label">No. Plat</label><input class="form-input" id="sm-nopol" value="${u?u.nopol:''}" placeholder="B 1234 XX"/></div>
      <div><label class="form-label">Supir Tetap</label><select class="form-select" id="sm-unit-driver">${getDriverOpts(u?u.driver:'')}</select></div>
      <div><label class="form-label">Status</label><select class="form-select" id="sm-status"><option value="jalan"${u?.status==='jalan'?' selected':''}>🟢 Jalan</option><option value="antre"${u?.status==='antre'?' selected':''}>🟡 Antre</option><option value="bengkel"${u?.status==='bengkel'?' selected':''}>🔴 Bengkel</option></select></div>
      <div class="form-row">
        <div><label class="form-label">Tgl Pajak</label><input type="date" class="form-input" id="sm-pajak" value="${u?u.pajak:''}"/></div>
        <div><label class="form-label">Tgl KIR</label><input type="date" class="form-input" id="sm-kir" value="${u?u.kir:''}"/></div>
      </div>
      <button class="sm-btn orange" onclick="saveUnit('${val}')">${isEdit?'Simpan':'Tambah Unit'}</button>
      ${isEdit?`<button class="sm-btn danger" onclick="deleteUnit('${val}');closeSm()">Hapus Unit</button>`:''}`;
  }
  document.getElementById('sm-overlay').classList.add('open');
}
function closeSm(){document.getElementById('sm-overlay').classList.remove('open');}
function closeSmOuter(e){if(e.target===document.getElementById('sm-overlay'))closeSm();}

function saveDriver(old){
  const name=document.getElementById('sm-driver-name')?.value?.trim();
  if(!name){showToast('Nama tidak boleh kosong');return;}
  if(old&&old!==name){const i=driverList.indexOf(old);if(i>-1)driverList[i]=name;else driverList.push(name);fleetData.forEach(f=>{if(f.driver===old)f.driver=name;});}
  else if(!old&&!driverList.includes(name))driverList.push(name);
  if(_useAPI) apiFetch('/api/drivers',{method:'POST',body:{nama:name}}).catch(e=>console.warn('Sync driver gagal:',e));
  closeSm();renderDriverList();renderDashboard();showToast(old?'Supir diperbarui':'Supir ditambahkan');vibrate(30);
}
function deleteDriver(name){
  if(fleetData.some(f=>f.driver===name)){showToast('Supir sedang bertugas di unit');return;}
  
  const smOverlay = document.getElementById('sm-overlay');
  const smTitle = document.getElementById('sm-title-text');
  const smBody = document.getElementById('sm-body');
  
  smTitle.innerHTML = `<span style="color:var(--danger)">⚠️ Konfirmasi Hapus</span>`;
  smBody.innerHTML = `
    <div style="text-align:center;padding:10px 0;">
      <div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text);">Hapus supir ini?</div>
      <div style="font-size:11.5px;color:var(--text3);line-height:1.5;">
        <b>${name}</b><br>
        Data akan dihapus secara permanen dari daftar supir.
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
      <button class="sm-btn" onclick="closeSm()" style="background:var(--bg3);color:var(--text2);">Batal</button>
      <button class="sm-btn danger" onclick="executeDeleteDriver('${encodeURIComponent(name)}')" style="background:var(--danger);color:#fff;box-shadow:0 4px 12px rgba(224,48,48,0.25);">Ya, Hapus</button>
    </div>
  `;
  smOverlay.classList.add('open');
  vibrate(20);
}

function executeDeleteDriver(encodedName) {
  const name = decodeURIComponent(encodedName);
  driverList = driverList.filter(d => d !== name);
  if(_useAPI) apiFetch('/api/drivers/' + encodedName, { method: 'DELETE' }).catch(e => console.warn(e));
  
  closeSm();
  renderDriverList(); renderDashboard();
  showToast('Supir Dihapus Permanen');
  vibrate(40);
}
function saveUnit(existId){
  const nopol=(document.getElementById('sm-nopol')?.value||'').trim().toUpperCase();
  const driver=document.getElementById('sm-unit-driver')?.value||'';
  const status=document.getElementById('sm-status')?.value||'jalan';
  const pajak=document.getElementById('sm-pajak')?.value||'';
  const kir=document.getElementById('sm-kir')?.value||'';
  if(!nopol){showToast('No. plat tidak boleh kosong');return;}
  const dupCheck=fleetData.find(f=>f.nopol===nopol&&f.id!==existId);
  if(dupCheck){showToast('No. plat sudah terdaftar');return;}
  if(existId){
    const u=fleetData.find(f=>f.id===existId);
    if(u){u.nopol=nopol;u.driver=driver;u.status=status;u.pajak=pajak;u.kir=kir;}
    if(_useAPI) apiFetch('/api/fleet/'+existId,{method:'PUT',body:{nopol,driver,status,pajak,kir}}).catch(e=>console.warn('Sync fleet gagal:',e));
  } else {
    const newId='f'+Date.now();
    fleetData.push({id:newId,nopol,driver,status,pajak,kir});
    if(_useAPI) apiFetch('/api/fleet',{method:'POST',body:{id:newId,nopol,driver,status,pajak,kir}}).catch(e=>console.warn('Sync fleet gagal:',e));
  }
  FLEET_COUNT=fleetData.length;
  const fi=document.getElementById('fleet-count-input');if(fi)fi.value=FLEET_COUNT;
  closeSm();renderFleetUnits();renderDashboard();renderLaporanTable();checkDocWarnings();
  showToast(existId?'Unit diperbarui':'Unit '+nopol+' ditambahkan');vibrate(30);
}
function deleteUnit(id){
  const u=fleetData.find(f=>f.id===id);
  const i=fleetData.findIndex(f=>f.id===id);if(i>-1)fleetData.splice(i,1);
  if(_useAPI) apiFetch('/api/fleet/'+id,{method:'DELETE'}).catch(e=>console.warn('Sync fleet delete gagal:',e));
  FLEET_COUNT=fleetData.length;
  const fi=document.getElementById('fleet-count-input');if(fi)fi.value=FLEET_COUNT;
  renderFleetUnits();renderDashboard();renderLaporanTable();checkDocWarnings();
  showToast(u?'Unit '+u.nopol+' dihapus':'Unit dihapus');vibrate(40);
}

// ═══════════════════════════════ INPUT MODAL ══════════════════════
function buildGudangOpts(){
  // Group stok gudang by kategori
  if(sparepartStock.length===0) return '<option value="">— Stok kosong —</option>';
  const grouped={};
  sparepartStock.filter(sp=>sp.stokSisa>0).forEach(sp=>{
    if(!grouped[sp.kategori]) grouped[sp.kategori]=[];
    grouped[sp.kategori].push(sp);
  });
  let html='<option value="">— Pilih dari Gudang —</option>';
  Object.keys(grouped).forEach(kat=>{
    html+=`<optgroup label="${kat}">`;
    grouped[kat].forEach(sp=>{
      html+=`<option value="${sp.id}">[${sp.stokSisa}/${sp.stokAwal}] ${sp.nama} · ${sp.spek}</option>`;
    });
    html+='</optgroup>';
  });
  return html;
}

function openModal(type){
  closeFab();
  if(!isEditMode) resetEditMode();
  document.getElementById('mt-dot').className='mt-dot '+type;
  const title=document.getElementById('mt-text'),body=document.getElementById('modal-body');
  if(type==='inflow'){
    title.textContent='+ Input Inflow';
    body.innerHTML=`
      <div class="form-group"><label class="form-label">No. Plat Armada</label><select class="form-select" id="inf-armada" onchange="syncDriverFromArmada()">${getArmadaOpts()}</select></div>
      <div class="form-group"><label class="form-label">Nama Supir</label><select class="form-select" id="inf-driver">${getDriverOpts()}</select></div>
      <div class="form-group"><label class="form-label">Titik Muat</label><input class="form-input" id="inf-muat" placeholder="Pelabuhan / Gudang Asal"/></div>
      <div class="form-group"><label class="form-label">Titik Bongkar</label><input class="form-input" id="inf-bongkar" placeholder="Gudang / Kota Tujuan"/></div>
      <div class="form-group"><label class="form-label">Jumlah Setoran Netto (Rp)</label><input class="form-input" id="inf-amount" placeholder="0" inputmode="numeric"/></div>
      <div class="form-group"><label class="form-label">Tanggal</label><input type="date" class="form-input" id="inf-date" value="${today()}"/></div>
      <div class="form-group"><label class="form-label">Update Status Armada</label><select class="form-select" id="inf-antre" onchange="document.getElementById('inf-antre-hint').style.display=this.value==='antre'?'block':'none'"><option value="jalan">🟢 Jalan — Aktif beroperasi</option><option value="antre">🟡 Antre — Menunggu bongkar</option><option value="bengkel">🔴 Bengkel — Dalam perbaikan</option></select></div>
      <div id="inf-antre-hint" style="display:none;font-size:10.5px;color:var(--text3);background:var(--bg3);padding:8px 10px;border-radius:10px;margin-bottom:8px;">💡 Status Antre bisa disimpan tanpa isi nominal uang.</div>
      <button class="form-btn inflow" onclick="submitInflow()">Simpan Inflow</button>`;
    setupCurrencyInput('inf-amount');syncDriverFromArmada();
  } else {
    title.textContent='- Input Outflow';
    body.innerHTML=`
      <div class="form-group"><label class="form-label">Tipe Pengeluaran</label>
        <select class="form-select" id="out-cat" onchange="onOutCatChange()">
          <option value="UMUM">🏢 UMUM — Beban Operasional</option>
          <option value="Onderdil">🔧 Onderdil — Suku Cadang</option>
          <option value="Tunai">💵 Tunai — Pengeluaran Tunai</option>
        </select>
      </div>
      <div id="out-onderdil-wrap" style="display:none;">
        <div class="form-group">
          <label class="form-label">📦 Pilih dari Stok Gudang</label>
          <select class="form-select" id="out-sp-select" onchange="onGudangItemSelect()">
            ${buildGudangOpts()}
          </select>
        </div>
        <div id="out-sp-info" style="display:none;background:var(--bg3);border-radius:10px;padding:9px 11px;margin-bottom:8px;font-size:11px;color:var(--text2);"></div>
      </div>
      <div class="form-group"><label class="form-label">Keterangan</label>
        <input class="form-input" id="out-label" placeholder="BBM, Ganti Oli, Retribusi..."/>
      </div>
      <div class="form-group"><label class="form-label">Nama Toko / Vendor</label>
        <input class="form-input" id="out-toko" placeholder="Nama toko"/>
      </div>
      <div class="form-group"><label class="form-label">No. Nota</label>
        <input class="form-input" id="out-nota" placeholder="INV-001"/>
      </div>
      <div id="out-armada-wrap" style="display:none;">
        <div class="form-group"><label class="form-label">No. Plat Armada</label>
          <select class="form-select" id="out-armada" onchange="syncOutDriver()">${getArmadaOpts()}</select>
        </div>
        <div class="form-group"><label class="form-label">Nama Supir</label>
          <select class="form-select" id="out-driver">${getDriverOpts()}</select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Jumlah (Rp)</label>
        <input class="form-input" id="out-amount" placeholder="0" inputmode="numeric"/>
      </div>
      <div class="form-group"><label class="form-label">Tanggal</label>
        <input type="date" class="form-input" id="out-date" value="${today()}"/>
      </div>
      <button class="form-btn outflow" onclick="submitOutflow()">Simpan Outflow</button>`;
    setupCurrencyInput('out-amount');
  }
  document.getElementById('modal-overlay').classList.add('open');
}

function onOutCatChange(){
  const cat=document.getElementById('out-cat')?.value;
  const onderdilWrap=document.getElementById('out-onderdil-wrap');
  const armadaWrap=document.getElementById('out-armada-wrap');
  if(onderdilWrap) onderdilWrap.style.display=cat==='Onderdil'?'block':'none';
  if(armadaWrap) armadaWrap.style.display=(cat==='Onderdil'||cat==='Tunai')?'block':'none';
  // Reset gudang selection when switching away
  if(cat!=='Onderdil'){
    const sel=document.getElementById('out-sp-select');
    if(sel) sel.value='';
    const info=document.getElementById('out-sp-info');
    if(info) info.style.display='none';
  }
}

function onGudangItemSelect(){
  const sel=document.getElementById('out-sp-select');
  const spId=sel?.value;
  const info=document.getElementById('out-sp-info');
  if(!spId){
    if(info) info.style.display='none';
    return;
  }
  const sp=sparepartStock.find(s=>s.id===spId);
  if(!sp){if(info) info.style.display='none';return;}
  // Auto-fill fields
  const labelEl=document.getElementById('out-label');
  const tokoEl=document.getElementById('out-toko');
  const notaEl=document.getElementById('out-nota');
  const amtEl=document.getElementById('out-amount');
  if(labelEl&&!labelEl.value) labelEl.value=sp.nama+' ('+sp.spek+')';
  if(tokoEl&&!tokoEl.value) tokoEl.value=sp.toko;
  if(notaEl&&!notaEl.value) notaEl.value=sp.nota;
  if(amtEl){
    amtEl.value=new Intl.NumberFormat('id-ID').format(sp.hargaSatuan);
  }
  // Show info badge
  if(info){
    const threshold=getRitaseThreshold(sp.kategori);
    info.style.display='block';
    info.innerHTML='<b>'+sp.nama+'</b> · Sisa stok: <b style="color:var(--'+(sp.stokSisa>0?'success':'danger')+')">'+sp.stokSisa+' unit</b>'
      +' · Harga: '+fmt(sp.hargaSatuan)
      +'<br>🔄 Ritase akan mulai dihitung dari 0 setelah dipasang ke armada (threshold: '+threshold+' trip)';
  }
}

function toggleArmadaField(){
  // Legacy compatibility — now handled by onOutCatChange
  onOutCatChange();
}
function syncDriverFromArmada(){const a=document.getElementById('inf-armada')?.value;const f=fleetData.find(x=>x.nopol===a);const dd=document.getElementById('inf-driver');if(f&&dd)dd.value=f.driver;}
function syncOutDriver(){const a=document.getElementById('out-armada')?.value;const f=fleetData.find(x=>x.nopol===a);const dd=document.getElementById('out-driver');if(f&&dd)dd.value=f.driver;}
function closeModal(){document.getElementById('modal-overlay').classList.remove('open');}
function closeModalOuter(e){if(e.target===document.getElementById('modal-overlay'))closeModal();}

function submitInflow(){
  const armada=document.getElementById('inf-armada')?.value;
  const driver=document.getElementById('inf-driver')?.value||'';
  const amount=getRaw('inf-amount');
  const muat=document.getElementById('inf-muat')?.value||'—';
  const bongkar=document.getElementById('inf-bongkar')?.value||'—';
  const date=document.getElementById('inf-date')?.value;
  const antre=document.getElementById('inf-antre')?.value;
  if(antre!=='antre' && (!amount||amount<=0)){showToast('Masukkan jumlah yang valid');return;}
  
  const fUnit=fleetData.find(x=>x.nopol===armada);
  const statusSebelum=fUnit?fUnit.status:'jalan';
  
  if(isEditMode && currentEditId) {
    const tIndex = transactions.findIndex(t => t.id == currentEditId);
    if(tIndex > -1) {
      const updated = { ...transactions[tIndex], label: (amount > 0) ? 'Setoran ' + armada : 'Antrean ' + armada, amount, date, armada, muat, bongkar, driver };
      transactions[tIndex] = updated;
      if(_useAPI) apiFetch('/api/transactions/' + currentEditId, { method: 'PUT', body: updated }).catch(E => console.warn(E));
      showToast('Revisi Inflow berhasil');
    }
  } else {
    const txnId = 'txn_'+Date.now();
    const txnLabel = (amount > 0) ? 'Setoran ' + armada : 'Antrean ' + armada;
    const newTxn={id:txnId,type:'inflow',label:txnLabel,sub:driver+' · Netto',amount,date,armada,muat:muat||'',bongkar:bongkar||'',driver,nota:'',toko:'',kategori:'Inflow',status:'lunas'};
    transactions.unshift(newTxn);
    if(fUnit){ fUnit.status=antre; fUnit.driver=driver; }
    incrementRitaseForArmada(armada, statusSebelum);
    if(_useAPI){
      apiFetch('/api/transactions',{method:'POST',body:newTxn}).catch(e=>console.warn('Sync inflow gagal:',e));
      apiFetch('/api/fleet/'+fUnit?.id,{method:'PUT',body:{nopol:armada,driver,status:antre,pajak:fUnit?.pajak||'',kir:fUnit?.kir||''}}).catch(e=>console.warn('Sync fleet gagal:',e));
    }
    showToast(amount > 0 ? 'Inflow ' + fmt(amount) + ' berhasil disimpan' : 'Status armada '+armada+' diperbarui ke Antre');
  }
  
  resetEditMode();
  closeModal(); renderDashboard(); applyTxnFilters(); renderLaporanTable();
  vibrate(30);
}

function resetEditMode() {
  isEditMode = false;
  currentEditId = null;
}
function submitOutflow(){
  const nota=document.getElementById('out-nota')?.value||'—';
  const toko=document.getElementById('out-toko')?.value||'—';
  const label=document.getElementById('out-label')?.value?.trim();
  const cat=document.getElementById('out-cat')?.value;
  const amount=getRaw('out-amount');
  const date=document.getElementById('out-date')?.value;
  const isUnit=cat==='Onderdil'||cat==='Tunai';
  const armada=isUnit?document.getElementById('out-armada')?.value:'UMUM';
  const driver=isUnit?document.getElementById('out-driver')?.value:'';
  if(!label){showToast('Masukkan keterangan pengeluaran');return;}
  if(!amount||amount<=0){showToast('Masukkan jumlah yang valid');return;}

  if(isEditMode && currentEditId) {
    const tIndex = transactions.findIndex(t => t.id == currentEditId);
    if(tIndex > -1) {
      const updated = { ...transactions[tIndex], label: label||'Pengeluaran', amount, date, armada, nota, toko, kategori: cat, driver };
      transactions[tIndex] = updated;
      if(_useAPI) apiFetch('/api/transactions/' + currentEditId, { method: 'PUT', body: updated }).catch(E => console.warn(E));
      showToast('Revisi Outflow berhasil');
    }
  } else {
    // Handle gudang item selection (Onderdil from stok)
    let spId=null;
    if(cat==='Onderdil'){
      const spSel=document.getElementById('out-sp-select');
      spId=spSel?.value||null;
      if(spId){
        const sp=sparepartStock.find(s=>s.id===spId);
        if(sp){
          if(sp.stokSisa<=0){showToast('Stok '+sp.nama+' sudah habis!');return;}
          sp.stokSisa--;
          // Tambah ke installed[] — ritase mulai dari 0
          sp.installed.push({
            armada:armada||'UMUM',
            tglPasang:date,
            ritase:0,
            txnId:Date.now()
          });
          showToast('✅ '+sp.nama+' dipasang ke '+armada+' — ritase mulai dihitung');
        }
      }
    }
    const txnLabel=label||(spId?sparepartStock.find(s=>s.id===spId)?.nama||'Onderdil':'Pengeluaran');
    const outId='txn_'+Date.now();
    const newOut={id:outId,type:'outflow',label:txnLabel,sub:`No.Nota: ${nota} · ${toko}${driver?' · '+driver:''}`,amount,date,armada,nota,toko,kategori:cat,driver,status:'lunas',sparepartId:spId||null};
    transactions.unshift(newOut);
    if(_useAPI){
      apiFetch('/api/transactions',{method:'POST',body:newOut}).catch(e=>console.warn('Sync outflow gagal:',e));
    }
    if(!spId) showToast('Outflow '+fmt(amount)+' disimpan');
  }

  resetEditMode();
  closeModal();renderDashboard();applyTxnFilters();renderGudang();renderLaporanTable();
  vibrate(30);
}

// ═══════════════════════════════ NAV ══════════════════════════════
function showPage(name,sbEl,bnId){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pg=document.getElementById('page-'+name);if(pg)pg.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
  if(sbEl)sbEl.classList.add('active');else{const s=document.getElementById('sb-'+name);if(s)s.classList.add('active');}
  document.querySelectorAll('.bn-item').forEach(i=>i.classList.remove('active'));
  if(bnId){const b=document.getElementById(bnId);if(b)b.classList.add('active');}
  closeSb();closeFab();
  if(name==='dashboard'){showSkeleton();renderDashboard();}
  if(name==='keuangan'){renderDashboard();applyTxnFilters();}
  if(name==='laporan'){renderLaporanTable();_buildAndShowWAPreview();}
  if(name==='armada'){renderFleetUnits();renderDashboard();}
  if(name==='gudang'){renderGudang();}
}
function openSb(){document.getElementById('sidebar').classList.add('open');document.getElementById('sb-overlay').classList.add('open');}
function closeSb(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sb-overlay').classList.remove('open');}

// ═══════════════════════════════ FAB ══════════════════════════════
function toggleFab(){fabOpen=!fabOpen;document.getElementById('fab-popup').classList.toggle('open',fabOpen);document.getElementById('fab-circle').classList.toggle('open',fabOpen);if(fabOpen)vibrate(20);}
function closeFab(){fabOpen=false;document.getElementById('fab-popup').classList.remove('open');document.getElementById('fab-circle').classList.remove('open');}
document.addEventListener('click',e=>{if(fabOpen&&!e.target.closest('#fab-btn')&&!e.target.closest('#fab-popup'))closeFab();});

// ═══════════════════════════════ THEME ═══════════════════════════
function setTheme(t){
  isDark=t==='dark';document.documentElement.setAttribute('data-theme',t);
  document.getElementById('ti-sun').style.display=isDark?'block':'none';
  document.getElementById('ti-moon').style.display=isDark?'none':'block';
  const bl=document.getElementById('btn-light'),bd=document.getElementById('btn-dark');
  if(bl){bl.style.borderColor=isDark?'var(--card-b)':'var(--green)';bl.style.background=isDark?'var(--bg3)':'var(--green-bg)';bl.style.color=isDark?'var(--text2)':'var(--green2)';}
  if(bd){bd.style.borderColor=isDark?'var(--green)':'var(--card-b)';bd.style.background=isDark?'var(--green-bg)':'var(--bg3)';bd.style.color=isDark?'var(--green2)':'var(--text2)';}
  setTimeout(()=>{renderDonut(totalInflow(transactions),totalOutflow(transactions));renderMiniLine();renderBarChart(currentBarFilter);},50);
}
function toggleTheme(){setTheme(isDark?'light':'dark');}

// ═══════════════════════════════ OTHER ═══════════════════════════
function updateFleetCount(v){const n=parseInt(v);if(n>0){FLEET_COUNT=n;renderDashboard();}}
function confirmReset(){if(confirm('Yakin hapus SEMUA transaksi?')){transactions=[];renderDashboard();applyTxnFilters();renderLaporanTable();showToast('Semua transaksi dihapus');}}

document.getElementById('bg-upload').addEventListener('change',function(e){
  const r=new FileReader();r.onload=ev=>{document.getElementById('bg-layer').style.backgroundImage=`url(${ev.target.result})`;applyBg();};r.readAsDataURL(e.target.files[0]);
});
function applyBg(){const bl=document.getElementById('blur-range').value,ov=document.getElementById('overlay-range').value;document.getElementById('bg-overlay').style.cssText=`backdrop-filter:blur(${bl}px);-webkit-backdrop-filter:blur(${bl}px);background:rgba(10,14,28,${ov/100})`;}
document.getElementById('blur-range').addEventListener('input',applyBg);
document.getElementById('overlay-range').addEventListener('input',applyBg);
function resetBg(){document.getElementById('bg-layer').style.backgroundImage='';document.getElementById('bg-overlay').style.cssText='';document.getElementById('blur-range').value=10;document.getElementById('overlay-range').value=50;document.getElementById('bg-upload').value='';}

// ═══════════════════════════════ PTR ══════════════════════════════
let ptrStartY=0,ptrActive=false;
document.getElementById('main').addEventListener('touchstart',e=>{if(document.getElementById('main').scrollTop===0)ptrStartY=e.touches[0].clientY;});
document.getElementById('main').addEventListener('touchmove',e=>{const dy=e.touches[0].clientY-ptrStartY;if(dy>60&&!ptrActive){ptrActive=true;document.getElementById('ptr-indicator').classList.add('show');vibrate(15);}});
document.getElementById('main').addEventListener('touchend',()=>{if(ptrActive){ptrActive=false;setTimeout(()=>{document.getElementById('ptr-indicator').classList.remove('show');showSkeleton();renderDashboard();showToast('Data diperbarui');},600);}ptrStartY=0;});

function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}

// ═══════════════════════════════ INIT ════════════════════════════
async function _appInit(){
  try{
    // Jika server aktif, load semua data dari backend
    if(_useAPI){
      showToast('⏳ Memuat data dari server...');
      try{
        // Load transaksi
        const txns = await apiFetch('/api/transactions');
        transactions = txns.map(t=>({...t, id:t.id, amount:Number(t.amount)}));
        // Load armada
        const fleet = await apiFetch('/api/fleet');
        fleetData.length=0;
        fleet.forEach(f=>fleetData.push({id:f.id,nopol:f.nopol,driver:f.driver,status:f.status,pajak:f.pajak||'',kir:f.kir||''}));
        FLEET_COUNT=fleetData.length;
        const fi=document.getElementById('fleet-count-input');if(fi)fi.value=FLEET_COUNT;
        // Load drivers
        const drv = await apiFetch('/api/drivers');
        driverList=[...drv];
        // Load inventory
        const inv = await apiFetch('/api/inventory');
        sparepartStock.length=0;
        inv.forEach(sp=>sparepartStock.push({...sp,installed:sp.installed||[]}));
        // Load settings
        const st = await apiFetch('/api/settings');
        if(st.gudang_kategori) gudangKategori=JSON.parse(st.gudang_kategori);
        showToast('✅ Data berhasil dimuat dari server');
      } catch(e){
        console.warn('Gagal load dari server, pakai data lokal:',e);
        showToast('⚠️ Gagal terhubung server – mode offline');
      }
    }
    renderGudangFilterChips();
    renderGudang();
    renderDashboard();
    applyTxnFilters();
    renderLaporanTable();
    checkDocWarnings();
  }catch(e){console.error('Init error:',e);}
}
// App init is triggered by login — do NOT auto-call here

