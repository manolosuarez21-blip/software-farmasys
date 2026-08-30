const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dbPath = path.join(__dirname, 'tmp-sales.sqlite');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

process.env.SQLITE_DB_PATH = dbPath;
for (const key of Object.keys(require.cache)) {
  if (key.includes('/src/config/db') || key.includes('/src/controllers/saleController')) {
    delete require.cache[key];
  }
}

const { initDb, storage } = require('../src/config/db');
const { create, getAll } = require('../src/controllers/saleController');
const { create: createProduct, getAll: getProducts } = require('../src/controllers/productController');

test('create and list a sale with multiple products', async () => {
  await initDb();
  storage.sqliteDb = storage.sqliteDb || await initDb();

  const productRes = {
    payload: null,
    statusCode: 200,
    json(payload) { this.payload = payload; return payload; },
    status(code) { this.statusCode = code; return this; }
  };

  await createProduct({
    body: {
      codigo: 'BAR-001',
      nombre: 'Jarabe X',
      categoria: 'Medicamento',
      stock: 15,
      precio: 2500,
      costo: 1800,
      ingreso: '2026-08-01',
      vence: '2027-08-01',
      distribuidor: 'Lab',
      ubicacion: 'A-3',
      codigo_barras: '7751234567890'
    }
  }, productRes);

  const productListRes = {
    payload: null,
    statusCode: 200,
    json(payload) { this.payload = payload; return payload; },
    status(code) { this.statusCode = code; return this; }
  };

  await getProducts({}, productListRes);
  assert.equal(productListRes.payload.some(product => product.codigo_barras === '7751234567890'), true);

  const createRes = {
    payload: null,
    statusCode: 200,
    json(payload) { this.payload = payload; return payload; },
    status(code) { this.statusCode = code; return this; }
  };

  await create({
    body: {
      fecha: '2026-08-07',
      vendedor: 'Test',
      cliente: 'Cliente',
      nota: 'Venta de prueba',
      descuento: 0,
      subtotal: 3000,
      total: 3000,
      factura_numero: 'F-000001',
      factura_emitida: true,
      items: [
        { id: 1, nombre: 'Acetaminofén', precio: 1000, qty: 2 },
        { id: 2, nombre: 'Ibuprofeno', precio: 1000, qty: 1 }
      ]
    }
  }, createRes);

  assert.equal(createRes.statusCode, 200);
  assert.equal(createRes.payload.ok, true);

  const listRes = {
    payload: null,
    statusCode: 200,
    json(payload) { this.payload = payload; return payload; },
    status(code) { this.statusCode = code; return this; }
  };

  await getAll({}, listRes);
  assert.equal(Array.isArray(listRes.payload), true);
  assert.equal(listRes.payload.length, 1);
  assert.equal(listRes.payload[0].items.length, 2);
  assert.deepEqual(listRes.payload[0].items.map(item => item.nombre), ['Acetaminofén', 'Ibuprofeno']);
});
