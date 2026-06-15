import type { Customer, DurationOption } from "@/types/hizli-kayit"

export const DURATION_PRICES: Record<DurationOption, number> = {
  30: 100,
  60: 150,
  90: 200,
  free: 250,
}

export const DURATION_LABELS: Record<DurationOption, string> = {
  30: "30 dk",
  60: "60 dk",
  90: "90 dk",
  free: "Serbest",
}

export const DURATION_COLORS: Record<DurationOption, string> = {
  30: "from-sky-500 to-blue-600",
  60: "from-violet-500 to-purple-600",
  90: "from-emerald-500 to-green-600",
  free: "from-orange-500 to-amber-600",
}

export const DURATION_OPTIONS: DurationOption[] = [30, 60, 90, "free"]

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: "c1",
    name: "Ahmet Yılmaz",
    phone: "0532 123 45 67",
    notes: "Hafta sonu genelde geliyor",
    allergies: "Fındık alerjisi",
    walletBalance: 250,
    children: [
      { id: "ch1", name: "Can Yılmaz", age: 7 },
      { id: "ch2", name: "Ece Yılmaz", age: 5 },
    ],
  },
  {
    id: "c2",
    name: "Fatma Kaya",
    phone: "0543 987 65 43",
    notes: "",
    allergies: "",
    walletBalance: 0,
    children: [{ id: "ch3", name: "Elif Kaya", age: 6 }],
  },
  {
    id: "c3",
    name: "Mehmet Demir",
    phone: "0555 321 98 76",
    notes: "Doğum günü paketi ilgileniyor",
    allergies: "Süt alerjisi",
    walletBalance: 500,
    children: [
      { id: "ch4", name: "Ali Demir", age: 8 },
      { id: "ch5", name: "Ayşe Demir", age: 4 },
      { id: "ch6", name: "Hasan Demir", age: 10 },
    ],
  },
  {
    id: "c4",
    name: "Zeynep Arslan",
    phone: "0506 741 25 89",
    notes: "",
    allergies: "",
    walletBalance: 150,
    children: [{ id: "ch7", name: "Mert Arslan", age: 9 }],
  },
  {
    id: "c5",
    name: "Hasan Öztürk",
    phone: "0544 852 36 14",
    notes: "VIP müşteri",
    allergies: "",
    walletBalance: 1200,
    children: [
      { id: "ch8", name: "Selin Öztürk", age: 7 },
      { id: "ch9", name: "Cem Öztürk", age: 5 },
    ],
  },
]
