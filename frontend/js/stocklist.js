// /frontend/js/stocklist.js
// Mirrors portfolio.js formatting and behavior, but for a single stocklist.
// Expects query param: ?id=<stockListId>
// Endpoints used:
//  - GET /stockLists/:stockListId     -> returns stocklist object {stocklistID, ownerID, visibility, stocks: [{symbol, shares, portfolio_id}]}
//  - GET /stats/matrix?id=<id>&usage=stocklist   -> returns { symbols, correlation, covariance }
//  - GET /stocks/range?symbol=...&start=...&end=...  -> returns { daily, stats }
//  - GET /stocks/predict?symbol=...&date=... -> returns { prediction: { price_prediction, slope?, intercept? } }

const params = new URLSearchParams(window.location.search);
const stockListId = params.get('id');
if (!stockListId) {
  // if no id, go back to listing page
  window.location.href = '/stocklists.html';
}

// DOM refs
const backBtn = document.getElementById('backToLists');
const headerEl = document.getElementById('stocklistHeader');
const stocklistTitle = document.getElementById('stocklistTitle');
const stocklistMeta = document.getElementById('stocklistMeta');
const stocklistVisibility = document.getElementById('stocklistVisibility');

const matrixPlaceholder = document.getElementById('matrixPlaceholder');
const matrixTableContainer = document.getElementById('matrixTable');
const matrixContainer = document.getElementById('matrixContainer');

const holdingsListEl = document.getElementById('holdingsList');

const holdingDetailBox = document.getElementById('holdingDetailBox');
const holdingSymbolEl = document.getElementById('holdingSymbol');
const holdingSharesEl = document.getElementById('holdingShares');
const holdingPriceEl = document.getElementById('holdingPrice');
const holdingRangeStart = document.getElementById('holdingRangeStart');
const holdingRangeEnd = document.getElementById('holdingRangeEnd');
const holdingLoadRangeBtn = document.getElementById('holdingLoadRange');

const predictDateInput = document.getElementById('predictDate');
const predictBtn = document.getElementById('predictBtn');
const predictResult = document.getElementById('predictResult');

const chartContainer = document.getElementById('chartContainer');
const holdingChartCanvas = document.getElementById('holdingChart');
let holdingChart = null;

let stocklist = null;
let selectedHolding = null;

// small fetch helper (same pattern as portfolio.js)
async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  if (!res.ok) {
    try { const b = await res.json(); throw new Error(b.error || JSON.stringify(b)); }
    catch (_) { throw new Error(`HTTP ${res.status}`); }
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

backBtn.addEventListener('click', () => {
  window.location.href = '/stocklists.html';
});

// basic login guard (same as portfolio)
(async function ensureLogin() {
  try {
    const cur = await fetchJson('/user/current');
    if (!cur || !cur.user) window.location.href = '/index.html';
  } catch (err) {
    window.location.href = '/index.html';
  }
})();

// load the stocklist object
async function loadStockList(id) {
  try {
    const data = await fetchJson(`/stockLists/${encodeURIComponent(id)}`);
    stocklist = data;
    renderHeader();
    // display matrix area
    await loadMatrix(id);
    renderHoldings();
  } catch (err) {
    headerEl.textContent = `Failed to load stock list: ${err.message}`;
  }
}

function renderHeader() {
  stocklistTitle.textContent = `StockList ${stocklist.stocklistID}`;
  stocklistMeta.textContent = `Owner ID: ${stocklist.ownerID}`;
  stocklistVisibility.textContent = stocklist.visibility ? stocklist.visibility.toUpperCase() : '';
  headerEl.querySelectorAll && Array.from(headerEl.querySelectorAll('.meta')).forEach(n => n.remove());
}

// render holdings list from stocklist.stocks
function renderHoldings() {
  holdingsListEl.innerHTML = '';
  if (!stocklist || !Array.isArray(stocklist.stocks) || stocklist.stocks.length === 0) {
    holdingsListEl.innerHTML = `<div style="color:#bbb;">No stocks in this list.</div>`;
    return;
  }
  stocklist.stocks.forEach(s => {
    const wrapper = document.createElement('div');
    wrapper.className = 'holding';
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'space-between';
    wrapper.style.alignItems = 'center';
    wrapper.innerHTML = `
      <div>
        <div style="font-weight:700;">${s.symbol}</div>
        <div style="color:#bbb;">${s.shares} shares</div>
      </div>
    `;
    const right = document.createElement('div');
    right.style.textAlign = 'right';
    right.style.minWidth = '110px';
    // current price will be fetched when clicked - show placeholder
    const priceDiv = document.createElement('div');
    priceDiv.style.fontWeight = '700';
    priceDiv.textContent = '$--.--';
    priceDiv.className = 'holding-current-price';
    const valueDiv = document.createElement('div');
    valueDiv.style.color = '#bbb';
    valueDiv.style.fontSize = '0.9rem';
    valueDiv.textContent = `Value --`;
    right.appendChild(priceDiv);
    right.appendChild(valueDiv);
    wrapper.appendChild(right);

    wrapper.addEventListener('click', async () => {
      // fetch current price and show detail
      try {
        const cur = await fetchJson(`/stocks/${encodeURIComponent(s.symbol)}/current`);
        // update price in list (right column)
        priceDiv.textContent = cur && cur.current_price != null ? `$${Number(cur.current_price).toFixed(2)}` : '$N/A';
        valueDiv.textContent = cur && cur.current_price != null ? `Value $${(Number(cur.current_price) * Number(s.shares)).toFixed(2)}` : 'Value N/A';
      } catch (err) {
        priceDiv.textContent = '$err';
        valueDiv.textContent = '';
      }
      onHoldingClick(s);
    });

    holdingsListEl.appendChild(wrapper);
  });
}

// when user clicks a holding -> show right-side detail (range/predict)
function onHoldingClick(h) {
  selectedHolding = h;
  holdingDetailBox.style.display = 'block';
  holdingSymbolEl.textContent = h.symbol;
  holdingSharesEl.textContent = `${h.shares} shares`;
  holdingPriceEl.textContent = `$--.--`;

  // fetch current price to display
  fetchJson(`/stocks/${encodeURIComponent(h.symbol)}/current`)
    .then(cur => {
      if (cur && cur.current_price != null) {
        holdingPriceEl.textContent = `$${Number(cur.current_price).toFixed(2)}`;
      } else {
        holdingPriceEl.textContent = 'N/A';
      }
    }).catch(() => { holdingPriceEl.textContent = 'N/A'; });

  // default range: last 90 days
  const end = new Date();
  const start = new Date(); start.setDate(end.getDate() - 90);
  holdingRangeStart.value = start.toISOString().slice(0,10);
  holdingRangeEnd.value = end.toISOString().slice(0,10);

  hideChartContainer();
}

// Load history and plot
if (holdingLoadRangeBtn) {
  holdingLoadRangeBtn.addEventListener('click', async () => {
    if (!selectedHolding) return alert('Select a holding first');
    const symbol = selectedHolding.symbol;
    const start = holdingRangeStart.value;
    const end = holdingRangeEnd.value;
    if (!start || !end) return alert('Select start and end dates');
    try {
      const res = await fetchJson(`/stocks/range?symbol=${encodeURIComponent(symbol)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      const daily = res.daily || [];
      if (!Array.isArray(daily) || daily.length === 0) return alert('No daily data for the selected range.');
      showChartContainer();
      if (holdingChart) { holdingChart.destroy(); holdingChart = null; }
      const labels = daily.map(d => (d.timestamp || d.date || '').slice(0,10));
      const prices = daily.map(d => d.close);
      const ctx = holdingChartCanvas.getContext('2d');
      holdingChart = new Chart(ctx, {
        type: 'line',
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
      alert('Failed to load range: ' + err.message);
    }
  });
}

// predict button behavior
if (predictBtn) {
  predictBtn.addEventListener('click', async () => {
    if (!selectedHolding) return alert('Select a holding first');
    const date = predictDateInput.value;
    if (!date) return alert('Select a date to predict');
    predictResult.textContent = 'Predicting...';
    try {
      const res = await fetchJson(`/stocks/predict?symbol=${encodeURIComponent(selectedHolding.symbol)}&date=${encodeURIComponent(date)}`);
      const p = res.prediction?.price_prediction ?? null;
      const slope = res.prediction?.slope ?? null;
      const intercept = res.prediction?.intercept ?? null;

      if (p != null && (slope == null || intercept == null)) {
        predictResult.textContent = `Predicted price on ${date}: $${Number(p).toFixed(2)}`;
        if (holdingChart) {
          // append point dataset
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

      if (slope != null && intercept != null) {
        // make a small predicted series (30 days) for visualization
        const days = 30;
        const labels = [];
        const preds = [];
        for (let i=1; i<=days; ++i) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          labels.push(d.toISOString().slice(0,10));
          preds.push(intercept + slope * i);
        }
        if (holdingChart) {
          const histLen = holdingChart.data.labels.length;
          holdingChart.data.labels = holdingChart.data.labels.concat(labels);
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
        predictResult.textContent = `Predicted (linear) series added to chart.`;
        return;
      }

      predictResult.textContent = 'No prediction returned.';
    } catch (err) {
      predictResult.textContent = `Prediction failed: ${err.message}`;
    }
  });
}

// show/hide chart container helpers
function showChartContainer() {
  chartContainer.classList.add('visible');
  if (holdingChart) holdingChart.resize();
}
function hideChartContainer() {
  chartContainer.classList.remove('visible');
  if (holdingChart) { holdingChart.destroy(); holdingChart = null; }
}

// MATRIX: load and render both correlation & covariance using createElement
async function loadMatrix(pid) {
  matrixPlaceholder.style.display = 'block';
  matrixTableContainer.style.display = 'none';
  matrixContainer.style.display = 'block';
  try {
    const res = await fetchJson(`/stats/matrix?id=${encodeURIComponent(pid)}&usage=stocklist`);
    renderMatrix(res);
  } catch (err) {
    matrixPlaceholder.textContent = `Failed to compute matrix: ${err.message}`;
  }
}

function renderMatrix(obj) {
  if (!obj || !Array.isArray(obj.symbols) || (!obj.correlation && !obj.covariance)) {
    matrixPlaceholder.textContent = 'No matrix available';
    matrixTableContainer.style.display = 'none';
    return;
  }

  const symbols = obj.symbols || [];
  const corr = obj.correlation || null;
  const cov = obj.covariance || null;

  // clear containers
  const corrDiv = document.getElementById('correlationTable');
  const covDiv = document.getElementById('covarianceTable');
  corrDiv.innerHTML = '';
  covDiv.innerHTML = '';

  if (Array.isArray(corr)) {
    const title = document.createElement('div');
    title.style.fontWeight = '600';
    title.style.marginBottom = '8px';
    title.textContent = 'Correlation Matrix';
    corrDiv.appendChild(title);
    corrDiv.appendChild(buildMatrixTable(symbols, corr));
  } else {
    const n = document.createElement('div'); n.style.color = '#9aa3b2'; n.textContent='No correlation data';
    corrDiv.appendChild(n);
  }

  if (Array.isArray(cov)) {
    const title = document.createElement('div');
    title.style.fontWeight = '600';
    title.style.marginTop = '10px';
    title.style.marginBottom = '8px';
    title.textContent = 'Covariance Matrix';
    covDiv.appendChild(title);
    covDiv.appendChild(buildMatrixTable(symbols, cov));
  } else {
    const n = document.createElement('div'); n.style.color = '#9aa3b2'; n.textContent='No covariance data';
    covDiv.appendChild(n);
  }

  matrixPlaceholder.style.display = 'none';
  matrixTableContainer.style.display = 'block';
  matrixContainer.style.display = 'block';
}

function buildMatrixTable(symbols, matrix) {
  const tbl = document.createElement('table');
  tbl.className = 'matrix';

  // thead
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const emptyTh = document.createElement('th');
  headRow.appendChild(emptyTh);
  symbols.forEach(s => {
    const th = document.createElement('th');
    th.textContent = s;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  tbl.appendChild(thead);

  // tbody
  const tbody = document.createElement('tbody');
  for (let i=0; i<symbols.length; ++i) {
    const tr = document.createElement('tr');
    const rowHeader = document.createElement('th');
    rowHeader.textContent = symbols[i];
    tr.appendChild(rowHeader);
    for (let j=0; j<symbols.length; ++j) {
      const td = document.createElement('td');
      const v = (matrix[i] && matrix[i][j] !== undefined) ? matrix[i][j] : null;
      if (v === null || v === undefined || Number.isNaN(v)) td.textContent = '-';
      else {
        const n = Number(v);
        td.textContent = Number.isFinite(n) ? n.toFixed(3) : '-';
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  tbl.appendChild(tbody);
  return tbl;
}

// init
document.addEventListener('DOMContentLoaded', async () => {
  if (holdingDetailBox) holdingDetailBox.style.display = 'none';
  matrixContainer.style.display = 'none';
  await loadStockList(stockListId);
});
