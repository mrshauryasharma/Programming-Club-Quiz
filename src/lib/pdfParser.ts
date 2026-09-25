import { extractText } from 'unpdf';

export interface ExtractedMCQ {
  question_text: string;
  options: string[];
  correct_option_index: number;
  timer_seconds: number;
}

/**
 * Universal multi-format MCQ text parser
 * Accepts almost ANY document format:
 * - Markdown bolded (**1. Question?**, **Answer: C**)
 * - Standard numbered (1., 2., Q1., Question 1:, 1), 1 -)
 * - Diverse option delimiters (A., A), (A), [A], A:, A -, a., a), 1), (1))
 * - Answers inline (Answer: C, Ans: C, Correct Option: C, Key: C)
 * - Separate Answer Key sections at the bottom of the document
 * - Questions with or without explicit answers (defaults to Option A with full UI editability)
 */
export function parseMCQsFromText(rawText: string): ExtractedMCQ[] {
  if (!rawText || !rawText.trim()) return [];

  // 1. Normalize line breaks and unicode whitespace
  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[—–]/g, '-');

  // 2. Check for separate Answer Key table/list at the bottom
  // e.g. "Answer Key: 1. C 2. A 3. B" or "Answers: 1-C, 2-A"
  const answerKeyMap = new Map<number, number>();
  const keySectionMatch = normalized.match(/(?:Answer\s*Key|Answers|Solution\s*Key)[\s\:\-]+([\s\S]*)$/i);
  if (keySectionMatch) {
    const keyContent = keySectionMatch[1];
    const keyPairs = keyContent.matchAll(/(\d+)[\.\:\)\-\s]+[\(\[]?([A-Ea-e1-4])[\)\]]?/g);
    for (const kp of keyPairs) {
      const qN = parseInt(kp[1], 10);
      const val = kp[2].toUpperCase();
      let idx = 0;
      if (val >= 'A' && val <= 'E') {
        idx = val.charCodeAt(0) - 65;
      } else if (val >= '1' && val <= '4') {
        idx = parseInt(val, 10) - 1;
      }
      answerKeyMap.set(qN, idx);
    }
  }

  // 3. Clean markdown headers and formatting markers
  const cleaned = normalized
    .replace(/^#+\s+/gm, '') // Strip markdown # headers
    .replace(/\*\*|__/g, '') // Strip markdown bold ** and __
    .replace(/(^|\s)\*([^\*]+)\*(\s|$)/g, '$1$2$3'); // Strip markdown italics *

  // 4. Split by Question markers
  // Matches: "1.", "1)", "1 -", "Q1.", "Q 1.", "Question 1:", "Problem 1 -", etc.
  const qSplitRegex = /(?:^|\n)\s*(?:(?:Question|Q|Problem)[\s\.\:\-]*\s*|(?=\d+\s*[\.\:\)\-\]]))(\d+)(?:\s*[\.\:\)\-\]])?\s+/i;
  const parts = cleaned.split(qSplitRegex);

  const questions: ExtractedMCQ[] = [];

  // parts layout: [preamble, qNum1, block1, qNum2, block2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const qNum = parseInt(parts[i], 10);
    const block = parts[i + 1];
    if (!block || !block.trim()) continue;

    // Inside block, find options A, B, C, D (and optionally E, or 1, 2, 3, 4)
    // Matches: A., A), (A), [A], A -, A:, a., a), (a), [a], a -
    const optionMatches: { letter: string; index: number; endIndex: number }[] = [];
    const optRegex = /(?:^|\n|\s{2,}|\t)\(?([A-Ea-e])\)?\s*[\.\:\)\-\]]\s+/g;
    let match: RegExpExecArray | null;

    while ((match = optRegex.exec(block)) !== null) {
      optionMatches.push({
        letter: match[1].toUpperCase(),
        index: match.index,
        endIndex: optRegex.lastIndex,
      });
    }

    // If letter options weren't found, try numeric options: 1), 2), 3), 4) or (1), (2), (3), (4)
    if (optionMatches.length < 2) {
      const numOptRegex = /(?:^|\n|\s{2,}|\t)(?:\(([1-4])\)|([1-4])[\.\)\-\]])\s+/g;
      let numMatch: RegExpExecArray | null;
      while ((numMatch = numOptRegex.exec(block)) !== null) {
        const numVal = parseInt(numMatch[1] || numMatch[2], 10);
        const letterEquivalent = String.fromCharCode(64 + numVal); // 1 -> A, 2 -> B...
        optionMatches.push({
          letter: letterEquivalent,
          index: numMatch.index,
          endIndex: numOptRegex.lastIndex,
        });
      }
    }

    // If options still not found via inline regex, try line-by-line fallback
    if (optionMatches.length < 2) {
      const lines = block.split('\n');
      const lineOpts: { letter: string; text: string }[] = [];
      let firstOptLineIdx = -1;

      for (let l = 0; l < lines.length; l++) {
        const line = lines[l].trim();
        const m = line.match(/^[\(\[]?([A-Ea-e1-4])[\)\]\.\:\-]\s*(.*)$/);
        if (m) {
          if (firstOptLineIdx === -1) firstOptLineIdx = l;
          let letChar = m[1].toUpperCase();
          if (letChar >= '1' && letChar <= '4') {
            letChar = String.fromCharCode(64 + parseInt(letChar, 10));
          }
          lineOpts.push({ letter: letChar, text: m[2].trim() });
        } else if (lineOpts.length > 0 && line.length > 0 && !line.match(/^(?:Ans(?:wer)?|Key|Solution)/i)) {
          // Continuation line of multi-line pattern/text
          const prev = lineOpts[lineOpts.length - 1];
          prev.text = prev.text ? prev.text + '\n' + line : line;
        }
      }

      if (lineOpts.length >= 2 && firstOptLineIdx > 0) {
        const questionText = lines.slice(0, firstOptLineIdx).join('\n').trim();
        const options = lineOpts.map(o => o.text);

        let correctIdx = 0;
        const ansMatch = block.match(/(?:Ans(?:wer)?|Correct(?:\s*Option)?|Key)[\s\:\-\=]+[\(\[]?([A-Ea-e1-4])[\)\]]?/i);
        if (ansMatch) {
          const char = ansMatch[1].toUpperCase();
          correctIdx = char >= 'A' && char <= 'E' ? char.charCodeAt(0) - 65 : parseInt(char, 10) - 1;
        } else if (answerKeyMap.has(qNum)) {
          correctIdx = answerKeyMap.get(qNum) ?? 0;
        }

        while (options.length < 4) {
          options.push(`Option ${String.fromCharCode(65 + options.length)}`);
        }

        if (questionText) {
          questions.push({
            question_text: questionText,
            options: options.slice(0, 4),
            correct_option_index: Math.max(0, Math.min(3, correctIdx)),
            timer_seconds: 30,
          });
        }
      }
      continue;
    }

    // Extract question text before first option
    const questionText = block.slice(0, optionMatches[0].index).replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!questionText) continue;

    // Extract options from between delimiters
    const rawOptions: string[] = [];
    for (let j = 0; j < optionMatches.length; j++) {
      const start = optionMatches[j].endIndex;
      const end = j + 1 < optionMatches.length ? optionMatches[j + 1].index : block.length;
      let optText = block.slice(start, end).trim();

      // If last option, strip answer line if embedded inside it
      if (j === optionMatches.length - 1) {
        const ansInline = optText.search(/(?:^|\n|\s{2,})(?:Ans(?:wer)?|Correct(?:\s*Option)?|Key)[\s\:\-\=]/i);
        if (ansInline !== -1) {
          optText = optText.slice(0, ansInline).trim();
        }
      }

      optText = optText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      rawOptions.push(optText);
    }

    // Determine correct option
    let correctIdx = 0;
    const ansMatch = block.match(/(?:Ans(?:wer)?|Correct(?:\s*Option)?|Key)[\s\:\-\=]+[\(\[]?([A-Ea-e1-4])[\)\]]?/i);
    if (ansMatch) {
      const char = ansMatch[1].toUpperCase();
      correctIdx = char >= 'A' && char <= 'E' ? char.charCodeAt(0) - 65 : parseInt(char, 10) - 1;
    } else if (answerKeyMap.has(qNum)) {
      correctIdx = answerKeyMap.get(qNum) ?? 0;
    }

    // Pad options to 4 if only 2 or 3 provided
    const finalOptions = [...rawOptions];
    while (finalOptions.length < 4) {
      finalOptions.push(`Option ${String.fromCharCode(65 + finalOptions.length)}`);
    }

    questions.push({
      question_text: questionText,
      options: finalOptions.slice(0, 4),
      correct_option_index: Math.max(0, Math.min(3, correctIdx)),
      timer_seconds: 30,
    });
  }

  return questions;
}

/**
 * Pure Web-standard PDF text extractor
 * Uses unpdf (built on Mozilla PDF.js, 100% universal across browsers, node, workers, and edge)
 */
export async function extractTextFromPdfArrayBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const { text } = await extractText(new Uint8Array(arrayBuffer));
    const fullText = Array.isArray(text) ? text.join('\n\n') : (text || '');
    if (fullText.trim()) return fullText.trim();
  } catch (err) {
    console.warn('unpdf extraction failed, attempting stream fallback:', err);
  }

  // Fallback stream extractor for raw uncompressed or standard ASCII streams
  try {
    const uint8 = new Uint8Array(arrayBuffer);
    let binaryStr = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      const sub = uint8.subarray(i, i + chunkSize);
      for (let j = 0; j < sub.length; j++) {
        binaryStr += String.fromCharCode(sub[j]);
      }
    }

    let fallbackText = '';
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(binaryStr)) !== null) {
      const textChunk = match[1];
      const tjArrayRegex = /\[((?:\(.*?\)|[^\]])+)\]\s*TJ/g;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjArrayRegex.exec(textChunk)) !== null) {
        const parts = tjMatch[1].match(/\((.*?)\)/g);
        if (parts) {
          fallbackText += parts.map(p => p.slice(1, -1)).join('') + ' ';
        }
      }

      const tjSimpleRegex = /\((.*?)\)\s*Tj/g;
      let simpleMatch: RegExpExecArray | null;
      while ((simpleMatch = tjSimpleRegex.exec(textChunk)) !== null) {
        fallbackText += simpleMatch[1] + '\n';
      }
    }

    if (!fallbackText.trim()) {
      const rawMatches = binaryStr.match(/\(([^()]{2,})\)/g);
      if (rawMatches) {
        fallbackText = rawMatches.map(m => m.slice(1, -1)).join(' ');
      }
    }

    return fallbackText
      .replace(/\\([()\\])/g, '$1')
      .replace(/\\r/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, ' ')
      .trim();
  } catch {
    return '';
  }
}
