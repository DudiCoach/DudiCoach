# Local CI Emulation Checklist

Use this checklist when testing CI/CD pipelines locally before pushing to CI.

## Pre-Flight Checklist

- [ ] Project has CI/CD workflow file (`.github/workflows/*.yml` or `.gitlab-ci.yml`)
- [ ] Current OS is compatible with target CI (see OS Mapping below)
- [ ] No secrets required for local execution
- [ ] Deployment steps identified and will be skipped

## OS Compatibility Mapping

| CI Runner | Your OS | Compatible? |
|-----------|----------|-------------|
| `ubuntu-latest` | Ubuntu/Debian | ✅ Yes |
| `ubuntu-latest` | macOS | ⚠️ Most likely |
| `ubuntu-latest` | Windows/WSL | ✅ Yes (WSL) |
| `macos-latest` | macOS | ✅ Yes |
| `macos-latest` | Ubuntu | ⚠️ May differ |
| `windows-latest` | Windows | ✅ Yes |
| `windows-latest` | WSL | ⚠️ May differ |

## 3-Phase Execution

### Phase 1: Clean ⏱️ ~1-2 min

```bash
# Node.js/Frontend projects
rm -rf node_modules/.cache
rm -rf dist/ build/ .next/ .nuxt/ .output/
rm -rf coverage/ .turbo/

# Python projects
rm -rf *.egg-info/
rm -rf __pycache__/ **/__pycache__/
rm -rf .pytest_cache/ .mypy_cache/

# Go projects
rm -rf target/

# Rust projects
rm -rf target/ debug/ release/
```

**Verify:** Run `ls -la` to confirm directories are removed

### Phase 2: Analyze ⏱️ ~30 sec

**Find workflow files:**
```bash
# GitHub Actions
ls -la .github/workflows/

# GitLab CI
cat .gitlab-ci.yml
```

**Extract key information:**
- Jobs to execute
- `runs-on` value (OS)
- Required environment variables
- Dependencies to install

**OS Detection:**
```bash
# Check your local OS
uname -a          # Linux/macOS
systeminfo        # Windows
sw_vers           # macOS
```

### Phase 3: Execute ⏱️ Varies

#### Node.js Projects
```bash
npm ci                    # Install exact versions
npm run lint             # Lint code
npm run typecheck       # Type check
npm test                # Run tests
npm run build           # Build
```

#### Python Projects
```bash
python3 -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
ruff check .
mypy .
pytest
```

#### Go Projects
```bash
go mod download
go test ./...
go vet ./...
go build ./...
```

#### Rust Projects
```bash
cargo test
cargo clippy -- -D warnings
cargo build --release
```

## Safety Boundaries

### ALWAYS SKIP These Steps

| Step Type | Why Skip |
|-----------|----------|
| `deploy` | May modify production |
| `release` | Creates tags/releases |
| `publish` | Publishes to registries |
| Uses `${{ secrets.* }}` | Requires credentials |
| `aws-actions/configure-aws-credentials` | Requires AWS access |
| Approval-gated jobs | Needs manual approval |
| Database migrations (prod) | Can corrupt data |

### SAFE To Execute

| Step Type | Why Safe |
|-----------|----------|
| `lint` | Code quality only |
| `test` | Runs locally |
| `build` | Creates local artifacts |
| Security scans | Read-only analysis |
| Type checking | No side effects |

## Common Issues & Solutions

### Issue: `npm ci` fails
**Solution:** Delete `node_modules` and try again
```bash
rm -rf node_modules
npm ci
```

### Issue: Python packages not found
**Solution:** Create fresh virtual environment
```bash
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Issue: Tests fail locally but pass in CI
**Solution:** Check for environment differences
```bash
# Compare Node versions
node --version
# vs CI version in workflow file

# Compare OS
uname -a
```

### Issue: Permission denied on scripts
**Solution:** Make script executable
```bash
chmod +x ./scripts/*.sh
```

### Issue: Secret value errors
**Solution:** Create mock environment file
```bash
# .env.test (add to .gitignore)
DATABASE_URL=postgresql://localhost:5432/test
API_KEY=mock-key-for-testing
```

## Quick Reference Commands

```bash
# Full cleanup + install + test (Node.js)
rm -rf node_modules/.cache dist coverage && npm ci && npm run lint && npm test

# Full cleanup + install + test (Python)
rm -rf __pycache__ .pytest_cache && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && pytest

# Quick check (does project build?)
npm run build          # Node.js
go build ./...         # Go
cargo build           # Rust
```

## Output Template

When completing local CI emulation, document:

```
## Local CI Emulation Results

**Date:** YYYY-MM-DD
**Project:** [name]
**Workflow:** [file]

### Phase 1: Clean
- [x] Build directories removed

### Phase 2: Analyze
- Workflow: [ci.yml]
- OS: ubuntu-latest → local: Ubuntu 22.04 ✅
- Jobs identified: [lint, test, build]

### Phase 3: Execute
- [x] npm ci - ✅ Success
- [x] npm run lint - ✅ Success  
- [x] npm test - ✅ 42 passed
- [x] npm run build - ✅ Success

### Skipped (Safety)
- [ ] deploy job - requires secrets
- [ ] publish job - requires npm token

### Notes
[Any observations or issues]
```

## Related Resources

- `implementation-playbook.md` - Detailed Local CI Emulation Engine section
- `cicd-pipeline` skill - GitHub Actions reference
