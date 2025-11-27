const express = require('express');
const db = require('../db')

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const stocks = await db.query('SELECT * FROM Stock');
        return res.status(200).json(stocks.rows);
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

// all daily/historical data for given stock
router.get('/:symbol/all', async (req, res) => {
    const symbol = req.params.symbol;

    try {
        const data = await db.query(`
            SELECT * 
            FROM DailyRangeStock
            WHERE symbol = $1
            ORDER BY timestamp ASC
            `, [symbol]);
        
        return res.status(200).json(data.rows);
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

// current data for given stock (current price)
router.get('/:symbol/current', async (req, res) => {
    const symbol = req.params.symbol;

    try {
        const data = await db.query(`
            SELECT * 
            FROM Stock
            WHERE symbol = $1
            `, [symbol]);
        
        if (data.rowCount == 0) return res.status(404).json({ error: "Not found" });
        
        return res.status(200).json(data.rows[0]);
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

// get data in time range (i.e. /ABC/range?start=date1&end=date2)
router.get('/range', async (req, res) => {
    const symbol = req.query.symbol;
    const start = req.query.start;
    const end = req.query.end;

    try {
        const daily = await db.query(`
            SELECT * 
            FROM dailyRangeStock
            WHERE symbol = $1 AND timestamp BETWEEN $2 AND $3
            ORDER BY timestamp ASC
            `, [symbol, start, end]);
        
        const stats = await db.query(`
            WITH stock_r AS (
            SELECT timestamp, (close - LAG(close) OVER (ORDER BY timestamp)) / LAG(close) OVER (ORDER BY timestamp) AS r
            FROM dailyRangeStock
            WHERE symbol = $1 AND timestamp BETWEEN $2 AND $3
            ),
            all_r AS (
            SELECT timestamp, symbol, 
                (close - LAG(close) OVER (PARTITION BY symbol ORDER BY timestamp))
                / LAG(close) OVER (PARTITION BY symbol ORDER BY timestamp) AS r
            FROM dailyRangeStock
            WHERE timestamp BETWEEN $2 AND $3
            ),
            market_avg AS (
            SELECT timestamp, AVG(r) AS market_r
            FROM all_r
            WHERE r IS NOT NULL
            GROUP BY timestamp
            ),
            joined AS (
            SELECT s.r AS s_r, m.market_r AS m_r
            FROM stock_r s
            JOIN market_avg m ON s.timestamp = m.timestamp
            WHERE s.r IS NOT NULL AND m.market_r IS NOT NULL
            )

            SELECT COVAR_POP(s_r, m_r) / VAR_POP(m_r) AS beta,
                STDDEV_POP(s_r) / AVG(s_r) AS cov
            FROM joined
            `, [symbol, start, end]);

        return res.status(200).json({ daily: daily.rows, stats: stats.rows });
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

// add new daily data
router.post('/daily', async (req, res) => {
    const { symbol, timestamp, open, high, close, low, volume } = req.body;
    const open_f = parseFloat(open);
    const close_f = parseFloat(close);
    const high_f = parseFloat(high);
    const low_f = parseFloat(low);
    const volume_i = parseInt(volume);

    try {
        // insert into stock if not already existing, else update current price
        await db.query(`
            INSERT INTO stock (current_price, symbol)
            VALUES ($1, $2)
            ON CONFLICT (symbol) DO UPDATE SET current_price = EXCLUDED.current_price
            `, [close_f, symbol]);

        await db.query(`
            INSERT INTO dailyRangeStock (symbol, timestamp, open, high, close, low, volume) 
            VALUES ($1, $2, $3, $4, $5, $6 ,$7)
            `, [symbol, timestamp, open_f, high_f, close_f, low_f, volume_i]);

        return res.json({ message: "Stock data added successfully" });
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

// make prediction based on past data
router.get('/predict', async (req, res) => {
    const symbol = req.query.symbol;
    const date = req.query.date;

    console.log("here first");

    try {
        const result = await db.query(`
            WITH ordered AS (
            SELECT symbol, close, timestamp,
                ROW_NUMBER() OVER (ORDER BY timestamp) - 1 AS t
            FROM dailyRangeStock
            WHERE symbol = $1
            ),
            reg AS (
            SELECT regr_slope(close, t) AS slope, regr_intercept(close, t) AS intercept
            FROM ordered
            ),
            future_t as (
            SELECT
                (SELECT MAX(t) FROM ordered)
                + (SELECT
                    EXTRACT(DAYS FROM ($2::timestamp - (SELECT MAX(timestamp) FROM ordered)))
                ) AS t_future
            )
            SELECT intercept + slope * t_future AS price_prediction
            FROM reg, future_t
            `, [symbol, date]);
            
            return res.status(200).json({ prediction: result.rows[0] });
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

module.exports = router;