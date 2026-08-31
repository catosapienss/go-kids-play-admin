"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff, Loader2, AlertCircle, User } from "lucide-react"
import { ARCHIVED_ACCOUNT_ERROR, useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { BrandLogo, BrandAccentStrip } from "@/components/brand-logo"
import { BRAND } from "@/lib/brand"
import { normalizeUsername } from "@/lib/auth/username"

export default function LoginPage() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("gkp_remember_username")
    if (saved) {
      setUsername(saved)
      setRemember(true)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = normalizeUsername(username)
    if (!cleaned || !password) {
      setError("Lütfen kullanıcı adı ve şifrenizi girin.")
      return
    }
    setError("")
    setLoading(true)

    try {
      if (remember) {
        localStorage.setItem("gkp_remember_username", cleaned)
      } else {
        localStorage.removeItem("gkp_remember_username")
      }
      await signIn(cleaned, password)
      toast.success("Giriş başarılı. Hoş geldiniz.")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Giriş başarısız."
      const turkishError =
        // Archived employee — either the app-side profile guard or the
        // auth-server ban set by migration 041.
        message.includes(ARCHIVED_ACCOUNT_ERROR) ||
        message.includes("banned") || message.includes("User is banned")
          ? "Bu hesap devre dışı bırakılmış. Yöneticinizle iletişime geçin."
          : message.includes("Invalid login") || message.includes("invalid_credentials")
          ? "Kullanıcı adı veya şifre hatalı."
          : message.includes("Email not confirmed")
          ? "Hesap doğrulanmamış. Yöneticinizle iletişime geçin."
          : "Giriş yapılamadı. Lütfen tekrar deneyin."
      setError(turkishError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
      {/* Ambient gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-[120px]"
          style={{ background: `${BRAND.mark.sky}1a` }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{ background: `${BRAND.mark.pink}14` }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-violet-600/[0.06] blur-[80px]" />
      </div>

      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "radial-gradient(circle, #a78bfa 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Card */}
      <div
        className={cn(
          "relative w-full max-w-md mx-4 transition-all duration-700",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        )}
      >
        <div className="relative bg-white/[0.04] backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-2xl shadow-black/40 overflow-hidden">
          <BrandAccentStrip className="opacity-70" />

          <div className="p-8">
            {/* Logo + branding */}
            <div className="flex flex-col items-center mb-7">
              <BrandLogo variant="hero" size="xl" on="dark" />
              <p className="text-[11px] tracking-widest uppercase text-white/35 mt-4 font-semibold">
                Operasyon · Yönetim · Mutabakat
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl px-4 py-3 text-rose-300 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                  Kullanıcı Adı
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError("") }}
                    placeholder="kullanici"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-white/25 text-sm outline-none focus:border-violet-500/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                  Şifre
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError("") }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                    className="w-full px-4 py-3 pr-11 rounded-2xl bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-white/25 text-sm outline-none focus:border-violet-500/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-violet-500/20 transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/60 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <div
                    onClick={() => setRemember(!remember)}
                    className={cn(
                      "w-4 h-4 rounded flex items-center justify-center border transition-all",
                      remember
                        ? "bg-violet-500 border-violet-500"
                        : "border-white/20 bg-white/[0.06] group-hover:border-white/40",
                    )}
                  >
                    {remember && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-white/50 select-none group-hover:text-white/70 transition-colors">
                    Beni hatırla
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full py-3.5 rounded-2xl font-bold text-sm text-white transition-all duration-200 flex items-center justify-center gap-2 mt-2",
                  loading
                    ? "bg-violet-600/60 cursor-not-allowed"
                    : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 active:scale-[0.98]",
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Giriş yapılıyor…
                  </>
                ) : (
                  "Giriş Yap"
                )}
              </button>
            </form>

            <p className="text-[11px] text-white/30 text-center mt-6 leading-relaxed">
              Şifre veya PIN sıfırlama için yöneticinizle iletişime geçin.
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] text-white/25 mt-5">
          <span className="font-semibold">Go Kids Play</span>
          <span className="opacity-50"> · Yönetim Sistemi · © 2026</span>
        </p>
      </div>
    </div>
  )
}
