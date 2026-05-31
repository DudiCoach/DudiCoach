# Firebase Cost Comparison: PR #63 (App Hosting) vs PR #64 (Cloud Functions)

## Overview

Both PRs deploy the same DudiCoach application to Firebase. The difference is the hosting/deployment mechanism, which affects cost structure.

## Pricing Reference (as of 2026)

### App Hosting (PR #63)
| Resource | Free Tier | Paid |
|----------|-----------|------|
| Outgoing bandwidth (cached) | 10 GiB/month | $0.15/GiB |
| Outgoing bandwidth (uncached) | 10 GiB/month | $0.20/GiB |
| Cloud Run CPU | 180k vCPU-seconds | $0.00002400/vCPU-second |
| Cloud Run Memory | 360k GiB-seconds | $0.00000250/GiB-second |
| Cloud Run Requests | 2M requests | $0.40/million requests |
| Cloud Build | 2500 minutes | $0.006/build-minute |
| Artifact Registry | 0.5 GB | $0.10/GB/month |

### Cloud Functions (PR #64)
| Resource | Free Tier | Paid |
|----------|-----------|------|
| Invocations | 2M/month | $0.40/million |
| GB-seconds | 400K/month | Google Cloud pricing |
| CPU-seconds | 200K/month | Google Cloud pricing |
| Outbound networking | 5 GB/month | $0.12/GB |
| Cloud Build | 120 min/day | $0.003/min |
| Artifact Registry | 500 MB | Google Cloud pricing |

### Firebase Hosting (PR #64)
| Resource | Free Tier | Paid |
|----------|-----------|------|
| Storage | 10 GB | $0.026/GB |
| Data transfer | 360 MB/day | $0.15/GB |

### Firestore (Both PRs)
| Resource | Free Tier | Paid |
|----------|-----------|------|
| Document reads | 50K/day | $0.06/100K |
| Document writes | 20K/day | $0.18/100K |
| Document deletes | 20K/day | $0.02/100K |
| Storage | 1 GiB | $0.10/GiB/month |

### Firebase Auth (Both PRs)
| Resource | Free Tier | Paid |
|----------|-----------|------|
| Monthly Active Users | 50K MAU | $0.0055/MAU (after 10K) |
| Phone Auth | 10K verifications | $0.01/verification |

## Cost Scenarios

### Scenario 1: Small App (1K users/month, 10K page views)

**Assumptions:**
- 1,000 monthly active users
- 10,000 page views/month
- 50KB average page size
- 500MB total bandwidth
- 10 builds/month
- 1GB Firestore storage

#### PR #63 (App Hosting)
| Component | Usage | Cost |
|-----------|-------|------|
| Cloud Run CPU | 1,250 vCPU-seconds | $0.00 (within free tier) |
| Cloud Run Memory | 625 GiB-seconds | $0.00 (within free tier) |
| Cloud Run Requests | 10K requests | $0.00 (within free tier) |
| Cloud Build | 10 builds × 16 min | $0.00 (within free tier) |
| Artifact Registry | 0.6 GB | $0.01 |
| Bandwidth | 0.5 GB | $0.00 (within free tier) |
| Firestore | 1 GB storage | $0.00 (within free tier) |
| Firebase Auth | 1K MAU | $0.00 (within free tier) |
| **Total** | | **~$0.01/month** |

#### PR #64 (Cloud Functions)
| Component | Usage | Cost |
|-----------|-------|------|
| Invocations | 10K requests | $0.00 (within free tier) |
| GB-seconds | 2,500 GB-sec | $0.00 (within free tier) |
| CPU-seconds | 1,250 CPU-sec | $0.00 (within free tier) |
| Outbound networking | 0.5 GB | $0.00 (within free tier) |
| Firebase Hosting | 100 MB storage | $0.00 (within free tier) |
| Firestore | 1 GB storage | $0.00 (within free tier) |
| Firebase Auth | 1K MAU | $0.00 (within free tier) |
| **Total** | | **$0.00/month** |

**Verdict:** Both are essentially free at this scale. Cloud Functions has a slight edge due to more generous free tiers.

---

### Scenario 2: Medium App (10K users/month, 100K page views)

**Assumptions:**
- 10,000 monthly active users
- 100,000 page views/month
- 50KB average page size
- 5 GB total bandwidth
- 20 builds/month
- 5 GB Firestore storage

#### PR #63 (App Hosting)
| Component | Usage | Cost |
|-----------|-------|------|
| Cloud Run CPU | 12,500 vCPU-seconds | $0.00 (within free tier) |
| Cloud Run Memory | 6,250 GiB-seconds | $0.00 (within free tier) |
| Cloud Run Requests | 100K requests | $0.00 (within free tier) |
| Cloud Build | 20 builds × 16 min | $0.00 (within free tier) |
| Artifact Registry | 0.6 GB | $0.01 |
| Bandwidth | 5 GB | $0.00 (within free tier) |
| Firestore | 5 GB storage | $0.40 |
| Firebase Auth | 10K MAU | $0.00 (within free tier) |
| **Total** | | **~$0.41/month** |

#### PR #64 (Cloud Functions)
| Component | Usage | Cost |
|-----------|-------|------|
| Invocations | 100K requests | $0.00 (within free tier) |
| GB-seconds | 25,000 GB-sec | $0.00 (within free tier) |
| CPU-seconds | 12,500 CPU-sec | $0.00 (within free tier) |
| Outbound networking | 5 GB | $0.00 (within free tier) |
| Firebase Hosting | 1 GB storage | $0.00 (within free tier) |
| Firestore | 5 GB storage | $0.40 |
| Firebase Auth | 10K MAU | $0.00 (within free tier) |
| **Total** | | **~$0.40/month** |

**Verdict:** Nearly identical costs. Cloud Functions is $0.01 cheaper.

---

### Scenario 3: Large App (100K users/month, 1M page views)

**Assumptions:**
- 100,000 monthly active users
- 1,000,000 page views/month
- 50KB average page size
- 50 GB total bandwidth
- 30 builds/month
- 20 GB Firestore storage

#### PR #63 (App Hosting)
| Component | Usage | Cost |
|-----------|-------|------|
| Cloud Run CPU | 125,000 vCPU-seconds | $0.00 (within free tier) |
| Cloud Run Memory | 62,500 GiB-seconds | $0.00 (within free tier) |
| Cloud Run Requests | 1M requests | $0.00 (within free tier) |
| Cloud Build | 30 builds × 16 min | $0.00 (within free tier) |
| Artifact Registry | 0.6 GB | $0.01 |
| Bandwidth | 50 GB | $7.50 (40 GB × $0.15/GiB) |
| Firestore | 20 GB storage | $1.90 |
| Firebase Auth | 100K MAU | $495.00 (90K × $0.0055) |
| **Total** | | **~$504.41/month** |

#### PR #64 (Cloud Functions)
| Component | Usage | Cost |
|-----------|-------|------|
| Invocations | 1M requests | $0.00 (within free tier) |
| GB-seconds | 250,000 GB-sec | $0.00 (within free tier) |
| CPU-seconds | 125,000 CPU-sec | $0.00 (within free tier) |
| Outbound networking | 50 GB | $5.40 (45 GB × $0.12/GB) |
| Firebase Hosting | 5 GB storage | $0.13 |
| Firestore | 20 GB storage | $1.90 |
| Firebase Auth | 100K MAU | $495.00 (90K × $0.0055) |
| **Total** | | **~$502.43/month** |

**Verdict:** Cloud Functions is ~$2 cheaper due to lower bandwidth costs.

---

### Scenario 4: High Traffic (1M users/month, 10M page views)

**Assumptions:**
- 1,000,000 monthly active users
- 10,000,000 page views/month
- 50KB average page size
- 500 GB total bandwidth
- 50 builds/month
- 100 GB Firestore storage

#### PR #63 (App Hosting)
| Component | Usage | Cost |
|-----------|-------|------|
| Cloud Run CPU | 1,250,000 vCPU-seconds | $25.20 (1,070K × $0.000024) |
| Cloud Run Memory | 625,000 GiB-seconds | $662.50 (265K × $0.0000025) |
| Cloud Run Requests | 10M requests | $3.20 (8M × $0.40/M) |
| Cloud Build | 50 builds × 16 min | $4.32 (720 min × $0.006) |
| Artifact Registry | 0.6 GB | $0.01 |
| Bandwidth | 500 GB | $73.50 (490 GB × $0.15/GiB) |
| Firestore | 100 GB storage | $9.90 |
| Firebase Auth | 1M MAU | $5,445.00 (990K × $0.0055) |
| **Total** | | **~$6,223.63/month** |

#### PR #64 (Cloud Functions)
| Component | Usage | Cost |
|-----------|-------|------|
| Invocations | 10M requests | $3.20 (8M × $0.40/M) |
| GB-seconds | 2,500,000 GB-sec | $5.25 (2.1M × $0.0000025) |
| CPU-seconds | 1,250,000 CPU-sec | $25.20 (1.05M × $0.000024) |
| Outbound networking | 500 GB | $59.40 (495 GB × $0.12/GB) |
| Firebase Hosting | 50 GB storage | $1.30 |
| Firestore | 100 GB storage | $9.90 |
| Firebase Auth | 1M MAU | $5,445.00 (990K × $0.0055) |
| **Total** | | **~$5,549.25/month** |

**Verdict:** Cloud Functions is ~$674 cheaper (10.8% savings).

## Scenario 0: Realistic App (30 users, daily usage)

**Assumptions:**
- 30 monthly active users
- Each user logs in **daily** (20 workdays/month)
- Each session: ~12 page views (dashboard, athlete profiles, plan edits)
- **30 users × 20 days × 12 pages = 7,200 page views/month**
- 50KB average page size
- 360 MB total bandwidth
- 5 builds/month (active development)
- 500 KB Firestore storage (athlete data, plans, etc.)

### PR #63 (App Hosting)

| Component | Usage | Free Tier | Billed | Cost |
|-----------|-------|-----------|--------|------|
| Cloud Run CPU | 900 vCPU-seconds | 180,000 | 0 | $0.00 |
| Cloud Run Memory | 450 GiB-seconds | 360,000 | 0 | $0.00 |
| Cloud Run Requests | 7,200 requests | 2,000,000 | 0 | $0.00 |
| Cloud Build | 5 builds × 16 min | 2,500 min | 0 | $0.00 |
| Artifact Registry | 0.6 GB | 0.5 GB | 0.1 GB | $0.01 |
| Bandwidth | 360 MB | 10 GiB | 0 | $0.00 |
| Firestore | 500 KB storage | 1 GiB | 0 | $0.00 |
| Firestore reads | 36,000 reads | 50,000/day | 0 | $0.00 |
| Firestore writes | 7,200 writes | 20,000/day | 0 | $0.00 |
| Firebase Auth | 30 MAU | 50,000 | 0 | $0.00 |
| **Total** | | | | **$0.01/month** |

### PR #64 (Cloud Functions)

| Component | Usage | Free Tier | Billed | Cost |
|-----------|-------|-----------|--------|------|
| Invocations | 7,200 requests | 2,000,000 | 0 | $0.00 |
| GB-seconds | 1,800 GB-sec | 400,000 | 0 | $0.00 |
| CPU-seconds | 900 CPU-sec | 200,000 | 0 | $0.00 |
| Outbound networking | 360 MB | 5 GB | 0 | $0.00 |
| Firebase Hosting | 10 MB storage | 10 GB | 0 | $0.00 |
| Firestore | 500 KB storage | 1 GiB | 0 | $0.00 |
| Firestore reads | 36,000 reads | 50,000/day | 0 | $0.00 |
| Firestore writes | 7,200 writes | 20,000/day | 0 | $0.00 |
| Firebase Auth | 30 MAU | 50,000 | 0 | $0.00 |
| **Total** | | | | **$0.00/month** |

### Monthly Breakdown (30 users, daily usage)

| Item | PR #63 (App Hosting) | PR #64 (Cloud Functions) |
|------|---------------------|-------------------------|
| Compute | $0.00 | $0.00 |
| Bandwidth | $0.00 | $0.00 |
| Storage | $0.01 | $0.00 |
| Auth | $0.00 | $0.00 |
| Firestore | $0.00 | $0.00 |
| **Total** | **$0.01** | **$0.00** |

**Verdict:** Both options are essentially free at 30 users with daily usage. You're using <1% of free tier limits.

## Free Tier Limits & Break-Even Points

### PR #63 (App Hosting)

| Resource | Free Tier | To Exceed Free Tier | Equivalent Traffic |
|----------|-----------|---------------------|-------------------|
| **Cloud Run Requests** | 2M/month | 2,000,001 requests | ~67K users (30 pages/user) |
| **Cloud Run CPU** | 180K vCPU-seconds | 180,001 vCPU-sec | ~14.4M pages (0.0125 sec/page) |
| **Cloud Run Memory** | 360K GiB-seconds | 360,001 GiB-sec | ~57.6M pages (0.00625 sec/page) |
| **Bandwidth (cached)** | 10 GiB/month | 10.24 GiB | ~200K users (50KB/page) |
| **Bandwidth (uncached)** | 10 GiB/month | 10.24 GiB | ~200K users (50KB/page) |
| **Cloud Build** | 2,500 min/month | 2,501 min | ~156 builds (16 min/build) |
| **Artifact Registry** | 0.5 GB | 0.51 GB | ~10 deploys (50MB/deploy) |
| **Firestore Storage** | 1 GiB | 1.01 GiB | ~20K athletes (50KB/athlete) |
| **Firestore Reads** | 50K/day (1.5M/month) | 50,001/day | ~10K users (5 reads/user) |
| **Firestore Writes** | 20K/day (600K/month) | 20,001/day | ~5K users (4 writes/user) |
| **Firebase Auth MAU** | 50,000/month | 50,001 MAU | 50,001 users |

### PR #64 (Cloud Functions)

| Resource | Free Tier | To Exceed Free Tier | Equivalent Traffic |
|----------|-----------|---------------------|-------------------|
| **Invocations** | 2M/month | 2,000,001 requests | ~67K users (30 pages/user) |
| **GB-seconds** | 400K/month | 400,001 GB-sec | ~16M pages (0.025 sec/page) |
| **CPU-seconds** | 200K/month | 200,001 CPU-sec | ~16M pages (0.0125 sec/page) |
| **Outbound Networking** | 5 GB/month | 5.12 GB | ~100K users (50KB/page) |
| **Firebase Hosting Storage** | 10 GB | 10.1 GB | ~200K users (50KB/page) |
| **Firebase Hosting Transfer** | 360 MB/day (10.8 GB/month) | 361 MB/day | ~7.2K users/day (50KB/page) |
| **Firestore Storage** | 1 GiB | 1.01 GiB | ~20K athletes (50KB/athlete) |
| **Firestore Reads** | 50K/day (1.5M/month) | 50,001/day | ~10K users (5 reads/user) |
| **Firestore Writes** | 20K/day (600K/month) | 20,001/day | ~5K users (4 writes/user) |
| **Firebase Auth MAU** | 50,000/month | 50,001 MAU | 50,001 users |

### Side-by-Side: When Do You Start Paying?

| Resource | PR #63 (App Hosting) | PR #64 (Cloud Functions) |
|----------|---------------------|-------------------------|
| **Requests** | >67K users | >67K users |
| **Compute** | >14.4M pages | >16M pages |
| **Bandwidth** | >200K users | >100K users |
| **Storage** | >200K users | >200K users |
| **Auth** | >50K users | >50K users |
| **Firestore** | >20K athletes | >20K athletes |

### Realistic Scenario: 30 Users

| Metric | Monthly Usage | Free Tier | Remaining |
|--------|---------------|-----------|-----------|
| Page views | 300 | 2,000,000 | 1,999,700 |
| Bandwidth | 15 MB | 10 GB | 9.985 GB |
| MAU | 30 | 50,000 | 49,970 |
| Firestore reads | 1,500 | 1,500,000 | 1,498,500 |
| Firestore writes | 300 | 600,000 | 599,700 |

**You're using 0.015% of available free tier.** You could grow 6,666x before paying anything.

## Summary Table

| Scale | PR #63 (App Hosting) | PR #64 (Cloud Functions) | Difference |
|-------|---------------------|-------------------------|------------|
| **30 users** | **$0.01/month** | **$0.00/month** | **+$0.01** |
| Small (1K users) | $0.01/month | $0.00/month | +$0.01 |
| Medium (10K users) | $0.41/month | $0.40/month | +$0.01 |
| Large (100K users) | $504.41/month | $502.43/month | +$1.98 |
| High Traffic (1M users) | $6,223.63/month | $5,549.25/month | +$674.38 |

## Key Insights

1. **Firebase Auth dominates costs** at scale (~80% of total bill). Both PRs incur this cost equally.

2. **Bandwidth costs favor Cloud Functions** — $0.12/GB vs $0.15-0.20/GB for App Hosting.

3. **Cloud Functions free tier is more generous** — 2M invocations vs 2M requests, but GB-seconds and CPU-seconds provide more value for compute-heavy workloads.

4. **App Hosting has better DX** — automatic deployments, preview channels, no cold starts.

5. **Cloud Functions has cold starts** — 2-3 seconds on first request, which may impact user experience.

## Recommendation

- **Small/Medium apps (<10K users):** Either option works. Choose based on DX preferences.
- **Large apps (10K-100K users):** Cloud Functions saves ~$2/month. Consider if cold starts are acceptable.
- **High traffic (100K+ users):** Cloud Functions saves significant money (~10%). Cold starts become less impactful with warm instances.

## Cost Optimization Tips

### For Both PRs
1. **Optimize Firestore reads** — Use compound queries, avoid N+1 queries
2. **Cache aggressively** — Use CDN headers for static assets
3. **Batch operations** — Use Firestore batch writes for multiple updates
4. **Monitor usage** — Set up Firebase budget alerts

### For PR #63 (App Hosting)
1. **Use caching** — Enable CDN caching for static assets
2. **Optimize images** — Use WebP format, lazy loading
3. **Monitor Cloud Run** — Set max instances to control costs

### For PR #64 (Cloud Functions)
1. **Increase memory** — More memory = faster execution = fewer GB-seconds
2. **Use connection pooling** — Reuse Firestore connections across requests
3. **Implement caching** — Cache frequently accessed data in memory
4. **Set max instances** — Prevent runaway scaling
