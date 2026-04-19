# Temuan Bug Mendalam — BHD SmartFlow

---

## BUG 1 — KRITIS: `outId` Dipakai Sebelum Dideklarasikan

**File:** `index.html` — fungsi `submitOutflow` (sekitar baris 3740)

`outId` digunakan di baris 3768 untuk `txnId`, tapi baru dideklarasikan
di baris 3775. Ini menyebabkan `ReferenceError` setiap kali user submit
outflow kategori Onderdil.

```js
// URUTAN SALAH SAAT INI:
spCopy.installed = [...sp.installed, {
  txnId: outId   // ← ERROR: outId belum ada!
}];
// ...
const outId = 'txn_' + Date.now();  // ← baru dideklarasikan di sini
```

**Fix — Pindahkan deklarasi `outId` ke atas, sebelum blok `if(cat==='Onderdil')`:**

```js
async function submitOutflow(){
  const nota = ...
  const toko = ...
  // ... input reading ...

  const outId = 'txn_' + Date.now();  // ← PINDAHKAN KE SINI (sebelum if Onderdil)
  
  let spId = null;
  let spCopy = null;
  if(cat === 'Onderdil'){
    // ... sekarang outId sudah tersedia saat dipakai di txnId
    spCopy.installed = [...sp.installed, {
      txnId: outId  // ✅ sudah terdefinisi
    }];
  }

  const txnLabel = ...
  // HAPUS baris: const outId = 'txn_' + Date.now(); (yang lama di bawah)
  const newOut = { id: outId, ... }
```

---

## BUG 2 — KRITIS: Ritase Tidak Pernah Tersimpan ke Database

**File:** `index.html` — fungsi `incrementRitaseForArmada` + `submitInflow`

`incrementRitaseForArmada` hanya update ritase di memori lokal (`sparepartStock`
array). Tidak ada `sbFetch` untuk simpan ke DB. Lebih parah lagi, urutannya:

```js
await syncFromSupabase();          // ← data DB ditarik (ritase lama dari DB)
incrementRitaseForArmada(armada);  // ← increment di memori
// tidak ada save ke DB!           // ← perubahan hilang saat refresh
```

**Fix — Tambahkan save ke DB setelah increment, di dalam fungsi `submitInflow`:**

Ganti bagian setelah `await syncFromSupabase()` di `submitInflow` menjadi:

```js
// Increment ritase di memori
incrementRitaseForArmada(armada, statusSebelum);

// Simpan ritase yang sudah diupdate ke database
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
```

> Catatan: `incrementRitaseForArmada` sendiri tidak perlu diubah.
> Perubahan hanya di `submitInflow` setelah fungsi itu dipanggil.

---

## BUG 3 — SEDANG: `loadSAAdminList` Pakai `sbFetch` Bukan `apiFetch`

**File:** `index.html` — fungsi `loadSAAdminList`

Fungsi ini masih menggunakan `sbFetch('admins', ...)` padahal tabel `admins`
tidak ada di mapping `sbFetch` backend. Seharusnya pakai `apiFetch`.

```js
// Sebelum:
const admins = await sbFetch('admins', { method:'GET', order:'username.asc' });

// Sesudah:
const admins = await apiFetch('/api/admins');
```

---

## BUG 4 — SEDANG: `confirmReset` Hanya Hapus di Memori, Tidak di Database

**File:** `index.html` — fungsi `confirmReset`

Tombol "Hapus Semua Transaksi" di Settings hanya mengosongkan array lokal,
data di Supabase tidak ikut terhapus.

```js
// Saat ini (hanya lokal):
function confirmReset(){
  if(confirm('Yakin hapus SEMUA transaksi?')){
    transactions = [];
    renderDashboard();
    ...
  }
}
```

**Fix:**

```js
async function confirmReset(){
  if(confirm('Yakin hapus SEMUA transaksi? Data akan dihapus permanen dari database.')){
    try {
      await apiFetch('/api/transactions/reset', { method: 'DELETE' });
      transactions = [];
      renderDashboard();
      applyTxnFilters();
      renderLaporanTable();
      showToast('Semua transaksi dihapus dari database');
    } catch(e) {
      showToast('❌ Gagal menghapus. Periksa koneksi server.');
    }
  }
}
```

> Tambahkan juga endpoint `DELETE /api/transactions/reset` di `api/index.js`
> yang menghapus semua record dari tabel `transactions`.

---

## BUG 5 — SSE Menyebabkan Status Selalu OFFLINE

*(Sudah didokumentasikan di file `perbaikan-status-offline.md`)*

Ringkasan: `initRealtimeSync` memanggil `setConnectionStatus('error')` saat
SSE gagal, padahal server REST API bisa tetap online. Solusi: jangan ubah
status koneksi dari dalam `es.onerror`.

---

## Status Keseluruhan Setelah Semua Perbaikan

| Item | Status |
|---|---|
| Syntax error renderGudangFilterChips | ✅ Fixed |
| Login freeze (timeout apiFetch) | ✅ Fixed |
| Cache localStorage | ✅ Fixed |
| Race condition async/await | ✅ Fixed |
| SB_URL tidak terdefinisi | ✅ Fixed |
| Hardcoded ADMIN_REG_CODE fallback | ✅ Fixed |
| Fungsi duplikat | ✅ Fixed |
| apiPing endpoint & timeout | ✅ Fixed |
| Format posisi ban (dropdown) | ✅ Fixed |
| txnId di confirmPasang | ✅ Fixed |
| Realtime SSE (Fix 5.1) | ✅ Fixed |
| outId dipakai sebelum deklarasi | ❌ Bug 1 — perlu fix |
| Ritase tidak tersimpan ke DB | ❌ Bug 2 — perlu fix |
| loadSAAdminList pakai sbFetch | ❌ Bug 3 — perlu fix |
| confirmReset tidak hapus dari DB | ❌ Bug 4 — perlu fix |
| SSE menyebabkan false offline | ❌ Bug 5 — perlu fix |

---

## Catatan untuk AI

- Bug 1 adalah yang paling kritis — submit outflow onderdil akan selalu error
- Bug 2 menyebabkan tab Truck tidak pernah update ritase ban
- Bug 4 memerlukan endpoint baru di `api/index.js`
- Kerjakan Bug 1, 2, 3, 5 di `index.html` dan Bug 4 di kedua file
