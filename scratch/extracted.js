
// ═══════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER (DEKLARASI PERTAMA)
// ═══════════════════════════════════════════════════════
window.onerror = function(msg, url, line, col, error) {
  var dbg = document.getElementById('login-debug');
  if (dbg) {
    dbg.innerHTML = '<div style="color:#FF3B30; padding:10px; border:1px solid #FF3B30; margin-top:10px;">' +
                    '<b>System Error:</b> ' + msg + '<br>' +
                    '<small>Line: ' + line + '</small></div>';
  }
  return false;
};

// State Awal
window.activeAdmin = { id: 'admin-1', name: 'Admin', role: 'superadmin' };

// Proteksi LocalStorage
(function() {
  try {
    var saved = localStorage.getItem('bhd_active_admin');
    if (saved) {
      var parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') { window.activeAdmin = parsed; }
    }
  } catch (e) { console.warn('LS Error', e); }
})();

function updateAdminUI() {
  const nameEls = document.querySelectorAll('.as-name, .user-name');
  const roleEls = document.querySelectorAll('.as-role, .user-role');
  const avEls = document.querySelectorAll('.as-av, .user-av');
  
  nameEls.forEach(el => el.textContent = activeAdmin.name);
  roleEls.forEach(el => el.textContent = activeAdmin.role);
  avEls.forEach(el => el.textContent = activeAdmin.name.substring(0, 2).toUpperCase());
  
  // Tampilkan tombol hapus log hanya untuk superadmin
  const superActions = document.getElementById('audit-super-actions');
  if (superActions) superActions.style.display = activeAdmin.role === 'superadmin' ? 'block' : 'none';

  const admSec = document.getElementById('admin-management-section');
  if (admSec) {
    admSec.style.display = activeAdmin.role === 'superadmin' ? 'block' : 'none';
    if (activeAdmin.role === 'superadmin' && typeof renderAdminSettings === 'function') renderAdminSettings();
  }
}

function setSystemStatus(status, text) {
  const dot = document.querySelector('.sync-dot');
  const txt = document.getElementById('sync-text');
  const indicator = document.querySelector('.sync-indicator');
  
  if (!indicator) return;
  
  if (status === 'syncing') {
    indicator.classList.add('syncing');
    txt.textContent = 'Syncing...';
  } else {
    indicator.classList.remove('syncing');
    txt.textContent = text || 'Online';
  }
}

// ═══════════════════════════════════════════════════════
// API CLIENT — BHD SmartFlow Backend
// ═══════════════════════════════════════════════════════
var API_BASE = (function() {
  var h = window.location.hostname;
  var p = window.location.protocol;
  // Jika dibuka lewat file:/// atau localhost
  if (!h || h === 'localhost' || h === '127.0.0.1' || p === 'file:') {
    return 'http://127.0.0.1:3001';
  }
  if (h.indexOf('vercel.app') !== -1) return '';
  return 'http://' + h + ':3001';
})();

console.log('📡 API Path:', API_BASE || '(Same Origin)');
window.apiInitialized = true;
var badge = document.getElementById('js-init-badge');
if (badge) badge.textContent = 'JS Ready (' + (API_BASE ? 'API' : 'Local') + ')';

let _useAPI = false; // akan di-set true setelah ping berhasil

async function apiPing(){
  try{
    // Menggunakan fetch standar tanpa signal timeout untuk kompatibilitas browser lama
    const r = await fetch(API_BASE+'/api/ping');
    _useAPI = r.ok;
  } catch(e){ _useAPI = false; }
  return _useAPI;
}

async function apiFetch(path, opts={}){
  const headers = {
    'Content-Type':'application/json'
  };
  
  // Kirim info admin untuk audit trail jika sudah login
  if (window.activeAdmin) {
    headers['X-Admin-ID'] = activeAdmin.id || 'system';
    headers['X-Admin-Name'] = activeAdmin.name || 'System';
    headers['X-Admin-Role'] = activeAdmin.role || 'admin';
  }

  const r = await fetch(API_BASE + path, {
    headers: headers,
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e.error||r.statusText); }
  return r.json();
}

// ═══════════════════════════════════════════════════════
// AUDIT LOGS & ADMIN MANAGEMENT (FASE 1)
// ═══════════════════════════════════════════════════════
async function fetchAuditLogs() {
  if (!_useAPI) return;
  const tbody = document.getElementById('audit-table-body');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text3);">Memuat data audit...</td></tr>';
  
  try {
    const logs = await apiFetch('/api/audit-logs');
    renderAuditLogs(logs);
  } catch (e) {
    console.error(e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--danger);">Gagal memuat: ${e.message}</td></tr>`;
  }
}

function renderAuditLogs(logs) {
  const tbody = document.getElementById('audit-table-body');
  if (!tbody) return;
  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text3);">Belum ada riwayat aktivitas.</td></tr>';
    return;
  }
  
  tbody.innerHTML = logs.map(l => {
    const ts = new Date(l.timestamp).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    const badgeClass = l.action === 'create' ? 'al-create' : (l.action === 'update' ? 'al-update' : 'al-delete');
    return `
      <tr>
        <td style="padding-left:15px; font-weight:500;">${ts}</td>
        <td>
          <div style="font-weight:700;">${l.user_name}</div>
          <div style="font-size:9px; color:var(--text3);">${l.user_id}</div>
        </td>
        <td><span class="al-badge ${badgeClass}">${l.action.toUpperCase()}</span></td>
        <td><span class="al-badge" style="background:var(--bg3); color:var(--text2);">${l.module.toUpperCase()}</span></td>
        <td style="padding-right:15px; font-size:10px; color:var(--text2);">${l.doc_id}</td>
      </tr>
    `;
  }).join('');
}

async function confirmDeleteAuditLogs() {
  if (confirm('Hapus semua riwayat audit? Tindakan ini tidak bisa dibatalkan.')) {
    try {
      await apiFetch('/api/audit-logs', { method: 'DELETE' });
      showToast('Riwayat audit berhasil dibersihkan');
      fetchAuditLogs();
    } catch (e) {
      alert('Gagal: ' + e.message);
    }
  }
}

async function showAdminList() {
  if (!_useAPI) return alert('Server offline. Fitur ini memerlukan koneksi backend.');
  
  try {
    const admins = await apiFetch('/api/admins');
    let html = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <p style="font-size:11px; color:var(--text3); margin-bottom:4px;">Pilih Admin Aktif untuk Audit Trail:</p>
        ${admins.map(a => `
          <div class="fleet-row" onclick="selectAdmin('${a.id}', '${a.username}', '${a.role}')" style="padding:12px; border:1px solid ${activeAdmin.id === a.id ? 'var(--green-bd)' : 'transparent'}; background:${activeAdmin.id === a.id ? 'var(--green-bg)' : 'var(--bg3)'};">
            <div class="as-av" style="background:${activeAdmin.id === a.id ? 'var(--green)' : 'var(--text4)'}; color:#fff; width:30px; height:30px;">${a.username.substring(0,2).toUpperCase()}</div>
            <div style="flex:1;">
              <div style="font-weight:700; color:var(--text);">${a.username} ${activeAdmin.id === a.id ? '✅' : ''}</div>
              <div style="font-size:10px; color:var(--text3); text-transform:uppercase;">${a.role}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    openSm('Pilih Admin', html);
  } catch (e) {
    alert('Gagal memuat daftar admin: ' + e.message);
  }
}

function selectAdmin(id, name, role) {
  window.activeAdmin = { id, name, role };
  localStorage.setItem('bhd_active_admin', JSON.stringify(activeAdmin));
  updateAdminUI();
  closeSm();
  showToast(`Sesi aktif: ${name}`);
  // Force sync untuk memastikan audit mencatat admin yang baru
  syncDataSilent();
}

// Kredensial fallback (hanya dipakai jika server offline)
const LOGIN_USERNAME = 'admin';
const LOGIN_PASSWORD = 'bhd2024';
// ═══════════════════════════════════════════════════════

async function doLogin(){
  const u=document.getElementById('login-user')?.value?.trim();
  const p=document.getElementById('login-pass')?.value;
  const errEl=document.getElementById('login-err');
  const dbgEl=document.getElementById('login-debug');
  const btn=document.querySelector('.login-btn');
  
  if(dbgEl) dbgEl.textContent = 'Mencoba koneksi ke: ' + (API_BASE || 'Same Origin');
  if(btn){btn.textContent='Memeriksa...';btn.disabled=true;}
  
  let ok=false;
  let serverUp = false;

  try {
    if(dbgEl) dbgEl.textContent += ' > Ping...';
    serverUp = await apiPing();
    if(serverUp){
      if(dbgEl) dbgEl.textContent += ' > Online > Auth...';
      const res = await apiFetch('/api/auth/login',{method:'POST',body:{username:u,password:p}});
      if(res.ok){
        window.activeAdmin = { id: res.id, name: res.username, role: res.role };
        localStorage.setItem('bhd_active_admin', JSON.stringify(activeAdmin));
        updateAdminUI();
        ok = true;
      }
    } else {
      if(dbgEl) dbgEl.textContent += ' > Offline > Fallback...';
      ok = (u===LOGIN_USERNAME && p===LOGIN_PASSWORD);
    }
  } catch(e){
    ok = false;
    console.error('Login Error:', e);
    if(dbgEl) dbgEl.textContent += ' > EROR: ' + e.message;
    if(errEl) {
      errEl.textContent = e.message.includes('fetch') ? 'Gagal terhubung ke server.' : e.message;
      errEl.style.animation='none';
      requestAnimationFrame(()=>{errEl.style.animation='fadeUp .3s ease';});
    }
  }

  if(btn){btn.textContent='Masuk ke Dashboard ⛏️';btn.disabled=false;}
  
  if(ok){
    const overlay=document.getElementById('login-overlay');
    const app=document.getElementById('app');
    if(overlay){overlay.style.opacity='0';overlay.style.transition='opacity .4s';setTimeout(()=>{overlay.style.display='none';},400);}
    if(app){app.style.display='flex';}
    const badge=document.getElementById('api-status-badge');
    if(badge){badge.textContent=serverUp?'🟢 Online':'🟡 Offline';badge.title=serverUp?'Terhubung ke server':'Mode Offline - data tidak tersimpan ke server';}
    setTimeout(()=>{_appInit();},100);
  } else if (!errEl?.textContent) {
    if(errEl){
      errEl.textContent = serverUp ? 'Username atau password salah.' : 'Kredensial salah (Mode Offline).';
      errEl.style.animation='none';
      requestAnimationFrame(()=>{errEl.style.animation='fadeUp .3s ease';});
    }
    const passEl=document.getElementById('login-pass');if(passEl){passEl.value='';passEl.focus();}
  }
}

function resetAppSession() {
  if (confirm('Bersihkan data cache browser dan reset sesi? Langkah ini bisa membantu jika aplikasi macet.')) {
    localStorage.clear();
    location.reload();
  }
}

// ═══════════════════════════════ STATE ═══════════════════════════
let FLEET_COUNT=6,isDark=false,fabOpen=false;
let currentPeriod='today',currentBarFilter='6m',lapFilter='bulan-ini';
let txnFilterTipe='all',txnSearch='',txnSort='newest',txnPage=5;
let currentDetailUnit=null;
let donutChart=null,barChart=null,miniChart=null;

const fleetData=[
  {id:'f1',nopol:'B 1234 CD',driver:'Budi Santoso',status:'jalan',pajak:'2025-07-20',kir:'2025-07-18'},
  {id:'f2',nopol:'B 5678 EF',driver:'Andi Pratama',status:'jalan',pajak:'2025-09-15',kir:'2025-10-01'},
  {id:'f3',nopol:'B 9012 GH',driver:'Rudi Hartono',status:'bengkel',pajak:'2025-08-05',kir:'2025-08-10'},
  {id:'f4',nopol:'B 3456 IJ',driver:'Sari Dewi',status:'antre',pajak:'2025-07-22',kir:'2025-07-25'},
  {id:'f5',nopol:'B 7890 KL',driver:'Hendra Wijaya',status:'jalan',pajak:'2025-12-01',kir:'2025-11-15'},
  {id:'f6',nopol:'B 2345 MN',driver:'Teguh Purnomo',status:'jalan',pajak:'2025-10-10',kir:'2025-09-20'},
];

let driverList=['Budi Santoso','Andi Pratama','Rudi Hartono','Sari Dewi','Hendra Wijaya','Teguh Purnomo','Agus Setiawan','Dian Kusuma'];

let transactions=[];

// Monthly data computed from real transactions (see renderBarChart)


// ════════════════════════════════════════════════════════
// GUDANG, WA, LAPORAN helpers (moved from dead script block)
// ════════════════════════════════════════════════════════
// ════════════════════════════════════
// SPAREPART STOCK (terpisah dari transactions)
// ════════════════════════════════════
let gudangFilter='all';
let waDataReady=false,waTextCache='';

let sparepartStock=[];
let gudangKategori=['Ban','Oli','Filter','Spare']; // dynamic categories

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
const spCatIconDefault = {
  'Ban': '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="3"></circle></svg>',
  'Oli': '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 3m-6 0l3-3M6 7l12 0M6 17l12 0M12 7l0 10"></path></svg>',
  'Aki': '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M6 7V4h4v3M14 7V4h4v3M6 11h4M14 11h4v4M14 13h4"></path></svg>',
  'Filter': '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"></path></svg>',
  'Lampu': '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="9" r="6"></circle><path d="M9 15h6M10 18h4M12 21h0"></path></svg>',
  'Baut': '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 2h10l-2 4h-6zM12 6v16M9 9h6M9 13h6M9 17h6"></path></svg>',
  'Spare': '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"></path></svg>',
  'Rem': '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M12 3v18M3 12h18"></path></svg>',
  'Per': '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 16h18M3 8h18M3 4h18M3 20h18"></path></svg>'
};
function getSpCatIcon(kat){ return spCatIconDefault[kat] || '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>'; }

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
    return '<div class="sp-card '+(st==='critical'?'critical-stock ':'')+st+'">'
      +'<div class="sp-header"><div class="sp-icon-wrap '+st+'">'+ico+'</div>'+spStatusLabel(sp)+'</div>'
      +'<div class="sp-name">'+sp.nama+' <span class="min-badge">Min: '+(sp.stok_min||5)+'</span></div>'
      +'<div class="sp-spec">🏷️ '+sp.spek+' · 🏪 '+sp.toko+'</div>'
      +(instList?'<div style="margin-bottom:8px;">'+instList+'</div>':'')
      +'<div class="sp-meta-grid">'
      +'<div class="sp-meta-item"><div class="sp-meta-label">📦 Sisa/Total</div><div class="sp-meta-val '+(st==='critical'?'critical-text':'')+'" style="color:'+(st==='fresh'?'var(--success)':st==='warn'?'var(--warning)':'var(--danger)')+';">'+sp.stokSisa+' / '+sp.stokAwal+'</div></div>'
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
    +'<div><label class="form-label">Stok Awal</label><input class="form-input" id="sp-jml" type="number" value="'+(sp?sp.stokAwal:'')+'" placeholder="Qty"/></div>'
    +'<div><label class="form-label">Stok Minimum ⚠️</label><input class="form-input" id="sp-min" type="number" value="'+(sp?sp.stok_min:5)+'" placeholder="5"/></div>'
    +'<div style="grid-column:1/-1;"><label class="form-label">Harga per Unit (Rp)</label><input class="form-input" id="sp-harga" value="'+(sp?new Intl.NumberFormat('id-ID').format(sp.hargaSatuan):'')+'" placeholder="0" inputmode="numeric"/></div>'
    +'</div>'
    +'<div style="font-size:10.5px;color:var(--text3);background:var(--bg3);border-radius:10px;padding:9px 11px;line-height:1.6;">💡 Stok kritis akan ditandai Merah saat sisa stok <= minimum.</div>'
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
    kategori:'Onderdil',driver,status:'lunas',sparepartId:spId
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
  renderCatChart(filtered.filter(t=>t.type==='outflow'));
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
      <div class="txn-main" onclick="toggleTxn(${t.id})">
        <div class="txn-ico ${t.type==='inflow'?'in':'out'}">${t.type==='inflow'?svgIn:svgOut}</div>
        <div class="txn-body">
          <div class="txn-name">${t.label}</div>
          <div class="txn-meta">${t.sub} · ${fmtDate(t.date)}</div>
        </div>
        <div class="txn-right">
          <div class="txn-amt ${t.type==='inflow'?'in':'out'}">${t.type==='inflow'?'+':'-'}${fmt(t.amount)}</div>
          ${statusBadge(t.status||'lunas')}
        </div>
        <svg class="txn-expand-icon" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="txn-detail">
        ${t.muat?`<div class="route-row"><svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 00-8 8c0 5.25 8 13 8 13s8-7.75 8-13a8 8 0 00-8-8z"/></svg><span class="route-text">${t.muat} <b>→</b> ${t.bongkar}</span></div>`:''}
        <div class="txn-detail-grid">
          <div class="tdg-item"><div class="tdg-label">Tanggal</div><div class="tdg-val">${fmtDate(t.date)}</div></div>
          <div class="tdg-item"><div class="tdg-label">Armada</div><div class="tdg-val">${t.armada||'—'}</div></div>
          ${t.driver?`<div class="tdg-item"><div class="tdg-label">Supir</div><div class="tdg-val">${t.driver}</div></div>`:''}
          ${t.nota&&t.nota!=='—'?`<div class="tdg-item"><div class="tdg-label">No. Nota</div><div class="tdg-val">${t.nota}</div></div>`:''}
          ${t.toko&&t.toko!=='—'?`<div class="tdg-item"><div class="tdg-label">Toko</div><div class="tdg-val">${t.toko}</div></div>`:''}
          ${t.kategori==='UMUM'?`<div class="tdg-item"><div class="tdg-label">Per Unit</div><div class="tdg-val" style="color:var(--green2);">${fmt(t.amount/FLEET_COUNT)}</div></div>`:''}
        </div>
        ${showActions?`<div class="txn-actions">
          <button class="txn-act-btn edit" onclick="editTxn(${t.id})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit</button>
          <button class="txn-act-btn del" onclick="deleteTxn(${t.id})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>Hapus</button>
        </div>`:''}
      </div>
    </div>`).join('');
}

function toggleTxn(id){
  const el=document.getElementById('txn-'+id);if(el)el.classList.toggle('expanded');
  vibrate(15);
}
function deleteTxn(id){
  const t = transactions.find(x=>x.id===id);
  if(!t)return;
  
  // Logic Otomatis: Kembalikan Stok jika ini transaksi Onderdil
  if(t.kategori==='Onderdil' && t.sparepartId){
    const sp = sparepartStock.find(s=>s.id===t.sparepartId);
    if(sp){
      // 1. Tambah kembali stokSisa
      const jmlStr = t.label.match(/\((\d+)\sunit\)/); 
      const jml = jmlStr ? parseInt(jmlStr[1]) : 1;
      sp.stokSisa += jml;
      
      // 2. Hapus dari history installed armada (paling baru)
      if(sp.installed && t.armada){
        // Cari entry terakhir di armada yang sama dan hapus
        const idx = [...sp.installed].reverse().findIndex(i=>i.armada===t.armada);
        if(idx!==-1){
          const realIdx = sp.installed.length - 1 - idx;
          sp.installed.splice(realIdx, 1);
        }
      }
      
      if(_useAPI) apiFetch('/api/inventory/'+sp.id, {method:'PUT', body:sp}).catch(e=>console.warn('Sync stock return gagal:',e));
      showToast('Stok '+sp.nama+' dikembalikan (+'+jml+')');
    }
  }

  transactions=transactions.filter(t=>t.id!==id);
  if(_useAPI) apiFetch('/api/transactions/'+id,{method:'DELETE'}).catch(e=>console.warn('Sync delete txn gagal:',e));
  renderDashboard();applyTxnFilters();renderLaporanTable();showToast('Transaksi dihapus');vibrate(40);
}

function setLoginMode(m){
  document.getElementById('login-fields').style.display=m==='login'?'block':'none';
  document.getElementById('register-fields').style.display=m==='register'?'block':'none';
  document.getElementById('login-title').textContent=m==='login'?'BHD Smart Flow':'Daftar Admin';
  document.getElementById('login-err').textContent='';
}

async function doRegister(){
  const user = document.getElementById('reg-user').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const err = document.getElementById('login-err');
  if(!user || !pass){ err.textContent='Isi semua bidang!'; return; }
  try {
    await apiFetch('/api/auth/register', {method:'POST', body:{username:user, password:pass}});
    showToast('Pendaftaran Berhasil! Silakan Login');
    setLoginMode('login');
  } catch(e){ err.textContent=e.message; }
}

function editTxn(id){
  const t = transactions.find(x=>x.id===id);
  if(!t)return;
  openEditTxnModal(t);
}

function openEditTxnModal(t){
  // Gunakan sm-modal untuk edit transaksi
  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('sm-body');
  tEl.textContent='Revisi Transaksi';
  body.innerHTML=`
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px;">ID: ${t.id} · ${t.type.toUpperCase()}</div>
    <div class="form-group"><label class="form-label">Keterangan / Label</label><input class="form-input" id="rev-label" value="${t.label}"/></div>
    <div class="form-group"><label class="form-label">Amount (Rp)</label><input class="form-input" id="rev-amount" value="${new Intl.NumberFormat('id-ID').format(t.amount)}" inputmode="numeric"/></div>
    <div class="form-group"><label class="form-label">Tanggal</label><input type="date" class="form-input" id="rev-date" value="${t.date}"/></div>
    <button class="sm-btn orange" onclick="saveRevisedTxn('${t.id}')">Simpan Perubahan</button>
  `;
  setupCurrencyInput('rev-amount');
  document.getElementById('sm-overlay').classList.add('open');
}

async function saveRevisedTxn(id){
  const t = transactions.find(x=>x.id===id);
  if(!t)return;
  const newLabel = document.getElementById('rev-label').value;
  const newAmt = getRaw('rev-amount');
  const newDate = document.getElementById('rev-date').value;
  
  t.label = newLabel;
  t.amount = newAmt;
  t.date = newDate;
  
  if(_useAPI) await apiFetch('/api/transactions/'+id, {method:'PUT', body:t}).catch(e=>console.warn(e));
  
  closeSm();
  renderDashboard(); applyTxnFilters(); renderLaporanTable();
  showToast('Transaksi diperbarui');
}

// ════════════════════════════════════════════════════════
// SMART SYNC ENGINE (Dashboard ↔ Keuangan)
// ════════════════════════════════════════════════════════
let _lastSyncTxn = null;

async function syncDataSilent(){
  if(!_useAPI) return;
  setSystemStatus('syncing');
  
  try {
    // 1. Cek Summary dulu untuk efisiensi
    const summary = await apiFetch('/api/sync/summary');
    
    // Jika tidak ada perubahan transaksi baru, jangan tarik data besar
    if (_lastSyncTxn === summary.lastTxn && _lastSyncTxn !== null) {
      console.log('☁? Data sudah up-to-date (No changes)');
      setTimeout(() => setSystemStatus('online'), 1000);
      return;
    }
    
    _lastSyncTxn = summary.lastTxn;

    // 2. Sync Full Data jika ada perubahan
    const [txns, inv, fleet] = await Promise.all([
      apiFetch('/api/transactions'),
      apiFetch('/api/inventory'),
      apiFetch('/api/fleet')
    ]);

    transactions = txns.map(t=>({...t, id:t.id, amount:Number(t.amount)}));
    
    sparepartStock.length=0;
    inv.forEach(sp=>sparepartStock.push({...sp,installed:sp.installed||[]}));
    
    fleetData.length=0;
    fleet.forEach(f=>fleetData.push({id:f.id,nopol:f.nopol,driver:f.driver,status:f.status,pajak:f.pajak||'',kir:f.kir||''}));
    FLEET_COUNT=fleetData.length;
    
    // Refresh UI
    renderDashboard();
    renderGudang();
    renderLaporanTable();
    checkDocWarnings();
    
    console.log('? Smart Sync berhasil (Data updated)');
    setTimeout(() => setSystemStatus('online', 'Updated'), 1000);
  } catch(e) {
    console.warn('Silent sync failed:', e);
    setSystemStatus('online', 'Offline?');
  }
}

// Jalankan sync setiap 30 detik (Optimal untuk Fase 1)
setInterval(syncDataSilent, 30000);

// Jalankan sync saat tab kembali difokuskan
window.addEventListener('focus', () => {
  console.log('? Tab focused, triggering fast sync...');
  syncDataSilent();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') syncDataSilent();
});

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

function renderCatChart(outflows){
  const ctx=document.getElementById('catChart');if(!ctx)return;
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  const cats=outflows.reduce((acc,t)=>{acc[t.kategori]=(acc[t.kategori]||0)+t.amount;return acc;},{});
  const labels=Object.keys(cats),data=Object.values(cats);
  const colors={'Onderdil':'#FF6700','Tunai':'#2EB85C','UMUM':'#636E72'};
  const bg=[...labels.map(l=>colors[l]||'#888')];
  
  const leg=document.getElementById('cat-legend');
  if(leg)leg.innerHTML=labels.map((l,i)=>`<div class="dl-item"><div class="dl-dot" style="background:${bg[i]}"></div><div class="dl-info"><div class="dl-label">${l}</div><div class="dl-val" style="font-size:9px;">${fmt(data[i])}</div></div></div>`).join('');

  if(typeof catChart!=='undefined' && catChart) catChart.destroy();
  window.catChart=new Chart(ctx,{
    type:'doughnut',
    data:{labels,datasets:[{data,backgroundColor:bg,borderWidth:0,hoverOffset:4}]},
    options:{plugins:{legend:{display:false}},cutout:'65%'}
  });
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
  /* Dashboard Chart Slider */
  .chart-grid-slide {
    display: flex; gap: 10px; overflow-x: auto; 
    scroll-snap-type: x mandatory; scrollbar-width: none;
    margin-bottom: 14px; padding-bottom: 4px;
    -webkit-overflow-scrolling: touch;
  }
  .chart-grid-slide::-webkit-scrollbar { display:none; }
  .chart-grid-slide > div { 
    flex: 0 0 85%; scroll-snap-align: center; margin-bottom: 0 !important;
  }
  @media(min-width: 769px) {
    .chart-grid-slide { display: grid; grid-template-columns: 1fr 1fr; }
    .chart-grid-slide > div { flex: none; }
  }

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
  // Life-to-date Repair (accumulated outflow onderdil/service)
  const uOutLTD=transactions.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&(t.kategori==='Onderdil'||t.label.toLowerCase().includes('servis'))).reduce((s,t)=>s+t.amount,0);
  
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
      <div class="dp-stat"><div class="dp-stat-l">Beban Umum</div><div class="dp-stat-v rd">${fmt(beban)}</div></div>
      <div class="dp-stat"><div class="dp-stat-l">Repair LTD</div><div class="dp-stat-v rd" style="font-weight:700;">${fmt(uOutLTD)}</div></div>
      <div class="dp-stat"><div class="dp-stat-l">Onderdil Aktif</div><div class="dp-stat-v" style="color:var(--warning);">${activeParts.length} item</div></div>
      <div class="dp-stat" style="grid-column:1/-1;border-top:1px solid var(--card-b);padding-top:8px;margin-top:4px;">
        <div class="dp-stat-l">Laba Bersih (Nett)</div><div class="dp-stat-v nt" style="font-size:16px;font-weight:900;">${fmt(net)}</div>
      </div>
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
  ['perjalanan','biaya','ban','dokumen'].forEach(t=>{const e=document.getElementById('tab-'+t);if(e)e.style.display=t===name?'block':'none';});
  if(!currentDetailUnit)return;const f=currentDetailUnit;
  if(name==='ban'){renderFleetTires(f.id);}
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
  if(fleetData.some(f=>f.driver===name)){showToast('Supir sedang bertugas');return;}
  driverList=driverList.filter(d=>d!==name);renderDriverList();showToast('Supir dihapus');vibrate(40);
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
  // Ambil status armada SEBELUM diupdate — untuk logika ritase
  const fUnit=fleetData.find(x=>x.nopol===armada);
  const statusSebelum=fUnit?fUnit.status:'jalan';
  const txnId = 'txn_'+Date.now();
  const txnLabel = (amount > 0) ? 'Setoran ' + armada : 'Antrean ' + armada;
  const newTxn={id:txnId,type:'inflow',label:txnLabel,sub:driver+' · Netto',amount,date,armada,muat:muat||'',bongkar:bongkar||'',driver,nota:'',toko:'',kategori:'Inflow',status:'lunas'};
  transactions.unshift(newTxn);
  if(fUnit){fUnit.status=antre;fUnit.driver=driver;}
  incrementRitaseForArmada(armada, statusSebelum);
  // Simpan ke server jika online
  if(_useAPI){
    apiFetch('/api/transactions',{method:'POST',body:newTxn}).catch(e=>console.warn('Sync inflow gagal:',e));
    apiFetch('/api/fleet/'+fUnit?.id,{method:'PUT',body:{nopol:armada,driver,status:antre,pajak:fUnit?.pajak||'',kir:fUnit?.kir||''}}).catch(e=>console.warn('Sync fleet gagal:',e));
  }
  closeModal();renderDashboard();applyTxnFilters();renderLaporanTable();
  showToast(amount > 0 ? 'Inflow ' + fmt(amount) + ' berhasil disimpan' : 'Status armada '+armada+' diperbarui ke Antre');vibrate(30);
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
  closeModal();renderDashboard();applyTxnFilters();renderGudang();renderLaporanTable();
  if(!spId) showToast('Outflow '+fmt(amount)+' disimpan');
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
  if(name==='audit-logs'){fetchAuditLogs();}
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
    updateAdminUI();
    renderDashboard();
    applyTxnFilters();
    renderLaporanTable();
    checkDocWarnings();
  }catch(e){console.error('Init error:',e);}
}
// App init is triggered by login — do NOT auto-call here

// ═══════════════════════════════ TIRE TRACKING (PHASE 2) ═════════
async function renderFleetTires(fleetId){
  const el=document.getElementById('tab-ban');if(!el)return;
  el.innerHTML='<div style="text-align:center;padding:32px;color:var(--text3);font-size:13px;">Memuat data ban...</div>';
  
  try {
    const tires = _useAPI ? await apiFetch('/api/fleet/'+fleetId+'/tires') : [];
    const positions = [
      ['F-L', 'F-R'],
      ['B1-L-O', 'B1-L-I', 'B1-R-I', 'B1-R-O', 'B2-L-O', 'B2-L-I', 'B2-R-I', 'B2-R-O']
    ];

    let html = '<div class="tire-grid">';
    
    // Front Axle
    html += '<div class="tire-col">' + renderTire('F-L', tires) + '</div>';
    html += '<div style="width:40px;height:65px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text3);font-weight:700;border:1.5px dashed var(--card-b);border-radius:8px;">CAB</div>';
    html += '<div class="tire-col">' + renderTire('F-R', tires) + '</div>';

    // Bogie 1
    html += '<div class="tire-col">' + renderTire('B1-L-O', tires) + renderTire('B1-L-I', tires) + '</div>';
    html += '<div style="width:40px;height:140px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text3);font-weight:700;border-left:2px solid var(--bg2);border-right:2px solid var(--bg2);">BOGIE 1</div>';
    html += '<div class="tire-col">' + renderTire('B1-R-I', tires) + renderTire('B1-R-O', tires) + '</div>';

    // Bogie 2
    html += '<div class="tire-col">' + renderTire('B2-L-O', tires) + renderTire('B2-L-I', tires) + '</div>';
    html += '<div style="width:40px;height:140px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text3);font-weight:700;border-left:2px solid var(--bg2);border-right:2px solid var(--bg2);">BOGIE 2</div>';
    html += '<div class="tire-col">' + renderTire('B2-R-I', tires) + renderTire('B2-R-O', tires) + '</div>';

    html += '</div>';
    html += '<div style="font-size:10px;color:var(--text3);margin-top:12px;padding:0 10px;line-height:1.4;">💡 Klik pada gambar ban untuk memperbarui Serial Number atau mencatat penggantian ban.</div>';
    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--danger);">Gagal memuat ban: '+e.message+'</div>';
  }
}

function renderTire(pos, tires){
  const t = tires.find(x=>x.position===pos) || {position:pos, serial_number:'', brand:'', condition:''};
  const cClass = t.condition ? 'cond-'+t.condition : '';
  const dataStr = JSON.stringify(t).replace(/"/g, '&quot;');
  return `<div class="tire-item ${t.serial_number?'':'empty'}" onclick="openTireEditModal('${currentDetailUnit.id}', '${pos}', ${dataStr})">
    <div class="tire-label">${pos}</div>
    <div class="tire-sn">${t.serial_number || 'EMPTY'}</div>
    ${t.condition ? `<div class="tire-cond ${cClass}"></div>` : ''}
  </div>`;
}

function openTireEditModal(fleetId, pos, data){
  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('sm-body');
  tEl.textContent = 'Manajemen Ban - ' + pos;
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="grid-column:1/-1;">
        <label class="form-label">Serial Number</label>
        <input class="form-input" id="t-sn" value="${data.serial_number||''}" placeholder="SN..."/>
      </div>
      <div style="grid-column:1/-1;">
        <label class="form-label">Merek</label>
        <input class="form-input" id="t-brand" value="${data.brand||''}" placeholder="Merek ban..."/>
      </div>
      <div>
        <label class="form-label">Kondisi</label>
        <select class="form-select" id="t-cond">
          <option value="baru" ${data.condition==='baru'?'selected':''}>🟢 Baru</option>
          <option value="vulkanisir" ${data.condition==='vulkanisir'?'selected':''}>🟡 Vulkanisir</option>
          <option value="tipis" ${data.condition==='tipis'?'selected':''}>🔴 Tipis / Perlu Ganti</option>
        </select>
      </div>
      <div>
        <label class="form-label">Tgl Pasang</label>
        <input type="date" class="form-input" id="t-date" value="${data.installed_date || today()}"/>
      </div>
    </div>
    <button class="sm-btn orange" onclick="saveFleetTire('${fleetId}', '${pos}')">Simpan Perubahan</button>
  `;
  openSm();
}

async function renderAdminSettings(){
  const cont=document.getElementById('admin-list-container');if(!cont)return;
  try{
    const admins=await apiFetch('/api/admins');
    cont.innerHTML=admins.map(a=>`
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg2); padding:10px; border-radius:10px; border:1px solid var(--card-b);">
        <div><div style="font-weight:700; font-size:13px;">${a.name}</div><div style="font-size:10px; color:var(--text3);">${a.id} · ${a.role}</div></div>
        ${a.id==='admin'?'':`<button onclick="deleteAdmin('${a.id}')" style="color:var(--danger); background:none; border:none; font-size:18px; cursor:pointer;">&times;</button>`}
      </div>
    `).join('');
  }catch(e){console.error(e);}
}

function openAddAdminModal(){
  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('sm-body');
  tEl.textContent = 'Tambah Admin Baru';
  body.innerHTML = `
    <div style="display:grid; gap:12px;">
      <div><label class="form-label">ID / Username</label><input class="form-input" id="ad-id" placeholder="Ex: admin2"/></div>
      <div><label class="form-label">Nama Lengkap</label><input class="form-input" id="ad-name" placeholder="Ex: Budi Setiawan"/></div>
      <div><label class="form-label">Password</label><input class="form-input" id="ad-pass" type="password" placeholder="******"/></div>
      <div><label class="form-label">Role</label>
        <select class="form-select" id="ad-role">
          <option value="admin">Admin Operasional</option>
          <option value="superadmin">Superadmin</option>
        </select>
      </div>
      <button class="sm-btn orange" onclick="saveAdmin()">Simpan Admin</button>
    </div>
  `;
  openSm();
}

async function saveAdmin(){
  const id=document.getElementById('ad-id').value, name=document.getElementById('ad-name').value, 
        pass=document.getElementById('ad-pass').value, role=document.getElementById('ad-role').value;
  if(!id||!name||!pass) return alert('Data belum lengkap');
  try{
    await apiFetch('/api/admins', {method:'POST', body:{id, name, password:pass, role}});
    showToast('Admin berhasil ditambahkan');
    closeSm();
    renderAdminSettings();
  }catch(e){alert(e.message);}
}

async function deleteAdmin(id){
  if(!confirm('Hapus admin ini?')) return;
  try{
    await apiFetch('/api/admins/'+id, {method:'DELETE'});
    showToast('Admin dihapus');
    renderAdminSettings();
  }catch(e){alert(e.message);}
}

function saveCompanyProfile(){
  const name=document.getElementById('company-name-input').value;
  const addr=document.getElementById('company-address-input').value;
  const logo=document.getElementById('company-logo-input').value;
  localStorage.setItem('bhd_company_name', name);
  localStorage.setItem('bhd_company_address', addr);
  localStorage.setItem('bhd_company_logo', logo);
  showToast('Profil perusahaan disimpan secara lokal');
  renderDashboard();
}

// ═══════════════════════════════ EXPORT CSV ═══════════════════════
function exportTransactionsCSV(){
  const headers = ['ID','Tanggal','Label','Armada','Amount','Type','Kategori','Status','Toko','Nota'];
  let csv = headers.join(',') + '\\n';
  transactions.forEach(t=>{
    const row = [t.id, t.date, t.label.replace(/,/g,''), t.armada, t.amount, t.type, t.kategori, t.status, (t.toko||'').replace(/,/g,''), t.nota];
    csv += row.join(',') + '\\n';
  });
  downloadCSV('bhd_transactions_export.csv', csv);
}

async function exportAuditLogsCSV(){
  try{
    const logs = await apiFetch('/api/audit-logs');
    const headers = ['ID','Timestamp','User','Action','Module','DocID'];
    let csv = headers.join(',') + '\\n';
    logs.forEach(l=>{
      const row = [l.id, l.timestamp, l.user_name, l.action, l.module, l.doc_id];
      csv += row.join(',') + '\\n';
    });
    downloadCSV('bhd_audit_logs_export.csv', csv);
  }catch(e){showToast('Gagal ekspor: '+e.message);}
}

function downloadCSV(filename, csv){
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ═══════════════════════════════ PDF REPORT ══════════════════════
function generateFleetRekapPDF(){
  const list = getLapTxns();
  const cName = localStorage.getItem('bhd_company_name') || 'PT. BAGUS HARYA DWIPRIMA';
  const cAddr = localStorage.getItem('bhd_company_address') || 'Jakarta, Indonesia';
  const cLogo = localStorage.getItem('bhd_company_logo') || '';
  
  // Calculate Data
  const umum=list.filter(t=>t.type==='outflow'&&t.kategori==='UMUM').reduce((s,t)=>s+t.amount,0);
  const bebanPerUnit=FLEET_COUNT>0?umum/FLEET_COUNT:0;
  
  let rows = fleetData.map(f=>{
    const inf = list.filter(t=>t.type==='inflow'&&t.armada===f.nopol).reduce((s,t)=>s+t.amount,0);
    const ot = list.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&t.kategori==='Tunai').reduce((s,t)=>s+t.amount,0);
    const oo = list.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&t.kategori==='Onderdil').reduce((s,t)=>s+t.amount,0);
    const ou = bebanPerUnit;
    const nt = inf - (ot + oo + ou);
    return { nopol: f.nopol, driver: f.driver, inf, ot, oo, ou, nt };
  });

  const totInf = rows.reduce((s,r)=>s+r.inf,0);
  const totOut = rows.reduce((s,r)=>s+(r.ot+r.oo+r.ou),0);
  const totNt = totInf - totOut;
  const avg = rows.length > 0 ? totNt / rows.length : 0;
  const best = [...rows].sort((a,b)=>b.nt-a.nt)[0];
  const worst = [...rows].sort((a,b)=>a.nt-b.nt)[0];

  // Get Period Label
  let pRange = document.getElementById('rekap-date-range')?.textContent || 'Periode: —';
  const dateStr = new Date().toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'});
  const timeStr = new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>BHD SmartFlow - Rekap Per Armada</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Tahoma,sans-serif; background:#fff; padding:20px; color:#333; font-size:12px; }
        @page { size: A4 landscape; margin: 15mm; }
        .pdf-container { width:100%; max-width:1100px; margin:0 auto; padding:20px; border:1px solid #eee; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; border-bottom:3px solid #2ecc71; padding-bottom:15px; }
        .header-left { display:flex; gap:15px; align-items:center; }
        .logo-box { width:55px; height:55px; background:linear-gradient(135deg,#2ecc71,#27ae60); border-radius:8px; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:22px; flex-shrink:0; overflow:hidden; }
        .logo-img { width:100%; height:100%; object-fit:contain; }
        .header-info h1 { font-size:24px; color:#2ecc71; margin-bottom:2px; font-weight:700; }
        .header-right { text-align:right; font-size:11px; color:#666; }
        .company-info { background:#f8f9fa; padding:12px; border-left:4px solid #2ecc71; margin-bottom:15px; }
        .company-info h3 { color:#2ecc71; margin-bottom:4px; font-size:14px; }
        .table-wrapper { margin-bottom:20px; }
        table { width:100%; border-collapse:collapse; font-size:11px; }
        th { background:#2ecc71; color:white; padding:10px; border:1px solid #27ae60; text-align:left; }
        td { padding:10px; border:1px solid #ddd; }
        tr:nth-child(even) { background:#f9f9f9; }
        .currency { text-align:right; font-family:monospace; }
        .pos { color:#27ae60; } .neg { color:#e74c3c; }
        .total-row { background:#e8f8f5; font-weight:bold; border-top:2px solid #2ecc71; }
        .summary-section { margin:20px 0; padding:15px; background:#f0fdf4; border:1px solid #2ecc71; border-radius:8px; }
        .summary-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:15px; }
        .summary-item { display:flex; flex-direction:column; gap:2px; }
        .summary-item label { font-weight:600; color:#555; font-size:10px; }
        .summary-item .value { font-weight:700; color:#2ecc71; font-size:13px; }
        .footer { margin-top:30px; padding-top:15px; border-top:1px solid #eee; display:flex; justify-content:space-between; font-size:10px; color:#999; }
        @media print { .no-print { display:none; } .pdf-container { border:none; padding:0; } }
    </style>
</head>
<body>
    <div class="no-print" style="text-align:center; margin-bottom:20px;">
        <button onclick="window.print()" style="padding:10px 25px; background:#2ecc71; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">📄 KLIK UNTUK CETAK PDF</button>
    </div>
    <div class="pdf-container">
        <div class="header">
            <div class="header-left">
                <div class="logo-box">
                    ${cLogo ? `<img src="${cLogo}" class="logo-img" onerror="this.style.display='none'; this.parentElement.innerText='BHD'"/>` : 'BHD'}
                </div>
                <div class="header-info">
                    <h1>${cName}</h1>
                    <p>Rekap Keuangan Per Armada</p>
                </div>
            </div>
            <div class="header-right">
                <p><strong>Dicetak:</strong> ${dateStr}</p>
                <p><strong>Waktu:</strong> ${timeStr}</p>
            </div>
        </div>
        <div class="company-info">
            <h3>INFO LAPORAN</h3>
            <p>${cAddr}</p>
            <p style="margin-top:5px; font-weight:bold;">${pRange}</p>
        </div>
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>No. Pol</th>
                        <th>Nama Driver</th>
                        <th style="text-align:right">Inflow (Rp)</th>
                        <th style="text-align:right">Out Tunai (Rp)</th>
                        <th style="text-align:right">Out Onderdil (Rp)</th>
                        <th style="text-align:right">Out Umum (Rp)</th>
                        <th style="text-align:right">Nett (Rp)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(r=>`
                        <tr>
                            <td style="font-weight:bold">${r.nopol}</td>
                            <td>${r.driver}</td>
                            <td class="currency pos">${fmtFull(r.inf)}</td>
                            <td class="currency neg">${r.ot > 0 ? '-' + fmtFull(r.ot) : '—'}</td>
                            <td class="currency neg">${r.oo > 0 ? '-' + fmtFull(r.oo) : '—'}</td>
                            <td class="currency neg">${r.ou > 0 ? '-' + fmtFull(r.ou) : '—'}</td>
                            <td class="currency" style="font-weight:bold; background:${r.nt >= 0 ? '#d5f4e6' : '#fadbd8'}; color:${r.nt >= 0 ? '#27ae60' : '#c0392b'}">${fmtFull(r.nt)}</td>
                        </tr>
                    `).join('')}
                    <tr class="total-row">
                        <td colspan="2">TOTAL KESELURUHAN</td>
                        <td class="currency pos">${fmtFull(totInf)}</td>
                        <td class="currency neg">${fmtFull(rows.reduce((s,r)=>s+r.ot,0))}</td>
                        <td class="currency neg">${fmtFull(rows.reduce((s,r)=>s+r.oo,0))}</td>
                        <td class="currency neg">${fmtFull(rows.reduce((s,r)=>s+r.ou,0))}</td>
                        <td class="currency" style="color:${totNt >= 0 ? '#27ae60' : '#c0392b'}">${fmtFull(totNt)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="summary-section">
            <div class="summary-grid">
                <div class="summary-item"><label>TOTAL INFLOW</label><span class="value">${fmtFull(totInf)}</span></div>
                <div class="summary-item"><label>TOTAL OUTFLOW</label><span class="value">${fmtFull(totOut)}</span></div>
                <div class="summary-item"><label>TOTAL PROFIT (NETT)</label><span class="value" style="font-size:16px;">${fmtFull(totNt)}</span></div>
                <div class="summary-item"><label>RATA-RATA PROFIT/UNIT</label><span class="value">${fmtFull(avg)}</span></div>
                <div class="summary-item"><label>🏆 BEST PERFORMER</label><span class="value">${best ? best.nopol + ' (' + best.driver + ')' : '—'}</span></div>
                <div class="summary-item"><label>⚠️ WORST PERFORMER</label><span class="value">${worst ? worst.nopol + ' (' + worst.driver + ')' : '—'}</span></div>
            </div>
        </div>
        <div class="footer">
            <div>BHD SmartFlow v1.0 | Data Terverifikasi Sistem</div>
            <div>Halaman 1 dari 1</div>
        </div>
    </div>
    <script>setTimeout(() => { window.print(); }, 500);<\/script>
</body>
</html>`;

  const win = window.open('','_blank');
  win.document.write(html);
  win.document.close();
}

