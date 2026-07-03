"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { canAccessRoute } from "@/lib/permissions"
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
      router.replace("/403")
    }
  }, [user, loading, pathname, router])

  if (loading) return <LoadingScreen />
  if (!user) return null
  if (!canAccessRoute(pathname, user)) return null

  return <>{children}</>
}
