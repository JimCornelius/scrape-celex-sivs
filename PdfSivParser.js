/* global pdfjsLib, pdfjsViewer */

import EventEmitter from 'events';
import GenericSivParser from './GenericSivParser.js';


// GenericSivParser --
export default class PdfSivParser extends GenericSivParser {
  constructor(storage) {
    // don't overuse constructor, save for initiate function
    super();
    this.emitter = new EventEmitter();
    this.storage = storage;
  }

  async exposeFunc(page) {
    // expose a function the can be called in the browser context
    const boundFunc = this.exposedFunc.bind(this);
    await page.exposeFunction('exposedFunc', boundFunc);
  }

  async exposedFunc(event, val) {
    if (event === 'pagecount') {
      this.unrendered = [...Array(val).keys()].map((x) => x + 1);
    } else if (event === 'textlayerrendered') {
      // text layer for page X is now in the DOM and can be parsed
      this.unrendered = this.unrendered.filter((i) => i !== val);
      if (this.unrendered.length === 0) {
        // now we can actually parse the PDF
        await this.parsePdfTags();
        this.emitter.emit('done');
      }
    }
  }

  static loadPdfDoc(url, workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

    const pdfViewer = new pdfjsViewer.PDFViewer({
      container: document.getElementById('viewerContainer'),
      textLayerFactory: new pdfjsViewer.DefaultTextLayerFactory(),
    });

    const loadingTask = pdfjsLib.getDocument({ url });
    loadingTask.promise.then((pdfDocument) => {
      if (pdfDocument.numPages > 5) {
        // suspiciously high number of pages suggests
        // this might not be what were' actually want
        // comment on the CELEX but skip parsing
      } else {
        window.exposedFunc('pagecount', pdfDocument.numPages);
        pdfViewer.setDocument(pdfDocument);
      }
    });
  }

  static preParse(rawElements) {
    // bunch up items that are within a space of each other
    const elements = [];
    let previous;
    const smallGap = 1.2; //
    const biggerGap = 7.2; // this should be good enough for our needs
    rawElements.forEach((el) => {
      if (previous
                && (el.left > (previous.right - smallGap))
                && (el.left < (previous.right + smallGap))
                && (el.top < ((previous.top + previous.bottom) / 2))
                && (el.bottom > ((previous.top + previous.bottom) / 2))
      ) {
        elements[elements.length - 1].innerText += el.innerText;
        elements[elements.length - 1].right = el.right;
      } else if (previous
                && (el.left > (previous.right - smallGap))
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
    });
    return elements;
  }

  static async getSpanElements(page) {
    const selector = '.textLayer>span';
    const elements = await page.$$eval(selector, (e) => e.map((el) => {
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

    return PdfSivParser.preParse(elements);
  }

  async parsePdf(celexDoc, page) {
    this.celexDoc = celexDoc;
    this.page = page;

    await page.evaluate(() => {
      document.addEventListener('textlayerrendered', (event) => {
        window.exposedFunc('textlayerrendered', event.detail.pageNumber);
      });
      // something in the body of a few pages interferes with
      // the rendering of the PDFs. Removing the body contents
      // before injecting the pdfViewer fixes this
      // It's a sledgehammer to crack a nut though.
      document.body.innerHTML = '';

      const pdfContainer = document.createElement('div');
      const viewer = document.createElement('div');
      document.body.appendChild(pdfContainer);
      pdfContainer.appendChild(viewer);
      pdfContainer.style = 'overflow: auto;position: absolute;width: 100%;height: 100%';
      pdfContainer.id = 'viewerContainer';

      viewer.id = 'viewer';
      viewer.className = 'pdfViewer';
    });

    // inject some code into the webpage to help us out with PDFs
    await page.addStyleTag({ url: 'https://unpkg.com/pdfjs-dist@2.2.228/web//pdf_viewer.css' });
    await page.addScriptTag({ url: 'https://unpkg.com/pdfjs-dist@2.2.228/build/pdf.js' });
    await page.waitForFunction('pdfjsLib != undefined');

    await page.addScriptTag({ url: 'https://unpkg.com/pdfjs-dist@2.2.228/web/pdf_viewer.js' });
    await page.waitForFunction('pdfjsViewer != undefined');

    await page.evaluate(
      PdfSivParser.loadPdfDoc,
      this.storage.Config.eurlex.pdfRoot + celexDoc.celexID,
      this.storage.Config.pdfjs.workerSrc,
    );
    await this.parsingComplete();
    this.emitter.removeAllListeners();
  }

  async parsingComplete() {
    await new Promise((resolve) => {
      this.emitter.on('done', resolve);
    });
  }

  async parsePdfTags() {
    const largeGap = 20;
    const elements = await PdfSivParser.getSpanElements(this.page);

    let date;
    let lookingForVariety = true;
    let lookingForValue = false;
    let sivRecord;
    let country;
    let topFound = false;
    let partialVariety = '';
    let lastItem;
    let currentVariety;

    try {
      elements.forEach((item) => {
        if (
          lastItem
          && ((lastItem.right + largeGap) < item.left)
        ) {
          partialVariety = '';
        }
        const txt = GenericSivParser.fixUpTextItem(item.innerText);
        const posVariety = partialVariety + txt;
        if (!txt.includes('nomenclature')) {
          if (!date) {
            // ignore everything till we have the date
            date = PdfSivParser.checkForPdfDate(txt);
          } else if (!topFound) {
            // ignore everything till we're at the top of the SIV list
            topFound = (txt.localeCompare('CNcode', undefined, { sensitivity: 'base' }) === 0);
          } else if (lookingForValue && !Number.isNaN(txt)) {
            this.setEntryInRecord(sivRecord, country, txt);
            lookingForVariety = true;
            lookingForValue = false;
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
                lookingForValue = true;
              }
            }
            if (lookingForVariety && !country) {
              let variety = this.varietyFromText(txt) || this.varietyFromText(posVariety);
              if (variety) {
                partialVariety = '';
                if (this.storage.Config.selectedVarieties.includes(variety)) {
                  // new variety, register it
                  sivRecord = this.storage.registerVariety(variety);
                  if (sivRecord === undefined) {
                    console.log(`Fatal Error. Can't create sivRecord ${variety} duplicate suspected`);
                    process.exit(1);
                  }
                  currentVariety = variety;
                  lookingForVariety = false;
                  country = undefined;
                }
              } else if ((posVariety) in this.storage.Config.transcriptionErrors) {
                variety = this.varietyFromText(this.storage.Config.transcriptionErrors[posVariety]);
                partialVariety = '';
                if (this.storage.Config.selectedVarieties.includes(variety)) {
                  sivRecord = this.storage.registerVariety(variety);
                  lookingForVariety = false;
                  country = undefined;
                }
              } else if ((posVariety) in this.storage.Config.ignoreVariertyDefinition) {
                partialVariety = '';
              } else if (PdfSivParser.checkForPdfDate(txt)) {
                // ignore, it's just a date
              } else if (/^[. 0-9]*$/.test(posVariety)) {
                // it could be that this is the first part of a variety split into
                // separate spans test if it's a substring of a known variety
                if (Object.values(this.storage.CNs).flat().some((i) => i.includes(posVariety))) {
                  partialVariety = posVariety;
                } else if (posVariety.length > 3) {
                  console.log(`Fatal error: Looking for variety; ${posVariety} does not match any known varieties`);
                  process.exit(1);
                }
              }
            }
          }
        }
        lastItem = item;
      });
    } catch (err) {
      console.log(`Caught exception${err.stack}`);
      process.exit(1);
    }
    if (!date) {
      // fatal error unable to confirm the date for this CELEX
      console.log('Fatal error: can\'t confirm date of PDF');
      process.exit(1);
    }
    await this.storage.completeParseCelex();
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
