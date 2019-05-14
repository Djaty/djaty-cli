import {logger} from '../index';
import {ValidationError} from './validationError';

/**
 * Deal with command.action as promise to handle action callback as a promise and
 * catch its errors to avoid `Unhandled Rejection errors`
 *
 * @param commandFn
 */
export function dealWithCommandActionAsPromise(commandFn: (...args: any[]) => Promise<void>) {
  return async (...args: any[]) => {
    try {
      await commandFn(...args);
    } catch (err) {
      if (err instanceof ValidationError) {
        logger.error(err.message);

        return;
      }

      throw err;
    }
  };
}

export function toTitleCase(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}
