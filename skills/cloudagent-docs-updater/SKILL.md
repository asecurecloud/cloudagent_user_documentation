---
name: cloudagent-docs-updater
description: Use when updating CloudAgent user documentation from product changes. Generates a docs update plan from frontend, backend, apps, and userdocs git diffs; requires approval before edits; guides screenshot capture and validation.
---

# CloudAgent Docs Updater

Use this skill when the user asks to update CloudAgent docs, create a docs update plan, review product diffs for docs impact, refresh CloudAgent screenshots, or run the docs-update agent.

## Workspace

Default workspace root:

`/Users/osman/Documents/ASC-Production/cloudagent`

Repos:

- `cloudagent_frontend`
- `cloudagent_backend`
- `cloudagent_apps`
- `cloudagent_userdocs`

Do not create a git repo at the workspace root. Each repo is tracked independently.

## Start Here

1. Open and follow:
   `/Users/osman/Documents/ASC-Production/cloudagent/cloudagent_userdocs/.agent/DOCS_UPDATE_AGENT.md`
2. Work from:
   `/Users/osman/Documents/ASC-Production/cloudagent/cloudagent_userdocs`
3. Generate a plan:

```bash
npm run docs:plan
```

This command should not edit files. It checks repo status, pulls latest when product repos are clean, compares against the docs baseline, and prints candidate docs/screenshots.

## Approval Gate

Do not edit docs or capture screenshots until the user approves the plan in plain language.

Accept approvals like:

- `Approved: workflows and health docs. Screenshots: none.`
- `Approved: workflows only. Screenshots: workflows_cc.`
- `Approved: scanner artifact docs. Screenshots: health_dashboard_cc, cost_dashboard_cc.`

Only touch approved docs and approved screenshots.

If approval is ambiguous, ask for a shorter scope instead of guessing.

## Screenshot Rules

Use screenshots only when the approved change needs a visible UI update.

Capture from the docs repo:

```bash
npm run screenshots:capture
```

The screenshot script logs into the live product using credentials from the workspace root `.env`, redacts sensitive text, and saves images in `public/images`.

Before committing screenshots, inspect them for:

- workload names
- account names
- AWS account IDs
- ARNs
- emails
- usernames
- external IDs
- role names
- subscription IDs

If sensitive data remains, fix redaction and recapture.

## Validation

After approved edits:

```bash
npm run generate-all
npm run build
```

Review `git diff`. Include changed MDX, changed screenshots, `public/llms.txt`, and `public/sitemap.xml` when applicable.

Run this only after the user accepts the docs update:

```bash
npm run docs:update:mark-reviewed
```

## Output Format

When planning, report:

- changed repos and commits
- likely user-facing impact
- docs files proposed
- screenshot ids proposed, or `none`
- explicit approval request

When finished, report:

- files changed
- commands run
- anything skipped or blocked
