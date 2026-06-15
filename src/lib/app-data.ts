export const APP_USER = {
  firstName: "Mehmet",
  fullName: "Mehmet Yılmaz",
  phone: "0532 111 22 33",
  email: "mehmet@email.com",
  memberSince: "Mart 2025",
  memberCode: "GKP-20250312",
  walletBalance: 850,
  bonusBalance: 50,
  totalVisits: 42,
}

export const APP_CHILDREN = [
  {
    id: "ac1",
    name: "Elif",
    age: 6,
    gradient: "from-violet-400 to-purple-500",
    inside: true,
    remainingSeconds: 2723,
    totalSeconds: 5400,
    entryTime: "14:30",
  },
  {
    id: "ac2",
    name: "Arda",
    age: 4,
    gradient: "from-sky-400 to-blue-500",
    inside: false,
    remainingSeconds: 0,
    totalSeconds: 0,
    entryTime: null,
  },
]

export interface AppPackage {
  id: string
  name: string
  tagline: string
  duration: string
  price: number
  oldPrice?: number
  bonus?: string
  popular?: boolean
  gradient: string
  iconBg: string
  features: string[]
  cta: string
}

export const APP_PACKAGES: AppPackage[] = [
  {
    id: "ap1",
    name: "Günlük",
    tagline: "Tek seferlik deneyim",
    duration: "2 Saat",
    price: 150,
    gradient: "from-sky-500 to-cyan-600",
    iconBg: "bg-sky-100 dark:bg-sky-500/20",
    features: ["2 saat oyun alanı", "1 çocuk", "Standart alan erişimi"],
    cta: "₺150 Satın Al",
  },
  {
    id: "ap2",
    name: "Haftalık",
    tagline: "En popüler seçim",
    duration: "10 Saat",
    price: 450,
    bonus: "+60 dk bonus",
    popular: true,
    gradient: "from-violet-600 to-purple-700",
    iconBg: "bg-violet-100 dark:bg-violet-500/20",
    features: ["10 saat oyun alanı", "2 çocuğa kadar", "Tüm alanlara erişim", "+60 dk bonus süre", "Öncelikli giriş"],
    cta: "₺450 Satın Al",
  },
  {
    id: "ap3",
    name: "Aylık",
    tagline: "Aileler için ideal",
    duration: "30 Saat",
    price: 1200,
    oldPrice: 1500,
    bonus: "+5 saat bonus",
    gradient: "from-emerald-500 to-teal-600",
    iconBg: "bg-emerald-100 dark:bg-emerald-500/20",
    features: ["30 saat oyun alanı", "3 çocuğa kadar", "VIP alan dahil", "+5 saat bonus süre", "Öncelikli rezervasyon", "Ücretsiz kek servisi (x1)"],
    cta: "₺1.200 Satın Al",
  },
  {
    id: "ap4",
    name: "VIP Yıllık",
    tagline: "Sınırsız eğlence",
    duration: "Sınırsız",
    price: 2999,
    bonus: "Doğum günü paketi dahil",
    gradient: "from-amber-500 to-orange-600",
    iconBg: "bg-amber-100 dark:bg-amber-500/20",
    features: ["Sınırsız oyun süresi", "5 çocuğa kadar", "Tüm özel alanlar", "1 doğum günü organizasyonu", "7/24 öncelikli rezervasyon", "Özel VIP lounge"],
    cta: "₺2.999 Satın Al",
  },
]

export const ACTIVE_PACKAGE = {
  name: "Haftalık Paket",
  remainingLabel: "6s 30dk",
  remainingSeconds: 23400,
  totalSeconds: 36000,
  validUntil: "18 Mayıs 2026",
}

export interface AppWalletTx {
  id: string
  type: "use" | "load" | "bonus" | "refund"
  amount: number
  description: string
  date: string
}

export const WALLET_TRANSACTIONS: AppWalletTx[] = [
  { id: "wt1", type: "use", amount: 150, description: "Elif — 2 Saat Oyun", date: "Bugün 14:30" },
  { id: "wt2", type: "load", amount: 500, description: "Cüzdan Yükleme", date: "Dün 10:00" },
  { id: "wt3", type: "bonus", amount: 50, description: "Yükleme Bonusu", date: "Dün 10:00" },
  { id: "wt4", type: "use", amount: 120, description: "Arda — 90 dk Oyun", date: "9 Mayıs" },
  { id: "wt5", type: "refund", amount: 200, description: "İptal İadesi", date: "7 Mayıs" },
  { id: "wt6", type: "use", amount: 80, description: "Elif — 1 Saat Oyun", date: "5 Mayıs" },
]

export const CAMPAIGNS = [
  { id: "camp1", title: "Hafta Sonu %50", subtitle: "2. çocuk yarı fiyat", gradient: "from-rose-500 to-pink-600", icon: "🎉" },
  { id: "camp2", title: "Doğum Günü Paketi", subtitle: "20 kişi özel salon", gradient: "from-violet-500 to-purple-700", icon: "🎂" },
  { id: "camp3", title: "Yaz Sezonu", subtitle: "3 ay sınırsız oyun", gradient: "from-amber-500 to-orange-600", icon: "☀️" },
]

export const EVENTS = [
  { id: "ev1", title: "Sihirbaz Gösterisi", date: "Cumartesi, 16 Mayıs", time: "15:00", icon: "🎩", spots: 8 },
  { id: "ev2", title: "Çocuk Tiyatrosu", date: "Pazar, 17 Mayıs", time: "14:00", icon: "🎭", spots: 3 },
  { id: "ev3", title: "Boyama Atölyesi", date: "Pazartesi, 18 Mayıs", time: "10:00", icon: "🎨", spots: 12 },
]

export function formatSeconds(s: number): string {
  if (s <= 0) return "00:00"
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}
