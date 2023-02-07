import { expect, jest, test } from '@jest/globals';
import { log, Log, formatBraces, formatArray } from './index.js';
import fs from 'node:fs';

test('default logging levels', () => {
	const spyStdout = jest.spyOn(process.stdout, 'write').mockImplementation();
	const spyStderr = jest.spyOn(process.stderr, 'write').mockImplementation();

	log.info('This is an info log level!'); // stdout
	expect(spyStdout).toHaveBeenLastCalledWith('\x1B[36mi\x1B[39m This is an info log level!\n');

	log.warn('This is a warning log level!'); // stderr
	expect(spyStderr).toHaveBeenLastCalledWith('\x1B[33m!\x1B[39m This is a warning log level!\n');

	log.error('This is an error log level!'); // stderr
	expect(spyStderr).toHaveBeenLastCalledWith('\x1B[31mx\x1B[39m This is an error log level!\n');

	log.success('This is a success log level!'); // stdout
	expect(spyStdout).toHaveBeenLastCalledWith('\x1B[32m✓\x1B[39m This is a success log level!\n');

	log.write('This is a plain message!'); // stdout
	expect(spyStdout).toHaveBeenLastCalledWith('This is a plain message!\n');
	
	expect(spyStdout).toHaveBeenCalledTimes(3);
	expect(spyStderr).toHaveBeenCalledTimes(2);

	spyStdout.mockRestore();
	spyStderr.mockRestore();
});

test('logger class functionality', () => {
	const logger = new Log();

	// Global `log` singleton should not be the same object as the new instance.
	expect(logger).not.toBe(log);

	// Global `log` singleton should be an instance of `Log`.
	expect(log).toBeInstanceOf(Log);

	// Global `log` singleton should have the same prototype as `Log`.
	expect(Object.getPrototypeOf(log)).toBe(Log.prototype);

	// Adding a level to a new instance of `Log` should not affect the global `log` singleton.
	logger.level('test');
	expect(log.test).toBeUndefined();
});

test('custom logging levels', () => {
	const logger = new Log();
	logger.level('test', message => 'TEST: ' + message);
	
	// logger.test() should be a function.
	expect(logger.test).toBeInstanceOf(Function);

	// logger.test(x) should print 'TEST: x' to stdout.
	const spyStdout = jest.spyOn(process.stdout, 'write').mockImplementation();

	try {
		logger.test('This is a custom log level!');

		expect(spyStdout).toHaveBeenLastCalledWith('TEST: This is a custom log level!\n');
		expect(spyStdout).toHaveBeenCalledTimes(1);
	} finally {
		spyStdout.mockRestore();
	}
});

test('string formatting', () => {
	const logger = new Log();
	const spyStdout = jest.spyOn(process.stdout, 'write').mockImplementation();

	try {
		logger.write('Hello %s!', 'world');
		expect(spyStdout).toHaveBeenLastCalledWith('Hello world!\n');

		logger.write('My number is %d!', 42);
		expect(spyStdout).toHaveBeenLastCalledWith('My number is 42!\n');

		expect(spyStdout).toHaveBeenCalledTimes(2);
	} finally {
		spyStdout.mockRestore();
	}
});

test('markdown formatting', () => {
	const logger = new Log();

	// logger.enableMarkdown should be `true` by default.
	expect(logger.enableMarkdown).toBe(true);

	const spyStdout = jest.spyOn(process.stdout, 'write').mockImplementation();

	try {
		logger.write('This is a **bold** message!');
		expect(spyStdout).toHaveBeenLastCalledWith('This is a \x1B[1mbold\x1B[22m message!\n');

		logger.write('This is an *italic* message!');
		expect(spyStdout).toHaveBeenLastCalledWith('This is an \x1B[3mitalic\x1B[23m message!\n');

		logger.write('This is a ~~strikethrough~~ message!');
		expect(spyStdout).toHaveBeenLastCalledWith('This is a \x1B[9mstrikethrough\x1B[29m message!\n');

		expect(spyStdout).toHaveBeenCalledTimes(3);
	} finally {
		spyStdout.mockRestore();
	}
});

test('disabling markdown formatting', () => {
	const logger = new Log();
	logger.enableMarkdown = false;

	const spyStdout = jest.spyOn(process.stdout, 'write').mockImplementation();

	try {
		logger.write('This is a **bold** message!');
		expect(spyStdout).toHaveBeenLastCalledWith('This is a **bold** message!\n');

		logger.write('This is an *italic* message!');
		expect(spyStdout).toHaveBeenLastCalledWith('This is an *italic* message!\n');

		logger.write('This is a ~~strikethrough~~ message!');
		expect(spyStdout).toHaveBeenLastCalledWith('This is a ~~strikethrough~~ message!\n');

		logger.write('This is a ***bold italic*** message!');
		expect(spyStdout).toHaveBeenLastCalledWith('This is a ***bold italic*** message!\n');

		expect(spyStdout).toHaveBeenCalledTimes(4);
	} finally {
		spyStdout.mockRestore();
	}
});

test('indentation functions', () => {
	const logger = new Log();

	const spyStdout = jest.spyOn(process.stdout, 'write').mockImplementation();

	try {
		logger.write('Normal message with no indentation');
		expect(spyStdout).toHaveBeenLastCalledWith('Normal message with no indentation\n');

		// logger.indent() should return the logger
		expect(logger.indent()).toBe(logger);
		logger.write('Indentented message x1');
		expect(spyStdout).toHaveBeenLastCalledWith('  Indentented message x1\n');

		logger.indent().write('Indentented message x2');
		expect(spyStdout).toHaveBeenLastCalledWith('    Indentented message x2\n');

		// logger.outdent() should return the logger.
		expect(logger.outdent()).toBe(logger);
		logger.write('Indentented message x1');
		expect(spyStdout).toHaveBeenLastCalledWith('  Indentented message x1\n');

		logger.indent(5).write('Indentented message x6');
		expect(spyStdout).toHaveBeenLastCalledWith('            Indentented message x6\n');

		logger.outdent(2).write('Indentented message x4');
		expect(spyStdout).toHaveBeenLastCalledWith('        Indentented message x4\n');

		logger.clearIndentation();
		logger.write('Normal message with no indentation');
		expect(spyStdout).toHaveBeenLastCalledWith('Normal message with no indentation\n');

		expect(spyStdout).toHaveBeenCalledTimes(7);
	} finally {
		spyStdout.mockRestore();
	}
});

test('custom indentation', () => {
	const logger = new Log();
	logger.indentString = '\t';

	const spyStdout = jest.spyOn(process.stdout, 'write').mockImplementation();

	try {
		logger.write('Normal message with no indentation');
		expect(spyStdout).toHaveBeenLastCalledWith('Normal message with no indentation\n');

		logger.indent().write('Indentented message x1');
		expect(spyStdout).toHaveBeenLastCalledWith('\tIndentented message x1\n');

		logger.indent().write('Indentented message x2');
		expect(spyStdout).toHaveBeenLastCalledWith('\t\tIndentented message x2\n');

		logger.outdent().write('Indentented message x1');
		expect(spyStdout).toHaveBeenLastCalledWith('\tIndentented message x1\n');

		logger.indent(5).write('Indentented message x6');
		expect(spyStdout).toHaveBeenLastCalledWith('\t\t\t\t\t\tIndentented message x6\n');

		logger.outdent(2).write('Indentented message x4');
		expect(spyStdout).toHaveBeenLastCalledWith('\t\t\t\tIndentented message x4\n');

		logger.clearIndentation();
		logger.write('Normal message with no indentation');
		expect(spyStdout).toHaveBeenLastCalledWith('Normal message with no indentation\n');

		expect(spyStdout).toHaveBeenCalledTimes(7);
	} finally {
		spyStdout.mockRestore();
	}
});

test('custom line termination', () => {
	const logger = new Log();

	// By default, logger.lineTerminator should be '\n'.
	expect(logger.lineTerminator).toBe('\n');

	const spyStdout = jest.spyOn(process.stdout, 'write').mockImplementation();

	try {
		logger.write('This is a message!');
		expect(spyStdout).toHaveBeenLastCalledWith('This is a message!\n');

		logger.lineTerminator = '\r\n';
		logger.write('This is a message!');
		expect(spyStdout).toHaveBeenLastCalledWith('This is a message!\r\n');

		expect(spyStdout).toHaveBeenCalledTimes(2);
	} finally {
		spyStdout.mockRestore();
	}
});

test('brace formatting', () => {
	const logger = new Log();
	const spyStdout = jest.spyOn(process.stdout, 'write').mockImplementation();
	const spyStderr = jest.spyOn(process.stderr, 'write').mockImplementation();

	try {
		logger.info('This is a {custom} message!');
		expect(spyStdout).toHaveBeenLastCalledWith('\x1B[36mi\x1B[39m This is a \x1B[36mcustom\x1B[39m message!\n');

		logger.error('This is a {custom} message!');
		expect(spyStderr).toHaveBeenLastCalledWith('\x1B[31mx\x1B[39m This is a \x1B[31mcustom\x1B[39m message!\n');

		logger.warn('This is a {custom} message!');
		expect(spyStderr).toHaveBeenLastCalledWith('\x1B[33m!\x1B[39m This is a \x1B[33mcustom\x1B[39m message!\n');

		logger.success('This is a {custom} message!');
		expect(spyStdout).toHaveBeenLastCalledWith('\x1B[32m✓\x1B[39m This is a \x1B[32mcustom\x1B[39m message!\n');

		// Test direct use of the `formatBraces` decorator.
		expect(formatBraces('This is a {direct} test', () => 'potato')).toBe('This is a potato test');
	} finally {
		spyStdout.mockRestore();
		spyStderr.mockRestore();
	}
});

test('adding output stream with pipe()', async () => {
	// We're not actually consuming the stream, but we mock them to prevent
	// the output from being printed to the console.
	const spyStdout = jest.spyOn(process.stdout, 'write').mockImplementation();
	const spyStderr = jest.spyOn(process.stderr, 'write').mockImplementation();

	try {
		const stream = fs.createWriteStream('./stream_output_test.txt');
		const logger = new Log();

		logger.level('test');
		logger.level('test2');

		logger.pipe(stream, ['info', 'warn', 'test']);

		logger.info('This is an info log level!'); // Should be logged.
		logger.warn('This is a warning log level!'); // Should be logged.
		logger.error('This is an error log level!'); // Should not be logged.
		logger.success('This is a success log level!'); // Should not be logged.
		logger.test('This is a test log level!'); // Should be logged.
		logger.test2('This is a test2 log level!'); // Should not be logged.

		// Ending a stream should remove it from the logger.
		await new Promise(resolve => stream.end(resolve));

		logger.info('This is an info log level!'); // Should not be logged.

		// Load the file and check the contents.
		const fileContents = await fs.promises.readFile('./stream_output_test.txt', 'utf8');
		const lines = fileContents.split('\n');

		expect(lines.length).toBe(4);
		expect(lines[0]).toBe('\x1B[36mi\x1B[39m This is an info log level!');
		expect(lines[1]).toBe('\x1B[33m!\x1B[39m This is a warning log level!');
		expect(lines[2]).toBe('This is a test log level!');
		expect(lines[3]).toBe('');
	} finally {
		// Remove the file.
		await fs.promises.unlink('./stream_output_test.txt');

		spyStdout.mockRestore();
		spyStderr.mockRestore();
	}
});

test('reconfigure stream levels with pipe()', () => {
	const logger = new Log();
	const spyStdout = jest.spyOn(process.stdout, 'write').mockImplementation();

	try {
		logger.info('This is an info message!');
		expect(spyStdout).toHaveBeenLastCalledWith('\x1B[36mi\x1B[39m This is an info message!\n');

		logger.success('This is a success message!');
		expect(spyStdout).toHaveBeenLastCalledWith('\x1B[32m✓\x1B[39m This is a success message!\n');

		expect(spyStdout).toHaveBeenCalledTimes(2);

		// Reconfigure the stream levels.
		logger.pipe(process.stdout, ['info']);

		logger.info('This is an info message!');
		expect(spyStdout).toHaveBeenLastCalledWith('\x1B[36mi\x1B[39m This is an info message!\n');

		logger.success('This is a success message!'); // This should now be ignored.
		expect(spyStdout).toHaveBeenCalledTimes(3);
	} finally {
		spyStdout.mockRestore();
	}
});

test('remove stream with unpipe()', () => {
	const logger = new Log();
	const spyStdout = jest.spyOn(process.stdout, 'write').mockImplementation();
	const spyStderr = jest.spyOn(process.stderr, 'write').mockImplementation();

	try {
		logger.info('This is an info message!');
		expect(spyStdout).toHaveBeenLastCalledWith('\x1B[36mi\x1B[39m This is an info message!\n');

		logger.success('This is a success message!');
		expect(spyStdout).toHaveBeenLastCalledWith('\x1B[32m✓\x1B[39m This is a success message!\n');

		logger.error('This is an error message!');
		expect(spyStderr).toHaveBeenLastCalledWith('\x1B[31mx\x1B[39m This is an error message!\n');

		expect(spyStdout).toHaveBeenCalledTimes(2);
		expect(spyStderr).toHaveBeenCalledTimes(1);

		// Remove the stream.
		logger.unpipe(process.stdout);

		// Both of the below should be ignored.
		logger.info('This is an info message!');
		logger.success('This is a success message!');

		expect(spyStdout).toHaveBeenCalledTimes(2);

		// process.stderr should not be affected.
		logger.error('This is an error message!');
		expect(spyStderr).toHaveBeenLastCalledWith('\x1B[31mx\x1B[39m This is an error message!\n');
	} finally {
		spyStdout.mockRestore();
		spyStderr.mockRestore();
	}
});

test('pause/resume logging', () => {
	const logger = new Log();

	// Add a custom logging level.
	logger.level('test');

	const spyStdout = jest.spyOn(process.stdout, 'write').mockImplementation();
	const spyStderr = jest.spyOn(process.stderr, 'write').mockImplementation();

	try {
		logger.pause();
		logger.info('This is an info log level!');
		logger.warn('This is a warning log level!');
		logger.error('This is an error log level!');
		logger.success('This is a success log level!');
		logger.test('This is a test log level!');

		expect(spyStdout).toHaveBeenCalledTimes(0);
		expect(spyStderr).toHaveBeenCalledTimes(0);

		logger.resume();
		logger.info('This is an info log level!');
		logger.warn('This is a warning log level!');
		logger.error('This is an error log level!');
		logger.success('This is a success log level!');
		logger.test('This is a test log level!');

		expect(spyStdout).toHaveBeenCalledTimes(3);
		expect(spyStderr).toHaveBeenCalledTimes(2);
	} finally {
		spyStdout.mockRestore();
		spyStderr.mockRestore();
	}
});

test('log.blank() should log a blank line', () => {
	const logger = new Log();
	const spyStdout = jest.spyOn(process.stdout, 'write').mockImplementation();

	try {
		expect(logger.blank()).toBe(logger);
		expect(spyStdout).toHaveBeenLastCalledWith('\n');
	} finally {
		spyStdout.mockRestore();
	}
});

test('formatArray', () => {
	expect(formatArray(['a', 'b', 'c'])).toBe('{a}, {b}, {c}');
	expect(formatArray(['a'])).toBe('{a}');
	expect(formatArray(['a', true, 50.5])).toBe('{a}, {true}, {50.5}');
	expect(formatArray(['a', 'b', 'c'], ' or ')).toBe('{a} or {b} or {c}');
	expect(formatArray(['a'], ' or ')).toBe('{a}');
});

test('empty logging functions should print empty messages', () => {
	const logger = new Log();
	const spyStdout = jest.spyOn(process.stdout, 'write').mockImplementation();
	const stdErr = jest.spyOn(process.stderr, 'write').mockImplementation();

	try {
		logger.info();
		expect(spyStdout).toHaveBeenLastCalledWith('\x1B[36mi\x1B[39m \n');

		logger.success();
		expect(spyStdout).toHaveBeenLastCalledWith('\x1B[32m✓\x1B[39m \n');

		logger.warn();
		expect(stdErr).toHaveBeenLastCalledWith('\x1B[33m!\x1B[39m \n');

		logger.error();
		expect(stdErr).toHaveBeenLastCalledWith('\x1B[31mx\x1B[39m \n');

		logger.write();
		expect(spyStdout).toHaveBeenLastCalledWith('\n');
	} finally {
		spyStdout.mockRestore();
		stdErr.mockRestore();
	}
});