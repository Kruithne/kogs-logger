# @kogs/logger
`@kogs/logger` is a simple logging utility for Node.js.

## Installation
```bash
npm install @kogs/logger
```

## Usage
**Basic Usage**
```js
import log from '@kogs/logger';
```

**Default Log Levels**

By default, `@kogs/logger` has 4 log levels: `info`, `success`, `warn`, and `error`. Each log level has a corresponding color and symbol.

![Snippet of code showing the default log levels](docs/readme-snippet-1.png)

**String Formatting**

All logging methods support string formatting using the [util.format()](https://nodejs.org/api/util.html#utilformatformat-args). See the documentation for more information.

```js
log.info('This is a %s', 'formatted string');
// > [i] This is a formatted string
```

**Colour Formatting**

The builtin log levels have decorators that add colors to logged messages. Instead of colouring the entire message, only text that appears between curly braces will be coloured.

![Snippet of code showing the default log levels](docs/readme-snippet-3.png)

**Custom Log Levels**

To add a custom logging level, use the `log.addLevel()` method. The first argument is the name of the level and must be a valid JavaScript identifier.

The second argument is an optional decorator function which takes the log message as an argument and returns a string. This is useful for adding colors or symbols to the log message.

```js
log.addLevel('debug', (msg) => `DEBUG: ${msg}`);
log.debug('This is a debug message');

// > DEBUG: This is a debug message
```
The builtin log levels can be overridden by adding a custom log level with the same name, however you cannot use names of other functions on the `Log` class.
```js
// Overwriting log levels is fine:
log.addLevel('info', (msg) => `INFO: ${msg}`);

// But this will throw an error:
log.addLevel('addLevel', (msg) => `INFO: ${msg}`);
```
The standard log levels have decorators that add colors and symbols to the logged messages. If you want to copy this behavior, you can use the `formatBraces` decorator function in combination with a coloring library; internally [picocolors](https://github.com/alexeyraspopov/picocolors) is used.

```js
import { log, formatBraces } from '@kogs/logger';
import pc from 'picocolors';

log.addLevel('add', message => {
	return formatBraces('[{+}] ' + message, pc.green);
});
log.add('This is a {custom} log level!');
```
![Snippet of code showing the default log levels](docs/readme-snippet-2.png)

**Output Flow**

By default, all log messages of the `info` and `success` level are written to `process.stdout`, and the `warn` and `error` levels are written to `process.stderr`.

Additionally, `process.stdout` is configured as the default output stream. In the event that a message is logged, but there is no output stream to catch it, the message default will be used as a fallback.

```js
log.info('This is an info message');
// stdout -> [i] This is an info message

log.warn('This is a warning');
// stderr -> [!] This is a warning

log.addLevel('test', undefined, false);
log.test('This is a test message');
// stdout -> This is a test message
```
In the above example, the third parameter `addToDefault` for `log.addLevel()` is explicitly set to `false` to demonstrate that the default stream is used as a fallback.

If `addToDefault` is set to `true`, the added `test` level will be implicitly added to the default stream, which at the time is `process.stdout`. The key difference between the two is that with `addToDefault` as `true`, the `test` level will stay assigned to `process.stdout` even if the default stream is changed.

```js
// Add `test` level to the default stream.
log.addLevel('test', undefined, true);
log.test('This is a test message');
// stdout -> This is a test message

// Change the default stream to `process.stderr`.
log.pipe(process.stderr, ['warn', 'error'], true);
log.test('This is a test message');
// stdout -> This is a test message

// Since `test` was implicitly added to the current default stream, it will
// stay assigned to the default stream at the time of creation.

// Add `test2` level but do not add it to the default stream.
// It will now fallback to `process.stderr`.
log.addLevel('test2', undefined, false);
log.test2('This is a test message');
// stderr -> This is a test message

// Change the default stream to `process.stdout`.
log.pipe(process.stdout, ['info', 'success'], true);
log.test2('This is a test message');
// stdout -> This is a test message

// Since `test2` was not implicitly added to the default stream, it will
// fallback to the default stream at the time of logging.
```
Additional output streams can be added by calling the `log.pipe()` method. The first argument is a writable stream, the second argument is an array of log levels to send to the stream, and the third argument is a boolean indicating whether this stream should be the default fallback stream.

```js
const myLoggingFile = fs.createWriteStream('my-logs.txt');
log.pipe(myLoggingFile, ['test']);

log.test('This is a test message');
// myLoggingFile -> This is a test message
```
If the second argument is omitted, the output will be considered a catch-all stream and will receive **all** log messages.

```js
log.pipe(myLoggingFile);

log.info('This is an info message');
// myLoggingFile -> [i] This is an info message
```

> Note: If a logged message has no implicit output stream, but is caught by a catch-all stream, the message is considered to have been handled and will not be sent to the default fallback stream.

If a string is passed as the first argument to `log.pipe()`, it will be treated as a file path and a writable stream will be created for it. For convienence, `log.pipe()` always returns the stream that was created or provided.

```js
const stream = log.pipe('my-logs.txt');
log.info('This is an info message');

// my-logs.txt -> [i] This is an info message
```

**Custom Loggers**

By default, the `log` object is a singleton instance of the `Log` class. You can create your own instances of the `Log` class by importing it.

```js
import { Log, log } from '@kogs/logger';

// `log` is the default instance of the `Log` class
// `Log` is the class itself, which can be instantiated.

const customLog = new Log();
customLog.info('This is a custom log instance');

// > [i] This is a custom log instance
```

Any changes made to the global `log` instance will not be reflected in custom log instances and vice versa. Unless you need to create multiple loggers, it is recommended to use the global `log` instance for convenience.

## License
The code in this repository is licensed under the ISC license. See the [LICENSE](LICENSE) file for more information.