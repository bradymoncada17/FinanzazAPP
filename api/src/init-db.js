'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const sql = require('mssql');

const database = process.env.DB_NAME || 'FinanzApp';
const server = process.env.DB_HOST || 'sqlserver';
const baseConfig = {
  server,
  port: Number(process.env.DB_PORT || 1433),
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  connectionTimeout: 5000,
  requestTimeout: 30000,
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createDatabase() {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(database)) throw new Error('Nombre de base de datos no válido.');
  const master = await new sql.ConnectionPool({ ...baseConfig, database: 'master' }).connect();
  try {
    await master.request().query(`IF DB_ID(N'${database}') IS NULL CREATE DATABASE [${database}]`);
  } finally {
    await master.close();
  }
}

async function initialize() {
  await createDatabase();
  const appPool = await new sql.ConnectionPool({ ...baseConfig, database }).connect();
  try {
    const file = process.env.INIT_SQL_PATH || path.join(__dirname, '../../database/init.sql');
    const script = await fs.readFile(file, 'utf8');
    await appPool.request().batch(script);
    console.log(`[DB Init] Script ejecutado correctamente en ${database}.`);
  } finally {
    await appPool.close();
  }
}

async function main() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      await initialize();
      return;
    } catch (error) {
      console.log(`[DB Init] SQL Server no está listo (intento ${attempt}/60): ${error.message}`);
      if (attempt === 60) throw error;
      await sleep(2000);
    }
  }
}

main().catch((error) => {
  console.error('[DB Init] Falló la inicialización SQL:', error.message);
  process.exit(1);
});
