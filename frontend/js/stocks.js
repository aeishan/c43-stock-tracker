// /frontend/js/stocks.js (replacement)
// Uses backend /stocks/* endpoints
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

const chartContainer = document.getElementById("chartContainer");
const rangeChartCanvas = document.getElementById("rangeChart");
let rangeChart = null;

// safe fetch helper
async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { credentials: "include", ...opts });
  if (!res.ok) {
    try { const j = await res.json(); throw new Error(j.error || JSON.stringify(j)); } catch (_) { throw new Error(`HTTP ${res.status}`); }
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

// show/hide add panel
function showAddPanel() { addPanel.style.display = "block"; toggleAddStock.textContent = "Add Stock Data ▲"; }
function hideAddPanel() { addPanel.style.display = "none"; toggleAddStock.textContent = "Add Stock Data ▼"; }

// chart helpers: toggle class, then create/destroy chart after layout settles
function openChartArea() {
  chartContainer.classList.add("visible");
  chartContainer.setAttribute("aria-hidden","false");
  // ensure header is visible so chart expansion does not hide header
  const header = document.getElementById("topHeader");
  if (header) header.scrollIntoView({ behavior: "auto", block: "start" });
}
function closeChartArea() {
  chartContainer.classList.remove("visible");
  chartContainer.setAttribute("aria-hidden","true");
  if (rangeChart) { rangeChart.destroy(); rangeChart = null; }
}

// load all stocks
async function loadAllStocks() {
  try {
    const data = await fetchJson("/stocks/");
    stockListEl.innerHTML = "";
    if (!Array.isArray(data) || data.length === 0) {
      stockListEl.innerHTML = "<div style='color:#bbb;'>No stocks found.</div>";
      return;
    }
    const frag = document.createDocumentFragment();
    data.forEach(stock => {
      const div = document.createElement("div");
      div.className = "stock-item";
      div.dataset.symbol = stock.symbol;
      div.innerHTML = `<div><strong>${stock.symbol}</strong></div><div style="color:#bbb;">$${Number(stock.current_price).toFixed(2)}</div>`;
      div.addEventListener("click", () => onStockClick(stock.symbol));
      frag.appendChild(div);
    });
    stockListEl.appendChild(frag);
  } catch (err) {
    console.error(err);
    stockListEl.innerHTML = `<div style="color:#f88;">Failed to load stocks</div>`;
  }
}

// display current stock info and range inputs
async function onStockClick(symbol) {
  searchResult.innerHTML = `<div style="color:#bbb">Loading ${symbol}...</div>`;
  try {
    const current = await fetchJson(`/stocks/${encodeURIComponent(symbol)}/current`);
    searchResult.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><strong>${current?.symbol ?? symbol}</strong></div>
        <div style="color:#bbb">$${current?.current_price ?? "N/A"}</div>
      </div>
      <div style="margin-top:8px;">
        <label>Start <input id="rangeStart" type="date"></label>
        <label style="margin-left:8px">End <input id="rangeEnd" type="date"></label>
        <button id="rangeBtn" style="margin-left:8px">Load Range</button>
      </div>
      <div id="statsBox" style="margin-top:8px;color:#bbb"></div>
    `;
    const rangeBtn = document.getElementById("rangeBtn");
    if (rangeBtn) rangeBtn.addEventListener("click", () => loadRangeForSymbol(symbol));
    // ensure searchResult is visible
    searchResult.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    searchResult.innerHTML = `<div style="color:#f88">Failed to load</div>`;
  }
}

// load range and render chart safely
async function loadRangeForSymbol(symbol) {
  const start = document.getElementById("rangeStart").value;
  const end = document.getElementById("rangeEnd").value;
  if (!start || !end) return alert("pick start and end");
  try {
    const res = await fetchJson(`/stocks/range?symbol=${encodeURIComponent(symbol)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
    const daily = res.daily || [];
    const stats = (res.stats && res.stats[0]) ? res.stats[0] : null;
    if (!daily.length) return alert("No data for range");

    // open area (CSS will animate). Important: create chart AFTER layout settles.
    openChartArea();

    // wait a frame + tiny timeout so canvas has correct size
    await new Promise(requestAnimationFrame);
    await new Promise(r => setTimeout(r, 40));

    if (rangeChart) { rangeChart.destroy(); rangeChart = null; }

    const labels = daily.map(d => (d.timestamp || d.date || "").slice(0,10));
    const prices = daily.map(d => d.close);

    const ctx = rangeChartCanvas.getContext("2d");
    rangeChart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets: [{ label: `${symbol} Close`, data: prices, borderWidth:2, tension:0.12, pointRadius: 0 }] },
      options: { responsive:true, maintainAspectRatio:false }
    });

    // ensure resize measured correctly
    await new Promise(requestAnimationFrame);
    rangeChart.resize();

    const statsBox = document.getElementById("statsBox");
    if (statsBox) {
      statsBox.innerHTML = `<div><strong>Beta:</strong> ${stats?.beta ?? "N/A"}</div><div><strong>CoV:</strong> ${stats?.cov ?? "N/A"}</div>`;
    }

    // ensure header remains visible to user (prevent perceived upward push)
    const header = document.getElementById("topHeader");
    if (header) header.scrollIntoView({ behavior: "smooth", block: "start" });

  } catch (err) {
    alert("Failed to load range: " + err.message);
  }
}

// toggle add panel
toggleAddStock.addEventListener("click", () => {
  if (!addPanel) return;
  if (addPanel.style.display === "block") hideAddPanel(); else showAddPanel();
});

// submit add
if (submitAddStockBtn) {
  submitAddStockBtn.addEventListener("click", async () => {
    addStockMsg.textContent = "Submitting...";
    const payload = {
      symbol: (addSymbol.value || "").trim(),
      timestamp: addTimestamp.value,
      open: addOpen.value, high: addHigh.value, close: addClose.value, low: addLow.value, volume: addVolume.value
    };
    if (!payload.symbol || !payload.timestamp || !payload.close) { addStockMsg.textContent = "symbol, date, close required"; return; }
    try {
      const r = await fetchJson("/stocks/daily", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
      addStockMsg.textContent = r.message || "Added";
      await loadAllStocks();
      hideAddPanel();
    } catch (err) {
      addStockMsg.textContent = "Add failed: " + err.message;
    }
  });
}

// search button: jump to matching item or show not found
searchBtn.addEventListener("click", () => {
  const q = (searchInput.value || "").trim().toUpperCase();
  if (!q) return;
  const items = Array.from(stockListEl.querySelectorAll(".stock-item"));
  const match = items.find(i => i.dataset.symbol === q || i.textContent.toUpperCase().includes(q));
  if (match) {
    // scroll the match into view inside the list container
    const wrapper = document.getElementById("stockListContainer");
    if (wrapper) {
      // compute relative offset & scroll
      match.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      match.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    match.click();
  } else {
    searchResult.innerHTML = `<div style="color:#f88">Stock "${q}" not found</div>`;
  }
});

// init
document.addEventListener("DOMContentLoaded", () => {
  hideAddPanel();
  closeChartArea();
  loadAllStocks();
});
