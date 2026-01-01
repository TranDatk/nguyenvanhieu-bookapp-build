import { NextRequest, NextResponse } from 'next/server';
import { addPracticeReaction, removePracticeReaction } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { practiceId, action } = await request.json();
    if (!practiceId) {
      return NextResponse.json(
        { error: 'Practice ID is required' },
        { status: 400 }
      );
    }
    
    if (action === 'remove') {
      await removePracticeReaction(practiceId);
    } else {
      await addPracticeReaction(practiceId);
    }
    
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error handling reaction:', error);
    return NextResponse.json(
      { error: 'Failed to handle reaction' },
      { status: 500 }
    );
  }
}

