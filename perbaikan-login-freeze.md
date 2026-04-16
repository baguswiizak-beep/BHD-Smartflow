# Perbaikan Login Freeze Saat Server Offline

## Masalah
Halaman login tidak merespons (freeze) ketika server backend sedang mati.
Tombol login tetap disabled selamanya karena fungsi `apiFetch` tidak memiliki timeout.

## Penyebab
Fungsi `apiFetch` di `index.html` menunggu respons server tanpa batas waktu.
Padahal fallback login lokal sudah ada dan benar, tapi tidak pernah terpicu karena `apiFetch` tidak pernah throw error — hanya menunggu terus.

## Yang Harus Diubah

Cari fungsi `apiFetch` di `index.html`, lalu ubah bagian `fetch` berikut:

**Sebelum:**
```js
const r = await fetch(API_BASE + path, {
  headers,
  ...opts,
  body: opts.body ? JSON.stringify(opts.body) : undefined,
});
```

**Sesudah:**
```js
const r = await fetch(API_BASE + path, {
  headers,
  signal: AbortSignal.timeout(5000),
  ...opts,
  body: opts.body ? JSON.stringify(opts.body) : undefined,
});
```

## Catatan
- Hanya **satu baris** yang ditambahkan: `signal: AbortSignal.timeout(5000)`
- Timeout 5 detik — jika server tidak merespons dalam 5 detik, fetch otomatis throw error
- Setelah error, fallback login lokal yang sudah ada akan langsung aktif
- Jangan ubah logika lain di fungsi `apiFetch` maupun `doLogin`
