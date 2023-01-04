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