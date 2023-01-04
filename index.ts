import * as util from 'node:util';
import pc from 'picocolors';

type Decorator = (message: string) => string;

/**
 * Formats any content within curly braces in the given message using the given decorator function.
 * @param message - The message to format.
 * @param decorator - The decorator function to use.
 * @returns The formatted message.
 */
export function formatBraces(message: string, decorator: Decorator): string {
	return message.replace(/{(.*?)}/g, (_, p1) => decorator(p1));
}

export class Log {
	#loggingLevels: Set<string> = new Set(['info', 'warn', 'error', 'success']);

	/**
	 * Logs a message at the `info` level.
	 * @param message Message to log with optional format specifiers.
	 * @param args Arguments to use when formatting the message.
	 */
	info(message: string, ...args: string[]): void {
		this.#write(formatBraces(`[{i}] ${message}`, pc.cyan), ...args);
	}

	/**
	 * Logs a message at the `warn` level.
	 * @param message Message to log with optional format specifiers.
	 * @param args Arguments to use when formatting the message.
	 */
	warn(message: string, ...args: string[]): void {
		this.#write(formatBraces(`[{!}] ${message}`, pc.yellow), ...args);
	}

	/**
	 * Logs a message at the `error` level.
	 * @param message Message to log with optional format specifiers.
	 * @param args Arguments to use when formatting the message.
	 */
	error(message: string, ...args: string[]): void {
		this.#write(formatBraces(`[{x}] ${message}`, pc.red), ...args);
	}

	/**
	 * Logs a message at the `success` level.
	 * @param message Message to log with optional format specifiers.
	 * @param args Arguments to use when formatting the message.
	 */
	success(message: string, ...args: string[]): void {
		this.#write(formatBraces(`[{✓}] ${message}`, pc.green), ...args);
	}

	/**
	 * Adds a custom logging level.
	 * 
	 * @remarks
	 * The level must be a valid JavaScript identifier and cannot collide with
	 * the names of functions already defined on the Log class. Existing levels
	 * can be overwritten by calling this function with the same level name.
	 * 
	 * @param level - The level to add. Must be a valid JavaScript identifier.
	 * @param decorator - Optional decorator function.
	 */
	addLevel(level: string, decorator?: Decorator): void {
		if (this[level] === undefined || this.#loggingLevels.has(level)) {
			this[level] = (message: string, ...args: string[]): void => {
				if (decorator !== undefined)
					message = decorator(message);

				this.#write(message, ...args);
			};

			this.#loggingLevels.add(level);
		} else {
			throw new Error('Cannot create custom logging level with reserved name: ' + level);
		}
	}

	/**
	 * Write a message to the logging output.
	 * 
	 * @remarks
	 * The message and arguments are formatted using `util.format` before being sent
	 * to the logging output.
	 * 
	 * @param message - The message to log, optionally containing format specifiers.
	 * @param args - The arguments to use when formatting the message.
	 */
	#write(message: string, ...args: string[]): void {
		const output = util.format(message, ... args);
		process.stdout.write(output + '\n');
	}
}

const globalLogger = new Log();

export default globalLogger;
export const log = globalLogger;