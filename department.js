let editDepartmentIndex = null;

window.onload = function () {
    loadDepartments();
};

function addDepartment() {

    let id = document.getElementById("deptId").value.trim();
    let name = document.getElementById("deptName").value.trim();
    let head = document.getElementById("deptHead").value.trim();

    if (id === "" || name === "" || head === "") {
        alert("Please fill all fields");
        return;
    }

    let departments = JSON.parse(localStorage.getItem("departments")) || [];

    let duplicate = departments.find((dept, index) =>
        dept.id.toUpperCase() === id.toUpperCase() &&
        index !== editDepartmentIndex
    );

    if (duplicate) {
        alert("Department ID already exists");
        return;
    }

    if (editDepartmentIndex !== null) {

        departments[editDepartmentIndex] = {
            id,
            name,
            head
        };

        editDepartmentIndex = null;
        alert("Department Updated Successfully");

    } else {

        departments.push({
            id,
            name,
            head
        });

        alert("Department Added Successfully");
    }

    // Sort Department ID
    departments.sort(function (a, b) {

        let idA = String(a.id).match(/\d+/);
        let idB = String(b.id).match(/\d+/);

        let numA = idA ? parseInt(idA[0]) : 0;
        let numB = idB ? parseInt(idB[0]) : 0;

        if (numA !== numB) {
            return numA - numB;
        }

        return String(a.id).localeCompare(String(b.id));

    });

    localStorage.setItem("departments", JSON.stringify(departments));

    document.getElementById("departmentForm").reset();

    loadDepartments();

}
function loadDepartments() {

    let table = document.getElementById("departmentTable");

    table.innerHTML = `
    <tr>
        <th>Department ID</th>
        <th>Department Name</th>
        <th>Department Head</th>
        <th>Action</th>
    </tr>`;

    let departments = JSON.parse(localStorage.getItem("departments")) || [];

    departments.forEach(function (dept, index) {

        let row = table.insertRow();

        row.insertCell(0).innerHTML = dept.id;
        row.insertCell(1).innerHTML = dept.name;
        row.insertCell(2).innerHTML = dept.head;

        row.insertCell(3).innerHTML =
        `<button onclick="editDepartment(${index})">Edit</button>
         <button onclick="deleteDepartment(${index})">Delete</button>`;

    });

    updateDepartmentCount();

}

function searchDepartment() {

    let input = document.getElementById("searchDepartment").value.toLowerCase();

    let table = document.getElementById("departmentTable");

    for (let i = 1; i < table.rows.length; i++) {

        let id = table.rows[i].cells[0].innerHTML.toLowerCase();
        let name = table.rows[i].cells[1].innerHTML.toLowerCase();
        let head = table.rows[i].cells[2].innerHTML.toLowerCase();

        if (
            id.includes(input) ||
            name.includes(input) ||
            head.includes(input)
        ) {
            table.rows[i].style.display = "";
        } else {
            table.rows[i].style.display = "none";
        }

    }

}

function editDepartment(index) {

    let departments = JSON.parse(localStorage.getItem("departments")) || [];

    document.getElementById("deptId").value = departments[index].id;
    document.getElementById("deptName").value = departments[index].name;
    document.getElementById("deptHead").value = departments[index].head;

    editDepartmentIndex = index;

}

function deleteDepartment(index) {

    if (!confirm("Are you sure you want to delete this department?")) {
        return;
    }

    let departments = JSON.parse(localStorage.getItem("departments")) || [];

    departments.splice(index, 1);

    localStorage.setItem("departments", JSON.stringify(departments));

    loadDepartments();

}

function updateDepartmentCount() {

    let departments = JSON.parse(localStorage.getItem("departments")) || [];

    let count = document.getElementById("departmentCount");

    if (count) {
        count.innerHTML = departments.length;
    }

}