const puppeteer = require('puppeteer');
const fs = require('fs').promises; // For file operations

// Define a custom delay function
function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time);
    });
}

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

    let clickedCombinations = [];
    let results = [];
    
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

    async function getItems() {
        return await page.$$eval('.item', items =>
            items.map(item => {
                const textContent = item.textContent.trim();
                const name = textContent.slice(11).trim();
                const emoji = textContent.slice(0, 2).trim();
                return { id: item.id, name, emoji };
            })
        );
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
    
                    if (!clickedCombinations.some(e => e.combinationKey === combinationKey)) {
                        const isClickableA = await isElementClickable(itemA);
                        const isClickableB = await isElementClickable(itemB);

                        if (isClickableA && isClickableB) {
                            const itemsBeforeClick = await getItems();
                            await delay(200);
                            await itemA.click();
                            await delay(200);
                            await itemB.click();
                            await delay(200);
        
                            const newItems = await getItems();
                            const newItemsFiltered = newItems.filter(item => !itemsBeforeClick.some(before => before.id === item.id));
                            let resultItem = newItemsFiltered.length > 0 ? newItemsFiltered[0] : { id: '', name: 'No new item', emoji: '' };
                            clickedCombinations.push({ combinationKey, itemA: itemA.name, itemB: itemB.name, result: resultItem.name + ' ' + resultItem.emoji });
                            newCombinationsFound = true;
                            console.log(`Clicked combination: ${combinationKey}, Result: ${resultItem.name} ${resultItem.emoji}`);
                            if (resultItem.id !== '') {
                                const combinationA = itemsBeforeClick.find(item => item.id === itemIdA);
                                const combinationB = itemsBeforeClick.find(item => item.id === itemIdB);
                                results.push({
                                    combinationA: { name: combinationA.name, emoji: combinationA.emoji },
                                    combinationB: { name: combinationB.name, emoji: combinationB.emoji },
                                    result: { name: resultItem.name, emoji: resultItem.emoji }
                                });
                            }
                        }
                    }
                }
            }
        }
    
        if (newCombinationsFound) {
            await saveResultsToFile();
        }
    }

    async function saveResultsToFile() {
        await fs.writeFile('combinations.json', JSON.stringify(results, null, 2));
        console.log('Results saved to combinations.json');
    }

    async function continuouslyClickNewItems() {
        let attempts = 0;
        let foundNewCombinations;
        do {
            foundNewCombinations = await clickNewItems();
            attempts++;
            console.log(`Attempt ${attempts}`);
        } while (foundNewCombinations);
    }

    await continuouslyClickNewItems();
})();



