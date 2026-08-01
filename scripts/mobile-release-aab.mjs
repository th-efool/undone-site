import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const androidDir = path.join(rootDir, 'android');
const keystorePropertiesPath = path.join(androidDir, 'keystore.properties');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const keystorePath = process.env.ANDROID_KEYSTORE_PATH ?? path.join(rootDir, '@agrim00001__sidequesthq.jks');

if (!fs.existsSync(keystorePath)) {
  console.error(`Keystore not found at: ${keystorePath}`);
  process.exit(1);
}

const keystoreProperties = [
  `storeFile=${keystorePath.replace(/\\/g, '/')}`,
  `storePassword=${requireEnv('ANDROID_KEYSTORE_PASSWORD')}`,
  `keyAlias=${requireEnv('ANDROID_KEY_ALIAS')}`,
  `keyPassword=${requireEnv('ANDROID_KEY_PASSWORD')}`,
].join('\n');

fs.mkdirSync(androidDir, { recursive: true });
fs.writeFileSync(keystorePropertiesPath, keystoreProperties, 'utf8');

console.log('Building static web assets and syncing Capacitor...');
run('node', ['scripts/mobile-build.mjs']);

console.log('Building signed release Android App Bundle...');
run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', ['bundleRelease'], {
  cwd: androidDir,
});

const bundlePath = path.join(
  androidDir,
  'app',
  'build',
  'outputs',
  'bundle',
  'release',
  'app-release.aab',
);

if (fs.existsSync(bundlePath)) {
  console.log(`\nRelease AAB ready:\n${bundlePath}`);
} else {
  console.error('Expected release AAB was not produced.');
  process.exit(1);
}
