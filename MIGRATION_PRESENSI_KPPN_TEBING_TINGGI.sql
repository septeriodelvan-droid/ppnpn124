-- ============================================================
-- MIGRASI PRESENSI SMART PPNPN - KPPN TEBING TINGGI
-- Jalankan sekali melalui Supabase > SQL Editor.
-- ============================================================

alter table public.attendances
  add column if not exists late_minutes integer not null default 0,
  add column if not exists early_leave_minutes integer not null default 0,
  add column if not exists deduction_minutes integer not null default 0;

alter table public.attendances
  drop constraint if exists attendances_late_minutes_nonnegative;

alter table public.attendances
  add constraint attendances_late_minutes_nonnegative
  check (late_minutes >= 0);

alter table public.attendances
  drop constraint if exists attendances_early_leave_minutes_nonnegative;

alter table public.attendances
  add constraint attendances_early_leave_minutes_nonnegative
  check (early_leave_minutes >= 0);

alter table public.attendances
  drop constraint if exists attendances_deduction_minutes_nonnegative;

alter table public.attendances
  add constraint attendances_deduction_minutes_nonnegative
  check (deduction_minutes >= 0);

comment on column public.attendances.late_minutes is
  'Menit keterlambatan dari standar masuk: pagi 07:15 WIB, malam 17:30 WIB.';

comment on column public.attendances.early_leave_minutes is
  'Menit pulang lebih awal dari standar: pagi 17:30 WIB, malam 07:15 WIB hari berikutnya.';

comment on column public.attendances.deduction_minutes is
  'Total dasar potongan waktu = late_minutes + early_leave_minutes.';

-- Verifikasi struktur/data terbaru.
select
  id,
  user_id,
  attendance_date,
  shift,
  check_in,
  check_out,
  status,
  late_minutes,
  early_leave_minutes,
  deduction_minutes
from public.attendances
order by id desc
limit 20;
