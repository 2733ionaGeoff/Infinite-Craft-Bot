const puppeteer = require('puppeteer');
const fs = require('fs').promises;

async function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
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

async function saveResultsToFile(results) {
    const oldResults = await loadExistingResults();
    results = [...oldResults, ...results];
    console.log('Saving new results to combinations.json');
    await fs.writeFile('combinations.json', JSON.stringify(results, null, 2));
    console.log('Results saved/updated to combinations.json');
}

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

async function getItems(page) {
    return page.$$eval('.item', items => items.map(item => {
        const textContent = item.textContent.trim();
        const rect = item.getBoundingClientRect();
        const style = window.getComputedStyle(item);
        const isVisible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && !item.disabled;
        return {
            id: item.id,
            name: textContent.slice(11).trim(),
            emoji: textContent.slice(0, 2).trim(),
            isVisible
        };
    }));
}


async function clickNewItems(page, clickedCombinations, delayTimeMS = 200) {
    let newCombinationsFound = false;
    let attempts = 0;
    const maxAttempts = 1000000;
    let results = [];

    while (attempts < maxAttempts) {
        attempts++;
        const items = await page.$$('.item');

        if (items.length < 2) {
            break; 
        }

        let indexA = Math.floor(Math.random() * items.length);
        let indexB;
        do {
            indexB = Math.floor(Math.random() * items.length);
        } while (indexA === indexB);

        const itemA = items[indexA];
        const itemB = items[indexB];

        const itemIdA = await itemA.evaluate(node => node.id);
        const itemIdB = await itemB.evaluate(node => node.id);
        if (itemIdA === itemIdB) {
            continue;
        }
        if (itemIdA === '' || itemIdB === '') {
            continue;
        }
        const combinationKey = `${itemIdA}-${itemIdB}`;
        if (!clickedCombinations.has(combinationKey)) {
            clickedCombinations.add(combinationKey);
            console.log(`Attempt: Clicking combination: ${combinationKey}`);

            const isClickableA = await isElementClickable(itemA);
            const isClickableB = await isElementClickable(itemB);

            if (isClickableA && isClickableB) {
                const itemsBeforeClick = await getItems(page);
                await delay(delayTimeMS);
                await itemA.click();
                await delay(delayTimeMS);
                await itemB.click();
                await delay(delayTimeMS);

                const newItems = await getItems(page);
                const newItemsFiltered = newItems.filter(item => !itemsBeforeClick.some(before => before.id === item.id));

                if (newItemsFiltered.length > 0) {
                    let resultItem = newItemsFiltered[0];
                    newCombinationsFound = true;
                    console.log(`Clicked combination: ${combinationKey}, Result: ${resultItem.name} ${resultItem.emoji}`);

                    results.push({
                        combinationA: { name: itemsBeforeClick.find(item => item.id === itemIdA).name, emoji: itemsBeforeClick.find(item => item.id === itemIdA).emoji },
                        combinationB: { name: itemsBeforeClick.find(item => item.id === itemIdB).name, emoji: itemsBeforeClick.find(item => item.id === itemIdB).emoji },
                        result: { name: resultItem.name, emoji: resultItem.emoji }
                    });
                    await saveResultsToFile(results);
                    console.log(results)
                    results = [];
                }
            }
        }
    }

    if (newCombinationsFound) {
        await saveResultsToFile(results);
    }
    return newCombinationsFound;
}

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://neal.fun/infinite-craft/');

    try {
        await page.waitForSelector('button.fc-cta-consent', { timeout: 500 });
        await page.click('button.fc-cta-consent');
    } catch (error) {
        console.log('No consent button found or error clicking it:', error);
    }

    let clickedCombinations = new Set();

    async function continuouslyClickNewItems() {
        let foundNewCombinations;
        do {
            foundNewCombinations = await clickNewItems(page, clickedCombinations, 10);
            console.log(`Attempt: Checking for new combinations...`);
        } while (foundNewCombinations);
        console.log('No more new combinations found.');
    }

    await continuouslyClickNewItems();
})();
