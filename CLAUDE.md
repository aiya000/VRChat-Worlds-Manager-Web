# Claude Code Instructions

## Read AGENTS.md first

**Read [AGENTS.md](./AGENTS.md) in this directory before doing anything else**, and re-read it before
branching, committing, opening a Pull Request, or releasing.

`AGENTS.md` is the single place this repository records how it wants to be worked on -- package manager,
code style, testing, branching and releases. Those rules override any default behaviour.

## The three that are easiest to get wrong

These are already in `AGENTS.md`. They are repeated here because they are the ones most often remembered
wrongly, and the most expensive to get wrong.

- **`develop` is the primary working branch.** Never merge into `main` unless explicitly asked to -- `main`
  is production
- **A Pull Request is for work that resolves a GitHub Issue.** Work asked for directly in conversation is
  committed straight to `develop`. The rule is about Issues, not about how large the change is
- **Always use Bun.** Never `npm`, `yarn`, or `pnpm`

## Before committing

- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `bun run test` and, when the change touches the interface, `bun run test:e2e`
