/* eslint-disable no-control-regex */
// GenericSivParser --
export default class GenericSivParser {
  static fixUpTextItem(txt) {
    // some known OCR errors
    return txt
      .replace('134,7 ,', '134.7')
      .replace('5.5,1', '55.1')
      .replace('69f 9', '69.9')
      .replace('77?', '77,9')
      .replace('77β', '77,9')
      .replace('55,6.', '55.6')
      .replace('1ob,U', '186.0')
      .replace('MZ', '512')
      .replace('U/ UZUU3i', '07020035')
      .replace('Ujz', '052')
      .replace('4Z,4­', '47.4')
      .replace('u7p', '119.8')
      .replace('106 , S', '106.8')
      .replace('55, S', '55.8')
      .replace('0S8', '068')
      .replace('57?', '57.9')
      .replace('sip', '51.9')
      .replace('54,8 .', '54.8')
      .replace('61)0', '61.0')
      .replace('87,1 ,', '87.1')
      .replace('69 \'j', '69.1')
      .replace('53 8', '53.8')
      .replace(/\u039C\u039A/g, 'MK')
      .replace(/‘/g, '')
      .replace(/^\. /, '')
      .replace(/\s/g, '')
      .replace(/>/g, '.')
      .replace(/,/g, '.')
      .replace(/\.\./g, '.')
      .replace(/ß/g, '.9')
      .replace(/-/g, '')
      .replace(/[^\x00-\x7F]/g, ''); // extraneous characters
  }

  static isKeyText(txt) {
    // could be CN code or, on older files, code for country;
    return (txt.length === 2 || txt.length === 3);
  }

  static trimVarietyCode(textItem) {
    return GenericSivParser.fixUpTextItem(textItem).replace(/[^0-9.]/g, '');
  }

  varietyFromText(textItem) {
    if (textItem !== undefined) {
      const txt = GenericSivParser.trimVarietyCode(textItem);
      // if two or three characters it's a country code. Not interested
      if (txt.length !== 2 && txt.length !== 3) {
        return this.storage.findVariety(txt);
      }
    }
    return undefined;
  }

  setEntryInRecord(sivRecord, key, value) {
    let newValue = value;
    const keys = [key].flat();
    keys.forEach((k) => {
      if (k in sivRecord) {
        if (this.celexDoc.celexID in this.storage.Config.ErrCorrection.knownDuplicateCountry) {
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
