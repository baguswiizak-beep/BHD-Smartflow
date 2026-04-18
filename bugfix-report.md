# 🐛 Bug Fix Report — BHD SmartFlow System
**Dikirim oleh:** BHD Team  
**Tanggal:** 17 April 2026  
**Prioritas:** High  

---

## Daftar Bug

| # | Bug | Status |
|---|-----|--------|
| 1 | Item transaksi tidak bisa dihapus (sangkut/macet) | 🔴 Unresolved |
| 2 | Kategori pada halaman Onderdil tidak bisa terhapus permanen | 🔴 Unresolved |
| 3 | Hapus transaksi tidak benar-benar terhapus dari server — data muncul kembali setelah refresh | 🔴 Unresolved |

---

## Root Cause

Ketiga bug berasal dari **satu sumber yang sama** di fungsi `apiFetch` (`index.html`, sekitar line 1403):

```javascript
// ❌ BERMASALAH — selalu mencoba parse JSON
return r.json();
```

Ketika server mengembalikan **HTTP 204 No Content** (respons umum untuk DELETE/POST yang berhasil), `r.json()` melempar `SyntaxError` karena body response kosong. Error ini kemudian menyebar dan memicu ketiga bug di atas.

---

## Bug #1 — Transaksi Sangkut (Modal Macet)

**Fungsi terdampak:** `deleteTxn()`, `deleteSparepart()`, `deleteUsage()`

**Alur masalah:**
1. User klik tombol Hapus pada item transaksi
2. `apiFetch` memanggil `DELETE /api/transactions/:id`
3. Server berhasil menghapus dan mengembalikan `204 No Content`
4. `r.json()` melempar `SyntaxError`
5. Error ditangkap oleh `showConfirmPopup`'s catch block
6. Modal menampilkan **"Coba Lagi"** dan tidak bisa ditutup → **sangkut**

**Fix — `apiFetch` (line ~1396–1403):**

```javascript
// ✅ SESUDAH
if (r.status === 204) return { ok: true };
const text = await r.text();
if (!text || !text.trim()) return { ok: true };
try { return JSON.parse(text); } catch { return { ok: true }; }
```

---

## Bug #2 — Kategori Tidak Terhapus Permanen

**Fungsi terdampak:** `deleteKategori()`

**Alur masalah:**
1. User klik Hapus pada kategori di halaman Onderdil
2. Kategori terhapus dari array lokal (`gudangKategori`)
3. `apiFetch` POST ke `/api/settings` — jika gagal, error hanya di-`console.warn` dan diabaikan
4. Server **tidak menyimpan perubahan**
5. Saat `syncFromSupabase()` berjalan (tiap 15 detik atau saat refresh), data dari server menimpa lokal
6. Kategori **muncul kembali**

**Fix — `deleteKategori()` (line ~1912–1919):**

```javascript
// ✅ SESUDAH
try {
  await apiFetch('/api/settings', {
    method: 'POST',
    body: { key: 'inventory_categories', value: JSON.stringify(gudangKategori) }
  });
  _renderKatList();
  renderGudangFilterChips();
  showToast('Kategori "' + nama + '" dihapus');
  vibrate(30);
} catch(e) {
  // Rollback perubahan lokal jika server gagal menyimpan
  gudangKategori = [...gudangKategori, nama].sort();
  console.warn('Failed to save categories after delete:', e);
  showToast('❌ Gagal hapus kategori: ' + (e.message || 'Periksa koneksi server'));
}
```

---

## Bug #3 — Data Transaksi Muncul Kembali Setelah Refresh

**Fungsi terdampak:** `deleteTxn()` → `syncFromSupabase()`

**Alur masalah:**
1. DELETE berhasil di server
2. `transactions` di-filter secara lokal (item dihapus)
3. `syncFromSupabase()` dipanggil langsung setelahnya
4. Server mengembalikan data (bisa ada race condition atau DELETE belum propagate)
5. `syncFromSupabase` **menimpa** array `transactions` lokal dengan data dari server
6. Item yang baru dihapus **muncul kembali** di UI

**Fix — `deleteTxn()` (line ~2593–2602):**

```javascript
// ✅ SESUDAH — re-apply filter setelah sync untuk cegah data balik
transactions = transactions.filter(t => t.id !== id);
localStorage.setItem('bhd_cache_transactions', JSON.stringify(transactions));

await syncFromSupabase();

// Re-apply setelah sync agar item tidak kembali akibat race condition
transactions = transactions.filter(t => t.id !== id);
localStorage.setItem('bhd_cache_transactions', JSON.stringify(transactions));
applyTxnFilters?.();
```

---

## Ringkasan Perubahan yang Dibutuhkan

| File | Fungsi | Baris (approx.) | Perubahan |
|------|--------|-----------------|-----------|
| `index.html` | `apiFetch` | ~1403 | Handle 204 / empty response body |
| `index.html` | `deleteTxn` | ~2593–2602 | Re-apply filter setelah `syncFromSupabase` |
| `index.html` | `deleteKategori` | ~1912–1919 | Rollback lokal jika server gagal simpan |

> **Catatan:** Fix pada `apiFetch` secara otomatis juga menyelesaikan bug sangkut di `deleteSparepart()` dan `deleteUsage()` karena keduanya menggunakan fungsi yang sama tanpa inner try-catch.

---

*Report ini dibuat berdasarkan analisis statis terhadap `index.html`. Mohon diverifikasi dengan testing langsung di environment staging sebelum deploy ke production.*
