-- ════════════════════════════════════════════════════════════════════
-- BHD SmartFlow — Kunci penghapusan transaksi
-- Jalankan SETELAH keamanan-login.sql. Aman dijalankan ulang.
--
-- Aturan:
--  • Admin & superadmin: boleh input, edit, dan hapus SATU transaksi
--    (wajib sedang login — dicek dengan token sesi).
--  • Hapus SEMUA transaksi: hanya superadmin.
--  • Hapus langsung ke tabel dengan kunci publik: ditolak.
-- ════════════════════════════════════════════════════════════════════

-- Helper: wajib login (admin atau superadmin)
create or replace function public._bhd_require_session(p_token uuid)
returns public.admins language plpgsql stable security definer
set search_path = public
as $$
declare v public.admins;
begin
  v := public._bhd_session_admin(p_token);
  if v.id is null then
    raise exception 'Sesi login berakhir, silakan login ulang' using errcode = '28000';
  end if;
  return v;
end $$;
revoke all on function public._bhd_require_session(uuid) from public, anon, authenticated;

-- Hapus satu transaksi (beserta jejak pasang onderdilnya)
create or replace function public.bhd_txn_delete(p_token uuid, p_id text)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  perform public._bhd_require_session(p_token);
  if coalesce(p_id, '') = '' then raise exception 'ID transaksi kosong'; end if;
  delete from public.transactions where id = p_id;
  if to_regclass('public.inventory_installed') is not null then
    -- txn_id bisa "idTransaksi" atau "idTransaksi_0", "idTransaksi_1" (pasang multi-unit)
    delete from public.inventory_installed
    where txn_id = p_id or left(txn_id, length(p_id) + 1) = p_id || '_';
  end if;
end $$;

-- Hapus SEMUA transaksi — superadmin saja
create or replace function public.bhd_txn_reset_all(p_token uuid)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  perform public._bhd_require_superadmin(p_token);
  delete from public.transactions where true;
  if to_regclass('public.inventory_installed') is not null then
    delete from public.inventory_installed where true;
  end if;
end $$;

-- Edit jumlah pasang dikurangi: simpan p_keep catatan pasang tertua, buang sisanya
create or replace function public.bhd_installed_trim(p_token uuid, p_txn_id text, p_keep int)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  perform public._bhd_require_session(p_token);
  if coalesce(p_txn_id, '') = '' then raise exception 'ID transaksi kosong'; end if;
  if to_regclass('public.inventory_installed') is null then return; end if;
  delete from public.inventory_installed
  where id in (
    select id from public.inventory_installed
    where txn_id = p_txn_id or left(txn_id, length(p_txn_id) + 1) = p_txn_id || '_'
    order by id asc
    offset greatest(coalesce(p_keep, 0), 0)
  );
end $$;

grant execute on function public.bhd_installed_trim(uuid, text, int) to anon, authenticated;
grant execute on function public.bhd_txn_delete(uuid, text) to anon, authenticated;
grant execute on function public.bhd_txn_reset_all(uuid) to anon, authenticated;

-- Cabut hak hapus langsung dari aplikasi (input & edit tetap boleh)
revoke delete on public.transactions from anon, authenticated;
do $$
begin
  if to_regclass('public.inventory_installed') is not null then
    execute 'revoke delete on public.inventory_installed from anon, authenticated';
  end if;
end $$;

-- Cek: anon_bisa_hapus_transaksi harus false, anon_bisa_edit_transaksi harus true
select has_table_privilege('anon', 'public.transactions', 'DELETE') as anon_bisa_hapus_transaksi,
       has_table_privilege('anon', 'public.transactions', 'UPDATE') as anon_bisa_edit_transaksi;
