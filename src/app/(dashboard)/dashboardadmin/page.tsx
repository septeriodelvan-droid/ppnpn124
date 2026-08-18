'use client'

import React, { useEffect, useState } from 'react'

import {
  User,
  LogOut,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  BookOpenCheck,
  FilterX,
  CalendarDays
} from 'lucide-react'

import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabaseClient'
import { getWIBDateString } from '@/lib/attendanceConfig'

import { Toaster } from 'react-hot-toast'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts'

export default function DashboardAdmin() {

  const router = useRouter()

  // ==============================
  // STATE
  // ==============================

  const [wibYear, wibMonth] = getWIBDateString().split('-').map(Number)

  const [selectedYear, setSelectedYear] =
    useState(wibYear.toString())

  const [selectedMonth, setSelectedMonth] =
    useState((wibMonth - 1).toString())

  const [chartData, setChartData] =
    useState<any[]>([])

  const [totalPegawai, setTotalPegawai] =
    useState<number>(0)

  const [isLoading, setIsLoading] =
    useState(true)

  const [isLoggingOut, setIsLoggingOut] =
    useState(false)

  const [userData, setUserData] =
    useState({
      fullName: 'Loading...',
      email: 'loading@kppn.go.id'
    })

  // ==============================
  // MONTH NAME
  // ==============================

  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember'
  ]

  // ==============================
  // FETCH DATA
  // ==============================

  useEffect(() => {

    const init = async () => {

      try {

        setIsLoading(true)

        // ==============================
        // AUTH
        // ==============================

        const {
          data: { user }
        } = await supabase.auth.getUser()

        if (!user) {
          router.replace('/login')
          return
        }

        // ==============================
        // PROFILE
        // ==============================

        const {
          data: profile
        } = await supabase
          .from('profiles')
          .select(`
            full_name,
            email,
            role
          `)
          .eq('id', user.id)
          .single()

        if (!profile) {
          router.replace('/')
          return
        }

        const allowedRoles = [
          'admin',
          'kepala_kantor',
          'kasubbag'
        ]

        if (
          !allowedRoles.includes(profile.role)
        ) {
          router.replace('/')
          return
        }

        setUserData({
          fullName:
            profile.full_name || 'Admin',
          email:
            profile.email || user.email || '-'
        })

        // ==============================
        // TOTAL PEGAWAI
        // ==============================

        const {
          data: pegawaiData
        } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('role', 'pegawai')

        setTotalPegawai(
          pegawaiData?.length || 0
        )

        // ==============================
        // FETCH DATA GRAFIK HARIAN
        // ==============================
        // v_rapor_bulanan menyimpan `bulan` sebagai tanggal pertama
        // setiap bulan (contoh: 2026-08-01), sehingga view tersebut
        // tidak boleh dipakai untuk grafik per tanggal. Grafik ini
        // membaca attendances + logbooks langsung agar 1, 2, 3 ... 18
        // Agustus muncul sesuai data aktual.

        const employeeIds = (pegawaiData || []).map((p: any) => p.id)

        if (employeeIds.length === 0) {
          setChartData([])
          return
        }

        const pad2 = (value: number) => String(value).padStart(2, '0')
        const daysInMonth = (year: number, monthIndex: number) =>
          new Date(year, monthIndex + 1, 0).getDate()

        let startDate: string | null = null
        let endDate: string | null = null

        if (selectedYear !== 'all') {
          const yearNumber = Number(selectedYear)

          if (selectedMonth !== 'all') {
            const monthIndex = Number(selectedMonth)
            startDate = `${yearNumber}-${pad2(monthIndex + 1)}-01`
            endDate = `${yearNumber}-${pad2(monthIndex + 1)}-${pad2(daysInMonth(yearNumber, monthIndex))}`
          } else {
            startDate = `${yearNumber}-01-01`
            endDate = `${yearNumber}-12-31`
          }
        }

        let attendanceQuery = supabase
          .from('attendances')
          .select(`
            user_id,
            attendance_date,
            check_in,
            late_minutes,
            check_in_distance_m,
            check_out_distance_m
          `)
          .in('user_id', employeeIds)
          .not('check_in', 'is', null)

        let logbookQuery = supabase
          .from('logbooks')
          .select('user_id, log_date')
          .in('user_id', employeeIds)

        if (startDate && endDate) {
          attendanceQuery = attendanceQuery
            .gte('attendance_date', startDate)
            .lte('attendance_date', endDate)

          logbookQuery = logbookQuery
            .gte('log_date', startDate)
            .lte('log_date', endDate)
        }

        const [attendanceResult, logbookResult] = await Promise.all([
          attendanceQuery,
          logbookQuery
        ])

        if (attendanceResult.error) throw attendanceResult.error
        if (logbookResult.error) throw logbookResult.error

        const aggregation: Record<string, any> = {}

        const ensureBucket = (dateString: string) => {
          const [year, month, day] = dateString.split('-').map(Number)
          const monthIndex = month - 1
          let key = ''
          let name = ''
          let sortKey = 0

          if (selectedYear === 'all') {
            key = `${year}-${pad2(month)}`
            name = `${monthNames[monthIndex].substring(0, 3)} ${year}`
            sortKey = year * 100 + month
          } else if (selectedMonth === 'all') {
            key = `${year}-${pad2(month)}`
            name = monthNames[monthIndex]
            sortKey = monthIndex
          } else {
            key = dateString
            name = pad2(day)
            sortKey = day
          }

          if (!aggregation[key]) {
            aggregation[key] = {
              name,
              TepatWaktu: 0,
              Terlambat: 0,
              LuarRadius: 0,
              TotalLogbook: 0,
              sortKey
            }
          }

          return aggregation[key]
        }

        // Untuk satu bulan tertentu, tampilkan seluruh tanggal sampai
        // hari ini (jika bulan berjalan), sehingga grafik tidak hanya
        // berisi tanggal yang kebetulan punya record.
        if (selectedYear !== 'all' && selectedMonth !== 'all') {
          const yearNumber = Number(selectedYear)
          const monthIndex = Number(selectedMonth)
          const [todayYear, todayMonth, todayDay] = getWIBDateString().split('-').map(Number)
          const maxDay =
            yearNumber === todayYear && monthIndex === todayMonth - 1
              ? todayDay
              : daysInMonth(yearNumber, monthIndex)

          for (let day = 1; day <= maxDay; day++) {
            ensureBucket(`${yearNumber}-${pad2(monthIndex + 1)}-${pad2(day)}`)
          }
        }

        // Untuk satu tahun, inisialisasi Januari-Desember.
        if (selectedYear !== 'all' && selectedMonth === 'all') {
          const yearNumber = Number(selectedYear)
          for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
            ensureBucket(`${yearNumber}-${pad2(monthIndex + 1)}-01`)
          }
        }

        ;(attendanceResult.data || []).forEach((item: any) => {
          if (!item.attendance_date) return

          const bucket = ensureBucket(item.attendance_date)
          const lateMinutes = Number(item.late_minutes || 0)
          const outsideRadius =
            Number(item.check_in_distance_m || 0) > 200 ||
            Number(item.check_out_distance_m || 0) > 200

          if (lateMinutes > 0) bucket.Terlambat += 1
          else bucket.TepatWaktu += 1

          if (outsideRadius) bucket.LuarRadius += 1
        })

        ;(logbookResult.data || []).forEach((item: any) => {
          if (!item.log_date) return
          ensureBucket(item.log_date).TotalLogbook += 1
        })

        const finalData = Object.values(aggregation)
          .sort((a: any, b: any) => a.sortKey - b.sortKey)

        setChartData(finalData)

      } catch (err) {

        console.error(err)

      } finally {

        setIsLoading(false)
      }
    }

    init()

  }, [
    router,
    selectedYear,
    selectedMonth
  ])

  // ==============================
  // LOGOUT
  // ==============================

  const handleLogout = async () => {

    setIsLoggingOut(true)

    await supabase.auth.signOut()

    router.replace('/login')
  }

  // ==============================
  // TITLE
  // ==============================

  const getChartTitleSuffix = () => {

    if (selectedYear === 'all') {
      return '(Semua Waktu)'
    }

    if (selectedMonth === 'all') {
      return `(Tahun ${selectedYear})`
    }

    return `(${monthNames[Number(selectedMonth)]} ${selectedYear})`
  }

  // ==============================
  // TOOLTIP
  // ==============================

  const formatTooltipLabel = (
    label: any
  ) => {

    if (selectedYear === 'all') {
      return `Periode: ${label}`
    }

    if (selectedMonth === 'all') {
      return `Bulan: ${label} ${selectedYear}`
    }

    return `Tanggal ${label} ${monthNames[Number(selectedMonth)]} ${selectedYear}`
  }

  // ==============================
  // LOADING
  // ==============================

  if (isLoading || isLoggingOut) {

    return (

      <div className="flex min-h-screen items-center justify-center bg-slate-50">

        <div className="flex flex-col items-center">

          <RefreshCw className="h-8 w-8 animate-spin text-blue-700" />

          <p className="mt-4 text-slate-600 font-semibold">

            {isLoggingOut
              ? 'Menutup Sesi...'
              : 'Memuat Dashboard Admin...'}

          </p>

        </div>

      </div>
    )
  }

  // ==============================
  // UI
  // ==============================

  return (

    <div className="min-h-screen bg-slate-50 font-sans pb-10">

      <Toaster position="top-center" />

      {/* HEADER */}

      <header className="bg-blue-900 text-white p-6 pb-20 shadow-xl rounded-b-3xl">

        <div className="flex justify-between items-start">

          <div className="flex items-center space-x-3">

            <div className="p-2.5 rounded-xl bg-white/10">

              <User
                size={24}
                className="text-white"
              />

            </div>

            <div>

              <h1 className="text-xl font-extrabold">

                {userData.fullName}

              </h1>

              <p className="text-xs text-blue-200">

                {userData.email}

              </p>

            </div>

          </div>

          

        </div>

      </header>

      {/* CONTENT */}

      <main className="px-5 -mt-12 flex flex-col gap-6 max-w-5xl mx-auto">

        {/* TOP */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* CARD */}

          <div className="md:col-span-2 bg-white p-5 rounded-2xl shadow-md border border-slate-200 flex items-center justify-between">

            <div>

              <p className="text-sm font-medium text-slate-500 uppercase">

                Total Pegawai Aktif

              </p>

              <p className="text-3xl font-extrabold text-blue-900 mt-1">

                {totalPegawai}

                <span className="text-base font-normal text-slate-400">

                  {' '}Orang

                </span>

              </p>

            </div>

            <div className="h-14 w-14 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">

              <User size={28} />

            </div>

          </div>

          {/* FILTER */}

          <div className="bg-white p-5 rounded-2xl shadow-md border border-slate-200">

            <div className="flex items-center justify-between mb-3">

              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">

                <CalendarDays
                  size={16}
                  className="text-blue-600"
                />

                Periode Grafik

              </label>

              {(selectedYear !== 'all' ||
                selectedMonth !== 'all') && (

                <button
                  onClick={() => {
                    setSelectedYear('all')
                    setSelectedMonth('all')
                  }}
                  className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded font-bold hover:bg-red-100 flex items-center gap-1"
                >

                  <FilterX size={12} />

                  Reset

                </button>
              )}

            </div>

            <div className="flex gap-2">

              {/* TAHUN */}

              <select
                value={selectedYear}
                onChange={(e) => {

                  setSelectedYear(
                    e.target.value
                  )

                  if (
                    e.target.value === 'all'
                  ) {
                    setSelectedMonth('all')
                  }
                }}
                className="w-1/2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-blue-900"
              >

                <option value="all">
                  Semua Tahun
                </option>

                <option value="2024">
                  2024
                </option>

                <option value="2025">
                  2025
                </option>

                <option value="2026">
                  2026
                </option>

                <option value="2027">
                  2027
                </option>

              </select>

              {/* BULAN */}

              <select
                value={selectedMonth}
                onChange={(e) =>
                  setSelectedMonth(
                    e.target.value
                  )
                }
                disabled={
                  selectedYear === 'all'
                }
                className="w-1/2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-blue-900"
              >

                <option value="all">
                  Semua Bulan
                </option>

                {monthNames.map(
                  (month, index) => (

                    <option
                      key={index}
                      value={index}
                    >

                      {month}

                    </option>
                  )
                )}

              </select>

            </div>

          </div>

        </div>

      {/* CHART 1 */}

<div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 overflow-hidden">

  <div className="flex items-center gap-2 mb-6">

    <TrendingUp
      className="text-blue-600"
      size={24}
    />

    <h2 className="text-lg font-bold text-slate-800">

      Tren Kedisiplinan {getChartTitleSuffix()}

    </h2>

  </div>

  <div className="w-full min-w-0 h-[320px]">

    <ResponsiveContainer
      width="100%"
      height={320}
    >

      <LineChart data={chartData}>

        <CartesianGrid
          strokeDasharray="3 3"
        />

        <XAxis dataKey="name" />

        <YAxis />

        <Tooltip
          labelFormatter={
            formatTooltipLabel
          }
        />

        <Legend />

        <Line
          type="monotone"
          dataKey="TepatWaktu"
          stroke="#3b82f6"
          strokeWidth={3}
          name="Tepat Waktu"
        />

        <Line
          type="monotone"
          dataKey="Terlambat"
          stroke="#f59e0b"
          strokeWidth={3}
          name="Terlambat"
        />

        <Line
          type="monotone"
          dataKey="LuarRadius"
          stroke="#ef4444"
          strokeWidth={3}
          name="Luar Radius"
        />

      </LineChart>

    </ResponsiveContainer>

  </div>

</div>

{/* CHART 2 */}

<div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 overflow-hidden">

  <div className="flex items-center gap-2 mb-6">

    <BookOpenCheck
      className="text-emerald-500"
      size={24}
    />

    <h2 className="text-lg font-bold text-slate-800">

      Kinerja Logbook {getChartTitleSuffix()}

    </h2>

  </div>

  <div className="w-full min-w-0 h-[320px]">

    <ResponsiveContainer
      width="100%"
      height={320}
    >

      <LineChart data={chartData}>

        <CartesianGrid
          strokeDasharray="3 3"
        />

        <XAxis dataKey="name" />

        <YAxis />

        <Tooltip
          labelFormatter={
            formatTooltipLabel
          }
        />

        <Legend />

        <Line
          type="monotone"
          dataKey="TotalLogbook"
          stroke="#10b981"
          strokeWidth={3}
          name="Total Logbook"
        />

      </LineChart>

    </ResponsiveContainer>

  </div>

</div>

        {/* FOOTER */}

        <div className="text-center pb-6 mt-4">

          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">

            <AlertTriangle size={12} />

            Aplikasi Smart PPNPN KPPN Tebing Tinggi

          </p>

        </div>

      </main>

    </div>
  )
}