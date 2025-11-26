const express = require('express');
const db = require('../db')

const router = express.Router();

// get all stocks associated with a list of stocklist ids (ids have been filtered to include ones that the user can view)
async function getStocksFromStockLists(idsArray) {
    const { rows } = await db.query(
      `
      SELECT
        sl.stock_list_id,
        sl.visibility,
        s.symbol,
        sl.owner_id
      FROM stocklist sl
      JOIN stockListContainStockHolding s ON sl.stock_list_id = s.stock_list_id
      WHERE sl.stock_list_id = ANY($1)
      `,
      [idsArray]
    );
  
    const grouped = {};
    for (const row of rows) {
      const id = row.stock_list_id;
      
  
      if (!grouped[id]) {
        grouped[id] = {
          stocklistID: row.stock_list_id,
          ownerID: row.owner_id,
          visibility: row.visibility,
          stocks: []
        };
      }
  
      grouped[id].stocks.push({
        symbol: row.symbol,
      });
    }
  
    return Object.values(grouped); // return as array of objects (each object is stock list with its stocks)
  }

// get all public stocklists
router.get('/public', async (req, res) => {
    try {
        const ret = await db.query(`
            SELECT sl.stock_list_id, sl.visibility, a.username AS owner_username
            FROM StockList sl
            JOIN Account a ON sl.owner_id = a.account_id
            WHERE sl.visibility = 'public'
        `);

        if (ret.rows.length === 0) {
            return res.status(202).json([]);
        }

        const stockListIds = ret.rows.map(row => row.stock_list_id);
        const final = await getStocksFromStockLists(stockListIds);
        
        return res.status(200).json(final);
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

// get all stockLists owned by user
router.get('/owned', async (req, res) => {
    const accountId = req.session.accountId;
    try {
        const { rows } = await db.query(
            `SELECT stock_list_id FROM stockList WHERE owner_id = $1`,
            [accountId]
        );
        if (rows.length === 0) {
            return res.status(202).json([]);
        }
        const stockListIds = rows.map(row => row.stock_list_id);
        const final = await getStocksFromStockLists(stockListIds);
        return res.status(200).json(final);
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

// get all stockLists shared to user
router.get('/shared', async (req, res) => {
    const accountId = req.session.accountId;

    try {
        const { rows } = await db.query(
            `SELECT stock_list_id FROM accountCanSeeStockList WHERE viewer_id = $1`,
            [accountId]
        );

        if (rows.length === 0) {
            return res.status(202).json([]);
        }

        const stockListIds = rows.map(row => row.stock_list_id);
        const final = await getStocksFromStockLists(stockListIds);
        return res.status(200).json(final);
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

// get stock list by id 
router.get('/:stockListId', async (req, res) => {
    const stockListId = parseInt(req.params.stockListId);
    const accountId = req.session.accountId;
    if (isNaN(stockListId)) {
        return res.status(400).json({ error: 'Invalid stockListId' });
    }
    try {

        const checkExists = await db.query(
            `SELECT 1 FROM stockList WHERE stock_list_id = $1`,
            [stockListId]
        );
        if (checkExists.rowCount === 0) {
            return res.status(404).json({ error: 'Stock list not found' });
        }

        // check if user can view the stock list
        const verify = await db.query(
            `SELECT visibility, owner_id FROM stockList WHERE stock_list_id = $1`,
            [stockListId]
        );
        if (verify.rowCount === 0) {
            return res.status(404).json({ error: 'Stock list not found' });
        }
        const visibility = verify.rows[0].visibility;
        const ownerId = verify.rows[0].owner_id;
        if (visibility === 'private' && ownerId !== accountId) {
            const canSee = await db.query(
                `SELECT 1 FROM accountCanSeeStockList
                 WHERE viewer_id = $1 AND stock_list_id = $2`,
                [accountId, stockListId]
            );
            if (canSee.rowCount === 0) {
                return res.status(403).json({ error: 'Unauthorized to view this stock list' });
            }
        }

        const final = await getStocksFromStockLists([stockListId]);
        return res.status(200).json(final[0]);
    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

// create a stock list and link it to entries in stockListContainStockHolding
router.post('/', async (req, res) => {
    const { visibility, stocks } = req.body;  // stocks should be array of objects { symbol, portfolio_id } (i.e. stock holdings)
    const accountId = req.session.accountId;

    if (!visibility || !Array.isArray(stocks)) {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    try {
        const ret = await db.query(
            'INSERT INTO stockList (owner_id, visibility) VALUES ($1, $2) RETURNING stock_list_id',
            [accountId, visibility]
        );

        if (ret.rows.length === 0) {
            return res.status(500).json({ error: 'Failed to create stock list' });
        }

        const stockListId = ret.rows[0].stock_list_id;

        // insert each stockHolding into stockListContainStockHolding
        for (const stock of stocks) {
            const { symbol, portfolio_id } = stock;

            if (!symbol || !portfolio_id) {
                console.log('Missing symbol or portfolio_id in stock:', stock); // should never run but here for safety
                continue;
            }

            // check if stock holding exists
            const exists = await db.query(
                `SELECT 1 FROM stockHolding WHERE symbol = $1 AND portfolio_id = $2`,
                [symbol, portfolio_id]
            );

            if (exists.rowCount === 0) {
                console.log(`StockHolding not found for symbol ${symbol} in portfolio ${portfolio_id}`);  // should never run but here for safety
                continue; // skip invalid stock
            }

            await db.query(
                `INSERT INTO stockListContainStockHolding (stock_list_id, symbol, portfolio_id)
                 VALUES ($1, $2, $3)`,
                [stockListId, symbol, portfolio_id]
            );
        }

        return res.status(200).json({
            message: 'Stock list created and stocks added successfully',
            stockListId
        });

    } catch (err) {
        console.error('Error creating stock list:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// edit stockList
router.put('/:stockListId', async (req, res) => {
    const stockListId = parseInt(req.params.stockListId);
    const { visibility, stocks } = req.body; 
    const accountId = req.session.accountId;

    if (isNaN(stockListId) || !visibility || !Array.isArray(stocks)) {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    try {
        // check if stock list belongs to user
        const verify = await db.query(
            `SELECT 1 FROM stockList WHERE stock_list_id = $1 AND owner_id = $2`,
            [stockListId, accountId]
        );

        if (verify.rowCount === 0) {
            return res.status(403).json({ error: 'Unauthorized to edit this stock list' });
        }

        // update visibility
        await db.query(
            `UPDATE stockList SET visibility = $1 WHERE stock_list_id = $2`,
            [visibility, stockListId]
        );

        // delete old entries in stockListContainStockHolding
        await db.query(
            `DELETE FROM stockListContainStockHolding WHERE stock_list_id = $1`,
            [stockListId]
        );

        // reinsert new stocks
        for (const stock of stocks) {
            const { symbol, portfolio_id } = stock;

            if (!symbol || !portfolio_id) {
                console.log('Missing symbol or portfolio_id in stock:', stock);  // should never run but here for safety
                continue;
            }

            // ensure stock holding exists
            const exists = await db.query(
                `SELECT 1 FROM stockHolding WHERE symbol = $1 AND portfolio_id = $2`,
                [symbol, portfolio_id]
            );

            if (exists.rowCount === 0) {
                console.log(`StockHolding not found for symbol ${symbol} in portfolio ${portfolio_id}`);  // should never run but here for safety
                continue;
            }

            await db.query(
                `INSERT INTO stockListContainStockHolding (stock_list_id, symbol, portfolio_id)
                 VALUES ($1, $2, $3)`,
                [stockListId, symbol, portfolio_id]
            );
        }

        return res.status(200).json({
            message: 'Stock list updated successfully',
            stockListId
        });

    } catch (err) {
        console.error('Error updating stock list:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// share stock list with another user
router.post('/:stockListId/share', async (req, res) => {
    const stockListId = parseInt(req.params.stockListId);
    const { viewerId } = req.body;
    const accountId = req.session.accountId;

    if (isNaN(stockListId) || !viewerId) {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    try {
        // check if stock list belongs to user
        const verify = await db.query(
            `SELECT 1 FROM stockList WHERE stock_list_id = $1 AND owner_id = $2`,
            [stockListId, accountId]
        );

        if (verify.rowCount === 0) {
            return res.status(403).json({ error: 'Unauthorized to share this stock list' });
        }

        // check if user can already see the stock list
        const isPublicStockList = await db.query(
            `SELECT 1 FROM stockList WHERE stock_list_id = $1 AND visibility = 'public'`,
            [stockListId]
        );

        const alreadyCanSee = await db.query(
            `SELECT 1 FROM accountCanSeeStockList
             WHERE viewer_id = $1 AND stock_list_id = $2`,
            [viewerId, stockListId]
        );

        if (alreadyCanSee.rowCount > 0 || isPublicStockList.rowCount > 0) {
            return res.status(409).json({ error: 'User already has access to this stock list' });
        }

        // insert into accountCanSeeStockList
        await db.query(
            `INSERT INTO accountCanSeeStockList (viewer_id, stock_list_id)
             VALUES ($1, $2)
             ON CONFLICT (viewer_id, stock_list_id) DO NOTHING`,
            [viewerId, stockListId]
        );

        return res.status(200).json({ message: 'Stock list shared successfully' });

    } catch (err) {
        return res.status(500).json({ error: err });
    }
});

// delete stock list and entries in stockListContainStockHolding
router.delete('/:stockListId', async (req, res) => {
    const stockListId = parseInt(req.params.stockListId);
    const accountId = req.session.accountId;

    if (isNaN(stockListId)) {
        return res.status(400).json({ error: 'Invalid stockListId' });
    }

    try {
        // check if stock list belongs to user
        const verify = await db.query(
            `SELECT 1 FROM stockList WHERE stock_list_id = $1 AND owner_id = $2`,
            [stockListId, accountId]
        );

        if (verify.rowCount === 0) {
            return res.status(403).json({ error: 'Unauthorized to delete this stock list' });
        }

        // delete entries in stockListContainStockHolding
        await db.query(
            `DELETE FROM stockListContainStockHolding WHERE stock_list_id = $1`,
            [stockListId]
        );

        // delete associated entries in accountCanSeeStockList
        await db.query(
            `DELETE FROM accountCanSeeStockList WHERE stock_list_id = $1`,
            [stockListId]
        );

        // delete stock list
        const del = await db.query(
            `DELETE FROM stockList WHERE stock_list_id = $1`,
            [stockListId]
        );

        if (del.rowCount === 0) {
            return res.status(500).json({ error: 'Failed to delete stock list' });
        }

        return res.status(200).json({ message: 'Stock list deleted successfully' });

    } catch (err) {
        return res.status(500).json({ error: err });
    }
});



module.exports = router;