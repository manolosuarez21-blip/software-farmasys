const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');
const sqlite3 = require('sqlite3').verbose();

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const app = express();
const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/farmasys';
const sqliteDbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, 'farmasys.sqlite');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let storage = {
  mode: 'mongo',
  mongoClient: null,
  mongoDb: null,
  sqliteDb: null
};

function sqliteRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function sqliteGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function initSqliteDb() {
  if (storage.sqliteDb) return Promise.resolve(storage.sqliteDb);

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(sqliteDbPath, (err) => {
      if (err) return reject(err);

      db.serialize(async () => {
        try {
          await sqliteRun(db, `
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT UNIQUE NOT NULL,
              password TEXT NOT NULL,
              nombre TEXT NOT NULL,
              rol TEXT NOT NULL,
              activo INTEGER DEFAULT 1
            )
          `);
          await sqliteRun(db, `
            CREATE TABLE IF NOT EXISTS productos (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              codigo TEXT UNIQUE NOT NULL,
              nombre TEXT NOT NULL,
              categoria TEXT NOT NULL,
              stock INTEGER NOT NULL DEFAULT 0,
              precio REAL NOT NULL DEFAULT 0,
              costo REAL NOT NULL DEFAULT 0,
              ingreso TEXT,
              vence TEXT,
              distribuidor TEXT,
              ubicacion TEXT
            )
          `);
          await sqliteRun(db, `
            CREATE TABLE IF NOT EXISTS ventas (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              fecha TEXT NOT NULL,
              vendedor TEXT NOT NULL,
              cliente TEXT,
              nota TEXT,
              descuento REAL DEFAULT 0,
              subtotal REAL DEFAULT 0,
              total REAL DEFAULT 0,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `);
          await sqliteRun(db, `
            CREATE TABLE IF NOT EXISTS venta_items (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              venta_id INTEGER NOT NULL,
              producto_id INTEGER NOT NULL,
              nombre TEXT NOT NULL,
              precio REAL NOT NULL,
              cantidad INTEGER NOT NULL
            )
          `);
          await sqliteRun(db, `
            CREATE TABLE IF NOT EXISTS bodega (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              fecha TEXT NOT NULL,
              tipo TEXT NOT NULL,
              producto_id INTEGER NOT NULL,
              producto_nombre TEXT NOT NULL,
              cantidad INTEGER NOT NULL,
              distribuidor TEXT,
              vence TEXT,
              nota TEXT,
              responsable TEXT NOT NULL,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `);
          await sqliteRun(db, `
            CREATE TABLE IF NOT EXISTS distribuidores (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              nombre TEXT NOT NULL,
              contacto TEXT,
              telefono TEXT,
              email TEXT,
              ciudad TEXT,
              estado TEXT DEFAULT 'Activo'
            )
          `);

          const userCount = await sqliteGet(db, 'SELECT COUNT(*) AS count FROM users');
          if (userCount.count === 0) {
            await sqliteRun(db, 'INSERT INTO users (username, password, nombre, rol, activo) VALUES (?, ?, ?, ?, ?)', ['admin', 'admin123', 'Administrador', 'admin', 1]);
            await sqliteRun(db, 'INSERT INTO users (username, password, nombre, rol, activo) VALUES (?, ?, ?, ?, ?)', ['vendedor1', 'vend1', 'María López', 'vendedor', 1]);
          }

          const productCount = await sqliteGet(db, 'SELECT COUNT(*) AS count FROM productos');
          if (productCount.count === 0) {
            await sqliteRun(db, `
              INSERT INTO productos (codigo, nombre, categoria, stock, precio, costo, ingreso, vence, distribuidor, ubicacion) VALUES
              ('FAR-001', 'Acetaminofén 500mg', 'Medicamento', 200, 1500, 800, '2026-01-10', '2027-06-30', 'Tecnoquímicas', 'A-1'),
              ('FAR-002', 'Ibuprofeno 400mg', 'Medicamento', 150, 2200, 1100, '2026-02-05', '2027-09-15', 'Genfar', 'A-2'),
              ('FAR-003', 'Vitamina C 1g', 'Suplemento', 80, 3500, 1800, '2026-03-01', '2026-05-20', 'Procaps', 'B-1')
            `);
          }

          storage.sqliteDb = db;
          storage.mode = 'sqlite';
          resolve(db);
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

async function initMongoDb() {
  if (storage.mongoDb) return storage.mongoDb;

  const client = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 20000
  });
  await client.connect();
  storage.mongoClient = client;
  storage.mongoDb = client.db();
  storage.mode = 'mongo';

  const collections = await storage.mongoDb.listCollections().toArray();
  const existing = new Set(collections.map((c) => c.name));

  if (!existing.has('users')) {
    await storage.mongoDb.createCollection('users');
    await storage.mongoDb.collection('users').insertMany([
      { username: 'admin', password: 'admin123', nombre: 'Administrador', rol: 'admin', activo: 1 },
      { username: 'vendedor1', password: 'vend1', nombre: 'María López', rol: 'vendedor', activo: 1 }
    ]);
  }

  if (!existing.has('productos')) {
    await storage.mongoDb.createCollection('productos');
    await storage.mongoDb.collection('productos').insertMany([
      { codigo: 'FAR-001', nombre: 'Acetaminofén 500mg', categoria: 'Medicamento', stock: 200, precio: 1500, costo: 800, ingreso: '2026-01-10', vence: '2027-06-30', distribuidor: 'Tecnoquímicas', ubicacion: 'A-1' },
      { codigo: 'FAR-002', nombre: 'Ibuprofeno 400mg', categoria: 'Medicamento', stock: 150, precio: 2200, costo: 1100, ingreso: '2026-02-05', vence: '2027-09-15', distribuidor: 'Genfar', ubicacion: 'A-2' },
      { codigo: 'FAR-003', nombre: 'Vitamina C 1g', categoria: 'Suplemento', stock: 80, precio: 3500, costo: 1800, ingreso: '2026-03-01', vence: '2026-05-20', distribuidor: 'Procaps', ubicacion: 'B-1' }
    ]);
  }

  return storage.mongoDb;
}

async function initDb() {
  if (storage.mode === 'mongo' && storage.mongoDb) return storage;
  if (storage.mode === 'sqlite' && storage.sqliteDb) return storage;

  try {
    await initMongoDb();
    return storage;
  } catch (error) {
    console.warn('Atlas no disponible, usando almacenamiento local SQLite:', error.message);
    await initSqliteDb();
    return storage;
  }
}

function toObjectId(id) {
  try {
    return new ObjectId(id);
  } catch (error) {
    return null;
  }
}

app.get('/api/health', async (req, res) => {
  try {
    await initDb();
    res.json({ ok: true, message: 'FARMAsys API funcionando', database: storage.mode });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  await initDb();

  if (storage.mode === 'mongo') {
    const user = await storage.mongoDb.collection('users').findOne({ username, password, activo: 1 });
    if (!user) return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });
    return res.json({ ok: true, user: { id: user._id.toString(), username: user.username, nombre: user.nombre, rol: user.rol } });
  }

  const user = await sqliteGet(storage.sqliteDb, 'SELECT * FROM users WHERE username = ? AND password = ? AND activo = 1', [username, password]);
  if (!user) return res.status(401).json({ ok: false, message: 'Credenciales inválidas' });
  res.json({ ok: true, user: { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol } });
});

app.get('/api/productos', async (req, res) => {
  await initDb();
  if (storage.mode === 'mongo') {
    const productos = await storage.mongoDb.collection('productos').find({}).sort({ nombre: 1 }).toArray();
    return res.json(productos.map((p) => ({ ...p, id: p._id.toString() })));
  }

  const rows = await sqliteAll(storage.sqliteDb, 'SELECT * FROM productos ORDER BY nombre');
  res.json(rows);
});

app.post('/api/productos', async (req, res) => {
  const { codigo, nombre, categoria, stock, precio, costo, ingreso, vence, distribuidor, ubicacion } = req.body;
  await initDb();

  if (storage.mode === 'mongo') {
    const result = await storage.mongoDb.collection('productos').insertOne({ codigo, nombre, categoria, stock: stock || 0, precio: precio || 0, costo: costo || 0, ingreso: ingreso || null, vence: vence || null, distribuidor: distribuidor || null, ubicacion: ubicacion || null });
    return res.json({ ok: true, id: result.insertedId.toString() });
  }

  const result = await sqliteRun(storage.sqliteDb, 'INSERT INTO productos (codigo, nombre, categoria, stock, precio, costo, ingreso, vence, distribuidor, ubicacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [codigo, nombre, categoria, stock || 0, precio || 0, costo || 0, ingreso || null, vence || null, distribuidor || null, ubicacion || null]);
  res.json({ ok: true, id: result.lastID });
});

app.delete('/api/productos/:id', async (req, res) => {
  await initDb();
  if (storage.mode === 'mongo') {
    await storage.mongoDb.collection('productos').deleteOne({ _id: toObjectId(req.params.id) });
    return res.json({ ok: true });
  }

  await sqliteRun(storage.sqliteDb, 'DELETE FROM productos WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

app.post('/api/ventas', async (req, res) => {
  const { fecha, vendedor, cliente, nota, descuento, subtotal, total, items } = req.body;
  await initDb();

  if (storage.mode === 'mongo') {
    const session = storage.mongoClient.startSession();
    try {
      await session.withTransaction(async () => {
        const venta = await storage.mongoDb.collection('ventas').insertOne({ fecha, vendedor, cliente: cliente || null, nota: nota || null, descuento: descuento || 0, subtotal: subtotal || 0, total: total || 0, created_at: new Date() }, { session });
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
    const ventaResult = await sqliteRun(storage.sqliteDb, 'INSERT INTO ventas (fecha, vendedor, cliente, nota, descuento, subtotal, total) VALUES (?, ?, ?, ?, ?, ?, ?)', [fecha, vendedor, cliente || null, nota || null, descuento || 0, subtotal || 0, total || 0]);
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
});

app.get('/api/ventas', async (req, res) => {
  await initDb();
  if (storage.mode === 'mongo') {
    const ventas = await storage.mongoDb.collection('ventas').find({}).sort({ _id: -1 }).toArray();
    return res.json(ventas.map((v) => ({ ...v, id: v._id.toString() })));
  }

  const rows = await sqliteAll(storage.sqliteDb, 'SELECT * FROM ventas ORDER BY id DESC');
  res.json(rows);
});

app.get('/api/ventas/:id/items', async (req, res) => {
  await initDb();
  if (storage.mode === 'mongo') {
    const items = await storage.mongoDb.collection('venta_items').find({ venta_id: toObjectId(req.params.id) }).toArray();
    return res.json(items);
  }

  const rows = await sqliteAll(storage.sqliteDb, 'SELECT * FROM venta_items WHERE venta_id = ?', [req.params.id]);
  res.json(rows);
});

app.get('/api/bodega', async (req, res) => {
  await initDb();
  if (storage.mode === 'mongo') {
    const registros = await storage.mongoDb.collection('bodega').find({}).sort({ _id: -1 }).toArray();
    return res.json(registros.map((r) => ({ ...r, id: r._id.toString() })));
  }

  const rows = await sqliteAll(storage.sqliteDb, 'SELECT * FROM bodega ORDER BY id DESC');
  res.json(rows);
});

app.post('/api/bodega', async (req, res) => {
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
});

app.get('/api/distribuidores', async (req, res) => {
  await initDb();
  if (storage.mode === 'mongo') {
    const distribuidores = await storage.mongoDb.collection('distribuidores').find({}).sort({ nombre: 1 }).toArray();
    return res.json(distribuidores.map((d) => ({ ...d, id: d._id.toString() })));
  }

  const rows = await sqliteAll(storage.sqliteDb, 'SELECT * FROM distribuidores ORDER BY nombre');
  res.json(rows);
});

app.delete('/api/distribuidores/:id', async (req, res) => {
  await initDb();
  if (storage.mode === 'mongo') {
    await storage.mongoDb.collection('distribuidores').deleteOne({ _id: toObjectId(req.params.id) });
    return res.json({ ok: true });
  }

  await sqliteRun(storage.sqliteDb, 'DELETE FROM distribuidores WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

app.post('/api/distribuidores', async (req, res) => {
  const { nombre, contacto, telefono, email, ciudad, estado } = req.body;
  await initDb();
  if (storage.mode === 'mongo') {
    const result = await storage.mongoDb.collection('distribuidores').insertOne({ nombre, contacto: contacto || null, telefono: telefono || null, email: email || null, ciudad: ciudad || null, estado: estado || 'Activo' });
    return res.json({ ok: true, id: result.insertedId.toString() });
  }

  const result = await sqliteRun(storage.sqliteDb, 'INSERT INTO distribuidores (nombre, contacto, telefono, email, ciudad, estado) VALUES (?, ?, ?, ?, ?, ?)', [nombre, contacto || null, telefono || null, email || null, ciudad || null, estado || 'Activo']);
  res.json({ ok: true, id: result.lastID });
});

app.get('/api/usuarios', async (req, res) => {
  await initDb();
  if (storage.mode === 'mongo') {
    const usuarios = await storage.mongoDb.collection('users').find({}).sort({ nombre: 1 }).toArray();
    return res.json(usuarios.map((u) => ({ id: u._id.toString(), username: u.username, nombre: u.nombre, rol: u.rol, activo: u.activo })));
  }

  const rows = await sqliteAll(storage.sqliteDb, 'SELECT id, username, nombre, rol, activo FROM users ORDER BY nombre');
  res.json(rows);
});

app.delete('/api/usuarios/:id', async (req, res) => {
  await initDb();
  if (storage.mode === 'mongo') {
    await storage.mongoDb.collection('users').deleteOne({ _id: toObjectId(req.params.id) });
    return res.json({ ok: true });
  }

  await sqliteRun(storage.sqliteDb, 'DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

app.post('/api/usuarios', async (req, res) => {
  const { username, password, nombre, rol } = req.body;
  await initDb();
  if (storage.mode === 'mongo') {
    const result = await storage.mongoDb.collection('users').insertOne({ username, password, nombre, rol, activo: 1 });
    return res.json({ ok: true, id: result.insertedId.toString() });
  }

  const result = await sqliteRun(storage.sqliteDb, 'INSERT INTO users (username, password, nombre, rol, activo) VALUES (?, ?, ?, ?, 1)', [username, password, nombre, rol]);
  res.json({ ok: true, id: result.lastID });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'farmasys.html'));
});

async function startServer() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`FARMAsys backend corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error iniciando el servidor:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { initDb };
