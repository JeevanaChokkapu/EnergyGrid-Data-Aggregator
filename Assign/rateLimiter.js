/**
 * Rate Limiter to enforce 1 request per second
 * Uses a queue-based approach to ensure requests are spaced at least 1 second apart
 */
class RateLimiter {
  constructor(requestsPerSecond = 1) {
    this.requestsPerSecond = requestsPerSecond;
    this.minInterval = 1000 / requestsPerSecond; // 1000ms for 1 req/sec
    this.lastRequestTime = 0;
    this.queue = [];
    this.processing = false;
  }

  /**
   * Executes a function with rate limiting
   * @param {Function} fn - Function to execute (should return a Promise)
   * @returns {Promise} Promise that resolves when the function completes
   */
  async execute(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Processes the queue, ensuring requests are spaced at least 1 second apart
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      // Wait if necessary to maintain rate limit
      if (timeSinceLastRequest < this.minInterval) {
        const waitTime = this.minInterval - timeSinceLastRequest;
        await this.sleep(waitTime);
      }

      const { fn, resolve, reject } = this.queue.shift();
      this.lastRequestTime = Date.now();

      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }

  /**
   * Sleep utility function
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = RateLimiter;
