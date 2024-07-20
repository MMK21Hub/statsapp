# StatsApp

Basically, this is a script that processes a WhatsApp chat export and generates CSV files with fun statistics that can be visualized in an app like <https://flourish.studio/>.

## Development instructions

This is a Typescript + Node.js project that uses Yarn v4 for package management. After cloning the repository, install dependencies by running `yarn`.

Start the Typescript compiler in watch mode using `yarn run watch`

Enable additional debug logs when running the tool by setting the `VERBOSE` environment variable, e.g.

```bash
VERBOSE=y yarn node dist/src/main.js --input-dir data --daily-stats out/daily-stats.csv --chat-log out/chat-log.txt
```
