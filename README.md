# StatsApp

StatsApp is a command-line tool that parses group chat export files from WhatsApp, and performs some data analysis, outputting CSV files that can be visualized in an app like <https://flourish.studio/>.

## Features

### Input

The program accepts a `.txt` file that contains a chat history export from WhatsApp. This is known as single-file mode.

Alternatively, you can provide a folder of chat exports taken at different times, known as folder mode. This is essential for long chat histories (1 year+) because WhatsApp limits the number of messages included in a single export.

### Processing

WhatsApp formats dates and times in the export based on your phone's localization settings. StatsApp has been tested with the United Kingdom locale, and can handle either 12-hour or 24-hour time. If the program fails to parse an export from your phone, please open an issue so that we can add support for your locale!

In addition, WhatsApp uses contact names (as they are at time of export) to identify message authors. Since contact names can change over time, when using folder mode, different exports may use different contact names. To remedy this, a configuration file is supported, which allows linking different contact names (identified using a regex) to a single canonical name.

### Output

StatsApp's main job is to create CSV reports that are written to a user-specified file. Any or all of the reports can be omitted from the command line arguments, in which case they won't be generated.

## Diagrams

### Single-file mode

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/StatsApp%20single%20file%20mode%20(dark).excalidraw.svg">
  <img alt="A diagram showing the inputs and outputs for StatsApp (when given a single file), and their corresponding command-line arguments" src="./assets/StatsApp%20single%20file%20mode.excalidraw.svg">
</picture>

### Folder mode

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/StatsApp%20folder%20mode%20(dark).excalidraw.svg">
  <img alt="A diagram showing the inputs and outputs for StatsApp (when given a folder of chat exports), and their corresponding command-line arguments" src="./assets/StatsApp%20folder%20mode.excalidraw.svg">
</picture>

## Usage guide

### Step 0: Installation


### Step 1: Taking a WhatsApp chat export

Open the WhatsApp chat you want to generate statistics for on your phone. In the Android app, press the three dots in the top bar, press **More**, press **Export chat**, and select **Without media** in the popup.

WhatsApp will take some time to generate the export. Once its done, the share screen will pop up, and you can save the `.zip` file it produced by attaching it to a message to yourself, or any other method. Transfer the file to the computer running StatsApp. Finally, extract the `.zip` file so that you have the `.txt` chat export file.

### Step 2: Run StatsApp

TODO

## Development instructions

This is a Typescript + Node.js project that uses Yarn v4 for package management. After cloning the repository, install dependencies by running `yarn`.

Start the Typescript compiler in watch mode using `yarn run watch`

Enable additional debug logs when running the tool by setting the `--verbose` flag, e.g.

```bash
VERBOSE=y yarn node dist/src/main.js --verbose --input-dir data --daily-stats out/daily-stats.csv --chat-log out/chat-log.txt
```
