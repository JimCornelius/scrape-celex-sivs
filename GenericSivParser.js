// GenericSivParser --
export default class GenericSivParser {
    constructor() {
        // don't overuse constructor, save for initiate function
    }
             
    static fixUpTextItem(txt) {
        return txt
            .replace(/‘/g, '')
            .replace(/\s/g, '')
            .replace(/,/g, '.'); 
    }

    static isKeyText(txt) { 
        // could be CN code or, on older files, code for country;
        return (txt.length == 2 || txt.length == 3) ?  true : false;
    }

    varietyFromItemText (textItem) {
        let txt = GenericSivParser.fixUpTextItem(textItem); 
        // if two or three characters it's a country code. Not interested
        if (txt.length != 2 && txt.length != 3) {
            return this.storage.findVariety(txt);
        }
    }

    setEntryInRecord(sivRecord, key, value) {
        const keys = [key].flat();
        keys.forEach((k) => {
            if (k in sivRecord) {
                console.log(`Fatal error: duplicate country code in siv record: ${k}`)
                process.exit();            
            }
            else {
                sivRecord[key] = value;
            } 
        });
    }

    storeRecord(celexDoc, variety, sivRecord) {
        // ensure this variety doesn't already exist in
        // this.celexDoc.varieties object
        if (!celexDoc.varieties.hasOwnProperty(variety)) {
            celexDoc.varieties[variety] = sivRecord;
        } else {    
            console.log(
                `Already have report for ${variety} for CELEX ${this.celexDoc.celexID}`);
        }
    }
}