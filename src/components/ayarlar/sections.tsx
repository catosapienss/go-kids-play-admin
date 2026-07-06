"use client"

import { Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSettings } from "@/lib/settings/settings-store"
import { DEFAULT_SETTINGS } from "@/types/settings"
import {
  SectionHeader, FieldGroup, Field,
  TextInput, NumberInput, Toggle, Segmented, SaveBar, useSavedFlag,
} from "./atoms"

// ─── Section: Genel ──────────────────────────────────────────────────────────

export function SectionGeneral() {
  const { settings, update, replace } = useSettings()
  const s = settings.general
  const [saved, flag] = useSavedFlag()

  function up(patch: Partial<typeof s>) {
    update("general", patch)
    flag()
  }

  return (
    <>
      <SectionHeader title="Genel Bilgiler" hint="Şube kimliği, iletişim, dil ve zaman dilimi" />

      <FieldGroup title="Şube">
        <Field label="Şube adı" hint="Sidebar başlığında ve TV ekranında görünür">
          <TextInput value={s.branchName} onChange={(v) => up({ branchName: v })} placeholder="Merkez Şube" />
        </Field>
        <Field label="İşletme adı">
          <TextInput value={s.businessName} onChange={(v) => up({ businessName: v })} placeholder="Go Kids Play" />
        </Field>
      </FieldGroup>

      <FieldGroup title="İletişim">
        <Field label="Adres">
          <TextInput value={s.businessAddress} onChange={(v) => up({ businessAddress: v })} placeholder="Mahalle, sokak, ilçe" />
        </Field>
        <Field label="Telefon">
          <TextInput value={s.businessPhone} onChange={(v) => up({ businessPhone: v })} placeholder="0212 000 00 00" />
        </Field>
      </FieldGroup>

      <FieldGroup title="Yerelleştirme">
        <Field label="Dil" inline>
          <Segmented
            value={s.language}
            onChange={(v) => up({ language: v })}
            options={[
              { value: "tr", label: "Türkçe" },
              { value: "en", label: "English" },
            ]}
          />
        </Field>
        <Field label="Zaman dilimi" inline hint="Raporlar bu zaman dilimine göre gruplanır">
          <TextInput value={s.timezone} onChange={(v) => up({ timezone: v })} className="w-56" />
        </Field>
      </FieldGroup>

      <SaveBar saved={saved} onReset={() => replace("general", DEFAULT_SETTINGS.general)} />
    </>
  )
}

// ─── Section: Paketler ───────────────────────────────────────────────────────

export function SectionPackages() {
  const { settings, update, replace } = useSettings()
  const s = settings.packages
  const [saved, flag] = useSavedFlag()

  function updateItem(id: string, patch: Partial<(typeof s.items)[number]>) {
    replace("packages", { ...s, items: s.items.map((it) => it.id === id ? { ...it, ...patch } : it) })
    flag()
  }
  function addItem() {
    const newItem = { id: `pkg_${Date.now()}`, label: "Yeni Paket", durationMin: 60, price: 150, active: true }
    replace("packages", { ...s, items: [...s.items, newItem] })
    flag()
  }
  function removeItem(id: string) {
    if (!confirm("Bu paket kalıcı olarak silinecek. Emin misin?")) return
    replace("packages", { ...s, items: s.items.filter((it) => it.id !== id) })
    flag()
  }

  return (
    <>
      <SectionHeader title="Paketler & Fiyatlar" hint="Aktif paketleri yönet, fiyatları güncelle, uzatma ücretini ayarla" />

      <FieldGroup title="Aktif paketler">
        <div className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_110px_90px_44px] gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800/40 text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <span>Ad</span>
            <span className="text-right">Süre</span>
            <span className="text-right">Fiyat</span>
            <span className="text-center">Aktif</span>
            <span />
          </div>
          {s.items.map((it) => (
            <div key={it.id} className="grid grid-cols-[1fr_120px_110px_90px_44px] gap-3 px-4 py-2.5 items-center border-b border-slate-100 dark:border-slate-800/60 last:border-b-0">
              <TextInput value={it.label} onChange={(v) => updateItem(it.id, { label: v })} />
              <NumberInput value={it.durationMin} onChange={(v) => updateItem(it.id, { durationMin: v })} min={0} suffix="dk" />
              <NumberInput value={it.price} onChange={(v) => updateItem(it.id, { price: v })} min={0} step={10} suffix="₺" />
              <div className="flex justify-center">
                <Toggle checked={it.active} onChange={(v) => updateItem(it.id, { active: v })} />
              </div>
              <button
                type="button"
                onClick={() => removeItem(it.id)}
                aria-label="Paketi sil"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="w-full px-4 py-3 flex items-center justify-center gap-2 text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 border-t border-dashed border-slate-200 dark:border-slate-700"
          >
            <Plus className="w-3.5 h-3.5" />
            Yeni paket ekle
          </button>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Süre <strong>0</strong> girersen sınırsız paket olarak işlenir. Pasif paketler hızlı kayıt ekranında görünmez ama mevcut oturumlar bozulmaz.
        </p>
      </FieldGroup>

      <FieldGroup title="Uzatma & vergi">
        <Field label="15 dakikalık uzatma ücreti" inline>
          <NumberInput value={s.extensionPricePer15Min} onChange={(v) => { update("packages", { extensionPricePer15Min: v }); flag() }} min={0} step={5} suffix="₺" />
        </Field>
        <Field label="KDV oranı" inline hint="Fiyatlara dahildir (raporlarda ayrıştırılır)">
          <NumberInput value={s.taxRate} onChange={(v) => { update("packages", { taxRate: v }); flag() }} min={0} max={50} step={1} suffix="%" />
        </Field>
      </FieldGroup>

      <SaveBar saved={saved} onReset={() => replace("packages", DEFAULT_SETTINGS.packages)} />
    </>
  )
}

// ─── Section: Operasyon ──────────────────────────────────────────────────────

export function SectionOperations() {
  const { settings, update, replace } = useSettings()
  const s = settings.operations
  const [saved, flag] = useSavedFlag()
  const up = (patch: Partial<typeof s>) => { update("operations", patch); flag() }

  return (
    <>
      <SectionHeader title="Operasyon Kuralları" hint="Duraklatma, iade, oto-bitiş ve etkinlik varsayılanları" />

      <FieldGroup title="Süre yönetimi">
        <Field label="Maksimum duraklatma süresi" inline hint="Bu süreyi aşan duraklamalar otomatik sonlanır">
          <NumberInput value={s.maxPauseMinutes} onChange={(v) => up({ maxPauseMinutes: v })} min={5} max={240} step={5} suffix="dk" />
        </Field>
        <Field label="Oto-bitiş tolerans süresi" inline hint="Süre dolduktan sonra çocuk hâlâ içerideyse kaç dakika beklenir">
          <NumberInput value={s.autoEndGraceMinutes} onChange={(v) => up({ autoEndGraceMinutes: v })} min={0} max={30} step={1} suffix="dk" />
        </Field>
        <Field label="Süre uyarısı eşiği" inline hint="Bu süre kalınca veliye/personele uyarı gider">
          <NumberInput value={s.warnOnExpireMinutes} onChange={(v) => up({ warnOnExpireMinutes: v })} min={5} max={30} step={5} suffix="dk" />
        </Field>
      </FieldGroup>

      <FieldGroup title="İade & limitler">
        <Field label="İade zaman aşımı" inline hint="Bu süreden sonra iade işlemi yapılamaz">
          <NumberInput value={s.refundTimeLimitMinutes} onChange={(v) => up({ refundTimeLimitMinutes: v })} min={5} max={240} step={5} suffix="dk" />
        </Field>
        <Field label="Tek oturumda maks kardeş sayısı" inline>
          <NumberInput value={s.maxSiblingsPerSession} onChange={(v) => up({ maxSiblingsPerSession: v })} min={1} max={10} step={1} suffix="çocuk" />
        </Field>
        <Field label="Varsayılan organizasyon çocuk sayısı" inline>
          <NumberInput value={s.defaultEventChildCount} onChange={(v) => up({ defaultEventChildCount: v })} min={1} max={50} step={1} suffix="çocuk" />
        </Field>
      </FieldGroup>

      <SaveBar saved={saved} onReset={() => replace("operations", DEFAULT_SETTINGS.operations)} />
    </>
  )
}

// ─── Section: TV ─────────────────────────────────────────────────────────────

export function SectionTv() {
  const { settings, update, replace } = useSettings()
  const s = settings.tv
  const [saved, flag] = useSavedFlag()
  const up = (patch: Partial<typeof s>) => { update("tv", patch); flag() }

  return (
    <>
      <SectionHeader title="TV Ekranı" hint="Salon ekranı görünüm tercihleri (uzak ekranlar dahil)" />

      <FieldGroup title="Görünüm">
        <Field label="Yerleşim modu" inline hint="Otomatik mod aktif çocuk sayısına göre adapte olur">
          <Segmented
            value={s.displayMode}
            onChange={(v) => up({ displayMode: v })}
            options={[
              { value: "auto",    label: "Oto" },
              { value: "compact", label: "Kompakt" },
              { value: "regular", label: "Normal" },
              { value: "large",   label: "Büyük" },
              { value: "minimal", label: "Minimal" },
            ]}
          />
        </Field>
        <Field label="Renk teması" inline>
          <Segmented
            value={s.accentPreset}
            onChange={(v) => up({ accentPreset: v })}
            options={[
              { value: "violet", label: "Mor" },
              { value: "ocean",  label: "Okyanus" },
              { value: "sunset", label: "Gün Batımı" },
              { value: "forest", label: "Orman" },
              { value: "mono",   label: "Mono" },
            ]}
          />
        </Field>
      </FieldGroup>

      <FieldGroup title="Davranış">
        <Field label="Markalama göster" hint="Logo + Go Kids Play yazısı" inline>
          <Toggle checked={s.showBranding} onChange={(v) => up({ showBranding: v })} />
        </Field>
        <Field label="Saat göster" inline>
          <Toggle checked={s.showLiveClock} onChange={(v) => up({ showLiveClock: v })} />
        </Field>
        <Field label="Sinema modu (imleç gizleme)" hint="4 saniye hareketsizlikten sonra imleci gizle" inline>
          <Toggle checked={s.cinemaCursorHide} onChange={(v) => up({ cinemaCursorHide: v })} />
        </Field>
      </FieldGroup>

      <div className="mt-4">
        <a
          href="/tv/live"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl",
            "bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold",
          )}
        >
          Canlı ekranı önizle ↗
        </a>
      </div>

      <SaveBar saved={saved} onReset={() => replace("tv", DEFAULT_SETTINGS.tv)} />
    </>
  )
}

// ─── Section: Ödeme ──────────────────────────────────────────────────────────

export function SectionPayments() {
  const { settings, update, replace } = useSettings()
  const s = settings.payments
  const [saved, flag] = useSavedFlag()
  const up = (patch: Partial<typeof s>) => { update("payments", patch); flag() }

  return (
    <>
      <SectionHeader title="Ödeme" hint="Split payment, cüzdan bonus kuralları, POS entegrasyonu" />

      <FieldGroup title="Ödeme yöntemleri">
        <Field label="Split payment (nakit + kart + cüzdan)" hint="Aynı ödemede birden fazla yöntem" inline>
          <Toggle checked={s.allowSplitPayment} onChange={(v) => up({ allowSplitPayment: v })} />
        </Field>
        <Field label="Dijital cüzdan" hint="Velilerin bakiye yükleyebilmesi" inline>
          <Toggle checked={s.walletEnabled} onChange={(v) => up({ walletEnabled: v })} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Cüzdan bonusları">
        <Field label="500 ₺ üzeri yükleme bonusu" inline>
          <NumberInput value={s.walletBonusOn500} onChange={(v) => up({ walletBonusOn500: v })} min={0} max={500} step={5} suffix="₺" />
        </Field>
        <Field label="1000 ₺ üzeri yükleme bonusu" inline>
          <NumberInput value={s.walletBonusOn1000} onChange={(v) => up({ walletBonusOn1000: v })} min={0} max={1000} step={5} suffix="₺" />
        </Field>
      </FieldGroup>

      <FieldGroup title="İade & POS">
        <Field label="Varsayılan iade yöntemi" inline>
          <Segmented
            value={s.defaultRefundMethod}
            onChange={(v) => up({ defaultRefundMethod: v })}
            options={[
              { value: "wallet", label: "Cüzdan" },
              { value: "cash",   label: "Nakit" },
            ]}
          />
        </Field>
        <Field label="POS entegrasyonu" inline hint="Şu an simülasyon modu — sonra gerçek sağlayıcı seçilir">
          <Segmented
            value={s.posIntegration}
            onChange={(v) => up({ posIntegration: v })}
            options={[
              { value: "none",    label: "Yok" },
              { value: "stripe",  label: "Stripe" },
              { value: "iyzico",  label: "iyzico" },
              { value: "paytr",   label: "PayTR" },
            ]}
          />
        </Field>
      </FieldGroup>

      <SaveBar saved={saved} onReset={() => replace("payments", DEFAULT_SETTINGS.payments)} />
    </>
  )
}

// ─── Section: Bildirim ───────────────────────────────────────────────────────

export function SectionNotifications() {
  const { settings, update, replace } = useSettings()
  const s = settings.notifications
  const [saved, flag] = useSavedFlag()
  const up = (patch: Partial<typeof s>) => { update("notifications", patch); flag() }

  return (
    <>
      <SectionHeader title="Bildirim & Uyarı" hint="Süre bitiş eşikleri, etkinlik hatırlatıcıları, ses davranışı" />

      <FieldGroup title="Süre uyarıları">
        <Field label="Sarı uyarı eşiği" inline hint="Bu süre kaldığında amber alarm">
          <NumberInput value={s.sessionEndingWarnMin} onChange={(v) => up({ sessionEndingWarnMin: v })} min={3} max={30} step={1} suffix="dk" />
        </Field>
        <Field label="Kırmızı uyarı eşiği" inline hint="Bu süre kaldığında kritik alarm + sticky strip">
          <NumberInput value={s.sessionEndingCriticalMin} onChange={(v) => up({ sessionEndingCriticalMin: v })} min={1} max={10} step={1} suffix="dk" />
        </Field>
      </FieldGroup>

      <FieldGroup title="Etkinlik">
        <Field label="Etkinlik hatırlatma süresi" inline hint="Organizasyon başlamadan kaç dakika önce">
          <NumberInput value={s.eventReminderMin} onChange={(v) => up({ eventReminderMin: v })} min={15} max={180} step={15} suffix="dk" />
        </Field>
      </FieldGroup>

      <FieldGroup title="Davranış">
        <Field label="Operasyonel uyarılar" hint="POS hatası, sync sorunu vb sistem uyarıları" inline>
          <Toggle checked={s.operationalWarnings} onChange={(v) => up({ operationalWarnings: v })} />
        </Field>
        <Field label="Bildirim sesleri" hint="Yeni bildirim geldiğinde ses çal" inline>
          <Toggle checked={s.soundsEnabled} onChange={(v) => up({ soundsEnabled: v })} />
        </Field>
      </FieldGroup>

      <SaveBar saved={saved} onReset={() => replace("notifications", DEFAULT_SETTINGS.notifications)} />
    </>
  )
}

// ─── Section: Personel ───────────────────────────────────────────────────────

export function SectionStaff() {
  const { settings, update, replace } = useSettings()
  const s = settings.staff
  const [saved, flag] = useSavedFlag()
  const up = (patch: Partial<typeof s>) => { update("staff", patch); flag() }

  return (
    <>
      <SectionHeader title="Personel Kuralları" hint="Otomatik kilit, vardiya zorunluluğu, yetki gerektiren işlemler" />

      <FieldGroup title="Güvenlik">
        <Field label="Otomatik kilit süresi" inline hint="Hareketsizlik sonrası ekran kilitlenir">
          <NumberInput value={s.autoLockMinutes} onChange={(v) => up({ autoLockMinutes: v })} min={5} max={120} step={5} suffix="dk" />
        </Field>
        <Field label="Vardiya açılışı zorunlu" hint="Kasiyer vardiyasını açmadan işlem yapamaz" inline>
          <Toggle checked={s.requireShiftOpening} onChange={(v) => up({ requireShiftOpening: v })} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Onay gerektiren işlemler">
        <Field label="İade işlemi yönetici onayı ister" inline>
          <Toggle checked={s.refundRequiresManager} onChange={(v) => up({ refundRequiresManager: v })} />
        </Field>
        <Field label="Kasa kapanışı yönetici onayı ister" inline>
          <Toggle checked={s.cashCloseRequiresManager} onChange={(v) => up({ cashCloseRequiresManager: v })} />
        </Field>
      </FieldGroup>

      <SaveBar saved={saved} onReset={() => replace("staff", DEFAULT_SETTINGS.staff)} />
    </>
  )
}

// ─── Section: Yazıcı ─────────────────────────────────────────────────────────

export function SectionPrinter() {
  const { settings, update, replace } = useSettings()
  const s = settings.printer
  const [saved, flag] = useSavedFlag()
  const up = (patch: Partial<typeof s>) => { update("printer", patch); flag() }

  return (
    <>
      <SectionHeader
        title="Yazıcı"
        hint="XPrinter XP-470B etiket boyutu ve otomatik yazdırma"
      />

      <FieldGroup title="Cihaz">
        <Field label="Yazıcı adı" hint="Sistem yazdırma diyaloğunda görünen ad — XP-470B'yi seçeceksin">
          <TextInput value={s.printerName} onChange={(v) => up({ printerName: v })} placeholder="XP-470B" />
        </Field>
      </FieldGroup>

      <FieldGroup title="Etiket Boyutu">
        <Field label="Genişlik" inline hint="Termal etiket genişliği (mm)">
          <NumberInput value={s.labelWidthMm} onChange={(v) => up({ labelWidthMm: v })} min={20} max={120} step={1} suffix="mm" />
        </Field>
        <Field label="Yükseklik" inline hint="Termal etiket yüksekliği (mm)">
          <NumberInput value={s.labelHeightMm} onChange={(v) => up({ labelHeightMm: v })} min={15} max={120} step={1} suffix="mm" />
        </Field>
      </FieldGroup>

      <FieldGroup title="Davranış">
        <Field
          label="Kayıttan sonra otomatik yazdır"
          inline
          hint="Açıksa: hızlı kayıt başarılı olur olmaz çocuk + veli etiketlerini yazdırır"
        >
          <Toggle checked={s.autoPrintEnabled} onChange={(v) => up({ autoPrintEnabled: v })} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Test">
        <Field label="Test sayfası" hint="Üretim verisine dokunmadan sahte etiket bas">
          <a
            href="/printer-test"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-500"
          >
            🖨 Test Yazdır
          </a>
        </Field>
      </FieldGroup>

      <SaveBar saved={saved} onReset={() => replace("printer", DEFAULT_SETTINGS.printer)} />
    </>
  )
}

// ─── Section: Süre Uzatma Fiyatları ─────────────────────────────────────────

export function SectionPricing() {
  const { settings, update, replace } = useSettings()
  const s = settings.pricing
  const [saved, flag] = useSavedFlag()
  const up = (patch: Partial<typeof s>) => { update("pricing", patch); flag() }

  return (
    <>
      <SectionHeader
        title="Süre Uzatma Fiyatları"
        hint="Aktif oyun ekranında 'Süre Uzat' modal'ında görünen tarifeler"
      />

      <FieldGroup title="Uzatma Seçenekleri">
        <Field label="+30 dakika" inline hint="Mevcut paketin üstüne 30 dakika eklenir">
          <NumberInput value={s.extension30Min} onChange={(v) => up({ extension30Min: v })}
                       min={0} max={5000} step={5} suffix="₺" />
        </Field>
        <Field label="+60 dakika" inline hint="Mevcut paketin üstüne 60 dakika eklenir">
          <NumberInput value={s.extension60Min} onChange={(v) => up({ extension60Min: v })}
                       min={0} max={5000} step={5} suffix="₺" />
        </Field>
        <Field label="Sınırsıza yükselt" inline hint="Mevcut oturumu sınırsız pakete dönüştürür">
          <NumberInput value={s.unlimitedUpgrade} onChange={(v) => up({ unlimitedUpgrade: v })}
                       min={0} max={5000} step={5} suffix="₺" />
        </Field>
      </FieldGroup>

      <SaveBar saved={saved} onReset={() => replace("pricing", DEFAULT_SETTINGS.pricing)} />
    </>
  )
}

// ─── Section: İndirim Yetkileri ─────────────────────────────────────────────

export function SectionDiscounts() {
  const { settings, update, replace } = useSettings()
  const s = settings.discounts
  const [saved, flag] = useSavedFlag()
  const up = (patch: Partial<typeof s>) => { update("discounts", patch); flag() }

  return (
    <>
      <SectionHeader
        title="İndirim Yetkileri"
        hint="Hızlı Kayıt ekranında uygulanan indirimler için kullanıcı rolüne göre limit"
      />

      <FieldGroup title="Rol Bazlı Maksimum İndirim">
        <Field label="Personel" inline hint="Tek işlemde personelin uygulayabileceği maksimum ₺ indirim">
          <NumberInput value={s.staffMaxDiscount} onChange={(v) => up({ staffMaxDiscount: v })}
                       min={0} max={5000} step={10} suffix="₺" />
        </Field>
        <Field label="Yönetici (Manager)" inline hint="Tek işlemde yöneticinin uygulayabileceği maksimum ₺ indirim">
          <NumberInput value={s.managerMaxDiscount} onChange={(v) => up({ managerMaxDiscount: v })}
                       min={0} max={20000} step={10} suffix="₺" />
        </Field>
        <Field label="Admin / Sahip" inline hint="Sınırsız — limit uygulanmaz">
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">∞ Sınırsız</span>
        </Field>
      </FieldGroup>

      <FieldGroup title="Genel">
        <Field label="Yüzde indirim aktif" inline hint="Kapatırsan kasada sadece sabit ₺ seçeneği görünür">
          <Toggle checked={s.allowPercentDiscount} onChange={(v) => up({ allowPercentDiscount: v })} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Perakende İndirim Yetkileri">
        <Field label="Perakende indirimi aktif" inline hint="Personel çorap, boyama vb. ürünlere indirim uygulayabilir">
          <Toggle checked={s.retailDiscountEnabled} onChange={(v) => up({ retailDiscountEnabled: v })} />
        </Field>
        <Field label="Manuel fiyat (override) izni" inline hint="Personel ürünü özel bir fiyata satabilir — ürün fiyatı değişmez">
          <Toggle checked={s.retailPriceOverride} onChange={(v) => up({ retailPriceOverride: v })} />
        </Field>
        <Field label="Personel maks. perakende indirimi" inline hint="Satır başına personelin uygulayabileceği maksimum ₺ indirim (0 = sınırsız)">
          <NumberInput value={s.retailMaxDiscount} onChange={(v) => up({ retailMaxDiscount: v })}
                       min={0} max={5000} step={10} suffix="₺" />
        </Field>
        <Field label="Admin / Yönetici" inline hint="Her zaman indirim + manuel fiyat uygulayabilir">
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">∞ Sınırsız</span>
        </Field>
      </FieldGroup>

      <SaveBar saved={saved} onReset={() => replace("discounts", DEFAULT_SETTINGS.discounts)} />
    </>
  )
}
