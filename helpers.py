from flask import redirect, session, url_for
from functools import wraps
import sqlite3
from uuid import uuid7
from openai import OpenAI
import os
import json
import hashlib

# OpenRouter API client configuration
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ.get("OPENROUTER_API_KEY"),
    default_headers={
        "HTTP-Referer": "http://127.0.0.1:5000",
        "X-Title": "newFORMS"
    }
)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kargs):
        if session.get("user_id") is None:
            return redirect(url_for("login"))
        
        return f(*args, **kargs)
    
    return decorated_function


def read_conn():
    conn = sqlite3.connect("database.db", timeout=5.0)

    conn.execute("PRAGMA query_only = ON;")
    
    return conn


def write_conn():
    conn = sqlite3.connect(
        "database.db",
        isolation_level="IMMEDIATE",
        timeout=10.0,
        )
    
    conn.execute("PRAGMA foreign_keys = ON;")

    conn.autocommit = False

    return conn


def generate_uuid():
    return str(uuid7()) # UUID v7 to avoid database page splitting and index fragmentation 


# Get options for questions
def get_options(questions, cursor):
    options = {}

    for q in questions:
        if q[1] in ["radio", "checkbox"]:
            cursor.execute("SELECT id, option_text FROM options WHERE question_id = ?", (q[0],))
            q_opts = cursor.fetchall()

            if q_opts:
                options[q[0]] = q_opts # Storage each option for a certain question {question_id: [list of options]}

    return options


# Generate a SHA-256 hash for the data
def generate_hash(data):
    # Sorts data to ensure the hash is always the same even in a different order
    sorted_data = json.dumps(data, sort_keys=True).encode("utf-8")
    return hashlib.sha256(sorted_data).hexdigest()


# Search if the ai-made analysis is already in cache
def search_analysis(hash):
    conn = read_conn()
    cursor = conn.cursor()

    cursor.execute("SELECT html_content FROM analysis_cache WHERE data_hash = ?", (hash,))
    analysis = cursor.fetchone()

    conn.close()

    if not analysis:
        return None
    else:
        return analysis[0]


# Save an ai analysis in cache
def save_analysis_in_cache(hash, html):
    conn = write_conn()
    cursor = conn.cursor()

    try:
        with conn:
            cursor.execute("INSERT INTO analysis_cache (data_hash, html_content) VALUES (?, ?)", (hash, html))

        conn.close()
        return True
    
    except Exception:
        conn.close()
        return False


# Transform question-answers dict into markdown
def format_answers_to_md(data):
    report = []

    for payload in data.values():
        report.append(f"### Question: {payload["question"]}")

        if isinstance(payload["answers"], dict):
            report.append(f"Type: {payload["type"]} options (votes distribution)")
            report.append("| Option | number of votes |")
            report.append("| :--- | :--- |")

            for option, votes in payload["answers"].items():
                report.append(f"| {option} | {votes} |")

        elif isinstance(payload["answers"], list):
            report.append("Type: Text answer")
            report.append("Users comments:")

            for answer in payload["answers"]:
                clean_answer = str(answer).strip().replace("\n", " ")
                report.append(f"- \"{clean_answer}\"")

        report.append("\n---\n")

    return "\n".join(report)

# Get AI insights from the users' anwers
def ask_for_ai_analysis(data):
    md_data = format_answers_to_md(data)

    # Prompt that will be sent to AI
    prompt = f"""
    You are a data scientist and user experience (UX) expert.
    Analyze the following consolidated form response report:

    {md_data}

    Your task is to generate a critical analysis. Please:
    1. Summarize the quantitative data (multiple choice) pointing out clear trends.
    2. Analyze the sentiments and recurring topics in the text responses.
    3. Try to cross-reference both pieces of information (e.g., do the textual comments explain or justify the multiple-choice numbers?).
    4. Make your response as concise as possible while fulfilling the requests above.

    Keep in mind that for questions with checkbox options, users can select more than one answer; therefore, this type of question will generally have more responses than others.
    You do not need to analyze comments that mention the name of the person responsible for the response.
    You must respond in the language used in the questions, if it can't be identified, respond in English.
    Respond strictly structuring your output using simple HTML tags 
    (such as <p>, <ul>, <li>, <strong>, <h3>) for direct rendering.
    """

    try:
        response = client.chat.completions.create(
            model="openrouter/free",
            messages=[
                {"role": "system", "content": "You are a precise and straight-to-the-point data scientist and user experience (UX) expert."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        return response.choices[0].message.content
    
    except Exception as e:
        return f"<p>Error during AI analysis generation: {str(e)}</p>"
