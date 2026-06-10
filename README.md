# RomPatcherJS+
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

### [Romm](https://docs.romm.app/latest/)
* Features
  * Get base ROM by hash or name
  * Get previous version for name format or to copy latest save (copying save not currently supported)
  * Upload to Romm library
* Settings
  * url - Publicly accessible path to your Romm instance
  * apikey - Configured API key for a Romm user
* API key Scopes:
  * roms.read - Download ROM from your library for patching
  * roms.write - Upload patched ROM to your library
  * platforms.read - Get platforms for selecting where to upload patched ROM
  * tasks.run - Rescan library after upload (Not currently supported)
  * assets.read - Get save file from previous version (Not currently supported)
  * assets.write - Write previous version save file to new upload (not currently supported)

## Cache
ROMs are cached locally when provided via extension, romfile parameter, or manually. Cached ROMs may be manually selected for use in patching. Cached ROMs may be manually deleted.

## URL Builder
The URL Builder helps create formatted URLs with URL parameters. It can also breakdown a provided URL to be more easily edited.

## Usage
```bash
https://mike94100.github.io/RomPatcher.js/?patchfile=<URL>&romfile=<URL>&romhash=<CRC32/MD5/SHA1>&outputname=<STRING>
```

## Examples
* [Pokemon Sienna IPS - FireRed Rev 0 - patchfile, romhash, outputname](https://mike94100.github.io/RomPatcher.js/?patchfile=https%3A%2F%2Fraw.githubusercontent.com%2Fmike94100%2Frompatcher-rs%2Frefs%2Fheads%2Fmain%2Fpatches%2FPokemon_Sienna_(Complete)_(FireRed).ips&romhash=41cb23d8dccc8ebd7c649cd8fbb58eeace6e2fdc&outputname=Pokemon%20Sienna%20(Rev%206)%20(Hack))
* [Pokemon Crystal Legacy BPS - Crystal Rev 0 - patchfile, outputname](https://mike94100.github.io/RomPatcher.js/?patchfile=https%3A%2F%2Fraw.githubusercontent.com%2Fmike94100%2Frompatcher-rs%2Frefs%2Fheads%2Fmain%2Fpatches%2FPokemon_Crystal_Legacy_(v1.3.1)_(Crystal).bps&outputname=Pokemon%20Crystal%20Legacy(Rev%201.3.1)%20(Hack))

## Issues

### Patch and Rom File URL Parameters require CORS
The site cannot download files from sites that do not allow Cross-Origin Resource Sharing (CORS). The URL Builder should help to test if links will work. As an example, GitHub Releases will not work, but files committed to the repo will work through the raw.githubusercontent.com link. This could also be worked around with a CORS proxy.

### Romm doesn't scan after uploads
Files uploaded to Romm via API do not automatically scan like they would via UI. There is no mechanism currently to run a scan via API. You will need to run a scan manually, run scans on a schedule, or use the file system watcher scan.

## AI
Yes this is vibe-coded. I wanted to put together features that I thought would be beneficial for a general-purpose ROM patcher. If you do not want to use it, understood. If you want to improve it, please do.