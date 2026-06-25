import { redirect } from "next/navigation"

// /print-test is the legacy URL — the canonical route is now /printer-test.
export default function PrintTestRedirect() {
  redirect("/printer-test")
}
