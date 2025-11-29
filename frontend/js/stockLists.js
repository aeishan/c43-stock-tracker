const endpoints = [
    "/stockLists/public",
    "/stockLists/owned",
    "/stockLists/shared",
];

const stockListsContainer = document.getElementById("stockListsContainer");

async function fetchJson(url) {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    return await res.json();
}

function mergeAndDedup(lists) {
    const seen = new Set();
    const merged = [];

    for (const list of lists) {
        if (!seen.has(list.stocklistID)) {
            seen.add(list.stocklistID);
            merged.push(list);
        }
    }

    return merged;
}


function createStockListCard(list) {
    const div = document.createElement("div");
    div.className = "stock-list-card";

    const title = document.createElement("h3");
    title.textContent = `StockList ID: ${list.stocklistID}`;

    const owner = document.createElement("p");
    owner.textContent = `Owner ID: ${list.ownerID}`;

    const visibility = document.createElement("p");
    visibility.textContent = `Visibility: ${list.visibility.toUpperCase()}`;

    const stockList = document.createElement("ul");
    list.stocks.forEach((stock) => {
        const li = document.createElement("li");
        li.textContent = `${stock.symbol} - ${stock.shares}`;
        stockList.appendChild(li);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.style.marginTop = "10px";
    deleteBtn.onclick = async () => {
        const confirmed = confirm(
            `Are you sure you want to delete StockList ID ${list.stocklistID}?`
        );
        if (!confirmed) return;

        try {
            const res = await fetch(`/stockLists/${list.stocklistID}`, {
                method: "DELETE",
                credentials: "include",
            });

            const result = await res.json();

            if (!res.ok) {
                alert(result.error || "Failed to delete stock list");
                return;
            }

            div.remove();
            alert("Deleted successfully");
        } catch (err) {
            alert("Error deleting stock list: " + err.message);
        }
    };

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.onclick = async () => {
        const newVisibility = prompt(
            "Enter new visibility (e.g. public/private):",
            list.visibility
        );
        if (!newVisibility) return;

        const newStocksRaw = prompt(
            "Enter stocks as comma-separated entries like SYMBOL:PORTFOLIO_ID\nExample: AAPL:1,GOOG:2",
            list.stocks.map((s) => `${s.symbol}:${s.portfolio_id}`).join(",")  // pre-fill current stocks in prompt
        );
        if (!newStocksRaw) return;

        const stocks = newStocksRaw.split(",").map((entry) => {
            const [symbol, portfolio_id] = entry.trim().split(":");
            return { symbol: symbol.trim(), portfolio_id: parseInt(portfolio_id) };
        });

        try {
            const res = await fetch(`/stockLists/${list.stocklistID}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({ visibility: newVisibility, stocks }),
            });

            const result = await res.json();

            if (!res.ok) {
                alert(result.error || "Failed to edit stock list");
                return;
            }

            alert(
                "Stock list updated successfully. Please refresh the page to see changes."
            );
        } catch (err) {
            alert("Error editing stock list: " + err.message);
        }
    };

    div.appendChild(title);
    div.appendChild(owner);
    div.appendChild(visibility);
    div.appendChild(stockList);
    div.appendChild(deleteBtn);
    div.appendChild(editBtn);

    return div;
}

(async () => {
    try {
        const allResults = await Promise.all(endpoints.map((e) => fetchJson(e)));
        const flat = allResults.flat();
        const unique = mergeAndDedup(flat);

        stockListsContainer.innerHTML = "";
        if (unique.length === 0) {
            stockListsContainer.textContent = "No stock lists found.";
            return;
        }

        unique.forEach((stockList) => {
            const card = createStockListCard(stockList);
            stockListsContainer.appendChild(card);
        });
    } catch (err) {
        stockListsContainer.textContent = `Error: ${err.message}`;
        alert(`Error fetching stock lists: ${err.message}`);
    }
})();

document.getElementById("shareForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const viewerId = document.getElementById("viewerId").value.trim();
    const stockListId = document.getElementById("stockListId").value.trim();

    if (!viewerId || !stockListId) {
        alert("Please enter both Friend ID and Stock List ID.");
        return;
    }

    try {
        const res = await fetch(`/stockLists/${stockListId}/share`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ viewerId: parseInt(viewerId) }),
        });

        const result = await res.json();

        if (!res.ok) {
            alert(result.error || "Failed to share stock list.");
            return;
        }

        alert("Stock list shared successfully!");
    } catch (err) {
        alert("Error sharing stock list: " + err.message);
    }
});
