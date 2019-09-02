import EventEmitter from 'events';
import GenericSivParser from './GenericSivParser.js';
import BrowserContext from './BrowserContext.js';

// GenericSivParser --
export default class PdfSivParser extends GenericSivParser {
  constructor(storage) {
    // don't overuse constructor, save for initiate function
    super();
    this.emitter = new EventEmitter();
    this.storage = storage;
  }

  async exposeHelperFuncs(page) {
    // expose function the can be called in the browser context
    const onDocEvent = this.onDocEvent.bind(this);
    await page.exposeFunction('onDocEvent', onDocEvent);

    const { doConsoleLog } = PdfSivParser;
    await page.exposeFunction('doConsoleLog', doConsoleLog);
  }

  static doConsoleLog(val) {
    console.log(val);
  }

  onDocEvent(event, val) {
    this.onDocEventAsync(event, val);
  }

  async onDocEventAsync(event, val) {
    if (event === 'pagecount') {
      // this is a custom event, created when the callback of the
      // loadingTask.promise is called.
      //
      // On a large document there will pages where the text layer is not loaded into the DOM.
      // A <loadingIcon> element will exist in place of the span tags
      // As each loadingIcon is scrolled into view pdfJSLibe populates the textLayer.
      // We can then extract the tags to allow the page to be parsed.
      //
      // Scrolling a page out of view will remove the spans in the textlayer,
      // so the tags must be capturesd wthile the page is in view.
      // The container holds 2 pages at any one time on a normal scaled view.
      //
      // Only scroll new Pages into view after current text layer tags are captured

      this.pageTags = new Array(val).fill(null);
    } else if (event === 'textlayerrendered') {
      // text layer for page X is now in the DOM and can be parsed
      // capture the span tags in the current page
      this.pageTags[val - 1] = await this.getPageSpanElements(val);

      // find the next unrendered page and scroll it into view
      const nextPage = 1 + this.pageTags.indexOf(null);

      // keep at it while there are pages yet to render
      if (nextPage) {
        await this.page.evaluate(BrowserContext.scrollPageIntoView, nextPage);
      } else {
        // All pages rendered, we can now parse the whole PDF
        // emit a message to pass control back to func parsePdf awaiting
        this.emitter.emit('readyToParse');
      }
    }
  }

  bunchNeighbours(orderedElements) {
    const elements = [];
    if (orderedElements) {
      // bunch up items that are within a space of each other
      let previous;

      // arbitrary but good enough
      const smallGap = 1.2; //
      const biggerGap = 7.2; // this should be good enough for our needs

      orderedElements.forEach((el) => {
        if (!(el.innerText in this.storage.Config.filterOut)) {
          if (previous
                && (el.left > (previous.right - smallGap))
                && (el.left < (previous.right + smallGap))
                && (el.top < ((previous.top + previous.bottom) / 2))
                && (el.bottom > ((previous.top + previous.bottom) / 2))
          ) {
            elements[elements.length - 1].innerText += el.innerText;
            elements[elements.length - 1].right = el.right;
          } else if (previous
                && (el.left > (previous.right - biggerGap))
                && (el.left < (previous.right + biggerGap))
                && (el.top < ((previous.top + previous.bottom) / 2))
                && (el.bottom > ((previous.top + previous.bottom) / 2))
          ) {
            elements[elements.length - 1].innerText += (` ${el.innerText}`);
            elements[elements.length - 1].right = el.right;
          } else {
            elements.push({
              innerText: el.innerText,
              top: el.top,
              left: el.left,
              bottom: el.bottom,
              right: el.right,
            });
          }
          previous = el;
        }
      });
    }
    return elements;
  }

  static fixTranscriptionErrs(elements) {
    if (elements) {
      const columnHeaders = [];
      // known OCR transcription errors
      elements.forEach((el) => {
        const txt = el.innerText
          .replace('\'ECU', '(ECU')
          .replace(/[^\w(/)]|_+/g, '')
          .replace('WO', '100')
          .replace('f', '(')
          .replace('FC11', 'ECU')
          .replace('100kg', '100kg)')
          .replace('))', ')');

        if (txt === '(ECU/100kg)' || txt === '(EUR/100kg)') {
          el.innerText = txt;
          columnHeaders.push(el);
        }
      });

      if (columnHeaders.length > 0 && columnHeaders.length % 2 === 0) {
        return undefined;
        // PdfSivParser.deColumnise(elements, columnHeaders);
      }
    }

    return elements;
  }

  static deColumnise(elements) {
    // TDB
    return elements;
  }

  static rationaliseOrder(elements) {
    const items = [];

    elements.forEach((el) => {
      let insert = false;
      if (items.length) {
        for (let i = 0; i < items.length; i += 1) {
          const item = items[i];
          if (
            // close to same line
            (item.top > (el.top - 4))
            && (item.top < (el.top + 4))
          ) {
            if (el.left < item.left) {
              insert = true;
              break;
            }
          } else if (el.top < item.top) {
            insert = true;
          }
          if (insert) {
            items.splice(i, 0, el);
            break;
          }
        // in all other circumstances el is after item, so check next item
        }
      }
      if (!insert) {
        items.push(el);
      }
    });
    return items;
  }

  async getPageSpanElements(pageNumber) {
    const selector = `.page[data-page-number="${pageNumber}"] > .textLayer > span`;
    const elements = await this.page.$$eval(selector, (e) => e.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tagName: el.tagName,
        className: el.className,
        innerText: el.innerText,
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
      };
    }));
    return elements;
  }

  async parsePdf(celexDoc, page) {
    this.celexDoc = celexDoc;
    this.page = page;

    // inject pdfViewerTags etc
    await page.evaluate(BrowserContext.injectPdfViewer);

    // inject some code into the webpage to help us out with PDFs
    await page.addStyleTag({ url: 'https://unpkg.com/pdfjs-dist@2.2.228/web//pdf_viewer.css' });
    await page.addScriptTag({ url: 'https://unpkg.com/pdfjs-dist@2.2.228/build/pdf.js' });
    await page.waitForFunction('pdfjsLib != undefined');

    await page.addScriptTag({ url: 'https://unpkg.com/pdfjs-dist@2.2.228/web/pdf_viewer.js' });
    await page.waitForFunction('pdfjsViewer != undefined');

    // calls loadPdfDoc in the browser context
    await page.evaluate(
      BrowserContext.loadPdfDoc,
      this.storage.Config.eurlex.pdfRoot + celexDoc.celexID,
      this.storage.Config.pdfjs.workerSrc,
    );
    // browser has control until ready to parse
    await this.readyToParse();
    // wait for parsing to complete and we're done for this page
    await this.parsePdfTags(this.collectElements());
    this.emitter.removeAllListeners();
  }

  async readyToParse() {
    await new Promise((resolve) => {
      this.emitter.on('readyToParse', resolve);
    });
  }

  collectElements() {
    // rearrange (potentially) the tags on each page so that they are correctly ordered
    // bunch up into words and phrases,
    // sort out columns so we can parse consistently
    let allElements = [];
    // eed early break, use foEach once sorted
    // eslint-disable-next-line no-restricted-syntax
    for (const pageElements of this.pageTags) {
      const orderedElements = PdfSivParser.rationaliseOrder(pageElements);
      const elements = this.bunchNeighbours(orderedElements);
      const fixedElements = PdfSivParser.fixTranscriptionErrs(elements);
      if (fixedElements === undefined) {
        console.log('Parsing columns not yet supported');
        return undefined;
      }
      allElements = allElements.concat(fixedElements);
    }
    return allElements;
  }

  async parsePdfTags(elements) {
    if (elements !== undefined) {
      try {
        const largeGap = 20;
        let date;
        let lookingForVariety = true;
        let sivRecord;
        let country;
        let topFound = false;
        let partialVariety = '';
        let lastItem;
        let currentVariety;

        elements.forEach((item) => {
          if (
            lastItem
          && ((lastItem.right + largeGap) < item.left)
          ) {
            partialVariety = '';
          }
          const txt = GenericSivParser.fixUpTextItem(item.innerText);
          const posVariety = partialVariety + txt;

          if (!date) {
            // ignore everything till we have the date
            date = PdfSivParser.checkForPdfDate(txt);
          } else if (!topFound) {
            // ignore everything till we're at the top of the SIV list
            topFound = (txt.localeCompare('CNcode', undefined, { sensitivity: 'base' }) === 0);
          } else if (country
                    && sivRecord
                    && sivRecord.value === undefined
                    && !(Number.isNaN(Number(txt)))) {
            this.setEntryInRecord(sivRecord, country, txt);
            lookingForVariety = true;
            country = undefined;
          } else {
            if (sivRecord && country === undefined) {
              // will always be looking for the variety as well
              country = this.storage.findCountry(posVariety);
              if (country) {
                partialVariety = '';
                if ([country].flat().some((i) => sivRecord.hasOwnProperty(i))) {
                  if (!(this.celexDoc.celexID in this.storage.Config.knownDuplicateCountry)) {
                    console.log(`Fatal error. Already have an entry for ${currentVariety} : ${country}`);
                    process.exit(1);
                  }
                }
              }
            }
            if (lookingForVariety && !country) {
              let variety = this.varietyFromText(txt) || this.varietyFromText(posVariety);
              const trimmedPosVariety = GenericSivParser.trimVarietyCode(posVariety);
              if (variety) {
                partialVariety = '';
                if (this.storage.Config.selectedVarieties.includes(variety)) {
                  // new variety, register it
                  sivRecord = this.storage.registerVariety(variety);
                  if (sivRecord === undefined) {
                    if (this.celexDoc.celexID in this.storage.Config.multiVarietyDefs) {
                      sivRecord = this.storage.getVarietySiv(variety);
                    } else {
                      console.log(`Fatal Error. Can't create sivRecord ${variety} duplicate suspected`);
                      process.exit(1);
                    }
                  }
                  currentVariety = variety;
                  lookingForVariety = false;
                  country = undefined;
                }
              } else if ((posVariety) in this.storage.Config.transcriptionErrors) {
                variety = this
                  .varietyFromText(this.storage.Config.transcriptionErrors[posVariety]);
                partialVariety = '';
                if (this.storage.Config.selectedVarieties.includes(variety)) {
                  sivRecord = this.storage.registerVariety(variety);
                  lookingForVariety = false;
                  country = undefined;
                }
              } else if (posVariety in this.storage.Config.ignoreVariertyDefinition) {
                partialVariety = '';
              } else if (PdfSivParser.checkForPdfDate(txt)) {
                // ignore, it's just a date
              } else if (trimmedPosVariety.length && Object.values(this.storage.CNs).flat()
                .some((i) => i.includes(trimmedPosVariety))) {
                partialVariety = trimmedPosVariety;
              } else if ((posVariety.length > 3) && (/^[. 0-9]*$/.test(posVariety))) {
                console.log(`Fatal error: Looking for variety; ${posVariety} does not match any known varieties`);
                process.exit(1);
              }
            }
          }

          lastItem = item;
        });

        if (!date) {
        // fatal error unable to confirm the date for this CELEX
          console.log('Fatal error: can\'t confirm date of PDF');
          process.exit(1);
        }
      } catch (err) {
        console.log(`Caught exception${err.stack}`);
        process.exit(1);
      }
      await this.storage.completeParseCelex();
    }
  }

  static checkForPdfDate(txt) {
    // look for date in format XX.XX.XXXX; X.XX.XXXX; XX.X.XXXX
    const trio = txt.split('.').map((d) => d.trim());
    if (trio.length !== 3) return undefined;
    if (trio.some((a) => Number.isNaN(a))) return undefined;
    if (trio.some((a) => (a === 0))) return undefined;
    if (
      trio[0] > 31 || trio[1] > 12 || (
        (trio[2] < 57)
                || (trio[2] > 99 && trio[2] < 1957)
      )
    ) return undefined;
    return trio.join('/');
  }
}
