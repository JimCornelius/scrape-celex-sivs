import EventEmitter from 'events';
import GenericSivParser from "./GenericSivParser.js"


// GenericSivParser --
export default class PdfSivParser extends GenericSivParser {
    constructor(storage) {
        // don't overuse constructor, save for initiate function
        super();
        this.emitter = new EventEmitter();
        this.storage = storage;
    }

    async exposeFunc(page) {
        // expose a function the can be called in the browser context
        var boundFunc = this.exposedFunc.bind(this);
        await page.exposeFunction('exposedFunc', boundFunc);
    }

    async exposedFunc(event, val) {
        if (event == "pagecount") {
            this.unrendered = [...Array(val).keys()].map(x => ++x);
        } else if (event == "textlayerrendered") {
            // text layer for page X is now in the DOM and can be parsed
            this.unrendered = this.unrendered.filter(i => i != val);
            if (this.unrendered.length == 0) {

               // now we can actually parse the PDF 
               await this.parsePdfTags();
               this.emitter.emit("done");
            }
        }
    }

    static loadPdfDoc(url, workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc; 
        
        var pdfViewer = new pdfjsViewer.PDFViewer({
            container: document.getElementById('viewerContainer'),
        });
        
        let loadingTask = pdfjsLib.getDocument({url: url});
        loadingTask.promise.then((pdfDocument) => {
            
            if (pdfDocument.numPages > 5 ) {
                // suspiciously high number of pages suggests
                // this might not be what were' actually want
                // comment on the CELEX but skip parsing
            } else {
                window.exposedFunc("pagecount", pdfDocument.numPages);
                pdfViewer.setDocument(pdfDocument);
            }      
        });
    }

    async getElements (page) {
        const selector = "span";
        return await page.$$eval(selector, elements =>
            elements.map(el => ({
                tagName: el.tagName,
                className: el.className,
                innerText: el.innerText
            }))
        );
    }

    async parsePdf(celexDoc, page) {
        this.celexDoc= celexDoc;
        this.page = page;

        await page.evaluate(() => {
            document.addEventListener('textlayerrendered', (event)  => {         
                window.exposedFunc("textlayerrendered", event.detail.pageNumber);
            });

            var x = document.createElement("div");
            var y = document.createElement("div");
            document.body.appendChild(x);
            x.appendChild(y);
            x.id = "viewerContainer";
            y.id = "viewer";
            y.className = "pdfViewer";
        });

        // inject some code into the webpage to help us out with PDFs
        await page.addScriptTag({ url: "https://unpkg.com/pdfjs-dist@2.2.228/build/pdf.js" });
        await page.waitForFunction("pdfjsLib != undefined");

        await page.addScriptTag({ url: "https://unpkg.com/pdfjs-dist@2.2.228/web/pdf_viewer.js" });
        await page.waitForFunction("pdfjsViewer != undefined");

        var result = await page.evaluate(
            PdfSivParser.loadPdfDoc,
            this.storage.Config.eurlex.pdfRoot + celexDoc.celexID,
            this.storage.Config.pdfjs.workerSrc
        );
        await this.parsingComplete();
    }

    async parsingComplete() {
        await new Promise((resolve, reject) => {
            this.emitter.on("done",resolve);
        });
    }
    
    async parsePdfTags() {
        try {
            let elements = await this.getElements(this.page);

            let lookingForVariety = true;
            let lookingForValue = false;

            let date;
            let sivRecord; 
            let country = undefined;
    
            var dateConfirmed = false;
            for (let item of elements) {
                let txt = GenericSivParser.fixUpTextItem(item.innerText);
                // ignore everything till we have the date and confirmed date
                if (!dateConfirmed) {
                    var thisDate = this.checkForPdfDate(txt);
                    if (thisDate) {
                        if (date == undefined) {
                            date = thisDate;
                        }
                        else if (date == thisDate) {
                            dateConfirmed = true;
                            this.celexDoc.dateInJournal = date;
                        }
                    }
                }
                else {
                    if (lookingForValue) {
                        if (!isNaN(txt)) {
                            if (country == "MGB") {
                                // Maghreb (MGB) countries
                                this.setEntryInRecord(sivRecord, "Algeria", txt);
                                this.setEntryInRecord(sivRecord, "Morocco", txt);
                                this.setEntryInRecord(sivRecord, "Tunisia", txt);
                            }
                            else  {
                                this.setEntryInRecord(sivRecord, country, txt);
                            }
                            lookingForVariety = true;
                            lookingForValue = false;
                            country = undefined;
                        }
                    } else {
                        if (country == undefined) {
                            // will always be looking for the variery as well
                            country = this.storage.findCountry(txt);
                            if (country) {
                                if (sivRecord.hasOwnProperty(country)) {
                                    console.log(`Already have an entry for ${sivRecord.variety} : ${country}`);
                                } else {
                                    lookingForValue = true;
                                }
                            }
                        }
                        if (lookingForVariety && !country) { 
                            const variety = this.varietyFromItemText(txt);
                            if (variety) {
                                if (this.storage.Config.selectedVarieties.includes(variety)) {
                                    // new variety, register it 
                                    sivRecord = this.storage.registerVariety(variety);
                                    if (sivRecord == undefined) {
                                        console.log(`Fatal Error. Can't create`+
                                        ` sivRecord ${entry.variety} duplicate suspected`); 
                                        process.exit(1);
                                    }
                                    lookingForVariety = false;
                                    country = undefined;
                                } else {
                                    // ignoring non selected varieties
                                }

                            } else {
                                // There's no way to single out the varieties we could miss some unmapped ones
                                // can't check all but if they look like potential varieties flag it as a non-fatal error
                                if (txt.length > 3 && /^[. 0-9]*$/.test(txt)) {

                                    console.log(`Not fatal error: Looking for variety; ${txt} does not match any known varieties`);
                                    process.exit(1);
                                }
                            }
                        }
                    }
                }
            }
            if (!dateConfirmed) {
                // fatal error unable to confirm the date for this CELEX
                console.log(`Not fatal error: Looking for variety; ${txt} does not match any known varieties`);
                process.exit(1);
            }

        } catch(err) {
            console.log("caught Exception" + err.stack);
            process.exit(1);
        }

        await this.storage.completeParseCelex();
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
     