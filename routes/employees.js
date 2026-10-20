
const express = require("express");
const db = require("../db");

const router = express.Router();

// Check login
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Please login first."
        });
    }

    next();
}

// Admin access only
function requireAdmin(req, res, next) {
    if (
        !req.session ||
        req.session.user.role !== "admin"
    ) {
        return res.status(403).json({
            success: false,
            message: "Admin access required."
        });
    }

    next();
}

router.use(requireAuth);

// GET all employees and search
router.get("/", (req, res) => {
    const search = String(req.query.search || "").trim();
    const keyword = `%${search}%`;

    const sql = `
        SELECT
            e.id,
            e.employee_id,
            e.name,
            e.email,
            e.phone,
            e.department_id,
            d.department_name,
            e.designation,
            e.salary,
            DATE_FORMAT(
                e.joining_date,
                '%Y-%m-%d'
            ) AS joining_date
        FROM employees e
        LEFT JOIN departments d
            ON e.department_id = d.id
        WHERE e.employee_id LIKE ?
           OR e.name LIKE ?
           OR e.email LIKE ?
        ORDER BY e.id DESC
    `;

    db.query(sql, [keyword, keyword, keyword], (error, rows) => {
        if (error) {
            console.error("Get employees error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Unable to load employees."
            });
        }

        return res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    });
});

// GET one employee by database ID
router.get("/:id", (req, res) => {
    const sql = `
        SELECT
            e.id,
            e.employee_id,
            e.name,
            e.email,
            e.phone,
            e.department_id,
            d.department_name,
            e.designation,
            e.salary,
            DATE_FORMAT(
                e.joining_date,
                '%Y-%m-%d'
            ) AS joining_date
        FROM employees e
        LEFT JOIN departments d
            ON e.department_id = d.id
        WHERE e.id = ?
    `;

    db.query(sql, [req.params.id], (error, rows) => {
        if (error) {
            console.error("Get employee error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Unable to load employee."
            });
        }

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Employee not found."
            });
        }

        return res.json({
            success: true,
            data: rows[0]
        });
    });
});

// CREATE employee (Admin only)
router.post("/", requireAdmin, (req, res) => {
    const {
        employee_id,
        name,
        email,
        phone,
        department_id,
        designation,
        salary,
        joining_date
    } = req.body;

    if (!employee_id || !name || !email) {
        return res.status(400).json({
            success: false,
            message: "Employee ID, name and email are required."
        });
    }

    db.query(
        "SELECT id FROM employees WHERE employee_id = ?",
        [employee_id],
        (error, existing) => {
            if (error) {
                console.error("Check employee error:", error.message);

                return res.status(500).json({
                    success: false,
                    message: "Unable to check employee."
                });
            }

            if (existing.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Employee ID already exists."
                });
            }

            const sql = `
                INSERT INTO employees (
                    employee_id,
                    name,
                    email,
                    phone,
                    department_id,
                    designation,
                    salary,
                    joining_date
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
                sql,
                [
                    employee_id,
                    name,
                    email,
                    phone || null,
                    department_id || null,
                    designation || null,
                    salary || null,
                    joining_date || null
                ],
                (insertError, result) => {
                    if (insertError) {
                        console.error(
                            "Create employee error:",
                            insertError.message
                        );

                        return res.status(500).json({
                            success: false,
                            message: "Unable to add employee."
                        });
                    }

                    return res.status(201).json({
                        success: true,
                        message: "Employee added successfully.",
                        id: result.insertId
                    });
                }
            );
        }
    );
});

// UPDATE employee (Admin only)
router.put("/:id", requireAdmin, (req, res) => {
    const {
        employee_id,
        name,
        email,
        phone,
        department_id,
        designation,
        salary,
        joining_date
    } = req.body;

    if (!employee_id || !name || !email) {
        return res.status(400).json({
            success: false,
            message: "Employee ID, name and email are required."
        });
    }

    db.query(
        "SELECT id FROM employees WHERE id = ?",
        [req.params.id],
        (error, existing) => {
            if (error) {
                console.error("Find employee error:", error.message);

                return res.status(500).json({
                    success: false,
                    message: "Unable to find employee."
                });
            }

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Employee not found."
                });
            }

            db.query(
                `SELECT id FROM employees
                 WHERE employee_id = ? AND id <> ?`,
                [employee_id, req.params.id],
                (duplicateError, duplicate) => {
                    if (duplicateError) {
                        console.error(
                            "Check duplicate error:",
                            duplicateError.message
                        );

                        return res.status(500).json({
                            success: false,
                            message: "Unable to check employee ID."
                        });
                    }

                    if (duplicate.length > 0) {
                        return res.status(409).json({
                            success: false,
                            message: "Employee ID already exists."
                        });
                    }

                    const sql = `
                        UPDATE employees
                        SET employee_id = ?,
                            name = ?,
                            email = ?,
                            phone = ?,
                            department_id = ?,
                            designation = ?,
                            salary = ?,
                            joining_date = ?
                        WHERE id = ?
                    `;

                    db.query(
                        sql,
                        [
                            employee_id,
                            name,
                            email,
                            phone || null,
                            department_id || null,
                            designation || null,
                            salary || null,
                            joining_date || null,
                            req.params.id
                        ],
                        (updateError) => {
                            if (updateError) {
                                console.error(
                                    "Update employee error:",
                                    updateError.message
                                );

                                return res.status(500).json({
                                    success: false,
                                    message: "Unable to update employee."
                                });
                            }

                            return res.json({
                                success: true,
                                message: "Employee updated successfully."
                            });
                        }
                    );
                }
            );
        }
    );
});

// DELETE employee (Admin only)
router.delete("/:id", requireAdmin, (req, res) => {
    db.query(
        "DELETE FROM employees WHERE id = ?",
        [req.params.id],
        (error, result) => {
            if (error) {
                console.error("Delete employee error:", error.message);

                return res.status(500).json({
                    success: false,
                    message: "Unable to delete employee."
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Employee not found."
                });
            }

            return res.json({
                success: true,
                message: "Employee deleted successfully."
            });
        }
    );
});

module.exports = router;
