import pg from 'pg';
import express from 'express';
import twilio from 'twilio';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { createTable } from './seed.js';

dotenv.config();

const { Pool } = pg;
export const pool = new Pool({
 user: process.env.DB_USER,
 host: process.env.DB_HOST,
 database: process.env.DB_NAME,
 password: process.env.DB_PASSWORD,
 port: process.env.DB_PORT,
 // ssl: {
 //  rejectUnauthorized: false,
 // },
});

const app = express();

app.use(express.json());
app.disable('x-powered-by');

const twilioClient = twilio(
 process.env.TWILIO_ACCOUNT_SID,
 process.env.TWILIO_AUTH_TOKEN
);

// Check if users table exist
const tableExists = async () => {
 const client = await pool.connect();
 try {
  const res = await client.query(`SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'users'
    )`);
  return res.rows[0].exists;
 } catch (err) {
  client.release();
  console.error('Error checking table existence:', err);
  return false;
 }
};

// Create users table if it doesn't exist
if (!(await tableExists())) {
 console.log('Creating users table');
 await createTable();
} else {
 console.log('Users table already exists');
}

// Helper function to send error response
const sendError = (res, status, message, err) => {
 res.status(status).json({ error: message, errMessage: err });
};

// Signup route
app.post('/signup', async (req, res) => {});

// Verify route
app.post('/verify', async (req, res) => {});

// Login route
app.post('/login', async (req, res) => {});

app.listen(3000, () => console.log('Server listening on port 3000'));
