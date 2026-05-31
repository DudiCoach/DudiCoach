# Firebase Migration & Deployment Guide

## Overview

DudiCoach has been fully migrated from Supabase to Firebase. Authentication uses Firebase Auth with session cookies for SSR. The data layer uses Firestore. This document covers the required steps for deployment, CI/CD configuration, and Firebase service account setup.

## Architecture Summary

| Component | Technology | Notes |
|-----------|-----------|-------|
| Authentication | Firebase Auth + session cookies | Google OAuth + email/password |
| Database | Firestore | All collections under `athletes/{id}/` |
| AI Generation | Minimax API (Anthropic-compatible) | Model: `MiniMax-M2.7` |
| Hosting | Firebase App Hosting | Auto-deploys from GitHub |
| CI/CD | GitHub Actions | Lint, typecheck, test, build, deploy |

## Environment Variables

### Required for All Environments

```bash
# Firebase (client SDK)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=1:...

# AI Generation
ANTHROPIC_API_KEY=sk-...
ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
ANTHROPIC_MODEL=MiniMax-M2.7

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_PLAN_GENERATION_MODE=sync  # or "async"
```

### Required for CI/CD (GitHub Actions)

```bash
# Firebase Service Account (for deployment + session cookies)
FIREBASE_SERVICE_ACCOUNT_DUDICOACH_APP={"type":"service_account",...}

# Plan Generation Worker (for async mode)
PLAN_JOBS_WORKER_SECRET=your-secret-here
```

## Firebase Service Account Setup (CRITICAL)

The `FIREBASE_SERVICE_ACCOUNT_DUDICOACH_APP` secret is used by the CI/CD pipeline for two purposes:
1. **Deploying** Firestore rules, indexes, and the app to Firebase App Hosting
2. **Verifying session cookies** in the auth guard (`lib/api/auth-guard.ts`)

Without this secret, authentication will fail and deployment will not work.

### Step 1: Generate the Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/) → Select `dudicoach-app` project
2. Click the **gear icon** (Project Settings) → **Service accounts** tab
3. Under "Firebase Admin SDK", click **"Generate new private key"**
4. Confirm the dialog — a JSON file will be downloaded to your machine
5. **Do not rename the file** — keep the original filename

### Step 2: Add to GitHub Secrets

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Name: `FIREBASE_SERVICE_ACCOUNT_DUDICOACH_APP`
4. Value: Open the downloaded JSON file in a text editor, select **ALL** content, and paste it as the value
   - The value should start with `{"type":"service_account",...}`
   - It must be the complete JSON, not just a key or ID
5. Click **"Add secret"**

### Step 3: Verify the Secret Works

After adding the secret, push a commit to trigger the CI/CD pipeline. The deploy job will fail with a clear error if the secret is missing or invalid.

You can also verify locally:
```bash
# Save the JSON content to a file
# Then set the environment variable
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Test Firebase CLI
firebase projects:list
```

### How the Pipeline Uses This Secret

In `.github/workflows/ci.yml`, the deploy job uses the secret like this:

```yaml
deploy:
  steps:
    - name: Deploy to Firebase
      run: firebase deploy --project dudicoach-app
      env:
        GOOGLE_APPLICATION_CREDENTIALS: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_DUDICOACH_APP }}
```

The `GOOGLE_APPLICATION_CREDENTIALS` environment variable tells the Firebase Admin SDK which service account to use. This is used both for:
- **Deployment**: `firebase deploy` uses it to push Firestore rules, indexes, and the app
- **Runtime auth**: The auth guard (`lib/api/auth-guard.ts`) uses `firebase-admin/auth` to verify session cookies, which requires the service account credentials

### Troubleshooting Service Account Issues

| Error | Cause | Fix |
|-------|-------|-----|
| `GOOGLE_APPLICATION_CREDENTIALS not set` | Secret not added to GitHub | Add the secret as described above |
| `INVALID_CREDENTIALS` | JSON content is incomplete or corrupted | Re-download the key from Firebase Console and paste the full JSON |
| `PERMISSION_DENIED` | Service account lacks required roles | Ensure the service account has "Firebase Admin SDK Administrator" role |
| `unanonymized` errors | Wrong project ID in the JSON | Ensure the JSON is from the `dudicoach-app` project |

## Firestore Data Model

All data is stored under the `athletes` collection with subcollections:

```
athletes/
  {athleteId}/
    injuries/
      {injuryId}
    fms_diagnostics/
      {diagnosticId}
    progressions/
      {progressionId}
    training_plans/
      {planId}
    session_feedback/
      {feedbackId}
    cycle_summaries/
      {summaryId}
    rpe_reports/
      {reportId}

plan_generation_jobs/
  {jobId}

fitness_test_results/
  {testId}
```

## Deployment Steps

### 1. First Time Setup

```bash
# Login to Firebase
firebase login

# Set the active project
firebase use dudicoach-app

# Deploy Firestore rules and indexes
firebase deploy --only firestore:rules,firestore:indexes
```

### 2. Connect GitHub Repository

1. Go to Firebase Console → App Hosting
2. Click "Get started"
3. Connect your GitHub repository (`dawidmalickilodz/DudiCoach`)
4. Select the branch (`firebase_testing` or `main`)
5. Configure build settings:
   - Build command: `npm run build`
   - Output directory: `.next`
6. Deploy

### 3. Set Environment Variables in App Hosting

1. Go to Firebase Console → App Hosting → Your backend
2. Go to "Environment variables"
3. Add all required variables from the list above
4. **Important**: Add `PLAN_JOBS_WORKER_SECRET` for async mode

### 4. Enable Google Auth Provider

1. Go to Firebase Console → Authentication → Sign-in method
2. Enable Google provider
3. Add authorized domains: `dudicoach-app.firebaseapp.com`
4. Set project support email

### 5. Create Coach User

To create the initial coach user for email/password login:

1. Go to Firebase Console → Authentication → Users
2. Click "Add user"
3. Enter email (e.g., `dawid.malicki@peaklab.com.pl`) and a password
4. The user can now log in via the email/password form

**Note:** Google OAuth is also available. Only emails listed in `lib/firebase/auth.ts` (`ALLOWED_COACH_EMAILS`) are authorized to access the coach panel.

### 6. Configure Firestore Security Rules

The rules are already deployed via `firebase deploy --only firestore:rules`. Key rules:

- Athletes: Read/write only by owner coach
- Subcollections: Read/write only by owner coach
- Plan generation jobs: Read/write only by owner coach
- Public endpoints use share codes (no auth required)

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

1. **Lint**: `npm run lint`
2. **Typecheck**: `npm run typecheck`
3. **Unit Tests**: `npm run test`
4. **Build**: `npm run build`
5. **Deploy**: `firebase deploy` (only on `main` branch)

### Workflow Triggers

- **Pull Request**: Lint, typecheck, test, build
- **Push to `main`**: All above + deploy to Firebase App Hosting

### Required GitHub Secrets

| Secret | Description | Where to get it |
|--------|-------------|-----------------|
| `FIREBASE_SERVICE_ACCOUNT_DUDICOACH_APP` | Firebase service account JSON | Firebase Console → Project Settings → Service Accounts → Generate new private key |
| `PLAN_JOBS_WORKER_SECRET` | Worker authentication secret | Generate with `openssl rand -hex 32` |

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm run test

# Run E2E tests
E2E_COACH_EMAIL=coach@example.com E2E_COACH_PASSWORD="TestCoach123!" npm run test:e2e
```

### Local Firebase Emulator (Optional)

For local development with Firestore emulation:

```bash
# Start Firebase emulators
firebase emulators:start

# Set emulator project
export GCLOUD_PROJECT=dudicoach-app
```

## Troubleshooting

### "Backend Not Found" on App Hosting

- Ensure the GitHub repository is connected
- Check that the first deployment has completed
- Verify environment variables are set

### Authentication Errors

- Ensure Firebase Auth is enabled in Firebase Console
- Check that Google provider is configured
- Verify the user's email is in `ALLOWED_COACH_EMAILS` (for Google login)
- For email/password: create the user manually in Firebase Console → Authentication → Users
- Verify `FIREBASE_SERVICE_ACCOUNT_DUDICOACH_APP` secret is set correctly in GitHub

### Session Cookie Errors

- The auth guard reads the `firebase-session` cookie
- If the cookie is missing, users are redirected to `/login`
- If the cookie is invalid, the API returns 401
- Ensure `FIREBASE_SERVICE_ACCOUNT_DUDICOACH_APP` is set in both GitHub secrets AND App Hosting environment variables

### Firestore Permission Errors

- Check Firestore security rules are deployed
- Verify the user is authenticated
- Ensure the user owns the athlete document

### Plan Generation Failures

- Check Minimax API key is valid
- Verify `ANTHROPIC_BASE_URL` is correct
- Check worker secret is set for async mode

## Rollback Procedure

If issues occur after deployment:

1. **Immediate**: Set `NEXT_PUBLIC_PLAN_GENERATION_MODE=sync` in App Hosting env vars
2. **Code rollback**: Revert to previous commit in GitHub
3. **Data rollback**: Firestore doesn't have built-in rollback; use backups

## Security Notes

- Never commit `.env.local` to version control
- Use GitHub Actions secrets for CI/CD
- Rotate `PLAN_JOBS_WORKER_SECRET` periodically
- Monitor Firestore usage for unexpected costs
- Review security advisors regularly: `firebase firestore:audit`
- The `firebase-session` cookie is HTTP-only and secure in production

## Cost Optimization

- Firestore charges per operation; batch writes when possible
- Use indexes efficiently (see `firestore.indexes.json`)
- Clean up old plan generation jobs: `deleteOldJobs(7)`
- Monitor usage in Firebase Console → Usage and billing
