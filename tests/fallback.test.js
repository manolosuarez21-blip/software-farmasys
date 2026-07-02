const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('initDb falls back to local SQLite storage when MongoDB is unavailable', async () => {
  process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/farmasys';
  process.env.SQLITE_DB_PATH = path.join(__dirname, 'farmasys-test.sqlite');
  delete require.cache[require.resolve('../server.js')];

  const server = require('../server.js');
  const storage = await server.initDb();

  assert.ok(storage);
  assert.equal(storage.mode, 'sqlite');
});
