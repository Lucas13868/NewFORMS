from flask import redirect, session, url_for
from functools import wraps


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kargs):
        if session.get("user_id") is None:
            return redirect(url_for("login"))
        
        return f(*args, **kargs)
    
    return decorated_function