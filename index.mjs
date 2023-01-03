import util from 'node:util';

/**
 * Writes a message to the console.
 * @param {string} message 
 * @param  {...any} args 
 */
export function write(message, ...args) {
	process.stdout.write(util.format(message, ...args));
}