-- The original CSV file is formatted differently than our DayRangeStock Schema, so first modify it using (modify the file paths as needed):
-- awk -F',' 'NR==1 {print "symbol,timestamp,open,high,low,close,volume"; next} {print $7","$1","$2","$3","$4","$5","$6}' /Users/eishan/downloads/SP500History.csv > /Users/eishan/downloads/updatedFile.csv

-- Create temporary table to hold the CSV values before inserting into DayRangeStock
CREATE TEMP TABLE temp_csv (
    symbol VARCHAR(10),
    timestamp TIMESTAMP,
    open NUMERIC(10,2),
    high NUMERIC(10,2),
    low NUMERIC(10,2),
    close NUMERIC(10,2),
    volume INT
);

-- Load data from CSV into temporary table
COPY temp_csv(symbol, timestamp, open, high, low, close, volume)
FROM '/Users/eishan/downloads/updatedFile.csv'  -- update file path as needed
DELIMITER ',' CSV HEADER;

-- Insert unique symbols into stock table
INSERT INTO stock(symbol, current_price)
SELECT DISTINCT symbol, 0
FROM temp_csv
ON CONFLICT (symbol) DO NOTHING;

-- Insert all rows into DayRangeStock
INSERT INTO dayRangeStock(symbol, timestamp, open, high, low, close, volume)
SELECT symbol, timestamp, open, high, low, close, volume
FROM temp_csv;

-- Update current_price in stock using most recent close price
UPDATE stock s
SET current_price = t.close
FROM (
    SELECT DISTINCT ON (symbol) symbol, close -- Get the most recent close price for each distinct symbol
    FROM dayRangeStock
    ORDER BY symbol, timestamp DESC
) t
WHERE s.symbol = t.symbol;

DROP TABLE temp_csv;
