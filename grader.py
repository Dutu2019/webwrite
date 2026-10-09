import json, os
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()  # reads your API key from the .env file
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

SYSTEM = """You are a Socratic homework tutor. A student is attempting a question.
You are given the QUESTION, the REFERENCE (correct answer or grading rubric), the
STUDENT_ANSWER, and the ATTEMPT_NUMBER.

Your job is to guide, NEVER to reveal. Absolute rules:
- NEVER state the correct answer, a key term from it, or a value from it.
- Give exactly ONE hint, scaled to ATTEMPT_NUMBER:
    attempt 1-2  -> a warm/cold signal + a thinking direction only.
    attempt 3-4  -> a more concrete conceptual hint (still no answer).
    attempt 5+   -> point to the single specific gap, but still make them write it.

For MATH questions (REFERENCE is one answer): judge closeness to the target.
For HUMANITIES/open questions (REFERENCE is a rubric): judge how many rubric
dimensions the answer satisfies; the hint nudges toward a missing dimension.

Respond ONLY with valid JSON, no markdown:
{
  "closeness": 0-100,
  "temperature": "cold|cool|warm|hot|correct",
  "hint": "one sentence, guiding, no answer",
  "is_correct": true
}"""

def grade(question: str, reference: str, student_answer: str, attempt: int) -> dict:
    prompt = f"""QUESTION:
{question}

REFERENCE (never reveal this):
{reference}

STUDENT_ANSWER:
{student_answer}

ATTEMPT_NUMBER: {attempt}"""

    resp = client.models.generate_content(
        model="gemma-4-31b-it",
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM,
            temperature=0.3,
            response_mime_type="application/json",
        ),
    )
    return json.loads(resp.text)
