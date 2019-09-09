import HtmlSivParser from './HtmlSivParser.js';
import PdfSivParser from './PdfSivParser.js';

export default class CelexParser {
  // factory method
  static async createParser(page, storage) {
    return new CelexParser(page, storage);
  }

  constructor(page, storage) {
    this.page = page;
    this.storage = storage;
  }

  async parseCollectedCelexFiles() {
    this.htmlSivParser = new HtmlSivParser(this.storage);
    this.pdfSivParser = new PdfSivParser(this.storage);
    await this.parseCelexFiles();
  }

  async parseCelexFiles() {
    await this.pdfSivParser.exposeHelperFuncs(this.page);
    await this.page.setViewport({ width: 1280, height: 800 });

    this.storage.setCelexIDCursor(this.storage.Config.skipToPos);
    console.log(`About to process ${await this.storage.fileCount()} files.`);
    this.iterateThroughPages(await this.storage.nextCelexDoc());
  }

  async iterateThroughPages(celexDoc) {
    this.storage.incrementParsedCount();
    if (celexDoc) {
      if (celexDoc.celexID in this.storage.Config.ignore) {
        console.log(`${celexDoc.celexID} ignored.`
        + ` Reason: ${this.storage.Config.ignore[celexDoc.celexID]}`);
      } else if (!await this.storage.checkSivDocExists(celexDoc.celexID)) {
        try {
          console.log(`${this.storage.parsedCount} : Processing ${celexDoc.celexID}`);
          await this.gotoPage(celexDoc.celexID);
          await this.scrapeCelex(celexDoc);
        } catch (err) {
          console.log(`Caught Exception ${err.stack}`);
        }
      } else {
        console.log(
          `${this.storage.parsedCount} : Document for celex ${celexDoc.celexID} already exists`,
        );
      }
      this.iterateThroughPages(await this.storage.nextCelexDoc());
    } else {
      console.log('Completed parsing celex files');
    }
  }

  async scrapeCelex(celexDoc) {
    if (celexDoc.celexID in this.storage.Config.ignore) {
      console.log(`${celexDoc.celexID} ignored.`
                + ` Reason: ${this.storage.Config.ignore[celexDoc.celexID]}`);
    } else {
      const date = await HtmlSivParser.parseHTMLDate(this.page);
      if (date === undefined) {
        await this.pdfSivParser.parsePdf(celexDoc, this.page);
      } else {
        await this.htmlSivParser.parseHTML(celexDoc, this.page, date);
      }
    }
  }
}
