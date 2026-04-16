# Arahan Perbaikan Kode — BHD SmartFlow System
> Kirim prompt ini ke AI untuk perbaikan kode index.html

---

## Konteks Aplikasi

Ini adalah aplikasi **BHD SmartFlow System** — sistem manajemen keuangan & armada berbasis single HTML file. Stack yang digunakan:
- Frontend: Vanilla HTML + CSS + JS (single file `index.html`)
- Backend: Node.js server berjalan di port 3001
- Database: Supabase (PostgreSQL)
- Semua komunikasi ke Supabase melalui backend API (`/api/...`), bukan langsung dari frontend

---

## Daftar Perbaikan yang Harus Dilakukan

---

### PERBAIKAN 1 — Tambahkan error handling & notifikasi saat simpan data gagal

**Masalah:**
Semua operasi write (POST/PATCH/DELETE) hanya menggunakan `.catch(e => console.warn(...))`. Jika gagal, user tidak tahu sama sekali karena tidak ada toast/notifikasi error.

**Yang harus diperbaiki:**
Ganti semua `.catch(e => console.warn(...))` pada operasi simpan data menjadi menampilkan toast error ke user.

**Contoh sebelum:**
```js
sbFetch('transactions', {method:'POST', body:dbTxn}).catch(e => console.warn('Supabase pasang txn:', e));
```

**Contoh sesudah:**
```js
sbFetch('transactions', {method:'POST', body:dbTxn})
  .catch(e => {
    console.warn('Supabase pasang txn:', e);
    showToast('❌ Gagal menyimpan transaksi. Periksa koneksi server.');
  });
```

Terapkan pola yang sama untuk semua operasi sbFetch yang bersifat write (POST, PATCH, DELETE) di seluruh file.

---

### PERBAIKAN 2 — Tambahkan pengecekan server online sebelum menyimpan data

**Masalah:**
Variabel `_useAPI` sudah ada tapi tidak pernah dipakai di dalam fungsi `sbFetch`. Akibatnya, app tetap mencoba menyimpan ke backend meski server offline.

**Yang harus diperbaiki:**
Panggil `apiPing()` saat app pertama kali load (di `_appInit`), dan tampilkan peringatan jika server tidak terdeteksi.

**Tambahkan di fungsi `_appInit`:**
```js
async function _appInit(){
  try{
    const serverOnline = await apiPing();
    if(!serverOnline){
      showToast('⚠️ Server backend tidak terdeteksi. Data tidak akan tersimpan.');
      console.warn('Backend server offline — semua perubahan hanya tersimpan sementara di memori.');
    }
    // ... sisa kode _appInit yang sudah ada
  }
}
```

---

### PERBAIKAN 3 — Simpan data ke localStorage setelah sync dari Supabase

**Masalah:**
Fungsi `syncFromSupabase()` membaca data dari backend/Supabase dan menyimpan ke array di memori (`transactions`, `fleetData`, `sparepartStock`), tapi tidak pernah menyimpannya ke `localStorage`. Akibatnya, saat user refresh/login ulang, cache yang dibaca adalah cache lama.

**Yang harus diperbaiki:**
Di akhir fungsi `syncFromSupabase()`, sebelum baris `setSyncStatus('ok')`, tambahkan:

```js
// Simpan cache ke localStorage agar tersedia saat login berikutnya
try {
  localStorage.setItem('bhd_cache_transactions', JSON.stringify(transactions));
  localStorage.setItem('bhd_cache_fleet', JSON.stringify(fleetData));
  localStorage.setItem('bhd_cache_inventory', JSON.stringify(sparepartStock));
} catch(e) {
  console.warn('Cache localStorage gagal:', e);
}
```

---

### PERBAIKAN 4 — Perbaiki race condition saat simpan + sync

**Masalah:**
Banyak operasi simpan memanggil `syncFromSupabase()` di dalam `.then()` setelah write, tapi ada yang tidak di-await dengan benar sehingga sync berjalan sebelum data benar-benar masuk ke database.

**Pola yang bermasalah:**
```js
sbFetch('transactions', {method:'POST', body:dbTxn}).catch(e=>console.warn(...));
// baris berikutnya langsung jalan tanpa menunggu POST selesai
```

**Yang harus diperbaiki:**
Pastikan operasi write dijalankan dengan `async/await` yang benar, dan `syncFromSupabase()` dipanggil setelah write berhasil:

```js
// Contoh perbaikan submitInflow / submitOutflow
try {
  await sbFetch('transactions', {method:'POST', body:dbTxn});
  await syncFromSupabase();
} catch(e) {
  console.warn('Gagal simpan transaksi:', e);
  showToast('❌ Gagal menyimpan. Coba lagi.');
}
```

Terapkan pola `async/await` yang konsisten pada semua fungsi yang melakukan write ke database: `submitInflow`, `submitOutflow`, `saveGudangItem`, `deleteGudangItem`, `saveFleetUnit`, `deleteFleetUnit`, dll.

---

### PERBAIKAN 5 — Perbaiki `API_BASE` agar bekerja di semua environment

**Masalah:**
Kondisi saat ini:
```js
const API_BASE = window.location.protocol === 'file:' || ...
  ? 'http://127.0.0.1:3001'
  : (window.location.port ? `http://${window.location.hostname}:3001` : "");
```

Jika app di-deploy ke domain tanpa port (misal `https://bhd.perusahaan.com`), maka `API_BASE` menjadi string kosong `""`, dan semua request API mengarah ke path yang salah.

**Yang harus diperbaiki:**
```js
function getApiBase() {
  const proto = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port;

  // Akses lokal via file atau localhost
  if (proto === 'file:' || host === '127.0.0.1' || host === 'localhost') {
    return 'http://127.0.0.1:3001';
  }
  // Akses via IP jaringan lokal (misal 192.168.x.x)
  if (/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    return `http://${host}:3001`;
  }
  // Akses via domain publik — backend diasumsikan sama origin atau sudah dikonfigurasi
  return `${proto}//${host}${port ? ':'+port : ''}`;
}
const API_BASE = getApiBase();
```

---

### PERBAIKAN 6 — Tambahkan Supabase Realtime untuk multi-device sync

**Masalah:**
Saat ini sync hanya terjadi setiap 15 detik via `setInterval`. Untuk multi-device, perubahan dari device lain tidak langsung terlihat.

**Yang harus diperbaiki:**
Tambahkan koneksi Supabase Realtime di backend (`server.js` / `index.js`), lalu kirim event ke frontend via WebSocket atau Server-Sent Events (SSE).

**Di backend (Node.js), tambahkan endpoint SSE:**
```js
// server.js
app.get('/api/realtime', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Supabase realtime channel
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

**Di frontend (`index.html`), tambahkan di `_appInit`:**
```js
function initRealtimeSync() {
  try {
    const evtSource = new EventSource(API_BASE + '/api/realtime');
    evtSource.onmessage = (e) => {
      console.log('Realtime event:', e.data);
      syncFromSupabase(); // refresh data saat ada perubahan dari device lain
    };
    evtSource.onerror = () => {
      console.warn('Realtime connection lost, fallback ke polling 15s');
    };
  } catch(e) {
    console.warn('Realtime tidak tersedia:', e);
  }
}
// Panggil di _appInit setelah syncFromSupabase pertama kali berhasil
```

---

### PERBAIKAN 7 — Tambahkan indikator visual status koneksi server

**Masalah:**
User tidak tahu apakah app sedang terhubung ke server/database atau tidak.

**Yang harus diperbaiki:**
Tambahkan indikator kecil di topbar atau sidebar yang menunjukkan status koneksi.

**Tambahkan elemen HTML di area topbar/sidebar (sesuaikan dengan struktur yang sudah ada):**
```html
<div id="conn-status" style="font-size:10px; padding:3px 8px; border-radius:20px; font-weight:600;">
  ● Terhubung
</div>
```

**Tambahkan fungsi untuk update status:**
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

Panggil `setConnectionStatus('syncing')` di awal `syncFromSupabase()`, `setConnectionStatus('ok')` di akhir, dan `setConnectionStatus('error')` di catch block.

---

## Urutan Prioritas Perbaikan

| No | Perbaikan | Prioritas | Dampak |
|----|-----------|-----------|--------|
| 3 | Cache localStorage | 🔴 Tinggi | Data hilang saat refresh |
| 4 | Race condition async/await | 🔴 Tinggi | Data tidak konsisten |
| 1 | Error handling toast | 🔴 Tinggi | User tidak tahu saat gagal |
| 2 | Pengecekan server online | 🟡 Sedang | Pencegahan data loss |
| 5 | Perbaikan API_BASE | 🟡 Sedang | Deploy ke domain publik |
| 7 | Indikator status koneksi | 🟡 Sedang | UX multi-device |
| 6 | Supabase Realtime | 🟢 Rendah | Fitur multi-device penuh |

---

## Catatan Penting untuk AI

- Jangan ubah struktur HTML, CSS, atau logika bisnis yang sudah ada
- Semua perubahan harus backward compatible
- Fungsi `showToast(msg)` sudah tersedia, gunakan langsung
- Fungsi `setSyncStatus(status)` sudah ada, integrasikan dengan `setConnectionStatus`
- Perbaikan No. 6 (Realtime) memerlukan perubahan di file backend (server.js), bukan hanya di index.html
- Pastikan semua fungsi write tetap bisa berjalan secara optimistic (update UI dulu, sync belakangan) agar UX tetap cepat
