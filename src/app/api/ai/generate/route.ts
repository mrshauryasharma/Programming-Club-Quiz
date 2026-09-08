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

    // Meta AI Official Endpoint (api.meta.ai) or custom endpoint
    const apiEndpoint = process.env.META_AI_BASE_URL || 'https://api.meta.ai/v1/chat/completions';
    const modelName = process.env.META_AI_MODEL || 'muse-spark-1.3';

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${metaApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      let friendlyMessage = `Meta AI service returned status ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.code === 'billing_not_configured' || response.status === 402) {
          friendlyMessage = 'Meta AI account billing is not configured or credit limit reached. Please verify payment method in the Meta AI dashboard.';
        } else if (response.status === 401 || errJson?.error?.code === 'invalid_api_key') {
          friendlyMessage = 'Invalid Meta AI API Key. Please verify META_AI_API_KEY in your server configuration.';
        } else if (errJson?.error?.message) {
          friendlyMessage = `Meta AI error: ${errJson.error.message}`;
        }
      } catch {
        // non-json response
      }

      return NextResponse.json(
        { error: friendlyMessage },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    let questions = [];

    try {
      // Clean possible markdown code fences if returned
      const cleanJson = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      questions = Array.isArray(parsed) ? parsed : parsed.questions || [];
    } catch {
      return NextResponse.json(
        { error: 'Meta AI returned an unexpected response format. Please try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, provider: 'Meta AI', questions });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Meta AI generation error: ${error.message || 'Unknown error'}. No fallback provider used.` },
      { status: 500 }
    );
  }
}
