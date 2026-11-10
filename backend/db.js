
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const connectDB = async () => {
  try {
    const result = await pool.query('SELECT NOW()');

    console.log('PostgreSQL Database Connected Successfully!');
    console.log('Database Time:', result.rows[0].now);
  } catch (error) {
    console.error('Database Connection Failed:', error.message);
  }
};

module.exports = {
  pool,
  connectDB,
};
