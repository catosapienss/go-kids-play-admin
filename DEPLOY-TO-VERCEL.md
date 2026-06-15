# Deploy to Vercel — Step-by-Step

The project is **deploy-ready**. Git repo initialised, 298 files committed,
production build verified. Three things left, all manual (~10 min total).

## ✅ Already done (in repo, locally)

- ✅ Production build verified (`next build` → success, 28 routes generated)
- ✅ Git initialised, branch `main`, first commit at `b6b5eb3`
- ✅ `.env.local` excluded by `.gitignore` (verified)
- ✅ `next.config.mjs` configured (`output: "standalone"`, ESLint skip)
- ✅ `vercel.json` configured (see below)
- ✅ PWA manifest + service worker mounted
- ✅ Supabase auth working (login HTTP 200)
- ✅ DB schema patched (recovery-roles.sql applied)

---

## STEP 1 — Push to GitHub (5 min)

### 1a. Create a GitHub repo
1. Open <https://github.com/new>
2. Repository name: `go-kids-play-admin`
3. **Private** (recommended) or Public — either works
4. **Do NOT** check "Initialize with README" — we already have commits
5. Click **Create repository**
6. Copy the URL GitHub gives you (something like `https://github.com/YOURNAME/go-kids-play-admin.git`)

### 1b. Add remote + push
Open Terminal at the project, paste these (replace the URL):

```bash
cd ~/Desktop/go-kids-play-admin
git remote add origin https://github.com/YOURNAME/go-kids-play-admin.git
git push -u origin main
```

The first push will prompt for GitHub credentials — use a **Personal Access
Token** (Settings → Developer settings → Personal access tokens → fine-grained
token with `Contents: read+write` on your new repo).

---

## STEP 2 — Deploy on Vercel (3 min)

1. Open <https://vercel.com/new>
2. Sign in (with GitHub — easiest).
3. **Import Git Repository** → pick `go-kids-play-admin`.
4. Vercel auto-detects Next.js — leave all defaults:
   - Framework: **Next.js**
   - Root directory: `./`
   - Build command: `next build`
   - Output: (auto)
5. **Environment Variables** — open the panel and add:
   ```
   NEXT_PUBLIC_SUPABASE_URL       = https://cmehadzcxrdgnzticrzl.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY  = (paste the value from .env.local)
   ```
   Both variables go into **Production, Preview, and Development** scopes.
6. Click **Deploy**.

Wait ~2 min. Vercel gives you a URL like:
```
https://go-kids-play-admin.vercel.app
```

This is your production URL.

---

## STEP 3 — Test & Install as PWA on the business computer

### 3a. Test in browser
1. Open `https://your-app.vercel.app/login`
2. Sign in with `admin@gokids.com` / `demo1234`
3. You should see the **full manager sidebar** (Dashboard + Müşteriler +
   Üyelikler + Raporlar + Gün Sonu + İşlem Kayıtları + Personel + Ayarlar)
4. Visit `/yetki` — should say **"Supabase (tam şema)"** in green

### 3b. Install as PWA on the business computer (Windows + Chrome)
1. Open Chrome on the business computer
2. Navigate to the Vercel URL
3. Sign in (so service worker caches the brand shell)
4. Look at the **right side of the address bar** — you'll see a small monitor
   icon with a down-arrow. Click it.
5. Pop-up appears: **"Install Go Kids Play?"** → click **Install**
6. The app now opens in its own window without browser chrome.
   It's also added to the Windows Start Menu and (optionally) the desktop.

To uninstall later: right-click the icon → **Uninstall Go Kids Play**.

---

## STEP 4 — Custom domain (later, optional)

When you have your own domain:

1. Vercel dashboard → project → **Settings** → **Domains**
2. Click **Add Domain** → type your domain (e.g. `panel.gokidsplay.com`)
3. Vercel shows the DNS records you need to add at your registrar:
   - `A` record pointing to `76.76.21.21`
   - or `CNAME` pointing to `cname.vercel-dns.com`
4. Add them at your DNS provider (Namecheap / Cloudflare / GoDaddy etc.)
5. Vercel automatically provisions an SSL cert.
6. Done — the app is now reachable at your custom domain.

---

## Troubleshooting

### "Cannot find module 'next'" during Vercel build
Don't worry — Vercel runs `npm install` first. Just make sure
`devDependencies` aren't required at runtime (they're not in this project).

### Login works but sidebar is missing items
You forgot to run `scripts/recovery-roles.sql` in Supabase SQL Editor.
Open Supabase dashboard → SQL Editor → paste contents → Run.

### Service worker says "outdated cache"
Force-reload (`Ctrl+Shift+R`). The new SW version installs and takes effect
immediately.

### Manager sees Staff sidebar
Visit `/yetki` — read the **"Rol kaynağı"** chip:
- Green "Supabase (tam şema)" → fix is done
- Amber "Supabase (eksik kolon)" → run `recovery-roles.sql` again

---

## Final Production URLs (once deployed)

| Page | URL |
| --- | --- |
| Login | `https://your-app.vercel.app/login` |
| Dashboard | `https://your-app.vercel.app/` |
| Role debug | `https://your-app.vercel.app/yetki` |
| Live TV | `https://your-app.vercel.app/tv/live` |
| Parent portal | `https://your-app.vercel.app/parent` |
| System status | `https://your-app.vercel.app/durum` |
