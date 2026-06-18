const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

function showLoginMessage(text) {
    loginMessage.textContent = text;
}

loginForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const submitButton = loginForm.querySelector("button[type='submit']");

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
        showLoginMessage("Please enter username and password.");
        return;
    }

    if (username.length < 3 || username.length > 50) {
        showLoginMessage("Invalid username.");
        return;
    }

    if (password.length < 6 || password.length > 100) {
        showLoginMessage("Invalid password.");
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Logging in...";
    showLoginMessage("");

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            showLoginMessage(data.message || "Login failed.");
            return;
        }

        window.location.href = "/admin.html";

    } catch (error) {
        console.error("LOGIN ERROR:", error);
        showLoginMessage("Login failed. Please try again.");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Login";
    }
});