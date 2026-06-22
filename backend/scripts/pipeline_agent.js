#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.resolve(__dirname);
const ARTIFACTS_DIR = path.join(SCRIPTS_DIR, 'pipeline_artifacts');

function ensureArtifactsDir() {
  if (!ARTIFACTS_DIR.startsWith(SCRIPTS_DIR)) throw new Error('Artifacts path outside scripts dir');
  if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

function now() { return new Date().toISOString(); }

function plan() {
  const planObj = {
    name: 'Pipeline Agent Roadmap',
    steps: ['plan', 'code', 'debug', 'review'],
    artifacts: ['pipeline_artifacts/'],
    created: now(),
  };
  ensureArtifactsDir();
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'plan.json'), JSON.stringify(planObj, null, 2));
  console.log('plan: wrote plan.json');
  return planObj;
}

function code(planObj) {
  ensureArtifactsDir();
  // Generate a small, safe artifact to represent produced code
  const srcDir = path.join(ARTIFACTS_DIR, 'code');
  if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

  const sampleFile = path.join(srcDir, 'generated_module.js');
  const content = `// Generated sample module\n// created: ${now()}\nmodule.exports = function sample() { return 'ok'; }\n`;
  fs.writeFileSync(sampleFile, content);
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'code_manifest.json'), JSON.stringify({ files: ['code/generated_module.js'], created: now() }, null, 2));
  console.log('code: generated sample module');
  return { codePath: srcDir };
}

function debug(codeObj) {
  ensureArtifactsDir();
  const report = { checks: [], passed: true, timestamp: now() };
  // Basic checks: files exist and simple static assertions
  const manifestPath = path.join(ARTIFACTS_DIR, 'code_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    report.checks.push({ name: 'manifest-exists', ok: false, note: 'code_manifest.json missing' });
    report.passed = false;
  } else {
    report.checks.push({ name: 'manifest-exists', ok: true });
  }

  const sampleFile = path.join(ARTIFACTS_DIR, 'code', 'generated_module.js');
  if (!fs.existsSync(sampleFile)) {
    report.checks.push({ name: 'sample-file', ok: false, note: 'generated_module.js missing' });
    report.passed = false;
  } else {
    // quick content sanity
    const content = fs.readFileSync(sampleFile, 'utf8');
    report.checks.push({ name: 'sample-exports', ok: /module\.exports/.test(content) });
  }

  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`debug: wrote report.json (passed=${report.passed})`);
  return report;
}

function review(report) {
  ensureArtifactsDir();
  const audit = {
    reviewedAt: now(),
    passed: !!(report && report.passed),
    summary: (report && report.passed) ? 'All QC checks passed' : 'QC found issues',
    suggestions: [],
  };
  if (!report) audit.suggestions.push('No report provided — run debug() first');
  if (report && !report.passed) audit.suggestions.push('Address failing checks in report.json');
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'audit.json'), JSON.stringify(audit, null, 2));
  console.log('review: wrote audit.json');
  return audit;
}

function runAll() {
  console.log('Pipeline: starting full run');
  const p = plan();
  const c = code(p);
  const r = debug(c);
  const a = review(r);
  console.log('Pipeline: finished');
  return { plan: p, code: c, report: r, audit: a };
}

function usage() {
  console.log('Usage: node pipeline_agent.js run|plan|code|debug|review|test');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  try {
    if (!cmd || cmd === 'run') runAll();
    else if (cmd === 'plan') plan();
    else if (cmd === 'code') code();
    else if (cmd === 'debug') debug();
    else if (cmd === 'review') review();
    else if (cmd === 'test') {
      // quick self-test
      runAll();
      console.log('self-test: done');
    } else usage();
  } catch (err) {
    console.error('Error:', err && err.message);
    process.exit(2);
  }
}

module.exports = { plan, code, debug, review, runAll };
