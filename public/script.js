const contactForm = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");

function showMessage(text, className) {
    formMessage.textContent = text;
    formMessage.className = className;
}

function isValidEmail(email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
}

contactForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const submitButton = contactForm.querySelector("button[type='submit']");

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const subject = document.getElementById("subject").value.trim();
    const message = document.getElementById("message").value.trim();

    if (!name || !email || !subject || !message) {
        showMessage("Please fill in all fields.", "error-message");
        return;
    }

    if (name.length < 2 || name.length > 50) {
        showMessage("Name must be between 2 and 50 characters.", "error-message");
        return;
    }

    if (!isValidEmail(email)) {
        showMessage("Please enter a valid email address.", "error-message");
        return;
    }

    if (email.length > 100) {
        showMessage("Email address is too long.", "error-message");
        return;
    }

    if (subject.length < 3 || subject.length > 100) {
        showMessage("Subject must be between 3 and 100 characters.", "error-message");
        return;
    }

    if (message.length < 5 || message.length > 1000) {
        showMessage("Message must be between 5 and 1000 characters.", "error-message");
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
    showMessage("", "");

    try {
        const response = await fetch("/api/contact", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                email: email,
                subject: subject,
                message: message,
                website: ""
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Message could not be sent.");
        }

        showMessage("Your message has been sent successfully.", "success-message");
        contactForm.reset();

    } catch (error) {
        showMessage(error.message, "error-message");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Send Message";
    }
});