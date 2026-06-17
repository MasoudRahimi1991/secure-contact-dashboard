const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

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

        if (!data.success) {
            loginMessage.textContent = data.message;
            return;
        }

        window.location.href = "/admin.html";

    } catch (error) {
        console.error("LOGIN ERROR:", error);
        loginMessage.textContent = "Login failed.";
    }
});