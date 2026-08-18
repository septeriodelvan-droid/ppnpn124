# Perbaikan Role dan Dashboard — 18 Agustus 2026

- `validator@kppn124.com` dipetakan sebagai Elias Kristanto Sinaga, Kepala Subbagian Umum, role `kasubbag`.
- `approver@kppn124.com` dipetakan sebagai Mahindun Dhiani Melda Harahap, Kepala Kantor, role `kepala_kantor`.
- Kedua role reviewer tidak dapat mengakses route presensi/logbook/lembur pegawai dan diarahkan ke `/dashboardadmin`.
- Rekap absensi/detail absensi/rekap lembur admin hanya mengambil `profiles.role = pegawai`.
- Grafik dashboard admin tidak lagi menggunakan `v_rapor_bulanan` untuk grafik harian. View tersebut bersifat bulanan dan nilai `bulan` selalu tanggal 1. Grafik kini membaca `attendances` dan `logbooks` secara langsung sehingga tanggal 1–18 Agustus 2026 dapat tampil sesuai periode berjalan.
