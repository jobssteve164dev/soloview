import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTests } from '@vscode/test-electron';

const directory = path.dirname(fileURLToPath(import.meta.url));
const extensionDevelopmentPath = path.resolve(directory, '../..');

await runTests({
  extensionDevelopmentPath,
  extensionTestsPath: path.join(directory, 'suite.cjs'),
  launchArgs: [extensionDevelopmentPath, '--disable-extensions', '--skip-welcome', '--disable-workspace-trust'],
});
