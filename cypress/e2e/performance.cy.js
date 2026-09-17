const API = 'http://localhost:3201';
describe('Bounded transaction history', () => {
  for (const size of [500, 1000, 5000]) {
    it(`searches, filters and paginates ${size} database transactions`, () => {
      cy.task('setHistorySize', size).its('total').should('equal', size);
      cy.intercept('GET', API + '/transactions?*').as('list');
      let started;
      const durations = [];
      cy.then(() => {
        started = Date.now();
      });
      cy.request(API + '/transactions?limit=20').then((response) => {
        durations.push(response.duration);
        expect(response.duration).to.be.lessThan(1500);
      });
      cy.visit('/transactions');
      cy.wait('@list').then(({ response }) => {
        expect(response.body.total).to.equal(size);
        expect(response.body.items).to.have.length(20);
      });
      cy.get('.transaction-row').should('have.length', 20);
      cy.contains('button', /^Next$/).click();
      cy.wait('@list').its('response.body.page').should('equal', 2);
      cy.intercept('GET', /\/transactions\?.*search=performance(?:\+|%20)needle/).as('search');
      cy.get('input[type="search"]')
        .clear()
        .type('performance needle', { delay: 0 })
        .should('have.value', 'performance needle');
      cy.wait('@search');
      cy.location('search').should('include', 'search=performance+needle');
      cy.get('.transaction-row').its('length').should('be.lte', 20).and('be.gt', 0);
      cy.contains('label', /^Category$/)
        .invoke('attr', 'for')
        .then((id) => cy.get(`[id="${id}"]`).select('shopping'));
      cy.location('search').should('include', 'category=shopping').and('not.include', 'page=2');
      cy.wait('@search');
      cy.get('.transaction-row').its('length').should('be.lte', 20).and('be.gt', 0);
      cy.request(API + '/transactions?search=performance%20needle&category=shopping').then(
        (response) => {
          durations.push(response.duration);
          expect(response.duration).to.be.lessThan(1500);
          expect(response.body.items.length).to.be.at.most(20);
        },
      );
      cy.then(() => {
        const elapsed = Date.now() - started;
        expect(elapsed).to.be.lessThan(12000);
        cy.writeFile(`.local/e2e/history-${size}.json`, {
          size,
          elapsedMs: elapsed,
          maxRenderedRows: 20,
          apiDurationsMs: durations,
        });
      });
    });
  }

  it('loads heavy routes on demand without duplicate API requests', () => {
    const calls = [];
    const routeLoads = [];
    let knownScripts;
    cy.intercept('GET', API + '/**', (request) => {
      const url = new URL(request.url);
      calls.push(url.pathname + url.search);
      request.continue();
    });
    cy.request({
      method: 'POST',
      url: API + '/session/demo',
      headers: { 'X-Flux-Client': 'web' },
    });
    cy.visit('/home');
    cy.get('h1').should('contain.text', 'Your money, in focus.');
    cy.window().then((win) => {
      knownScripts = new Set(
        win.performance
          .getEntriesByType('resource')
          .filter((entry) => entry.initiatorType === 'script')
          .map((entry) => entry.name),
      );
    });

    for (const [path, heading] of [
      ['/analytics', 'Analytics'],
      ['/subscriptions', 'Subscriptions'],
      ['/cards', 'Cards'],
    ]) {
      cy.then(() => {
        const started = Date.now();
        cy.get(`a[href="${path}"]`).filter(':visible').first().click();
        cy.location('pathname').should('equal', path);
        cy.get('h1').should('contain.text', heading);
        cy.window().then((win) => {
          const scripts = win.performance
            .getEntriesByType('resource')
            .filter((entry) => entry.initiatorType === 'script' && !knownScripts.has(entry.name))
            .map((entry) => ({
              name: new URL(entry.name).pathname,
              transferSize: entry.transferSize,
              durationMs: Math.round(entry.duration),
            }));
          scripts.forEach((entry) => knownScripts.add(new URL(entry.name, location.origin).href));
          routeLoads.push({ path, elapsedMs: Date.now() - started, scripts });
        });
      });
    }

    cy.then(() => {
      const counts = calls.reduce((result, call) => {
        result[call] = (result[call] || 0) + 1;
        return result;
      }, {});
      const duplicateCalls = Object.entries(counts).filter(([, count]) => count > 1);
      expect(duplicateCalls, JSON.stringify(duplicateCalls)).to.deep.equal([]);
      expect(routeLoads.every((route) => route.elapsedMs < 5000)).to.equal(true);
      cy.writeFile('.local/e2e/request-report.json', {
        routeLoads,
        apiCalls: counts,
        duplicateCalls,
      });
    });
  });
});
