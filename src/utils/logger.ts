import * as winston from 'winston';
import * as util from 'util';
import {SPLAT, MESSAGE} from 'triple-beam';

import {config} from '../config/config';

const {combine, colorize: winstonColorize, printf, timestamp, label} = winston.format;

export function getLogger(loggerLabel: string) {
  function formatObject(param: any) {
    if (typeof param === 'object') {
      return util.inspect(param);
    }

    return param;
  }

  const prepareMessage = winston.format((info) => {
    const splat = info[SPLAT] || [];
    const message = formatObject(info.message);
    const rest = splat.map(formatObject).join(' ');
    info.message = `${message} ${rest}`;

    return info;
  });

  const formatMessage = (info: any) =>
    `[${info.timestamp}][${info.label}][${info.level}]: ${formatObject(info.message)}`;

  function prodFormat() {
    const replaceErr = (info: any) => ({
      message: formatMessage(info),
      stack: info.stack,
    });

    const replaceObj = (info: any) => ({
      message: formatMessage(info),
    });

    const replacer = (key: any, value: any) =>
      value instanceof Error ? replaceErr(value) :
        typeof value === 'object' ? replaceObj(value) : value;

    const safeStringify = winston.format((info) => {
      // @TODO, Remove `toJSON` from the `info` as we don't support it as the moment.
      const safeInfo = Object.assign({}, info, {toJSON: undefined});
      info[MESSAGE] = JSON.stringify(safeInfo, replacer);

      return info;
    });

    // noinspection JSUnusedGlobalSymbols
    return combine(
      prepareMessage(),
      label({label: loggerLabel}),
      timestamp({format: 'YY-MM-DD HH:mm:SS'}),
      safeStringify(),
    );
  }

  function devFormat() {
    // `colorizer`: `combine(winstonColorize({all: true}), ...)` not working with `timestamp()`.
    const {colorize} = winstonColorize();

    const formatColorizedMessage = (info: any) => colorize(info.level, formatMessage(info));

    const formatError = (info: any) => colorize(info.level,
      `${formatColorizedMessage(info)}\n${info.stack}\n`);

    const format = (info: any) =>
      info instanceof Error ? formatError(info) : formatColorizedMessage(info);

    return combine(
      prepareMessage(),
      label({label: loggerLabel}),
      timestamp({format: 'YYYY-MM-DD HH:mm:SS'}),
      printf(format),
    );
  }

  const nodeEnv = process.env.NODE_ENV;
  const isDev = !nodeEnv || nodeEnv === 'development';
  const defaultFormat = isDev ? devFormat() : prodFormat();

  // Set Default formatter.
  config.logger.format = config.logger.format || defaultFormat;

  return (<any> winston).createLogger(config.logger);
}
