const { initDb, storage } = require('../config/db');
const { sqliteRun, sqliteGet, sqliteAll } = require('../utils/sqlite');
const { toObjectId } = require('../utils/objectid');

async function getAll(req, res) {
  await initDb();
  if (storage.mode === 'mongo') {
    const productos = await storage.mongoDb.collection('productos').find({}).sort({ nombre: 1 }).toArray();
    return res.json(productos.map((p) => ({ ...p, id: p._id.toString() })));
  }

  const rows = await sqliteAll(storage.sqliteDb, 'SELECT * FROM productos ORDER BY nombre');
  res.json(rows);
}

async function create(req, res) {
  const { codigo, nombre, categoria, stock, precio, costo, ingreso, vence, distribuidor, ubicacion, imagen } = req.body;
  await initDb();

  if (storage.mode === 'mongo') {
    const result = await storage.mongoDb.collection('productos').insertOne({
      codigo, nombre, categoria, stock: stock || 0, precio: precio || 0, costo: costo || 0,
      ingreso: ingreso || null, vence: vence || null, distribuidor: distribuidor || null,
      ubicacion: ubicacion || null, imagen: imagen || null
    });
    return res.json({ ok: true, id: result.insertedId.toString() });
  }

  const result = await sqliteRun(storage.sqliteDb,
    'INSERT INTO productos (codigo, nombre, categoria, stock, precio, costo, ingreso, vence, distribuidor, ubicacion, imagen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [codigo, nombre, categoria, stock || 0, precio || 0, costo || 0, ingreso || null, vence || null, distribuidor || null, ubicacion || null, imagen || null]
  );
  res.json({ ok: true, id: result.lastID });
}

async function updateById(req, res) {
  const { id } = req.params;
  const { codigo, nombre, categoria, stock, precio, costo, ingreso, vence, distribuidor, ubicacion, imagen } = req.body;
  await initDb();

  if (storage.mode === 'mongo') {
    const updateDoc = {
      codigo, nombre, categoria,
      stock: stock || 0, precio: precio || 0, costo: costo || 0,
      ingreso: ingreso || null, vence: vence || null,
      distribuidor: distribuidor || null, ubicacion: ubicacion || null
    };
    if (imagen !== undefined) updateDoc.imagen = imagen;

    await storage.mongoDb.collection('productos').updateOne(
      { _id: toObjectId(id) },
      { $set: updateDoc }
    );
    return res.json({ ok: true });
  }

  if (imagen !== undefined) {
    await sqliteRun(storage.sqliteDb,
      'UPDATE productos SET codigo = ?, nombre = ?, categoria = ?, stock = ?, precio = ?, costo = ?, ingreso = ?, vence = ?, distribuidor = ?, ubicacion = ?, imagen = ? WHERE id = ?',
      [codigo, nombre, categoria, stock || 0, precio || 0, costo || 0, ingreso || null, vence || null, distribuidor || null, ubicacion || null, imagen, id]
    );
  } else {
    await sqliteRun(storage.sqliteDb,
      'UPDATE productos SET codigo = ?, nombre = ?, categoria = ?, stock = ?, precio = ?, costo = ?, ingreso = ?, vence = ?, distribuidor = ?, ubicacion = ? WHERE id = ?',
      [codigo, nombre, categoria, stock || 0, precio || 0, costo || 0, ingreso || null, vence || null, distribuidor || null, ubicacion || null, id]
    );
  }

  res.json({ ok: true });
}

async function deleteById(req, res) {
  await initDb();
  if (storage.mode === 'mongo') {
    await storage.mongoDb.collection('productos').deleteOne({ _id: toObjectId(req.params.id) });
    return res.json({ ok: true });
  }

  await sqliteRun(storage.sqliteDb, 'DELETE FROM productos WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}

module.exports = { getAll, create, updateById, deleteById };
