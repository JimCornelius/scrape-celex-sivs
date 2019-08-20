import cnCodes from './data/cnCodes.json';
import countries from './data/countries.json';

export default class Config {
    static startPos = 0;
    static puppeteerConfig = {headless: true};
    static urlConfig = {
        search: "https://eur-lex.europa.eu/search.html",
        lang: "lang=en",
        type: "type=quick",
        scope: "scope=EURLEX",
        sortBy: "sortOne=DD",
        sortOrder: "sortOneOrder=desc",
        // The session could be anyhing as long 
        // as it's the same each time we fetch with it
        sessionID: "qid=1563402353675", 
        searchTerm: 'text="establishing+the+standard+import+values"'
    };
    static standardIgnoreMsg =
        "Standard CELEX code but this is a correction"+
        " of earlier SIV. Manual DB correction required.";
    static ignore = {
        "32010R0944": this.standardIgnoreMsg,
        "32008R0468": this.standardIgnoreMsg,
        "32005R2002": this.standardIgnoreMsg,
        "32005R1179": this.standardIgnoreMsg
    };
    static dontIgnore = {
        "32003R0779": "Only 5 varieties, but valid"
    };
    static eurlex = {
        urlRoot: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:",
        pdfRoot: "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:"
    };

    static pdfjs = {
        workerSrc: "https://unpkg.com/pdfjs-dist@2.2.228/build/pdf.worker.js"
    }

    static storage = {
        resetDB: false,
        resetLog: false,

        mongo: {
            url: 'mongodb://localhost:27017',
            clientOptions: {
                useNewUrlParser: true,
                useUnifiedTopology: true
                },
            dbName: 'SIVdb',
            knownIDs: "sivCelex",
            sivDocs: "sivDocs",
        }
    };

    static selectors = {
        code: ".tbl-cod",
        num: ".tbl-num",
        txt: ".tbl-txt"
    };

    static countries = countries;
    static cnCodes = cnCodes;
    static selectedVarieties = [Object.keys(cnCodes)].flat();
}