const stockListEl = document.getElementById("stockList");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const searchResult = document.getElementById("searchResult");

const addPanel = document.getElementById("addStockPanel");
const toggleAddStock = document.getElementById("toggleAddStock");
const addSymbol = document.getElementById("addSymbol");
const addTimestamp = document.getElementById("addTimestamp");
const addOpen = document.getElementById("addOpen");
const addHigh = document.getElementById("addHigh");
const addLow = document.getElementById("addLow");
const addClose = document.getElementById("addClose");
const addVolume = document.getElementById("addVolume");
const submitAddStockBtn = document.getElementById("submitAddStock");
const addStockMsg = document.getElementById("addStockMsg");

const rangeChartCanvas = document.getElementById("rangeChart");
let rangeChart = null;

if (!stockListEl) {
  console.error("Expected #stockList element in DOM");
}

// Utility: safe fetch JSON
async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { credentials: "include", ...opts });
  if (!res.ok) {
    // try to parse error body for message, otherwise throw status
    try {
      const err = await res.json();
      throw new Error(err.error || JSON.stringify(err));
    } catch (_) {
      throw new Error(`HTTP ${res.status}`);
    }
  }
  // allow empty body handling
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch (e) {
    throw new Error("Invalid JSON response");
  }
}

// Ensure add panel hidden on load (robust)
function hideAddPanel() {
  if (addPanel) {
    addPanel.style.display = "none";
    toggleAddStock.textContent = "Add Stock Data ▼";
  }
}

function showAddPanel() {
  if (addPanel) {
    addPanel.style.display = "block";
    toggleAddStock.textContent = "Add Stock Data ▲";
  }
}

function panelIsVisible() {
  if (!addPanel) return false;
  // use computed style so empty style.display is handled
  return window.getComputedStyle(addPanel).display !== "none";
}

// Load all stocks and render list
async function loadAllStocks() {
  try {
    const data = await fetchJson("/stocks/"); // matches backend mount
    stockListEl.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      stockListEl.innerHTML = "<p style='color:#bbb;'>No stocks found.</p>";
      return;
    }

    data.forEach(stock => {
      const div = document.createElement("div");
      div.className = "stock-item";
      div.dataset.symbol = stock.symbol;
      div.innerHTML = `<span><strong>${stock.symbol}</strong></span><span>$${stock.current_price}</span>`;
      // click handler: show details for clicked symbol
      div.addEventListener("click", () => onStockClick(stock.symbol));
      stockListEl.appendChild(div);
    });
  } catch (err) {
    console.error("Error loading all stocks:", err);
    stockListEl.innerHTML = `<p style="color:red">Failed to load stocks: ${err.message}</p>`;
  }
}

// On stock click: show current price and a small UI for range selection
async function onStockClick(symbol) {
  searchResult.innerHTML = "<p>Loading stock...</p>";

  try {
    const current = await fetchJson(`/stocks/${encodeURIComponent(symbol)}/current`);
    searchResult.innerHTML = `
      <h3>${current?.symbol ?? symbol}</h3>
      <p>Current Price: $${current?.current_price ?? "N/A"}</p>
      <div style="margin-top:12px;">
        <label>Start: <input id="rangeStart" type="date"></label>
        <label style="margin-left:10px;">End: <input id="rangeEnd" type="date"></label>
        <button id="rangeBtn" style="margin-left:10px;">Load Range</button>
      </div>
      <div id="statsBox" style="margin-top:12px;"></div>
    `;

    // attach handler for range button
    document.getElementById("rangeBtn").addEventListener("click", () => loadRangeForSymbol(symbol));
  } catch (err) {
    searchResult.innerHTML = `<p style="color:red;">${err.message}</p>`;
  }

  // Ensure page doesn't scroll weirdly: bring search result into view
  searchResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

const chartContainer = document.getElementById("chartContainer");
chartContainer.classList.add("hidden");       

// Load range, plot chart, show stats
async function loadRangeForSymbol(symbol) {
  const start = document.getElementById("rangeStart").value;
  const end = document.getElementById("rangeEnd").value;
  if (!start || !end) {
    alert("Please select start and end dates.");
    return;
  }

  try {
    const json = await fetchJson(`/stocks/range?symbol=${encodeURIComponent(symbol)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
    const daily = json.daily || [];
    const stats = (json.stats && json.stats[0]) ? json.stats[0] : null;

    if (!Array.isArray(daily) || daily.length === 0) { 
      alert("No daily data for the selected range.");
      return;
    }

    chartContainer.classList.remove("hidden");

    const labels = daily.map(d => (d.timestamp || d.date || "").slice(0, 10));
    const prices = daily.map(d => d.close);

    // Make sure canvas exists and has context
    if (!rangeChartCanvas) {
      console.warn("No chart canvas found");
      return;
    }

    if (rangeChart) rangeChart.destroy();

    const ctx = rangeChartCanvas.getContext("2d");
    rangeChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: `${symbol} Close Price`,
          data: prices,
          borderWidth: 2,
          tension: 0.1,
          pointRadius: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    // render stats
    const statsBox = document.getElementById("statsBox");
    if (statsBox) {
      statsBox.innerHTML = `
        <p><strong>Beta:</strong> ${stats?.beta ?? "N/A"}</p>
        <p><strong>Coefficient of Variation:</strong> ${stats?.cov ?? stats?.coefficient_variation ?? "N/A"}</p>
      `;
    }

  } catch (err) {
    alert("Failed to load range data: " + err.message);
  }
}

// Toggle add panel (robust check)
toggleAddStock.addEventListener("click", () => {
  if (panelIsVisible()) {
    hideAddPanel();
  } else {
    showAddPanel();
    // scroll to panel so it's visible
    addPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

// Submit add stock data
submitAddStockBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  addStockMsg.style.color = "lightgreen";
  addStockMsg.textContent = "Submitting...";

  const payload = {
    symbol: (addSymbol.value || "").trim(),
    timestamp: addTimestamp.value,
    open: addOpen.value,
    high: addHigh.value,
    close: addClose.value,
    low: addLow.value,
    volume: addVolume.value
  };

  // basic validation
  if (!payload.symbol || !payload.timestamp || !payload.close) {
    addStockMsg.style.color = "salmon";
    addStockMsg.textContent = "Symbol, timestamp and close price are required.";
    return;
  }

  try {
    const result = await fetchJson("/stocks/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    addStockMsg.style.color = "lightgreen";
    addStockMsg.textContent = result.message || "Stock added";

    // reload list to show updated current price
    await loadAllStocks();
    // hide form
    hideAddPanel();
  } catch (err) {
    addStockMsg.style.color = "salmon";
    addStockMsg.textContent = "Add failed: " + err.message;
  }
});

// Simple search box behaviour (filter client-side)
searchBtn.addEventListener("click", () => {
  const q = (searchInput.value || "").trim().toUpperCase();
  if (!q) return;
  // filter the existing list by clicking the matching stock if present
  const items = Array.from(stockListEl.querySelectorAll(".stock-item"));
  const match = items.find(i => i.dataset.symbol === q || i.textContent.toUpperCase().includes(q));
  if (match) {
    match.scrollIntoView({ behavior: "smooth", block: "center" });
    // simulate click
    match.click();
  } else {
    searchResult.innerHTML = `<p style="color:red;">Stock "${q}" not found in list.</p>`;
  }
});

// initialisation
document.addEventListener("DOMContentLoaded", () => {
  hideAddPanel(); // ensure hidden on load
  loadAllStocks().catch(err => console.error("Initial load failed:", err));
});
