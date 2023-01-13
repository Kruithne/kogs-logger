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

**Plain Text Logging**

It may be preferable to log messages without a prefix/formatting, in which case you can use the `log.write()` method.

Since this has no associated log level, it will be sent to the default stream only, regardless of how the logger is configured.

```js
log.write('Hello, world!');
// > Hello, world!
```

**String Formatting**

All logging methods support string formatting using the [util.format()](https://nodejs.org/api/util.html#utilformatformat-args). See the documentation for more information.

```js
log.info('This is a %s', 'formatted string');
// > [i] This is a formatted string
```

Arguments provided to the logging methods for string formatting are **not** subject to colour or Markdown formatting.

```js
log.info('My message is %s bold!', '**not**');
// > [i] My message is **not** bold!
```

**Colour Formatting**

The builtin log levels have decorators that add colors to logged messages. Instead of colouring the entire message, only text that appears between curly braces will be coloured.

![Snippet of code showing the default log levels](docs/readme-snippet-3.png)

**Markdown Formatting**

By default, the logger supports the Markdown formatting syntax for `bold`, `italic` and `strikethrough` text.

![Snippet of code showing the markdown formatted output](docs/readme-snippet-4.png)

If you want to disable Markdown formatting, you can do so by setting the property `enableMarkdown` on the logger to `false`.

```js
log.enableMarkdown = false;

log.info('This is a *bold* message');
// > [i] This is a *bold* message
```

**Indentation**

The `log.indent()` and `log.outdent()` methods can be used to indent and unindent the logger's output.

```js
log.info('This is an info message');
// > [i] This is an info message

log.indent();
log.info('This is an indented info message');
// > [i] This is an indented info message

log.outdent();
log.info('This is an info message again');
// > [i] This is an info message again
```

By default, indentation is done using 2 spaces. You can change this by setting the `indentString` property on the logger.

```js
log.indentString = '\t';
log.indent();

log.info('This is an indented info message');
// > [i] 	This is an indented info message
```

Additionally, you can provide a number to `log.indent()` and `log.outdent()` to specify the number of indentations to add/remove.

```js
log.indent(4);
log.info('This is an indented info message');
// > [i]             This is an indented info message

log.outdent(2);
log.info('This is an info message again');
// > [i]     This is an info message again
```

The convinience method `log.clearIndentation()` can be used to reset the indentation level to 0.

```js
log.indent(4);
log.info('This is an indented info message');
// > [i]         This is an indented info message

log.clearIndentation();
log.info('This is an info message again');
// > [i] This is an info message again
```

**Pause/Resume Logging**

The `log.pause()` and `log.resume()` methods can be used to temporarily disable logging. Any messages logged while logging is paused will be discarded and **not** retroactively logged when `log.resume()` is called.

```js
log.info('This is an info message');
// > [i] This is an info message

log.pause();
log.info('This message will not be logged');

log.resume();

log.info('This message will be logged');
// > [i] This message will be logged
```

**Progress Bar**

The `log.progress()` method allows you to display a dynamic progress bar in the terminal. The function is non-blocking and returns a progress bar object.

> Note: Values provided to `progress.update()` are clamped between 0-1, meaning any value lower than 0 will be treated as 0, and any value higher than 1 will be treated as 1.

```js
const progress = log.progress('Downloading > ');
const file = fs.createWriteStream('file.zip');

https.get(someZipURL, (response) => {
	// The content-length header being available depends
	// on the server, but we'll use it for this example.
	const total = parseInt(response.headers['content-length'], 10);

	let downloaded = 0;
	response.on('data', (chunk) => {
		file.write(chunk);
		downloaded += chunk.length;

		// Update the progress bar with a value between 0-1.
		progress.update(downloaded / total);
	});

	response.on('end', () => {
		file.end();
	});
});

// Downloading > [============                            ] 30%
// Downloading > [========================                ] 60%
// Downloading > [========================================] 100%
```
> Note: The progress bar is always and only written to `process.stdout`, regardless of how the logger is configured.

> Note: Messages sent through the logger while a progress bar is active will appear above the progress bar, and the progress bar will be reprinted after the message is logged.

Once `progress.update()` has been provided with a value of 1, the progress bar will automatically finish and turn green. To finish prematurely, you can call `progress.finish()`, which will skip to 100% and turn the progress bar green.

In the event that you want to indicate failure, you can call `progress.cancel()` instead. This will leave the progress bar at its current value and turn it red.

```js
response.on('error', e => {
	progress.cancel();
	log.error('Failed to download file: %s', e.message);
});

// Downloading > [============                            ] 30%
// > [!] Failed to download file: [error message]
```

**User Prompting**

The `log.prompt()` method allows you to prompt the terminal user for input.

```js
const name = await log.prompt('What is your name? ');
log.info('Hello, %s!', name);

// > What is your name? [user input]
// > [i] Hello, [user input]!
```
> Note: The prompt is always and only written to `process.stdout`, regardless of how the logger is configured.

While `log.prompt()` is waiting for user input, logging functions can still be used freely (with the exception of dynamic functions such as `prompt()` and `progress()`).

Messages logged while a prompt is active will appear above the prompt, and the prompt will be reprinted after the message is logged.

```js
log.info('This is the first message sent.');
log.prompt('What is your name? ').then(name => {
	log.info('Hello, %s!', name);
});
log.info('This is the second message sent.');

// > [i] This is the first message sent.
// > [i] This is the second message sent.
// > What is your name? [user input]
// > [i] Hello, [user input]!
```
If you want to ensure that nothing is logged while the user is being prompted, you can use the `log.pause()` and `log.resume()` methods.

> Note: Keep in mind that all messages logged while the logger is paused will be discarded.

```js
log.pause();
log.prompt('What is your name? ').then(name => {
	log.info('Hello, %s!', name);
	log.resume();
});
log.info('This message will not be logged');

// > What is your name? [user input]
// > [i] Hello, [user input]!
```
In some scenarios, the user may be entering sensitive information. In these cases, the second parameter of `log.prompt()` can be set to `true` to mask the user's input.

> Note: Keep in mind that this only masks the input in the terminal, the actual value is still uncensored.
```js
const pass = await log.prompt('Password > ', true);
log.info('Your password is %s', pass);

// > Password > ******
// > [i] Your password is potato
```

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