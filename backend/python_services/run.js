#!/usr/bin/env node
/**
 * Cross-platform launcher for the local DistilBERT + SHAP service.
 *
 * The old npm scripts hard-coded `./venv/bin/python`, which only exists on
 * macOS/Linux; on Windows the venv interpreter lives in `venv\Scripts\python.exe`.
 * This script picks the right one, can create the virtualenv and install the
 * requirements, and then runs distilbert_emotion_service.py in the foreground.
 *
 *   node python_services/run.js            run the service (venv must exist)
 *   node python_services/run.js --setup    create venv + pip install -r requirements.txt first
 *
 * Environment: PYTHON=/path/to/python overrides the interpreter used for --setup.
 * Use Python 3.10-3.12 (python.org or conda). PyTorch wheels for brand-new Python
 * releases (e.g. 3.13 from Homebrew) are the usual cause of native crashes.
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const venvDir = path.join(dir, 'venv');
const isWin = process.platform === 'win32';
const venvPython = isWin ? path.join(venvDir, 'Scripts', 'python.exe') : path.join(venvDir, 'bin', 'python');
const args = process.argv.slice(2);

function run(cmd, cmdArgs, opts = {}) {
  return spawnSync(cmd, cmdArgs, { stdio: 'inherit', cwd: dir, ...opts });
}

function findSystemPython() {
  const candidates = [];
  if (process.env.PYTHON) candidates.push([process.env.PYTHON, []]);
  if (isWin) candidates.push(['py', ['-3.12']], ['py', ['-3.11']], ['py', ['-3.10']], ['py', ['-3']], ['python', []]);
  else candidates.push(['python3.12', []], ['python3.11', []], ['python3.10', []], ['python3', []], ['python', []]);

  for (const [cmd, pre] of candidates) {
    const probe = spawnSync(cmd, [...pre, '--version'], { encoding: 'utf8' });
    if (probe.status === 0) return { cmd, pre, version: (probe.stdout || probe.stderr || '').trim() };
  }
  return null;
}

if (args.includes('--setup')) {
  if (!fs.existsSync(venvPython)) {
    const py = findSystemPython();
    if (!py) {
      console.error('No Python 3 found. Install Python 3.10-3.12 from python.org (or conda) and retry.');
      process.exit(1);
    }
    console.log(`Creating virtualenv with ${py.version} ...`);
    const r = run(py.cmd, [...py.pre, '-m', 'venv', venvDir]);
    if (r.status !== 0) process.exit(r.status || 1);
  }
  console.log('Installing Python requirements (first run downloads PyTorch, ~200-800 MB) ...');
  let r = run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip']);
  if (r.status !== 0) process.exit(r.status || 1);
  r = run(venvPython, ['-m', 'pip', 'install', '-r', 'requirements.txt']);
  if (r.status !== 0) process.exit(r.status || 1);
}

if (!fs.existsSync(venvPython)) {
  console.error(`Python virtualenv not found at ${venvDir}.`);
  console.error('Run once:  npm run setup:python   (or: node python_services/run.js --setup)');
  process.exit(1);
}

const child = spawn(venvPython, ['distilbert_emotion_service.py'], { stdio: 'inherit', cwd: dir, env: process.env });
child.on('exit', (code, signal) => process.exit(code === null ? (signal ? 1 : 0) : code));
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => child.kill(sig));
}
