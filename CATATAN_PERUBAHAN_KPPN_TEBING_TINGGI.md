# Perubahan Smart PPNPN - KPPN Tebing Tinggi

## Aturan presensi
- Lokasi: KPPN Tebing Tinggi, Jl. Sutomo No. 2.
- Titik GPS: 3.3271875, 99.167671875.
- Radius maksimal: 200 meter.
- Validasi lokasi hanya berdasarkan jarak GPS; hasil reverse geocoding tidak harus mengandung kata "tebing".
- Zona waktu: Asia/Jakarta (WIB).
- Piket pagi: standar masuk 07.15 WIB dan standar pulang 17.30 WIB.
- Piket malam: standar masuk 17.30 WIB dan standar pulang 07.15 WIB pada hari berikutnya.
- Presensi masuk dan pulang tetap dapat dilakukan kapan saja.
- Terlambat dihitung dalam `late_minutes`.
- Pulang cepat dihitung dalam `early_leave_minutes`.
- Total dasar potongan waktu disimpan dalam `deduction_minutes`.

## Routing
- `/` mengecek session/role.
- Pegawai diarahkan ke `/dashboard`.
- `/dashboard` sekarang merupakan dashboard/menu utama pegawai, bukan halaman presensi.
- Presensi masuk: `/presensi`.
- Presensi pulang: `/presensiout`.
- `/checkinpage` menjadi alias ke `/presensi`.
- `/checkoutform` menjadi alias ke `/presensiout`.

## Database
Sebelum uji presensi, jalankan:
`MIGRATION_PRESENSI_KPPN_TEBING_TINGGI.sql`
di Supabase SQL Editor.

## Environment Vercel
Pastikan minimal tersedia:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Lokasi kantor tidak lagi mengambil `NEXT_PUBLIC_LOCATION`, sehingga lokasi lama tidak dapat menimpa titik KPPN Tebing Tinggi.
