'use strict';

const sql = require('mssql');

const config = {
  server: process.env.DB_HOST || 'sqlserver',
  port: Number(process.env.DB_PORT || 1433),
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'FinanzApp',
  connectionTimeout: 5000,
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
};

async function main() {
  const pool = await new sql.ConnectionPool(config).connect();
  try {
    const result = await pool.request().query(`
      SELECT DB_NAME() AS database_name,
             (SELECT COUNT(*) FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo')) AS tables_created,
             (SELECT COUNT(*) FROM dbo.lab_runs) AS init_sql_rows,
             (SELECT COUNT(*) FROM dbo.financial_snapshots) AS finance_snapshots,
             OBJECT_ID(N'dbo.app_users', N'U') AS app_users_table_id,
             OBJECT_ID(N'dbo.app_sessions', N'U') AS app_sessions_table_id,
             (SELECT COUNT_BIG(*) FROM dbo.app_users) AS app_users,
             (SELECT COUNT_BIG(*) FROM dbo.app_sessions) AS app_sessions
    `);
    const row = result.recordset[0];
    if (!row.app_users_table_id || !row.app_sessions_table_id) {
      throw new Error('Faltan las tablas dbo.app_users o dbo.app_sessions; ejecuta la inicialización SQL.');
    }
    console.log(JSON.stringify(row, null, 2));
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error('[DB Check] No se pudo validar SQL Server:', error.message);
  process.exit(1);
});
