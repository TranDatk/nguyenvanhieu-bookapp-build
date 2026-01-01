import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { pdfPath } = await request.json();

    if (!pdfPath) {
      return NextResponse.json(
        { error: 'Missing pdfPath' },
        { status: 400 }
      );
    }

    // Get the full path
    const fullPath = path.join(process.cwd(), 'public', pdfPath);
    
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'PDF file not found' },
        { status: 404 }
      );
    }

    // Extract file ID from path (e.g., /pdf/abc123.pdf -> abc123)
    const fileId = path.basename(pdfPath, '.pdf');
    const pagesDir = path.join(process.cwd(), 'public', 'pdf-pages', fileId);
    
    // Create pages directory
    if (!fs.existsSync(pagesDir)) {
      fs.mkdirSync(pagesDir, { recursive: true });
    }

    // Create initial status file
    const statusPath = path.join(pagesDir, 'status.json');
    fs.writeFileSync(statusPath, JSON.stringify({
      status: 'processing',
      totalPages: 0,
      processedPages: 0,
      startedAt: new Date().toISOString(),
    }));

    // Start background processing (non-blocking)
    processPdfInBackground(fullPath, pagesDir, statusPath);

    return NextResponse.json({
      success: true,
      fileId,
      message: 'PDF processing started',
    });
  } catch (error) {
    console.error('Error starting PDF processing:', error);
    return NextResponse.json(
      { error: 'Failed to start PDF processing' },
      { status: 500 }
    );
  }
}

// Background processing function
async function processPdfInBackground(pdfPath: string, pagesDir: string, statusPath: string) {
  try {
    // Load PDF
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();

    // Update status with total pages
    fs.writeFileSync(statusPath, JSON.stringify({
      status: 'processing',
      totalPages,
      processedPages: 0,
      startedAt: new Date(JSON.parse(fs.readFileSync(statusPath, 'utf-8')).startedAt).toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    // Process each page
    for (let i = 0; i < totalPages; i++) {
      const pageNumber = i + 1;
      
      try {
        // Create new PDF with single page
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
        newPdf.addPage(copiedPage);

        // Save page
        const pageBytes = await newPdf.save();
        const pagePath = path.join(pagesDir, `page-${pageNumber}.pdf`);
        fs.writeFileSync(pagePath, Buffer.from(pageBytes));

        // Update progress
        const currentStatus = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
        fs.writeFileSync(statusPath, JSON.stringify({
          ...currentStatus,
          processedPages: pageNumber,
          updatedAt: new Date().toISOString(),
        }));

        console.log(`Processed page ${pageNumber}/${totalPages}`);
      } catch (error) {
        console.error(`Error processing page ${pageNumber}:`, error);
      }
    }

    // Mark as completed
    const finalStatus = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    fs.writeFileSync(statusPath, JSON.stringify({
      ...finalStatus,
      status: 'completed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    console.log(`PDF processing completed: ${totalPages} pages`);
  } catch (error) {
    console.error('Error in background PDF processing:', error);
    
    // Mark as failed
    try {
      const failedStatus = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
      fs.writeFileSync(statusPath, JSON.stringify({
        ...failedStatus,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date().toISOString(),
      }));
    } catch (e) {
      console.error('Failed to update status file:', e);
    }
  }
}

// GET endpoint to check processing status
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: 'Missing fileId parameter' },
        { status: 400 }
      );
    }

    const statusPath = path.join(process.cwd(), 'public', 'pdf-pages', fileId, 'status.json');
    
    if (!fs.existsSync(statusPath)) {
      return NextResponse.json({
        status: 'not_found',
        message: 'Processing not started or file not found',
      });
    }

    const status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error checking PDF processing status:', error);
    return NextResponse.json(
      { error: 'Failed to check processing status' },
      { status: 500 }
    );
  }
}

