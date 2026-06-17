const messageContainer = document.getElementById("messageContainer");
const logoutButton = document.getElementById("logoutBtn");

const totalMessagesElement = document.getElementById("totalMessages");
const newMessagesElement = document.getElementById("newMessages");
const readMessagesElement = document.getElementById("readMessages");
const archivedMessagesElement = document.getElementById("archivedMessages");

const refreshButton = document.getElementById("refreshBtn");
const searchInput = document.getElementById("searchInput");

const inboxViewButton = document.getElementById("inboxViewBtn");
const archiveViewButton = document.getElementById("archiveViewBtn");
const currentViewTitle = document.getElementById("currentViewTitle");

let allMessages = [];
let currentView = "inbox";

async function loadMessages() {
    try {
        const response = await fetch("/api/messages");
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || "Failed to load messages");
        }

        allMessages = data.data;

        updateStatistics();
        renderCurrentView();

    } catch (error) {
        console.error("LOAD MESSAGES ERROR:", error);

        messageContainer.innerHTML = `
            <p class="empty-text">Failed to load messages.</p>
        `;
    }
}

function updateStatistics() {
    totalMessagesElement.textContent = allMessages.length;

    newMessagesElement.textContent = allMessages.filter(function(message) {
        return message.status === "new";
    }).length;

    readMessagesElement.textContent = allMessages.filter(function(message) {
        return message.status === "read";
    }).length;

    archivedMessagesElement.textContent = allMessages.filter(function(message) {
        return message.status === "archived";
    }).length;
}

function getMessagesByCurrentView() {
    if (currentView === "archive") {
        return allMessages.filter(function(message) {
            return message.status === "archived";
        });
    }

    return allMessages.filter(function(message) {
        return message.status !== "archived";
    });
}

function getFilteredMessages() {
    const searchValue = searchInput.value.toLowerCase().trim();
    const messages = getMessagesByCurrentView();

    if (searchValue === "") {
        return messages;
    }

    return messages.filter(function(message) {
        return (
            String(message.name).toLowerCase().includes(searchValue) ||
            String(message.email).toLowerCase().includes(searchValue) ||
            String(message.subject).toLowerCase().includes(searchValue) ||
            String(message.message).toLowerCase().includes(searchValue) ||
            String(message.status).toLowerCase().includes(searchValue)
        );
    });
}

function renderCurrentView() {
    const messages = getFilteredMessages();
    renderMessages(messages);
}

function renderMessages(messages) {
    if (messages.length === 0) {
        messageContainer.innerHTML = `
            <p class="empty-text">No messages found.</p>
        `;
        return;
    }

    messageContainer.innerHTML = "";

    messages.forEach(function(message) {
        const card = document.createElement("div");
        card.classList.add("message-card");

        card.innerHTML = `
            <div class="message-top">
                <div>
                    <h3>${escapeHtml(message.subject)}</h3>
                    <p class="message-meta">
                        ${escapeHtml(message.name)} | ${escapeHtml(message.email)}
                    </p>
                </div>

                <span class="status ${escapeHtml(message.status)}">
                    ${escapeHtml(message.status)}
                </span>
            </div>

            <div class="message-text">
                ${escapeHtml(message.message)}
            </div>

            <div class="message-actions">
                ${getActionButtons(message)}
            </div>
        `;

        messageContainer.appendChild(card);
    });
}

function getActionButtons(message) {
    if (message.status === "archived") {
        return `
            <button class="restore-btn" data-action="status" data-id="${message.id}" data-status="new">
                Restore To New
            </button>

            <button class="read-btn" data-action="status" data-id="${message.id}" data-status="read">
                Restore To Read
            </button>

            <button class="delete-btn" data-action="delete" data-id="${message.id}">
                Delete
            </button>
        `;
    }

    return `
        <button class="read-btn" data-action="status" data-id="${message.id}" data-status="read">
            Mark Read
        </button>

        <button class="archive-btn" data-action="status" data-id="${message.id}" data-status="archived">
            Archive
        </button>

        <button class="delete-btn" data-action="delete" data-id="${message.id}">
            Delete
        </button>
    `;
}

async function updateStatus(id, status) {
    try {
        const response = await fetch(`/api/messages/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status: status
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || "Failed to update message status");
        }

        await loadMessages();

    } catch (error) {
        console.error("UPDATE STATUS ERROR:", error);
        alert("Failed to update message status.");
    }
}

async function deleteMessage(id) {
    const confirmed = confirm(
        "Are you sure you want to delete this message permanently?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/messages/${id}`, {
            method: "DELETE"
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || "Failed to delete message");
        }

        await loadMessages();

    } catch (error) {

    if (
        error.message ===
        "Permanent delete is disabled in demo mode"
    ) {

        alert(
            "This feature is disabled for demo users. Permanent deletion is not available in demo mode."
        );

        return;
    }

    alert(error.message);
}
}

function switchToInbox() {
    currentView = "inbox";
    currentViewTitle.textContent = "Inbox";

    inboxViewButton.classList.add("active");
    archiveViewButton.classList.remove("active");

    renderCurrentView();
}

function switchToArchive() {
    currentView = "archive";
    currentViewTitle.textContent = "Archive";

    archiveViewButton.classList.add("active");
    inboxViewButton.classList.remove("active");

    renderCurrentView();
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

refreshButton.addEventListener("click", loadMessages);
searchInput.addEventListener("input", renderCurrentView);

inboxViewButton.addEventListener("click", switchToInbox);
archiveViewButton.addEventListener("click", switchToArchive);

messageContainer.addEventListener("click", function(event) {
    const button = event.target.closest("button");

    if (!button) {
        return;
    }

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "status") {
        updateStatus(id, button.dataset.status);
    }

    if (action === "delete") {
        deleteMessage(id);
    }
});
logoutButton.addEventListener("click", async function() {
    try {
        await fetch("/api/logout", {
            method: "POST"
        });

        window.location.href = "/login.html";

    } catch (error) {
        console.error("LOGOUT ERROR:", error);
        alert("Logout failed.");
    }
});

loadMessages();