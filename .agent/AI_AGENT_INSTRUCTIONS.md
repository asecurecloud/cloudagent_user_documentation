# AI Agent Instructions

## Product Documentation Update Workflow

For product-driven documentation updates, read `.agent/DOCS_UPDATE_AGENT.md` first.

For automation, run from clean checkouts and treat the remote default branches as the source of truth.

Start with a plan:

```bash
npm run docs:plan
```

This checks the frontend, backend, apps, and userdocs repos, refuses to pull over dirty worktrees, pulls latest changes when clean, reports the diff since the last reviewed documentation baseline, and prints a proposed documentation plan without editing files.

## Before Committing Documentation Changes

Whenever you make changes to the documentation in the `pages/` directory, you **MUST** run the following command before committing:

```bash
npm run generate-llms
```

This will regenerate the `public/llms.txt` file, which is a consolidated version of all documentation optimized for LLM consumption.

## Workflow

1. Make your documentation edits in `pages/`
2. Run `npm run generate-llms`
3. Add both your changes AND the updated `public/llms.txt` to your commit
4. Commit and push

## Example

```bash
# After editing pages/guide/dashboard.mdx
npm run generate-llms
git add pages/guide/dashboard.mdx public/llms.txt
git commit -m "docs: update dashboard guide"
git push
```

This ensures the LLM-friendly documentation stays in sync with the human-readable docs.
