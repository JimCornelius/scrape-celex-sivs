import cnCodes from './data/cnCodes.json';
import countries from './data/countries.json';
import ErrCorrection from './ErrCorrection.js';

export default class Config {
  static ErrCorrection = ErrCorrection;

  static gatherer = {
    searchText: 'the standard import values for determining the entry',
    resultsPerPage: '20',
    startPage: 1,

    urlConfig: {
      // The session could be anything as long
      // as it's the same each time we fetch with it
      sessionID: 'qid=1563402353675',
      search: 'https://eur-lex.europa.eu/search.html',
      lang: 'lang=en',
      type: 'type=quick',
      scope: 'scope=EURLEX',
      sortBy: 'sortOne=DD',
      sortOrder: 'sortOneOrder=desc',
    },
  };

  static skipToPos = 0;

  static parse = {
    search: true,
    celex: true,
  }

  static pdfjs = {
    workerSrc: 'https://unpkg.com/pdfjs-dist@2.2.228/build/pdf.worker.js',
  }

  static puppeteerConfig = { headless: true };

  // default to all known varieties
  static selectedVarieties = [Object.keys(cnCodes)].flat();

  static minVarieties = 3;

  static eurlex = {
    urlRoot: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:',
    pdfRoot: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:',
  };

  static storage = {
    setResetCelexDB: false,
    setResetDocDB: false,

    mongo: {
      url: 'mongodb://localhost:27017',
      clientOptions: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
      dbName: 'EuSiv',
      sivDocs: 'sivDocs',
      standardIDs: 'sivCelex',
      nonStandardIDs: 'nonSivCelex',
    },
    file: {
      standardIDs: 'EuSIV.json',
      nonStandardIDs: 'EuSIVnonStandard.json',
    },
  };

  static selectors = {
    title: '.doc-ti',
    table: {
      code: '.tbl-cod',
      num: '.tbl-num',
      txt: '.tbl-txt',
    },
  };

  static jsonData = {
    countries,
    cnCodes,
  };
}

Config.gatherer.urlConfig
  .searchTerm = `text="${Config.gatherer.searchText.replace(/ /g, '+')}"`;
