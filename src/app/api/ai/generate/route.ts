import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { topic, count = 5, difficulty = 'medium' } = await req.json();

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    const metaApiKey = process.env.META_AI_API_KEY;

    if (!metaApiKey) {
      return NextResponse.json(
        {
          error:
            'Meta AI API key is not configured in server environment (META_AI_API_KEY). Fallback to other AI providers is strictly prohibited by project policy.',
        },
        { status: 503 }
      );
    }

    // Call Meta AI (Llama 3 via Meta / Together / Groq / official endpoint using Meta AI model)
    const prompt = `You are a Technical Quiz Generator for the USICT GBU Programming Club.
Create ${count} single-choice technical multiple-choice questions on "${topic}" with difficulty "${difficulty}".
Output ONLY valid JSON array with objects matching:
{
  "question_text": "string",
  "options": ["string", "string", "string", "string"],
  "correct_option_index": 0,
  "timer_seconds": 30
}
Strictly ensure each question has exactly 4 options and timer_seconds is between 15 and 60.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${metaApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // Official Meta Llama model
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return NextResponse.json(
        { error: `Meta AI request failed: ${response.status} ${response.statusText} (${errBody})` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    const questions = Array.isArray(parsed) ? parsed : parsed.questions || [];

    return NextResponse.json({ success: true, provider: 'Meta AI (Llama)', questions });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Meta AI generation error: ${error.message || 'Unknown error'}. No fallback provider used.` },
      { status: 500 }
    );
  }
}
