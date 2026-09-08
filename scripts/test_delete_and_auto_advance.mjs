// Test Suite: Individual Event Deletion + Automatic Question Advance When Timer Ends
const BASE_URL = 'http://localhost:3000';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('================================================================');
  console.log('PROGRAMMING CLUB QUIZ — EVENT DELETION & AUTO-ADVANCE TEST');
  console.log('================================================================\n');

  // ============================================================================
  // PART 1: EVENT DELETION WITH MULTI-EVENT ISOLATION
  // ============================================================================
  console.log('>>> PART 1: Testing Individual Event Deletion Isolation <<<');

  // Step 1: Create a shared quiz template
  const quizRes = await fetch(`${BASE_URL}/api/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Deletion & Auto-Advance Validation Quiz',
      description: 'Quiz template to verify event deletion isolation and automatic timer advance',
      questions: [
        {
          question_text: 'Question 1: What is 1 + 1 in binary?',
          options: ['10', '11', '01', '00'],
          correct_option_index: 0,
          timer_seconds: 10,
        },
        {
          question_text: 'Question 2: Which layer of OSI model is IP protocol in?',
          options: ['Network', 'Transport', 'Data Link', 'Physical'],
          correct_option_index: 0,
          timer_seconds: 10,
        },
      ],
    }),
  });
  assert(quizRes.ok, 'Created shared quiz template');
  const quizData = await quizRes.json();
  const quizId = quizData.quiz.id;
  assert(Boolean(quizId), `Quiz ID: ${quizId}`);

  // Step 2: Host Event 1
  const e1Res = await fetch(`${BASE_URL}/api/sessions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quiz_id: quizId }),
  });
  const event1 = (await e1Res.json()).session;
  const code1 = event1.game_code;
  const id1 = event1.id;
  assert(Boolean(code1) && Boolean(id1), `Event 1 created (Code: ${code1}, ID: ${id1})`);

  // Event 1 participant
  const join1 = await fetch(`${BASE_URL}/api/sessions/${code1}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Event 1 Participant',
      roll_no: '23DEL001',
      year: '3rd Year',
      department: 'Computer Science & Engineering',
      email: 'e1part@gbu.ac.in',
    }),
  });
  assert(join1.ok, 'Event 1 participant joined');
  const part1 = (await join1.json()).participant;

  // Complete Event 1
  await fetch(`${BASE_URL}/api/sessions/${code1}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'FINAL_RESULTS' }),
  });

  // Step 3: Host Event 2 using the SAME quiz template
  const e2Res = await fetch(`${BASE_URL}/api/sessions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quiz_id: quizId }),
  });
  const event2 = (await e2Res.json()).session;
  const code2 = event2.game_code;
  const id2 = event2.id;
  assert(Boolean(code2) && Boolean(id2), `Event 2 created (Code: ${code2}, ID: ${id2})`);
  assert(code1 !== code2, 'Event 1 and Event 2 have distinct game codes');
  assert(id1 !== id2, 'Event 1 and Event 2 have distinct session IDs');

  // Event 2 participant
  const join2 = await fetch(`${BASE_URL}/api/sessions/${code2}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Event 2 Participant (Must Survive)',
      roll_no: '24DEL002',
      year: '2nd Year',
      department: 'Information Technology',
      email: 'e2part@gbu.ac.in',
    }),
  });
  assert(join2.ok, 'Event 2 participant joined');
  const part2 = (await join2.json()).participant;

  // Complete Event 2
  await fetch(`${BASE_URL}/api/sessions/${code2}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'FINAL_RESULTS' }),
  });

  // Verify both events appear in history
  const historyBefore = await (await fetch(`${BASE_URL}/api/organizer/history`)).json();
  const listBefore = historyBefore.history;
  assert(listBefore.some((h) => h.id === id1), 'History contains Event 1');
  assert(listBefore.some((h) => h.id === id2), 'History contains Event 2');

  // Step 4: DELETE ONLY Event 1 using its Session ID
  console.log(`\nExecuting DELETE for Event 1 (ID: ${id1})...`);
  const delRes = await fetch(`${BASE_URL}/api/organizer/history/${id1}`, {
    method: 'DELETE',
  });
  assert(delRes.ok, 'DELETE /api/organizer/history/[id] returned HTTP 200');
  const delData = await delRes.json();
  assert(delData.success === true, 'Response confirmed deletion success');

  // Step 5: Verify Event 1 is completely gone
  const historyAfter = await (await fetch(`${BASE_URL}/api/organizer/history`)).json();
  const listAfter = historyAfter.history;
  assert(!listAfter.some((h) => h.id === id1), 'Event 1 is completely removed from History list');

  const getAnalytics1 = await fetch(`${BASE_URL}/api/sessions/${code1}/analytics`);
  assert(getAnalytics1.status === 404, 'Event 1 analytics returns HTTP 404');

  const getExport1 = await fetch(`${BASE_URL}/api/sessions/${code1}/export/csv`);
  assert(getExport1.status === 404, 'Event 1 CSV export returns HTTP 404');

  // Step 6: Verify Event 2 remains completely intact!
  assert(listAfter.some((h) => h.id === id2), 'Event 2 remains present in History');
  const getAnalytics2 = await fetch(`${BASE_URL}/api/sessions/${code2}/analytics`);
  assert(getAnalytics2.ok, 'Event 2 analytics remains accessible (HTTP 200)');
  const a2Data = (await getAnalytics2.json()).analytics;
  assert(a2Data.totalParticipants === 1, 'Event 2 retains 1 participant');
  assert(a2Data.leaderboard[0].name === 'Event 2 Participant (Must Survive)', 'Event 2 participant data is intact');

  const getExport2 = await fetch(`${BASE_URL}/api/sessions/${code2}/export/csv`);
  assert(getExport2.ok, 'Event 2 CSV export remains accessible');
  const csv2 = await getExport2.text();
  assert(csv2.includes('Event 2 Participant (Must Survive)'), 'Event 2 CSV contains correct participant');

  // Step 7: Verify quiz template remains completely intact
  const quizCheck = await fetch(`${BASE_URL}/api/quizzes/${quizId}`);
  assert(quizCheck.ok, 'Quiz template is completely intact (HTTP 200)');
  const qCheckData = await quizCheck.json();
  assert(qCheckData.quiz.questions.length === 2, 'Quiz questions remain untouched');
  console.log('✓ Event deletion test verified with 100% data isolation.\n');

  // ============================================================================
  // PART 2: AUTOMATIC QUESTION ADVANCE WHEN TIMER ENDS
  // ============================================================================
  console.log('>>> PART 2: Testing Automatic Question Advance When Timer Ends <<<');

  // Create a 3-question quiz with 10-second timer
  const autoQuizRes = await fetch(`${BASE_URL}/api/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Auto-Advance 3-Question Live Quiz',
      description: 'Testing automatic progression without organizer manual clicks',
      questions: [
        {
          question_text: 'Auto Q1: What does HTML stand for?',
          options: ['HyperText Markup Language', 'High Tech Modern Language', 'Home Tool Multi Language', 'None'],
          correct_option_index: 0,
          timer_seconds: 10,
        },
        {
          question_text: 'Auto Q2: What is the capital of France?',
          options: ['Paris', 'London', 'Berlin', 'Madrid'],
          correct_option_index: 0,
          timer_seconds: 10,
        },
        {
          question_text: 'Auto Q3: Which company created TypeScript?',
          options: ['Microsoft', 'Google', 'Apple', 'Meta'],
          correct_option_index: 0,
          timer_seconds: 10,
        },
      ],
    }),
  });
  assert(autoQuizRes.ok, 'Created 3-question quiz');
  const autoQuiz = (await autoQuizRes.json()).quiz;

  // Create live session for Auto-Advance
  const autoSessRes = await fetch(`${BASE_URL}/api/sessions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quiz_id: autoQuiz.id }),
  });
  const autoSession = (await autoSessRes.json()).session;
  const autoCode = autoSession.game_code;
  console.log(`Live Session created for auto-advance test: Code ${autoCode}`);

  // Join participants
  const autoJoinA = await fetch(`${BASE_URL}/api/sessions/${autoCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rohan Verma',
      roll_no: '24AUTO01',
      year: '2nd Year',
      department: 'Computer Science & Engineering',
      email: 'rohan@gbu.ac.in',
    }),
  });
  assert(autoJoinA.ok, 'Participant Rohan joined session');
  const rohan = (await autoJoinA.json()).participant;

  const autoJoinB = await fetch(`${BASE_URL}/api/sessions/${autoCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Simran Kaur',
      roll_no: '24AUTO02',
      year: '2nd Year',
      department: 'Artificial Intelligence',
      email: 'simran@gbu.ac.in',
    }),
  });
  assert(autoJoinB.ok, 'Participant Simran joined session');
  const simran = (await autoJoinB.json()).participant;

  // STEP A: START QUESTION 1
  console.log('\n--- Step A: Organizer Starts Question 1 ---');
  await fetch(`${BASE_URL}/api/sessions/${autoCode}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'START_QUESTION' }),
  });

  let stateQ1 = await (await fetch(`${BASE_URL}/api/sessions/${autoCode}/state`)).json();
  assert(stateQ1.session.current_state === 'QUESTION_ACTIVE', 'State is QUESTION_ACTIVE');
  assert(stateQ1.session.current_question_index === 0, 'Current question is Q1 (index 0)');

  // Rohan submits correct answer
  const ansQ1 = await fetch(`${BASE_URL}/api/sessions/${autoCode}/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: rohan.id,
      question_id: autoQuiz.questions[0].id,
      selected_option: 0,
    }),
  });
  assert(ansQ1.ok, 'Rohan answered Question 1 on time');

async function waitForState(code, predicate, description, timeoutMs = 22000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/sessions/${code}/state`);
      if (res.ok) {
        const data = await res.json();
        if (data.session && predicate(data.session)) {
          return data;
        }
      }
    } catch (e) {}
    await sleep(1000);
  }
  throw new Error(`Timeout (${timeoutMs}ms) waiting for: ${description}`);
}

  // STEP B: WAIT FOR Q1 TIMER EXPIRY & AUTOMATIC ADVANCE TO Q2
  console.log('\nWaiting for Question 1 timer (10s) + result processing delay (2.5s) to auto-advance to Q2...');
  const stateQ2 = await waitForState(
    autoCode,
    (s) => s.current_question_index === 1 && s.current_state === 'QUESTION_ACTIVE',
    'Question 1 automatic advance to Question 2 (index 1, QUESTION_ACTIVE)'
  );
  console.log(`Current state after Q1 expiry: ${stateQ2.session.current_state}, index: ${stateQ2.session.current_question_index}`);
  assert(stateQ2.session.current_question_index === 1, 'AUTOMATIC ADVANCE: Session moved to Question 2 (index 1) without manual click!');
  assert(stateQ2.session.current_state === 'QUESTION_ACTIVE', 'AUTOMATIC ADVANCE: Question 2 is QUESTION_ACTIVE');

  // Verify late answer to Q1 is rejected
  const lateAnsQ1 = await fetch(`${BASE_URL}/api/sessions/${autoCode}/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: simran.id,
      question_id: autoQuiz.questions[0].id,
      selected_option: 0,
    }),
  });
  assert(!lateAnsQ1.ok, 'Late submission to expired Question 1 is strictly rejected');

  // Simran submits answer to Q2
  const ansQ2 = await fetch(`${BASE_URL}/api/sessions/${autoCode}/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: simran.id,
      question_id: autoQuiz.questions[1].id,
      selected_option: 0,
    }),
  });
  assert(ansQ2.ok, 'Simran answered Question 2 on time');

  // STEP C: WAIT FOR Q2 TIMER EXPIRY & AUTOMATIC ADVANCE TO Q3
  console.log('\nWaiting for Question 2 timer (10s) + result processing delay (2.5s) to auto-advance to Q3...');
  const stateQ3 = await waitForState(
    autoCode,
    (s) => s.current_question_index === 2 && s.current_state === 'QUESTION_ACTIVE',
    'Question 2 automatic advance to Question 3 (index 2, QUESTION_ACTIVE)'
  );
  console.log(`Current state after Q2 expiry: ${stateQ3.session.current_state}, index: ${stateQ3.session.current_question_index}`);
  assert(stateQ3.session.current_question_index === 2, 'AUTOMATIC ADVANCE: Session moved to Question 3 (index 2) without manual click!');
  assert(stateQ3.session.current_state === 'QUESTION_ACTIVE', 'AUTOMATIC ADVANCE: Question 3 is QUESTION_ACTIVE');

  // STEP D: WAIT FOR Q3 (FINAL QUESTION) EXPIRY & AUTOMATIC TRANSITION TO FINAL RESULTS
  console.log('\nWaiting for Final Question timer (10s) + result processing delay (2.5s) to auto-transition to FINAL_RESULTS...');
  const stateFinal = await waitForState(
    autoCode,
    (s) =>
      (s.current_state === 'FINAL_RESULTS' || s.current_state === 'COMPLETED') &&
      s.status === 'completed',
    'Final Question automatic transition to FINAL_RESULTS (status: completed)'
  );
  console.log(`Final state after Q3 expiry: ${stateFinal.session.current_state}, status: ${stateFinal.session.status}`);
  assert(
    stateFinal.session.current_state === 'FINAL_RESULTS' || stateFinal.session.current_state === 'COMPLETED',
    'AUTOMATIC ADVANCE: Final Question automatically transitioned to FINAL_RESULTS!'
  );
  assert(stateFinal.session.status === 'completed', 'Session status is COMPLETED');
  assert(stateFinal.session.current_question_index === 2, 'Final question index remains 2 (did not attempt nonexistent question 3)');

  // Verify Final Leaderboard is populated
  assert(Array.isArray(stateFinal.leaderboard) && stateFinal.leaderboard.length === 2, 'Final leaderboard populated with 2 participants');

  console.log('\n================================================================');
  console.log('🎉 ALL EVENT DELETION & AUTO-ADVANCE TESTS PASSED WITH 100% SUCCESS!');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
