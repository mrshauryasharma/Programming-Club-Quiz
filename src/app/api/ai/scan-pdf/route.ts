import { NextRequest, NextResponse } from 'next/server';
import { parseMCQsFromText, extractTextFromPdfArrayBuffer } from '@/lib/pdfParser';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    let rawText = '';
    let fileName = 'Scanned Quiz';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json();
      rawText = body.text || '';
      fileName = body.title || fileName;
    } else {
      try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        if (file) {
          fileName = file.name;
          const arrayBuffer = await file.arrayBuffer();
          rawText = await extractTextFromPdfArrayBuffer(arrayBuffer);
        }
      } catch (formErr) {
        console.warn('FormData read error:', formErr);
      }
    }

    if (!rawText || !rawText.trim()) {
      return NextResponse.json(
        { error: 'Could not extract text from this PDF. Please ensure the PDF contains selectable text (not scanned images).' },
        { status: 400 }
      );
    }

    // Try Meta AI first if configured (with strict 3.5s timeout)
    const metaApiKey = process.env.META_AI_API_KEY;
    if (metaApiKey) {
      try {
        const prompt = `You are a Technical Quiz Scanner for the USICT GBU Programming Club.
Extract all multiple-choice questions from the provided text and convert them into single-choice MCQs with 4 options.
Output ONLY valid JSON matching this schema:
{
  "title": "Suggested quiz title based on the document",
  "questions": [
    {
      "question_text": "string",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_option_index": 0,
      "timer_seconds": 30
    }
  ]
}
Strict Rules:
- Output exactly 4 options per question.
- correct_option_index must be an integer 0, 1, 2, or 3.
- timer_seconds must be between 15 and 60.
- Maximum 15 questions.
- Return ONLY the JSON object, with no markdown code blocks or additional text.

DOCUMENT TEXT:
${rawText.slice(0, 10000)}`;

        const apiEndpoint = process.env.META_AI_BASE_URL || 'https://api.meta.ai/v1/chat/completions';
        const modelName = process.env.META_AI_MODEL || 'muse-spark-1.3';

        const aiRes = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${metaApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          }),
          signal: AbortSignal.timeout(3500),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          const cleanJson = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            return NextResponse.json({
              success: true,
              provider: 'Meta AI',
              title: parsed.title || fileName.replace(/\.[^/.]+$/, ''),
              questions: parsed.questions,
            });
          }
        }
      } catch (err) {
        console.warn('Meta AI extraction skipped or timed out, using local parser:', err);
      }
    }

    // Local smart parser
    const fallbackQuestions = parseMCQsFromText(rawText);

    if (fallbackQuestions.length > 0) {
      return NextResponse.json({
        success: true,
        provider: 'PDF Scanner',
        title: fileName.replace(/\.[^/.]+$/, ''),
        questions: fallbackQuestions,
      });
    }

    return NextResponse.json(
      {
        error: 'No structured MCQs could be detected. Please ensure questions are numbered (e.g. 1., 2.) with options A, B, C, D.',
      },
      { status: 422 }
    );

  } catch (err: any) {
    console.error('Unhandled scan-pdf error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal error scanning PDF file' },
      { status: 500 }
    );
  }
}
