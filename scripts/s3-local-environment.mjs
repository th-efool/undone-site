/** Disposable local verification environment. Never reads the shared connection string. */
import { mkdirSync, mkdtempSync, writeFileSync, createWriteStream, symlinkSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
const root = process.cwd();
mkdirSync(resolve(root, '.tmp'), { recursive: true });
const directory = mkdtempSync(resolve(root, '.tmp/s3-local-'));
const port = Number(process.env.S3_TEST_PORT ?? 15433);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('INVALID_LOCAL_PORT');
const modulePath = resolve(process.env.S3_EMBEDDED_POSTGRES_MODULE ?? '.tmp/s3-postgres-runtime/node_modules/embedded-postgres/dist/index.js');
const { default: EmbeddedPostgres } = await import(pathToFileURL(modulePath).href);
const database = new EmbeddedPostgres({ databaseDir: resolve(directory,'data'), user:'s3test', password:'s3-local-only', port,
  persistent:true, createPostgresUser:false, postgresFlags:['-h','127.0.0.1','-c','timezone=UTC'], onLog:() => {}, onError:console.error });
let host;
try {
  await database.initialise(); await database.start(); await database.createDatabase('s3test');
  const connectionString = `postgresql://s3test:s3-local-only@127.0.0.1:${port}/s3test`;
  const schema = spawnSync(process.execPath, ['node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema','prisma/schema.prisma','--script'],
    { cwd:root, encoding:'utf8', env:{ ...process.env, DATABASE_URL:connectionString }, windowsHide:true });
  if (schema.status !== 0) throw new Error(schema.stderr);
  const client = database.getPgClient('s3test','127.0.0.1'); await client.connect();
  try {
    await client.query(schema.stdout);
    await client.query(readFileSync('prisma/interaction-runs-and-journal.sql','utf8'));
    await client.query(readFileSync('prisma/interaction-s3-storage.sql','utf8'));
    await client.query(readFileSync('prisma/interaction-s4b-sources.sql','utf8'));
  } finally { await client.end(); }
  if (process.argv.includes('--serve')) {
    const hostDirectory = resolve(directory,'host');
    const checkout = spawnSync('git',['worktree','add','--detach',hostDirectory,'HEAD'],{ cwd:root, encoding:'utf8', windowsHide:true });
    if (checkout.status !== 0) throw new Error(checkout.stderr);
    if (process.argv.includes('--working-tree')) {
      const changed = spawnSync('git',['diff','--name-only','HEAD'],{ cwd:root, encoding:'utf8', windowsHide:true });
      const untracked = spawnSync('git',['ls-files','--others','--exclude-standard'],{ cwd:root, encoding:'utf8', windowsHide:true });
      if (changed.status !== 0 || untracked.status !== 0) throw new Error('LOCAL_SOURCE_LIST_FAILED');
      for (const file of new Set(`${changed.stdout}\n${untracked.stdout}`.split(/\r?\n/).filter(file => /^(src|scripts)\//.test(file)))) {
        mkdirSync(dirname(resolve(hostDirectory,file)),{ recursive:true });
        copyFileSync(resolve(root,file),resolve(hostDirectory,file));
      }
    }
    symlinkSync(resolve(root,'node_modules'),resolve(hostDirectory,'node_modules'),'junction');
    symlinkSync(resolve(root,'generated'),resolve(hostDirectory,'generated'),'junction');
    const script = [{ tool:'set_intent', input:{ intent:'Learn quorum overlap' }, text:'Learning goal saved.', delayMs: 6000 },
      { tool:'edit_lesson', input:{ lessonId:'$selected', objective:'Explain quorum overlap.' }, text:'Selected lesson refined.' }];
    writeFileSync(resolve(hostDirectory,'.env'), `DATABASE_URL=${connectionString}\nAUTH_SECRET=${randomBytes(32).toString('hex')}\nNODE_ENV=development\nINTERACTION_COHORT_V2_ENABLED=1\nINTERACTION_TEXT_DRIVER=durable\nINTERACTION_PDF_ENABLED=1\nINTERACTION_WEB_ENABLED=1\nINTERACTION_LOCAL_SOURCE_FIXTURE=1\nINTERACTION_LOCAL_MODEL_FIXTURE=1\nINTERACTION_LOCAL_MODEL_SCRIPT='${JSON.stringify(script)}'\n`);
    const log = createWriteStream(resolve(directory,'host.log'));
    host = spawn(process.execPath,[resolve(root,'node_modules/next/dist/bin/next'),'dev','--webpack','-p','3107'],
      { cwd:hostDirectory, stdio:['ignore','pipe','pipe'], windowsHide:true });
    host.stdout.pipe(log); host.stderr.pipe(log);
    console.log(`S3_TEST_HOST_DIRECTORY=${hostDirectory}`);
  }
  console.log(`S3_TEST_DATABASE_URL=${connectionString}`);
  console.log('Local fixtures ready. Ctrl+C stops services; fixture files remain under .tmp.');
  const timer = setInterval(() => {},1000);
  async function stop() { clearInterval(timer); host?.kill(); await database.stop(); process.exit(0); }
  process.once('SIGINT',stop); process.once('SIGTERM',stop);
} catch (error) { host?.kill(); await database.stop().catch(() => {}); throw error; }
