import { NextRequest, NextResponse } from 'next/server';
import { addPracticeComment } from '@/lib/db';
import { Comment } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { practiceId, comment } = await request.json();
    if (!practiceId || !comment) {
      return NextResponse.json(
        { error: 'Practice ID and comment are required' },
        { status: 400 }
      );
    }
    if (!comment.id || !comment.user || !comment.content || !comment.date) {
      return NextResponse.json(
        { error: 'Comment must have id, user, content, and date' },
        { status: 400 }
      );
    }
    await addPracticeComment(practiceId, comment as Comment);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error adding practice comment:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add comment' },
      { status: 500 }
    );
  }
}

