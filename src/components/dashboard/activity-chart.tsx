"use client"

import { Card } from "@/components/ui/card"
import { hourlyData } from "@/lib/fake-data"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export function ActivityChart() {
  return (
    <Card className="p-6 rounded-2xl border-0 shadow-sm bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Günlük Yoğunluk</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Saatlik çocuk sayısı</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
            <span className="text-slate-500 dark:text-slate-400">Bugün</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={hourlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-800" />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              fontSize: "12px",
            }}
            labelStyle={{ fontWeight: 600, color: "#1e293b" }}
            formatter={(value) => [`${value} çocuk`, "Yoğunluk"]}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#8b5cf6"
            strokeWidth={2.5}
            fill="url(#colorCount)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: "#8b5cf6" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  )
}
