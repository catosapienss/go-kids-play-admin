import type { StaffMember, PermissionKey, ActivityItem } from "@/types/personel"

const ALL_PERMS: Record<PermissionKey, boolean> = {
  take_payment: true, process_refund: true, cancel_session: true,
  view_reports: true, manage_staff: true, manage_organizations: true,
  manage_wallet: true, view_security_logs: true, modify_prices: true, export_data: true,
}

const MANAGER_PERMS: Record<PermissionKey, boolean> = {
  take_payment: true, process_refund: true, cancel_session: true,
  view_reports: true, manage_staff: false, manage_organizations: true,
  manage_wallet: true, view_security_logs: false, modify_prices: false, export_data: true,
}

const CASHIER_PERMS: Record<PermissionKey, boolean> = {
  take_payment: true, process_refund: false, cancel_session: true,
  view_reports: false, manage_staff: false, manage_organizations: false,
  manage_wallet: false, view_security_logs: false, modify_prices: false, export_data: false,
}

const PERF_7 = (base: number, cancel: number): { day: string; txCount: number; cancelCount: number; revenue: number }[] => [
  { day: "Pts", txCount: base + 2, cancelCount: cancel, revenue: (base + 2) * 380 },
  { day: "Sal", txCount: base - 1, cancelCount: cancel, revenue: (base - 1) * 380 },
  { day: "Çar", txCount: base + 4, cancelCount: cancel + 1, revenue: (base + 4) * 380 },
  { day: "Per", txCount: base, cancelCount: cancel, revenue: base * 380 },
  { day: "Cum", txCount: base + 5, cancelCount: cancel, revenue: (base + 5) * 380 },
  { day: "Cmt", txCount: base + 8, cancelCount: cancel + 1, revenue: (base + 8) * 380 },
  { day: "Paz", txCount: base + 3, cancelCount: cancel, revenue: (base + 3) * 380 },
]

// Production: demo staff array emptied. Real account list lives in
// public.profiles and is rendered by ProductionAccounts.
export const STAFF_MEMBERS: StaffMember[] = []
const _LEGACY_STAFF_MEMBERS: StaffMember[] = [
  {
    id: "s_001",
    name: "Ahmet Kaya",
    phone: "0532 100 11 22",
    email: "ahmet.kaya@gokidsplay.com",
    role: "admin",
    status: "active",
    loginTime: "08:02",
    lastActivity: "09 dk önce",
    todayTxCount: 12,
    todayCancelCount: 0,
    todayRevenue: 4800,
    totalCustomers: 342,
    avgTxMinutes: 3,
    cancelRate: 1.2,
    permissions: ALL_PERMS,
    dailyPerformance: PERF_7(12, 0),
    operations: [
      { id: "op_a1", type: "payment", description: "Ödeme alındı", customerName: "Zeynep Arslan", amount: 350, datetime: "2026-05-11 17:41" },
      { id: "op_a2", type: "org_action", description: "Organizasyon onaylandı — #ORG-2026-042", datetime: "2026-05-11 16:50" },
      { id: "op_a3", type: "payment", description: "Ödeme alındı", customerName: "Mehmet Demir", amount: 450, datetime: "2026-05-11 15:33" },
      { id: "op_a4", type: "cancel", description: "Seans iptal edildi", customerName: "Ayşe Kılıç", amount: 200, datetime: "2026-05-11 14:20" },
      { id: "op_a5", type: "wallet_load", description: "Cüzdan yüklendi", customerName: "Can Öztürk", amount: 500, datetime: "2026-05-11 13:10" },
      { id: "op_a6", type: "payment", description: "Karma ödeme alındı", customerName: "Fatma Yıldız", amount: 600, datetime: "2026-05-11 12:05" },
      { id: "op_a7", type: "checkin", description: "Giriş işlendi", customerName: "Ali Şahin", datetime: "2026-05-11 11:30" },
      { id: "op_a8", type: "extend", description: "Süre uzatıldı +30 dk", customerName: "Leyla Çelik", amount: 100, datetime: "2026-05-11 10:15" },
    ],
    securityLogs: [
      { id: "sl_a1", event: "login", device: "iPad Pro (Kasa 1)", ip: "192.168.1.10", datetime: "2026-05-11 08:02" },
      { id: "sl_a2", event: "login", device: "iPad Pro (Kasa 1)", ip: "192.168.1.10", datetime: "2026-05-10 08:15" },
      { id: "sl_a3", event: "logout", device: "iPad Pro (Kasa 1)", ip: "192.168.1.10", datetime: "2026-05-10 22:00" },
      { id: "sl_a4", event: "permission_change", device: "Admin Panel", ip: "192.168.1.5", datetime: "2026-05-09 11:30", note: "Büşra Çetin yetkileri güncellendi" },
      { id: "sl_a5", event: "login", device: "MacBook Pro", ip: "192.168.1.5", datetime: "2026-05-09 09:00" },
    ],
    notes: [
      { id: "n_a1", type: "performance", content: "Bu ay mükemmel bir performans sergiledi. Müşteri memnuniyeti %98.", authorName: "Sistem", datetime: "2026-05-01 09:00" },
      { id: "n_a2", type: "manager", content: "Yeni personel eğitiminde mentorluk yapıyor. Takım liderliği güçlü.", authorName: "Yönetim", datetime: "2026-04-20 14:00" },
    ],
  },
  {
    id: "s_002",
    name: "Selin Yıldız",
    phone: "0541 200 33 44",
    email: "selin.yildiz@gokidsplay.com",
    role: "manager",
    status: "active",
    loginTime: "08:31",
    lastActivity: "2 dk önce",
    todayTxCount: 18,
    todayCancelCount: 1,
    todayRevenue: 6200,
    totalCustomers: 518,
    avgTxMinutes: 2,
    cancelRate: 2.1,
    permissions: MANAGER_PERMS,
    dailyPerformance: PERF_7(18, 1),
    operations: [
      { id: "op_s1", type: "payment", description: "Ödeme alındı", customerName: "Büşra Arslan", amount: 450, datetime: "2026-05-11 17:55" },
      { id: "op_s2", type: "payment", description: "Kart ile ödeme", customerName: "Murat Kaya", amount: 550, datetime: "2026-05-11 17:20" },
      { id: "op_s3", type: "refund", description: "Cüzdana iade", customerName: "Hande Demir", amount: 300, datetime: "2026-05-11 16:40" },
      { id: "op_s4", type: "org_action", description: "Organizasyon takvime eklendi", datetime: "2026-05-11 15:55" },
      { id: "op_s5", type: "payment", description: "Nakit ödeme", customerName: "Okan Yılmaz", amount: 250, datetime: "2026-05-11 15:10" },
      { id: "op_s6", type: "wallet_load", description: "Cüzdan yüklendi +₺100 bonus", customerName: "Gül Şen", amount: 1000, datetime: "2026-05-11 14:00" },
      { id: "op_s7", type: "checkout", description: "Çıkış işlendi", customerName: "Aslı Çetin", datetime: "2026-05-11 13:20" },
      { id: "op_s8", type: "payment", description: "Karma ödeme", customerName: "Taner Öz", amount: 400, datetime: "2026-05-11 12:30" },
    ],
    securityLogs: [
      { id: "sl_s1", event: "login", device: "iPhone 15 Pro", ip: "192.168.1.12", datetime: "2026-05-11 08:31" },
      { id: "sl_s2", event: "login", device: "iPad Mini (Kasa 2)", ip: "192.168.1.11", datetime: "2026-05-11 08:32" },
      { id: "sl_s3", event: "logout", device: "iPad Mini (Kasa 2)", ip: "192.168.1.11", datetime: "2026-05-10 21:30" },
      { id: "sl_s4", event: "login", device: "iPad Mini (Kasa 2)", ip: "192.168.1.11", datetime: "2026-05-10 08:30" },
    ],
    notes: [
      { id: "n_s1", type: "performance", content: "Günlük işlem sayısı en yüksek personel. Hızlı ve doğru çalışıyor.", authorName: "Ahmet Kaya", datetime: "2026-05-10 18:00" },
      { id: "n_s2", type: "operation", content: "Hafta sonu doğum günü organizasyonlarını tek başına yönetti.", authorName: "Ahmet Kaya", datetime: "2026-05-04 20:00" },
    ],
  },
  {
    id: "s_003",
    name: "Emre Taşkın",
    phone: "0555 300 55 66",
    email: "emre.taskin@gokidsplay.com",
    role: "cashier",
    status: "active",
    loginTime: "09:05",
    lastActivity: "15 dk önce",
    todayTxCount: 9,
    todayCancelCount: 1,
    todayRevenue: 3100,
    totalCustomers: 201,
    avgTxMinutes: 4,
    cancelRate: 3.8,
    permissions: CASHIER_PERMS,
    dailyPerformance: PERF_7(9, 1),
    operations: [
      { id: "op_e1", type: "payment", description: "Ödeme alındı", customerName: "Pınar Yılmaz", amount: 350, datetime: "2026-05-11 17:15" },
      { id: "op_e2", type: "checkin", description: "Giriş işlendi", customerName: "Sinan Kara", datetime: "2026-05-11 16:30" },
      { id: "op_e3", type: "cancel", description: "Seans iptal edildi", customerName: "Deniz Arslan", amount: 200, datetime: "2026-05-11 15:45" },
      { id: "op_e4", type: "payment", description: "Nakit ödeme", customerName: "Ebru Şahin", amount: 300, datetime: "2026-05-11 14:55" },
      { id: "op_e5", type: "extend", description: "Süre uzatıldı +60 dk", customerName: "Cenk Öztürk", amount: 200, datetime: "2026-05-11 13:40" },
      { id: "op_e6", type: "checkout", description: "Çıkış işlendi", customerName: "Nisa Demir", datetime: "2026-05-11 12:20" },
    ],
    securityLogs: [
      { id: "sl_e1", event: "login", device: "Android Tablet (Kasa 3)", ip: "192.168.1.13", datetime: "2026-05-11 09:05" },
      { id: "sl_e2", event: "failed_login", device: "Android Tablet (Kasa 3)", ip: "192.168.1.13", datetime: "2026-05-11 09:03", note: "Yanlış PIN — 1 deneme" },
      { id: "sl_e3", event: "login", device: "Android Tablet (Kasa 3)", ip: "192.168.1.13", datetime: "2026-05-10 09:10" },
      { id: "sl_e4", event: "logout", device: "Android Tablet (Kasa 3)", ip: "192.168.1.13", datetime: "2026-05-10 20:00" },
    ],
    notes: [
      { id: "n_e1", type: "operation", content: "Giriş sırasında yanlış PIN hatası yaşandı. Takip edilmeli.", authorName: "Ahmet Kaya", datetime: "2026-05-11 09:10" },
    ],
  },
  {
    id: "s_004",
    name: "Büşra Çetin",
    phone: "0544 400 77 88",
    email: "busra.cetin@gokidsplay.com",
    role: "cashier",
    status: "break",
    loginTime: "08:45",
    lastActivity: "Molada",
    todayTxCount: 7,
    todayCancelCount: 0,
    todayRevenue: 2450,
    totalCustomers: 145,
    avgTxMinutes: 3,
    cancelRate: 0.8,
    permissions: { ...CASHIER_PERMS, manage_wallet: true },
    dailyPerformance: PERF_7(7, 0),
    operations: [
      { id: "op_b1", type: "payment", description: "Kart ödeme", customerName: "Merve Koç", amount: 450, datetime: "2026-05-11 15:30" },
      { id: "op_b2", type: "payment", description: "Nakit ödeme", customerName: "Tuğba Acar", amount: 200, datetime: "2026-05-11 14:20" },
      { id: "op_b3", type: "wallet_load", description: "Cüzdan yüklendi", customerName: "Seda Güneş", amount: 300, datetime: "2026-05-11 13:15" },
      { id: "op_b4", type: "checkin", description: "Giriş işlendi", customerName: "Bora Aktaş", datetime: "2026-05-11 11:50" },
      { id: "op_b5", type: "payment", description: "Karma ödeme", customerName: "Yasemin Öz", amount: 500, datetime: "2026-05-11 10:30" },
    ],
    securityLogs: [
      { id: "sl_b1", event: "login", device: "iPad Air (Kasa 4)", ip: "192.168.1.14", datetime: "2026-05-11 08:45" },
      { id: "sl_b2", event: "login", device: "iPad Air (Kasa 4)", ip: "192.168.1.14", datetime: "2026-05-10 09:00" },
      { id: "sl_b3", event: "logout", device: "iPad Air (Kasa 4)", ip: "192.168.1.14", datetime: "2026-05-10 20:15" },
    ],
    notes: [
      { id: "n_b1", type: "performance", content: "En düşük iptal oranına sahip personel. Müşteri iletişimi çok güçlü.", authorName: "Selin Yıldız", datetime: "2026-05-08 17:00" },
    ],
  },
]

export const LIVE_ACTIVITY: ActivityItem[] = []
const _LEGACY_LIVE_ACTIVITY: ActivityItem[] = [
  { id: "act_1", staffId: "s_002", staffName: "Selin Y.", type: "payment", description: "Büşra Arslan — ₺450 kart ödeme", datetime: "17:55" },
  { id: "act_2", staffId: "s_001", staffName: "Ahmet K.", type: "payment", description: "Zeynep Arslan — ₺350 nakit", datetime: "17:41" },
  { id: "act_3", staffId: "s_002", staffName: "Selin Y.", type: "payment", description: "Murat Kaya — ₺550 kart", datetime: "17:20" },
  { id: "act_4", staffId: "s_003", staffName: "Emre T.", type: "payment", description: "Pınar Yılmaz — ₺350 nakit", datetime: "17:15" },
  { id: "act_5", staffId: "s_002", staffName: "Selin Y.", type: "refund", description: "Hande Demir — ₺300 cüzdan iade", datetime: "16:40" },
  { id: "act_6", staffId: "s_003", staffName: "Emre T.", type: "checkin", description: "Sinan Kara — giriş", datetime: "16:30" },
  { id: "act_7", staffId: "s_001", staffName: "Ahmet K.", type: "org_action", description: "Organizasyon onaylandı #ORG-2026-042", datetime: "16:50" },
  { id: "act_8", staffId: "s_003", staffName: "Emre T.", type: "cancel", description: "Deniz Arslan — seans iptal", datetime: "15:45" },
  { id: "act_9", staffId: "s_004", staffName: "Büşra Ç.", type: "payment", description: "Merve Koç — ₺450 kart", datetime: "15:30" },
  { id: "act_10", staffId: "s_001", staffName: "Ahmet K.", type: "payment", description: "Mehmet Demir — ₺450", datetime: "15:33" },
  { id: "act_11", staffId: "s_002", staffName: "Selin Y.", type: "payment", description: "Okan Yılmaz — ₺250 nakit", datetime: "15:10" },
  { id: "act_12", staffId: "s_004", staffName: "Büşra Ç.", type: "payment", description: "Tuğba Acar — ₺200", datetime: "14:20" },
]

export const PERMISSION_LABELS: Record<string, { label: string; description: string }> = {
  take_payment: { label: "Ödeme Alma", description: "Nakit, kart ve karma ödeme işlemleri" },
  process_refund: { label: "İade Yapma", description: "Cüzdana iade ve geri ödeme işlemleri" },
  cancel_session: { label: "Seans İptal", description: "Aktif seans iptali ve süre düzenleme" },
  view_reports: { label: "Rapor Görüntüleme", description: "Günlük/haftalık raporları görme" },
  manage_staff: { label: "Personel Yönetimi", description: "Personel ekleme, düzenleme ve silme" },
  manage_organizations: { label: "Organizasyon Yönetimi", description: "Doğum günü rezervasyonları" },
  manage_wallet: { label: "Cüzdan Yönetimi", description: "Müşteri cüzdanı yükleme ve düzenleme" },
  view_security_logs: { label: "Güvenlik Logları", description: "Sistem güvenlik kayıtlarını görme" },
  modify_prices: { label: "Fiyat Değiştirme", description: "Hizmet fiyatlarını düzenleme yetkisi" },
  export_data: { label: "Veri Dışa Aktarma", description: "Raporları Excel/PDF olarak export etme" },
}

export function getStaffById(id: string): StaffMember | undefined {
  return STAFF_MEMBERS.find((s) => s.id === id)
}
