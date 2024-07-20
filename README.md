# StatsApp

Basically, this is a script that processes a WhatsApp chat export and generates CSV files with fun statistics that can be visualized in an app like <https://flourish.studio/>.

## Diagram

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
