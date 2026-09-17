const API = 'http://localhost:3201';
const field = (label) =>
  typeof label === 'string' && /\([A-Z]{3}\)$/.test(label)
    ? cy.get(`input[aria-label="${label}"]`)
    : cy
        .contains('label', label)
        .invoke('attr', 'for')
        .then((id) => cy.get(`[id="${id}"]`));
const button = (name) => cy.contains('button', name);
const visit = (path) => {
  cy.visit(path);
  cy.get('h1').should('be.visible');
};
function transferAmount(value = '10') {
  visit('/payments/send?again=1');
  field('Search recipients').type('Sara');
  button(/Sara Nasser/).click();
  field('Recipient receives in').select('USD');
  field('Recipient receives (USD)').clear().type(value);
  field('Note (optional)').type('CYPRESS-TRANSFER');
  button(/^Get quote$/).click();
  button(/^Confirm transfer$/).should('be.visible');
}
function simulate() {
  visit('/demo/card-payments');
  field(/^Card$/).select('card-physical');
  field('Purchase amount (USD)').clear().type('2.00');
  cy.intercept('POST', API + '/card-payments/authorize').as('authorize');
  button(/^Run simulated payment$/).click();
  return cy.wait('@authorize').its('response.body');
}

describe('production journeys', () => {
  afterEach(() => {
    cy.task('financialIntegrity').should('deep.equal', { unbalanced: [], mismatch: [] });
  });

  it('1 — enters the demo and loads Home', () => {
    visit('/login');
    cy.contains('a', 'Try Demo').click();
    cy.location('pathname').should('equal', '/home');
    cy.contains('h1', 'Your money, in focus.').should('be.visible');
    cy.get('.balance-value').should('be.visible');
  });

  it('2 — opens an account, searches and filters activity, then persists a category change', () => {
    visit('/accounts');
    cy.get('a[href="/accounts/usd"]').first().click();
    cy.get('.transaction-row').should('have.length.greaterThan', 0);
    visit('/transactions');
    field('Search transactions').type('Roadster', { delay: 0 }).should('have.value', 'Roadster');
    field(/^Account$/).select('usd');
    field(/^Category$/).select('dining');
    cy.get('.transaction-row').first().click();
    field('Transaction category').select('other');
    button(/^Save category$/).click();
    button(/^Save category$/).should('be.disabled');
    cy.reload();
    field('Transaction category').should('have.value', 'other');
    cy.contains('a', 'Back to activity').click();
    cy.location('search').should('include', 'search=Roadster').and('include', 'category=dining');
  });

  it('3 — confirms once under a double click, with exact balance and history changes', () => {
    cy.task('accountState', 'usd').as('before');
    transferAmount();
    cy.intercept('POST', API + '/transfers').as('execute');
    button(/^Confirm transfer$/).then(($button) => {
      $button[0].click();
      $button[0].click();
    });
    cy.wait('@execute').its('response.body').as('transfer');
    cy.contains('h2', 'Money sent').should('be.visible');
    cy.get('@execute.all').should('have.length', 1);
    cy.get('@transfer').then((transfer) => {
      expect(transfer.status).to.equal('COMPLETED');
      cy.get('@before').then((before) =>
        cy
          .task('accountState', 'usd')
          .its('balanceMinor')
          .should('equal', before.balanceMinor - transfer.totalDebitMinor),
      );
      visit('/transactions?search=' + transfer.reference);
      cy.get('.transaction-row').should('have.length', 1).click();
      cy.contains('a', 'View transfer').click();
      cy.contains(transfer.reference).should('be.visible');
    });
  });

  it('4 — explains insufficient funds and prevents confirmation', () => {
    cy.task('accountState', 'usd').as('before');
    transferAmount('1000000');
    cy.get('[role="alert"]').should('contain.text', 'You need');
    button(/^Confirm transfer$/).should('be.disabled');
    cy.get('@before').then((before) => cy.task('accountState', 'usd').should('deep.equal', before));
  });

  it('5 — freezes a card, declines a payment, then unfreezes and completes it', () => {
    visit('/cards/card-physical');
    button(/^Freeze$/).click();
    button(/^Unfreeze$/).should('be.visible');
    simulate().its('declineReason').should('equal', 'CARD_FROZEN');
    cy.contains('h2', 'Payment declined').should('be.visible');
    visit('/cards/card-physical');
    button(/^Unfreeze$/).click();
    button(/^Freeze$/).should('be.visible');
    simulate().its('status').should('equal', 'COMPLETED');
    cy.contains('h2', 'Payment completed').should('be.visible');
  });

  it('6 — enforces an edited spending limit', () => {
    visit('/cards/card-physical');
    button(/^Edit limit$/).click();
    field('Monthly limit (USD)').clear().type('1.00');
    button(/^Save limit$/).click();
    cy.get('[role="dialog"]').should('not.exist');
    simulate().its('declineReason').should('equal', 'SPENDING_LIMIT_EXCEEDED');
    cy.contains('h2', 'Payment declined').should('be.visible');
  });

  it('7 — creates and edits a budget and reconciles actual category usage', () => {
    visit('/budgets');
    button(/^Create budget$/).click();
    field(/^Category$/).select('entertainment');
    field('Monthly target (USD)').type('100.00');
    button(/^Save budget$/).click();
    cy.get('[role="dialog"]').should('not.exist');
    cy.get('button[aria-label="Edit Entertainment budget"]').click();
    field('Monthly target (USD)').clear().type('125.00');
    button(/^Save budget$/).click();
    cy.get('[role="dialog"]').should('not.exist');
    cy.reload();
    cy.get('button[aria-label="Edit Entertainment budget"]').should('be.visible');
    cy.request(API + '/budgets')
      .its('body.items')
      .then((items) => {
        const budget = items.find((item) => item.category === 'entertainment');
        expect(budget.amountMinor).to.equal(12500);
        cy.request(API + '/analytics/summary?period=month&baseCurrency=USD&category=entertainment')
          .its('body')
          .then((report) => {
            expect(budget.spentMinor).to.equal(report.spendingMinor);
          });
      });
  });

  it('8 — changes Analytics period and follows category activity to its source', () => {
    visit('/analytics');
    cy.intercept('GET', API + '/analytics/summary*').as('report');
    button(/^3 months$/).click();
    cy.wait('@report');
    button(/^3 months$/).should('have.attr', 'aria-pressed', 'true');
    cy.contains('.insight-categories a', 'Dining').click();
    cy.contains('h1', /^Dining$/).should('be.visible');
    cy.get('.insight-transactions a').first().click();
    cy.contains('h1', 'Transaction details').should('be.visible');
    cy.contains('a', 'Back to activity').click();
    cy.location('pathname').should('equal', '/analytics/categories/dining');
    cy.location('search').should('include', 'period=quarter');
  });

  it('9 — opens a subscription and verifies its original payment history', () => {
    visit('/subscriptions');
    cy.get('a[href^="/subscriptions/subscription-spotify"]').first().click();
    cy.contains('h1', 'Spotify').should('be.visible');
    cy.get('a[href^="/transactions/"]').first().click();
    cy.contains('h1', 'Transaction details').should('be.visible');
    cy.contains('h2', 'Spotify').should('be.visible');
  });

  it('recovers a committed transfer after response loss, refresh and quote expiry', () => {
    cy.task('accountState', 'usd').as('before');
    transferAmount('3');
    let original;
    cy.intercept({ method: 'POST', url: API + '/transfers', times: 1 }, (request) => {
      original = { key: request.headers['idempotency-key'], body: request.body };
      request.continue((response) => {
        response.send({ statusCode: 502, body: { message: 'Response lost after commit' } });
      });
    }).as('lost');
    button(/^Confirm transfer$/).click();
    cy.wait('@lost');
    button(/^Retry safely$/).should('be.visible');
    cy.then(() => cy.task('transferByKey', original.key))
      .should('have.length', 1)
      .as('committed');
    cy.then(() => cy.task('expireQuote', original.body.quoteId));
    cy.reload();
    cy.intercept('POST', API + '/transfers').as('retry');
    button(/^Retry safely$/).click();
    cy.wait('@retry').then(({ request, response }) => {
      expect(request.headers['idempotency-key']).to.equal(original.key);
      expect(request.body).to.deep.equal(original.body);
      cy.get('@committed').then(([transfer]) => expect(response.body.id).to.equal(transfer.id));
    });
    cy.contains('h2', 'Money sent').should('be.visible');
    cy.then(() => cy.task('transferByKey', original.key)).should('have.length', 1);
    cy.get('@committed').then(([transfer]) =>
      cy.get('@before').then((before) =>
        cy
          .task('accountState', 'usd')
          .its('balanceMinor')
          .should('equal', before.balanceMinor - transfer.totalDebitMinor),
      ),
    );
  });
});
