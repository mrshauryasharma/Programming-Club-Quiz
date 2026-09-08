// Test Suite: Organizer History & Per-Event Result Storage & Data Isolation
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

async function runHistoryTests() {
  console.log('================================================================');
  console.log('PROGRAMMING CLUB QUIZ — ORGANIZER HISTORY & EVENT ISOLATION TEST');
  console.log('================================================================\n');

  // STEP 1: CREATE A COMMON QUIZ TEMPLATE
  console.log('--- Step 1: Create Shared Quiz Template ---');
  const quizRes = await fetch(`${BASE_URL}/api/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Data Structures & Algorithms Championship',
      description: 'Championship quiz used across multiple workshop events',
      questions: [
        {
          question_text: 'What is the average time complexity of searching in a Hash Map?',
          options: ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'],
          correct_option_index: 0,
          timer_seconds: 30,
        },
        {
          question_text: 'Which data structure is used in Breadth-First Search (BFS)?',
          options: ['Stack', 'Queue', 'Priority Queue', 'Binary Tree'],
          correct_option_index: 1,
          timer_seconds: 30,
        },
      ],
    }),
  });
  assert(quizRes.ok, 'Created shared quiz template');
  const quizData = await quizRes.json();
  const quizId = quizData.quiz.id;
  assert(Boolean(quizId), `Quiz ID created: ${quizId}`);

  // STEP 2: HOST EVENT 1
  console.log('\n--- Step 2: Host Event 1 with Shared Quiz ---');
  const event1Res = await fetch(`${BASE_URL}/api/sessions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quiz_id: quizId }),
  });
  assert(event1Res.ok, 'Created Event 1 session');
  const event1Data = await event1Res.json();
  const session1 = event1Data.session;
  const code1 = session1.game_code;
  const id1 = session1.id;
  assert(code1 && code1.length === 6, `Event 1 Game Code: ${code1}`);
  assert(Boolean(id1), `Event 1 Session ID: ${id1}`);

  // Event 1 Participants Join
  const join1A = await fetch(`${BASE_URL}/api/sessions/${code1}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Aarav Sharma',
      roll_no: '23ICS001',
      year: '3rd Year',
      department: 'Computer Science & Engineering',
      email: 'aarav@gbu.ac.in',
    }),
  });
  assert(join1A.ok, 'Event 1: Participant 1A (Aarav Sharma) joined');
  const part1A = (await join1A.json()).participant;

  const join1B = await fetch(`${BASE_URL}/api/sessions/${code1}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Bhavna Patel',
      roll_no: '23ICS002',
      year: '3rd Year',
      department: 'Information Technology',
      email: 'bhavna@gbu.ac.in',
    }),
  });
  assert(join1B.ok, 'Event 1: Participant 1B (Bhavna Patel) joined');
  const part1B = (await join1B.json()).participant;

  // Event 1 Conduct Quiz: Q1
  await fetch(`${BASE_URL}/api/sessions/${code1}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'START_QUESTION' }),
  });
  const q1Id = quizData.quiz.questions[0].id;

  // Aarav answers correctly (+2 pts)
  const ans1A = await fetch(`${BASE_URL}/api/sessions/${code1}/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: part1A.id,
      question_id: q1Id,
      selected_option: 0, // correct
    }),
  });
  assert(ans1A.ok, 'Event 1: Aarav submitted answer');
  const ans1AData = await ans1A.json();
  assert(ans1AData.points === 2, 'Event 1: Aarav awarded exactly 2 points');

  // Bhavna answers incorrectly (0 pts)
  const ans1B = await fetch(`${BASE_URL}/api/sessions/${code1}/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: part1B.id,
      question_id: q1Id,
      selected_option: 1, // incorrect
    }),
  });
  assert(ans1B.ok, 'Event 1: Bhavna submitted answer');
  const ans1BData = await ans1B.json();
  assert(ans1BData.points === 0, 'Event 1: Bhavna awarded 0 points');

  // End Q1, transition to Final Results
  await fetch(`${BASE_URL}/api/sessions/${code1}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'END_QUESTION' }),
  });
  await fetch(`${BASE_URL}/api/sessions/${code1}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'FINAL_RESULTS' }),
  });
  console.log('Event 1 completed successfully.');

  // STEP 3: HOST EVENT 2 WITH THE SAME QUIZ TEMPLATE
  console.log('\n--- Step 3: Host Event 2 with the SAME Quiz ---');
  const event2Res = await fetch(`${BASE_URL}/api/sessions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quiz_id: quizId }),
  });
  assert(event2Res.ok, 'Created Event 2 session with same quiz');
  const event2Data = await event2Res.json();
  const session2 = event2Data.session;
  const code2 = session2.game_code;
  const id2 = session2.id;
  assert(code2 && code2.length === 6, `Event 2 Game Code: ${code2}`);
  assert(Boolean(id2), `Event 2 Session ID: ${id2}`);

  // Check Game Code uniqueness
  assert(code1 !== code2, `Game Code 1 (${code1}) !== Game Code 2 (${code2})`);
  assert(id1 !== id2, `Session ID 1 (${id1}) !== Session ID 2 (${id2})`);

  // Event 2 Participants Join (3 different participants)
  const join2A = await fetch(`${BASE_URL}/api/sessions/${code2}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Chirag Verma',
      roll_no: '24ICS010',
      year: '2nd Year',
      department: 'Artificial Intelligence',
      email: 'chirag@gbu.ac.in',
    }),
  });
  assert(join2A.ok, 'Event 2: Participant 2A (Chirag Verma) joined');
  const part2A = (await join2A.json()).participant;

  const join2B = await fetch(`${BASE_URL}/api/sessions/${code2}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Divya Singh',
      roll_no: '24ICS011',
      year: '2nd Year',
      department: 'Cyber Security',
      email: 'divya@gbu.ac.in',
    }),
  });
  assert(join2B.ok, 'Event 2: Participant 2B (Divya Singh) joined');
  const part2B = (await join2B.json()).participant;

  const join2C = await fetch(`${BASE_URL}/api/sessions/${code2}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Eshan Gupta',
      roll_no: '24ICS012',
      year: '2nd Year',
      department: 'Data Science',
      email: 'eshan@gbu.ac.in',
    }),
  });
  assert(join2C.ok, 'Event 2: Participant 2C (Eshan Gupta) joined');
  const part2C = (await join2C.json()).participant;

  // Event 2 Conduct Quiz: Q1
  await fetch(`${BASE_URL}/api/sessions/${code2}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'START_QUESTION' }),
  });

  // Chirag answers correctly (+2)
  await fetch(`${BASE_URL}/api/sessions/${code2}/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: part2A.id,
      question_id: q1Id,
      selected_option: 0,
    }),
  });

  // Divya answers correctly (+2)
  await fetch(`${BASE_URL}/api/sessions/${code2}/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: part2B.id,
      question_id: q1Id,
      selected_option: 0,
    }),
  });

  // Eshan answers incorrectly (0)
  await fetch(`${BASE_URL}/api/sessions/${code2}/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: part2C.id,
      question_id: q1Id,
      selected_option: 2,
    }),
  });

  // End Q1, transition Event 2 to Final Results
  await fetch(`${BASE_URL}/api/sessions/${code2}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'END_QUESTION' }),
  });
  await fetch(`${BASE_URL}/api/sessions/${code2}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'FINAL_RESULTS' }),
  });
  console.log('Event 2 completed successfully.');

  // STEP 4: VERIFY ORGANIZER HISTORY LIST
  console.log('\n--- Step 4: Verify Organizer History Archive ---');
  const historyRes = await fetch(`${BASE_URL}/api/organizer/history`);
  assert(historyRes.ok, 'Fetched organizer history list');
  const historyData = await historyRes.json();
  const historyList = historyData.history;
  assert(Array.isArray(historyList), 'History is an array');

  const histEvent1 = historyList.find((h) => h.game_code === code1 || h.id === id1);
  const histEvent2 = historyList.find((h) => h.game_code === code2 || h.id === id2);

  assert(Boolean(histEvent1), `Event 1 (${code1}) is present in organizer history`);
  assert(Boolean(histEvent2), `Event 2 (${code2}) is present in organizer history`);
  assert(histEvent1.id !== histEvent2.id, 'Event 1 and Event 2 have distinct event IDs');
  assert(histEvent1.total_participants === 2, `Event 1 participant count is 2 (actual: ${histEvent1.total_participants})`);
  assert(histEvent2.total_participants === 3, `Event 2 participant count is 3 (actual: ${histEvent2.total_participants})`);

  // STEP 5: VERIFY DATA ISOLATION IN EVENT ANALYTICS
  console.log('\n--- Step 5: Verify Complete Data Isolation in Analytics ---');
  // Event 1 Analytics
  const analytics1Res = await fetch(`${BASE_URL}/api/sessions/${code1}/analytics`);
  assert(analytics1Res.ok, 'Fetched Event 1 analytics');
  const analytics1 = (await analytics1Res.json()).analytics;
  assert(analytics1.totalParticipants === 2, `Event 1 total participants = 2 (actual: ${analytics1.totalParticipants})`);
  const names1 = analytics1.leaderboard.map((p) => p.name);
  assert(names1.includes('Aarav Sharma') && names1.includes('Bhavna Patel'), 'Event 1 contains Aarav and Bhavna');
  assert(!names1.includes('Chirag Verma') && !names1.includes('Divya Singh') && !names1.includes('Eshan Gupta'), 'Event 1 DOES NOT contain Event 2 participants');

  // Event 2 Analytics
  const analytics2Res = await fetch(`${BASE_URL}/api/sessions/${code2}/analytics`);
  assert(analytics2Res.ok, 'Fetched Event 2 analytics');
  const analytics2 = (await analytics2Res.json()).analytics;
  assert(analytics2.totalParticipants === 3, `Event 2 total participants = 3 (actual: ${analytics2.totalParticipants})`);
  const names2 = analytics2.leaderboard.map((p) => p.name);
  assert(names2.includes('Chirag Verma') && names2.includes('Divya Singh') && names2.includes('Eshan Gupta'), 'Event 2 contains Chirag, Divya, Eshan');
  assert(!names2.includes('Aarav Sharma') && !names2.includes('Bhavna Patel'), 'Event 2 DOES NOT contain Event 1 participants');

  // STEP 6: VERIFY EXPORT ISOLATION (CSV)
  console.log('\n--- Step 6: Verify Export Data Isolation ---');
  const csv1Res = await fetch(`${BASE_URL}/api/sessions/${code1}/export/csv`);
  assert(csv1Res.ok, 'Event 1 CSV export returned HTTP 200');
  const csv1Text = await csv1Res.text();
  assert(csv1Text.includes('Aarav Sharma'), 'Event 1 CSV contains Aarav Sharma');
  assert(csv1Text.includes('Bhavna Patel'), 'Event 1 CSV contains Bhavna Patel');
  assert(!csv1Text.includes('Chirag Verma'), 'Event 1 CSV DOES NOT contain Chirag Verma');

  const csv2Res = await fetch(`${BASE_URL}/api/sessions/${code2}/export/csv`);
  assert(csv2Res.ok, 'Event 2 CSV export returned HTTP 200');
  const csv2Text = await csv2Res.text();
  assert(csv2Text.includes('Chirag Verma'), 'Event 2 CSV contains Chirag Verma');
  assert(csv2Text.includes('Divya Singh'), 'Event 2 CSV contains Divya Singh');
  assert(csv2Text.includes('Eshan Gupta'), 'Event 2 CSV contains Eshan Gupta');
  assert(!csv2Text.includes('Aarav Sharma'), 'Event 2 CSV DOES NOT contain Aarav Sharma');

  // STEP 7: RE-OPEN EVENT 1 TO VERIFY RETENTION & ZERO MUTATION
  console.log('\n--- Step 7: Verify Historical Event 1 Retention After Event 2 ---');
  const reopen1Res = await fetch(`${BASE_URL}/api/sessions/${code1}/analytics`);
  assert(reopen1Res.ok, 'Re-fetched Event 1 analytics after Event 2 complete');
  const reopen1 = (await reopen1Res.json()).analytics;
  assert(reopen1.totalParticipants === 2, 'Event 1 retains exactly 2 participants without pollution');
  assert(reopen1.session.id === id1, 'Event 1 session ID remains unchanged');
  assert(reopen1.session.game_code === code1, 'Event 1 game code remains unchanged');

  // STEP 8: VERIFY LOOKUP BY SESSION UUID AS WELL AS GAME CODE
  console.log('\n--- Step 8: Verify Lookup by Session UUID ---');
  const uuidLookup1 = await fetch(`${BASE_URL}/api/sessions/${id1}/analytics`);
  assert(uuidLookup1.ok, `Analytics query by UUID (${id1}) returned HTTP 200`);
  const uuidData1 = (await uuidLookup1.json()).analytics;
  assert(uuidData1.session.id === id1, 'UUID lookup matched exact session');

  console.log('\n================================================================');
  console.log('🎉 ALL ORGANIZER HISTORY & EVENT ISOLATION TESTS PASSED!');
  console.log('================================================================');
}

runHistoryTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
