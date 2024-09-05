// tslint:disable:max-line-length
import { AppPage } from './app.po';
import { browser, element, by, ExpectedConditions, $ } from 'protractor';

const width = 1200;
const height = 800;
const showBaseURL = false; // Change to true if you want to show which site you're testing
browser.driver
  .manage()
  .window()
  .setSize(width, height);

describe('Test cdbfly', () => {
  const util = require('util');
  let page: AppPage;

  beforeEach(() => {
    page = new AppPage();
  });

  afterEach(function() {
    browser
      .manage()
      .logs()
      .get('browser')
      .then(function(browserLog) {
        const result = util.inspect(browserLog);
        if (result.length > 2) {
          console.log('log: ' + result);
        }
      });
  });

  describe('Basic Tests', () => {
    it('should have right title', () => {
      page.navigateTo(); // Go to the home page
      const title = browser.getTitle();
      expect(title).toEqual('Cdbfly');
    });

    let firstTable;
    it('First table should be actor', async () => {
      browser.wait(
        ExpectedConditions.presenceOf(
          $('tr.ng-star-inserted:nth-child(1) > td:nth-child(1)')
        ),
        5000,
        'Element taking too long to appear in the DOM'
      );
      firstTable = element(
        by.css('tr.ng-star-inserted:nth-child(1) > td:nth-child(1)')
      );
      expect(firstTable.getText()).toBe('Actor');
    });

    it('get table rows', async () => {
      firstTable.click();
      const firstRowCss =
        '#row-0 > td:nth-child(3)';
      browser.wait(
        ExpectedConditions.presenceOf($(firstRowCss)),
        10000,
        'Element taking too long to appear in the DOM'
      expect(firstRowCss.getText()).toBe('Actor');
    });
  });
});
