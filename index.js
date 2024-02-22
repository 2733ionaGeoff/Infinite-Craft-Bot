const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    console.log('Browser opened');
    const page = await browser.newPage();
    console.log('New page created');
    await page.goto('https://neal.fun/infinite-craft/');
    console.log('Page loaded');

    try {
        await page.waitForSelector('button.fc-cta-consent', { timeout: 500 });
        await page.click('button.fc-cta-consent');
    } catch (error) {
        console.log('No consent button found or error clicking it:', error);
    }

    let clickedCombinations = {};

    async function isElementClickable(item) {
        const isClickable = await item.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return (
                rect.width > 0 &&
                rect.height > 0 &&
                window.getComputedStyle(el).visibility !== 'hidden' &&
                !el.disabled
            );
        });
        return isClickable;
    }

    async function clickNewItems() {
        const items = await page.$$('.item');
        let newCombinationsFound = false;

        for (let i = 0; i < items.length; i++) {
            const itemA = items[i];
            const itemIdA = await itemA.evaluate(node => node.id);

            for (let j = 0; j < items.length; j++) {
                if (i !== j) {
                    const itemB = items[j];
                    const itemIdB = await itemB.evaluate(node => node.id);
                    const combinationKey = `${itemIdA}-${itemIdB}`;

                    if (!clickedCombinations[combinationKey]) {
                        const isClickableA = await isElementClickable(itemA);
                        const isClickableB = await isElementClickable(itemB);

                        if (isClickableA && isClickableB) {
                            await page.waitForTimeout(50); // Delay before clicking itemA
                            await itemA.click();
                            await page.waitForTimeout(50); // Delay before clicking itemB
                            await itemB.click();
                            clickedCombinations[combinationKey] = true;
                            newCombinationsFound = true;
                            console.log(`Clicked combination: ${combinationKey}`);
                        }
                    }
                }
            }
        }

        return newCombinationsFound;
    }

    async function continuouslyClickNewItems() {
        while (true) {
            const foundNewCombinations = await clickNewItems();
            if (!foundNewCombinations) {
                console.log('No new combinations found. Continuing to try...');
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    continuouslyClickNewItems();
})();
