// Strip "type": "module" from dist/package.json so the ncc bundle runs as CJS.
// GitHub Actions standard is CJS, and bundled deps like Playwright use __dirname.
const fs = require('fs');
fs.writeFileSync('dist/package.json', '{}');
