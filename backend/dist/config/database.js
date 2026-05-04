import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});
export async function testConnection() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        console.log('✅ Database connected:', result.rows[0]);
        client.release();
        return true;
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
        return false;
    }
}
export async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log(`Query executed in ${duration}ms`);
        return result;
    }
    catch (error) {
        console.error('Query error:', error);
        throw error;
    }
}
//# sourceMappingURL=database.js.map