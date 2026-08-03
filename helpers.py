from flask import redirect, session, url_for
from functools import wraps
import sqlite3
from uuid import uuid7


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