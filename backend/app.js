const express = require('express');
const path = require('path');
const http = require('http');
const { Pool } = require('pg');

require('dotenv').config();

const app = express();

app.use(express.json());

app.use('/user', userRouter)

const server = http.createServer(app).listen(PORT, function(err) {
  if (err) console.log(err);
  else console.log("HTTP server on http://localhost:%s", PORT);
});

module.exports = app;