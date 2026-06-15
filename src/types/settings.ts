// ─── App Settings ─────────────────────────────────────────────────────────────
//
// Full shape of every operator-configurable knob in the platform. Persisted in
// localStorage today (single-operator + single-branch convenience); migrating
// to a Supabase `branch_settings` row later means swapping the storage layer
// without changing any consumers.

export interface AppSettings {
  general:        GeneralSettings
  packages:       PackagesSettings
  operations:     OperationsSettings
  tv:             TvSettings
  payments:       PaymentsSettings
  notifications:  NotificationsSettings
  staff:          StaffSettings
}

// ─── Section shapes ──────────────────────────────────────────────────────────

export interface GeneralSettings {
  branchName:       string
  businessName:     string
  businessAddress:  string
  businessPhone:    string
  timezone:         string
  language:         "tr" | "en"
}

export interface PackagePricing {
  id:           string
  label:        string
  durationMin:  number     // 0 = unlimited
  price:        number
  active:       boolean
}

export interface PackagesSettings {
  items:                  PackagePricing[]
  extensionPricePer15Min: number
  taxRate:                number          // %
}

export interface OperationsSettings {
  maxPauseMinutes:          number
  refundTimeLimitMinutes:   number
  autoEndGraceMinutes:      number
  maxSiblingsPerSession:    number
  defaultEventChildCount:   number
  warnOnExpireMinutes:      number       // when to fire the "az kaldı" alert
}

export type TvDisplayMode    = "auto" | "compact" | "regular" | "large" | "minimal"
export type TvAccentPreset   = "violet" | "ocean" | "sunset" | "forest" | "mono"

export interface TvSettings {
  displayMode:     TvDisplayMode
  showBranding:    boolean
  showLiveClock:   boolean
  accentPreset:    TvAccentPreset
  cinemaCursorHide: boolean
}

export interface PaymentsSettings {
  allowSplitPayment:  boolean
  walletEnabled:      boolean
  walletBonusOn500:   number      // bonus added when loading 500₺+
  walletBonusOn1000:  number
  defaultRefundMethod: "wallet" | "cash"
  posIntegration:     "none" | "stripe" | "iyzico" | "paytr"
}

export interface NotificationsSettings {
  sessionEndingWarnMin:    number
  sessionEndingCriticalMin: number
  eventReminderMin:        number
  operationalWarnings:     boolean
  soundsEnabled:           boolean
}

export interface StaffSettings {
  autoLockMinutes:          number
  requireShiftOpening:      boolean
  refundRequiresManager:    boolean
  cashCloseRequiresManager: boolean
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    branchName:      "Merkez Şube",
    businessName:    "Go Kids Play",
    businessAddress: "",
    businessPhone:   "",
    timezone:        "Europe/Istanbul",
    language:        "tr",
  },
  packages: {
    items: [
      { id: "pkg_30",  label: "30 Dakika",  durationMin: 30, price: 100, active: true },
      { id: "pkg_60",  label: "60 Dakika",  durationMin: 60, price: 150, active: true },
      { id: "pkg_90",  label: "90 Dakika",  durationMin: 90, price: 200, active: true },
      { id: "pkg_inf", label: "Sınırsız",   durationMin: 0,  price: 250, active: true },
    ],
    extensionPricePer15Min: 40,
    taxRate:                20,
  },
  operations: {
    maxPauseMinutes:        60,
    refundTimeLimitMinutes: 30,
    autoEndGraceMinutes:    5,
    maxSiblingsPerSession:  5,
    defaultEventChildCount: 12,
    warnOnExpireMinutes:    10,
  },
  tv: {
    displayMode:      "auto",
    showBranding:     true,
    showLiveClock:    true,
    accentPreset:     "violet",
    cinemaCursorHide: true,
  },
  payments: {
    allowSplitPayment:   true,
    walletEnabled:       true,
    walletBonusOn500:    25,
    walletBonusOn1000:   75,
    defaultRefundMethod: "wallet",
    posIntegration:      "none",
  },
  notifications: {
    sessionEndingWarnMin:     10,
    sessionEndingCriticalMin: 5,
    eventReminderMin:         60,
    operationalWarnings:      true,
    soundsEnabled:            true,
  },
  staff: {
    autoLockMinutes:          15,
    requireShiftOpening:      true,
    refundRequiresManager:    false,
    cashCloseRequiresManager: true,
  },
}

// ─── Section metadata for the UI ─────────────────────────────────────────────

export type SettingsSection =
  | "general" | "packages" | "operations" | "tv" | "payments" | "notifications" | "staff"

export const SECTION_LABEL: Record<SettingsSection, string> = {
  general:       "Genel",
  packages:      "Paketler & Fiyatlar",
  operations:    "Operasyon Kuralları",
  tv:            "TV Ekranı",
  payments:      "Ödeme",
  notifications: "Bildirim & Uyarı",
  staff:         "Personel",
}

export const SECTION_HINT: Record<SettingsSection, string> = {
  general:       "Şube bilgisi, iletişim, dil",
  packages:      "Paket fiyatları, uzatma, KDV",
  operations:    "İade, pause, oto-bitiş, kardeş limiti",
  tv:            "Salon ekranı görünüm tercihleri",
  payments:      "Split payment, cüzdan, bonus, POS",
  notifications: "Süre bitiş eşikleri, ses, uyarı",
  staff:         "Otomatik kilit, vardiya kuralları",
}
