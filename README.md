# Rom Patcher JS
A ROM patcher based on RomPatcherJS with additional functionality.

## URL Parameters
URL parameters allow for data to be loaded on the site automatically:
* patchfile - URL to download and set as patch file (Must allow CORS)
* romfile - URL to download and set as rom file (Must allow CORS)
* romhash - Hash/Checksum (CRC32, MD5, or SHA-1) the patch file requires for the ROM
* outputname - Name for the patched ROM file, may be edited by users

## Server Integration:
Server integrations allow for reading and writing data to self-hosted ROM managers.

* Settings are stored locally, API keys stay on device
* Settings can be imported & exported as json

### Romm
* Settings
  * url - Publicly accessible path to your Romm instance
  * apikey - Configured API key for a Romm user
* API key Scopes:
  * roms.read - Download ROM from your library for patching
  * roms.write - Upload patched ROM to your library
  * platforms.read - Get platforms for selecting where to upload patched ROM
  * tasks.run - Rescan library after upload (Does not currently work)

## Usage
```bash
https://mike94100.github.io/RomPatcher.js/?patchfile=<URL>&romfile=<URL>&romhash=<CRC32/MD5/SHA1>&outputname=<STRING>
```

## Cache
ROMs are cached when provided so you do not need to redownload (from configured server or romfile parameter) or reupload manually. You may manually select a file from the cache to use, or delete files from the cache.

## Examples
[Pokemon Sienna ips patch - Base FireRed Rev 0 - sets patchfile, romhash, outputname](https://mike94100.github.io/RomPatcher.js/?patchfile=https%3A%2F%2Fraw.githubusercontent.com%2Fmike94100%2Frompatcher-rs%2Frefs%2Fheads%2Fmain%2Fpatches%2FPokemon_Sienna_(Complete)_(FireRed).ips&romhash=41cb23d8dccc8ebd7c649cd8fbb58eeace6e2fdc&outputname=Pokemon%20Sienna%20(Rev%206)%20(Hack))

## AI
Yes this is vibe-coded and I have minimal experience with JS. I wanted to put together features that I thought would be beneficial for a general-purpose ROM patcher. If you do not want to use it, understood. If you want to improve it, please do.