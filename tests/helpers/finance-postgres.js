const { execFileSync, spawn } = require('node:child_process');
const { randomBytes, createHmac } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(__dirname, '../../supabase/migrations/202609140002_finance_foundation.sql');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 60000 });
const token = (role, secret) => {
  const payload = [ { alg: 'HS256', typ: 'JWT' }, { role, exp: Math.floor(Date.now() / 1000) + 3600 } ]
    .map((part) => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
};

async function createHarness() {
  const id = `finance_${process.pid}_${randomBytes(4).toString('hex')}`;
  const network = `${id}_net`, pg = `${id}_pg`, rest = `${id}_rest`;
  const secret = randomBytes(32).toString('hex');
  // TCP avoids the temporary Unix-socket-only server used by the image during init.
  const sqlArgs = ['exec', '-i', pg, 'psql', '-X', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'];
  const sql = (query) => docker(sqlArgs, query).trim();
  const sqlAsync = (query, onOutput = () => {}) => new Promise((resolve, reject) => {
    const proc = spawn('docker', sqlArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (part) => { stdout += part; onOutput(String(part)); });
    proc.stderr.on('data', (part) => { stderr += part; });
    proc.on('error', reject);
    proc.on('close', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr)));
    proc.stdin.end(query);
  });
  const cleanup = () => {
    for (const name of [rest, pg]) { try { docker(['rm', '-f', name]); } catch {} }
    try { docker(['network', 'rm', network]); } catch {}
  };
  try {
    docker(['info', '--format', '{{.ServerVersion}}']);
    // Never pick up environment credentials or use an external database URL.
    docker(['image', 'inspect', 'postgres:16-alpine']);
    docker(['image', 'inspect', 'postgrest/postgrest:v12.2.8']);
    docker(['network', 'create', network]);
    docker(['run', '--pull=never', '--name', pg, '--network', network, '-e', 'POSTGRES_PASSWORD=local-only', '-d', 'postgres:16-alpine']);
    for (let n = 0; ; n++) {
      try { sql('select 1;'); break; } catch (error) { if (n === 39) throw error; await delay(250); }
    }
    sql(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create role authenticator login password 'local-only' noinherit;
      grant anon, authenticated, service_role to authenticator;`);
    const migrate = () => sql(fs.readFileSync(migrationPath, 'utf8'));
    migrate();
    docker(['run', '--pull=never', '--name', rest, '--network', network, '-p', '127.0.0.1::3000',
      '-e', `PGRST_DB_URI=postgres://authenticator:local-only@${pg}:5432/postgres`,
      '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', 'PGRST_DB_POOL=30',
      '-e', `PGRST_JWT_SECRET=${secret}`, '-d', 'postgrest/postgrest:v12.2.8']);
    const port = docker(['port', rest, '3000/tcp']).trim().split(':').pop();
    const url = `http://127.0.0.1:${port}`;
    for (let n = 0; ; n++) {
      try { const res = await fetch(url); if (!res.ok) throw new Error('rest_not_ready'); break; }
      catch (error) { if (n === 39) throw error; await delay(250); }
    }
    // supabaseFetch adds /rest/v1; this local adapter strips only that URL prefix.
    // Calls still hit a real PostgREST server, JWT verification, privileges and Postgres RPC.
    const request = async (route, { method, body }) => {
      const response = await fetch(url + route, { method,
        headers: { Authorization: `Bearer ${token('service_role', secret)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.message || 'rpc_failed'), { code: data.code, status: response.status });
      return { data, status: response.status };
    };
    return { sql, sqlAsync, request, url, token: (role) => token(role, secret), migrate, cleanup };
  } catch (error) { cleanup(); throw error; }
}

module.exports = { createHarness, delay, migrationPath };
