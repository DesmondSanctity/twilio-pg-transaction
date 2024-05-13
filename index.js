import express from 'express';
import twilio from 'twilio';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
 user: process.env.DB_USER,
 host: process.env.DB_HOST,
 database: process.env.DB_NAME,
 password: process.env.DB_PASSWORD,
 port: process.env.DB_PORT,
 ssl: {
  rejectUnauthorized: false,
 },
});

const client = await pool.connect();

const app = express();

app.use(express.json());
app.disable('x-powered-by');

const twilioClient = twilio(
 process.env.TWILIO_ACCOUNT_SID,
 process.env.TWILIO_AUTH_TOKEN
);

// Helper function to send error response
const sendError = (res, status, message) => {
 res.status(status).json({ error: message });
};

// Signup route
app.post('/signup', async (req, res) => {
 const { email, password } = req.body;

 try {
  await client.query('BEGIN');

  const result = await client.query('SELECT * FROM users WHERE email = $1', [
   email,
  ]);
  if (result.rows.length > 0) {
   await client.query('ROLLBACK');
   return sendError(res, 400, 'Email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10); // Replace with your password hashing library
  const otp = Math.floor(100000 + Math.random() * 900000); // Generate random OTP

  await client.query(
   'INSERT INTO users (email, password, otp) VALUES ($1, $2, $3)',
   [email, hashedPassword, otp]
  );

  await client.query('COMMIT');

  await twilioClient.messages.create({
   body: `Your OTP for signup is ${otp}`,
   from: process.env.TWILIO_PHONE_NUMBER,
   to: `whatsapp:${process.env.TEST_PHONE_NUMBER}`, // Replace with recipient phone number
  });
  res.json({ message: 'Signup successful, OTP sent to your phone' });
 } catch (err) {
  console.error(err);
  await client.query('ROLLBACK');
  sendError(res, 500, 'Signup failed');
 } finally {
  await client.release();
 }
});

// Verify route
app.post('/verify', async (req, res) => {
 const { email, code } = req.body;

 try {
  const client = await pool.getClient();
  await client.query('BEGIN');

  const result = await client.query('SELECT * FROM users WHERE email = $1', [
   email,
  ]);
  if (!result.rows.length) {
   await client.query('ROLLBACK');
   return sendError(res, 400, 'Invalid email');
  }

  const user = result.rows[0];
  if (user.otp !== code) {
   await client.query('ROLLBACK');
   return sendError(res, 400, 'Invalid OTP');
  }

  await client.query(
   'UPDATE users SET isVerified = true, otp = null WHERE email = $1',
   [email]
  );

  await client.query('COMMIT');
  res.json({ message: 'Verification successful' });
 } catch (err) {
  console.error(err);
  await client.query('ROLLBACK');
  sendError(res, 500, 'Verification failed');
 } finally {
  client.release();
 }
});

// Login route (implement your logic to compare email and hashed password)
app.post('/login', async (req, res) => {
 const { email, password } = req.body;

 try {
  const result = await client.query('SELECT * FROM users WHERE email = $1', [
   email,
  ]);
  if (!result.rows.length) {
   return sendError(res, 401, 'Invalid email or password');
  }

  const user = result.rows[0];

  // Replace this with your password hashing library (e.g., bcrypt)
  const isPasswordValid = await bcrypt.compare(password, user.password); // Placeholder logic

  if (!isPasswordValid) {
   return sendError(res, 401, 'Invalid email or password');
  }

  // Successful login logic (e.g., generate JWT token)
  res.json({ message: 'Login successful', token: 'your_generated_token' }); // Placeholder token
 } catch (err) {
  console.error(err);
  sendError(res, 500, 'Login failed');
 } finally {
  client.release();
 }
});

app.listen(3000, () => console.log('Server listening on port 3000'));
