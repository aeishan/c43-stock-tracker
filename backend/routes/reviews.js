const express = require('express');
const db = require('../db')

const router = express.Router();

async function canUserViewStockList(accountId, stockListId) {
    const verify = await db.query(
        `SELECT visibility, owner_id FROM stockList WHERE stock_list_id = $1`,
        [stockListId]
    );

    if (verify.rowCount === 0) {
        return { errorCode: 404, errorMessage: 'Stock list not found' };
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
            return { errorCode: 403, errorMessage: 'You cannot view this stock list' };
        }
    }

    return { visibility, ownerId };
}

// get all reviews for a stockList
router.get('/:stockListId', async (req, res) => {
    const stockListId = parseInt(req.params.stockListId);
    const accountId = req.session.accountId;

    if (!stockListId || isNaN(stockListId)) {
        return res.status(400).json({ error: 'Invalid stockListId parameter' });
    }

    try{
        const viewInfo = await canUserViewStockList(accountId, stockListId);
        if (viewInfo.errorCode) {
            return res.status(viewInfo.errorCode).json({ error: viewInfo.errorMessage });
        }
        const { visibility, ownerId } = viewInfo;

        const data = await db.query(
            `SELECT r.review_id, a.username, r.review, r.stock_list_id, r.reviewer_id 
             FROM Review r 
             JOIN Account a ON r.reviewer_id = a.account_id 
             WHERE r.stock_list_id = $1`,
            [stockListId]
        );

        if (data.rowCount === 0) {
            return res.status(200).json([]);
        }

        if (visibility === 'public' || accountId === ownerId) {
            return res.status(200).json(data.rows);
        }

        // if private stockList, only show review by user
        const userOwnedReview = data.rows.filter(
            (review) => review.reviewer_id === accountId
        );

        return res.status(200).json(userOwnedReview);
    }
    catch (err) {
        return res.status(500).json({ error: err });
    }
});

// get a specific review
router.get('/review/:reviewId', async (req, res) => {
    const reviewId = parseInt(req.params.reviewId);
    const accountId = req.session.accountId;

    if (!reviewId || isNaN(reviewId)) {
        return res.status(400).json({ error: 'Invalid reviewId parameter' });
    }

    try {

        const data = await db.query(
            `SELECT r.review_id, r.review, r.stock_list_id, r.reviewer_id, a.username
             FROM Review r 
             JOIN Account a ON r.reviewer_id = a.account_id 
             WHERE r.review_id = $1`,
            [reviewId]
        );

        if (data.rowCount === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }

        const review = data.rows[0];
        const stockListId = review.stock_list_id;

        const viewInfo = await canUserViewStockList(accountId, stockListId);

        if (viewInfo.errorCode) {
            return res.status(viewInfo.errorCode).json({ error: viewInfo.errorMessage });
        }

        const { visibility, ownerId } = viewInfo;

        if (visibility === 'public' || accountId === ownerId) {
            return res.status(200).json(review);
        }
        if (review.reviewer_id !== accountId) {
            return res.status(403).json({ error: 'You cannot view this review' });
        }

        return res.status(200).json(review);
    }
    catch (err) {
        return res.status(500).json({ error: err });
    }
});

// create review 
router.post('/', async (req, res) => {
    const { stockListId, review } = req.body;
    const reviewerId = req.session.accountId;

    if (!stockListId || isNaN(stockListId)) {
        return res.status(400).json({ error: 'Invalid stockListId parameter' });
    }

    if (!review || review.trim() === '') {
        return res.status(400).json({ error: 'Review content cannot be empty' });
    }

    try {

        // check if user has written a review already
        const existing = await db.query(
            `SELECT 1 FROM Review 
             WHERE stock_list_id = $1 AND reviewer_id = $2`,
            [stockListId, reviewerId]
        );

        if (existing.rowCount > 0) {
            return res.status(400).json({ error: 'You have already written a review for this stock list' });
        }

        const viewInfo = await canUserViewStockList(reviewerId, stockListId);

        if (viewInfo.errorCode) {
            return res.status(viewInfo.errorCode).json({ error: viewInfo.errorMessage });
        }

        const ret = await db.query(
            `INSERT INTO Review (review, reviewer_id, stock_list_id)
             VALUES ($1, $2, $3)`,
            [review, reviewerId, stockListId]
        );

        if (ret.rowCount === 0) {
            return res.status(500).json({ error: 'Failed to create review' });
        }

        return res.status(200).json({ message: 'Review created successfully' });
    }
    catch (err) {
        return res.status(500).json({ error: err });
    }
});

// edit a review
router.put('/:reviewId', async (req, res) => {
    const reviewId = parseInt(req.params.reviewId);
    const { review } = req.body;
    const reviewerId = req.session.accountId;

    if (!reviewId || isNaN(reviewId)) {
        return res.status(400).json({ error: 'Invalid reviewId parameter' });
    }

    if (!review || review.trim() === '') {
        return res.status(400).json({ error: 'Review content cannot be empty' });
    }

    try {

        const data = await db.query(
            `SELECT reviewer_id FROM Review WHERE review_id = $1`,
            [reviewId]
        );

        if (data.rowCount === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }

        if (data.rows[0].reviewer_id !== reviewerId) {
            return res.status(403).json({ error: 'You cannot edit this review' });
        }

        const ret = await db.query(
            `UPDATE Review 
             SET review = $1 
             WHERE review_id = $2`,
            [review, reviewId]
        );

        if (ret.rowCount === 0) {
            return res.status(500).json({ error: 'Failed to update review' });
        }

        return res.status(200).json({ message: 'Review updated successfully' });
    }
    catch (err) {
        return res.status(500).json({ error: err });
    }
});

// delete a review
router.delete('/:reviewId', async (req, res) => {
    const reviewId = parseInt(req.params.reviewId);
    const reviewerId = req.session.accountId;

    if (!reviewId || isNaN(reviewId)) {
        return res.status(400).json({ error: 'Invalid reviewId parameter' });
    }

    try {

        const data = await db.query(
            `SELECT r.reviewer_id, sl.owner_id
            FROM Review r
            JOIN StockList sl ON r.stock_list_id = sl.stock_list_id
            WHERE r.review_id = $1`,
            [reviewId]
        );

        if (data.rowCount === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }

        if (data.rows[0].reviewer_id !== reviewerId && data.rows[0].owner_id !== reviewerId) {
            return res.status(403).json({ error: 'You cannot delete this review' });
        }

        const ret = await db.query(
            `DELETE FROM Review WHERE review_id = $1`,
            [reviewId]
        );

        if (ret.rowCount === 0) {
            return res.status(500).json({ error: 'Failed to delete review' });
        }

        return res.status(200).json({ message: 'Review deleted successfully' });
    }
    catch (err) {
        return res.status(500).json({ error: err });
    }
});

module.exports = router;