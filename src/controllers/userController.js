const { initDb, storage } = require('../config/db');
const { sqliteRun, sqliteAll } = require('../utils/sqlite');
const { toObjectId } = require('../utils/objectid');

async function getAll(req, res) {
  await initDb();
  if (storage.mode === 'mongo') {
    const usuarios = await storage.mongoDb.collection('users').find({}).sort({ nombre: 1 }).toArray();
    return res.json(usuarios.map((u) => ({ id: u._id.toString(), username: u.username, nombre: u.nombre, rol: u.rol, activo: u.activo })));
  }

  const rows = await sqliteAll(storage.sqliteDb, 'SELECT id, username, nombre, rol, activo FROM users ORDER BY nombre');
  res.json(rows);
}

async function create(req, res) {
  const { username, password, nombre, rol } = req.body;
  await initDb();
  if (storage.mode === 'mongo') {
    const result = await storage.mongoDb.collection('users').insertOne({ username, password, nombre, rol, activo: 1 });
    return res.json({ ok: true, id: result.insertedId.toString() });
  }

  const result = await sqliteRun(storage.sqliteDb, 'INSERT INTO users (username, password, nombre, rol, activo) VALUES (?, ?, ?, ?, 1)', [username, password, nombre, rol]);
  return res.json({ ok: true, id: result.lastID });
}

async function updateById(req, res) {
  const { id } = req.params;
  const { nombre, rol, activo, password } = req.body;
  await initDb();

  if (storage.mode === 'mongo') {
    const update = {};
    if (nombre !== undefined) update.nombre = nombre;
    if (rol !== undefined) update.rol = rol;
    if (activo !== undefined) update.activo = activo;
    if (password !== undefined) update.password = password;

    await storage.mongoDb.collection('users').updateOne({ _id: toObjectId(id) }, { $set: update });
    return res.json({ ok: true });
  }

  const fields = [];
  const values = [];
  if (nombre !== undefined) {
    fields.push('nombre = ?');
    values.push(nombre);
  }
  if (rol !== undefined) {
    fields.push('rol = ?');
    values.push(rol);
  }
  if (activo !== undefined) {
    fields.push('activo = ?');
    values.push(activo);
  }
  if (password !== undefined) {
    fields.push('password = ?');
    values.push(password);
  }

  if (!fields.length) return res.status(400).json({ ok: false, message: 'No hay campos para actualizar' });

  values.push(id);
  await sqliteRun(storage.sqliteDb, `UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  return res.json({ ok: true });
}

async function deleteById(req, res) {
  await initDb();
  if (storage.mode === 'mongo') {
    await storage.mongoDb.collection('users').deleteOne({ _id: toObjectId(req.params.id) });
    return res.json({ ok: true });
  }

  await sqliteRun(storage.sqliteDb, 'DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}

module.exports = { getAll, create, updateById, deleteById };
