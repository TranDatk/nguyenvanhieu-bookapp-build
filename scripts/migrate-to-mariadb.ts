/**
 * Migration script to import data from JSON files to MariaDB
 * Run: npx tsx scripts/migrate-to-mariadb.ts
 */

import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

const dbPath = path.join(process.cwd(), 'database');

interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  coverUrl: string;
  pdfUrl?: string;
  description: string;
  publishDate: string;
  views: number;
  comments: Array<{
    id: string;
    user: string;
    content: string;
    date: string;
  }>;
}

interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  imageUrl: string;
  publishDate: string;
  category: string;
}

interface Practice {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  publishDate: string;
  reactions?: number;
  comments?: Array<{
    id: string;
    user: string;
    content: string;
    date: string;
  }>;
}

async function readJsonFile<T>(filename: string): Promise<T> {
  const filePath = path.join(dbPath, filename);
  try {
    const fileContents = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContents) as T;
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return [] as unknown as T;
  }
}

async function migrate() {
  console.log('Starting migration to MariaDB...');
  
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

  if (!password) {
    console.warn('Warning: MYSQL_PASSWORD is empty. Make sure this is intentional.');
  }

  console.log(`Connecting to database: ${database}@${host}:${port} as ${user}`);
  
  // Create connection pool for migration
  const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  });
  
  const connection = await pool.getConnection();

  try {
    // Test connection
    await connection.query('SELECT 1');
    console.log('✓ Database connection successful');

    // Read schema file and execute
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf-8');
    const statements = schema.split(';').filter(s => s.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.query(statement);
      }
    }
    console.log('✓ Schema created successfully');

    // Migrate books
    const books = await readJsonFile<Book[]>('books.json');
    if (books.length > 0) {
      for (const book of books) {
        await connection.query(
          `INSERT INTO books (id, title, author, category, coverUrl, pdfUrl, description, publishDate, views)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           title = VALUES(title),
           author = VALUES(author),
           category = VALUES(category),
           coverUrl = VALUES(coverUrl),
           pdfUrl = VALUES(pdfUrl),
           description = VALUES(description),
           publishDate = VALUES(publishDate),
           views = VALUES(views)`,
          [
            book.id,
            book.title,
            book.author,
            book.category,
            book.coverUrl,
            book.pdfUrl || null,
            book.description,
            book.publishDate,
            book.views || 0,
          ]
        );

        // Migrate book comments
        if (book.comments && book.comments.length > 0) {
          for (const comment of book.comments) {
            await connection.query(
              `INSERT INTO book_comments (id, bookId, user, content, date)
               VALUES (?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
               user = VALUES(user),
               content = VALUES(content),
               date = VALUES(date)`,
              [comment.id, book.id, comment.user, comment.content, comment.date]
            );
          }
        }
      }
      console.log(`✓ Migrated ${books.length} books`);
    }

    // Migrate articles
    const articles = await readJsonFile<Article[]>('articles.json');
    if (articles.length > 0) {
      for (const article of articles) {
        await connection.query(
          `INSERT INTO articles (id, title, summary, content, imageUrl, publishDate, category)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           title = VALUES(title),
           summary = VALUES(summary),
           content = VALUES(content),
           imageUrl = VALUES(imageUrl),
           publishDate = VALUES(publishDate),
           category = VALUES(category)`,
          [
            article.id,
            article.title,
            article.summary || '',
            article.content,
            article.imageUrl,
            article.publishDate,
            article.category,
          ]
        );
      }
      console.log(`✓ Migrated ${articles.length} articles`);
    }

    // Migrate practices
    const practices = await readJsonFile<Practice[]>('practices.json');
    if (practices.length > 0) {
      for (const practice of practices) {
        await connection.query(
          `INSERT INTO practices (id, title, description, videoUrl, publishDate, reactions)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           title = VALUES(title),
           description = VALUES(description),
           videoUrl = VALUES(videoUrl),
           publishDate = VALUES(publishDate),
           reactions = VALUES(reactions)`,
          [
            practice.id,
            practice.title,
            practice.description,
            practice.videoUrl,
            practice.publishDate,
            practice.reactions || 0,
          ]
        );

        // Migrate practice comments
        if (practice.comments && practice.comments.length > 0) {
          for (const comment of practice.comments) {
            await connection.query(
              `INSERT INTO practice_comments (id, practiceId, user, content, date)
               VALUES (?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
               user = VALUES(user),
               content = VALUES(content),
               date = VALUES(date)`,
              [comment.id, practice.id, comment.user, comment.content, comment.date]
            );
          }
        }
      }
      console.log(`✓ Migrated ${practices.length} practices`);
    }

    // Migrate book categories
    const bookCategories = await readJsonFile<string[]>('book-categories.json');
    if (bookCategories.length > 0) {
      for (const category of bookCategories) {
        await connection.query(
          `INSERT IGNORE INTO book_categories (name) VALUES (?)`,
          [category]
        );
      }
      console.log(`✓ Migrated ${bookCategories.length} book categories`);
    }

    // Migrate article categories
    const articleCategories = await readJsonFile<string[]>('article-categories.json');
    if (articleCategories.length > 0) {
      for (const category of articleCategories) {
        await connection.query(
          `INSERT IGNORE INTO article_categories (name) VALUES (?)`,
          [category]
        );
      }
      console.log(`✓ Migrated ${articleCategories.length} article categories`);
    }

    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

// Run migration
migrate()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

