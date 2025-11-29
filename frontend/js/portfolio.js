// /frontend/js/portfolio.js
// Assumes Chart.js is loaded on page via CDN and backend endpoints exist.

const tabsEl = document.getElementById("portfolioTabs");
const createBtnTop = document.getElementById("createPortfolioBtnTop");
const newAmountTop = document.getElementById("newAmountTop");

const depositTop = document.getElementById("depositBtnTop");
const depositAmountTop = document.getElementById("depositAmountTop");
const withdrawTop = document.getElementById("withdrawBtnTop");
const withdrawAmountTop = document.getElementById("withdrawAmountTop");
const cashAccountTop = document.getElementById("cashAccountTop");
const portfolioTotalTop = document.getElementById("portfolioTotalTop");
const topControls = document.getElementById("topControls");

// const portfolioListEl = document.getElementById("portfolioList");
const holdingsListEl = document.getElementById("holdingsList");

const matrixPlaceholder = document.getElementById("matrixPlaceholder");
const matrixTableContainer = document.getElementById("matrixTable");
const matrixContainer = document.getElementById("matrixContainer");

const portfolioNameEl = document.getElementById("portfolioName");
const portfolioIdEl = document.getElementById("portfolioId");
const cashAccountMini = document.getElementById("cashAccountMini");

const holdingDetailBox = document.getElementById("holdingDetailBox");
const holdingSymbolEl = document.getElementById("holdingSymbol");
const holdingSharesEl = document.getElementById("holdingShares");
const holdingPriceEl = document.getElementById("holdingPrice");
const holdingRangeStart = document.getElementById("holdingRangeStart");
const holdingRangeEnd = document.getElementById("holdingRangeEnd");
const holdingLoadRangeBtn = document.getElementById("holdingLoadRange");

const buySymbolInput = document.getElementById("buySymbol");
const buySharesInput = document.getElementById("buyShares");
const buyBtn = document.getElementById("buyBtn");
const buyMsg = document.getElementById("buyMsg");

const buySellOpenBtn = document.getElementById("buySellOpenBtn");
const predictDateInput = document.getElementById("predictDate");
const predictBtn = document.getElementById("predictBtn");
const predictResult = document.getElementById("predictResult");

const chartContainer = document.getElementById("chartContainer");
const holdingChartCanvas = document.getElementById("holdingChart");
let holdingChart = null;

const buySellModal = document.getElementById("buySellModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalTabs = Array.from(document.querySelectorAll(".modal-tab"));
const modalForms = Array.from(document.querySelectorAll(".modal-form"));
const modalSymbol = document.getElementById("modalSymbol");
const modalShares = document.getElementById("modalShares");
const modalSymbolSell = document.getElementById("modalSymbolSell");
const modalSharesSell = document.getElementById("modalSharesSell");
const modalCancel = document.getElementById("modalCancel");
const modalCancel2 = document.getElementById("modalCancel2");
const modalSubmit = document.getElementById("modalSubmit");
const modalSubmit2 = document.getElementById("modalSubmit2");
const modalMsg = document.getElementById("modalMsg");
const modalMsgSell = document.getElementById("modalMsgSell");

let portfolios = [];
let selectedPortfolio = null;
let selectedHolding = null;

// helper
async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { credentials: "include", ...opts });
  if (!res.ok) {
    try { const body = await res.json(); throw new Error(body.error || JSON.stringify(body)); }
    catch (_) { throw new Error(`HTTP ${res.status}`); }
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ensure logged in
(async function ensureLogin() {
  try {
    const cur = await fetchJson("/user/current");
    if (!cur || !cur.user) window.location.href = "/index.html";
  } catch (err) {
    window.location.href = "/index.html";
  }
})();

// ---------- load portfolios ----------
async function loadPortfolios() {
  try {
    portfolios = await fetchJson("/portfolio/");
    renderTabs();
    // renderPortfolioList();
    if (!selectedPortfolio && portfolios.length) {
      selectPortfolio(portfolios[0]);
    } else if (selectedPortfolio) {
      // refresh selectedPortfolio info
      const updated = portfolios.find(p => p.portfolio_id === selectedPortfolio.portfolio_id);
      if (updated) selectedPortfolio = updated;
    }
  } catch (err) {
    // portfolioListEl.innerHTML = `<li style="color:#f88;">Failed to load portfolios</li>`;
    console.error(err);
  }
}

function renderTabs() {
  tabsEl.innerHTML = "";
  portfolios.forEach(p => {
    const t = document.createElement("div");
    t.className = "tab" + (selectedPortfolio && selectedPortfolio.portfolio_id === p.portfolio_id ? " active" : "");
    t.textContent = `Portfolio ${p.portfolio_id}`;
    t.addEventListener("click", () => selectPortfolio(p));
    tabsEl.appendChild(t);
  });
}

// function renderPortfolioList() {
//   portfolioListEl.innerHTML = "";
//   portfolios.forEach(p => {
//     const li = document.createElement("li");
//     li.className = "portfolio-item";
//     li.innerHTML = `<span>Portfolio ${p.portfolio_id}</span><span style="color:#bbb;">$${Number(p.cash_account).toFixed(2)}</span>`;
//     li.addEventListener("click", () => selectPortfolio(p));
//     portfolioListEl.appendChild(li);
//   });
// }

// create portfolio
if (createBtnTop) {
  createBtnTop.addEventListener("click", async () => {
    const amt = parseFloat((newAmountTop && newAmountTop.value) || "0");
    if (isNaN(amt) || amt < 0) return alert("Enter a positive initial cash amount");
    try {
      await fetchJson(`/portfolio/create?amount=${encodeURIComponent(amt)}`, { method: "POST" });
      if (newAmountTop) newAmountTop.value = "";
      await loadPortfolios();
    } catch (err) {
      alert("Create failed: " + err.message);
    }
  });
}

// ---------- select portfolio ----------
async function selectPortfolio(p) {
  selectedPortfolio = p;
  renderTabs();

  // Show top controls
  topControls.style.display = "flex";
  portfolioNameEl.textContent = `Portfolio ${p.portfolio_id}`;
  portfolioIdEl.textContent = p.portfolio_id;
  cashAccountTop.textContent = `$${Number(p.cash_account).toFixed(2)}`;
  cashAccountMini.textContent = `$${Number(p.cash_account).toFixed(2)}`;

  await loadHoldings(p.portfolio_id);
  await loadPortfolioTotal(p.portfolio_id);
  await loadMatrix(p.portfolio_id);
}

// load holdings
async function loadHoldings(pid) {
  holdingsListEl.innerHTML = "Loading...";
  try {
    const rows = await fetchJson(`/portfolio/holdings?id=${encodeURIComponent(pid)}`);
    if (!rows || rows.length === 0) {
      holdingsListEl.innerHTML = `<div style="color:#bbb;">No holdings</div>`;
      return;
    }
    holdingsListEl.innerHTML = "";
    rows.forEach(h => {
      const wrapper = document.createElement("div");
      wrapper.className = "holding";
      wrapper.innerHTML = `
        <div>
          <div style="font-weight:700;">${h.symbol}</div>
          <div style="color:#bbb;">${h.shares} shares</div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700;">$${Number(h.current_price).toFixed(2)}</div>
          <div style="color:#bbb; font-size:0.9rem;">Value $${Number(h.asset_value).toFixed(2)}</div>
        </div>
      `;
      wrapper.addEventListener("click", () => onHoldingClick(h));
      holdingsListEl.appendChild(wrapper);
    });
  } catch (err) {
    holdingsListEl.innerHTML = `<div style="color:#f88;">Failed to load holdings: ${err.message}</div>`;
  }
}

// Buy quick button
if (buyBtn) {
  buyBtn.addEventListener("click", async () => {
    if (!selectedPortfolio) return alert("Select a portfolio first");
    const pid = selectedPortfolio.portfolio_id;
    const symbol = (buySymbolInput.value || "").trim().toUpperCase();
    const shares = parseInt(buySharesInput.value || "0");
    if (!symbol || isNaN(shares) || shares <= 0) return alert("Symbol and positive shares required");
    buyMsg.textContent = "Buying...";
    try {
      const res = await fetchJson(`/portfolio/buy?pid=${encodeURIComponent(pid)}&symbol=${encodeURIComponent(symbol)}&shares=${encodeURIComponent(shares)}`, { method: "POST" });
      buyMsg.textContent = res.message || "Bought";
      buySymbolInput.value = ""; buySharesInput.value = "";
      await loadPortfolios();
      await selectPortfolio(portfolios.find(x => x.portfolio_id === pid));
    } catch (err) {
      buyMsg.textContent = `Buy failed: ${err.message}`;
    }
  });
}

// Deposit / Withdraw Top
if (depositTop) {
  depositTop.addEventListener("click", async () => {
    if (!selectedPortfolio) return;
    const amt = parseFloat(depositAmountTop.value || "0");
    if (isNaN(amt) || amt <= 0) return alert("Enter deposit amount");
    depositTop.textContent = "Depositing...";
    try {
      await fetchJson(`/portfolio/deposit?pid=${encodeURIComponent(selectedPortfolio.portfolio_id)}&amount=${encodeURIComponent(amt)}`, { method: "POST" });
      depositTop.textContent = "Deposit";
      depositAmountTop.value = "";
      await loadPortfolios();
      await selectPortfolio(portfolios.find(x => x.portfolio_id === selectedPortfolio.portfolio_id));
    } catch (err) {
      depositTop.textContent = "Deposit";
      alert("Deposit failed: " + err.message);
    }
  });
}
if (withdrawTop) {
  withdrawTop.addEventListener("click", async () => {
    if (!selectedPortfolio) return;
    const amt = parseFloat(withdrawAmountTop.value || "0");
    if (isNaN(amt) || amt <= 0) return alert("Enter withdraw amount");
    withdrawTop.textContent = "Withdrawing...";
    try {
      await fetchJson(`/portfolio/withdraw?pid=${encodeURIComponent(selectedPortfolio.portfolio_id)}&amount=${encodeURIComponent(amt)}`, { method: "POST" });
      withdrawTop.textContent = "Withdraw";
      withdrawAmountTop.value = "";
      await loadPortfolios();
      await selectPortfolio(portfolios.find(x => x.portfolio_id === selectedPortfolio.portfolio_id));
    } catch (err) {
      withdrawTop.textContent = "Withdraw";
      alert("Withdraw failed: " + err.message);
    }
  });
}

// on holding click
function onHoldingClick(h) {
  selectedHolding = h;
  holdingDetailBox.style.display = "block";
  holdingSymbolEl.textContent = h.symbol;
  holdingSharesEl.textContent = `${h.shares} shares`;
  holdingPriceEl.textContent = `$${Number(h.current_price).toFixed(2)}`;
  predictResult.textContent = "";
  // default range: last 90 days
  const end = new Date();
  const start = new Date(); start.setDate(end.getDate() - 90);
  holdingRangeStart.value = start.toISOString().slice(0,10);
  holdingRangeEnd.value = end.toISOString().slice(0,10);
  hideChartContainer();
}

// load range + historical chart
if (holdingLoadRangeBtn) {
  holdingLoadRangeBtn.addEventListener("click", async () => {
    if (!selectedHolding) return alert("Select a holding");
    const symbol = selectedHolding.symbol;
    const start = holdingRangeStart.value;
    const end = holdingRangeEnd.value;
    if (!start || !end) return alert("Select range");
    try {
      const res = await fetchJson(`/stocks/range?symbol=${encodeURIComponent(symbol)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      const daily = res.daily || [];
      if (!Array.isArray(daily) || daily.length === 0) return alert("No data for the selected range.");
      showChartContainer();
      if (holdingChart) { holdingChart.destroy(); holdingChart = null; }
      const labels = daily.map(d => (d.timestamp || d.date || "").slice(0,10));
      const prices = daily.map(d => d.close);
      const ctx = holdingChartCanvas.getContext("2d");
      holdingChart = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: `${symbol} Close`,
            data: prices,
            borderWidth: 2,
            tension: 0.12,
            pointRadius: 0
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    } catch (err) {
      alert("Failed to load range: " + err.message);
    }
  });
}

// predict (uses /stocks/predict which currently returns a point; also will use slope/intercept if available)
if (predictBtn) {
  predictBtn.addEventListener("click", async () => {
    if (!selectedHolding) return alert("Select a holding");
    const date = predictDateInput.value;
    if (!date) return alert("Select a date");
    predictResult.textContent = "Predicting...";
    try {
      const res = await fetchJson(`/stocks/predict?symbol=${encodeURIComponent(selectedHolding.symbol)}&date=${encodeURIComponent(date)}`);
      const p = res.prediction?.price_prediction ?? null;
      const slope = res.prediction?.slope ?? null;
      const intercept = res.prediction?.intercept ?? null;
      // numeric point
      if (p != null && (slope == null || intercept == null)) {
        predictResult.textContent = `Predicted price on ${date}: $${Number(p).toFixed(2)}`;
        // also show small single-point marker on chart
        if (holdingChart) {
          // add a dataset for predicted point
          const idx = holdingChart.data.labels.length;
          holdingChart.data.labels.push(date);
          holdingChart.data.datasets.push({
            label: 'Prediction',
            data: Array(holdingChart.data.labels.length-1).fill(null).concat([p]),
            borderColor: 'rgba(255,140,0,0.9)',
            borderWidth: 2,
            pointBackgroundColor: 'rgba(255,140,0,1)',
            showLine: false
          });
          holdingChart.update();
        }
        return;
      }
      // if slope & intercept provided, generate a predicted series from last historical t to future date
      if (slope != null && intercept != null) {
        // create a small predicted line for the next N days up to the target date
        // determine last recorded timestamp from current chart if available
        const days = 30; // default: predict next 30 days or until the chosen date
        const startDate = new Date();
        const labels = [];
        const preds = [];
        for (let i = 1; i <= days; ++i) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          labels.push(d.toISOString().slice(0,10));
          // naive t calculation: use i as t_future offset (backend uses a different t; this is a visual overlay)
          preds.push(intercept + slope * i);
        }
        // overlay predicted series onto chart (preserve historical)
        if (holdingChart) {
          // append predicted labels and dataset
          const combinedLabels = holdingChart.data.labels.concat(labels);
          const histLen = holdingChart.data.labels.length;
          holdingChart.data.labels = combinedLabels;
          holdingChart.data.datasets.push({
            label: 'Prediction (linear)',
            data: Array(histLen).fill(null).concat(preds),
            borderColor: 'rgba(255,140,0,0.9)',
            borderWidth: 2,
            tension: 0,
            pointRadius: 0
          });
          holdingChart.update();
        }
        predictResult.textContent = `Predicted (linear) using slope/intercept.`;
        return;
      }
      predictResult.textContent = "No prediction returned.";
    } catch (err) {
      predictResult.textContent = `Prediction failed: ${err.message}`;
    }
  });
}

// matrix
async function loadMatrix(pid) {
  matrixPlaceholder.style.display = "block";
  matrixTableContainer.style.display = "none";
  matrixContainer.style.display = "block";
  try {
    const res = await fetchJson(`/stats/matrix?id=${encodeURIComponent(pid)}&usage=stockholding`);
    renderMatrix(res);
  } catch (err) {
    matrixPlaceholder.textContent = `Failed to compute matrix: ${err.message}`;
  }
}

// function renderMatrix(obj) {
//   if (!obj || !Array.isArray(obj.symbols) || !obj.correlation) {
//     matrixPlaceholder.textContent = "No matrix available";
//     matrixTableContainer.style.display = "none";
//     return;
//   }
//   const symbols = obj.symbols;
//   const corr = obj.correlation;

//   const tbl = document.createElement("table");
//   tbl.className = "matrix";
//   const thead = document.createElement("thead");
//   const headRow = document.createElement("tr");
//   headRow.appendChild(document.createElement("th"));
//   symbols.forEach(s => {
//     const th = document.createElement("th");
//     th.textContent = s;
//     headRow.appendChild(th);
//   });
//   thead.appendChild(headRow);
//   tbl.appendChild(thead);

//   const tbody = document.createElement("tbody");
//   for (let i = 0; i < symbols.length; ++i) {
//     const tr = document.createElement("tr");
//     const th = document.createElement("th");
//     th.textContent = symbols[i];
//     tr.appendChild(th);
//     for (let j = 0; j < symbols.length; ++j) {
//       const td = document.createElement("td");
//       const v = corr[i] && corr[i][j];
//       td.textContent = (v === null || v === undefined) ? "-" : Number(v).toFixed(3);
//       tr.appendChild(td);
//     }
//     tbody.appendChild(tr);
//   }
//   tbl.appendChild(tbody);
//   matrixTableContainer.innerHTML = "";
//   matrixTableContainer.appendChild(tbl);
//   matrixPlaceholder.style.display = "none";
//   matrixTableContainer.style.display = "block";
// }

function renderMatrix(obj) {
    if (
      !obj ||
      !Array.isArray(obj.symbols) ||
      !obj.correlation ||
      !obj.covariance
    ) {
      matrixPlaceholder.textContent = "No matrix available";
      matrixTableContainer.style.display = "none";
      return;
    }
  
    const symbols = obj.symbols;
    const corr = obj.correlation;
    const cov = obj.covariance;
    console.log(cov);
  
    // Clear old content
    const corrDiv = document.getElementById("correlationTable");
    const covDiv = document.getElementById("covarianceTable");
    corrDiv.innerHTML = "";
    covDiv.innerHTML = "";
  
    // Build each table
    corrDiv.innerHTML = `
      <h3 style="margin-bottom:8px;">Correlation Matrix</h3>
      ${buildMatrixTableHTML(symbols, corr)}
    `;
  
    covDiv.innerHTML = `
      <h3 style="margin-bottom:8px;">Covariance Matrix</h3>
      ${buildMatrixTableHTML(symbols, cov)}
    `;
  
    // Show results
    matrixPlaceholder.style.display = "none";
    matrixTableContainer.style.display = "block";
}

function buildMatrixTableHTML(symbols, matrix) {
    let html = `<table class="matrix"><thead><tr><th></th>`;
  
    symbols.forEach(s => html += `<th>${s}</th>`);
    html += `</tr></thead><tbody>`;
  
    for (let i = 0; i < symbols.length; i++) {
      html += `<tr><th>${symbols[i]}</th>`;
      for (let j = 0; j < symbols.length; j++) {
        const val = matrix[i]?.[j];
        html += `<td>${val == null ? "-" : Number(val).toFixed(3)}</td>`;
      }
      html += `</tr>`;
    }
  
    html += `</tbody></table>`;
    return html;
}
  

// portfolio total
async function loadPortfolioTotal(pid) {
  try {
    const r = await fetchJson(`/portfolio/total?pid=${encodeURIComponent(pid)}`);
    if (r && r.total && r.total.total != null) {
      portfolioTotalTop.textContent = `$${Number(r.total.total).toFixed(2)}`;
    } else {
      portfolioTotalTop.textContent = "$0.00";
    }
  } catch (err) {
    portfolioTotalTop.textContent = "$0.00";
  }
}

// Chart helpers
function showChartContainer() {
  chartContainer.classList.add("visible");
  if (holdingChart) holdingChart.resize();
}
function hideChartContainer() {
  chartContainer.classList.remove("visible");
  if (holdingChart) { holdingChart.destroy(); holdingChart = null; }
}

// Buy/Sell modal behavior (tabs)
function openBuySellModal(defaultMode = "buy", symbol = "") {
  buySellModal.style.display = "block";
  // make sure first child is backdrop visible
  modalBackdrop.style.display = "flex";
  // set forms
  modalTabs.forEach(t => t.classList.remove("active"));
  modalTabs.find(t => t.dataset.mode === defaultMode).classList.add("active");
  modalForms.forEach(f => f.style.display = f.dataset.mode === defaultMode ? "block" : "none");
  // prefill symbol
  modalSymbol.value = symbol;
  modalSymbolSell.value = symbol;
  modalMsg.textContent = "";
  modalMsgSell.textContent = "";
}
function closeBuySellModal() {
  buySellModal.style.display = "none";
  modalBackdrop.style.display = "none";
}

// modal tab clicks
modalTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    modalTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const mode = tab.dataset.mode;
    modalForms.forEach(f => f.style.display = f.dataset.mode === mode ? "block" : "none");
  });
});

// modal cancel/submit
modalCancel.addEventListener("click", closeBuySellModal);
modalCancel2.addEventListener("click", closeBuySellModal);

modalSubmit.addEventListener("click", async () => {
  const symbol = (modalSymbol.value || "").trim().toUpperCase();
  const shares = parseInt(modalShares.value || "0");
  if (!symbol || isNaN(shares) || shares <= 0) { modalMsg.textContent = "Fill symbol and positive shares"; modalMsg.style.color = "#ff7b7b"; return; }
  if (!selectedPortfolio) { modalMsg.textContent = "Select portfolio"; modalMsg.style.color = "#ff7b7b"; return; }
  try {
    modalMsg.textContent = "Buying...";
    await fetchJson(`/portfolio/buy?pid=${encodeURIComponent(selectedPortfolio.portfolio_id)}&symbol=${encodeURIComponent(symbol)}&shares=${encodeURIComponent(shares)}`, { method: "POST" });
    modalMsg.textContent = "Bought";
    modalMsg.style.color = "#7ef2a1";
    await loadPortfolios();
    await selectPortfolio(portfolios.find(x => x.portfolio_id === selectedPortfolio.portfolio_id));
    setTimeout(closeBuySellModal, 600);
  } catch (err) {
    modalMsg.textContent = `Buy failed: ${err.message}`;
    modalMsg.style.color = "#ff7b7b";
  }
});

modalSubmit2.addEventListener("click", async () => {
  const symbol = (modalSymbolSell.value || "").trim().toUpperCase();
  const shares = parseInt(modalSharesSell.value || "0");
  if (!symbol || isNaN(shares) || shares <= 0) { modalMsgSell.textContent = "Fill symbol and positive shares"; modalMsgSell.style.color = "#ff7b7b"; return; }
  if (!selectedPortfolio) { modalMsgSell.textContent = "Select portfolio"; modalMsgSell.style.color = "#ff7b7b"; return; }
  try {
    modalMsgSell.textContent = "Selling...";
    await fetchJson(`/portfolio/sell?pid=${encodeURIComponent(selectedPortfolio.portfolio_id)}&symbol=${encodeURIComponent(symbol)}&shares=${encodeURIComponent(shares)}`, { method: "POST" });
    modalMsgSell.textContent = "Sold";
    modalMsgSell.style.color = "#7ef2a1";
    await loadPortfolios();
    await selectPortfolio(portfolios.find(x => x.portfolio_id === selectedPortfolio.portfolio_id));
    setTimeout(closeBuySellModal, 600);
  } catch (err) {
    modalMsgSell.textContent = `Sell failed: ${err.message}`;
    modalMsgSell.style.color = "#ff7b7b";
  }
});

// open modal button
if (buySellOpenBtn) {
  buySellOpenBtn.addEventListener("click", () => {
    openBuySellModal("buy", selectedHolding ? selectedHolding.symbol : "");
  });
}

// initialisation
document.addEventListener("DOMContentLoaded", async () => {
  if (holdingDetailBox) holdingDetailBox.style.display = "none";
  matrixContainer.style.display = "none";
  await loadPortfolios();
});
