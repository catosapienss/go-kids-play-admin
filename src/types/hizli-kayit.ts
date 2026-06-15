export type DurationOption = 30 | 60 | 90 | "free"
export type PaymentMethod = "cash" | "card" | "wallet"

export interface Customer {
  id: string
  name: string
  phone: string
  notes?: string
  allergies?: string
  children: SavedChild[]
  walletBalance: number
}

export interface SavedChild {
  id: string
  name: string
  age: number
}

export interface ChildEntry {
  id: string
  name: string
  age: number | ""
  duration: DurationOption | null
  price: number
}

export interface PaymentEntry {
  id: string
  method: PaymentMethod
  amount: number
}

export interface NewCustomerForm {
  name: string
  phone: string
  notes: string
  allergies: string
}
