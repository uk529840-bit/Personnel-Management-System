
const express = require("express");
const db = require("../db");

const router = express.Router();

// Require login for all department APIs
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Please log in to continue"
        });
    }

    next();
}

// Only admin can modify departments
function requireAdmin(req, res, next) {
    if (
        !req.session ||
        !req.session.user ||
        req.session.user.role !== "admin"
    ) {
        return res.status(403).json({
            success: false,
            message: "Admin permission is required"
        });
    }

    next();
}

router.use(requireAuth);

// GET: View and search departments - logged-in users
router.get("/", (req, res) => {
    const search = String(req.query.search || "").trim();
    const keyword = `%${search}%`;

    const sql = `
        SELECT id, department_name, description, created_at
        FROM departments
        WHERE department_name LIKE ?
           OR description LIKE ?
        ORDER BY id DESC
    `;

    db.query(sql, [keyword, keyword], (error, results) => {
        if (error) {
            console.error("Get departments error:", error.message);
            return res.status(500).json({
                success: false,
                message: "Unable to retrieve departments"
            });
        }

        res.json({
            success: true,
            count: results.length,
            data: results
        });
    });
});

// POST: Add department - admin only
router.post("/", requireAdmin, (req, res) => {
    const { department_name, description } = req.body;

    if (
        typeof department_name !== "string" ||
        !department_name.trim()
    ) {
        return res.status(400).json({
            success: false,
            message: "Department name is required"
        });
    }

    const sql = `
        INSERT INTO departments (department_name, description)
        VALUES (?, ?)
    `;

    db.query(
        sql,
        [
            department_name.trim(),
            typeof description === "string" && description.trim()
                ? description.trim()
                : null
        ],
        (error, result) => {
            if (error) {
                if (error.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({
                        success: false,
                        message: "Department already exists"
                    });
                }

                console.error("Add department error:", error.message);
                return res.status(500).json({
                    success: false,
                    message: "Unable to add department"
                });
            }

            res.status(201).json({
                success: true,
                message: "Department added successfully",
                id: result.insertId
            });
        }
    );
});

// PUT: Edit department - admin only
router.put("/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const { department_name, description } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid department ID"
        });
    }

    if (
        typeof department_name !== "string" ||
        !department_name.trim()
    ) {
        return res.status(400).json({
            success: false,
            message: "Department name is required"
        });
    }

    const sql = `
        UPDATE departments
        SET department_name = ?, description = ?
        WHERE id = ?
    `;

    db.query(
        sql,
        [
            department_name.trim(),
            typeof description === "string" && description.trim()
                ? description.trim()
                : null,
            id
        ],
        (error, result) => {
            if (error) {
                if (error.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({
                        success: false,
                        message: "Department name already exists"
                    });
                }

                console.error("Update department error:", error.message);
                return res.status(500).json({
                    success: false,
                    message: "Unable to update department"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Department not found or no changes made"
                });
            }

            res.json({
                success: true,
                message: "Department updated successfully"
            });
        }
    );
});

// DELETE: Remove department - admin only
router.delete("/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid department ID"
        });
    }

    db.query(
        "DELETE FROM departments WHERE id = ?",
        [id],
        (error, result) => {
            if (error) {
                if (error.code === "ER_ROW_IS_REFERENCED_2") {
                    return res.status(409).json({
                        success: false,
                        message: "This department is assigned to employees. Reassign those employees before deleting it."
                    });
                }

                console.error("Delete department error:", error.message);
                return res.status(500).json({
                    success: false,
                    message: "Unable to delete department"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Department not found"
                });
            }

            res.json({
                success: true,
                message: "Department deleted successfully"
            });
        }
    );
});

module.exports = router;
