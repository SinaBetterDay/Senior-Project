# FAIR agent navigation

Start with `CLAUDE.md`, then use `DIRECTORY.md` to select only the context, source files, and tests needed for the task.

Do not recursively load the repository. In particular, skip lockfile bodies, generated output, binary fixtures, Jira CSV exports, and legacy placeholders unless the request specifically needs them.

## Required validation before finishing

- Add or update tests for every code change. Run focused tests while developing, then run `npm test` from the repository root before declaring any code, configuration, dependency, or feature task complete.
- Also run the affected package checks: client changes require typecheck and build; Apify changes require build; Prisma changes require `npx prisma validate` from `server/`.
- Test-framework or coverage changes also require `npm run test:coverage`.
- Documentation-only changes require both documentation checks below.
- Never claim completion when a required check fails. Fix it, or clearly report the exact failure and why it remains.

```bash
npm run docs:check
npm run test:docs
```