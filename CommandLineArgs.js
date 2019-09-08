import Config from './Config.js';

export default class CommandLineArgs {
    static commands = {
      '-c': {
        command: () => { Config.storage.setResetCelexDB = true; },
        consumes: 1,
        args: [],
        run: false,
      },
      '-d': {
        command: () => { Config.storage.setResetDocDB = true; },
        consumes: 1,
        args: [],
        run: false,
      },
      '-f': {
        command: () => { Config.parse.search = true; },
        consumes: 1,
        args: [],
        run: false,
      },
      '-h': {
        command: () => { Config.puppeteerConfig.headless = false; },
        consumes: 1,
        args: [],
        run: false,
      },
      '-l': {
        command: () => { Config.storage.resetLog = true; },
        consumes: 1,
        args: [],
        run: false,
      },
      '-p': {
        command: (pos) => { Config.gatherer.startPage = pos; },
        consumes: 2,
        args: [],
        run: false,
      },
      '-s': {
        command: (pos) => { Config.skipToPos = pos; },
        consumes: 2,
        args: [],
        run: false,
      },
      '-x': {
        command: () => { Config.puppeteerConfig.parse.celex = false; },
        consumes: 1,
        args: [],
        run: false,
      },
    };

    static parseArgs() {
      let consumed = [0, 1];
      process.argv.forEach((arg, i) => {
        if (!consumed.includes(i)) {
          if (Object.keys(this.commands).includes(arg)) {
            consumed = consumed
              .concat([...Array(this.commands[arg].consumes).keys()].map((v) => v + i));
            this.commands[arg].args = process.argv.slice(i + 1, i + this.commands[arg].consumes);
            this.commands[arg].run = true;
          }
        }
      });
    }

    static registerArgV() {
      Object.keys(this.commands).filter((k) => this.commands[k].run === true).forEach((k) => {
        this.commands[k].command.apply(this, this.commands[k].args);
      });
    }
}
