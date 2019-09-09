import GenericSivParser from './GenericSivParser.js';
import BrowserContext from './BrowserContext.js';

// GenericSivParser --
export default class PdfSivParser extends GenericSivParser {
  constructor(storage) {
    // don't overuse constructor, save for initiate function
    super();
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
        this.storage.emitter.emit('readyToParse');
      }
    }
  }

  bunchNeighbours(orderedElements) {
    const elements = [];
    if (orderedElements) {
      // bunch up items that are within a space of each other
      let previous;

      // arbitrary but good enough for our needs
      const smallGap = 1.2; //
      const overlap = -2.5;
      const biggerGap = 17;
      const rowSize = 10;

      orderedElements.forEach((el) => {
        if (!(el.innerText in this.storage.Config.filterOut)) {
          if (elements.length) {
            previous = elements[elements.length - 1];
          }
          if (previous
            && ((el.left - previous.right) > overlap)
            && (el.left - previous.right) < smallGap
            && Math.abs(el.bottom - previous.bottom) < rowSize
          ) {
            // merge as one element without a space
            previous.innerText += el.innerText;
            previous.right = (previous.right + el.right) / 2;
          } else if (previous
            && ((el.left - previous.right) > overlap)
            && (el.left - previous.right) < biggerGap
            && Math.abs(el.bottom - previous.bottom) < rowSize
          ) {
            // merge as one element with a space
            previous.innerText += (` ${el.innerText}`);
            previous.right = (previous.right + el.right) / 2;
          } else {
            elements.push({
              innerText: el.innerText,
              top: el.top,
              left: el.left,
              bottom: el.bottom,
              right: el.right,
            });
          }
        }
      });
    }
    return elements;
  }

  static fixTranscriptionErr(element) {
    return element.innerText
      .replace('\'ECU', '(ECU')
      .replace(/[^\w(/)]|_+/g, '')
      .replace('WO', '100')
      .replace('f', '(')
      .replace('FC11', 'ECU')
      .replace('100kg', '100kg)')
      .replace('))', ')');
  }

  repairText(elements) {
    // correctd in-place
    let correctedElements = elements;
    const columnHeaders = [];

    // known OCR transcription issues
    elements.every((el, i) => {
      if (this.celexDoc.celexID === '31996R0378' && el.innerText === '528') {
        if (i > 0 && elements[i - 1].innerText === '29,5') {
          el.innerText = '728';
        }
      }

      if (this.celexDoc.celexID === '31996R0655' && el.innerText === 'CN') {
        el.innerText = 'CNcode';
      }

      if (this.celexDoc.celexID === '31996R0397' && el.innerText === '1') {
        if (i > 0 && elements[i - 1].innerText === '999') {
          el.innerText = 'Ignore me';
        }
      }

      if (this.celexDoc.celexID === '31996R0066' && el.innerText === '1') {
        if (i > 0 && elements[i - 1].innerText === '20 15 ,') {
          el.innerText = 'Ignore me';
        }
      }

      const txt = PdfSivParser.fixTranscriptionErr(el);

      if (txt === '(ECU/100kg)' || txt === '(EUR/100kg)') {
        el.innerText = txt;
        columnHeaders.push(el);
      }
      if (
        (txt.search(/correcting/i) !== -1)
        || txt.search(/amending/i) !== -1) {
        // early exit
        correctedElements = undefined;
        console.log('This regulation corrects one or more earlier regulations. Needs manual integration.');
        return false;
      }
      return true;
    });
    if (columnHeaders.length > 0 && columnHeaders.length % 2 === 0) {
      correctedElements = PdfSivParser.deColumnise(correctedElements, columnHeaders);
    }
    return correctedElements;
  }

  static deColumnise(elementsIN, columnHeaders) {
    // columnHeaders will always be pairs.
    const elementsLeft = [];
    const elementsRight = [];
    const headerLeft = columnHeaders.shift();
    const headerRight = columnHeaders.shift();

    if (columnHeaders.length) {
      this.doConsoleLog.log('Fatal error: unexpected column headers.');
      process.exit(1);
    }
    if (headerLeft && headerRight) {
      elementsIN.forEach((el) => {
        // if element is above the column headers just stick it in the left
        if (el.bottom < headerLeft.bottom && el.bottom < headerRight.bottom) {
          elementsLeft.push(el);
        } else if (el.left > headerLeft.right) {
          elementsRight.push(el);
        } else {
          elementsLeft.push(el);
        }
      });
    }

    // needs to be repeated per column
    const orderedElementsLeft = PdfSivParser.rationaliseOrder(elementsLeft);
    const orderedElementsRight = PdfSivParser.rationaliseOrder(elementsRight);

    return orderedElementsLeft.concat(orderedElementsRight);
  }

  static rationaliseOrder(elements) {
    const wiggleRoom = 7.4;
    const items = [];

    elements.forEach((el) => {
      let insert = false;

      if (items.length) {
        for (let i = 0; i < items.length; i += 1) {
          const item = items[i];
          if (Math.abs(item.bottom - el.bottom) < wiggleRoom) {
            // close to same line
            if (el.left < item.left) {
              insert = true;
            }
          } else if (el.bottom < item.bottom) {
            insert = true;
          }
          if (insert) {
            items.splice(i, 0, el);
            break;
          }
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
    this.storage.emitter.removeAllListeners();
  }

  async readyToParse() {
    await new Promise((resolve) => {
      this.storage.emitter.on('readyToParse', resolve);
    });
  }

  collectElements() {
    // rearrange (potentially) the tags on each page
    // so that they are correctly ordered
    // bunch up into words and phrases,
    // sort out columns so we can parse consistently
    let allElements = [];
    for (const pageElements of this.pageTags) {
      const orderedElements = PdfSivParser.rationaliseOrder(pageElements);
      const elements = this.bunchNeighbours(orderedElements);
      const fixedElements = this.repairText(elements);
      if (fixedElements === undefined) {
        console.log('File is correcting earlier regulation');
        return undefined;
      }
      allElements = allElements.concat(fixedElements);
    }
    return allElements;
  }

  parseElement(item) {
    const txt = GenericSivParser.fixUpTextItem(item.innerText);
    const possibleKey = this.partialVariety + txt;

    if (!this.state.date) {
      // ignore everything till we have the date
      this.state.date = PdfSivParser.checkForPdfDate(txt);
    } else if (!this.state.topFound) {
      // ignore everything till we're at the top of the SIV list
      this.state.topFound = (txt.search(/cncode/i) !== -1);
    } else if (this.state.country
                && this.state.sivRecord
                && this.state.sivRecord.value === undefined
                && !(Number.isNaN(Number(txt)))) {
      this.setEntryInRecord(this.state.sivRecord, this.state.country, txt);
      this.state.lookingForVariety = true;
      this.state.country = undefined;
    } else {
      this.interpretKeys(possibleKey, txt);
    }
  }

  interpretKeys(possibleKey, txt) {
    if (this.state.sivRecord && this.state.country === undefined) {
      this.state.country = this.storage.findCountry(this.state.possibleKey);
      if (this.state.country) {
        this.state.partialVariety = '';
        if ([this.state.country].flat().some((i) => this.state.sivRecord.hasOwnProperty(i))) {
          if (!(this.celexDoc.celexID in this.storage.Config.knownDuplicateCountry)) {
            console.log(`Fatal error. Already have an entry for ${this.state.currentVariety} : ${this.state.country}`);
            process.exit(1);
          }
        }
      }
    }
    if (this.state.lookingForVariety && !this.state.country) {
      this.lookForVariety(possibleKey, txt);
    }
  }

  updateVariety(variety) {
    this.state.partialVariety = '';
    if (this.storage.Config.selectedVarieties.includes(variety)) {
      // new variety, register it
      this.state.sivRecord = this.storage.registerVariety(variety);
      if (this.state.sivRecord === undefined) {
        if (this.celexDoc.celexID in this.storage.Config.multiVarietyDefs) {
          this.state.sivRecord = this.storage.getVarietySiv(variety);
        } else {
          console.log(`Fatal Error. Can't create sivRecord ${variety} duplicate suspected`);
          process.exit(1);
        }
      }
      this.state.currentVariety = variety;
      this.state.lookingForVariety = false;
      this.state.country = undefined;
    }
  }

  lookForVariety(possibleKey, txt) {
    let variety = this.varietyFromText(txt) || this.varietyFromText(possibleKey);
    const trimmedV = GenericSivParser.trimVarietyCode(possibleKey);
    if (variety) {
      this.updateVariety(variety);
    } else if ((possibleKey) in this.storage.Config.transcriptionErrors) {
      variety = this.varietyFromText(this.storage.Config.transcriptionErrors[possibleKey]);
      if (variety) {
        if (this.storage.Config.selectedVarieties.includes(variety)) {
          this.state.sivRecord = this.storage.registerVariety(variety);
          this.state.lookingForVariety = false;
          this.state.country = undefined;
        }
        this.state.partialVariety = '';
      } else {
        this.state.partialVariety = possibleKey;
      }
    } else if (PdfSivParser.checkForPdfDate(txt)) {
      // ignore, it's just a date
    } else if (trimmedV.length && Object.values(this.storage.CNs).flat()
      .some((i) => i.startsWith(trimmedV))) {
      this.state.partialVariety = trimmedV;
    } else if ((possibleKey.length > 3) && (/^[. 0-9]*$/.test(possibleKey))) {
      console.log(`Fatal error: Looking for variety; ${possibleKey} does not match any known varieties`);
      process.exit(1);
    }
  }

  async parsePdfTags(elements) {
    if (elements !== undefined) {
      try {
        this.state = {
          lookingForVariety: true,
          topFound: false,
          partialVariety: '',
        };
        elements.forEach(this.parseElement, this);
        if (!this.state.date) {
          // fatal error unable to confirm the date for this CELEX
          console.log('Fatal error: can\'t confirm date of PDF');
          process.exit(1);
        }
        if (!this.state.topFound) {
          // fatal error unable to confirm any SIV table
          console.log('Fatal error: can\'t find top of table');
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
    const trio = txt.split('.').map((d) => Number(d.trim()));
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
