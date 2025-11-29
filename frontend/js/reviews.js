async function fetchReviews() {
    const stockListId = parseInt(document.getElementById("stockListIdInput").value);
    const container = document.getElementById("reviewsContainer");
    container.innerHTML = ""; 
  
    if (isNaN(stockListId)) {
      alert("Please enter a valid stock list ID.");
      return;
    }
  
    try {
      const res = await fetch(`/reviews/${stockListId}`, {
        credentials: "include",
      });
  
      const data = await res.json();
  
      if (!res.ok) {
        alert(data.error || "Failed to fetch reviews.");
        return;
      }
  
      if (data.length === 0) {
        container.textContent = "No reviews found for this stock list.";
        return;
      }
  
      data.forEach((review) => {
        const card = document.createElement("div");
        card.className = "review-card";
  
        const user = document.createElement("p");
        user.innerHTML = `<strong>User:</strong> ${review.username}`;
  
        const content = document.createElement("p");
        content.innerHTML = `<strong>Review:</strong> <span class="review-content">${review.review}</span>`;
  
        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.onclick = () => editReview(review.review_id, card);
  
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.onclick = () => deleteReview(review.review_id);
  
        card.appendChild(user);
        card.appendChild(content);
        card.appendChild(editBtn);
        card.appendChild(deleteBtn);
  
        container.appendChild(card);
      });
    } catch (err) {
      alert("Error fetching reviews: " + err.message);
    }
  }
  
  async function deleteReview(reviewId) {
    const confirmDelete = confirm("Are you sure you want to delete this review?");
    if (!confirmDelete) return;
  
    try {
      const res = await fetch(`/reviews/${reviewId}`, {
        method: "DELETE",
        credentials: "include",
      });
  
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to delete review.");
        return;
      }
  
      alert("Review deleted.");
      fetchReviews(); // Refresh the reviews
    } catch (err) {
      alert("Error deleting review: " + err.message);
    }
  }
  
  async function editReview(reviewId, card) {
    const newContent = prompt("Enter new review content:", card.querySelector(".review-content").textContent);
    if (newContent === null) return; 
    if (newContent.trim() === "") {
        alert("Review content cannot be empty.");
        return;
    }
  
    try {
      const res = await fetch(`/reviews/${reviewId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ review: newContent }),
      });
  
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update review.");
        return;
      }
  
      alert("Review updated.");
      // Update the content on the page without refreshing
      const contentSpan = card.querySelector(".review-content");
      if (contentSpan) contentSpan.textContent = newContent;
    } catch (err) {
      alert("Error updating review: " + err.message);
    }
  }