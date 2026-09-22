const { initDb, storage } = require('../config/db');
const { dbRun, dbAll } = require('../utils/sql');
const { toObjectId } = require('../utils/objectid');

async function getAll(req, res) {
  try {
    await initDb();
    if (storage.mode === 'mongo') {
      const registros = await storage.mongoDb.collection('bodega').find({}).sort({ _id: -1 }).toArray();
      return res.json(registros.map((r) => ({ ...r, id: r._id.toString() })));
    }

    const rows = await dbAll('SELECT * FROM bodega ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error in warehouse getAll:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
}

async function create(req, res) {
  try {
    const { fecha, tipo, producto_id, producto_nombre, cantidad, distribuidor, vence, nota, responsable } = req.body;
    await initDb();

    if (storage.mode === 'mongo') {
      await storage.mongoDb.collection('bodega').insertOne({
        fecha,
        tipo,
        producto_id,
        producto_nombre,
        cantidad: Number(cantidad) || 0,
        distribuidor: distribuidor || null,
        vence: vence || null,
        nota: nota || null,
        responsable
      });

      if (tipo === 'Entrada') {
        const prodObjId = toObjectId(producto_id);
        const filter = prodObjId ? { $or: [{ _id: prodObjId }, { codigo: producto_id }] } : { codigo: producto_id };
        await storage.mongoDb.collection('productos').updateOne(filter, { $inc: { stock: Number(cantidad || 0) } });
      }
      return res.json({ ok: true });
    }

    await dbRun(
      'INSERT INTO bodega (fecha, tipo, producto_id, producto_nombre, cantidad, distribuidor, vence, nota, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [fecha, tipo, producto_id, producto_nombre, Number(cantidad) || 0, distribuidor || null, vence || null, nota || null, responsable]
    );
    if (tipo === 'Entrada') {
      const isNumeric = /^\d+$/.test(String(producto_id));
      if (isNumeric) {
        await dbRun('UPDATE productos SET stock = stock + ? WHERE id = ? OR codigo = ?', [Number(cantidad) || 0, Number(producto_id), String(producto_id)]);
      } else {
        await dbRun('UPDATE productos SET stock = stock + ? WHERE codigo = ?', [Number(cantidad) || 0, String(producto_id)]);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Error in warehouse create:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
}

module.exports = { getAll, create };
