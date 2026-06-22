// Save form changes
const save_btn = document.getElementById("save-button");

save_btn.addEventListener('click', () => { // save form changes 
    
    const data = { // gets all the elements from form
        form_id: parseInt(save_btn.getAttribute("form-id"), 10),
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

        if (el.classList.contains("form-title")) {
            empty_replace(el, "Title");
        }
        if (el.classList.contains("form-name")) {
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



