import { useEffect, useState } from 'react'
import {
  AlertCircle, Briefcase, CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, Download, FileSpreadsheet, LogIn, LogOut, RotateCcw, Settings as SettingsIcon,
  Sparkles, Timer, Trash2,
} from 'lucide-react'
import {
  KpiBarsGraphic, KpiHourglassGraphic, KpiWaveGraphic,
} from '../components/Icons'
import {
  ATTENDANCE_STATUSES, WEEKDAYS, countStandardWorkDaysInMonth,
  evaluateAttendance, fmt, getWeekdayCode, monthGrid, nowTimeStr, pad, todayStr,
} from '../utils'

const DAY_NAMES_FULL = {
  T2: 'Thứ Hai',
  T3: 'Thứ Ba',
  T4: 'Thứ Tư',
  T5: 'Thứ Năm',
  T6: 'Thứ Sáu',
  T7: 'Thứ Bảy',
  CN: 'Chủ Nhật',
}

export default function Attendance({ attendance, onNavigate }) {
  const { workConfig, records, upsertRecord, removeRecord } = attendance
  const today = todayStr()

  const [now, setNow] = useState(() => new Date())
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState(today)
  const [filterMode, setFilterMode] = useState('all')
  const [saveToast, setSaveToast] = useState('')

  // Đồng hồ thời gian thực
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const selectedRecord = records[selected] || null

  // State form chỉnh sửa ngày đang chọn
  const [form, setForm] = useState({
    checkInTime: '',
    checkOutTime: '',
    leaveType: 'none',
    note: '',
  })

  useEffect(() => {
    const rec = records[selected]
    setForm({
      checkInTime: rec?.checkInTime || '',
      checkOutTime: rec?.checkOutTime || '',
      leaveType: rec?.leaveType || 'none',
      note: rec?.note || '',
    })
    setSaveToast('')
  }, [selected, records])

  const todayRecord = records[today] || null
  const todayWeekCode = getWeekdayCode(today)
  const isTodayWorkDay = workConfig.workDays.includes(todayWeekCode)

  const clockStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  const currentHM = `${pad(now.getHours())}:${pad(now.getMinutes())}`

  // Thao tác Check-in / Check-out 1 chạm cho hôm nay
  const handleQuickCheckIn = async () => {
    const time = nowTimeStr()
    await upsertRecord(today, {
      checkInTime: time,
      leaveType: 'none',
    })
    setSelected(today)
  }

  const handleQuickCheckOut = async () => {
    const time = nowTimeStr()
    await upsertRecord(today, {
      checkInTime: todayRecord?.checkInTime || workConfig.startTime,
      checkOutTime: time,
      leaveType: 'none',
    })
    setSelected(today)
  }

  // Tính toán thống kê cho tháng đang xem
  const viewYear = cursor.getFullYear()
  const viewMonth = cursor.getMonth()
  const monthPrefix = `${viewYear}-${pad(viewMonth + 1)}-`
  const standardMonthDays = countStandardWorkDaysInMonth(viewYear, viewMonth, workConfig.workDays)

  const monthRecords = Object.values(records)
    .filter((r) => r.date && r.date.startsWith(monthPrefix))
    .sort((a, b) => b.date.localeCompare(a.date))

  const totalWorkUnits = Number(
    monthRecords.reduce((sum, r) => sum + (Number(r.workUnits) || 0), 0).toFixed(2)
  )
  const totalActualHours = Number(
    monthRecords.reduce((sum, r) => sum + (Number(r.actualHours) || 0), 0).toFixed(1)
  )
  const totalOvertimeHours = Number(
    monthRecords.reduce((sum, r) => sum + (Number(r.overtimeHours) || 0), 0).toFixed(1)
  )
  const onTimeCount = monthRecords.filter((r) => r.status === 'on_time').length
  const lateOrEarlyCount = monthRecords.filter((r) =>
    ['late', 'early_leave', 'late_and_early'].includes(r.status)
  ).length
  const leaveCount = monthRecords.filter((r) =>
    ['paid_leave', 'half_leave', 'unpaid_leave'].includes(r.status)
  ).length

  const days = monthGrid(viewYear, viewMonth)
  const stepMonth = (dir) => {
    const d = new Date(cursor)
    d.setMonth(d.getMonth() + dir)
    setCursor(d)
  }

  // Xem trước kết quả tính công trực tiếp khi đang nhập form
  const previewEval = evaluateAttendance(form, workConfig)

  const handleSaveManual = async (e) => {
    e.preventDefault()
    await upsertRecord(selected, {
      checkInTime: form.leaveType === 'none' ? form.checkInTime : '',
      checkOutTime: form.leaveType === 'none' ? form.checkOutTime : '',
      leaveType: form.leaveType,
      note: form.note.trim(),
    })
    setSaveToast('Đã lưu dữ liệu chấm công!')
    setTimeout(() => setSaveToast(''), 2500)
  }

  const handleFillStandardTime = () => {
    setForm((prev) => ({
      ...prev,
      leaveType: 'none',
      checkInTime: workConfig.startTime,
      checkOutTime: workConfig.endTime,
    }))
  }

  const handleDeleteRecord = async () => {
    if (!selectedRecord) return
    if (!window.confirm(`Xóa dữ liệu chấm công ngày ${selected.split('-').reverse().join('/')}?`)) return
    await removeRecord(selected)
    setSaveToast('Đã xóa bản ghi chấm công.')
    setTimeout(() => setSaveToast(''), 2500)
  }

  const exportAttendanceCsv = () => {
    const headers = ['Ngày', 'Thứ', 'Giờ vào', 'Giờ ra', 'Giờ làm thực tế', 'Số công', 'Trạng thái', 'Đi muộn (phút)', 'Về sớm (phút)', 'Ghi chú']
    const rows = [...monthRecords]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => {
        const wCode = getWeekdayCode(r.date)
        return [
          r.date.split('-').reverse().join('/'),
          DAY_NAMES_FULL[wCode] || wCode,
          r.checkInTime || '--:--',
          r.checkOutTime || '--:--',
          r.actualHours ?? 0,
          r.workUnits ?? 0,
          ATTENDANCE_STATUSES[r.status] || r.status,
          r.lateMinutes || 0,
          r.earlyMinutes || 0,
          `"${(r.note || '').replace(/"/g, '""')}"`,
        ].join(',')
      })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bang-cham-cong-${viewYear}-${pad(viewMonth + 1)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredMonthRecords = monthRecords.filter((r) => {
    if (filterMode === 'late') return ['late', 'early_leave', 'late_and_early'].includes(r.status)
    if (filterMode === 'leave') return ['paid_leave', 'half_leave', 'unpaid_leave'].includes(r.status)
    return true
  })

  const selectedWeekCode = getWeekdayCode(selected)
  const isSelectedWorkDay = workConfig.workDays.includes(selectedWeekCode)

  return (
    <div className="page">
      <header className="page-head fade-up">
        <div>
          <h1>Kiểm tra công & Chấm công</h1>
          <p className="page-subtitle">
            Ca làm việc cấu hình: <strong>{workConfig.startTime} – {workConfig.endTime}</strong>
            {' • '}Nghỉ giữa ca: <strong>{workConfig.breakHours}h</strong>
            {' • '}Ngày làm: <strong>{workConfig.workDays.join(', ')}</strong>
          </p>
        </div>
        <div className="toolbar">
          <button
            type="button"
            className="btn"
            onClick={() => onNavigate && onNavigate('settings')}
          >
            <SettingsIcon size={16} />
            <span>Cấu hình ca làm</span>
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={exportAttendanceCsv}
            disabled={monthRecords.length === 0}
          >
            <Download size={16} />
            <span>Xuất bảng công (.csv)</span>
          </button>
        </div>
      </header>

      {/* PANEL CHẤM CÔNG HÔM NAY */}
      <section className="card attendance-hero fade-up delay-1">
        <div className="att-hero-left">
          <div className="att-live-clock-wrap">
            <span className="att-live-dot" />
            <span className="att-live-label">
              {DAY_NAMES_FULL[todayWeekCode]}, {today.split('-').reverse().join('/')}
            </span>
            <span className={`att-day-type-pill ${isTodayWorkDay ? 'work' : 'off'}`}>
              {isTodayWorkDay ? 'Ngày làm việc' : 'Ngày nghỉ cấu hình'}
            </span>
          </div>
          <div className="att-digital-clock">{clockStr}</div>
          <p className="att-hero-desc">
            {!todayRecord?.checkInTime && todayRecord?.leaveType === 'none' &&
              `Bấm "Vào ca" để ghi nhận giờ bắt đầu làm việc hôm nay (Chuẩn: ${workConfig.startTime}).`}
            {todayRecord?.checkInTime && !todayRecord?.checkOutTime &&
              `Bạn đã vào ca lúc ${todayRecord.checkInTime}. Đừng quên bấm "Tan ca" khi kết thúc ngày làm việc!`}
            {todayRecord?.checkInTime && todayRecord?.checkOutTime &&
              `Hoàn tất chấm công hôm nay: ${todayRecord.checkInTime} – ${todayRecord.checkOutTime} (${todayRecord.actualHours}h • ${todayRecord.workUnits} công).`}
            {todayRecord && todayRecord.leaveType && todayRecord.leaveType !== 'none' &&
              `Hôm nay bạn đã đăng ký: ${ATTENDANCE_STATUSES[todayRecord.status] || 'Nghỉ phép'} (${todayRecord.workUnits} công).`}
            {!todayRecord &&
              `Bấm "Vào ca" để ghi nhận giờ bắt đầu làm việc hôm nay (Chuẩn: ${workConfig.startTime}).`}
          </p>
        </div>

        <div className="att-hero-right">
          <div className="att-today-steps">
            <div className={`att-step-box ${todayRecord?.checkInTime ? 'done' : ''}`}>
              <small>Giờ vào (Check-in)</small>
              <strong>{todayRecord?.checkInTime || '--:--'}</strong>
              {todayRecord?.lateMinutes > 0 ? (
                <span className="att-mini-tag warn">Muộn {todayRecord.lateMinutes}p</span>
              ) : todayRecord?.checkInTime ? (
                <span className="att-mini-tag ok">Đúng giờ</span>
              ) : (
                <span className="att-mini-tag muted">Chưa chấm</span>
              )}
            </div>

            <div className={`att-step-box ${todayRecord?.checkOutTime ? 'done' : ''}`}>
              <small>Giờ ra (Check-out)</small>
              <strong>{todayRecord?.checkOutTime || '--:--'}</strong>
              {todayRecord?.earlyMinutes > 0 ? (
                <span className="att-mini-tag warn">Sớm {todayRecord.earlyMinutes}p</span>
              ) : todayRecord?.checkOutTime ? (
                <span className="att-mini-tag ok">{todayRecord.actualHours} giờ</span>
              ) : (
                <span className="att-mini-tag muted">Chưa chấm</span>
              )}
            </div>

            <div className={`att-step-box highlight ${todayRecord?.workUnits >= 1 ? 'full' : ''}`}>
              <small>Công hôm nay</small>
              <strong>{todayRecord?.workUnits ?? 0} công</strong>
              <span className="att-mini-tag ok">
                {todayRecord ? (ATTENDANCE_STATUSES[todayRecord.status] || 'Đã ghi nhận') : 'Chờ chấm'}
              </span>
            </div>
          </div>

          <div className="att-quick-actions">
            {!todayRecord?.checkInTime ? (
              <button
                type="button"
                className="btn att-checkin-btn"
                onClick={handleQuickCheckIn}
              >
                <LogIn size={19} />
                <span>Chấm công Vào ca ({currentHM})</span>
              </button>
            ) : !todayRecord?.checkOutTime ? (
              <button
                type="button"
                className="btn att-checkout-btn"
                onClick={handleQuickCheckOut}
              >
                <LogOut size={19} />
                <span>Chấm công Tan ca ({currentHM})</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn att-update-checkout-btn"
                onClick={handleQuickCheckOut}
                title="Cập nhật lại giờ tan ca theo thời điểm hiện tại"
              >
                <RotateCcw size={17} />
                <span>Cập nhật giờ ra ({currentHM})</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3 THẺ KPI THỐNG KÊ CÔNG TRONG THÁNG */}
      <div className="kpi-row fade-up delay-1">
        <div className="kpi-box blue">
          <div className="kpi-icon blue">
            <Briefcase size={24} strokeWidth={2.4} />
          </div>
          <div className="kpi-info">
            <strong>{totalWorkUnits} <small style={{ fontSize: '0.95rem', fontWeight: 600, opacity: 0.75 }}>/ {standardMonthDays}</small></strong>
            <span>Tổng ngày công tháng {viewMonth + 1}</span>
          </div>
          <KpiWaveGraphic />
        </div>

        <div className="kpi-box green">
          <div className="kpi-icon green">
            <Timer size={24} strokeWidth={2.4} />
          </div>
          <div className="kpi-info">
            <strong>{totalActualHours}h</strong>
            <span>Tổng giờ làm {totalOvertimeHours > 0 ? `(+${totalOvertimeHours}h OT)` : 'thực tế'}</span>
          </div>
          <KpiBarsGraphic />
        </div>

        <div className="kpi-box orange">
          <div className="kpi-icon orange">
            <CalendarCheck size={24} strokeWidth={2.4} />
          </div>
          <div className="kpi-info">
            <strong>{onTimeCount} ngày</strong>
            <span>Đúng giờ • {lateOrEarlyCount} muộn/sớm • {leaveCount} phép</span>
          </div>
          <KpiHourglassGraphic />
        </div>
      </div>

      {/* LỊCH CHẤM CÔNG THÁNG & FORM KIỂM TRA / ĐIỀU CHỈNH CÔNG */}
      <div className="grid-cal fade-up delay-2">
        <section className="card">
          <div className="card-head" style={{ marginBottom: 14 }}>
            <h2>Bảng lịch công tháng {viewMonth + 1}/{viewYear}</h2>
            <div className="toolbar">
              <button type="button" className="btn icon-only" onClick={() => stepMonth(-1)} aria-label="Tháng trước">
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setCursor(new Date())
                  setSelected(today)
                }}
              >
                Hôm nay
              </button>
              <button type="button" className="btn icon-only" onClick={() => stepMonth(1)} aria-label="Tháng sau">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="att-legend">
            <span><i className="leg-dot full" /> Đủ công (1.0)</span>
            <span><i className="leg-dot warn" /> Muộn/Sớm / 0.5c</span>
            <span><i className="leg-dot leave" /> Nghỉ phép</span>
            <span><i className="leg-dot absent" /> Chưa chấm</span>
          </div>

          <div className="cal month att-cal">
            {WEEKDAYS.map((w) => (
              <div key={w} className="cal-h">{w}</div>
            ))}
            {days.map((d) => {
              const key = fmt(d)
              const isCurrentMonth = d.getMonth() === viewMonth
              const rec = records[key]
              const wCode = getWeekdayCode(d)
              const isScheduledWorkDay = workConfig.workDays.includes(wCode)
              const isPastWorkDay = key < today && isScheduledWorkDay

              let statusClass = ''
              let badgeText = ''

              if (rec) {
                if (['paid_leave', 'half_leave', 'unpaid_leave'].includes(rec.status)) {
                  statusClass = 'att-leave'
                  badgeText = rec.workUnits > 0 ? `Phép (${rec.workUnits}c)` : 'Nghỉ KL'
                } else if (rec.workUnits >= 1 && rec.status === 'on_time') {
                  statusClass = 'att-full'
                  badgeText = '1.0 công'
                } else if (rec.workUnits > 0 || rec.checkInTime) {
                  statusClass = 'att-warn'
                  badgeText = rec.checkOutTime ? `${rec.workUnits} công` : `Vào ${rec.checkInTime}`
                }
              } else if (isPastWorkDay && isCurrentMonth) {
                statusClass = 'att-absent'
                badgeText = 'Vắng'
              } else if (!isScheduledWorkDay) {
                statusClass = 'att-off'
              }

              return (
                <button
                  key={key}
                  type="button"
                  className={`cal-d att-cal-cell ${!isCurrentMonth ? 'out' : ''} ${key === today ? 'today' : ''} ${key === selected ? 'sel' : ''} ${statusClass}`}
                  onClick={() => setSelected(key)}
                >
                  <span className="att-cell-day">{d.getDate()}</span>
                  {badgeText && <small className="att-cell-badge">{badgeText}</small>}
                </button>
              )
            })}
          </div>
        </section>

        {/* FORM KIỂM TRA & CHỈNH SỬA NGÀY ĐANG CHỌN */}
        <section className="card">
          <div className="card-head" style={{ marginBottom: 12 }}>
            <div>
              <h2>Chi tiết ngày {selected.split('-').reverse().join('/')}</h2>
              <small style={{ color: 'var(--muted)', fontWeight: 500 }}>
                {DAY_NAMES_FULL[selectedWeekCode]} • {isSelectedWorkDay ? 'Ngày làm việc theo cấu hình' : 'Ngày nghỉ cuối tuần'}
              </small>
            </div>
            <button
              type="button"
              className="btn"
              onClick={handleFillStandardTime}
              title="Điền nhanh giờ vào/ra chuẩn theo cấu hình"
            >
              <Sparkles size={15} />
              <span>Giờ chuẩn</span>
            </button>
          </div>

          {/* Tóm tắt kết quả tính công */}
          <div className="att-eval-summary">
            <div className="att-eval-item">
              <span>Số công tính được</span>
              <strong className={previewEval.workUnits >= 1 ? 'text-ok' : previewEval.workUnits > 0 ? 'text-warn' : ''}>
                {previewEval.workUnits} công
              </strong>
            </div>
            <div className="att-eval-item">
              <span>Giờ làm thực tế</span>
              <strong>{previewEval.actualHours} giờ</strong>
            </div>
            <div className="att-eval-item">
              <span>Trạng thái</span>
              <strong>{ATTENDANCE_STATUSES[previewEval.status] || 'Chưa chấm'}</strong>
            </div>
            {(previewEval.lateMinutes > 0 || previewEval.earlyMinutes > 0) && (
              <div className="att-eval-alert">
                <AlertCircle size={15} />
                <span>
                  {previewEval.lateMinutes > 0 && `Đi muộn ${previewEval.lateMinutes} phút. `}
                  {previewEval.earlyMinutes > 0 && `Về sớm ${previewEval.earlyMinutes} phút.`}
                </span>
              </div>
            )}
          </div>

          <form className="att-edit-form" onSubmit={handleSaveManual}>
            <label className="att-field">
              <span>Hình thức chấm công</span>
              <select
                value={form.leaveType}
                onChange={(e) => setForm((prev) => ({ ...prev, leaveType: e.target.value }))}
              >
                <option value="none">Đi làm bình thường (Tính theo giờ vào/ra)</option>
                <option value="paid_leave">Nghỉ phép có lương (Tính đủ 1.0 công)</option>
                <option value="half_leave">Nghỉ phép nửa ngày (Tính 0.5 công)</option>
                <option value="unpaid_leave">Nghỉ không lương (0 công)</option>
              </select>
            </label>

            {form.leaveType === 'none' && (
              <div className="att-time-grid">
                <label className="att-field">
                  <span>Giờ vào (Check-in)</span>
                  <input
                    type="time"
                    value={form.checkInTime}
                    onChange={(e) => setForm((prev) => ({ ...prev, checkInTime: e.target.value }))}
                  />
                </label>
                <label className="att-field">
                  <span>Giờ ra (Check-out)</span>
                  <input
                    type="time"
                    value={form.checkOutTime}
                    onChange={(e) => setForm((prev) => ({ ...prev, checkOutTime: e.target.value }))}
                  />
                </label>
              </div>
            )}

            <label className="att-field">
              <span>Ghi chú / Giải trình công việc</span>
              <textarea
                rows={2}
                placeholder="VD: Đi gặp khách hàng buổi sáng, tăng ca dự án..."
                value={form.note}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              />
            </label>

            <div className="att-form-actions">
              <button type="submit" className="btn primary" style={{ flex: 1 }}>
                <CheckCircle2 size={16} />
                <span>Lưu chấm công ngày này</span>
              </button>
              {selectedRecord && (
                <button
                  type="button"
                  className="btn icon-only danger-btn"
                  onClick={handleDeleteRecord}
                  title="Xóa dữ liệu chấm công ngày này"
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>

            {saveToast && <p className="att-save-toast">{saveToast}</p>}
          </form>
        </section>
      </div>

      {/* BẢNG CHI TIẾT LỊCH SỬ CHẤM CÔNG TRONG THÁNG */}
      <section className="card fade-up delay-2" style={{ marginTop: 18 }}>
        <div className="card-head" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileSpreadsheet size={20} style={{ color: 'var(--accent)' }} />
            <h2>Bảng kê chi tiết công tháng {viewMonth + 1}/{viewYear} ({filteredMonthRecords.length} bản ghi)</h2>
          </div>

          <div className="segmented">
            <button
              type="button"
              className={filterMode === 'all' ? 'on' : ''}
              onClick={() => setFilterMode('all')}
            >
              Tất cả ({monthRecords.length})
            </button>
            <button
              type="button"
              className={filterMode === 'late' ? 'on' : ''}
              onClick={() => setFilterMode('late')}
            >
              Đi muộn / Về sớm ({lateOrEarlyCount})
            </button>
            <button
              type="button"
              className={filterMode === 'leave' ? 'on' : ''}
              onClick={() => setFilterMode('leave')}
            >
              Nghỉ phép ({leaveCount})
            </button>
          </div>
        </div>

        {filteredMonthRecords.length === 0 ? (
          <p className="empty">Chưa có bản ghi chấm công nào trong mục này.</p>
        ) : (
          <div className="att-table-wrap">
            <table className="att-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Thứ</th>
                  <th>Giờ vào</th>
                  <th>Giờ ra</th>
                  <th>Thực tế</th>
                  <th>Số công</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {filteredMonthRecords.map((r) => {
                  const wCode = getWeekdayCode(r.date)
                  return (
                    <tr
                      key={r.date}
                      className={r.date === selected ? 'active-row' : ''}
                      onClick={() => setSelected(r.date)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><strong>{r.date.split('-').reverse().join('/')}</strong></td>
                      <td>{DAY_NAMES_FULL[wCode]}</td>
                      <td>{r.checkInTime || '--:--'}</td>
                      <td>{r.checkOutTime || '--:--'}</td>
                      <td>{r.actualHours ?? 0}h</td>
                      <td>
                        <span className={`att-unit-pill ${r.workUnits >= 1 ? 'full' : r.workUnits > 0 ? 'half' : 'zero'}`}>
                          {r.workUnits ?? 0} công
                        </span>
                      </td>
                      <td>
                        <span className={`att-status-badge ${r.status}`}>
                          {ATTENDANCE_STATUSES[r.status] || r.status}
                          {r.lateMinutes > 0 ? ` (${r.lateMinutes}p)` : ''}
                        </span>
                      </td>
                      <td className="att-note-cell">{r.note || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
