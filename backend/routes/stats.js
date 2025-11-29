const express = require('express');
const db = require('../db')

const router = express.Router();

router.get('/matrix', async (req, res) => {
    const id = parseInt(req.query.id);
    const usage = req.query.usage;
    
    const query = usage == 'stockholding' ? 'SELECT symbol FROM stockholding WHERE portfolio_id = $1' :
        'SELECT symbol FROM stocklistcontainstockholding WHERE stock_list_id = $1';

    try {
        const s = await db.query(query, [id]);
        
        if (s.rowCount == 0) return res.status(400).json({ error: "No stocks in portfolio"});

        const symbols = s.rows.map(r => r.symbol);

        const m = await db.query(`
            WITH syms AS (
            ${query}
            ),
            returns AS (
            SELECT d.symbol, d.timestamp,
                (d.close - LAG(d.close) OVER (PARTITION BY d.symbol ORDER BY d.timestamp)) 
                / LAG(d.close) OVER (PARTITION BY d.symbol ORDER BY d.timestamp) as ret
            FROM dayRangeStock d
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
            `, [id]);

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