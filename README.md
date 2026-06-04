# Rom Patcher JS
A ROM patcher based on RomPatcherJS with additional functionality.

## Features
* URL parameters:
  * patchfile - Download and set patch file by URL (Must allow CORS)
  * romfile - Download and set ROM file by URL (Must allow CORS)
  * romhash - Set a required source ROM hash (CRC / MD5 / SHA1) for patches that do not provide it
* Self-hosted server integration:
  * Romm - Locally stored URL & API Key allows for:
    * Downloading source ROMs by hash
    * Uploading patched ROMs to specific platform