const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");

const router = express.Router();

const uploadDirectory = path.join(
    __dirname,
    "..",
    "uploads",
    "employees"
);

fs.mkdirSync(uploadDirectory, { recursive: true });

function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Please log in first."
        });
    }

    next();
}

function requireAdmin(req, res, next) {
    if (req.session.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Admin access required."
        });
    }

    next();
}

const storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, uploadDirectory);
    },

    filename: function (req, file, callback) {
        const extension = path.extname(file.originalname).toLowerCase();
        const filename =
            Date.now() + "-" +
            Math.round(Math.random() * 1e9) +
            extension;

        callback(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: function (req, file, callback) {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return callback(
                new Error("Only JPG, PNG and WEBP images are allowed.")
            );
        }

        callback(null, true);
    }
});

// GET: View logged-in employee's own profile
router.get("/me", requireAuth, (req, res) => {
    const user = req.session.user;

    if (user.role === "admin") {
        return res.json({
            success: true,
            message: "Admin account",
            user: {
                username: user.username,
                role: user.role
            },
            data: null
        });
    }

    db.query(
        `SELECT
            e.employee_id,
            e.name,
            e.email,
            e.phone,
            e.department_id,
            d.department_name,
            e.designation,
            e.joining_date,
            e.profile_photo
         FROM users u
         JOIN employees e ON e.employee_id = u.employee_id
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE u.id = ? AND u.role = 'employee'
         LIMIT 1`,
        [user.id],
        (error, rows) => {
            if (error) {
                console.error("Profile query failed:", error.message);

                return res.status(500).json({
                    success: false,
                    message: "Unable to load profile."
                });
            }

            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "No employee profile is linked to this account."
                });
            }

            res.json({
                success: true,
                user: {
                    username: user.username,
                    role: user.role
                },
                data: rows[0]
            });
        }
    );
});

// POST: Admin uploads an employee photo
router.post(
    "/:employeeId/photo",
    requireAuth,
    requireAdmin,
    (req, res, next) => {
        upload.single("photo")(req, res, (error) => {
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message || "Photo upload failed."
                });
            }

            next();
        });
    },
    (req, res) => {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please select a photo."
            });
        }

        const employeeId = req.params.employeeId;
        const photoPath = "/uploads/employees/" + req.file.filename;

        db.query(
            "SELECT profile_photo FROM employees WHERE employee_id = ? LIMIT 1",
            [employeeId],
            (findError, rows) => {
                if (findError || rows.length === 0) {
                    fs.unlink(req.file.path, () => {});

                    if (findError) {
                        return res.status(500).json({
                            success: false,
                            message: "Unable to find employee."
                        });
                    }

                    return res.status(404).json({
                        success: false,
                        message: "Employee not found."
                    });
                }

                const oldPhoto = rows[0].profile_photo;

                db.query(
                    "UPDATE employees SET profile_photo = ? WHERE employee_id = ?",
                    [photoPath, employeeId],
                    (updateError) => {
                        if (updateError) {
                            fs.unlink(req.file.path, () => {});

                            return res.status(500).json({
                                success: false,
                                message: "Unable to save photo path."
                            });
                        }

                        // Remove previous photo if it belongs to this upload folder.
                        if (oldPhoto) {
                            const oldFilename = path.basename(oldPhoto);
                            const oldPath = path.join(uploadDirectory, oldFilename);

                            if (oldFilename === oldPhoto.replace(/^.*\//, "")) {
                                fs.unlink(oldPath, () => {});
                            }
                        }

                        res.json({
                            success: true,
                            message: "Employee photo uploaded successfully.",
                            profile_photo: photoPath
                        });
                    }
                );
            }
        );
    }
);

module.exports = router;
