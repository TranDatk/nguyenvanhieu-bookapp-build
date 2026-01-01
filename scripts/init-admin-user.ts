/**
 * Migration script to initialize admin user with hashed password
 * Run: npx tsx scripts/init-admin-user.ts
 * 
 * This script will:
 * 1. Check if admin user exists
 * 2. If not, create admin user with hashed password
 * 3. If exists, update password hash if it's still the placeholder
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function initAdminUser() {
  console.log('Initializing admin user...');
  
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

  // Get admin credentials from environment or use defaults
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminName = process.env.ADMIN_NAME || 'Administrator';
  const adminId = 'admin-00000000-0000-7000-8000-000000000000';

  console.log(`Connecting to database: ${database}@${host}:${port} as ${user}`);
  console.log(`Admin email: ${adminEmail}`);
  console.log(`Admin password: ${adminPassword} (will be hashed)`);
  
  // Create connection
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
  });

  try {
    // Check if admin user exists
    const [users] = await connection.query<any[]>(
      `SELECT id, email, password FROM users WHERE id = ? OR email = ?`,
      [adminId, adminEmail]
    );

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    if (users.length === 0) {
      // Create admin user
      await connection.query(
        `INSERT INTO users (id, email, password, name, role) 
         VALUES (?, ?, ?, ?, ?)`,
        [adminId, adminEmail, hashedPassword, adminName, 'admin']
      );
      console.log('✓ Successfully created admin user');
    } else {
      // Check if password is still placeholder
      const existingUser = users[0];
      if (existingUser.password === '$2a$10$PLACEHOLDER_PASSWORD_HASH') {
        // Update password hash
        await connection.query(
          `UPDATE users SET password = ? WHERE id = ?`,
          [hashedPassword, existingUser.id]
        );
        console.log('✓ Successfully updated admin user password hash');
      } else {
        console.log('✓ Admin user already exists with hashed password');
      }
    }
    
    console.log('\n Admin credentials:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('\n  Please change the password after first login!');
    
  } catch (error: any) {
    console.error('Error initializing admin user:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run migration
initAdminUser()
  .then(() => {
    console.log('\n Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n Migration failed:', error);
    process.exit(1);
  });

