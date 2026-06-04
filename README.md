# Rom Patcher JS
A ROM patcher based on RomPatcherJS with additional functionality.

## URL Parameters
URL parameters allow for custom data to be loaded on the site:
* patchfile - Download and set patch file by URL (Must allow CORS)
* romfile - Download and set ROM file by URL (Must allow CORS)
* romhash - Set a required source CRC32, MD5, or SHA-1 hash for patches that do not provide it

## Server Integration:
Server integrations allow for reading and writing data to self-hosted ROM managers. All settings are stored locally in browser. Options available to import and export as json.

### Romm
* Settings
  * url - Publicly accessible path to your Romm instance
  * apikey - Configured API Key for a Romm user
* API Key Scopes:
  * roms.read - Download ROM from your library for patching
  * roms.write - Upload patched ROM to your library
  * platforms.read - Get platforms for selecting where to upload patched ROM
  * tasks.run - Rescan library after upload (Does not currently work)

## Usage
```bash
https://mike94100.github.io/RomPatcher.js/?patchfile=<URL>&romfile=<URL>&romhash=<CRC32/MD5/SHA1>
```