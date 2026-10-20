
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const loginButton = document.getElementById("loginButton");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    message.textContent = "";
    message.className = "message";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            message.textContent =
                result.message || "Login failed. Please try again.";
            return;
        }

        message.textContent = "Login successful!";
        message.classList.add("success");

        window.location.href = "/dashboard.html";

    } catch (error) {
        console.error("Login error:", error);
        message.textContent =
            "Cannot connect to server. Please check the server.";
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Sign In";
    }
});
