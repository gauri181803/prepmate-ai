import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app: Express = express();
const port = process.env.PORT || 3000;
app.use(express.json());

function cleanJsonString(str: string): string {
  return str.replace(/```json\s*([\s\S]*?)```/g, '$1').trim();
}

// Health check
app.get('/', (req: Request, res: Response) => {
  res.send('Hello from the Express & TypeScript backend!');
});

// -------- /api/generate -------- //
app.post('/api/generate', async (req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const userInput: string = req.body.text;
  const format: 'html' | 'json' = req.body.format || 'json';
  const count: number = parseInt(req.body.count) || 10;

  console.log('📥 Incoming request:', { text: userInput, format, count });

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not set in environment');
    return res.status(500).json({ error: 'Server config error: missing API key' });
  }

  if (!userInput) {
    return res.status(400).json({ error: 'Please provide a "text" field in the JSON body.' });
  }

  let prompt = '';
  if (format === 'html') {
    prompt = `Generate ${count} multiple choice questions (MCQs) on the following topic. Output the MCQs as valid HTML with each question and its options in <ul> lists:

Topic: ${userInput}

Format Example:
<div>
  <p>1. What is ...?</p>
  <ul>
    <li>A) Option 1</li>
    <li>B) Option 2</li>
    <li>C) Option 3</li>
    <li>D) Option 4</li>
  </ul>
</div>`;
  } else if (format === 'json') {
    prompt = `Generate ${count} multiple choice questions (MCQs) on the following topic. Output the MCQs as a JSON array with this structure:

[
  {
    "question": "Question text?",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "answer": "Correct Option"
  }
]

Topic: ${userInput}`;
  } else {
    return res.status(400).json({ error: 'Invalid format. Use "json" or "html".' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelId = 'gemini-2.5-pro';

    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];

    const response = await genAI
      .getGenerativeModel({ model: modelId })
      .generateContentStream({
        contents,
        generationConfig: { responseMimeType: 'text/plain' as any },
      });

    let fullResponseText = '';
    for await (const chunk of response.stream) {
      if (chunk.text()) {
        fullResponseText += chunk.text();
      }
    }

    if (format === 'json') {
      try {
        const cleanedText = cleanJsonString(fullResponseText);
        const parsed = JSON.parse(cleanedText);
        return res.json({ generatedMCQs: parsed });
      } catch (parseError) {
        return res.status(500).json({
          error: 'Failed to parse JSON from Gemini response.',
          rawText: fullResponseText,
        });
      }
    } else {
      return res.json({ generatedMCQsHTML: fullResponseText });
    }
  } catch (error) {
    console.error('❌ Error generating content:', error);
    return res.status(500).json({ error: 'An error occurred while generating content.' });
  }
});


// -------- /api/evaluate -------- //
app.post('/api/evaluate', async (req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is missing.' });

  const { topic, answers, format = 'json', difficulty = 'medium', count = 5 } = req.body;
  if (!topic || !answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Please provide "topic" and "answers" array.' });
  }

  const wrongCount = answers.reduce(
    (total: number, a: any) => total + (a.userAnswer !== a.correctAnswer ? 1 : 0),
    0
  );

  const isWeak = wrongCount > 2;
  let newQuestions = null;

  if (isWeak) {
    let prompt = '';

    if (format === 'json') {
      prompt = `The student is weak in "${topic}". Generate ${count} ${difficulty}-level MCQs with the following format:

{
  "question": "The question",
  "options": ["A", "B", "C", "D"],
  "answer": "Correct option",
  "explanation": "Why the answer is correct"
}

Only return a clean JSON array. No markdown, no wrapping.`;
    } else {
      prompt = `The student is weak in "${topic}". Generate ${count} ${difficulty}-level MCQs in HTML. 
Use <p> for question, <ul> for options, and <p> for explanation. No extra text.`;
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

      const result = await model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'text/plain' as any },
      });

      let responseText = '';
      for await (const chunk of result.stream) {
        if (chunk.text()) responseText += chunk.text();
      }

      if (format === 'json') {
        const cleaned = cleanJsonString(responseText);
        newQuestions = JSON.parse(cleaned);
      } else {
        newQuestions = responseText;
      }
    } catch (err) {
      return res.status(500).json({ error: 'Could not generate follow-up questions.' });
    }
  }

  res.json({
    topic,
    weak: isWeak,
    wrongAnswers: wrongCount,
    newQuestions,
  });
});

app.listen(port, () => {
  console.log(`⚡️ Server running at http://localhost:${port}`);
});
