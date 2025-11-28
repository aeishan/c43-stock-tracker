document.getElementById("addStockBtn").addEventListener("click", () => {
    const container = document.getElementById("stocksContainer");
    const div = document.createElement("div");
    div.classList.add("stock-input");
    div.innerHTML = `
      <input type="text" placeholder="Symbol (e.g. AAPL)" class="symbol">
      <input type="text" placeholder="Portfolio ID (e.g. 101)" class="portfolio_id">
    `;
    container.appendChild(div);
  });
  
  document.getElementById("submitBtn").addEventListener("click", async () => {
    const visibility = document.getElementById("visibility").value;
  
    const stockInputs = document.querySelectorAll(".stock-input");
    const stocks = [];
  
    for (const inputDiv of stockInputs) {
      const symbol = inputDiv.querySelector(".symbol").value.trim();
      const portfolio_id = inputDiv.querySelector(".portfolio_id").value.trim();
  
      if (symbol && portfolio_id) {
        stocks.push({ symbol, portfolio_id: parseInt(portfolio_id) });
      }
    }
  
    if (stocks.length === 0) {
      document.getElementById("resultMsg").textContent = "Please add at least one valid stock.";
      return;
    }
  
    try {
      const res = await fetch("/stockLists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ visibility, stocks })
      });
  
      const result = await res.json();
  
      if (!res.ok) {
        document.getElementById("resultMsg").textContent = result.error || "Failed to create stock list.";
        return;
      }
  
      document.getElementById("resultMsg").textContent = "Stock list created successfully!";

    // send user back to stock lists page 
        setTimeout(() => {
            window.location.href = "/stockLists.html";
        }, 1500);
    } catch (err) {
      document.getElementById("resultMsg").textContent = "Error: " + err.message;
    }
  });