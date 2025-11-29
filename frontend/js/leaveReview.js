document.getElementById("submitReview").addEventListener("click", async () => {
    const stockListId = document.getElementById("stockListId").value.trim();
    const review = document.getElementById("review").value.trim();
    const messageDiv = document.getElementById("message");

    messageDiv.textContent = "";

    if (!stockListId || isNaN(stockListId)) {
        messageDiv.textContent = "Please enter a valid Stock List ID.";
        return;
    }

    if (!review) {
        messageDiv.textContent = "Please enter your review.";
        return;
    }

    try {
        const res = await fetch("/reviews", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ stockListId, review })
        });

        const data = await res.json();

        if (res.ok) {
            messageDiv.style.color = "green";
            messageDiv.textContent = "Review created successfully!";
            document.getElementById("review").value = "";

            // send user to reviews page
            setTimeout(() => {
                window.location.href = "/stockLists.html";
            }, 1500);
        } else {
            messageDiv.style.color = "red";
            messageDiv.textContent = data.error || "Failed to create review.";
        }
    } catch (err) {
        messageDiv.style.color = "red";
        messageDiv.textContent = "An unexpected error occurred.";
        console.error(err);
        alert("Error creating review: " + err.message);
    }
});