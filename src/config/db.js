const path = require('path');
const dns = require('dns');
const { MongoClient } = require('mongodb');
const sqlite3 = require('sqlite3').verbose();
const { sqliteRun, sqliteGet } = require('../utils/sqlite');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (err) {
  // Ignorar si falla
}

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/farmasys';
const sqliteDbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../farmasys.sqlite');

let storage = {
  mode: 'mongo',
  mongoClient: null,
  mongoDb: null,
  sqliteDb: null
};

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
              ubicacion TEXT,
              imagen TEXT,
              codigo_barras TEXT
            )
          `);
          try {
            await sqliteRun(db, 'ALTER TABLE productos ADD COLUMN imagen TEXT');
          } catch (e) {
            // Ignorar si la columna ya existe
          }
          try {
            await sqliteRun(db, 'ALTER TABLE productos ADD COLUMN codigo_barras TEXT');
          } catch (e) {
            // Ignorar si la columna ya existe
          }
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
              factura_numero TEXT,
              factura_emitida INTEGER DEFAULT 0,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `);
          try {
            await sqliteRun(db, 'ALTER TABLE ventas ADD COLUMN factura_numero TEXT');
          } catch (e) {
            // Ignorar si la columna ya existe
          }
          try {
            await sqliteRun(db, 'ALTER TABLE ventas ADD COLUMN factura_emitida INTEGER DEFAULT 0');
          } catch (e) {
            // Ignorar si la columna ya existe
          }
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

  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/farmasys';
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000
  });
  await client.connect();
  storage.mongoClient = client;
  const dbName = process.env.MONGO_DB_NAME || (client.db().databaseName !== 'test' ? client.db().databaseName : 'farmasys');
  storage.mongoDb = client.db(dbName);
  storage.mode = 'mongo';
  console.log(`[MongoDB] Conectado exitosamente a la base de datos: '${storage.mongoDb.databaseName}'`);

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

module.exports = { initDb, storage, mongoUri, sqliteDbPath };
