from flask import Flask, render_template, redirect, request, flash, url_for, session, jsonify
from flask_bcrypt import Bcrypt
from dotenv import load_dotenv
import sqlite3
import os

from helpers import login_required, read_conn, write_conn, generate_uuid

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

# Allow db simultaneous write and read
conn = sqlite3.connect("database.db")
conn.execute("PRAGMA journal_mode=WAL;")
conn.close()

# Home page
@app.route("/")
@login_required
def index():
    user_id = session["user_id"]

    connection = read_conn()
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
        user_id = generate_uuid()

        connection = write_conn()
        cursor = connection.cursor()
        
        try:
            with connection: # Starts transaction
                cursor.execute("INSERT INTO users (id, username, hash, email) VALUES (?, ?, ?, ?)", (user_id, name, pwd_hash, email)) # insert user in db

            connection.close()
                
        except sqlite3.IntegrityError: # if email has already been used, returns an error
            flash("Email already registered!", "error")

            connection.close()
            return redirect(url_for("register"))
        
        except Exception as e:
            flash("Something went wrong! Try again later.", "error")
            print(f"Error: {e}")

            connection.close()
            return redirect(url_for("register"))
        

        session["user_id"] = user_id
        session.permanent = True # saves user session for different browser sessions

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
        
        connection = read_conn()
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
@app.route("/api/create-form")
@login_required
def create_form():
    user_id = session["user_id"]

    connect = write_conn()
    cursor = connect.cursor()

    form_id = generate_uuid()

    text_id = generate_uuid()
    radio_id = generate_uuid()
    checkbox_id = generate_uuid()

    try:
        with connect:
            cursor.execute("INSERT INTO forms (id, user_id) VALUES (?, ?)", (form_id, user_id))

            cursor.execute("INSERT INTO questions (id, form_id, type, question_text, quest_order) VALUES (?, ?, ?, ?, ?)", (text_id, form_id, 'text', 'Text question', 1))
            cursor.execute("INSERT INTO questions (id, form_id, type, question_text, quest_order) VALUES (?, ?, ?, ?, ?)", (radio_id, form_id, 'radio', 'Multi options question', 2))
            cursor.execute("INSERT INTO questions (id, form_id, type, question_text, quest_order) VALUES (?, ?, ?, ?, ?)", (checkbox_id, form_id, 'checkbox', 'Checkbox question', 3))


            for i in range(3):
                cursor.execute("INSERT INTO options (id, question_id, option_text) VALUES (?, ?, ?)", (generate_uuid(), radio_id, f'Option{i + 1}'))

            for i in range(3):
                cursor.execute("INSERT INTO options (id, question_id, option_text) VALUES (?, ?, ?)", (generate_uuid(), checkbox_id, f'Option{i + 1}'))

        connect.close()

        return redirect(f"/e/{form_id}")

    except Exception as e:
        print(f"Error during form creation: {e}")

        connect.close()

        return redirect(url_for("index"))

# Delete form from db
@app.route("/api/delete-form", methods=["POST"])
def delete_form():
    form_id = request.form.get("form_id")
    user_id = session["user_id"]

    connect = write_conn()
    cursor = connect.cursor()

    try:
        with connect:
            cursor.execute("DELETE FROM forms WHERE id = ? AND user_id = ?", (form_id, user_id))
    except Exception as e:
        print("Error while deleting form: ", e)

    connect.close()

    return redirect(url_for("index"))

# Enter in form's edit page
@app.route("/e/<uuid:form_id>")
@login_required
def edit_form(form_id):
    form_id = str(form_id)

    connect = read_conn()
    cursor = connect.cursor()

    cursor.execute("SELECT name, title, description FROM forms WHERE id = ? AND user_id = ?", (form_id, session["user_id"]))
    form = cursor.fetchone() # Get form

    if not form:
        connect.close()
        return redirect("/")
    
    cursor.execute("SELECT id, type, question_text, quest_order, required FROM questions WHERE form_id = ? ORDER BY quest_order", (form_id,))
    questions = cursor.fetchall() # Get all form questions

    options = {}
    for q in questions:
        if q[1] in ["radio", "checkbox"]:
            cursor.execute("SELECT id, option_text FROM options WHERE question_id = ?", (q[0],))
            q_opts = cursor.fetchall()

            if q_opts:
                options[q[0]] = q_opts # Storage each option for a certain question {question_id: [list of options]}
    

    connect.close()

    return render_template("form_edit.html", form=form, questions=questions, options=options, form_id=form_id)

# Save changes made in form's edit
@app.route("/api/save-changes/<uuid:form_id>", methods=['POST'])
@login_required
def save_changes(form_id): # save changes from forms in database
    form_id = str(form_id)

    json = request.get_json()
    changes = json.get("changes", [])
    
    connect = write_conn()
    cursor = connect.cursor()
    
    try:
        with connect:
            for item in changes:
                table = item.get("table")
                action = item.get("action")
                uuid = item.get("id")
                data = item.get("data")
                
                match table:
                    case "forms":
                        if "form-name" in data:
                            cursor.execute("UPDATE forms SET name = ? WHERE id = ?", (data.get("form-name").strip(), form_id))
                        if "form-title" in data:
                            cursor.execute("UPDATE forms SET title = ? WHERE id = ?", (data.get("form-title").strip(), form_id))
                        if "form-description" in data:
                            cursor.execute("UPDATE forms SET description = ? WHERE id = ?", (data.get("form-description"), form_id))

                    case "questions":
                        match action:
                            case "CREATE":
                                cursor.execute("INSERT INTO questions (id, type, question_text, quest_order, form_id) VALUES (?, ?, ?, ?, ?)", 
                                            (uuid, data.get("type"), data.get("text"), data.get("order"), form_id))
                                
                            case "UPDATE":
                                if "text" in data:
                                    cursor.execute("UPDATE questions SET question_text = ? WHERE id = ?", (data.get("text").strip(), uuid))
                                if "required" in data:
                                    cursor.execute("UPDATE questions SET required = ? WHERE id = ?", (data.get("required"), uuid))
                                if "type" in data:
                                    cursor.execute("UPDATE questions SET type = ? WHERE id = ?", (data.get("type"), uuid))
                                if "order" in data:
                                    cursor.execute("UPDATE questions SET quest_order = ? WHERE id = ?", (data.get("order"), uuid))

                            case "DELETE":
                                cursor.execute("DELETE FROM questions WHERE id = ?", (uuid,))

                            case _:
                                raise Exception("Invalid action!")
                    case "options":
                        match action:
                            case "CREATE":
                                cursor.execute("INSERT INTO options (id, option_text, question_id) VALUES (?, ?, ?)", (uuid, data.get("value"), data.get("quest_id")))
                            case "UPDATE":
                                if "value" in data:
                                    cursor.execute("UPDATE options SET option_text = ? WHERE id = ?", (data.get("value").strip(), uuid))
                            case "DELETE":
                                cursor.execute("DELETE FROM options WHERE id = ?", (uuid,))
                            case _:
                                raise Exception("Invalid action!")
                    case _:
                        raise Exception("Table don't exist!")

        connect.close()

        return jsonify({"msg": "Changes saved!", "status": "ok"})
    
    except Exception as e:
        print(f"Error: {str(e)}")
        
        connect.close()
        
        return jsonify({"msg": str(e), "status": "error"}), 500


# Visualize the form ready to work
@app.route("/v/<uuid:form_id>")
def view_form(form_id):
    form_id = str(form_id)

    connect = read_conn()
    cursor = connect.cursor()

    cursor.execute("SELECT title, description FROM forms WHERE id = ?", (form_id,))
    form = cursor.fetchone()

    if not form:
        print("Form doesn't exist!")
        connect.close()
        return redirect(url_for("index"))

    cursor.execute("SELECT id, type, question_text, required FROM questions WHERE form_id = ? ORDER BY quest_order", (form_id,))
    questions = cursor.fetchall()

    options = {}
    for q in questions:
        if q[1] in ["radio", "checkbox"]:
            cursor.execute("SELECT id, option_text FROM options WHERE question_id = ?", (q[0],))
            q_opts = cursor.fetchall()

            if q_opts:
                options[q[0]] = q_opts # Storage each option for a certain question {question_id: [list of options]}

    connect.close()
    
    return render_template("form_view.html", form=form, questions=questions, options=options, form_id=form_id)


# Register the form's response
@app.route("/submit/<uuid:form_id>", methods=["POST"])
def register_response(form_id):
    form_id = str(form_id)

    connect = write_conn()
    cursor = connect.cursor()

    cursor.execute("SELECT id, type, required FROM questions WHERE form_id = ? ORDER BY quest_order", (form_id,))
    questions = cursor.fetchall()

    if not questions:
        print("Form doesn't exist!")
        connect.close()
        return redirect(url_for("index"))

    try:
        with connect:
            response_id = generate_uuid()
            cursor.execute("INSERT INTO responses (id, form_id) VALUES (?, ?)", (response_id, form_id))
            
            for question in questions:
                answer = request.form.getlist(question[0])

                # Certify that user didn't changed the values
                if question[1] in ["radio", "checkbox"]: 
                    cursor.execute("SELECT option_text FROM options WHERE question_id = ?", (question[0],))
                    options = cursor.fetchall()
                    options = [opt[0] for opt in options]

                    answer = [value for value in answer if value in options]

                # Certify that a required question was sended
                if not answer and question[2]:
                    raise Exception("Required question missing!")

                for value in answer:
                    if value != '':
                        answer_id = generate_uuid()
                        cursor.execute("INSERT INTO answers (id, answer_text, question_id, response_id) VALUES (?, ?, ?, ?)", (answer_id, value, question[0], response_id))

        cursor.execute("SELECT title FROM forms WHERE id = ?", (form_id,))
        title = cursor.fetchone()[0]

        connect.close()
        return render_template("form_submitted.html", form_id=form_id, title=title, msg="Your response has been recorded.")

    except Exception as e:
        print("Error: " + str(e))

        cursor.execute("SELECT title FROM forms WHERE id = ?", (form_id,))
        title = cursor.fetchone()[0]

        connect.close()
        return render_template("form_submitted.html", form_id=form_id, title=title, msg="Something went wrong, try again later!")



if __name__ == "__main__":
    app.run(debug=True)


