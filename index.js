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
app.post('/signup', async (req, res) => {
 const { email, phone, password } = req.body;
 const client = await pool.connect();
 try {
  await client.query('BEGIN');

  const result = await client.query('SELECT * FROM users WHERE email = $1', [
   email,
  ]);
  if (result.rows.length > 0) {
   await client.query('ROLLBACK');
   return sendError(res, 400, 'Email already exists', null);
  }

  const hashedPassword = await bcrypt.hash(password, 10); // Replace with your password hashing library

  await client.query(
   'INSERT INTO users (email, phone, password) VALUES ($1, $2, $3)',
   [email, phone, hashedPassword]
  );

  const verify = await twilioClient.verify.v2
   .services(process.env.TWILIO_MESSAGE_SID)
   .verifications.create({
    channel: 'sms',
    to: phone,
   });

  console.log(verify);

  await client.query('COMMIT');
  res.json({ message: 'Signup successful, OTP sent to your phone' });
 } catch (err) {
  console.error(err);
  await client.query('ROLLBACK');
  sendError(res, 500, 'Signup failed', err);
 } finally {
  client.release();
 }
});

// Verify route
app.post('/verify', async (req, res) => {
 const { phone, code } = req.body;
 const client = await pool.connect();
 try {
  await client.query('BEGIN');

  const result = await client.query('SELECT * FROM users WHERE phone = $1', [
   phone,
  ]);
  if (!result.rows.length) {
   await client.query('ROLLBACK');
   return sendError(res, 400, 'Invalid phone', null);
  }

  const verificationCheck = await twilioClient.verify.v2
   .services(process.env.TWILIO_MESSAGE_SID)
   .verificationChecks.create({
    code: code,
    to: phone,
   });

  if (verificationCheck.status !== 'approved') {
   await client.query('ROLLBACK');
   return sendError(res, 400, 'Invalid OTP', null);
  }

  await client.query('UPDATE users SET isVerified = true WHERE phone = $1', [
   phone,
  ]);

  await client.query('COMMIT');
  res.json({ message: 'Verification successful' });
 } catch (err) {
  console.error(err);
  await client.query('ROLLBACK');
  sendError(res, 500, 'Verification failed', err);
 } finally {
  client.release();
 }
});

// Login route (implement your logic to compare email and hashed password)
app.post('/login', async (req, res) => {
 const { email, password } = req.body;
 const client = await pool.connect();
 try {
  const result = await client.query('SELECT * FROM users WHERE email = $1', [
   email,
  ]);
  if (!result.rows.length) {
   return sendError(res, 401, 'Invalid email or password', null);
  }

  const user = result.rows[0];

  // Replace this with your password hashing library (e.g., bcrypt)
  const isPasswordValid = await bcrypt.compare(password, user.password); // Placeholder logic

  if (!isPasswordValid) {
   return sendError(res, 401, 'Invalid email or password', null);
  }

  // Successful login logic (e.g., generate JWT token)
  user.password = null;
  res.json({ message: 'Login successful', user }); // Placeholder token
 } catch (err) {
  console.error(err);
  sendError(res, 500, 'Login failed', err);
 } finally {
  client.release();
 }
});

app.listen(3000, () => console.log('Server listening on port 3000'));
