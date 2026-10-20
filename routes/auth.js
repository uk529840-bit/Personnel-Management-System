
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");

const router = express.Router();

const COOKIE_NAME = "connect.sid";

function isLoggedIn(req, res, next) {
    if (!req.session || !req.session.user || !req.session.user.id) {
        return res.status(401).json({
            success: false,
            message: "Please login first."
        });
    }

    next();
}

// LOGIN
router.post("/login", (req, res) => {
    const { username, password } = req.body || {};

    if (
        typeof username !== "string" ||
        typeof password !== "string" ||
        !username.trim() ||
        !password ||
        username.length > 100 ||
        password.length > 200
    ) {
        return res.status(400).json({
            success: false,
            message: "Enter a valid username and password."
        });
    }

    db.query(
        "SELECT id, username, password, role FROM users WHERE username = ? LIMIT 1",
        [username.trim()],
        async (error, results) => {
            if (error) {
                console.error("Login database error:", error.message);
                return res.status(500).json({
                    success: false,
                    message: "Login is temporarily unavailable."
                });
            }

            if (!results || results.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid username or password."
                });
            }

            const user = results[0];

            try {
                const validPassword = await bcrypt.compare(
                    password,
                    user.password
                );

                if (!validPassword) {
                    return res.status(401).json({
                        success: false,
                        message: "Invalid username or password."
                    });
                }

                const role = String(user.role || "").toLowerCase();

                if (!["admin", "employee"].includes(role)) {
                    return res.status(403).json({
                        success: false,
                        message: "This account has an invalid role."
                    });
                }

                // Prevent session fixation.
                req.session.regenerate((sessionError) => {
                    if (sessionError) {
                        console.error("Session regeneration failed.");
                        return res.status(500).json({
                            success: false,
                            message: "Unable to create a secure session."
                        });
                    }

                    req.session.user = {
                        id: user.id,
                        username: user.username,
                        role
                    };

                    req.session.save((saveError) => {
                        if (saveError) {
                            console.error("Session save failed.");
                            return res.status(500).json({
                                success: false,
                                message: "Unable to save login session."
                            });
                        }

                        return res.json({
                            success: true,
                            message: "Login successful.",
                            user: req.session.user
                        });
                    });
                });
            } catch (compareError) {
                console.error("Password verification failed.");
                return res.status(500).json({
                    success: false,
                    message: "Login failed."
                });
            }
        }
    );
});

// CURRENT LOGGED-IN USER
router.get("/me", isLoggedIn, (req, res) => {
    res.json({
        success: true,
        user: req.session.user
    });
});

// CHANGE PASSWORD
router.post("/change-password", isLoggedIn, (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        typeof confirmPassword !== "string"
    ) {
        return res.status(400).json({
            success: false,
            message: "Enter all password fields."
        });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
            success: false,
            message: "All password fields are required."
        });
    }

    if (newPassword.length < 8 || newPassword.length > 72) {
        return res.status(400).json({
            success: false,
            message: "New password must be 8 to 72 characters long."
        });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({
            success: false,
            message: "New password and confirmation do not match."
        });
    }

    if (currentPassword === newPassword) {
        return res.status(400).json({
            success: false,
            message: "Choose a password different from the current one."
        });
    }

    const userId = req.session.user.id;

    db.query(
        "SELECT password FROM users WHERE id = ? LIMIT 1",
        [userId],
        async (error, results) => {
            if (error) {
                console.error("Change password lookup error:", error.message);
                return res.status(500).json({
                    success: false,
                    message: "Unable to change password right now."
                });
            }

            if (!results || results.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: "User account not found. Please login again."
                });
            }

            try {
                const matches = await bcrypt.compare(
                    currentPassword,
                    results[0].password
                );

                if (!matches) {
                    return res.status(400).json({
                        success: false,
                        message: "Current password is incorrect."
                    });
                }

                const hashedPassword = await bcrypt.hash(newPassword, 12);

                db.query(
                    "UPDATE users SET password = ? WHERE id = ?",
                    [hashedPassword, userId],
                    (updateError, updateResult) => {
                        if (updateError) {
                            console.error(
                                "Change password update error:",
                                updateError.message
                            );
                            return res.status(500).json({
                                success: false,
                                message: "Unable to save the new password."
                            });
                        }

                        if (!updateResult || updateResult.affectedRows !== 1) {
                            return res.status(400).json({
                                success: false,
                                message: "Password was not updated."
                            });
                        }

                        // End the current session after a password change.
                        req.session.destroy((sessionError) => {
                            if (sessionError) {
                                console.error("Session cleanup failed.");
                            }

                            res.clearCookie(COOKIE_NAME, { path: "/" });

                            return res.json({
                                success: true,
                                message: "Password changed. Please login again."
                            });
                        });
                    }
                );
            } catch (passwordError) {
                console.error("Password change processing failed.");
                return res.status(500).json({
                    success: false,
                    message: "Unable to change password right now."
                });
            }
        }
    );
});

// LOGOUT
router.post("/logout", (req, res) => {
    if (!req.session) {
        res.clearCookie(COOKIE_NAME, { path: "/" });

        return res.json({
            success: true,
            message: "Logged out."
        });
    }

    req.session.destroy((error) => {
        if (error) {
            console.error("Logout failed.");
            return res.status(500).json({
                success: false,
                message: "Logout failed. Please try again."
            });
        }

        res.clearCookie(COOKIE_NAME, { path: "/" });

        return res.json({
            success: true,
            message: "Logout successful."
        });
    });
});

module.exports = router;
