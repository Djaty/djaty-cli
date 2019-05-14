import * as path from 'path';
import * as winston from 'winston';

export interface CLIConfig {
  baseURL: string;
  baseAPI: string;
  requestTimeout: number;
  logger: winston.LoggerOptions;
}

export const config: CLIConfig = {
  baseURL: 'https://djaty.com',
  baseAPI: 'api/unauth/cli',
  requestTimeout: 1000 * 60 * 1000,
  logger: {
    exitOnError: false,
    transports: [
      new winston.transports.File({
        filename: path.resolve(__dirname, '../../logs/all-logs.log'),
        level: 'debug',
        handleExceptions: false,
        maxsize: 5242880, // 5MB
        maxFiles: 10,
      }),
      new winston.transports.Console({
        level: 'debug',
        handleExceptions: false,
      }),
    ],
  },
};
