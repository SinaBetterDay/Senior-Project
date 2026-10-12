# FAIR agent navigation

Start with `CLAUDE.md`, then use `DIRECTORY.md` to select only the context, source files, and tests needed for the task.

Do not recursively load the repository. In particular, skip lockfile bodies, generated output, binary fixtures, Jira CSV exports, and legacy placeholders unless the request specifically needs them.

Validate documentation changes with:

```bash
npm run docs:check
npm run test:docs
```