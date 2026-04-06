import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import http from 'node:http';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.WEBHOOK_PORT || 9000);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const REPO_DIR = process.env.REPO_DIR || '/opt/url-expiry-tracker';
const BRANCH = process.env.BRANCH || 'main';
const DEPLOY_SCRIPT = process.env.DEPLOY_SCRIPT || `${REPO_DIR}/deploy/deploy.sh`;

if (!WEBHOOK_SECRET) {
  console.error('WEBHOOK_SECRET is required');
  process.exit(1);
}

let deployInProgress = false;

function verifySignature(rawBody, signature) {
  if (!signature) return false;

  const expected = `sha256=${crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')}`;

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

async function runDeploy() {
  deployInProgress = true;
  try {
    const { stdout, stderr } = await execFileAsync('bash', [DEPLOY_SCRIPT], {
      env: {
        ...process.env,
        REPO_DIR,
        BRANCH
      }
    });

    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  } finally {
    deployInProgress = false;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/github-webhook') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks);
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];

  if (!verifySignature(rawBody, signature)) {
    res.writeHead(401);
    res.end('Invalid signature');
    return;
  }

  if (event !== 'push') {
    res.writeHead(202);
    res.end('Ignored event');
    return;
  }

  const payload = JSON.parse(rawBody.toString('utf8'));
  const pushedBranch = payload.ref?.replace('refs/heads/', '');

  if (pushedBranch !== BRANCH) {
    res.writeHead(202);
    res.end(`Ignored branch ${pushedBranch}`);
    return;
  }

  if (deployInProgress) {
    res.writeHead(409);
    res.end('Deploy already in progress');
    return;
  }

  res.writeHead(202);
  res.end('Deploy started');

  try {
    await runDeploy();
  } catch (error) {
    console.error('Deploy failed', error);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Webhook listener running on port ${PORT}`);
});
