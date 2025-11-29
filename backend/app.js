const express = require('express');
const session = require('express-session');
const path = require('path');
const http = require('http');
const { Pool } = require('pg');

const userRouter = require('./routes/user');
const stockRouter = require('./routes/stocks');
const portfolioRouter = require('./routes/portfolio');
const stockHoldingRouter = require('./routes/stockHolding');
const friendsRouter = require('./routes/friends');
const stockListsRouter = require('./routes/stockLists');
const reviewsRouter = require('./routes/reviews');
const statsRouter = require('./routes/stats');

const PORT = 3000;

require('dotenv').config();

const app = express();

app.use(session({
  secret: 'superduper',
  resave: false,
  saveUninitialized: false,
  cookie: {secure: false}
}));

app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/user', userRouter);
app.use('/stocks', stockRouter);
app.use('/portfolio', portfolioRouter);
app.use('/stockHoldings', stockHoldingRouter);
app.use('/friends', friendsRouter);
app.use('/stockLists', stockListsRouter);
app.use('/reviews', reviewsRouter);
app.use('/stats', statsRouter);


const server = http.createServer(app).listen(PORT, function(err) {
  if (err) console.log(err);
  else console.log("HTTP server on http://localhost:%s", PORT);
});

module.exports = app;