const { execSync } = require('child_process');
const os = require('os');

const platform = os.platform();
const isWindows = platform === 'win32';
const isMac = platform === 'darwin';
const isLinux = platform === 'linux';

function checkTailscale() {
  try {
    if (isWindows) {
      execSync('where tailscale', { stdio: 'ignore' });
    } else {
      execSync('which tailscale', { stdio: 'ignore' });
    }
    console.log('\u2713 Tailscale \u0111\u00e3 \u0111\u01b0\u1ee3c c\u00e0i \u0111\u1eb7t');
    return true;
  } catch {
    console.log('\n\u26a0\ufe0f  Tailscale ch\u01b0a \u0111\u01b0\u1ee3c c\u00e0i \u0111\u1eb7t');
    console.log('\n\u0110\u1ec3 c\u00f3 link tunnel c\u1ed1 \u0111\u1ecbnh (free), b\u1ea1n c\u1ea7n c\u00e0i Tailscale:');
    console.log('');

    if (isWindows) {
      console.log('  Windows: https://tailscale.com/download/windows');
      console.log('  Ho\u1eb7c d\u00f9ng winget: winget install tailscale.tailscale');
    } else if (isMac) {
      console.log('  macOS: https://tailscale.com/download/mac');
      console.log('  Ho\u1eb7c d\u00f9ng brew: brew install tailscale');
    } else if (isLinux) {
      console.log('  Linux: https://tailscale.com/download/linux');
      console.log('  Ho\u1eb7c: curl -fsSL https://tailscale.com/install.sh | sh');
    }

    console.log('\nSau khi c\u00e0i xong:');
    console.log('  1. Ch\u1ea1y: tailscale up');
    console.log('  2. V\u00e0o Dashboard > Endpoint > Enable Tailscale Funnel');
    console.log('  3. Link public c\u1ed1 \u0111\u1ecbnh s\u1ebd c\u00f3 d\u1ea1ng: https://<id>.<tailnet>.ts.net\n');
    return false;
  }
}

if (require.main === module) {
  checkTailscale();
}

module.exports = { checkTailscale };
