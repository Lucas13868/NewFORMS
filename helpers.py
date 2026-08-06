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
    # UUID v7 to avoid database page splitting and index fragmentation 
    return str(uuid7()) 


# Get options for questions
def get_options(questions, cursor):
    questions_ids = [q[0] for q in questions if q[1] in {"radio", "checkbox"}]
    ids_placeholder = ",".join("?" for _ in questions_ids)
    options = {q_id: [] for q_id in questions_ids}

    if questions_ids:
        query = f"""
            SELECT id, option_text, question_id FROM options
            WHERE question_id IN ({ids_placeholder})
        """

        cursor.execute(query, questions_ids)
        all_rows = cursor.fetchall()

        for op_id, op_text, q_id in all_rows:
            options[q_id].append((op_id, op_text))

    return options


# Generate a SHA-256 hash for the data
def generate_hash(data):
    # Sorts data to ensure the hash is always the same even in a different order
    sorted_data = json.dumps(data, sort_keys=True).encode("utf-8")
    return hashlib.sha256(sorted_data).hexdigest()


# Search if the ai-made analysis is already in cache
def search_analysis(form_id):
    conn = read_conn()
    cursor = conn.cursor()

    cursor.execute("SELECT data_hash, html_content FROM analysis_cache WHERE form_id = ?", (form_id,))
    analysis = cursor.fetchone()

    conn.close()

    return analysis


# Save an ai analysis in cache
def save_analysis_in_cache(form_id, hash, html):
    conn = write_conn()
    cursor = conn.cursor()

    try:
        with conn:
            cursor.execute("""
                           INSERT INTO analysis_cache 
                           (form_id, data_hash, html_content) VALUES (?, ?, ?)
                           ON CONFLICT (form_id) DO UPDATE SET
                           data_hash = excluded.data_hash,
                           html_content = excluded.html_content,
                           update_date = CURRENT_TIMESTAMP;
                                                                      """, 
                                                                      (form_id, hash, html)
                                                                      )

        conn.close()
        return True
    
    except Exception as e:
        print(str(e))
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


