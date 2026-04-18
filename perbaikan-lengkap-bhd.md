# Arahan Perbaikan Lengkap — BHD SmartFlow System
> Dokumen ini menggabungkan SEMUA perbaikan yang perlu dilakukan sekaligus.
> Kerjakan sesuai urutan prioritas.

---

## PRIORITAS 1 — Bug Kritis (Harus dikerjakan duluan)

---

### Fix 1.1 — Syntax Error: Fungsi Terpotong di Baris 1787

**File:** `index.html`

Fungsi `renderGudangFilterChips` badannya terpotong dan menyatu dengan
`openAddStockModal`. Ini menyebabkan **seluruh JavaScript error**.

Cari dan ganti bagian yang rusak ini:
```js
function renderGudangFilterChips(){
  const el=document.gfunction openAddStockModal(editId){
```

Ganti dengan dua fungsi terpisah yang benar:
```js
function renderGudangFilterChips(){
  const el=document.getElementById('gudang-filter-chips');
  if(!el) return;
  el.innerHTML='<button class="fs-chip filter-chip'+(gudangFilter==='all'?' active':'')+'" onclick="setGudangFilter(\'all\',this)">Semua</button>'
    +gudangKategori.map(k=>'<button class="fs-chip filter-chip'+(gudangFilter===k?' active':'')+'" onclick="setGudangFilter(\''+k+'\',this)">'+getSpCatIcon(k)+' '+k+'</button>').join('');
}

function openAddStockModal(editId){
```

---

### Fix 1.2 — Login Freeze: Tambahkan Timeout ke apiFetch

**File:** `index.html`

Fungsi `apiFetch` tidak punya timeout sehingga halaman login freeze jika server mati.

Cari fungsi `apiFetch`, ubah baris `fetch`:
```js
// Sebelum:
const r = await fetch(API_BASE + path, {
  headers,
  ...opts,
  body: opts.body ? JSON.stringify(opts.body) : undefined,
});

// Sesudah:
const r = await fetch(API_BASE + path, {
  headers,
  signal: AbortSignal.timeout(5000),
  ...opts,
  body: opts.body ? JSON.stringify(opts.body) : undefined,
});
```

---

## PRIORITAS 2 — Data Tidak Tersimpan

---

### Fix 2.1 — Cache localStorage Tidak Diperbarui Setelah Sync

**File:** `index.html`

Di akhir fungsi `syncFromSupabase()`, sebelum baris `setSyncStatus('ok')`, tambahkan:

```js
try {
  localStorage.setItem('bhd_cache_transactions', JSON.stringify(transactions));
  localStorage.setItem('bhd_cache_fleet', JSON.stringify(fleetData));
  localStorage.setItem('bhd_cache_inventory', JSON.stringify(sparepartStock));
} catch(e) {
  console.warn('Cache localStorage gagal:', e);
}
```

---

### Fix 2.2 — Race Condition: Operasi Write Tidak Di-await dengan Benar

**File:** `index.html`

Semua fungsi yang melakukan write ke database harus menggunakan `async/await`
yang benar. Terapkan pola ini secara konsisten di fungsi:
`submitInflow`, `submitOutflow`, `saveGudangItem`, `deleteGudangItem`,
`saveFleetUnit`, `deleteFleetUnit`, `saveDocs`.

```js
// Pola yang benar:
try {
  await sbFetch('transactions', {method:'POST', body:dbTxn});
  await syncFromSupabase();
} catch(e) {
  console.warn('Gagal:', e);
  showToast('❌ Gagal menyimpan. Coba lagi.');
}
```

---

### Fix 2.3 — Error Handling: Tampilkan Toast Saat Gagal Simpan

**File:** `index.html`

Ganti semua `.catch(e => console.warn(...))` pada operasi write menjadi:
```js
.catch(e => {
  console.warn('Error:', e);
  showToast('❌ Gagal menyimpan [nama data]. Periksa koneksi server.');
});
```

---

### Fix 2.4 — Perbaiki API_BASE untuk Semua Environment

**File:** `index.html`

Ganti konstanta `API_BASE` yang ada dengan fungsi yang lebih robust:

```js
function getApiBase() {
  const proto = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port;
  if (proto === 'file:' || host === '127.0.0.1' || host === 'localhost') {
    return 'http://127.0.0.1:3001';
  }
  if (/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    return `http://${host}:3001`;
  }
  return `${proto}//${host}${port ? ':'+port : ''}`;
}
const API_BASE = getApiBase();
```

---

### Fix 2.5 — Pengecekan Server Online Saat App Pertama Kali Load

**File:** `index.html`

Tambahkan di awal fungsi `_appInit()`:
```js
const serverOnline = await apiPing();
if(!serverOnline){
  showToast('⚠️ Server backend tidak terdeteksi. Data tidak akan tersimpan.');
}
```

---

### Fix 2.6 — Tambahkan Indikator Status Koneksi

**File:** `index.html`

Tambahkan elemen HTML di area topbar/sidebar:
```html
<div id="conn-status" style="font-size:10px;padding:3px 8px;border-radius:20px;font-weight:600;"></div>
```

Tambahkan fungsi:
```js
function setConnectionStatus(status) {
  const el = document.getElementById('conn-status');
  if (!el) return;
  if (status === 'ok') {
    el.textContent = '● Online';
    el.style.background = 'rgba(52,199,89,0.12)';
    el.style.color = '#1a7a3a';
  } else if (status === 'error') {
    el.textContent = '● Offline';
    el.style.background = 'rgba(255,59,48,0.1)';
    el.style.color = '#c0392b';
  } else {
    el.textContent = '● Sinkronisasi...';
    el.style.background = 'rgba(255,149,0,0.1)';
    el.style.color = '#b36a00';
  }
}
```

Panggil `setConnectionStatus('syncing')` di awal `syncFromSupabase()`,
`setConnectionStatus('ok')` di akhir, dan `setConnectionStatus('error')` di catch.

---

## PRIORITAS 3 — Fitur Settings: SB_URL Tidak Terdefinisi

---

### Fix 3.1 — Refactor Fungsi Admin Management dari SB_URL ke apiFetch

**File:** `index.html`

Lima fungsi berikut masih menggunakan koneksi Supabase langsung dengan `SB_URL`
dan `SB_KEY` yang tidak pernah didefinisikan. Ganti semua dengan `apiFetch`.

**Fungsi `loadSAAdminList` — ganti baris fetch:**
```js
// Sebelum:
const res=await fetch(`${SB_URL}/rest/v1/admins?select=id,username,role&order=username.asc`,
  {headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}});
const admins=await res.json();

// Sesudah:
const admins=await apiFetch('/api/admins');
```

**Fungsi `saveSANewAdmin` — ganti baris fetch:**
```js
// Sebelum:
const res=await fetch(`${SB_URL}/rest/v1/admins`,{
  method:'POST',
  headers:{'apikey':SB_KEY,...},
  body:JSON.stringify({id,username,password,role,active:true,created_at:new Date().toISOString()})
});
if(!res.ok){const e=await res.json();throw new Error(e.message||'Gagal');}

// Sesudah:
await apiFetch('/api/admins', {
  method: 'POST',
  body: {id,username,password,role,active:true,created_at:new Date().toISOString()}
});
```

**Fungsi `saveSAEditAdmin` — ganti baris fetch:**
```js
// Sebelum:
const res=await fetch(`${SB_URL}/rest/v1/admins?id=eq.${id}`,{
  method:'PATCH', headers:{'apikey':SB_KEY,...}, body:JSON.stringify(body)
});
if(!res.ok) throw new Error('Gagal update');

// Sesudah:
await apiFetch(`/api/admins/${id}`, { method: 'PUT', body: body });
```

**Fungsi `deleteSAAdmin` — ganti baris fetch:**
```js
// Sebelum:
await fetch(`${SB_URL}/rest/v1/admins?id=eq.${id}`,
  {method:'DELETE',headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}});

// Sesudah:
await apiFetch(`/api/admins/${id}`, { method: 'DELETE' });
```

**Fungsi `saveRegCode` — ganti baris fetch:**
```js
// Sebelum:
const res=await fetch(`${SB_URL}/rest/v1/settings?key=eq.admin_reg_code`,{
  method:'PATCH', headers:{'apikey':SB_KEY,...}, body:JSON.stringify({value:code})
});
if(!res.ok) throw new Error('Gagal simpan ke database');

// Sesudah:
await apiFetch('/api/settings/admin_reg_code', { method: 'PUT', body: {value: code} });
```

> Jika endpoint `/api/admins` atau `/api/settings/admin_reg_code` belum ada
> di `api/index.js`, tambahkan juga endpoint tersebut di backend.

---

## PRIORITAS 4 — Logika Stok & Tire Management

---

### Fix 4.1 — Bug txnId: Array installed Tidak Dibersihkan Saat Hapus Transaksi

**File:** `index.html`

**Masalah:** Saat outflow onderdil disimpan, `txnId` dibuat sebagai angka murni.
Tapi saat dihapus, pencarian menggunakan id transaksi yang punya prefix `txn_`.
Keduanya tidak pernah cocok.

**Langkah 1** — Di `submitOutflow`, saat membuat record `installed`, gunakan `outId`:
```js
// Sebelum:
spCopy.installed = [...sp.installed, {
  armada: armada||'UMUM', tglPasang: date, ritase: 0,
  txnId: Date.now()   // ❌ angka baru
}];

// Sesudah:
spCopy.installed = [...sp.installed, {
  armada: armada||'UMUM', tglPasang: date, ritase: 0,
  txnId: outId        // ✅ id transaksi yang sama
}];
```

**Langkah 2** — Lakukan hal yang sama di fungsi `confirmPassang` (pasang onderdil
dari gudang). Pastikan `txnId` menggunakan id transaksi yang disimpan.

**Langkah 3** — Di `deleteTxn`, perbaiki filter `installed`:
```js
// Sebelum:
const newInstalled = sp.installed.filter(i =>
  !String(i.txnId).startsWith(String(id))
);

// Sesudah:
const newInstalled = sp.installed.filter(i => {
  const txnIdStr = String(i.txnId);
  const idStr = String(id);
  return txnIdStr !== idStr &&
         !txnIdStr.startsWith(idStr) &&
         !idStr.startsWith(txnIdStr.replace('txn_', ''));
});
```

---

### Fix 4.2 — Tire Management Tidak Tampil: Format Posisi Tidak Cocok

**File:** `index.html`

**Masalah:** Dropdown posisi ban menggunakan format kode (`SKR 1`, `SKN 1`, dll)
tapi visualisasi di tab Truck mencari dengan nama lengkap (`Depan Kiri`, dll).
Akibatnya semua ban selalu tampil abu-abu "?" meski data sudah ada.

Ganti **semua** dropdown posisi ban di 3 tempat berikut:
1. Form Input Outflow (`out-pos-select`)
2. Form Edit Transaksi (`et-pos`)
3. Form Pasang Onderdil di gudang

```html
<!-- Sebelum -->
<option value="SKR 1">Sumbu 1 Kiri (SKR 1)</option>
<option value="SKN 1">Sumbu 1 Kanan (SKN 1)</option>
<option value="SKR D 2">Sumbu 2 Kiri Dalam (SKR D 2)</option>
<option value="SKR L 2">Sumbu 2 Kiri Luar (SKR L 2)</option>
<option value="SKN D 2">Sumbu 2 Kanan Dalam (SKN D 2)</option>
<option value="SKN L 2">Sumbu 2 Kanan Luar (SKN L 2)</option>
<option value="SKR D 3">Sumbu 3 Kiri Dalam (SKR D 3)</option>
<option value="SKR L 3">Sumbu 3 Kiri Luar (SKR L 3)</option>
<option value="SKN D 3">Sumbu 3 Kanan Dalam (SKN D 3)</option>
<option value="SKN L 3">Sumbu 3 Kanan Luar (SKN L 3)</option>

<!-- Sesudah — value harus sama persis dengan label di renderTruckTab -->
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
```

---

### Fix 4.3 — Kode Registrasi Admin: Hapus Fallback Hardcoded

**File:** `index.html`

Kode lama `BHD2024` selalu bisa dipakai karena ada sebagai fallback hardcoded.
Setelah Fix 3.1 selesai dan `saveRegCode` sudah menyimpan ke database,
ubah logika validasi kode di fungsi `doRegister`:

```js
// Sebelum:
let validCode = window._ADMIN_REG_CODE || ADMIN_REG_CODE;  // fallback ke 'BHD2024'
try {
  const sdata = await apiFetch('/api/settings');
  if(sdata && sdata.admin_reg_code) validCode = sdata.admin_reg_code;
} catch(e){ console.warn('Fetch live regcode fail, using last known'); }

// Sesudah:
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
```

Kemudian hapus baris konstanta hardcoded:
```js
// Hapus baris ini:
const ADMIN_REG_CODE = 'BHD2024';
```

---

## PRIORITAS 5 — Multi-Device Realtime Sync

---

### Fix 5.1 — Tambahkan Server-Sent Events (SSE) untuk Realtime Sync

**File:** `api/index.js` (backend) + `index.html` (frontend)

**Di backend `api/index.js`, tambahkan endpoint SSE:**
```js
app.get('/api/realtime', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const channel = supabase
    .channel('db-changes')
    .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    })
    .subscribe();

  req.on('close', () => {
    supabase.removeChannel(channel);
  });
});
```

**Di frontend `index.html`, tambahkan di `_appInit` setelah sync pertama:**
```js
function initRealtimeSync() {
  try {
    const evtSource = new EventSource(API_BASE + '/api/realtime');
    evtSource.onmessage = () => { syncFromSupabase(); };
    evtSource.onerror = () => {
      console.warn('Realtime putus, fallback ke polling 15 detik');
    };
  } catch(e) {
    console.warn('Realtime tidak tersedia:', e);
  }
}
```

---

## Catatan Penting

- Kerjakan perbaikan sesuai urutan prioritas (1 → 5)
- Prioritas 1 harus selesai dulu sebelum yang lain, karena syntax error membuat
  semua fungsi tidak berjalan
- Fungsi `showToast(msg)` sudah tersedia global, gunakan langsung
- Jangan ubah struktur HTML, CSS, atau logika bisnis lain di luar bagian yang disebutkan
- Prioritas 5 memerlukan perubahan di dua file sekaligus: `api/index.js` dan `index.html`
