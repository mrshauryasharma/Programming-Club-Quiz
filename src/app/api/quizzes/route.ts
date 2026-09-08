import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const quizzes = await db.getQuizzes();
    return NextResponse.json({ quizzes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch quizzes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, questions } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Quiz title is required' }, { status: 400 });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'Quiz must contain at least 1 question' }, { status: 400 });
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text || typeof q.question_text !== 'string' || q.question_text.trim().length === 0) {
        return NextResponse.json({ error: `Question ${i + 1} text is required` }, { status: 400 });
      }

      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) {
        return NextResponse.json({ error: `Question ${i + 1} must have 2 to 4 options` }, { status: 400 });
      }

      if (typeof q.correct_option_index !== 'number' || q.correct_option_index < 0 || q.correct_option_index >= q.options.length) {
        return NextResponse.json({ error: `Question ${i + 1} must have a valid correct option selected` }, { status: 400 });
      }

      const timer = Number(q.timer_seconds);
      if (isNaN(timer) || timer < 10 || timer > 120) {
        return NextResponse.json({ error: `Question ${i + 1} timer must be between 10 and 120 seconds` }, { status: 400 });
      }
    }

    const created = await db.createQuiz(
      { title: title.trim(), description: description ? description.trim() : '' },
      questions.map(q => ({
        question_text: q.question_text.trim(),
        options: q.options.map((opt: string) => opt.trim()),
        correct_option_index: Number(q.correct_option_index),
        timer_seconds: Number(q.timer_seconds),
        order_index: 0,
      }))
    );

    return NextResponse.json({ quiz: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create quiz' }, { status: 500 });
  }
}
