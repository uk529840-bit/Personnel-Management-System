
const API_URL = "/api/attendance";

const employeePanel = document.getElementById("employeePanel");
const adminPanel = document.getElementById("adminPanel");
const attendanceForm = document.getElementById("attendanceForm");
const attendanceTableBody = document.getElementById("attendanceTableBody");

const employeeStatus = document.getElementById("employeeStatus");
const adminStatus = document.getElementById("adminStatus");
const recordsStatus = document.getElementById("recordsStatus");

const checkInButton = document.getElementById("checkInButton");
const checkOutButton = document.getElementById("checkOutButton");
const refreshButton = document.getElementById("refreshButton");
const dashboardButton = document.getElementById("dashboardButton");

function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.style.color = isError ? "#c62828" : "#218838";
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(options.headers || {})
        }
    });

    const result = await response.json().catch(() => ({
        success: false,
        message: "Invalid server response."
    }));

    if (response.status === 401) {
        window.location.href = "/login.html";
        throw new Error("Please log in again.");
    }

    if (!response.ok || result.success === false) {
        throw new Error(result.message || "Request failed.");
    }

    return result;
}

// Load logged-in user and show the correct panel
async function loadUser() {
    try {
        const result = await apiRequest("/api/auth/me");
        const user = result.user || result.data || result;

        if (user.role === "admin") {
            adminPanel.hidden = false;
            employeePanel.hidden = true;
        } else {
            employeePanel.hidden = false;
            adminPanel.hidden = true;
        }

        await loadAttendance();
    } catch (error) {
        showMessage(recordsStatus, error.message, true);
    }
}

// Load attendance records
async function loadAttendance() {
    attendanceTableBody.replaceChildren();
    const loadingRow = document.createElement("tr");
    const loadingCell = document.createElement("td");
    loadingCell.colSpan = 7;
    loadingCell.textContent = "Loading records...";
    loadingRow.appendChild(loadingCell);
    attendanceTableBody.appendChild(loadingRow);

    try {
        const result = await apiRequest(API_URL);
        const records = result.data || [];

        attendanceTableBody.replaceChildren();

        if (records.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 7;
            cell.textContent = "No attendance records found.";
            row.appendChild(cell);
            attendanceTableBody.appendChild(row);
        } else {
            records.forEach(record => {
                const row = document.createElement("tr");

                const values = [
                    record.employee_code,
                    record.employee_name,
                    formatDate(record.attendance_date),
                    record.status,
                    formatDateTime(record.check_in),
                    formatDateTime(record.check_out),
                    record.notes || "-"
                ];

                values.forEach(value => {
                    const cell = document.createElement("td");
                    cell.textContent = value ?? "-";
                    row.appendChild(cell);
                });

                attendanceTableBody.appendChild(row);
            });
        }

        showMessage(recordsStatus, `${records.length} record(s) loaded.`);
    } catch (error) {
        attendanceTableBody.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 7;
        cell.textContent = "Unable to load attendance records.";
        row.appendChild(cell);
        attendanceTableBody.appendChild(row);

        showMessage(recordsStatus, error.message, true);
    }
}

function formatDate(value) {
    if (!value) return "-";

    if (typeof value === "string") {
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleDateString("en-IN");
}

function formatDateTime(value) {
    if (!value) return "-";

    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleString("en-IN");
}

// Admin: mark or update attendance
attendanceForm.addEventListener("submit", async event => {
    event.preventDefault();

    const payload = {
        employee_id: Number(document.getElementById("employeeId").value),
        attendance_date: document.getElementById("attendanceDate").value,
        status: document.getElementById("attendanceStatus").value,
        notes: document.getElementById("attendanceNotes").value.trim()
    };

    if (!payload.employee_id || !payload.attendance_date) {
        showMessage(adminStatus, "Enter employee ID and date.", true);
        return;
    }

    try {
        const result = await apiRequest(`${API_URL}/mark`, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        showMessage(adminStatus, result.message);
        await loadAttendance();
    } catch (error) {
        showMessage(adminStatus, error.message, true);
    }
});

// Employee: check in
checkInButton.addEventListener("click", async () => {
    checkInButton.disabled = true;

    try {
        const result = await apiRequest(`${API_URL}/check-in`, {
            method: "POST"
        });

        showMessage(employeeStatus, result.message);
        await loadAttendance();
    } catch (error) {
        showMessage(employeeStatus, error.message, true);
    } finally {
        checkInButton.disabled = false;
    }
});

// Employee: check out
checkOutButton.addEventListener("click", async () => {
    checkOutButton.disabled = true;

    try {
        const result = await apiRequest(`${API_URL}/check-out`, {
            method: "POST"
        });

        showMessage(employeeStatus, result.message);
        await loadAttendance();
    } catch (error) {
        showMessage(employeeStatus, error.message, true);
    } finally {
        checkOutButton.disabled = false;
    }
});

// Refresh records
refreshButton.addEventListener("click", loadAttendance);

// Return to dashboard
dashboardButton.addEventListener("click", () => {
    window.location.href = "/dashboard.html";
});

// Set today's date as the default attendance date
const today = new Date();
const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
].join("-");

document.getElementById("attendanceDate").value = localToday;

// Initialize
loadUser();
