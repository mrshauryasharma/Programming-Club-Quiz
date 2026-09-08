// Comprehensive Functional, Security, Multi-User, and Export Test Suite
const BASE_URL = 'http://localhost:3000';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('PROGRAMMING CLUB QUIZ — AUTOMATED VERIFICATION SUITE');
  console.log('====================================================\n');

  // TEST 1: QUIZ CREATION & TIMER VALIDATION
  console.log('TEST 1: Quiz Creation & Timer Validation');
  // Attempt invalid timer (> 120 seconds)
  const invalidQuizRes = await fetch(`${BASE_URL}/api/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Invalid Quiz',
      questions: [
        {
          question_text: 'Test?',
          options: ['A', 'B', 'C', 'D'],
          correct_option_index: 0,
          timer_seconds: 150, // Invalid > 120s
        },
      ],
    }),
  });
  assert(!invalidQuizRes.ok, 'Rejects quiz with timer > 120 seconds (status: ' + invalidQuizRes.status + ')');

  // Create valid quiz
  const validQuizRes = await fetch(`${BASE_URL}/api/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Automated Test Core Quiz',
      description: 'Test session quiz',
      questions: [
        {
          question_text: 'What is the output of 2 + 2 in JavaScript?',
          options: ['3', '4', '22', 'Error'],
          correct_option_index: 1, // '4'
          timer_seconds: 20,
        },
        {
          question_text: 'Which data structure follows FIFO?',
          options: ['Stack', 'Queue', 'Tree', 'Graph'],
          correct_option_index: 1, // 'Queue'
          timer_seconds: 20,
        },
      ],
    }),
  });
  assert(validQuizRes.ok, 'Successfully created valid quiz with MCQ options and timer <= 120s');
  const { quiz } = await validQuizRes.json();
  const quizId = quiz.id;

  // TEST 2: SESSION CREATION & DYNAMIC GAME CODE GENERATION
  console.log('\nTEST 2: Session Creation & Dynamic Game Code Generation');
  const sessionRes = await fetch(`${BASE_URL}/api/sessions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quiz_id: quizId }),
  });
  assert(sessionRes.ok, 'Successfully created live session 1');
  const { session } = await sessionRes.json();
  const gameCode = session.game_code;
  assert(gameCode && gameCode.length === 6, `Generated valid 6-char Game Code: ${gameCode}`);

  // Test that starting the same quiz AGAIN generates a DIFFERENT Game Code
  const sessionRes2 = await fetch(`${BASE_URL}/api/sessions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quiz_id: quizId }),
  });
  assert(sessionRes2.ok, 'Successfully created live session 2 for the same quiz');
  const session2 = (await sessionRes2.json()).session;
  assert(session2.game_code && session2.game_code.length === 6, `Generated valid 6-char Game Code for session 2: ${session2.game_code}`);
  assert(session2.game_code !== gameCode, `Same quiz started again generates a DIFFERENT Game Code (${gameCode} vs ${session2.game_code})`);

  // TEST 2.5: STEP 1 CODE VALIDATION ENDPOINT
  console.log('\nTEST 2.5: Step 1 Code Validation Endpoint');
  const invalidCodeRes = await fetch(`${BASE_URL}/api/sessions/BADCOD/validate`);
  assert(!invalidCodeRes.ok && invalidCodeRes.status === 404, 'Step 1: Rejects invalid game code on /validate');
  const validCodeRes = await fetch(`${BASE_URL}/api/sessions/${gameCode}/validate`);
  assert(validCodeRes.ok, 'Step 1: Successfully validates existing game code on /validate');

  // Verify that an ENDED session cannot be joined
  await fetch(`${BASE_URL}/api/sessions/${session2.game_code}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'FINAL_RESULTS' }),
  });
  const endedValidateRes = await fetch(`${BASE_URL}/api/sessions/${session2.game_code}/validate`);
  assert(!endedValidateRes.ok && endedValidateRes.status === 400, 'Rejects joining a completed/ended quiz session on /validate');

  const endedJoinRes = await fetch(`${BASE_URL}/api/sessions/${session2.game_code}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Late Student',
      roll_no: '23CS999',
      year: '1st Year',
      department: 'School of ICT',
      email: 'late@gbu.ac.in',
    }),
  });
  assert(!endedJoinRes.ok && endedJoinRes.status === 400, 'Rejects joining a completed/ended quiz session on /join');

  // TEST 3: MULTI-USER JOIN & PARTICIPANT VALIDATION (FLOW STEPS 2-4)
  console.log('\nTEST 3: Multi-User Join & Validation (Steps 2-4: Year, Department, Info)');
  // Attempt invalid join (missing roll number)
  const invalidJoinRes = await fetch(`${BASE_URL}/api/sessions/${gameCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rahul Kumar',
      roll_no: '',
      year: '2nd Year',
      department: 'School of ICT',
      email: 'rahul@gbu.ac.in',
    }),
  });
  assert(!invalidJoinRes.ok, 'Rejects join with missing Roll Number');

  // Attempt invalid join (missing year)
  const invalidYearRes = await fetch(`${BASE_URL}/api/sessions/${gameCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rahul Kumar',
      roll_no: '23CS101',
      department: 'School of ICT',
      email: 'rahul@gbu.ac.in',
    }),
  });
  assert(!invalidYearRes.ok, 'Rejects join with missing Year');

  // Attempt invalid join (invalid year option)
  const badYearRes = await fetch(`${BASE_URL}/api/sessions/${gameCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rahul Kumar',
      roll_no: '23CS101',
      year: '7th Year',
      department: 'School of ICT',
      email: 'rahul@gbu.ac.in',
    }),
  });
  assert(!badYearRes.ok, 'Rejects join with invalid Year option (must be 1st-5th Year)');

  // Attempt invalid join ('Other' department without custom_department text)
  const missingCustomDeptRes = await fetch(`${BASE_URL}/api/sessions/${gameCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rahul Kumar',
      roll_no: '23CS101',
      year: '2nd Year',
      department: 'Other',
      email: 'rahul@gbu.ac.in',
    }),
  });
  assert(!missingCustomDeptRes.ok, 'Rejects join when Department is "Other" but custom department name is blank');

  // Join Student 1: Rahul (2nd Year, CSE)
  const join1 = await (
    await fetch(`${BASE_URL}/api/sessions/${gameCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rahul Kumar',
        roll_no: '23CS101',
        year: '2nd Year',
        department: 'Department of Computer Science',
        email: 'rahul@gbu.ac.in',
      }),
    })
  ).json();
  const rahul = join1.participant;
  assert(rahul && rahul.id && rahul.year === '2nd Year', `Student 1 (Rahul - 2nd Year) joined session`);

  // Join Student 2: Priya (3rd Year, IT)
  const join2 = await (
    await fetch(`${BASE_URL}/api/sessions/${gameCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Priya Singh',
        roll_no: '23IT102',
        year: '3rd Year',
        department: 'Department of Information Technology',
        email: 'priya@gbu.ac.in',
      }),
    })
  ).json();
  const priya = join2.participant;
  assert(priya && priya.id && priya.year === '3rd Year', `Student 2 (Priya - 3rd Year) joined session`);

  // Join Student 3: Amit (1st Year, Other with custom department)
  const join3 = await (
    await fetch(`${BASE_URL}/api/sessions/${gameCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Amit Verma',
        roll_no: '23EC103',
        year: '1st Year',
        department: 'Other',
        custom_department: 'Robotics and Automation',
        email: 'amit@gbu.ac.in',
      }),
    })
  ).json();
  const amit = join3.participant;
  assert(amit && amit.id && amit.year === '1st Year' && amit.custom_department === 'Robotics and Automation', `Student 3 (Amit - 1st Year, Custom Dept) joined session`);

  // Verify waiting state
  const stateLobby = await (await fetch(`${BASE_URL}/api/sessions/${gameCode}/state`)).json();
  assert(stateLobby.participant_count === 3, 'Lobby accurately records 3 participants in waiting room');
  assert(stateLobby.session.current_state === 'WAITING', 'Session is in WAITING state');

  // TEST 4: QUESTION 1 START & SCORING (+2 / 0, Strict Timer, Tie-Breaker)
  console.log('\nTEST 4: Question 1 Activation & Authoritative Scoring');
  await fetch(`${BASE_URL}/api/sessions/${gameCode}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'START_QUESTION' }),
  });

  const stateQ1 = await (await fetch(`${BASE_URL}/api/sessions/${gameCode}/state`)).json();
  assert(stateQ1.session.current_state === 'QUESTION_ACTIVE', 'State transitioned to QUESTION_ACTIVE');
  const q1Id = stateQ1.activeQuestion.id;
  assert(stateQ1.activeQuestion.correct_option_index === undefined, 'Server sanitized correct_option_index from client response');

  // Rahul answers Correctly (option 1: '4')
  const ansRahul = await (
    await fetch(`${BASE_URL}/api/sessions/${gameCode}/submit-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: rahul.id,
        question_id: q1Id,
        selected_option: 1,
      }),
    })
  ).json();
  assert(ansRahul.is_correct === true && ansRahul.points === 2, 'Rahul correct answer yields strictly +2 points');
  assert(ansRahul.response_time_ms >= 0, `Recorded valid response time: ${ansRahul.response_time_ms}ms`);

  // Priya answers Correctly (option 1: '4')
  await new Promise(r => setTimeout(r, 100)); // Small delay for timing differentiation
  const ansPriya = await (
    await fetch(`${BASE_URL}/api/sessions/${gameCode}/submit-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: priya.id,
        question_id: q1Id,
        selected_option: 1,
      }),
    })
  ).json();
  assert(ansPriya.is_correct === true && ansPriya.points === 2, 'Priya correct answer yields strictly +2 points');
  assert(ansPriya.response_time_ms > ansRahul.response_time_ms, 'Priya response time is later than Rahul for tie-break testing');

  // TEST 5: ANTI-CHEAT STRIKE SYSTEM (Warning 1, 2, and Removal on 3)
  console.log('\nTEST 5: Anti-Cheat Violation & Immediate Removal');
  // Amit violation 1
  const v1 = await (
    await fetch(`${BASE_URL}/api/sessions/${gameCode}/violation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: amit.id, violation_type: 'tab_switched' }),
    })
  ).json();
  assert(v1.warning_count === 1 && v1.is_removed === false, 'Violation 1 -> Warning 1 (Participant remains)');

  // Amit violation 2
  const v2 = await (
    await fetch(`${BASE_URL}/api/sessions/${gameCode}/violation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: amit.id, violation_type: 'window_blur' }),
    })
  ).json();
  assert(v2.warning_count === 2 && v2.is_removed === false, 'Violation 2 -> Warning 2 (Participant remains)');

  // Amit violation 3 -> Immediate Removal
  const v3 = await (
    await fetch(`${BASE_URL}/api/sessions/${gameCode}/violation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: amit.id, violation_type: 'tab_switched' }),
    })
  ).json();
  assert(v3.warning_count === 3 && v3.is_removed === true && v3.status === 'removed', 'Violation 3 -> Warning 3 + IMMEDIATE REMOVAL');

  // Removed participant attempt to submit answer should be rejected
  const removedSubmit = await fetch(`${BASE_URL}/api/sessions/${gameCode}/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: amit.id,
      question_id: q1Id,
      selected_option: 1,
    }),
  });
  assert(!removedSubmit.ok, 'Removed participant answer submission is rejected by server');

  // Reconnection check: restore endpoint preserves status and warnings without cheating penalties
  const restoreAmit = await (
    await fetch(`${BASE_URL}/api/sessions/${gameCode}/restore?participant_id=${amit.id}`)
  ).json();
  assert(restoreAmit.participant.warning_count === 3 && restoreAmit.participant.status === 'removed', 'Reconnection preserves warning count & removal state');

  // TEST 6: END QUESTION 1 & QUESTION RESULT
  console.log('\nTEST 6: Question 1 Ended & Result Summary');
  await fetch(`${BASE_URL}/api/sessions/${gameCode}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'END_QUESTION' }),
  });

  const stateQ1End = await (await fetch(`${BASE_URL}/api/sessions/${gameCode}/state`)).json();
  assert(stateQ1End.session.current_state === 'QUESTION_ENDED', 'Session is in QUESTION_ENDED state');
  assert(stateQ1End.activeQuestion.correct_option_index === 1, 'Correct option index revealed upon question conclusion');
  assert(stateQ1End.questionSummary.correct_count === 2, 'Accurate correct count recorded (2 answers)');

  // TEST 7: QUESTION 2 & TIE-BREAKING LEADERBOARD
  console.log('\nTEST 7: Question 2, Score Computation & Tie-Breaker');
  await fetch(`${BASE_URL}/api/sessions/${gameCode}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'NEXT_QUESTION' }),
  });

  const stateQ2 = await (await fetch(`${BASE_URL}/api/sessions/${gameCode}/state`)).json();
  assert(stateQ2.session.current_state === 'QUESTION_ACTIVE', 'State transitioned to Question 2 QUESTION_ACTIVE');
  const q2Id = stateQ2.activeQuestion.id;

  // Rahul answers Wrongly (option 0: 'Stack') -> 0 pts
  const ansRahulQ2 = await (
    await fetch(`${BASE_URL}/api/sessions/${gameCode}/submit-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: rahul.id,
        question_id: q2Id,
        selected_option: 0,
      }),
    })
  ).json();
  assert(ansRahulQ2.is_correct === false && ansRahulQ2.points === 0, 'Wrong answer yields strictly 0 points');
  assert(ansRahulQ2.total_score === 2, 'Rahul total score is 2 points');

  // Priya answers Correctly (option 1: 'Queue') -> +2 pts -> total 4 pts
  const ansPriyaQ2 = await (
    await fetch(`${BASE_URL}/api/sessions/${gameCode}/submit-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: priya.id,
        question_id: q2Id,
        selected_option: 1,
      }),
    })
  ).json();
  assert(ansPriyaQ2.is_correct === true && ansPriyaQ2.points === 2, 'Priya correct answer yields +2 points');
  assert(ansPriyaQ2.total_score === 4, 'Priya total score is 4 points');

  // End Question 2 and Show Leaderboard
  await fetch(`${BASE_URL}/api/sessions/${gameCode}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'SHOW_LEADERBOARD' }),
  });

  const stateLB = await (await fetch(`${BASE_URL}/api/sessions/${gameCode}/state`)).json();
  const lb = stateLB.leaderboard;
  assert(lb[0].name === 'Priya Singh' && lb[0].total_score === 4 && lb[0].rank === 1, 'Priya is Rank #1 with 4 points');
  assert(lb[1].name === 'Rahul Kumar' && lb[1].total_score === 2 && lb[1].rank === 2, 'Rahul is Rank #2 with 2 points');

  // Transition to FINAL_RESULTS
  await fetch(`${BASE_URL}/api/sessions/${gameCode}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'FINAL_RESULTS' }),
  });
  const stateFinal = await (await fetch(`${BASE_URL}/api/sessions/${gameCode}/state`)).json();
  assert(stateFinal.session.current_state === 'FINAL_RESULTS', 'Session reached FINAL_RESULTS');

  // TEST 8: VERIFIABLE EXPORT ENGINE (CSV, Excel, PDF)
  console.log('\nTEST 8: Export Verification (CSV, Excel, PDF)');
  // 1. CSV
  const csvRes = await fetch(`${BASE_URL}/api/sessions/${gameCode}/export/csv`);
  assert(csvRes.ok, 'CSV export endpoint returned HTTP 200');
  const csvText = await csvRes.text();
  assert(csvText.includes('Rank,Name,Roll Number,Year,Department,Email,Score'), 'CSV contains correct header row including Year');
  assert(csvText.includes('Priya Singh') && csvText.includes('3rd Year') && csvText.includes('4 / 4'), 'CSV contains Priya Singh with 3rd Year and score 4 / 4');
  assert(csvText.includes('Rahul Kumar') && csvText.includes('2nd Year') && csvText.includes('2 / 4'), 'CSV contains Rahul Kumar with 2nd Year and score 2 / 4');
  assert(csvText.includes('Amit Verma') && csvText.includes('REMOVED'), 'CSV records Amit Verma as REMOVED');

  // 2. Excel (.xlsx)
  const xlsxRes = await fetch(`${BASE_URL}/api/sessions/${gameCode}/export/excel`);
  assert(xlsxRes.ok, 'Excel export endpoint returned HTTP 200');
  const xlsxBuf = await xlsxRes.arrayBuffer();
  assert(xlsxBuf.byteLength > 1000, `Excel file generated with non-empty payload (${xlsxBuf.byteLength} bytes)`);

  // 3. PDF
  const pdfRes = await fetch(`${BASE_URL}/api/sessions/${gameCode}/export/pdf`);
  assert(pdfRes.ok, 'PDF export endpoint returned HTTP 200');
  const pdfBuf = await pdfRes.arrayBuffer();
  const pdfHeader = Buffer.from(pdfBuf.slice(0, 5)).toString();
  assert(pdfHeader === '%PDF-', `PDF export generates authentic PDF document (${pdfBuf.byteLength} bytes)`);

  // TEST 9: ANALYTICS VERIFICATION
  console.log('\nTEST 9: Analytics Verification');
  const analyticsRes = await fetch(`${BASE_URL}/api/sessions/${gameCode}/analytics`);
  assert(analyticsRes.ok, 'Analytics endpoint returned HTTP 200');
  const { analytics } = await analyticsRes.json();
  assert(analytics.totalParticipants === 3, 'Analytics tracks 3 total participants');
  assert(analytics.questionSummaries.length === 2, 'Analytics includes question-wise breakdown for all questions');

  console.log('\n====================================================');
  console.log('🎉 ALL AUTOMATED TESTS PASSED WITH 100% SUCCESS!');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
