import { spawn } from 'node:child_process';
import app from './src/app.js';

const PORT = process.env.PORT || 5000;

// start.bat sets OPEN_BROWSER=1 so double-clicking it opens the system only
// after the server is really listening - never a "site can't be reached" page.
// BROWSER_EXE is Chrome or Edge (detected by start.bat); without it we fall
// back to the default browser in a normal tab.
function openSystem() {
  if (process.env.OPEN_BROWSER !== '1' || process.platform !== 'win32') return;
  const url = `http://localhost:${PORT}`;
  const browser = process.env.BROWSER_EXE;
  const args = browser
    ? ['/c', 'start', '', browser, `--app=${url}`, '--start-fullscreen']
    : ['/c', 'start', '', url];
  spawn('cmd.exe', args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  console.log('Opening the system fullscreen...');
}

app.listen(PORT, () => {
  console.log(`✅ Agri Monitor API running on http://localhost:${PORT}`);
  openSystem();
});
