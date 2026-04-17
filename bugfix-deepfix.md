# 🔧 Deep Bug Fix Report — BHD SmartFlow
**Tanggal:** 17 April 2026  
**Severity:** Critical  
**Scope:** `index.html`

---

## Daftar Bug

| # | Bug | Root Cause |
|---|-----|-----------|
| 1 | 4 item sangkut di laporan keuangan | `apiFetch` crash saat respons kosong (204) |
| 2 | Item onderdil tidak bisa dihapus permanen | `apiFetch` crash + tidak ada rollback |
| 3 | "Hapus Semua Transaksi" tidak berfungsi | `apiFetch` crash + guard `txns.length>0` memblokir reset |

---

## Akar Masalah Utama (Semua Bug Berasal dari Sini)

**Lokasi:** `apiFetch()` — sekitar line **1403**

```javascript
// ❌ SEKARANG — selalu paksa parse JSON
return r.json();
```

Ketika server berhasil menghapus data dan mengembalikan **HTTP 204 No Content** (body kosong), `r.json()` melempar `SyntaxError`. Error ini menyebar ke atas dan menghentikan seluruh alur hapus sebelum selesai — item tidak terhapus dari UI, modal macet, atau toast error muncul padahal server sudah berhasil.

```javascript
// ✅ FIX — handle 204 dan body kosong
// Ganti baris `return r.json();` dengan:

if (r.status === 204) return { ok: true };
const text = await r.text();
if (!text || !text.trim()) return { ok: true };
try { return JSON.parse(text); } catch { return { ok: true }; }
```

> **Fix ini wajib dipasang pertama.** Semua fix di bawah bergantung padanya.

---

## Bug #1 — 4 Item Sangkut di Laporan Keuangan

**Item yang sangkut:**
- `outflow` — Baut Roda (R16HD) × 3 unit
- `outflow` — UMUM "ww" × 1 unit

**Mengapa bisa sangkut?**

Alur `deleteTxn()`:
1. `apiFetch DELETE /api/transactions/:id` → server hapus, return 204
2. `r.json()` crash → `SyntaxError` tanpa `.status`
3. Catch block: karena bukan error 404, muncul `window.confirm("Gagal hapus di server...")`
4. User bingung dan klik **Batal** → `onConfirm` return lebih awal
5. `transactions.filter()` tidak pernah dijalankan
6. `syncFromSupabase()` 15 detik kemudian menarik data dari server — kalau server sudah hapus, item hilang; kalau belum, item balik lagi
7. Hasilnya: item **sangkut** di tampilan meski mungkin sudah dihapus di server

**Fix — `deleteTxn()` sekitar line 2573–2604:**

Setelah fix `apiFetch`, tambahkan re-apply filter setelah sync agar item tidak balik akibat race condition:

```javascript
// Setelah baris: await syncFromSupabase();
// TAMBAHKAN dua baris ini:

transactions = transactions.filter(t => t.id !== id);
localStorage.setItem('bhd_cache_transactions', JSON.stringify(transactions));
applyTxnFilters?.();
```

**Kode lengkap `deleteTxn` bagian callback setelah try-catch (line ~2593–2604):**

```javascript
// Hapus lokal segera
transactions = transactions.filter(t => t.id !== id);
localStorage.setItem('bhd_cache_transactions', JSON.stringify(transactions));

// Sync dari server
await syncFromSupabase();

// Re-apply filter setelah sync — cegah item balik karena race condition
transactions = transactions.filter(t => t.id !== id);
localStorage.setItem('bhd_cache_transactions', JSON.stringify(transactions));
applyTxnFilters?.();

logAudit('delete', 'transaksi', `[${waktu}] - [${adminName}] - [Hapus Transaksi] - [${txn.label}, Rp ${fmt(txn.amount)}${txn.sparepartId ? ', Qty ' + jml + ' unit dikembalikan' : ''}]`);
refreshDetailHero();
vibrate(40);
showToast('Transaksi dihapus' + (txn.sparepartId ? ' · Stok +' + jml + ' dikembalikan' : ''));
```

---

## Bug #2 — Item Onderdil Tidak Bisa Dihapus Permanen

Ada **dua sub-bug** di sini:

### Sub-bug 2A — `deleteSparepart` sangkut (modal macet)

**Lokasi:** `deleteSparepart()` — line ~1998–2006

```javascript
// ❌ SEKARANG — tidak ada try-catch, error langsung ke showConfirmPopup
async () => {
  const result = await apiFetch(`/api/inventory/${id}`, { method: 'DELETE' });
  if (!result || result.ok === false) throw new Error(result?.error || 'Gagal hapus paksa');
  await syncFromSupabase();
  showToast('Item dan semua riwayat dihapus');
  vibrate(40);
}
```

Karena tidak ada inner try-catch, kalau `apiFetch` throw (204), error langsung masuk ke `showConfirmPopup`'s catch → tombol berubah jadi **"Coba Lagi"** dan modal tidak bisa ditutup.

```javascript
// ✅ FIX — tambah try-catch + update lokal setelah berhasil
async () => {
  try {
    const result = await apiFetch(`/api/inventory/${id}`, { method: 'DELETE' });
    if (!result || result.ok === false) throw new Error(result?.error || 'Gagal hapus paksa');
  } catch(err) {
    if (err.status === 404) {
      console.warn('Item already gone from server (404), continuing...');
    } else {
      throw err; // Re-throw agar showConfirmPopup tampilkan error yang benar
    }
  }

  // Update lokal segera
  sparepartStock = sparepartStock.filter(s => s.id !== id);

  await syncFromSupabase();
  showToast('Item dan semua riwayat dihapus');
  vibrate(40);
}
```

### Sub-bug 2B — `deleteKategori` tidak tersimpan ke server (balik setelah refresh)

**Lokasi:** `deleteKategori()` — line ~1907–1920

```javascript
// ❌ SEKARANG — error di-swallow, server tidak tersimpan, UI tetap update
try {
  await apiFetch('/api/settings', { method: 'POST', body: { ... } });
} catch(e) { console.warn('Failed to save categories after delete:', e); }

_renderKatList();        // ← Ini tetap jalan meski server gagal
showToast('... dihapus');
```

Kategori tampak terhapus di layar, tapi perubahan tidak sampai ke server. Saat `syncFromSupabase` berjalan (tiap 15 detik), server menimpa data lokal → kategori muncul lagi.

```javascript
// ✅ FIX — rollback lokal jika server gagal
async function deleteKategori(nama) {
  const inUse = sparepartStock.some(s => s.kategori === nama);
  if (inUse) {
    showToast('Kategori masih dipakai ' + sparepartStock.filter(s => s.kategori === nama).length + ' item');
    return;
  }

  // Ubah lokal dulu
  gudangKategori = gudangKategori.filter(k => k !== nama);

  try {
    await apiFetch('/api/settings', {
      method: 'POST',
      body: { key: 'inventory_categories', value: JSON.stringify(gudangKategori) }
    });
    // Sukses — perbarui UI
    _renderKatList();
    renderGudangFilterChips();
    showToast('Kategori "' + nama + '" dihapus');
    vibrate(30);
  } catch(e) {
    // Gagal — rollback perubahan lokal
    gudangKategori = [...gudangKategori, nama].sort();
    console.warn('Failed to save categories after delete:', e);
    showToast('❌ Gagal hapus kategori: ' + (e.message || 'Periksa koneksi server'));
  }
}
```

> **Bonus:** Fungsi `addKategori()` (line ~1889) punya masalah yang sama. Terapkan pola error handling yang identik di sana juga.

### Sub-bug 2C — Duplikat fungsi `_renderKatList`

**Lokasi:** Line **1774** dan **1922**

Ada dua definisi fungsi `_renderKatList` yang identik. Di JavaScript, definisi kedua (line 1922) **menimpa** yang pertama (line 1774). Hapus salah satu — pertahankan yang di line 1774 (lebih awal dan lebih rapi), hapus yang di line 1922–1931.

---

## Bug #3 — "Hapus Semua Transaksi" Tidak Berfungsi

Ada **dua root cause independen** — keduanya harus difix.

### Root Cause 3A — `apiFetch` crash untuk 204

Sama seperti bug sebelumnya. Setelah **Fix `apiFetch`** diterapkan, `confirmReset()` tidak akan crash lagi saat server return 204.

### Root Cause 3B — `syncFromSupabase` tidak meng-clear data lokal saat server return `[]`

**Lokasi:** `syncFromSupabase()` — line **4386**

```javascript
// ❌ SEKARANG — guard ini memblokir update saat transactions kosong
if (Array.isArray(txns) && txns.length > 0) {
  transactions = txns.map(t => ({ ... }));
}
// Jika server return [] setelah reset → kondisi false → transactions TIDAK di-clear!
```

Setelah reset berhasil, server mengembalikan array kosong `[]`. Kondisi `txns.length > 0` adalah `false`, sehingga `transactions` lokal **tidak pernah di-reset ke `[]`**. Data lama tetap ada di memori dan UI.

```javascript
// ✅ FIX — izinkan update meski array kosong
if (Array.isArray(txns)) {           // ← Hapus syarat txns.length > 0
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

### Root Cause 3C — `_isSyncing` flag menghalangi sync setelah reset

**Lokasi:** `syncFromSupabase()` — line **4381**

```javascript
// ❌ SEKARANG
if (_isSyncing) return; // Kalau background sync sedang jalan, sync setelah reset diabaikan
```

Jika background sync (interval 15 detik) sedang berjalan tepat saat user tekan "Hapus Semua", `syncFromSupabase()` yang dipanggil oleh `confirmReset` akan langsung `return` tanpa melakukan apapun — `transactions` tidak di-clear, UI tidak diperbarui.

Fix: Pada `confirmReset()`, paksa reset lokal **sebelum** memanggil sync:

```javascript
// ✅ FIX — tambahkan di confirmReset(), sebelum await syncFromSupabase()
// Lokasi: sekitar line 4079–4083

// 3. Update local state SEGERA — jangan tunggu sync
transactions = [];
localStorage.removeItem('bhd_cache_transactions');
renderDashboard();
applyTxnFilters?.();
renderLaporanTable?.();

// 4. Sync untuk konfirmasi dari server (boleh gagal — lokal sudah clear)
try {
  await syncFromSupabase();
} catch(e) {
  console.warn('Post-reset sync failed, local already cleared:', e);
}
```

---

## Ringkasan Semua Perubahan

| Prioritas | File | Fungsi | Line (approx.) | Perubahan |
|-----------|------|--------|---------------|-----------|
| 🔴 P1 | `index.html` | `apiFetch` | ~1403 | Handle 204 / empty response — **wajib pertama** |
| 🔴 P1 | `index.html` | `syncFromSupabase` | ~4386 | Hapus guard `txns.length > 0` |
| 🔴 P1 | `index.html` | `confirmReset` | ~4079 | Clear lokal sebelum sync, sync dalam try-catch |
| 🟠 P2 | `index.html` | `deleteTxn` | ~2593 | Re-apply filter setelah sync |
| 🟠 P2 | `index.html` | `deleteSparepart` | ~1998 | Tambah inner try-catch + update lokal |
| 🟡 P3 | `index.html` | `deleteKategori` | ~1907 | Rollback lokal jika server gagal |
| 🟡 P3 | `index.html` | `addKategori` | ~1889 | Tambah error handling (pola sama dengan deleteKategori) |
| 🟢 P4 | `index.html` | `_renderKatList` | ~1922 | Hapus definisi duplikat (pertahankan line 1774) |

---

## Urutan Pengerjaan yang Disarankan

```
1. Fix apiFetch (P1) — ini unlock semua bug lainnya
2. Fix syncFromSupabase guard txns.length (P1)
3. Fix confirmReset — clear lokal + try-catch sync (P1)
4. Fix deleteTxn — re-apply filter (P2)
5. Fix deleteSparepart — inner try-catch (P2)
6. Fix deleteKategori — rollback pada error (P3)
7. Fix addKategori — error handling (P3)
8. Hapus _renderKatList duplikat (P4)
```

---

*Semua perubahan di atas berlokasi di satu file: `index.html`. Tidak ada perubahan pada backend/server yang diperlukan untuk fix ini.*
