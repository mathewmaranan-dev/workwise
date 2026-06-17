import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') ? { rejectUnauthorized: false } : undefined });

async function run(){
  const client = await pool.connect();
  try{
    const total = await client.query('SELECT COUNT(*) as c FROM ml_training_samples');
    const active = await client.query("SELECT COUNT(*) as c FROM ml_training_samples WHERE is_active = TRUE");
    const synthetic = await client.query("SELECT COUNT(*) as c FROM ml_training_samples WHERE source_type = 'synthetic'");
    const sample = await client.query("SELECT training_sample_id, ticket_id, non_fcr_label, agent_fcr_history, category_non_fcr_rate, is_active, source_type FROM ml_training_samples LIMIT 5");
    console.log('total', total.rows[0].c);
    console.log('active', active.rows[0].c);
    console.log('synthetic', synthetic.rows[0].c);
    console.log('sample rows:', sample.rows);
  }catch(e){
    console.error(e);
  }finally{
    client.release();
    await pool.end();
  }
}

run();
