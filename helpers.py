from flask import redirect, session, url_for
from functools import wraps
import sqlite3


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kargs):
        if session.get("user_id") is None:
            return redirect(url_for("login"))
        
        return f(*args, **kargs)
    
    return decorated_function


def sql_conn():
    connection = sqlite3.connect("database.db")
    connection.execute("PRAGMA foreign_keys = ON")

    return connection