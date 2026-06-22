from flask import Flask, render_template, redirect, request, flash, url_for, session, jsonify
from flask_bcrypt import Bcrypt
from dotenv import load_dotenv
import sqlite3
import os

from helpers import login_required

load_dotenv()

app = Flask(__name__)
bcrypt = Bcrypt(app)

app.secret_key = os.environ.get("SECRET_KEY")

# Session configuration for security and user experience
app.config.update(
    SESSION_COOKIE_HTTPONLY=True, # avoid JS injections (XSS)
    SESSION_COOKIE_SECURE=False, # require HTTPS (cookie won't be sent in HTTP) # FALSE FOR LOCAL TESTS
    SESSION_COOKIE_SAMESITE="Lax", # protect against CSRF attacks
    PERMANENT_SESSION_LIFETIME=3600 # expire session after 1 hour
)

# Home page
@app.route("/")
@login_required
def index():
    user_id = session["user_id"]

    connection = sqlite3.connect("database.db")
    cursor = connection.cursor()

    cursor.execute("SELECT username FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()[0]

    cursor.execute("SELECT name, id, created_at FROM forms WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    forms = cursor.fetchall()


    connection.close()

    return render_template("home.html", user=user, forms=forms)

# Register new user
@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "GET":
        return render_template("register.html")
    else:
        name = request.form.get("name").strip()
        email = request.form.get("email")
        pwd = request.form.get("password")
        cfm_pwd = request.form.get("confirmation")

        if not email or not pwd or not cfm_pwd or not name: # verify data presence
            flash("Missing information!", "error")
            return redirect(url_for("register"))
        
        if pwd != cfm_pwd: # verify if passwords match
            flash("Passwords doesn't match!", "error")
            return redirect(url_for("register"))
        
        if len(pwd) < 8: # verify password lenght
            flash("Your password must be at least 8 characters long.", "error")
            return redirect(url_for("register"))
        
        pwd_hash = bcrypt.generate_password_hash(pwd).decode('utf-8') # encrypt password
        connection = sqlite3.connect("database.db")
        cursor = connection.cursor()
        
        try:
            cursor.execute("INSERT INTO users (username, hash, email) VALUES (?, ?, ?)", (name, pwd_hash, email)) # insert user in db
            connection.commit()
        except sqlite3.IntegrityError: # if email has already been used, returns an error
            flash("Email already registered!", "error")
            connection.close()
            return redirect(url_for("register"))
        except Exception as e:
            flash("Something went wrong! Try again later.")
            connection.close()
            return redirect(url_for("register"))
        
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        user_id = cursor.fetchone()

        session["user_id"] = user_id[0] 
        session.permanent = True # saves user session for different brower sessions

        connection.close()

        return redirect(url_for("index"))
        
# User Login
@app.route("/login", methods=["POST", "GET"])
def login():
    if request.method == "GET":
        return render_template("login.html")
    else:
        session.clear()

        email = request.form.get("email")
        pwd = request.form.get("password")

        if not email:
            flash("Missing email!", "error")
            return redirect(url_for("login"))
        elif not pwd:
            flash("Missing password!", "error")
            return redirect(url_for("login"))
        
        connection = sqlite3.connect("database.db")
        cursor = connection.cursor()
        cursor.execute("SELECT hash, id FROM users WHERE email = ?", (email,))
        user_row = cursor.fetchone()

        if user_row is None:
            flash("Invalid email and/or password!", "error")
            connection.close()
            return redirect(url_for("login"))

        elif not bcrypt.check_password_hash(user_row[0], pwd):
            flash("Invalid email and/or password!", "error")
            connection.close()
            return redirect(url_for("login"))
        
        session["user_id"] = user_row[1]
        session.permanent = True

        connection.close()

        return redirect(url_for("index"))


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))   

# Create new form in db
@app.route("/create-form")
@login_required
def create_form():
    user_id = session["user_id"]

    connect = sqlite3.connect("database.db")
    cursor = connect.cursor()

    cursor.execute("INSERT INTO forms (user_id) VALUES (?)", (user_id,))
    connect.commit()

    cursor.execute("SELECT id FROM forms WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    form_id = cursor.fetchone()[0]

    cursor.execute("INSERT INTO questions (form_id, type, question_text) VALUES (?, ?, ?)", (form_id, 'text', 'Text question'))
    cursor.execute("INSERT INTO questions (form_id, type, question_text) VALUES (?, ?, ?)", (form_id, 'radio', 'Multi options question'))
    connect.commit()

    cursor.execute("SELECT id FROM questions WHERE form_id = ? AND type = 'radio'", (form_id,))
    radio_id = cursor.fetchone()[0]

    for i in range(3):
        cursor.execute("INSERT INTO options (question_id, option_text) VALUES (?, ?)", (radio_id, f'Option{i + 1}'))
    
    connect.commit()

    connect.close()
    return redirect(f"/e/{form_id}")

# Delete form from db
@app.route("/delete-form", methods=["POST"])
def delete_form():
    form_id = request.form.get("form_id")
    user_id = session["user_id"]

    connect = sqlite3.connect("database.db")
    cursor = connect.cursor()

    try:
        cursor.execute("DELETE FROM forms WHERE id = ? AND user_id = ?", (form_id, user_id))
        connect.commit()
    except Exception as e:
        print("Error while deleting form: ", e)

    connect.close()

    return redirect(url_for("index"))

# Enter in form's edit page
@app.route("/e/<int:form_id>")
@login_required
def edit_form(form_id):
    connect = sqlite3.connect("database.db")
    cursor = connect.cursor()

    cursor.execute("SELECT name, title, description FROM forms WHERE id = ? AND user_id = ?", (form_id, session["user_id"]))
    form = cursor.fetchone()

    connect.close()

    if not form:
        return redirect("/")

    return render_template("form_template.html", form=form, id=form_id)

# Save changes made in form's edit
@app.route("/save-changes", methods=['POST'])
@login_required
def save_changes(): # save changes from forms in database
    data = request.get_json()

    connect = sqlite3.connect("database.db")
    cursor = connect.cursor()
    
    cursor.execute("UPDATE forms SET name = ?, title = ?, description = ? WHERE id = ? AND user_id = ?", 
                   (data["file_title"].strip(), data["form_title"].strip(), data["form_description"].strip(), data["form_id"], session["user_id"]))

    connect.commit()
    connect.close()

    return jsonify({"msg": "Changes saved!"})
    

# TODO: Verify why sqlite foreign key cascade isn't working
# TODO: html to add the questions for a certain form

if __name__ == "__main__":
    app.run(debug=True)