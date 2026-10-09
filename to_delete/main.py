from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from to_delete.grader import grade

app = FastAPI()

# Fake "database". The reference/rubric NEVER leaves this file.
QUESTIONS = {
    "m1": {
        "prompt": "A ball is dropped from 20 m. How long until it hits the ground? (g=9.8)",
        "reference": "t = sqrt(2h/g) = sqrt(40/9.8) ≈ 2.02 s",
    },
    "h1": {
        "prompt": "Argue whether civil disobedience can be justified in a democracy.",
        "reference": """RUBRIC (open-ended, no single answer):
        1. Defines civil disobedience vs ordinary law-breaking.
        2. Takes a clear position.
        3. Gives a principled argument (justice vs legality).
        4. Addresses the counterargument (undermining rule of law).
        5. Uses a concrete example or analogy.""",
    },
}

class Attempt(BaseModel):
    question_id: str
    student_answer: str
    attempt: int = 1

# Serve the website at the root URL
@app.get("/")
def home():
    return FileResponse("static/index.html")

# Give the browser the list of questions (prompts only, NO answers)
@app.get("/questions")
def questions():
    return [{"id": k, "prompt": v["prompt"]} for k, v in QUESTIONS.items()]

# Grade an answer
@app.post("/check")
def check(a: Attempt):
    q = QUESTIONS.get(a.question_id)
    if not q:
        raise HTTPException(404, "unknown question")
    r = grade(q["prompt"], q["reference"], a.student_answer, a.attempt)
    return {  # only safe fields go back to the browser
        "closeness": r["closeness"],
        "temperature": r["temperature"],
        "hint": r["hint"],
        "is_correct": r["is_correct"],
    }
