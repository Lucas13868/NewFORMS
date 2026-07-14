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

        console.log(options_number);

        if (options_number <= 1) return;

        const option_node = document.getElementById(elem.getAttribute("option-div-id"));

        option_node.remove();
}

document.querySelectorAll(".del-option").forEach(elem => {
    elem.addEventListener("click", () => delete_option(elem));
});


// Create option for multi or checkbox questions
document.querySelectorAll(".add-option-btn").forEach(elem => {
    elem.addEventListener("click", () => {
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

        if (elem.classList.contains("radio")) {
            input_div.classList.add("radio-input");
            input_div.id = "radioElem-" + option_id;

            input.type = "radio";

            del_btn.setAttribute("option-div-id", "radioElem-" + option_id);

            
        }
        else if (elem.classList.contains("checkbox")) {
            input_div.classList.add("checkbox-input");
            input_div.id = "checkboxElem-" + option_id;

            input.type = "checkbox";

            del_btn.setAttribute("option-div-id", "checkboxElem-" + option_id);
        }

        label.appendChild(input);
        label.appendChild(span);

        input_div.appendChild(label);
        input_div.appendChild(del_btn);

        options_div.appendChild(input_div);
    });
});



