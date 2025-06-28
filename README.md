# MCQ Generator & Evaluator API

This is an AI-powered backend built with **Express.js** and **TypeScript**, integrated with **Google Gemini API**, for generating and evaluating Multiple Choice Questions (MCQs). It supports both JSON and HTML formats and adapts to user performance by generating follow-up questions if needed.

---

## 🛠️ Tech Stack

- **Node.js** with **Express**
- **TypeScript**
- **Google Generative AI (Gemini)**

---

## 📦 Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/gauri181803/prepmate-ai.git
   cd prepmate-ai

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Variables**

   Create a `.env` file in the root directory and add:

   ```env
   GEMINI_API_KEY=your_google_generative_ai_key
   PORT=3000
   ```

4. **Start the server**

   ```bash
   npm run dev  # or use ts-node if configured
   ```

---

## 🚀 API Endpoints

### ✅ Health Check

**GET /**
Returns a simple confirmation message that the server is running.

---

### 📘 Generate MCQs

**POST /api/generate**

Generates MCQs based on a topic, format, and count.

#### Request Body (JSON)

```json
{
  "text": "Photosynthesis",
  "format": "json",       // or "html"
  "count": 5
}
```

#### Successful Response (for JSON format)

```json
{
  "generatedMCQs": [
    {
      "question": "What is the primary source of energy for photosynthesis?",
      "options": ["Water", "Soil", "The Sun", "Oxygen"],
      "answer": "The Sun"
    }
  ]
}
```

#### Successful Response (for HTML format)

```json
{
  "generatedMCQsHTML": "<div><p>1. What is ...?</p><ul>...</ul></div>"
}
```

---

### 🧠 Evaluate Answers

**POST /api/evaluate**

Analyzes user's answers and generates remedial questions if they perform poorly.

#### Request Body

```json
{
  "topic": "Photosynthesis",
  "answers": [
    {
      "question": "What is ...?",
      "userAnswer": "B",
      "correctAnswer": "C"
    }
  ],
  "difficulty": "medium",    // optional
  "count": 5,                // optional
  "format": "json"           // or "html"
}
```

#### Response (if weak in topic)

```json
{
  "topic": "Photosynthesis",
  "weak": true,
  "wrongAnswers": 3,
  "newQuestions": [ 
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "answer": "B",
      "explanation": "..."
    }
  ]
}
```

---

## 📌 Notes

* Responses are streamed from Gemini and then parsed.
* Fallback and error handling are included for missing keys, invalid formats, and JSON parsing issues.
* Both `/api/generate` and `/api/evaluate` support `json` and `html` formats.
* JSON responses are cleaned and validated before sending back to client.

---

## 🧪 Example cURL Commands

**Generate MCQs**

```bash
curl -X POST http://localhost:3000/api/generate \
-H "Content-Type: application/json" \
-d '{"text":"Artificial Intelligence", "format":"json", "count":5}'
```

**Evaluate Answers**

```bash
curl -X POST http://localhost:3000/api/evaluate \
-H "Content-Type: application/json" \
-d '{"topic":"AI", "answers":[{"question":"...", "userAnswer":"A", "correctAnswer":"C"}]}'
```

---

## 📂 Project Structure

```
├── index.ts         # Main Express server
├── .env             # Environment variables
├── package.json
├── tsconfig.json
└── ...
```

---

## 🔐 Environment Variables

| Key              | Description                            |
| ---------------- | -------------------------------------- |
| `GEMINI_API_KEY` | Your Google Generative AI API key      |
| `PORT`           | Port for running the server (optional) |

---
