import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { recentTransactions } from "@/lib/fake-data"
import { ArrowRight } from "lucide-react"

export function RecentTransactions() {
  return (
    <Card className="p-6 rounded-2xl border-0 shadow-sm bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Son İşlemler</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Bugünkü hareketler</p>
        </div>
        <button className="text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 font-medium">
          Tümü <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <div className="space-y-3">
        {recentTransactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-500/20 dark:to-purple-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 text-xs font-bold flex-shrink-0">
              {tx.child.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{tx.child}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{tx.name} • {tx.time}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <Badge
                variant={tx.type === "Çıkış" ? "secondary" : "default"}
                className={
                  tx.type === "Çıkış"
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-0 text-[10px]"
                    : tx.type === "Doğum Günü"
                    ? "bg-pink-100 dark:bg-pink-500/10 text-pink-700 dark:text-pink-400 border-0 text-[10px]"
                    : "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0 text-[10px]"
                }
              >
                {tx.type}
              </Badge>
              {tx.amount > 0 && (
                <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">₺{tx.amount}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
