
const contactForm = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");

contactForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const submitButton = contactForm.querySelector("button[type='submit']");

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const subject = document.getElementById("subject").value.trim();
    const message = document.getElementById("message").value.trim();

    submitButton.disabled = true;
    submitButton.textContent = "Sending...";

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

        if (!data.success) {
            throw new Error(data.message || "Message could not be sent.");
        }

        formMessage.textContent = "Your message has been sent successfully.";
        formMessage.className = "success-message";

        contactForm.reset();

    } catch (error) {
        formMessage.textContent = error.message;
        formMessage.className = "error-message";
    }

    submitButton.disabled = false;
    submitButton.textContent = "Send Message";
});