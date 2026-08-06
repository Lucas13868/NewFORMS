import { uuidv7 } from "https://unpkg.com/uuidv7@^1"

const form_id = document.querySelector(".form-container").dataset.id;

// Save form changes

let changes_done = [];
let can_save = true;

// Send changes made to backend
function send_changes() {
    if (!can_save) return;

    verify_order();

    if (changes_done.length === 0) return;

    const changes_to_save = [...changes_done];

    changes_done = [];

    fetch(`/api/save-changes/${form_id}`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({changes: changes_to_save})
    })
    .then(async res => {
        if (!res.ok) {
            const error_data = await res.json().catch(() => ({}));
            throw new Error(error_data.msg || "Unknown server error");
        }
        return res.json();
    })
    .then(data => {
        change_feedback_msg(data.msg);
    })
    .catch(error => {
        console.error("Request failed: ", error.message);
        change_feedback_msg("Something went wrong! (reloading...)");
        can_save = false;
        setTimeout(() => location.reload(), 3000);
    });
}

// Sets a debounce and max wait to send changes
// Send after 2 sec of inactivity or 10 sec of activity
const debounced_save = _.debounce(send_changes, 2000, {
    maxWait: 10000
});


// Verify if new change already exists
function verify_change_existence(table, id, field, value) {
    const existingElem = changes_done.find(item => 
        item.table === table && item.id === id && (item.action === "CREATE" || item.action === "UPDATE")
    );

    if (existingElem) { // If the question was already changed, update the queue
        existingElem.data[field] = value;
    }
    else { // If doesn't exist, add a new change in the queue
        changes_done.push({
            table: table, 
            id: id, 
            action: "UPDATE", 
            data: {[field]: value}
        });
    }
}

// Register each change made
function register_change(table, id, field, value) {

    verify_change_existence(table, id, field, value)
    
    debounced_save();

    change_feedback_msg("Saving...");
}

// Observes changes made in ellements wich the debounce is applied
document.body.addEventListener("input", event => {
    const elem = event.target;

    if (elem.hasAttribute('data-table') && elem.hasAttribute('data-id')) {
        const table = elem.getAttribute('data-table');
        const id = elem.getAttribute("data-id");
        const field = elem.getAttribute("data-field");
        
        let value = elem.innerText;
        if (elem.type === "checkbox") {
            value = elem.checked;
        }
        
        register_change(table, id, field, value);
    }
});


const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)) // Sets a sleep function

async function empty_replace(el, txt) { // Fill an editable div's space if empty
    if (el.innerHTML === "") {
        await sleep(1500);

        if (el.innerHTML === "") {
            el.innerHTML = txt;

            const table = el.getAttribute('data-table');
            const id = el.getAttribute("data-id");
            const field = el.getAttribute("data-field");

            register_change(table, id, field, txt);
        }
    }
}

document.querySelectorAll("[contenteditable]").forEach(el => {
    el.addEventListener("input", () => {
        if (el.innerHTML === "<br>" || el.innerHTML === "") { // Cleans the input section for the placeholder
            el.innerHTML = "";
        }

        if (el.classList.contains("form-title")) { // If empty fill the form title space with "Title"
            empty_replace(el, "Title");
        }
        if (el.classList.contains("form-name")) { // If empty fill the form name space with "Form"
            empty_replace(el, "Form");
        }
        
    });
});

// Avoid user adding more characters than allowed
document.querySelectorAll(".max-length").forEach(elem => { 
    elem.addEventListener("beforeinput", event => {
        const max_char = parseInt(elem.getAttribute("data-max") || 0, 10);
        
        if (!max_char) return;
        
        if (event.inputType.startsWith('insert')) {
            const current_text = elem.innerText || "";
            const next_char = event.data || "";

            const selected_text = window.getSelection().toString();

            const next_length = current_text.length + next_char.length - selected_text.length;
            
            if (next_length > max_char) {
                event.preventDefault();
            }
        }
        
    });
});

// Avoid user adding more characters than allowed with 'paste'
document.querySelectorAll(".max-length").forEach(elem => {
    elem.addEventListener("paste", event => {
        event.preventDefault();

        const max_char = parseInt(elem.getAttribute("data-max") || 0, 10);

        if (!max_char) return;

        const current_text = elem.innerText || "";
        const selected_text = window.getSelection().toString();

        const chars_left = max_char - (current_text.length - selected_text.length);

        if (chars_left <= 0) return;

        const pasted_text = (event.clipboardData || window.clipboardData).getData('text');
        const truncated_text = pasted_text.substring(0, chars_left);

        document.execCommand("insertText", false, truncated_text);
    });
});

// Delete option for multi or checkbox questions
function delete_option(elem) {
    const options_container = elem.closest(".options-container");
    const options_number = options_container.querySelectorAll(".radio-input").length || options_container.querySelectorAll(".checkbox-input").length;

    if (options_number <= 1) return;
    
    const option_node = elem.closest(".option");

    changes_done.push({
        table: "options",
        id: option_node.dataset.id,
        action: "DELETE",
        data: {}
    });

    send_changes();

    option_node.remove();
}

document.querySelectorAll(".del-option").forEach(elem => {
    elem.addEventListener("click", () => delete_option(elem));
});


// Create option for multi or checkbox questions
function create_option(elem) {
    const question_id = elem.dataset.id;
    const option_id = uuidv7();
    
    const select_types = document.querySelector(`.question-types[data-id='${question_id}']`);

    const options_div = document.querySelector(`.options-container[data-id='${question_id}']`);

    const input_div = document.createElement("div");
    input_div.dataset.id = option_id;

    const label = document.createElement("label");

    const input = document.createElement("input");
    input.classList.add("options-input", "mx-1");
    input.name = question_id;
    input.dataset.id = option_id;
    input.value = "New Option";
    input.disabled = true;

    const span = document.createElement("span");
    span.classList.add("ms-1");
    span.contentEditable = true;
    span.innerText = "New Option";

    const del_btn = document.createElement("button");
    del_btn.classList.add("del-option");
    del_btn.innerText = "Delete";
    del_btn.addEventListener("click", () => delete_option(del_btn));

    if (select_types.value === "radio") {
        input_div.classList.add("radio-input", "option", "d-flex", "flex-row", "justify-content-between")
        input.type = "radio";       
    }
    else if (select_types.value === "checkbox") {
        input_div.classList.add("checkbox-input", "option", "d-flex", "flex-row", "justify-content-between")
        input.type = "checkbox";
    }

    label.appendChild(input);
    label.appendChild(span);

    input_div.appendChild(label);
    input_div.appendChild(del_btn);

    options_div.appendChild(input_div);

    changes_done.push({
        table: "options",
        id: option_id,
        action: "CREATE",
        data: {value: "New Option", quest_id: question_id}
    });

    debounced_save();

    change_feedback_msg("Saving...");
}

document.querySelectorAll(".add-option-btn").forEach(elem => {
    elem.addEventListener("click", () => create_option(elem));
});


// Change the question's type
function change_question_type(elem) {
    const question_id = elem.dataset.id;
    const current_type = elem.getAttribute("current-type");
    const next_type = elem.value;

    if (["radio", "checkbox"].includes(current_type) && ["radio", "checkbox"].includes(next_type)) { // change from radio/checkbox to checkbox/radio
        document.querySelectorAll(`input[name='${question_id}']`).forEach(inputElem => {
            inputElem.type = next_type;

            const option_div = inputElem.closest(".option");
            
            if (next_type === "radio") {
                option_div.classList.add("radio-input");
                option_div.classList.remove("checkbox-input");
            }
            else {
                option_div.classList.add("checkbox-input");
                option_div.classList.remove("radio-input");
            }
        });
    }
    else if (["radio", "checkbox"].includes(current_type) && next_type === "text") { //change from radio/checkbox to text
        const options = document.querySelector(`.options-container[data-id='${question_id}']`);
        const add_opt_btn = document.querySelector(`.add-option-btn[data-id='${question_id}']`);
        const new_text_input = `<input class="text-input" data-id="${question_id}" name="text-input" type="text" placeholder="Your Answer" disabled>`;
        
        options.querySelectorAll(".option").forEach(input => {
            changes_done.push({
                table: "options",
                id: input.dataset.id,
                action: "DELETE",
                data: {}
            });
        });

        options.remove();
        add_opt_btn.remove();

        const question_div = elem.closest(".item-container");
        question_div.insertAdjacentHTML('beforeend', new_text_input);
    }
    else if (current_type === "text" && ["radio", "checkbox"].includes(next_type)) { // change from text to radio/checkbox
        
        const text_input = document.querySelector(`.text-input[data-id='${question_id}']`);
        const option_id = uuidv7();
        
        text_input.remove();


        const question_div = elem.closest(".item-container")

        const options_div = document.createElement("div");
        options_div.setAttribute("data-id", question_id);
        options_div.classList.add("options-container");

        const input_div = document.createElement("div");

        const label = document.createElement("label");

        const input = document.createElement("input");
        input.classList.add("options-input", "mx-1");
        input.name = question_id;
        input.value = "New Option";
        input.disabled = true;

        const span = document.createElement("span");
        span.classList.add("ms-1");
        span.contentEditable= true;
        span.innerText = "New Option";
        span.dataset.id = option_id;
        span.dataset.table = "options";
        span.dataset.field = "text";

        const del_btn = document.createElement("button");
        del_btn.classList.add("del-option");
        del_btn.innerText = "Delete";
        del_btn.addEventListener("click", () => delete_option(del_btn));

        const add_opt_btn = document.createElement("button");
        add_opt_btn.classList.add("add-option-btn");
        add_opt_btn.classList.add("mt-3");
        add_opt_btn.dataset.id = question_id;
        add_opt_btn.innerText = "Add Option";
        add_opt_btn.addEventListener("click", () => create_option(add_opt_btn));

        if (next_type === "radio") {
            input_div.classList.add("radio-input", "option", "d-flex", "flex-row", "justify-content-between")
            input_div.dataset.id = option_id;

            input.type = "radio";
        }
        else if (next_type === "checkbox") {
            input_div.classList.add("checkbox-input", "option", "d-flex", "flex-row", "justify-content-between")
            input_div.dataset.id = option_id;

            input.type = "checkbox";
        }

        label.appendChild(input);
        label.appendChild(span);

        input_div.appendChild(label);
        input_div.appendChild(del_btn);

        options_div.appendChild(input_div);

        question_div.appendChild(options_div);
        question_div.appendChild(add_opt_btn);

        changes_done.push({
            table: "options",
            id: option_id,
            action: "CREATE",
            data: {value: "New Option", quest_id: question_id}
        });
    }
    
    elem.setAttribute("current-type", next_type);

    changes_done.push({
        table: "questions",
        id: question_id,
        action: "UPDATE",
        data: {type: next_type}
    });

    send_changes();
}

document.querySelectorAll(".question-types").forEach(elem => {
    elem.addEventListener("input", () => change_question_type(elem));
});


// Create a new question
function add_question() {
    const questions_container = document.querySelector(".questions-container");
    const question_id = uuidv7();
    const order = questions_container.querySelectorAll(".item-container").length + 1;
    
    const new_question_div = `
    <div class="item-container my-1" data-id="${question_id}" data-order="${order}">
        <button class="del-question-btn mb-2" data-id="${question_id}">Delete Question</button>

        <label>
            <input type="checkbox" data-id="{{ question[0] }}" data-table="questions" data-field="required" value="required">
            <span>Required</span>
        </label>

        <div class="question-text mb-2" contenteditable="true" data-id="${question_id}" data-table="questions" data-field="text" contenteditable="true" data-placeholder="Question Text">New Question</div>
        
        <div class="mb-2">
            <label>
                <span>Type</span>
                <select class="question-types" name="type" data-id="${question_id}" current-type="text">
                    <option value="text" selected>Text</option>
                    <option value="radio">Multi Option</option>
                    <option value="checkbox">Checkbox</option>
                </select>
            </label>
        </div>

        <input class="text-input" data-id="${question_id}" name="text-input" type="text" placeholder="Your Answer" disabled>

        <div class="move-btn-container d-flex flex-column justify-content-center">
            <button class="up-btn" data-id="${question_id}" data-action="up">Up</button>
            <button class="down-btn" data-id="${question_id}" data-action="down">Down</button>
        </div>
    </div>
    `;

    questions_container.insertAdjacentHTML("beforeend", new_question_div);

    const type_select = document.querySelector(`.question-types[data-id='${question_id}']`);
    type_select.addEventListener("input", () => change_question_type(type_select));

    const del_btn = document.querySelector(`.del-question-btn[data-id='${question_id}']`);
    del_btn.addEventListener("click", () => delete_question(del_btn));

    const up_btn = document.querySelector(`.up-btn[data-id='${question_id}']`);
    up_btn.addEventListener("click", () => change_question_order(up_btn));

    const down_btn = document.querySelector(`.down-btn[data-id='${question_id}']`);
    down_btn.addEventListener("click", () => change_question_order(down_btn));

    changes_done.push({
        table: "questions",
        id: question_id,
        action: "CREATE",
        data: {text: "New Question", type: "text", order: order}
    });

    debounced_save();

    change_feedback_msg("Saving...");
}

const add_question_btn = document.getElementById("add-question-btn");
if (add_question_btn) {
    add_question_btn.addEventListener("click", () => add_question());
}


// Delete question
function delete_question(elem) {
    const question_id = elem.dataset.id;
    const question_div = document.querySelector(`.item-container[data-id='${question_id}']`);
    const question_number = question_div.closest(".questions-container").querySelectorAll(".item-container").length;
    
    if (question_number > 1) {
        question_div.remove();

        const was_created = changes_done.some(item => item.id === question_id && item.action === "CREATE");

        changes_done = changes_done.filter(item => item.id !== question_id);

        if (!was_created) {
            changes_done.push({
                table: "questions",
                id: question_id,
                action: "DELETE",
                data: {}
            });
        }

        send_changes();
    }
}

document.querySelectorAll(".del-question-btn").forEach(elem => elem.addEventListener("click", () => delete_question(elem)));


// Change question order
function change_question_order(elem) {
    const action = elem.dataset.action;
    const question_div = elem.closest(".item-container");
    const current_ord = parseInt(question_div.dataset.order, 10);

    let ref_question = null;
    if (action == "up") {
        ref_question = question_div.previousElementSibling;

        if (ref_question) {
            ref_question.before(question_div);

            question_div.dataset.order = String(current_ord - 1);
            ref_question.dataset.order = String(current_ord);
        }
    }
    else if (action == "down") {
        ref_question = question_div.nextElementSibling;

        if (ref_question) {
            ref_question.after(question_div);

            question_div.dataset.order = String(current_ord + 1);
            ref_question.dataset.order = String(current_ord);
        }
    }
    
    register_change("questions", question_div.dataset.id, "order", question_div.dataset.order)
    register_change("questions", ref_question.dataset.id, "order", ref_question.dataset.order)
}

document.querySelectorAll(".up-btn, .down-btn").forEach(elem => elem.addEventListener("click", () => change_question_order(elem)));


// See if the order of every question is correct, correcting when necessary
function verify_order() {
    const questions_container = document.querySelector(".questions-container");

    if (questions_container) {
        let i = 1
        questions_container.querySelectorAll(".item-container").forEach(question => {
            if (question.dataset.order != i) {
                question.dataset.order = i;

                verify_change_existence("questions", question.dataset.id, "order", i);
            }

            i++;
        });
    }
    
}


// Change the text from the feedback message element
function change_feedback_msg(msg) {
    const elem = document.getElementById("feedback-msg");

    elem.innerText = msg;
}

// Verify if everything is ok to change page
document.querySelectorAll("#logo, #responses-page, #questions-page").forEach(elem => elem.addEventListener("click", () => {
    // Check if form name isn't empty
    const form_name = document.querySelector(".form-name");
    
    if (form_name.innerText === "") {
        form_name.innerText = "Form";
        verify_change_existence("forms", form_name.dataset.id, form_name.dataset.field, "Form");
    }

    // Check if form title isn't empty
    const form_title = document.querySelector(".form-title");
    
    if (form_title && form_title.innerText === "") {
        form_title.innerText = "Form";
        verify_change_existence("forms", form_title.dataset.id, form_title.dataset.field, "Title");
    }

    // Save any pending changes
    send_changes();
}));


// Copy form link to clipboard
async function copy_to_clipboard(text) {
    
    // Use Clipboard API (for HTTPS or localhost)
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            
            change_feedback_msg("Link copied!");
            return true;
        }
        catch (err) {
            console.warn("Couldn't use clipboard API, trying fallback...", err);
        }
    }
    
    // Fallback (for old browsers or HTTP)
    const text_area = document.createElement("textarea");
    text_area.value = text;

    text_area.style.position = "fixed";
    text_area.style.top = "-9999999px";
    text_area.style.left = "-9999999px";
    document.body.appendChild(text_area);

    text_area.focus()
    text_area.select()

    try {
        const copied = document.execCommand("copy");

        if (copied) {
            change_feedback_msg("Link copied!");
        }
        else {
            change_feedback_msg("Unable to copy link!");
        }

        document.body.removeChild(text_area);
        return copied;

    } catch (err) {
        change_feedback_msg("Unable to copy link!");
        console.warn("Failed to copy link to clipboard", err);
        
        document.body.removeChild(text_area);
        return false;
    }
    
}

const copy_btn = document.getElementById("copy-clipboard");
if (copy_btn) {
    copy_btn.addEventListener("click", () => copy_to_clipboard(`http://127.0.0.1:5000/v/${form_id}`));
}


// **Code for the responses page**

function call_ai() {
    const content_elem = document.getElementById("ai-content");
    const event_source = new EventSource(`/api/get-ai-analysis/${form_id}`);

    let text_buffer = "";
    event_source.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);

            if (data.error) {
                content_elem.innerHTML = data.error;
                event_source.close();
                return;
            }

            if (data.text) {
                text_buffer += data.text;

                content_elem.innerHTML = text_buffer;
            }
        } catch (e) {
            console.error("Failed to process AI data: ", e)
        }
    };

    event_source.onerror = function() {
        event_source.close();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("ai-switch-input").checked) {
        call_ai();
    }
});


// Transform the time data for the user's timezone
function convert_timezone(elem) {
    const default_time = elem.innerText;

    // Ajust time string for format ISO 8601
    const time_ISO = default_time.replace(" ", "T") + "Z"
    
    const local_time = new Date(time_ISO);

    elem.innerText = local_time.toLocaleString();
}

document.querySelectorAll(".time-data").forEach(elem => convert_timezone(elem));


// Change responses view mode
function change_responses_view(elem) {
    const individual_div = document.getElementById("individual-resp-container");
    const summary_div = document.getElementById("summary-resp-container");

    if (elem.id === "summary-btn") {
        summary_div.hidden = false;
        individual_div.hidden = true;
    } else {
        summary_div.hidden = true;
        individual_div.hidden = false;
    }
}

document.querySelectorAll("#summary-btn, #individual-btn").forEach(elem => elem.addEventListener("click", () => change_responses_view(elem)));


// Enable or disable ai analysis
function switch_ai_analysis(elem) {
    const ai_container = document.getElementById("ai-container");

    if (elem.checked) {
        ai_container.hidden = false;
        call_ai()
        
    } else {
        ai_container.hidden = true;
    }
}

const ai_switch = document.getElementById("ai-switch-input");
if (ai_switch) {
    ai_switch.addEventListener("input", () => switch_ai_analysis(ai_switch));
}