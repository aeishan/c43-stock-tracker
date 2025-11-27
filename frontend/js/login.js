const API = "http://localhost:3000";

// Show messages
function showMessage(msg, isError = false) {
    const m = document.getElementById("message");
    m.style.color = isError ? "red" : "lightgreen";
    m.textContent = msg;
}

// ----- SIGN IN -----
document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;

    try {
        const res = await fetch(`${API}/user/signin`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (!res.ok) return showMessage(data.error, true);

        showMessage("Login successful!");
        // Redirect to dashboard or portfolio page
        setTimeout(() => {
            window.location.href = "/home.html"; // you'll create this later
        }, 1000);

    } catch (err) {
        showMessage("Network error", true);
    }
});

// ----- SIGN UP -----
document.getElementById("signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("signup-username").value;
    const password = document.getElementById("signup-password").value;

    try {
        const res = await fetch(`${API}/user/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (!res.ok) return showMessage(data.error, true);

        showMessage("Registration successful! You can now log in.");
    } catch (err) {
        showMessage("Network error", true);
    }
});
