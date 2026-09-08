// Test Clean Participant Registration & Anti-Cheat State Isolation
const BASE_URL = 'http://localhost:3000';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function run() {
  console.log('================================================================');
  console.log('TEST: CLEAN REGISTRATION & ANTI-CHEAT STATE ISOLATION');
  console.log('================================================================\n');

  // Step 1: Create a test quiz
  console.log('Step 1: Create Quiz');
  const quizRes = await fetch(`${BASE_URL}/api/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'State Isolation Test Quiz',
      questions: [
        {
          question_text: 'What is 10 + 20?',
          options: ['10', '20', '30', '40'],
          correct_option_index: 2,
          timer_seconds: 30,
        },
      ],
    }),
  });
  assert(quizRes.ok, 'Successfully created test quiz');
  const { quiz } = await quizRes.json();

  // Step 2: Start Session 1
  console.log('\nStep 2: Start Session 1 (Event 1)');
  const sess1Res = await fetch(`${BASE_URL}/api/sessions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quiz_id: quiz.id }),
  });
  assert(sess1Res.ok, 'Session 1 created');
  const session1 = (await sess1Res.json()).session;
  console.log(`  Session 1 Game Code: ${session1.game_code}`);

  // Step 3: Register Student A in Session 1
  console.log('\nStep 3: Register Student A in Session 1');
  const join1Res = await fetch(`${BASE_URL}/api/sessions/${session1.game_code}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Student A',
      roll_no: '23CS999',
      year: '2nd Year',
      department: 'B.Tech CSE',
      email: 'studentA@gbu.ac.in',
    }),
  });
  assert(join1Res.ok, 'Student A joined Session 1 successfully');
  const studentA = (await join1Res.json()).participant;
  assert(studentA.warning_count === 0, 'Student A starts with 0 warnings');

  // Step 4: Start question in Session 1
  console.log('\nStep 4: Start question in Session 1');
  await fetch(`${BASE_URL}/api/sessions/${session1.game_code}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'START_QUESTION' }),
  });

  // Step 5: Issue 3 violations to Student A in Session 1
  console.log('\nStep 5: Issue 3 violations to Student A in Session 1');
  for (let i = 1; i <= 3; i++) {
    const vRes = await fetch(`${BASE_URL}/api/sessions/${session1.game_code}/violation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: studentA.id,
        violation_type: 'tab_switched',
      }),
    });
    const vData = await vRes.json();
    assert(vData.warning_count === i, `Violation ${i} recorded, count = ${i}`);
    if (i === 3) {
      assert(vData.is_removed === true && vData.status === 'removed', 'Violation 3 causes IMMEDIATE REMOVAL');
    }
  }

  // Step 6: Verify Student A cannot answer in Session 1
  console.log('\nStep 6: Verify Student A cannot answer in Session 1');
  const qState1 = await (await fetch(`${BASE_URL}/api/sessions/${session1.game_code}/state`)).json();
  const qId = qState1.activeQuestion.id;

  const ansRes = await fetch(`${BASE_URL}/api/sessions/${session1.game_code}/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: studentA.id,
      question_id: qId,
      selected_option: 2,
    }),
  });
  assert(!ansRes.ok, 'Server rejects answer from removed participant');

  // Step 7: Verify Student A attempting to re-join Session 1 gets removal rejection
  console.log('\nStep 7: Verify re-join attempt by removed student in Session 1 is rejected');
  const rejoin1Res = await fetch(`${BASE_URL}/api/sessions/${session1.game_code}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Student A',
      roll_no: '23CS999',
      year: '2nd Year',
      department: 'B.Tech CSE',
      email: 'studentA@gbu.ac.in',
    }),
  });
  assert(!rejoin1Res.ok, 'Re-join in same session by removed student is rejected');
  const rejoin1Err = (await rejoin1Res.json()).error;
  assert(
    rejoin1Err.includes('removed from this session for cheating violations'),
    'Error correctly states participant is removed from this session'
  );

  // Step 8: Verify a NEW Student B can register in Session 1 cleanly
  console.log('\nStep 8: Verify a new Student B can join Session 1 cleanly');
  const joinBRes = await fetch(`${BASE_URL}/api/sessions/${session1.game_code}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Student B',
      roll_no: '23CS888',
      year: '3rd Year',
      department: 'B.Tech IT',
      email: 'studentB@gbu.ac.in',
    }),
  });
  assert(joinBRes.ok, 'Student B joined Session 1 successfully');
  const studentB = (await joinBRes.json()).participant;
  assert(studentB.warning_count === 0, 'Student B starts with 0 warnings');
  assert(studentB.status === 'active', 'Student B status is active');

  // Step 9: Start Session 2 (Event 2) for the SAME quiz
  console.log('\nStep 9: Start Session 2 (Event 2) for the SAME quiz');
  const sess2Res = await fetch(`${BASE_URL}/api/sessions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quiz_id: quiz.id }),
  });
  assert(sess2Res.ok, 'Session 2 created');
  const session2 = (await sess2Res.json()).session;
  console.log(`  Session 2 Game Code: ${session2.game_code}`);
  assert(session2.game_code !== session1.game_code, 'Session 2 has a new unique Game Code');

  // Step 10: Student A (who was removed in Session 1) registers in Session 2
  console.log('\nStep 10: Student A registers in Session 2 (Fresh Session)');
  const join2Res = await fetch(`${BASE_URL}/api/sessions/${session2.game_code}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Student A',
      roll_no: '23CS999', // Same roll number that was removed in Session 1
      year: '2nd Year',
      department: 'B.Tech CSE',
      email: 'studentA@gbu.ac.in',
    }),
  });
  assert(join2Res.ok, 'Student A registers cleanly in Session 2 with HTTP 200');
  const studentA2 = (await join2Res.json()).participant;
  assert(studentA2.warning_count === 0, 'Student A in Session 2 has 0 warnings');
  assert(studentA2.status === 'active', 'Student A in Session 2 has status "active"');
  assert(studentA2.id !== studentA.id, 'Student A receives a brand new participant record in Session 2');

  // Step 11: End both sessions cleanly
  console.log('\nStep 11: Clean up test sessions');
  await fetch(`${BASE_URL}/api/sessions/${session1.game_code}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'FINAL_RESULTS' }),
  });
  await fetch(`${BASE_URL}/api/sessions/${session2.game_code}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'FINAL_RESULTS' }),
  });
  await fetch(`${BASE_URL}/api/quizzes/${quiz.id}`, { method: 'DELETE' });

  console.log('\n================================================================');
  console.log('🎉 ALL CLEAN REGISTRATION & ISOLATION TESTS PASSED 100%!');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
