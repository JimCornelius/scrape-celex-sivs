import GenericSivParser from "./GenericSivParser.js"

// HtmlSivParser --
export default class HtmlSivParser extends GenericSivParser {
    constructor(celexParser, sivStorage, frameWrapper) {
        // don't overuse constructor, save for initiate function
        super(celexParser);
        this.reset();
        this.sivStorage = sivStorage;
        this.frameWrapper = frameWrapper;
    }

    reset() {
        return this;
    }


    // this should be in the HTML parser
    varietyFromItem (item) {
        let txt = GenericSivParser.fixUpTextItem(item); 
        // if two or three characters it's a country code. Not interested
        if (txt.length != 2 && txt.length != 3) {
            return this.sivStorage.findVariety(txt);
        }
    }

    initDescendants() {
        this.descendants = Array.from(this.frameWrapper.queryElementInFrameAll("*")); 
        return this.descendants;
    }

    processKeyAndValues(entry) {
        let keySet = false;
        let cls = this.descendants[entry.position].className;
        if (cls != "") {
            let txt = GenericSivParser.fixUpTextItem(this.descendants[entry.position]); 
            if(cls == "tbl-cod") {
                // could be the tag for another variety
                // or key for country
                let res = GenericSivParser.isKeyText(txt);
                if (res.isKey) {
                    entry.key = txt;
                    keySet = true;
                }
                else if (res.done) {
                    // done for this variety
                    entry.done = true;
                }
            } else if (cls == "tbl-num") { // check 
                entry.value = txt;
            } else if (cls == "tbl-txt") {
                if (entry.key == undefined) {
                    entry.key = txt;
                    keySet = true;
                } else {
                    entry.value = txt;
                }
            }
            if (keySet) {
                let countries = this.sivStorage.input.countries;
                if (entry.key.length == 2) {
                    let iText = countries.map(i=> i[0]).indexOf(txt);
                    if (iText != -1) {
                        entry.key = countries[iText][2];
                    } else {
                        console.log(`Unknown 2 letter country code ${entry.key} ignored`);                        
                    }
                }
                else if (entry.key.length == 3) {
                    if (entry.key != "MGB") {
                        let iText = countries.map(i=> i[1]).indexOf(txt);
                        if (iText != -1) {
                            entry.key = countries[iText][2];
                        } else {
                            console.log(`Unknown 3 letter country code [${entry.key}] ignored`);                        
                        }
                    }
                    // else it's MGB ... dealt with as a special case
                } else {
                    console.log(`Invalid potential key [${entry.key}] ignored`);                        
                } 
                         
            }
        }
    }

    parseHTMLDate() {
        let rawDate = this.frameWrapper.queryElementInFrame(".hd-date");
        if (rawDate != undefined) { 
            return rawDate.textContent.replace(/\s/g, '').replace(/\./g, '/');
        }
        // else return undefined
    }

    getCnElements() { 
        return this.frameWrapper.queryElementInFrameAll(".tbl-cod");
    };

    setEntryInRecord(sivRecord, key, value) {
        if (key in sivRecord) {
            console.log("duplicate key");              
        }
        else {
            sivRecord[key] = value;
        } 
    }

    parseHTML(date) {
        this.sivStorage.initCelexInfo(date);
        this.initDescendants();
        let elements = this.getCnElements();
        // iterate through all elements
        for(let item of elements) {
            let variety = this.varietyFromItem(item);
            
            // on finding a new variety
            // Is this one of the varieties selected to be reported on? 
            if (GenericSivParser.selectedVarieties.includes(variety)) {
               
                // sivRecord will contain all prices, for this variety
                // for this CELEX
                let sivRecord = {};

                let entry = {
                    position: this.descendants.indexOf(item),
                    key: undefined,
                    value: undefined,
                    done: false
                }
            
                // till the end of this variety (by finding the next one)
                // or the end of page
                while (!entry.done && (++entry.position < this.descendants.length)) {
                    
                    // till we run out of elements to check
                    // entry is updated on each iteration  
                    this.processKeyAndValues(entry);

                    if (entry.value != undefined){
                        if (entry.key == "MGB") {
                            // Maghreb (MGB) countries
                            this.setEntryInRecord(sivRecord, "Algeria", entry.value);
                            this.setEntryInRecord(sivRecord, "Morocco", entry.value);
                            this.setEntryInRecord(sivRecord, "Tunisia", entry.value);
                        }
                        else  {
                            this.setEntryInRecord(sivRecord, entry.key, entry.value);
                        }                    
                        entry.key = undefined;
                        entry.value = undefined; 
                    }
                }
                this.sivStorage.storeRecord(variety, sivRecord);
            }
        }
        this.celexParser.completeParseCelex();
    }
}