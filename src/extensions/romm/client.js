/*
* Client.Romm.js - RomM API client for Rom Patcher JS
* Allows Rom Patcher JS to communicate with a RomM server
* By [Your Name]
* Sourcecode: https://github.com/marcrobledo/RomPatcher.js
* License: MIT
*/

/*
 * Client interface contract:
 *   id: string              - unique client identifier
 *   name: string            - display name
 *   settingsFields: array   - [{id, label, type, placeholder}] for settings dialog generation
 *   configure(url, key)     - set connection parameters
 *   isConfigured()          - returns boolean
 *   testConnection()        - returns Promise<string> (version string)
 *   searchByHash(hashes)    - returns Promise<object|null>
 *   searchByName(term)      - returns Promise<object[]>
 *   downloadRom(id, name)   - returns Promise<ArrayBuffer>
 *   uploadRom(pid, name, buf, onProg) - returns Promise<boolean>
 *   getPlatforms()          - returns Promise<object[]>
 *   loadSettings()          - load from localStorage
 *   saveSettings()          - save to localStorage
 *   exportSettings()        - returns JSON string
 *   importSettings(json)    - restore from JSON string
 */

const RommClient = (function () {
	const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks for upload

	let _url = '';
	let _apiKey = '';

	let _platformsCache = null;
	let _platformsCacheTime = 0;

	const _getHeaders = function () {
		return {
			'Authorization': 'Bearer ' + _apiKey,
			'Content-Type': 'application/json'
		};
	};

	const _fetchJson = async function (path, options) {
		const response = await fetch(_url + path, options);
		if (!response.ok) {
			let errorMsg = 'HTTP ' + response.status;
			try {
				const errorData = await response.json();
				if (errorData.detail)
					errorMsg += ': ' + (typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail));
			} catch (e) { /* response body was not JSON */ }
			throw new Error(errorMsg);
		}
		return response.json();
	};

	const SETTINGS_KEY = 'rom-patcher-js-client-romm';
	const _settings = { url: '', apiKey: '' };

	const _loadSettings = function () {
		if (typeof localStorage === 'undefined') return;
		try {
			const stored = localStorage.getItem(SETTINGS_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				if (typeof parsed.url === 'string') _settings.url = parsed.url;
				if (typeof parsed.apiKey === 'string') _settings.apiKey = parsed.apiKey;
				if (_settings.url && _settings.apiKey) {
					_url = _settings.url;
					_apiKey = _settings.apiKey;
				}
			}
		} catch (e) {
			console.error('[RommClient] Error loading settings: ' + e.message);
		}
	};

	const _saveSettings = function () {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(SETTINGS_KEY, JSON.stringify(_settings));
		} catch (e) {
			console.error('[RommClient] Error saving settings: ' + e.message);
		}
	};

	return {
		/* Interface metadata */
		id: 'romm',
		name: 'RomM',
		settingsFields: [
			{ id: 'url', label: 'Server URL', type: 'url', placeholder: 'https://romm.example.com' },
			{ id: 'apiKey', label: 'API Key', type: 'password', placeholder: 'romm_xxxxxxxx...' }
		],

		/* Expose internal settings as properties so client-integration can read/write them */
		get _url() { return _url; },
		set _url(v) { _url = v; },
		get _apiKey() { return _apiKey; },
		set _apiKey(v) { _apiKey = v; },

		isConfigured: function () {
			return _url && _apiKey;
		},

		getUrl: function () {
			return _url;
		},

		configure: function (url, apiKey) {
			var oldUrl = _url;
			_url = url.replace(/\/+$/, '');
			_apiKey = apiKey;
			_platformsCache = null;
			console.log('configured: URL=' + _url + ' (was ' + (oldUrl || 'empty') + '), API key set=' + (_apiKey ? 'yes' : 'no'));
		},

		testConnection: async function () {
			console.log('Testing connection to ' + _url);
			const data = await _fetchJson('/api/heartbeat', {
				headers: _getHeaders()
			});
			var version = data && data.SYSTEM && data.SYSTEM.VERSION ? data.SYSTEM.VERSION : 'unknown';
			console.log('Connection test succeeded: v' + version);
			return version;
		},

		getPlatforms: async function (forceRefresh) {
			if (_platformsCache && !forceRefresh && (Date.now() - _platformsCacheTime) < 30000) {
				console.log('getPlatforms: returning cached data (' + _platformsCache.length + ' platforms)');
				return _platformsCache;
			}
			console.log('getPlatforms: fetching from server' + (forceRefresh ? ' (forced refresh)' : ''));
			const data = await _fetchJson('/api/platforms', {
				headers: _getHeaders()
			});
			_platformsCache = data;
			_platformsCacheTime = Date.now();
			console.log('getPlatforms: got ' + (data ? data.length : 0) + ' platforms');
			return data;
		},

		getRomByHash: async function (hashes) {
			/*
			 * hashes can contain: crc_hash, md5_hash, sha1_hash, ra_hash
			 * Returns DetailedRomSchema or null if not found
			 */
			const params = new URLSearchParams();
			if (hashes.crc_hash) params.append('crc_hash', hashes.crc_hash);
			if (hashes.md5_hash) params.append('md5_hash', hashes.md5_hash);
			if (hashes.sha1_hash) params.append('sha1_hash', hashes.sha1_hash);
			if (hashes.ra_hash) params.append('ra_hash', hashes.ra_hash);

			const queryString = params.toString();
			if (!queryString) {
				console.log('getRomByHash: no hash parameters provided');
				return null;
			}

			console.log('getRomByHash: searching with ' + queryString.substring(0, 60) + '...');
			try {
				const result = await _fetchJson('/api/roms/by-hash?' + queryString, {
					headers: _getHeaders()
				});
				if (result) console.log('getRomByHash: found ROM id=' + result.id + ' name=' + (result.name || 'unknown'));
				else console.log('getRomByHash: no ROM found');
				return result;
			} catch (err) {
				if (err.message.indexOf('404') !== -1 || err.message.indexOf('400') !== -1) {
					console.log('getRomByHash: not found (404/400)');
					return null;
				}
				console.error('getRomByHash: error: ' + err.message);
				throw err;
			}
		},

		getRomById: async function (romId) {
			console.log('getRomById: fetching ROM id=' + romId);
			return _fetchJson('/api/roms/' + romId, {
				headers: _getHeaders()
			});
		},

		searchRoms: async function (searchTerm, platformIds) {
			console.log('searchRoms: searching term="' + searchTerm + '"' + (platformIds ? ' platformIds=' + platformIds.join(',') : ''));
			const params = new URLSearchParams();
			params.append('search_term', searchTerm);
			params.append('limit', '50');
			params.append('offset', '0');
			params.append('with_char_index', 'false');
			params.append('with_filter_values', 'false');
			if (platformIds && platformIds.length) {
				platformIds.forEach(function (id) {
					params.append('platform_ids', id);
				});
			}
			const result = await _fetchJson('/api/roms?' + params.toString(), {
				headers: _getHeaders()
			});
			if (result && result.items) console.log('searchRoms: got ' + result.items.length + ' results');
			else console.log('searchRoms: got 0 results');
			return result;
		},

		/* Get the latest save file (not save state) for a given ROM */
		getSavesSummary: async function (romId) {
			console.log('getSavesSummary: fetching saves for romId=' + romId);
			return _fetchJson('/api/saves/summary?rom_id=' + romId, {
				headers: _getHeaders()
			});
		},

		/* Download a save file's content by save ID */
		downloadSaveContent: async function (saveId) {
			console.log('downloadSaveContent: downloading save id=' + saveId);
			const response = await fetch(_url + '/api/saves/' + saveId + '/content', {
				headers: {
					'Authorization': 'Bearer ' + _apiKey
				}
			});
			if (!response.ok)
				throw new Error('Download save failed: HTTP ' + response.status);
			const buf = await response.arrayBuffer();
			console.log('downloadSaveContent: downloaded ' + buf.byteLength + ' bytes');
			return buf;
		},

		/* Upload a save file for a given ROM */
		uploadSave: async function (romId, fileName, fileBuffer, onProgress) {
			console.log('uploadSave: uploading save for romId=' + romId + ' fileName=' + fileName + ' size=' + (fileBuffer ? fileBuffer.byteLength : 0) + ' bytes');
			const formData = new FormData();
			const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
			formData.append('saveFile', blob, fileName);

			const response = await fetch(_url + '/api/saves?rom_id=' + romId, {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer ' + _apiKey
				},
				body: formData
			});
			if (!response.ok) {
				let errorMsg = 'Save upload failed: HTTP ' + response.status;
				if (response.status === 403) {
					errorMsg += ': API token missing required scope "assets.write". Generate a new token in RomM Settings → Users → Client Tokens with the "assets.write" scope.';
				} else {
					try {
						const errorData = await response.json();
						if (errorData.detail)
							errorMsg += ': ' + (typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail));
					} catch (e) {}
				}
				throw new Error(errorMsg);
			}
			const result = await response.json();
			console.log('uploadSave: uploaded save id=' + result.id);
			return result;
		},

		/* Check if a file name already exists for a given search on the platform */
		romExistsByName: async function (platformId, fileName) {
			console.log('romExistsByName: checking if "' + fileName + '" exists on platform ' + platformId);
			try {
				const result = await this.searchRoms(fileName, [platformId]);
				if (result && result.items) {
					for (var i = 0; i < result.items.length; i++) {
						if (result.items[i].fs_name === fileName || result.items[i].fs_name_no_ext === fileName.replace(/\.[^.]+$/, '')) {
							console.log('romExistsByName: found existing ROM with same name id=' + result.items[i].id);
							return true;
						}
					}
				}
				return false;
			} catch (e) {
				console.warn('romExistsByName: search failed: ' + e.message);
				return false;
			}
		},

		/* Search for a ROM by SHA-1 hash (after upload to find the new ROM) */
		getRomBySha1: async function (sha1Hash) {
			console.log('getRomBySha1: searching with sha1=' + sha1Hash);
			try {
				const result = await _fetchJson('/api/roms/by-hash?sha1_hash=' + sha1Hash, {
					headers: _getHeaders()
				});
				if (result) console.log('getRomBySha1: found ROM id=' + result.id + ' name=' + (result.name || 'unknown'));
				else console.log('getRomBySha1: no ROM found');
				return result;
			} catch (err) {
				if (err.message.indexOf('404') !== -1 || err.message.indexOf('400') !== -1) {
					console.log('getRomBySha1: not found (404/400)');
					return null;
				}
				console.error('getRomBySha1: error: ' + err.message);
				throw err;
			}
		},

		downloadRom: async function (romId, fileName) {
			console.log('downloadRom: starting download romId=' + romId + ' fileName=' + fileName);
			/* Get the actual file name from the ROM details first */
			let actualFileName = fileName;
			try {
				const details = await _fetchJson('/api/roms/' + romId, {
					headers: _getHeaders()
				});
				if (details && details.files && details.files.length) {
					/* Use the first file's name */
					actualFileName = details.files[0].file_name || details.files[0].file_path || fileName;
					console.log('downloadRom: resolved actualFileName=' + actualFileName);
				}
			} catch (e) {
				console.warn('downloadRom: could not fetch ROM details, using provided fileName: ' + e.message);
			}
			const url = _url + '/api/roms/' + romId + '/content/' + actualFileName;
			var startTime = Date.now();
			const response = await fetch(url, {
				headers: {
					'Authorization': 'Bearer ' + _apiKey
				}
			});
			if (!response.ok)
				throw new Error('Download failed: HTTP ' + response.status);
			const buf = await response.arrayBuffer();
			console.log('downloadRom: downloaded ' + buf.byteLength + ' bytes in ' + (Date.now() - startTime) + 'ms');
			return buf;
		},

		loadSettings: function () {
			console.log('loadSettings: loading from localStorage');
			_loadSettings();
			console.log('loadSettings: loaded URL=' + (_url ? _url.substring(0, 40) + '...' : '(empty)') + ', API key set=' + (_apiKey ? 'yes' : 'no'));
		},
		saveSettings: function () {
			_settings.url = _url;
			_settings.apiKey = _apiKey;
			console.log('saveSettings: saving to localStorage');
			_saveSettings();
		},
		exportSettings: function () {
			console.log('exportSettings: exporting config');
			return JSON.stringify({ url: _url, apiKey: _apiKey }, null, 2);
		},
		importSettings: function (jsonStr) {
			const data = JSON.parse(jsonStr);
			if (typeof data.url === 'string' && typeof data.apiKey === 'string') {
				console.log('importSettings: importing config URL=' + data.url.substring(0, 40) + '...');
				this.configure(data.url, data.apiKey);
				this.saveSettings();
				return true;
			}
			console.warn('importSettings: invalid config format');
			return false;
		},

		uploadRom: async function (platformId, fileName, fileBuffer, onProgress) {
			console.log('uploadRom: starting upload platformId=' + platformId + ' fileName=' + fileName + ' size=' + (fileBuffer ? fileBuffer.byteLength : 0) + ' bytes');
			// Step 1: Start chunked upload
			const totalSize = fileBuffer.byteLength;
			const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

			const startResponse = await fetch(_url + '/api/roms/upload/start', {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer ' + _apiKey,
					'X-Upload-Platform': platformId.toString(),
					'X-Upload-Filename': fileName,
					'X-Upload-Total-Size': totalSize.toString(),
					'X-Upload-Total-Chunks': totalChunks.toString()
				}
			});
			if (!startResponse.ok) {
				let errorMsg = 'Upload start failed: HTTP ' + startResponse.status;
				try {
					const errorData = await startResponse.json();
					if (errorData.detail)
						errorMsg += ': ' + (typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail));
				} catch (e) {}
				throw new Error(errorMsg);
			}
			const startData = await startResponse.json();
			const uploadId = startData.upload_id || startData.id;
			console.log('uploadRom: started upload id=' + uploadId + ' totalChunks=' + totalChunks);

			// Upload chunks
			for (let i = 0; i < totalChunks; i++) {
				const chunkStart = i * CHUNK_SIZE;
				const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, totalSize);
				const chunk = fileBuffer.slice(chunkStart, chunkEnd);

				const chunkResponse = await fetch(_url + '/api/roms/upload/' + uploadId, {
					method: 'PUT',
					headers: {
						'Authorization': 'Bearer ' + _apiKey,
						'Content-Type': 'application/octet-stream',
						'X-Chunk-Index': i.toString()
					},
					body: new Blob([chunk])
				});
				if (!chunkResponse.ok) {
					// Cancel the upload on failure
					try {
						await fetch(_url + '/api/roms/upload/' + uploadId + '/cancel', {
							method: 'POST',
							headers: {
								'Authorization': 'Bearer ' + _apiKey
							}
						});
					} catch (e) {}
					let errorMsg = 'Upload chunk ' + i + ' failed: HTTP ' + chunkResponse.status;
					try {
						const errorData = await chunkResponse.json();
						if (errorData.detail)
							errorMsg += ': ' + (typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail));
					} catch (e) {}
					throw new Error(errorMsg);
				}
				if (typeof onProgress === 'function') {
					onProgress(chunkEnd, totalSize);
				}
			}

			// Complete upload
			const completeResponse = await fetch(_url + '/api/roms/upload/' + uploadId + '/complete', {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer ' + _apiKey
				}
			});
			if (!completeResponse.ok) {
				let errorMsg = 'Upload completion failed: HTTP ' + completeResponse.status;
				try {
					const errorData = await completeResponse.json();
					if (errorData.detail)
						errorMsg += ': ' + (typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail));
				} catch (e) {}
				throw new Error(errorMsg);
			}
			return true;
		},

		// Trigger a rescan so newly uploaded files are picked up.
		// Disabled: scan_library endpoint does not currently allow manual triggers.
		// rescanLibrary: async function () {
		// 	const response = await fetch(_url + '/api/tasks/run/scan_library', {
		// 		method: 'POST',
		// 		headers: {
		// 			'Authorization': 'Bearer ' + _apiKey
		// 		}
		// 	});
		// 	if (!response.ok) {
		// 		let errorMsg = 'Rescan failed: HTTP ' + response.status;
		// 		try {
		// 			const errorData = await response.json();
		// 			if (errorData.detail)
		// 				errorMsg += ': ' + (typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail));
		// 		} catch (e) {}
		// 		throw new Error(errorMsg);
		// 	}
		// 	return response.json();
		// }
	};
})();

/* Self-register with the ClientRegistry if available */
if (typeof ClientRegistry !== 'undefined' && typeof ClientRegistry.register === 'function') {
	ClientRegistry.register(RommClient);
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = RommClient;
}