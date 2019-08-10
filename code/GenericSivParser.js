// GenericSivParser --
export default class GenericSivParser {
    constructor(celexParser) {
        this.celexParser = celexParser;
        // don't overuse constructor, save for initiate function
        this.reset();
    }

    reset() {
        return this;
    }

    static fixUpTextItem(item) {
        return GenericSivParser.fixUpText(item.textContent);
    }
             
    static fixUpText(txt) {
        return txt
            .replace(/‘/g, '')
            .replace(/\s/g, '')
            .replace(/,/g, '.'); 
    }

    static isKeyText(txt) {
        let result = {
            isKey: false,
            done: false
        };
        
        // could be CN code or, on older files, code for country;
        if (txt.length == 2 || txt.length == 3) {
          result.isKey = true;
        }
        else {
          // some other fruit_veg
          result.done = true;
        }
        return result;
    }
}