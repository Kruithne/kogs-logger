import * as util from 'node:util';
import pc from 'picocolors';
import fs from 'node:fs';

type Decorator = (message: string) => string;
type ChoiceValue = string|number|boolean;

type Choice = {
	label: string;
	value?: ChoiceValue;
	key?: string;
};

type ChoiceOptions = {
	margin?: number;
	prependKey?: boolean;
};

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

/**
 * Formats a string with some basic Markdown formatting.
 * @param message - The message to format.
 * @returns The formatted message.
 */
export function formatMarkdown(message: string): string {
	message = message.replace(/\*\*(.*?)\*\*/g, (_, p1) => pc.bold(p1)); // Bold
	message = message.replace(/\*(.*?)\*/g, (_, p1) => pc.italic(p1)); // Italic
	message = message.replace(/~~(.*?)~~/g, (_, p1) => pc.strikethrough(p1)); // Strikethrough

	return message;
}

export class Log {
	#loggingLevels: Set<string> = new Set(['info', 'warn', 'error', 'success']);
	#streams: Map<NodeJS.WritableStream, string[]> = new Map();
	#userPrompt?: string;
	#isPaused: boolean = false;
	enableMarkdown: boolean = true;

	#indentationLevel: number = 0;
	indentString: string = '  ';
	lineTerminator: string = '\n';

	constructor() {
		this.pipe(process.stdout, ['info', 'success']);
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
	 * Adds a level of indentation to the logger.
	 * @param amount - The amount of indentation to add.
	 * @returns The logger instance.
	 */
	indent(amount: number = 1): Log {
		this.#indentationLevel = Math.max(this.#indentationLevel + amount, 0);
		return this;
	}

	/**
	 * Removes a level of indentation from the logger.
	 * @param amount - The amount of indentation to remove.
	 * @returns The logger instance.
	 */
	outdent(amount: number = 1): Log {
		this.#indentationLevel = Math.max(this.#indentationLevel - amount, 0);
		return this;
	}

	/**
	 * Clears all indentation from the logger.
	 */
	clearIndentation(): void {
		this.#indentationLevel = 0;
	}

	/**
	 * Logs a message to the default output stream with no prefix/colour.
	 * @param message - The message to log.
	 * @param args - Arguments to use when formatting the message.
	 */
	write(message: string, ...args: string[]): void {
		this.#write('info', message, ...args);
	}

	/**
	 * Logs a message at the `info` level.
	 * @param message - Message to log with optional format specifiers.
	 * @param args - Arguments to use when formatting the message.
	 */
	info(message: string, ...args: string[]): void {
		this.#write('info', formatBraces(`[{i}] ${message}`, pc.cyan), ...args);
	}

	/**
	 * Logs a message at the `warn` level.
	 * @param message - Message to log with optional format specifiers.
	 * @param args - Arguments to use when formatting the message.
	 */
	warn(message: string, ...args: string[]): void {
		this.#write('warn', formatBraces(`[{!}] ${message}`, pc.yellow), ...args);
	}

	/**
	 * Logs a message at the `error` level.
	 * @param message - Message to log with optional format specifiers.
	 * @param args - Arguments to use when formatting the message.
	 */
	error(message: string, ...args: string[]): void {
		this.#write('error', formatBraces(`[{x}] ${message}`, pc.red), ...args);
	}

	/**
	 * Logs a message at the `success` level.
	 * @param message - Message to log with optional format specifiers.
	 * @param args - Arguments to use when formatting the message.
	 */
	success(message: string, ...args: string[]): void {
		this.#write('success', formatBraces(`[{✓}] ${message}`, pc.green), ...args);
	}

	/**
	 * Adds a stream to the logger.
	 * 
	 * @remarks
	 * When the stream ends, it will automatically be removed from the list of streams.
	 * 
	 * @param streamOrPath - The stream to pipe to. Can be a file path.
	 * @param levels - The levels to pipe to the stream. If empty, all levels will be piped.
	 */
	pipe(streamOrPath: NodeJS.WritableStream | string, levels: string[] = []): void {
		// If the stream is a string, create a write stream to the file.
		const stream: NodeJS.WritableStream = typeof streamOrPath === 'string' ? fs.createWriteStream(streamOrPath) : streamOrPath;

		this.#streams.set(stream, levels);
		
		// If the stream ends, remove it from the list of streams.
		stream.once('close', () => this.#streams.delete(stream));
	}

	/**
	 * Removes a stream from the logger.
	 * @param stream - The stream to remove from the logger.
	 */
	unpipe(stream: NodeJS.WritableStream): void {
		this.#streams.delete(stream);
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
	 * @param stream - The stream to write to. Defaults to `process.stdout`.
	 */
	level(level: string, decorator?: Decorator, stream: NodeJS.WritableStream = process.stdout): void {
		if (this[level] === undefined || this.#loggingLevels.has(level)) {
			this[level] = (message: string, ...args: string[]): void => {
				if (decorator !== undefined)
					message = decorator(message);

				this.#write(level, message, ...args);
			};

			const streamLevels = this.#streams.get(stream);
			if (streamLevels !== undefined && !streamLevels.includes(level))
				streamLevels.push(level);

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
	 * @throws {Error}
	 * Thrown if a dynamic prompt is already active.
	 * 
	 * @param prefix - The prefix to appear before the progress bar.
	 * @param initialPct - The initial percentage to display (0-1).
	 * @returns A controller for the progress bar.
	 */
	progress(prefix: string, initialPct: number = 0): Progress {
		if (this.#userPrompt !== undefined)
			throw new Error('Cannot display progress bar while another interactive prompt is active.');

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
				process.stdout.write(out + this.lineTerminator);
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
	 * @throws {Error}
	 * Thrown if a dynamic prompt is already active.
	 * 
	 * @param message - Prompt to display to the user, defaults to '> '.
	 * @param mask - If true, the user's input will be masked.
	 * @returns The user's response.
	 */
	async prompt(message: string = '> ', mask: boolean = false): Promise<string> {
		if (this.#userPrompt !== undefined)
			throw new Error('Cannot display input prompt while another interactive prompt is active.');

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
						process.stdout.write(this.lineTerminator);

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
			this.#userPrompt = message;
			process.stdout.write(message);
				
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
	 * Prompts the user to select a choice from a list.
	 * 
	 * @throws {Error}
	 * Thrown if a dynamic prompt is already active.
	 * 
	 * @throws {Error}
	 * Thrown if no choices are provided.
	 * 
	 * @param choices - Choices to display to the user.
	 * @param options - Options for the choice prompt.
	 * @returns A promise that resolves to the user's choice.
	 */
	async choice(choices: Array<Choice|string>, options?: ChoiceOptions): Promise<ChoiceValue> {
		if (choices.length === 0)
			throw new Error('log.choice(): No choices provided');

		if (this.#userPrompt !== undefined)
			throw new Error('Cannot display choice prompt while another interactive prompt is active.');

		const parsedChoices: Choice[] = choices.map(choice => typeof choice === 'string' ? { label: choice } : choice);
		const assignedKeys = new Set<string>();

		// If the user has defined the key, use it. Otherwise, generate a key. This
		// is to allow users to override the key generation scheme if they wish.
		for (const choice of parsedChoices) {
			if (choice.key !== undefined) {
				if (assignedKeys.has(choice.key))
					throw new Error(`log.choice(): Choice ${choice.label} assigned duplicate key ${choice.key}`);

				assignedKeys.add(choice.key);
			}
		}

		const output: string[] = [''];
		for (const choice of parsedChoices) {
			// Generate keys for any choices that don't have them.
			if (choice.key === undefined) {
				// Attempt to use the first letter of the label.
				let newKey: string = choice.label.toLowerCase().match(/[a-z]/)?.[0];

				// If no letter is found, or the letter is already assigned, use a number instead.
				if (newKey === undefined || assignedKeys.has(newKey)) {
					let choiceNumber = parsedChoices.indexOf(choice) + 1;
					newKey = choiceNumber.toString();

					// If the number is already assigned, keep incrementing until we find an unused number.
					while (assignedKeys.has(newKey)) {
						choiceNumber++;
						newKey = choiceNumber.toString();
					}
				}

				choice.key = newKey;
				assignedKeys.add(newKey);
			}

			// Add each choice to the output.
			if (options?.prependKey ?? true)
				output.push(`(${choice.key}) ${choice.label}`);
			else
				output.push(choice.label);
		}

		// A blank string is left at the start and end of the output array so when
		// formatted, the same margin between the choices is used before and after.
		// This looks nicer and pushes the cursor away from the choices.
		output.push('');

		this.#userPrompt = output.join(' '.repeat(options?.margin ?? 2));
		process.stdout.write(this.#userPrompt);

		return new Promise(resolve => {
			process.stdin.setRawMode(true);

			const handler = (chunk: Buffer) => {
				const key = chunk.toString();

				// Allow CTRL+C to exit the process still.
				if (key === '\u0003')
					return process.exit();

				for (const choice of parsedChoices) {
					if (choice.key === key) {
						process.stdin.setRawMode(false);
						process.stdout.write(this.lineTerminator);

						process.stdin.off('data', handler);
						process.stdin.pause();

						this.#userPrompt = undefined;
						resolve(choice.value ?? choice.label);
					}
				}
			};

			process.stdin.on('data', handler);
		});
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

		if (this.enableMarkdown)
			message = formatMarkdown(message);
		
		let output = util.format(message, ...args);

		if (this.#indentationLevel > 0)
			output = this.indentString.repeat(this.#indentationLevel) + output;

		for (const [stream, levels] of this.#streams)
			if (stream.writable && levels.length === 0 || levels.includes(level))
				stream.write(output + this.lineTerminator);
		
		if (this.#userPrompt !== undefined)
			process.stdout.write(this.#userPrompt);
	}
}

const globalLogger = new Log();

export default globalLogger;
export const log = globalLogger;