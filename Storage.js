import mongodb from "mongodb";

export default class Storage {

    constructor (Config) {
        this.parsedCount = 0;
        this.knownIDs = [];
        this.CNs = [];
        this.Config = Config;

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

            if (Config.storage.reset) {
                console.log("resetting database");                 
                await this.sivRecords.drop();
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
            
            console.log("Created ");

            // todo: test whether or not returning this is actually required
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
            if (iText != -1) {
                countryKey = this.Config.countries[iText][2];
            }
            else{
                // unknown 2 letter code ignore                        
                // fail; 
            }
        }
        else if (txt.length == 3) {
            let iText = this.Config.countries.map(i=> i[1]).indexOf(txt);
            if (iText != -1) {
                countryKey = this.Config.countries[iText][2];
            }
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
        console.log(`attempting to create duplicate variety record for` 
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
        this.cursor = this.knownIDs.find({}).skip(index);
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