import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getBooks, getArticles } from '@/lib/db';

// Security: Require API key for this endpoint
const CLEANUP_API_KEY = process.env.CLEANUP_API_KEY || 'your-secret-key-change-this';

export async function POST(request: NextRequest) {
  try {
    // Verify API key
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CLEANUP_API_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deletedFiles: string[] = [];
    const errors: string[] = [];

    // Get all image and PDF URLs from database
    const [books, articles] = await Promise.all([
      getBooks(),
      getArticles(),
    ]);

    // Collect all URLs that are in use
    const usedUrls = new Set<string>();
    
    books.forEach((book) => {
      if (book.coverUrl) usedUrls.add(book.coverUrl);
      if (book.pdfUrl) usedUrls.add(book.pdfUrl);
    });
    
    articles.forEach((article) => {
      if (article.imageUrl) usedUrls.add(article.imageUrl);
    });

    // Function to check and delete unused files in a directory
    const cleanupDirectory = async (dirPath: string, urlPrefix: string) => {
      try {
        const fullPath = path.join(process.cwd(), 'public', dirPath);
        const files = await fs.readdir(fullPath);

        for (const file of files) {
          const fileUrl = `/${dirPath}/${file}`;
          
          // Skip if file is being used
          if (usedUrls.has(fileUrl)) {
            continue;
          }

          // Delete unused file
          try {
            await fs.unlink(path.join(fullPath, file));
            deletedFiles.push(fileUrl);
          } catch (error) {
            errors.push(`Failed to delete ${fileUrl}: ${error}`);
          }
        }
      } catch (error) {
        errors.push(`Failed to read directory ${dirPath}: ${error}`);
      }
    };

    // Cleanup images and PDFs
    await Promise.all([
      cleanupDirectory('images', '/images'),
      cleanupDirectory('pdf', '/pdf'),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed',
      stats: {
        deletedCount: deletedFiles.length,
        errorCount: errors.length,
        usedFilesCount: usedUrls.size,
      },
      deletedFiles,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to check stats without deleting
export async function GET(request: NextRequest) {
  try {
    // Verify API key
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CLEANUP_API_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all URLs from database
    const [books, articles] = await Promise.all([
      getBooks(),
      getArticles(),
    ]);

    const usedUrls = new Set<string>();
    
    books.forEach((book) => {
      if (book.coverUrl) usedUrls.add(book.coverUrl);
      if (book.pdfUrl) usedUrls.add(book.pdfUrl);
    });
    
    articles.forEach((article) => {
      if (article.imageUrl) usedUrls.add(article.imageUrl);
    });

    // Count files in directories
    const getFileCount = async (dirPath: string) => {
      try {
        const fullPath = path.join(process.cwd(), 'public', dirPath);
        const files = await fs.readdir(fullPath);
        
        const unusedFiles = files.filter(file => {
          const fileUrl = `/${dirPath}/${file}`;
          return !usedUrls.has(fileUrl);
        });
        
        return {
          total: files.length,
          used: files.length - unusedFiles.length,
          unused: unusedFiles.length,
          unusedFiles: unusedFiles.map(f => `/${dirPath}/${f}`),
        };
      } catch (error) {
        return { total: 0, used: 0, unused: 0, error: String(error) };
      }
    };

    const [imagesStats, pdfStats] = await Promise.all([
      getFileCount('images'),
      getFileCount('pdf'),
    ]);

    return NextResponse.json({
      success: true,
      usedUrlsCount: usedUrls.size,
      images: imagesStats,
      pdfs: pdfStats,
      totalUnusedFiles: (imagesStats.unused || 0) + (pdfStats.unused || 0),
    });

  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

