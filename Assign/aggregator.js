const { fetchDeviceData } = require("./client");
const RateLimiter = require("./rateLimiter");

/**
 * Generates an array of serial numbers from SN-000 to SN-499
 * @param {number} count - Number of serial numbers to generate
 * @returns {string[]} Array of serial numbers
 */
function generateSerialNumbers(count = 500) {
  const serialNumbers = [];
  for (let i = 0; i < count; i++) {
    serialNumbers.push(`SN-${String(i).padStart(3, "0")}`);
  }
  return serialNumbers;
}

/**
 * Splits an array into batches of specified size
 * @param {Array} array - Array to split
 * @param {number} batchSize - Size of each batch
 * @returns {Array[]} Array of batches
 */
function createBatches(array, batchSize) {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Aggregates device data from all batches
 * @param {Array} allResults - Array of all API responses
 * @returns {Object} Aggregated report
 */
function aggregateResults(allResults) {
  const aggregated = {
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    totalPower: 0,
    devices: [],
    summary: {},
  };

  allResults.forEach((response) => {
    if (response && response.data && Array.isArray(response.data)) {
      response.data.forEach((device) => {
        aggregated.totalDevices++;
        aggregated.devices.push(device);

        if (device.status === "Online") {
          aggregated.onlineDevices++;
        } else {
          aggregated.offlineDevices++;
        }

        // Extract numeric power value (remove " kW" suffix)
        const powerValue = parseFloat(device.power);
        if (!isNaN(powerValue)) {
          aggregated.totalPower += powerValue;
        }
      });
    }
  });

  aggregated.summary = {
    totalDevices: aggregated.totalDevices,
    onlineDevices: aggregated.onlineDevices,
    offlineDevices: aggregated.offlineDevices,
    totalPowerKW: aggregated.totalPower.toFixed(2),
    averagePowerKW: (
      aggregated.totalPower / aggregated.totalDevices
    ).toFixed(2),
    successRate: (
      (aggregated.onlineDevices / aggregated.totalDevices) *
      100
    ).toFixed(2) + "%",
  };

  return aggregated;
}

/**
 * Main function to fetch and aggregate data from all devices
 */
async function aggregateAllDevices() {
  console.log("🚀 Starting EnergyGrid Data Aggregation...\n");

  // Generate serial numbers
  const serialNumbers = generateSerialNumbers(500);
  console.log(`✅ Generated ${serialNumbers.length} serial numbers`);

  // Create batches of 10
  const batches = createBatches(serialNumbers, 10);
  console.log(`✅ Created ${batches.length} batches (10 devices per batch)\n`);

  // Initialize rate limiter (1 request per second)
  const rateLimiter = new RateLimiter(1);

  const allResults = [];
  const errors = [];

  console.log("📡 Fetching device data...\n");

  // Process each batch with rate limiting
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNumber = i + 1;

    try {
      console.log(
        `[Batch ${batchNumber}/${batches.length}] Fetching ${batch.length} devices...`
      );

      const result = await rateLimiter.execute(() =>
        fetchDeviceData(batch)
      );

      allResults.push(result);
      console.log(
        `  ✅ Success: Received data for ${result.data.length} devices\n`
      );
    } catch (error) {
      errors.push({
        batch: batchNumber,
        serialNumbers: batch,
        error: error.message,
      });
      console.error(
        `  ❌ Error in batch ${batchNumber}: ${error.message}\n`
      );
    }
  }

  // Aggregate results
  console.log("\n📊 Aggregating results...\n");
  const aggregated = aggregateResults(allResults);

  // Display summary
  console.log("=".repeat(60));
  console.log("📈 AGGREGATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total Devices Processed: ${aggregated.summary.totalDevices}`);
  console.log(`Online Devices: ${aggregated.summary.onlineDevices}`);
  console.log(`Offline Devices: ${aggregated.summary.offlineDevices}`);
  console.log(`Total Power: ${aggregated.summary.totalPowerKW} kW`);
  console.log(
    `Average Power per Device: ${aggregated.summary.averagePowerKW} kW`
  );
  console.log(`Success Rate: ${aggregated.summary.successRate}`);
  console.log("=".repeat(60));

  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} batch(es) failed:`);
    errors.forEach((err) => {
      console.log(`  Batch ${err.batch}: ${err.error}`);
    });
  }

  return {
    aggregated,
    errors,
    batchesProcessed: batches.length,
    batchesSuccessful: allResults.length,
    batchesFailed: errors.length,
  };
}

// Run if executed directly
if (require.main === module) {
  aggregateAllDevices()
    .then((result) => {
      console.log("\n✅ Aggregation completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Fatal error:", error);
      process.exit(1);
    });
}

module.exports = {
  aggregateAllDevices,
  generateSerialNumbers,
  createBatches,
  aggregateResults,
};
