// Save form changes
const save_btn = document.getElementById("save-button");

save_btn.addEventListener('click', () => {
    
    const data = {
        file_title: document.getElementById("file-title").innerText
    }
    
    fetch("/api/save-changes", {
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
        console.log("Data: ",  data)
    })
    .catch(error => {
        console.error('Error: ', error)
    })
});