"use client"

import { useState } from "react"
import { Check, X, Shield, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { PERMISSION_LABELS } from "@/lib/personel-data"
import type { PermissionKey } from "@/types/personel"

const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as PermissionKey[]

const DEFAULT_ROLES: Record<string, Record<PermissionKey, boolean>> = {
  admin: Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true])) as Record<PermissionKey, boolean>,
  manager: {
    take_payment: true, process_refund: true, cancel_session: true,
    view_reports: true, manage_staff: false, manage_organizations: true,
    manage_wallet: true, view_security_logs: false, modify_prices: false, export_data: true,
  },
  cashier: {
    take_payment: true, process_refund: false, cancel_session: true,
    view_reports: false, manage_staff: false, manage_organizations: false,
    manage_wallet: false, view_security_logs: false, modify_prices: false, export_data: false,
  },
}

const ROLE_LABELS = {
  admin: { label: "Admin", color: "text-slate-100 bg-slate-800", headerBg: "bg-slate-800" },
  manager: { label: "Yönetici", color: "text-violet-700 bg-violet-100", headerBg: "bg-violet-600" },
  cashier: { label: "Kasiyer", color: "text-sky-700 bg-sky-100", headerBg: "bg-sky-600" },
}

export function PermissionMatrix() {
  const [permissions, setPermissions] = useState(DEFAULT_ROLES)
  const [hoveredPerm, setHoveredPerm] = useState<PermissionKey | null>(null)

  function toggle(role: string, perm: PermissionKey) {
    if (role === "admin") return
    setPermissions((prev) => ({
      ...prev,
      [role]: { ...prev[role], [perm]: !prev[role][perm] },
    }))
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <Shield className="w-4 h-4 text-violet-500" />
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Rol Yetki Matrisi</p>
        <span className="text-[10px] text-slate-400 ml-auto">Admin yetkileri değiştirilemez</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-48">
                Yetki
              </th>
              {(Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[]).map((role) => (
                <th key={role} className="px-4 py-3 text-center">
                  <span className={cn("inline-block px-3 py-1 rounded-lg text-xs font-bold text-white", ROLE_LABELS[role].headerBg)}>
                    {ROLE_LABELS[role].label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {PERMISSION_KEYS.map((perm) => {
              const meta = PERMISSION_LABELS[perm]
              return (
                <tr
                  key={perm}
                  className={cn(
                    "transition-colors",
                    hoveredPerm === perm ? "bg-violet-50 dark:bg-violet-500/5" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  )}
                  onMouseEnter={() => setHoveredPerm(perm)}
                  onMouseLeave={() => setHoveredPerm(null)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-1.5">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{meta.label}</p>
                        {hoveredPerm === perm && (
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Info className="w-2.5 h-2.5 flex-shrink-0" />
                            {meta.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  {(Object.keys(ROLE_LABELS) as string[]).map((role) => {
                    const allowed = permissions[role]?.[perm] ?? false
                    const isAdmin = role === "admin"
                    return (
                      <td key={role} className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggle(role, perm)}
                          disabled={isAdmin}
                          className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all",
                            allowed
                              ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600",
                            !isAdmin && "hover:scale-110 cursor-pointer",
                            isAdmin && "cursor-default"
                          )}
                        >
                          {allowed
                            ? <Check className="w-3.5 h-3.5" />
                            : <X className="w-3.5 h-3.5" />
                          }
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Save button */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
        <button className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 transition-colors">
          Varsayılana Dön
        </button>
        <button className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm">
          Değişiklikleri Kaydet
        </button>
      </div>
    </div>
  )
}
