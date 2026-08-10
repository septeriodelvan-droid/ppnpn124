'use client';

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ArrowLeft,
  Camera,
  Clock,
} from 'lucide-react';

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


const getWIBMinutesOfDay = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: WIB_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);

  return hour * 60 + minute;
};

// Untuk piket malam yang absen setelah tengah malam s.d. sebelum 07.15 WIB,
// attendance_date tetap dianggap tanggal piket malam sebelumnya.
const getAttendanceDateForShift = (
  shift: 'pagi' | 'malam',
  date = new Date()
) => {
  const wibDate = getWIBDateString(date);

  if (
    shift === 'malam' &&
    getWIBMinutesOfDay(date) < 7 * 60 + 15
  ) {
    return addDaysToDateString(wibDate, -1);
  }

  return wibDate;
};

export default function CheckInPage() {
  const router = useRouter();

  // =========================
  // HYDRATION FIX
  // =========================

  const [mounted, setMounted] =
    useState(false);

  // =========================
  // STATE
  // =========================

  const [currentTime, setCurrentTime] =
    useState(new Date());

  const [todayDateWib, setTodayDateWib] =
    useState('');

  const [location, setLocation] =
    useState<{
      lat: number;
      lon: number;
    } | null>(null);

  const [distance, setDistance] =
    useState<number | null>(null);

  const [address, setAddress] =
    useState('Mencari alamat...');

  const [locationStatus, setLocationStatus] =
    useState('Mencari lokasi...');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [shift, setShift] = useState<
    'pagi' | 'malam'
  >('pagi');

  const [userId, setUserId] = useState<
    string | null
  >(null);

  const [canCheckIn, setCanCheckIn] =
    useState(true);

  // =========================
  // FOTO / KAMERA
  // =========================

  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);

  const [photo, setPhoto] = useState<
    string | null
  >(null);

  const [cameraOpen, setCameraOpen] =
    useState(false);

  // =========================
  // MOUNTED FIX
  // =========================

  useEffect(() => {
    setMounted(true);

    setTodayDateWib(getWIBDateString());
  }, []);

  // =========================
  // CLEANUP CAMERA
  // =========================

  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const stream =
          videoRef.current
            .srcObject as MediaStream;

        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }
    };
  }, []);

  // =========================
  // REALTIME CLOCK
  // =========================

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // =========================
  // RESET HARIAN BERDASARKAN WIB
  // =========================

  useEffect(() => {
    if (!todayDateWib) return;

    const timer = setInterval(() => {
      const newDateWib = getWIBDateString();

      if (newDateWib !== todayDateWib) {
        setTodayDateWib(newDateWib);
        setLocation(null);
        setDistance(null);
        setAddress('Mencari alamat...');
        setLocationStatus('Mencari lokasi...');
        setIsSubmitting(false);
        setPhoto(null);
      }
    }, 60000);

    return () => clearInterval(timer);
  }, [todayDateWib]);

  // =========================
  // GPS
  // =========================

  const fetchLocation = async () => {
    if (!navigator.geolocation) {
      setLocationStatus(
        'Geolocation tidak didukung browser ini.'
      );

      return;
    }

    setLocationStatus(
      'Mengambil lokasi...'
    );

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;

        const lon = pos.coords.longitude;

        setLocation({ lat, lon });

        const R = 6371e3;

        const φ1 =
          (OFFICE_LOCATION.latitude *
            Math.PI) /
          180;

        const φ2 = (lat * Math.PI) / 180;

        const Δφ =
          ((lat -
            OFFICE_LOCATION.latitude) *
            Math.PI) /
          180;

        const Δλ =
          ((lon -
            OFFICE_LOCATION.longitude) *
            Math.PI) /
          180;

        const a =
          Math.sin(Δφ / 2) ** 2 +
          Math.cos(φ1) *
            Math.cos(φ2) *
            Math.sin(Δλ / 2) ** 2;

        const c =
          2 *
          Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
          );

        const dist = R * c;

        setDistance(dist);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
          );

          const data = await res.json();

          setAddress(
            data.display_name ||
              'Alamat tidak ditemukan'
          );
        } catch {
          setAddress(
            'Gagal mendapatkan alamat'
          );
        }

        if (
          dist <= OFFICE_LOCATION.radius_m
        ) {
          setLocationStatus(
            'Lokasi valid (dalam radius KPPN Tebing Tinggi)'
          );
        } else {
          setLocationStatus(
            'Di luar radius 200 meter KPPN Tebing Tinggi'
          );
        }
      },
      () => {
        setLocationStatus(
          'Gagal mendapatkan lokasi.'
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  // =========================
  // USER LOGIN
  // =========================

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);
      }
    };

    fetchUser();
  }, []);

  // =========================
  // CEK ABSEN
  // =========================

  useEffect(() => {
    const checkAttendance = async () => {
      if (!userId || !todayDateWib)
        return;

      const effectiveAttendanceDate =
        getAttendanceDateForShift(shift, new Date());

      const { data } = await supabase
        .from('attendances')
        .select('id')
        .eq('user_id', userId)
        .eq(
          'attendance_date',
          effectiveAttendanceDate
        )
        .eq('shift', shift)
        .maybeSingle();

      setCanCheckIn(!data);
    };

    checkAttendance();
  }, [todayDateWib, shift, userId]);

  // =========================
  // BUKA KAMERA
  // =========================

  const openCamera = async () => {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: {
              facingMode: 'user',
              width: {
                ideal: 1280,
              },
              height: {
                ideal: 720,
              },
            },
            audio: false,
          }
        );

      if (videoRef.current) {
        videoRef.current.srcObject =
          stream;

        await videoRef.current.play();
      }

      setCameraOpen(true);
    } catch (err) {
      console.error(err);

      toast.error(
        'Kamera tidak dapat diakses. Pastikan izin kamera diaktifkan.'
      );
    }
  };

  // =========================
  // AMBIL FOTO
  // =========================

  const capturePhoto = () => {
  const video = videoRef.current;
  const canvas = canvasRef.current;

  if (!video || !canvas) return;

  // 1. TINGKATKAN RESOLUSI
  const TARGET_WIDTH = 540;
  const TARGET_HEIGHT = 720;

  canvas.width = TARGET_WIDTH;
  canvas.height = TARGET_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 2. DEFINISI VARIABEL (Agar tidak ReferenceError)
  const now = new Date();
  const dateText = now.toLocaleDateString('id-ID', {
    timeZone: WIB_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeText = now.toLocaleTimeString('id-ID', {
    timeZone: WIB_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const latText = location?.lat ? location.lat.toFixed(5) : '-';
  const lonText = location?.lon ? location.lon.toFixed(5) : '-';
  const distanceText = distance !== null ? `${distance.toFixed(1)} meter` : '-';
  const shortAddress = address ? address.substring(0, 38) : 'Lokasi tidak tersedia';

  // 3. Gambar video ke canvas
  ctx.drawImage(video, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);

  // 4. Overlay Watermark
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, TARGET_HEIGHT - 200, TARGET_WIDTH, 200);

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'black';
  ctx.shadowBlur = 4;

  // Render Teks
  ctx.font = 'bold 30px Arial';
  ctx.fillText('SMART PPNPN - KPPN TEBING TINGGI', 20, TARGET_HEIGHT - 160);

  ctx.font = '24px Arial';
  ctx.fillText(`${dateText} ${timeText} WIB`, 20, TARGET_HEIGHT - 120);
  ctx.fillText(`${latText}, ${lonText}`, 20, TARGET_HEIGHT - 90);
  ctx.fillText(`Jarak: ${distanceText}`, 20, TARGET_HEIGHT - 60);
  ctx.fillText(shortAddress, 20, TARGET_HEIGHT - 30);

  // 5. EKSPOR GAMBAR (Kualitas 0.8 sudah sangat jernih dan tidak pecah)
  const compressedImage = canvas.toDataURL('image/jpeg', 0.7);

  setPhoto(compressedImage);
  setCameraOpen(false);

  // Stop kamera
  const stream = video.srcObject as MediaStream;
  stream?.getTracks().forEach((track) => track.stop());
};

  // =========================
  // HANDLE CHECK IN - KPPN TEBING TINGGI
  // =========================

  const handleCheckIn = async () => {
    if (!location) {
      return toast.error('Lokasi belum terdeteksi.');
    }

    if (!photo) {
      return toast.error('Silakan ambil foto terlebih dahulu.');
    }

    // Validasi lokasi hanya berdasarkan jarak GPS <= 200 meter.
    // Tidak lagi mensyaratkan hasil alamat mengandung kata "tebing".
    const isValidLocation =
      distance !== null &&
      distance <= OFFICE_LOCATION.radius_m;

    if (!isValidLocation) {
      return toast.error(
        `Presensi ditolak. Anda harus berada maksimal ${OFFICE_LOCATION.radius_m} meter dari KPPN Tebing Tinggi.`
      );
    }

    if (!userId) {
      return toast.error('Anda belum login.');
    }

    const now = new Date();
    const attendanceDate =
      getAttendanceDateForShift(shift, now);

    // Jam standar tetap dipakai sebagai dasar hitung keterlambatan,
    // tetapi presensi TIDAK lagi ditolak jika lewat jam tersebut.
    const scheduledStart =
      shift === 'pagi'
        ? makeWIBDateTime(attendanceDate, '07:15:00')
        : makeWIBDateTime(attendanceDate, '17:30:00');

    const lateMinutes = Math.max(
      0,
      Math.ceil(
        (now.getTime() - scheduledStart.getTime()) / 60000
      )
    );

    const attendanceStatus =
      lateMinutes > 0 ? 'Terlambat' : 'Hadir';

    setIsSubmitting(true);

    try {
      // Cegah presensi ganda untuk tanggal WIB dan shift yang sama.
      const { data: existingAttendance, error: existingError } =
        await supabase
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

      // =========================
      // UPLOAD FOTO
      // =========================

      const response = await fetch(photo);
      const blob = await response.blob();

      const fileName =
        `${userId}_in_${Date.now()}.jpg`;

      const { error: uploadError } =
        await supabase.storage
          .from('attendance-photos')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
          });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } =
        supabase.storage
          .from('attendance-photos')
          .getPublicUrl(fileName);

      const photoUrl =
        publicUrlData.publicUrl;

      // Piket pagi selesai 17.30 WIB hari yang sama.
      // Piket malam selesai 07.15 WIB hari berikutnya.
      const shiftEnd =
        shift === 'pagi'
          ? makeWIBDateTime(
              attendanceDate,
              '17:30:00'
            )
          : makeWIBDateTime(
              addDaysToDateString(
                attendanceDate,
                1
              ),
              '07:15:00'
            );

      // =========================
      // INSERT ATTENDANCE
      // =========================

      const {
        data: attendanceData,
        error: attendanceError,
      } = await supabase
        .from('attendances')
        .insert([
          {
            user_id: userId,
            attendance_date:
              attendanceDate,
            shift,

            // Jam standar masuk sebagai dasar perhitungan keterlambatan.
            shift_start:
              scheduledStart.toISOString(),

            shift_end:
              shiftEnd.toISOString(),

            check_in:
              now.toISOString(),

            status:
              attendanceStatus,

            // 1 menit terlambat = 1 menit potongan waktu.
            // Nilai ini dapat dikonversi menjadi persen/rupiah pada tahap payroll.
            late_minutes:
              lateMinutes,

            early_leave_minutes:
              0,

            deduction_minutes:
              lateMinutes,

            check_in_location:
              address,

            check_in_latitude:
              location.lat,

            check_in_longitude:
              location.lon,

            check_in_distance_m:
              distance,

            check_in_photo:
              photoUrl,
          },
        ])
        .select('id')
        .single();

      if (attendanceError) {
        throw attendanceError;
      }

      // =========================
      // INSERT LOGBOOK
      // =========================

      const { error: logbookError } =
        await supabase
          .from('logbooks')
          .insert([
            {
              user_id: userId,
              attendance_id:
                attendanceData.id,
              shift,
              log_date:
                attendanceDate,
              description: '',
              status:
                'IN_PROGRESS',
            },
          ]);

      if (logbookError) {
        console.error(
          'Gagal membuat logbook:',
          logbookError
        );
      }

      toast.success(
        lateMinutes > 0
          ? `Absen masuk berhasil. Terlambat ${lateMinutes} menit; potongan tercatat ${lateMinutes} menit.`
          : `Absen masuk piket ${shift} berhasil tepat waktu.`
      );

      setCanCheckIn(false);
      router.replace('/dashboard');
    } catch (err: any) {
      toast.error(
        err?.message ||
          'Gagal menyimpan absen.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================
  // FORMAT WAKTU WIB
  // =========================

  const formattedTime = mounted
    ? currentTime.toLocaleTimeString(
        'id-ID',
        {
          timeZone: WIB_TIME_ZONE,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }
      )
    : '--:--:--';

  const formattedDate = mounted
    ? currentTime.toLocaleDateString(
        'id-ID',
        {
          timeZone: WIB_TIME_ZONE,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }
      )
    : 'Memuat tanggal...';

  // =========================
  // SSR FIX
  // =========================

  if (!mounted) {
    return null;
  }

  // =========================
  // UI
  // =========================

  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* HEADER */}
      <header className="bg-blue-900 text-white p-4 shadow-lg flex items-center">
        <button
          onClick={() =>
            router.back()
          }
          className="p-1 mr-4 text-white hover:text-gray-300 transition"
        >
          <ArrowLeft size={24} />
        </button>

        <div>
          <h1 className="text-xl font-bold">
            Absen Masuk
          </h1>
          <p className="text-xs text-blue-100">
            KPPN Tebing Tinggi
          </p>
        </div>
      </header>

      <main className="p-6">

        {/* JAM */}
        <div className="bg-white p-8 rounded-xl shadow-lg mb-8 text-center">
          <Clock
            size={48}
            className="text-gray-700 mx-auto mb-4"
          />

          <p className="text-lg font-semibold text-gray-700">
            Waktu Saat Ini (WIB)
          </p>

          <h2 className="text-5xl font-extrabold text-gray-900 mb-1">
            {formattedTime}
          </h2>

          <p className="text-md text-gray-500">
            {formattedDate}
          </p>
        </div>

        {/* SHIFT */}
        <div className="bg-white p-4 rounded-xl shadow-md border mb-4">
          <label className="font-semibold text-gray-700">
            Pilih Shift
          </label>

          <select
            value={shift}
            onChange={(e) =>
              setShift(
                e.target
                  .value as
                  | 'pagi'
                  | 'malam'
              )
            }
            className="mt-2 w-full border p-2 rounded-lg"
          >
            <option value="pagi">
              Piket Pagi — standar masuk 07.15 WIB
            </option>

            <option value="malam">
              Piket Malam — standar masuk 17.30 WIB
            </option>
          </select>
        </div>

        {/* LOKASI */}
        <div className="bg-white p-4 rounded-xl shadow-md border mb-5">
          <p className="font-semibold text-gray-700 mb-1">
            Lokasi Presensi — KPPN Tebing Tinggi
          </p>

          <p className="text-sm text-gray-600 mb-2">
            {OFFICE_LOCATION.address} — radius maksimal {OFFICE_LOCATION.radius_m} meter
          </p>

          <p
            className={`text-sm ${
              distance &&
              distance <=
                OFFICE_LOCATION.radius_m
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {locationStatus}
          </p>

          {distance !==
            null && (
            <p className="mt-1 text-sm text-gray-600">
              Jarak dari kantor:{' '}
              <b>
                {distance.toFixed(
                  1
                )}{' '}
                meter
              </b>
            </p>
          )}

          <p className="mt-2 text-sm text-gray-600">
            <b>Alamat GPS:</b>
            <br />
            {address}
          </p>

          <button
            onClick={
              fetchLocation
            }
            className="mt-3 bg-blue-900 text-white text-sm py-2 px-3 rounded-lg"
          >
            Ambil Ulang
            Lokasi
          </button>
        </div>

        {/* FOTO */}
        <div className="bg-white p-4 rounded-xl shadow-md border mb-5">

          <div className="flex items-center gap-2 mb-3">
            <Camera size={20} />

            <p className="font-semibold text-gray-700">
              Foto Presensi
            </p>
          </div>

          {/* TOMBOL BUKA KAMERA */}
          {!photo &&
            !cameraOpen && (
              <button
                onClick={() => {
                  setCameraOpen(
                    true
                  );

                  setTimeout(
                    () => {
                      openCamera();
                    },
                    300
                  );
                }}
                className="bg-green-600 text-white px-4 py-2 rounded-lg"
              >
                Buka Kamera
              </button>
            )}

          {/* VIDEO */}
          {cameraOpen && (
            <div className="space-y-3">

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg border bg-black"
              />

              <button
                onClick={
                  capturePhoto
                }
                className="bg-blue-900 text-white px-4 py-2 rounded-lg"
              >
                Ambil Foto
              </button>
            </div>
          )}

          {/* PREVIEW FOTO */}
          {photo && (
            <div className="space-y-3">

              <img
                src={photo}
                alt="Preview"
                className="w-full rounded-lg border"
              />

              <button
                onClick={() => {
                  setPhoto(
                    null
                  );

                  setCameraOpen(
                    true
                  );

                  setTimeout(
                    () => {
                      openCamera();
                    },
                    300
                  );
                }}
                className="bg-yellow-500 text-white px-4 py-2 rounded-lg"
              >
                Ambil Ulang
              </button>
            </div>
          )}

          <canvas
            ref={canvasRef}
            className="hidden"
          />
        </div>

        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
          <b>Perhitungan keterlambatan:</b><br />
          Piket pagi dihitung terlambat setelah 07.15 WIB. Piket malam dihitung terlambat setelah 17.30 WIB.
          Presensi tetap dapat dilakukan kapan saja; jumlah menit terlambat disimpan sebagai dasar potongan.
        </div>

        {/* SUBMIT */}
        <button
          onClick={
            handleCheckIn
          }
          disabled={
            isSubmitting ||
            !canCheckIn
          }
          className={`w-full py-4 text-white font-extrabold rounded-xl transition duration-300 shadow-xl ${
            isSubmitting ||
            !canCheckIn
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-900 hover:bg-blue-800'
          }`}
        >
          {isSubmitting
            ? 'Memproses...'
            : !canCheckIn
            ? `Sudah absen piket ${shift}`
            : 'SUBMIT ABSEN MASUK'}
        </button>
      </main>
    </div>
  );
}
