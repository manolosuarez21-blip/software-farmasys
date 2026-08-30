const { initDb, storage } = require('../config/db');
const { sqliteRun, sqliteGet, sqliteAll } = require('../utils/sqlite');
const { toObjectId } = require('../utils/objectid');

async function create(req, res) {
  const { fecha, vendedor, cliente, nota, descuento, subtotal, total, items, factura_numero, factura_emitida } = req.body;
  await initDb();

  if (storage.mode === 'mongo') {
    const session = storage.mongoClient.startSession();
    try {
      await session.withTransaction(async () => {
        const venta = await storage.mongoDb.collection('ventas').insertOne({ fecha, vendedor, cliente: cliente || null, nota: nota || null, descuento: descuento || 0, subtotal: subtotal || 0, total: total || 0, factura_numero: factura_numero || null, factura_emitida: !!factura_emitida, created_at: new Date() }, { session });
        for (const item of items || []) {
          await storage.mongoDb.collection('venta_items').insertOne({ venta_id: venta.insertedId, producto_id: item.producto_id || item.id, nombre: item.nombre, precio: item.precio, cantidad: item.qty }, { session });
          await storage.mongoDb.collection('productos').updateOne({ _id: toObjectId(item.producto_id || item.id) }, { $inc: { stock: -Number(item.qty || 0) } }, { session });
        }
      });
      return res.json({ ok: true, id: 'ok' });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    } finally {
      await session.endSession();
    }
  }

  try {
    await sqliteRun(storage.sqliteDb, 'BEGIN');
    const ventaResult = await sqliteRun(storage.sqliteDb, 'INSERT INTO ventas (fecha, vendedor, cliente, nota, descuento, subtotal, total, factura_numero, factura_emitida) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [fecha, vendedor, cliente || null, nota || null, descuento || 0, subtotal || 0, total || 0, factura_numero || null, factura_emitida ? 1 : 0]);
    const ventaId = ventaResult.lastID;
    for (const item of items || []) {
      await sqliteRun(storage.sqliteDb, 'INSERT INTO venta_items (venta_id, producto_id, nombre, precio, cantidad) VALUES (?, ?, ?, ?, ?)', [ventaId, item.producto_id || item.id, item.nombre, item.precio, item.qty]);
      await sqliteRun(storage.sqliteDb, 'UPDATE productos SET stock = stock - ? WHERE id = ?', [item.qty, item.producto_id || item.id]);
    }
    await sqliteRun(storage.sqliteDb, 'COMMIT');
    res.json({ ok: true, id: ventaId });
  } catch (error) {
    await sqliteRun(storage.sqliteDb, 'ROLLBACK');
    res.status(500).json({ ok: false, message: error.message });
  }
}

async function getAll(req, res) {
  await initDb();
  if (storage.mode === 'mongo') {
    const ventas = await storage.mongoDb.collection('ventas').find({}).sort({ _id: -1 }).toArray();
    const ventaIds = ventas.map((v) => v._id);
    const items = await storage.mongoDb.collection('venta_items').find({ venta_id: { $in: ventaIds } }).toArray();
    const itemsByVenta = items.reduce((acc, item) => {
      const key = item.venta_id.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push({ ...item, id: item._id.toString(), qty: item.cantidad || item.qty || 1 });
      return acc;
    }, {});

    return res.json(ventas.map((v) => ({ ...v, id: v._id.toString(), items: itemsByVenta[v._id.toString()] || [] })));
  }

  const rows = await sqliteAll(storage.sqliteDb, 'SELECT * FROM ventas ORDER BY id DESC');
  const itemRows = await sqliteAll(storage.sqliteDb, 'SELECT * FROM venta_items');
  const itemsByVenta = itemRows.reduce((acc, item) => {
    if (!acc[item.venta_id]) acc[item.venta_id] = [];
    acc[item.venta_id].push({ ...item, qty: item.cantidad || item.qty || 1 });
    return acc;
  }, {});

  res.json(rows.map((venta) => ({ ...venta, items: itemsByVenta[venta.id] || [] })));
}

async function getItems(req, res) {
  await initDb();
  if (storage.mode === 'mongo') {
    const items = await storage.mongoDb.collection('venta_items').find({ venta_id: toObjectId(req.params.id) }).toArray();
    return res.json(items);
  }

  const rows = await sqliteAll(storage.sqliteDb, 'SELECT * FROM venta_items WHERE venta_id = ?', [req.params.id]);
  res.json(rows);
}

module.exports = { create, getAll, getItems };
