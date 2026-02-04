const crypto = require("crypto");
const https = require("https");
const http = require("http");

const API_URL = "http://localhost:3000/device/real/query";
const API_TOKEN = "interview_token_123";

/**
 * Generates MD5 signature for API request
 * Signature = MD5(URL + Token + Timestamp)
 */
function generateSignature(url, token, timestamp) {
  const hash = crypto.createHash("md5");
  hash.update(url + token + timestamp);
  return hash.digest("hex");
}

/**
 * Makes a POST request to the EnergyGrid API
 * @param {string[]} serialNumbers - Array of serial numbers (max 10)
 * @param {number} retries - Number of retry attempts remaining
 * @returns {Promise<Object>} API response data
 */
async function fetchDeviceData(serialNumbers, retries = 3) {
  if (serialNumbers.length > 10) {
    throw new Error("Batch size cannot exceed 10 devices");
  }

  const timestamp = Date.now().toString();
  const urlPath = "/device/real/query";
  const signature = generateSignature(urlPath, API_TOKEN, timestamp);

  const postData = JSON.stringify({
    sn_list: serialNumbers,
  });

  const url = new URL(API_URL);
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
      signature: signature,
      timestamp: timestamp,
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        } else if (res.statusCode === 429) {
          // Rate limit exceeded - retry after delay
          if (retries > 0) {
            console.log(
              `[429] Rate limit hit. Retrying in 1.5s... (${retries} retries left)`
            );
            setTimeout(() => {
              fetchDeviceData(serialNumbers, retries - 1)
                .then(resolve)
                .catch(reject);
            }, 1500);
          } else {
            reject(
              new Error(
                `Rate limit exceeded after retries. Status: ${res.statusCode}`
              )
            );
          }
        } else if (res.statusCode === 401) {
          reject(new Error(`Authentication failed. Status: ${res.statusCode}`));
        } else {
          // Other errors - retry if possible
          if (retries > 0 && res.statusCode >= 500) {
            console.log(
              `[${res.statusCode}] Server error. Retrying... (${retries} retries left)`
            );
            setTimeout(() => {
              fetchDeviceData(serialNumbers, retries - 1)
                .then(resolve)
                .catch(reject);
            }, 1000);
          } else {
            reject(
              new Error(
                `Request failed. Status: ${res.statusCode}, Response: ${data}`
              )
            );
          }
        }
      });
    });

    req.on("error", (error) => {
      // Network errors - retry if possible
      if (retries > 0) {
        console.log(
          `Network error: ${error.message}. Retrying... (${retries} retries left)`
        );
        setTimeout(() => {
          fetchDeviceData(serialNumbers, retries - 1)
            .then(resolve)
            .catch(reject);
        }, 1000);
      } else {
        reject(error);
      }
    });

    req.write(postData);
    req.end();
  });
}

module.exports = {
  fetchDeviceData,
  generateSignature,
};
