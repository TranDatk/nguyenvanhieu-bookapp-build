/**
 * Migration script to add views column to articles table
 * Run: npx tsx scripts/add-views-to-articles.ts
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

async function addViewsToArticles() {
  console.log('Adding views column to articles table...');
  
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
    // Check if views column already exists
    const [columns] = await connection.query<any[]>(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'articles' 
       AND COLUMN_NAME = 'views'`,
      [database]
    );

    if (columns.length > 0) {
      console.log('✓ Views column already exists in articles table');
    } else {
      // Add views column
      await connection.query(
        `ALTER TABLE articles 
         ADD COLUMN views INT DEFAULT 0 AFTER status`
      );
      console.log('✓ Successfully added views column to articles table');
    }

    // Update existing articles to have views = 0 if NULL
    await connection.query(
      `UPDATE articles SET views = 0 WHERE views IS NULL`
    );
    console.log('✓ Updated existing articles with default views value');
    
  } catch (error: any) {
    console.error('Error adding views column:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run migration
addViewsToArticles()
  .then(() => {
    console.log('\n Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n Migration failed:', error);
    process.exit(1);
  });

