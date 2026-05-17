
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function listTables() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables:', res.rows.map(r => r.table_name));
    
    // Also check columns of checkpoint tables if they exist
    for (const table of res.rows.map(r => r.table_name)) {
      if (table.includes('checkpoint')) {
        const columns = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [table]);
        console.log(`Columns for ${table}:`, columns.rows);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

listTables();
