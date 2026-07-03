"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { canAccessRoute, defaultRouteForRole } from "@/lib/permissions"
import { LoadingScreen } from "./loading-screen"

interface RoleGuardProps {
  children: React.ReactNode
}

export function RoleGuard({ children }: RoleGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace("/login")
      return
    }
    if (!canAccessRoute(pathname, user)) {
      // Silently bounce the user to their own default landing page instead
      // of the 403 screen — a manager landing on `/perakende` shouldn't see
      // a red "Erişim Yok" splash, they should just be sent home.
      const home = defaultRouteForRole(user.role)
      router.replace(home === pathname ? "/403" : home)
    }
  }, [user, loading, pathname, router])

  if (loading) return <LoadingScreen />
  if (!user) return null
  if (!canAccessRoute(pathname, user)) return null

  return <>{children}</>
}
