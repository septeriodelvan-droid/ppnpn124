'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Clock3,
  FileClock,
  FileText,
  LogOut,
  MapPin,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast, Toaster } from 'react-hot-toast';

type Profile = {
  full_name?: string | null;
  position?: string | null;
  role?: string | null;
};

const menuItems = [
  {
    title: 'Absen Masuk',
    description: 'Presensi masuk dengan GPS dan foto.',
    href: '/presensi',
    icon: UserRoundCheck,
  },
  {
    title: 'Absen Pulang',
    description: 'Presensi pulang dengan GPS dan foto.',
    href: '/presensiout',
    icon: Clock3,
  },
  {
    title: 'Logbook',
    description: 'Isi aktivitas untuk sesi presensi aktif.',
    href: '/logbook',
    icon: ClipboardList,
  },
  {
    title: 'Rekap Absensi',
    description: 'Lihat riwayat hadir, terlambat, dan potongan.',
    href: '/rekapabsensi',
    icon: CalendarCheck,
  },
  {
    title: 'Pengajuan Izin',
    description: 'Ajukan izin sesuai kebutuhan.',
    href: '/pengajuanizin',
    icon: FileText,
  },
  {
    title: 'Pengajuan Cuti',
    description: 'Ajukan dan pantau cuti.',
    href: '/pengajuancutipage',
    icon: CalendarDays,
  },
  {
    title: 'Lembur',
    description: 'Clock-in dan clock-out lembur di kantor.',
    href: '/lembur',
    icon: FileClock,
  },
  {
    title: 'Rekap Lembur',
    description: 'Lihat riwayat pelaksanaan lembur.',
    href: '/rekaplembur',
    icon: ShieldCheck,
  },
];

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initialize = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace('/login');
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, position, role')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        const role = data?.role?.toLowerCase();

        if (
          role === 'admin' ||
          role === 'kepala_kantor' ||
          role === 'kasubbag'
        ) {
          router.replace('/dashboardadmin');
          return;
        }

        setProfile(data);
      } catch (error) {
        console.error(error);
        toast.error('Gagal memuat dashboard.');
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [router]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Berhasil logout.');
      router.replace('/login');
    } catch (error: any) {
      toast.error(error?.message || 'Gagal logout.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600 font-medium">Memuat dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-center" />

      <header className="bg-blue-900 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-5 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-blue-200">
              SMART PPNPN
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold">
              Dashboard PPNPN
            </h1>
            <p className="text-sm text-blue-100 mt-1">
              KPPN Tebing Tinggi
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-white/10 hover:bg-red-500 px-3 py-2 rounded-lg transition"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline text-sm font-semibold">
              Logout
            </span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
          <p className="text-sm text-slate-500">Selamat datang,</p>
          <h2 className="text-2xl font-bold text-slate-800 mt-1">
            {profile?.full_name || 'Pegawai PPNPN'}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {profile?.position || 'PPNPN'}
          </p>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-blue-900">
            <MapPin size={18} className="mt-0.5 shrink-0" />
            <div>
              <b>Lokasi presensi:</b> KPPN Tebing Tinggi, Jl. Sutomo No. 2.
              Radius presensi maksimal 200 meter.
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3">
            Menu Utama
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {menuItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className="text-left bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center mb-4">
                    <Icon size={22} />
                  </div>
                  <p className="font-bold text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
