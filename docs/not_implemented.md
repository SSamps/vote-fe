# Not Implemented

This document lists production-quality features that have been consciously deferred.
Each item is sound practice and should be added as the project matures — they were
left out to keep the initial build simple, not because they are unimportant.

---

## CI pipeline

There is no automated CI. On every push or pull request, the following should run:

```yaml
- npm run typecheck
- npm run lint
- npm test
- npm run build
```

Recommended: GitHub Actions, triggered on `push` and `pull_request` to `main`.
