// Signup Function
async function signup() {
    let newUsername = document.getElementById("new-username").value;
    let newPassword = document.getElementById("new-password").value;

    if (newUsername === "" || newPassword === "") {
        alert("Please fill in both fields!");
        return;
    }
    
    let userData = {
        username: newUsername,
        password: newPassword
    };

    try {
        let response = await fetch("http://localhost:3000/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });

        let result = await response.json();
        alert(result.message);

        if (response.ok) {
            window.location.href = "index.html"; // Redirect to login page
        }
    }  catch (error) {
        console.error("Error:", error);
        alert("Signup failed!");
    }
}

// Login Function
function login() {
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;

    let storedUsername = localStorage.getItem("username");
    let storedPassword = localStorage.getItem("password");

    if (username === storedUsername && password === storedPassword) {
        window.location.href = "home.html";
    } else {
        alert("Incorrect username or password! Try again.");
    }
}


// Define the correct order of pages
const pages = ["index.html", "home.html", "record.html", "data.html", "history.html"];

function goBack() {
    let currentPage = window.location.pathname.split("/").pop();

    // Correct Navigation Flow:
    if (currentPage === "record.html") {
        window.location.href = "home.html"; // Back to Home
    } else if (currentPage === "data.html") {
        window.location.href = "record.html"; // Back to Recording Page
    } else if (currentPage === "history.html") {
        window.location.href = "home.html"; // Back to Home from History
    } else {
        window.location.href = "index.html"; // Default back to Login Page
    }
}

function goForward() {
    let currentPage = window.location.pathname.split("/").pop();

    // Correct Navigation Flow:
    if (currentPage === "home.html") {
        window.location.href = "record.html"; // Go to Recording Page
    } else if (currentPage === "record.html") {
        window.location.href = "data.html"; // Go to Data Results Page
    } else if (currentPage === "home.html") {
        window.location.href = "history.html"; // Go to History Page
    } else {
        window.location.href = "home.html"; // Default forward to Home Page
    }
}



function startRecording() {
    alert("Recording started...");
}

function stopRecording() {
    alert("Recording stopped...");
}
function uploadVideo() {
    document.getElementById("videoUpload").click(); // Opens file selection
}

function handleVideoUpload(event) {
    let file = event.target.files[0];
    if (file) {
        alert("Video '" + file.name + "' uploaded successfully!");
    }
}
