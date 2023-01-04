import test, { capture } from '@kogs/test';
import assert from 'node:assert/strict';
import { log, Log, formatBraces } from '../index.js';

await test.run(async () => {
	const { stdout, stderr } = await test.capture(() => {
		log.info('This is an info log level!');
		log.warn('This is a warning log level!');
		log.error('This is an error log level!');
		log.success('This is a success log level!');
	});
	
	assert.equal(stdout[0], '[\x1B[36mi\x1B[39m] This is an info log level!\n');
	assert.equal(stdout[1], '[\x1B[33m!\x1B[39m] This is a warning log level!\n');
	assert.equal(stdout[2], '[\x1B[31mx\x1B[39m] This is an error log level!\n');
	assert.equal(stdout[3], '[\x1B[32m✓\x1B[39m] This is a success log level!\n');
	assert.equal(stderr.length, 0);
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
	const { stdout } = await capture(() => {
		logger.info('This is an info log level!');
		logger.addLevel('info', message => 'INFO: ' + message);
		logger.info('This is an info log level!');
	});

	assert.equal(stdout[0], '[\x1B[36mi\x1B[39m] This is an info log level!\n');
	assert.equal(stdout[1], 'INFO: This is an info log level!\n');
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
	const { stdout } = await test.capture(() => {
		log.info('This is a {custom} message!');
		log.error('This is a {custom} message!');
		log.warn('This is a {custom} message!');
		log.success('This is a {custom} message!');
	});

	assert.equal(stdout[0], '[\x1B[36mi\x1B[39m] This is a \x1B[36mcustom\x1B[39m message!\n');
	assert.equal(stdout[1], '[\x1B[31mx\x1B[39m] This is a \x1B[31mcustom\x1B[39m message!\n');
	assert.equal(stdout[2], '[\x1B[33m!\x1B[39m] This is a \x1B[33mcustom\x1B[39m message!\n');
	assert.equal(stdout[3], '[\x1B[32m✓\x1B[39m] This is a \x1B[32mcustom\x1B[39m message!\n');

	// Test direct use of the formatBraces decorator function.
	assert.equal(formatBraces('This is a {direct} test', () => 'potato'), 'This is a potato test');
}, 'Brace formatting');