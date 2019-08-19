import GenericSivParser from "./GenericSivParser.js"

// HtmlSivParser --
export default class HtmlSivParser extends GenericSivParser {
    constructor(storage) {
        // don't overuse constructor, save for initiate function
        super();
        this.storage = storage;
    }

    async getElements (page) {
        const selector = Object.values(this.storage.Config.selectors).join(",");
        return await page.$$eval(selector, elements =>
            elements.map(el => ({
                tagName: el.tagName,
                className: el.className,
                innerText: el.innerText
            }))
        );
    }

    async parseHTMLDate(page) { 
        return await page.evaluate(() => {
            const dateNode = document.querySelector(".hd-date");
            if (dateNode) {
                return dateNode.innerText.replace(/\s/g, '').replace(/\./g, '/');
            }
        });
    }

    async parseHTML(celexDoc, page, date) {
        celexDoc.dateInJournal = date;
        const theElements = await this.getElements(page);
 
        let entry = {
            variety: undefined,
            key: undefined,
            value: undefined,
            rawKey: undefined,
            newVariety: false
        }
        let sivRecord = undefined;
        for(const element of theElements) {
            this.processKeyAndValues(element, entry);
            if (entry.newVariety) {
                entry.variety = this.varietyFromItemText(element.innerText);
                if (entry.variety == undefined) {
                    console.log(`Fatal Error. Unknown variety code: ${element.innerText}`)
                    process.exit();
                }
                // sivRecord will contain all prices, for this variety
                sivRecord = this.storage.registerVariety(entry.variety);
                if (sivRecord == undefined) {
                    console.log(`Fata Error. Can't create`+
                    ` sivRecord ${entry.variety} duplicate suspected`); 
                    process.exit(1);
                }
                // scrape for this variety on subsequent iterations
                entry.newVariety = false;
             
            } else if (entry.value != undefined) {
                // have an entry
                if (entry.key == "MGB") {
                    // Maghreb (MGB) countries
                    this.setEntryInRecord(sivRecord, "Algeria", entry.value);
                    this.setEntryInRecord(sivRecord, "Morocco", entry.value);
                    this.setEntryInRecord(sivRecord, "Tunisia", entry.value);
                }
                else  {
                    this.setEntryInRecord(sivRecord, entry.key, entry.value);
                } 
                entry.rawKey = undefined;                   
                entry.key = undefined;
                entry.value = undefined;
            } else if (entry.rawKey != undefined) {
                // convertKey
                const countryKey = this.storage.findCountry(entry.rawKey);

                if (countryKey == undefined) {
                    console.log(`Fata Error. Unknown country code ${entry.rawKey} ignored`); 
                    process.exit(1);
                } else {
                    entry.key = countryKey;
                }
            } else {
                // no value, no new variety, no new key
                // something wnet wrong
                console.log(`Fatal Error. Unknown cause`); 
                process.exit(1);
            }
        }
        await this.storage.completeParseCelex();
    }

    processKeyAndValues(element, entry) {   
        let txt = GenericSivParser.fixUpTextItem(element.innerText); 
        if("." + element.className == this.storage.Config.selectors.code) {
            // could be the tag for another variety
            // or key for country
            if (GenericSivParser.isKeyText(txt)) {
                entry.rawKey = txt;
            }
            else {
                // must be start of new variety (or error)
                entry.newVariety = true;
                entry.rawKey = undefined; 
                entry.key = undefined;
                entry.value = undefined;
            }
        } else if ("." + element.className == this.storage.Config.selectors.num) {
            entry.value = txt;
        } else if ("." + element.className == this.storage.Config.selectors.txt) {
            if (entry.rawKey == undefined) {
                entry.rawKey = txt; 
            } else {
                entry.value = txt;
            }
        }
    }
}