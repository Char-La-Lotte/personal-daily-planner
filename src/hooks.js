import { useEffect, useRef, useState } from 'react'
import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import { DEFAULT_WORK_CONFIG, evaluateAttendance } from './utils'

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])
  return [theme, setTheme]
}

function loadLocalTasks(uid) {
  try {
    const raw = localStorage.getItem(`planner_tasks_${uid}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalTasks(uid, list) {
  try {
    localStorage.setItem(`planner_tasks_${uid}`, JSON.stringify(list))
  } catch {
    // ignore storage quota errors
  }
}

export function useTasks(uid) {
  const [tasks, setTasks] = useState(() => (uid ? loadLocalTasks(uid) : []))
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState('')
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks

  useEffect(() => {
    if (!uid) return
    const cached = loadLocalTasks(uid)
    setTasks(cached)

    const timer = setTimeout(() => setLoading(false), 1200)

    const q = query(collection(db, 'users', uid, 'tasks'), orderBy('date'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        clearTimeout(timer)
        const remote = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setTasks(remote)
        saveLocalTasks(uid, remote)
        setDbError('')
        setLoading(false)
      },
      (err) => {
        clearTimeout(timer)
        console.warn('Firestore sync warning:', err?.code || err?.message)
        setDbError('')
        setLoading(false)
      }
    )

    return () => {
      clearTimeout(timer)
      unsub()
    }
  }, [uid])

  const add = async (t) => {
    // Chặn thêm trùng lặp trong cùng ngày & giờ bắt đầu
    const exists = tasksRef.current.some(
      (item) =>
        item.date === t.date &&
        item.title?.trim().toLowerCase() === t.title?.trim().toLowerCase() &&
        (item.startTime || '') === (t.startTime || '')
    )
    if (exists) return

    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const newTask = { id, ...t, createdAt: Date.now(), updatedAt: Date.now() }
    const next = [...tasksRef.current, newTask]
    tasksRef.current = next
    setTasks(next)
    saveLocalTasks(uid, next)

    setDoc(doc(db, 'users', uid, 'tasks', id), {
      ...t,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch((e) => console.warn('Firestore add skipped:', e?.code || e?.message))
  }

  const update = async (id, patch) => {
    const next = tasksRef.current.map((item) =>
      item.id === id ? { ...item, ...patch, updatedAt: Date.now() } : item
    )
    tasksRef.current = next
    setTasks(next)
    saveLocalTasks(uid, next)

    updateDoc(doc(db, 'users', uid, 'tasks', id), {
      ...patch,
      updatedAt: serverTimestamp(),
    }).catch((e) => console.warn('Firestore update skipped:', e?.code || e?.message))
  }

  const remove = async (id) => {
    const next = tasksRef.current.filter((item) => item.id !== id)
    tasksRef.current = next
    setTasks(next)
    saveLocalTasks(uid, next)

    deleteDoc(doc(db, 'users', uid, 'tasks', id)).catch((e) =>
      console.warn('Firestore delete skipped:', e?.code || e?.message)
    )
  }

  return { tasks, loading, dbError, add, update, remove }
}

function loadLocalWorkConfig(uid) {
  try {
    const raw = localStorage.getItem(`planner_work_config_${uid}`)
    return raw ? { ...DEFAULT_WORK_CONFIG, ...JSON.parse(raw) } : DEFAULT_WORK_CONFIG
  } catch {
    return DEFAULT_WORK_CONFIG
  }
}

function saveLocalWorkConfig(uid, cfg) {
  try {
    localStorage.setItem(`planner_work_config_${uid}`, JSON.stringify(cfg))
  } catch {
    // ignore storage quota errors
  }
}

function loadLocalAttendance(uid) {
  try {
    const raw = localStorage.getItem(`planner_attendance_${uid}`)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLocalAttendance(uid, map) {
  try {
    localStorage.setItem(`planner_attendance_${uid}`, JSON.stringify(map))
  } catch {
    // ignore storage quota errors
  }
}

export function useAttendance(uid) {
  const [workConfig, setWorkConfig] = useState(() =>
    uid ? loadLocalWorkConfig(uid) : DEFAULT_WORK_CONFIG
  )
  const [records, setRecords] = useState(() => (uid ? loadLocalAttendance(uid) : {}))
  const recordsRef = useRef(records)
  recordsRef.current = records
  const configRef = useRef(workConfig)
  configRef.current = workConfig

  useEffect(() => {
    if (!uid) return
    setWorkConfig(loadLocalWorkConfig(uid))
    setRecords(loadLocalAttendance(uid))

    const cfgDoc = doc(db, 'users', uid, 'settings', 'workConfig')
    const unsubCfg = onSnapshot(
      cfgDoc,
      (snap) => {
        if (snap.exists()) {
          const merged = { ...DEFAULT_WORK_CONFIG, ...snap.data() }
          setWorkConfig(merged)
          saveLocalWorkConfig(uid, merged)
        }
      },
      (err) => console.warn('WorkConfig sync warning:', err?.code || err?.message)
    )

    const attQuery = query(collection(db, 'users', uid, 'attendance'))
    const unsubAtt = onSnapshot(
      attQuery,
      (snap) => {
        const nextMap = {}
        snap.docs.forEach((d) => {
          nextMap[d.id] = { date: d.id, ...d.data() }
        })
        setRecords(nextMap)
        saveLocalAttendance(uid, nextMap)
      },
      (err) => console.warn('Attendance sync warning:', err?.code || err?.message)
    )

    return () => {
      unsubCfg()
      unsubAtt()
    }
  }, [uid])

  const updateWorkConfig = async (nextConfig) => {
    const merged = { ...DEFAULT_WORK_CONFIG, ...nextConfig }
    configRef.current = merged
    setWorkConfig(merged)
    saveLocalWorkConfig(uid, merged)

    setDoc(
      doc(db, 'users', uid, 'settings', 'workConfig'),
      { ...merged, updatedAt: serverTimestamp() },
      { merge: true }
    ).catch((e) => console.warn('Firestore workConfig save skipped:', e?.code || e?.message))
  }

  const upsertRecord = async (date, patch) => {
    const existing = recordsRef.current[date] || { date }
    const mergedInput = { ...existing, ...patch, date }
    const evaluated = evaluateAttendance(mergedInput, configRef.current)
    const fullRecord = {
      ...mergedInput,
      ...evaluated,
      updatedAt: Date.now(),
    }

    const nextMap = { ...recordsRef.current, [date]: fullRecord }
    recordsRef.current = nextMap
    setRecords(nextMap)
    saveLocalAttendance(uid, nextMap)

    setDoc(
      doc(db, 'users', uid, 'attendance', date),
      {
        ...fullRecord,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((e) => console.warn('Firestore attendance save skipped:', e?.code || e?.message))
  }

  const removeRecord = async (date) => {
    const nextMap = { ...recordsRef.current }
    delete nextMap[date]
    recordsRef.current = nextMap
    setRecords(nextMap)
    saveLocalAttendance(uid, nextMap)

    deleteDoc(doc(db, 'users', uid, 'attendance', date)).catch((e) =>
      console.warn('Firestore attendance delete skipped:', e?.code || e?.message)
    )
  }

  return {
    workConfig,
    records,
    updateWorkConfig,
    upsertRecord,
    removeRecord,
  }
}
