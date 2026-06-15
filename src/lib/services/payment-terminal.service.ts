// Payment Terminal Service
// Architecture foundation for POS device integration.
// Currently uses a mock terminal. Swap `activeTerminal` for a real provider
// (Ingenico, Verifone, iyzico POS, etc.) when hardware is available.

export type TerminalStatus = "idle" | "processing" | "approved" | "declined" | "cancelled" | "error"
export type TerminalProvider = "mock" | "ingenico" | "verifone" | "iyzico"

export interface TerminalPaymentRequest {
  amount: number          // TRY, in full units (e.g. 150 = ₺150)
  currency: "TRY"
  description: string
  sessionId?: string
  referenceId?: string    // unique per transaction
}

export interface TerminalPaymentResponse {
  success: boolean
  status: TerminalStatus
  transactionId: string
  amount: number
  authCode?: string       // bank auth code on approval
  maskedPan?: string      // e.g. "**** **** **** 1234"
  errorCode?: string
  errorMessage?: string
  providerRaw?: unknown   // raw response from terminal for logging
}

type StatusListener = (status: TerminalStatus) => void

// ─── Mock Terminal ────────────────────────────────────────────────────────────

async function processMockPayment(req: TerminalPaymentRequest): Promise<TerminalPaymentResponse> {
  // Simulates a 2-second terminal processing delay
  await new Promise((r) => setTimeout(r, 2000))

  // Always approve in mock mode (set MOCK_DECLINE=true to simulate decline)
  const decline = false
  if (decline) {
    return {
      success: false,
      status: "declined",
      transactionId: `MOCK-${Date.now()}`,
      amount: req.amount,
      errorCode: "DECLINED",
      errorMessage: "Kart reddedildi (mock)",
    }
  }

  return {
    success: true,
    status: "approved",
    transactionId: `MOCK-${Date.now()}`,
    amount: req.amount,
    authCode: `AUTH${Math.floor(Math.random() * 900000 + 100000)}`,
    maskedPan: "**** **** **** 4242",
    providerRaw: { provider: "mock", timestamp: new Date().toISOString() },
  }
}

// ─── Terminal Service ─────────────────────────────────────────────────────────

class PaymentTerminalService {
  private provider: TerminalProvider = "mock"
  private currentStatus: TerminalStatus = "idle"
  private listeners: StatusListener[] = []
  private abortController: AbortController | null = null

  setProvider(provider: TerminalProvider) {
    this.provider = provider
  }

  getProvider(): TerminalProvider {
    return this.provider
  }

  getStatus(): TerminalStatus {
    return this.currentStatus
  }

  onStatusChange(listener: StatusListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private setStatus(status: TerminalStatus) {
    this.currentStatus = status
    this.listeners.forEach((l) => l(status))
  }

  async processPayment(req: TerminalPaymentRequest): Promise<TerminalPaymentResponse> {
    if (this.currentStatus === "processing") {
      throw new Error("Terminal zaten işlem yapıyor")
    }

    this.abortController = new AbortController()
    this.setStatus("processing")

    try {
      let response: TerminalPaymentResponse

      switch (this.provider) {
        case "mock":
          response = await processMockPayment(req)
          break
        // Future providers:
        // case "ingenico": response = await processIngenicoPayment(req, this.abortController.signal); break
        // case "verifone":  response = await processVerifonePayment(req, this.abortController.signal); break
        // case "iyzico":    response = await processIyzicoPayment(req, this.abortController.signal); break
        default:
          throw new Error(`Desteklenmeyen terminal: ${this.provider}`)
      }

      this.setStatus(response.success ? "approved" : "declined")

      // Auto-reset to idle after a short delay
      setTimeout(() => this.setStatus("idle"), 3000)

      return response
    } catch (err) {
      this.setStatus("error")
      setTimeout(() => this.setStatus("idle"), 3000)
      throw err
    }
  }

  async cancelPayment(): Promise<void> {
    if (this.currentStatus !== "processing") return
    this.abortController?.abort()
    this.setStatus("cancelled")
    setTimeout(() => this.setStatus("idle"), 1000)
  }
}

// Singleton instance
export const paymentTerminal = new PaymentTerminalService()
