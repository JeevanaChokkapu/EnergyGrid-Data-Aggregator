# EnergyGrid Data Aggregator

A robust Node.js client application that fetches real-time telemetry data from 500 solar inverters while respecting strict rate limits and security protocols.

## Project Structure

```
Assign/
├── server.js          # Mock API server (EnergyGrid API simulator)
├── client.js          # API client module (signature generation, HTTP requests)
├── rateLimiter.js     # Rate limiting module (1 req/sec enforcement)
├── aggregator.js      # Main aggregation script
├── package.json       # Dependencies and scripts
├── README.md          # This file
└── instructions.md    # Assignment requirements
```

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Setup and Run

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Start the Mock API Server

In one terminal window, start the mock server:

```bash
npm start
# or
node server.js
```

You should see:
```
⚡ EnergyGrid Mock API running on port 3000
   Constraints: 1 req/sec, Max 10 items/batch
```

**Keep this server running** while you execute the aggregator.

### Step 3: Run the Data Aggregator

In another terminal window, run the aggregator:

```bash
npm run aggregate
# or
node aggregator.js
```

The aggregator will:
1. Generate 500 serial numbers (SN-000 to SN-499)
2. Split them into 50 batches of 10 devices each
3. Fetch data for each batch while respecting the 1 req/sec rate limit
4. Aggregate all results and display a summary

## Approach and Implementation

### Architecture

The solution is modular with clear separation of concerns:

1. **`client.js`** - Handles all API communication
   - Generates MD5 signatures: `MD5(URL + Token + Timestamp)`
   - Makes HTTP POST requests with proper headers
   - Implements retry logic for 429s and network errors

2. **`rateLimiter.js`** - Enforces rate limiting
   - Queue-based approach ensures requests are spaced exactly 1 second apart
   - Prevents rate limit violations by tracking last request time
   - Processes requests sequentially with automatic spacing

3. **`aggregator.js`** - Orchestrates the entire process
   - Generates serial numbers
   - Creates batches of 10 devices
   - Coordinates rate-limited API calls
   - Aggregates results into a comprehensive report

### Rate Limiting Strategy

**Queue-Based Rate Limiter:**
- Maintains a queue of pending requests
- Calculates wait time based on time since last request
- Ensures minimum 1000ms gap between requests
- Processes requests sequentially to guarantee compliance

This approach is more reliable than simple `setTimeout` delays because it accounts for:
- Variable request processing times
- Network latency variations
- System clock precision

### Error Handling

The client implements robust error handling:

1. **429 (Rate Limit Exceeded)**
   - Automatic retry with 1.5s delay
   - Up to 3 retry attempts per batch
   - Logs retry attempts for visibility

2. **Network Errors**
   - Retries on connection failures
   - Exponential backoff not needed (rate limiter handles timing)
   - Up to 3 retry attempts

3. **401 (Authentication Errors)**
   - No retry (indicates signature issue)
   - Immediate failure with clear error message

4. **500+ Server Errors**
   - Retries with 1s delay
   - Up to 3 retry attempts

### Batch Processing

- **Batch Size**: 10 devices per request (API limit)
- **Total Batches**: 50 batches for 500 devices
- **Estimated Time**: ~50 seconds minimum (1 req/sec × 50 batches)
- **Actual Time**: Slightly longer due to processing overhead

### Signature Generation

The signature is computed as:
```javascript
MD5(URL + Token + Timestamp)
```

Where:
- `URL` = `/device/real/query` (path only, not full URL)
- `Token` = `interview_token_123`
- `Timestamp` = Current time in milliseconds (as string)

This matches exactly what the server expects.

## Output

The aggregator provides:

1. **Real-time Progress**: Shows each batch being processed
2. **Summary Statistics**:
   - Total devices processed
   - Online/Offline counts
   - Total and average power
   - Success rate percentage
3. **Error Reporting**: Lists any failed batches with error details

Example output:
```
📈 AGGREGATION SUMMARY
============================================================
Total Devices Processed: 500
Online Devices: 450
Offline Devices: 50
Total Power: 1234.56 kW
Average Power per Device: 2.47 kW
Success Rate: 90.00%
============================================================
```

## Assumptions

1. **Server Availability**: The mock server must be running before starting the aggregator
2. **Network Stability**: Assumes stable network connection (retries handle temporary failures)
3. **Time Precision**: System clock is reasonably accurate (millisecond precision sufficient)
4. **Error Tolerance**: Some batches may fail after retries; the aggregator continues processing remaining batches

## Testing

To test the solution:

1. Start the mock server: `npm start`
2. Run the aggregator: `npm run aggregate`
3. Verify:
   - All 500 devices are processed
   - Rate limit is respected (no 429 errors in normal operation)
   - Signature generation is correct (no 401 errors)
   - Results are properly aggregated

## Code Quality

- **Modular Design**: Clear separation between API client, rate limiting, and business logic
- **Error Handling**: Comprehensive retry logic and error reporting
- **Code Readability**: Well-commented, descriptive variable names, clear function purposes
- **No External Dependencies**: Uses only Node.js built-in modules (crypto, http)
- **Robustness**: Handles edge cases and failures gracefully
