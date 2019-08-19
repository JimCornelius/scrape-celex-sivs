import Config from "./Config.js"

export default class CommandLineArgs {

    static commands = {
        "-p": {command:this.setPos, consumes: 2, args:[], run: false},
        "-l": {command:this.setResetLog , consumes: 1, args:[], run: false},
        "-r": {command:this.setResetDB, consumes: 1, args:[], run: false},
        "-h": {command:this.setHeadless , consumes: 1, args:[], run: false}
    };

    static parseArgs() {
        let consumed = [0,1];
        process.argv.forEach((arg, i) => {
            if (!consumed.includes(i)) {
                if (Object.keys(this.commands).includes(arg)) {
                    consumed = consumed.concat([...Array(this.commands[arg].consumes).keys()].map(v =>v+i));
                    this.commands[arg].args = process.argv.slice(i+1,i+this.commands[arg].consumes);
                    this.commands[arg].run = true;
                }
            }
        });
    }

    static registerArgV() {
        Object.keys(this.commands).filter(k => this.commands[k].run == true).forEach( k =>{ 
            this.commands[k].command.apply(this, this.commands[k].args);
        });
    }

    static setHeadless() {
        Config.puppeteerConfig.headless = false;
    }

    static setPos(pos) {
        Config.starPos = pos;
    }

    static setResetLog() {
        // reset log before running
        Config.storage.resetLog = true;
    }

    static setResetDB() {
        // reset db before running
        Config.storage.resetDB = true;
    }
}