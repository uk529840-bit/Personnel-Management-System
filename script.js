let editEmployeeIndex = null;

window.onload = function () {
    loadEmployees();
};

function addEmployee() {

    let id = document.getElementById("empid").value.trim();
    let name = document.getElementById("empname").value.trim();
    let department = document.getElementById("department").value.trim();
    let designation = document.getElementById("designation").value.trim();
    let salary = document.getElementById("salary").value.trim();

    if (id === "" || name === "" || department === "" || designation === "" || salary === "") {
        alert("Please fill all fields");
        return;
    }

    let employees = JSON.parse(localStorage.getItem("employees")) || [];

    let duplicate = employees.find((emp, index) =>
        emp.id.toUpperCase() === id.toUpperCase() &&
        index !== editEmployeeIndex
    );

    if (duplicate) {
        alert("Employee ID already exists");
        return;
    }

    let employee = {
        id: id,
        name: name,
        department: department,
        designation: designation,
        salary: salary
    };

    if (editEmployeeIndex !== null) {
        employees[editEmployeeIndex] = employee;
        editEmployeeIndex = null;
        alert("Employee Updated Successfully");
    } else {
        employees.push(employee);
        alert("Employee Added Successfully");
    }

    // Auto Sort by Employee ID
    employees.sort(function (a, b) {

        let numA = parseInt(a.id.replace(/\D/g, "")) || 0;
        let numB = parseInt(b.id.replace(/\D/g, "")) || 0;

        if (numA !== numB) {
            return numA - numB;
        }

        return a.id.localeCompare(b.id);

    });

    localStorage.setItem("employees", JSON.stringify(employees));

    document.getElementById("employeeForm").reset();

    loadEmployees();

}
function loadEmployees() {

    let employees = JSON.parse(localStorage.getItem("employees")) || [];

    let table = document.getElementById("employeeTable");

    table.innerHTML = `
        <tr>
            <th>Employee ID</th>
            <th>Name</th>
            <th>Department</th>
            <th>Designation</th>
            <th>Salary</th>
            <th>Action</th>
        </tr>
    `;

    employees.forEach(function(emp, index) {

        let row = table.insertRow();

        row.insertCell(0).innerHTML = emp.id;
        row.insertCell(1).innerHTML = emp.name;
        row.insertCell(2).innerHTML = emp.department;
        row.insertCell(3).innerHTML = emp.designation;
        row.insertCell(4).innerHTML = emp.salary;

        row.insertCell(5).innerHTML =
        `<button onclick="editEmployee(${index})">Edit</button>
         <button onclick="deleteEmployee(${index})">Delete</button>`;

    });

    updateCount();

}

function searchEmployee() {

    let input = document.getElementById("search").value.toLowerCase();

    let table = document.getElementById("employeeTable");

    for (let i = 1; i < table.rows.length; i++) {

        let id = table.rows[i].cells[0].innerText.toLowerCase();
        let name = table.rows[i].cells[1].innerText.toLowerCase();
        let department = table.rows[i].cells[2].innerText.toLowerCase();

        if (
            id.includes(input) ||
            name.includes(input) ||
            department.includes(input)
        ) {
            table.rows[i].style.display = "";
        } else {
            table.rows[i].style.display = "none";
        }

    }

}

function editEmployee(index) {

    let employees = JSON.parse(localStorage.getItem("employees")) || [];

    document.getElementById("empid").value = employees[index].id;
    document.getElementById("empname").value = employees[index].name;
    document.getElementById("department").value = employees[index].department;
    document.getElementById("designation").value = employees[index].designation;
    document.getElementById("salary").value = employees[index].salary;

    editEmployeeIndex = index;

}

function deleteEmployee(index) {

    if (!confirm("Delete this employee?")) {
        return;
    }

    let employees = JSON.parse(localStorage.getItem("employees")) || [];

    employees.splice(index, 1);

    localStorage.setItem("employees", JSON.stringify(employees));

    loadEmployees();

}

function updateCount() {

    let employees = JSON.parse(localStorage.getItem("employees")) || [];

    let count = document.getElementById("employeeCount");

    if (count) {
        count.innerHTML = employees.length;
    }

}