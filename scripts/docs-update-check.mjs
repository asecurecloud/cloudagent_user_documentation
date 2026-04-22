import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = path.resolve(__dirname, '..');
const STATE_FILE = path.join(DOCS_ROOT, '.agent', 'docs-update-state.json');
let SHOULD_PULL = process.argv.includes('--pull');
const SHOULD_PLAN = process.argv.includes('--plan');
const SHOULD_MARK_REVIEWED = process.argv.includes('--mark-reviewed');

function runGit(repoPath, args, options = {}) {
  const output = execFileSync('git', args, {
    cwd: repoPath,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  });
  return options.trim === false ? output : output.trim();
}

function readState() {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(`Missing state file: ${STATE_FILE}`);
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function repoAbsPath(repoConfig) {
  return path.resolve(DOCS_ROOT, repoConfig.path);
}

function statusLines(repoPath) {
  const output = runGit(repoPath, ['status', '--porcelain'], { trim: false });
  const lines = output ? output.split('\n').filter(Boolean) : [];
  return lines.filter((line) => {
    const filePath = line.slice(3).trim();
    return !isIgnoredLocalEnvFile(filePath);
  });
}

function isIgnoredLocalEnvFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const name = normalized.split('/').pop() || '';
  if (name === '.env') return true;
  if (name.startsWith('.env.')) return true;
  if (name.endsWith('.local')) return true;
  return false;
}

function summarizeDiff(repoPath, baseCommit, headCommit) {
  if (!baseCommit || baseCommit === headCommit) {
    return {
      commitCount: 0,
      commits: [],
      files: [],
      stats: '',
    };
  }

  let commitCount = 0;
  let commits = [];
  let files = [];
  let stats = '';

  try {
    commitCount = Number(runGit(repoPath, ['rev-list', '--count', `${baseCommit}..${headCommit}`]) || 0);
    const commitOutput = runGit(repoPath, ['log', '--oneline', '--decorate', '--no-merges', `${baseCommit}..${headCommit}`]);
    commits = commitOutput ? commitOutput.split('\n').slice(0, 20) : [];
    const fileOutput = runGit(repoPath, ['diff', '--name-status', `${baseCommit}..${headCommit}`]);
    files = fileOutput ? fileOutput.split('\n') : [];
    stats = runGit(repoPath, ['diff', '--stat', `${baseCommit}..${headCommit}`]);
  } catch (err) {
    return {
      error: `Could not diff ${baseCommit}..${headCommit}: ${err.message}`,
      commitCount: 0,
      commits: [],
      files: [],
      stats: '',
    };
  }

  return { commitCount, commits, files, stats };
}

function classifyFile(filePath) {
  const p = filePath.toLowerCase();
  if (p.includes('/pages/') || p.includes('/components/') || p.includes('/features/') || p.endsWith('app.jsx')) return 'user-facing-ui';
  if (p.includes('/routes/') || p.includes('/core/') || p.includes('/tools/') || p.includes('/helpers/')) return 'backend-behavior';
  if (p.includes('/infra/') || p.includes('template.yaml')) return 'infrastructure';
  if (p.includes('/services/') || p.includes('/hooks/')) return 'integration-flow';
  if (p.includes('/pages/') || p.endsWith('.mdx') || p.endsWith('_meta.json')) return 'docs';
  return 'supporting';
}

function docsSignal(files) {
  const signals = new Map();
  for (const entry of files) {
    const parts = entry.split(/\s+/);
    const filePath = parts.slice(1).join(' ') || entry;
    const kind = classifyFile(filePath);
    signals.set(kind, (signals.get(kind) ?? 0) + 1);
  }
  return [...signals.entries()].map(([kind, count]) => `${kind}: ${count}`).join(', ') || 'none';
}

function getChangedFilePath(entry) {
  const parts = entry.split(/\s+/);
  return parts.slice(1).join(' ') || entry;
}

function inferPlanItems(repoReports) {
  const items = [];
  const allFiles = repoReports.flatMap((report) =>
    (report.diff?.files || []).map((entry) => ({
      repo: report.name,
      path: getChangedFilePath(entry),
      entry,
    }))
  );

  const has = (matcher) => allFiles.some(({ repo, path }) => matcher(repo, path.toLowerCase()));

  if (has((repo, p) => repo === 'cloudagent_frontend' && (p.includes('/pages/') || p.includes('/components/') || p.includes('/features/') || p.endsWith('app.jsx')))) {
    items.push({
      area: 'Frontend UI',
      action: 'Inspect changed routes/components for navigation, labels, workflows, and screenshot impact.',
      docs: ['pages/guide/**', 'pages/cookbooks/**'],
      screenshots: 'Likely if changed UI is visible in the product.',
    });
  }

  if (has((repo, p) => repo === 'cloudagent_backend' && p.includes('workflows'))) {
    items.push({
      area: 'Automation workflows',
      action: 'Review workflow builder/runtime changes for user-visible workflow creation or execution behavior.',
      docs: ['pages/guide/automation/workflows.mdx', 'pages/guide/automation/blueprints.mdx'],
      screenshots: 'Only if the workflow builder UI changed.',
    });
  }

  if (has((repo, p) => repo === 'cloudagent_backend' && (p.includes('scan-router') || p.includes('scanner') || p.includes('resource-health') || p.includes('cost-scanner') || p.includes('threat-scanner')))) {
    items.push({
      area: 'Scanners and analysis artifacts',
      action: 'Review scan/result behavior for health, cost, inventory, threat, pending states, and artifact-backed analysis.',
      docs: [
        'pages/guide/dashboards/health.mdx',
        'pages/guide/dashboards/cost.mdx',
        'pages/guide/dashboards/threat-management.mdx',
        'pages/guide/reports-insights/recommendations.mdx',
      ],
      screenshots: 'Maybe; capture only if live pages expose new labels or states.',
    });
  }

  if (has((repo, p) => repo === 'cloudagent_backend' && (p.includes('permission') || p.includes('ops-router') || p.includes('workload')))) {
    items.push({
      area: 'Cloud setup, permissions, and workloads',
      action: 'Review whether permission profile or workload behavior changed for users.',
      docs: [
        'pages/guide/cloud-setup/permissions.mdx',
        'pages/guide/workloads-governance/workloads.mdx',
      ],
      screenshots: 'Only if Cloud Setup or Workloads UI changed.',
    });
  }

  if (has((repo, p) => repo === 'cloudagent_userdocs' && (p.endsWith('.mdx') || p.endsWith('_meta.json')))) {
    items.push({
      area: 'Existing docs changes',
      action: 'Review docs repo changes and regenerate LLM/sitemap outputs after edits.',
      docs: ['public/llms.txt', 'public/sitemap.xml'],
      screenshots: 'Only if image references changed.',
    });
  }

  return items;
}

function printDocumentationPlan(reports) {
  console.log('\n# Proposed Documentation Plan');
  const dirty = reports.filter((report) => report.dirty);
  const dirtyProductRepos = dirty.filter((report) => report.name !== 'cloudagent_userdocs');
  if (dirtyProductRepos.length) {
    console.log('Status: blocked');
    console.log('Reason: dirty checkout. Automation should run from clean repos and remote default branches.');
    console.log('Next action: clean or recreate the automation workspace, then rerun npm run docs:plan.');
    return;
  }
  if (dirty.length) {
    console.log('Status: provisional');
    console.log('Reason: only cloudagent_userdocs is dirty. This plan is for review only; do not edit docs, capture screenshots, or mark reviewed until the docs repo is clean.');
  }

  const changedReports = reports.filter((report) => (report.diff?.commitCount || 0) > 0);
  if (!changedReports.length) {
    console.log('Status: no product diffs since the last reviewed baseline.');
    console.log('Recommended action: no docs edits; do not mark reviewed unless this was an intentional audit run.');
    return;
  }

  console.log('Status: ready for review');
  console.log('Policy: no documentation files should be edited until this plan is accepted.');
  console.log('\nChanged repos:');
  for (const report of changedReports) {
    console.log(`- ${report.name}: ${report.diff.commitCount} commit(s), ${report.diff.files.length} changed file(s)`);
  }

  const planItems = inferPlanItems(reports);
  if (!planItems.length) {
    console.log('\nNo obvious user-facing documentation impact was detected.');
    console.log('Recommended action: inspect commits manually; if no user-facing behavior changed, mark reviewed after approval.');
    return;
  }

  console.log('\nReview items:');
  for (const [index, item] of planItems.entries()) {
    console.log(`${index + 1}. ${item.area}`);
    console.log(`   Action: ${item.action}`);
    console.log(`   Candidate docs: ${item.docs.join(', ')}`);
    console.log(`   Screenshots: ${item.screenshots}`);
  }

  console.log('\nAfter approval: update only the affected docs, capture screenshots only when UI changed, run npm run generate-all and npm run build, then run npm run docs:update:mark-reviewed.');
}

function printRepoReport(name, repoConfig) {
  const repoPath = repoAbsPath(repoConfig);
  const branch = runGit(repoPath, ['branch', '--show-current']) || '(detached)';
  const head = runGit(repoPath, ['rev-parse', 'HEAD']);
  const status = statusLines(repoPath);

  console.log(`\n## ${name}`);
  console.log(`Path: ${path.relative(DOCS_ROOT, repoPath) || '.'}`);
  console.log(`Branch: ${branch}`);
  console.log(`HEAD: ${head}`);

  if (status.length) {
    console.log('Status: dirty');
    for (const line of status.slice(0, 40)) console.log(`  ${line}`);
    if (status.length > 40) console.log(`  ... ${status.length - 40} more`);
    return { name, repoPath, head, dirty: true, diff: null };
  }

  console.log('Status: clean');

  if (SHOULD_PULL) {
    console.log('Pull: git pull --ff-only');
    runGit(repoPath, ['pull', '--ff-only'], { stdio: 'inherit' });
  }

  const refreshedHead = runGit(repoPath, ['rev-parse', 'HEAD']);
  const base = repoConfig.lastReviewedCommit;
  const diff = summarizeDiff(repoPath, base, refreshedHead);

  console.log(`Last reviewed: ${base || '(none)'}`);
  console.log(`Commits since reviewed: ${diff.commitCount}`);
  console.log(`Docs signal: ${docsSignal(diff.files)}`);

  if (diff.error) {
    console.log(`Diff error: ${diff.error}`);
  }
  if (diff.commits.length) {
    console.log('Recent commits:');
    for (const commit of diff.commits) console.log(`  ${commit}`);
  }
  if (diff.files.length) {
    console.log('Changed files:');
    for (const file of diff.files.slice(0, 80)) console.log(`  ${file}`);
    if (diff.files.length > 80) console.log(`  ... ${diff.files.length - 80} more`);
  }
  if (diff.stats) {
    console.log('Diff stat:');
    console.log(diff.stats);
  }

  return { name, repoPath, head: refreshedHead, dirty: false, diff };
}

function markReviewed(state, reports) {
  for (const report of reports) {
    if (report.dirty) {
      throw new Error(`Cannot mark reviewed while ${report.name} is dirty.`);
    }
    state.repos[report.name].lastReviewedCommit = report.head;
  }
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
  console.log(`\nUpdated ${path.relative(DOCS_ROOT, STATE_FILE)}.`);
}

function main() {
  const state = readState();
  const reports = [];

  console.log('# CloudAgent Docs Update Check');
  console.log(`State file: ${path.relative(DOCS_ROOT, STATE_FILE)}`);

  if (SHOULD_PULL) {
    const dirtyRepos = [];
    for (const [name, repoConfig] of Object.entries(state.repos)) {
      const repoPath = repoAbsPath(repoConfig);
      const status = statusLines(repoPath);
      if (status.length) dirtyRepos.push(name);
    }
    if (dirtyRepos.length) {
      SHOULD_PULL = false;
      console.log(`Pull latest: no; dirty repos found: ${dirtyRepos.join(', ')}`);
    } else {
      console.log('Pull latest: yes');
    }
  } else {
    console.log('Pull latest: no');
  }

  for (const [name, repoConfig] of Object.entries(state.repos)) {
    reports.push(printRepoReport(name, repoConfig));
  }

  const dirty = reports.filter(r => r.dirty);
  if (dirty.length) {
    if (SHOULD_PLAN) {
      printDocumentationPlan(reports);
    }
    console.log('\nStopped before pulling or marking reviewed because at least one repo has uncommitted work.');
    process.exitCode = 2;
    return;
  }

  if (SHOULD_MARK_REVIEWED) {
    markReviewed(state, reports);
  } else if (SHOULD_PLAN) {
    printDocumentationPlan(reports);
  } else {
    console.log('\nNext: inspect relevant changed files, update MDX/screenshots, run npm run generate-all and npm run build.');
    console.log('After review is complete, run: npm run docs:update:mark-reviewed');
  }
}

main();
