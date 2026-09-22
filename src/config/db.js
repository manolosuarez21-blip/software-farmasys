const path = require('path');
const dns = require('dns');
const { MongoClient } = require('mongodb');
const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const { sqliteRun, sqliteGet } = require('../utils/sqlite');

const DEFAULT_MYSQL_URI = 'mysql://ug5ucywg5f8edzmk:oKV9y3fPdTG7QUzrAdVB@b3yofqbnfw0fvjqc7thu-mysql.services.clever-cloud.com:3306/b3yofqbnfw0fvjqc7thu';
const mysqlUri = process.env.MYSQL_URI || process.env.MYSQL_ADDON_URI || DEFAULT_MYSQL_URI;

const DEFAULT_MONGO_URI = 'mongodb+srv://manolosuarez:Manuelito0@cluster0.wtkadyv.mongodb.net/farmasys?appName=Cluster0';
const mongoUri = process.env.MONGO_URI || DEFAULT_MONGO_URI;

const sqliteDbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../farmasys.sqlite');

let storage = {
  mode: 'mysql',
  mysqlPool: null,
  mongoClient: null,
  mongoDb: null,
  sqliteDb: null
};

async function initMysqlDb() {
  if (storage.mysqlPool) return storage.mysqlPool;

  const pool = mysql.createPool({
    uri: mysqlUri,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000
  });

  // Verificar conexión inicial
  const [testResult] = await pool.execute('SELECT 1 AS ok');

  // Crear tablas necesarias si no existen
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      nombre VARCHAR(100) NOT NULL,
      rol ENUM('admin', 'vendedor') NOT NULL DEFAULT 'vendedor',
      activo TINYINT(1) DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS productos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      codigo VARCHAR(50) UNIQUE NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      categoria VARCHAR(50) NOT NULL,
      stock INT NOT NULL DEFAULT 0,
      precio DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      costo DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      ingreso DATE NULL,
      vence DATE NULL,
      distribuidor VARCHAR(100) NULL,
      ubicacion VARCHAR(50) NULL,
      imagen LONGTEXT NULL,
      codigo_barras VARCHAR(100) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ventas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fecha VARCHAR(20) NOT NULL,
      vendedor VARCHAR(100) NOT NULL,
      cliente VARCHAR(150) NULL,
      nota TEXT NULL,
      descuento DECIMAL(5,2) DEFAULT 0.00,
      subtotal DECIMAL(12,2) DEFAULT 0.00,
      total DECIMAL(12,2) DEFAULT 0.00,
      factura_numero VARCHAR(50) NULL,
      factura_emitida TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS venta_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      venta_id INT NOT NULL,
      producto_id VARCHAR(50) NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      precio DECIMAL(12,2) NOT NULL,
      cantidad INT NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS bodega (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fecha VARCHAR(20) NOT NULL,
      tipo VARCHAR(50) NOT NULL,
      producto_id VARCHAR(50) NOT NULL,
      producto_nombre VARCHAR(150) NOT NULL,
      cantidad INT NOT NULL DEFAULT 0,
      distribuidor VARCHAR(100) NULL,
      vence DATE NULL,
      nota TEXT NULL,
      responsable VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS distribuidores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      contacto VARCHAR(100) NULL,
      telefono VARCHAR(50) NULL,
      email VARCHAR(100) NULL,
      ciudad VARCHAR(100) NULL,
      estado VARCHAR(20) DEFAULT 'Activo'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Crear usuarios iniciales si la tabla está vacía
  const [userRows] = await pool.execute('SELECT COUNT(*) AS count FROM users');
  if (userRows[0].count === 0) {
    await pool.execute(
      'INSERT INTO users (username, password, nombre, rol, activo) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)',
      ['admin', 'admin123', 'Administrador', 'admin', 1, 'vendedor1', 'vend1', 'María López', 'vendedor', 1]
    );
  }

  // Crear productos iniciales si la tabla está vacía
  const [prodRows] = await pool.execute('SELECT COUNT(*) AS count FROM productos');
  if (prodRows[0].count === 0) {
    await pool.execute(`
      INSERT INTO productos (codigo, nombre, categoria, stock, precio, costo, ingreso, vence, distribuidor, ubicacion) VALUES
      ('FAR-001', 'Acetaminofén 500mg', 'Medicamento', 200, 1500, 800, '2026-01-10', '2027-06-30', 'Tecnoquímicas', 'A-1'),
      ('FAR-002', 'Ibuprofeno 400mg', 'Medicamento', 150, 2200, 1100, '2026-02-05', '2027-09-15', 'Genfar', 'A-2'),
      ('FAR-003', 'Vitamina C 1g', 'Suplemento', 80, 3500, 1800, '2026-03-01', '2026-05-20', 'Procaps', 'B-1')
    `);
  }

  storage.mysqlPool = pool;
  storage.mode = 'mysql';
  console.log('[MySQL] Conectado exitosamente a Clever Cloud MySQL!');
  return pool;
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
              ubicacion TEXT,
              imagen TEXT,
              codigo_barras TEXT
            )
          `);
          try {
            await sqliteRun(db, 'ALTER TABLE productos ADD COLUMN imagen TEXT');
          } catch (e) {}
          try {
            await sqliteRun(db, 'ALTER TABLE productos ADD COLUMN codigo_barras TEXT');
          } catch (e) {}
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
          } catch (e) {}
          try {
            await sqliteRun(db, 'ALTER TABLE ventas ADD COLUMN factura_emitida INTEGER DEFAULT 0');
          } catch (e) {}
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

  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (dnsErr) {
    console.warn('[DB] No se pudo ajustar los servidores DNS públicos:', dnsErr.message);
  }

  const uri = mongoUri;
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000
  });

  const connectPromise = client.connect();
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('MongoDB timeout (10s)')), 10000)
  );

  try {
    await Promise.race([connectPromise, timeoutPromise]);
  } catch (err) {
    client.close().catch(() => {});
    throw err;
  }

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

  if (!existing.has('ventas')) {
    await storage.mongoDb.createCollection('ventas');
  }
  if (!existing.has('venta_items')) {
    await storage.mongoDb.createCollection('venta_items');
  }
  if (!existing.has('bodega')) {
    await storage.mongoDb.createCollection('bodega');
  }
  if (!existing.has('distribuidores')) {
    await storage.mongoDb.createCollection('distribuidores');
  }

  return storage.mongoDb;
}

async function initDb() {
  if (storage.mode === 'mysql' && storage.mysqlPool) return storage;
  if (storage.mode === 'mongo' && storage.mongoDb) return storage;
  if (storage.mode === 'sqlite' && storage.sqliteDb) return storage;

  // 1. Intentar conectar a Clever Cloud MySQL primero
  if (mysqlUri) {
    try {
      await initMysqlDb();
      return storage;
    } catch (mysqlErr) {
      console.warn('[DB] MySQL no disponible, probando alternativas:', mysqlErr.message);
    }
  }

  // 2. Intentar conectar a MongoDB Atlas
  try {
    await initMongoDb();
    return storage;
  } catch (mongoErr) {
    console.warn('[DB] MongoDB no disponible, usando SQLite local:', mongoErr.message);
  }

  // 3. Fallback de emergencia a SQLite local
  await initSqliteDb();
  return storage;
}

module.exports = { initDb, storage, mysqlUri, mongoUri, sqliteDbPath };
