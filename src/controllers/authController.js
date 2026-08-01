const { initDb, storage } = require('../config/db');
const { toObjectId } = require('../utils/objectid');

async function login(req, res) {
  const { username, password } = req.body;
  await initDb();

  if (storage.mode === 'mongo') {
    const user = await storage.mongoDb.collection('users').findOne({ username, password, activo: 1 });
    if (!user) return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });
    return res.json({ ok: true, user: { id: user._id.toString(), username: user.username, nombre: user.nombre, rol: user.rol } });
  }

  const { sqliteGet } = require('../utils/sqlite');
  const user = await sqliteGet(storage.sqliteDb, 'SELECT * FROM users WHERE username = ? AND password = ? AND activo = 1', [username, password]);
  if (!user) return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });
  res.json({ ok: true, user: { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol } });
}

async function health(req, res) {
  try {
    await initDb();
    res.json({ ok: true, message: 'FARMAsys API funcionando', database: storage.mode });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
}

module.exports = { login, health };
