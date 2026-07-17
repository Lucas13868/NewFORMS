// Save form changes
const save_btn = document.getElementById("save-button");

save_btn.addEventListener('click', () => { // save form changes 
    
    const data = { // gets all the elements from form
        file_title: document.getElementById("form-name").innerText,
        form_title: document.getElementById("form-title").innerText,
        form_description: document.getElementById("form-description").innerText
    }
    
    fetch("/save-changes", { // send form data to backend 
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => {
        if (!res.ok) {
            throw new Error("Network error");
        }
        return res.json();
    })
    .then(data => {
        console.log("Data: ",  data.msg)
    })
    .catch(error => {
        console.error('Error: ', error)
    })
});


const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)) // Sets a sleep function

async function empty_replace(el, txt) { // Fill an editable div's space if empty
    if (el.innerHTML === "") {
        await sleep(1500);

        if (el.innerHTML === "") {
            el.innerHTML = txt;
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
    const question_id = elem.getAttribute("question-id");
        const options_container = document.getElementById("options-" + question_id);
        const options_number = options_container.querySelectorAll(".radio-input").length || options_container.querySelectorAll(".checkbox-input").length;

        if (options_number <= 1) return;

        const option_node = document.getElementById(elem.getAttribute("option-div-id"));

        option_node.remove();
}

document.querySelectorAll(".del-option").forEach(elem => {
    elem.addEventListener("click", () => delete_option(elem));
});


// Create option for multi or checkbox questions
function create_option(elem) {
    const question_id = elem.getAttribute("question-id");
    const option_id = crypto.randomUUID();
    

    const options_div = document.getElementById("options-" + elem.getAttribute("question-id"))

    const input_div = document.createElement("div");

    const label = document.createElement("label");

    const input = document.createElement("input");
    input.classList.add("options-input");
    input.name = question_id;
    input.value = "New Option";
    input.disabled = true;

    const span = document.createElement("span");
    span.contentEditable= true;
    span.innerText = "New Option";

    const del_btn = document.createElement("button");
    del_btn.classList.add("del-option");
    del_btn.setAttribute("question-id", question_id);
    del_btn.innerText = "Delete";
    del_btn.addEventListener("click", () => delete_option(del_btn));

    if (elem.dataset.questionType === "radio") {
        ["radio-input", "d-flex", "flex-row", "justify-content-between"].forEach(c => input_div.classList.add(c));
        input_div.id = "radioElem-" + option_id;

        input.type = "radio";

        del_btn.setAttribute("option-div-id", "radioElem-" + option_id);        
    }
    else if (elem.dataset.questionType === "checkbox") {
        ["checkbox-input", "d-flex", "flex-row", "justify-content-between"].forEach(c => input_div.classList.add(c));
        input_div.id = "checkboxElem-" + option_id;

        input.type = "checkbox";

        del_btn.setAttribute("option-div-id", "checkboxElem-" + option_id);
    }

    label.appendChild(input);
    label.appendChild(span);

    input_div.appendChild(label);
    input_div.appendChild(del_btn);

    options_div.appendChild(input_div);
}

document.querySelectorAll(".add-option-btn").forEach(elem => {
    elem.addEventListener("click", () => create_option(elem));
});


// Change the question's type
function change_question_type(elem) {
    const question_id = elem.id.split("types-")[1];
    const current_type = elem.getAttribute("current-type");
    const next_type = elem.value;

    if (["radio", "checkbox"].includes(current_type) && ["radio", "checkbox"].includes(next_type)) { // change from radio/checkbox to checkbox/radio
        document.querySelectorAll(`input[name='${question_id}']`).forEach(inputElem => {
            inputElem.type = next_type;
        });

        const add_opt_btn = document.getElementById("add-opt-btn-" + question_id);

        if (next_type === "radio") {
            add_opt_btn.dataset.questionType = "radio";
        }
        else {
            add_opt_btn.dataset.questionType = "checkbox";
        }
    }
    else if (["radio", "checkbox"].includes(current_type) && next_type === "text") { //change from radio/checkbox to text
        const options = document.getElementById(`options-${question_id}`);
        const add_opt_btn = document.getElementById(`add-opt-btn-${question_id}`);
        const new_text_input = `<input class="text-input" id="text-input-${question_id}" type="text" placeholder="Your Answer" disabled>`;
        
        options.remove();
        add_opt_btn.remove();
        elem.parentElement.insertAdjacentHTML('afterend', new_text_input);
    }
    else if (current_type === "text" && ["radio", "checkbox"].includes(next_type)) { // change from text to radio/checkbox
        
        const text_input = document.getElementById(`text-input-${question_id}`);
        const option_id = crypto.randomUUID();
        
        text_input.remove();


        const question_div = elem.parentElement.parentElement;

        const options_div = document.createElement("div");
        options_div.id = "options-" + question_id;

        const input_div = document.createElement("div");

        const label = document.createElement("label");

        const input = document.createElement("input");
        input.classList.add("options-input");
        input.name = question_id;
        input.value = "New Option";
        input.disabled = true;

        const span = document.createElement("span");
        span.contentEditable= true;
        span.innerText = "New Option";

        const del_btn = document.createElement("button");
        del_btn.classList.add("del-option");
        del_btn.setAttribute("question-id", question_id);
        del_btn.innerText = "Delete";
        del_btn.addEventListener("click", () => delete_option(del_btn));

        const add_opt_btn = document.createElement("button");
        add_opt_btn.classList.add("add-option-btn");
        add_opt_btn.classList.add("radio");
        add_opt_btn.classList.add("mt-3");
        add_opt_btn.id = "add-opt-btn-" + question_id;
        add_opt_btn.setAttribute("question-id", question_id);
        add_opt_btn.innerText = "Add Option";
        add_opt_btn.addEventListener("click", () => create_option(add_opt_btn));

        if (next_type === "radio") {
            ["radio-input", "d-flex", "flex-row", "justify-content-between"].forEach(c => input_div.classList.add(c));
            input_div.id = "radioElem-" + option_id;

            input.type = "radio";

            del_btn.setAttribute("option-div-id", "radioElem-" + option_id);

            add_opt_btn.dataset.questionType = "radio";
        }
        else if (next_type === "checkbox") {
            ["checkbox-input", "d-flex", "flex-row", "justify-content-between"].forEach(c => input_div.classList.add(c));
            input_div.id = "checkboxElem-" + option_id;

            input.type = "checkbox";

            del_btn.setAttribute("option-div-id", "checkboxElem-" + option_id);

            add_opt_btn.dataset.questionType = "checkbox";
        }

        label.appendChild(input);
        label.appendChild(span);

        input_div.appendChild(label);
        input_div.appendChild(del_btn);

        options_div.appendChild(input_div);

        question_div.appendChild(options_div);
        question_div.appendChild(add_opt_btn);
    }
    
    elem.setAttribute("current-type", next_type);
}

document.querySelectorAll(".question-types").forEach(elem => {
    elem.addEventListener("input", () => change_question_type(elem));
});


// Create a new question
const add_question_btn = document.getElementById("add-question-btn");

add_question_btn.addEventListener("click", () => {
    const questions_container = document.querySelector(".questions-container");
    const question_id = crypto.randomUUID();
    
    const new_question_div = `
    <div class="item-container my-1 question-box" id="question-${question_id}">
        <button class="del-question-btn mb-2" id="del-question-btn-${question_id}">Delete Question</button>

        <div class="question-text mb-2" contenteditable="true" data-placeholder="Question Text">New Question...</div>
        
        <div class="mb-2">
            <label for="types-${question_id}">Type</label>
            <select class="question-types" name="type" id="types-${question_id}" current-type="text">
                <option value="text" selected>Text</option>
                <option value="radio">Multi Option</option>
                <option value="checkbox">Checkbox</option>
            </select>
        </div>

        <input class="text-input" id="text-input-${question_id}" type="text" placeholder="Your Answer" disabled>

        <div class="move-btn-container d-flex flex-column justify-content-center">
            <button class="up-btn" id="up-btn-${question_id}" data-action="up">Up</button>
            <button class="down-btn" id="down-btn-${question_id}" data-action="down">Down</button>
        </div>
    </div>
    `;

    questions_container.insertAdjacentHTML("beforeend", new_question_div);

    const type_select = document.getElementById("types-" + question_id);
    type_select.addEventListener("input", () => change_question_type(type_select));

    const del_btn = document.getElementById("del-question-btn-" + question_id);
    del_btn.addEventListener("click", () => delete_question(del_btn));

    const up_btn = document.getElementById("up-btn-" + question_id);
    up_btn.addEventListener("click", () => change_question_order(up_btn));

    const down_btn = document.getElementById("down-btn-" + question_id);
    down_btn.addEventListener("click", () => change_question_order(down_btn));
});


// Delete question
function delete_question(elem) {
    const question_id = elem.id.split("del-question-btn-")[1];
    const question_div = document.getElementById("question-" + question_id);
    const question_number = question_div.parentElement.querySelectorAll(".item-container").length;
    
    if (question_number > 1) {
        question_div.remove();
    }
}

document.querySelectorAll(".del-question-btn").forEach(elem => elem.addEventListener("click", () => delete_question(elem)));


// Change question order
function change_question_order(elem) {
    const action = elem.dataset.action;
    const question_div = elem.closest(".item-container");

    if (action == "up") {
        const previous_quest = question_div.previousElementSibling;
        if (previous_quest) {
            previous_quest.before(question_div);
        }
    }
    else if (action == "down") {
        const next_quest = question_div.nextElementSibling;
        if (next_quest) {
            next_quest.after(question_div);
        }
    }
    
}

document.querySelectorAll(".up-btn, .down-btn").forEach(elem => elem.addEventListener("click", () => change_question_order(elem)));