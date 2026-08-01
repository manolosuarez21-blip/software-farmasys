const { initDb, storage } = require('../config/db');
const { sqliteRun, sqliteAll } = require('../utils/sqlite');
const { toObjectId } = require('../utils/objectid');

async function getAll(req, res) {
  await initDb();
  if (storage.mode === 'mongo') {
    const registros = await storage.mongoDb.collection('bodega').find({}).sort({ _id: -1 }).toArray();
    return res.json(registros.map((r) => ({ ...r, id: r._id.toString() })));
  }

  const rows = await sqliteAll(storage.sqliteDb, 'SELECT * FROM bodega ORDER BY id DESC');
  res.json(rows);
}

async function create(req, res) {
  const { fecha, tipo, producto_id, producto_nombre, cantidad, distribuidor, vence, nota, responsable } = req.body;
  await initDb();

  if (storage.mode === 'mongo') {
    await storage.mongoDb.collection('bodega').insertOne({ fecha, tipo, producto_id, producto_nombre, cantidad: cantidad || 0, distribuidor: distribuidor || null, vence: vence || null, nota: nota || null, responsable });
    if (tipo === 'Entrada') {
      await storage.mongoDb.collection('productos').updateOne({ _id: toObjectId(producto_id) }, { $inc: { stock: Number(cantidad || 0) } });
    }
    return res.json({ ok: true });
  }

  await sqliteRun(storage.sqliteDb, 'INSERT INTO bodega (fecha, tipo, producto_id, producto_nombre, cantidad, distribuidor, vence, nota, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [fecha, tipo, producto_id, producto_nombre, cantidad || 0, distribuidor || null, vence || null, nota || null, responsable]);
  if (tipo === 'Entrada') {
    await sqliteRun(storage.sqliteDb, 'UPDATE productos SET stock = stock + ? WHERE id = ?', [cantidad || 0, producto_id]);
  }
  res.json({ ok: true });
}

module.exports = { getAll, create };
