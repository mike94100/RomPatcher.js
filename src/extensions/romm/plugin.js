/*
* Rom Patcher JS - RomM Client Plugin
* Thin registration layer using the Client Integration Framework
* License: MIT
*/

(function () {
	const MAX_DEPENDENCY_RETRIES = 150; /* 30 seconds at 200ms intervals */

	/* Wait for all dependencies to load */
	let _retryCount = 0;
	const _init = function () {
		if (
			typeof ClientRegistry === 'undefined' ||
			typeof ClientIntegration === 'undefined' ||
			typeof RommClient === 'undefined'
		) {
			_retryCount++;
			if (_retryCount >= MAX_DEPENDENCY_RETRIES) {
				console.error('Failed to load dependencies after ' + MAX_DEPENDENCY_RETRIES + ' retries');
				return;
			}
			setTimeout(_init, 200);
			return;
		}

		console.log('Registering RomM client with integration framework');

		/* State for previous version */
		let _previousVersionRom = null; /* {rom, fs_name_no_ext} */

		/* Helper: download a ROM from server and load it into the ROM file slot */
		const _loadRomFromServer = async function (client, rom) {
			const romId = rom.id;
			const fileName = rom.fs_name || rom.file_name || 'rom.bin';
			console.log('_loadRomFromServer: downloading romId=' + romId + ' fileName=' + fileName);
			try {
				const btns = document.querySelectorAll('#client-search-hash, #client-search-name');
				btns.forEach(function (b) { b.disabled = true; });

				const arrayBuffer = await client.downloadRom(romId, fileName);
				const binFile = new BinFile(arrayBuffer);
				binFile.fileName = fileName;
				ClientIntegration.setSelectedRom(rom, rom.platform_id || null);
				console.log('_loadRomFromServer: downloaded ' + arrayBuffer.byteLength + ' bytes, providing to RomPatcherWeb');

				if (typeof RomPatcherWeb !== 'undefined' && RomPatcherWeb.provideRomFile) {
					RomPatcherWeb.provideRomFile(binFile, true);
					if (typeof RomPatcherWeb.showAutoLoadToast === 'function') {
						RomPatcherWeb.showAutoLoadToast('Loaded from RomM: ' + fileName);
					}
				}
			} catch (e) {
				console.error('Failed to download ROM: ' + e.message);
				alert('Failed to download ROM from server: ' + e.message);
			} finally {
				const btns = document.querySelectorAll('#client-search-hash, #client-search-name');
				btns.forEach(function (b) { b.disabled = false; });
			}
		};

		ClientIntegration.register('romm', {
			/* Auto-lookup: called when a patch with hashes is loaded */
			onAutoLookup: async function (client, hashes) {
				if (!hashes) {
					console.log('onAutoLookup: no hashes provided, skipping');
					return;
				}
				console.log('onAutoLookup: starting auto-lookup with hashes');

				const hashInput = document.getElementById('client-hash-value');
				if (hashInput) {
					hashInput.value = hashes.crc_hash || hashes.md5_hash || hashes.sha1_hash || '';
				}

				try {
					const rom = await client.getRomByHash(hashes);
					if (rom) {
						console.log('onAutoLookup: found ROM id=' + rom.id + ' on server, auto-loading');
						await _loadRomFromServer(client, rom);
					} else {
						console.log('onAutoLookup: no ROM found on server for given hash');
					}
				} catch (e) {
					console.warn('Auto-lookup failed: ' + e.message);
				}
			},

			/* Search by hash button */
			onSearchByHash: async function (client, hashes) {
				console.log('onSearchByHash: searching by hash');
				try {
					const rom = await client.getRomByHash(hashes);
					if (rom) {
						console.log('onSearchByHash: found ROM id=' + rom.id + ', loading');
						await _loadRomFromServer(client, rom);
					} else {
						console.log('onSearchByHash: no ROM found');
						alert('No ROM found with that hash on RomM.');
					}
				} catch (e) {
					console.error('Hash search failed: ' + e.message);
					alert('RomM hash search failed: ' + e.message);
				}
			},

			/* Search by name button */
			onSearchByName: async function (client, term) {
				try {
					const results = await client.searchRoms(term);
					const resultsDiv = document.getElementById('client-search-results');
					if (!resultsDiv) return;
					resultsDiv.innerHTML = '';
					if (results && results.items && results.items.length) {
						resultsDiv.style.display = '';
						results.items.forEach(function (rom) {
							const item = document.createElement('div');
							item.className = 'client-result-item';
							item.textContent = (rom.name || rom.fs_name || 'Unknown') + (rom.platform_display_name ? ' [' + rom.platform_display_name + ']' : '');
							item.title = 'ID: ' + rom.id + ' | CRC: ' + (rom.crc_hash || 'N/A');
							item.addEventListener('click', function () {
								_loadRomFromServer(client, rom);
								resultsDiv.style.display = 'none';
							});
							resultsDiv.appendChild(item);
						});
					} else {
						resultsDiv.style.display = '';
						resultsDiv.innerHTML = '<div class="text-muted" style="padding:8px;font-size:12px">No results found</div>';
					}
				} catch (e) {
					alert('RomM search failed: ' + e.message);
				}
			},

			/* Download selected ROM from server — delegates to _loadRomFromServer */
			onDownload: async function (client, selectedRom) {
				await _loadRomFromServer(client, selectedRom);
			},

			/* Upload patched ROM to server.
			   Checks for name collision — blocks upload if the output name matches
			   the previous version's name, or if a ROM with the same name already
			   exists on the target platform. */
			onUpload: async function (client, patchedRom, platformId, fileName, wantZip, createZipFn) {
				const progressDiv = document.getElementById('client-progress');
				if (progressDiv) {
					progressDiv.style.display = '';
					progressDiv.textContent = 'Uploading to RomM... 0%';
				}

				/* Check if output name is the same as the previous version's name */
				if (_previousVersionRom) {
					var prevName = _previousVersionRom.fs_name_no_ext;
					var uploadNameNoExt = fileName.replace(/\.[^.]+$/, '');
					if (prevName && uploadNameNoExt === prevName) {
						if (progressDiv) progressDiv.textContent = '';
						alert('The output file name "' + fileName + '" is the same as the previous version. Please change the version number in the output name to avoid overwriting.');
						return;
					}
				}

				/* Check for name collision with existing ROMs on the target platform */
				try {
					var collisionCheckName = wantZip ? fileName.replace(/\.[^.]+$/, '') + '.zip' : fileName;
					var exists = await client.romExistsByName(platformId, collisionCheckName);
					if (exists) {
						if (progressDiv) progressDiv.textContent = '';
						alert('A ROM with the name "' + collisionCheckName + '" already exists on this platform. Please change the output name and try again.');
						return;
					}
				} catch (e) {
					console.warn('onUpload: name collision check failed: ' + e.message);
				}

				const doUpload = function (buffer, uploadName) {
					client.uploadRom(platformId, uploadName, buffer, function (loaded, total) {
						var pct = Math.round(loaded / total * 100);
						if (progressDiv) progressDiv.textContent = 'Uploading to RomM... ' + pct + '%';
					}).then(function () {
						if (progressDiv) {
							progressDiv.textContent = 'Upload complete!';
							setTimeout(function () { progressDiv.style.display = 'none'; }, 3000);
						}
					}).catch(function (err) {
						if (progressDiv) progressDiv.textContent = '';
						alert('Upload to RomM failed: ' + err.message);
					});
				};

				if (wantZip) {
					const zipName = fileName.replace(/\.[^.]+$/, '') + '.zip';
					createZipFn(patchedRom, fileName, function (zipBuffer) {
						doUpload(zipBuffer, zipName);
					});
				} else {
					doUpload(patchedRom._u8array.buffer, fileName);
				}
			}
		});

		/* ---- Wire up previous version search UI ---- */
		(function () {
			/* Wait for DOM elements to exist */
			var _waitForPrevVersionEls = function () {
				var searchInput = document.getElementById('client-prev-version-search');
				var searchBtn = document.getElementById('client-prev-version-search-btn');
				if (!searchInput || !searchBtn) {
					setTimeout(_waitForPrevVersionEls, 200);
					return;
				}

				searchBtn.addEventListener('click', function () {
					_doPreviousVersionSearch();
				});
				searchInput.addEventListener('keydown', function (e) {
					if (e.key === 'Enter') _doPreviousVersionSearch();
				});
			};

			var _doPreviousVersionSearch = async function () {
				var client = ClientRegistry.getClient('romm');
				if (!client || !client.isConfigured()) {
					alert('RomM is not configured. Please configure it in Settings first.');
					return;
				}

				var searchInput = document.getElementById('client-prev-version-search');
				var searchBtn = document.getElementById('client-prev-version-search-btn');
				var resultsDiv = document.getElementById('client-prev-version-results');
				var selectedDiv = document.getElementById('client-prev-version-selected');
				if (!searchInput || !resultsDiv) return;

				var term = searchInput.value.trim();
				if (!term) return;

				resultsDiv.innerHTML = '<div class="text-muted" style="padding:8px;font-size:12px">Searching...</div>';
				resultsDiv.style.display = '';
				if (searchBtn) searchBtn.disabled = true;

				try {
					var searchResults = await client.searchRoms(term);
					resultsDiv.innerHTML = '';
					if (searchResults && searchResults.items && searchResults.items.length) {
						searchResults.items.forEach(function (rom) {
							var item = document.createElement('div');
							item.className = 'client-result-item';
							var platformName = rom.platform_display_name || '';
							var label = (rom.name || rom.fs_name || 'Unknown');
							if (platformName) label += ' [' + platformName + ']';
							item.textContent = label;
							item.title = 'ID: ' + rom.id + ' | File: ' + (rom.fs_name || '');
							item.addEventListener('click', function () {
								/* Clear previous selection highlight */
								var allItems = resultsDiv.querySelectorAll('.client-result-item');
								allItems.forEach(function (el) { el.style.background = ''; });
								item.style.background = '#d4edda';

								/* Store the previous version */
								_previousVersionRom = {
									rom: rom,
									fs_name_no_ext: rom.fs_name_no_ext || rom.fs_name.replace(/\.[^.]+$/, '') || rom.fs_name
								};

								/* Show selected info */
								if (selectedDiv) {
									selectedDiv.innerHTML = 'Previous version set: <strong>' + (rom.name || rom.fs_name || 'Unknown') + '</strong>' +
										(platformName ? ' [' + platformName + ']' : '') +
										'<br><span style="font-size:11px">File name: ' + (_previousVersionRom.fs_name_no_ext) + '</span>';
									selectedDiv.style.display = '';
								}

								/* Pre-fill the output name with the previous version's file name (no extension) */
								var nameInput = document.getElementById('client-output-name');
								if (nameInput) {
									nameInput.value = _previousVersionRom.fs_name_no_ext;
									nameInput.placeholder = _previousVersionRom.fs_name_no_ext;
								}

								/* Hide results after selection */
								resultsDiv.style.display = 'none';

								console.log('Previous version set: romId=' + rom.id + ' name=' + (rom.fs_name || rom.name));
							});
							resultsDiv.appendChild(item);
						});
					} else {
						resultsDiv.innerHTML = '<div class="text-muted" style="padding:8px;font-size:12px">No results found</div>';
					}
				} catch (e) {
					resultsDiv.innerHTML = '<div style="padding:8px;font-size:12px;color:red">Search failed: ' + e.message + '</div>';
				} finally {
					if (searchBtn) searchBtn.disabled = false;
				}
			};

			_waitForPrevVersionEls();
		})();

		/* Show the previous version area when RomM is configured */
		var _showPrevVersionArea = function () {
			var client = ClientRegistry.getClient('romm');
			if (client && client.isConfigured()) {
				var prevArea = document.getElementById('client-prev-version-area');
				if (prevArea) prevArea.style.display = '';
			}
		};

		/* Check periodically for RomM configuration and show the prev version area */
		(function _pollConfig() {
			var client = ClientRegistry.getClient('romm');
			if (client && client.isConfigured()) {
				_showPrevVersionArea();
			} else {
				setTimeout(_pollConfig, 1000);
			}
		})();
	};

	/* Wait for DOM to be ready since scripts load in <head> before DOM is parsed */
	if (document.readyState !== 'loading') {
		_init();
	} else {
		document.addEventListener('DOMContentLoaded', function () {
			_init();
		});
	}
})();