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

    processKeyAndValues(entries) {
        let keySet = false;
        let cls = this.descendants[entries.position].className;
        if (cls != "") {
            let txt = GenericSivParser.fixUpTextItem(this.descendants[entries.position]); 
            if(cls == "tbl-cod") {
                // could be the tag for another variety
                // or key for country
                let res = GenericSivParser.isKeyText(txt);
                if (res.isKey) {
                    entries.key = txt;
                    keySet = true;
                }
                else if (res.done) {
                    // done for this variety
                    entries.done = true;
                }
            } else if (cls == "tbl-num") { // check 
                entries.value = txt;
            } else if (cls == "tbl-txt") {
                if (entries.key == null) {
                    entries.key = txt;
                    keySet = true;
                } else {
                    entries.value = txt;
                }
            }
            if (keySet) {
                let countries = this.sivStorage.input.countries;
                if (entries.key != undefined && entries.key == "MGB") {
                    // special - Maghreb countries.
                    entries.key = ["Algeria","Morocco","Tunisia"];
                    entries.value = [entries.value, entries.value, entries.value];
                }
                else if (entries.key.length == 2) {
                    let iText = countries.map(i=> i[0]).indexOf(txt);
                    if (iText != -1) {
                        entries.key = countries[iText][2];
                    } else {
                        console.log(`Unknown 2 letter country code ${entries.key} ignored`);                        
                    }
                }
                else if (entries.key.length == 3) {
                    let iText = countries.map(i=> i[1]).indexOf(txt);
                    if (iText != -1) {
                        entries.key = countries[iText][2];
                    } else {
                        console.log(`Unknown 3 letter country code [${entries.key}] ignored`);                        
                    }
                } else {
                    console.log(`Invalid potential key [${entries.key}] ignored`);                        
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
  
                // could be multiple entries at each position
                // eg Maghreb (MGB) countries
                let entries = {
                    position: this.descendants.indexOf(item),
                    key: undefined,
                    value: undefined,
                    done: false
                }
            
                // till the end of this variety (by finding the next one)
                // or the end of page
                while (!entries.done && (++entries.position < this.descendants.length)) {
                    
                    // till we run out of elements to check
                    // entry is updated on each iteration  
                    this.processKeyAndValues(entries);

                    if (entries.value != undefined){
                        // processed as an array so turn single entry into an array
                        entries.key = [entries.key].flat();
                        entries.value = [entries.value].flat();
                        if ((entries.value.length != entries.key.length) ) {                            
                            console.log("entry key/value should be equal length arrays");
                        } else {
                            for(i in entries.value) {
                                if (entries.key[i] in sivRecord) {
                                    console.log("duplicate key");              
                                }
                                else {
                                    sivRecord[entries.key[i]] = entries.value[i];
                                }
                            }
                        }
                    }
                    entries.key = undefined;
                    entries.value = undefined; 
                }
                this.sivStorage.storeRecord(variety, sivRecord);
            }
        }
        this.celexParser.completeParseCelex();
    }
}