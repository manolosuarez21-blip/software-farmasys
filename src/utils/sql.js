const { storage } = require('../config/db');
const { sqliteRun, sqliteGet, sqliteAll } = require('./sqlite');

async function dbAll(query, params = []) {
  if (storage.mode === 'mysql') {
    const [rows] = await storage.mysqlPool.execute(query, params);
    return rows;
  }
  return sqliteAll(storage.sqliteDb, query, params);
}

async function dbGet(query, params = []) {
  if (storage.mode === 'mysql') {
    const [rows] = await storage.mysqlPool.execute(query, params);
    return rows[0] || null;
  }
  return sqliteGet(storage.sqliteDb, query, params);
}

async function dbRun(query, params = []) {
  if (storage.mode === 'mysql') {
    const [result] = await storage.mysqlPool.execute(query, params);
    return { lastID: result.insertId, changes: result.affectedRows };
  }
  return sqliteRun(storage.sqliteDb, query, params);
}

module.exports = { dbAll, dbGet, dbRun };
