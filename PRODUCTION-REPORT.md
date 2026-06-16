# Go Kids Play — Production Hardening Report

**Tarih:** 2026-06-17
**Sürüm:** v3.0 (Production User Management)
**Repo:** https://github.com/catosapienss/go-kids-play-admin
**Deploy:** Vercel (auto-deploy from `main`)

Bu rapor, 5-fazlı production geçişinin sonucunu özetler. Demo davranışı çıkarıldı, gerçek kullanıcı/izin/PIN sistemi kuruldu, finance koruması eklendi, doğum günü paketleri yönetilebilir hale geldi.

---

## 1. Yeni İzin Modeli

Sistem artık **role + per-user override** ikilisiyle çalışır:

```
   Effective Access = Per-user Override (varsa)
                    OR
                    Role Default
```

### Rol → Modül varsayılanları

| Modül | Admin | Manager | Staff |
| --- | :---: | :---: | :---: |
| Dashboard | ✓ | ✓ | ✗ |
| Müşteriler | ✓ | ✓ | ✗ |
| Üyelikler | ✓ | ✓ | ✗ |
| Cüzdan | ✓ | ✓ | ✗ |
| Doğum Günleri | ✓ | ✓ | ✗ |
| Raporlar | ✓ | ✓ | ✗ |
| **Finans** | ✓ | **✗** | ✗ |
| **Personel Yönetimi** | ✓ | **✗** | ✗ |
| **Ayarlar** | ✓ | **✗** | ✗ |
| TV / Canlı Ekran | ✓ | ✓ | ✗ |

> **Finans, Personel ve Ayarlar** manager için varsayılan olarak kapalı.
> Admin `/personeller → Hesaplar` ekranından kişi bazlı açabilir.

### Override saklama

- `public.profiles.permissions` → JSONB
- `{}` (boş) = sadece rol varsayılanlarını kullan
- `{"finance": true}` = grant override
- `{"finance": false}` = revoke override
- Override `null` ya da `undefined` ise rol varsayılanına döner

### Yardımcılar

- `DEFAULT_MODULE_ACCESS` → [src/lib/permissions.ts](src/lib/permissions.ts)
- `hasModuleAccess(user, module)` → tek fonksiyon, override + role default'u birleştirir
- Sidebar item'leri `module: ModuleKey` ile gating yapar

---

## 2. Oluşturulan Kullanıcılar

| Kullanıcı Adı | Rol | Şifre | PIN | Tam Ad |
| --- | --- | --- | --- | --- |
| **cumhuryuksel** | admin | `23865` | `8423` | Cumhur Yüksel |
| **eylul** | manager | `85643` | `6271` | Eylül |
| **sevilay** | staff | `k7m2x9` | `1847` | Sevilay |
| **sude** | staff | `p3q8z5` | `2953` | Sude |
| **dila** | staff | `r6w4n1` | `6294` | Dila |

**Backwards compat:** `admin@gokids.com / demo1234` hesabı kurtarma amaçlı bırakıldı; admin yetkili.

### Login akışı

1. Operatör `cumhuryuksel` yazar
2. `src/lib/auth/username.ts` arkada `cumhuryuksel@gokids.local` üretir
3. Supabase Auth bu sentetik email ile giriş kabul eder
4. `touch_last_login` RPC → `profiles.last_login_at` güncellenir
5. `loadProfile` permissions + role'ü çeker, route guard'lar bunu kullanır

---

## 3. PIN / Session Lock Durumu

| Özellik | Durum |
| --- | --- |
| Hash algoritması | **bcrypt** (`crypt(pin, gen_salt('bf'))`) via `pgcrypto` |
| Saklama yeri | `public.profiles.pin_hash` |
| Doğrulama | `verify_pin(pin)` RPC (security definer) |
| Self-reset | `set_pin(pin)` RPC — kullanıcı kendi PIN'ini değiştirir |
| Admin-reset | `admin_set_pin(uid, pin)` RPC — yalnız admin/super_admin |
| İdle timeout | **15 dakika** (mousemove/keydown/touch/scroll dinlenir) |
| Hatalı deneme | 5 hata → otomatik signOut |
| Kilitten çıkış | Aynı sayfaya geri döner — session kaybolmaz |
| Muaf rotalar | `/login`, `/tv`, `/canli`, `/parent`, `/app` (kiosk/public) |

PIN'ler asla cihazda saklanmaz; sadece sunucuda bcrypt hash olarak durur. Doğrulama tamamen server-side `verify_pin` RPC ile yapılır.

---

## 4. Doğum Günü Paket Yönetimi

| Paket | Fiyat | Durum |
| --- | --- | --- |
| Bronz | ₺3.500 | Aktif |
| Gümüş | ₺5.500 | Aktif |
| Altın | ₺8.500 | Aktif |

### Yönetim yetkileri

| Aksiyon | Admin | Manager | Staff |
| --- | :---: | :---: | :---: |
| Paketleri görüntüleme | ✓ | ✓ | ✓ |
| Yeni paket ekleme | ✓ | ✗ | ✗ |
| Paket düzenleme | ✓ | ✗ | ✗ |
| Aktif/pasif yapma | ✓ | ✗ | ✗ |
| Silme | ✓ | ✗ | ✗ |

> **RLS server-side zorlar** — kullanıcı UI'ı bypass etse bile yazma policy'si admin/super_admin değilse reddeder.

### Şema

```sql
public.birthday_packages (
  id          uuid primary key,
  name        text not null,
  description text,
  price       numeric(10,2),
  is_active   boolean,
  sort_order  int,
  created_at  timestamptz,
  updated_at  timestamptz
)
```

UI: `/dogum-gunleri` sayfasının en üstünde "Paketler" kartı.

---

## 5. Finance Erişim Kuralları

| Rol | Default | Nasıl açılır |
| --- | --- | --- |
| Admin | ✓ (full) | Otomatik |
| Manager | ✗ | `/personeller → Hesaplar → eylul → Modül İzinleri → Finans` |
| Staff | ✗ | Yok (admin grant edebilir ama tasarım staff'a finance vermez) |

**Finance modülü** şu içerikleri kapsar (tasarım):
- Cüzdan
- Raporlar (gelir / iade / payment logs)
- Gün sonu analitik

Sidebar gating zaten aktif. Sayfa içi (dashboard'daki gelir widget'ı vb.) gating gelecek sürüme bırakıldı — `hasModuleAccess(user, "finance")` ile tek satırda eklenebilir.

---

## 6. Migration Özeti

| # | Dosya | Ne yapar | Çalıştırıldı mı? |
| --- | --- | --- | :---: |
| 003 | `003_finance_engine.sql` | Finans motoru | ✓ (geçmiş) |
| 004 | `004_unlimited_extension.sql` | Sınırsız uzatma | ✓ (geçmiş) |
| 005 | `005_multi_branch.sql` | Çok-şube + `branch_id` | partial |
| 014 | `014_memberships.sql` | Üyelikler | partial |
| **015** | **`015_user_management.sql`** | **username + pin_hash + permissions + birthday_packages** | ✓ **uygulandı** |
| seed | `seed-production-users.sql` | 5 kullanıcı + PIN | ✓ |
| seed | `seed-birthday-packages.sql` | 3 başlangıç paketi | ✓ |
| recovery | `recovery-roles.sql` | branch_id + role constraint | ✓ |

**Idempotent**: tüm seed/recovery scriptleri tekrar çalıştırılabilir, var olan veriyi bozmaz.

---

## 7. UI Değişiklikleri Özeti

| Sayfa | Değişiklik |
| --- | --- |
| `/login` | E-posta alanı → **Username**. Demo hesap grid'i kaldırıldı. |
| `/personeller` → "Hesaplar" tab | Yeni: gerçek Supabase-backed hesap yönetimi (rol/izin/PIN/disable) |
| `/dogum-gunleri` | Üstte yeni "Paketler" yönetim kartı |
| `/yetki` | "demo modu" → "Çevrimdışı kurtarma" |
| Sidebar | Modül-bazlı görünürlük (eski: `roles: [...]`, yeni: `module: <key>`) |
| Lock screen | Yeni overlay komponenti (15 dk idle → PIN) |

---

## 8. Test URL'leri

Vercel deploy URL ne olursa olsun bu rotalar var:

| Sayfa | Yol | Erişen |
| --- | --- | --- |
| Login | `/login` | Herkes |
| Dashboard | `/` | Admin + Manager |
| Hesap Yönetimi | `/personeller` → "Hesaplar" | Admin |
| Paket Yönetimi | `/dogum-gunleri` | Admin (write) · herkes (read) |
| Rol Debug | `/yetki` | Tüm girişli kullanıcılar |
| Canlı Operasyon | `/canli` | Kiosk (public) |
| TV Ekranı | `/tv/live` | Kiosk (public) |
| Veli Portalı | `/parent` | Kiosk (public, code-based) |
| İşletme Özeti | `/durum` | Admin + Manager |

---

## 9. Bilinen Eksikler (Faz 6 adayları)

| Konu | Neden eksik | Çözüm |
| --- | --- | --- |
| **UI'dan yeni user oluşturma** | service_role key client'ta yok | Vercel'e `SUPABASE_SERVICE_ROLE_KEY` ekle → `/api/admin/create-user` route'u yaz |
| **UI'dan şifre sıfırlama** | service_role key gerekli | Aynı route + `supabase.auth.admin.updateUserById` |
| **Per-widget finance gating** | Dashboard/raporlar içindeki para sütunları henüz `hasModuleAccess(user, "finance")` ile sarmalanmadı | Her widget'a `if (!hasModuleAccess(user,"finance")) return null` ekle |
| **Demo staff card grid (`/personeller → Personel` tab)** | Hardcoded STAFF_MEMBERS data hâlâ var | Yeni "Hesaplar" tab varsayılan; ileride staff tab'ı sil |
| **Audit log entegrasyonu** | İzin değişiklikleri henüz audit_log'a yazılmıyor | Trigger yaz: profiles güncellendiğinde audit_log'a satır at |

---

## 10. Veri Güvenliği Notları

- `.env.local` git'e commit edilmedi (kontrol: `git check-ignore .env.local` → ignored)
- PIN'ler bcrypt hash, hiçbir log'a düz metin geçmiyor
- `verify_pin` / `set_pin` / `admin_set_pin` hepsi `security definer` → server-side bcrypt
- Sentetik email konvansiyonu (`@gokids.local`) external email değil — Supabase Auth iç kullanımı için
- service_role key bu repoda yok; client kod sadece anon key kullanır

---

## 11. Bir Sonraki Hedef (Önerilen)

Sırasıyla:

1. **`SUPABASE_SERVICE_ROLE_KEY` Vercel env'e ekle** → "yeni kullanıcı" + "şifre reset" UI'dan
2. **Audit log integration** — kim ne zaman izin değiştirdi
3. **Reservation flow'u paketlerle bağla** — `/dogum-gunleri` rezervasyon ekranı paketten seçsin
4. **PWA install banner**'ı kapatma seçeneği

---

**Hazırlayan:** Claude Opus 4.7
**Repo:** [catosapienss/go-kids-play-admin](https://github.com/catosapienss/go-kids-play-admin)
**Onay veren kullanıcı:** mehmetcagatay27@gmail.com
