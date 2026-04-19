# 🔧 Deep Bug Fix Report — BHD SmartFlow
**Tanggal:** 17 April 2026  
**Severity:** Critical  
**Scope:** `index.html` + Supabase Database

---

## Daftar Bug

| # | Bug | Root Cause |
|---|-----|-----------|
| 1 | 4 item sangkut di laporan keuangan — tidak bisa diklik/dihapus | ID type mismatch integer vs string + perlu hapus manual di Supabase |
| 2 | Item onderdil tidak bisa dihapus — `closeSm()` tutup popup sebelum konfirmasi | `closeSm()` dipanggil bersamaan dengan `deleteSparepart()` di onclick |
| 3 | "Hapus Semua Transaksi" tidak berfungsi | `apiFetch` crash (204) + guard `txns.length>0` memblokir reset |
| 4 | `apiFetch` crash untuk semua DELETE/POST yang return 204 | `r.json()` throw saat body kosong |
| 5 | `deleteKategori` balik setelah refresh | Error di-swallow, server tidak tersimpan |

---

## Akar Masalah Utama — Wajib Fix Pertama

**Lokasi:** `apiFetch()` — sekitar line **1403**

```javascript
// ❌ SEKARANG — selalu paksa parse JSON, throw jika body kosong
return r.json();
```

Ketika server berhasil dan mengembalikan **HTTP 204 No Content**, `r.json()` melempar `SyntaxError`. Error ini menyebar ke atas dan menghentikan seluruh alur hapus sebelum selesai — modal macet, item tidak terhapus dari UI.

```javascript
// ✅ FIX — ganti baris return r.json() dengan:
if (r.status === 204) return { ok: true };
const text = await r.text();
if (!text || !text.trim()) return { ok: true };
try { return JSON.parse(text); } catch { return { ok: true }; }
```

> Fix ini wajib dipasang pertama. Semua bug lain bergantung padanya.

---

## Bug #1 — 4 Item Sangkut: Tidak Bisa Diklik & Tidak Bisa Dihapus

**Item:**
- `outflow` — Baut Roda (R16HD) × 3 unit
- `outflow` — UMUM "ww" × 1 unit

### Mengapa tidak bisa diklik sama sekali?

Item-item ini sudah tersimpan di Supabase dengan **ID format lama** (kemungkinan integer auto-increment seperti `1`, `2`, `3`, `4`). Item baru menggunakan format string `txn_1713340800000`.

Saat di-render ke HTML, `onclick="toggleTxn('1')"` mengirim string `'1'`, tapi di dalam fungsi `deleteTxn`:

```javascript
// ❌ Strict equality gagal untuk integer vs string
const txn = transactions.find(t => t.id === id);
// find(t => 1 === '1') → false → txn = undefined → return diam-diam
```

Untuk `toggleTxn`, elemen ditemukan tapi jika ada ID duplikat akibat format lama, hanya elemen pertama yang toggle.

### Fix #1A — Hapus Manual dari Supabase (Wajib untuk 4 item ini)

Buka **Supabase Dashboard → Table Editor → transactions** → filter label "Baut Roda" dan "ww" tanggal 17 Apr 2026 → delete ke-4 baris secara manual.

Ini satu-satunya cara menghapus item yang sudah "rusak" di database level.

### Fix #1B — Kode: Konversi String agar Tidak Terjadi Lagi

**`toggleTxn` — line ~2587:**
```javascript
// ❌ SEBELUM
function toggleTxn(id){
  const el=document.getElementById('txn-'+id);

// ✅ SESUDAH
function toggleTxn(id){
  const el=document.getElementById('txn-'+String(id));
```

**`deleteTxn` — line ~2592:**
```javascript
// ❌ SEBELUM
const txn=transactions.find(t=>t.id===id);

// ✅ SESUDAH
const txn=transactions.find(t=>String(t.id)===String(id));
```

**`editTxn` / `confirmSaveEditTxn` — cari `t.id===id` di area yang sama:**
```javascript
// ❌ SEBELUM
const txn=transactions.find(t=>t.id===id);

// ✅ SESUDAH
const txn=transactions.find(t=>String(t.id)===String(id));
```

**`deleteTxn` — setelah try-catch, tambahkan re-apply filter (line ~2593–2604):**
```javascript
// Hapus lokal segera
transactions = transactions.filter(t => String(t.id) !== String(id));
localStorage.setItem('bhd_cache_transactions', JSON.stringify(transactions));

// Sync dari server
await syncFromSupabase();

// Re-apply setelah sync — cegah item balik karena race condition
transactions = transactions.filter(t => String(t.id) !== String(id));
localStorage.setItem('bhd_cache_transactions', JSON.stringify(transactions));
applyTxnFilters?.();

logAudit('delete', 'transaksi', `[${waktu}] - [${adminName}] - [Hapus Transaksi] - [${txn.label}, Rp ${fmt(txn.amount)}${txn.sparepartId ? ', Qty ' + jml + ' unit dikembalikan' : ''}]`);
refreshDetailHero();
vibrate(40);
showToast('Transaksi dihapus' + (txn.sparepartId ? ' · Stok +' + jml + ' dikembalikan' : ''));
```

---

## Bug #2 — Item Onderdil Tidak Bisa Dihapus

Ada **tiga sub-bug** di sini.

### Sub-bug 2A — `closeSm()` Langsung Tutup Popup Konfirmasi

**Lokasi:** `openAddStockModal()` — line **~1978**

```javascript
// ❌ SEKARANG — closeSm() langsung tutup popup sebelum user sempat klik "Ya Hapus"
onclick="deleteSparepart('"+sp.id+"');closeSm()"
```

Urutannya:
1. User klik "Hapus Item"
2. `deleteSparepart()` membuka popup konfirmasi → modal muncul
3. `closeSm()` langsung dipanggil di baris yang sama → **modal langsung ditutup**
4. User tidak melihat popup konfirmasi apapun

```javascript
// ✅ FIX — hapus ;closeSm(), biarkan deleteSparepart handle sendiri
onclick="deleteSparepart('"+sp.id+"')"
```

### Sub-bug 2B — `deleteSparepart` Sangkut (Modal Macet)

**Lokasi:** `deleteSparepart()` — line ~2011–2036

```javascript
// ❌ SEKARANG — tidak ada try-catch, error langsung ke showConfirmPopup → "Coba Lagi" / sangkut
async () => {
  const result = await apiFetch(`/api/inventory/${id}`, { method: 'DELETE' });
  if (!result || result.ok === false) throw new Error(result?.error || 'Gagal hapus paksa');
  await syncFromSupabase();
  showToast('Item dan semua riwayat dihapus');
}
```

```javascript
// ✅ FIX — inner try-catch + update lokal segera
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
  sparepartStock = sparepartStock.filter(s => s.id !== id);
  await syncFromSupabase();
  showToast('Item dan semua riwayat dihapus');
  vibrate(40);
}
```

### Sub-bug 2C — Duplikat Fungsi `_renderKatList`

**Lokasi:** Line **1774** dan **1922**

Ada dua definisi fungsi `_renderKatList`. Definisi kedua (line 1922) menimpa yang pertama. Hapus definisi di line 1922–1931, pertahankan yang di line 1774.

---

## Bug #3 — "Hapus Semua Transaksi" Tidak Berfungsi

### Root Cause 3A — `apiFetch` crash untuk 204

Diselesaikan oleh **Fix Akar Masalah Utama** di atas.

### Root Cause 3B — Guard `txns.length > 0` Memblokir Reset

**Lokasi:** `syncFromSupabase()` — line **~4386**

```javascript
// ❌ SEKARANG — jika server return [] setelah reset, transactions TIDAK di-clear
if (Array.isArray(txns) && txns.length > 0) {
  transactions = txns.map(t => ({ ... }));
}
```

```javascript
// ✅ FIX — izinkan update meski array kosong
if (Array.isArray(txns)) {
  transactions = txns.map(t => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount || 0),
    label: t.label || (t.type === 'inflow' ? 'Pemasukan' : 'Pengeluaran'),
    sub: t.sub || '',
    date: t.date || t.created_at?.split('T')[0] || '',
    armada: t.armada || '',
    muat: t.muat || '',
    bongkar: t.bongkar || '',
    driver: t.driver || '',
    nota: t.nota || '',
    toko: t.toko || '',
    kategori: t.kategori || '',
    status: t.status || 'lunas',
    sparepartId: t.sparepart_id || null,
    posisi: t.posisi || '',
    created_at: t.created_at
  }));
}
```

### Root Cause 3C — `_isSyncing` Flag Menghalangi Sync Setelah Reset

**Lokasi:** `confirmReset()` — line ~4100

Jika background sync (interval 15 detik) berjalan tepat saat reset, `syncFromSupabase()` langsung `return` tanpa melakukan apapun.

```javascript
// ✅ FIX — paksa reset lokal SEBELUM sync di confirmReset()
// 3. Update local state SEGERA
transactions = [];
localStorage.removeItem('bhd_cache_transactions');
renderDashboard();
applyTxnFilters?.();
renderLaporanTable?.();

// 4. Sync (boleh gagal — lokal sudah clear)
try {
  await syncFromSupabase();
} catch(e) {
  console.warn('Post-reset sync failed, local already cleared:', e);
}
```

---

## Bug #4 — `deleteKategori` Balik Setelah Refresh

**Lokasi:** `deleteKategori()` — line ~1907 dan `addKategori()` — line ~1893

Error API di-swallow oleh `console.warn`, perubahan tidak tersimpan ke server, saat sync berikutnya data lama menimpa kembali.

```javascript
// ✅ FIX deleteKategori — rollback lokal jika server gagal
async function deleteKategori(nama) {
  const itemsInUse = sparepartStock.filter(s => s.kategori === nama);
  if (itemsInUse.length > 0) {
    const force = confirm(`Kategori "${nama}" masih digunakan ${itemsInUse.length} barang. Tetap hapus?`);
    if (!force) return;
    itemsInUse.forEach(s => { s.kategori = 'Spare'; });
  }
  gudangKategori = gudangKategori.filter(k => k !== nama);
  try {
    await apiFetch('/api/settings', {
      method: 'POST',
      body: { key: 'inventory_categories', value: JSON.stringify(gudangKategori) }
    });
    _renderKatList();
    renderGudangFilterChips();
    showToast('Kategori "' + nama + '" dihapus'); vibrate(30);
  } catch(e) {
    gudangKategori = [...gudangKategori, nama].sort(); // rollback
    showToast('❌ Gagal hapus kategori: ' + (e.message || 'Periksa koneksi'));
    _renderKatList();
  }
}
```

```javascript
// ✅ FIX addKategori — pola error handling yang sama
async function addKategori() {
  const input = document.getElementById('kat-new-name');
  const nama = (input?.value || '').trim();
  if (!nama) { showToast('Nama kategori tidak boleh kosong'); return; }
  if (gudangKategori.includes(nama)) { showToast('Kategori sudah ada'); return; }
  gudangKategori.push(nama);
  input.value = '';
  try {
    await apiFetch('/api/settings', {
      method: 'POST',
      body: { key: 'inventory_categories', value: JSON.stringify(gudangKategori) }
    });
    _renderKatList();
    renderGudangFilterChips();
    showToast('Kategori "' + nama + '" ditambahkan'); vibrate(20);
  } catch(e) {
    gudangKategori = gudangKategori.filter(k => k !== nama); // rollback
    showToast('❌ Gagal tambah kategori: ' + (e.message || 'Periksa koneksi'));
    _renderKatList();
  }
}
```

---

## Ringkasan Semua Perubahan

| Prioritas | Tipe | Lokasi | Perubahan |
|-----------|------|--------|-----------|
| 🔴 P0 | Database | Supabase → transactions table | Hapus manual 4 baris: 3× Baut Roda + 1× ww (17 Apr) |
| 🔴 P1 | `index.html` `apiFetch` ~1403 | Handle 204 / empty response — **wajib pertama** |
| 🔴 P1 | `index.html` `syncFromSupabase` ~4386 | Hapus guard `txns.length > 0` |
| 🔴 P1 | `index.html` `confirmReset` ~4100 | Clear lokal sebelum sync, sync dalam try-catch |
| 🟠 P2 | `index.html` `openAddStockModal` ~1978 | Hapus `;closeSm()` dari onclick Hapus Item |
| 🟠 P2 | `index.html` `deleteTxn` ~2592 | `String()` conversion + re-apply filter setelah sync |
| 🟠 P2 | `index.html` `toggleTxn` ~2587 | `String()` conversion pada getElementById |
| 🟠 P2 | `index.html` `deleteSparepart` ~2011 | Inner try-catch + update lokal segera |
| 🟡 P3 | `index.html` `deleteKategori` ~1907 | Rollback lokal jika server gagal |
| 🟡 P3 | `index.html` `addKategori` ~1893 | Error handling + rollback |
| 🟢 P4 | `index.html` `_renderKatList` ~1922 | Hapus definisi duplikat |

---

## Urutan Pengerjaan

```
STEP 0 (segera): Hapus 4 baris manual di Supabase Dashboard
STEP 1: Fix apiFetch — handle 204
STEP 2: Fix syncFromSupabase — hapus guard txns.length > 0
STEP 3: Fix confirmReset — clear lokal dulu
STEP 4: Fix openAddStockModal — hapus ;closeSm()
STEP 5: Fix toggleTxn + deleteTxn — String() conversion
STEP 6: Fix deleteSparepart — inner try-catch
STEP 7: Fix deleteKategori + addKategori — rollback
STEP 8: Hapus _renderKatList duplikat
```

---

*Perubahan kode seluruhnya di `index.html`. Tidak ada perubahan backend yang diperlukan.*  
*Step 0 (Supabase) harus dilakukan manual oleh developer dengan akses database.*
