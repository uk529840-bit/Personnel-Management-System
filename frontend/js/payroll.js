const form = document.getElementById("payrollForm");
const adminPanel = document.getElementById("adminPanel");
const employeeSelect = document.getElementById("employee_id");
const table = document.getElementById("payrollTable");
const message = document.getElementById("message");

let currentUser = null;

function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "red" : "green";
}

async function api(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const result = await response.json();

    if (!response.ok || result.success === false) {
        throw new Error(result.message || "Request failed");
    }

    return result;
}

function money(value) {
    return "₹" + Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

async function loadEmployees() {
    const result = await api("/api/employees");
    const employees = result.data || [];

    employeeSelect.innerHTML =
        '<option value="">Select Employee</option>';

    employees.forEach(employee => {
        const option = document.createElement("option");

        // Payroll API expects employees.id (database integer),
        // not employee.employee_id (such as EMP001).
        option.value = employee.id;
        option.textContent =
            `${employee.employee_id || employee.id} - ${employee.name}`;

        employeeSelect.appendChild(option);
    });
}

async function loadPayroll() {
    table.innerHTML =
        '<tr><td colspan="10">Loading records...</td></tr>';

    try {
        const result = await api("/api/payroll");
        const records = result.data || [];

        if (records.length === 0) {
            table.innerHTML =
                '<tr><td colspan="10">No payroll records found.</td></tr>';
            return;
        }

        table.innerHTML = records.map(record => {
            const month = record.salary_month
                ? String(record.salary_month).slice(0, 7)
                : "-";

            let action = "-";

            if (currentUser?.role === "admin") {
                if (record.status === "Draft") {
                    action = `<button type="button"
                        data-id="${Number(record.id)}"
                        data-status="Approved">Approve</button>`;
                } else if (record.status === "Approved") {
                    action = `<button type="button"
                        data-id="${Number(record.id)}"
                        data-status="Paid">Mark Paid</button>`;
                }
            }

            return `
                <tr>
                    <td>${escapeHTML(record.employee_name || record.name || record.employee_id)}</td>
                    <td>${escapeHTML(month)}</td>
                    <td>${escapeHTML(record.salary_type)}</td>
                    <td>${money(record.basic_salary)}</td>
                    <td>${escapeHTML(record.payable_days)}</td>
                    <td>${money(record.gross_salary)}</td>
                    <td>${money(record.deductions)}</td>
                    <td>${money(record.net_salary)}</td>
                    <td>${escapeHTML(record.status)}</td>
                    <td>${action}</td>
                </tr>`;
        }).join("");
    } catch (error) {
        table.innerHTML =
            `<tr><td colspan="10">${escapeHTML(error.message)}</td></tr>`;
    }
}

form.addEventListener("submit", async event => {
    event.preventDefault();

    const data = {
        employee_id: Number(employeeSelect.value),
        salary_month: document.getElementById("salary_month").value,
        salary_type: document.getElementById("salary_type").value,
        working_days: Number(document.getElementById("working_days").value),
        payable_days: Number(document.getElementById("payable_days").value),
        allowances: Number(document.getElementById("allowances").value),
        deductions: Number(document.getElementById("deductions").value)
    };

    if (!data.employee_id || !data.salary_month) {
        showMessage("Please select an employee and salary month.", true);
        return;
    }

    if (data.working_days < 1 ||
        data.payable_days < 0 ||
        data.payable_days > data.working_days ||
        data.allowances < 0 ||
        data.deductions < 0) {
        showMessage("Please check the salary and day values.", true);
        return;
    }

    try {
        await api("/api/payroll/generate", {
            method: "POST",
            body: JSON.stringify(data)
        });

        showMessage("Payroll generated successfully.");
        form.reset();
        document.getElementById("working_days").value = 26;
        document.getElementById("payable_days").value = 26;
        document.getElementById("allowances").value = 0;
        document.getElementById("deductions").value = 0;

        await loadPayroll();
    } catch (error) {
        showMessage(error.message, true);
    }
});

table.addEventListener("click", async event => {
    const button = event.target.closest("button[data-id][data-status]");
    if (!button) return;

    try {
        await api(`/api/payroll/${button.dataset.id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: button.dataset.status })
        });

        showMessage(`Payroll status updated to ${button.dataset.status}.`);
        await loadPayroll();
    } catch (error) {
        showMessage(error.message, true);
    }
});

document.getElementById("refreshBtn").addEventListener("click", loadPayroll);

document.getElementById("backBtn").addEventListener("click", () => {
    window.location.href = "/dashboard.html";
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    try {
        await api("/api/auth/logout", { method: "POST" });
        window.location.href = "/login.html";
    } catch (error) {
        showMessage("Logout failed. Please use your existing logout option.", true);
    }
});

async function initialize() {
    try {
        const result = await api("/api/auth/me");
        currentUser = result.user || result.data || result;

        if (currentUser.role === "admin") {
            adminPanel.hidden = false;
            await loadEmployees();
        }

        await loadPayroll();
    } catch (error) {
        showMessage("Please log in again to access payroll.", true);
    }
}

initialize();
