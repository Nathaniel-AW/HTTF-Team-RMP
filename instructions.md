# LLM Review Extraction & Summary Specification

This document defines the complete contract for how the LLM must parse a professor reviews CSV, identify notable reviews, group them by course, generate course-level summaries, and output strictly valid JSON ready for rendering in the Summary UI. The response must contain JSON only and no explanatory text.

The input will be a CSV file containing the following case-sensitive columns: professor_name (string), school (string), school_id (string), course (string), rating (float between 1 and 5), date (string, ISO format preferred), and comment (string). All fields are required. Rows must be ignored if the comment is empty, null, or fewer than 20 words, if the rating is non-numeric, or if the rating falls outside the 1–5 range. The model must not hallucinate missing fields, must not modify course names, must not merge similar-looking course labels, and must not infer missing ratings.

All analysis must be strictly isolated by course. Reviews may only be analyzed alongside other reviews from the same course. Themes, sentiment, averages, and recurring patterns must not mix across courses. If a professor teaches multiple courses, each course must be treated independently and appear separately in the output.

A review is considered notable if it meets one or more of the following conditions: it has an extreme rating (greater than or equal to 4.5 or less than or equal to 2.0); it contains high specificity such as references to exams, assignments, projects, grading style, workload, lecture clarity, attendance policy, or course structure; it demonstrates strong positive or negative sentiment; it provides constructive insight explaining why something is good or bad; or it reinforces a recurring theme that appears in multiple reviews within the same course.

Each review must receive a notability_score between 0 and 5. A score of 0–1 indicates vague or low-value content, 2 indicates somewhat informative, 3 indicates informative, 4 indicates highly informative, and 5 indicates extremely detailed and insightful. Only reviews with notability_score greater than or equal to 3 may be included in the output. Scoring must be performed independently per course.

For each course, return a maximum of 3 to 5 notable reviews. Prioritize higher notability_score first, then more recent dates, and ensure sentiment diversity so the selection is not exclusively positive or exclusively negative. Exclude duplicate comments, near-duplicates, spam-like content, and generic statements such as “Great professor” or “Easy class.”

The output must be strictly valid JSON with no surrounding explanation. The structure must match the following format:

```json
{
  "professor_name": "string",
  "school": "string",
  "courses": [
    {
      "course": "CSE 12",
      "summary": {
        "overall_sentiment": "positive | mixed | negative",
        "common_themes": [
          "heavy_workload",
          "clear_lectures"
        ]
      },
      "notable_reviews": [
        {
          "rating": 5.0,
          "date": "2025-02-12",
          "comment": "Full review text...",
          "notability_score": 4,
          "tags": [
            "extreme_positive",
            "clear_lectures",
            "highly_specific"
          ]
        }
      ]
    }
  ]
}