import { browser, by, element } from 'protractor';
const fs = require('fs');
let screenShotId = 0;

export class AppPage {
  navigateTo() {
    return browser.get(browser.baseUrl) as Promise<any>;
  }

  getTitleText() {
    return element(by.css('.mat-h1')).getText() as Promise<string>;
  }

  async saveScreenShot(filename) {
    return new Promise(resolve => {
      screenShotId++; // Increment the screenshot id so we have them by order
      const file = `${screenShotId}-${filename}.png`;
      const stream = fs.createWriteStream(file);
      browser.takeScreenshot().then(function(data) {
        stream.write(Buffer.from(data, 'base64'));
        stream.end();
        resolve();
      });
    });
  }
}
