console.log("AUTH SERVER VERSION IS RUNNING");
require("dotenv").config();
console.log("AUTH VERSION LOADED");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const validator = require("validator");
const xss = require("xss");
const morgan = require("morgan");
const compression = require("compression");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");

const pool = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const DEMO_MODE = process.env.DEMO_MODE !== "false";

if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !SESSION_SECRET) {
    console.error("Missing required environment variables.");
    process.exit(1);
}

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60
    }
}));

function requireAuth(req, res, next) {
    if (!req.session.isAuthenticated) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }

    next();
}

function requirePageAuth(req, res, next) {

    console.log("ADMIN PAGE ACCESS");

    if (!req.session.isAuthenticated) {
        return res.redirect("/login.html");
    }

    next();
}

app.get("/admin.html", requirePageAuth, function(req, res) {
    res.sendFile(
        path.join(__dirname, "public", "admin.html")
    );
});

app.get("/login.html", function(req, res) {
    res.sendFile(
        path.join(__dirname, "public", "login.html")
    );
});

app.use(express.static("public"));

const contactSpeedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 3,
    delayMs: function(hits) {
        return hits * 100;
    }
});

const contactRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max:5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please try again later."
    }
});

const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many login attempts. Please try again later."
    }
});

function isValidId(id) {
    return validator.isInt(String(id), { min: 1 });
}

function containsDangerousHtml(value) {
    const dangerousPattern = /<\s*script|<\/\s*script|javascript:|onerror\s*=|onload\s*=|onclick\s*=|<\s*iframe|<\s*object|<\s*embed/i;

    return dangerousPattern.test(String(value));
}
function validateMessageBody(body) {
    const allowedFields = [
        "name",
        "email",
        "subject",
        "message",
        "website"
    ];

    const receivedFields = Object.keys(body);

    const hasUnknownField = receivedFields.some(function(field) {
        return !allowedFields.includes(field);
    });

    if (hasUnknownField) {
        return "Invalid request fields";
    }

    const { name, email, subject, message, website } = body;

    if (typeof website === "string" && website.trim() !== "") {
        return "Spam detected";
    }

    const requiredFields = [name, email, subject, message];

    for (const field of requiredFields) {
        if (typeof field !== "string") {
            return "Invalid input type";
        }

        if (field.trim() === "") {
            return "All fields are required";
        }
    }

    if (name.trim().length < 2 || name.trim().length > 100) {
        return "Name must be between 2 and 100 characters";
    }
    if (
    containsDangerousHtml(name) ||
    containsDangerousHtml(email) ||
    containsDangerousHtml(subject) ||
    containsDangerousHtml(message)
) {
    return "HTML or script content is not allowed";
}

    if (!validator.isEmail(email.trim())) {
        return "Invalid email address";
    }

    if (email.trim().length > 150) {
        return "Email is too long";
    }

    if (subject.trim().length < 3 || subject.trim().length > 150) {
        return "Subject must be between 3 and 150 characters";
    }

    if (message.trim().length < 10 || message.trim().length > 1000) {
        return "Message must be between 10 and 1000 characters";
    }

    return null;
}

function validateStatus(status) {
    const allowedStatus = ["new", "read", "archived"];

    if (typeof status !== "string") {
        return false;
    }

    return allowedStatus.includes(status);
}

async function checkPassword(inputPassword) {
    if (ADMIN_PASSWORD.startsWith("$2b$") || ADMIN_PASSWORD.startsWith("$2a$")) {
        return bcrypt.compare(inputPassword, ADMIN_PASSWORD);
    }

    return inputPassword === ADMIN_PASSWORD;
}

app.post("/api/login", loginRateLimiter, async function(req, res) {
    console.log("LOGIN ROUTE HIT");

    try {
        const { username, password } = req.body;

        if (
            typeof username !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });
        }

        if (
            username.trim() === "" ||
            password.trim() === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });
        }

        if (
            username.trim().length < 3 ||
            username.trim().length > 50 ||
            password.length < 6 ||
            password.length > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid input"
            });
        }

        if (
            containsDangerousHtml(username) ||
            containsDangerousHtml(password)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid input"
            });
        }

        const usernameIsValid = username.trim() === ADMIN_USERNAME;
        const passwordIsValid = await checkPassword(password);

        if (!usernameIsValid || !passwordIsValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        req.session.isAuthenticated = true;
        req.session.user = {
            username: ADMIN_USERNAME,
            role: "demo-admin"
        };

        res.json({
            success: true,
            message: "Login successful"
        });

    } catch (error) {
        console.error("LOGIN ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
});

app.get("/api/auth/check", function(req, res) {
    res.json({
        success: true,
        authenticated: !!req.session.isAuthenticated,
        user: req.session.user || null
    });
});

app.post("/api/logout", function(req, res) {
    req.session.destroy(function(error) {
        if (error) {
            return res.status(500).json({
                success: false,
                message: "Logout failed"
            });
        }

        res.clearCookie("connect.sid");

        res.json({
            success: true,
            message: "Logged out successfully"
        });
    });
});

app.get("/", function(req, res) {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/messages", requireAuth, async function(req, res) {
    try {
        const result = await pool.query(
            `
            SELECT
                id,
                name,
                email,
                subject,
                message,
                status
            FROM messages
            ORDER BY id DESC
            `
        );

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error("GET MESSAGES ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Database error"
        });
    }
});

app.get("/api/messages/:id", requireAuth, async function(req, res) {
    try {
        const id = req.params.id;

        if (!isValidId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid message ID"
            });
        }

        const result = await pool.query(
            `
            SELECT
                id,
                name,
                email,
                subject,
                message,
                status
            FROM messages
            WHERE id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Message not found"
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error("GET MESSAGE BY ID ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Database error"
        });
    }
});

async function createMessage(req, res) {
    try {
        const validationError = validateMessageBody(req.body);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        const cleanName = xss(req.body.name.trim());
        const cleanEmail = validator.normalizeEmail(req.body.email.trim());
        const cleanSubject = xss(req.body.subject.trim());
        const cleanMessage = xss(req.body.message.trim());

        const result = await pool.query(
            `
            INSERT INTO messages
                (name, email, subject, message, status)
            VALUES
                ($1, $2, $3, $4, $5)
            RETURNING
                id,
                name,
                email,
                subject,
                message,
                status
            `,
            [
                cleanName,
                cleanEmail,
                cleanSubject,
                cleanMessage,
                "new"
            ]
        );

        res.status(201).json({
            success: true,
            message: "Message created successfully",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("POST MESSAGE ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

app.post(
    "/api/messages",
    contactSpeedLimiter,
    contactRateLimiter,
    createMessage
);

app.post(
    "/api/contact",
    contactSpeedLimiter,
    contactRateLimiter,
    createMessage
);

app.put("/api/messages/:id", requireAuth, async function(req, res) {
    try {
        const id = req.params.id;
        const status = req.body.status;

        if (!isValidId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid message ID"
            });
        }

        if (!validateStatus(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status value"
            });
        }

        const result = await pool.query(
            `
            UPDATE messages
            SET status = $1
            WHERE id = $2
            RETURNING
                id,
                name,
                email,
                subject,
                message,
                status
            `,
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Message not found"
            });
        }

        res.json({
            success: true,
            message: "Message status updated successfully",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("PUT MESSAGE ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Database update error"
        });
    }
});

app.delete("/api/messages/:id", requireAuth, async function(req, res) {
    try {
        if (DEMO_MODE) {
            return res.status(403).json({
                success: false,
                message: "Permanent delete is disabled in demo mode"
            });
        }

        const id = req.params.id;

        if (!isValidId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid message ID"
            });
        }

        const result = await pool.query(
            `
            DELETE FROM messages
            WHERE id = $1
            RETURNING id
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Message not found"
            });
        }

        res.json({
            success: true,
            message: "Message deleted successfully"
        });

    } catch (error) {
        console.error("DELETE MESSAGE ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Database delete error"
        });
    }
});
async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(150) NOT NULL,
                subject VARCHAR(150) NOT NULL,
                message TEXT NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'new'
            )
        `);

        console.log("Messages table is ready");
    } catch (error) {
        console.error("DATABASE INIT ERROR:", error);
    }
}

initializeDatabase();

app.listen(PORT, function() {
    console.log(`Server is running on http://localhost:${PORT}`);
});