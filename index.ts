import * as util from 'node:util';
import pc from 'picocolors';
import fs from 'node:fs';

type Decorator = (message: string) => string;
type StreamTargets = Set<string> | null;

const NO_LEVEL = '';

interface Progress {
	/**
	 * Update the progress bar with a new value.
	 * @param value - A value between 0 and 1.
	 */
	update(value: number): void;

	/**
	 * Cancel the progress bar.
	 */
	cancel(): void;
	
	/**
	 * Finish the progress bar, indicating success.
	 */
	finish(): void;
}

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
	#userPrompt?: string;
	#isPaused: boolean = false;

	constructor() {
		this.pipe(process.stdout, ['info', 'success'], true);
		this.pipe(process.stderr, ['warn', 'error']);
	}

	/**
	 * Pauses logging from this instance.
	 * 
	 * @remarks
	 * All calls to direct logging functions will be ignored until `resume()` is called.
	 * This does not effect dynamic logging functions such as `prompt()` or `progress()`.
	 */
	pause(): void {
		this.#isPaused = true;
	}

	/**
	 * Resumes logging from this instance.
	 * 
	 * @remarks
	 * Any messages sent while the logger was paused will not be retroactively logged.
	 */
	resume(): void {
		this.#isPaused = false;
	}

	/**
	 * Logs a message to the default output stream with no prefix/colour.
	 * @param message - The message to log.
	 * @param args - Arguments to use when formatting the message.
	 */
	write(message: string, ...args: string[]): void {
		this.#write(NO_LEVEL, message, ...args);
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
	 * @param output - The output stream to write to or a path to a file to write to.
	 * @param levels - Optional array of levels to write to the output stream.
	 * @param setDefault - Whether to set this stream as the default output.
	 * @returns The output stream.
	 */
	pipe(output: NodeJS.WritableStream | string, levels?: string[], setDefault: boolean = false): NodeJS.WritableStream {
		if (typeof output === 'string')
			output = fs.createWriteStream(output);

		this.#streams.set(output, levels === undefined ? null : new Set(levels));

		if (setDefault)
			this.#defaultStream = output;
		else if (this.#defaultStream === output)
			this.#defaultStream = undefined;

		return output;
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
	 * Render a dynamic progress bar.
	 * 
	 * @remarks
	 * Messages sent using standard logging methods while a progress bar is active will
	 * appear above the progress bar.
	 * 
	 * The progress bar does not automatically move to a 'finished' state when it is
	 * updated with the value of `1`. You should call `.finish()` when completed.
	 * 
	 * @param prefix - The prefix to appear before the progress bar.
	 * @param initialPct - The initial percentage to display (0-1).
	 * @returns A controller for the progress bar.
	 */
	progress(prefix: string, initialPct: number = 0): Progress {
		let currentValue = 0;
		let finished = false;

		const writeProgress = (value: number, color: Decorator, finish: boolean = false, first: boolean = false) => {
			if (finished)
				return;

			currentValue = value;

			const progress = Math.round(currentValue * 40);
			const out = prefix + '[' + color('='.repeat(progress)) + ' '.repeat(40 - progress) + '] ' + Math.round(currentValue * 100) + '%';
			const changed = out !== this.#userPrompt;

			if (!first && changed) {
				// \r - carriage return, moves cursor to beginning of line.
				// \u001b[K - clear line from cursor to end of line.
				process.stdout.write('\r\u001b[K');
			}

			if (finish) {
				process.stdout.write(out + '\n');
				this.#userPrompt = undefined;
				finished = true;
			} else if (changed) {
				process.stdout.write(out);
				this.#userPrompt = out;
			}
		};

		writeProgress(initialPct, pc.yellow, false, true);

		return {
			update: (value: number) => {
				value = Math.min(1, Math.max(0, value));
				const autoFinish = value === 1;
				writeProgress(value, autoFinish ? pc.green : pc.yellow, autoFinish);
			},
			cancel: () => writeProgress(currentValue, pc.red, true),
			finish: () => writeProgress(1, pc.green, true)
		};
	}

	/**
	 * Prompts the user for input.
	 * 
	 * @remarks
	 * The given prompt is displayed to the user and the user's response is
	 * returned trimmed of whitespace. The prompt is always written to the
	 * `process.stdout` stream, regardless of configured output streams.
	 * 
	 * @param message - Prompt to display to the user.
	 * @param mask - If true, the user's input will be masked.
	 * @returns The user's response.
	 */
	async prompt(message: string, mask: boolean = false): Promise<string> {
		if (mask) {
			return new Promise(resolve => {
				process.stdin.setRawMode(true);

				this.#userPrompt = message;
				process.stdout.write(message);

				let input = '';
				const handler = (chunk: Buffer) => {
					const key = chunk.toString();
					if (key === '\r' || key === '\u0003') {
						process.stdin.setRawMode(false);
						process.stdout.write('\n');

						process.stdin.off('data', handler);
						process.stdin.pause();

						this.#userPrompt = undefined;
						resolve(key === '\r' ? input.trim() : null);
					} else {
						if (key === '\u0008' || key === '\u001B\u005B\u0033\u007E') {
							// For backspace and delete, remove the last character.
							input = input.slice(0, -1);
						} else {
							// Otherwise, add the character to the input if it's a printable character.
							if (key.length === 1 && key >= ' ')
								input += key;
						}

						process.stdout.clearLine(0);
						process.stdout.cursorTo(0);
						
						const prompt = this.#userPrompt = message + '*'.repeat(input.length);
						process.stdout.write(prompt);
					}
				};

				process.stdin.on('data', handler);
			});
		} else {
			return new Promise(resolve => {		
				process.stdin.once('readable', () => {
					const chunk = process.stdin.read();
					if (chunk !== null)
						resolve(chunk?.toString().trim() ?? null);
				});
			});
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
		if (this.#isPaused)
			return;

		// TODO: Ideally we might want to check if we're actually targeting
		// a TTY before doing this, but that seems like overkill for now.
		if (this.#userPrompt !== undefined) {
			process.stdout.clearLine(0);
			process.stdout.cursorTo(0);
		}
		
		const output = util.format(message, ... args);

		let hasWritten = false;

		if (level !== NO_LEVEL) {
			for (const [stream, levels] of this.#streams) {
				if (levels === null || levels.has(level)) {
					stream.write(output + '\n');
					hasWritten = true;
				}
			}
		}

		if (!hasWritten)
			this.#defaultStream?.write(output + '\n');

		
		if (this.#userPrompt !== undefined)
			process.stdout.write(this.#userPrompt);
	}
}

const globalLogger = new Log();

export default globalLogger;
export const log = globalLogger;