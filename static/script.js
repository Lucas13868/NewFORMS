// Save form changes
const save_btn = document.getElementById("save-button");

save_btn.addEventListener('click', () => { // save form changes 
    
    const data = { // gets all the elements from form
        file_title: document.getElementById("file-title").innerText
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
        console.log("Data: ",  data.mensagem)
    })
    .catch(error => {
        console.error('Error: ', error)
    })
});