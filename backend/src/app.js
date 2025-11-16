require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const { Pool } = require('pg');

const PORT = 3000;
const app = express();

app.use(express.json());


export const server = http.createServer(app).listen(PORT, function(err) {
  if (err) console.log(err);
  else console.log("HTTP server on http://localhost:%s", PORT);
});