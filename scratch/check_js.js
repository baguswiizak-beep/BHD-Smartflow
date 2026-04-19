
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// API CLIENT â€” BHD SmartFlow Backend
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Deteksi apakah diakses dari localhost atau IP jaringan
// Robust API_BASE detection
function getApiBase() {
  const proto = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port;

  let base = '';
  if (proto === 'file:' || host === '127.0.0.1' || host === 'localhost') {
    base = 'http://127.0.0.1:3001';
  } else if (/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    base = `http://${host}:3001`;
  } else {
    base = `${proto}//${host}${port ? ':'+port : ''}`;
  }
  console.log('ðŸŒ Detected API Base:', base);
  return base;
}
const API_BASE = getApiBase();




async function apiFetch(path, opts={}){
  const headers = { 'Content-Type': 'application/json' };
  if (window.activeAdmin) {
    headers['x-admin-id'] = window.activeAdmin.id || 'system';
    headers['x-admin-name'] = window.activeAdmin.name || 'System';
    headers['x-admin-role'] = window.activeAdmin.role || 'admin';
  }
  const r = await fetch(API_BASE + path, {
    headers,
    signal: AbortSignal.timeout(5000),
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if(!r.ok){ 
    const e=await r.json().catch(()=>({})); 
    const err = new Error(e.error||r.statusText);
    err.status = r.status; // Tambahkan status code agar bisa dicek (misal: 404)
    throw err; 
  }

  if (r.status === 204) return { ok: true };
  const text = await r.text();
  if (!text || !text.trim()) return { ok: true };
  try { return JSON.parse(text); } catch(e) { return { ok: true }; }

}

// Kredensial fallback (hanya dipakai jika server offline)
const LOGIN_USERNAME = 'admin';
const LOGIN_PASSWORD = 'bhd2024';
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function doLogin(){
  const u=document.getElementById('login-user')?.value?.trim();
  const p=document.getElementById('login-pass')?.value;
  const errEl=document.getElementById('login-err');
  const btn=document.querySelector('#login-form-masuk .login-btn');
  if(!u||!p){if(errEl)errEl.textContent='Masukkan username & password';return;}
  if(btn){btn.textContent='Memeriksa...';btn.disabled=true;}
  let ok=false, adminData=null;
  try{
    const response = await apiFetch('/api/auth/login', { method: 'POST', body: { username: u, password: p } });
    if(response.ok) { ok=true; adminData={id:response.id, name:response.username, role:response.role}; }
    else throw new Error(response.error || 'Login gagal.');
  } catch(e){
    if(u===LOGIN_USERNAME&&p===LOGIN_PASSWORD){ok=true;adminData={id:'admin-local',name:u,role:'superadmin'};}
    else{
      if(btn){btn.textContent='Masuk ke Dashboard â›ï¸';btn.disabled=false;}
      if(errEl){errEl.textContent=e.message;errEl.style.color='#FCA5A5';}
      return;
    }
  }
  if(btn){btn.textContent='Masuk ke Dashboard â›ï¸';btn.disabled=false;}
  if(ok&&adminData){
    window.activeAdmin=adminData;
    localStorage.setItem('bhd_active_admin',JSON.stringify(adminData));
    const overlay=document.getElementById('login-overlay');
    const app=document.getElementById('app');
    if(overlay){overlay.style.opacity='0';overlay.style.transition='opacity .4s';setTimeout(()=>{overlay.style.display='none';},400);}
    if(app){app.style.display='flex';}
    // Set cached data immediately so UI renders instantly while sync background fetches
    const cachedTxns = localStorage.getItem('bhd_cache_transactions');
    if (cachedTxns) transactions = JSON.parse(cachedTxns);
    const cachedFleet = localStorage.getItem('bhd_cache_fleet');
    if (cachedFleet) { fleetData.length=0; JSON.parse(cachedFleet).forEach(f=>fleetData.push(f)); }
    const cachedSp = localStorage.getItem('bhd_cache_inventory');
    if (cachedSp) { sparepartStock.length=0; JSON.parse(cachedSp).forEach(s=>sparepartStock.push(s)); }

    setTimeout(()=>{_appInit();},100);
  }
}

function switchLoginTab(tab){
  const masuk=document.getElementById('login-form-masuk');
  const daftar=document.getElementById('login-form-daftar');
  const btnM=document.getElementById('ltab-masuk');
  const btnD=document.getElementById('ltab-daftar');
  const errEl=document.getElementById('login-err');
  if(errEl) errEl.textContent='';
  if(tab==='masuk'){
    masuk.style.display='block';daftar.style.display='none';
    btnM.style.background='linear-gradient(135deg,#8B6914,#D4A843)';btnM.style.color='#2C1810';
    btnD.style.background='transparent';btnD.style.color='rgba(255,255,255,.4)';
  } else {
    masuk.style.display='none';daftar.style.display='block';
    btnD.style.background='linear-gradient(135deg,#8B6914,#D4A843)';btnD.style.color='#2C1810';
    btnM.style.background='transparent';btnM.style.color='rgba(255,255,255,.4)';
  }
}

// Kode rahasia untuk daftar admin â€” superadmin bisa lihat/ubah di Pengaturan
// Hapus hardcoded fallback agar sistem sepenuhnya bergantung pada Database Central (Fix 4.3)
// const ADMIN_REG_CODE='BHD2024';

async function doRegister(){
  const username=document.getElementById('reg-user')?.value?.trim();
  const pass=document.getElementById('reg-pass')?.value;
  const pass2=document.getElementById('reg-pass2')?.value;
  const code=document.getElementById('reg-code')?.value;
  const errEl=document.getElementById('login-err');
  if(!username||!pass||!code){errEl.textContent='Username, password & kode wajib diisi';errEl.style.color='#FCA5A5';return;}
  if(pass!==pass2){errEl.textContent='Password tidak cocok';errEl.style.color='#FCA5A5';return;}
  if(pass.length<6){errEl.textContent='Password minimal 6 karakter';errEl.style.color='#FCA5A5';return;}

  // Validasi kode admin live dari database (Fix 4.3)
  let validCode = null;
  try {
    const sdata = await apiFetch('/api/settings');
    if(sdata && sdata.admin_reg_code) validCode = sdata.admin_reg_code;
  } catch(e){
    errEl.textContent = 'Tidak dapat memverifikasi kode. Periksa koneksi server.';
    errEl.style.color = '#FCA5A5';
    return;
  }

  if(!validCode){
    errEl.textContent = 'Kode registrasi belum dikonfigurasi. Hubungi Superadmin.';
    errEl.style.color = '#FCA5A5';
    return;
  }
  if(code !== validCode){errEl.textContent='Kode registrasi salah!';errEl.style.color='#FCA5A5';return;}

  errEl.textContent='Mendaftar...';errEl.style.color='var(--orange)';
  try{
    const response = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: { username, password: pass, role: 'admin' }
    });
    if(!response.ok && response.error) throw new Error(response.error);
    errEl.textContent='âœ… Berhasil! Silakan masuk dengan akun baru.';errEl.style.color='#86EFAC';
    setTimeout(()=>switchLoginTab('masuk'),1500);
  }catch(e){errEl.textContent='Gagal: '+e.message;errEl.style.color='#FCA5A5';}
}

// Keuangan stats renderer
function renderKeuanganStats(){
  const list=typeof getKeuanganTxns==='function'?getKeuanganTxns():[...transactions];
  const inf=list.filter(t=>t.type==='inflow').reduce((s,t)=>s+t.amount,0);
  
  const oUmum=list.filter(t=>t.type==='outflow'&&(t.kategori||'').toLowerCase()==='umum').reduce((s,t)=>s+t.amount,0);
  const oTunai=list.filter(t=>t.type==='outflow'&&(t.kategori||'').toLowerCase()==='tunai').reduce((s,t)=>s+t.amount,0);
  const oOnderdil=list.filter(t=>t.type==='outflow'&&(t.kategori||'').toLowerCase()==='onderdil').reduce((s,t)=>s+t.amount,0);
  
  const kIn=document.getElementById('k-in');
  const kUmum=document.getElementById('k-umum');
  const kTunai=document.getElementById('k-tunai');
  const kOnderdil=document.getElementById('k-onderdil');
  
  if(kIn) kIn.textContent=fmt(inf);
  if(kUmum) kUmum.textContent=fmt(oUmum);
  if(kTunai) kTunai.textContent=fmt(oTunai);
  if(kOnderdil) kOnderdil.textContent=fmt(oOnderdil);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• STATE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GUDANG, WA, LAPORAN helpers (moved from dead script block)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SPAREPART STOCK (terpisah dari transactions)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let gudangFilter='all';
let waDataReady=false,waTextCache='';

let sparepartStock=[];
let gudangKategori=['Ban','Oli','Filter','Spare']; // dynamic categories

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GUDANG HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
const spCatIconDefault={
  Ban:'ðŸ›ž',Oli:'ðŸ›¢ï¸',Filter:'ðŸŸ ',Spare:'ðŸ”§',Aki:'âš¡',Rem:'ðŸ”´',
  Lampu:'ðŸ’¡',Mesin:'âš™ï¸',Baut:'ðŸ”©',Tool:'ðŸ› ï¸',Bearing:'â­•',Belt:'ã€°ï¸',
  Radiator:'ðŸŒ¡ï¸',Kopling:'ðŸ”—',Knalpot:'ðŸ’¨',Body:'ðŸš›',Kaca:'ðŸªŸ',
  Listrik:'âš¡',Pompa:'ðŸ’§',Selang:'ðŸ”—',Rantai:'â›“ï¸',Gear:'âš™ï¸',
  Suspensi:'ðŸ”„',Setir:'ðŸŽ¯',Kampas:'ðŸ”´',Gasket:'ðŸ”²',Seal:'ðŸ”µ'
};
// SVG icons untuk tampil di card gudang (lebih visual)
const spCatIconSVG={
  Ban:`<svg viewBox="0 0 32 32" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Dinding luar ban truk tebal -->
    <circle cx="16" cy="16" r="14" stroke="#1e1e1e" stroke-width="4" fill="#2d2d2d"/>
    <!-- Tapak kembang ban (tread blocks) melingkar -->
    <circle cx="16" cy="16" r="14" stroke="#555" stroke-width="1.5" stroke-dasharray="4.4 2.2" fill="none"/>
    <!-- Dinding samping (sidewall) ban -->
    <circle cx="16" cy="16" r="9.5" stroke="#444" stroke-width="1" fill="#3a3a3a"/>
    <!-- Pelek velg -->
    <circle cx="16" cy="16" r="6" stroke="#9CA3AF" stroke-width="2" fill="#6B7280"/>
    <!-- Pusat roda/hub -->
    <circle cx="16" cy="16" r="2.5" fill="#D1D5DB"/>
    <!-- Baut roda (lug nuts) -->
    <circle cx="16" cy="10" r="1" fill="#9CA3AF"/>
    <circle cx="16" cy="22" r="1" fill="#9CA3AF"/>
    <circle cx="10" cy="16" r="1" fill="#9CA3AF"/>
    <circle cx="22" cy="16" r="1" fill="#9CA3AF"/>
    <circle cx="11.5" cy="11.5" r="1" fill="#9CA3AF"/>
    <circle cx="20.5" cy="20.5" r="1" fill="#9CA3AF"/>
    <circle cx="20.5" cy="11.5" r="1" fill="#9CA3AF"/>
    <circle cx="11.5" cy="20.5" r="1" fill="#9CA3AF"/>
  </svg>`,
  Oli:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#EAB308" stroke-width="2"><path d="M3 3h18v13a3 3 0 01-3 3H6a3 3 0 01-3-3V3z"/><path d="M3 8h18"/></svg>`,
  Aki:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#F59E0B" stroke-width="2"><rect x="2" y="7" width="20" height="12" rx="2"/><path d="M7 7V5M17 7V5M10 13l2-2v4"/></svg>`,
  Filter:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#F97316" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
  Rem:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#EF4444" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>`,
  Lampu:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#FBBF24" stroke-width="2"><path d="M9 21h6M12 3a6 6 0 016 6c0 2.2-1.2 4.1-3 5.2V17H9v-2.8A6 6 0 0112 3z"/></svg>`,
};
function getSpCatIcon(kat, svg=false){
  if(!kat) return 'ðŸ“¦';
  if(svg && spCatIconSVG[kat]) return spCatIconSVG[kat];
  if(spCatIconDefault[kat]) return spCatIconDefault[kat];
  const k=kat.toLowerCase();
  if(k.includes('ban')||k.includes('tire')||k.includes('roda')) return svg&&spCatIconSVG['Ban']?spCatIconSVG['Ban']:'ðŸ›ž';
  if(k.includes('oli')||k.includes('oil')||k.includes('pelumas')||k.includes('grease')) return svg&&spCatIconSVG['Oli']?spCatIconSVG['Oli']:'ðŸ›¢ï¸';
  if(k.includes('aki')||k.includes('baterai')||k.includes('accu')||k.includes('battery')) return svg&&spCatIconSVG['Aki']?spCatIconSVG['Aki']:'âš¡';
  if(k.includes('rem')||k.includes('brake')||k.includes('kampas')) return 'ðŸ”´';
  if(k.includes('filter')) return svg&&spCatIconSVG['Filter']?spCatIconSVG['Filter']:'ðŸŸ ';
  if(k.includes('lampu')||k.includes('light')||k.includes('bohlam')||k.includes('led')) return svg&&spCatIconSVG['Lampu']?spCatIconSVG['Lampu']:'ðŸ’¡';
  if(k.includes('truk')||k.includes('tronton')||k.includes('fuso')||k.includes('trailer')) return 'ðŸšš';
  if(k.includes('pickup')||k.includes('losbak')||k.includes('blindvan')) return 'ðŸ›»';
  if(k.includes('mobil')||k.includes('car')||k.includes('kendaraan')) return 'ðŸš—';
  if(k.includes('alat berat')||k.includes('traktor')||k.includes('excavator')||k.includes('forklift')) return 'ðŸšœ';
  if(k.includes('tambah')||k.includes('baru')||k.includes('plus')) return 'âž•';
  if(k.includes('mesin')||k.includes('engine')||k.includes('motor')) return 'âš™ï¸';
  if(k.includes('baut')||k.includes('mur')||k.includes('bolt')||k.includes('screw')) return 'ðŸ”©';
  if(k.includes('kunci')||k.includes('obeng')||k.includes('tang')||k.includes('tool')||k.includes('alat')) return 'ðŸ› ï¸';
  if(k.includes('dongkrak')||k.includes('katrol')||k.includes('kerekan')||k.includes('jack')) return 'ðŸ—ï¸';
  if(k.includes('kopling')||k.includes('clutch')) return 'ðŸ”—';
  if(k.includes('knalpot')||k.includes('exhaust')||k.includes('muffler')||k.includes('asap')) return 'ðŸ’¨';
  if(k.includes('radiator')||k.includes('coolant')||k.includes('pendingin')) return 'ðŸŒ¡ï¸';
  if(k.includes('pompa')||k.includes('pump')||k.includes('air')) return 'ðŸ’§';
  if(k.includes('kaca')||k.includes('glass')||k.includes('cermin')||k.includes('spion')) return 'ðŸªŸ';
  if(k.includes('wiper')||k.includes('karet kaca')) return 'ðŸª’';
  if(k.includes('selang')||k.includes('hose')||k.includes('pipa')) return 'ðŸ”—';
  if(k.includes('suspensi')||k.includes('shock')||k.includes('per ')||k.includes('pegas')) return 'ðŸ”„';
  if(k.includes('gear')||k.includes('transmisi')||k.includes('gardan')) return 'âš™ï¸';
  if(k.includes('velg')||k.includes('pelek')||k.includes('rim')||k.includes('steer')||k.includes('setir')) return 'ðŸ›ž';
  if(k.includes('cat ')||k.includes('paint')||k.includes('dempul')||k.includes('thinner')) return 'ðŸŽ¨';
  if(k.includes('klakson')||k.includes('horn')||k.includes('telolet')||k.includes('toa')) return 'ðŸ“£';
  if(k.includes('kabin')||k.includes('cabin')||k.includes('jok')||k.includes('kursi')) return 'ðŸ’º';
  if(k.includes('sensor')||k.includes('indikator')||k.includes('gps')) return 'ðŸ“¡';
  if(k.includes('bearing')||k.includes('laher')||k.includes('laker')) return 'ðŸ§¿';
  if(k.includes('terpal')||k.includes('tenda')||k.includes('tutup')) return 'â›º';
  if(k.includes('tali')||k.includes('strap')||k.includes('klem')||k.includes('webbing')) return 'ðŸª¢';
  if(k.includes('listrik')||k.includes('elektrik')||k.includes('kabel')||k.includes('wiring')) return 'âš¡';
  if(k.includes('gembok')||k.includes('kunci ganda')||k.includes('segel')) return 'ðŸ”’';
  if(k.includes('body')||k.includes('karoseri')||k.includes('plat')||k.includes('bumper')) return 'ðŸš›';
  return 'ðŸ“¦';
}

// Auto-detect icon saat user mengetik nama onderdil
function autoDetectIcon(namaInput){
  const el=document.getElementById('sp-kat');
  if(!el||!namaInput) return;
  const n=namaInput.toLowerCase();
  let detected='';
  if(n.includes('ban')||n.includes('tire')) detected='Ban';
  else if(n.includes('oli')||n.includes('oil')) detected='Oli';
  else if(n.includes('aki')||n.includes('accu')) detected='Aki';
  else if(n.includes('rem')||n.includes('brake')||n.includes('kampas')) detected='Rem';
  else if(n.includes('filter')) detected='Filter';
  else if(n.includes('lampu')||n.includes('bohlam')) detected='Lampu';
  else if(n.includes('mesin')||n.includes('engine')) detected='Mesin';
  else if(n.includes('baut')||n.includes('mur')||n.includes('screw')) detected='Baut';
  else if(n.includes('kunci')||n.includes('obeng')||n.includes('tang')) detected='Tool';
  else if(n.includes('truk')||n.includes('mobil')||n.includes('kendaraan')) detected='Armada';
  else if(n.includes('kaca')||n.includes('wiper')||n.includes('spion')) detected='Kaca';
  else if(n.includes('cat ')||n.includes('dempul')||n.includes('thinner')) detected='Cat';
  
  if(detected && el.value!==detected){
    // Update daftar bila kategori yang dideteksi belum ada sama sekali
    if(!gudangKategori.includes(detected)) {
       gudangKategori.push(detected);
       gudangKategori.sort();
       apiFetch('/api/settings', { method: 'POST', body: { key: 'inventory_categories', value: JSON.stringify(gudangKategori) } });
       el.innerHTML = '<option value="">Pilih Kategori...</option>' + gudangKategori.map(c=>'<option value="'+c+'">'+c+'</option>').join('');
    }
    
    // Hanya auto-set jika belum diubah / masih null
    if(!el.value||el.value===gudangKategori[0]||el.value===''){
      el.value=detected;
      // Visual feedback
      const preview=document.getElementById('cat-icon-preview');
      if(preview) preview.textContent=getSpCatIcon(detected);
    }
  }
}

function setGudangFilter(f,btn){
  gudangFilter=f;
  document.querySelectorAll('#page-gudang .fs-chip').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderGudang();
}

function renderGudang(){
  const grid=document.getElementById('sp-grid');
  if(!grid)return;
  
  // Filter & Search
  let list=[...sparepartStock];
  if(gudangFilter!=='all') list=list.filter(s=>s.kategori===gudangFilter);
  if(window._gudangSearch) {
    const s = window._gudangSearch.toLowerCase();
    list=list.filter(item=>item.nama.toLowerCase().includes(s)||item.spek.toLowerCase().includes(s));
  }
  if(window._gudangStokFilter){
    if(window._gudangStokFilter==='habis') list=list.filter(s=>s.stokSisa<=0);
    else if(window._gudangStokFilter==='rendah') list=list.filter(s=>s.stokSisa>0 && s.stokSisa<=s.stokMin);
    else if(window._gudangStokFilter==='cukup') list=list.filter(s=>s.stokSisa>s.stokMin);
  }
  
  // Sorting
  list.sort((a,b)=>{
    let va=a[window._gudangSortBy||'nama'], vb=b[window._gudangSortBy||'nama'];
    if(window._gudangSortBy==='stok') { va=a.stokSisa; vb=b.stokSisa; }
    if(typeof va==='string') return window._gudangSortDir==='asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    return window._gudangSortDir==='asc' ? va-vb : vb-va;
  });

  // Render Stats (Samsung UI Header)
  const totItem=sparepartStock.length;
  const totInst=sparepartStock.reduce((s,p)=>s+(p.installed?p.installed.length:0),0);
  const totCrit=sparepartStock.filter(s=>spStatus(s)==='critical').length;
  const totVal=sparepartStock.reduce((s,p)=>s+(p.stokSisa*p.hargaSatuan),0);
  
  const gt=document.getElementById('gh-total'); if(gt) gt.textContent=totItem;
  const gi=document.getElementById('gh-installed'); if(gi) gi.textContent=totInst;
  const gc=document.getElementById('gh-critical'); if(gc) gc.textContent=totCrit;
  const gn=document.getElementById('gh-nilai'); if(gn) gn.textContent=fmt(totVal);

  if(!list.length){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text3);font-size:13px;background:var(--bg3);border-radius:22px;">â˜¹ï¸ Tidak ada item ditemukan</div>';
    return;
  }

  grid.innerHTML=list.map(sp=>{
    const s=spStatus(sp); // critical, warn, fresh
    const badgeText=spStatusLabel(sp);
    const icon=getSpCatIcon(sp.kategori, true);
    const pct=Math.round((sp.stokSisa/sp.stokAwal)*100)||0;
    
    return `<div class="sp-card ${s}">
      <div class="sp-card-hdr">
        <div class="sp-icon-box" style="background:var(--bg3);">${icon}</div>
        <div style="flex:1;min-width:0;">
          <div class="sp-nama">${sp.nama}</div>
          <div class="sp-kat">${sp.kategori} Â· ${sp.spek}</div>
        </div>
        <button class="sp-edit-btn" onclick="openAddStockModal('${sp.id}')">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      </div>

      <div class="sp-card-body">
        <div class="sp-stok-row">
          <div class="sp-stok-main">
            <span class="sp-stok-v">${sp.stokSisa}</span>
            <span class="sp-stok-u">/ ${sp.stokAwal} Unit</span>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;font-weight:700;color:var(--${s==='fresh'?'success':s==='warn'?'warning':'danger'});">${badgeText}</div>
            <div style="font-size:9px;color:var(--text3);margin-top:2px;">Target min ${sp.stokMin}</div>
          </div>
        </div>
        <div style="height:6px;background:var(--card-b);border-radius:10px;overflow:hidden;margin-top:2px;">
          <div style="width:${pct}%;height:100%;border-radius:10px;background:var(--${s==='fresh'?'success':s==='warn'?'warning':'danger'});transition:width .8s ease;"></div>
        </div>
      </div>

      <div class="sp-price">ðŸ’° Rp ${fmt(sp.hargaSatuan)}</div>
      <div class="sp-toko">ðŸª ${sp.toko || 'â€”'} Â· ${sp.nota || 'Tanpa Nota'}</div>

      <div class="sp-card-foot" style="margin-top:16px;">
        <button class="sp-btn-act pasang" onclick="openModal('outflow', {spId:'${sp.id}'})">
          <svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          Pasang Baru
        </button>
        <button class="sp-btn-act history" onclick="toggleSpUsage('${sp.id}')" id="btn-usage-${sp.id}">
          ðŸ“‹ Riwayat (${sp.installed?.length||0})
        </button>
      </div>

      <div class="sp-usage-list" id="usage-${sp.id}">
        ${(sp.installed&&sp.installed.length) 
          ? sp.installed.slice().reverse().map((ins, idx)=>`<div class="sp-usage-item" onclick="openArmadaUsagePopup('${sp.id}', ${sp.installed.length-1-idx})">
              <div style="display:flex;flex-direction:column;">
                <span style="font-size:11px;font-weight:800;color:var(--text);">ðŸš› ${ins.armada}</span>
                <span style="font-size:9px;color:var(--text3);">${fmtDate(ins.tglPasang)}</span>
              </div>
              <span class="usage-rit">${ins.ritase} rit</span>
            </div>`).join('')
          : '<div style="font-size:10px;color:var(--text4);text-align:center;padding:15px;">Belum ada riwayat pemasangan</div>'
        }
      </div>
    </div>`;
  }).join('');
}

function toggleSpUsage(id){
  const el=document.getElementById('usage-'+id);
  if(el) el.classList.toggle('open');
  vibrate(10);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// KATEGORI GUDANG - Dynamic Management
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

// â”€â”€ ONDERDIL: Armada Usage Popup (#7) â”€â”€
function openArmadaUsagePopup(spId, instIdx){
  const sp=sparepartStock.find(s=>String(s.id)===String(spId));
  if(!sp||!sp.installed[instIdx])return;
  const i=sp.installed[instIdx];
  const f=fleetData.find(x=>x.nopol===i.armada);
  const freeze=f&&f.status==='bengkel';
  const threshold=getRitaseThreshold(sp.kategori)||200;
  const pct=Math.min(100,Math.round((i.ritase/threshold)*100));
  const sisa=Math.max(0,threshold-i.ritase);
  const barColor=pct>=90?'var(--danger)':pct>=70?'var(--warning)':'var(--success)';
  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('sm-body');
  tEl.textContent='Detail Penggunaan';
  body.innerHTML=`<div style="display:grid;gap:10px;">
    <div style="background:var(--bg3);border-radius:12px;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div><div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:2px;">No. Polisi</div><div style="font-size:14px;font-weight:800;">${i.armada}</div></div>
      <div><div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:2px;">Driver</div><div style="font-size:13px;color:var(--text2);">${f?f.driver:'â€”'}</div></div>
      <div><div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:2px;">Dipasang</div><div style="font-size:12px;color:var(--text2);">${fmtDate(i.tglPasang)||'â€”'}</div></div>
      <div><div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:2px;">Status</div><div style="font-size:12px;">${freeze?'<span style="color:var(--info);">â„ Bengkel</span>':'<span style="color:var(--success);">âœ… Aktif</span>'}</div></div>
    </div>
    <div style="background:var(--bg3);border-radius:12px;padding:12px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:11px;font-weight:700;">Ritase Terpakai</span>
        <span style="font-size:11px;font-weight:700;">${i.ritase} / ${threshold}</span>
      </div>
      <div style="background:var(--bg4);border-radius:6px;height:10px;overflow:hidden;margin-bottom:6px;">
        <div style="height:100%;border-radius:6px;background:${barColor};width:${pct}%;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="font-size:10px;color:var(--text3);">Sisa: ${sisa} ritase</span>
        <span style="font-size:10px;font-weight:700;color:${barColor};">${pct}% terpakai</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;">
      <button onclick="showPage('armada',document.getElementById('sb-armada'),'bn-armada');closeSm();" style="padding:11px;border-radius:12px;border:none;background:var(--bg3);color:var(--text2);font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">ðŸš› Detail Armada</button>
      <button onclick="deleteUsage('${sp.id}','${i.id}')" style="padding:11px;border-radius:12px;border:none;background:rgba(224,48,48,.1);color:var(--danger);font-size:11px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">ðŸ—‘ï¸ Hapus Pasang</button>
    </div>
  </div>`;

  document.getElementById('sm-overlay').classList.add('open');
}

// â”€â”€ ONDERDIL: Filter & Sort Menu (#9) â”€â”€
window._gudangSearch='';window._gudangStokFilter='';window._gudangSortBy='nama';window._gudangSortDir='asc';
function openGudangFilterMenu(){
  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('sm-body');
  tEl.textContent='âš™ï¸ Filter & Sort Onderdil';
  const stokOpts=[['','Semua'],['habis','Habis'],['rendah','Rendah'],['cukup','Cukup']];
  const sortOpts=[['nama','Nama'],['stok','Stok'],['kategori','Kategori']];
  body.innerHTML=`<div style="display:grid;gap:14px;">
    <div>
      <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Cari</div>
      <input class="form-input" id="gf-search" value="${_gudangSearch}" placeholder="Nama onderdil..."/>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Status Stok</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${stokOpts.map(([v,l])=>`<label style="display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:20px;border:1.5px solid ${_gudangStokFilter===v?'var(--green)':'var(--card-b)'};background:${_gudangStokFilter===v?'var(--green-bg)':'var(--card)'};cursor:pointer;font-size:12px;font-weight:600;"><input type="radio" name="gf-stok" value="${v}" ${_gudangStokFilter===v?'checked':''}> ${l}</label>`).join('')}</div>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Urutkan</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${sortOpts.map(([v,l])=>`<label style="display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:20px;border:1.5px solid ${_gudangSortBy===v?'var(--green)':'var(--card-b)'};background:${_gudangSortBy===v?'var(--green-bg)':'var(--card)'};cursor:pointer;font-size:12px;font-weight:600;"><input type="radio" name="gf-sort" value="${v}" ${_gudangSortBy===v?'checked':''}> ${l}</label>`).join('')}
      <label style="display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:20px;border:1.5px solid ${_gudangSortDir==='desc'?'var(--orange)':'var(--card-b)'};background:${_gudangSortDir==='desc'?'var(--orange-bg)':'var(--card)'};cursor:pointer;font-size:12px;font-weight:600;"><input type="checkbox" id="gf-desc" ${_gudangSortDir==='desc'?'checked':''}> Zâ†’A</label>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button onclick="resetGudangFilter()" style="padding:10px;border-radius:11px;border:1px solid var(--card-b);background:var(--bg3);color:var(--text2);font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">Reset</button>
      <button onclick="applyGudangFilter()" style="padding:10px;border-radius:11px;border:none;background:var(--green-bg);color:var(--green2);font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">âœ“ Terapkan</button>
    </div>
  </div>`;
  document.getElementById('sm-overlay').classList.add('open');
}
function applyGudangFilter(){
  _gudangSearch=document.getElementById('gf-search')?.value?.toLowerCase()||'';
  const sr=document.querySelector('input[name="gf-stok"]:checked');_gudangStokFilter=sr?sr.value:'';
  const so=document.querySelector('input[name="gf-sort"]:checked');_gudangSortBy=so?so.value:'nama';
  _gudangSortDir=document.getElementById('gf-desc')?.checked?'desc':'asc';
  closeSm();renderGudang();
}
function resetGudangFilter(){
  _gudangSearch='';_gudangStokFilter='';_gudangSortBy='nama';_gudangSortDir='asc';
  closeSm();renderGudang();
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
    <div style="font-size:10.5px;color:var(--text3);margin-top:8px;padding:8px 10px;background:var(--bg3);border-radius:9px;">ðŸ’¡ Kategori yang dihapus tidak menghapus item yang sudah ada.</div>`;
  _renderKatList();
  document.getElementById('sm-overlay').classList.add('open');
}

async function addKategori(){
  const input=document.getElementById('kat-new-name');
  const nama=(input?.value||'').trim();
  if(!nama){showToast('Nama kategori tidak boleh kosong');return;}
  if(gudangKategori.includes(nama)){showToast('Kategori sudah ada');return;}
  gudangKategori.push(nama);
  input.value='';
  
  try {
    await apiFetch('/api/settings', { method: 'POST', body: { key: 'inventory_categories', value: JSON.stringify(gudangKategori) } });
    _renderKatList();
    renderGudangFilterChips();
    showToast('Kategori "'+nama+'" ditambahkan');vibrate(20);
  } catch(e) { 
    gudangKategori = gudangKategori.filter(k=>k!==nama); // Rollback
    console.warn('Failed to save categories:', e); 
    showToast('âŒ Gagal tambah kategori: ' + (e.message || 'Periksa koneksi server'));
    _renderKatList();
  }
}


async function deleteKategori(nama){
  const itemsInUse = sparepartStock.filter(s=>s.kategori===nama);
  if(itemsInUse.length > 0){
    const force = confirm(`Kategori "${nama}" masih digunakan oleh ${itemsInUse.length} barang.\n\nTetap hapus kategori ini? Barang-barang tersebut akan otomatis diubah ke kategori "Spare".`);
    if(!force) return;
    
    // Auto re-categorize items to 'Spare' locally
    itemsInUse.forEach(s => {
      s.kategori = 'Spare';
      // Note: Ideally we should update these in the DB too via API, 
      // but for now, we'll rely on the user manually fixing them or 
      // just being okay with 'Spare' category if they click force.
    });
  }

  gudangKategori=gudangKategori.filter(k=>k!==nama);
  
  // Save updated categories to Backend
  try {
    await apiFetch('/api/settings', { 
      method: 'POST', 
      body: { key: 'inventory_categories', value: JSON.stringify(gudangKategori) } 
    });
    _renderKatList();
    renderGudangFilterChips();
    renderGudang(); 
    showToast('Kategori "'+nama+'" dihapus (Paksa)');vibrate(30);
  } catch(e) {
    // Rollback local state if server fails
    gudangKategori = [...gudangKategori, nama].sort();
    console.warn('Failed to save categories after delete:', e);
    showToast('âŒ Gagal hapus kategori: ' + (e.message || 'Periksa koneksi'));
    _renderKatList();
  }

}


function renderGudangFilterChips(){
  const el=document.getElementById('gudang-filter-chips');
  if(!el) return;
  el.innerHTML='<button class="fs-chip filter-chip'+(gudangFilter==='all'?' active':'')+'" onclick="setGudangFilter(\'all\',this)">Semua</button>'
    +gudangKategori.map(k=>'<button class="fs-chip filter-chip'+(gudangFilter===k?' active':'')+'" onclick="setGudangFilter(\''+k+'\',this)">'+getSpCatIcon(k)+' '+k+'</button>').join('');
}

function openAddStockModal(editId){
  const sp=editId?sparepartStock.find(s=>String(s.id)===String(editId)):null;
  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('sm-body');
  tEl.textContent=sp?'Edit Item Stok':'Tambah Stok Baru';
  body.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;">'
    +'<div style="grid-column:1/-1;"><label class="form-label">ðŸ“¦ Nama Barang</label><input class="form-input" id="sp-nama" value="'+(sp?sp.nama:'')+'" placeholder="Nama onderdil..." oninput="autoDetectIcon(this.value)"/></div>'
    +'<div style="grid-column:1/-1;"><label class="form-label">ðŸ·ï¸ Spek / Tipe</label><input class="form-input" id="sp-spek" value="'+(sp?sp.spek:'')+'" placeholder="Ukuran, kode, merk..."/></div>'
    +'<div><label class="form-label">Kategori</label><select class="form-select" id="sp-kat">'
    +gudangKategori.map(k=>'<option value="'+k+'"'+(sp&&sp.kategori===k?' selected':'')+'>'+getSpCatIcon(k)+' '+k+'</option>').join('')
    +'</select></div>'
    +'<div><label class="form-label">ðŸª Toko</label><input class="form-input" id="sp-toko" value="'+(sp?sp.toko:'')+'" placeholder="Nama toko..."/></div>'
    +'<div><label class="form-label">No. Nota</label><input class="form-input" id="sp-nota" value="'+(sp?sp.nota:'')+'" placeholder="SP-001"/></div>'
    +'<div><label class="form-label">ðŸ“… Tgl Masuk</label><input type="date" class="form-input" id="sp-tgl" value="'+(sp?sp.tglMasuk:today())+'"/></div>'
    +'<div><label class="form-label">Jumlah</label><input class="form-input" id="sp-jml" type="number" value="'+(sp?sp.stokAwal:'')+'" placeholder="Qty"/></div>'
    +'<div><label class="form-label">Harga/unit (Rp)</label><input class="form-input" id="sp-harga" value="'+(sp?new Intl.NumberFormat('id-ID').format(sp.hargaSatuan):'')+'" placeholder="0" inputmode="numeric"/></div>'
    +'</div>'
    +'<div style="font-size:10.5px;color:var(--text3);background:var(--bg3);border-radius:10px;padding:9px 11px;line-height:1.6;">ðŸ’¡ Stok masuk tanpa potong kas â€” sistem tempo.</div>'
    +'<button class="sm-btn orange" onclick="saveSparepart(\''+(editId||'')+'\')">'+(sp?'Simpan':'Tambah Stok')+'</button>'
    +(sp?'<button class="sm-btn danger" onclick="deleteSparepart(\''+sp.id+'\')">Hapus Item</button>':'');
  setupCurrencyInput('sp-harga');
  document.getElementById('sm-overlay').classList.add('open');
}

async function saveSparepart(editId){
  const nama=document.getElementById('sp-nama')?.value?.trim(),spek=document.getElementById('sp-spek')?.value?.trim(),kat=document.getElementById('sp-kat')?.value||'Spare',toko=document.getElementById('sp-toko')?.value?.trim()||'',nota=document.getElementById('sp-nota')?.value?.trim()||'',tgl=document.getElementById('sp-tgl')?.value||today(),jmlRaw=document.getElementById('sp-jml')?.value||'',jml=parseInt(jmlRaw.toString().replace(/\D/g,''))||0,harga=getRaw('sp-harga')||0;
  if(!nama){showToast('Nama barang tidak boleh kosong');return;}
  if(!spek){showToast('Spek/tipe tidak boleh kosong');return;}
  if(jml<=0){showToast('Jumlah harus lebih dari 0');return;}
  try {
    if(editId){
      const sp=sparepartStock.find(s=>String(s.id)===String(editId));
      if(sp){
        const dbData = { nama, spek, kategori: kat, toko, nota, tgl_masuk: tgl, stok_awal: jml, stok_sisa: Math.min(isNaN(sp.stokSisa)?jml:sp.stokSisa,jml), harga_satuan: isNaN(harga)?0:harga, catatan: sp.catatan };
        await sbFetch('inventory',{method:'PATCH',filters:{id:editId},body:dbData});
      }
    } else {
      const spId = 'sp'+Date.now();
      const dbData = { id: spId, nama, spek, kategori: kat, toko, nota, tgl_masuk: tgl, stok_awal: jml, stok_sisa: jml, harga_satuan: isNaN(harga)?0:harga, catatan: '', installed: [] };
      await sbFetch('inventory',{method:'POST',body:dbData});
    }
    await syncFromSupabase();
    closeSm();
    showToast(editId?'Item diperbarui':'Stok ditambahkan');
    vibrate(30);
  } catch(e) {
    console.warn('Sync sparepart gagal:', e);
    showToast('âŒ Gagal menyimpan data gudang. Periksa koneksi server.');
  }

}

async function deleteSparepart(id){
  const sp = sparepartStock.find(s=>String(s.id)===String(id));
  if(!sp) return;
  
  showConfirmPopup('ðŸ—‘ï¸ Hapus Paksa Item', 
    `Hapus master data item: <b>${sp.nama}</b> (Spek: ${sp.spek})?<br><br><span style="color:var(--danger);font-size:11px;">âš ï¸ <b>Peringatan Hapus Paksa:</b> Tindakan ini akan menghapus SEMUA riwayat pemakaian dan transaksi keuangan terkait item ini secara permanen.</span>`,
    async () => {
      try {
        const result = await apiFetch(`/api/inventory/${id}`, { method: 'DELETE' });
        if (!result || result.ok === false) throw new Error(result?.error || 'Gagal hapus paksa');
      } catch(err) {
        if (err.status === 404) {
          console.warn('Item already gone from server (404), continuing...');
        } else {
          throw err;
        }
      }
      
      // Local update immediately
      sparepartStock = sparepartStock.filter(s => String(s.id) !== String(id));

      await syncFromSupabase();
      
      // Re-apply setelah sync untuk mencegah flicker dari race condition
      sparepartStock = sparepartStock.filter(s => String(s.id) !== String(id));
      localStorage.setItem('bhd_cache_inventory', JSON.stringify(sparepartStock));
      if(typeof renderGudang==='function') renderGudang();

      showToast('Item dan semua riwayat dihapus');
      vibrate(40);
    }
  );
}

async function deleteUsage(spId, installId){
  const sp = sparepartStock.find(s=>String(s.id)===String(spId));
  const ins = sp?.installed?.find(i=>String(i.id)===String(installId));
  if(!sp || !ins) return;

  showConfirmPopup('ðŸ—‘ï¸ Hapus Pemasangan',
    `Hapus riwayat pasang di <b>${ins.armada}</b>?<br><br>âœ… Stok <b>${sp.nama}</b> akan otomatis bertambah +1.<br>âœ… Transaksi keuangan yang terkait juga akan dihapus.`,
    async () => {
      // DELETE via backend uninstall endpoint
      // URL: DELETE /api/inventory/:id/install/:installId
      const result = await apiFetch(`/api/inventory/${spId}/install/${installId}`, { method: 'DELETE' });
      if (!result || result.ok === false) throw new Error(result?.error || 'Gagal menghapus riwayat');
      
      await syncFromSupabase();
      showToast('Pemasangan dibatalkan & stok dikembalikan');
      vibrate(40);
    }
  );
}


function openPasangModal(spId){
  const sp=sparepartStock.find(s=>String(s.id)===String(spId));if(!sp)return;
  if(sp.stokSisa<=0){showToast('Stok habis!');return;}
  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('sm-body');
  tEl.textContent='Pasang ke Armada';
  const opts=fleetData.map(f=>'<option value="'+f.nopol+'">'+f.nopol+' - '+f.driver+'</option>').join('');
  body.innerHTML='<div style="background:var(--bg3);border-radius:11px;padding:10px 12px;margin-bottom:4px;">'
    +'<div style="font-size:13px;font-weight:700;color:var(--text);">'+sp.nama+'</div>'
    +'<div style="font-size:11px;color:var(--text3);">ðŸ·ï¸ '+sp.spek+' Â· Sisa: <b>'+sp.stokSisa+'</b></div>'
    +'</div>'
    +'<div><label class="form-label">Pilih Armada</label><select class="form-select" id="pasang-armada">'+opts+'</select></div>'
    +'<div><label class="form-label">Tanggal Pasang</label><input type="date" class="form-input" id="pasang-tgl" value="'+today()+'"/></div>'
    +'<div><label class="form-label">Jumlah Dipasang</label><input class="form-input" id="pasang-jml" type="number" value="1" min="1" max="'+sp.stokSisa+'"/></div>'
    +(sp.kategori==='Ban' ? `<div><label class="form-label">Posisi Ban</label><select class="form-select" id="pasang-posisi">
        <option value="Depan Kiri">Depan Kiri</option>
        <option value="Depan Kanan">Depan Kanan</option>
        <option value="Tengah Kiri Dalam">Tengah Kiri Dalam</option>
        <option value="Tengah Kiri Luar">Tengah Kiri Luar</option>
        <option value="Tengah Kanan Dalam">Tengah Kanan Dalam</option>
        <option value="Tengah Kanan Luar">Tengah Kanan Luar</option>
        <option value="Belakang Kiri Dalam">Belakang Kiri Dalam</option>
        <option value="Belakang Kiri Luar">Belakang Kiri Luar</option>
        <option value="Belakang Kanan Dalam">Belakang Kanan Dalam</option>
        <option value="Belakang Kanan Luar">Belakang Kanan Luar</option>
      </select></div>` : '')
    +'<div style="font-size:10.5px;color:var(--text3);background:var(--orange-bg);border:1px solid var(--orange-bd);border-radius:10px;padding:9px 11px;">Pasang = potong stok + buat outflow Onderdil + tracking ritase.</div>'
    +'<button class="sm-btn orange" onclick="confirmPasang(\''+spId+'\')">Konfirmasi Pasang</button>';
  document.getElementById('sm-overlay').classList.add('open');
}

async function confirmPasang(spId){
  const sp=sparepartStock.find(s=>String(s.id)===String(spId));if(!sp)return;
  const armada=document.getElementById('pasang-armada')?.value, tgl=document.getElementById('pasang-tgl')?.value, jml=parseInt(document.getElementById('pasang-jml')?.value||'1'), posisi=document.getElementById('pasang-posisi')?.value||'';
  if(jml<1){showToast('Jumlah minimal 1');return;}
  if(jml>sp.stokSisa){showToast('Jumlah melebihi stok (sisa: '+sp.stokSisa+')');return;}
  const driver=fleetData.find(f=>f.nopol===armada)?.driver||'', outId='txn_'+Date.now();
  const newTxn={ id:outId, type:'outflow', label:sp.nama+' ('+sp.spek+') â€” '+jml+' unit'+(posisi?' ['+posisi+']':''), sub:'No.Nota: '+sp.nota+' Â· '+sp.toko+' Â· '+driver, amount:sp.hargaSatuan*jml, date:tgl, armada, nota:sp.nota, toko:sp.toko, kategori:'Onderdil', driver, status:'lunas', sparepartId:spId, jmlPasang:jml, posisi };
  const newInstalled = [...sp.installed];
  for(let i=0;i<jml;i++) newInstalled.push({ armada, tglPasang:tgl, ritase:0, txnId:outId, posisi: posisi||(jml>1?'Unit '+(i+1):'') });
  try {
    const dbTxn = {...newTxn, sparepart_id: newTxn.sparepartId}; delete dbTxn.sparepartId;
    await sbFetch('transactions', {method:'POST', body:dbTxn});
    await sbFetch('inventory', {method:'PATCH', filters:{id:spId}, body:{stok_sisa:sp.stokSisa-jml, installed:newInstalled}});
    await syncFromSupabase();
    logAudit('create','gudang',`Pasang ${sp.nama} ${jml}unit ke ${armada}${posisi?' pos:'+posisi:''}`);
    closeSm();
    refreshDetailHero();
    if(currentDetailUnit?.nopol===armada){
      const tv=document.getElementById('tab-truck');
      if(tv&&tv.style.display!=='none')renderTruckTab(currentDetailUnit);
    }
    showToast('Pemasangan terekam âœ…');
  } catch(e) {
    console.warn('Gagal pasang sparepart:', e);
    showToast('âŒ Gagal menyimpan pemasangan. Periksa koneksi server.');
  }

}


// Ritase thresholds per kategori
const RITASE_THRESHOLDS={Ban:100,Oli:50,Filter:80,Spare:60};
function getRitaseThreshold(kategori){
  return RITASE_THRESHOLDS[kategori]||50;
}

// Dipanggil saat submitInflow â€” hitung ritase berdasarkan trip baru
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
        warnings.push(sp.nama+': '+i.ritase+'/'+threshold+' ritase âš ï¸');
      }
    });
  });
  if(warnings.length){
    setTimeout(()=>warnings.forEach(w=>showToast('ðŸ”§ '+w)),900);
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// WA SUMMARY with Refresh
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•


function buildWAText(){
  const now=new Date();
  const todayStr=today();
  const todayTxn=transactions.filter(t=>t.date===todayStr);
  const inf=totalInflow(todayTxn),out=totalOutflow(todayTxn),net=inf-out;
  const bulanIni=transactions.filter(t=>{const d=new Date(t.date+'T00:00:00');return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
  const bInf=totalInflow(bulanIni),bOut=totalOutflow(bulanIni),bNet=bInf-bOut;
  const cnt={jalan:0,antre:0,bengkel:0};
  fleetData.forEach(f=>cnt[f.status]=(cnt[f.status]||0)+1);
  const SEP='â”'.repeat(22);
  // Per-armada summary for today
  const armadaTodayLines=fleetData.map(f=>{
    const fInf=todayTxn.filter(t=>t.type==='inflow'&&t.armada===f.nopol).reduce((s,t)=>s+t.amount,0);
    if(fInf===0) return null;
    return '  ðŸš› '+f.nopol+' ('+f.driver+'): +'+fmtFull(fInf);
  }).filter(Boolean);
  // Outflow today
  const outTodayLines=todayTxn.filter(t=>t.type==='outflow').map(t=>'  ðŸ’¸ '+t.label+' ['+t.kategori+']: -'+fmtFull(t.amount));
  const docW=fleetData.filter(f=>daysUntil(f.pajak)<=30||daysUntil(f.kir)<=30);
  const docTxt=docW.length?docW.map(f=>{
    const p=daysUntil(f.pajak),k=daysUntil(f.kir);
    let w='';if(p<=30)w+='Pajak '+f.nopol+' '+p+'h ';if(k<=30)w+='KIR '+f.nopol+' '+k+'h';
    return '  âš ï¸ '+w.trim();
  }).join('\n'):'  âœ… Semua dokumen aman';
  const kritis=sparepartStock.filter(s=>spStatus(s)==='critical');
  const kritTxt=kritis.length?kritis.map(s=>'  âš ï¸ '+s.nama+' - Sisa '+s.stokSisa+' unit').join('\n'):'  âœ… Stok dalam kondisi aman';
  const tglStr=now.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const lines=[
    'ðŸšš *LAPORAN BHD SmartFlow*',
    'ðŸ“… '+tglStr,SEP,
    '*ðŸ“Š RINGKASAN HARI INI*',
    '  ðŸ’° Inflow  : '+fmtFull(inf),
    '  ðŸ’¸ Outflow : '+fmtFull(out),
    '  ðŸ“ˆ Nett    : '+(net>=0?'âœ… ':' ')+'*'+fmtFull(net)+'*',
  ];
  if(armadaTodayLines.length){lines.push('');lines.push('*Status Armada Hari Ini:*');}
  lines.push(SEP);
  lines.push('*ðŸš› STATUS ARMADA ('+fleetData.length+' unit)*');
  lines.push('  ðŸŸ¢ Jalan   : '+cnt.jalan+' unit');
  lines.push('  ðŸŸ¡ Antre   : '+cnt.antre+' unit');
  lines.push('  ðŸ”´ Bengkel : '+cnt.bengkel+' unit');
  lines.push(SEP);
  lines.push('*ðŸ“… KAS BULAN INI*');
  lines.push('  ðŸ’° Inflow  : '+fmtFull(bInf));
  lines.push('  ðŸ’¸ Outflow : '+fmtFull(bOut));
  lines.push('  ðŸ“ˆ Nett    : '+(bNet>=0?'âœ… ':' ')+'*'+fmtFull(bNet)+'*');
  lines.push(SEP);
  lines.push('*ðŸ“‹ URGENCY DOKUMEN*');lines.push(docTxt);
  lines.push(SEP);
  lines.push('*ðŸ“¦ STOK KRITIS*');lines.push(kritTxt);
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// LAPORAN: Per-Armada Table
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GRAFIK: custom date chart
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// END HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• UTILS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function fmt(n){if(!n&&n!==0)return 'â€”';const a=Math.abs(n);if(a>=1e9)return'Rp '+(n/1e9).toFixed(1)+'M';if(a>=1e6)return'Rp '+(n/1e6).toFixed(1)+'Jt';if(a>=1e3)return'Rp '+(n/1e3).toFixed(0)+'Rb';return'Rp '+n;}
function fmtFull(n){return'Rp '+new Intl.NumberFormat('id-ID').format(Math.round(n));}
function fmtDate(d){if(!d)return'â€”';return new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});}
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• CLOCK â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function updateClocks(){
  const now=new Date();
  const hms=now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const ds=now.toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  ['sb-clock','tb-clock','hero-clock'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=hms;});
  const hd=document.getElementById('hero-date');if(hd)hd.textContent=ds;
  const sd=document.getElementById('sb-date');if(sd)sd.textContent=ds;
}
setInterval(updateClocks,1000);updateClocks();

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• PERIOD FILTER â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• COMPUTED â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function totalInflow(list){return list.filter(t=>t.type==='inflow').reduce((s,t)=>s+t.amount,0);}
function totalOutflow(list){return list.filter(t=>t.type==='outflow').reduce((s,t)=>s+t.amount,0);}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• DOC WARN â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function checkDocWarnings(){
  const w=fleetData.some(f=>daysUntil(f.pajak)<=7||daysUntil(f.kir)<=7);
  ['sb-armada-badge','bn-armada-badge'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display=w?'':'none';});
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• SKELETON â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• PERIOD COMPARISON â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• RENDER DASHBOARD â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function renderDashboard(){
  const filtered=filterByPeriod(transactions);
  const inf=totalInflow(filtered),out=totalOutflow(filtered),prf=inf-out;
  const margin=inf>0?((prf/inf)*100).toFixed(1):0;
  const perUnit=Math.round(out/FLEET_COUNT);
  // Real comparison vs previous period
  const _prev=getPrevPeriodTxns();const _pi=totalInflow(_prev),_po=totalOutflow(_prev),_pp=_pi-_po;
  const _pct=(c,p)=>p!==0?((c-p)/Math.abs(p)*100).toFixed(0)+'%':c>0?'baru':'â€”';
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
    const ci=document.getElementById('cmp-in');if(ci){const _u=inf>=_pi;ci.textContent=(_u?'â†‘':'â†“')+' '+cmpIn;ci.className='cmp-badge '+(_u?'up':'dn');}
    const co=document.getElementById('cmp-out');if(co){const _u=out>_po;co.textContent=(_u?'â†‘':'â†“')+' '+cmpOut;co.className='cmp-badge '+(_u?'dn':'up');}
    const cp=document.getElementById('cmp-prf');if(cp){const _u=prf>=_pp;cp.textContent=(_u?'â†‘':'â†“')+' '+cmpPrf;cp.className='cmp-badge '+(_u?'up':'dn');}
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• FLEET ROWS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• TXN CARDS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function statusBadge(s){
  if(s==='lunas')return'<span class="txn-badge tb-lunas">âœ“ Lunas</span>';
  if(s==='proses')return'<span class="txn-badge tb-proses">âŸ³ Proses</span>';
  return'<span class="txn-badge tb-pending">â³ Pending</span>';
}
const svgIn='<svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';
const svgOut='<svg viewBox="0 0 24 24"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>';


function getSmartIcon(label, type){
  const l = (label||'').toLowerCase();
  if(l.includes('ban')) return '<svg viewBox="0 0 24 24" style="stroke:var(--orange)"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg>';
  if(l.includes('aki')) return '<svg viewBox="0 0 24 24" style="stroke:var(--info)"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M9 6V4M15 6V4M7 10h4M13 10h4"/></svg>';
  if(l.includes('oli')) return '<svg viewBox="0 0 24 24" style="stroke:var(--warning)"><path d="M12 22a7 7 0 007-7c0-2-1-3.9-3-5.5s-4-4-4-4-2 2.4-4 4-3 3.5-3 5.5a7 7 0 007 7z"/></svg>';
  if(l.includes('lampu')) return '<svg viewBox="0 0 24 24" style="stroke:#FDE047"><path d="M12 2v2M5 5l1.5 1.5M2 12h2M5 19l1.5-1.5M12 20v2M19 19l-1.5-1.5M22 12h-2M19 5l-1.5 1.5M12 7a5 5 0 100 10 5 5 0 000-10z"/></svg>';
  return type==='inflow' ? svgIn : svgOut;
}

function renderTxnCards(elId,list,showActions=true){
  const el=document.getElementById(elId);if(!el)return;
  if(!list.length){el.innerHTML='<div style="text-align:center;padding:30px;color:var(--text3);font-size:12.5px;">Tidak ada transaksi ditemukan</div>';return;}
  el.innerHTML=list.map(t=>`
    <div class="txn-item" id="txn-${t.id}">
      <div class="txn-main" onclick="toggleTxn('${t.id}')">
        <div class="txn-ico ${t.type==='inflow'?'in':'out'}">${getSmartIcon(t.label, t.type)}</div>
        <div class="txn-body">
          <div class="txn-name">${t.label}</div>
          <div class="txn-meta">${t.sub} Â· ${fmtDate(t.date)}</div>
        </div>
        <div class="txn-right">
          <div class="txn-amt ${t.type==='inflow'?'in':'out'}">${t.type==='inflow'?'+':'-'}${fmt(t.amount)}</div>
          ${statusBadge(t.status||'lunas')}
        </div>
        <svg class="txn-expand-icon" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="txn-detail">
        ${t.muat?`<div class="route-row"><svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 00-8 8c0 5.25 8 13 8 13s8-7.75 8-13a8 8 0 00-8-8z"/></svg><span class="route-text">${t.muat} <b>â†’</b> ${t.bongkar}</span></div>`:''}
        <div class="txn-detail-grid">
          <div class="tdg-item"><div class="tdg-label">Tanggal</div><div class="tdg-val">${fmtDate(t.date)}</div></div>
          <div class="tdg-item"><div class="tdg-label">Armada</div><div class="tdg-val">${t.armada||'â€”'}</div></div>
          ${t.driver?`<div class="tdg-item"><div class="tdg-label">Supir</div><div class="tdg-val">${t.driver}</div></div>`:''}
          ${t.nota&&t.nota!=='â€”'?`<div class="tdg-item"><div class="tdg-label">No. Nota</div><div class="tdg-val">${t.nota}</div></div>`:''}
          ${t.toko&&t.toko!=='â€”'?`<div class="tdg-item"><div class="tdg-label">Toko</div><div class="tdg-val">${t.toko}</div></div>`:''}
          ${(t.kategori||'').toLowerCase()==='umum'?`<div class="tdg-item"><div class="tdg-label">Per Unit</div><div class="tdg-val" style="color:var(--green2);">${fmt(t.amount/FLEET_COUNT)}</div></div>`:''}
        </div>
        ${showActions?`<div class="txn-actions">
          <button class="txn-act-btn edit" onclick="editTxn('${t.id}')"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit</button>
          <button class="txn-act-btn del" onclick="deleteTxn('${t.id}')"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>Hapus</button>
        </div>`:''}
      </div>
    </div>`).join('');
}

function toggleTxn(id){
  const el=document.getElementById('txn-'+String(id));if(el)el.classList.toggle('expanded');
  vibrate(15);
}
function deleteTxn(id){
  const txn=transactions.find(t=>String(t.id)===String(id));
  if(!txn) return;
  const stockMsg = txn.type==='outflow' && txn.sparepartId
    ? '<br><span style="color:var(--success);font-size:11px;">âœ… Stok onderdil akan otomatis kembali +'+(txn.jmlPasang||1)+' unit</span>'
    : '';
  showConfirmPopup(
    'ðŸ—‘ï¸ Hapus Transaksi',
    `<b>${txn.type==='inflow'?'Pemasukan':'Pengeluaran'}</b>: ${txn.label||''}<br>
     Nominal: <b>${fmt(txn.amount)}</b> Â· ${fmtDate(txn.date)}${stockMsg}`,
    async () => {
      const waktu = new Date().toLocaleString('id-ID');
      const adminName = window.activeAdmin?.name || 'System';
      const jml = txn.jmlPasang || 1;

      try {
        // DELETE via backend API â€” backend handles inventory restore
        const result = await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
        if (!result || result.ok === false) throw new Error(result?.error || 'Hapus gagal di server');
      } catch(err) {
        if (err.status === 404) {
          console.warn('Txn already gone from server (404), unsticking locally...');
          // Continue to local deletion logic below
        } else {
          const force = confirm(`âŒ Gagal hapus di server: ${err.message}\n\nIngin paksa hapus dari layar saja (Hapus Lokal)?\n\n(Pilih ini jika item 'sangkut' di tampilan)`);
          if (!force) return;
          // Continue if user chose force local delete
        }
      }

      // Sync & UI update (Self-healing: transactions are filtered by what server has anyway)
      await syncFromSupabase();

      // Re-apply after sync to prevent data flicker due to race conditions
      transactions = transactions.filter(t => String(t.id) !== String(id));
      localStorage.setItem('bhd_cache_transactions', JSON.stringify(transactions));
      if (typeof applyTxnFilters === 'function') applyTxnFilters();


      logAudit('delete','transaksi', `[${waktu}] - [${adminName}] - [Hapus Transaksi] - [${txn.label}, Rp ${fmt(txn.amount)}${txn.sparepartId?', Qty '+jml+' unit dikembalikan':''}]`);
      refreshDetailHero();
      vibrate(40);
      showToast('Transaksi dihapus'+(txn.sparepartId?' Â· Stok +'+jml+' dikembalikan':''));
    }
  );
}


function editTxn(id){
  openModal('edit', {id});
}

function confirmSaveEditTxn(id){
  const txn=transactions.find(t=>String(t.id)===String(id));if(!txn)return;
  const newLabel=document.getElementById('et-label')?.value||txn.label;
  const newAmount=parseFloat(getRaw('et-amount'))||txn.amount;
  const newDate=document.getElementById('et-date')?.value||txn.date;
  const newArmada=document.getElementById('et-armada')?.value||txn.armada;
  const finalPosisi=(txn.sparepartId || (txn.label||'').toLowerCase().includes('ban')) ? (document.getElementById('et-pos')?.value || txn.posisi) : '';
  const newCat=document.getElementById('et-cat')?.value||txn.kategori;

  closeSm(); // In case anything is open
  closeModal();

  const waktu=new Date().toLocaleString('id-ID');
  const adminName=window.activeAdmin?.name||'System';
  
  const dbData = {
    label:newLabel,
    amount:newAmount,
    date:newDate,
    armada:newArmada,
    posisi:finalPosisi,
    kategori:newCat
  };

  sbFetch('transactions',{method:'PATCH', filters:{id:id}, body:dbData}).then(()=>{
    return syncFromSupabase();
  }).then(()=>{
    logAudit('update','transaksi', `[${waktu}] - [${adminName}] - [Edit Transaksi] - [${newLabel}, Rp ${fmt(txn.amount)}â†’${fmt(newAmount)}]`);
    refreshDetailHero();
    showToast('Transaksi berhasil diperbarui');
  }).catch(e=>{
    console.warn('Gagal update transaksi:', e);
    showToast('âŒ Gagal memperbarui transaksi.');
  });
}

// Custom confirm popup (ganti browser confirm())
function showConfirmPopup(title, message, onConfirm, onCancel){
  const smOverlay = document.getElementById('sm-overlay');
  const tEl = document.getElementById('sm-title-text');
  const body = document.getElementById('sm-body');
  if(!tEl || !body || !smOverlay) return;
  tEl.textContent = title;
  body.innerHTML = `<div style="display:grid;gap:16px;text-align:center;">
    <div style="font-size:12.5px;color:var(--text2);line-height:1.6;">${message}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <button id="confirm-cancel-btn" style="padding:10px;border-radius:9px;border:1px solid var(--card-b);background:var(--bg3);color:var(--text2);font-size:12px;font-weight:600;cursor:pointer;">Batal</button>
      <button id="confirm-ok-btn" style="padding:10px;border-radius:9px;border:none;background:var(--danger);color:#fff;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(224,48,48,.3);">Ya, Hapus</button>
    </div>
    <div id="confirm-err" style="display:none;font-size:11px;color:var(--danger);margin-top:-8px;"></div>
  </div>`;
  smOverlay.classList.add('open');
  
  setTimeout(() => {
    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    const errEl = document.getElementById('confirm-err');
    
    if(cancelBtn) cancelBtn.onclick = () => { closeSm(); if(onCancel) onCancel(); };
    
    if(okBtn) okBtn.onclick = async () => {
      // Show loading state
      okBtn.textContent = 'â³ Memproses...';
      okBtn.disabled = true;
      if(cancelBtn) cancelBtn.disabled = true;
      if(errEl) errEl.style.display = 'none';
      
      try {
        await onConfirm();
        closeSm(); // Only close on success
      } catch(e) {
        // Show error inline â€” don't close modal
        okBtn.textContent = 'Coba Lagi';
        okBtn.disabled = false;
        if(cancelBtn) cancelBtn.disabled = false;
        if(errEl) {
          errEl.textContent = 'âŒ ' + (e.message || 'Gagal. Periksa koneksi.');
          errEl.style.display = 'block';
        }
        console.error('Confirm action failed:', e);
      }
    };
  }, 50);
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• FILTER & SEARCH â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let txnFilterGroup='all';
let txnFilterCat='all';
function setTxnFilter(key,val,btn){
  if(key==='tipe'){
     txnFilterGroup=val; 
     txnFilterCat='all';
  } else if(key==='kategori') {
     txnFilterGroup='outflow';
     txnFilterCat=val;
  }
  document.querySelectorAll('#page-keuangan .fs-chip').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  txnPage=5;applyTxnFilters();
}
function applyTxnFilters(){
  txnSearch=document.getElementById('txn-search')?.value?.toLowerCase()||'';
  txnSort=document.getElementById('txn-sort')?.value||'newest';
  let list=[...transactions];
  if(txnFilterGroup!=='all')list=list.filter(t=>t.type===txnFilterGroup);
  if(txnFilterCat!=='all')list=list.filter(t=>(t.kategori||'').toLowerCase()===txnFilterCat.toLowerCase());
  if(typeof keuanganFromDate!=='undefined'&&keuanganFromDate) list=list.filter(t=>t.date>=keuanganFromDate);
  if(typeof keuanganToDate!=='undefined'&&keuanganToDate) list=list.filter(t=>t.date<=keuanganToDate);
  if(typeof keuanganArmadaFilter!=='undefined'&&keuanganArmadaFilter) list=list.filter(t=>t.armada===keuanganArmadaFilter);
  if(txnSearch)list=list.filter(t=>(t.label||'').toLowerCase().includes(txnSearch)||(t.sub||'').toLowerCase().includes(txnSearch)||(t.armada||'').toLowerCase().includes(txnSearch)||(t.driver||'').toLowerCase().includes(txnSearch));
  if(txnSort==='oldest')list.sort((a,b)=>new Date(a.date)-new Date(b.date));
  else if(txnSort==='biggest')list.sort((a,b)=>b.amount-a.amount);
  else if(txnSort==='smallest')list.sort((a,b)=>a.amount-b.amount);
  else list.sort((a,b)=>String(b.id).localeCompare(String(a.id)));
  renderTxnCards('txn-full',list.slice(0,txnPage),true);
  const lm=document.getElementById('load-more-btn');
  if(lm)lm.style.display=list.length>txnPage?'block':'none';
}
function loadMoreTxn(){txnPage+=5;applyTxnFilters();}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• CHARTS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• CASH FLOW TREND â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• ARMADA PERF CHART â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• LAPORAN â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
      if(col!==rekapSortCol)ar.textContent='â‡…';
      else ar.textContent=rekapSortDir===1?'â†‘':'â†“';
    }
  });
  tbody.innerHTML=rows.map(r=>`<tr>
    <td><div class="ar-nopol">${r.nopol}</div><span class="ar-badge ${r.status}">${r.status.charAt(0).toUpperCase()+r.status.slice(1)}</span></td>
    <td style="font-size:12px;color:var(--text2);">${r.driver}</td>
    <td class="ar-num ${r.inflow>0?'pos':'zero'}">${fmt(r.inflow)}</td>
    <td class="ar-num ${r.outTunai>0?'neg':'zero'}">${r.outTunai>0?'-'+fmt(r.outTunai):'â€”'}</td>
    <td class="ar-num ${r.outOnderdil>0?'neg':'zero'}">${r.outOnderdil>0?'-'+fmt(r.outOnderdil):'â€”'}</td>
    <td class="ar-num ${r.outUmum>0?'neg':'zero'}">${r.outUmum>0?'-'+fmt(r.outUmum):'â€”'}</td>
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
  <h1>BHD Smart Flow â€” Rekap Per Armada</h1>
  <p>PT. BAGUS HARYA DWIPRIMA Â· Periode: ${lapFilter==='bulan-ini'?'Bulan Ini':lapFilter==='bulan-lalu'?'Bulan Lalu':'Custom'} Â· Dicetak: ${new Date().toLocaleDateString('id-ID')}</p>
  <table><thead><tr><th>No. Pol</th><th>Nama Driver</th><th class="num" style="color:#12A060;">Inflow</th><th class="num">Out Tunai</th><th class="num">Out Onderdil</th><th class="num">Out Umum</th><th class="num" style="color:#2563EB;">Nett</th></tr></thead>
  <tbody>${dataRows.map(r=>`<tr>
    <td><b>${r.nopol}</b></td><td>${r.driver}</td>
    <td class="num pos">${fmtFull(r.inflow)}</td>
    <td class="num neg">${r.outTunai>0?'-'+fmtFull(r.outTunai):'â€”'}</td>
    <td class="num neg">${r.outOnderdil>0?'-'+fmtFull(r.outOnderdil):'â€”'}</td>
    <td class="num neg">${r.outUmum>0?'-'+fmtFull(r.outUmum):'â€”'}</td>
    <td class="num ${r.nett>=0?'nett-pos':'nett-neg'}">${fmtFull(r.nett)}</td>
  </tr>`).join('')}</tbody>
  <tfoot><tr><td colspan="2">TOTAL PERIODE</td><td class="num pos">${fmtFull(totInf)}</td><td class="num neg">-${fmtFull(totTunai)}</td><td class="num neg">-${fmtFull(totOnderdil)}</td><td class="num neg">-${fmtFull(umum)}</td><td class="num nett-pos">${fmtFull(totNett)}</td></tr></tfoot>
  </table></body></html>`);
  w.document.close();w.print();showToast('Laporan PDF siap cetak');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• ARMADA MANAGEMENT â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
        <div class="fcu-nopol">${f.nopol||'â€”'}</div>
        <div class="fcu-driver"><svg viewBox="0 0 24 24" width="10" height="10" style="fill:none;stroke:var(--text3);stroke-width:2;stroke-linecap:round;flex-shrink:0"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${f.driver||'â€”'}</div>
      </div>
      <div class="fcu-right">
        ${status==='antre'?'<span class="antre-pulse"><span class="ap-dot"></span>Antre</span>':`<span class="chip ${sl[status]||'chip-gray'}">${sIcoFn(status)} ${status.charAt(0).toUpperCase()+status.slice(1)}</span>`}
        ${aW?'<span class="doc-warn">âš  Dokumen</span>':''}
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
      <div class="drv-info"><div class="drv-name">${d}</div><div class="drv-meta">${unit?'ðŸš› '+unit.nopol:'Tidak ada unit tetap'}</div></div>
      <div class="drv-actions">
        <button class="drv-btn edit" onclick="openSmModal('driver','${d}')"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="drv-btn del" onclick="deleteDriver('${d}')"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
      </div>
    </div>`;
  }).join('');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• UNIT DETAIL â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// State untuk filter date armada detail
let _detailFromDate='', _detailToDate='';

function setDetailPeriod(from, to){
  _detailFromDate=from; _detailToDate=to;
  document.querySelectorAll('.dp-period-btn').forEach(b=>b.classList.remove('active'));
  refreshDetailHero();
  const activeTab=document.querySelector('.tab-btn.active');
  if(activeTab) activeTab.click();
}

function setDetailPeriodPreset(preset){
  const now=new Date(),y=now.getFullYear(),m=now.getMonth();
  document.querySelectorAll('.dp-period-btn').forEach(b=>b.classList.remove('active'));
  if(preset==='bulan-ini'){
    _detailFromDate=`${y}-${String(m+1).padStart(2,'0')}-01`;_detailToDate=today();
    document.getElementById('dpf-m')?.classList.add('active');
  } else if(preset==='3bulan'){
    const d=new Date(y,m-2,1);_detailFromDate=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;_detailToDate=today();
    document.getElementById('dpf-3m')?.classList.add('active');
  } else if(preset==='tahun-ini'){
    _detailFromDate=`${y}-01-01`;_detailToDate=today();
    document.getElementById('dpf-y')?.classList.add('active');
  }
  refreshDetailHero();
  const activeTab=document.querySelector('.tab-btn.active');
  if(activeTab) activeTab.click();
}

function toggleDetailCustomDate(){
  const el=document.getElementById('dp-custom-dates');
  if(!el) return;
  el.style.display=el.style.display==='none'?'flex':'none';
}

function applyDetailCustomDate(){
  _detailFromDate=document.getElementById('dp-from')?.value||'';
  _detailToDate=document.getElementById('dp-to')?.value||'';
  document.querySelectorAll('.dp-period-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('dpf-custom')?.classList.add('active');
  document.getElementById('dp-custom-dates').style.display='none';
  refreshDetailHero();
  const activeTab=document.querySelector('.tab-btn.active');
  if(activeTab) activeTab.click();
}

function getDetailTxns(nopol){
  let list=transactions.filter(t=>t.armada===nopol||t.kategori==='UMUM');
  if(_detailFromDate) list=list.filter(t=>t.date>=_detailFromDate);
  if(_detailToDate) list=list.filter(t=>t.date<=_detailToDate);
  return list;
}

function refreshDetailHero(){
  const f=currentDetailUnit; if(!f) return;
  const allTxns=getDetailTxns(f.nopol);
  const uIn=allTxns.filter(t=>t.type==='inflow'&&t.armada===f.nopol).reduce((s,t)=>s+t.amount,0);
  const uOutTunai=allTxns.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&t.kategori==='Tunai').reduce((s,t)=>s+t.amount,0);
  const uOutOnderdil=allTxns.filter(t=>t.type==='outflow'&&t.armada===f.nopol&&t.kategori==='Onderdil').reduce((s,t)=>s+t.amount,0);
  const beban=allTxns.filter(t=>t.type==='outflow'&&t.kategori==='UMUM').reduce((s,t)=>s+t.amount/FLEET_COUNT,0);
  const net=uIn-(uOutTunai+uOutOnderdil+beban);
  const pD=daysUntil(f.pajak),kD=daysUntil(f.kir);
  const activeParts=sparepartStock.filter(sp=>sp.installed.some(i=>i.armada===f.nopol));
  const periodLabel=_detailFromDate||_detailToDate?`<div style="font-size:9px;color:rgba(255,255,255,.4);margin-top:4px;">ðŸ“… ${_detailFromDate||'awal'} s/d ${_detailToDate||'sekarang'}</div>`:'';
  const heroEl=document.getElementById('dp-hero');if(!heroEl)return;
  heroEl.innerHTML=`
    <div style="display:flex;align-items:center;gap:11px;margin-bottom:12px;position:relative;z-index:1;">
      <div style="width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#CC5200,#FF6700,#FF9A40);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;">${f.nopol.replace(/\s/g,'').slice(-4)}</div>
      <div><div class="dp-nopol">${f.nopol}</div><div class="dp-driver">${f.driver}</div>${periodLabel}</div>
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
}

function openUnitDetail(id){
  const f=fleetData.find(x=>String(x.id)===String(id));if(!f)return;
  currentDetailUnit=f;
  _detailFromDate=''; _detailToDate='';
  document.querySelectorAll('.dp-period-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('dpf-all')?.classList.add('active');
  document.getElementById('armada-list').style.display='none';
  document.getElementById('detail-panel').classList.add('active');
  refreshDetailHero();
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
  ['perjalanan','biaya','dokumen','truck'].forEach(t=>{const e=document.getElementById('tab-'+t);if(e)e.style.display=t===name?'block':'none';});
  if(!currentDetailUnit)return;const f=currentDetailUnit;
  if(name==='perjalanan'){
    const trips=transactions.filter(t=>t.type==='inflow'&&t.armada===f.nopol&&t.muat).sort((a,b)=>b.date.localeCompare(a.date));
    const parts=getActivePartsForArmada(f.nopol);
    const tripsHTML=trips.length
      ?trips.map(t=>`<div class="hist-item"><div class="hist-dot trip"></div><div class="txn-body"><div class="hist-main">${t.muat} â†’ ${t.bongkar}</div><div class="hist-sub">${fmtDate(t.date)} Â· ${t.driver}</div></div><div class="hist-amt in">+${fmt(t.amount)}</div></div>`).join('')
      :'<div style="text-align:center;padding:24px;color:var(--text3);">Belum ada perjalanan tercatat</div>';
    const partsHTML=parts.length
      ?'<div class="sec-title" style="margin-top:14px;margin-bottom:8px;">ðŸ”§ Onderdil Aktif ('+parts.length+' item)</div>'
        +parts.map(p=>`<div class="ritase-row">
          <div style="font-size:18px;">${getSpCatIcon(p.kategori)||'ðŸ”§'}</div>
          <div class="ritase-info">
            <div class="ritase-label">${p.nama}</div>
            <div class="ritase-meta">${p.spek} Â· Dipasang: ${fmtDate(p.tglPasang)} (${p.daysSince} hari)</div>
            ${p.freeze?'<div class="ritase-freeze">â„ FREEZE â€” Armada di Bengkel</div>':''}
          </div>
          <div style="text-align:right;"><div class="ritase-count">${p.ritase}</div><div style="font-size:9px;color:var(--text3);">ritase</div></div>
        </div>`).join('')
      :'<div style="text-align:center;padding:14px;color:var(--text3);font-size:12px;">Tidak ada onderdil terpasang</div>';
    document.getElementById('tab-perjalanan').innerHTML=tripsHTML+partsHTML;
  }
  if(name==='biaya'){
    const allTxns=getDetailTxns(f.nopol);
    const unitCosts=allTxns.filter(t=>t.type==='outflow'&&t.armada===f.nopol).sort((a,b)=>b.date.localeCompare(a.date));
    const umumCosts=allTxns.filter(t=>t.type==='outflow'&&t.kategori==='UMUM').sort((a,b)=>b.date.localeCompare(a.date));
    const chipColor={Tunai:'chip-green',Onderdil:'chip-orange',UMUM:'chip-gray'};
    const renderItem=t=>`<div class="hist-item">
      <div class="hist-dot out"></div>
      <div class="txn-body">
        <div class="hist-main">${t.label} <span class="chip ${chipColor[t.kategori]||'chip-gray'}" style="font-size:8px;">${t.kategori}</span></div>
        <div class="hist-sub">${t.nota||'â€”'} Â· ${t.toko||'â€”'} Â· ${fmtDate(t.date)}</div>
      </div>
      <div class="hist-amt out">-${fmt(t.kategori==='UMUM'?t.amount/FLEET_COUNT:t.amount)}</div>
    </div>`;
    let html='';
    if(unitCosts.length){html+='<div class="sec-title" style="font-size:10px;margin-bottom:6px;">Biaya Unit Ini</div>'+unitCosts.map(renderItem).join('');}
    if(umumCosts.length){html+='<div class="sec-title" style="font-size:10px;margin-top:10px;margin-bottom:6px;">Beban Umum (porsi unit ini)</div>'+umumCosts.map(renderItem).join('');}
    if(!html)html='<div style="text-align:center;padding:30px;color:var(--text3);font-size:12.5px;">Belum ada biaya tercatat</div>';
    document.getElementById('tab-biaya').innerHTML=html;
  }
  if(name==='truck'){ renderTruckTab(f); }
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

async function saveDocs(id){
  const f=fleetData.find(x=>String(x.id)===String(id));if(!f)return;
  const newPajak=document.getElementById('edit-pajak')?.value||f.pajak;
  const newKir=document.getElementById('edit-kir')?.value||f.kir;
  
  try {
    await sbFetch('fleet', {method:'PATCH', filters:{id:id}, body:{pajak:newPajak, kir:newKir}});
    await syncFromSupabase();
    showToast('Dokumen berhasil disimpan');
    openUnitDetail(id);
  } catch(e) {
    console.warn('Gagal simpan dokumen:', e);
    showToast('âŒ Gagal menyimpan dokumen armada. Periksa koneksi server.');
  }
}


// â”€â”€â”€ TRUCK VISUALIZATION (#4) â”€â”€â”€
function renderTruckTab(f){
  const el=document.getElementById('tab-truck');if(!el)return;
  // Posisi 10 ban: depan 2, tengah 4 (2+2), belakang 4 (2+2)
  const positions=[
    {id:'d-l',label:'Depan Kiri',cx:95,cy:68},
    {id:'d-r',label:'Depan Kanan',cx:95,cy:132},
    {id:'t-li',label:'Tengah Kiri Dalam',cx:195,cy:78},
    {id:'t-lo',label:'Tengah Kiri Luar',cx:195,cy:58},
    {id:'t-ri',label:'Tengah Kanan Dalam',cx:195,cy:122},
    {id:'t-ro',label:'Tengah Kanan Luar',cx:195,cy:142},
    {id:'b-li',label:'Belakang Kiri Dalam',cx:285,cy:78},
    {id:'b-lo',label:'Belakang Kiri Luar',cx:285,cy:58},
    {id:'b-ri',label:'Belakang Kanan Dalam',cx:285,cy:122},
    {id:'b-ro',label:'Belakang Kanan Luar',cx:285,cy:142},
  ];
  // Cari ban dari sparepartStock yang terpasang di armada ini
  const banItems=sparepartStock.filter(sp=>
    (sp.kategori==='Ban'||sp.nama.toLowerCase().includes('ban'))&&
    sp.installed.some(i=>i.armada===f.nopol)
  );
  const threshold=getRitaseThreshold('Ban')||200;
  // Map posisi ke ritase â€” cocokkan by nama posisi
  const installedBans=banItems.flatMap(sp=>sp.installed.filter(i=>i.armada===f.nopol).map(i=>({...i,spId:sp.id,nama:sp.nama,spek:sp.spek})));
  function getBanAtPosition(posLabel){
    // Cari ban yang punya posisi cocok (case-insensitive)
    return installedBans.find(b=>(b.posisi||'').toLowerCase()===posLabel.toLowerCase());
  }
  function getTireColor(ritase){
    const pct=(ritase/threshold)*100;
    if(pct>=90)return '#FF3B30';
    if(pct>=70)return '#FF9500';
    return '#34C759';
  }
  function getTireLabel(ritase){
    const pct=Math.round((ritase/threshold)*100);
    return pct+'%';
  }
  const tiresHTML=positions.map((p,i)=>{
    const ban=getBanAtPosition(p.label);
    const ritase=ban?ban.ritase:0;
    const color=ban?getTireColor(ritase):'#8E8E93';
    const label=ban?getTireLabel(ritase):'?';
    return `<g style="cursor:pointer;" onclick="showTireDetail('${f.nopol}','${p.label}')">
      <circle cx="${p.cx}" cy="${p.cy}" r="13" fill="${color}" opacity="0.85"/>
      <text x="${p.cx}" y="${p.cy}" text-anchor="middle" dominant-baseline="middle" font-size="8" font-weight="700" fill="white">${label}</text>
    </g>`;
  }).join('');
  el.innerHTML=`
    <div style="background:var(--card);border:1px solid var(--card-b);border-radius:14px;padding:14px;margin-bottom:10px;">
      <div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:12px;">ðŸš› Visualisasi Ban â€” ${f.nopol}</div>
      <svg viewBox="0 0 380 200" style="width:100%;max-width:420px;display:block;margin:0 auto;">
        <!-- Bodi truk -->
        <rect x="30" y="80" width="310" height="40" rx="6" fill="none" stroke="var(--card-b)" stroke-width="1.5"/>
        <!-- Kabin -->
        <rect x="30" y="55" width="70" height="65" rx="6" fill="none" stroke="var(--card-b)" stroke-width="1.5"/>
        <!-- Label sumbu -->
        <text x="95" y="30" text-anchor="middle" font-size="9" fill="var(--text3)">Depan</text>
        <text x="195" y="30" text-anchor="middle" font-size="9" fill="var(--text3)">Tengah</text>
        <text x="285" y="30" text-anchor="middle" font-size="9" fill="var(--text3)">Belakang</text>
        <!-- Garis sumbu -->
        <line x1="95" y1="34" x2="95" y2="180" stroke="var(--card-b)" stroke-width="1" stroke-dasharray="4,3"/>
        <line x1="195" y1="34" x2="195" y2="180" stroke="var(--card-b)" stroke-width="1" stroke-dasharray="4,3"/>
        <line x1="285" y1="34" x2="285" y2="180" stroke="var(--card-b)" stroke-width="1" stroke-dasharray="4,3"/>
        ${tiresHTML}
      </svg>
      <!-- Legend -->
      <div style="display:flex;gap:12px;justify-content:center;margin-top:10px;">
        <span style="font-size:10px;font-weight:600;display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:50%;background:#34C759;display:inline-block;"></span>Baik</span>
        <span style="font-size:10px;font-weight:600;display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:50%;background:#FF9500;display:inline-block;"></span>Perhatian</span>
        <span style="font-size:10px;font-weight:600;display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:50%;background:#FF3B30;display:inline-block;"></span>Ganti</span>
        <span style="font-size:10px;font-weight:600;display:flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:50%;background:#8E8E93;display:inline-block;"></span>Belum Diisi</span>
      </div>
    </div>
    <div id="tire-detail-panel" style="display:none;background:var(--card);border:1px solid var(--card-b);border-radius:14px;padding:14px;"></div>
    <div style="background:var(--bg3);border-radius:12px;padding:12px;margin-top:8px;">
      <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">Ringkasan Ban Terpasang</div>
      <div style="font-size:13px;font-weight:700;color:var(--text);">${installedBans.length} ban terpasang dari 10 posisi</div>
      ${(()=>{
        if(installedBans.length===0) return '<div style="font-size:11px;color:var(--text3);margin-top:4px;">Klik lingkaran ban di atas untuk memasang ban di posisi tersebut.</div>';
        const items=installedBans.map(b=>{
          const pct=(b.ritase/threshold)*100;
          const bColor=pct>=90?'var(--danger)':pct>=70?'var(--warning)':'var(--success)';
          return '<div style="display:flex;justify-content:space-between;align-items:center;background:var(--card);border:1px solid var(--card-b);padding:10px 12px;border-radius:10px;cursor:pointer;" onclick="showTireDetail(\''+f.nopol+'\',\''+b.posisi+'\')">'
            +'<div style="display:flex;flex-direction:column;gap:3px;">'
            +'<span style="font-size:11px;font-weight:800;color:var(--text);">ðŸ”˜ '+(b.posisi||'Posisi Belum Diset')+'</span>'
            +'<span style="font-size:10.5px;font-weight:500;color:var(--text3);">'+b.nama+' ('+(b.spek||'-')+')</span>'
            +'</div>'
            +'<div style="text-align:right;">'
            +'<div style="font-size:11.5px;font-weight:700;color:'+bColor+';">'+b.ritase+' ritase</div>'
            +'<div style="font-size:9.5px;color:var(--text3);margin-top:2px;">Tgl: '+fmtDate(b.tglPasang)+'</div>'
            +'</div></div>';
        }).join('');
        return '<div style="display:grid;gap:8px;margin-top:12px;">'+items+'</div>';
      })()}
    </div>`;
  // Store for click handler
  window._truckBans={f,installedBans,positions,threshold,getBanAtPosition};
}

function showTireDetail(nopol, posLabel){
  if(!window._truckBans) return;
  const {f,positions,threshold,getBanAtPosition}=_truckBans;
  const p=positions.find(x=>x.label===posLabel)||{label:posLabel};
  const ban=getBanAtPosition(posLabel);
  const el=document.getElementById('tire-detail-panel');
  if(!el) return;
  if(!ban){
    el.style.display='block';
    el.innerHTML=`<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px;">ðŸ”˜ ${p.label}</div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:12px;">Belum ada data ban di posisi ini.<br>Pasang ban baru melalui tombol di bawah:</div>
      <button onclick="openModal('outflow', {armada:'${nopol}', category:'Onderdil', pos:'${p.label}'})" 
              style="width:100%;padding:12px;border-radius:12px;border:none;background:var(--green2);color:#fff;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 12px rgba(10,168,96,.2);">
        ðŸ”§ Pasang Ban Baru
      </button>`;
    return;
  }
  const pct=Math.min(100,Math.round((ban.ritase/threshold)*100));
  const sisa=Math.max(0,threshold-ban.ritase);
  const barColor=pct>=90?'var(--danger)':pct>=70?'var(--warning)':'var(--success)';
  el.style.display='block';
  el.innerHTML=`
    <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px;">ðŸ”˜ ${p.label}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
      <div style="background:var(--bg3);border-radius:10px;padding:9px;">
        <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:2px;">Nama</div>
        <div style="font-size:12px;font-weight:600;">${ban.nama||'Ban'}</div>
      </div>
      <div style="background:var(--bg3);border-radius:10px;padding:9px;">
        <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:2px;">Spek</div>
        <div style="font-size:12px;font-weight:600;">${ban.spek||'â€”'}</div>
      </div>
      <div style="background:var(--bg3);border-radius:10px;padding:9px;">
        <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:2px;">Dipasang</div>
        <div style="font-size:12px;font-weight:600;">${fmtDate(ban.tglPasang)||'â€”'}</div>
      </div>
      <div style="background:var(--bg3);border-radius:10px;padding:9px;">
        <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:2px;">Sisa</div>
        <div style="font-size:12px;font-weight:600;color:${barColor};">${sisa} ritase</div>
      </div>
    </div>
    <div style="background:var(--bg3);border-radius:10px;padding:9px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:10px;font-weight:700;">Pemakaian</span>
        <span style="font-size:10px;font-weight:700;color:${barColor};">${pct}%</span>
      </div>
      <div style="background:var(--bg4);border-radius:4px;height:8px;overflow:hidden;">
        <div style="height:100%;background:${barColor};width:${pct}%;border-radius:4px;transition:width .4s;"></div>
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px;">${ban.ritase} / ${threshold} ritase terpakai</div>
    </div>
    <button onclick="openModal('outflow', {armada:'${nopol}', category:'Onderdil', spId:'${ban.spId}', pos:'${p.label}'})" 
            style="width:100%;margin-top:12px;padding:12px;border-radius:12px;border:none;background:var(--green2);color:#fff;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 12px rgba(10,168,96,.2);">
      ðŸ”§ Ganti Ban Baru
    </button>`;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• SM MODAL (CRUD) â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
    const isEdit=!!val;const u=isEdit?fleetData.find(f=>String(f.id)===String(val)):null;
    tEl.textContent=isEdit?'Edit Unit Armada':'Tambah Unit Baru';
    body.innerHTML=`
      <div><label class="form-label">No. Plat</label><input class="form-input" id="sm-nopol" value="${u?u.nopol:''}" placeholder="B 1234 XX"/></div>
      <div><label class="form-label">Supir Tetap</label><select class="form-select" id="sm-unit-driver">${getDriverOpts(u?u.driver:'')}</select></div>
      <div><label class="form-label">Status</label><select class="form-select" id="sm-status"><option value="jalan"${u?.status==='jalan'?' selected':''}>ðŸŸ¢ Jalan</option><option value="antre"${u?.status==='antre'?' selected':''}>ðŸŸ¡ Antre</option><option value="bengkel"${u?.status==='bengkel'?' selected':''}>ðŸ”´ Bengkel</option></select></div>
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

async function saveDriver(old){
  const name=document.getElementById('sm-driver-name')?.value?.trim();
  if(!name){showToast('Nama tidak boleh kosong');return;}
  
  try {
    if(old && old !== name) {
      // 1. Delete old driver record
      await sbFetch('drivers',{method:'DELETE',filters:{nama:old}});
      // 2. Insert new driver record
      await sbFetch('drivers',{method:'POST',body:{nama:name}});
    } else if(!old) {
      // New driver
      await sbFetch('drivers',{method:'POST',body:{nama:name}});
    }

    await syncFromSupabase();
    closeSm();
    showToast(old?'Supir diperbarui':'Supir ditambahkan');
    vibrate(30);
  } catch(e) {
    console.warn('Gagal simpan supir:', e);
    showToast('âŒ Gagal menyimpan supir. Periksa koneksi server.');
  }
}

async function deleteDriver(name){
  if(fleetData.some(f=>f.driver===name)){showToast('Supir sedang bertugas');return;}
  if(!confirm(`Hapus supir ${name}?`)) return;
  
  try {
    await sbFetch('drivers',{method:'DELETE',filters:{nama:name}});
    await syncFromSupabase();
    showToast('Supir dihapus');
    vibrate(40);
  } catch(e) {
    console.warn('Gagal hapus supir:', e);
    showToast('âŒ Gagal menghapus supir. Periksa koneksi server.');
  }
}

async function saveUnit(existId){
  const nopol=(document.getElementById('sm-nopol')?.value||'').trim().toUpperCase();
  const driver=document.getElementById('sm-unit-driver')?.value||'';
  const status=document.getElementById('sm-status')?.value||'jalan';
  const pajak=document.getElementById('sm-pajak')?.value||'';
  const kir=document.getElementById('sm-kir')?.value||'';
  if(!nopol){showToast('No. plat tidak boleh kosong');return;}
  const dupCheck=fleetData.find(f=>f.nopol===nopol&&f.id!==existId);
  if(dupCheck){showToast('No. plat sudah terdaftar');return;}
  
  const unitData = {nopol,driver,status,pajak,kir};

  try {
    if(existId){
      await sbFetch('fleet',{method:'PATCH',filters:{id:existId},body:unitData});
    } else {
      const newId='f'+Date.now();
      await sbFetch('fleet',{method:'POST',body:{id:newId, ...unitData}});
    }
    await syncFromSupabase();
    closeSm();
    showToast(existId?'Unit diperbarui':'Unit '+nopol+' ditambahkan');
    vibrate(30);
  } catch(e) {
    console.warn('Gagal simpan armada:', e);
    showToast('âŒ Gagal menyimpan unit armada. Periksa koneksi server.');
  }
}

async function deleteUnit(id){
  const u=fleetData.find(f=>String(f.id)===String(id));
  if(!u) return;
  if(!confirm(`Hapus armada ${u.nopol}?`)) return;

  try {
    await sbFetch('fleet',{method:'DELETE',filters:{id:id}});
    await syncFromSupabase();
    showToast('Unit '+u.nopol+' dihapus');
    vibrate(40);
  } catch(e) {
    console.warn('Gagal hapus armada:', e);
    showToast('âŒ Gagal menghapus unit armada. Periksa koneksi server.');
  }
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• INPUT MODAL â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function buildGudangOpts(){
  // Group stok gudang by kategori
  if(sparepartStock.length===0) return '<option value="">â€” Stok kosong â€”</option>';
  const grouped={};
  sparepartStock.filter(sp=>sp.stokSisa>0).forEach(sp=>{
    if(!grouped[sp.kategori]) grouped[sp.kategori]=[];
    grouped[sp.kategori].push(sp);
  });
  let html='<option value="">â€” Pilih dari Gudang â€”</option>';
  Object.keys(grouped).forEach(kat=>{
    html+=`<optgroup label="${kat}">`;
    grouped[kat].forEach(sp=>{
      html+=`<option value="${sp.id}">[${sp.stokSisa}/${sp.stokAwal}] ${sp.nama} Â· ${sp.spek}</option>`;
    });
    html+='</optgroup>';
  });
  return html;
}

function openModal(type, prefill={}){
  closeFab();
  
  // Apply prefill if any
  setTimeout(() => {
    if(type === 'outflow' && prefill.category) {
       const catEl = document.getElementById('out-cat');
       if(catEl) { catEl.value = prefill.category; onOutCatChange(); }
    }
    if(prefill.armada) {
       const armEl = document.getElementById(type==='inflow'?'inf-armada':'out-armada');
       if(armEl) { armEl.value = prefill.armada; if(type==='inflow')syncDriverFromArmada(); else syncOutDriver(); }
    }
    if(prefill.spId) {
       const spEl = document.getElementById('out-sp-select');
       if(spEl) { spEl.value = prefill.spId; onGudangItemSelect(); }
    }
    if(prefill.pos) {
       const posEl = document.getElementById('out-pos-select');
       if(posEl) posEl.value = prefill.pos;
    }
  }, 50);

  document.getElementById('mt-dot').className='mt-dot '+type;
  const title=document.getElementById('mt-text'),body=document.getElementById('modal-body');
  
  if(type==='edit'){
    const txn=transactions.find(t=>String(t.id)===String(prefill.id));
    if(!txn) return;
    title.textContent='âœï¸ Edit Transaksi';
    body.innerHTML=`
      <div style="background:var(--${txn.type==='inflow'?'green':'orange'}-bg);border:1px solid var(--${txn.type==='inflow'?'green':'orange'}-bd);border-radius:10px;padding:8px 11px;font-size:12px;font-weight:700;color:var(--${txn.type==='inflow'?'green2':'orange'});margin-bottom:14px;">
        ${txn.type==='inflow'?'ðŸ“ˆ Pemasukan':'ðŸ“‰ Pengeluaran'} Â· Transaksi ID: ${String(txn.id).substring(0,8)}...
      </div>
      <div class="form-group"><label class="form-label">Keterangan / Label</label>
        <input class="form-input" id="et-label" value="${txn.label||''}"/></div>
      <div class="form-group"><label class="form-label">Jumlah (Rp)</label>
        <input class="form-input" id="et-amount" placeholder="0" inputmode="numeric" value="${fmt(txn.amount||0)}"/></div>
      <div class="form-group"><label class="form-label">Tanggal</label>
        <input type="date" class="form-input" id="et-date" value="${txn.date||today()}"/></div>
      <div class="form-group"><label class="form-label">Kategori</label>
        <select class="form-select" id="et-cat">
          <option value="UMUM" ${txn.kategori==='UMUM'?'selected':''}>Beban Umum</option>
          <option value="Tunai" ${(txn.kategori||'').toLowerCase()==='tunai'?'selected':''}>Kas Bon / Tunai</option>
          <option value="Onderdil" ${(txn.kategori||'').toLowerCase()==='onderdil'?'selected':''}>Beban Onderdil</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Armada Alokasi</label>
        <select class="form-select" id="et-armada">
          <option value="">â€” Opsional (Biaya Umum) â€”</option>
          ${fleetData.map(f=>`<option value="${f.nopol}" ${txn.armada===f.nopol?'selected':''}>${f.nopol} - ${f.driver}</option>`).join('')}
        </select></div>
      <div class="form-group" style="display:${(txn.sparepartId || (txn.label||'').toLowerCase().includes('ban'))?'block':'none'};">
        <label class="form-label">ðŸ“ Posisi Ban (Sumbu)</label>
        <select class="form-select" id="et-pos">
          <option value="">â€” Pilih Posisi â€”</option>
          <option value="Depan Kiri" ${txn.posisi==='Depan Kiri'?'selected':''}>Depan Kiri</option>
          <option value="Depan Kanan" ${txn.posisi==='Depan Kanan'?'selected':''}>Depan Kanan</option>
          <option value="Tengah Kiri Dalam" ${txn.posisi==='Tengah Kiri Dalam'?'selected':''}>Tengah Kiri Dalam</option>
          <option value="Tengah Kiri Luar" ${txn.posisi==='Tengah Kiri Luar'?'selected':''}>Tengah Kiri Luar</option>
          <option value="Tengah Kanan Dalam" ${txn.posisi==='Tengah Kanan Dalam'?'selected':''}>Tengah Kanan Dalam</option>
          <option value="Tengah Kanan Luar" ${txn.posisi==='Tengah Kanan Luar'?'selected':''}>Tengah Kanan Luar</option>
          <option value="Belakang Kiri Dalam" ${txn.posisi==='Belakang Kiri Dalam'?'selected':''}>Belakang Kiri Dalam</option>
          <option value="Belakang Kiri Luar" ${txn.posisi==='Belakang Kiri Luar'?'selected':''}>Belakang Kiri Luar</option>
          <option value="Belakang Kanan Dalam" ${txn.posisi==='Belakang Kanan Dalam'?'selected':''}>Belakang Kanan Dalam</option>
          <option value="Belakang Kanan Luar" ${txn.posisi==='Belakang Kanan Luar'?'selected':''}>Belakang Kanan Luar</option>
        </select>
      </div>
      ${txn.sparepartId ? `<div style="font-size:10.5px;color:var(--text3);background:var(--bg3);padding:10px;border-radius:10px;margin-bottom:14px;">ðŸ’¡ <b>Onderdil Mode:</b> Tidak dapat mengubah kuantitas stok di form ini. Jika terjadi kesalahan input barang yang menyebabkan stok keliru, silakan <b>Hapus</b> baris transaksi ini lalu buat ulang.</div>` : ''}
      <button class="form-btn outflow" style="background:var(--primary);" onclick="confirmSaveEditTxn('${txn.id}')">ðŸ’¾ Simpan Perubahan</button>`;
    setupCurrencyInput('et-amount');
  }
  else if(type==='inflow'){
    title.textContent='+ Input Inflow';
    body.innerHTML=`
      <div class="form-group"><label class="form-label">No. Plat Armada</label><select class="form-select" id="inf-armada" onchange="syncDriverFromArmada()">${getArmadaOpts()}</select></div>
      <div class="form-group"><label class="form-label">Nama Supir</label><select class="form-select" id="inf-driver">${getDriverOpts()}</select></div>
      <div class="form-group"><label class="form-label">Titik Muat</label><input class="form-input" id="inf-muat" placeholder="Pelabuhan / Gudang Asal"/></div>
      <div class="form-group"><label class="form-label">Titik Bongkar</label><input class="form-input" id="inf-bongkar" placeholder="Gudang / Kota Tujuan"/></div>
      <div class="form-group"><label class="form-label">Jumlah Setoran Netto (Rp)</label><input class="form-input" id="inf-amount" placeholder="0" inputmode="numeric"/></div>
      <div class="form-group"><label class="form-label">Tanggal</label><input type="date" class="form-input" id="inf-date" value="${today()}"/></div>
      <div class="form-group"><label class="form-label">Update Status Armada</label><select class="form-select" id="inf-antre" onchange="document.getElementById('inf-antre-hint').style.display=this.value==='antre'?'block':'none'"><option value="jalan">ðŸŸ¢ Jalan â€” Aktif beroperasi</option><option value="antre">ðŸŸ¡ Antre â€” Menunggu bongkar</option><option value="bengkel">ðŸ”´ Bengkel â€” Dalam perbaikan</option></select></div>
      <div id="inf-antre-hint" style="display:none;font-size:10.5px;color:var(--text3);background:var(--bg3);padding:8px 10px;border-radius:10px;margin-bottom:8px;">ðŸ’¡ Status Antre bisa disimpan tanpa isi nominal uang.</div>
      <button class="form-btn inflow" onclick="submitInflow()">Simpan Inflow</button>`;
    setupCurrencyInput('inf-amount');syncDriverFromArmada();
  } else {
    title.textContent='- Input Outflow';
    body.innerHTML=`
      <div class="form-group"><label class="form-label">Tipe Pengeluaran</label>
        <select class="form-select" id="out-cat" onchange="onOutCatChange()">
          <option value="UMUM">ðŸ¢ UMUM â€” Beban Operasional</option>
          <option value="Onderdil">ðŸ”§ Onderdil â€” Suku Cadang</option>
          <option value="Tunai">ðŸ’µ Tunai â€” Pengeluaran Tunai</option>
        </select>
      </div>
      <div id="out-onderdil-wrap" style="display:none;">
        <div class="form-group">
          <label class="form-label">ðŸ“¦ Pilih dari Stok Gudang</label>
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
  const sp=sparepartStock.find(s=>String(s.id)===String(spId));
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
    info.innerHTML='<b>'+sp.nama+'</b> Â· Sisa stok: <b style="color:var(--'+(sp.stokSisa>0?'success':'danger')+')">'+sp.stokSisa+' unit</b>'
      +' Â· Harga: '+fmt(sp.hargaSatuan)
      +(sp.kategori==='Ban' ? `
        <div style="margin-top:8px;">
          <label class="form-label" style="font-size:9px;">Posisi Pasang Ban</label>
          <select class="form-select" id="out-pos-select" style="padding:7px 10px;font-size:12px;">
            <option value="Depan Kiri">Depan Kiri</option>
            <option value="Depan Kanan">Depan Kanan</option>
            <option value="Tengah Kiri Dalam">Tengah Kiri Dalam</option>
            <option value="Tengah Kiri Luar">Tengah Kiri Luar</option>
            <option value="Tengah Kanan Dalam">Tengah Kanan Dalam</option>
            <option value="Tengah Kanan Luar">Tengah Kanan Luar</option>
            <option value="Belakang Kiri Dalam">Belakang Kiri Dalam</option>
            <option value="Belakang Kiri Luar">Belakang Kiri Luar</option>
            <option value="Belakang Kanan Dalam">Belakang Kanan Dalam</option>
            <option value="Belakang Kanan Luar">Belakang Kanan Luar</option>
          </select>
        </div>` : '')
      +'<br>ðŸ”„ Ritase akan mulai dihitung dari 0 setelah dipasang ke armada (threshold: '+threshold+' trip)';
  }
}

function toggleArmadaField(){
  // Legacy compatibility â€” now handled by onOutCatChange
  onOutCatChange();
}
function syncDriverFromArmada(){const a=document.getElementById('inf-armada')?.value;const f=fleetData.find(x=>x.nopol===a);const dd=document.getElementById('inf-driver');if(f&&dd)dd.value=f.driver;}
function syncOutDriver(){const a=document.getElementById('out-armada')?.value;const f=fleetData.find(x=>x.nopol===a);const dd=document.getElementById('out-driver');if(f&&dd)dd.value=f.driver;}
function closeModal(){document.getElementById('modal-overlay').classList.remove('open');}
function closeModalOuter(e){if(e.target===document.getElementById('modal-overlay'))closeModal();}

async function submitInflow(){
  const armada=document.getElementById('inf-armada')?.value;
  const driver=document.getElementById('inf-driver')?.value||'';
  const amount=getRaw('inf-amount');
  const muat=document.getElementById('inf-muat')?.value||'â€”';
  const bongkar=document.getElementById('inf-bongkar')?.value||'â€”';
  const date=document.getElementById('inf-date')?.value;
  const antre=document.getElementById('inf-antre')?.value;
  
  const fUnit=fleetData.find(x=>x.nopol===armada);
  const statusSebelum=fUnit?fUnit.status:'jalan';

  // Perbolehkan submit nominal 0 jika status 'antre' atau hanya update status
  if(antre !== 'antre' && (!amount||amount<=0)){
    showToast('Masukkan jumlah yang valid');return;
  }

  const txnId = 'txn_'+Date.now();
  const txnLabel = (amount > 0) ? 'Setoran ' + armada : 'Antrean ' + armada;
  
  const newTxn={id:txnId,type:'inflow',label:txnLabel,sub:driver+' Â· Netto',amount,date,armada,muat:muat||'',bongkar:bongkar||'',driver,nota:'',toko:'',kategori:'Inflow',status:'lunas'};

  try {
    // 1. Post transaction
    await sbFetch('transactions', {method:'POST', body:newTxn});
    // 2. Patch fleet if status changed
    if(fUnit) {
      await sbFetch('fleet', {method:'PATCH', filters:{id:fUnit.id}, body:{status:antre, driver:driver}});
    }
    
    await syncFromSupabase();
    
    // Increment ritase di memori
    incrementRitaseForArmada(armada, statusSebelum);

    // Bug 2 Fix: Simpan ritase yang sudah diupdate ke database
    const affectedParts = sparepartStock.filter(sp =>
      sp.installed.some(i => i.armada === armada)
    );
    for(const sp of affectedParts) {
      try {
        await sbFetch('inventory', {
          method: 'PATCH',
          filters: { id: sp.id },
          body: { installed: sp.installed }
        });
      } catch(e) {
        console.warn('Gagal simpan ritase untuk', sp.nama, e);
      }
    }

    logAudit('create','transaksi',`Inflow ${fmt(amount)} - ${armada}`);
    closeModal();
    refreshDetailHero();
    showToast(amount > 0 ? 'Inflow ' + fmt(amount) + ' berhasil disimpan' : 'Status armada '+armada+' diperbarui ke Antre');
    vibrate(30);
  } catch(e) {
    console.warn('Gagal submit inflow:', e);
    showToast('âŒ Gagal menyimpan transaksi. Periksa koneksi server.');
  }
}

async function submitOutflow(){
  const nota=document.getElementById('out-nota')?.value||'â€”';
  const toko=document.getElementById('out-toko')?.value||'â€”';
  const label=document.getElementById('out-label')?.value?.trim();
  const cat=document.getElementById('out-cat')?.value;
  const amount=getRaw('out-amount');
  const date=document.getElementById('out-date')?.value;
  const isUnit=cat==='Onderdil'||cat==='Tunai';
  const armada=isUnit?document.getElementById('out-armada')?.value:'UMUM';
  const driver=isUnit?document.getElementById('out-driver')?.value:'';
  if(!label){showToast('Masukkan keterangan pengeluaran');return;}
  if(!amount||amount<=0){showToast('Masukkan jumlah yang valid');return;}
  
  const outId='txn_'+Date.now();
  let spId=null;
  if(cat==='Onderdil'){
    const spSel=document.getElementById('out-sp-select');
    spId=spSel?.value||null;
    if(spId){
      const sp=sparepartStock.find(s=>String(s.id)===String(spId));
      if(sp && sp.stokSisa<=0){
        showToast('Stok '+sp.nama+' sudah habis!');return;
      }
    }
  }

  const txnLabel=label||(spId?sparepartStock.find(s=>String(s.id)===String(spId))?.nama||'Onderdil':'Pengeluaran');
  const newOut={id:outId,type:'outflow',label:txnLabel,sub:`No.Nota: ${nota} Â· ${toko}${driver?' Â· '+driver:''}`,amount,date,armada,nota,toko,kategori:cat,driver,status:'lunas',sparepartId:spId||null};

  try {
    // 1. Post Transaction
    const dbOut = {
      ...newOut, 
      posisi: document.getElementById('out-pos-select')?.value || '', 
      sparepart_id: newOut.sparepartId
    };
    delete dbOut.sparepartId;
    await sbFetch('transactions', {method:'POST', body:dbOut});

    // 2. Update Inventory & Record Installation securely via Backend
    if(cat==='Onderdil' && spId){
      await apiFetch(`/api/inventory/${spId}/install`, {
        method: 'POST',
        body: {
          jumlah: 1,
          armada: armada || 'UMUM',
          tgl_pasang: date,
          txnId: outId,
          posisi: document.getElementById('out-pos-select')?.value || ''
        }
      });
    }

    await syncFromSupabase();
    
    logAudit('create','transaksi',`Outflow ${fmt(amount)} - ${txnLabel}`);
    closeModal();
    refreshDetailHero();
    if(spId) showToast('âœ… Onderdil terpasang & stok terpotong');
    else showToast('Outflow '+fmt(amount)+' disimpan');
    vibrate(30);
  } catch(e) {
    console.warn('Gagal submit outflow:', e);
    showToast('âŒ Gagal menyimpan transaksi. Periksa koneksi server.');
  }
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• NAV â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
  if(name==='audit'){loadAuditLogs();}
  if(name==='settings'){updateSettingsAdminInfo();}
}
function openSb(){document.getElementById('sidebar').classList.add('open');document.getElementById('sb-overlay').classList.add('open');}
function closeSb(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sb-overlay').classList.remove('open');}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• FAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function toggleFab(){fabOpen=!fabOpen;document.getElementById('fab-popup').classList.toggle('open',fabOpen);document.getElementById('fab-circle').classList.toggle('open',fabOpen);if(fabOpen)vibrate(20);}
function closeFab(){fabOpen=false;document.getElementById('fab-popup').classList.remove('open');document.getElementById('fab-circle').classList.remove('open');}
document.addEventListener('click',e=>{if(fabOpen&&!e.target.closest('#fab-btn')&&!e.target.closest('#fab-popup'))closeFab();});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• THEME â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• OTHER â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function updateFleetCount(v){const n=parseInt(v);if(n>0){FLEET_COUNT=n;renderDashboard();}}
async function confirmReset(){
  showConfirmPopup('â— Riset Data Keuangan',
    'Hapus SEMUA data transaksi permanen dari database?<br><br><span style="color:var(--danger);font-size:11px;">âš ï¸ Tindakan ini tidak dapat dibatalkan.</span>',
    async () => {
      // 1. DELETE via backend
      const result = await apiFetch('/api/transactions/reset', { method: 'DELETE' });
      if (!result || result.ok === false) throw new Error(result?.error || 'Gagal meriset data');

      // 2. Clear Local Cache immediately to prevent flicker on refresh
      localStorage.removeItem('bhd_cache_transactions');
      localStorage.removeItem('bhd_cache_fleet');
      localStorage.removeItem('bhd_cache_inventory');
      
      // 3. Update local state SEGERA sebelum menunggu sync
      transactions = [];
      renderDashboard();
      if(typeof applyTxnFilters === 'function') applyTxnFilters();
      if(typeof renderLaporanTable === 'function') renderLaporanTable();
      
      // 4. Sync untuk konfirmasi dari server
      try {
        await syncFromSupabase();
      } catch(e) {
        console.warn('Post-reset sync failed, local already cleared:', e);
      }
      
      showToast('Semua data transaksi di-reset ke Nol');
      vibrate(40);
    }
  );
}


document.getElementById('bg-upload').addEventListener('change',function(e){
  const r=new FileReader();r.onload=ev=>{document.getElementById('bg-layer').style.backgroundImage=`url(${ev.target.result})`;applyBg();};r.readAsDataURL(e.target.files[0]);
});
function applyBg(){const bl=document.getElementById('blur-range').value,ov=document.getElementById('overlay-range').value;document.getElementById('bg-overlay').style.cssText=`backdrop-filter:blur(${bl}px);-webkit-backdrop-filter:blur(${bl}px);background:rgba(10,14,28,${ov/100})`;}
document.getElementById('blur-range').addEventListener('input',applyBg);
document.getElementById('overlay-range').addEventListener('input',applyBg);
function resetBg(){document.getElementById('bg-layer').style.backgroundImage='';document.getElementById('bg-overlay').style.cssText='';document.getElementById('blur-range').value=10;document.getElementById('overlay-range').value=50;document.getElementById('bg-upload').value='';}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• PTR â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let ptrStartY=0,ptrActive=false;
document.getElementById('main').addEventListener('touchstart',e=>{if(document.getElementById('main').scrollTop===0)ptrStartY=e.touches[0].clientY;});
document.getElementById('main').addEventListener('touchmove',e=>{const dy=e.touches[0].clientY-ptrStartY;if(dy>60&&!ptrActive){ptrActive=true;document.getElementById('ptr-indicator').classList.add('show');vibrate(15);}});
document.getElementById('main').addEventListener('touchend',()=>{if(ptrActive){ptrActive=false;setTimeout(()=>{document.getElementById('ptr-indicator').classList.remove('show');showSkeleton();renderDashboard();showToast('Data diperbarui');},600);}ptrStartY=0;});

function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PHASE 1 â€” AUDIT TRAIL + SYNC INDICATOR + LOGOUT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Refactored sbFetch to use Backend API with table normalization & error handling
async function sbFetch(table, opts={}){
  const {filters={}, method='GET', body=null} = opts;
  
  // Normalize table names (e.g., audit_logs -> audit-logs) to match Backend API
  const normalizedTable = table.replace(/_/g, '-');
  let endpoint = `/api/${normalizedTable}`;
  let fetchMethod = method === 'PATCH' ? 'PUT' : method;

  // Handle specific lookup by ID for mutations
  if (filters.id && (fetchMethod === 'PUT' || fetchMethod === 'DELETE')) {
    endpoint += `/${filters.id}`;
  }

  // Handle other filters as query parameters for GET requests
  if (fetchMethod === 'GET' && Object.keys(filters).length > 0) {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      // Basic mapping: if v is "eq.val", just use "val"
      const val = (typeof v === 'string' && v.startsWith('eq.')) ? v.substring(3) : v;
      qs.append(k, val);
    });
    endpoint += `?${qs.toString()}`;
  }

  try {
    const result = await apiFetch(endpoint, {
      method: fetchMethod,
      body: body
    });
    return result;
  } catch(e) {
    console.error(`sbFetch API Error [${endpoint}]:`, e);
    if (fetchMethod === 'GET') return [];
    throw e;
  }
}


// Log aksi â€” now using Backend API
async function logAudit(action, modul, detail=''){
  try{
    const adminName = (window.activeAdmin?.name) || 'System';
    await apiFetch('/api/audit-logs', {
      method: 'POST',
      body: {
        user_name: adminName,
        action,
        module: modul,
        doc_id: '', 
        changes_after: typeof detail==='object' ? detail : { info: String(detail) }
      }
    });
  } catch(e){ console.warn('logAudit failed:', e); }
}

// Load & render audit logs dari Supabase
async function loadAuditLogs(){
  const el = document.getElementById('audit-log-list');
  if(!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">â³ Memuat...</div>';
  try{
    const modul = document.getElementById('audit-filter-modul')?.value||'';
    const aksi  = document.getElementById('audit-filter-aksi')?.value||'';
    const filters={};
    if(modul) filters.modul=modul;
    if(aksi) filters.action=aksi;
    const logs = await sbFetch('audit_logs',{select:'*',filters,limit:100,order:'created_at.desc'});
    if(!Array.isArray(logs)||logs.length===0){
      el.innerHTML='<div style="text-align:center;padding:32px;color:var(--text3);font-size:13px;">Belum ada log</div>';
      return;
    }
    const aksiColor={create:'var(--success)',update:'var(--warning)',delete:'var(--danger)',login:'var(--info)'};
    const aksiLabel={create:'Tambah',update:'Edit',delete:'Hapus',login:'Login'};
    el.innerHTML = logs.map(l=>{
      const tgl = new Date(l.created_at).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
      const warna = aksiColor[l.action]||'var(--text3)';
      const label = aksiLabel[l.action]||l.action;
      return `<div style="background:var(--card);border:1px solid var(--card-b);border-radius:12px;padding:11px 13px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
          <div style="display:flex;align-items:center;gap:7px;">
            <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${warna}22;color:${warna};">${label}</span>
            <span style="font-size:11px;font-weight:700;color:var(--text);">${l.modul||'â€”'}</span>
          </div>
          <span style="font-size:10px;color:var(--text3);">${tgl}</span>
        </div>
        <div style="font-size:11px;color:var(--text2);">${l.detail||''}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:3px;">ðŸ‘¤ ${l.admin_name||'â€”'}</div>
      </div>`;
    }).join('');
  }catch(e){
    el.innerHTML=`<div style="text-align:center;padding:20px;color:var(--danger);font-size:12px;">Gagal memuat: ${e.message}</div>`;
  }
}

// Logout
function doLogout(){
  if(!confirm('Yakin ingin logout?')) return;
  localStorage.removeItem('bhd_active_admin');
  location.reload();
}

// Update admin info di halaman settings
function updateSettingsAdminInfo(){
  const a=window.activeAdmin;
  const el=document.getElementById('settings-admin-info');
  if(el){
    if(!a){el.textContent='Tidak ada sesi';}
    else{el.innerHTML=`<span style="font-weight:700;color:var(--text);">${a.name}</span>
      <span style="margin-left:8px;font-size:10px;padding:2px 7px;border-radius:20px;background:${a.role==='superadmin'?'rgba(212,168,67,.15)':'var(--green-bg)'};color:${a.role==='superadmin'?'#C4993C':'var(--green2)'};">${a.role}</span>`;}
  }
  // Show superadmin panel
  const saMgmt=document.getElementById('sa-admin-mgmt');
  if(saMgmt){
    saMgmt.style.display=a?.role==='superadmin'?'block':'none';
    if(a?.role==='superadmin') loadSAAdminList();
  }
  // Update sidebar footer
  if(!a) return;
  const sbName=document.getElementById('sb-user-name');
  const sbRole=document.getElementById('sb-user-role');
  const sbAv=document.getElementById('sb-user-av');
  if(sbName) sbName.textContent=a.name;
  if(sbRole) sbRole.textContent=a.role==='superadmin'?'â­ Superadmin':'ðŸ‘¤ Admin';
  if(sbAv){
    sbAv.textContent=a.name.substring(0,2).toUpperCase();
    sbAv.style.background=a.role==='superadmin'
      ?'linear-gradient(135deg,#8B6914,#D4A843)'
      :'linear-gradient(135deg,#5FA00D,#A8F040)';
  }
}

// â•â•â• SUPERADMIN: MANAJEMEN ADMIN â•â•â•
async function loadSAAdminList(){
  const el=document.getElementById('sa-admin-list');if(!el)return;
  el.innerHTML='<div style="font-size:11px;color:var(--text3);">Memuat...</div>';
  try{
    const admins=await apiFetch('/api/admins');
    if(!Array.isArray(admins)||admins.length===0){el.innerHTML='<div style="font-size:11px;color:var(--text3);">Belum ada admin</div>';return;}
    el.innerHTML=admins.map(a=>`
      <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg3);padding:10px 12px;border-radius:11px;border:1px solid var(--card-b);">
        <div>
          <span style="font-size:13px;font-weight:700;">${a.username}</span>
          <span style="margin-left:7px;font-size:10px;padding:2px 7px;border-radius:20px;background:${a.role==='superadmin'?'rgba(212,168,67,.12)':'var(--green-bg)'};color:${a.role==='superadmin'?'#C4993C':'var(--green2)'};">${a.role}</span>
        </div>
        <div style="display:flex;gap:5px;">
          <button onclick="editSAAdmin('${a.id}','${a.username}','${a.role}')" style="font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;border:1px solid var(--card-b);background:var(--bg3);color:var(--text2);cursor:pointer;font-family:'Inter',sans-serif;">Edit</button>
          ${a.id!==window.activeAdmin?.id?`<button onclick="deleteSAAdmin('${a.id}','${a.username}')" style="font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;border:1px solid rgba(224,48,48,.2);background:rgba(224,48,48,.06);color:var(--danger);cursor:pointer;font-family:'Inter',sans-serif;">Hapus</button>`:'<span style="font-size:10px;color:var(--text3);padding:4px 6px;">Anda</span>'}
        </div>
      </div>`).join('');
  }catch(e){el.innerHTML=`<div style="font-size:11px;color:var(--danger);">Gagal: ${e.message}</div>`;}
}

function openAddAdminFromSettings(){
  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('sm-body');
  tEl.textContent='+ Tambah Admin Baru';
  body.innerHTML=`<div style="display:grid;gap:10px;">
    <div><label class="form-label">Username</label><input class="form-input" id="aa-user" placeholder="username unik..."/></div>
    <div><label class="form-label">Password</label><input class="form-input" id="aa-pass" type="password" placeholder="min 6 karakter..."/></div>
    <div><label class="form-label">Role</label>
      <select class="form-select" id="aa-role">
        <option value="admin">ðŸ‘¤ Admin</option>
        <option value="superadmin">â­ Superadmin</option>
      </select></div>
    <button onclick="saveSANewAdmin()" style="padding:11px;border-radius:11px;border:none;background:var(--green-bg);color:var(--green2);font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">Simpan</button>
  </div>`;
  document.getElementById('sm-overlay').classList.add('open');
}

async function saveSANewAdmin(){
  const username=document.getElementById('aa-user')?.value?.trim();
  const password=document.getElementById('aa-pass')?.value;
  const role=document.getElementById('aa-role')?.value;
  if(!username||!password){showToast('Username & password wajib');return;}
  if(password.length<6){showToast('Password minimal 6 karakter');return;}
  try{
    const id='adm_'+Date.now();
    await sbFetch('admins', {
      method: 'POST',
      body: {id,username,password,role,active:true,created_at:new Date().toISOString()}
    });
    const waktu=new Date().toLocaleString('id-ID');
    logAudit('create','admin',`[${waktu}] - [${window.activeAdmin?.name}] - [Tambah Admin] - [${username}, role: ${role}]`);
    closeSm();loadSAAdminList();showToast('Admin '+username+' ditambahkan âœ…');
  }catch(e){showToast('Error: '+e.message);}
}

function editSAAdmin(id, username, currentRole){
  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('sm-body');
  tEl.textContent='Edit Admin: '+username;
  body.innerHTML=`<div style="display:grid;gap:10px;">
    <div><label class="form-label">Role</label>
      <select class="form-select" id="ea-role">
        <option value="admin" ${currentRole==='admin'?'selected':''}>ðŸ‘¤ Admin</option>
        <option value="superadmin" ${currentRole==='superadmin'?'selected':''}>â­ Superadmin</option>
      </select></div>
    <div><label class="form-label">Password Baru <span style="color:var(--text3);">(kosong = tidak berubah)</span></label>
      <input class="form-input" id="ea-pass" type="password" placeholder="Password baru..."/></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button onclick="closeSm()" style="padding:10px;border-radius:11px;border:1px solid var(--card-b);background:var(--bg3);color:var(--text2);font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">Batal</button>
      <button onclick="saveSAEditAdmin('${id}','${username}')" style="padding:10px;border-radius:11px;border:none;background:var(--green-bg);color:var(--green2);font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">Simpan</button>
    </div>
  </div>`;
  document.getElementById('sm-overlay').classList.add('open');
}

async function saveSAEditAdmin(id, username){
  const role=document.getElementById('ea-role')?.value;
  const pass=document.getElementById('ea-pass')?.value;
  const body={role};
  if(pass&&pass.length>=6) body.password=pass;
  try{
    await sbFetch('admins', {
      method: 'PUT',
      filters: { id: id },
      body: body
    });
    const waktu=new Date().toLocaleString('id-ID');
    logAudit('update','admin',`[${waktu}] - [${window.activeAdmin?.name}] - [Edit Admin] - [${username}, role: ${role}]`);
    closeSm();loadSAAdminList();showToast('Admin '+username+' diperbarui âœ…');
  }catch(e){showToast('Error: '+e.message);}
}

async function deleteSAAdmin(id, username){
  showConfirmPopup('ðŸ—‘ï¸ Hapus Admin',
    `Hapus admin <b>${username}</b>? Aksi ini tidak dapat dibatalkan.`,
    async()=>{
      try{
        await sbFetch('admins', { method:'DELETE', filters:{id:id} });
        const waktu=new Date().toLocaleString('id-ID');
        logAudit('delete','admin',`[${waktu}] - [${window.activeAdmin?.name}] - [Hapus Admin] - [${username}]`);
        loadSAAdminList();showToast('Admin '+username+' dihapus');
      }catch(e){showToast('Error: '+e.message);}
    }
  );
}

function changeRegCode(){
  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('sm-body');
  tEl.textContent='Ganti Kode Daftar Admin';
  body.innerHTML=`<div style="display:grid;gap:10px;">
    <div style="font-size:11px;color:var(--text3);">Kode ini dibutuhkan saat admin baru mendaftar dari halaman login.</div>
    <div><label class="form-label">Kode Baru</label><input class="form-input" id="new-reg-code" placeholder="Kode rahasia..."/></div>
    <button onclick="saveRegCode()" style="padding:10px;border-radius:11px;border:none;background:var(--green-bg);color:var(--green2);font-size:12px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">Simpan</button>
  </div>`;
  document.getElementById('sm-overlay').classList.add('open');
}

async function saveRegCode(){
  const code=document.getElementById('new-reg-code')?.value?.trim();
  if(!code){showToast('Kode tidak boleh kosong');return;}
  try{
    await apiFetch('/api/settings/admin_reg_code', {
      method: 'PUT',
      body: { value: code }
    });
    window._ADMIN_REG_CODE=code;
    const display=document.getElementById('reg-code-display');
    if(display) display.textContent=code;
    closeSm();showToast('Kode daftar diperbarui ke database Central âœ…');
  }catch(e){showToast('Gagal simpan: '+e.message);}
}




// Auto-sync data dari Supabase setiap 60 detik
let _isSyncing = false;
async function syncFromSupabase(){
  if(_isSyncing) return;
  _isSyncing = true;
  setSyncStatus('syncing');
  try{
    const txns = await sbFetch('transactions',{select:'*',limit:500,order:'created_at.desc'});
    if(Array.isArray(txns)){
      transactions = txns.map(t=>({
        id:t.id, 
        type:t.type, 
        amount:Number(t.amount||0),
        label:t.label||(t.type==='inflow'?'Pemasukan':'Pengeluaran'),
        sub:t.sub||'',
        date:t.date||t.created_at?.split('T')[0]||'',
        armada:t.armada||'', 
        muat:t.muat||'',
        bongkar:t.bongkar||'',
        driver:t.driver||'',
        nota:t.nota||'',
        toko:t.toko||'',
        kategori:t.kategori||'',
        status:t.status||'lunas',
        sparepartId:t.sparepart_id||null,
        posisi:t.posisi||'',
        created_at:t.created_at
      }));
    }
    // Sync armada
    const fleet = await sbFetch('fleet',{select:'*',limit:100});
    if(Array.isArray(fleet)){
      fleetData.length=0;
      fleet.forEach(f=>fleetData.push({id:f.id,nopol:f.nopol,driver:f.driver,status:f.status||'jalan',pajak:f.pajak||'',kir:f.kir||''}));
      FLEET_COUNT=fleetData.length;
    }
    // Sync inventory/spareparts
    try {
      const inv = await apiFetch('/api/inventory');
      if(Array.isArray(inv)){
        sparepartStock.length=0;
        inv.forEach(sp=>sparepartStock.push({
          id: sp.id,
          nama: sp.nama,
          spek: sp.spek,
          kategori: sp.kategori,
          toko: sp.toko,
          nota: sp.nota,
          tglMasuk: sp.tgl_masuk || '',
          stokAwal: Number(sp.stok_awal || 0),
          stokSisa: Number(sp.stok_sisa || 0),
          stokMin: Number(sp.stok_min || 5),
          hargaSatuan: Number(sp.harga_satuan || 0),
          catatan: sp.catatan || '',
          installed: sp.installed || []
        }));
      }
    } catch(e) { console.warn('Sync inventory failing:', e); }
    // Sync settings
    try {
      const resp = await apiFetch('/api/settings/inventory_categories');
      if (resp && resp.value) {
        const cats = JSON.parse(resp.value);
        if (Array.isArray(cats)) gudangKategori = cats;
      }
      // Sync Registration Code (Lama)
      const settings = await sbFetch('settings',{select:'*',limit:100});
      if(Array.isArray(settings)){
        const regCode = settings.find(s=>s.key==='admin_reg_code')?.value;
        if(regCode) {
          window._ADMIN_REG_CODE = regCode;
          const display=document.getElementById('reg-code-display');
          if(display) display.textContent=regCode;
        }
      }
    } catch(e) { console.warn('Settings sync fail:', e); }

    // Simpan cache ke localStorage agar tersedia saat offline/next load
    try {
      localStorage.setItem('bhd_cache_transactions', JSON.stringify(transactions));
      localStorage.setItem('bhd_cache_fleet', JSON.stringify(fleetData));
      localStorage.setItem('bhd_cache_inventory', JSON.stringify(sparepartStock));
    } catch(e) { console.warn('Cache localStorage gagal:', e); }


    setSyncStatus('success');
    renderDashboard();
    applyTxnFilters?.();
    renderLaporanTable?.();
    renderGudang?.();
  }catch(e){
    console.warn('Sync error:',e);
    setSyncStatus('error');
    setConnectionStatus('offline');
  } finally {
    _isSyncing = false;
  }
}



// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• INIT â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â•â•â• CHART CAROUSEL (Swipeable) â•â•â•
let _carouselIdx=0;
function goToChart(idx){
  _carouselIdx=idx;
  const slides=document.getElementById('chart-slides');
  if(slides) slides.style.transform=`translateX(-${idx*100}%)`;
  document.querySelectorAll('.chart-dot').forEach((d,i)=>{
    d.style.background=i===idx?'var(--green)':'var(--card-b)';
    d.style.width=i===idx?'18px':'6px';
    d.style.borderRadius='3px';
  });
  // Re-render chart on slide change (canvas resize fix)
  if(idx===0) setTimeout(()=>{renderDonut(totalInflow(transactions),totalOutflow(transactions));},50);
  if(idx===1) setTimeout(()=>{renderMiniLine();},50);
  if(idx===2) setTimeout(()=>{renderBarChart(currentBarFilter);},50);
}

function initCarouselSwipe(){
  const wrap=document.getElementById('chart-carousel');
  if(!wrap||wrap._swipeInit) return;
  wrap._swipeInit=true;
  let startX=0,startY=0,isDragging=false;
  wrap.addEventListener('touchstart',e=>{
    startX=e.touches[0].clientX;
    startY=e.touches[0].clientY;
    isDragging=true;
  },{passive:true});
  wrap.addEventListener('touchend',e=>{
    if(!isDragging) return;
    isDragging=false;
    const dx=e.changedTouches[0].clientX-startX;
    const dy=e.changedTouches[0].clientY-startY;
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>40){
      if(dx<0) goToChart(Math.min(2,_carouselIdx+1));
      else goToChart(Math.max(0,_carouselIdx-1));
    }
  },{passive:true});
  // Mouse drag for desktop
  wrap.addEventListener('mousedown',e=>{startX=e.clientX;isDragging=true;});
  wrap.addEventListener('mouseup',e=>{
    if(!isDragging) return;
    isDragging=false;
    const dx=e.clientX-startX;
    if(Math.abs(dx)>40){
      if(dx<0) goToChart(Math.min(2,_carouselIdx+1));
      else goToChart(Math.max(0,_carouselIdx-1));
    }
  });
}

function setSyncStatus(status) {
  const dot = document.querySelector('.sync-dot');
  const txt = document.getElementById('sync-text');
  if(!dot || !txt) return;
  if(status === 'syncing') {
    dot.style.background = 'var(--info)';
    txt.textContent = 'Sinkronisasi...';
    dot.classList.add('pulse-sync');
    setConnectionStatus('syncing');
  } else if(status === 'success') {
    dot.style.background = 'var(--success)';
    txt.textContent = 'Singkron: ' + new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
    dot.classList.remove('pulse-sync');
    setConnectionStatus('online');
  } else {
    dot.style.background = 'var(--text4)';
    txt.textContent = 'Belum sync';
    dot.classList.remove('pulse-sync');
    setConnectionStatus('offline');
  }
}


function setConnectionStatus(status) {
  const el = document.getElementById('conn-status');
  const badge = document.getElementById('api-status-badge');
  if(!el) return;
  
  if(status === 'online' || status === 'ok') {
    el.textContent = 'â— Online';
    el.style.background = 'rgba(52,199,89,0.12)';
    el.style.color = '#1a7a3a';
    if(badge){ badge.textContent = 'Online'; badge.style.color = 'var(--success)'; badge.style.display = 'block'; }
  } else if(status === 'offline' || status === 'error') {
    el.textContent = 'â— Offline';
    el.style.background = 'rgba(255,59,48,0.1)';
    el.style.color = '#c0392b';
    if(badge){ badge.textContent = 'Offline'; badge.style.color = 'var(--danger)'; badge.style.display = 'block'; }
  } else if(status === 'syncing') {
    el.textContent = 'â— Sinkronisasi...';
    el.style.background = 'rgba(255,149,0,0.1)';
    el.style.color = '#b36a00';
    if(badge){ badge.textContent = 'Syncing'; badge.style.color = 'var(--orange)'; badge.style.display = 'block'; }
  }
}



async function apiPing() {
  const url = `${getApiBase()}/api/ping`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3000)
    });
    console.log('ðŸ“¡ Ping Response:', res.status, res.ok);
    return res.ok;
  } catch(e) { 
    console.warn('âŒ Ping Failed at:', url, e.message);
    return false; 
  }
}

function initRealtimeSync() {
  const url = `${getApiBase()}/api/realtime`;
  console.log('ðŸ”Œ Memulai SSE di:', url);
  const es = new EventSource(url);
  
  es.onopen = () => {
    console.log('âœ… SSE Terhubung');
    setConnectionStatus('online');
  };
  
  es.onerror = (err) => {
    console.warn('âŒ SSE Error:', err);
    es.close();
    setTimeout(initRealtimeSync, 5000); // Reconnect after 5s
  };
  
  es.addEventListener('sync', (e) => {
    console.log('ðŸ“¥ SSE Sync received');
    syncFromSupabase();
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => es.close());
}

async function _appInit(){

  try{
    updateSettingsAdminInfo();
    initCarouselSwipe();
    goToChart(0);
    
    // Server health is now checked in preFetchSettings()
    // We just trigger initial manual sync
    showToast('â³ Sinkronisasi data...');
    await syncFromSupabase();
    
    checkDocWarnings();
    setInterval(syncFromSupabase, 15000);
    document.addEventListener('visibilitychange',()=>{ if(!document.hidden) syncFromSupabase(); });
    
    const waktu=new Date().toLocaleString('id-ID');
    const adminName=window.activeAdmin?.name||'System';
    logAudit('login','login',`[${waktu}] - [${adminName}] - [Login] - [Masuk ke sistem]`);
  }catch(e){ console.error('Init error:',e); }
}

// Fetch registration code on page load so it's ready for new admin registration
(async function preFetchSettings(){
  try {
    // Check server health immediately on load
    const serverOnline = await apiPing();
    if(serverOnline) {
      setConnectionStatus('online');
      initRealtimeSync();
    } else {
      setConnectionStatus('offline');
      console.warn('Backend server offline during pre-fetch');
    }

    const settings = await sbFetch('settings',{select:'*',limit:100});
    if(Array.isArray(settings)){
      const regCode = settings.find(s=>s.key==='admin_reg_code')?.value;
      if(regCode) {
        window._ADMIN_REG_CODE = regCode;
        const display=document.getElementById('reg-code-display');
        if(display) display.textContent=regCode;
        console.log('âœ… Registration code synced from database');
      }
    }
  } catch(e) { 
    console.warn('Pre-fetch settings fail:', e); 
    setConnectionStatus('offline');
  }
})();
// App init is triggered by login â€” do NOT auto-call here


