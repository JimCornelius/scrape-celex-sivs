import BrowserContext from './BrowserContext.js';

export default class SivCelexIdGatherer {
  // factory method
  static async createGatherer(page, storage) {
    return new SivCelexIdGatherer(page, storage);
  }

  constructor(page, storage) {
    this.storage = storage;
    this.page = page;
    console.log('Created Gatherer');
  }

  async gather() {
    const u = this.storage.Config.gatherer.urlConfig;
    // get first page of Search, then keep hitting the next button
    // quicker if we manually change the settings to get 20 items per page
    const fullUrl = `${u.search}?${u.searchTerm}`
      + `&${u.sessionID}&${u.type}&${u.lang}`
      + `&${u.scope}&${u.sortBy}&${u.sortOrder}&page=${this.storage.Config.gatherer.startPage}`;
    this.iterateThroughPages(fullUrl, true);
    await this.completedGathering();
  }

  async completedGathering() {
    await new Promise((resolve) => {
      this.emitter.on('completedGathering', resolve);
    });
  }

  async iterateThroughPages(url, first) {
    try {
      await this.page.goto(url, { waitUntil: 'networkidle0' });
      if (first) {
        this.storage.nResults = await this.page.evaluate(BrowserContext.getResultsTotal);
        console.log(`Total result: ${this.storage.nResults}`);
        await this.adjustMetaData();
      }
      this.storage.currentPage = await this.page.$eval('#pagingInput1', (el) => el.value);

      const records = await this.page.evaluate(
        BrowserContext.getCelexRecords,
        this.storage.Config.gatherer.searchText,
      );

      const rejectCount = this.storage.Config.gatherer.resultsPerPage - records.length;

      if (rejectCount > 0) {
        console.log(`${rejectCount} item${rejectCount > 1 ? 's' : ''} on the page rejected`);
      }
      await this.storage.storeCelexIDs(records, rejectCount);

      // if there's a next page use that
      const nextUrl = await this.page.evaluate(BrowserContext.getNextButtonUrl);
      if (nextUrl) {
        this.iterateThroughPages(nextUrl, false);
      } else {
        this.finishUp();
      }
    } catch (err) {
      console.log(`caught Exception ${err.stack}`);
    }
  }

  async adjustMetaData() {
    await this.page.waitForSelector('#link-change-metadata');
    await this.page.click('#link-change-metadata');
    await this.page.waitForSelector("#nbResultPerPage>[title='10']");
    await this.page.select('#nbResultPerPage', this.storage.Config.gatherer.resultsPerPage);

    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'load' }),
      this.page.$eval('#button\\.apply', (elem) => elem.click()),
    ]);
  }

  finishUp() {
    console.log('Storing json file');
    this.storage.storeToFile();
    console.log('Job done');
    this.cleanUp();
    this.emitter.emit('completedGathering');
  }
}
