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
    const { startPage } = this.storage.Config.gatherer;
    // get first page of Search, then keep hitting the next button
    // quicker if we manually change the settings to get 20 items per page
    const fullUrl = `${u.search}?${u.searchTerm}`
      + `&${u.sessionID}&${u.type}&${u.lang}`
      + `&${u.scope}&${u.sortBy}&${u.sortOrder}&page=${startPage}`;
    this.iterateThroughPages(fullUrl, true, startPage);
    await this.completedGatheringEmitted();
    this.storage.emitter.removeAllListeners();
  }

  async completedGatheringEmitted() {
    await new Promise((resolve) => {
      this.storage.emitter.on('completedGathering', resolve);
    });
  }

  static async asyncFilterArray(arr, callback) {
    return arr.reduce(async (res, val) => {
      const filtered = await res;
      if (await callback(val)) {
        filtered.push(val);
      }
      return filtered;
    }, Promise.resolve([]));
  }

  async iterateThroughPages(url, first, pageNo) {
    try {
      await this.page.goto(url, { waitUntil: 'networkidle0' });
      if (first) {
        this.storage.nResults = await this.page.evaluate(BrowserContext.getResultsTotal);
        console.log(`Total results: ${this.storage.nResults}`);
        await this.adjustMetaData();
      }
      this.storage.currentPage = await this.page.$eval('#pagingInput1', (el) => el.value);

      console.log(`Scraping results from page: ${pageNo}`);
      let records = await this.page.evaluate(
        BrowserContext.getCelexRecords,
        this.storage.Config.gatherer.searchText,
      );
      records = records.filter((r) => r.celexID);

      const rejectCount = this.storage.Config.gatherer.resultsPerPage - records.length;

      if (rejectCount > 0) {
        console.log(`${rejectCount} item${rejectCount > 1 ? 's' : ''} on the page rejected`);
      }

      const callback = this.storage.checkCelexIDExists.bind(this.storage);
      const filteredOutRecords = await SivCelexIdGatherer.asyncFilterArray(records, callback);
      const filteredInRecords = records.filter((item) => !filteredOutRecords.includes(item));

      filteredOutRecords.forEach((item) => {
        console.log(`ID ${item.celexID} is already in the database`);
      });
      await this.storage.storeCelexIDs(filteredInRecords, rejectCount);

      // if there's a next page use that
      const nextUrl = await this.page.evaluate(BrowserContext.getNextButtonUrl);
      if (nextUrl) {
        this.iterateThroughPages(nextUrl, false, pageNo + 1);
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
    // don't noth storing  a test tile anymore
    // console.log('Storing json file');
    //  this.storage.storeToFile();
    console.log('Gathering completed');
    this.storage.emitter.emit('completedGathering');
  }
}
