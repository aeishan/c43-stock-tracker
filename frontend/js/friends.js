document.addEventListener("DOMContentLoaded", async () => {
    try {
        await fetchFriends();
        await fetchIncoming();
        await fetchOutgoing();
    } catch (err) {
        console.error("Error loading data:", err);
        alert("Error loading data: " + err.message);
    }
});

async function fetchFriends() {
    const res = await fetch("/friends/accepted", { credentials: "include" });
    if (!res.ok) return console.error("Failed to load friends");
    const data = await res.json();

    const list = document.getElementById("friendsList");
    list.innerHTML = "";
    data.forEach(({ friend_username, friend_id }) => {
        const li = document.createElement("li");
        li.className = "friend-card";
        li.innerHTML = `
            <span>${friend_username}</span>
            <button class="remove-btn">Remove</button>
        `;

        li.querySelector(".remove-btn").onclick = () => removeFriend(friend_id, friend_username);

        list.appendChild(li);
    });
}

async function removeFriend(friendId, friendName) {
    if (!confirm(`Are you sure you want to remove ${friendName} as a friend?`)) return;

    try {
        const res = await fetch(`/friends/${friendId}`, {
            method: "DELETE",
            credentials: "include"
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Failed to remove friend.");
            return;
        }

        alert("Friend removed successfully.");
        await fetchFriends();
    } catch (err) {
        alert("Error removing friend: " + err.message);
    }
}

async function fetchIncoming() {
    const res = await fetch("/friends/requests/incoming", { credentials: "include" });
    if (!res.ok) return console.error("Failed to load incoming requests");
    const data = await res.json();

    const list = document.getElementById("incomingList");
    list.innerHTML = "";

    data.forEach(({ friend_username, friend_id, time_modified }) => {
        const li = document.createElement("li");
        li.className = "friend-card";

        li.innerHTML = `
        <strong>${friend_username} (${friend_id})</strong>
        <div class="modified-time">Sent: ${new Date(time_modified).toLocaleString()}</div>
        <div class="action-row" style="margin-top:10px;">
        <button class="accept-btn">Accept</button>
        <button class="reject-btn">Reject</button>
        </div>
        `;

        // Attach button actions
        li.querySelector(".accept-btn").onclick = () => interactRequest(friend_id, "accepted");
        li.querySelector(".reject-btn").onclick = () => interactRequest(friend_id, "rejected");

        list.appendChild(li);
    });
}

async function interactRequest(senderId, newStatus) {
    try {
        const res = await fetch("/friends/requests/interact", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ senderId, newStatus })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Failed to process request.");
            return;
        }

        alert(`Request ${newStatus}!`);
        await fetchIncoming();
        await fetchFriends();   // a new friend might appear
    } catch (err) {
        alert("Error: " + err.message);
    }
}

async function fetchOutgoing() {
    const res = await fetch("/friends/requests/outgoing", { credentials: "include" });
    if (!res.ok) return console.error("Failed to load outgoing requests");
    const data = await res.json();

    const list = document.getElementById("outgoingList");
    list.innerHTML = "";
    data.forEach(({ friend_username, friend_id, time_modified }) => {
        const li = document.createElement("li");
        li.className = "friend-card";
        li.innerHTML = `
        <strong>${friend_username} (${friend_id})</strong>
        <div class="modified-time">Sent: ${new Date(time_modified).toLocaleString()}</div>
      `;
        list.appendChild(li);
    });
}

async function sendFriendRequest() {
    const input = document.getElementById("friendIdInput");
    const receiverId = parseInt(input.value);

    if (!receiverId || isNaN(receiverId)) {
        alert("Please enter a valid numeric Account ID.");
        return;
    }

    try {
        const res = await fetch("/friends/requests/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ receiverId }),
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Failed to send friend request.");
            return;
        }

        alert("Friend request sent successfully!");
        fetchOutgoing();
        input.value = "";
    } catch (err) {
        alert("Error sending friend request: " + err.message);
    }
}