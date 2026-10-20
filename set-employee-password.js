require("dotenv").config();

const bcrypt = require("bcryptjs");
const db = require("./db");

async function createEmployeeLogin() {
    const username = "kumar";
    const password = "Kumar@123";
    const employeeId = "EMP001";

    try {
        // Check employee exists
        db.query(
            "SELECT employee_id FROM employees WHERE employee_id = ?",
            [employeeId],
            async (error, employees) => {
                if (error) {
                    console.error("Database error:", error.message);
                    return db.end();
                }

                if (employees.length === 0) {
                    console.log("Employee EMP001 not found.");
                    return db.end();
                }

                try {
                    const hashedPassword = await bcrypt.hash(password, 12);

                    db.query(
                        `INSERT INTO users
                            (username, password, role, employee_id)
                         VALUES (?, ?, 'employee', ?)
                         ON DUPLICATE KEY UPDATE
                            password = VALUES(password),
                            role = 'employee',
                            employee_id = VALUES(employee_id)`,
                        [username, hashedPassword, employeeId],
                        (err) => {
                            if (err) {
                                console.error("Account creation failed:", err.message);
                            } else {
                                console.log("Employee login created successfully!");
                                console.log("Username: " + username);
                                console.log("Password: " + password);
                            }

                            db.end();
                        }
                    );
                } catch (err) {
                    console.error("Password hashing failed:", err.message);
                    db.end();
                }
            }
        );
    } catch (error) {
        console.error("Error:", error.message);
        db.end();
    }
}

createEmployeeLogin();
