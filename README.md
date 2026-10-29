# RomPatcherJS+
A ROM patcher based on RomPatcherJS with additional functionality.

## URL Parameters
URL parameters allow for data to be loaded on the site automatically:
* patchfile - URL to download and set as patch file (Must allow CORS).
* romfile - URL to download and set as rom file (Must allow CORS).
* romhash - Hash/Checksum (CRC32, MD5, or SHA-1) the patch file requires for the ROM.
* outputname - Name for the patched ROM file, may be edited by users.
* metadata - URL to a json file which provides the other URL parameters.

## Server Integration:
Read and write data to self-hosted ROM managers. Settings and API keys are stored locally and can be imported & exported as json.

### [Romm](https://docs.romm.app/latest/)
* Features
  * Get base ROM by hash or name.
  * Get previous ROM version for name formatting.
  * Get previous ROM version to copy latest save (not currently supported).
  * Upload to Romm library.
* Settings
  * url - URL to your Romm instance accessible by your browser.
  * token - API token for a Romm user. Configured in Settings - Client API Tokens.
    * Permissions:
      * roms.read - Download ROM from your library for patching
      * roms.write - Upload patched ROM to your library
      * platforms.read - Get platforms for selecting where to upload patched ROM
      * tasks.run - Rescan library after upload
      * assets.read - Get save file from previous version (Not currently supported)
      * assets.write - Write previous version save file to new upload (not currently supported)
* Cross-Origin Browser Requests (CORS)
  * Romm blocks cross-origin browser API calls unless the calling origin is listed in `ROMM_CORS_ALLOWED_ORIGINS` on the Romm server (defaults to empty, which denies all).
  * Add the origin serving RomPatcher.js to Environment Variables as: `ROMM_CORS_ALLOWED_ORIGINS=https://mike94100.github.io`
  * Multiple origins are comma-separated. Recreate Romm after changing.

## Local Testing

```bash
npm run dev
# or separately:
npm run certs
npm run start:https
```

Then open `https://localhost:8443/` and accept the self-signed certificate warning.

* Server testing:
  * Romm
    * [Romm OpenAPI Latest](https://demo.romm.app/openapi.json)
    * `ROMM_CORS_ALLOWED_ORIGINS=https://localhost:8443`

## Cached ROMs
All ROMs are cached locally by browser when loaded manually, via extension, or via romfile parameter. Cached ROMs can be manually selected by the user or automatically selected by hash.

## URL Builder
The URL Builder helps create formatted URLs with URL parameters. It can also breakdown a provided URL to be more easily edited.

## Usage
```bash
https://mike94100.github.io/RomPatcher.js/?patchfile=<URL>&romfile=<URL>&romhash=<CRC32/MD5/SHA1>&outputname=<STRING>
```

```bash
https://mike94100.github.io/RomPatcher.js/?metadata=<URL>
```

## Examples
* [Pokemon Sienna IPS - FireRed Rev 0 - patchfile, romhash, outputname](https://mike94100.github.io/RomPatcher.js/?patchfile=https%3A%2F%2Fraw.githubusercontent.com%2Fmike94100%2Frompatcher-rs%2Frefs%2Fheads%2Fmain%2Fpatches%2FPokemon_Sienna_(Complete)_(FireRed).ips&romhash=41cb23d8dccc8ebd7c649cd8fbb58eeace6e2fdc&outputname=Pokemon%20Sienna%20(Rev%206)%20(Hack))
* [Pokemon Crystal Legacy BPS - Crystal Rev 0 - patchfile, outputname](https://mike94100.github.io/RomPatcher.js/?patchfile=https%3A%2F%2Fraw.githubusercontent.com%2Fmike94100%2Frompatcher-rs%2Frefs%2Fheads%2Fmain%2Fpatches%2FPokemon_Crystal_Legacy_(v1.3.1)_(Crystal).bps&outputname=Pokemon%20Crystal%20Legacy(Rev%201.3.1)%20(Hack))

## Issues

### Patch and Rom File URL Parameters require CORS
The site cannot download files from sites that do not allow Cross-Origin Resource Sharing (CORS). The URL Builder should help to test if links will work. As an example, GitHub Releases will not work, but files committed to the repo will work through the raw.githubusercontent.com link. This could also be worked around with a CORS proxy.

## AI
Yes this is vibe-coded. I wanted to put together features that I thought would be beneficial for a general-purpose ROM patcher. If you do not want to use it, understood. If you want to improve it, please do.