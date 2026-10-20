
const express = require("express");
const db = require("../db");

const router = express.Router();

// Require login for all designation APIs
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Please log in to continue"
        });
    }

    next();
}

// Only admin can modify designations
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

// GET: View and search designations - logged-in users
router.get("/", (req, res) => {
    const search = String(req.query.search || "").trim();
    const keyword = `%${search}%`;

    const sql = `
        SELECT id, designation_name, description, created_at
        FROM designations
        WHERE designation_name LIKE ?
           OR description LIKE ?
        ORDER BY id DESC
    `;

    db.query(sql, [keyword, keyword], (error, results) => {
        if (error) {
            console.error("Get designations error:", error.message);
            return res.status(500).json({
                success: false,
                message: "Unable to retrieve designations"
            });
        }

        res.json({
            success: true,
            count: results.length,
            data: results
        });
    });
});

// POST: Add designation - admin only
router.post("/", requireAdmin, (req, res) => {
    const { designation_name, description } = req.body;

    if (
        typeof designation_name !== "string" ||
        !designation_name.trim()
    ) {
        return res.status(400).json({
            success: false,
            message: "Designation name is required"
        });
    }

    const sql = `
        INSERT INTO designations (designation_name, description)
        VALUES (?, ?)
    `;

    db.query(
        sql,
        [
            designation_name.trim(),
            typeof description === "string" && description.trim()
                ? description.trim()
                : null
        ],
        (error, result) => {
            if (error) {
                if (error.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({
                        success: false,
                        message: "Designation already exists"
                    });
                }

                console.error("Add designation error:", error.message);
                return res.status(500).json({
                    success: false,
                    message: "Unable to add designation"
                });
            }

            res.status(201).json({
                success: true,
                message: "Designation added successfully",
                id: result.insertId
            });
        }
    );
});

// PUT: Update designation - admin only
router.put("/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const { designation_name, description } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid designation ID"
        });
    }

    if (
        typeof designation_name !== "string" ||
        !designation_name.trim()
    ) {
        return res.status(400).json({
            success: false,
            message: "Designation name is required"
        });
    }

    const sql = `
        UPDATE designations
        SET designation_name = ?, description = ?
        WHERE id = ?
    `;

    db.query(
        sql,
        [
            designation_name.trim(),
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
                        message: "Designation name already exists"
                    });
                }

                console.error("Update designation error:", error.message);
                return res.status(500).json({
                    success: false,
                    message: "Unable to update designation"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Designation not found or no changes made"
                });
            }

            res.json({
                success: true,
                message: "Designation updated successfully"
            });
        }
    );
});

// DELETE: Remove designation - admin only
router.delete("/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid designation ID"
        });
    }

    db.query(
        "DELETE FROM designations WHERE id = ?",
        [id],
        (error, result) => {
            if (error) {
                if (error.code === "ER_ROW_IS_REFERENCED_2") {
                    return res.status(409).json({
                        success: false,
                        message: "This designation is assigned to employees and cannot be deleted yet."
                    });
                }

                console.error("Delete designation error:", error.message);
                return res.status(500).json({
                    success: false,
                    message: "Unable to delete designation"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Designation not found"
                });
            }

            res.json({
                success: true,
                message: "Designation deleted successfully"
            });
        }
    );
});

module.exports = router;
