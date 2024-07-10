import { pool } from './index.js';

export const createTable = async () => {
 const client = await pool.connect();
 const query = await client.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    isVerified BOOLEAN DEFAULT false
  )`);

 console.log('Table created successfully');
 return query;
};
