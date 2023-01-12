import test from '@kogs/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { log, Log, formatBraces } from '../index.js';

await test.run(async () => {
	const { stdout, stderr } = await test.capture(() => {
		log.info('This is an info log level!');
		log.warn('This is a warning log level!');
		log.error('This is an error log level!');
		log.success('This is a success log level!');
	});
	
	assert.equal(stdout[0], '[\x1B[36mi\x1B[39m] This is an info log level!\n');
	assert.equal(stdout[1], '[\x1B[32m✓\x1B[39m] This is a success log level!\n');

	assert.equal(stderr[0], '[\x1B[33m!\x1B[39m] This is a warning log level!\n');
	assert.equal(stderr[1], '[\x1B[31mx\x1B[39m] This is an error log level!\n');
}, 'Default logging levels');

await test.run(() => {
	const logger = new Log();

	// Global `log` singleton should not be the same object as a new instance of `Log`.
	assert.notEqual(logger, log);

	// Global `log` singleton should be an instance of `Log`.
	assert.ok(log instanceof Log);

	// Global `log` singleton should have the same prototype as `Log`.
	assert.equal(Object.getPrototypeOf(log), Log.prototype);

	// Adding a level to a new instance of `Log` should not affect the global `log` singleton.
	logger.addLevel('test');
	assert.equal(log.test, undefined);
}, 'Class/instancing');

await test.run(async () => {
	const logger = new Log();

	// Cannot add a level with the same name as a function on the `Log` class.
	assert.throws(() => { logger.addLevel('addLevel'); });

	// Overwriting a builtin logging level is allowed.
	const { stdout } = await test.capture(() => {
		logger.info('This is an info log level!');
		logger.addLevel('info', message => 'INFO: ' + message);
		logger.info('This is an info log level!');
	});

	assert.equal(stdout[0], '[\x1B[36mi\x1B[39m] This is an info log level!\n');
	assert.equal(stdout[1], 'INFO: This is an info log level!\n');
}, 'Overwriting builtin logging levels');

await test.run(async () => {
	const logger = new Log();

	logger.addLevel('test', message => 'TEST: ' + message);
	assert.equal(typeof logger.test, 'function');

	const { stdout } = await test.capture(() => {
		logger.test('This is a test log level!');
	});

	assert.equal(stdout[0], 'TEST: This is a test log level!\n');
}, 'Custom logging levels');

await test.run(async () => {
	const logger = new Log();
	logger.addLevel('test');

	const { stdout } = await test.capture(() => {
		logger.test('This is a %s message', 'formatted');
		logger.test('This is a %d message', 123);
	});

	assert.equal(stdout[0], 'This is a formatted message\n');
	assert.equal(stdout[1], 'This is a 123 message\n');
}, 'String formatting');

await test.run(async () => {
	const { stdout, stderr } = await test.capture(() => {
		log.info('This is a {custom} message!');
		log.error('This is a {custom} message!');
		log.warn('This is a {custom} message!');
		log.success('This is a {custom} message!');
	});

	assert.equal(stdout[0], '[\x1B[36mi\x1B[39m] This is a \x1B[36mcustom\x1B[39m message!\n');
	assert.equal(stdout[1], '[\x1B[32m✓\x1B[39m] This is a \x1B[32mcustom\x1B[39m message!\n');
	assert.equal(stderr[0], '[\x1B[31mx\x1B[39m] This is a \x1B[31mcustom\x1B[39m message!\n');
	assert.equal(stderr[1], '[\x1B[33m!\x1B[39m] This is a \x1B[33mcustom\x1B[39m message!\n');

	// Test direct use of the formatBraces decorator function.
	assert.equal(formatBraces('This is a {direct} test', () => 'potato'), 'This is a potato test');
}, 'Brace formatting');

await test.run(async () => {
	const logger = new Log();

	// Calling .unpipe() with no arguments should unpipe all streams.
	logger.unpipe();

	const { stdout, stderr } = await test.capture(() => {
		logger.info('This is an info log level!');
		logger.warn('This is a warning log level!');
		logger.error('This is an error log level!');
		logger.success('This is a success log level!');
	});

	assert.equal(stdout.length, 0);
	assert.equal(stderr.length, 0);
}, 'unpipe() all streams');

await test.run(async () => {
	const logger = new Log();

	// If we unpipe process.stderr, then `warn` and `error` should now default to stdout
	// since they have no streams to write to.
	logger.unpipe(process.stderr);

	const { stdout, stderr } = await test.capture(() => {
		logger.info('This is an info log level!');
		logger.warn('This is a warning log level!');
		logger.error('This is an error log level!');
		logger.success('This is a success log level!');
	});

	assert.equal(stdout.length, 4);
	assert.equal(stderr.length, 0);
}, 'unpipe() non-default stream');

await test.run(async () => {
	const logger = new Log();

	// If we unpipe process.stdout, which is the default stream, then `info` and `success`
	// will not output since we don't automatically assume a new default stream.
	logger.unpipe(process.stdout);

	// If we add a level now while there's no default stream, the output will be lost.
	logger.addLevel('test');

	const { stdout, stderr } = await test.capture(() => {
		logger.info('This is an info log level!');
		logger.warn('This is a warning log level!');
		logger.error('This is an error log level!');
		logger.success('This is a success log level!');
		logger.test('This is a test message');
	});

	assert.equal(stdout.length, 0);
	assert.equal(stderr.length, 2);
}, 'unpipe() default stream');

await test.run(async () => {
	const logger = new Log();

	// Remove process.stdout as the default stream.
	logger.unpipe(process.stdout);

	// If we add a level now while there's no default stream, the output will be lost.
	logger.addLevel('test');

	// Adding process.stdout back with an empty level array and not setting it as the default
	// stream should still mean that output is lost.
	logger.pipe(process.stdout, [], false);
	
	// If we add a level now while there's still no default stream, the output will be lost.
	logger.addLevel('test2');

	const { stdout, stderr } = await test.capture(() => {
		logger.info('This is an info log level!');
		logger.warn('This is a warning log level!');
		logger.error('This is an error log level!');
		logger.success('This is a success log level!');
		logger.test('This is a test message');
		logger.test2('This is a test2 message');
	});

	assert.equal(stdout.length, 0);
	assert.equal(stderr.length, 2);
}, 'pipe() non-default stream');

await test.run(async () => {
	const logger = new Log();

	// Remove process.stdout as the default stream.
	logger.unpipe(process.stdout);

	// If we add a level now while there's no default stream, the output will be lost.
	logger.addLevel('test');

	// But if we upgrade process.stderr to the default stream, then it should catch
	// everything that doesn't have a stream, even if we don't add it to the level array.
	logger.pipe(process.stderr, ['warn', 'error'], true);

	const { stdout, stderr } = await test.capture(() => {
		logger.info('This is an info log level!');
		logger.warn('This is a warning log level!');
		logger.error('This is an error log level!');
		logger.success('This is a success log level!');
		logger.test('This is a test message');
	});

	assert.equal(stdout.length, 0);
	assert.equal(stderr.length, 5);
}, 'pipe() default stream');

await test.run(async () => {
	const logger = new Log();

	// Re-piping an existing stream with `setDefault` set to `false` will remove
	// it as the default stream if it's currently the default stream.
	logger.pipe(process.stdout, ['info', 'success'], false);

	// If we add a level now while there's no default stream, the output will be lost.
	logger.addLevel('test');

	// But if we upgrade process.stderr to a catch-all stream (no levels), then it should catch
	// everything even without being the default stream.
	logger.pipe(process.stderr, undefined, false);

	// The key difference here is that catch-all streams catch everything, whereas the default
	// stream is only used as a fallback for levels that don't have a stream.
	const { stdout, stderr } = await test.capture(() => {
		logger.info('This is an info log level!');
		logger.warn('This is a warning log level!');
		logger.error('This is an error log level!');
		logger.success('This is a success log level!');
		logger.test('This is a test message');
	});

	assert.equal(stdout.length, 2);
	assert.equal(stderr.length, 5);
}, 'pipe() catch-all stream');

await test.run(async () => {
	const logger = new Log();

	// Upgrade process.stderr to log the `test` level.
	logger.pipe(process.stderr, ['warn', 'error', 'test']);

	// Add the 'test' level which is now piped to process.stderr.
	logger.addLevel('test', undefined, false);

	// Add the 'test2' level and set it to be piped to the default.
	logger.addLevel('test2', undefined, true);

	const { stdout, stderr } = await test.capture(() => {
		logger.info('This is an info log level!');
		logger.warn('This is a warning log level!');
		logger.error('This is an error log level!');
		logger.success('This is a success log level!');
		logger.test('This is a test message');
		logger.test2('This is a test2 message');
	});

	assert.equal(stdout.length, 3);
	assert.equal(stderr.length, 3);
}, 'pipe() custom levels');

await test.run(async () => {
	const logger = new Log();
	logger.unpipe();

	const stream = fs.createWriteStream('./test/test-log.txt');
	const output = logger.pipe(stream);

	assert.ok(stream === output);

	logger.info('This is an info log level!');
	logger.warn('This is a warning log level!');
	logger.error('This is an error log level!');
	logger.success('This is a success log level!');

	logger.addLevel('test');
	logger.test('This is a test message');

	await new Promise(res => stream.end(res));

	const file = await fs.promises.readFile('./test/test-log.txt', 'utf8');
	const lines = file.split('\n');

	assert.equal(lines.length, 6);
	assert.equal(lines[0], '[\x1B[36mi\x1B[39m] This is an info log level!');
	assert.equal(lines[1], '[\x1B[33m!\x1B[39m] This is a warning log level!');
	assert.equal(lines[2], '[\x1B[31mx\x1B[39m] This is an error log level!');
	assert.equal(lines[3], '[\x1B[32m✓\x1B[39m] This is a success log level!');
	assert.equal(lines[4], 'This is a test message');
	assert.equal(lines[5], '');

	await fs.promises.unlink('./test/test-log.txt');
}, 'pipe() file stream');

await test.run(async () => {
	const logger = new Log();
	logger.unpipe();

	const stream = logger.pipe('./test/test-log.txt');
	assert(stream instanceof fs.WriteStream);

	logger.info('This is an info log level!');
	logger.warn('This is a warning log level!');
	logger.error('This is an error log level!');
	logger.success('This is a success log level!');

	logger.addLevel('test');
	logger.test('This is a test message');

	await new Promise(res => stream.end(res));

	const file = await fs.promises.readFile('./test/test-log.txt', 'utf8');
	const lines = file.split('\n');

	assert.equal(lines.length, 6);
	assert.equal(lines[0], '[\x1B[36mi\x1B[39m] This is an info log level!');
	assert.equal(lines[1], '[\x1B[33m!\x1B[39m] This is a warning log level!');
	assert.equal(lines[2], '[\x1B[31mx\x1B[39m] This is an error log level!');
	assert.equal(lines[3], '[\x1B[32m✓\x1B[39m] This is a success log level!');
	assert.equal(lines[4], 'This is a test message');
	assert.equal(lines[5], '');

	await fs.promises.unlink('./test/test-log.txt');
}, 'pipe() file shortcut');

await test.run(async () => {
	const logger = new Log();

	// Add a custom logging level.
	logger.addLevel('test', undefined, false);

	await test.capture((stdout, stderr) => {
		logger.info('This is an info log level!');
		logger.error('This is an error log level!');
		
		assert.equal(stdout.shift(), '[\x1B[36mi\x1B[39m] This is an info log level!\n');
		assert.equal(stderr.shift(), '[\x1B[31mx\x1B[39m] This is an error log level!\n');

		logger.pause();

		logger.info('This is an info log level!');
		logger.error('This is an error log level!');
		logger.warn('This is a warning log level!');
		logger.success('This is a success log level!');
		logger.test('This is a test message');

		assert.equal(stdout.length, 0);
		assert.equal(stderr.length, 0);

		logger.resume();

		logger.info('This is an info log level!');
		logger.error('This is an error log level!');
		logger.test('This is a test message');

		assert.equal(stdout.shift(), '[\x1B[36mi\x1B[39m] This is an info log level!\n');
		assert.equal(stderr.shift(), '[\x1B[31mx\x1B[39m] This is an error log level!\n');
		assert.equal(stdout.shift(), 'This is a test message\n');
	});
}, 'Pause/resume logging');