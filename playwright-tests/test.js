const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://kosmos.nuvanta-holding.com');
  
  // Example check: Verify the page title or a known element
  if (await page.title() === "Expected Title") {
    console.log('Test passed: Title is correct.');
  } else {
    console.log('Test failed: Title is incorrect.');
  }

  await browser.close();
})();