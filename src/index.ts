#!/usr/bin/env node
import {djaty} from '@djaty/djaty-nodejs';
import {nodejsAgentConfig} from './config/nodejsAgentConfig';

djaty.init(nodejsAgentConfig);

import * as commander from 'commander';

import {dealWithCommandActionAsPromise, toTitleCase} from './utils/utils';
import {getLogger} from './utils/logger';

export const logger = getLogger('cli');

const curCmd = process.argv[2];

// tslint:disable-next-line no-require-imports
const script = require(`./scripts/${curCmd}`);

const scriptInstance = new script[toTitleCase(curCmd)]();
const {command, description, action, optionList, version} = scriptInstance.initializationDetails;

const commanderInstance = commander
  .version(version)
  .command(command)
  .description(description);

optionList.forEach((option: string[]) => {
  commanderInstance.option.apply(commanderInstance, option);
});

commanderInstance.action(dealWithCommandActionAsPromise(action));

commander.parse(process.argv);
