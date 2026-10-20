require("dotenv").config();

const bcrypt = require("bcryptjs");
const db = require("./db");

async function createAdmin() {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD;

    if (!password || password.length < 8) {
        console.error("Set ADMIN_PASSWORD in .env (minimum 8 characters).");
        db.end();
        process.exitCode = 1;
        return;
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 12);

        db.query(
            `INSERT INTO users (username, password, role)
             VALUES (?, ?, 'admin')
             ON DUPLICATE KEY UPDATE
             password = VALUES(password),
             role = 'admin'`,
            [username, hashedPassword],
            (error) => {
                if (error) {
                    console.error("Admin creation failed:", error.message);
                    process.exitCode = 1;
                } else {
                    console.log("Admin account created successfully!");
                    console.log("Username:", username);
                    console.log("Use the password configured in .env to log in.");
                }

                db.end();
            }
        );
    } catch (error) {
        console.error("Error:", error.message);
        db.end();
        process.exitCode = 1;
    }
}

createAdmin();