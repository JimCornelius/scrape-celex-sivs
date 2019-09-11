import puppeteer from 'puppeteer';
import Config from './Config.js';
import Storage from './Storage.js';
import CommandLineArgs from './CommandLineArgs.js';
import SivCelexIdGatherer from './SivCelexIdGatherer.js';
import CelexParser from './CelexParser.js';

export default class CelexSivScraper {
  constructor() {
    CommandLineArgs.parseArgs();
    console.log('Created Scraper');
  }

  static async go() {
    await (new CelexSivScraper()).start();
  }

  async initPuppeteer() {
    console.log('Launching puppeteer');
    this.browser = await puppeteer.launch(Config.puppeteerConfig);
    [this.page] = await this.browser.pages();
    return this.page;
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
      const parser = await CelexParser.createParser(this.page, this.storage);
      await parser.parseCollectedCelexFiles();
    }

    await this.cleanUp();
    console.log('All done. End.');
  }

  async cleanUp() {
    await this.browser.close();
    await this.storage.close();
  }
}
