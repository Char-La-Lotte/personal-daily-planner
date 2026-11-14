export const pad = (n) => String(n).padStart(2, '0')
export const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayStr = () => fmt(new Date())

export const PRIORITIES = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' }
export const STATUSES = {
  pending: 'Chưa thực hiện',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}
export const CATEGORIES = {
  work: 'Công việc',
  learning: 'Học tập',
  personal: 'Cá nhân',
  health: 'Sức khỏe',
}
export const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export const DEFAULT_WORK_CONFIG = {
  workDays: ['T2', 'T3', 'T4', 'T5', 'T6'],
  startTime: '08:30',
  endTime: '17:30',
  breakHours: 1,
  gracePeriodMinutes: 15,
  targetWorkHours: 8,
}

export const ATTENDANCE_STATUSES = {
  on_time: 'Đúng giờ',
  late: 'Đi muộn',
  early_leave: 'Về sớm',
  late_and_early: 'Muộn & Về sớm',
  paid_leave: 'Nghỉ phép (Đủ công)',
  half_leave: 'Nghỉ nửa ngày',
  unpaid_leave: 'Nghỉ không lương',
}

export function getWeekdayCode(dateOrStr) {
  const d = typeof dateOrStr === 'string' ? new Date(`${dateOrStr}T00:00:00`) : dateOrStr
  const day = d.getDay()
  return day === 0 ? 'CN' : `T${day + 1}`
}

export function timeToMinutes(t) {
  if (!t || !t.includes(':')) return null
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

export function nowTimeStr() {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function evaluateAttendance({ checkInTime, checkOutTime, leaveType = 'none' }, config = DEFAULT_WORK_CONFIG) {
  const cfg = { ...DEFAULT_WORK_CONFIG, ...config }

  if (leaveType === 'paid_leave') {
    return {
      status: 'paid_leave',
      actualHours: cfg.targetWorkHours,
      workUnits: 1,
      lateMinutes: 0,
      earlyMinutes: 0,
      overtimeHours: 0,
    }
  }
  if (leaveType === 'half_leave') {
    return {
      status: 'half_leave',
      actualHours: Number((cfg.targetWorkHours / 2).toFixed(1)),
      workUnits: 0.5,
      lateMinutes: 0,
      earlyMinutes: 0,
      overtimeHours: 0,
    }
  }
  if (leaveType === 'unpaid_leave') {
    return {
      status: 'unpaid_leave',
      actualHours: 0,
      workUnits: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      overtimeHours: 0,
    }
  }

  const inMin = timeToMinutes(checkInTime)
  const outMin = timeToMinutes(checkOutTime)
  const startMin = timeToMinutes(cfg.startTime) ?? 510
  const endMin = timeToMinutes(cfg.endTime) ?? 1050
  const grace = Number(cfg.gracePeriodMinutes) || 0
  const breakH = Number(cfg.breakHours) || 0
  const targetH = Number(cfg.targetWorkHours) || 8

  let lateMinutes = 0
  if (inMin !== null && inMin > startMin + grace) {
    lateMinutes = inMin - startMin
  }

  let earlyMinutes = 0
  if (outMin !== null && outMin < endMin) {
    earlyMinutes = endMin - outMin
  }

  let actualHours = 0
  let workUnits = 0
  let overtimeHours = 0

  if (inMin !== null && outMin !== null && outMin > inMin) {
    const rawHours = (outMin - inMin) / 60
    // Trừ giờ nghỉ trưa nếu làm việc từ 5 tiếng trở lên
    const deducted = rawHours >= 5 ? Math.max(0, rawHours - breakH) : rawHours
    actualHours = Number(deducted.toFixed(2))

    if (actualHours >= targetH - 0.25) {
      workUnits = 1
    } else if (actualHours >= targetH / 2 - 0.25) {
      workUnits = 0.5
    } else {
      workUnits = 0
    }

    if (actualHours > targetH + 0.25) {
      overtimeHours = Number((actualHours - targetH).toFixed(2))
    }
  }

  let status = 'on_time'
  if (lateMinutes > 0 && earlyMinutes > 0) status = 'late_and_early'
  else if (lateMinutes > 0) status = 'late'
  else if (earlyMinutes > 0) status = 'early_leave'

  return {
    status,
    actualHours,
    workUnits,
    lateMinutes,
    earlyMinutes,
    overtimeHours,
  }
}

export function countStandardWorkDaysInMonth(year, month, workDays = DEFAULT_WORK_CONFIG.workDays) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const code = getWeekdayCode(new Date(year, month, d))
    if (workDays.includes(code)) count++
  }
  return count
}

// Lưới tháng 6 tuần, bắt đầu từ thứ Hai
export function monthGrid(year, month) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i))
}

export function weekDays(date) {
  const offset = (date.getDay() + 6) % 7
  return Array.from({ length: 7 }, (_, i) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset + i)
  )
}

export const byTime = (a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99')
