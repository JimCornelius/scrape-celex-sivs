import GenericSivParser from './GenericSivParser.js';

// HtmlSivParser --
export default class HtmlSivParser extends GenericSivParser {
  constructor(storage) {
    // don't overuse constructor, save for initiate function
    super();
    this.storage = storage;
  }

  async getElements(page) {
    const selector = Object.values(this.storage.Config.selectors.table).join(',');
    return page.$$eval(selector, (elements) => elements.map((el) => ({
      tagName: el.tagName,
      className: el.className,
      innerText: el.innerText,
    })));
  }

  async isCorrection(page) {
    const tags = await this.getDocTitleTags(page);

    return tags.some((el) => (
      (el.innerText.search(/correcting regulation/i) !== -1)
        || el.innerText.search(/amending regulation/i) !== -1));
  }

  async getDocTitleTags(page) {
    const selector = this.storage.Config.selectors.title;
    return page.$$eval(selector, (elements) => elements.map((el) => ({
      tagName: el.tagName,
      className: el.className,
      innerText: el.innerText,
    })));
  }

  static async parseHTMLDate(page) {
    return page.evaluate(() => {
      const dateNode = document.querySelector('.hd-date');
      if (dateNode) {
        return dateNode.innerText.replace(/\s/g, '').replace(/\./g, '/');
      }
      return undefined;
    });
  }

  async parseHTML(celexDoc, page, date) {
    celexDoc.dateInJournal = date;
    if (await this.isCorrection(page)) {
      console.log('This regulation corrects one or more earlier regulations. Needs manual integration.');
    } else {
      const theElements = await this.getElements(page);

      let entry = {
        variety: undefined,
        key: undefined,
        value: undefined,
        rawKey: undefined,
        newVariety: false,
      };
      let sivRecord;

      theElements.forEach((element) => {
        entry = this.processKeyAndValues(element, entry);
        if (entry.newVariety) {
          const txt = GenericSivParser.fixUpTextItem(element.innerText);
          entry.variety = this.varietyFromText(txt);
          if (entry.variety === undefined) {
            if (txt in this.storage.Config.ErrCorrection.transcriptionErrors) {
              entry.variety = this
                .varietyFromText(this.storage.Config.ErrCorrection.transcriptionErrors[txt]);
            } else {
              console.log(`Fatal Error. Unknown variety code: ${element.innerText}`);
              process.exit();
            }
          }

          // sivRecord will contain all prices, for this variety
          sivRecord = this.storage.registerVariety(entry.variety);
          if (sivRecord === undefined) {
            console.log(`Fatal Error. Can't create sivRecord ${entry.variety} duplicate suspected`);
            process.exit(1);
          }
          // scrape for this variety on subsequent iterations
          entry.newVariety = false;
        } else if (entry.value !== undefined) {
        // have an entry
          this.setEntryInRecord(sivRecord, entry.key, entry.value);
          entry.rawKey = undefined;
          entry.key = undefined;
          entry.value = undefined;
        } else if (entry.rawKey !== undefined) {
        // convertKey
          const country = this.storage.findCountry(entry.rawKey);
          if (country === undefined) {
            console.log(`Fatal Error. Unknown country code ${entry.rawKey} ignored`);
            process.exit(1);
          } else {
            if (entry.variety === undefined) {
              console.log(`Fatal Error. Country ${entry.rawKey}, before variety known.`);
              process.exit(1);
            }
            if ([country].flat().some((i) => sivRecord.hasOwnProperty(i))) {
              console.log(`Fatal Error.  for ${entry.variety} : ${country}`);
              process.exit(1);
            }
            entry.key = country;
          }
        } else {
        // no value, no new variety, no new key
        // something wnet wrong
          console.log('Fatal Error. Unknown cause');
          process.exit(1);
        }
      });
      await this.storage.completeParseCelex();
    }
  }

  processKeyAndValues(element, entryIn) {
    const entryOut = entryIn;
    const txt = GenericSivParser.fixUpTextItem(element.innerText);
    if (`.${element.className}` === this.storage.Config.selectors.table.code) {
      // could be the tag for another variety
      // or key for country
      if (GenericSivParser.isKeyText(txt)) {
        entryOut.rawKey = txt;
      } else {
        // must be start of new variety (or error)
        entryOut.newVariety = true;
        entryOut.rawKey = undefined;
        entryOut.key = undefined;
        entryOut.value = undefined;
      }
    } else if (`.${element.className}` === this.storage.Config.selectors.table.num) {
      entryOut.value = txt;
    } else if (`.${element.className}` === this.storage.Config.selectors.table.txt) {
      if (entryOut.rawKey === undefined) {
        entryOut.rawKey = txt;
      } else {
        entryOut.value = txt;
      }
    }
    return entryOut;
  }
}
