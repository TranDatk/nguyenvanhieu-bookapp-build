import { NextRequest, NextResponse } from 'next/server';
import { getArticleCategories, addArticleCategory, updateArticleCategory, deleteArticleCategory } from '@/lib/db';

export async function GET() {
  try {
    const categories = await getArticleCategories();
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch article categories' },
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
    await addArticleCategory(category);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to add article category' },
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
    await updateArticleCategory(oldCategory, newCategory);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update article category' },
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
    await deleteArticleCategory(category);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete article category' },
      { status: 500 }
    );
  }
}

