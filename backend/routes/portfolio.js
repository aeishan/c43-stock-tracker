const express = require('express');
const db = require('../db')

const router = express.Router();

router.post('/create', async (req, res) => {
    const id = req.session.accountId;
    const amount = parseFloat(req.query.amount);

    if (!id) {
        return res.status(400).json({ error: "No user logged in" });
    }

    try {
        const ret = await db.query(`
            INSERT INTO portfolio (cash_account, owner_id)
            VALUES ($1, $2)
            `, [amount, id]);
        
        return res.status(200).json({ message: "Portfolio successfully created"});
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

// get portfolio(s)
router.get('/', async (req, res) => {
    const id = req.session.accountId;

    if (!id) {
        return res.status(400).json({ error: "No user logged in" });
    }

    try {
        const ret = await db.query(`
            SELECT * FROM portfolio
            WHERE owner_id = $1
            `, [id]);
        
        return res.status(200).json(ret.rows);
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

// get stock holdings given portfolio_id
router.get('/holdings', async (req, res) => {
    const pid = parseInt(req.query.id);

    try {
        const ret = await db.query(`
            SELECT sh.symbol, sh.shares, s.current_price, sh.shares * s.current_price as asset_value
            FROM stockholding sh
            JOIN stock s USING(symbol)
            WHERE sh.portfolio_id = $1
            `, [pid]);
        
        return res.status(200).json(ret.rows);
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

// buy stocks
router.post('/buy', async (req, res) => {
    const pid = parseInt(req.query.pid);
    const symbol = req.query.symbol;
    const shares = parseInt(req.query.shares);

    try {
        // const amt = await db.query(`
        //     SELECT p.cash_account, s.current_price * $1 as total
        //     FROM portfolio p
        //     JOIN stock s USING(symbol)
        //     WHERE portfolio_id = $2 AND symbol = $3
        //     `, [shares, pid, symbol]);
        
        // const acc = amt.rows[0].cash_account;
        // const total = amt.rows[0].total;
        // if (acc < total) return res.status(400).json({ error: "Insufficient funds" });

        await db.query('BEGIN');
        const withdraw = await db.query(`
            WITH p AS (
            SELECT current_price
            FROM stock
            WHERE symbol = $2
            ),
            c AS (
            SELECT current_price * $3 as total
            FROM p
            )
            UPDATE portfolio
            SET cash_account = cash_account - c.total
            FROM c
            WHERE portfolio_id = $1 AND cash_account >= c.total
            RETURNING cash_account, c.total
            `, [pid, symbol, shares]);
        
        if (withdraw.rowCount == 0) {
            await db.query("ROLLBACK");
            return res.status(400).json({ error: "Insufficient funds" });
        }

        await db.query(`
            INSERT INTO stockholding (shares, symbol, portfolio_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (portfolio_id, symbol)
            DO UPDATE SET shares = stockholding.shares + EXCLUDED.shares
            `, [shares, symbol, pid]);
        await db.query("COMMIT");

        return res.status(200).json({ message: "Successful buy" });
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

// sell stocks
router.post('/sell', async (req, res) => {
    const pid = parseInt(req.query.pid);
    const symbol = req.query.symbol;
    const shares = parseInt(req.query.shares);

    try {
        await db.query('BEGIN');
        const sell = await db.query(`
            UPDATE stockholding
            SET shares = shares - $3
            WHERE portfolio_id = $1 AND symbol = $2 AND shares >= $3
            RETURNING shares
            `, [pid, symbol, shares]);
        
        if (sell.rowCount == 0) {
            await db.query("ROLLBACK");
            return res.status(400).json({ error: "Not enough shares" });
        }

        if (sell.rows[0].shares == 0) {
            await db.query(`
                DELETE FROM stockholding
                WHERE portfolio_id = $1 AND symbol = $2
                `, [pid, symbol]);
        }

        const price = await db.query(`
            SELECT current_price
            FROM stock
            WHERE symbol = $1
            `, [symbol]);
        
        if (price.rowCount == 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: "Stock not found"});
        }

        const total = price.rows[0].current_price * shares;

        await db.query(`
            UPDATE portfolio
            SET cash_account = cash_account + $1
            WHERE portfolio_id = $2
            `, [total, pid]);
        await db.query("COMMIT");

        return res.status(200).json({ message: "Sold successfully" });
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

router.post('/withdraw', async (req, res) => {
    const pid = parseInt(req.query.pid);
    const amount = parseFloat(req.query.amount);

    try {
        const withdraw = await db.query(`
            UPDATE portfolio
            SET cash_account = cash_account - $1
            WHERE portfolio_id = $2 AND cash_account >= $1
            `, [amount, pid]);
        
        if (withdraw.rowCount == 0) {
            return res.status(400).json({ error: "Insufficient funds" });
        }

        res.status(200).json({ message: "Withdrawn successfully" });
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

router.post('/deposit', async (req, res) => {
    const pid = parseInt(req.query.pid);
    const amount = parseFloat(req.query.amount);

    if (amount < 0) {
        return res.status(400).json({ error: "Positive amount required" });
    }

    try {
        await db.query(`
            UPDATE portfolio
            SET cash_account = cash_account + $1
            WHERE portfolio_id = $2
            `, [amount, pid]);

        res.status(200).json({ message: "Deposited successfully" });
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

router.get('/total', async (req, res) => {
    const pid = parseInt(req.query.pid);

    try {
        const total = await db.query(`
            SELECT SUM(sh.shares * s.current_price) AS total
            FROM stockholding sh
            JOIN stock s USING(symbol)
            WHERE sh.portfolio_id = $1
            `, [pid]);
        
        res.status(200).json({ total: total.rows[0] });
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

router.get('/matrix', async (req, res) => {
    const pid = parseInt(req.query.pid);

    try {
        const s = await db.query(`
            SELECT symbol
            FROM stockholding
            WHERE portfolio_id = $1
            `, [pid]);
        
        if (s.rowCount == 0) return res.status(400).json({ error: "No stocks in portfolio"});

        const symbols = s.rows.map(r => r.symbol);

        const m = await db.query(`
            WITH syms AS (
            SELECT symbol
            FROM stockholding
            WHERE portfolio_id = $1
            ),
            returns AS (
            SELECT d.symbol, d.timestamp,
                (d.close - LAG(d.close) OVER (PARTITION BY d.symbol ORDER BY d.timestamp)) 
                / LAG(d.close) OVER (PARTITION BY d.symbol ORDER BY d.timestamp) as ret
            FROM dailyRangeStock d
            JOIN syms s USING (symbol)
            ),
            clean AS (
            SELECT symbol, timestamp, ret
            FROM returns
            WHERE ret IS NOT NULL
            ),
            pairs AS (
            SELECT c1.symbol AS s1, c2.symbol AS s2,
                CORR(c1.ret, c2.ret) AS corr, COVAR_POP(c1.ret, c2.ret) AS covar
            FROM clean c1
            JOIN clean c2 ON c1.timestamp = c2.timestamp
            GROUP BY c1.symbol, c2.symbol
            )
            SELECT * FROM pairs ORDER BY s1, s2
            `, [pid]);

        const len = symbols.length;
        const corr = Array.from({ length: len }, () => Array(len).fill(null));
        const covar = Array.from({ length: len }, () => Array(len).fill(null));

        for (const r of m.rows) {
            const i = symbols.indexOf(r.s1);
            const j = symbols.indexOf(r.s2);
            corr[i][j] = r.corr;
            covar[i][j] = r.covar;
        }

        return res.json({ symbols, correlation: corr, covariance: covar });
        
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

module.exports = router;