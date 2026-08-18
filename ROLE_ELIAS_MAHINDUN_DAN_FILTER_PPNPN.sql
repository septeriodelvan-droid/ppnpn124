-- ============================================================
-- SMART PPNPN KPPN TEBING TINGGI
-- Penetapan Elias sebagai Validator dan Mahindun sebagai Approver
-- + pembatasan presensi hanya untuk role pegawai
-- ============================================================

begin;

-- Pastikan kolom perhitungan disiplin sudah tersedia.
alter table public.attendances
  add column if not exists late_minutes integer not null default 0,
  add column if not exists early_leave_minutes integer not null default 0,
  add column if not exists deduction_minutes integer not null default 0;

-- 1. Izinkan jabatan pejabat pada tabel profiles.
alter table public.profiles
  drop constraint if exists profiles_position_check;

alter table public.profiles
  add constraint profiles_position_check check (
    position is null
    or position = any (
      array[
        'PPNPN'::text,
        'Satpam'::text,
        'Supir'::text,
        'CS'::text,
        'Kepala Subbagian Umum'::text,
        'Kepala Kantor'::text
      ]
    )
  );

-- 2. Pastikan profil reviewer tersedia dan identitasnya benar.
insert into public.profiles (
  id, email, full_name, position, role, is_admin
)
select
  u.id,
  u.email,
  'Elias Kristanto Sinaga',
  'Kepala Subbagian Umum',
  'kasubbag',
  false
from auth.users u
where lower(u.email) = 'validator@kppn124.com'
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  position = excluded.position,
  role = excluded.role,
  is_admin = false;

insert into public.profiles (
  id, email, full_name, position, role, is_admin
)
select
  u.id,
  u.email,
  'Mahindun Dhiani Melda Harahap',
  'Kepala Kantor',
  'kepala_kantor',
  false
from auth.users u
where lower(u.email) = 'approver@kppn124.com'
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  position = excluded.position,
  role = excluded.role,
  is_admin = false;

-- 3. Helper role untuk RLS.
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(coalesce(p.role, ''))
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

-- ============================================================
-- 4. ATTENDANCES
-- Pegawai: lihat/tulis milik sendiri.
-- Validator/Approver/Admin: hanya melihat semua data pegawai.
-- ============================================================
alter table public.attendances enable row level security;
grant select, insert, update on public.attendances to authenticated;

drop policy if exists "attendances_select" on public.attendances;
drop policy if exists "attendance_select_own" on public.attendances;
drop policy if exists "attendance_insert_own" on public.attendances;
drop policy if exists "attendance_update_own" on public.attendances;
drop policy if exists "attendance_employee_only_insert" on public.attendances;
drop policy if exists "attendance_employee_only_update" on public.attendances;

create policy "attendances_select"
on public.attendances
for select
to authenticated
using (
  (
    public.current_app_role() = 'pegawai'
    and user_id = (select auth.uid())
  )
  or public.current_app_role() in ('kasubbag', 'kepala_kantor', 'admin')
);

create policy "attendance_insert_own"
on public.attendances
for insert
to authenticated
with check (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
);

create policy "attendance_update_own"
on public.attendances
for update
to authenticated
using (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
)
with check (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
);

-- Policy RESTRICTIVE mencegah policy permisif lama membuka akses tulis reviewer.
create policy "attendance_employee_only_insert"
on public.attendances
as restrictive
for insert
to authenticated
with check (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
);

create policy "attendance_employee_only_update"
on public.attendances
as restrictive
for update
to authenticated
using (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
)
with check (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
);

-- ============================================================
-- 5. LOGBOOKS
-- ============================================================
alter table public.logbooks enable row level security;
grant select, insert, update on public.logbooks to authenticated;

drop policy if exists "logbooks_select" on public.logbooks;
drop policy if exists "logbook_select_own" on public.logbooks;
drop policy if exists "logbook_insert_own" on public.logbooks;
drop policy if exists "logbook_update_own" on public.logbooks;
drop policy if exists "logbook_employee_only_insert" on public.logbooks;
drop policy if exists "logbook_employee_only_update" on public.logbooks;

create policy "logbooks_select"
on public.logbooks
for select
to authenticated
using (
  (
    public.current_app_role() = 'pegawai'
    and user_id = (select auth.uid())
  )
  or public.current_app_role() in ('kasubbag', 'kepala_kantor', 'admin')
);

create policy "logbook_insert_own"
on public.logbooks
for insert
to authenticated
with check (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
);

create policy "logbook_update_own"
on public.logbooks
for update
to authenticated
using (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
)
with check (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
);

create policy "logbook_employee_only_insert"
on public.logbooks
as restrictive
for insert
to authenticated
with check (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
);

create policy "logbook_employee_only_update"
on public.logbooks
as restrictive
for update
to authenticated
using (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
)
with check (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
);

-- ============================================================
-- 6. LEMBUR
-- Reviewer hanya membaca, tidak clock-in/out lembur.
-- ============================================================
alter table public.lembur enable row level security;
grant select, insert, update on public.lembur to authenticated;

drop policy if exists "lembur_select" on public.lembur;
drop policy if exists "lembur_insert_own" on public.lembur;
drop policy if exists "lembur_update_own" on public.lembur;
drop policy if exists "lembur_employee_only_insert" on public.lembur;
drop policy if exists "lembur_employee_only_update" on public.lembur;

create policy "lembur_select"
on public.lembur
for select
to authenticated
using (
  (
    public.current_app_role() = 'pegawai'
    and user_id = (select auth.uid())
  )
  or public.current_app_role() in ('kasubbag', 'kepala_kantor', 'admin')
);

create policy "lembur_insert_own"
on public.lembur
for insert
to authenticated
with check (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
);

create policy "lembur_update_own"
on public.lembur
for update
to authenticated
using (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
)
with check (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
);

create policy "lembur_employee_only_insert"
on public.lembur
as restrictive
for insert
to authenticated
with check (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
);

create policy "lembur_employee_only_update"
on public.lembur
as restrictive
for update
to authenticated
using (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
)
with check (
  public.current_app_role() = 'pegawai'
  and user_id = (select auth.uid())
);

-- ============================================================
-- 7. View logbook admin hanya menampilkan pegawai PPNPN/CS/Satpam/Supir.
-- ============================================================
create or replace view public.vlogbook
with (security_invoker = on) as
select
  a.id,
  a.user_id,
  a.attendance_date,
  a.shift,
  a.check_in,
  a.check_out,
  a.status,
  p.full_name,
  p."position",
  coalesce(
    string_agg(t.task_name, '; '::text order by t.id),
    '-'::text
  ) as uraian_kerja,
  l.description,
  l.activity_name,
  coalesce(a.late_minutes, 0) as late_minutes,
  coalesce(a.early_leave_minutes, 0) as early_leave_minutes,
  coalesce(a.deduction_minutes, 0) as deduction_minutes
from public.attendances a
join public.profiles p on p.id = a.user_id
left join public.logbooks l on l.attendance_id = a.id
left join public.tasks t on t.logbook_id = l.id
where p.role = 'pegawai'
group by
  a.id,
  a.user_id,
  a.attendance_date,
  a.shift,
  a.check_in,
  a.check_out,
  a.status,
  p.full_name,
  p."position",
  l.description,
  l.activity_name,
  a.late_minutes,
  a.early_leave_minutes,
  a.deduction_minutes;

-- Jika view rekap presensi baru sudah pernah dibuat, filter ke pegawai saja.
do $$
begin
  if exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'v_rekap_presensi_ppnpn'
  ) then
    execute $view$
      create or replace view public.v_rekap_presensi_ppnpn
      with (security_invoker = on) as
      select
        a.id,
        a.user_id,
        p.full_name,
        p.position,
        p.email,
        a.attendance_date,
        a.shift,
        a.shift_start,
        a.shift_end,
        a.check_in,
        a.check_out,
        a.status,
        coalesce(a.late_minutes, 0) as late_minutes,
        coalesce(a.early_leave_minutes, 0) as early_leave_minutes,
        coalesce(a.deduction_minutes, 0) as deduction_minutes,
        a.check_in_location,
        a.check_in_latitude,
        a.check_in_longitude,
        a.check_in_distance_m,
        a.check_in_photo,
        a.check_out_location,
        a.check_out_latitude,
        a.check_out_longitude,
        a.check_out_distance_m,
        a.check_out_photo
      from public.attendances a
      join public.profiles p on p.id = a.user_id
      where p.role = 'pegawai'
    $view$;
  end if;
end $$;

commit;

-- ============================================================
-- VERIFIKASI
-- ============================================================
select
  email,
  full_name,
  position,
  role,
  is_admin
from public.profiles
where lower(email) in (
  'validator@kppn124.com',
  'approver@kppn124.com'
)
order by email;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('attendances', 'logbooks', 'lembur')
order by tablename, cmd, policyname;
