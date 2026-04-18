# Perbaikan Syntax Error — Fungsi Terpotong

## Masalah
Saat melakukan refactoring sebelumnya, terjadi kesalahan edit yang menyebabkan
badan fungsi `renderGudangFilterChips` terpotong dan menyatu dengan fungsi
`openAddStockModal`. Akibatnya **seluruh JavaScript di halaman error** dan
tidak ada yang berjalan — termasuk tombol login.

## Lokasi Error
File: `index.html`  
Baris: **1787–1788**

## Kode yang Rusak Saat Ini
```js
function renderGudangFilterChips(){
  const el=document.gfunction openAddStockModal(editId){
```

Terlihat jelas dua fungsi yang tidak sengaja digabung menjadi satu baris.

## Yang Harus Dilakukan

Ganti baris 1787–1788 yang rusak ini:
```js
function renderGudangFilterChips(){
  const el=document.gfunction openAddStockModal(editId){
```

Dengan dua fungsi yang terpisah dan benar:
```js
function renderGudangFilterChips(){
  const el=document.getElementById('gudang-filter-chips');
  if(!el) return;
  el.innerHTML='<button class="fs-chip filter-chip'+(gudangFilter==='all'?' active':'')+'" onclick="setGudangFilter(\'all\',this)">Semua</button>'
    +gudangKategori.map(k=>'<button class="fs-chip filter-chip'+(gudangFilter===k?' active':'')+'" onclick="setGudangFilter(\''+k+'\',this)">'+getSpCatIcon(k)+' '+k+'</button>').join('');
}

function openAddStockModal(editId){
```

## Catatan Penting
- Jangan ubah apapun selain baris yang rusak tersebut
- Pastikan `function openAddStockModal(editId){` tetap pada baris terpisah
- Setelah diperbaiki, semua fungsi JavaScript termasuk login akan kembali normal
