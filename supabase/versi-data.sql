-- ════════════════════════════════════════════════════════════════════
-- BHD SmartFlow — Penanda versi data (hemat kuota transfer)
-- Jalankan di Supabase → SQL Editor. Aman dijalankan ulang.
--
-- Setiap kali ada data yang ditambah/diubah/dihapus, angka versi naik.
-- Aplikasi cukup menanyakan angka ini tiap 20 detik (beberapa byte),
-- dan baru mengunduh data lengkap kalau angkanya berubah.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.data_version (
  id         int primary key default 1 check (id = 1),
  version    bigint not null default 1,
  updated_at timestamptz not null default now()
);
insert into public.data_version(id) values (1) on conflict (id) do nothing;
alter table public.data_version enable row level security;
revoke all on public.data_version from anon, authenticated;

create or replace function public._bhd_bump_data_version()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  update public.data_version set version = version + 1, updated_at = now() where id = 1;
  return null;
end $$;
revoke all on function public._bhd_bump_data_version() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['transactions','fleet','drivers','inventory',
                           'inventory_installed','settings']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_bhd_data_version on public.%I', t);
      execute format('create trigger trg_bhd_data_version after insert or update or delete on public.%I
                      for each statement execute function public._bhd_bump_data_version()', t);
      execute format('drop trigger if exists trg_bhd_data_version_trunc on public.%I', t);
      execute format('create trigger trg_bhd_data_version_trunc after truncate on public.%I
                      for each statement execute function public._bhd_bump_data_version()', t);
    end if;
  end loop;
end $$;

create or replace function public.bhd_data_version()
returns bigint language sql stable security definer
set search_path = public
as $$ select version from public.data_version where id = 1 $$;
grant execute on function public.bhd_data_version() to anon, authenticated;

-- Cek: harus muncul satu angka
select public.bhd_data_version() as versi_data;
