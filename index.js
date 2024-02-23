const puppeteer = require('puppeteer');
const fs = require('fs').promises;

function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time);
    });
}

async function loadExistingResults() {
    try {
        const data = await fs.readFile('combinations.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.log('No existing file, starting fresh.');
        return [];
    }
}

async function saveResultsToFile(newResults) {
    let anyUniqueResults = false;
    let existingResults = await loadExistingResults();
    newResults.forEach(newResult => {
        const isUnique = !existingResults.some(existing => 
            existing.combinationA.name === newResult.combinationA.name &&
            existing.combinationB.name === newResult.combinationB.name &&
            existing.result.name === newResult.result.name
        );
        if (isUnique) {
            anyUniqueResults = true;
            existingResults.push(newResult);
            console.log('New unique result added:', newResult);
        }
    });
    if (anyUniqueResults) {
        console.log('Saving new results to combinations.json');
        await fs.writeFile('combinations.json', JSON.stringify(existingResults, null, 2));
        console.log('Results saved/updated to combinations.json');
    } else {
        console.log('No new unique results to save.');
    }
    console.log('Total unique results:', existingResults.length);
}

async function findItemByText(page, text) {
    const items = await page.$$('.item');
    for (const item of items) {
        let itemText = await page.evaluate(el => el.textContent, item);
        if (itemText.includes(text)) {
            const isVisible = await item.evaluate(el => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 && rect.height > 0 &&
                       style.visibility !== 'hidden' && style.display !== 'none';
            });
            if (isVisible) {
                return item;
            }
        }
    }
    return null;
}


async function runOldCombinations(page, delayTimeMS = 200) {
    const combinations = await loadExistingResults();
    for (const combo of combinations) {
        try {
            await delay(delayTimeMS);
            const itemA = await findItemByText(page, combo.combinationA.name);
            const itemB = await findItemByText(page, combo.combinationB.name);

            if (itemA && itemB) {
                await itemA.click();
                await delay(delayTimeMS);
                await itemB.click();
                console.log(`Re-ran combination: ${combo.combinationA.name} + ${combo.combinationB.name} = ${combo.result.name}`);
                await delay(delayTimeMS);
            } else {
                console.log(`Could not find items for combination: ${combo.combinationA.name} + ${combo.combinationB.name}`);
            }
        } catch (error) {
            console.log(`Error finding or clicking items for combination: ${combo.combinationA.name} + ${combo.combinationB.name}`, error);
        }
    }
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

    await runOldCombinations(page, 100);

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

    async function clickNewItems(delayTimeMS = 200) {
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
    
                    if (!clickedCombinations.some(e => e === combinationKey)) {
                        const isClickableA = await isElementClickable(itemA);
                        const isClickableB = await isElementClickable(itemB);

                        if (isClickableA && isClickableB) {
                            const itemsBeforeClick = await getItems();
                            await delay(delayTimeMS);
                            await itemA.click();
                            await delay(delayTimeMS);
                            await itemB.click();
                            await delay(delayTimeMS);
        
                            const newItems = await getItems();
                            const newItemsFiltered = newItems.filter(item => !itemsBeforeClick.some(before => before.id === item.id));
                            let resultItem = newItemsFiltered.length > 0 ? newItemsFiltered[0] : { id: '', name: 'No new item', emoji: '' };
                            clickedCombinations.push(combinationKey);
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
                                await saveResultsToFile(results);
                            }
                        }
                    }
                }
            }
        }
        if (newCombinationsFound) {
            await saveResultsToFile(results);
        }
        return newCombinationsFound;
    }

    async function continuouslyClickNewItems() {
        let foundNewCombinations;
        do {
            foundNewCombinations = await clickNewItems(50);
            console.log(`Attempt: Checking for new combinations...`);
        } while (foundNewCombinations);
        console.log('No more new combinations found.');
    }

    await continuouslyClickNewItems();
})();
