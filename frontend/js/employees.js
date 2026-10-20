
"use strict";

const API = "/api/employees";
let employees = [];
let toastTimer;

const $ = (id) => document.getElementById(id);

function showToast(message, isError = false) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function setPageMessage(message = "") {
  $("pageMessage").textContent = message;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

async function requestJSON(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  const result = await response.json().catch(() => ({}));

  if (response.status === 401) {
    throw new Error("Login session expired. Please login again.");
  }

  if (!response.ok || result.success === false) {
    throw new Error(result.message || `Request failed (${response.status}).`);
  }

  return result;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return escapeHTML(value);

  return date.toLocaleDateString("en-GB");
}

function formatSalary(value) {
  if (value === null || value === undefined || value === "") return "—";

  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  return "₹" + number.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function renderEmployees() {
  const query = $("searchInput").value.trim().toLowerCase();

  const filtered = employees.filter((employee) => {
    const searchable = [
      employee.employee_id,
      employee.name,
      employee.email,
      employee.phone,
      employee.department_name,
      employee.designation
    ].join(" ").toLowerCase();

    return searchable.includes(query);
  });

  $("totalEmployees").textContent = employees.length;
  $("visibleCount").textContent = filtered.length;

  const tbody = $("employeeTableBody");

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          ${employees.length ? "No matching employees found." : "No employees found. Click Add Employee to create a record."}
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((employee) => {
    const id = Number(employee.id);
    const name = escapeHTML(employee.name || "Unnamed");
    const initials = escapeHTML(
      String(employee.name || "?").trim().charAt(0).toUpperCase() || "?"
    );

    return `
      <tr>
        <td>
          <div class="employee-cell">
            <div class="avatar">${initials}</div>
            <div>
              <div class="employee-name">${name}</div>
              <div class="employee-id">${escapeHTML(employee.employee_id || "—")}</div>
            </div>
          </div>
        </td>
        <td>
          <div>${escapeHTML(employee.email || "—")}</div>
          <div class="secondary-text">${escapeHTML(employee.phone || "—")}</div>
        </td>
        <td><span class="department-badge">${escapeHTML(employee.department_name || "—")}</span></td>
        <td>${escapeHTML(employee.designation || "—")}</td>
        <td><span class="salary-text">${formatSalary(employee.salary)}</span></td>
        <td>${formatDate(employee.joining_date)}</td>
        <td>
          <div class="action-buttons">
            <button type="button" class="btn-edit" data-action="edit" data-id="${id}">Edit</button>
            <button type="button" class="btn-delete" data-action="delete" data-id="${id}">Delete</button>
          </div>
        </td>
      </tr>`;
  }).join("");
}

async function loadEmployees() {
  setPageMessage("");
  $("employeeTableBody").innerHTML =
    '<tr><td colspan="7" class="empty-state">Loading employees...</td></tr>';

  try {
    const result = await requestJSON(API);
    employees = Array.isArray(result.data) ? result.data : [];
    renderEmployees();
  } catch (error) {
    employees = [];
    renderEmployees();
    setPageMessage(error.message || "Unable to load employees.");
    $("employeeTableBody").innerHTML =
      `<tr><td colspan="7" class="empty-state">${escapeHTML(error.message || "Unable to load employees.")}</td></tr>`;
  }
}

async function loadDepartmentCount() {
  try {
    const result = await requestJSON("/api/departments");
    const data = Array.isArray(result.data) ? result.data : [];
    $("totalDepartments").textContent = data.length;
  } catch {
    $("totalDepartments").textContent = "—";
  }
}

function openForm(employee = null) {
  $("employeeForm").reset();
  $("formMessage").textContent = "";
  $("recordId").value = employee ? employee.id : "";
  $("formTitle").textContent = employee ? "Edit Employee" : "Add New Employee";
  $("saveEmployee").textContent = employee ? "Update Employee" : "Save Employee";

  if (employee) {
    $("employeeId").value = employee.employee_id || "";
    $("employeeName").value = employee.name || "";
    $("employeeEmail").value = employee.email || "";
    $("employeePhone").value = employee.phone || "";
    $("departmentId").value = employee.department_id ?? "";
    $("designation").value = employee.designation || "";
    $("salary").value = employee.salary ?? "";
    $("joiningDate").value = employee.joining_date
      ? String(employee.joining_date).slice(0, 10)
      : "";
  }

  $("employeeFormPanel").hidden = false;
  $("employeeFormPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  $("employeeName").focus();
}

function closeForm() {
  $("employeeFormPanel").hidden = true;
  $("employeeForm").reset();
  $("recordId").value = "";
  $("formMessage").textContent = "";
}

function getFormData() {
  const departmentValue = $("departmentId").value.trim();
  const salaryValue = $("salary").value.trim();

  return {
    employee_id: $("employeeId").value.trim(),
    name: $("employeeName").value.trim(),
    email: $("employeeEmail").value.trim(),
    phone: $("employeePhone").value.trim(),
    department_id: departmentValue ? Number(departmentValue) : null,
    designation: $("designation").value.trim(),
    salary: salaryValue ? Number(salaryValue) : null,
    joining_date: $("joiningDate").value || null
  };
}

async function saveEmployee(event) {
  event.preventDefault();

  const recordId = $("recordId").value;
  const payload = getFormData();

  if (!payload.employee_id || !payload.name || !payload.email) {
    $("formMessage").textContent = "Employee ID, name and email are required.";
    return;
  }

  if (payload.department_id !== null &&
      (!Number.isInteger(payload.department_id) || payload.department_id < 1)) {
    $("formMessage").textContent = "Enter a valid Department ID.";
    return;
  }

  if (payload.salary !== null &&
      (!Number.isFinite(payload.salary) || payload.salary < 0)) {
    $("formMessage").textContent = "Enter a valid salary.";
    return;
  }

  const saveButton = $("saveEmployee");
  saveButton.disabled = true;
  saveButton.textContent = recordId ? "Updating..." : "Saving...";

  try {
    const result = await requestJSON(
      recordId ? `${API}/${encodeURIComponent(recordId)}` : API,
      {
        method: recordId ? "PUT" : "POST",
        body: JSON.stringify(payload)
      }
    );

    closeForm();
    showToast(result.message || (recordId ? "Employee updated successfully." : "Employee added successfully."));
    await loadEmployees();
    await loadDepartmentCount();
  } catch (error) {
    $("formMessage").textContent = error.message || "Unable to save employee.";
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = $("recordId").value ? "Update Employee" : "Save Employee";
  }
}

async function deleteEmployee(id) {
  const employee = employees.find((item) => Number(item.id) === Number(id));
  if (!employee) return;

  const confirmed = window.confirm(
    `Delete employee ${employee.name} (${employee.employee_id})? This action cannot be undone.`
  );

  if (!confirmed) return;

  try {
    const result = await requestJSON(`${API}/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    showToast(result.message || "Employee deleted successfully.");
    await loadEmployees();
    await loadDepartmentCount();
  } catch (error) {
    showToast(error.message || "Unable to delete employee.", true);
  }
}

$("showAddForm").addEventListener("click", () => openForm());
$("cancelForm").addEventListener("click", closeForm);
$("cancelFormBottom").addEventListener("click", closeForm);
$("employeeForm").addEventListener("submit", saveEmployee);
$("searchInput").addEventListener("input", renderEmployees);

$("showAll").addEventListener("click", () => {
  $("searchInput").value = "";
  renderEmployees();
});

$("refreshEmployees").addEventListener("click", async () => {
  await loadEmployees();
  await loadDepartmentCount();
  showToast("Employee list refreshed.");
});

$("employeeTableBody").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = Number(button.dataset.id);
  const action = button.dataset.action;

  if (action === "edit") {
    const employee = employees.find((item) => Number(item.id) === id);
    if (employee) openForm(employee);
  }

  if (action === "delete") {
    await deleteEmployee(id);
  }
});

loadEmployees();
loadDepartmentCount();
