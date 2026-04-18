# Perbaikan: Fungsi Duplikat & Ping Endpoint Salah

## Masalah yang Ditemukan

Ada 3 fungsi yang didefinisikan dua kali di `index.html`. JavaScript memakai
definisi yang paling bawah, tapi definisi yang lama masih ada dan menyebabkan
konflik. Selain itu, fungsi `apiPing` yang aktif menggunakan endpoint yang salah
dan tidak ada timeout-nya.

---

## Yang Harus Dilakukan

### 1. Hapus Definisi Duplikat (versi lama)

Hapus blok fungsi berikut yang ada di sekitar baris 4163–4199 (versi LAMA,
bukan yang di bagian bawah file):

```js
// HAPUS fungsi ini (versi lama setConnectionStatus sekitar baris 4163):
function setConnectionStatus(status) {
  const el = document.getElementById('conn-status');
  if (!el) return;
  if (status === 'ok') {
    el.textContent = '● ONLINE';
    el.style.color = 'var(--success)';
  } else if (status === 'error') {
    el.textContent = '● OFFLINE';
    el.style.color = 'var(--danger)';
  } else {
    el.textContent = '● SYNCING...';
    el.style.color = 'var(--warning)';
  }
}

// HAPUS fungsi ini (versi lama setSyncStatus sekitar baris 4178):
function setSyncStatus(status){
  const dot = document.querySelector('.sync-dot');
  const txt = document.getElementById('sync-text');
  if(!dot||!txt) return;
  if(status==='syncing'){ 
    dot.style.background='var(--warning)'; 
    txt.textContent='Syncing...'; 
    dot.style.animation='ap 1s infinite';
    setConnectionStatus('syncing');
  } else if(status==='ok'){ 
    dot.style.background='var(--success)'; 
    const t=new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}); 
    txt.textContent='Sync '+t; 
    dot.style.animation=''; 
    _lastSyncTime=new Date();
    setConnectionStatus('ok');
  } else if(status==='error'){ 
    dot.style.background='var(--danger)'; 
    txt.textContent='Offline'; 
    dot.style.animation='';
    setConnectionStatus('error');
  }
}
```

**Pertahankan** hanya versi yang ada di bagian bawah file (sekitar baris 4346
dan 4368) karena itu yang lebih lengkap dan benar.

---

### 2. Hapus Definisi `apiPing` Lama di Baris 1375

Hapus fungsi `apiPing` yang pertama (sekitar baris 1375):
```js
// HAPUS ini:
async function apiPing(){
  try{
    const r = await fetch(API_BASE+'/api/ping',{signal:AbortSignal.timeout(2000)});
    _useAPI = r.ok;
  } catch(e){ _useAPI = false; }
  return _useAPI;
}
```

---

### 3. Perbaiki `apiPing` yang Aktif (sekitar baris 4393)

Versi aktif `apiPing` menggunakan endpoint `/realtime?ping=1` dengan HEAD method
yang mungkin tidak tersedia. Ganti dengan endpoint `/api/ping` yang sudah terbukti
bekerja, dan tambahkan timeout:

```js
// Sebelum:
async function apiPing() {
  try {
    const res = await fetch(`${getApiBase()}/realtime?ping=1`, {method:'HEAD'});
    return res.ok;
  } catch(e) { return false; }
}

// Sesudah:
async function apiPing() {
  try {
    const res = await fetch(`${getApiBase()}/api/ping`, {
      signal: AbortSignal.timeout(3000)
    });
    return res.ok;
  } catch(e) { return false; }
}
```

---

### 4. Pastikan `setSyncStatus('error')` Memperbarui Status Koneksi

Di fungsi `setSyncStatus` yang aktif (sekitar baris 4346), bagian `else`
(untuk status `'error'`) tidak memanggil `setConnectionStatus`. Tambahkan:

```js
// Sebelum:
  } else {
    dot.style.background = 'var(--text4)';
    txt.textContent = 'Belum sync';
    dot.classList.remove('pulse-sync');
  }

// Sesudah:
  } else {
    dot.style.background = 'var(--text4)';
    txt.textContent = 'Belum sync';
    dot.classList.remove('pulse-sync');
    setConnectionStatus('offline');
  }
```

---

## Catatan
- Jangan hapus `getApiBase()` — fungsi itu sudah benar dan dibutuhkan
- Setelah perubahan ini, indikator Online/Offline/Syncing akan bekerja konsisten
- Tidak perlu mengubah file `api/index.js` untuk perbaikan ini
