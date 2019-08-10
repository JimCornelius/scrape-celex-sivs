import HtmlSivParser from "./HtmlSivParser.js"
import PdfSivParser from "./PdfSivParser.js"
import SivStorage from "./SivStorage.js"
import DataConfig from "./DataConfig.js";
import FrameWrapper from "./FrameWrapper.js";
import GenericSivParser from "./GenericSivParser.js";


window.addEventListener('load', () => {
    // give the CelexSivScraper object global exposure
    globalThis.myCelex = new CelexSivScraper();
    myCelex.initiate();
});

//----

// CelexSivScraper --
class CelexSivScraper {
    constructor() {
        // don't overuse constructor, save for initiate function
        this.reset();
    };

    reset() {
        return this;
    }

    initiate() {
        this.sivStorage = new SivStorage().initiate();
        this.frameWrapper = new FrameWrapper().initiate();
        this.htmlSivParser = new HtmlSivParser(this, this.sivStorage, this.frameWrapper);
        this.pdfSivParser = new PdfSivParser(this, this.sivStorage).initiate();
        this.initiateButtons();
        return this;
    }

    initiateButtons() {
        this.performAllButton = document.querySelector('button#ScrapeFromIDs');
        // this.testButton.style.background='green';
        this.performAllButton.addEventListener('click', this.startMainJob.bind(this));
    }

    get parsedCount() {
        return  this.sivStorage.parsedCount;
    }

    get currentCelex() {
        return  this.sivStorage.currentCelex;
    }

    startMainJob() {
        this.pocessVarieties(Object.keys(this.sivStorage.input.cnCodes));
    }

    pocessVarieties(varieties) {
        // set the righthandler for this job
        this.frameWrapper.setFrameLoadedHandler(this.onCelexLoaded.bind(this));
  
        // ensure selected varieties is a list, this store it.     
        GenericSivParser.selectedVarieties = [varieties].flat();
        this.updateCelexPage();
    }
    
    onCelexLoaded() {
        this.pdfSivParser.cleanup();
        this.scrapeCelex();
    }

    fetchNextCelexPage() {
        if (this.sivStorage.advancePosition()) {
            this.updateCelexPage();
        } else {
            // we're done
            // save the output
            this.sivStorage.saveOutput();
        }
    }

    updateCelexPage() {
        this.frameWrapper.setSource(DataConfig.eurlex.urlRoot+this.currentCelex);
    }
    
    scrapeCelex() {
        var date = this.htmlSivParser.parseHTMLDate();
        if (!date) {
            // parse PDF which is completed asynchronously
            this.pdfSivParser.parsePdf();
        }
        else {
            this.htmlSivParser.parseHTML(date);
        }        
    };

    completeParseCelex() {
        this.sivStorage.incrementParsedCount();
               
        console.log(`${this.parsedCount} : completed: ${this.currentCelex};` +
        `varieties: ${this.sivStorage.currentVarietyCount}`);
        this.fetchNextCelexPage();
    }
}
