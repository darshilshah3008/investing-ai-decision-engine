# Deploy to Vercel + Firebase

This app deploys as **two separate services** that talk to each other:

- **Vercel** hosts the Next.js app (frontend + API routes)
- **Firebase** provides the database (Firestore) and auth (Google sign-in)

Total cost on free tiers: **$0/month** for prototype-scale traffic.

---

## Prerequisites

- A GitHub account with this repo pushed
- A free Firebase account (<https://console.firebase.google.com>)
- A free Vercel account (<https://vercel.com>) — sign up with the same GitHub account
- Your real email (SEC requires it in the User-Agent header)

---

## Step 1 — Create the Firebase project (~3 min)

1. Open <https://console.firebase.google.com> → **Add project**.
   Name it whatever (e.g. `investing-ai-engine`). Disable Google Analytics
   (you don't need it for a prototype).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable**.
   Set a support email. Save.
3. **Build → Firestore Database → Create database → Production mode →
   Region: us-central** (or closest). Click **Enable**.
4. **⚙️ Project settings → General → Your apps → Web (`</>`)**.
   Register a web app. Skip Firebase Hosting offer. Copy the config object —
   you'll need these 6 keys for Step 4:
   ```js
   apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId
   ```
5. **⚙️ Project settings → Service accounts → Generate new private key**.
   Download the JSON. Keep it safe — it's the server-side admin credential.

---

## Step 2 — Deploy the Firestore security rules (~1 min)

The rules in `firestore.rules` lock watchlists per-user and make the verdicts
cache public-read. Deploy them once:

```bash
# From web/ directory
npm install -g firebase-tools     # if you don't have it
firebase login
firebase use --add                # pick the project from step 1
firebase deploy --only firestore:rules
```

You'll see "✓ Deploy complete!" — that's it for Firebase.

---

## Step 3 — Push to GitHub (~1 min)

If your repo isn't on GitHub yet:

```bash
# From the repo root (not from web/)
git add web/
git commit -m "Add Next.js + Firebase web app"
git push origin main
```

---

## Step 4 — Deploy to Vercel (~3 min)

1. Open <https://vercel.com/new> → **Import** your GitHub repo.
2. **Important — Root Directory:** click *Edit* and set to `web`.
   The Next.js app lives in a subfolder.
3. **Framework Preset:** auto-detected as Next.js. Don't change.
4. **Environment Variables** — paste these one-by-one (apply to **Production,
   Preview, and Development**):

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | from step 1.4 config object |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | from step 1.4 |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | from step 1.4 |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | from step 1.4 |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | from step 1.4 |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | from step 1.4 |
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | the entire JSON file from step 1.5, pasted as one line |
   | `SEC_USER_AGENT` | `"Your Name <you@example.com>"` (your real email) |

   Paste the full service-account JSON directly into the value field — Vercel
   handles long secrets fine. Don't quote it.

5. Click **Deploy**. ~2 minutes for the first build.

Done. Your app is live at `https://<project-name>.vercel.app`.

---

## Step 5 — Authorize the Vercel domain in Firebase (~1 min)

For Google sign-in to work on the deployed URL:

1. Firebase Console → **Authentication → Settings → Authorized domains**.
2. Click **Add domain** and add your Vercel domain
   (e.g. `investing-ai-engine.vercel.app`).
3. If you wire a custom domain later, add that too.

---

## Step 6 — Test the deployed app

1. Open `https://<project>.vercel.app`
2. Click **Try free** → sign in with Google
3. Click **+ Add stocks** → search `AAPL` → **Analyze**
4. Wait 10-30 seconds (cold EDGAR fetch the first time)
5. You should see Apple's verdict with the full math trail and links back
   to the SEC 10-K accession numbers.

If anything fails:

- Check **Vercel → Deployments → Functions** logs for the API route errors
- Check **Firebase Console → Firestore** for the cached `verdicts/AAPL` doc
- Check the **browser console** for client-side Firebase errors

---

## Custom domain (optional, ~5 min)

Vercel:
1. **Project → Settings → Domains → Add**.
2. Point your DNS as Vercel instructs. Free SSL automatic.
3. Add the new domain to Firebase **Authorized domains** (Step 5 above).

---

## Future deploys

Just push to GitHub. Vercel auto-deploys every push to `main` as Production
and every PR as a Preview environment. Firestore rules redeploy only when
you re-run `firebase deploy --only firestore:rules`.

---

## Cost ceilings on the free tiers

| Service | Free quota | When you'd start paying |
|---|---|---|
| Vercel Hobby | 100 GB bandwidth, 100 GB-hours functions, 60s function timeout | ~10K MAU |
| Firebase Spark | 1 GB Firestore, 50K reads/day, 20K writes/day, 10 GB Auth | ~50-100 daily active users |
| **Total** | | First paid month: ~$5-25 |

Both have built-in alerts you can configure. You'll get an email before
either bills you.

---

## Common pitfalls

- **"Module not found: firebase-admin"** in Vercel logs → you forgot to set
  the **Root Directory** to `web`. Fix in Project Settings → General.
- **Sign-in popup shows "auth/unauthorized-domain"** → add your Vercel
  domain to Firebase Auth's Authorized Domains (Step 5).
- **API routes return `EDGAR fetch failed: SEC_USER_AGENT env var is unset`**
  → you forgot to add `SEC_USER_AGENT` to Vercel env vars or didn't
  redeploy after adding it.
- **Firestore writes fail with "PERMISSION_DENIED"** → run
  `firebase deploy --only firestore:rules` from `web/`.
- **First analysis takes >30s and times out** → that's the cold-start +
  EDGAR fetch combination. Subsequent runs are cached. To pre-warm popular
  tickers, hit `/api/verdict/AAPL` once after deploy.
