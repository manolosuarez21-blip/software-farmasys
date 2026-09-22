const { initDb, storage } = require('../config/db');
const { dbRun, dbGet, dbAll } = require('../utils/sql');
const { toObjectId } = require('../utils/objectid');

async function getAll(req, res) {
  try {
    await initDb();
    if (storage.mode === 'mongo') {
      const productos = await storage.mongoDb.collection('productos').find({}).sort({ nombre: 1 }).toArray();
      return res.json(productos.map((p) => ({ ...p, id: p._id.toString() })));
    }

    const rows = await dbAll('SELECT * FROM productos ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    console.error('Error in product getAll:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
}

async function create(req, res) {
  try {
    const { codigo, nombre, categoria, stock, precio, costo, ingreso, vence, distribuidor, ubicacion, imagen, codigo_barras } = req.body;
    await initDb();

    if (storage.mode === 'mongo') {
      const result = await storage.mongoDb.collection('productos').insertOne({
        codigo,
        nombre,
        categoria,
        stock: Number(stock) || 0,
        precio: Number(precio) || 0,
        costo: Number(costo) || 0,
        ingreso: ingreso || null,
        vence: vence || null,
        distribuidor: distribuidor || null,
        ubicacion: ubicacion || null,
        imagen: imagen || null,
        codigo_barras: codigo_barras || null
      });
      return res.json({ ok: true, id: result.insertedId.toString() });
    }

    const result = await dbRun(
      'INSERT INTO productos (codigo, nombre, categoria, stock, precio, costo, ingreso, vence, distribuidor, ubicacion, imagen, codigo_barras) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [codigo, nombre, categoria, Number(stock) || 0, Number(precio) || 0, Number(costo) || 0, ingreso || null, vence || null, distribuidor || null, ubicacion || null, imagen || null, codigo_barras || null]
    );
    res.json({ ok: true, id: result.lastID });
  } catch (err) {
    console.error('Error in product create:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
}

async function updateById(req, res) {
  try {
    const { id } = req.params;
    const { codigo, nombre, categoria, stock, precio, costo, ingreso, vence, distribuidor, ubicacion, imagen, codigo_barras } = req.body;
    await initDb();

    if (storage.mode === 'mongo') {
      const updateDoc = {
        codigo,
        nombre,
        categoria,
        stock: Number(stock) || 0,
        precio: Number(precio) || 0,
        costo: Number(costo) || 0,
        ingreso: ingreso || null,
        vence: vence || null,
        distribuidor: distribuidor || null,
        ubicacion: ubicacion || null,
        codigo_barras: codigo_barras || null
      };
      if (imagen !== undefined) updateDoc.imagen = imagen;

      const objId = toObjectId(id);
      const filter = objId ? { $or: [{ _id: objId }, { codigo: id }] } : { codigo: id };
      await storage.mongoDb.collection('productos').updateOne(filter, { $set: updateDoc });
      return res.json({ ok: true });
    }

    if (imagen !== undefined) {
      await dbRun(
        'UPDATE productos SET codigo = ?, nombre = ?, categoria = ?, stock = ?, precio = ?, costo = ?, ingreso = ?, vence = ?, distribuidor = ?, ubicacion = ?, imagen = ?, codigo_barras = ? WHERE id = ?',
        [codigo, nombre, categoria, Number(stock) || 0, Number(precio) || 0, Number(costo) || 0, ingreso || null, vence || null, distribuidor || null, ubicacion || null, imagen, codigo_barras || null, id]
      );
    } else {
      await dbRun(
        'UPDATE productos SET codigo = ?, nombre = ?, categoria = ?, stock = ?, precio = ?, costo = ?, ingreso = ?, vence = ?, distribuidor = ?, ubicacion = ?, codigo_barras = ? WHERE id = ?',
        [codigo, nombre, categoria, Number(stock) || 0, Number(precio) || 0, Number(costo) || 0, ingreso || null, vence || null, distribuidor || null, ubicacion || null, codigo_barras || null, id]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Error in product updateById:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
}

async function deleteById(req, res) {
  try {
    await initDb();
    if (storage.mode === 'mongo') {
      const objId = toObjectId(req.params.id);
      const filter = objId ? { $or: [{ _id: objId }, { codigo: req.params.id }] } : { codigo: req.params.id };
      await storage.mongoDb.collection('productos').deleteOne(filter);
      return res.json({ ok: true });
    }

    await dbRun('DELETE FROM productos WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error in product deleteById:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
}

module.exports = { getAll, create, updateById, deleteById };
