import { Phone, Mail, Clock, Shield, LogIn } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StaffMember } from "@/types/personel"
import { PERMISSION_LABELS } from "@/lib/personel-data"

const ROLE_META = {
  admin: { label: "Admin", bg: "bg-slate-800", text: "text-white", ring: "ring-slate-700" },
  manager: { label: "Yönetici", bg: "bg-violet-600", text: "text-white", ring: "ring-violet-500" },
  cashier: { label: "Kasiyer", bg: "bg-sky-600", text: "text-white", ring: "ring-sky-500" },
}

const STATUS_META = {
  active: { label: "Aktif", color: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-400", pulse: true },
  break: { label: "Molada", color: "text-amber-700 dark:text-amber-400", dot: "bg-amber-400", pulse: false },
  offline: { label: "Çevrimdışı", color: "text-slate-500", dot: "bg-slate-400", pulse: false },
}

const AVATAR_GRADIENTS: Record<string, string> = {
  "s_001": "from-slate-700 to-slate-900",
  "s_002": "from-violet-500 to-purple-700",
  "s_003": "from-sky-500 to-blue-600",
  "s_004": "from-emerald-500 to-teal-600",
}

export function ProfileCard({ staff }: { staff: StaffMember }) {
  const role = ROLE_META[staff.role]
  const status = STATUS_META[staff.status]
  const avatarGrad = AVATAR_GRADIENTS[staff.id] ?? "from-slate-500 to-slate-700"
  const enabledPerms = Object.entries(staff.permissions).filter(([, v]) => v).map(([k]) => k)

  return (
    <div className="space-y-4">
      {/* Profile hero */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {/* Banner */}
        <div className={cn("h-24 bg-gradient-to-r relative", role.bg === "bg-slate-800" ? "from-slate-800 to-slate-900" : role.bg === "bg-violet-600" ? "from-violet-600 to-purple-700" : "from-sky-500 to-sky-700")}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-20 translate-x-20" />
        </div>

        <div className="px-4 pb-4">
          {/* Avatar + name */}
          <div className="flex items-end gap-4 -mt-8 mb-4">
            <div className={cn("w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-2xl border-4 border-white dark:border-slate-900 shadow-md", avatarGrad)}>
              {staff.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div className="pb-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{staff.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg", role.bg, role.text)}>
                  {role.label}
                </span>
                <div className="flex items-center gap-1">
                  <div className="relative w-3 h-3 flex items-center justify-center">
                    <span className={cn("w-2 h-2 rounded-full", status.dot)} />
                    {status.pulse && <span className={cn("absolute w-2 h-2 rounded-full animate-ping opacity-60", status.dot)} />}
                  </div>
                  <span className={cn("text-[10px] font-semibold", status.color)}>{status.label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Contact info */}
          <div className="space-y-2">
            {[
              { icon: Phone, value: staff.phone },
              { icon: Mail, value: staff.email },
              { icon: LogIn, value: `Giriş: ${staff.loginTime}` },
              { icon: Clock, value: `Son aktivite: ${staff.lastActivity}` },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.value} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400">
                  <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>{item.value}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Permissions */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Shield className="w-4 h-4 text-violet-500" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Yetkiler</p>
          <span className="ml-auto text-xs text-slate-400">{enabledPerms.length}/{Object.keys(staff.permissions).length}</span>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(staff.permissions).map(([perm, allowed]) => {
            const meta = PERMISSION_LABELS[perm]
            return (
              <div
                key={perm}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-colors",
                  allowed
                    ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600"
                )}
              >
                <div className={cn("w-4 h-4 rounded flex items-center justify-center flex-shrink-0", allowed ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}>
                  <span className="text-white text-[9px] font-bold">{allowed ? "✓" : "×"}</span>
                </div>
                {meta?.label ?? perm}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
