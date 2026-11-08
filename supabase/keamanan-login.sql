-- ════════════════════════════════════════════════════════════════════
-- BHD SmartFlow — Keamanan login & kunci database
-- Jalankan SEKALI di Supabase → SQL Editor → New query → Run.
-- Aman dijalankan ulang (idempoten).
--
-- Isi:
--  1. Password admin dienkripsi (bcrypt), termasuk password yang sudah ada.
--  2. Tabel admins dikunci: tidak bisa dibaca/diubah langsung dari aplikasi.
--     Login, daftar, dan kelola admin lewat fungsi server di bawah.
--  3. Kode daftar admin (settings.admin_reg_code) tidak bisa dibaca dari luar.
--  4. RLS diaktifkan di tabel data, dengan izin baca/tulis untuk aplikasi
--     (perilaku aplikasi tetap sama setelah pindah ke publishable key).
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ── 1. Enkripsi password admin ─────────────────────────────────────
create or replace function public.bhd_hash_admin_password()
returns trigger language plpgsql
set search_path = public, extensions
as $$
begin
  if new.password is not null and new.password !~ '^\$2[abxy]\$' then
    new.password := crypt(new.password, gen_salt('bf', 10));
  end if;
  return new;
end $$;

drop trigger if exists trg_hash_admin_password on public.admins;
create trigger trg_hash_admin_password
  before insert or update of password on public.admins
  for each row execute function public.bhd_hash_admin_password();

-- Enkripsi password lama yang masih teks biasa
update public.admins set password = password where password !~ '^\$2[abxy]\$';

-- ── 2. Sesi login (token) ──────────────────────────────────────────
create table if not exists public.admin_sessions (
  token      uuid primary key default gen_random_uuid(),
  admin_id   text not null references public.admins(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
alter table public.admin_sessions enable row level security;
revoke all on public.admin_sessions from anon, authenticated;

-- Kunci tabel admins: hanya fungsi di bawah yang boleh menyentuhnya
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

-- Helper internal: admin pemilik token (null kalau token tidak valid/kedaluwarsa)
create or replace function public._bhd_session_admin(p_token uuid)
returns public.admins language sql stable security definer
set search_path = public
as $$
  select a.* from public.admin_sessions s
  join public.admins a on a.id = s.admin_id
  where s.token = p_token and s.expires_at > now()
  limit 1
$$;

create or replace function public._bhd_require_superadmin(p_token uuid)
returns public.admins language plpgsql stable security definer
set search_path = public
as $$
declare v public.admins;
begin
  v := public._bhd_session_admin(p_token);
  if v.id is null then
    raise exception 'Sesi login berakhir, silakan login ulang' using errcode = '28000';
  end if;
  if v.role is distinct from 'superadmin' then
    raise exception 'Hanya superadmin yang boleh melakukan ini' using errcode = '42501';
  end if;
  return v;
end $$;

-- ── 3. Login / logout / daftar ─────────────────────────────────────
create or replace function public.bhd_login(p_username text, p_password text)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare v public.admins; v_token uuid;
begin
  select * into v from public.admins where username = trim(p_username) limit 1;
  if v.id is null or v.password is null
     or v.password <> crypt(coalesce(p_password, ''), v.password) then
    return null;
  end if;
  delete from public.admin_sessions where expires_at < now();
  insert into public.admin_sessions(admin_id) values (v.id) returning token into v_token;
  return json_build_object('id', v.id, 'username', v.username, 'role', v.role, 'token', v_token);
end $$;

create or replace function public.bhd_logout(p_token uuid)
returns void language sql security definer
set search_path = public
as $$ delete from public.admin_sessions where token = p_token $$;

create or replace function public.bhd_register(p_username text, p_password text, p_code text)
returns void language plpgsql security definer
set search_path = public, extensions
as $$
declare v_code text;
begin
  select value into v_code from public.settings where key = 'admin_reg_code';
  if v_code is null or coalesce(p_code, '') <> v_code then
    raise exception 'Kode admin tidak valid. Hubungi Superadmin.';
  end if;
  if coalesce(trim(p_username), '') = '' then raise exception 'Username wajib diisi'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Password minimal 6 karakter'; end if;
  if exists (select 1 from public.admins where username = trim(p_username)) then
    raise exception 'Username sudah dipakai';
  end if;
  insert into public.admins(id, username, password, role, active, created_at)
  values ('adm_' || (extract(epoch from clock_timestamp()) * 1000)::bigint,
          trim(p_username), p_password, 'admin', true, now());
end $$;

-- ── 4. Kelola admin (superadmin saja) ──────────────────────────────
create or replace function public.bhd_admin_list(p_token uuid)
returns table(id text, username text, role text)
language plpgsql security definer
set search_path = public
as $$
begin
  perform public._bhd_require_superadmin(p_token);
  return query select a.id, a.username, a.role from public.admins a order by a.username;
end $$;

create or replace function public.bhd_admin_add(p_token uuid, p_username text, p_password text, p_role text)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  perform public._bhd_require_superadmin(p_token);
  if p_role not in ('admin', 'superadmin') then raise exception 'Role tidak valid'; end if;
  if coalesce(trim(p_username), '') = '' then raise exception 'Username wajib diisi'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Password minimal 6 karakter'; end if;
  if exists (select 1 from public.admins where username = trim(p_username)) then
    raise exception 'Username sudah dipakai';
  end if;
  insert into public.admins(id, username, password, role, active, created_at)
  values ('adm_' || (extract(epoch from clock_timestamp()) * 1000)::bigint,
          trim(p_username), p_password, p_role, true, now());
end $$;

create or replace function public.bhd_admin_update(p_token uuid, p_id text, p_role text, p_password text)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  perform public._bhd_require_superadmin(p_token);
  if p_role not in ('admin', 'superadmin') then raise exception 'Role tidak valid'; end if;
  if not exists (select 1 from public.admins where id = p_id) then
    raise exception 'Admin tidak ditemukan';
  end if;
  if p_role = 'admin'
     and (select role from public.admins where id = p_id) = 'superadmin'
     and (select count(*) from public.admins where role = 'superadmin') <= 1 then
    raise exception 'Harus ada minimal satu superadmin';
  end if;
  if p_password is not null and p_password <> '' then
    if length(p_password) < 6 then raise exception 'Password minimal 6 karakter'; end if;
    update public.admins set role = p_role, password = p_password where id = p_id;
    delete from public.admin_sessions where admin_id = p_id; -- paksa login ulang
  else
    update public.admins set role = p_role where id = p_id;
  end if;
end $$;

create or replace function public.bhd_admin_delete(p_token uuid, p_id text)
returns void language plpgsql security definer
set search_path = public
as $$
declare me public.admins;
begin
  me := public._bhd_require_superadmin(p_token);
  if me.id = p_id then raise exception 'Tidak bisa menghapus akun sendiri'; end if;
  delete from public.admins where id = p_id;
  if not found then raise exception 'Admin tidak ditemukan'; end if;
end $$;

create or replace function public.bhd_reg_code_get(p_token uuid)
returns text language plpgsql security definer
set search_path = public
as $$
begin
  perform public._bhd_require_superadmin(p_token);
  return (select value from public.settings where key = 'admin_reg_code');
end $$;

create or replace function public.bhd_reg_code_set(p_token uuid, p_code text)
returns void language plpgsql security definer
set search_path = public
as $$
begin
  perform public._bhd_require_superadmin(p_token);
  if coalesce(trim(p_code), '') = '' then raise exception 'Kode tidak boleh kosong'; end if;
  insert into public.settings(key, value) values ('admin_reg_code', trim(p_code))
  on conflict (key) do update set value = excluded.value;
end $$;

-- Hak jalankan fungsi: helper internal tertutup, fungsi publik boleh dipanggil aplikasi
revoke all on function public._bhd_session_admin(uuid) from public, anon, authenticated;
revoke all on function public._bhd_require_superadmin(uuid) from public, anon, authenticated;
revoke all on function public.bhd_hash_admin_password() from public, anon, authenticated;
grant execute on function public.bhd_login(text, text) to anon, authenticated;
grant execute on function public.bhd_logout(uuid) to anon, authenticated;
grant execute on function public.bhd_register(text, text, text) to anon, authenticated;
grant execute on function public.bhd_admin_list(uuid) to anon, authenticated;
grant execute on function public.bhd_admin_add(uuid, text, text, text) to anon, authenticated;
grant execute on function public.bhd_admin_update(uuid, text, text, text) to anon, authenticated;
grant execute on function public.bhd_admin_delete(uuid, text) to anon, authenticated;
grant execute on function public.bhd_reg_code_get(uuid) to anon, authenticated;
grant execute on function public.bhd_reg_code_set(uuid, text) to anon, authenticated;

-- ── 5. Settings: semua boleh kecuali kode daftar admin ─────────────
alter table public.settings enable row level security;
grant select, insert, update, delete on public.settings to anon, authenticated;
drop policy if exists bhd_settings_app on public.settings;
create policy bhd_settings_app on public.settings
  for all to anon, authenticated
  using (key <> 'admin_reg_code')
  with check (key <> 'admin_reg_code');

-- ── 6. Tabel data operasional: RLS aktif, aplikasi tetap bisa baca/tulis ──
do $$
declare t text;
begin
  foreach t in array array['transactions','fleet','drivers','inventory',
                           'inventory_installed','fleet_tires','audit_logs']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
      execute format('drop policy if exists bhd_app_access on public.%I', t);
      execute format('create policy bhd_app_access on public.%I for all to anon, authenticated using (true) with check (true)', t);
    end if;
  end loop;
end $$;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Selesai. Cek cepat (harus 0 baris password teks biasa):
select count(*) as password_belum_terenkripsi
from public.admins where password !~ '^\$2[abxy]\$';
