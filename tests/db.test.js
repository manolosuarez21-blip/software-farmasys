const test = require('node:test');
const assert = require('node:assert/strict');

test('server exports an initialization function for the database', async () => {
  const server = require('../server.js');
  assert.equal(typeof server.initDb, 'function');
});
