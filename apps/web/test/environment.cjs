const { TestEnvironment } = require('jest-environment-jsdom');

module.exports = class FluxTestEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();
    Object.assign(this.global, {
      Request,
      Response,
      Headers,
      AbortController,
      AbortSignal,
      fetch: () => Promise.reject(new Error('Mock the request before fetching in a unit test.')),
    });
  }
};
