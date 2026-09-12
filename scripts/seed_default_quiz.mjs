import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();

const client = createClient(url, key);

async function seed() {
  const quizId = 'b4722af8-2981-48e7-9c9e-4eac6bebe147';

  // Ensure quiz exists
  const { data: existingQuiz } = await client.from('quizzes').select('*').eq('id', quizId).maybeSingle();
  if (!existingQuiz) {
    await client.from('quizzes').insert({
      id: quizId,
      title: 'Programming Club — Web & Core CS Quiz',
      description: 'Official USICT GBU Programming Club Technical Quiz covering Web Development, CS fundamentals, and problem solving.',
      status: 'PUBLISHED'
    });
  } else {
    await client.from('quizzes').update({ status: 'PUBLISHED' }).eq('id', quizId);
  }

  // Clear existing questions for this quiz
  await client.from('questions').delete().eq('quiz_id', quizId);

  const questions = [
    {
      quiz_id: quizId,
      text: 'What does CSS stand for in web development?',
      question_type: 'MCQ',
      options: ['Cascading Style Sheets', 'Computer Styling Syntax', 'Creative Sheet System', 'Central Style Selector'],
      correct_option: 0,
      time_limit: 20,
      order_num: 0
    },
    {
      quiz_id: quizId,
      text: 'Which data structure follows the Last-In First-Out (LIFO) principle?',
      question_type: 'MCQ',
      options: ['Queue', 'Stack', 'Array', 'Linked List'],
      correct_option: 1,
      time_limit: 20,
      order_num: 1
    },
    {
      quiz_id: quizId,
      text: 'What is the time complexity of binary search on a sorted array of N elements?',
      question_type: 'MCQ',
      options: ['O(N)', 'O(N^2)', 'O(log N)', 'O(1)'],
      correct_option: 2,
      time_limit: 30,
      order_num: 2
    },
    {
      quiz_id: quizId,
      text: 'In JavaScript, which keyword declares a block-scoped variable that cannot be reassigned?',
      question_type: 'MCQ',
      options: ['var', 'let', 'const', 'static'],
      correct_option: 2,
      time_limit: 20,
      order_num: 3
    },
    {
      quiz_id: quizId,
      text: 'Which HTTP status code signifies "Not Found"?',
      question_type: 'MCQ',
      options: ['200', '403', '404', '500'],
      correct_option: 2,
      time_limit: 15,
      order_num: 4
    }
  ];

  const { data, error } = await client.from('questions').insert(questions).select();
  console.log('Seeded questions:', data?.length, 'Error:', error);
}

seed();
