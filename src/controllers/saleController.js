const { initDb, storage } = require('../config/db');
const { dbRun, dbGet, dbAll } = require('../utils/sql');
const { toObjectId } = require('../utils/objectid');

async function create(req, res) {
  const { fecha, vendedor, cliente, nota, descuento, subtotal, total, items, factura_numero, factura_emitida } = req.body;
  await initDb();

  if (storage.mode === 'mongo') {
    let session = null;
    try {
      session = storage.mongoClient.startSession();
    } catch (e) {
      session = null;
    }

    const saveMongoSale = async (sess) => {
      const opts = sess ? { session: sess } : {};
      const ventaDoc = {
        fecha,
        vendedor,
        cliente: cliente || null,
        nota: nota || null,
        descuento: descuento || 0,
        subtotal: subtotal || 0,
        total: total || 0,
        factura_numero: factura_numero || null,
        factura_emitida: !!factura_emitida,
        created_at: new Date()
      };
      const venta = await storage.mongoDb.collection('ventas').insertOne(ventaDoc, opts);
      const ventaId = venta.insertedId;

      for (const item of items || []) {
        await storage.mongoDb.collection('venta_items').insertOne({
          venta_id: ventaId,
          producto_id: item.producto_id || item.id,
          nombre: item.nombre,
          precio: item.precio,
          cantidad: item.qty || item.cantidad || 1
        }, opts);

        const rawProdId = item.producto_id || item.id;
        const prodObjId = toObjectId(rawProdId);
        const filter = prodObjId ? { $or: [{ _id: prodObjId }, { codigo: rawProdId }] } : { codigo: rawProdId };
        await storage.mongoDb.collection('productos').updateOne(filter, { $inc: { stock: -Number(item.qty || item.cantidad || 0) } }, opts);
      }
      return ventaId;
    };

    try {
      let ventaId;
      if (session) {
        try {
          await session.withTransaction(async () => {
            ventaId = await saveMongoSale(session);
          });
        } catch (txError) {
          ventaId = await saveMongoSale(null);
        }
      } else {
        ventaId = await saveMongoSale(null);
      }
      return res.json({ ok: true, id: ventaId.toString() });
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    } finally {
      if (session) await session.endSession().catch(() => {});
    }
  }

  try {
    const ventaResult = await dbRun('INSERT INTO ventas (fecha, vendedor, cliente, nota, descuento, subtotal, total, factura_numero, factura_emitida) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [fecha, vendedor, cliente || null, nota || null, descuento || 0, subtotal || 0, total || 0, factura_numero || null, factura_emitida ? 1 : 0]);
    const ventaId = ventaResult.lastID;
    for (const item of items || []) {
      const rawId = item.producto_id || item.id;
      const qty = Number(item.qty || item.cantidad || 1);
      await dbRun('INSERT INTO venta_items (venta_id, producto_id, nombre, precio, cantidad) VALUES (?, ?, ?, ?, ?)', [ventaId, String(rawId), item.nombre, item.precio, qty]);
      
      const isNumeric = /^\d+$/.test(String(rawId));
      if (isNumeric) {
        await dbRun('UPDATE productos SET stock = stock - ? WHERE id = ? OR codigo = ?', [qty, Number(rawId), String(rawId)]);
      } else {
        await dbRun('UPDATE productos SET stock = stock - ? WHERE codigo = ?', [qty, String(rawId)]);
      }
    }
    res.json({ ok: true, id: ventaId });
  } catch (error) {
    console.error('Error saving sale:', error);
    res.status(500).json({ ok: false, message: error.message });
  }
}

async function getAll(req, res) {
  try {
    await initDb();
    if (storage.mode === 'mongo') {
      const ventas = await storage.mongoDb.collection('ventas').find({}).sort({ _id: -1 }).toArray();
      const ventaIds = ventas.map((v) => v._id);
      const stringVentaIds = ventas.map((v) => v._id.toString());
      const items = await storage.mongoDb.collection('venta_items').find({
        $or: [
          { venta_id: { $in: ventaIds } },
          { venta_id: { $in: stringVentaIds } }
        ]
      }).toArray();

      const itemsByVenta = items.reduce((acc, item) => {
        const key = item.venta_id ? item.venta_id.toString() : '';
        if (!acc[key]) acc[key] = [];
        if (!acc[key].some(i => i._id && item._id && i._id.toString() === item._id.toString())) {
          acc[key].push({ ...item, id: item._id ? item._id.toString() : '', qty: item.cantidad || item.qty || 1 });
        }
        return acc;
      }, {});

      return res.json(ventas.map((v) => ({ ...v, id: v._id.toString(), items: itemsByVenta[v._id.toString()] || [] })));
    }

    const rows = await dbAll('SELECT * FROM ventas ORDER BY id DESC');
    const itemRows = await dbAll('SELECT * FROM venta_items');
    const itemsByVenta = itemRows.reduce((acc, item) => {
      if (!acc[item.venta_id]) acc[item.venta_id] = [];
      acc[item.venta_id].push({ ...item, qty: item.cantidad || item.qty || 1 });
      return acc;
    }, {});

    res.json(rows.map((venta) => ({ ...venta, items: itemsByVenta[venta.id] || [] })));
  } catch (err) {
    console.error('Error in sales getAll:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
}

async function getItems(req, res) {
  try {
    await initDb();
    if (storage.mode === 'mongo') {
      const objId = toObjectId(req.params.id);
      const filter = objId ? { $or: [{ venta_id: objId }, { venta_id: req.params.id }] } : { venta_id: req.params.id };
      const items = await storage.mongoDb.collection('venta_items').find(filter).toArray();
      return res.json(items.map(i => ({ ...i, id: i._id.toString(), qty: i.cantidad || i.qty || 1 })));
    }

    const rows = await dbAll('SELECT * FROM venta_items WHERE venta_id = ?', [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error('Error in sales getItems:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
}

module.exports = { create, getAll, getItems };
