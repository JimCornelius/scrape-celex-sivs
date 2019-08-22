import mongodb from "mongodb";

export default class Storage {

    constructor (Config) {
        this.parsedCount = 0;
        this.knownIDs = [];
        this.CNs = [];
        this.Config = Config;

        //  validate that the country code list has no anomalies
        const char2 = Config.countries.map(i => i[0]);
        const digit3 = Config.countries.map(i => i[1]);
        const excess2 = [...new Set(char2.filter(i => char2.indexOf(i) != char2.lastIndexOf(i)))];
        const excess3 = [...new Set(digit3.filter(i => digit3.indexOf(i) != digit3.lastIndexOf(i)))];

        //  validate that the country code list has no anomalies
        if (excess2.length) {
            console.log(`Fatal error: duplicate 2 letter country code(s): ${excess2.join(", ")}`);
            process.exit();  
        }
        if (excess3.length) {
            console.log(`Fatal error: duplicate 3 letter country code(s): ${excess3.join(", ")}`);
            process.exit();  
        }

        // for convenience concatenate variety CN codes where grouped 
        this.CNs = Object.fromEntries(
            Object.values(Config.cnCodes).map(
                (k,v) => [Object.keys(Config.cnCodes)[v],k.map(i => i.join("."))]
            )
        );

        return (async () => {
            this.db = (await mongodb.MongoClient.connect(
                Config.storage.mongo.url, Config.storage.mongo.clientOptions
            )).db(Config.storage.mongo.dbName);

            if (Config.storage.resetDB) {
                console.log("resetting database");
                this.sivDocs = this.db.collection(Config.storage.mongo.sivDocs);               
                await this.sivDocs.drop();
            }

            // sivID collection will already exist
            this.messageLog = this.db.collection('messageLog');
            this.knownIDs = this.db.collection(Config.storage.mongo.knownIDs);
            this.sivDocs = this.db.collection(Config.storage.mongo.sivDocs);
            this.sivDocs.createIndex( { "celexID": 1 }, { unique: true } );

            if (Config.storage.setResetLog) {
                console.log("resetting log");
                await this.messageLog.drop();
                this.messageLog = this.db.collection('messageLog');
            }
            return this; // when done
        })();
    }

    incrementParsedCount() {
        return ++this.parsedCount;
    }

    async checkDocExists(celexID) {
        return ((await this.sivDocs.countDocuments({celexID : celexID}, { limit: 1 })) > 0);
    }

    async completeParseCelex() {
        if (Object.keys(this.celexDoc.varieties).length < this.Config.minVarieties) {
            // suspiciously short list of varieties, could be a correction, or basd parsing.
            if (!(this.celexDoc.celexID in this.Config.dontIgnore)) {
                console.log(`Short list of varieties. Check whether it's a correction.`);
                process.exit(1);
            }
        }
        // store complete document to mongo an reset current doc
        await this.storeAsDoc(this.sivDocs, this.celexDoc);
        console.log(`${this.parsedCount} : completed: ${this.celexDoc.celexID};` +
        `varieties: ${Object.keys(this.celexDoc.varieties).length}`);
        this.celexDoc = undefined;
    }

    findVariety (txt) {
        // can we find CN?
        return Object.keys(this.CNs)[Object.values(this.CNs).findIndex(x => x.flat().includes(txt))];
    }

    findCountry(txt) {
        let countryKey =  undefined;
        // could be CN code or, on older files, code for country;
        if (txt.length == 2) {
            let iText = this.Config.countries.map(i=> i[0]).indexOf(txt);

            if (iText == -1) {
                // special case might be using the Greek Alphabet
                // could be some others?
                txt = txt.replace(String.fromCharCode(924),"M")
                        .replace(String.fromCharCode(922),"K");
                iText = this.Config.countries.map(i=> i[0]).indexOf(txt);
            }
            if (iText != -1) {
                countryKey = this.Config.countries[iText][2];
            } else if (/^[A-Z]+$/.test(txt)) {
                console.log(`Fatal Error: possible 2 letter country code ${txt} missed`);
                process.exit(1);
            }       
            // else unknown two char string ignored
        }
        else if (txt.length == 3) {
            let iText = this.Config.countries.map(i=> i[1]).indexOf(txt);
            if (iText != -1) {
                countryKey = this.Config.countries[iText][2];
            } else if (txt == "MGB") {
                    // special case the Maghreb agreement covers Algeria, 
                    // Morocco & Tunisia
                    countryKey = txt;
            } else if (/^[0-9]+$/.test(txt)) {
                console.log(`Fatal Error: possible 3 digit country code ${txt} missed.`);
                process.exit(1);
            } 
            // else unonown three char string ignored 
        }
        return countryKey;
    }

    async nextCelexDoc(first = false) {
        if (first) {
            this.setCelexIDCursor(this.Config.startPos);
        }
        return this.newCelexDoc(await this.cursor.next());
    }

    registerVariety (variety) {
        if (!this.celexDoc.varieties.hasOwnProperty(variety)) {
            this.celexDoc.varieties[variety] = {};
            return this.celexDoc.varieties[variety];
        }
        console.log(`attempting to create duplicate variety record for ` +
            `${variety} in CELEX:${this.celexDoc.celexID}`);
        
    }

    newCelexDoc(currentCelex) {
        this.celexDoc = {
            celexID: currentCelex.celexID,
            dateOfDoc: currentCelex.date,
            dateInJournal: undefined,
            varieties: {
            }
        }
        return this.celexDoc;
    }

    setCelexIDCursor(index = 0) {
        // cursor for the whole collection
        // shoud only be called once
        this.cursor = this.knownIDs.find({}).skip(index);
        this.cursor.batchSize(20);
        return this.cursor;
    }

    async log(msg) {
        // perhaps make a static functon in a logger class where 
        // logger has reference to instance of storage
        const timeStamp = new Date().toJSON();
        await this.messageLog.insertOne({timeStamp: timeStamp, msg: msg});
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
}
