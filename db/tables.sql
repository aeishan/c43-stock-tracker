CREATE DATABASE stockTrakcer;


CREATE TABLE Account (
    account_id SERIAL PRIMARY KEY,
    username VARCHAR (20) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL -- long enough to store hashed passwords
);

CREATE TABLE Stock (
    current_price INT CHECK (current_price >= 0) NOT NULL,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) PRIMARY KEY
);

CREATE TABLE Portfolio (
    portfolio_id SERIAL PRIMARY KEY,
    cash_account NUMERIC(10,2) NOT NULL,
    owner_id INT REFERENCES Account(account_id)
);

CREATE TABLE StockList (
    stock_list_id SERIAL PRIMARY KEY,
    visibility VARCHAR(10) NOT NULL,
    owner_id INT REFERENCES Account(account_id)
);

CREATE TABLE Review (
    review_id SERIAL PRIMARY KEY,
    review TEXT,
    reviewer_id INT REFERENCES Account(account_id),
    stock_list_id INT REFERENCES StockList(stock_list_id)
);

CREATE TABLE StockHolding (
    shares INT CHECK (shares >= 0),
    symbol VARCHAR(10) REFERENCES Stock(symbol), 
    portfolio_id INT REFERENCES Portfolio(portfolio_id),
    PRIMARY KEY (symbol, portfolio_id)
);

CREATE TABLE Transaction (
    transaction_id SERIAL PRIMARY KEY, 
    type VARCHAR(25),
    symbol VARCHAR(10) REFERENCES Stock(symbol),
    shares_moved INT CHECK (shares_moved >= 0) NOT NULL,
    strike_price NUMERIC(10,2) check (strike_price >= 0) NOT NULL,
    date_time TIMESTAMP NOT NULL,
    portfolio_id INT REFERENCES Portfolio(portfolio_id)  -- ER digram imples this by making one to many relationship between Transaction and StockHolding
);

CREATE TABLE DailyRangeStock (
    symbol REFERENCES Stock(symbol) NOT NULL, 
    timestamp TIMESTAMP NOT NULL, 
    open NUMERIC(10,2) NOT NULL,
    high NUMERIC(10,2) NOT NULL,
    close NUMERIC(10,2) NOT NULL,
    low NUMERIC(10,2) NOT NULL,
    volume INT CHECK (volume >= 0),
    PRIMARY KEY (symbol, timestamp)
);

CREATE TABLE RequestFriendship (
    sender_id INT REFERENCES Account(account_id),
    receiver_id INT REFERENCES Account(account_id),
    time_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(10) NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),  -- set this to CURRENT_TIMESTAMP (on the backend) on creation or any modification to an entry of this table
    PRIMARY KEY (sender_id, receiver_id)
);

CREATE TABLE AccountCanSeeStockList (
    viewer_id INT REFERENCES Account(account_id),
    stock_list_id INT REFERENCES StockList(stock_list_id),
    PRIMARY KEY (viewer_id, stock_list_id)
);

CREATE TABLE StockListContainStockHolding (
    stock_list_id INT NOT NULL REFERENCES StockList(stock_list_id),
    symbol VARCHAR(10) NOT NULL,
    portfolio_id INT NOT NULL,
    FOREIGN KEY (symbol, portfolio_id) REFERENCES StockHolding(symbol, portfolio_id),
    PRIMARY KEY (stock_list_id, symbol, portfolio_id)
)