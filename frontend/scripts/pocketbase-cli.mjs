import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const action = process.argv[2];
const extraArgs = process.argv.slice(3);

const scriptByAction = {
    install: 'install-pocketbase.ps1',
    start: 'start-pocketbase.ps1',
    bootstrap: 'bootstrap-pocketbase.ps1',
};

if (!action || !(action in scriptByAction)) {
    console.error('Uso: bun run scripts/pocketbase-cli.mjs <install|start|bootstrap> [args...]');
    process.exit(1);
}

const scriptPath = resolve(__dirname, '..', '..', 'backend', 'pocketbase', scriptByAction[action]);

const powershellArgs = ['-ExecutionPolicy', 'Bypass', '-File', scriptPath];
if (action === 'start') {
    powershellArgs.push('-InstallIfMissing');
}
powershellArgs.push(...extraArgs);

const child = spawn('powershell', powershellArgs, {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
    windowsHide: false,
});

child.on('exit', (code) => {
    process.exit(code ?? 1);
});

child.on('error', (error) => {
    console.error(error);
    process.exit(1);
});
