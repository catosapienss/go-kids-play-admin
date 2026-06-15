import type { ActiveSession, LiveEvent, EventType } from "@/types/aktif-oyun"

const STAFF = ["Ayşe H.", "Murat K.", "Selin T.", "Emre D."]
const PACKAGES = ["30dk", "60dk", "90dk", "Serbest"] as const

function mins(m: number) { return m * 60 }

let _idCounter = 100

export function makeId() {
  return `s${++_idCounter}_${Math.random().toString(36).slice(2, 6)}`
}

export const INITIAL_SESSIONS: ActiveSession[] = [
  {
    id: "s1",
    childName: "Can Yılmaz",
    childAge: 7,
    parentName: "Ahmet Yılmaz",
    parentPhone: "0532 123 45 67",
    entryTime: "13:15",
    entryTimestamp: Date.now() - mins(42),
    totalMinutes: 60,
    remainingSeconds: mins(18),
    packageType: "60dk",
    staffName: "Ayşe H.",
    parentId: "",
    isVip: false,
    isPaused: false,
  },
  {
    id: "s2",
    childName: "Elif Kaya",
    childAge: 5,
    parentName: "Fatma Kaya",
    parentPhone: "0543 987 65 43",
    entryTime: "13:45",
    entryTimestamp: Date.now() - mins(12),
    totalMinutes: 30,
    remainingSeconds: mins(7),
    packageType: "30dk",
    staffName: "Murat K.",
    parentId: "",
    isVip: false,
    isPaused: false,
  },
  {
    id: "s3",
    childName: "Ali Demir",
    childAge: 8,
    parentName: "Mehmet Demir",
    parentPhone: "0555 321 98 76",
    entryTime: "12:00",
    entryTimestamp: Date.now() - mins(57),
    totalMinutes: 90,
    remainingSeconds: mins(33),
    packageType: "90dk",
    staffName: "Ayşe H.",
    parentId: "",
    isVip: true,
    isPaused: false,
  },
  {
    id: "s4",
    childName: "Zeynep Arslan",
    childAge: 6,
    parentName: "Zeynep Arslan",
    parentPhone: "0506 741 25 89",
    entryTime: "14:00",
    entryTimestamp: Date.now() - mins(5),
    totalMinutes: 60,
    remainingSeconds: mins(55),
    packageType: "60dk",
    staffName: "Selin T.",
    parentId: "",
    isVip: false,
    isPaused: false,
  },
  {
    id: "s5",
    childName: "Cem Öztürk",
    childAge: 9,
    parentName: "Hasan Öztürk",
    parentPhone: "0544 852 36 14",
    entryTime: "12:30",
    entryTimestamp: Date.now() - mins(87),
    totalMinutes: 90,
    remainingSeconds: mins(3),
    packageType: "90dk",
    staffName: "Emre D.",
    parentId: "",
    isVip: true,
    isPaused: false,
  },
  {
    id: "s6",
    childName: "Selin Öztürk",
    childAge: 7,
    parentName: "Hasan Öztürk",
    parentPhone: "0544 852 36 14",
    entryTime: "13:00",
    entryTimestamp: Date.now() - mins(57),
    totalMinutes: 90,
    remainingSeconds: mins(33),
    packageType: "90dk",
    staffName: "Emre D.",
    parentId: "",
    isVip: true,
    isPaused: true,
  },
  {
    id: "s7",
    childName: "Mert Arslan",
    childAge: 10,
    parentName: "Kemal Arslan",
    parentPhone: "0533 456 78 90",
    entryTime: "14:10",
    entryTimestamp: Date.now() - mins(2),
    totalMinutes: 60,
    remainingSeconds: mins(58),
    packageType: "60dk",
    staffName: "Selin T.",
    parentId: "",
    isVip: false,
    isPaused: false,
  },
  {
    id: "s8",
    childName: "Ayşe Demir",
    childAge: 4,
    parentName: "Mehmet Demir",
    parentPhone: "0555 321 98 76",
    entryTime: "13:30",
    entryTimestamp: Date.now() - mins(27),
    totalMinutes: 0,
    remainingSeconds: -1,
    packageType: "Serbest",
    staffName: "Ayşe H.",
    parentId: "",
    isVip: false,
    isPaused: false,
  },
]

export const INITIAL_EVENTS: LiveEvent[] = [
  {
    id: "e1",
    type: "entry",
    childName: "Mert Arslan",
    parentName: "Kemal Arslan",
    staffName: "Selin T.",
    timestamp: new Date(Date.now() - 2 * 60000),
    detail: "60 dk paket",
  },
  {
    id: "e2",
    type: "pause",
    childName: "Selin Öztürk",
    parentName: "Hasan Öztürk",
    staffName: "Emre D.",
    timestamp: new Date(Date.now() - 8 * 60000),
    detail: "Veli isteği",
  },
  {
    id: "e3",
    type: "entry",
    childName: "Zeynep Arslan",
    parentName: "Zeynep Arslan",
    staffName: "Selin T.",
    timestamp: new Date(Date.now() - 5 * 60000),
    detail: "60 dk paket",
  },
  {
    id: "e4",
    type: "extend",
    childName: "Can Yılmaz",
    parentName: "Ahmet Yılmaz",
    staffName: "Ayşe H.",
    timestamp: new Date(Date.now() - 15 * 60000),
    detail: "+30 dk eklendi",
  },
  {
    id: "e5",
    type: "exit",
    childName: "Hasan Demir",
    parentName: "Mehmet Demir",
    staffName: "Murat K.",
    timestamp: new Date(Date.now() - 20 * 60000),
    detail: "Normal çıkış",
  },
]

export const EVENT_LABELS: Record<EventType, string> = {
  entry: "Giriş",
  exit: "Çıkış",
  extend: "Süre Uzatma",
  pause: "Duraklat",
  resume: "Devam Et",
  expire: "Süre Bitti",
}

export const EVENT_COLORS: Record<EventType, string> = {
  entry: "bg-emerald-500",
  exit: "bg-slate-400",
  extend: "bg-violet-500",
  pause: "bg-amber-500",
  resume: "bg-sky-500",
  expire: "bg-red-500",
}

// Random new entry simulation
const NEW_KIDS = [
  { childName: "Buse Yıldız", childAge: 6, parentName: "Leyla Yıldız", phone: "0532 999 00 11" },
  { childName: "Taha Kara", childAge: 8, parentName: "Osman Kara", phone: "0543 888 77 66" },
  { childName: "Defne Çelik", childAge: 5, parentName: "Aylin Çelik", phone: "0555 777 44 33" },
]

export function generateRandomEntry(): { session: ActiveSession; event: LiveEvent } {
  const kid = NEW_KIDS[Math.floor(Math.random() * NEW_KIDS.length)]
  const pkg = PACKAGES[Math.floor(Math.random() * 3)] // exclude Serbest for simplicity
  const staff = STAFF[Math.floor(Math.random() * STAFF.length)]
  const durationMap: Record<string, number> = { "30dk": 30, "60dk": 60, "90dk": 90 }
  const totalMins = durationMap[pkg] ?? 60
  const now = new Date()
  const id = makeId()

  const session: ActiveSession = {
    id,
    childName: kid.childName,
    childAge: kid.childAge,
    parentName: kid.parentName,
    parentPhone: kid.phone,
    entryTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    entryTimestamp: Date.now(),
    totalMinutes: totalMins,
    remainingSeconds: totalMins * 60,
    packageType: pkg,
    staffName: staff,
    parentId: "",
    isVip: false,
    isPaused: false,
  }

  const event: LiveEvent = {
    id: `evt_${id}`,
    type: "entry",
    childName: kid.childName,
    parentName: kid.parentName,
    staffName: staff,
    timestamp: now,
    detail: `${pkg} paket`,
  }

  return { session, event }
}
