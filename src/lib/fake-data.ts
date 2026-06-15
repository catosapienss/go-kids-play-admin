export const dashboardStats = {
  activeKids: 23,
  dailyRevenue: 4850,
  activeStaff: 6,
  todayEntries: 47,
}

export const recentTransactions = [
  { id: 1, name: "Ahmet Yılmaz", child: "Can Yılmaz", amount: 150, type: "Giriş", time: "14:32", status: "success" },
  { id: 2, name: "Fatma Kaya", child: "Elif Kaya", amount: 150, type: "Giriş", time: "14:15", status: "success" },
  { id: 3, name: "Mehmet Demir", child: "Ali Demir", amount: 300, type: "Doğum Günü", time: "13:50", status: "success" },
  { id: 4, name: "Ayşe Çelik", child: "Zeynep Çelik", amount: 150, type: "Giriş", time: "13:22", status: "success" },
  { id: 5, name: "Hasan Öztürk", child: "Cem Öztürk", amount: 150, type: "Giriş", time: "12:45", status: "success" },
  { id: 6, name: "Hatice Şahin", child: "Selin Şahin", amount: 0, type: "Çıkış", time: "12:30", status: "neutral" },
]

export const hourlyData = [
  { hour: "09:00", count: 5 },
  { hour: "10:00", count: 12 },
  { hour: "11:00", count: 18 },
  { hour: "12:00", count: 25 },
  { hour: "13:00", count: 22 },
  { hour: "14:00", count: 30 },
  { hour: "15:00", count: 28 },
  { hour: "16:00", count: 35 },
  { hour: "17:00", count: 40 },
  { hour: "18:00", count: 38 },
  { hour: "19:00", count: 32 },
  { hour: "20:00", count: 20 },
]

export const activeKids = [
  { id: 1, name: "Can Yılmaz", age: 7, entryTime: "13:15", parent: "Ahmet Yılmaz", color: "bg-purple-500" },
  { id: 2, name: "Elif Kaya", age: 5, entryTime: "13:30", parent: "Fatma Kaya", color: "bg-pink-500" },
  { id: 3, name: "Ali Demir", age: 8, entryTime: "12:00", parent: "Mehmet Demir", color: "bg-blue-500" },
  { id: 4, name: "Zeynep Çelik", age: 6, entryTime: "14:00", parent: "Ayşe Çelik", color: "bg-green-500" },
  { id: 5, name: "Cem Öztürk", age: 9, entryTime: "12:30", parent: "Hasan Öztürk", color: "bg-orange-500" },
]
