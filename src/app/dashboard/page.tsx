'use client';

import { Clock, ArrowLeft } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';

const OFFICE_LOCATION = {
  latitude: 3.3271875,
  longitude: 99.167671875,
  radius_m: 200,
  name: 'KPPN Tebing Tinggi',
  address: 'Jl. Sutomo No. 2, Tebing Tinggi',
} as const;

const WIB_TIME_ZONE = 'Asia/Jakarta';

const getWIBDateString = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: WIB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
};

const addDaysToDateString = (dateString: string, days: number) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const makeWIBDateTime = (dateString: string, timeString: string) =>
  new Date(`${dateString}T${timeString}+07:00`);

export default function CheckInPage() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [address, setAddress] = useState<string>('Mencari alamat...');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>('Mencari lokasi...');
  const [shift, setShift] = useState<'pagi' | 'malam'>('pagi');
  const [todayDateWib, setTodayDateWib] = useState(getWIBDateString());
  
  const [userId, setUserId] = useState<string | null>(null);
  const [canCheckIn, setCanCheckIn] = useState(true);

  // --- Realtime clock ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Reset otomatis ketika tanggal WIB berganti ---
  useEffect(() => {
    const timer = setInterval(() => {
      const todayStr = getWIBDateString();
      if (todayStr !== todayDateWib) {
        setTodayDateWib(todayStr);
        setLocation(null);
        setDistance(null);
        setAddress('Mencari alamat...');
        setLocationStatus('Mencari lokasi...');
        setIsSubmitting(false);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [todayDateWib]);

  // --- Ambil lokasi GPS ---
  const fetchLocation = async () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation tidak didukung browser ini.');
      return;
    }

    setLocationStatus('Mengambil lokasi...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLocation({ lat, lon });

        const R = 6371e3;
        const φ1 = OFFICE_LOCATION.latitude * Math.PI / 180;
        const φ2 = lat * Math.PI / 180;
        const Δφ = (lat - OFFICE_LOCATION.latitude) * Math.PI / 180;
        const Δλ = (lon - OFFICE_LOCATION.longitude) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const dist = R * c;
        setDistance(dist);

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
          const data = await res.json();
          setAddress(data.display_name || 'Alamat tidak ditemukan');
        } catch {
          setAddress('Gagal mendapatkan alamat');
        }

        if (dist <= OFFICE_LOCATION.radius_m)
          setLocationStatus('Lokasi valid (dalam radius kantor)');
        else setLocationStatus('Di luar radius kantor');
      },
      () => {
        setLocationStatus('Gagal mendapatkan lokasi.');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => { fetchLocation(); }, []);

  // Waktu dan tanggal selalu ditampilkan dalam WIB/Asia Jakarta
  const formattedTime = currentTime.toLocaleTimeString('id-ID', {
    timeZone: WIB_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const formattedDate = currentTime.toLocaleDateString('id-ID', {
    timeZone: WIB_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // --- Ambil user ID saat login ---
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    fetchUser();
  }, []);

  // --- Cek apakah user sudah absen hari ini ---
  useEffect(() => {
    const checkAttendance = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from('attendances')
        .select('id')
        .eq('user_id', userId)
        .eq('attendance_date', todayDateWib)
        .eq('shift', shift)
        .maybeSingle();
      setCanCheckIn(!data);
    };
    checkAttendance();
  }, [todayDateWib, shift, userId]);

  // --- HANDLE CHECK-IN KPPN TEBING TINGGI ---
  const handleCheckIn = async () => {
    if (!location) return toast.error('Lokasi belum terdeteksi.');

    // Validasi lokasi hanya berdasarkan jarak GPS <= 200 meter.
    // Tidak lagi mensyaratkan hasil alamat mengandung kata "tebing".
    const isValidLocation =
      distance !== null && distance <= OFFICE_LOCATION.radius_m;

    if (!isValidLocation) {
      return toast.error(
        `Presensi ditolak. Anda harus berada maksimal ${OFFICE_LOCATION.radius_m} meter dari KPPN Tebing Tinggi.`
      );
    }

    if (!userId) return toast.error('Anda belum login.');

    const now = new Date();
    const attendanceDate = getWIBDateString(now);

    // Piket pagi  : masuk paling lambat 07.15 WIB hari ini.
    // Piket malam : masuk paling lambat 17.30 WIB hari ini.
    const checkInDeadline =
      shift === 'pagi'
        ? makeWIBDateTime(attendanceDate, '07:15:00')
        : makeWIBDateTime(attendanceDate, '17:30:00');

    // Lewat batas waktu = ditolak, bukan lagi status "Terlambat".
    if (now.getTime() > checkInDeadline.getTime()) {
      const batas = shift === 'pagi' ? '07.15 WIB' : '17.30 WIB';
      return toast.error(
        `Presensi ditolak. Batas absen masuk piket ${shift} adalah ${batas}.`
      );
    }

    setIsSubmitting(true);

    try {
      // Cegah presensi ganda pada tanggal WIB dan shift yang sama.
      const { data: existingAttendance, error: existingError } = await supabase
        .from('attendances')
        .select('id')
        .eq('user_id', userId)
        .eq('attendance_date', attendanceDate)
        .eq('shift', shift)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingAttendance) {
        setCanCheckIn(false);
        throw new Error(`Anda sudah absen masuk untuk piket ${shift}.`);
      }

      // Piket pagi selesai 17.30 WIB hari yang sama.
      // Piket malam selesai 07.15 WIB pada hari berikutnya.
      const shiftEnd =
        shift === 'pagi'
          ? makeWIBDateTime(attendanceDate, '17:30:00')
          : makeWIBDateTime(
              addDaysToDateString(attendanceDate, 1),
              '07:15:00'
            );

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendances')
        .insert([{
          user_id: userId,
          attendance_date: attendanceDate,
          shift,
          shift_start: checkInDeadline.toISOString(),
          shift_end: shiftEnd.toISOString(),
          check_in: now.toISOString(),
          status: 'Hadir',
          check_in_location: address,
          check_in_latitude: location.lat,
          check_in_longitude: location.lon,
          check_in_distance_m: distance,
        }])
        .select('id')
        .single();

      if (attendanceError) throw attendanceError;

      // ================= RANDOM VERIFIKASI 5% PER MINGGU =================
      const startYear = new Date(now.getFullYear(), 0, 1);
      const days = Math.floor((now.getTime() - startYear.getTime()) / 86400000);
      const weekNumber = Math.ceil((days + startYear.getDay() + 1) / 7);
      const randomVerify = ((attendanceData.id + weekNumber) % 100) < 5;

      await supabase.from('logbooks').insert([{
        user_id: userId,
        attendance_id: attendanceData.id,
        shift,
        log_date: attendanceDate,
        description: '',
        activity_name: randomVerify ? 'random' : 'system',
        status: 'IN_PROGRESS',
      }]);

      toast.success(`Absen masuk piket ${shift} berhasil.`);
      setCanCheckIn(false);
      router.replace('/dashboard');
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan absen.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <header className="bg-blue-900 text-white p-4 shadow-lg flex items-center">
        <button onClick={() => router.back()} className="p-1 mr-4 text-white hover:text-gray-300 transition">
          <ArrowLeft size={24} />
        </button>
        <div><h1 className="text-xl font-bold">Absen Masuk</h1><p className="text-xs text-blue-100">KPPN Tebing Tinggi</p></div>
      </header>

      <main className="p-6">
        <div className="bg-white p-8 rounded-xl shadow-lg mb-8 text-center">
          <Clock size={48} className="text-gray-700 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">Waktu Saat Ini (WIB)</p>
          <h2 className="text-5xl font-extrabold text-gray-900 mb-1">{formattedTime}</h2>
          <p className="text-md text-gray-500">{formattedDate}</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-md border mb-4">
          <label className="font-semibold text-gray-700">Pilih Shift:</label>
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value as 'pagi' | 'malam')}
            className="mt-2 w-full border p-2 rounded-lg"
          >
            <option value="pagi">Piket Pagi — masuk maks. 07.15 WIB</option>
            <option value="malam">Piket Malam — masuk maks. 17.30 WIB</option>
          </select>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-md border mb-5">
          <p className="font-semibold text-gray-700 mb-1">Lokasi Presensi: KPPN Tebing Tinggi, Jl. Sutomo No. 2 (maks. {OFFICE_LOCATION.radius_m} meter)</p>
          <p className={`text-sm ${distance && distance <= OFFICE_LOCATION.radius_m ? 'text-green-600' : 'text-red-600'}`}>
            {locationStatus}
          </p>
          {distance !== null && (
            <p className="mt-1 text-sm text-gray-600">
              Jarak dari kantor: <b>{distance.toFixed(1)} meter</b>
            </p>
          )}
          <p className="mt-2 text-sm text-gray-600">
            <b>Alamat:</b><br />{address}
          </p>
          <button onClick={fetchLocation} className="mt-3 bg-blue-900 text-white text-sm py-2 px-3 rounded-lg">
            Ambil Ulang Lokasi
          </button>
        </div>

        <button
          onClick={handleCheckIn}
          disabled={isSubmitting || !canCheckIn}
          className={`w-full py-4 text-white font-extrabold rounded-xl transition duration-300 shadow-xl ${
            isSubmitting || !canCheckIn ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-800'
          }`}
        >
          {isSubmitting ? 'Memproses...' : !canCheckIn ? `Sudah absen piket ${shift}` : 'SUBMIT ABSEN MASUK'}
        </button>
      </main>
    </div>
  );
}
