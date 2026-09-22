const { initDb, storage } = require('../config/db');
const { dbRun, dbAll } = require('../utils/sql');
const { toObjectId } = require('../utils/objectid');

async function getAll(req, res) {
  try {
    await initDb();
    if (storage.mode === 'mongo') {
      const distribuidores = await storage.mongoDb.collection('distribuidores').find({}).sort({ nombre: 1 }).toArray();
      return res.json(distribuidores.map((d) => ({ ...d, id: d._id.toString() })));
    }

    const rows = await dbAll('SELECT * FROM distribuidores ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    console.error('Error in supplier getAll:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
}

async function create(req, res) {
  try {
    const { nombre, contacto, telefono, email, ciudad, estado } = req.body;
    await initDb();
    if (storage.mode === 'mongo') {
      const result = await storage.mongoDb.collection('distribuidores').insertOne({ nombre, contacto: contacto || null, telefono: telefono || null, email: email || null, ciudad: ciudad || null, estado: estado || 'Activo' });
      return res.json({ ok: true, id: result.insertedId.toString() });
    }

    const result = await dbRun('INSERT INTO distribuidores (nombre, contacto, telefono, email, ciudad, estado) VALUES (?, ?, ?, ?, ?, ?)', [nombre, contacto || null, telefono || null, email || null, ciudad || null, estado || 'Activo']);
    res.json({ ok: true, id: result.lastID });
  } catch (err) {
    console.error('Error in supplier create:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
}

async function deleteById(req, res) {
  try {
    await initDb();
    if (storage.mode === 'mongo') {
      await storage.mongoDb.collection('distribuidores').deleteOne({ _id: toObjectId(req.params.id) });
      return res.json({ ok: true });
    }

    await dbRun('DELETE FROM distribuidores WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error in supplier deleteById:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
}

module.exports = { getAll, create, deleteById };
