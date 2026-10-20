
const express = require("express");
const db = require("../db");

const router = express.Router();

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

function validMonth(value) {
    return typeof value === "string" &&
        /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

// List payroll records
// Admin: all employees
// Employee: own payroll only
router.get("/", requireAuth, (req, res) => {
    const user = req.session.user;

    let sql = `
        SELECT
            p.id,
            e.employee_id AS employee_code,
            e.name AS employee_name,
            p.salary_month,
            p.salary_type,
            p.basic_salary,
            p.working_days,
            p.payable_days,
            p.allowances,
            p.deductions,
            p.gross_salary,
            p.net_salary,
            p.status
        FROM payroll p
        JOIN employees e ON e.id = p.employee_id
    `;

    const params = [];

    if (user.role !== "admin") {
        sql += `
            JOIN users u ON u.employee_id = e.employee_id
            WHERE u.id = ? AND u.role = 'employee'
        `;
        params.push(user.id);
    }

    sql += " ORDER BY p.salary_month DESC, e.name ASC";

    db.query(sql, params, (err, rows) => {
        if (err) {
            console.error("Payroll list error:", err);
            return res.status(500).json({
                success: false,
                message: "Unable to load payroll records."
            });
        }

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    });
});

// Generate payroll for one employee
router.post("/generate", requireAuth, requireAdmin, (req, res) => {
    const {
        employee_id,
        salary_month,
        salary_type,
        working_days,
        payable_days,
        allowances,
        deductions
    } = req.body;

    const employeeDbId = Number(employee_id);
    const workingDays = Number(working_days);
    const payableDays = Number(payable_days);
    const allowanceAmount = Number(allowances ?? 0);
    const deductionAmount = Number(deductions ?? 0);

    if (
        !Number.isSafeInteger(employeeDbId) ||
        employeeDbId <= 0 ||
        !validMonth(salary_month) ||
        !["Fixed", "Attendance Based"].includes(salary_type) ||
        !Number.isInteger(workingDays) ||
        workingDays < 1 ||
        workingDays > 31 ||
        !Number.isFinite(payableDays) ||
        payableDays < 0 ||
        payableDays > workingDays ||
        !Number.isFinite(allowanceAmount) ||
        allowanceAmount < 0 ||
        !Number.isFinite(deductionAmount) ||
        deductionAmount < 0
    ) {
        return res.status(400).json({
            success: false,
            message: "Enter valid employee, month, salary type, days and amounts."
        });
    }

    // Use the employee's saved monthly salary as the base salary.
    db.query(
        "SELECT id, salary FROM employees WHERE id = ? LIMIT 1",
        [employeeDbId],
        (employeeErr, employees) => {
            if (employeeErr) {
                console.error("Employee salary lookup error:", employeeErr);
                return res.status(500).json({
                    success: false,
                    message: "Unable to retrieve employee salary."
                });
            }

            if (!employees.length) {
                return res.status(404).json({
                    success: false,
                    message: "Employee not found."
                });
            }

            const basicSalary = Number(employees[0].salary);

            if (!Number.isFinite(basicSalary) || basicSalary < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Employee has an invalid base salary."
                });
            }

            // Fixed: full monthly salary.
            // Attendance Based: monthly salary proportional to payable days.
            const earnedSalary = salary_type === "Fixed"
                ? basicSalary
                : basicSalary * (payableDays / workingDays);

            const grossSalary = Math.round(
                (earnedSalary + allowanceAmount) * 100
            ) / 100;

            const netSalary = Math.round(
                (grossSalary - deductionAmount) * 100
            ) / 100;

            if (netSalary < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Deductions cannot exceed gross salary."
                });
            }

            const monthDate = `${salary_month}-01`;

            const sql = `
                INSERT INTO payroll (
                    employee_id,
                    salary_month,
                    salary_type,
                    basic_salary,
                    working_days,
                    payable_days,
                    allowances,
                    deductions,
                    gross_salary,
                    net_salary,
                    status,
                    generated_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?)
                ON DUPLICATE KEY UPDATE
                    salary_type = IF(status = 'Draft', VALUES(salary_type), salary_type),
                    basic_salary = IF(status = 'Draft', VALUES(basic_salary), basic_salary),
                    working_days = IF(status = 'Draft', VALUES(working_days), working_days),
                    payable_days = IF(status = 'Draft', VALUES(payable_days), payable_days),
                    allowances = IF(status = 'Draft', VALUES(allowances), allowances),
                    deductions = IF(status = 'Draft', VALUES(deductions), deductions),
                    gross_salary = IF(status = 'Draft', VALUES(gross_salary), gross_salary),
                    net_salary = IF(status = 'Draft', VALUES(net_salary), net_salary),
                    generated_by = IF(status = 'Draft', VALUES(generated_by), generated_by)
            `;

            db.query(
                sql,
                [
                    employeeDbId,
                    monthDate,
                    salary_type,
                    basicSalary,
                    workingDays,
                    payableDays,
                    allowanceAmount,
                    deductionAmount,
                    grossSalary,
                    netSalary,
                    req.session.user.id
                ],
                (saveErr, result) => {
                    if (saveErr) {
                        console.error("Payroll save error:", saveErr);
                        return res.status(500).json({
                            success: false,
                            message: "Unable to save payroll."
                        });
                    }

                    res.json({
                        success: true,
                        message: "Payroll saved as Draft.",
                        payroll_id: result.insertId || null,
                        calculation: {
                            basic_salary: basicSalary,
                            earned_salary: Math.round(earnedSalary * 100) / 100,
                            allowances: allowanceAmount,
                            deductions: deductionAmount,
                            gross_salary: grossSalary,
                            net_salary: netSalary
                        }
                    });
                }
            );
        }
    );
});

// Update payroll status
router.patch("/:id/status", requireAuth, requireAdmin, (req, res) => {
    const payrollId = Number(req.params.id);
    const { status } = req.body;

    if (
        !Number.isSafeInteger(payrollId) ||
        payrollId <= 0 ||
        !["Approved", "Paid"].includes(status)
    ) {
        return res.status(400).json({
            success: false,
            message: "Valid payroll ID and status are required."
        });
    }

    const sql = `
        UPDATE payroll
        SET status = ?
        WHERE id = ?
          AND (
              (? = 'Approved' AND status = 'Draft')
              OR
              (? = 'Paid' AND status = 'Approved')
          )
    `;

    db.query(sql, [status, payrollId, status, status], (err, result) => {
        if (err) {
            console.error("Payroll status update error:", err);
            return res.status(500).json({
                success: false,
                message: "Unable to update payroll status."
            });
        }

        if (result.affectedRows === 0) {
            return res.status(400).json({
                success: false,
                message: "Payroll not found or invalid status transition."
            });
        }

        res.json({
            success: true,
            message: `Payroll status updated to ${status}.`
        });
    });
});

module.exports = router;
