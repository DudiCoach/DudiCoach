# Incident: credential exposure in PR #69 (2026-08-19)

**Status:** remediation in progress (PR closed; rotation pending user action)
**Severity:** P0 (public repository, committed credential)
**Owner:** Dawid Malicki
**Redaction note:** this document intentionally contains NO secret values, credentials, or
external URLs. It names the repository owner (already public in `docs/engineering-policy.md`
and git history).

## Summary

PR #69 (`feature/opencode-skills-agents-md`) committed a live PostgreSQL connection
credential inside `.opencode/skills/supabase-cpet-monitor/SKILL.md` (3 occurrences:
connection-details section + 2 psql command examples). The credential is a `postgres`
user password for a local Cloud SQL Auth Proxy connection (`localhost:5433`) to the
`peaklab` database. This violates `docs/engineering-policy.md` hard rule
"Never hardcode secrets or credentials" and applies to a PUBLIC repository.

The PR was closed without merging on 2026-08-19 and its head branch was deleted.

## Scope of exposure

- Credential value: `postgres` password for `peaklab` database (local proxy endpoint).
- Contained only in the two commits of PR #69:
  - `1b8658c9ad5a33c72f8676a3dc1d286aaab35d6e`
  - `d4adcb47e808dc570f6624bc7a20f9d6682bfda5`
- Full-ref scan (`git rev-list --all` + `git grep`) confirms the credential appears
  in **no other commit or ref** in the repository — not in `main`, not in any other
  branch, not in the stash.
- No global/out-of-repo copy of the `supabase-cpet-monitor` skill was found on this
  machine (searched user config/skills directories and the PeaklabStrategy project
  tree). The PR description claimed adaptation from a global skill source; that
  source is not present locally, so no local redaction was needed.
- The credential is NOT the DudiCoach production database credential (different
  database/instance), so the DudiCoach production environment is unaffected.

## Actions completed (2026-08-19)

1. PR #69 closed without merge; comment added explaining the security reason.
2. Head branch `feature/opencode-skills-agents-md` deleted from origin.
3. Comment corrected via API after a typo (final text is the authoritative record).
4. Local refs scanned for the credential (result: 2 commits only, both in PR #69).
5. Repository hygiene: stash dropped, stale local/remote branches of closed or
   merged PRs removed; only `main` remains.
6. Replacement minimal opencode configuration planned as a separate PR (no reuse
   of PR #69 commits).

## Required user actions (rotation — still pending)

Treat the credential as compromised regardless of local-only usage because it is
visible in the public PR history.

1. Rotate the `postgres` password on the target Cloud SQL instance that serves
   `peaklab` (change in Cloud SQL console / gcloud, then update any local proxy
   config and downstream scripts that consume it).
2. After rotation, verify the old credential is rejected: an attempt to connect
   with the leaked password must fail with an authentication error.
3. Review authentication/connection logs of the instance for any connections
   since 2026-08-13 (PR creation date); flag anything not matching known
   operators.
4. If the password is reused anywhere else (other instances, services), rotate
   those too.

After rotation completes, update this document: mark rotation done with the
verification result (no secret values).

## GitHub sensitive-data removal (recommended)

Deleting the branch does NOT remove the credential from the PR commits, which
remain reachable via the closed PR's refs. File a GitHub Support request
(sensitive data removal) asking to purge the two commits above from all refs and
caches. GitHub accepts a commit SHA or a file path; provide both. File this
request ONLY after rotation and verification are complete (steps 1–2 above), so
that the assertion below is true. Draft request text:

> Requesting removal of sensitive data (a database credential) from two commits
> in the DudiCoach/DudiCoach repository: 1b8658c9ad5a33c72f8676a3dc1d286aaab35d6e
> and d4adcb47e808dc570f6624bc7a20f9d6682bfda5, in the file
> .opencode/skills/supabase-cpet-monitor/SKILL.md (originally opened in a pull
> request that has been closed and its branch deleted). Please purge these
> commits from all refs, pull-request refs, and caches. The credential has been
> rotated.

## Residual risks

- Until GitHub purges the commits, the credential string remains publicly
  retrievable; rotation is the only effective mitigation.
- Cloud SQL proxy binding to localhost limits remote reachability, but the
  instance may still accept connections from other hosts if firewall rules allow.
- No evidence of unauthorized use was found in available logs; log review on the
  target instance is part of the pending user action.

## Follow-ups

- [ ] Rotate `postgres` password for `peaklab` instance (user).
- [ ] Verify old credential rejected (user).
- [ ] Review instance connection logs since 2026-08-13 (user).
- [ ] Submit GitHub sensitive-data removal request AFTER rotation+verification (user).
- [ ] Check for repository forks and GitHub secret-scanning alerts (user; dashboard).
- [ ] Merge this incident record (this PR).