/* eslint-disable no-control-regex */
// GenericSivParser --
export default class GenericSivParser {
//   constructor() {
//     // don't overuse constructor, save for initiate function
//     }

  static fixUpTextItem(txt) {
    return txt
      .replace(/‘/g, '')
      .replace(/‘/g, '')
      .replace(/\s/g, '')
      .replace(/,/g, '.')
      .replace(/ß/g, '.9') // known typo
      .replace(/[^\x00-\x7F]/g, ''); // extraneous characters
  }

  static isKeyText(txt) {
    // could be CN code or, on older files, code for country;
    return (txt.length === 2 || txt.length === 3);
  }

  varietyFromText(textItem) {
    const txt = GenericSivParser.fixUpTextItem(textItem);
    // if two or three characters it's a country code. Not interested
    if (txt.length !== 2 && txt.length !== 3) {
      return this.storage.findVariety(txt);
    }
    return undefined;
  }

  setEntryInRecord(sivRecord, key, value) {
    let newValue = value;
    const keys = [key].flat();
    keys.forEach((k) => {
      if (k in sivRecord) {
        if (this.celexDoc.celexID in this.storage.Config.knownDuplicateCountry) {
          // use the lower price
          newValue = Math.min(value, sivRecord[key]);
        } else {
          console.log(`Fatal error: duplicate country code in siv record: ${k}`);
          process.exit();
        }
      }
      sivRecord[key] = newValue;
    });
  }

  storeRecord(celexDoc, variety, sivRecord) {
    // ensure this variety doesn't already exist in
    // this.celexDoc.varieties object
    if (!celexDoc.varieties.hasOwnProperty(variety)) {
      celexDoc.varieties[variety] = sivRecord;
    } else {
      console.log(`Faltal error. Already have report for ${variety} for CELEX ${this.celexDoc.celexID}`);
    }
  }
}
