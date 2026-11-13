// Publishes dist/ to Cloudflare Pages with its custom domain (the unified site replaces
// barroco estocástico's: same project, same domain).
//   npm run deploy                      -> checks, build, upload, domain + CNAME
//   npm run deploy -- --skip-build      -> deploy the dist/ already built (still checked)
//   npm run deploy -- --dry-run         -> everything except contacting Cloudflare
// Upload: `wrangler pages deploy` (direct upload, devDependency). It hashes every file
// and only sends the ones Pages does not have yet. Pages limits: 20,000 files, 25 MiB
// per file (checked below before anything is sent).
// The API token is read at run time from a file OUTSIDE the repo (a line API_TOKEN=...;
// barroco's old jape-cloudflare-total.txt, moved to private/cuentas/cloudflare-japedev.env);
// another path with the CF_CREDENTIALS variable. It is never printed nor written here.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJECT = 'barroco-estocastico';
const ZONE = 'jape.com.ar';
const DOMAIN = `barroco.${ZONE}`;
const CREDENTIALS = process.env.CF_CREDENTIALS
    || 'C:/Users/jntac/Documents/prj/jape/00/gestion_servidores/private/cuentas/cloudflare-japedev.env';
const MAX_FILES = 20000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const dryRun = process.argv.includes('--dry-run');
const skipBuild = process.argv.includes('--skip-build');
const run = (cmd, env) => execSync(cmd, { stdio: 'inherit', cwd: ROOT, env: env && { ...process.env, ...env } });
const mib = (b) => `${(b / 1048576).toFixed(2)} MiB`;
const die = (msg) => { console.error(`\n[deploy] ${msg}`); process.exit(1); };

// 1. Local inputs that git does not carry (public/soundfonts from `npm run samples`;
//    public/impulses and public/Orchestra are git-ignored and only exist locally)
for (const dir of ['public/soundfonts', 'public/impulses', 'public/Orchestra', 'public/manifests']) {
    const p = path.join(ROOT, dir);
    if (!fs.existsSync(p) || !fs.readdirSync(p).length) {
        die(`${dir} is missing or empty${dir === 'public/soundfonts' ? ' (run npm run samples)' : ''}`);
    }
}

// 2. Credentials: the file must exist and carry an API_TOKEN line (value never shown)
let token = null;
if (!fs.existsSync(CREDENTIALS)) die(`credentials file not found (${CREDENTIALS}; set CF_CREDENTIALS)`);
token = fs.readFileSync(CREDENTIALS, 'utf8').match(/^API_TOKEN=(\S+)/m)?.[1] || null;
if (!token) die(`no API_TOKEN line in ${CREDENTIALS}`);
console.log(`[deploy] credentials: ${CREDENTIALS} has an API_TOKEN line`);

// 3. Build (fails on a missing sample) + the per-style sample check on dist/
if (!skipBuild) run('npm run build');
if (!fs.existsSync(path.join(DIST, 'index.html'))) die('dist/index.html missing (build first)');
run('node tools/check-samples.mjs dist');

// 4. What would be uploaded
const files = [];
(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else files.push({ rel: path.relative(DIST, p).split(path.sep).join('/'), bytes: fs.statSync(p).size });
    }
})(DIST);
files.sort((a, b) => b.bytes - a.bytes);
const total = files.reduce((s, f) => s + f.bytes, 0);
const byTop = {};
for (const f of files) {
    const top = f.rel.includes('/') ? f.rel.split('/')[0] + '/' : '(root)';
    byTop[top] ??= { files: 0, MiB: 0 };
    byTop[top].files++;
    byTop[top].MiB += f.bytes / 1048576;
}
for (const v of Object.values(byTop)) v.MiB = +v.MiB.toFixed(2);
console.table(byTop);
console.log(`[deploy] dist/: ${files.length} files, ${mib(total)}; largest ${files[0].rel} (${mib(files[0].bytes)})`);

const problems = [];
if (files.length > MAX_FILES) problems.push(`${files.length} files > ${MAX_FILES} (Pages limit)`);
for (const f of files) if (f.bytes > MAX_FILE_BYTES) problems.push(`${f.rel}: ${mib(f.bytes)} > 25 MiB (Pages limit)`);
// `#` / `%` / `?` in a path cannot be served as a plain URL (see HOW_TO_RUN.md, Samples)
for (const f of files) if (/[#%?]/.test(f.rel)) problems.push(`${f.rel}: '#', '%' or '?' in the path`);
if (problems.length) die(`${problems.length} problems:\n` + problems.slice(0, 20).join('\n'));
console.log('[deploy] within the Pages limits (20,000 files, 25 MiB per file)');

const wrangler = `npx wrangler pages deploy dist --project-name ${PROJECT} --branch main --commit-dirty=true`;
if (dryRun) {
    console.log(`\n[deploy] dry run, Cloudflare not contacted. A real run would:
  - find the account of zone ${ZONE}; create Pages project ${PROJECT} if it does not exist
  - ${wrangler}   (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID from the credentials)
  - add custom domain ${DOMAIN} and a proxied CNAME -> ${PROJECT}.pages.dev if missing
  Run: npm run deploy -- --skip-build   (or npm run deploy to rebuild first)`);
    process.exit(0);
}

// ---- Cloudflare ------------------------------------------------------------------
async function cf(method, apiPath, body) {
    const r = await fetch(`https://api.cloudflare.com/client/v4${apiPath}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body && JSON.stringify(body)
    });
    const j = await r.json();
    return { status: r.status, ...j };
}
const fail = (what, res) => { throw new Error(`${what}: ${JSON.stringify(res.errors)}`); };

const zones = await cf('GET', `/zones?name=${ZONE}`);
const zone = zones.result?.[0] ?? fail('zone', zones);
const account = zone.account.id;

// 5. Pages project (direct upload, no Git integration)
const proj = await cf('GET', `/accounts/${account}/pages/projects/${PROJECT}`);
if (!proj.success) {
    const created = await cf('POST', `/accounts/${account}/pages/projects`,
        { name: PROJECT, production_branch: 'main' });
    if (!created.success) fail('create project', created);
    console.log(`Pages project created: ${PROJECT}`);
}

// 6. Upload
run(wrangler, { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account });

// 7. Custom domain + CNAME (idempotent)
const domains = await cf('GET', `/accounts/${account}/pages/projects/${PROJECT}/domains`);
if (!domains.result?.some(d => d.name === DOMAIN)) {
    const added = await cf('POST', `/accounts/${account}/pages/projects/${PROJECT}/domains`, { name: DOMAIN });
    if (!added.success) fail('add domain', added);
    console.log(`Domain added: ${DOMAIN}`);
}
const dns = await cf('GET', `/zones/${zone.id}/dns_records?name=${DOMAIN}`);
if (!dns.result?.length) {
    const rec = await cf('POST', `/zones/${zone.id}/dns_records`,
        { type: 'CNAME', name: DOMAIN, content: `${PROJECT}.pages.dev`, proxied: true });
    if (!rec.success) fail('create CNAME', rec);
    console.log(`CNAME ${DOMAIN} -> ${PROJECT}.pages.dev`);
}
console.log(`\nDone: https://${DOMAIN}`);
