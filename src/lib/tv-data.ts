export interface TvSession {
  id: string
  childName: string
  remainingSeconds: number
  totalSeconds: number
}

export interface TvAnnouncement {
  id: string
  type: "campaign" | "birthday" | "event" | "app"
  icon: string
  title: string
  subtitle: string
  highlight?: string
}

export const INITIAL_SESSIONS: TvSession[] = [
  { id: "tv1", childName: "Elif",   remainingSeconds: 3420, totalSeconds: 5400 },
  { id: "tv2", childName: "Arda",   remainingSeconds: 1680, totalSeconds: 3600 },
  { id: "tv3", childName: "Zeynep", remainingSeconds: 480,  totalSeconds: 3600 },
  { id: "tv4", childName: "Mert",   remainingSeconds: 2700, totalSeconds: 5400 },
  { id: "tv5", childName: "Sude",   remainingSeconds: 960,  totalSeconds: 1800 },
  { id: "tv6", childName: "Can",    remainingSeconds: 0,    totalSeconds: 3600 },
  { id: "tv7", childName: "Buse",   remainingSeconds: 1860, totalSeconds: 3600 },
  { id: "tv8", childName: "Kaan",   remainingSeconds: 125,  totalSeconds: 3600 },
  { id: "tv9", childName: "Ali",    remainingSeconds: 4500, totalSeconds: 7200 },
  { id: "tv10",childName: "Ayşe",   remainingSeconds: 1200, totalSeconds: 1800 },
]

export const ANNOUNCEMENTS: TvAnnouncement[] = [
  {
    id: "a1",
    type: "birthday",
    icon: "🎂",
    title: "Bugün Doğum Günü!",
    subtitle: "Elif ve Arda doğum gününü kutluyoruz",
    highlight: "Tebrikler! 🎉",
  },
  {
    id: "a2",
    type: "campaign",
    icon: "⭐",
    title: "Hafta Sonu Kampanyası",
    subtitle: "2. çocuk %50 indirimli — Cumartesi & Pazar",
    highlight: "%50 İndirim",
  },
  {
    id: "a3",
    type: "event",
    icon: "🎪",
    title: "Özel Etkinlik",
    subtitle: "Bu Cumartesi sihirbaz gösterisi saat 15:00'da",
    highlight: "Cumartesi 15:00",
  },
  {
    id: "a4",
    type: "app",
    icon: "📱",
    title: "Mobil Uygulama",
    subtitle: "Go Kids Play uygulamasını indirin, cüzdan yükleyin",
    highlight: "Ücretsiz İndir",
  },
  {
    id: "a5",
    type: "campaign",
    icon: "🎁",
    title: "Doğum Günü Paketi",
    subtitle: "20 kişiye kadar özel organizasyon paketleri",
    highlight: "Bilgi Al →",
  },
]

export const TICKER_MESSAGES = [
  "Süre uzatmak için danışma masasına başvurabilirsiniz",
  "Go Kids Play mobil uygulamasını App Store ve Google Play'den ücretsiz indirin",
  "Doğum günü organizasyonları için özel paketlerimizi sorunuz",
  "Cüzdan ile ödeme yapın, bonus kazanın",
  "Haftalık abonelik paketleri için danışmanlarımızla görüşün",
  "Çocuğunuzun süresini uzatmak için kasaya başvurabilirsiniz",
  "Üyelik programımıza katılın, her ziyarette puan kazanın",
]

export type SessionStatus = "ample" | "caution" | "critical" | "expired"

export function getSessionStatus(seconds: number): SessionStatus {
  if (seconds <= 0) return "expired"
  if (seconds <= 600) return "critical"
  if (seconds <= 1800) return "caution"
  return "ample"
}

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}
