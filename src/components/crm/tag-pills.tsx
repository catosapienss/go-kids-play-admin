"use client"

import { useState } from "react"
import { Check, Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { setCustomerTag } from "@/lib/services/customer.service"
import { TAG_LABEL, TAG_TONE, type WellKnownTag } from "@/types/customer"

// ─── TagPills ────────────────────────────────────────────────────────────────
//
// Reads + edits the parent's `tags` array. Manager+ roles can toggle tags;
// cashier view sees the pills read-only.

const ALL_TAGS: WellKnownTag[] = ["vip", "frequent", "organization", "unlimited"]

interface Props {
  parentId: string
  tags: string[]
  readOnly?: boolean
  onChange?: (newTags: string[]) => void
  className?: string
}

export function TagPills({ parentId, tags, readOnly, onChange, className }: Props) {
  const [pending, setPending] = useState<string | null>(null)

  async function toggle(tag: string) {
    if (readOnly || pending) return
    const active = tags.includes(tag)
    setPending(tag)
    try {
      const next = await setCustomerTag(parentId, tag, !active)
      onChange?.(next)
      toast.success(active ? "Etiket kaldırıldı" : "Etiket eklendi")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem başarısız")
    } finally {
      setPending(null)
    }
  }

  if (readOnly && tags.length === 0) return null

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {ALL_TAGS.map((tag) => {
        const active = tags.includes(tag)
        const tone = TAG_TONE[tag]
        const isPending = pending === tag
        // Read-only mode: only render the active tags.
        if (readOnly && !active) return null
        return (
          <button
            key={tag}
            type="button"
            disabled={readOnly || isPending}
            onClick={() => toggle(tag)}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all",
              active
                ? cn(tone?.bg, tone?.fg, "ring-1", tone?.ring)
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700",
              readOnly && "cursor-default",
              isPending && "opacity-60",
            )}
          >
            {isPending
              ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
              : active
              ? <Check className="w-2.5 h-2.5" />
              : <Plus className="w-2.5 h-2.5" />}
            {TAG_LABEL[tag] ?? tag}
          </button>
        )
      })}
    </div>
  )
}
