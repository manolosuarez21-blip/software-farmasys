const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('frontend initializes and renders the user list from appData.users', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'farmasys.html'), 'utf8');

  assert.match(html, /appData\s*=\s*\{\s*productos,\s*ventas,\s*bodega,\s*distribuidores,\s*users:\s*usuarios\s*\}/);
  assert.match(html, /const users = appData\.users \|\| appData\.usuarios \|\| \[\];/);
});
