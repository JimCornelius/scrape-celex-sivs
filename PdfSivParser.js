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
            console.log("in promise of loading task");
            console.log(pdfDocument.numPages);  
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
        const selector = ".textLayer>span";
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
            // something in the body of a few pages interferes with
            // the rendering of the PDFs. Removing the body contents
            // before injecting the pdfViewer fixes this
            // It's a sledgehammer to crack a nut though.
            document.body.innerHTML = "";

            var pdfContainer = document.createElement("div");
            var viewer = document.createElement("div");
            document.body.appendChild(pdfContainer);
            pdfContainer.appendChild(viewer);
            pdfContainer.id = "viewerContainer";
            viewer.id = "viewer";
            viewer.className = "pdfViewer";
        });

        // inject some code into the webpage to help us out with PDFs
        await page.addScriptTag({ url: "https://unpkg.com/pdfjs-dist@2.2.228/build/pdf.js" });
        await page.waitForFunction("pdfjsLib != undefined");

        await page.addScriptTag({ url: "https://unpkg.com/pdfjs-dist@2.2.228/web/pdf_viewer.js" });
        await page.waitForFunction("pdfjsViewer != undefined");

        await page.evaluate(
            PdfSivParser.loadPdfDoc,
            this.storage.Config.eurlex.pdfRoot + celexDoc.celexID,
            this.storage.Config.pdfjs.workerSrc
        );
        await this.parsingComplete();
        this.emitter.removeAllListeners();
    }

    async parsingComplete() {
        await new Promise((resolve, reject) => {
            this.emitter.on("done",resolve);
        });
    }
    
    async parsePdfTags() {
        try {
            const elements = await this.getElements(this.page);

            let lookingForVariety = true;
            let lookingForValue = false;

            let date;
            let sivRecord; 
            let country = undefined;
            let topFound = false;
            let partialVariety = "";
            let lastTxt = undefined;
            for (let item of elements) {
                const txt = GenericSivParser.fixUpTextItem(item.innerText);
                // ignore everything till we have the date
                if (!date) {
                    date = this.checkForPdfDate(txt);
                    if (date) {
                        this.celexDoc.dateInJournal = date;
                    }
                }
                else {
                    // ignore everything till we're at the top of the SIV list
                    if (!topFound) {
                        topFound = (
                            (0 == txt.localeCompare('CNcode',
                                undefined, { sensitivity: 'base' }))  ||
                            (0 == (lastTxt+txt).localeCompare('CNcode',
                                undefined, { sensitivity: 'base' }))     
                                ); 
                    } else {
                        if (lookingForValue) {
                            if (!isNaN(txt)) {
                                this.setEntryInRecord(sivRecord, country, txt);
                                lookingForVariety = true;
                                lookingForValue = false;
                                country = undefined;
                            }
                        } else {
                            if (sivRecord && country == undefined) {
                                // will always be looking for the variery as well
                                country = this.storage.findCountry(txt);
                                if (country) {
                                    if([country].flat().some(i => sivRecord.hasOwnProperty(i))) {
                                        if (!(this.celexDoc.celexID in this.storage.Config.knownDuplicateCountry)) {
                                            console.log(`Already have an entry for ${sivRecord.variety} : ${country}`);
                                            process.exit(1);
                                        }
                                    }
                                    lookingForValue = true;
                                }
                            }
                            if (lookingForVariety && !country) { 
                                let variety = this.varietyFromItemText(partialVariety+txt);
                                if (variety) {
                                    partialVariety = "";
                                    if (this.storage.Config.selectedVarieties.includes(variety)) {
                                        // new variety, register it 
                                        sivRecord = this.storage.registerVariety(variety);
                                        if (sivRecord == undefined) {
                                            console.log(`Fatal Error. Can't create`+
                                            ` sivRecord ${variety} duplicate suspected`); 
                                            process.exit(1);
                                        }
                                        lookingForVariety = false;
                                        country = undefined;
                                    } else {
                                        // ignoring non selected varieties
                                    }
                                } else {
                                    
                                    // There's no way to single out the varieties we could miss some unmapped ones
                                    // can't check all but if it looks like a potential variety exists we can manually check                                   
                                    if (txt.length > 3 && /^[. 0-9]*$/.test(txt)) {
                                        // ignore if this is just the date
                                        if (date != this.checkForPdfDate(txt)) {
                                            if (!((partialVariety+txt) in this.storage.Config.ignoreVariertyDefinition)) {
                                                if ((partialVariety+txt) in this.storage.Config.transcriptionErrors) {
                                                    variety = this.varietyFromItemText(this.storage.Config.transcriptionErrors[partialVariety+txt]);
                                                    if (this.storage.Config.selectedVarieties.includes(variety)) {
                                                        sivRecord = this.storage.registerVariety(variety);                    
                                                        lookingForVariety = false;
                                                        country = undefined;                                                        
                                                    }
                                                    partialVariety = "";
                                                } else {
                                                    // it could be that this is the first part of a variety split into separate spans
                                                    // test if it's a substring of a known variety
                                                    if (Object.values(this.storage.CNs).flat().some(i => i.includes(txt))) {
                                                        partialVariety += txt;
                                                    } else {
                                                        // is it another date?
                                                        if (!this.checkForPdfDate(txt)) {
                                                            console.log(`Fatal error: Looking for variety; ${txt} does not match any known varieties`);
                                                            process.exit(1);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                lastTxt = txt;
            }
            if (!date) {
                // fatal error unable to confirm the date for this CELEX
                console.log(`Fatal error: can't confirm date of PDF`);
                process.exit(1);
            }

        } catch(err) {
            console.log("Caught exception" + err.stack);
            process.exit(1);
        }

        await this.storage.completeParseCelex();
    }

    checkForPdfDate(txt) {
        // look for date in format XX.XX.XXXX; X.XX.XXXX; XX.X.XXXX
        let trio = txt.split(".").map(d => d.trim());
        if (trio.length!=3) return;
        if (trio.some(a => isNaN(a))) return;
        if (trio.some(a => (0==a))) return;
        if (
            trio[0] > 31 || trio[1] > 12 || (
                (trio[2] < 57) || 
                (trio[2] > 99 && trio[2] <1957)
            )
        ) return;
        
        return trio.join("/");
    }
};
     
