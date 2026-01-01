import { NextRequest, NextResponse } from 'next/server';
import { getBookCategories, addBookCategory, updateBookCategory, deleteBookCategory } from '@/lib/db';

export async function GET() {
  try {
    const categories = await getBookCategories();
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch book categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { category } = await request.json();
    if (!category) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }
    await addBookCategory(category);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to add book category' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { oldCategory, newCategory } = await request.json();
    if (!oldCategory || !newCategory) {
      return NextResponse.json(
        { error: 'Old and new category names are required' },
        { status: 400 }
      );
    }
    await updateBookCategory(oldCategory, newCategory);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update book category' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    if (!category) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }
    await deleteBookCategory(category);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete book category' },
      { status: 500 }
    );
  }
}

