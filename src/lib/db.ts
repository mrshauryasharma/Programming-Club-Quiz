import { Quiz, Question, Session, Participant, Answer, SessionState, QuestionResultSummary, SecurityLog, SessionHistoryItem } from '@/types/quiz';
import { getSupabaseServerClient } from './supabase';

// Global in-memory storage for high-speed state, automated testing, and fallback when Supabase keys are not set
class QuizRepository {
  private quizzes: Map<string, Quiz> = new Map();
  private questions: Map<string, Question[]> = new Map();
  private sessions: Map<string, Session> = new Map();
  private participants: Map<string, Participant[]> = new Map();
  private answers: Map<string, Answer[]> = new Map();
  private securityLogs: Map<string, SecurityLog[]> = new Map();

  constructor() {
    this.seedDefaultQuiz();
  }

  private seedDefaultQuiz() {
    const defaultQuizId = 'default-quiz-101';
    const defaultQuiz: Quiz = {
      id: defaultQuizId,
      title: 'Programming Club — Web & Core CS Quiz',
      description: 'Official USICT GBU Programming Club Technical Quiz covering Web Development, CS fundamentals, and problem solving.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.quizzes.set(defaultQuizId, defaultQuiz);

    const defaultQuestions: Question[] = [
      {
        id: 'q1',
        quiz_id: defaultQuizId,
        question_text: 'What does CSS stand for in web development?',
        options: ['Cascading Style Sheets', 'Computer Styling Syntax', 'Creative Sheet System', 'Central Style Selector'],
        correct_option_index: 0,
        timer_seconds: 20,
        order_index: 0,
      },
      {
        id: 'q2',
        quiz_id: defaultQuizId,
        question_text: 'Which data structure follows the Last-In First-Out (LIFO) principle?',
        options: ['Queue', 'Stack', 'Array', 'Linked List'],
        correct_option_index: 1,
        timer_seconds: 20,
        order_index: 1,
      },
      {
        id: 'q3',
        quiz_id: defaultQuizId,
        question_text: 'What is the time complexity of binary search on a sorted array of N elements?',
        options: ['O(N)', 'O(N^2)', 'O(log N)', 'O(1)'],
        correct_option_index: 2,
        timer_seconds: 30,
        order_index: 2,
      },
      {
        id: 'q4',
        quiz_id: defaultQuizId,
        question_text: 'In JavaScript, which keyword declares a block-scoped variable that cannot be reassigned?',
        options: ['var', 'let', 'const', 'static'],
        correct_option_index: 2,
        timer_seconds: 20,
        order_index: 3,
      },
      {
        id: 'q5',
        quiz_id: defaultQuizId,
        question_text: 'Which HTTP status code signifies "Not Found"?',
        options: ['200', '403', '404', '500'],
        correct_option_index: 2,
        timer_seconds: 15,
        order_index: 4,
      },
    ];
    this.questions.set(defaultQuizId, defaultQuestions);
  }

  // Quizzes CRUD
  public async getQuizzes(): Promise<Quiz[]> {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase.from('quizzes').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) return data as Quiz[];
    }
    return Array.from(this.quizzes.values());
  }

  public async getQuizById(id: string): Promise<Quiz | null> {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase.from('quizzes').select('*').eq('id', id).single();
      if (!error && data) {
        // Query existing questions table using existing columns: text, correct_option, time_limit, order_num
        const { data: qData } = await supabase
          .from('questions')
          .select('*')
          .eq('quiz_id', id)
          .order('order_num', { ascending: true });

        const mappedQuestions: Question[] = (qData || []).map((row: any) => ({
          id: row.id,
          quiz_id: row.quiz_id,
          question_text: row.text || row.question_text,
          options: row.options || [],
          correct_option_index: row.correct_option ?? row.correct_option_index ?? 0,
          timer_seconds: row.time_limit ?? row.timer_seconds ?? 30,
          order_index: row.order_num ?? row.order_index ?? 0,
        }));

        return { ...(data as Quiz), questions: mappedQuestions };
      }
    }
    const quiz = this.quizzes.get(id);
    if (!quiz) return null;
    return { ...quiz, questions: this.questions.get(id) || [] };
  }

  public async createQuiz(
    quiz: Omit<Quiz, 'id' | 'created_at' | 'updated_at'>,
    questions: Omit<Question, 'id' | 'quiz_id'>[]
  ): Promise<Quiz> {
    const supabase = getSupabaseServerClient();

    if (supabase) {
      try {
        const { data: quizData, error: quizError } = await supabase
          .from('quizzes')
          .insert({
            title: quiz.title,
            description: quiz.description,
          })
          .select()
          .single();

        if (!quizError && quizData) {
          const quizId = quizData.id;
          const questionsPayload = questions.map((q, idx) => ({
            quiz_id: quizId,
            text: q.question_text,
            options: q.options,
            correct_option: q.correct_option_index,
            points: 2, // Strictly 2 points per rule
            time_limit: Math.min(120, Math.max(10, q.timer_seconds)),
            order_num: idx,
            question_type: 'MCQ',
          }));

          const { data: qResult } = await supabase.from('questions').insert(questionsPayload).select();

          const mappedQuestions: Question[] = (qResult || []).map((row: any) => ({
            id: row.id,
            quiz_id: quizId,
            question_text: row.text,
            options: row.options,
            correct_option_index: row.correct_option,
            timer_seconds: row.time_limit,
            order_index: row.order_num,
          }));

          const fullQuiz: Quiz = {
            id: quizId,
            title: quizData.title,
            description: quizData.description,
            created_at: quizData.created_at,
            updated_at: quizData.updated_at,
            questions: mappedQuestions,
          };

          this.quizzes.set(quizId, fullQuiz);
          this.questions.set(quizId, mappedQuestions);
          return fullQuiz;
        }
      } catch (err) {
        console.warn('Supabase createQuiz fallback to in-memory:', err);
      }
    }

    const id = `quiz-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newQuiz: Quiz = {
      ...quiz,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.quizzes.set(id, newQuiz);

    const questionList: Question[] = questions.map((q, idx) => ({
      ...q,
      id: `q-${id}-${idx}-${Date.now()}`,
      quiz_id: id,
      order_index: idx,
    }));
    this.questions.set(id, questionList);

    return { ...newQuiz, questions: questionList };
  }

  public async deleteQuiz(id: string): Promise<boolean> {
    this.quizzes.delete(id);
    this.questions.delete(id);
    const supabase = getSupabaseServerClient();
    if (supabase) {
      await supabase.from('quizzes').delete().eq('id', id);
    }
    return true;
  }

  // Session Management — Every live session gets a newly generated 6-char Game Code
  public async createSession(quizId: string): Promise<Session> {
    const quiz = await this.getQuizById(quizId);
    if (!quiz) throw new Error('Quiz not found');

    const supabase = getSupabaseServerClient();

    // Server-side generation of unique 6-character uppercase alphanumeric code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let gameCode = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      attempts++;
      gameCode = '';
      for (let i = 0; i < 6; i++) {
        gameCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const localExists = this.sessions.has(gameCode);
      if (localExists) continue;

      if (supabase) {
        const { data } = await supabase
          .from('live_sessions')
          .select('id')
          .eq('game_code', gameCode)
          .in('status', ['WAITING', 'ACTIVE', 'waiting', 'active']);
        if (data && data.length > 0) continue;
      }

      isUnique = true;
    }

    if (!isUnique) {
      gameCode = `S${Date.now().toString().slice(-5)}`;
    }

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('live_sessions')
          .insert({
            quiz_id: quizId,
            game_code: gameCode,
            status: 'WAITING',
            current_state: 'WAITING',
            current_question_index: 0,
            question_start_time: null,
          })
          .select()
          .single();

        if (!error && data) {
          const session: Session = {
            id: data.id,
            quiz_id: data.quiz_id,
            game_code: data.game_code,
            status: (data.status?.toLowerCase() || 'waiting') as any,
            current_question_index: data.current_question_index || 0,
            question_start_time: data.question_start_time ? Number(data.question_start_time) : null,
            current_state: (data.current_state || 'WAITING') as any,
            created_at: data.created_at,
            ended_at: data.ended_at,
          };

          this.sessions.set(session.id, session);
          this.sessions.set(gameCode, session);
          this.participants.set(session.id, []);
          this.answers.set(session.id, []);
          this.securityLogs.set(session.id, []);
          return session;
        }
      } catch (e) {
        console.warn('Supabase session insert fallback to in-memory:', e);
      }
    }

    // In-memory fallback
    const session: Session = {
      id: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      quiz_id: quizId,
      game_code: gameCode,
      status: 'waiting',
      current_question_index: 0,
      question_start_time: null,
      current_state: 'WAITING',
      created_at: new Date().toISOString(),
      ended_at: null,
    };

    this.sessions.set(session.id, session);
    this.sessions.set(gameCode, session);
    this.participants.set(session.id, []);
    this.answers.set(session.id, []);
    this.securityLogs.set(session.id, []);

    return session;
  }

  public async getSessionByCode(code: string): Promise<Session | null> {
    if (!code) return null;
    const trimmed = code.trim();
    const normalizedCode = trimmed.toUpperCase();
    const session = this.sessions.get(normalizedCode) || this.sessions.get(trimmed);
    if (session) return session;

    const supabase = getSupabaseServerClient();
    if (supabase) {
      let { data } = await supabase
        .from('live_sessions')
        .select('*')
        .eq('game_code', normalizedCode)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data && /^[0-9a-fA-F-]{36}$/.test(trimmed)) {
        const res = await supabase.from('live_sessions').select('*').eq('id', trimmed).maybeSingle();
        data = res.data;
      }
      if (data) {
        const s: Session = {
          id: data.id,
          quiz_id: data.quiz_id,
          game_code: data.game_code,
          status: (data.status?.toLowerCase() || 'waiting') as any,
          current_question_index: data.current_question_index || 0,
          question_start_time: data.question_start_time ? Number(data.question_start_time) : null,
          current_state: (data.current_state || 'WAITING') as any,
          created_at: data.created_at,
          ended_at: data.ended_at,
        };
        this.sessions.set(s.id, s);
        this.sessions.set(s.game_code, s);
        return s;
      }
    }
    return null;
  }

  public async getSessionById(id: string): Promise<Session | null> {
    if (!id) return null;
    const trimmed = id.trim();
    const session = this.sessions.get(trimmed) || this.sessions.get(trimmed.toUpperCase());
    if (session) return session;

    const supabase = getSupabaseServerClient();
    if (supabase) {
      let { data } = await supabase.from('live_sessions').select('*').eq('id', trimmed).maybeSingle();
      if (!data && trimmed.length === 6) {
        const res = await supabase.from('live_sessions').select('*').eq('game_code', trimmed.toUpperCase()).maybeSingle();
        data = res.data;
      }
      if (data) {
        const s: Session = {
          id: data.id,
          quiz_id: data.quiz_id,
          game_code: data.game_code,
          status: (data.status?.toLowerCase() || 'waiting') as any,
          current_question_index: data.current_question_index || 0,
          question_start_time: data.question_start_time ? Number(data.question_start_time) : null,
          current_state: (data.current_state || 'WAITING') as any,
          created_at: data.created_at,
          ended_at: data.ended_at,
        };
        this.sessions.set(s.id, s);
        this.sessions.set(s.game_code, s);
        return s;
      }
    }
    return null;
  }

  // Delete a specific live quiz event/session strictly scoped to this session ID
  public async deleteSession(sessionId: string): Promise<boolean> {
    const session = (await this.getSessionById(sessionId)) || (await this.getSessionByCode(sessionId));
    if (!session) return false;

    // 1. Remove from in-memory maps
    this.sessions.delete(session.id);
    this.sessions.delete(session.game_code);
    this.participants.delete(session.id);
    this.answers.delete(session.id);
    this.securityLogs.delete(session.id);

    // 2. Remove strictly scoped data from Supabase if connected
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        // Delete child tables first to respect FK constraints
        await supabase.from('answers').delete().eq('session_id', session.id);
        await supabase.from('security_logs').delete().eq('session_id', session.id);
        await supabase.from('participants').delete().eq('session_id', session.id);
        const { error } = await supabase.from('live_sessions').delete().eq('id', session.id);
        if (error) {
          console.error('Supabase live_sessions delete error:', error);
          throw new Error(error.message);
        }
      } catch (err: any) {
        console.error('Failed to delete session from Supabase:', err);
        throw err;
      }
    }

    return true;
  }

  // Participant Join
  public async joinSession(
    code: string,
    participantData: {
      name: string;
      roll_no: string;
      year: string;
      department: string;
      custom_department?: string;
      email: string;
    }
  ): Promise<{ participant: Participant; session: Session }> {
    const session = await this.getSessionByCode(code);
    if (!session) throw new Error('Invalid game code');
    if (session.status === 'completed') throw new Error('This quiz session has already ended');

    const cleanRoll = participantData.roll_no?.trim().toUpperCase();
    const cleanName = participantData.name?.trim();
    const cleanEmail = participantData.email?.trim().toLowerCase();
    const cleanYear = participantData.year?.trim();
    let cleanDept = participantData.department?.trim();
    const cleanCustomDept = participantData.custom_department?.trim();

    const validYears = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];
    if (!cleanYear || !validYears.includes(cleanYear)) {
      throw new Error('Please select a valid Year of study (1st, 2nd, 3rd, 4th, or 5th Year)');
    }

    if (!cleanDept) {
      throw new Error('Department is required');
    }

    if (cleanDept === 'Other') {
      if (!cleanCustomDept) {
        throw new Error('Please enter your department name');
      }
      cleanDept = cleanCustomDept;
    }

    if (!cleanName) throw new Error('Name is required');
    if (!cleanRoll) throw new Error('Roll Number is required');
    if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('A valid Email ID is required');

    // Fetch existing participants in THIS active session
    let pList = await this.getParticipants(session.id);

    // Roll number uniqueness enforced strictly WITHIN this session
    const existing = pList.find(p => p.roll_no?.toUpperCase() === cleanRoll);
    if (existing) {
      if (existing.status === 'removed') {
        throw new Error('This participant has been removed from this session for cheating violations');
      }
      return { participant: existing, session };
    }

    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('participants')
          .insert({
            session_id: session.id,
            name: cleanName,
            nickname: cleanName, // Compatibility with legacy schema
            roll_no: cleanRoll,
            year: cleanYear,
            department: cleanDept,
            custom_department: cleanCustomDept || '',
            email: cleanEmail,
            warning_count: 0,
            status: 'ACTIVE',
            score: 0,
            correct_count: 0,
            total_response_time_ms: 0,
          })
          .select()
          .single();

        if (!error && data) {
          const participant: Participant = {
            id: data.id,
            session_id: session.id,
            name: cleanName,
            roll_no: cleanRoll,
            year: cleanYear,
            department: cleanDept,
            custom_department: cleanCustomDept || '',
            email: cleanEmail,
            warning_count: 0,
            status: 'active',
            total_score: 0,
            total_response_time_ms: 0,
            joined_at: data.joined_at,
          };

          const curList = this.participants.get(session.id) || [];
          curList.push(participant);
          this.participants.set(session.id, curList);
          return { participant, session };
        }
      } catch (e) {
        console.warn('Supabase joinSession fallback to in-memory:', e);
      }
    }

    // In-memory fallback
    const participant: Participant = {
      id: `part-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      session_id: session.id,
      name: cleanName,
      roll_no: cleanRoll,
      year: cleanYear,
      department: cleanDept,
      custom_department: cleanCustomDept || '',
      email: cleanEmail,
      warning_count: 0,
      status: 'active',
      total_score: 0,
      total_response_time_ms: 0,
      joined_at: new Date().toISOString(),
    };

    const curList = this.participants.get(session.id) || [];
    curList.push(participant);
    this.participants.set(session.id, curList);

    return { participant, session };
  }

  public async getParticipants(sessionId: string): Promise<Participant[]> {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase.from('participants').select('*').eq('session_id', sessionId);
      if (data && data.length > 0) {
        return data.map((p: any) => ({
          id: p.id,
          session_id: p.session_id,
          name: p.name || p.nickname || 'Student',
          roll_no: p.roll_no || 'N/A',
          year: p.year || '1st Year',
          department: p.department || 'School of ICT',
          custom_department: p.custom_department || '',
          email: p.email || 'student@gbu.ac.in',
          warning_count: p.warning_count || 0,
          status: (p.status?.toLowerCase() || 'active') as any,
          total_score: p.score ?? p.total_score ?? 0,
          total_response_time_ms: Number(p.total_response_time_ms || 0),
          joined_at: p.joined_at,
        }));
      }
    }
    return this.participants.get(sessionId) || [];
  }

  public async getParticipantById(sessionId: string, participantId: string): Promise<Participant | null> {
    const list = await this.getParticipants(sessionId);
    return list.find(p => p.id === participantId) || null;
  }

  // Live Quiz State Transitions (Server Authoritative)
  public async transitionSessionState(
    code: string,
    action: 'START_QUESTION' | 'END_QUESTION' | 'SHOW_LEADERBOARD' | 'NEXT_QUESTION' | 'FINAL_RESULTS' | 'END_QUIZ'
  ): Promise<Session> {
    const session = await this.getSessionByCode(code);
    if (!session) throw new Error('Session not found');

    const quiz = await this.getQuizById(session.quiz_id);
    if (!quiz || !quiz.questions || quiz.questions.length === 0) throw new Error('Quiz has no questions');

    const now = Date.now();

    switch (action) {
      case 'START_QUESTION':
        session.status = 'active';
        session.current_state = 'QUESTION_ACTIVE';
        session.question_start_time = now;
        break;

      case 'END_QUESTION':
        session.current_state = 'QUESTION_ENDED';
        break;

      case 'SHOW_LEADERBOARD':
        session.current_state = 'SHOW_LEADERBOARD';
        break;

      case 'NEXT_QUESTION':
        if (session.current_question_index + 1 < quiz.questions.length) {
          session.current_question_index += 1;
          session.current_state = 'QUESTION_ACTIVE';
          session.question_start_time = now;
        } else {
          session.current_state = 'FINAL_RESULTS';
          session.status = 'completed';
          session.ended_at = new Date().toISOString();
        }
        break;

      case 'FINAL_RESULTS':
        session.current_state = 'FINAL_RESULTS';
        session.status = 'completed';
        session.ended_at = new Date().toISOString();
        break;

      case 'END_QUIZ':
        session.current_state = 'COMPLETED';
        session.status = 'completed';
        session.ended_at = new Date().toISOString();
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    this.sessions.set(session.id, session);
    this.sessions.set(session.game_code, session);

    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        await supabase
          .from('live_sessions')
          .update({
            status: session.status === 'completed' ? 'ENDED' : 'ACTIVE',
            current_question_index: session.current_question_index,
            question_start_time: session.question_start_time,
            current_state: session.current_state,
            ended_at: session.ended_at,
          })
          .eq('id', session.id);
      } catch (e) {
        console.warn('Supabase state update warning:', e);
      }
    }

    return session;
  }

  // Answer Submission (Server Authoritative: +2 / 0 points, Strict Timer, Tie-Breaker Response Time)
  public async submitAnswer(
    code: string,
    participantId: string,
    questionId: string,
    selectedOption: number
  ): Promise<{ is_correct: boolean; points: number; response_time_ms: number; total_score: number }> {
    const session = await this.getSessionByCode(code);
    if (!session) throw new Error('Session not found');

    if (session.current_state !== 'QUESTION_ACTIVE') {
      throw new Error('Answers are not being accepted for this question');
    }

    const quiz = await this.getQuizById(session.quiz_id);
    if (!quiz || !quiz.questions) throw new Error('Quiz not found');

    const currentQuestion = quiz.questions[session.current_question_index];
    if (!currentQuestion || currentQuestion.id !== questionId) {
      throw new Error('Question mismatch or already expired');
    }

    const now = Date.now();
    const startTime = session.question_start_time || now;
    const timeLimitMs = currentQuestion.timer_seconds * 1000;

    // Strict timer check: NO arbitrary grace period
    if (now > startTime + timeLimitMs) {
      throw new Error('Time expired. Late submissions are not accepted.');
    }

    const participant = await this.getParticipantById(session.id, participantId);
    if (!participant) throw new Error('Participant not found');

    if (participant.status === 'removed') {
      throw new Error('You have been removed from this session and cannot answer.');
    }

    // Check if participant already answered this question
    const answersList = this.answers.get(session.id) || [];
    const alreadyAnswered = answersList.some(a => a.participant_id === participantId && a.question_id === questionId);
    if (alreadyAnswered) {
      throw new Error('You have already submitted an answer for this question.');
    }

    const response_time_ms = Math.max(0, now - startTime);
    const is_correct = selectedOption === currentQuestion.correct_option_index;
    const points = is_correct ? 2 : 0; // Strict scoring rule: +2 or 0

    const answerRecord: Answer = {
      id: `ans-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      session_id: session.id,
      participant_id: participantId,
      question_id: questionId,
      selected_option: selectedOption,
      is_correct,
      points,
      response_time_ms,
      submitted_at: new Date().toISOString(),
    };

    answersList.push(answerRecord);
    this.answers.set(session.id, answersList);

    // Update participant score and total response time
    participant.total_score += points;
    participant.total_response_time_ms += response_time_ms;

    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        // Insert into existing answers table: points_awarded, speed_bonus: 0, streak_bonus: 0, response_time_ms
        await supabase.from('answers').insert({
          session_id: session.id,
          participant_id: participantId,
          question_id: questionId,
          selected_option: selectedOption,
          is_correct,
          points_awarded: points,
          speed_bonus: 0,
          streak_bonus: 0,
          response_time_ms,
        });

        // Update existing participants table: score, total_response_time_ms
        await supabase
          .from('participants')
          .update({
            score: participant.total_score,
            total_response_time_ms: participant.total_response_time_ms,
            correct_count: Math.floor(participant.total_score / 2),
          })
          .eq('id', participantId);
      } catch (e) {
        console.warn('Supabase answer insert warning:', e);
      }
    }

    return {
      is_correct,
      points,
      response_time_ms,
      total_score: participant.total_score,
    };
  }

  // Anti-Cheat Violation (Warning 1, Warning 2, Warning 3 = Immediate Removal)
  public async reportViolation(
    code: string,
    participantId: string,
    violationType: string
  ): Promise<{ warning_count: number; status: string; is_removed: boolean }> {
    const session = await this.getSessionByCode(code);
    if (!session) throw new Error('Session not found');

    const participant = await this.getParticipantById(session.id, participantId);
    if (!participant) throw new Error('Participant not found');

    if (participant.status === 'removed') {
      return { warning_count: 3, status: 'removed', is_removed: true };
    }

    participant.warning_count = Math.min(3, participant.warning_count + 1);

    if (participant.warning_count === 1) {
      participant.status = 'warning_1';
    } else if (participant.warning_count === 2) {
      participant.status = 'warning_2';
    } else if (participant.warning_count >= 3) {
      participant.status = 'removed';
    }

    const log: SecurityLog = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      session_id: session.id,
      participant_id: participantId,
      violation_type: violationType,
      warning_level: participant.warning_count,
      recorded_at: new Date().toISOString(),
    };

    const logs = this.securityLogs.get(session.id) || [];
    logs.push(log);
    this.securityLogs.set(session.id, logs);

    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const dbStatus =
          participant.status === 'warning_1'
            ? 'WARNING_1'
            : participant.status === 'warning_2'
            ? 'WARNING_2'
            : participant.status === 'removed'
            ? 'REMOVED'
            : 'ACTIVE';

        await supabase
          .from('participants')
          .update({
            warning_count: participant.warning_count,
            status: dbStatus,
          })
          .eq('id', participantId);

        await supabase.from('security_logs').insert({
          session_id: session.id,
          participant_id: participantId,
          violation_type: violationType,
          warning_level: participant.warning_count,
        });
      } catch (e) {
        console.warn('Supabase violation logging warning:', e);
      }
    }

    return {
      warning_count: participant.warning_count,
      status: participant.status,
      is_removed: participant.status === 'removed',
    };
  }

  // Leaderboard Calculation (Server-Authoritative Tie Breaking: Points DESC, Total Response Time ASC)
  public async getLeaderboard(sessionId: string): Promise<Participant[]> {
    const list = await this.getParticipants(sessionId);

    // Sort: 1. Higher total_score, 2. Lower total_response_time_ms, 3. Joined earlier
    const sorted = [...list].sort((a, b) => {
      if (b.total_score !== a.total_score) {
        return b.total_score - a.total_score;
      }
      if (a.total_response_time_ms !== b.total_response_time_ms) {
        return a.total_response_time_ms - b.total_response_time_ms;
      }
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    });

    return sorted.map((p, idx) => ({ ...p, rank: idx + 1 }));
  }

  // Question Summary
  public async getQuestionSummary(sessionId: string, questionIndex: number): Promise<QuestionResultSummary | null> {
    const session = await this.getSessionById(sessionId);
    if (!session) return null;

    const quiz = await this.getQuizById(session.quiz_id);
    if (!quiz || !quiz.questions || !quiz.questions[questionIndex]) return null;

    const q = quiz.questions[questionIndex];
    let answersList = this.answers.get(session.id);
    if (!answersList || answersList.length === 0) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        const { data } = await supabase.from('answers').select('*').eq('session_id', session.id);
        if (data && data.length > 0) {
          answersList = data.map((d: any) => ({
            id: d.id,
            session_id: d.session_id,
            participant_id: d.participant_id,
            question_id: d.question_id,
            selected_option: d.selected_option,
            is_correct: d.is_correct,
            points: d.points_awarded ?? (d.is_correct ? 2 : 0),
            response_time_ms: d.response_time_ms ?? 0,
            submitted_at: d.created_at || new Date().toISOString(),
          }));
          this.answers.set(session.id, answersList);
        }
      }
    }

    const questionAnswers = (answersList || []).filter(a => a.question_id === q.id);
    const participants = await this.getParticipants(session.id);

    const option_counts: [number, number, number, number] = [0, 0, 0, 0];
    let correct_count = 0;
    let incorrect_count = 0;
    let total_time = 0;
    let fastest_answer_ms: number | null = null;
    let fastest_participant_name: string | null = null;

    for (const ans of questionAnswers) {
      if (ans.selected_option >= 0 && ans.selected_option <= 3) {
        option_counts[ans.selected_option as 0 | 1 | 2 | 3] += 1;
      }
      if (ans.is_correct) {
        correct_count += 1;
        if (fastest_answer_ms === null || ans.response_time_ms < fastest_answer_ms) {
          fastest_answer_ms = ans.response_time_ms;
          const p = participants.find(part => part.id === ans.participant_id);
          fastest_participant_name = p ? p.name : 'Anonymous';
        }
      } else {
        incorrect_count += 1;
      }
      total_time += ans.response_time_ms;
    }

    return {
      question_id: q.id,
      question_text: q.question_text,
      correct_option_index: q.correct_option_index,
      total_answers: questionAnswers.length,
      correct_count,
      incorrect_count,
      option_counts,
      fastest_answer_ms,
      fastest_participant_name,
      average_response_time_ms: questionAnswers.length > 0 ? Math.round(total_time / questionAnswers.length) : null,
    };
  }

  // Analytics for completed session
  public async getSessionAnalytics(sessionId: string) {
    let session = await this.getSessionById(sessionId);
    if (!session) {
      session = await this.getSessionByCode(sessionId);
    }
    if (!session) return null;

    const quiz = await this.getQuizById(session.quiz_id);
    if (!quiz || !quiz.questions) return null;

    const participants = await this.getParticipants(session.id);
    const leaderboard = await this.getLeaderboard(session.id);

    const questionSummaries: QuestionResultSummary[] = [];
    for (let i = 0; i < quiz.questions.length; i++) {
      const summary = await this.getQuestionSummary(session.id, i);
      if (summary) questionSummaries.push(summary);
    }

    const totalQuestions = quiz.questions.length;
    const maxScore = totalQuestions * 2; // Exactly 2 pts per question
    const averageScore =
      participants.length > 0
        ? (participants.reduce((acc, p) => acc + p.total_score, 0) / participants.length).toFixed(1)
        : '0.0';

    // Identify most difficult and most missed question
    let mostDifficult: QuestionResultSummary | null = null;
    let lowestAccuracy = 101;

    questionSummaries.forEach(qs => {
      const acc = qs.total_answers > 0 ? (qs.correct_count / qs.total_answers) * 100 : 0;
      if (acc < lowestAccuracy) {
        lowestAccuracy = acc;
        mostDifficult = qs;
      }
    });

    return {
      session,
      quiz,
      totalParticipants: participants.length,
      maxScore,
      averageScore,
      leaderboard,
      questionSummaries,
      mostDifficultQuestion: mostDifficult,
    };
  }

  // Session History — Retrieves persistent history of all quiz events
  public async getSessionHistory(): Promise<SessionHistoryItem[]> {
    const historyMap = new Map<string, SessionHistoryItem>();

    // 1. Check in-memory active & past sessions
    for (const s of this.sessions.values()) {
      if (!historyMap.has(s.id)) {
        const quiz = await this.getQuizById(s.quiz_id);
        const participants = await this.getParticipants(s.id);
        const avgScore =
          participants.length > 0
            ? (participants.reduce((acc, p) => acc + p.total_score, 0) / participants.length).toFixed(1)
            : '0.0';

        historyMap.set(s.id, {
          id: s.id,
          quiz_id: s.quiz_id,
          quiz_title: quiz?.title || 'Programming Club Quiz',
          game_code: s.game_code,
          status: s.status,
          current_state: s.current_state,
          created_at: s.created_at,
          ended_at: s.ended_at,
          total_participants: participants.length,
          average_score: avgScore,
          total_questions: quiz?.questions?.length || 0,
        });
      }
    }

    // 2. Fetch from Supabase live_sessions if connected
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data: dbSessions } = await supabase
          .from('live_sessions')
          .select(`
            id,
            quiz_id,
            game_code,
            status,
            current_state,
            created_at,
            ended_at,
            quizzes (
              id,
              title
            ),
            participants (
              id,
              score
            )
          `)
          .order('created_at', { ascending: false });

        if (dbSessions) {
          for (const row of dbSessions) {
            const quiz = await this.getQuizById(row.quiz_id);
            const quizTitle = (row.quizzes as any)?.title || quiz?.title || 'Programming Club Quiz';
            const participantsList = (row.participants as any[]) || (await this.getParticipants(row.id));
            const avgScore =
              participantsList.length > 0
                ? (participantsList.reduce((acc, p) => acc + (p.score ?? p.total_score ?? 0), 0) / participantsList.length).toFixed(1)
                : '0.0';

            historyMap.set(row.id, {
              id: row.id,
              quiz_id: row.quiz_id,
              quiz_title: quizTitle,
              game_code: row.game_code,
              status: (row.status?.toLowerCase() || 'waiting') as any,
              current_state: (row.current_state || 'WAITING') as any,
              created_at: row.created_at,
              ended_at: row.ended_at,
              total_participants: participantsList.length,
              average_score: avgScore,
              total_questions: quiz?.questions?.length || 0,
            });
          }
        }
      } catch (err) {
        console.warn('Supabase getSessionHistory error:', err);
      }
    }

    return Array.from(historyMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
}

// Singleton global repository instance
const globalForQuiz = global as unknown as { quizRepository: QuizRepository };
export const db = globalForQuiz.quizRepository || new QuizRepository();
globalForQuiz.quizRepository = db;
