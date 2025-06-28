import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { API_BASE_URL } from './config'; // Configuration file for API base URL

// Utility function to clean JSON string from LLM responses
function cleanJsonString(str: string): string {
  // Removes Markdown code blocks (```json ... ```) and trims whitespace
  return str.replace(/```json\s*([\s\S]*?)```/g, '$1').trim();
}

// Type definitions for clarity and type safety
interface MCQ {
  question: string;
  options: string[];
  answer?: string; // 'answer' is present in generated JSON for evaluation
  explanation?: string; // 'explanation' is present in evaluation's new questions
}

interface UserAnswer {
  question: string;
  userAnswer: string;
  correctAnswer: string;
}

interface GenerateQuizResponse {
  generatedMCQs?: MCQ[]; // For JSON format
  generatedMCQsHTML?: string; // For HTML format
}

interface EvaluateQuizResponse {
  topic: string;
  weak: boolean;
  wrongAnswers: number;
  newQuestions: MCQ[] | string | null; // Can be JSON or HTML
}

/**
 * QuizGenerator Component
 * Allows users to input quiz topic, number of questions, and desired format.
 * Triggers the /api/generate endpoint.
 */
interface QuizGeneratorProps {
  onGenerate: (topic: string, format: 'html' | 'json', count: number) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const QuizGenerator: React.FC<QuizGeneratorProps> = ({ onGenerate, isLoading, error }) => {
  const [topic, setTopic] = useState<string>('');
  const [format, setFormat] = useState<'html' | 'json'>('json');
  const [count, setCount] = useState<number>(5);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (topic.trim()) {
      await onGenerate(topic, format, count);
    }
  };

  return (
    <div className="card shadow-lg mb-4">
      <div className="card-body p-4 p-md-5">
        <h2 className="card-title text-center mb-4 text-primary">Generate New Quiz</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="topic" className="form-label">
              Quiz Topic:
            </label>
            <input
              type="text"
              id="topic"
              value={topic}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTopic(e.target.value)}
              placeholder="e.g., Quantum Physics, World History, React Hooks"
              className="form-control"
              required
            />
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <label htmlFor="count" className="form-label">
                Number of Questions:
              </label>
              <input
                type="number"
                id="count"
                value={count}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                max="20"
                className="form-control"
                required
              />
            </div>
            <div className="col-md-6">
              <label htmlFor="format" className="form-label">
                Output Format:
              </label>
              <select
                id="format"
                value={format}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormat(e.target.value as 'html' | 'json')}
                className="form-select"
              >
                <option value="json">JSON</option>
                <option value="html">HTML</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className={`btn btn-primary w-100 py-2 ${isLoading ? 'disabled' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Generating Quiz...
              </>
            ) : (
              'Generate Quiz'
            )}
          </button>
          {error && <p className="text-danger text-center mt-3">{error}</p>}
        </form>
      </div>
    </div>
  );
};

/**
 * QuizDisplay Component
 * Displays the generated quiz questions and allows users to select answers.
 * Supports both HTML and JSON quiz formats.
 */
interface QuizDisplayProps {
  quizData: GenerateQuizResponse | null;
  onQuizSubmit: (answers: UserAnswer[], topic: string) => Promise<void>;
  isLoadingEvaluation: boolean;
  quizTopic: string;
}

const QuizDisplay: React.FC<QuizDisplayProps> = ({ quizData, onQuizSubmit, isLoadingEvaluation, quizTopic }) => {
  const [userSelections, setUserSelections] = useState<{ [key: number]: string }>({});

  // Reset user selections when quizData changes
  useEffect(() => {
    setUserSelections({});
  }, [quizData]);

  const handleOptionChange = (questionIndex: number, selectedOption: string) => {
    setUserSelections((prev) => ({
      ...prev,
      [questionIndex]: selectedOption,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!quizData || !quizData.generatedMCQs) return;

    const answers: UserAnswer[] = quizData.generatedMCQs.map((q, index) => ({
      question: q.question,
      userAnswer: userSelections[index] || '', // Default to empty string if no answer
      correctAnswer: q.answer || '', // Ensure correctAnswer is always defined
    }));
    await onQuizSubmit(answers, quizTopic);
  };

  if (!quizData) {
    return null; // Don't render if no quiz data
  }

  // Handle HTML format
  if (quizData.generatedMCQsHTML) {
    return (
      <div className="card shadow-lg">
        <div className="card-body p-4 p-md-5">
          <h2 className="card-title text-center mb-4 text-dark">Your Quiz (HTML Format)</h2>
          <div
            className="prose" // Keep prose for basic styling if @tailwindcss/typography is still used or for general text flow
            dangerouslySetInnerHTML={{ __html: quizData.generatedMCQsHTML }}
          />
          <p className="text-danger text-center mt-4">
            HTML format does not support automated evaluation. Please generate a JSON quiz to evaluate.
          </p>
        </div>
      </div>
    );
  }

  // Handle JSON format
  if (quizData.generatedMCQs && quizData.generatedMCQs.length > 0) {
    return (
      <div className="card shadow-lg">
        <div className="card-body p-4 p-md-5">
          <h2 className="card-title text-center mb-4 text-dark">Your Quiz</h2>
          <div className="space-y-4"> {/* Custom class for spacing between questions */}
            {quizData.generatedMCQs.map((mcq, qIndex) => (
              <div key={qIndex} className="card mb-3">
                <div className="card-body">
                  <p className="card-text fw-semibold mb-2">
                    {qIndex + 1}. {mcq.question}
                  </p>
                  <ul className="list-unstyled">
                    {mcq.options.map((option, oIndex) => (
                      <li key={oIndex} className="form-check mb-2">
                        <input
                          type="radio"
                          id={`q${qIndex}-option${oIndex}`}
                          name={`question-${qIndex}`}
                          value={option}
                          checked={userSelections[qIndex] === option}
                          onChange={() => handleOptionChange(qIndex, option)}
                          className="form-check-input"
                        />
                        <label htmlFor={`q${qIndex}-option${oIndex}`} className="form-check-label">
                          {String.fromCharCode(65 + oIndex)}) {option}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleSubmitQuiz}
            className={`btn btn-success w-100 py-2 mt-4 ${isLoadingEvaluation ? 'disabled' : ''}`}
            disabled={isLoadingEvaluation}
          >
            {isLoadingEvaluation ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Evaluating...
              </>
            ) : (
              'Submit Quiz for Evaluation'
            )}
          </button>
        </div>
      </div>
    );
  }

  return <p className="text-center text-secondary">No quiz questions to display.</p>;
};

/**
 * QuizEvaluation Component
 * Displays the results of the quiz evaluation and, if the user is weak,
 * provides new questions and an option to retake a focused quiz.
 */
interface QuizEvaluationProps {
  evaluationResult: EvaluateQuizResponse | null;
  onGenerateNewQuiz: (topic: string, format: 'html' | 'json', count: number) => Promise<void>;
  isLoadingNewQuiz: boolean;
  newQuizError: string | null;
  currentQuizFormat: 'html' | 'json';
  quizData: GenerateQuizResponse | null; // Pass quizData to determine if new questions are JSON or HTML
}

const QuizEvaluation: React.FC<QuizEvaluationProps> = ({
  evaluationResult,
  onGenerateNewQuiz,
  isLoadingNewQuiz,
  newQuizError,
  currentQuizFormat,
  quizData,
}) => {
  if (!evaluationResult) {
    return null;
  }

  const { topic, weak, wrongAnswers, newQuestions } = evaluationResult;

  const handleRetakeQuiz = async () => {
    // Determine the format for the new quiz based on the original format generated.
    const format = quizData?.generatedMCQs ? 'json' : 'html'; // If original was JSON, new will be JSON
    await onGenerateNewQuiz(topic, format, 5); // Default to 5 questions for retake
  };

  return (
    <div className="card shadow-lg mt-4">
      <div className="card-body p-4 p-md-5">
        <h2 className="card-title text-center mb-4 text-dark">Quiz Evaluation Result</h2>
        <p className="card-text">
          <span className="fw-semibold">Topic:</span> {topic}
        </p>
        <p className="card-text">
          <span className="fw-semibold">Wrong Answers:</span> {wrongAnswers}
        </p>
        {weak ? (
          <>
            <p className="fs-5 fw-bold text-danger mt-4 text-center">
              You are weak in "{topic}". Here are some new questions to practice!
            </p>
            {newQuestions && (
              <div className="mt-3 p-3 bg-warning-subtle border border-warning rounded">
                <h3 className="fs-5 fw-semibold mb-3">Practice Questions:</h3>
                {currentQuizFormat === 'html' ? (
                   <div className="prose" dangerouslySetInnerHTML={{ __html: newQuestions as string }} />
                ) : (
                  <div className="space-y-3"> {/* Custom class for spacing */}
                    {(newQuestions as MCQ[]).map((q, index) => (
                      <div key={index} className="card mb-2">
                        <div className="card-body p-3">
                          <p className="card-text fw-semibold mb-1">
                            {index + 1}. {q.question}
                          </p>
                          <ul className="list-unstyled ps-3">
                            {q.options.map((opt, oIdx) => (
                              <li key={oIdx}>{opt}</li>
                            ))}
                          </ul>
                          <p className="text-success small mt-1">
                            <span className="fw-semibold">Answer:</span> {q.answer}
                          </p>
                          {q.explanation && (
                            <p className="text-muted small mt-1 fst-italic">
                              <span className="fw-semibold">Explanation:</span> {q.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={handleRetakeQuiz}
              className={`btn btn-info w-100 py-2 mt-4 ${isLoadingNewQuiz ? 'disabled' : ''}`}
              disabled={isLoadingNewQuiz}
            >
              {isLoadingNewQuiz ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Generating New Quiz...
                </>
              ) : (
                'Generate New Quiz on Weak Topic'
              )}
            </button>
            {newQuizError && <p className="text-danger text-center mt-3">{newQuizError}</p>}
          </>
        ) : (
          <p className="fs-5 fw-bold text-success mt-4 text-center">
            Great job! You performed well in "{topic}".
          </p>
        )}
      </div>
    </div>
  );
};

// Main App Component
const App: React.FC = () => {
  const [quizData, setQuizData] = useState<GenerateQuizResponse | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<EvaluateQuizResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingEvaluation, setIsLoadingEvaluation] = useState<boolean>(false);
  const [isLoadingNewQuiz, setIsLoadingNewQuiz] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [quizTopic, setQuizTopic] = useState<string>('');
  const [currentQuizFormat, setCurrentQuizFormat] = useState<'html' | 'json'>('json');

  // Handles generating the quiz based on user input
  const handleGenerateQuiz = async (topic: string, format: 'html' | 'json', count: number) => {
    setIsLoading(true);
    setError(null);
    setQuizData(null); // Clear previous quiz data
    setEvaluationResult(null); // Clear previous evaluation results
    setQuizTopic(topic);
    setCurrentQuizFormat(format);

    try {
      const response = await fetch(`${API_BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: topic, format, count }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate quiz.');
      }

      const data: GenerateQuizResponse = await response.json();

      // Ensure the correct data structure is set based on format
      if (format === 'json' && data.generatedMCQs) {
        setQuizData({ generatedMCQs: data.generatedMCQs });
      } else if (format === 'html' && data.generatedMCQsHTML) {
        setQuizData({ generatedMCQsHTML: data.generatedMCQsHTML });
      } else {
        throw new Error('Unexpected response format from API.');
      }
    } catch (err: any) {
      console.error('Error generating quiz:', err);
      setError(err.message || 'An unknown error occurred while generating the quiz.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handles submitting the quiz for evaluation
  const handleQuizSubmit = async (answers: UserAnswer[], topic: string) => {
    setIsLoadingEvaluation(true);
    setError(null); // Clear previous errors
    setEvaluationResult(null); // Clear previous evaluation results

    try {
      const response = await fetch(`${API_BASE_URL}/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic, answers, format: currentQuizFormat }), // Pass the format to evaluation API
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to evaluate quiz.');
      }

      const data: EvaluateQuizResponse = await response.json();

      // Clean newQuestions if it's a JSON string from the backend (for weak users)
      if (typeof data.newQuestions === 'string' && currentQuizFormat === 'json') {
          try {
              const cleanedText = cleanJsonString(data.newQuestions);
              data.newQuestions = JSON.parse(cleanedText);
          } catch (parseError) {
              console.error("Failed to parse newQuestions JSON:", parseError);
              // Fallback or handle parsing error for new questions
          }
      }

      setEvaluationResult(data);
    } catch (err: any) {
      console.error('Error evaluating quiz:', err);
      setError(err.message || 'An unknown error occurred during quiz evaluation.');
    } finally {
      setIsLoadingEvaluation(false);
    }
  };

  // Handles generating new questions after evaluation (if weak)
  const handleGenerateNewQuizBasedOnEvaluation = async (
    topic: string,
    format: 'html' | 'json',
    count: number
  ) => {
    setIsLoadingNewQuiz(true);
    setError(null);
    setQuizData(null); // Clear the previous quiz
    setEvaluationResult(null); // Clear previous evaluation results

    try {
      const response = await fetch(`${API_BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: topic, format, count }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate new quiz after evaluation.');
      }

      const data: GenerateQuizResponse = await response.json();

      if (format === 'json' && data.generatedMCQs) {
        setQuizData({ generatedMCQs: data.generatedMCQs });
      } else if (format === 'html' && data.generatedMCQsHTML) {
        setQuizData({ generatedMCQsHTML: data.generatedMCQsHTML });
      } else {
        throw new Error('Unexpected response format for new quiz.');
      }
    } catch (err: any) {
      console.error('Error generating new quiz:', err);
      setError(err.message || 'An unknown error occurred while generating new questions.');
    } finally {
      setIsLoadingNewQuiz(false);
    }
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-column align-items-center py-5">
      <div className="container">
        <h1 className="display-4 text-center text-primary mb-5">
          Dynamic Quiz Generator
        </h1>

        <QuizGenerator
          onGenerate={handleGenerateQuiz}
          isLoading={isLoading}
          error={error}
        />

        {quizData && (
          <div className="mt-4">
            <QuizDisplay
              quizData={quizData}
              onQuizSubmit={handleQuizSubmit}
              isLoadingEvaluation={isLoadingEvaluation}
              quizTopic={quizTopic}
            />
          </div>
        )}

        {evaluationResult && (
          <div className="mt-4">
            <QuizEvaluation
              evaluationResult={evaluationResult}
              onGenerateNewQuiz={handleGenerateNewQuizBasedOnEvaluation}
              isLoadingNewQuiz={isLoadingNewQuiz}
              newQuizError={error}
              currentQuizFormat={currentQuizFormat}
              quizData={quizData}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
