
const express = require("express");
const session = require("express-session");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Parse incoming requests
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Basic security headers
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
});

// Session configuration
app.use(
    session({
        name: "connect.sid",
        secret:
            process.env.SESSION_SECRET ||
            "pms-development-secret-change-this",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 8 * 60 * 60 * 1000
        }
    })
);

// Frontend folder
const frontendPath = path.join(__dirname, "frontend");

// Serve frontend static files
app.use(express.static(frontendPath));

// ===============================
// API ROUTES
// ===============================

app.use("/api/auth", require("./routes/auth"));
app.use("/api/employees", require("./routes/employees"));
app.use("/api/departments", require("./routes/departments"));
app.use("/api/designations", require("./routes/designations"));
app.use("/api/profiles", require("./routes/profile"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/payroll", require("./routes/payroll"));

// ===============================
// HEALTH CHECK
// ===============================

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Personnel Management System server is running."
    });
});

// ===============================
// PAGE ROUTES
// ===============================

// Login page
app.get("/", (req, res) => {
    res.sendFile(path.join(frontendPath, "login.html"));
});

app.get("/login.html", (req, res) => {
    res.sendFile(path.join(frontendPath, "login.html"));
});

// Check login session
function requirePageAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.redirect("/login.html");
    }

    next();
}

// Admin-only page access
function requirePageAdmin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.redirect("/login.html");
    }

    if (req.session.user.role !== "admin") {
        return res.redirect("/dashboard.html");
    }

    next();
}

// Dashboard
app.get("/dashboard.html", requirePageAuth, (req, res) => {
    res.sendFile(path.join(frontendPath, "dashboard.html"));
});

// Employee Management
app.get("/employees.html", requirePageAdmin, (req, res) => {
    res.sendFile(path.join(frontendPath, "employees.html"));
});

// Department Management
app.get("/departments.html", requirePageAdmin, (req, res) => {
    res.sendFile(path.join(frontendPath, "departments.html"));
});

// Designation Management
app.get("/designations.html", requirePageAdmin, (req, res) => {
    res.sendFile(path.join(frontendPath, "designations.html"));
});

// Attendance: Admin and logged-in Employees
app.get("/attendance.html", requirePageAuth, (req, res) => {
    res.sendFile(path.join(frontendPath, "attendance.html"));
});

// Payroll page: Admin and logged-in Employees
// Employee-specific data access must also be enforced by the API.
app.get("/payroll.html", requirePageAuth, (req, res) => {
    res.sendFile(path.join(frontendPath, "payroll.html"));
});

// ===============================
// API 404 HANDLER
// ===============================

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });
});

// ===============================
// GENERAL ERROR HANDLER
// ===============================

app.use((err, req, res, next) => {
    console.error("Server error:", err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        success: false,
        message: "Internal server error."
    });
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
