const { initDb, storage } = require('../config/db');
const { sqliteRun, sqliteAll } = require('../utils/sqlite');
const { toObjectId } = require('../utils/objectid');

async function getAll(req, res) {
  await initDb();
  if (storage.mode === 'mongo') {
    const distribuidores = await storage.mongoDb.collection('distribuidores').find({}).sort({ nombre: 1 }).toArray();
    return res.json(distribuidores.map((d) => ({ ...d, id: d._id.toString() })));
  }

  const rows = await sqliteAll(storage.sqliteDb, 'SELECT * FROM distribuidores ORDER BY nombre');
  res.json(rows);
}

async function create(req, res) {
  const { nombre, contacto, telefono, email, ciudad, estado } = req.body;
  await initDb();
  if (storage.mode === 'mongo') {
    const result = await storage.mongoDb.collection('distribuidores').insertOne({ nombre, contacto: contacto || null, telefono: telefono || null, email: email || null, ciudad: ciudad || null, estado: estado || 'Activo' });
    return res.json({ ok: true, id: result.insertedId.toString() });
  }

  const result = await sqliteRun(storage.sqliteDb, 'INSERT INTO distribuidores (nombre, contacto, telefono, email, ciudad, estado) VALUES (?, ?, ?, ?, ?, ?)', [nombre, contacto || null, telefono || null, email || null, ciudad || null, estado || 'Activo']);
  res.json({ ok: true, id: result.lastID });
}

async function deleteById(req, res) {
  await initDb();
  if (storage.mode === 'mongo') {
    await storage.mongoDb.collection('distribuidores').deleteOne({ _id: toObjectId(req.params.id) });
    return res.json({ ok: true });
  }

  await sqliteRun(storage.sqliteDb, 'DELETE FROM distribuidores WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}

module.exports = { getAll, create, deleteById };
