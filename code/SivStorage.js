import DataConfig from "./DataConfig.js"
import FileStore from "./FileStore.js"
import FireBaseDB from "./FireBaseDB.js"

// SivStorage --
export default class SivStorage {
    constructor() {
        this.fileStore = new FileStore;
        this.fireBaseDB = new FireBaseDB(DataConfig.fireBase);
        // don't overuse constructor, save for initiate function
        this.reset();
    }

    reset() {
        this.pos = 0;
        this.parsedCount = 0;
        this.output = {
            celexInfo:{},
            siv: {}
        };
        return this;
    }

    initiate() {
        this.initiateInputs();
        this.initiateOutputs();
        return this;
    }

    async initiateOutputs() {
        this.fireBaseDB.applyConfig();
    }

    async initiateInputs() {
        this.input = {
            countries: await SivStorage.loadServerSideJSON(DataConfig.jsonSrc.countries),
            cnCodes: await SivStorage.loadServerSideJSON(DataConfig.jsonSrc.cnCodes),
            celexList: await SivStorage.loadServerSideJSON(DataConfig.jsonSrc.celexList),
        };
         
        // for convenience concatenate variety CN codes where grouped 
        this.input.CNs = Object.fromEntries(
            Object.values(this.input.cnCodes).map(
                (k,v) => [Object.keys(this.input.cnCodes)[v],k.map(i => i.join("."))]
            )
        );
    }

    static async loadServerSideJSON(file) {       
        let page = await fetch(file);
        let res = await page.json();
        return res;
    }

    advancePosition() {
        if (++this.pos < this.input.celexList.length) {
            return true;
        }
        this.pos = 0;
        return false;
    }

    get currentCelex() {
        return this.input.celexList[this.pos];
    }

    initCelexInfo(date) {
        if (this.output.celexInfo.hasOwnProperty(this.currentCelex)) {
            console.log(`Already parsed CELEX ${this.currentCelex}`);
            return false;
        }
        
        // if date is returned the file is in  HTML and shouls be good
        // for HTML pasing if not it could be PDF an needs PDF parsing
        this.output.celexInfo[this.currentCelex] = {
            date: date ,
            varieties: [],
            comments: ""
        };
        return true;
    }

    registerVariety(variety) {
        if (!this.output.celexInfo[this.currentCelex].varieties.includes(variety)) {
            this.output.celexInfo[this.currentCelex].varieties.push(variety);
            return true;
        } else {    
            console.log(
                `Already have celexInfo report for ${variety} for CELEX ${this.currentCelex}`);
            return false;
        }
    }

    varietyInUse (variety) {  
        if (!this.output.siv.hasOwnProperty(variety)) {         
            // prepare SIV for variety
            this.output.siv[variety] = {};
        }
        else if (this.output.siv[variety].hasOwnProperty((this.currentCelex))) {
            // already covered this variety for this celex
            console.log(`Already have SIV report for ${variety} for CELEX ${this.currentCelex}`);     
        }
    }

    findVariety (txt) {
        // can we find CN?
        const CNs = this.input.CNs;
        var variety = Object.keys(CNs)[Object.values(CNs).findIndex(x => x.flat().includes(txt))];
        if (variety != undefined) {  
            if (this.varietyInUse(variety)) {
                // already have data for this. Something went wrong
                variety = undefined;   
            }
        } else {
            // log it 
            // console.log(`Unable to find variety with code: ${txt}`);
        }
        return variety;
    }

    findCountry(txt) {
        let retVal = {
            variety: undefined,
            countryKey: undefined
        }

        // could be CN code or, on older files, code for country;
        if (txt.length == 2) {
            let iText = this.input.countries.map(i=> i[0]).indexOf(txt);
            if (iText != -1) {
                retVal.countryKey = this.input.countries[iText][2];
            }
            else{
                // unknown 2 letter code ignore                        
                // fail; 
            }
        }
        else if (txt.length == 3) {
            let iText = this.input.countries.map(i=> i[1]).indexOf(txt);
            if (iText != -1) {
                retVal.countryKey = this.input.countries[iText][2];
            }
        }
        else {
            retVal.variety = this.findVariety(txt);
        }
        return retVal;
    }

    storeRecord(variety, sivRecord) {

        // ensure this variey exists in the output.siv object
        // registerVariety fails if the variety has already
        // bee reported on for this CELEX
        if (this.registerVariety(variety)) {
            this.output.siv[variety][this.currentCelex]= sivRecord;
        
            // store to fireBase as a backup in the cloud
            this.fireBaseDB.saveRecord(this.currentCelex, variety, sivRecord);
        }
    }

    incrementParsedCount() {
        return ++this.parsedCount;
    }

    get currentVarietyCount()
    {
        return this.output.celexInfo[this.currentCelex].varieties;
    }

    saveOutput() {
        this.completedOutput = this.output;
        this.reset();   
        console.log("Job done");
        this.fileStore.save(this.completedOutput, DataConfig.outputFileName);
    }
};
