import {djaty} from '@djaty/djaty-nodejs';
import * as glob from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import * as ora from 'ora';
import * as tar from 'tar';
import * as os from 'os';
import * as requestPromise from 'request-promise';

// tslint:disable-next-line no-require-imports
const urlRegex = require('url-regex');

import {CommandParams} from '../interfaces/commandParams';
import {config} from '../config/config';
import {logger} from '..';
import {ValidationError} from '../utils/validationError';
import {dealWithCommandActionAsPromise} from '../utils/utils';

interface UploadSourcemapCMDParams {
  apiKey: string;
  apiSecret: string;
  release: string;
  minifiedDir: string;
  projectRoot: string;
  endPoint?: string;
}

export class UploadSourcemap {
  static sourcemapApi = 'sourcemap';
  static abortSourcemapApi = 'abortUploadingSourcemap';
  static djatyPathPrefix = 'djaty';
  static sourcemapFileSuffix = '_sourcemap_files.tgz';

  initializationDetails: CommandParams;

  constructor() {
    this.initializationDetails = {
      command: 'uploadSourcemap',
      description: 'Upload project sourcemap files.',
      version: '1.0.0',
      optionList: [
        ['--api-key <key>', 'An API key for project'],
        ['--api-secret <secret>', 'An API secret for project'],
        ['--release <v>', 'when requesting to resolve a stack trace, we check the bug release' +
        'against current uploaded releases and if a release is matched, the stack trace will be' +
        ' resolved. So, if a bug is not configured with a release, it\'ll not be able to have ' +
        'its stack trace resolved. And due to the probability of having multiple devices running' +
        ' different releases concurrently, we let the user upload up to 5 releases per project.'],
        ['--minified-dir <path>', 'Path to the directory that contains the minified and ' +
        ' sourcemap files (I.e, `dist`). Only `.js` and `.map` files will be uploaded.'],
        ['--project-root <domain>', 'The path of the project root. It helps us locate the' +
        ' original files from the stack frame, e.g., http://example.com.'],
        ['--end-point [server]', 'The server URL The default is `djaty.com`' +
        ' (on-premises installations).'],
      ],
      action: this.commandAction.bind(this),
    };
  }

  async commandAction(cmd: UploadSourcemapCMDParams) {
    UploadSourcemap.validateOnCLIInput(cmd);

    const baseURL = cmd.endPoint || config.baseURL;
    const absolutePath = path.resolve(cmd.minifiedDir);
    const spinner = ora('Compressing sourcemap files').start();

    let minifiedFileListPaths: string[] = [];
    let isUploadReqFired = false;
    let isAbortReqFired = false;

    const osTmpDir = os.tmpdir();
    const djatyTmpPathDir = path.resolve(osTmpDir, UploadSourcemap.djatyPathPrefix);
    if (!fs.existsSync(djatyTmpPathDir)) {
      fs.mkdirSync(djatyTmpPathDir);
    }

    const uniquePrefix = (Math.random() * Date.now()).toString();
    const compressedFileName = path.resolve(djatyTmpPathDir,
      `${Date.now()}${UploadSourcemap.sourcemapFileSuffix}`);

    process.on('SIGINT', dealWithCommandActionAsPromise(async() => {
      UploadSourcemap.saveRemove(compressedFileName);
      if (!isUploadReqFired || isAbortReqFired) {
        spinner.stop();
        logger.info('Uploading stopped successfully.');
        process.exit();
      }

      isAbortReqFired = true;
      await requestPromise.put({
        url: `${baseURL}/${config.baseAPI}/${UploadSourcemap.abortSourcemapApi}`,
        body: {
          apiKey: cmd.apiKey,
          apiSecret: cmd.apiSecret,
          release: cmd.release,
          uniquePrefix,
        },
        headers: {
          'djaty-escape-html-entities': true,
        },

        // Automatically stringifies the body to JSON,
        json: true,
        timeout: config.requestTimeout,
      }).catch(err => {
        spinner.stop();
        let errMsg = '';
        if (err.statusCode === 400) {
          // Handle AJV validation errors.
          const error = JSON.parse(err.error.replace(')]}\',\n', ''));
          if (error.code === 'NOT_RELEASE_TO_ABORT') {
            // noinspection JSIgnoredPromiseFromCall
            djaty.trackBug(err);
            return;
          }

          errMsg = 'Validation error: \n\t';
          const ignoredError = 'Unable to abort release. Release doesn\'t found.';

          errMsg += error.errors ? error.errors
            .map((errItem: {message: string}) => errItem.message)
            .join('\n\t') : '';

          throw new ValidationError(`Unable to stop uploading sourcemap files: ${errMsg}`);
        } else {
          errMsg += 'Something went wrong and a bug has been reported and will be resolved soon.';
        }

        logger.error(`Unable to stop uploading sourcemap files: ${errMsg}`);
        throw err;
      });

      spinner.stop();
      logger.info('Uploading stopped successfully.');
      process.exit();
    }));

    try {
      // `*` Matches 0 or more characters in a single path portion
      // `@(*.js|*.js.map)` Matches exactly one of the patterns provided
      // `**` If a "globstar" is alone in a path portion, then it matches zero
      // or more directories and subdirectories searching for matches.
      minifiedFileListPaths = glob.sync('**/@(*.js|*.js.map)',
        {cwd: absolutePath});
    } catch (err) {
      spinner.stop();

      if (err.code === 'EACCES') {
        throw new ValidationError(err);
      }

      throw err;
    }

    try {
      await tar.c({
          gzip: true,
          file: compressedFileName,
          cwd: absolutePath,
        }, minifiedFileListPaths,
      );
    } catch (err) {
      spinner.stop();
      logger.error('Unable to compress sourcemap files.', err);
      UploadSourcemap.saveRemove(compressedFileName);

      throw err;
    }

    spinner.stopAndPersist({text: 'The sourcemap files compressed successfully.', symbol: '#'});
    spinner.start('Uploading sourcemap files to Djaty...');

    const uploadFormData = {
      apiKey: cmd.apiKey,
      apiSecret: cmd.apiSecret,
      release: cmd.release,
      projectRoot: cmd.projectRoot,

      // I submit this data as a `formData` so it always been converted to `string` and I reuse the
      // same upcoming fields in normal request to abort current upload so,
      // I convert use them a string in the first place.
      maxFiles: minifiedFileListPaths.length.toString(),
      uniquePrefix,
      sourcemapFiles: fs.createReadStream(compressedFileName),
    };

    isUploadReqFired = true;

    await requestPromise.post({
      url: `${baseURL}/${config.baseAPI}/${UploadSourcemap.sourcemapApi}`,
      formData: uploadFormData,
      timeout: config.requestTimeout,
      headers: {
        'djaty-escape-html-entities': true,
      },
    }).catch(async err => {
      let errMsg = '';
      UploadSourcemap.saveRemove(compressedFileName);
      spinner.stop();

      // Handle request errors
      const requestErrorsCodes: {[p: string]: string} = {
        UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'Current connection to Djaty is secured ' +
          'with a self-signed certificate but the current config has not passed the `server`' +
          'object with a `ca` (Certification Authority) property!',
        CERT_HAS_EXPIRED: 'The certificate  of the HTTPS connection to djaty has been expired!',
        ECONNREFUSED: 'Make sure `server` config is correct',
        ENOTFOUND: 'Make sure `server` config is correct',
        ECONNRESET: 'Client network socket disconnected before secure TLS connection' +
          ' was established',
      };

      if (err.error && err.error.code && requestErrorsCodes[err.error.code]) {
        errMsg += requestErrorsCodes[err.error.code];
        throw new ValidationError(`Unable to upload sourcemap files: ${errMsg}.`);
      }

      // Handle nginx errors
      const nginxErrors: {[p: number]: string} = {
        301: 'Redirection are not supported',
        404: '404 Not Found',
        413: 'Uploaded sourcemap file is too large, It should be less than 15MB',
      };

      if (err.statusCode && nginxErrors[err.statusCode]) {
        errMsg += nginxErrors[err.statusCode];
        throw new ValidationError(`Unable to upload sourcemap files: ${errMsg}.`);
      }

      // Handle server errors
      const serverErrors: {[p: number]: Function} = {
        400: (error: any) => 'Validation error: \n\t' + error.errors
          .map((errItem: {message: string}) => errItem.message).join('\n\t'),
        428: (error: any) => error.message,
      };

      if (err.statusCode && serverErrors[err.statusCode]) {
        const error = JSON.parse(err.error.replace(')]}\',\n', ''));
        errMsg += serverErrors[err.statusCode](error);

        throw new ValidationError(`Unable to upload sourcemap files: ${errMsg}.`);
      }

      errMsg += 'Something went wrong and a bug has been reported and will be resolved soon';

      logger.error(`Unable to upload sourcemap files: ${errMsg}.`);
      throw err;
    });

    UploadSourcemap.saveRemove(compressedFileName);
    spinner.stop();
    logger.info('Uploading finished successfully. Please wait few minutes for' +
      ' the uploaded files to be processed.');
  };

  private static validateOnCLIInput(cmd: UploadSourcemapCMDParams | string) {
    if (typeof cmd === 'string') {
      throw new ValidationError(`Invalid args params: '${cmd}'`);
    }

    if (!cmd.apiKey || !cmd.apiSecret || !cmd.release || !cmd.minifiedDir || !cmd.projectRoot) {
      throw new ValidationError('Command params (apiKey, apiSecret,' +
        ' release, projectRoot and minifiedDir) are required');
    }

    if (!fs.existsSync(cmd.minifiedDir)) {
      throw new ValidationError('Command param `minifiedDir` is not exists');
    }

    if (!fs.lstatSync(cmd.minifiedDir).isDirectory()) {
      throw new ValidationError('Command param `minifiedDir` should be directory path');
    }

    const urlRegexValidator = urlRegex({exact: true, strict: false});

    if (!urlRegexValidator.test(cmd.projectRoot)) {
      throw new ValidationError('Invalid `project-root`.' +
        ' You should add valid url like `http://your-domain.com`');
    }

    if (cmd.endPoint && !urlRegexValidator.test(cmd.endPoint)) {
      throw new ValidationError('Invalid `end-point`.' +
        ' You should add valid url like `http://your-domain.com`');
    }
  };

  private static saveRemove(path: string) {
    return fs.existsSync(path) && fs.unlinkSync(path);
  }
}
