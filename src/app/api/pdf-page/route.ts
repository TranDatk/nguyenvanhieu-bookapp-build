import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { pdfUrl, pageNumber, fromPage, toPage } = await request.json();

    // Check if it's a local file
    if (!pdfUrl || !pdfUrl.startsWith('/pdf/')) {
      // For external URLs, return the original URL (client will handle)
      return NextResponse.json({ 
        url: pdfUrl,
        isExternal: true 
      });
    }

    // Read the PDF file from public directory
    const pdfPath = path.join(process.cwd(), 'public', pdfUrl);
    
    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json(
        { error: 'PDF file not found' },
        { status: 404 }
      );
    }

    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const totalPages = pdfDoc.getPageCount();

    // Support range request (fromPage to toPage)
    if (fromPage !== undefined && toPage !== undefined) {
      // Validate range
      if (fromPage < 1 || toPage < 1 || fromPage > totalPages || toPage > totalPages || fromPage > toPage) {
        return NextResponse.json(
          { error: 'Invalid page range' },
          { status: 400 }
        );
      }

      // Check for pre-processed pages first
      const filename = pdfUrl.split('/').pop() || '';
      const fileId = filename.replace('.pdf', '');
      const pages: { pageNumber: number; url: string; isPreProcessed: boolean }[] = [];
      const pagesToExtract: number[] = [];

      for (let page = fromPage; page <= toPage; page++) {
        const preProcessedPageUrl = `/pdf-pages/${fileId}/page-${page}.pdf`;
        const preProcessedPath = path.join(process.cwd(), 'public', preProcessedPageUrl);
        
        if (fs.existsSync(preProcessedPath)) {
          pages.push({
            pageNumber: page,
            url: preProcessedPageUrl,
            isPreProcessed: true
          });
        } else {
          pagesToExtract.push(page);
        }
      }

      // Extract pages that are not pre-processed (one by one)
      for (const pageNum of pagesToExtract) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNum - 1]);
        newPdf.addPage(copiedPage);
        
        const pageBytes = await newPdf.save();
        const buffer = Buffer.from(pageBytes);
        const base64 = buffer.toString('base64');
        
        pages.push({
          pageNumber: pageNum,
          url: `data:application/pdf;base64,${base64}`,
          isPreProcessed: false
        });
      }
      
      // Sort pages by page number
      pages.sort((a, b) => a.pageNumber - b.pageNumber);

      return NextResponse.json({
        pages,
        totalPages,
        fromPage,
        toPage
      });
    }

    // Single page request (backward compatibility)
    if (pageNumber === undefined) {
      return NextResponse.json(
        { error: 'Missing pageNumber or page range' },
        { status: 400 }
      );
    }

    // Validate page number
    if (pageNumber < 1 || pageNumber > totalPages) {
      return NextResponse.json(
        { error: 'Invalid page number' },
        { status: 400 }
      );
    }

    // Check for pre-processed page first
    const filename = pdfUrl.split('/').pop() || '';
    const fileId = filename.replace('.pdf', '');
    const preProcessedPageUrl = `/pdf-pages/${fileId}/page-${pageNumber}.pdf`;
    const preProcessedPath = path.join(process.cwd(), 'public', preProcessedPageUrl);
    
    if (fs.existsSync(preProcessedPath)) {
      // Return pre-processed page URL
      return NextResponse.json({
        url: preProcessedPageUrl,
        isPreProcessed: true,
        pageNumber
      });
    }

    // Create a new PDF with only the requested page
    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNumber - 1]);
    newPdf.addPage(copiedPage);

    // Save to bytes
    const singlePageBytes = await newPdf.save();

    // Convert Uint8Array to Buffer
    const buffer = Buffer.from(singlePageBytes);

    // Return as PDF
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache 1 year
      },
    });
  } catch (error) {
    console.error('Error extracting PDF page:', error);
    return NextResponse.json(
      { error: 'Failed to extract page' },
      { status: 500 }
    );
  }
}

// GET endpoint to get total pages
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pdfUrl = searchParams.get('pdfUrl');

    if (!pdfUrl) {
      return NextResponse.json(
        { error: 'Missing pdfUrl parameter' },
        { status: 400 }
      );
    }

    // Check if it's a local file
    if (!pdfUrl.startsWith('/pdf/')) {
      // For external URLs, client needs to handle this differently
      return NextResponse.json({ 
        totalPages: null,
        isExternal: true,
        url: pdfUrl
      });
    }

    // Read the PDF file from public directory
    const pdfPath = path.join(process.cwd(), 'public', pdfUrl);
    
    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json(
        { error: 'PDF file not found' },
        { status: 404 }
      );
    }

    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();

    return NextResponse.json({ 
      totalPages,
      isExternal: false
    });
  } catch (error) {
    console.error('Error getting PDF info:', error);
    return NextResponse.json(
      { error: 'Failed to get PDF info' },
      { status: 500 }
    );
  }
}

