import GenericSivParser from "./GenericSivParser.js"
import DataConfig from "./DataConfig.js";

// GenericSivParser --
export default class PdfSivParser extends GenericSivParser {
    constructor(celexParser, sivStorage) {
        // don't overuse constructor, save for initiate function
        super(celexParser);
        this.reset();
        this.sivStorage = sivStorage;
    }

    reset() {
        return this;
    }

    cleanup(){
        // get rid of PDF of the last celex
        if(this.pdfViewer != undefined) {
            this.pdfViewer.cleanup();
        }
        return this;
    }

    onTextLayerRendered (event) {
        // text layer for page X is now in the DOM and can be parsed
        this.unrendered = this.unrendered.filter(i => i != event.detail.pageNumber);
        if (this.unrendered.length == 0) {
            // console.log(`calling parsePdfTags with CELEX:${this.sivStorage.currentCelex}`);
            this.parsePdfTags();
        }
    }    

    initiate() {
        document.addEventListener('textlayerrendered',
            this.onTextLayerRendered.bind(this));
        return this;
    }

    onLoaded(pdfDocument) {
        if (pdfDocument.numPages > 5 ) {
            // suspiciously high number of pages suggests
            // this might not be what were' actually want
            // comment on the CELEX but skip parsing
        } else {
            // eliminate items from this array as each page rendered
            this.unrendered = [...Array(pdfDocument.numPages).keys()].map(x => ++x);

            // Document loaded, specifying document for the viewer
            this.pdfViewer.setDocument(pdfDocument);
        }
    };

    parsePdf() {
        // The workerSrc property shall be specified.
        pdfjsLib.GlobalWorkerOptions.workerSrc = DataConfig.pdfjs.workerSrc;

        let container = document.getElementById('viewerContainer');

        if (this.pdfViewer == undefined) {
            this.pdfViewer = new pdfjsViewer.PDFViewer({
                container: container,
            });
        }

        // Loading document.
        let loadingTask = pdfjsLib.getDocument({
            url: DataConfig.eurlex.pdfRoot + this.sivStorage.currentCelex
        })

        loadingTask.promise.then(this.onLoaded.bind(this));
    }

    parsePdfTags() {
        let variety;
        let country;
        let date;
        let sivRecord; 

        let findingValue = false;
        let elements = document.querySelectorAll("span");
        for(let item of elements) {
            let txt = GenericSivParser.fixUpTextItem(item);
            if (date == undefined) {
                date = this.checkForPdfDate(txt);
                if (date != undefined) {
                    this.sivStorage.initCelexInfo(date);
                }
            }
            else if (findingValue) {         
                let val = this.validateValue(txt);
                if (val != undefined) {
                    // console.log(`${variety} : ${country} : ${val}`);

                    // store value then reset
                    if (sivRecord == undefined) {
                        sivRecord = {};
                    }
                    if (sivRecord.hasOwnProperty(country)) {
                        console.log(`already have an entry for ${variety} : ${country}`);
                    } else {
                        sivRecord[country] = val;
                    }                
                    country = undefined;
                    findingValue = false;
                }
            }
            else{
                let varietyCountry = this.sivStorage.findCountry(txt);
                if (varietyCountry != undefined) {
                    if (varietyCountry.variety != undefined) {
                        // found variety is it among the seelcted varieties
                        if (GenericSivParser.selectedVarieties.includes(variety)) {
                            if (sivRecord != undefined) {
                                // this is a new variety, store the old one
                                this.sivStorage.storeRecord(variety, sivRecord);
                                sivRecord = undefined;
                            }
                            variety = varietyCountry.variety;
                            // console.log(`Variety: ${variety}`);
                            findingValue = false;
                        }
                        else if (varietyCountry.countryKey != undefined) {
                            country = varietyCountry.countryKey;
                            // console.log(`Variety: + ${variety}; Country: ${country}`);
                            findingValue = true;
                        }
                    }
                }
            }
        }
        // store what remaines
        if (sivRecord != undefined) {
            this.sivStorage.storeRecord(variety, sivRecord);
            sivRecord = undefined;
        }

        // ideally would like to get rid of this reference
        this.celexParser.completeParseCelex();
    }

    validateValue(txt) {
        // not sure how we can validate this
        let val = txt; 
        return val;
    }

    checkForPdfDate(txt) {
        // look for date in format XX.XX.XXXX; X.XX.XXXX; XX.X.XXXX
        let trio = txt.split(".");
        if (trio.length!=3) return;
        if (trio.some(a => isNaN(a))) return;
        if (trio.some(a => (0==a))) return;
        if (trio[0] >31 || trio[1] > 12 || trio[2] < 1957) return;
        
        return trio.join("/");
    }
};