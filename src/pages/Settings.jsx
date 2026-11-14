import { useEffect, useState } from 'react'
import { signOut } from 'firebase/auth'
import {
  Briefcase, CheckCircle2, Download, Moon, RotateCcw, Sparkles, Sun, Trash2,
} from 'lucide-react'
import { auth } from '../firebase'
import { GoogleLogoIcon } from '../components/Icons'
import { DEFAULT_WORK_CONFIG, WEEKDAYS } from '../utils'

export default function Settings({
  user,
  theme,
  setTheme,
  tasks = [],
  onRemove,
  attendance,
}) {
  const [msg, setMsg] = useState('')
  const [cfgMsg, setCfgMsg] = useState('')

  const workConfig = attendance?.workConfig || DEFAULT_WORK_CONFIG
  const updateWorkConfig = attendance?.updateWorkConfig

  const [cfgForm, setCfgForm] = useState(workConfig)

  useEffect(() => {
    setCfgForm(workConfig)
  }, [workConfig])

  const toggleWorkDay = (dayCode) => {
    setCfgForm((prev) => {
      const exists = prev.workDays.includes(dayCode)
      const nextDays = exists
        ? prev.workDays.filter((d) => d !== dayCode)
        : WEEKDAYS.filter((d) => prev.workDays.includes(d) || d === dayCode)
      return { ...prev, workDays: nextDays }
    })
    setCfgMsg('')
  }

  const handleSaveWorkConfig = async (e) => {
    e.preventDefault()
    if (!updateWorkConfig) return
    if (cfgForm.workDays.length === 0) {
      setCfgMsg('Vui lòng chọn ít nhất 1 ngày làm việc trong tuần.')
      return
    }
    await updateWorkConfig({
      workDays: cfgForm.workDays,
      startTime: cfgForm.startTime || '08:30',
      endTime: cfgForm.endTime || '17:30',
      breakHours: Math.max(0, Number(cfgForm.breakHours) || 0),
      targetWorkHours: Math.max(1, Number(cfgForm.targetWorkHours) || 8),
      gracePeriodMinutes: Math.max(0, Number(cfgForm.gracePeriodMinutes) || 0),
    })
    setCfgMsg('Đã lưu cấu hình ngày và ca làm việc thành công!')
    setTimeout(() => setCfgMsg(''), 3000)
  }

  const handleResetWorkConfig = async () => {
    if (!updateWorkConfig) return
    setCfgForm(DEFAULT_WORK_CONFIG)
    await updateWorkConfig(DEFAULT_WORK_CONFIG)
    setCfgMsg('Đã khôi phục cấu hình ca làm việc mặc định.')
    setTimeout(() => setCfgMsg(''), 3000)
  }

  const completedTasks = tasks.filter((t) => t.status === 'completed' || t.status === 'cancelled')

  // Tìm các công việc bị trùng (cùng ngày + cùng tiêu đề + cùng giờ bắt đầu)
  const duplicateIds = []
  const seen = new Set()
  for (const t of tasks) {
    const key = `${t.date}|${(t.title || '').trim().toLowerCase()}|${t.startTime || ''}`
    if (seen.has(key)) duplicateIds.push(t.id)
    else seen.add(key)
  }

  const exportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      tasks,
      workConfig: attendance?.workConfig || DEFAULT_WORK_CONFIG,
      attendance: attendance?.records || {},
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `daily-planner-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg('Đã tải xuống file sao lưu toàn bộ dữ liệu (.json).')
  }

  const cleanDuplicates = async () => {
    if (!duplicateIds.length || !onRemove) return
    for (const id of duplicateIds) {
      await onRemove(id)
    }
    setMsg(`Đã dọn dẹp ${duplicateIds.length} công việc bị trùng lặp.`)
  }

  const clearCompleted = async () => {
    if (!completedTasks.length || !onRemove) return
    if (!window.confirm(`Xóa ${completedTasks.length} công việc đã hoàn thành / đã hủy?`)) return
    for (const t of completedTasks) {
      await onRemove(t.id)
    }
    setMsg(`Đã xóa ${completedTasks.length} công việc đã hoàn thành / đã hủy.`)
  }

  return (
    <div className="page narrow">
      <header className="page-head fade-up"><h1>Cài đặt hệ thống</h1></header>

      <section className="card fade-up delay-1">
        <h2 style={{ marginBottom: 14 }}>Tài khoản Google</h2>
        <div className="account big">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="avatar-fallback">{(user.displayName || user.email || 'U')[0].toUpperCase()}</div>
          )}
          <div>
            <strong>{user.displayName || 'Người dùng'}</strong>
            <small>{user.email}</small>
          </div>
        </div>
        <button type="button" className="btn" onClick={() => signOut(auth)}>
          <GoogleLogoIcon size={16} />
          <span>Đăng xuất tài khoản</span>
        </button>
      </section>

      {/* CẤU HÌNH NGÀY LÀM VIỆC & CHẤM CÔNG */}
      <section className="card fade-up delay-1">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Briefcase size={19} style={{ color: 'var(--accent)' }} />
            <h2 style={{ margin: 0 }}>Cấu hình ngày làm việc & Chấm công</h2>
          </div>
          <span className="workconfig-summary-pill">
            {cfgForm.workDays.length} ngày/tuần • {cfgForm.targetWorkHours}h/công
          </span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: '0 0 16px' }}>
          Thiết lập lịch làm việc tiêu chuẩn để hệ thống tự động tính ngày công, giờ làm thực tế và kiểm tra đi muộn / về sớm cho tài khoản của bạn.
        </p>

        <form className="work-config-form" onSubmit={handleSaveWorkConfig}>
          <div className="att-field">
            <span>Các ngày làm việc trong tuần</span>
            <div className="workdays-selector">
              {WEEKDAYS.map((day) => {
                const active = cfgForm.workDays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    className={`workday-chip ${active ? 'active' : ''}`}
                    onClick={() => toggleWorkDay(day)}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="workconfig-grid">
            <label className="att-field">
              <span>Giờ vào ca chuẩn</span>
              <input
                type="time"
                value={cfgForm.startTime}
                onChange={(e) => setCfgForm((p) => ({ ...p, startTime: e.target.value }))}
              />
            </label>

            <label className="att-field">
              <span>Giờ tan ca chuẩn</span>
              <input
                type="time"
                value={cfgForm.endTime}
                onChange={(e) => setCfgForm((p) => ({ ...p, endTime: e.target.value }))}
              />
            </label>

            <label className="att-field">
              <span>Nghỉ giữa ca (giờ)</span>
              <input
                type="number"
                step="0.5"
                min="0"
                max="4"
                value={cfgForm.breakHours}
                onChange={(e) => setCfgForm((p) => ({ ...p, breakHours: e.target.value }))}
              />
            </label>

            <label className="att-field">
              <span>Số giờ tính 1.0 công</span>
              <input
                type="number"
                step="0.5"
                min="1"
                max="16"
                value={cfgForm.targetWorkHours}
                onChange={(e) => setCfgForm((p) => ({ ...p, targetWorkHours: e.target.value }))}
              />
            </label>

            <label className="att-field">
              <span>Cho phép trễ (phút)</span>
              <input
                type="number"
                step="5"
                min="0"
                max="120"
                value={cfgForm.gracePeriodMinutes}
                onChange={(e) => setCfgForm((p) => ({ ...p, gracePeriodMinutes: e.target.value }))}
              />
            </label>
          </div>

          <div className="toolbar" style={{ marginTop: 14 }}>
            <button type="submit" className="btn primary">
              <CheckCircle2 size={16} />
              <span>Lưu cấu hình chấm công</span>
            </button>
            <button type="button" className="btn" onClick={handleResetWorkConfig}>
              <RotateCcw size={15} />
              <span>Khôi phục mặc định</span>
            </button>
          </div>

          {cfgMsg && (
            <p style={{ color: 'var(--low)', fontWeight: 600, fontSize: '0.86rem', marginTop: 10 }}>
              {cfgMsg}
            </p>
          )}
        </form>
      </section>

      <section className="card fade-up delay-2">
        <h2 style={{ marginBottom: 14 }}>Giao diện hiển thị</h2>
        <div className="segmented">
          <button
            type="button"
            className={theme === 'light' ? 'on' : ''}
            onClick={() => setTheme('light')}
          >
            <Sun size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Sáng
          </button>
          <button
            type="button"
            className={theme === 'dark' ? 'on' : ''}
            onClick={() => setTheme('dark')}
          >
            <Moon size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Tối
          </button>
        </div>
      </section>

      <section className="card fade-up delay-2">
        <h2 style={{ marginBottom: 8 }}>Quản lý dữ liệu ({tasks.length} công việc)</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: '0 0 14px' }}>
          Sao lưu danh sách công việc & dữ liệu chấm công về máy hoặc dọn dẹp nhanh các công việc trùng lặp / đã xong.
        </p>
        <div className="toolbar">
          <button type="button" className="btn" onClick={exportJson}>
            <Download size={16} />
            <span>Xuất file sao lưu (.json)</span>
          </button>

          {duplicateIds.length > 0 && (
            <button type="button" className="btn primary" onClick={cleanDuplicates}>
              <Sparkles size={16} />
              <span>Xóa {duplicateIds.length} việc bị trùng</span>
            </button>
          )}

          {completedTasks.length > 0 && (
            <button type="button" className="btn" onClick={clearCompleted}>
              <Trash2 size={16} />
              <span>Dọn {completedTasks.length} việc đã xong</span>
            </button>
          )}
        </div>
        {msg && <p style={{ color: 'var(--low)', fontWeight: 600, fontSize: '0.86rem', marginTop: 12 }}>{msg}</p>}
      </section>
    </div>
  )
}
