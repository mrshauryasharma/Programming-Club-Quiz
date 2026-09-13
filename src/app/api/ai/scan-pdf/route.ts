import { NextRequest, NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';

interface ExtractedMCQ {
  question_text: string;
  options: string[];
  correct_option_index: number;
  timer_seconds: number;
}

// Regex fallback parser for standard MCQ documents
function parseMCQsFromText(text: string): ExtractedMCQ[] {
  const questions: ExtractedMCQ[] = [];
  
  // Clean up text
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split on question numbers like "1.", "Q1.", "Question 1:", "1)"
  const qBlocks = clean.split(/(?:^|\n)(?:Q(?:uestion)?\s*)?(\d+)[\.\:\)]\s+/i);
  
  // qBlocks[0] is header/preamble, then pairs of [number, content]
  for (let i = 1; i < qBlocks.length; i += 2) {
    const qNum = qBlocks[i];
    const block = qBlocks[i + 1];
    if (!block) continue;

    // Extract options A, B, C, D
    const optMatch = block.match(/(?:^|\n)\s*\(?[A-a]\)?[.\s]+([\s\S]*?)(?:^|\n)\s*\(?[B-b]\)?[.\s]+([\s\S]*?)(?:^|\n)\s*\(?[C-c]\)?[.\s]+([\s\S]*?)(?:^|\n)\s*\(?[D-d]\)?[.\s]+([\s\S]*?)(?=(?:^|\n)\s*(?:Ans|Answer|\d+[\.\)]|$))/i);
    
    if (optMatch) {
      // Question text is everything before option A
      const questionText = block.slice(0, optMatch.index).trim();
      const optA = optMatch[1].trim();
      const optB = optMatch[2].trim();
      const optC = optMatch[3].trim();
      let optD = optMatch[4].trim();

      // Check for answer key in optD or remainder
      let correctIdx = 0;
      const ansMatch = block.match(/(?:Ans|Answer)[\s\:\-]+([A-Da-d])/i);
      if (ansMatch) {
        const letter = ansMatch[1].toUpperCase();
        if (letter === 'A') correctIdx = 0;
        else if (letter === 'B') correctIdx = 1;
        else if (letter === 'C') correctIdx = 2;
        else if (letter === 'D') correctIdx = 3;

        // Clean optD if it contained the answer string
        optD = optD.replace(/(?:Ans|Answer)[\s\:\-]+[A-Da-d][\s\S]*/i, '').trim();
      }

      if (questionText && optA && optB && optC && optD) {
        questions.push({
          question_text: questionText.replace(/\n+/g, ' ').trim(),
          options: [
            optA.replace(/\n+/g, ' ').trim(),
            optB.replace(/\n+/g, ' ').trim(),
            optC.replace(/\n+/g, ' ').trim(),
            optD.replace(/\n+/g, ' ').trim(),
          ],
          correct_option_index: correctIdx,
          timer_seconds: 30,
        });
      }
    }
  }

  return questions;
}

export async function POST(req: NextRequest) {
  let parserInstance: any = null;
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No PDF file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text using PDFParse
    let rawText = '';
    try {
      parserInstance = new PDFParse({ data: buffer });
      await parserInstance.load();
      const parsed = await parserInstance.getText();
      rawText = parsed?.text || '';
    } catch (e: any) {
      return NextResponse.json({ error: `Failed to read PDF text: ${e.message || 'Corrupted or unreadable PDF'}` }, { status: 400 });
    } finally {
      if (parserInstance?.destroy) {
        await parserInstance.destroy().catch(() => {});
      }
    }

    if (!rawText.trim()) {
      return NextResponse.json({ error: 'Could not extract any text from this PDF. Please ensure it contains selectable text.' }, { status: 400 });
    }

    // Try Meta AI first if API key is present
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
              title: parsed.title || file.name.replace(/\.[^/.]+$/, ''),
              questions: parsed.questions,
            });
          }
        }
      } catch (err) {
        console.warn('Meta AI extraction failed, falling back to regex parser:', err);
      }
    }

    // Fallback parser if Meta AI is unconfigured or failed
    const fallbackQuestions = parseMCQsFromText(rawText);

    if (fallbackQuestions.length > 0) {
      return NextResponse.json({
        success: true,
        provider: 'PDF Scanner',
        title: file.name.replace(/\.[^/.]+$/, ''),
        questions: fallbackQuestions,
      });
    }

    return NextResponse.json({
      error: 'Could not detect structured MCQs in this PDF. Please verify the PDF contains numbered questions with options A, B, C, D.',
    }, { status: 422 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error scanning PDF' }, { status: 500 });
  }
}
