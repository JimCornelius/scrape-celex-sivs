import puppeteer from 'puppeteer';
import Config from './Config.js';
import Storage from './Storage.js';
import CommandLineArgs from './CommandLineArgs.js';
import SivCelexIdGatherer from './SivCelexIdGatherer.js';
import HtmlSivParser from './HtmlSivParser.js';
import PdfSivParser from './PdfSivParser.js';

export default class CelexSivScraper {
  constructor() {
    CommandLineArgs.parseArgs();
    console.log('Created Scraper');
  }

  static async go() {
    await (new CelexSivScraper()).start();
  }

  async start() {
    CommandLineArgs.registerArgV();
    this.storage = await Storage.createStorage(Config);
    this.page = await this.initPuppeteer();
    if (Config.parse.search) {
      const gatherer = await SivCelexIdGatherer.createGatherer(this.page, this.storage);
      await gatherer.gather();
    }

    if (Config.parse.celex) {
      await this.parseCollectedCelexFiles();
    }
    console.log('All Complete');
  }

  async initPuppeteer() {
    console.log('Launching puppeteer');
    this.browser = await puppeteer.launch(Config.puppeteerConfig);
    [this.page] = await this.browser.pages();
    return this.page;
  }

  async parseCollectedCelexFiles() {
    this.htmlSivParser = new HtmlSivParser(this.storage);
    this.pdfSivParser = new PdfSivParser(this.storage);
    await this.parseCelexFiles();
  }

  async cleanUp() {
    await this.browser.close();
    await this.storage.close();
  }

  async parseCelexFiles() {
    await this.pdfSivParser.exposeHelperFuncs(this.page);
    await this.page.setViewport({ width: 1280, height: 800 });

    this.storage.setCelexIDCursor(Config.skipToPos);
    console.log(`About to process ${await this.storage.fileCount()} files.`);
    this.iterateThroughPages(await this.storage.nextCelexDoc());
  }

  async scrapeCelex(celexDoc) {
    if (celexDoc.celexID in Config.ignore) {
      console.log(`${celexDoc.celexID} ignored.`
                + ` Reason: ${Config.ignore[celexDoc.celexID]}`);
    } else {
      const date = await HtmlSivParser.parseHTMLDate(this.page);
      if (date === undefined) {
        await this.pdfSivParser.parsePdf(celexDoc, this.page);
      } else {
        await this.htmlSivParser.parseHTML(celexDoc, this.page, date);
      }
    }
  }

  async gotoPage(celexID) {
    await this.page.goto(Config.eurlex.urlRoot + celexID, { waitUntil: 'load' });
  }

  async iterateThroughPages(celexDoc) {
    this.storage.incrementParsedCount();
    if (celexDoc) {
      if (celexDoc.celexID in Config.ignore) {
        console.log(`${celexDoc.celexID} ignored.`
        + ` Reason: ${Config.ignore[celexDoc.celexID]}`);
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
      this.finishUp();
    }
  }

  finishUp() {
    console.log('Completed parsing celex files');
    this.cleanUp();
  }
}
