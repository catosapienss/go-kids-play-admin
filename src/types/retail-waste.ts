// ─── Retail Waste / Loss (Zayiat) types ─────────────────────────────────────

export type WasteReason =
  | "damaged" | "expired" | "theft" | "count_diff" | "sample" | "other"

export const WASTE_REASON_LABELS: Record<WasteReason, string> = {
  damaged:    "Hasarlı / Kırık",
  expired:    "Son Kullanma Geçti",
  theft:      "Kayıp / Çalıntı",
  count_diff: "Sayım Farkı",
  sample:     "Numune / İkram",
  other:      "Diğer",
}

export const WASTE_REASON_OPTIONS: WasteReason[] = [
  "damaged", "expired", "theft", "count_diff", "sample", "other",
]

export interface RetailWaste {
  id:            string
  productId:     string | null
  productName:   string
  quantity:      number
  unitCost:      number
  totalCost:     number
  reason:        WasteReason
  note:          string | null
  createdBy:     string | null
  createdByName: string | null
  createdAt:     string
}

export interface DbRetailWasteRow {
  id:              string
  product_id:      string | null
  product_name:    string
  quantity:        number | string
  unit_cost:       number | string
  total_cost:      number | string
  reason:          string
  note:            string | null
  created_by:      string | null
  created_by_name: string | null
  created_at:      string
}

export function dbRowToWaste(r: DbRetailWasteRow): RetailWaste {
  return {
    id:            r.id,
    productId:     r.product_id,
    productName:   r.product_name,
    quantity:      Number(r.quantity) || 0,
    unitCost:      Number(r.unit_cost) || 0,
    totalCost:     Number(r.total_cost) || 0,
    reason:        (r.reason as WasteReason),
    note:          r.note,
    createdBy:     r.created_by,
    createdByName: r.created_by_name,
    createdAt:     r.created_at,
  }
}

// ─── Report aggregate ────────────────────────────────────────────────────────

export interface WasteReasonSlice { reason: WasteReason; qty: number; cost: number }
export interface WasteProductSlice { name: string; qty: number; cost: number }

export interface WasteReport {
  totalQty:    number
  totalCost:   number
  entryCount:  number
  byReason:    WasteReasonSlice[]
  topProducts: WasteProductSlice[]
}
