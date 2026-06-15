"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertOctagon, RefreshCw, Home } from "lucide-react"
import Link from "next/link"
import { createLogger } from "@/lib/reliability/logger"

const log = createLogger("error-boundary")

// ─── React error boundary ─────────────────────────────────────────────────────
//
// Last line of defence against render-time crashes. Anything thrown during
// render of a child tree is caught and replaced with a friendly fallback +
// "Tekrar dene" button. The boundary itself never throws.

interface Props {
  /** Optional custom fallback. Receives the error + a reset() handler. */
  fallback?: (error: Error, reset: () => void) => ReactNode
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    log.error("render error", { componentStack: info.componentStack }, error)
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    if (this.props.fallback) {
      return this.props.fallback(this.state.error, this.reset)
    }

    return <DefaultFallback error={this.state.error} reset={this.reset} />
  }
}

// ─── Default fallback UI ─────────────────────────────────────────────────────

function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-xl shadow-slate-900/5 dark:shadow-black/30">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
          <AlertOctagon className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
          Bir şeyler ters gitti
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Beklenmedik bir hata oluştu. Sayfayı yenileyebilir veya ana sayfaya dönebilirsiniz.
        </p>

        {process.env.NODE_ENV !== "production" && (
          <pre className="text-[10px] text-left text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/5 rounded-lg p-3 mb-4 overflow-x-auto max-h-32">
            {error.message}
          </pre>
        )}

        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tekrar dene
          </button>
          <Link
            href="/"
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Ana sayfa
          </Link>
        </div>
      </div>
    </div>
  )
}
