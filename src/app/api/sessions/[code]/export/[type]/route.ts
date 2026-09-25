import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function GET(req: NextRequest, context: { params: Promise<{ code: string; type: string }> }) {
  try {
    const { code, type } = await context.params;
    let session = await db.getSessionByCode(code);
    if (!session) {
      session = await db.getSessionById(code);
    }
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const quiz = await db.getQuizById(session.quiz_id);
    const leaderboard = await db.getLeaderboard(session.id);
    const totalQuestions = quiz?.questions?.length || 0;
    const maxScore = totalQuestions * 2;

    const dataRows = leaderboard.map(p => {
      const correctCount = Math.floor(p.total_score / 2);
      const incorrectCount = Math.max(0, totalQuestions - correctCount);
      const totalTimeSec = (p.total_response_time_ms / 1000).toFixed(2);
      const avgTimeSec = correctCount > 0 ? (p.total_response_time_ms / correctCount / 1000).toFixed(2) : '0.00';

      return {
        Rank: p.rank || 0,
        Name: p.name,
        'Roll Number': p.roll_no,
        Year: p.year || 'N/A',
        Department: p.department,
        Email: p.email,
        Score: `${p.total_score} / ${maxScore}`,
        'Correct Answers': correctCount,
        'Incorrect / Missed': incorrectCount,
        'Total Response Time (s)': totalTimeSec,
        'Average Time / Correct (s)': avgTimeSec,
        Status: p.status.toUpperCase(),
        'Audit Resolution': p.resolved_by || (p.status === 'flagged' ? 'FLAGGED FOR REVIEW' : 'Normal'),
        Warnings: p.warning_count,
        'Student Appeal Note': p.appeal_note || 'None',
      };
    });

    const exportType = type.toLowerCase();

    // 1. CSV EXPORT
    if (exportType === 'csv') {
      const headers = [
        'Rank',
        'Name',
        'Roll Number',
        'Year',
        'Department',
        'Email',
        'Score',
        'Correct Answers',
        'Incorrect / Missed',
        'Total Response Time (s)',
        'Average Time / Correct (s)',
        'Status',
        'Audit Resolution',
        'Warnings',
        'Student Appeal Note',
      ];

      const csvLines = [headers.join(',')];
      dataRows.forEach(row => {
        const line = [
          row.Rank,
          `"${row.Name.replace(/"/g, '""')}"`,
          `"${row['Roll Number'].replace(/"/g, '""')}"`,
          `"${row.Year.replace(/"/g, '""')}"`,
          `"${row.Department.replace(/"/g, '""')}"`,
          `"${row.Email.replace(/"/g, '""')}"`,
          `"${row.Score}"`,
          row['Correct Answers'],
          row['Incorrect / Missed'],
          row['Total Response Time (s)'],
          row['Average Time / Correct (s)'],
          row.Status,
          `"${(row['Audit Resolution'] || '').replace(/"/g, '""')}"`,
          row.Warnings,
          `"${(row['Student Appeal Note'] || '').replace(/"/g, '""')}"`,
        ].join(',');
        csvLines.push(line);
      });

      const csvContent = csvLines.join('\r\n');
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="programming-club-quiz-${session.game_code}.csv"`,
        },
      });
    }

    // 2. EXCEL (.xlsx) EXPORT
    if (exportType === 'excel' || exportType === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(dataRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leaderboard Results');

      const metaData = [
        { Parameter: 'Quiz Title', Value: quiz?.title || 'Programming Club Quiz' },
        { Parameter: 'Game Code', Value: session.game_code },
        { Parameter: 'Total Questions', Value: totalQuestions },
        { Parameter: 'Max Possible Score', Value: maxScore },
        { Parameter: 'Participants Count', Value: leaderboard.length },
        { Parameter: 'Export Date', Value: new Date().toLocaleString() },
      ];
      const metaSheet = XLSX.utils.json_to_sheet(metaData);
      XLSX.utils.book_append_sheet(workbook, metaSheet, 'Session Details');

      const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return new Response(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="programming-club-quiz-${session.game_code}.xlsx"`,
        },
      });
    }

    // 3. PDF EXPORT
    if (exportType === 'pdf') {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

      // Document Header
      doc.setFillColor(3, 18, 70); // Deep Navy (#031246)
      doc.rect(0, 0, 842, 60, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('USICT GBU PROGRAMMING CLUB — QUIZ RESULTS', 40, 36);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('LEARN • CONNECT • EXPLORE • GROW', 620, 36);

      // Quiz Metadata Box
      doc.setTextColor(3, 18, 70);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`Quiz: ${quiz?.title || 'Live Quiz'}`, 40, 85);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Game Code: ${session.game_code}   |   Date: ${new Date(session.created_at).toLocaleDateString()}   |   Total Participants: ${leaderboard.length}   |   Max Score: ${maxScore} pts`,
        40,
        102
      );

      const tableHead = [
        ['Rank', 'Name', 'Roll No', 'Year', 'Department', 'Email', 'Score', 'Time (s)', 'Status', 'Audit / Appeal'],
      ];

      const tableBody = dataRows.map(r => [
        `#${r.Rank}`,
        r.Name,
        r['Roll Number'],
        r.Year,
        r.Department,
        r.Email,
        r.Score,
        r['Total Response Time (s)'],
        r.Status,
        r['Student Appeal Note'] !== 'None' ? `${r['Audit Resolution']} (${r['Student Appeal Note']})` : r['Audit Resolution'],
      ]);

      autoTable(doc, {
        startY: 115,
        head: tableHead,
        body: tableBody,
        theme: 'striped',
        headStyles: {
          fillColor: [127, 27, 176], // Purple (#7F1BB0)
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 8,
          cellPadding: 6,
        },
        alternateRowStyles: {
          fillColor: [247, 244, 254], // Light Background (#F7F4FE)
        },
      });

      const pdfOutput = doc.output('arraybuffer');

      return new Response(pdfOutput, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="programming-club-quiz-${session.game_code}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: 'Unsupported export type. Use csv, excel, or pdf.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to generate export file' }, { status: 500 });
  }
}
