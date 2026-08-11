export const OFFICE_LOCATION = {
  latitude: 3.3271875,
  longitude: 99.167671875,
  radius_m: 200,
  name: 'KPPN Tebing Tinggi',
  address: 'Jl. Sutomo No. 2, Tebing Tinggi',
} as const;

export const WIB_TIME_ZONE = 'Asia/Jakarta';

export type AttendanceShift = 'pagi' | 'malam';

export const getWIBDateString = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: WIB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
};

export const addDaysToDateString = (dateString: string, days: number) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const makeWIBDateTime = (dateString: string, timeString: string) =>
  new Date(`${dateString}T${timeString}+07:00`);

export const getWIBMinutesOfDay = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: WIB_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);

  return hour * 60 + minute;
};

/**
 * Untuk piket malam yang melakukan check-in setelah tengah malam namun
 * sebelum 07.15 WIB, tanggal presensinya tetap mengacu ke hari piket
 * sebelumnya. Ini mencegah shift malam terpecah menjadi dua tanggal.
 */
export const getAttendanceDateForShift = (
  shift: AttendanceShift,
  date = new Date()
) => {
  const wibDate = getWIBDateString(date);

  if (shift === 'malam' && getWIBMinutesOfDay(date) < 7 * 60 + 15) {
    return addDaysToDateString(wibDate, -1);
  }

  return wibDate;
};

export const getScheduledStart = (
  attendanceDate: string,
  shift: AttendanceShift
) =>
  shift === 'pagi'
    ? makeWIBDateTime(attendanceDate, '07:15:00')
    : makeWIBDateTime(attendanceDate, '17:30:00');

export const getScheduledEnd = (
  attendanceDate: string,
  shift: AttendanceShift
) =>
  shift === 'pagi'
    ? makeWIBDateTime(attendanceDate, '17:30:00')
    : makeWIBDateTime(addDaysToDateString(attendanceDate, 1), '07:15:00');

export const calculateLateMinutes = (
  actualCheckIn: Date,
  attendanceDate: string,
  shift: AttendanceShift
) =>
  Math.max(
    0,
    Math.ceil(
      (actualCheckIn.getTime() -
        getScheduledStart(attendanceDate, shift).getTime()) /
        60000
    )
  );

export const calculateEarlyLeaveMinutes = (
  actualCheckOut: Date,
  attendanceDate: string,
  shift: AttendanceShift
) =>
  Math.max(
    0,
    Math.ceil(
      (getScheduledEnd(attendanceDate, shift).getTime() -
        actualCheckOut.getTime()) /
        60000
    )
  );

export const calculateDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const earthRadius = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
};

export const isWithinOfficeRadius = (distance: number | null) =>
  distance !== null && distance <= OFFICE_LOCATION.radius_m;
