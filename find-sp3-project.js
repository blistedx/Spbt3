const fs = require('fs');
const path = require('path');
const base = 'C:\\Users\\Mohit\\.gemini\\antigravity-ide\\brain';

const dirs = fs.readdirSync(base);
for (const dir of dirs) {
  const logPath = path.join(base, dir, '.system_generated', 'logs', 'transcript_full.jsonl');
  if (fs.existsSync(logPath)) {
    const text = fs.readFileSync(logPath, 'utf8');
    const idx = text.indexOf('sp3-ayix7pnah');
    if (idx !== -1) {
      console.log('Found in dir:', dir);
      // Find any project.json or projectId near it
      const start = Math.max(0, idx - 10000);
      const end = Math.min(text.length, idx + 10000);
      const slice = text.substring(start, end);
      const prjMatch = slice.match(/\"projectId\":\"([^\"]+)\"/);
      const orgMatch = slice.match(/\"orgId\":\"([^\"]+)\"/);
      console.log('prjMatch:', prjMatch);
      console.log('orgMatch:', orgMatch);
    }
  }
}
