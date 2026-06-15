"use client"

import { ShieldOff } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { defaultRouteForRole } from "@/lib/permissions"
import Link from "next/link"

export default function ForbiddenPage() {
  const { user } = useAuth()
  const href = user ? defaultRouteForRole(user.role) : "/login"

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="text-center max-w-sm mx-4">
        <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
          <ShieldOff className="w-8 h-8 text-rose-500" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Erişim Yok</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Bu sayfayı görüntülemek için yeterli yetkiniz bulunmuyor.
        </p>
        <Link
          href={href}
          className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-2xl transition-colors"
        >
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  )
}
