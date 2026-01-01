/**
 * Migration script to add status column to articles table
 * Run: npx tsx scripts/add-status-to-articles.ts
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

async function addStatusColumn() {
  console.log('Adding status column to articles table...');
  
  // Validate environment variables
  const host = process.env.MYSQL_HOST || 'localhost';
  const port = parseInt(process.env.MYSQL_PORT || '3306');
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || '';

  if (!database) {
    console.error('Error: MYSQL_DATABASE environment variable is required');
    console.error('Please set MYSQL_DATABASE in your .env file');
    process.exit(1);
  }

  console.log(`Connecting to database: ${database}@${host}:${port} as ${user}`);
  
  // Create connection
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
  });

  try {
    // Check if column already exists
    const [columns] = await connection.query<any[]>(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'articles' 
       AND COLUMN_NAME = 'status'`,
      [database]
    );

    if (columns.length > 0) {
      console.log('✓ Column "status" already exists in articles table');
      await connection.end();
      return;
    }

    // Add status column
    await connection.query(`
      ALTER TABLE articles 
      ADD COLUMN status ENUM('draft', 'published') DEFAULT 'published' 
      AFTER category
    `);

    console.log('✓ Successfully added status column to articles table');
    
    // Update existing articles to have published status
    await connection.query(`
      UPDATE articles 
      SET status = 'published' 
      WHERE status IS NULL
    `);
    
    console.log('✓ Updated existing articles to have published status');
    
  } catch (error: any) {
    console.error('Error adding status column:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run migration
addStatusColumn()
  .then(() => {
    console.log('Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

