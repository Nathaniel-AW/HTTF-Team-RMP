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

## Optional RAG enrichment env vars

- `SEARCH_API_KEY=...`
- `SEARCH_ENGINE_ID=...` (Google Custom Search Engine ID)
- `RAG_TOP_K=10`
- `PROFILE_WEIGHT=0.15`
- `REVIEWS_WEIGHT=0.85`
- `CACHE_TTL_DAYS=7`
- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`

If search credentials are missing, analysis falls back to review-only mode and returns an enrichment warning.

## Supabase schema

- SQL migration for RAG tables + pgvector is in:
  - `supabase/migrations/202603010001_rag_professor_enrichment.sql`

## API

### `POST /api/professor/analyze`

Request:

```json
{
  "rmpUrl": "https://www.ratemyprofessors.com/professor/3126905",
  "selectedCourses": ["CS 61A"]
}
```

Response (shape):

```json
{
  "professor": { "id": "...", "name": "...", "school": "...", "department": "...", "lastRefreshed": "..." },
  "summary": "string",
  "summaryCitations": ["c1"],
  "score": {
    "total": 0,
    "reviews": 0,
    "profile": 0,
    "weights": { "reviews": 0.85, "profile": 0.15 },
    "explanation": {
      "reviews_component_reasoning": "string",
      "profile_component_reasoning": "string"
    }
  },
  "achievements": [{ "text": "string", "citations": ["c1"] }],
  "citations": [{ "id": "c1", "title": "string", "url": "https://...", "domain": "example.edu" }],
  "warnings": [],
  "enrichment": { "enabled": true, "warning": "", "retrievedSources": 0, "indexedChunks": 0 }
}
```

### `POST /api/professor/chat`

Request:

```json
{
  "professorId": "...",
  "message": "What awards does this professor have?",
  "recentMessages": [{ "role": "user", "content": "..." }]
}
```

Response:

```json
{
  "answer": "string",
  "citations": [{ "id": "c1", "title": "string", "url": "https://...", "domain": "example.edu" }]
}
```

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
  "summary": "string",
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
