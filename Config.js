import cnCodes from './data/cnCodes.json';
import countries from './data/countries.json';

export default class Config {
    static startPos = 3000;
    static puppeteerConfig = {headless: false};
    static urlConfig = {
        search: "https://eur-lex.europa.eu/search.html",
        lang: "lang=en",
        type: "type=quick",
        scope: "cope=EURLEX",
        sortBy: "sortOne=DD",
        sortOrder: "sortOneOrder=desc",
        // this could be anyhing as long 
        // as it's the same each timewe fetch with it
        sessionID: "qid=1563402353675", 
        searchTerm: 'text="establishing+the+standard+import+values"'
    };
    static eurlex = {
        urlRoot: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:",
        pdfRoot: "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:"
    };

    static pdfjs = {
        workerSrc: "https://unpkg.com/pdfjs-dist@2.2.228/build/pdf.worker.js"
    }

    static storage = {
        reset: false,
        resetLog: false,

        mongo: {
            url: 'mongodb://localhost:27017',
            clientOptions: {useNewUrlParser: true},
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