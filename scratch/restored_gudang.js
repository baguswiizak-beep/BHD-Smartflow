function openAddStockModal(editId){
  const sp=editId?sparepartStock.find(s=>s.id===editId):null;
  const tEl=document.getElementById('sm-title-text'),body=document.getElementById('sm-body');
  tEl.textContent=sp?'Edit Item Stok':'Tambah Stok Baru';
  body.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;">'
    +'<div style="grid-column:1/-1;"><label class="form-label">📦 Nama Barang</label><input class="form-input" id="sp-nama" value="'+(sp?sp.nama:'')+'" placeholder="Nama onderdil..." oninput="autoDetectIcon(this.value)"/></div>'
    +'<div style="grid-column:1/-1;"><label class="form-label">🏷️ Spek / Tipe</label><input class="form-input" id="sp-spek" value="'+(sp?sp.spek:'')+'" placeholder="Ukuran, kode, merk..."/></div>'
    +'<div><label class="form-label">Kategori</label><select class="form-select" id="sp-kat">'
    +gudangKategori.map(k=>'<option value="'+k+'"'+(sp&&sp.kategori===k?' selected':'')+'>'+getSpCatIcon(k)+' '+k+'</option>').join('')
    +'</select></div>'
    +'<div><label class="form-label">🏪 Toko</label><input class="form-input" id="sp-toko" value="'+(sp?sp.toko:'')+'" placeholder="Nama toko..."/></div>'
    +'<div><label class="form-label">No. Nota</label><input class="form-input" id="sp-nota" value="'+(sp?sp.nota:'')+'" placeholder="SP-001"/></div>'
    +'<div><label class="form-label">📅 Tgl Masuk</label><input type="date" class="form-input" id="sp-tgl" value="'+(sp?sp.tglMasuk:today())+'"/></div>'
    +'<div><label class="form-label">Jumlah</label><input class="form-input" id="sp-jml" type="number" value="'+(sp?sp.stokAwal:'')+'" placeholder="Qty"/></div>'
    +'<div><label class="form-label">Harga/unit (Rp)</label><input class="form-input" id="sp-harga" value="'+(sp?new Intl.NumberFormat('id-ID').format(sp.hargaSatuan):'')+'" placeholder="0" inputmode="numeric"/></div>'
    +'</div>'
    +'<div style="font-size:10.5px;color:var(--text3);background:var(--bg3);border-radius:10px;padding:9px 11px;line-height:1.6;">💡 Stok masuk tanpa potong kas — sistem tempo.</div>'
    +'<button class="sm-btn orange" onclick="saveSparepart(\''+(editId||'')+'\')">'+(sp?'Simpan':'Tambah Stok')+'</button>'
    +(sp?'<button class="sm-btn danger" onclick="deleteSparepart(\''+sp.id+'\');closeSm()">Hapus Item</button>':'');
  setupCurrencyInput('sp-harga');
  document.getElementById('sm-overlay').classList.add('open');
}

async function saveSparepart(editId){
  const nama=document.getElementById('sp-nama')?.value?.trim();
  const spek=document.getElementById('sp-spek')?.value?.trim();
  const kat=document.getElementById('sp-kat')?.value||'Spare';
  const toko=document.getElementById('sp-toko')?.value?.trim()||'';
  const nota=document.getElementById('sp-nota')?.value?.trim()||'';
  const tgl=document.getElementById('sp-tgl')?.value||today();
  const jmlRaw=document.getElementById('sp-jml')?.value||'';
  const jml=parseInt(jmlRaw.toString().replace(/\D/g,''))||0;
  const harga=getRaw('sp-harga')||0;

  if(!nama){showToast('Nama barang tidak boleh kosong');return;}
  if(!spek){showToast('Spek/tipe tidak boleh kosong');return;}
  if(jml<=0){showToast('Jumlah harus lebih dari 0');return;}

  try {
    if(editId){
      const sp=sparepartStock.find(s=>s.id===editId);
      if(sp){
        const dbData = {
          nama, spek, kategori: kat, toko, nota, tgl_masuk: tgl,
          stok_awal: jml, stok_sisa: Math.min(isNaN(sp.stokSisa)?jml:sp.stokSisa,jml),
          harga_satuan: isNaN(harga)?0:harga, catatan: sp.catatan
        };
        await sbFetch('inventory',{method:'PATCH',filters:{id:editId},body:dbData});
      }
    } else {
      const spId = 'sp'+Date.now();
      const dbData = {
        id: spId, nama, spek, kategori: kat, toko, nota,
        tgl_masuk: tgl, stok_awal: jml, stok_sisa: jml,
        harga_satuan: isNaN(harga)?0:harga, catatan: '', installed: []
      };
      await sbFetch('inventory',{method:'POST',body:dbData});
    }
    await syncFromSupabase();
    closeSm();
    showToast(editId?'Item diperbarui':'Stok ditambahkan');
    vibrate(30);
  } catch(e) { console.warn('Sync sparepart gagal:', e); }
}

async function deleteSparepart(id){
  const sp = sparepartStock.find(s=>s.id===id);
  if(!sp) return;
  if(!confirm(`Hapus ${sp.nama}?`)) return;

  try {
    await sbFetch('inventory',{method:'DELETE',filters:{id:id}});
    await syncFromSupabase();
    showToast('Item dihapus');
    vibrate(40);
  } catch(e) { console.warn('Gagal hapus sparepart:', e); }
}

async function confirmPasang(spId){
  const sp=sparepartStock.find(s=>s.id===spId);if(!sp)return;
  const armada=document.getElementById('pasang-armada')?.value;
  const tgl=document.getElementById('pasang-tgl')?.value;
  const jml=parseInt(document.getElementById('pasang-jml')?.value||'1');
  const posisi=document.getElementById('pasang-posisi')?.value||'';
  if(jml<1){showToast('Jumlah minimal 1');return;}
  if(jml>sp.stokSisa){showToast('Jumlah melebihi stok (sisa: '+sp.stokSisa+')');return;}
  const driver=fleetData.find(f=>f.nopol===armada)?.driver||'';
  const txnId='txn_'+Date.now();

  const newTxn={
    id:txnId, type:'outflow',
    label:sp.nama+' ('+sp.spek+') — '+jml+' unit'+(posisi?' ['+posisi+']':''),
    sub:'No.Nota: '+sp.nota+' · '+sp.toko+' · '+driver,
    amount:sp.hargaSatuan*jml, date:tgl,
    armada, nota:sp.nota, toko:sp.toko,
    kategori:'Onderdil', driver, status:'lunas',
    sparepartId:spId, jmlPasang:jml, posisi
  };

  const newInstalled = [...sp.installed];
  for(let i=0;i<jml;i++){
    newInstalled.push({
      armada, tglPasang:tgl, ritase:0,
      txnId:txnId+'_'+i,
      posisi: posisi||(jml>1?'Unit '+(i+1):'')
    });
  }

  try {
    const dbTxn = {...newTxn, sparepart_id: newTxn.sparepartId};
    delete dbTxn.sparepartId;
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
    showToast('Pemasangan terekam ✅');
  } catch(e) { console.warn('Gagal pasang sparepart:', e); }
}
