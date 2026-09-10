# Contributing to VRChat Worlds Manager Web

Thank you for considering contributing to VRChat Worlds Manager Web!  
We welcome all kinds of contributions, including bug reports, feature requests, translations, and code improvements.

## Language Usage

Issues and pull requests are welcome in **English or Japanese**.

Both are on that list for practical reasons, and for no other kind of reason:

- **English**, because it is the language the most people who arrive here can read
- **Japanese**, because the maintainer is a native speaker of it

Neither is a statement about who is welcome. If you are comfortable in neither, write in whichever you prefer with the help of a machine translation -- that is a perfectly ordinary way to file an Issue here, and nobody will hold the wording against the report.

## This Project Is Vibe Coded, End to End

Every line in this repository is written by an AI agent working from a conversation. That is not a phase this project is passing through; it is how it is built.

Two things follow from it, and it is only fair to say them before you spend an evening on a patch:

- **Code that is merged may later be rewritten or removed, without anyone asking first.** Not because it was poor work. An agent reworking an area rewrites what it finds there, and there is no register of which lines arrived from where.
- **The commit history is never rewritten.** Your commit, under your name, stays in the log for as long as this repository exists. The credit is permanently yours, including where the code no longer is.

## Open an Issue Before You Open a Pull Request

**Always** -- not only for large changes.

Say what you want added or fixed and, if you can, how you would build it: the design, the shape of the interface, what the screen would look like. A sketch or a screenshot is worth more here than a paragraph.

This is asked for because of the section above. The code moves quickly and in large sweeps, so a pull request that arrives without its reasoning stated first has often been overtaken by the time it is read -- and there is then nothing to weigh it against. An Issue is what makes the intent survive the next rewrite, even when the code does not.

## How to Contribute

1. **Fork the repository** and create your branch from `develop`, which is where development happens. `main` is the production release.
2. **Describe your changes** clearly in your pull request.
3. **Test your changes** before submitting.

### Issues

Open an [Issue](https://github.com/aiya000/VRChat-Worlds-Manager-Web/issues) before modifying any code, as above. Questions and troubleshooting belong in an Issue too -- this repository has no Discussions.

If you decide to work on an Issue, please assign yourself to avoid conflicts.
If you lack permission to self-assign, leave a comment to indicate your intent.

> [!WARNING]
> Before creating a new Issue, check for duplicates.  
> Also, even if an implementation approach is decided, do not close the Issue until the code is fully merged.

### Pull Requests

When creating a Pull Request, please follow these guidelines:

1. Ensure there is a related Issue (create one if necessary).
2. Target `develop`, not `main`.
3. Keep changes minimal to facilitate review.
4. (If possible) Use a prefix for branch names (e.g., `feat/`, `fix/`, `perf/`, `docs/`).
5. (If possible) Attach screenshots for UI changes.

If new language file entries are added, you do not need to fill out all translations yourself.  
After creating a PR, you can request translation contributions from others.

## Setting Up the Development Environment

Install the following:

- [Bun](https://bun.sh/) (v1.2+)

We recommend using [VSCode](https://code.visualstudio.com/), but you can use any editor you prefer.

> [!IMPORTANT]
> **This project uses Bun, and only Bun.** `npm`, `yarn` and `pnpm` all write a lock file of their own beside `bun.lock` and resolve dependencies differently.

### Installing Packages

```bash
bun install
```

Playwright's browsers are not part of that -- they live in a machine-wide cache and are tied to the Playwright version. Run this once, and again whenever Playwright is upgraded:

```bash
bunx playwright install chromium
```

### Running in Dev Mode

```bash
bun run dev
```

The port is fixed at 3456 on purpose: it is a registered origin of the Google OAuth client, so signing in to Google locally stops working if it moves.

Frontend code changes will trigger automatic updates.  
If updates do not appear, try refreshing with `Ctrl-R`.

### Checks and Tests

```bash
# Prettier, ESLint and TypeScript, all three
bun run check

# Unit and integration tests
bun run test

# End-to-end tests (Playwright). It starts the dev server itself
bun run test:e2e

# Production build
bun run build
```

If you touched anything under `worker/`, run its own checks as well:

```bash
cd worker && bun run check
```

### Code Formatting

```bash
bun run format
```

### Useful Commands

Sometimes after merging a PR on GitHub, the remote branch is deleted, but the local branch still remains.
To avoid clutter, you can clean up your local branches that:

- Were already merged and deleted on GitHub
- Were previously pushed, but are now gone on origin
- Are not your private local-only branches

```bash
git fetch --prune
git branch -vv | grep ': gone]' | awk '{print $1}' | xargs -n 1 git branch -d
```

---

Thank you for helping make VRChat Worlds Manager Web better!
