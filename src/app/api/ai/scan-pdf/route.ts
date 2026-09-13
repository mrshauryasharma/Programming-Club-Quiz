import { NextRequest, NextResponse } from 'next/server';
import zlib from 'zlib';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface ExtractedMCQ {
  question_text: string;
  options: string[];
  correct_option_index: number;
  timer_seconds: number;
}

// Regex parser supporting diverse MCQ document formats
function parseMCQsFromText(text: string): ExtractedMCQ[] {
  const questions: ExtractedMCQ[] = [];
  
  // Clean up text and normalize line breaks
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split on question numbers like "1.", "Q1.", "Question 1:", "1)", "1 -", "Q.1"
  const qBlocks = clean.split(/(?:^|\n)\s*(?:Q(?:uestion)?[\s\.\:\-]*)?(\d+)[\.\:\)\-]\s+/i);
  
  for (let i = 1; i < qBlocks.length; i += 2) {
    const block = qBlocks[i + 1];
    if (!block) continue;

    // Match options A, B, C, D in formats like A) / (A) / A. / a) / (a) / a.
    const optRegex = /(?:^|\n|\s)\(?[A-a]\)?[.\:\)]\s+([\s\S]*?)(?:^|\n|\s)\(?[B-b]\)?[.\:\)]\s+([\s\S]*?)(?:^|\n|\s)\(?[C-c]\)?[.\:\)]\s+([\s\S]*?)(?:^|\n|\s)\(?[D-d]\)?[.\:\)]\s+([\s\S]*?)(?=(?:^|\n)\s*(?:Ans(?:wer)?|Correct(?:\s*Option)?|Key|\d+[\.\:\)\-]|$))/i;
    const optMatch = block.match(optRegex);
    
    if (optMatch) {
      const questionText = block.slice(0, optMatch.index).replace(/\n+/g, ' ').trim();
      const optA = optMatch[1].replace(/\n+/g, ' ').trim();
      const optB = optMatch[2].replace(/\n+/g, ' ').trim();
      const optC = optMatch[3].replace(/\n+/g, ' ').trim();
      let optD = optMatch[4].replace(/\n+/g, ' ').trim();

      // Check for answer key in optD or remainder
      let correctIdx = 0;
      const ansMatch = block.match(/(?:Ans(?:wer)?|Correct(?:\s*Option)?|Key)[\s\:\-]+([A-Da-d])/i);
      if (ansMatch) {
        const letter = ansMatch[1].toUpperCase();
        correctIdx = { A: 0, B: 1, C: 2, D: 3 }[letter] ?? 0;

        // Clean optD if it contained the answer string
        optD = optD.replace(/(?:Ans(?:wer)?|Correct(?:\s*Option)?|Key)[\s\:\-]+[A-Da-d][\s\S]*/i, '').trim();
      }

      if (questionText && optA && optB && optC && optD) {
        questions.push({
          question_text: questionText,
          options: [optA, optB, optC, optD],
          correct_option_index: correctIdx,
          timer_seconds: 30,
        });
      }
    }
  }

  return questions;
}

// Pure JavaScript PDF text extractor (Edge, Node, Cloudflare, Serverless 100% compatible)
function extractTextFromPdfBuffer(buffer: Buffer): string {
  let fullText = '';
  const bufferString = buffer.toString('binary');

  // Find all stream ... endstream blocks
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;

  while ((match = streamRegex.exec(bufferString)) !== null) {
    const streamContent = match[1];
    const streamBuffer = Buffer.from(streamContent, 'binary');

    let decompressed: Buffer | null = null;
    try {
      decompressed = zlib.inflateSync(streamBuffer);
    } catch {
      try {
        decompressed = zlib.inflateRawSync(streamBuffer);
      } catch {
        decompressed = streamBuffer;
      }
    }

    if (decompressed) {
      const textChunk = decompressed.toString('latin1');

      // 1. Match TJ arrays: [(text) 10 (text)] TJ
      const tjArrayRegex = /\[((?:\(.*?\)|[^\]])+)\]\s*TJ/g;
      let tjMatch;
      while ((tjMatch = tjArrayRegex.exec(textChunk)) !== null) {
        const parts = tjMatch[1].match(/\((.*?)\)/g);
        if (parts) {
          fullText += parts.map(p => p.slice(1, -1)).join('') + ' ';
        }
      }

      // 2. Match simple (text) Tj
      const tjSimpleRegex = /\((.*?)\)\s*Tj/g;
      let simpleMatch;
      while ((simpleMatch = tjSimpleRegex.exec(textChunk)) !== null) {
        fullText += simpleMatch[1] + '\n';
      }

      // 3. Match ' or "
      const quoteRegex = /\((.*?)\)\s*['"]/g;
      let quoteMatch;
      while ((quoteMatch = quoteRegex.exec(textChunk)) !== null) {
        fullText += quoteMatch[1] + '\n';
      }
    }
  }

  // 4. Fallback if streams didn't yield text
  if (!fullText.trim()) {
    const rawMatches = bufferString.match(/\(([^()]{2,})\)/g);
    if (rawMatches) {
      fullText = rawMatches.map(m => m.slice(1, -1)).join(' ');
    }
  }

  return fullText
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\r/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, ' ')
    .trim();
}

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
          const buffer = Buffer.from(arrayBuffer);
          rawText = extractTextFromPdfBuffer(buffer);
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
