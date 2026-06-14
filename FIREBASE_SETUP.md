# Firebase setup — Vyapaar-Mitra

The app runs **without Firebase** on a local mock login. Follow this once to switch
to real **Firebase Auth + Firestore**. Project: `vyapaar-mitra-12fc7`.

The code is already wired and *config-gated*: it stays on the mock until the six
`NEXT_PUBLIC_FIREBASE_*` keys are filled in `frontend/.env.local`, then it
switches automatically on the next `npm run dev`.

---

## 1. Frontend — Auth + Firestore (required)

### 1a. Copy the web app config
Firebase console → **⚙ Project settings** → **General** → *Your apps* →
**vyapaar-mitra-app** → **SDK setup and configuration** → select **Config**.
Copy the values into `frontend/.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=vyapaar-mitra-12fc7.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=vyapaar-mitra-12fc7
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=vyapaar-mitra-12fc7.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```
> These web keys are **not secrets** — they are client identifiers. Access is
> controlled by Firestore security rules (step 1c), not by hiding them.

### 1b. Enable Email/Password sign-in
Console → **Build → Authentication → Get started** →
**Sign-in method** tab → **Email/Password** → *Enable* → Save.
(The demo account `demo@vyapaar-mitra.app` / `demo1234` is auto-created the first
time you click **Use demo** on the login page.)

### 1c. Create the Firestore database
Console → **Build → Firestore Database → Create database** →
**Start in test mode** (fine for development) → pick a location → Enable.

Run history is stored at `users/{uid}/runs/{runId}`. When you go past dev,
replace the test-mode rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

### 1d. Restart the frontend
```
cd frontend
npm run dev
```
Sign-up / sign-in now go through Firebase; run history persists to Firestore.

---

## 2. Backend — Firestore checkpointer (optional)

Only needed if you want LangGraph run state durably checkpointed in Firestore
(otherwise it uses an in-memory saver — the engine works fine without this).

### 2a. Generate a service-account key (**secret**)
Console → **⚙ Project settings → Service accounts** →
**Generate new private key** → save the JSON as
`backend/firebase-admin.json` (already git-ignored — never commit it).

### 2b. Set backend env vars before running the API
```
# from backend/, in your shell (or a .env you source):
export GOOGLE_APPLICATION_CREDENTIALS=./firebase-admin.json
export FIRESTORE_PROJECT_ID=vyapaar-mitra-12fc7
export RESILIO_USE_FIRESTORE=1     # or leave 'auto' — auto-detects the above

python -m uvicorn main:app --port 8000
```
On Windows PowerShell use `$env:GOOGLE_APPLICATION_CREDENTIALS="./firebase-admin.json"` etc.

The checkpointer auto-degrades to in-memory if the credentials are missing, so a
misconfig won't break the API — it just won't persist graph state.

---

## What stays the same
- The **LLM** is still OFFLINE-deterministic unless you set `GROQ_API_KEY`.
- All Firebase wiring is **isolated**: `lib/firebase.ts`, `AuthContext.tsx`,
  `lib/runs.ts` (frontend) and `graph.py`'s checkpointer (backend). The rest of
  the app only uses `useAuth()` and the async `runs` API.
