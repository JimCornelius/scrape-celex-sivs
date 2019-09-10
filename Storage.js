import EventEmitter from 'events';
import mongodb from 'mongodb';

export default class Storage {
  // Factory method
  static async createStorage(config) {
    const storage = new Storage(config);
    return storage.prepareMongo();
  }

  constructor(Config) {
    this.emitter = new EventEmitter();
    this.celexStandardIDs = [];
    this.celexNonStandardIDs = [];
    this.rejected = 0;
    this.parsedCount = 0;

    this.CNs = [];
    this.Config = Config;
    this.validateCountryCodes();
  }

  validateCountryCodes() {
    //  validate that the country code list has no anomalies
    const char2 = this.Config.jsonData.countries.map((i) => i[0]);
    const digit3 = this.Config.jsonData.countries.map((i) => i[1]);
    const excess2 = [...new Set(char2.filter((i) => char2.indexOf(i) !== char2.lastIndexOf(i)))];
    const excess3 = [...new Set(digit3.filter((i) => digit3.indexOf(i) !== digit3.lastIndexOf(i)))];

    //  validate that the country code list has no anomalies
    if (excess2.length) {
      console.log(`Fatal error: duplicate 2 letter country code(s): ${excess2.join(', ')}`);
      process.exit();
    }
    if (excess3.length) {
      console.log(`Fatal error: duplicate 3 letter country code(s): ${excess3.join(', ')}`);
      process.exit();
    }
  }

  async prepareMongo() {
    this.mongoClient = await mongodb.MongoClient.connect(
      this.Config.storage.mongo.url, this.Config.storage.mongo.clientOptions,
    );

    this.db = this.mongoClient.db(this.Config.storage.mongo.dbName);

    this.standardIDs = this.db.collection(this.Config.storage.mongo.standardIDs);
    this.nonStandardIDs = this.db.collection(this.Config.storage.mongo.nonStandardIDs);

    this.sivDocs = this.db.collection(this.Config.storage.mongo.sivDocs);
    this.sivDocs.createIndex({ celexID: 1 }, { unique: true });

    if (this.Config.storage.setResetCelexDB) {
      console.log('resetting Celed ID list');
      await this.standardIDs.drop();
      await this.nonStandardIDs.drop();
      this.standardIDs.createIndex({ 'celexID': 1 }, { unique: true });
      this.nonStandardIDs.createIndex({ 'celexID': 1 }, { unique: true });
    }

    if (this.Config.storage.setResetDocDB) {
      console.log('resetting database');
      this.sivDocs = this.db.collection(this.Config.storage.mongo.sivDocs);
      this.sivDocs.createIndex({ 'celexID': 1 }, { unique: true });
      await this.sivDocs.drop();
    }

    this.messageLog = this.db.collection('messageLog');
    if (this.Config.storage.resetLog) {
      console.log('resetting log');
      await this.messageLog.drop();
      this.messageLog = this.db.collection('messageLog');
    }

    console.log('Created collections with unique index for celexID property');
    return this; // when done
  }

  async close() {
    this.mongoClient.close();
  }

  incrementParsedCount() {
    this.parsedCount++;
    return this.parsedCount;
  }

  async checkSivDocExists(celexID) {
    return ((await this.sivDocs.countDocuments({ celexID }, { limit: 1 })) > 0);
  }


  async checkCelexIDExists(celexDoc) {
    const { celexID } = celexDoc;
    return (
      (await this.standardIDs.countDocuments({ celexID }, { limit: 1 }) > 0)
    || (await this.nonStandardIDs.countDocuments({ celexID }, { limit: 1 }) > 0));
  }

  async completeParseCelex() {
    if (Object.keys(this.celexDoc.varieties).length < this.Config.minVarieties) {
      // suspiciously short list of varieties, could be a correction, or basd parsing.
      if (!(this.celexDoc.celexID in this.Config.dontIgnore)) {
        console.log('Short list of varieties. Check whether it\'s a correction.');
        process.exit(1);
      }
    }
    // store complete document to mongo an reset current doc
    await this.storeAsDoc(this.sivDocs, this.celexDoc);
    console.log(`${this.parsedCount} : completed: ${this.celexDoc.celexID};`
        + `varieties: ${Object.keys(this.celexDoc.varieties).length}`);
    this.celexDoc = undefined;
  }

  findVariety(txt) {
    // can we find CN?
    return Object.keys(this.CNs)[Object.values(this.CNs).findIndex((x) => x.flat().includes(txt))];
  }

  findCountry(txtIN) {
    // special case might be using the Greek Alphabet
    // could be some others?
    const txt = txtIN
      .replace(String.fromCharCode(924), 'M')
      .replace(String.fromCharCode(922), 'K')
      .replace(/[\W_]+/g, ''); // extraneous characters

    const index2 = 2;
    let countryKey;
    // could be CN code or, on older files, code for country;
    if (txt.length === 2) {
      const iText = this.Config.jsonData.countries.map((i) => i[0]).indexOf(txt);
      if (iText !== -1) {
        countryKey = this.Config.jsonData.countries[iText][index2];
      } else if (/^[A-Z]+$/.test(txt)) {
        console.log(`Fatal Error: possible 2 letter country code ${txt} missed`);
        process.exit(1);
      }
      // else unknown two char string ignored
    } else if (txt.length === 3) {
      const iText = this.Config.jsonData.countries.map((i) => i[1]).indexOf(txt);
      if (iText !== -1) {
        countryKey = this.Config.jsonData.countries[iText][index2];
      } else if (txt === 'MGB') {
        // special case the Maghreb agreement covers Algeria,
        // Morocco & Tunisia
        countryKey = txt;
      } else if (txt === '036') {
        // known transcription error
        countryKey = '039';
      } else if (/^[0-9]+$/.test(txt)) {
        console.log(`Fatal Error: possible 3 digit country code ${txt} missed.`);
        process.exit(1);
      }
      // else unknown three char string ignored
    }
    return countryKey;
  }

  async nextCelexDoc() {
    return this.newCelexDoc(await this.cursor.next());
  }

  getVarietySiv(variety) {
    let retVal;
    if (this.celexDoc.varieties.hasOwnProperty(variety)) {
      retVal = this.celexDoc.varieties[variety];
    }
    return retVal;
  }

  registerVariety(variety) {
    if (!this.celexDoc.varieties.hasOwnProperty(variety)) {
      this.celexDoc.varieties[variety] = {};
      return this.celexDoc.varieties[variety];
    }
    console.log(`attempting to create duplicate variety record for ${variety}`
        + ` in CELEX:${this.celexDoc.celexID}`);
    return undefined;
  }

  newCelexDoc(currentCelex) {
    if (currentCelex !== null) {
      this.celexDoc = {
        celexID: currentCelex.celexID,
        dateOfDoc: currentCelex.date,
        dateInJournal: undefined,
        varieties: {
        },
      };
    } else {
      this.celexDoc = undefined;
    }
    return this.celexDoc;
  }

  async knownCelexCount() {
    return this.standardIDs.find({}).count();
  }

  async fileCount() {
    return this.sivDocs.find({}).count();
  }

  setCelexIDCursor(index = 0) {
    // cursor for the whole collection
    // should only be called once
    this.cursor = this.standardIDs.find({}).skip(index);
    this.cursor.batchSize(20);
    return this.cursor;
  }

  async log(msg) {
    // perhaps make a static functon in a logger class where
    // logger has reference to instance of storage
    const timeStamp = new Date().toJSON();
    await this.messageLog.insertOne({ timeStamp, msg });
    console.log(`${timeStamp} ${msg}`);
  }

  async storeAsDoc(collection, doc) {
    if (doc) {
      try {
        await collection.insertOne(doc);
      } catch (error) {
        console.log(error.errmsg);
        // should log errors in an error log too
        this.log(error.errmsg);
      }
    }
  }

  async storeAsDocs(collection, records) {
    if (records.length) {
      try {
        await collection.insertMany(records, { ordered: false });
      } catch (error) {
        // should log errors in an error log too
        const eMsg = `insertMany() completed: ${error.result.result.nInserted}; incomplete: ${error.result.result.writeErrors.length}`;
        this.log(eMsg);
        error.result.getWriteErrors().map((e) => e.errmsg).forEach((msg) => this.log(msg));
      }
    }
  }

  static isStandardFormat(celexID) {
    return (
      celexID
      && celexID.includes('R')
      && !(celexID.includes('D')
        || celexID.includes('C')
        || celexID.includes('('))
    );
  }

  async storeCelexIDs(celexIDs, rejects) {
    // this is just storing as an array
    // possibly don't rally need this.
    this.rejected += rejects;
    celexIDs.forEach((x) => {
      if (Storage.isStandardFormat(x.celexID)) {
        this.celexStandardIDs.push(x.celexID);
      } else if (x.celexID) {
        this.celexNonStandardIDs.push(x.celexID);
      }
    });

    await this.storeAsDocs(this.standardIDs, celexIDs
      .filter((x) => Storage.isStandardFormat(x.celexID)));

    await this.storeAsDocs(this.nonStandardIDs, celexIDs
      .filter((x) => !Storage.isStandardFormat(x.celexID)));

    const standard = await this.standardIDs.countDocuments();
    const nonStandard = await this.nonStandardIDs.countDocuments();

    console.log(
      `Page: ${this.currentPage} Total saved records:${this.rejected + standard + nonStandard} `
            + `of ${this.nResults}; standard: ${standard}; non-standard: ${nonStandard}; `
            + `${this.rejected} rejected.`,
    );
  }
}
