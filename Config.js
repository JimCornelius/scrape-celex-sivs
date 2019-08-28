import cnCodes from './data/cnCodes.json';
import countries from './data/countries.json';

export default class Config {
    static startPos = 0;

    static puppeteerConfig = { headless: true };

    static urlConfig = {
      search: 'https://eur-lex.europa.eu/search.html',
      lang: 'lang=en',
      type: 'type=quick',
      scope: 'scope=EURLEX',
      sortBy: 'sortOne=DD',
      sortOrder: 'sortOneOrder=desc',
      // The session could be anyhing as long
      // as it's the same each time we fetch with it
      sessionID: 'qid=1563402353675',
      searchTerm: 'text="establishing+the+standard+import+values"',
    };

    static ignoreVariertyDefinition = {
      '08052070.08052090': 'ignore this, part of a variety defintion on a separate line',
    };

    static transcriptionErrors = {
      '08089100': '07099100',
      '07071000': '07091000',
      '08052030.08052050.': '08052030.08052050.08052070.08052090',
      '07029070': '07020000',
      '308081020.08081050.08081090': '08081020.08081050.08081090',
      '07020005': '07070005',
    };

    static minVarieties = 4;

    static standardIgnoreMsg =
        'Standard CELEX code but this is a correction'
        + ' of earlier SIV. Manual DB correction required.';

    static ignore = {
      '32010R0944': this.standardIgnoreMsg,
      '32008R0468': this.standardIgnoreMsg,
      '32005R2002': this.standardIgnoreMsg,
      '32005R1179': this.standardIgnoreMsg,
      '32002R0510': this.standardIgnoreMsg,
      '32001R2427': this.standardIgnoreMsg,
      '32001R0684': this.standardIgnoreMsg,
      '32001R1179': 'Incorrectly indexed. Lnks to a regulation'
            + ' on butter. Journal listing shows CELEX 32001R1170',
      '31999R2594': 'amended regulation, needs manual interpretation',
      '31999R1491': this.standardIgnoreMsg,
      '31998R0674': this.standardIgnoreMsg,
      '31997R1896': this.standardIgnoreMsg,
    };

    static dontIgnore = {
      '32000R0404': 'Only 1 variety, but valid',
      '32000R0162': 'Only 2 varieties, but valid',
      '31999R0901': 'Only 3 varieties, but valid',
      '31999R0887': 'Only 5 varieties, but valid',
      '31998R1140': 'Only 4 varieties, but valid',
      '31997R1142': 'Only 4 varieties, but valid',
      '31997R1135': 'Only 4 varieties, but valid',
      '31997R1128': 'Only 4 varieties, but valid',
    };

    static knownDuplicateCountry = {
      '32001R1366': 'Contains duplicate for 999 on 08091000',
      '31997R1887': 'Contains duplicate for 058 on 08081092.08081094.08081098',
    };

    static eurlex = {
      urlRoot: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:',
      pdfRoot: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:',
    };

    static pdfjs = {
      workerSrc: 'https://unpkg.com/pdfjs-dist@2.2.228/build/pdf.worker.js',
    }

    static storage = {
      resetDB: false,
      resetLog: false,

      mongo: {
        url: 'mongodb://localhost:27017',
        clientOptions: {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        },
        dbName: 'SIVdb',
        knownIDs: 'sivCelex',
        sivDocs: 'sivDocs',
      },
    };

    static selectors = {
      code: '.tbl-cod',
      num: '.tbl-num',
      txt: '.tbl-txt',
    };

    static countries = countries;

    static cnCodes = cnCodes;

    static selectedVarieties = [Object.keys(cnCodes)].flat();
}
