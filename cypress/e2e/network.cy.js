const API = 'http://localhost:3201';
const button = (label) => cy.contains('button', label);

describe('Recovery under network and route failures', () => {
  it('keeps navigation usable during a slow account response', () => {
    cy.intercept('GET', API + '/accounts', (request) =>
      request.continue((response) => response.setDelay(1500)),
    ).as('accounts');
    cy.visit('/accounts');
    cy.get('.skeleton').should('exist');
    cy.get('nav[aria-label="Primary navigation"]').should('be.visible');
    cy.wait('@accounts');
    cy.get('.account-tile').should('have.length', 4);
  });

  it('recovers a server error without losing transaction filters', () => {
    cy.intercept(
      { method: 'GET', url: API + '/transactions?*', times: 1 },
      { statusCode: 500, body: { message: 'Temporary outage' } },
    );
    cy.visit('/transactions?account=usd&category=dining');
    cy.get('[role="alert"]').should('contain.text', 'Transactions couldn’t load');
    button(/^Try again$/).click();
    cy.get('.transaction-row').should('have.length.greaterThan', 0);
    cy.location('search').should('contain', 'account=usd').and('contain', 'category=dining');
  });

  it('recovers an interrupted connection', () => {
    cy.intercept(
      { method: 'GET', url: API + '/analytics/summary*', times: 1 },
      { forceNetworkError: true },
    );
    cy.visit('/analytics?period=quarter');
    cy.get('[role="alert"]').should('be.visible');
    button(/^Try again$/).click();
    cy.get('.insight-spending-value').should('be.visible');
    button(/^3 months$/).should('have.attr', 'aria-pressed', 'true');
  });

  it('times out an unresponsive request and offers retry', () => {
    cy.intercept({ method: 'GET', url: API + '/budgets*', times: 1 }, (request) =>
      request.continue((response) => response.setDelay(25000)),
    );
    cy.visit('/budgets');
    cy.get('.skeleton').should('exist');
    cy.get('[role="alert"]', { timeout: 24000 }).should('be.visible');
    button(/^Try again$/).click();
    cy.get('.budget-list').should('be.visible');
  });

  it('keeps recent activity available when the Home overview fails', () => {
    cy.intercept('GET', API + '/overview*', {
      statusCode: 503,
      body: { message: 'Overview unavailable' },
    });
    cy.visit('/home');
    cy.contains('Balance unavailable').should('be.visible');
    cy.get('.finance-activity .transaction-row').should('have.length.greaterThan', 0);
    cy.get('.account-selector').should('be.visible');
  });

  it('recovers a failed route chunk without clearing a saved financial attempt', () => {
    const saved = JSON.stringify({ marker: 'preserve-existing-attempt' });
    cy.intercept(
      { method: 'GET', url: /\/\d+\.[a-f0-9]+\.js$/, times: 1 },
      { statusCode: 503, body: '' },
    );
    cy.visit('/home', {
      onBeforeLoad(win) {
        win.sessionStorage.setItem('flux.transfer.draft.v1', saved);
      },
    });
    cy.contains('h1', 'This page couldn’t load').should('be.visible').and('be.focused');
    cy.window()
      .its('sessionStorage')
      .invoke('getItem', 'flux.transfer.draft.v1')
      .should('equal', saved);
    cy.contains('a', 'Reload page').click();
    cy.contains('h1', 'Your money, in focus.').should('be.visible');
    cy.window()
      .its('sessionStorage')
      .invoke('getItem', 'flux.transfer.draft.v1')
      .should('equal', saved);
  });
});
