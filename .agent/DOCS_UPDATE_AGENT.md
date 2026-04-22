# CloudAgent Docs Update Agent

Use this workflow whenever product changes may require user documentation updates.

## Repositories

The workspace root is `../` from this docs repo:

- `cloudagent_frontend` - React/Vite product UI
- `cloudagent_backend` - API backend, infra, Lambda handlers
- `cloudagent_apps` - supporting app code
- `cloudagent_userdocs` - Nextra documentation site

Do not create a git repository at the workspace root. Each repo above is already tracked independently.

## Start Of Every Run

Automation should run from clean checkouts. The remote default branch is the source of truth because it represents what is deployed or about to be deployed.

1. Check all four repos for uncommitted work.
2. If any repo has uncommitted changes, stop and report an operator error. Automation should not run from a dirty checkout.
3. Fetch and fast-forward each repo from its remote default branch with `git pull --ff-only`.
4. Run `npm run docs:plan` from `cloudagent_userdocs` to compare product repos against `.agent/docs-update-state.json` and produce a documentation update plan.
5. Review the plan. Do not edit documentation until the plan is accepted by the operator or automation policy.
6. After approval, make the planned docs and screenshot updates.

The agent must not document every code diff. Update docs only when a change affects user-facing behavior, navigation, labels, setup steps, screenshots, integrations, permissions, reports, workflows, or troubleshooting.

## Code Context To Review

Frontend:

- Routes and navigation: `cloudagent_frontend/src/App.jsx`, `src/pages/**`, sidebar/header components.
- User workflows: `src/features/**`, `src/services/**`, `src/helpers/**`, `src/hooks/**`.
- Screenshots and labels: inspect changed components directly, not only commit messages.

Backend:

- API routes: `cloudagent_backend/cloudagent-api-backend/routes/**`.
- Agent behavior and tools: `cloudagent_backend/cloudagent-api-backend/core/**`, `tools/**`, `helpers/**`.
- Infra/runtime changes: `cloudagent_backend/infra/**`.

Docs:

- MDX content: `cloudagent_userdocs/pages/**`.
- Navigation: `_meta.json` files.
- Images: `cloudagent_userdocs/public/images/**`.
- LLM output: `cloudagent_userdocs/public/llms.txt`.

## Documentation Standards

- Write in second person, active voice, present tense.
- Keep paragraphs short and task-oriented.
- Use Nextra `Callout` for warnings, prerequisites, tips, and preview/coming-soon notices.
- Use tables for states, permissions, metrics, and supported options.
- End substantial guides with `## Next Steps`.
- Keep navigation titles and product labels aligned with the current UI.
- If a feature is not live or is partially implemented, say so clearly.

## Screenshot Workflow

Use `npm run screenshots:capture` from `cloudagent_userdocs` when screenshots need updates.

Screenshot rules:

- Credentials are read from the workspace root `.env`. Do not put credentials in scripts, docs, or prompts.
- Use the existing standard viewport: `1512x805`, `deviceScaleFactor: 2`.
- Save full app screenshots as `*_cc.png` in `public/images`.
- Capture sidebar, top bar, and main content with no excess whitespace.
- Prefer one stable screenshot per main page. Add flow-specific screenshots only when they clarify a task.
- Redact sensitive data before capture:
  - workload names
  - cloud account names
  - AWS account IDs
  - ARNs
  - emails
  - user names
  - external IDs
  - role names
  - subscription IDs
  - access keys or secrets
- After capture, inspect every image before committing. If any sensitive data remains visible, fix redaction and recapture.

## Required Validation

After docs edits:

1. Run `npm run generate-all`.
2. Run `npm run build`.
3. Review `git diff`.
4. Include changed MDX, changed screenshots, `public/llms.txt`, and `public/sitemap.xml` when applicable.
5. Update `.agent/docs-update-state.json` only after the docs are reviewed against the latest product changes.

## Commit Guidance

Use focused commits. Good examples:

- `docs: update workload guide for governance tabs`
- `docs: refresh dashboard screenshots`
- `docs: document permission profile validation`

Do not commit generated caches, local credentials, or unrelated workspace files.
