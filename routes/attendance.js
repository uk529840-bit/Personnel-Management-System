
const express = require("express");
const db = require("../db");

const router = express.Router();

// Check whether user is logged in
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Please log in first."
        });
    }

    next();
}

// Admin-only access
function requireAdmin(req, res, next) {
    if (req.session.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Admin access required."
        });
    }

    next();
}

// Get attendance records
// Admin: all records
// Employee: own records
router.get("/", requireAuth, (req, res) => {
    const user = req.session.user;

    let sql = `
        SELECT
            a.id,
            e.employee_id AS employee_code,
            e.name AS employee_name,
            a.attendance_date,
            a.status,
            a.check_in,
            a.check_out,
            a.notes
        FROM attendance a
        JOIN employees e ON e.id = a.employee_id
    `;

    const params = [];

    if (user.role !== "admin") {
        sql += `
            JOIN users u ON u.employee_id = e.employee_id
            WHERE u.id = ?
        `;
        params.push(user.id);
    }

    sql += " ORDER BY a.attendance_date DESC, e.name ASC";

    db.query(sql, params, (err, rows) => {
        if (err) {
            console.error("Attendance list error:", err);
            return res.status(500).json({
                success: false,
                message: "Unable to load attendance records."
            });
        }

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    });
});

// Admin manually marks or updates attendance
router.post("/mark", requireAuth, requireAdmin, (req, res) => {
    const {
        employee_id,
        attendance_date,
        status,
        notes
    } = req.body;

    const allowedStatuses = [
        "Present",
        "Absent",
        "Leave",
        "Half Day"
    ];

    if (
        !employee_id ||
        !attendance_date ||
        !allowedStatuses.includes(status)
    ) {
        return res.status(400).json({
            success: false,
            message: "Employee, date and valid status are required."
        });
    }

    const sql = `
        INSERT INTO attendance
            (employee_id, attendance_date, status, notes, marked_by)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            notes = VALUES(notes),
            marked_by = VALUES(marked_by)
    `;

    db.query(
        sql,
        [
            employee_id,
            attendance_date,
            status,
            notes || null,
            req.session.user.id
        ],
        (err) => {
            if (err) {
                console.error("Mark attendance error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Unable to save attendance. Check the employee ID."
                });
            }

            res.json({
                success: true,
                message: "Attendance saved successfully."
            });
        }
    );
});

// Employee self check-in
router.post("/check-in", requireAuth, (req, res) => {
    const user = req.session.user;

    if (user.role === "admin") {
        return res.status(403).json({
            success: false,
            message: "Admin accounts cannot use employee check-in."
        });
    }

    const sql = `
        SELECT e.id
        FROM users u
        JOIN employees e ON e.employee_id = u.employee_id
        WHERE u.id = ? AND u.role = 'employee'
        LIMIT 1
    `;

    db.query(sql, [user.id], (err, rows) => {
        if (err) {
            console.error("Check-in lookup error:", err);
            return res.status(500).json({
                success: false,
                message: "Unable to find employee record."
            });
        }

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Employee record not found."
            });
        }

        const employeeDbId = rows[0].id;

        const saveSql = `
            INSERT INTO attendance
                (employee_id, attendance_date, status, check_in)
            VALUES (?, CURDATE(), 'Present', NOW())
            ON DUPLICATE KEY UPDATE
                check_in = IF(check_in IS NULL, NOW(), check_in),
                status = IF(status = 'Absent', 'Present', status)
        `;

        db.query(saveSql, [employeeDbId], (saveErr) => {
            if (saveErr) {
                console.error("Check-in save error:", saveErr);
                return res.status(500).json({
                    success: false,
                    message: "Unable to check in."
                });
            }

            res.json({
                success: true,
                message: "Check-in recorded."
            });
        });
    });
});

// Employee self check-out
router.post("/check-out", requireAuth, (req, res) => {
    const user = req.session.user;

    if (user.role === "admin") {
        return res.status(403).json({
            success: false,
            message: "Admin accounts cannot use employee check-out."
        });
    }

    const sql = `
        SELECT e.id
        FROM users u
        JOIN employees e ON e.employee_id = u.employee_id
        WHERE u.id = ? AND u.role = 'employee'
        LIMIT 1
    `;

    db.query(sql, [user.id], (err, rows) => {
        if (err) {
            console.error("Check-out lookup error:", err);
            return res.status(500).json({
                success: false,
                message: "Unable to find employee record."
            });
        }

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Employee record not found."
            });
        }

        const employeeDbId = rows[0].id;

        const updateSql = `
            UPDATE attendance
            SET check_out = NOW()
            WHERE employee_id = ?
              AND attendance_date = CURDATE()
              AND check_in IS NOT NULL
              AND check_out IS NULL
        `;

        db.query(updateSql, [employeeDbId], (updateErr, result) => {
            if (updateErr) {
                console.error("Check-out save error:", updateErr);
                return res.status(500).json({
                    success: false,
                    message: "Unable to check out."
                });
            }

            if (result.affectedRows === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Check in first, or check-out is already recorded."
                });
            }

            res.json({
                success: true,
                message: "Check-out recorded."
            });
        });
    });
});

module.exports = router;
