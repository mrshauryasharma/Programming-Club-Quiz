export interface ExtractedMCQ {
  question_text: string;
  options: string[];
  correct_option_index: number;
  timer_seconds: number;
}

// Robust multi-format MCQ text parser
export function parseMCQsFromText(text: string): ExtractedMCQ[] {
  const questions: ExtractedMCQ[] = [];
  if (!text) return questions;

  // Clean up text and normalize line breaks
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split on question numbers like "1.", "Q1.", "Question 1:", "1)", "1 -", "Q.1"
  const qBlocks = clean.split(/(?:^|\n)\s*(?:Q(?:uestion)?[\s\.\:\-]*)?(\d+)[\.\:\)\-]\s+/i);

  for (let i = 1; i < qBlocks.length; i += 2) {
    const block = qBlocks[i + 1];
    if (!block) continue;

    // Match options A, B, C, D in formats like A) / (A) / A. / a) / (a) / a.
    const optRegex =
      /(?:^|\n|\s)\(?[A-a]\)?[.\:\)\]]\s+([\s\S]*?)(?:^|\n|\s)\(?[B-b]\)?[.\:\)\]]\s+([\s\S]*?)(?:^|\n|\s)\(?[C-c]\)?[.\:\)\]]\s+([\s\S]*?)(?:^|\n|\s)\(?[D-d]\)?[.\:\)\]]\s+([\s\S]*?)(?=(?:^|\n)\s*(?:Ans(?:wer)?|Correct(?:\s*Option)?|Key|\d+[\.\:\)\-]|$))/i;
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
        correctIdx = ({ A: 0, B: 1, C: 2, D: 3 } as any)[letter] ?? 0;

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

// Pure Web-standard PDF text extractor
export async function extractTextFromPdfArrayBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  let fullText = '';
  const uint8 = new Uint8Array(arrayBuffer);

  // Convert binary to string safely
  let binaryStr = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    const sub = uint8.subarray(i, i + chunkSize);
    for (let j = 0; j < sub.length; j++) {
      binaryStr += String.fromCharCode(sub[j]);
    }
  }

  // Find all stream ... endstream blocks
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;

  while ((match = streamRegex.exec(binaryStr)) !== null) {
    const streamContent = match[1];
    const streamBytes = new Uint8Array(streamContent.length);
    for (let j = 0; j < streamContent.length; j++) {
      streamBytes[j] = streamContent.charCodeAt(j);
    }

    let textChunk = '';

    // Decompress with native Web DecompressionStream
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('deflate');
        const writer = ds.writable.getWriter();
        writer.write(streamBytes);
        writer.close();

        const reader = ds.readable.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }

        // Combine chunks
        let totalLen = 0;
        for (const c of chunks) totalLen += c.length;
        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }

        for (let k = 0; k < merged.length; k += chunkSize) {
          const sub = merged.subarray(k, k + chunkSize);
          for (let m = 0; m < sub.length; m++) {
            textChunk += String.fromCharCode(sub[m]);
          }
        }
      } catch {
        textChunk = streamContent;
      }
    } else {
      textChunk = streamContent;
    }

    if (textChunk) {
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

  // 4. Fallback if streams didn't yield text: direct parenthesized strings
  if (!fullText.trim()) {
    const rawMatches = binaryStr.match(/\(([^()]{2,})\)/g);
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
