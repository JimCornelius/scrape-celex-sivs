// import puppeteer from 'puppeteer-firefox';
import puppeteer from 'puppeteer';

import Config from './Config.js';
import Storage from './Storage.js';
import CommandLineArgs from "./CommandLineArgs.js"
import HtmlSivParser from "./HtmlSivParser.js"
import PdfSivParser from "./PdfSivParser.js"

class CelexSivScraper {

    constructor () {
        CommandLineArgs.parseArgs();
        console.log("created Scraper");
    }

    async go() {
        CommandLineArgs.registerArgV();
        this.storage = await this.initStorage(Config);

        this.htmlSivParser = new HtmlSivParser(this.storage);
        this.pdfSivParser = new PdfSivParser(this.storage);
        await this.runPuppeteer();
    }

    async initStorage(){
        return await new Storage(Config);
    }

    async cleanUp() {
        await this.browser.close();
    }

    async runPuppeteer() {
        console.log("Launching puppeteer...");
        this.browser = await puppeteer.launch(Config.puppeteerConfig);
        [this.page] = await this.browser.pages();
        await this.pdfSivParser.exposeFunc(this.page);
        await this.page.setViewport({width:1280, height:800});
        this.iterateThroughPages(await this.storage.nextCelexDoc(true));
    }

    async scrapeCelex(celexDoc) {
        var date = await this.htmlSivParser.parseHTMLDate(this.page);
        if (!date) {
            // parse PDF which is completed asynchronously
            await this.pdfSivParser.parsePdf(celexDoc, this.page);
        }
        else {
            await this.htmlSivParser.parseHTML(celexDoc, this.page, date);
        }      
    };

    async gotoPage(celexID) {
        await this.page.goto(Config.eurlex.urlRoot + celexID,{waitUntil:"load"});
    }

    async iterateThroughPages(celexDoc) {
        this.storage.incrementParsedCount();
        if (celexDoc) {
            if (!await this.storage.checkDocExists(celexDoc.celexID)) {
                try {
                    console.log(`Processing ${celexDoc.celexID}`);
                    await this.gotoPage(celexDoc.celexID);
                    await this.scrapeCelex(celexDoc);
                } catch(err) {
                    console.log("caught Exception" + err.stack);
                }
            }
            else {
                console.log(`Document for celex ${celexDoc.celexID} already exists`); 
            }

            this.iterateThroughPages(await this.storage.nextCelexDoc());
        } else {
            this.finishUp();
        }
    }

    finishUp() {
        console.log("Job done");
        this.cleanUp();
        process.exit(0);
    }
}

process.on('uncaughtException', function (err) {
    if (err) {
        console.log("caught exception but no error msg" + err.stack);
        process.exit(1);
    }
});

let scraper = new CelexSivScraper();
scraper.go();

