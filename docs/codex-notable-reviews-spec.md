# Codex Task: Add "Notable Reviews" Section on Professor Summary Page

## Context (Current App)
- Stack: Vite + React frontend, Node/Express backend, Python scraper.
- Route flow: `/endScore` -> `/courseSelection` -> `/summary`.
- The professor results page is [`src/pages/summary.jsx`](/Users/andrewngantung/Desktop/hacktothefuture2026/HTTF-Team-RMP/src/pages/summary.jsx).
- It currently renders:
  - 1 paragraph summary
  - numeric score + descriptor
  - chatbot panel
- Data source for this page is `POST /api/reviews/summary`.
- The response already includes `professorContext.reviewsSample`, so no backend API contract changes are required for this task.

## Objective
Add a new **Notable Reviews** section to the professor results page (`/summary`) that shows a curated subset of meaningful review snippets.

## Scope
- Keep existing behavior working:
  - summary generation
  - score display
  - chat functionality
  - course-filter flow
- Implement notable review selection on the frontend using `professorContext.reviewsSample`.
- Add styling in existing theme file.

## Files to Edit
1. [`src/pages/summary.jsx`](/Users/andrewngantung/Desktop/hacktothefuture2026/HTTF-Team-RMP/src/pages/summary.jsx)
2. [`src/styles/theme.css`](/Users/andrewngantung/Desktop/hacktothefuture2026/HTTF-Team-RMP/src/styles/theme.css)

## Functional Requirements
1. Add a new card titled `Notable Reviews` in `/summary`.
2. Place it below the existing summary/score/chat grid so it is clearly visible on desktop and mobile.
3. Show 3-5 notable review snippets (target 4).
4. For each review item, render:
  - sentiment badge (`Positive`, `Mixed`, or `Critical`)
  - optional metadata line (rating and/or date if present)
  - review text snippet
5. If no usable review text is available, show a fallback message like `No notable written reviews available.`

## Selection Logic (Deterministic, Frontend)
Create helper logic in `summary.jsx` to pick notable reviews from `professorContext.reviewsSample`:

1. Start from `reviewsSample` array (if missing, use empty array).
2. Filter out unusable text:
  - empty text
  - placeholder text like `No written comment provided.`
3. Deduplicate by normalized review text (trim + lowercase).
4. Bucket by rating:
  - `Positive`: rating >= 4
  - `Critical`: rating <= 2
  - `Mixed`: everything else / unknown rating
5. Build final list in this order:
  - first positive
  - first critical
  - first mixed
  - remaining slots filled from longest remaining reviews
6. Cap list to 4 items.

This keeps results varied and stable without backend changes.

## UI/Style Requirements
Use existing card language and add minimal new classes in `theme.css`, for example:
- `.notable-reviews-list`
- `.notable-review-item`
- `.notable-review-meta`
- `.notable-review-text`

Design constraints:
- Match current visual style (borders, radii, spacing, muted text colors).
- Preserve responsive behavior (`@media` blocks already in `theme.css`).
- Do not break existing `.results-grid`, `.results-side`, `.chat-panel` styling.

## Accessibility Requirements
- Keep semantic structure inside the card (`ul`/`li` for list).
- Ensure badge + metadata remain readable in both default and light theme.
- No interactive controls are required for this feature.

## Non-Goals
- No backend model changes.
- No changes to scraper logic.
- No new routes or API endpoints.
- No chatbot behavior changes.

## Acceptance Criteria
1. `/summary` still loads summary, score, and chat as before.
2. A new `Notable Reviews` card appears with up to 4 curated snippets.
3. Empty/placeholder comments are not shown.
4. Layout works on desktop and mobile.
5. No console errors introduced by the new section.

## Manual Test Checklist
1. Run backend: `npm run server`
2. Run frontend: `npm run dev`
3. Use a valid professor URL and continue through course selection.
4. Confirm `Summary`, `Score`, and `Ask about this professor` still behave unchanged.
5. Confirm `Notable Reviews` appears and shows varied sentiment when data allows.
6. Confirm graceful fallback message when review text is sparse.

## Suggested Commit Message
`feat(summary): add notable reviews section using existing professor context`
