# StatsApp

StatsApp is a command-line tool that parses group chat export files from WhatsApp, and performs some data analysis, outputting CSV files that can be visualized in an app like <https://flourish.studio/>.

## Features

- Accepts either a single chat export as input, or multiple chat exports taken at different times (because WhatsApp limits the number of messages included in a single export)
- Tested with United Kingdom localization, and supports 12-hour or 24-hour time. If your phone is set to a different locale then your results may vary (feel free to open an issue!)

## Diagrams

### Single-file mode

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/StatsApp%20single%20file%20mode%20(dark).excalidraw.svg">
  <img alt="A diagram showing the inputs and outputs for StatsApp, and their corresponding command-line arguments" src="./assets/StatsApp%20single%20file%20mode.excalidraw.svg">
</picture>

### Folder mode

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/StatsApp%20folder%20mode%20(dark).excalidraw.svg">
  <img alt="A diagram showing the inputs and outputs for StatsApp when it's processing a folder of chat exports, and their corresponding command-line arguments" src="./assets/StatsApp%20folder%20mode.excalidraw.svg">
</picture>

## Development instructions

This is a Typescript + Node.js project that uses Yarn v4 for package management. After cloning the repository, install dependencies by running `yarn`.

Start the Typescript compiler in watch mode using `yarn run watch`

Enable additional debug logs when running the tool by setting the `VERBOSE` environment variable, e.g.

```bash
VERBOSE=y yarn node dist/src/main.js --input-dir data --daily-stats out/daily-stats.csv --chat-log out/chat-log.txt
```
