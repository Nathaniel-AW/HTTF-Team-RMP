# HTTF Team RMP

RateMyProfessors URL in, AI summary/score/chat out.

## Stack

- Vite + React frontend
- Node + Express backend
- Python Selenium scraper (`RMPScraper.py`)
- OpenAI API

## Local setup

1. Install dependencies:
   - `npm install`
   - `pip install -r requirements.txt`
2. Create `.env` with:
   - `OPENAI_API_KEY=your_key_here`
3. Run backend API:
   - `npm run server`
4. Run frontend:
   - `npm run dev`

## API

### `POST /api/reviews/summary`
Alias: `POST /api/summarize`

Request:

```json
{
  "professorUrl": "https://www.ratemyprofessors.com/professor/3126905"
}
```

Response:

```json
{
  "summaryParagraph": "string",
  "numericScore": 0,
  "scoreExplanation": "string",
  "professorContext": {
    "professorName": "string",
    "schoolName": "string",
    "department": "string",
    "ratingStats": {
      "overall": 0,
      "difficulty": 0,
      "wouldTakeAgain": 0
    },
    "reviewCount": 0,
    "reviewsSample": [
      {
        "date": "string",
        "rating": 0,
        "difficulty": 0,
        "tags": ["string"],
        "text": "string"
      }
    ]
  }
}
```

### `POST /api/chat`

Request:

```json
{
  "messages": [
    { "role": "user", "content": "How hard is this class?" }
  ],
  "professorContext": { "...": "context from summary response" }
}
```

Response:

```json
{
  "answer": "string"
}
```
