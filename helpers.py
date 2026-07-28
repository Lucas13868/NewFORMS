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


def sql_conn():
    conn = sqlite3.connect("database.db", timeout=5.0)
    
    return conn


def write_conn():
    conn = sqlite3.connect(
        "database.db",
        isolation_level="IMMEDIATE",
        timeout=10.0,
        autocommit=False
        )
    
    conn.execute("PRAGMA foreign_keys = ON")

    return conn


def generate_uuid():
    return str(uuid7()) # UUID v7 to avoid database page splitting and index fragmentation 