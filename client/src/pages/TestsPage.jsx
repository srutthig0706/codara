import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import CodeEditor from '../components/CodeEditor';
import {
  CheckCircle,
  XCircle,
  HelpCircle,
  Code,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Award,
  BookOpen,
  Terminal,
  Cpu
} from 'lucide-react';

export default function TestsPage({ initialTechSlug = 'python', onBack }) {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('quizzes'); // 'quizzes' | 'exercises'
  const [selectedTech, setSelectedTech] = useState(initialTechSlug || 'python');

  // Quiz state
  const [quizData, setQuizData] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  // Exercise state
  const [exercisesList, setExercisesList] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [exerciseCode, setExerciseCode] = useState('');
  const [runningTests, setRunningTests] = useState(false);
  const [testRunResults, setTestRunResults] = useState(null);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // 1. Fetch Quiz for Selected Tech
  useEffect(() => {
    if (activeTab === 'quizzes') {
      fetchQuiz(selectedTech);
    }
  }, [activeTab, selectedTech]);

  // 2. Fetch Exercises List
  useEffect(() => {
    if (activeTab === 'exercises') {
      fetchExercises();
    }
  }, [activeTab]);

  const fetchQuiz = async (techSlug) => {
    setLoadingQuiz(true);
    setQuizResult(null);
    setSelectedAnswers({});
    try {
      const res = await fetch(`/api/tests/quizzes/${techSlug}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQuizData(data);
      } else {
        setQuizData(null);
      }
    } catch (err) {
      console.error('Failed to load quiz:', err);
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleSelectOption = (questionId, optionIndex) => {
    if (quizResult) return; // Prevent changing after submission
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const handleSubmitQuiz = async () => {
    setSubmittingQuiz(true);
    try {
      const res = await fetch(`/api/tests/quizzes/${selectedTech}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ answers: selectedAnswers })
      });
      if (res.ok) {
        const result = await res.json();
        setQuizResult(result);
      }
    } catch (err) {
      console.error('Quiz submit failed:', err);
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const fetchExercises = async () => {
    try {
      const res = await fetch('/api/tests/exercises', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExercisesList(data.exercises || []);
        if (data.exercises?.length > 0 && !selectedExercise) {
          loadExercise(data.exercises[0].slug);
        }
      }
    } catch (err) {
      console.error('Failed to load exercises:', err);
    }
  };

  const loadExercise = async (slug) => {
    try {
      const res = await fetch(`/api/tests/exercises/${slug}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const ex = await res.json();
        setSelectedExercise(ex);
        setExerciseCode(ex.starterCode || '');
        setTestRunResults(null);
        setSubmissionResult(null);
        setAiFeedback(null);
      }
    } catch (err) {
      console.error('Failed to load exercise detail:', err);
    }
  };

  const handleRunPublicTests = async () => {
    if (!selectedExercise) return;
    setRunningTests(true);
    try {
      const res = await fetch(`/api/tests/exercises/${selectedExercise.slug}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: exerciseCode })
      });
      if (res.ok) {
        const data = await res.json();
        setTestRunResults(data);
      }
    } catch (err) {
      console.error('Run failed:', err);
    } finally {
      setRunningTests(false);
    }
  };

  const handleSubmitAllTests = async () => {
    if (!selectedExercise) return;
    setRunningTests(true);
    setAiFeedback(null);
    try {
      const res = await fetch(`/api/tests/exercises/${selectedExercise.slug}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: exerciseCode })
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissionResult(data);
      }
    } catch (err) {
      console.error('Submit failed:', err);
    } finally {
      setRunningTests(false);
    }
  };

  const handleRequestAiFeedback = async (isSuccess) => {
    if (!selectedExercise) return;
    setLoadingFeedback(true);
    try {
      const res = await fetch(`/api/tests/exercises/${selectedExercise.slug}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          code: exerciseCode,
          passed: isSuccess,
          failedCase: submissionResult?.failedCase || null
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiFeedback({ feedback: data.feedback, passed: isSuccess });
      }
    } catch (err) {
      console.error('Feedback fetch failed:', err);
    } finally {
      setLoadingFeedback(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span className="badge badge-primary">Tests & Verification</span>
            <span className="badge badge-runnable">Deterministic Grading</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 800 }}>
            Knowledge Assessments & Sandboxed Challenges
          </h1>
          <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Strict answer key grading and isolated container execution. AI provides reflective tutor feedback, never scores.
          </p>
        </div>

        {/* Tab switchers */}
        <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '0.35rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', gap: '0.25rem' }}>
          <button
            className={`btn btn-sm ${activeTab === 'quizzes' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('quizzes')}
          >
            <HelpCircle size={14} />
            Conceptual Quizzes
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'exercises' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('exercises')}
          >
            <Code size={14} />
            Coding Exercises
          </button>
        </div>
      </div>

      {/* QUIZ TAB */}
      {activeTab === 'quizzes' && (
        <div>
          {/* Tech selector pill tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {['python', 'javascript', 'redis'].map((t) => (
              <button
                key={t}
                className={`btn btn-sm ${selectedTech === t ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedTech(t)}
                style={{ textTransform: 'capitalize' }}
              >
                {t === 'javascript' ? 'JavaScript (Node.js)' : t}
              </button>
            ))}
          </div>

          {loadingQuiz ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading quiz questions from database...
            </div>
          ) : quizData ? (
            <div>
              <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>{quizData.title}</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {quizData.questions.length} Questions &bull; Stored Server Answer Keys
                    </span>
                  </div>
                  {quizResult && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        background: quizResult.passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        border: `1px solid ${quizResult.passed ? '#10b981' : '#ef4444'}`,
                        color: quizResult.passed ? '#34d399' : '#f87171',
                        fontWeight: 700,
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}>
                        <Award size={18} />
                        Score: {quizResult.score}% ({quizResult.correctCount}/{quizResult.totalQuestions})
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Questions list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {quizData.questions.map((q, qIndex) => {
                  const resultItem = quizResult?.results?.find((r) => r.questionId === q.id);
                  const isAnswered = selectedAnswers[q.id] !== undefined;

                  return (
                    <div
                      key={q.id}
                      className="glass-card"
                      style={{
                        padding: '1.5rem',
                        borderLeft: resultItem
                          ? `4px solid ${resultItem.isCorrect ? '#10b981' : '#ef4444'}`
                          : '1px solid var(--border-subtle)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Question {qIndex + 1} &bull; {q.type === 'mcq' ? 'Multiple Choice' : 'True / False'}
                        </span>
                        {resultItem && (
                          <span style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: resultItem.isCorrect ? '#34d399' : '#f87171',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}>
                            {resultItem.isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
                            {resultItem.isCorrect ? 'Correct' : 'Incorrect'}
                          </span>
                        )}
                      </div>

                      <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
                        {q.question}
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {q.options.map((opt, optIndex) => {
                          const isSelected = selectedAnswers[q.id] === optIndex;
                          let optBg = 'var(--bg-input)';
                          let optBorder = 'var(--border-subtle)';

                          if (resultItem) {
                            if (optIndex === resultItem.correctAnswerIndex) {
                              optBg = 'rgba(16, 185, 129, 0.15)';
                              optBorder = '#10b981';
                            } else if (isSelected && !resultItem.isCorrect) {
                              optBg = 'rgba(239, 68, 68, 0.15)';
                              optBorder = '#ef4444';
                            }
                          } else if (isSelected) {
                            optBg = 'rgba(99, 102, 241, 0.15)';
                            optBorder = 'var(--accent-primary)';
                          }

                          return (
                            <label
                              key={optIndex}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem 1rem',
                                background: optBg,
                                border: `1px solid ${optBorder}`,
                                borderRadius: 'var(--radius-sm)',
                                cursor: quizResult ? 'default' : 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <input
                                type="radio"
                                name={`q_${q.id}`}
                                checked={isSelected}
                                onChange={() => handleSelectOption(q.id, optIndex)}
                                disabled={!!quizResult}
                                style={{ accentColor: 'var(--accent-primary)' }}
                              />
                              <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{opt}</span>
                            </label>
                          );
                        })}
                      </div>

                      {resultItem && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderLeft: '2px solid var(--accent-primary)',
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)'
                        }}>
                          <strong style={{ color: 'var(--accent-primary)' }}>Explanation: </strong>
                          {resultItem.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Submit Button */}
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                {!quizResult ? (
                  <button
                    className="btn btn-primary"
                    onClick={handleSubmitQuiz}
                    disabled={submittingQuiz || Object.keys(selectedAnswers).length === 0}
                  >
                    {submittingQuiz ? 'Evaluating on Server...' : 'Submit Answers (Grade Quiz)'}
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setQuizResult(null);
                      setSelectedAnswers({});
                    }}
                  >
                    <RefreshCw size={14} />
                    Retake Quiz
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No quiz available for {selectedTech}.
            </div>
          )}
        </div>
      )}

      {/* EXERCISES TAB */}
      {activeTab === 'exercises' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Exercises list sidebar */}
          <div className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', paddingLeft: '0.5rem' }}>
              Available Challenges
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {exercisesList.map((ex) => (
                <div
                  key={ex.slug}
                  onClick={() => loadExercise(ex.slug)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: selectedExercise?.slug === ex.slug ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.03)',
                    color: selectedExercise?.slug === ex.slug ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ex.title}</div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem', fontSize: '0.7rem' }}>
                    <span style={{ opacity: 0.8 }}>{ex.techSlug.toUpperCase()}</span>
                    <span>&bull;</span>
                    <span style={{ opacity: 0.8 }}>{ex.difficulty}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Exercise Work Area */}
          {selectedExercise ? (
            <div>
              {/* Problem Statement Card */}
              <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>{selectedExercise.title}</h2>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span className="badge badge-primary">{selectedExercise.techSlug.toUpperCase()}</span>
                    <span className="badge badge-runnable">{selectedExercise.difficulty}</span>
                  </div>
                </div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  {selectedExercise.description}
                </p>
              </div>

              {/* Monaco Code Editor */}
              <CodeEditor
                code={exerciseCode}
                onChange={(newCode) => setExerciseCode(newCode || '')}
                language={selectedExercise.techSlug}
                isRunnable={true}
                height="320px"
              />

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  All tests run inside hardened throwaway Docker containers.
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleRunPublicTests}
                    disabled={runningTests}
                  >
                    <Terminal size={14} />
                    Run Public Tests
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSubmitAllTests}
                    disabled={runningTests}
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', borderColor: '#10b981' }}
                  >
                    <CheckCircle size={14} />
                    Submit for Official Grading
                  </button>
                </div>
              </div>

              {/* Test Run Results */}
              {(testRunResults || submissionResult) && (
                <div className="glass-card" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Terminal size={16} />
                      {submissionResult ? 'Official Grading Results (Public + Hidden Cases)' : 'Public Test Results'}
                    </h3>
                    {submissionResult && (
                      <span style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        background: submissionResult.allPassed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: submissionResult.allPassed ? '#34d399' : '#f87171'
                      }}>
                        {submissionResult.allPassed ? 'ALL TESTS PASSED' : `FAILED (${submissionResult.passedCount}/${submissionResult.totalTests} Passed)`}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {(submissionResult?.testResults || testRunResults?.testResults || []).map((t, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-sm)',
                          background: t.passed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                          border: `1px solid ${t.passed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.85rem'
                        }}
                      >
                        <div>
                          <strong>Test Case #{t.testCaseIndex}</strong> {t.isHidden && <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>HIDDEN</span>}
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                            Input: <code>{t.input}</code> | Expected: <code>{t.expectedOutput}</code> | Actual: <code>{t.actualOutput}</code>
                          </div>
                          {t.stderr && (
                            <pre style={{ margin: '0.4rem 0 0', color: '#fca5a5', fontSize: '0.75rem' }}>{t.stderr}</pre>
                          )}
                        </div>
                        <span style={{ fontWeight: 700, color: t.passed ? '#34d399' : '#f87171' }}>
                          {t.passed ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* AI Tutor Assistance Trigger (Never grades, explains or challenges) */}
                  {submissionResult && (
                    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRequestAiFeedback(submissionResult.allPassed)}
                        disabled={loadingFeedback}
                        style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
                      >
                        <Sparkles size={14} />
                        {loadingFeedback
                          ? 'Generating Tutor Feedback...'
                          : submissionResult.allPassed
                            ? 'Request Architectural Reflection'
                            : 'Explain My Algorithmic Mistake'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* AI Grounded Tutor Feedback Panel */}
              {aiFeedback && (
                <div className="glass-card" style={{ marginTop: '1.25rem', padding: '1.5rem', borderLeft: '4px solid var(--accent-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <Sparkles size={16} color="var(--accent-primary)" />
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                      AI Pedagogical Tutor Feedback
                    </span>
                    <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>
                      Post-Execution Reflection Only
                    </span>
                  </div>

                  {!aiFeedback.passed ? (
                    <div>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#f87171' }}>Failure Analysis: </strong>
                        <p style={{ margin: '0.2rem 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {aiFeedback.feedback.failureAnalysis}
                        </p>
                      </div>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#fbbf24' }}>Conceptual Misunderstanding: </strong>
                        <p style={{ margin: '0.2rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          {aiFeedback.feedback.conceptualMisunderstanding}
                        </p>
                      </div>
                      <div style={{ padding: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--radius-sm)' }}>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}>💡 Guidance Hint: </strong>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          {aiFeedback.feedback.hintWithoutGivingAnswer}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#34d399' }}>Approach Evaluation: </strong>
                        <p style={{ margin: '0.2rem 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {aiFeedback.feedback.approachEvaluation}
                        </p>
                      </div>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Complexity Analysis: </strong>
                        <p style={{ margin: '0.2rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          {aiFeedback.feedback.timeSpaceComplexityFeedback}
                        </p>
                      </div>
                      <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-sm)' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#34d399' }}>🤔 Reflection Challenge: </strong>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          {aiFeedback.feedback.followUpReflectionQuestion}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a coding challenge from the left to begin.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
