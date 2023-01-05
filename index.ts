import * as util from 'node:util';
import pc from 'picocolors';

type Decorator = (message: string) => string;
type StreamTargets = Set<string> | null;

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
	#streams: Map<NodeJS.WritableStream, StreamTargets> = new Map();
	#defaultStream?: NodeJS.WritableStream;

	constructor() {
		this.pipe(process.stdout, ['info', 'success'], true);
		this.pipe(process.stderr, ['warn', 'error']);
	}

	/**
	 * Logs a message at the `info` level.
	 * @param message Message to log with optional format specifiers.
	 * @param args Arguments to use when formatting the message.
	 */
	info(message: string, ...args: string[]): void {
		this.#write('info', formatBraces(`[{i}] ${message}`, pc.cyan), ...args);
	}

	/**
	 * Logs a message at the `warn` level.
	 * @param message Message to log with optional format specifiers.
	 * @param args Arguments to use when formatting the message.
	 */
	warn(message: string, ...args: string[]): void {
		this.#write('warn', formatBraces(`[{!}] ${message}`, pc.yellow), ...args);
	}

	/**
	 * Logs a message at the `error` level.
	 * @param message Message to log with optional format specifiers.
	 * @param args Arguments to use when formatting the message.
	 */
	error(message: string, ...args: string[]): void {
		this.#write('error', formatBraces(`[{x}] ${message}`, pc.red), ...args);
	}

	/**
	 * Logs a message at the `success` level.
	 * @param message Message to log with optional format specifiers.
	 * @param args Arguments to use when formatting the message.
	 */
	success(message: string, ...args: string[]): void {
		this.#write('success', formatBraces(`[{✓}] ${message}`, pc.green), ...args);
	}

	/**
	 * Add an output stream to log messages to.
	 * 
	 * @remarks
	 * If `levels` is omitted, the stream will receive messages of all levels.
	 *  
	 * @param output - The output stream to write to.
	 * @param levels - Optional array of levels to write to the output stream.
	 * @param setDefault - Whether to set this stream as the default output.
	 */
	pipe(output: NodeJS.WritableStream, levels?: string[], setDefault: boolean = false): void {
		this.#streams.set(output, levels === undefined ? null : new Set(levels));

		if (setDefault)
			this.#defaultStream = output;
		else if (this.#defaultStream === output)
			this.#defaultStream = undefined;
	}

	/**
	 * Remove an output stream from logging.
	 * 
	 * @remarks
	 * If `output` is omitted, all output streams are removed.
	 * 
	 * @param output - The output stream to remove.
	 */
	unpipe(output?: NodeJS.WritableStream): void {
		if (output === undefined) {
			this.#streams.clear();
			this.#defaultStream = undefined;
		} else {
			this.#streams.delete(output);

			if (this.#defaultStream === output)
				this.#defaultStream = undefined;
		}
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
	 * @param addToDefault - Whether to add this level to the default stream.
	 */
	addLevel(level: string, decorator?: Decorator, addToDefault: boolean = true): void {
		if ((this[level] === undefined || this.#loggingLevels.has(level)) && level !== 'default') {
			this[level] = (message: string, ...args: string[]): void => {
				if (decorator !== undefined)
					message = decorator(message);

				this.#write(level, message, ...args);
			};

			// Add this level to the default stream if requested.
			if (addToDefault)
				this.#streams.get(this.#defaultStream)?.add(level);

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
	 * @param level - The logging level for this message.
	 * @param message - The message to log, optionally containing format specifiers.
	 * @param args - The arguments to use when formatting the message.
	 */
	#write(level: string, message: string, ...args: string[]): void {
		const output = util.format(message, ... args);

		let hasWritten = false;
		for (const [stream, levels] of this.#streams) {
			if (levels === null || levels.has(level)) {
				stream.write(output + '\n');
				hasWritten = true;
			}
		}

		if (!hasWritten)
			this.#defaultStream?.write(output + '\n');
	}
}

const globalLogger = new Log();

export default globalLogger;
export const log = globalLogger;