const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

test('users can be created and updated in SQLite storage', async () => {
  const tempDbPath = path.join(os.tmpdir(), `farmasys-users-${Date.now()}.sqlite`);
  process.env.SQLITE_DB_PATH = tempDbPath;

  delete require.cache[require.resolve('../src/config/db')];
  delete require.cache[require.resolve('../src/controllers/userController')];

  const { initDb } = require('../src/config/db');
  const { create, getAll, updateById } = require('../src/controllers/userController');

  await initDb();

  const createRes = {
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return payload; }
  };

  const created = await create({ body: { username: 'editme', password: 'secret', nombre: 'Original', rol: 'vendedor' } }, createRes);
  assert.equal(created.ok, true);

  const updateRes = {
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return payload; }
  };

  const updated = await updateById({ params: { id: created.id.toString() }, body: { nombre: 'Actualizado', activo: 0 } }, updateRes);
  assert.equal(updated.ok, true);

  const listRes = {
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return payload; }
  };

  await getAll({}, listRes);
  const storedUser = listRes.body.find((user) => user.username === 'editme');
  assert.ok(storedUser);
  assert.equal(storedUser.nombre, 'Actualizado');
  assert.equal(storedUser.activo, 0);

  try {
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
  } catch (error) {
    if (error.code !== 'EBUSY') throw error;
  }
});
