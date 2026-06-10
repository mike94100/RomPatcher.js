/* Rom Patcher JS (complete webapp implementation) v20240809 - Marc Robledo 2016-2024 - http://www.marcrobledo.com/license */


/* service worker */
const FORCE_HTTPS = true;
if (FORCE_HTTPS && location.protocol === 'http:')
	location.href = window.location.href.replace('http:', 'https:');
else if (location.protocol === 'https:' && 'serviceWorker' in navigator && window.location.hostname === 'www.marcrobledo.com')
	navigator.serviceWorker.register('/RomPatcher.js/_cache_service_worker.js', { scope: '/RomPatcher.js/' }); /* using absolute paths to avoid unexpected behaviour in GitHub Pages */


/* settings */
const LOCAL_STORAGE_SETTINGS_ID = 'rom-patcher-js-settings';
/* default settings */
const settings = {
	language: typeof navigator.userLanguage === 'string' ? navigator.userLanguage.substr(0, 2) : 'en',
	outputSuffix: true,
	fixChecksum: false,
	theme: 'default',
	cacheRoms: true
};
/* load settings from localStorage */
if (typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_STORAGE_SETTINGS_ID)) {
	try {
		const loadedSettings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_SETTINGS_ID));
		const changes = [];

		if (typeof loadedSettings.language === 'string') {
			settings.language = loadedSettings.language;
			changes.push('language=' + settings.language);
		}

		if (typeof loadedSettings.outputSuffix === 'boolean') {
			settings.outputSuffix = loadedSettings.outputSuffix;
			changes.push('outputSuffix=' + settings.outputSuffix);
		}

		if (typeof loadedSettings.fixChecksum === 'boolean') {
			settings.fixChecksum = loadedSettings.fixChecksum;
			changes.push('fixChecksum=' + settings.fixChecksum);
		}

		if (typeof loadedSettings.theme === 'string' && ['light'].indexOf(loadedSettings.theme) !== -1) {
			settings.theme = loadedSettings.theme;
			changes.push('theme=' + settings.theme);
		}

		if (typeof loadedSettings.cacheRoms === 'boolean') {
			settings.cacheRoms = loadedSettings.cacheRoms;
			changes.push('cacheRoms=' + settings.cacheRoms);
		}

		if (changes.length) console.log('Loaded settings from localStorage: ' + changes.join(', '));
	} catch (err) {
		console.error('Error parsing settings from localStorage: ' + err.message);
	}
} else {
	console.log('No saved settings found, using defaults');
}
/* Latest patched ROM, captured from RomPatcherWeb's onpatch callback so
   the standalone download handler can use it without poking into the
   private module-level state of RomPatcherWeb. */
var _latestPatchedRom = null;
/* When the user clicks Download before clicking Apply, we need to first
   run the patch, then download. This flag is set by the download handler
   and read by the onpatch callback. */
var _pendingDownload = false;
/* Reference to the standalone download routine. Assigned below; read from
   the onpatch callback in buildSettingsForWebapp. */
var _standaloneRunDownload = null;

const buildSettingsForWebapp = function () {
	return {
		language: settings.language,
		outputSuffix: settings.outputSuffix,
		fixChecksum: settings.fixChecksum,
		allowDropFiles: true,
		ondropfiles:function(evt){
			if(currentTab === 'creator'){
				/* already on creator tab, nothing to switch */
			}
		},
		/* Reveal the Output section (name + zip) when a ROM is valid or a patch
		   is applied. This is also the responsibility of any server extension
		   (RomM) when configured, but we register it here so the section becomes
		   available regardless of whether an extension is loaded. If a server
		   extension also registers a callback, it will overwrite ours — but its
		   callback does the same reveal work, so behaviour stays correct. */
		onloadrom: function (romFile) {
			/* Skip caching if this ROM was just loaded FROM the cache */
			if (RomPatcherWeb._romCacheLoaded) {
				console.log('onloadrom: ROM was loaded from cache, skip caching');
				return;
			}
			console.log('ROM loaded: ' + (romFile ? romFile.fileName : 'unknown') + ' (' + (romFile ? (romFile._u8array ? romFile._u8array.byteLength : '?') : '?') + ' bytes)');
			/* Auto-cache the ROM once hashes are computed (CRC32, MD5 available immediately, SHA-1 async). */
			if (settings.cacheRoms && typeof RomCache !== 'undefined' && romFile) {
				RomCache.put(romFile, romFile.fileName).then(function (entry) {
					if (entry) console.log('onloadrom: auto-cached ' + entry.name + ' (SHA-1=' + entry.sha1.substring(0, 12) + '...)');
				}).catch(function (e) {
					console.warn('onloadrom: failed to cache ROM: ' + e.message);
				});
			}
		},
		onvalidaterom: function (romFile, validRom) {
			if (!validRom) {
				console.log('ROM validation failed');
				return;
			}
			console.log('ROM validated successfully: ' + (romFile ? romFile.fileName : 'unknown'));
			var outputSection = document.getElementById('client-output-section');
			if (outputSection) outputSection.style.display = '';
			var dlBtn = document.getElementById('client-btn-download');
			if (dlBtn) dlBtn.disabled = false;
			/* pre-populate a default output name if the user hasn't typed one */
			var nameInput = document.getElementById('client-output-name');
			if (nameInput && !nameInput.value.trim() && romFile) {
				var baseName = romFile.fileName.replace(/\.[^.]+$/, '');
				nameInput.value = baseName + ' (patched)';
				nameInput.placeholder = baseName + ' (patched)';
			}
		},
		onpatch: function (patchedRom) {
			console.log('Patch applied successfully: ' + (patchedRom ? patchedRom.fileName : 'unknown') + ' (' + (patchedRom ? (patchedRom._u8array ? patchedRom._u8array.byteLength : '?') : '?') + ' bytes)');
			_latestPatchedRom = patchedRom;
			var outputSection = document.getElementById('client-output-section');
			if (outputSection) outputSection.style.display = '';
			var dlBtn = document.getElementById('client-btn-download');
			if (dlBtn) dlBtn.disabled = false;
			var nameInput = document.getElementById('client-output-name');
			if (nameInput && !nameInput.value.trim()) {
				var baseName = patchedRom.fileName.replace(/\.[^.]+$/, '');
				nameInput.value = baseName + ' (patched)';
				nameInput.placeholder = baseName + ' (patched)';
			}
			/* If the standalone download handler set a flag, run the download now */
			if (_pendingDownload && typeof _standaloneRunDownload === 'function') {
				_pendingDownload = false;
				_standaloneRunDownload(patchedRom);
			}
		}
	};
}
const saveSettings = function () {
	console.log('Saving settings to localStorage: language=' + settings.language + ', outputSuffix=' + settings.outputSuffix + ', fixChecksum=' + settings.fixChecksum + ', theme=' + settings.theme + ', cacheRoms=' + settings.cacheRoms);
	if (typeof localStorage !== 'undefined')
		localStorage.setItem(LOCAL_STORAGE_SETTINGS_ID, JSON.stringify(settings));
	RomPatcherWeb.setSettings(buildSettingsForWebapp());
}


var currentTab = 'patcher';

	/* Add tab bar styles */
	(function() {
		var s = document.createElement('style');
		s.textContent = [
			'.tab-bar {',
			'  display:flex; flex-wrap:wrap; margin-bottom:12px;',
			'  border-bottom:2px solid #ddd;',
			'  position:relative;',
			'}',
			'.tab-button {',
			'  flex:1 1 auto; padding:12px 20px; border:none;',
			'  cursor:pointer; font-size:13px; font-weight:bold; color:#666;',
			'  background:#e8e8e8; transition:all 0.2s;',
			'  white-space:nowrap; min-height:44px;',
			'  border-right:1px solid #ddd;',
			'}',
			'.tab-button:last-child { border-right:none; }',
			'.tab-button:hover { background:#ddd; }',
			'.tab-button:active { background:#ccc; }',
			'.tab-button.active { background:var(--rom-patcher-color-primary,#4a90d9); color:#fff; }'
		].join('\n');
		document.head.appendChild(s);
	})();

window.addEventListener('load', function (evt) {
	/* set theme */
	document.body.className = 'theme-' + settings.theme;

	document.getElementById('settings-language').value = settings.language;
	document.getElementById('settings-language').addEventListener('change', function () {
		settings.language = this.value;
		saveSettings();
		RomPatcherWeb.translateUI(settings.language);
	});

	document.getElementById('settings-output-suffix').checked = !settings.outputSuffix;
	document.getElementById('settings-output-suffix').addEventListener('change', function () {
		settings.outputSuffix = !this.checked;
		saveSettings();
	});

	document.getElementById('settings-fix-checksum').checked = settings.fixChecksum;
	document.getElementById('settings-fix-checksum').addEventListener('change', function () {
		settings.fixChecksum = this.checked;
		saveSettings();
	});

	document.getElementById('settings-light-theme').checked = settings.theme === 'light';
	document.getElementById('settings-light-theme').addEventListener('change', function () {
		settings.theme = this.checked ? 'light' : 'default';
		saveSettings();
		document.body.className = 'theme-' + settings.theme;
	});

	document.getElementById('settings-cache-roms').checked = settings.cacheRoms;
	document.getElementById('settings-cache-roms').addEventListener('change', function () {
		settings.cacheRoms = this.checked;
		saveSettings();
	});

	/* Tab switching */
	const containers = {
		patcher: document.getElementById('rom-patcher-container'),
		creator: document.getElementById('patch-builder-container'),
		cache: document.getElementById('cache-container'),
		'url-builder': document.getElementById('url-builder-container'),
		settings: document.getElementById('settings-container')
	};
	const tabButtons = document.querySelectorAll('.tab-button');
	const switchTab = function (tabId) {
		currentTab = tabId;
		tabButtons.forEach(function (btn) { btn.classList.remove('active'); });
		document.querySelector('.tab-button[data-tab="' + tabId + '"]').classList.add('active');
		for (var id in containers) {
			if (containers[id]) containers[id].style.display = (id === tabId) ? 'block' : 'none';
		}
		if (tabId === 'creator' && !PatchBuilderWeb.isInitialized()) {
			try { PatchBuilderWeb.initialize(); } catch (err) {
				document.getElementById('patch-builder-container').innerHTML = err.message;
				document.getElementById('patch-builder-container').style.color = 'red';
			}
		}
		if (tabId === 'cache') { _refreshCacheList(); }
	};
	tabButtons.forEach(function (btn) {
		btn.addEventListener('click', function () { switchTab(this.dataset.tab); });
	});

	/* URL Builder */
	(function () {
		var elImport = document.getElementById('url-builder-import');
		var elImportBtn = document.getElementById('url-builder-import-btn');
		var elImportStatus = document.getElementById('url-builder-status-import');
		var elPatchUrl = document.getElementById('url-builder-patchfile');
		var elRomUrl = document.getElementById('url-builder-romfile');
		var elRomHash = document.getElementById('url-builder-romhash');
		var elOutputName = document.getElementById('url-builder-outputname');
		var elOutputRaw = document.getElementById('url-builder-output-raw');
		var elOutputMeta = document.getElementById('url-builder-output-metadata');
		var elStatusPatch = document.getElementById('url-builder-status-patchfile');
		var elStatusRom = document.getElementById('url-builder-status-romfile');
		var elStatusHash = document.getElementById('url-builder-status-romhash');

		if (!elOutputRaw) return; /* URL Builder elements not found */

		var _parseImportUrl = function () {
			var url = elImport.value.trim();
			if (!url) { elImportStatus.innerHTML = '<span style="color:orange">Enter a URL</span>'; return; }
			try {
				var parsed = new URL(url);
				var params = parsed.searchParams;
				var pf = params.get('patchfile');
				var rf = params.get('romfile');
				var rh = params.get('romhash');
				var on = params.get('outputname');
				if (pf) elPatchUrl.value = pf;
				if (rf) elRomUrl.value = rf;
				if (rh) elRomHash.value = rh;
				if (on && elOutputName) elOutputName.value = on;
				if (pf || rf || rh || on) {
					elImportStatus.innerHTML = '<span style="color:green">Parameters imported</span>';
				} else {
					elImportStatus.innerHTML = '<span style="color:orange">No known parameters found in URL</span>';
				}
				_validateHash();
				_updateUrl();
			} catch (e) {
				elImportStatus.innerHTML = '<span style="color:red">Invalid URL</span>';
			}
		};

		if (elImportBtn) {
			elImportBtn.addEventListener('click', _parseImportUrl);
		}
		if (elImport) {
			elImport.addEventListener('keydown', function (e) { if (e.key === 'Enter') _parseImportUrl(); });
		}

		var _testUrl = function (url, statusEl, btn) {
			if (!url) { statusEl.innerHTML = ''; return; }
			if (!/^https?:\/\//i.test(url)) { statusEl.innerHTML = '<span style="color:orange">Invalid URL</span>'; return; }
			btn.disabled = true;
			btn.textContent = 'Testing...';
			var controller = new AbortController();
			var timeout = setTimeout(function () { controller.abort(); }, 5000);
			fetch(url, { method: 'HEAD', signal: controller.signal, mode: 'cors' })
				.then(function (r) {
					clearTimeout(timeout);
					statusEl.innerHTML = '<span style="color:green">OK (' + r.status + ')</span>';
				})
				.catch(function (err) {
					clearTimeout(timeout);
					var msg = err.name === 'AbortError' ? 'Timeout' : (err.message.indexOf('Failed to fetch') !== -1 ? 'CORS/Network error' : err.message);
					statusEl.innerHTML = '<span style="color:red">' + msg + '</span>';
				})
				.finally(function () { btn.disabled = false; btn.textContent = 'Test'; });
		};

		var _updateUrl = function () {
			var base = window.location.origin + window.location.pathname;
			var params = [];
			var pf = elPatchUrl.value.trim();
			var rf = elRomUrl.value.trim();
			var rh = elRomHash.value.trim();
			var on = elOutputName ? elOutputName.value.trim() : '';
			if (pf) params.push('patchfile=' + encodeURIComponent(pf));
			if (rf) params.push('romfile=' + encodeURIComponent(rf));
			if (rh) params.push('romhash=' + encodeURIComponent(rh));
			if (on) params.push('outputname=' + encodeURIComponent(on));
			if (params.length) elOutputRaw.value = base + '?' + params.join('&');
			else elOutputRaw.value = base;

			/* Also update the metadata URL output field */
			if (elOutputMeta) {
				var metaUrlInput = document.getElementById('url-builder-metadata-url');
				var metaUrl = metaUrlInput ? metaUrlInput.value.trim() : '';
				if (metaUrl) {
					elOutputMeta.value = base + '?metadata=' + encodeURIComponent(metaUrl);
				} else {
					elOutputMeta.value = '';
				}
			}
		};

		var _validateHash = function () {
			var h = elRomHash.value.trim().toLowerCase().replace('0x', '');
			if (!h) { elStatusHash.innerHTML = ''; return; }
			if (/^[0-9a-f]{8}$/.test(h)) elStatusHash.innerHTML = '<span style="color:green">CRC32 hash</span>';
			else if (/^[0-9a-f]{32}$/.test(h)) elStatusHash.innerHTML = '<span style="color:green">MD5 hash</span>';
			else if (/^[0-9a-f]{40}$/.test(h)) elStatusHash.innerHTML = '<span style="color:green">SHA-1 hash</span>';
			else elStatusHash.innerHTML = '<span style="color:red">Invalid: expected 8/32/40 hex chars</span>';
		};

		elPatchUrl.addEventListener('input', _updateUrl);
		elRomUrl.addEventListener('input', _updateUrl);
		elRomHash.addEventListener('input', function () { _validateHash(); _updateUrl(); });
		if (elOutputName) elOutputName.addEventListener('input', _updateUrl);

		document.getElementById('url-builder-test-patchfile').addEventListener('click', function () {
			_testUrl(elPatchUrl.value.trim(), elStatusPatch, this);
		});
		document.getElementById('url-builder-test-romfile').addEventListener('click', function () {
			_testUrl(elRomUrl.value.trim(), elStatusRom, this);
		});

		document.getElementById('url-builder-copy-raw').addEventListener('click', function () {
			if (!elOutputRaw.value) return;
			navigator.clipboard.writeText(elOutputRaw.value).then(function () {
				var origText = this.textContent;
				this.textContent = 'Copied!';
				var self = this;
				setTimeout(function () { self.textContent = origText; }, 2000);
			}.bind(this)).catch(function () {
				elOutputRaw.select();
				document.execCommand('copy');
			});
		});
		if (elOutputMeta) {
			document.getElementById('url-builder-copy-metadata').addEventListener('click', function () {
				if (!elOutputMeta.value) return;
				navigator.clipboard.writeText(elOutputMeta.value).then(function () {
					var origText = this.textContent;
					this.textContent = 'Copied!';
					var self = this;
					setTimeout(function () { self.textContent = origText; }, 2000);
				}.bind(this)).catch(function () {
					elOutputMeta.select();
					document.execCommand('copy');
				});
			});
		}

		_updateUrl();

		/* ---- Metadata URL input triggers output update ---- */
		(function () {
			var metaUrlInput = document.getElementById('url-builder-metadata-url');
			if (metaUrlInput) {
				metaUrlInput.addEventListener('input', _updateUrl);
			}
		})();

		/* ---- Metadata URL test button ---- */
		(function () {
			var metaUrlInput = document.getElementById('url-builder-metadata-url');
			var testBtn = document.getElementById('url-builder-test-metadata-url');
			var statusEl = document.getElementById('url-builder-status-metadata-url');
			if (metaUrlInput && testBtn) {
				testBtn.addEventListener('click', function () {
					var url = metaUrlInput.value.trim();
					if (!url) { if (statusEl) statusEl.innerHTML = ''; return; }
					if (!/^https?:\/\//i.test(url)) { if (statusEl) statusEl.innerHTML = '<span style="color:orange">Invalid URL</span>'; return; }
					testBtn.disabled = true;
					testBtn.textContent = 'Testing...';
					var controller = new AbortController();
					var timeout = setTimeout(function () { controller.abort(); }, 5000);
					fetch(url, { method: 'GET', signal: controller.signal, mode: 'cors' })
						.then(function (r) {
							clearTimeout(timeout);
							if (!r.ok) throw new Error('HTTP ' + r.status);
							return r.json();
						})
						.then(function (data) {
							var fields = ['patchfile', 'romfile', 'romhash', 'outputname'];
							var found = fields.filter(function (f) { return typeof data[f] === 'string'; });
							if (statusEl) statusEl.innerHTML = '<span style="color:green">OK (' + found.length + '/' + fields.length + ' fields)</span>';
						})
						.catch(function (err) {
							clearTimeout(timeout);
							var msg = err.name === 'AbortError' ? 'Timeout' : err.message;
							if (statusEl) statusEl.innerHTML = '<span style="color:red">' + msg + '</span>';
						})
						.finally(function () { testBtn.disabled = false; testBtn.textContent = 'Test'; });
				});
			}
		})();

		/* ---- JSON metadata import/export ---- */
		var _jsonStatusEl = document.getElementById('url-builder-status-json');
		var _setJsonStatus = function (msg, isError) {
			if (_jsonStatusEl) {
				_jsonStatusEl.innerHTML = isError ? '<span style="color:red">' + msg + '</span>' : '<span style="color:green">' + msg + '</span>';
			}
		};

		/* Export JSON: serialize URL builder fields to a JSON file */
		var _exportJson = function () {
			var pf = elPatchUrl.value.trim();
			var rf = elRomUrl.value.trim();
			var rh = elRomHash.value.trim();
			var on = elOutputName ? elOutputName.value.trim() : '';
			if (!pf && !rf && !rh && !on) {
				_setJsonStatus('No parameters to export.', true);
				return;
			}
			var meta = {};
			if (pf) meta.patchfile = pf;
			if (rf) meta.romfile = rf;
			if (rh) meta.romhash = rh;
			if (on) meta.outputname = on;

			var json = JSON.stringify(meta, null, 2);
			var blob = new Blob([json], { type: 'application/json' });
			var url = URL.createObjectURL(blob);
			var a = document.createElement('a');
			a.href = url;
			a.download = 'rompatcher-metadata.json';
			document.body.appendChild(a);
			a.click();
			URL.revokeObjectURL(url);
			document.body.removeChild(a);
			_setJsonStatus('Exported successfully.', false);
		};

		/* Import JSON: parse a JSON file and populate URL builder fields */
		var _importJson = function () {
			var input = document.createElement('input');
			input.type = 'file';
			input.accept = '.json';
			input.addEventListener('change', function (evt) {
				if (!this.files || !this.files.length) return;
				var reader = new FileReader();
				reader.onload = function (evt) {
					try {
						var data = JSON.parse(evt.target.result);
						if (typeof data !== 'object' || data === null) {
							_setJsonStatus('Invalid JSON: expected an object.', true);
							return;
						}
						var hadAny = false;
						if (typeof data.patchfile === 'string') { elPatchUrl.value = data.patchfile; hadAny = true; }
						if (typeof data.romfile === 'string') { elRomUrl.value = data.romfile; hadAny = true; }
						if (typeof data.romhash === 'string') { elRomHash.value = data.romhash; hadAny = true; _validateHash(); }
						if (typeof data.outputname === 'string' && elOutputName) { elOutputName.value = data.outputname; hadAny = true; }
						if (hadAny) {
							_updateUrl();
							_setJsonStatus('Imported successfully.', false);
						} else {
							_setJsonStatus('No recognized fields found in JSON.', true);
						}
					} catch (e) {
						_setJsonStatus('Failed to parse JSON: ' + e.message, true);
					}
				};
				reader.readAsText(this.files[0]);
			});
			input.click();
		};

		/* Wire up Export/Import buttons */
		var exportBtn = document.getElementById('url-builder-export-json');
		var importBtn = document.getElementById('url-builder-import-json');
		if (exportBtn) exportBtn.addEventListener('click', _exportJson);
		if (importBtn) importBtn.addEventListener('click', _importJson);
	})();

	/* ---- Base ROM Cache ---- */
	var _showAutoLoadToast = function (msg) {
		var existing = document.getElementById('rom-cache-toast');
		if (existing) existing.remove();
		var toast = document.createElement('div');
		toast.id = 'rom-cache-toast';
		toast.textContent = msg;
		toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:6px;font-size:13px;z-index:9999;transition:opacity 0.4s;opacity:1;';
		document.body.appendChild(toast);
		setTimeout(function () { toast.style.opacity = '0'; }, 3000);
		setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3500);
	};
	/* Expose globally for extensions (RomM, etc.) */
	RomPatcherWeb.showAutoLoadToast = _showAutoLoadToast;

	var _formatBytes = function (n) {
		if (n < 1024) return n + 'B';
		if (n < 1024 * 1024) return (n / 1024).toFixed(1) + 'KB';
		if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + 'MB';
		return (n / (1024 * 1024 * 1024)).toFixed(1) + 'GB';
	};

	var _formatDate = function (ts) {
		if (!ts) return 'Never';
		var d = new Date(ts);
		return d.toLocaleDateString();
	};

	var _refreshCacheList = function () {
		if (typeof RomCache === 'undefined') return;
		var listEl = document.getElementById('cache-list');
		var emptyEl = document.getElementById('cache-empty');
		var sizeEl = document.getElementById('cache-total-size');
		var storageEl = document.getElementById('cache-storage-usage');
		if (!listEl) return;

		RomCache.list().then(function (entries) {
			listEl.innerHTML = '';
			if (!entries || !entries.length) {
				if (emptyEl) emptyEl.style.display = '';
				if (sizeEl) sizeEl.textContent = 'ROMs cached: 0';
				if (storageEl) storageEl.textContent = '';
				listEl.style.display = 'none';
				return;
			}
			if (emptyEl) emptyEl.style.display = 'none';
			listEl.style.display = '';
			var totalZip = 0;
			entries.forEach(function (e) { totalZip += e.storedSize || 0; });
			if (sizeEl) sizeEl.textContent = 'ROMs cached: ' + entries.length;
			if (storageEl) storageEl.textContent = 'Storage: ' + _formatBytes(totalZip);

			entries.forEach(function (e) {
				var row = document.createElement('div');
				row.style.borderBottom = '1px solid #eee';
				row.style.padding = '6px 0';

				/* Top line: name (full width), expand arrow (hover only) */
				var top = document.createElement('div');
				top.style.display = 'flex';
				top.style.alignItems = 'center';

				var nameSpan = document.createElement('span');
				nameSpan.style.flex = '1';
				nameSpan.style.overflow = 'hidden';
				nameSpan.style.textOverflow = 'ellipsis';
				nameSpan.style.whiteSpace = 'nowrap';
				nameSpan.style.fontSize = '13px';
				nameSpan.style.fontWeight = '500';
				nameSpan.textContent = e.name;
				nameSpan.title = e.name;

				var expandBtn = document.createElement('span');
				expandBtn.textContent = ' ▸';
				expandBtn.style.cursor = 'pointer';
				expandBtn.style.fontSize = '12px';
				expandBtn.style.color = '#000';
				expandBtn.style.display = 'none';
				expandBtn.style.whiteSpace = 'nowrap';
				expandBtn.style.flexShrink = '0';

				top.appendChild(nameSpan);
				top.appendChild(expandBtn);

				/* Expandable detail section */
				var detail = document.createElement('div');
				detail.style.display = 'none';
				detail.style.padding = '4px 0 0 0';
				detail.style.fontSize = '12px';
				detail.style.color = '#666';
				detail.style.lineHeight = '1.8';
				detail.style.fontFamily = 'monospace';

				var infoLines = document.createElement('div');
				infoLines.style.marginBottom = '6px';
				var il = [
					'Size: ' + _formatBytes(e.storedSize),
					'Last used: ' + _formatDate(e.lastUsed)
				];
				if (e.sha1) il.push('SHA-1: ' + e.sha1);
				if (e.md5) il.push('MD5: ' + e.md5);
				if (e.crc32) il.push('CRC32: ' + e.crc32);
				infoLines.innerHTML = il.join('<br>');
				detail.appendChild(infoLines);

				/* Buttons inside expandable section */
				var btnRow = document.createElement('div');
				btnRow.style.display = 'flex';
				btnRow.style.gap = '6px';

				var useBtn = document.createElement('button');
				useBtn.className = 'rom-patcher-btn-small';
				useBtn.textContent = 'Use';
				useBtn.addEventListener('click', function () {
					RomCache.findByHash({ type: 'SHA-1', value: e.sha1 }).then(function (entry) {
						if (!entry) return;
						return RomCache.toBlob(entry).then(function (blob) {
							return blob.arrayBuffer();
						}).then(function (ab) {
							var binFile = new BinFile(ab);
							binFile.fileName = e.name;
							RomPatcherWeb.provideRomFile(binFile);
							RomPatcherWeb.getHtmlElements().setFakeFile('rom', e.name);
							_showAutoLoadToast('Loaded from cache: ' + e.name);
							switchTab('patcher');
						});
					});
				});
				btnRow.appendChild(useBtn);

				var delBtn = document.createElement('button');
				delBtn.className = 'rom-patcher-btn-small';
				delBtn.textContent = 'Delete';
				delBtn.style.color = '#ff0030';
				delBtn.addEventListener('click', function () {
					RomCache.remove(e.sha1).then(function () { _refreshCacheList(); });
				});
				btnRow.appendChild(delBtn);
				detail.appendChild(btnRow);

				row.appendChild(top);
				row.appendChild(detail);

				var expanded = false;
				function toggleExpand() {
					expanded = !expanded;
					expandBtn.textContent = expanded ? ' ▾' : ' ▸';
					detail.style.display = expanded ? 'block' : 'none';
				}

				expandBtn.addEventListener('click', function (ev) {
					ev.stopPropagation();
					toggleExpand();
				});

				/* Desktop: show expand arrow on hover */
				row.addEventListener('mouseenter', function () {
					expandBtn.style.display = '';
				});
				row.addEventListener('mouseleave', function () {
					expandBtn.style.display = 'none';
				});

				/* Mobile: tap name to expand */
				nameSpan.addEventListener('click', function (ev) {
					ev.stopPropagation();
					toggleExpand();
				});

				listEl.appendChild(row);
			});
		});
	};

	var _cacheClearBtn = document.getElementById('cache-clear-all');
	if (_cacheClearBtn) _cacheClearBtn.addEventListener('click', function () {
		if (!confirm('Delete all cached ROMs?')) return;
		RomCache.clear().then(function () { _refreshCacheList(); });
	});

	try {
		const initialSettings = buildSettingsForWebapp();

		/* check for remote file URL parameters */
		const urlParams = new URLSearchParams(window.location.search);
		const remotePatchFileUrl = urlParams.get('patchfile');
		const remoteRomFileUrl = urlParams.get('romfile');
		const remoteRomHash = urlParams.get('romhash');
		const remoteOutputName = urlParams.get('outputname');
		const hasRemoteFiles = remotePatchFileUrl || remoteRomFileUrl;

		/* seed the Output name input with the ?outputname= URL parameter,
		   only if the user hasn't typed anything yet. The output section is
		   hidden until a ROM is validated, so we watch for it to appear. */
		if (remoteOutputName) {
			var _applyInitialOutputName = function () {
				var nameInput = document.getElementById('client-output-name');
				if (nameInput && !nameInput.value) {
					nameInput.value = remoteOutputName;
				}
			};
			var outputSection = document.getElementById('client-output-section');
			if (outputSection) {
				_applyInitialOutputName();
				var _outputSectionObserver = new MutationObserver(function () {
					_applyInitialOutputName();
				});
				_outputSectionObserver.observe(outputSection, { attributes: true, attributeFilter: ['style', 'class'] });
			}
		}

		/* parse romhash parameter: auto-detect type by length */
		const _parsedRomHash = (function () {
			if (!remoteRomHash) return null;
			var h = remoteRomHash.trim().toLowerCase().replace('0x', '');
			if (/^[0-9a-f]{8}$/.test(h)) return { type: 'CRC32', value: parseInt(h, 16) };
			if (/^[0-9a-f]{32}$/.test(h)) return { type: 'MD5', value: h };
			if (/^[0-9a-f]{40}$/.test(h)) return { type: 'SHA-1', value: h };
			return null;
		})();

		/* store romhash globally so providePatchFile can inject it before onloadpatch callbacks */
		if (_parsedRomHash) {
			var _romHashOverride = _parsedRomHash;
			RomPatcherWeb.setRomHashOverride = function (hashType, hashValue) {
				_romHashOverride = { type: hashType, value: hashValue };
			};
			RomPatcherWeb.getRomHashOverride = function () {
				return _romHashOverride || null;
			};
		}

		RomPatcherWeb.initialize(initialSettings);

		/* Initialize the base ROM cache */
		if (typeof RomCache !== 'undefined') {
			RomCache.open().catch(function (e) {
				console.warn('RomCache: failed to open IndexedDB:', e.message);
			});
		}

		if (hasRemoteFiles) {
			var remoteFilesLoaded = { rom: !remoteRomFileUrl, patch: !remotePatchFileUrl };
			var _onRemoteFileLoaded = function () {
				if (remoteFilesLoaded.rom && remoteFilesLoaded.patch) {
					/* both remote files loaded — ensure apply button state is correct */
					RomPatcherWeb.getHtmlElements().enableAll();
				}
			};
		}

		const _fetchRemoteFile = function (fileUrl, fileType, onLoad) {
			const remoteFileName = fileUrl.replace(/^.*[\/\\]/g, '').split('?')[0] || ('remote_' + fileType);
			RomPatcherWeb.getHtmlElements().setSpinner(fileType, true);
			fetch(fileUrl)
				.then(function (response) {
					if (!response.ok)
						throw new Error('HTTP ' + response.status);
					return response.arrayBuffer();
				})
				.then(function (arrayBuffer) {
					const remoteFile = new BinFile(arrayBuffer);
					remoteFile.fileName = remoteFileName;
					onLoad(remoteFile, remoteFileName);
					if (hasRemoteFiles) {
						remoteFilesLoaded[fileType] = true;
						_onRemoteFileLoaded();
					}
				})
				.catch(function (err) {
					console.error('Rom Patcher JS: Error fetching remote ' + fileType + ' file', err);
					RomPatcherWeb.getHtmlElements().setSpinner(fileType, false);
					RomPatcherWeb.getHtmlElements().addClass('row-error-message', 'show');
					var errorMsg;
					if (err instanceof TypeError && /failed to fetch/i.test(err.message)) {
						errorMsg = 'CORS error: The remote server does not allow cross-origin downloads. '
							+ 'The ' + fileType + ' file URL must be hosted on a server that includes Access-Control-Allow-Origin headers. '
							+ 'Original error: ' + err.message;
					} else {
						errorMsg = 'Error downloading remote ' + fileType + ' file: ' + err.message;
					}
					RomPatcherWeb.getHtmlElements().setText('error-message', errorMsg);
				});
		};

		if (remotePatchFileUrl) {
			_fetchRemoteFile(remotePatchFileUrl, 'patch', function (remoteFile, remoteFileName) {
				RomPatcherWeb.providePatchFile(remoteFile);
				RomPatcherWeb.getHtmlElements().setFakeFile('patch', remoteFileName);
			});
		}

		/* Load ROM: Cache → Server (RomM) → ?romfile= URL → manual upload.
		   The order is enforced globally:
		   1. Check local cache by ?romhash= (runs immediately, independent of URL)
		   2. RomM auto-lookup (integration.js onloadpatch) — suppressed if cache hit
		   3. Fetch ?romfile= URL (fallback)
		   4. User uploads manually */
		RomPatcherWeb._romCacheLoaded = false;
		if (_parsedRomHash && settings.cacheRoms && typeof RomCache !== 'undefined') {
			console.log('Attempting to load ROM from cache (hash=' + _parsedRomHash.type + '=' + String(_parsedRomHash.value).substring(0, 12) + '...)');
			RomCache.findByHash(_parsedRomHash).then(function (cached) {
				if (cached) {
					console.log('Cache HIT - loading ' + cached.name + ' from IndexedDB');
					return RomCache.toBlob(cached).then(function (blob) {
						return blob.arrayBuffer();
					}).then(function (ab) {
						var binFile = new BinFile(ab);
						binFile.fileName = cached.name;
						RomPatcherWeb._romCacheLoaded = true;
						console.log('Providing cached ROM to RomPatcherWeb: ' + cached.name);
						RomPatcherWeb.provideRomFile(binFile);
						RomPatcherWeb.getHtmlElements().setFakeFile('rom', cached.name);
						_showAutoLoadToast('Loaded from cache: ' + cached.name);
						if (hasRemoteFiles && remoteRomFileUrl) {
							remoteFilesLoaded.rom = true;
							_onRemoteFileLoaded();
						}
					});
				}
				console.log('Cache MISS - no cached ROM found for hash');
				/* Cache miss — fall through to server auto-lookup or URL fetch */
				if (!RomPatcherWeb._romCacheLoaded && remoteRomFileUrl) {
					console.log('Falling through to ?romfile= URL download');
					_fetchRemoteFile(remoteRomFileUrl, 'rom', function (remoteFile, remoteFileName) {
						RomPatcherWeb.provideRomFile(remoteFile);
						RomPatcherWeb.getHtmlElements().setFakeFile('rom', remoteFileName);
						_showAutoLoadToast('Loaded from URL: ' + remoteFileName);
					});
				}
			}).catch(function (err) {
				console.warn('Cache lookup error: ' + (err ? err.message : 'unknown'));
				/* Cache lookup failed — fall through to URL fetch */
				if (remoteRomFileUrl) {
					console.log('Falling through to ?romfile= URL download after cache error');
					_fetchRemoteFile(remoteRomFileUrl, 'rom', function (remoteFile, remoteFileName) {
						RomPatcherWeb.provideRomFile(remoteFile);
						RomPatcherWeb.getHtmlElements().setFakeFile('rom', remoteFileName);
						_showAutoLoadToast('Loaded from URL: ' + remoteFileName);
					});
				}
			});
		} else if (remoteRomFileUrl) {
			console.log('No cache configured/available, fetching ROM from URL: ' + remoteRomFileUrl.substring(0, 80) + '...');
			_fetchRemoteFile(remoteRomFileUrl, 'rom', function (remoteFile, remoteFileName) {
				RomPatcherWeb.provideRomFile(remoteFile);
				RomPatcherWeb.getHtmlElements().setFakeFile('rom', remoteFileName);
				_showAutoLoadToast('Loaded from URL: ' + remoteFileName);
			});
		} else {
			console.log('No remote ROM URL or hash parameter; user will upload manually');
		}

		/* ---- Standalone Download button (no server extension required) ----
		   Wires up #client-btn-download so the Output name and Zip output
		   controls work even when no server extension (RomM, etc.) is
		   configured. If a server extension is also loaded and wires this
		   button, its handler will overwrite this one — which is fine. */
		var _standaloneCreateZip = function (binFile, zipFileName, callback) {
			if (typeof zip !== 'undefined' && zip && zip.ZipWriter && zip.BlobWriter && zip.Uint8ArrayReader) {
				try {
					var writer = new zip.ZipWriter(new zip.BlobWriter());
					writer.add(zipFileName, new zip.Uint8ArrayReader(binFile._u8array)).then(function () {
						return writer.close();
					}).then(function (blob) {
						return blob.arrayBuffer();
					}).then(function (arrayBuffer) {
						callback(arrayBuffer);
					}).catch(function (err) {
						console.warn('Standalone zip failed, falling back to raw download:', err);
						callback(binFile._u8array.buffer);
					});
					return;
				} catch (e) {
					console.warn('Standalone zip threw, falling back to raw download:', e);
				}
			}
			/* no zip lib available — download raw */
			callback(binFile._u8array.buffer);
		};
		/* The actual download routine, exposed as a global so the onpatch
		   callback (registered above) can call it once the patch is applied. */
		_standaloneRunDownload = function (patchedRom) {
			try {
				var wantZip = document.getElementById('client-output-zip') && document.getElementById('client-output-zip').checked;
				var nameInp = document.getElementById('client-output-name');
				var origExt = patchedRom.fileName.match(/\.(\w+)$/);
				var ext = origExt ? '.' + origExt[1] : '.bin';
				var outName = (nameInp && nameInp.value.trim())
					? nameInp.value.trim().replace(/\.\w+$/, '') + ext
					: patchedRom.fileName;

				var u8 = patchedRom._u8array;
				if (!u8 || u8.byteLength === 0) {
					alert('Patched ROM is empty.');
					return;
				}
				var buffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);

				var triggerDownload = function (blob, filename) {
					var url = URL.createObjectURL(blob);
					var a = document.createElement('a');
					a.href = url;
					a.download = filename;
					a.style.display = 'none';
					document.body.appendChild(a);
					a.click();
					setTimeout(function () {
						try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
						if (a.parentNode) a.parentNode.removeChild(a);
					}, 1000);
				};

				if (wantZip) {
					var downloadName = outName.replace(/\.[^.]+$/, '') + '.zip';
					var binFile = { _u8array: new Uint8Array(buffer) };
					_standaloneCreateZip(binFile, outName, function (zipBuffer) {
						var blob = new Blob([zipBuffer], { type: 'application/zip' });
						triggerDownload(blob, downloadName);
					});
				} else {
					var blob = new Blob([buffer], { type: 'application/octet-stream' });
					triggerDownload(blob, outName);
				}
			} catch (e) {
				console.error('Standalone download failed:', e);
				alert('Download failed: ' + e.message);
			}
		};
		var _standaloneDlBtn = document.getElementById('client-btn-download');
		if (_standaloneDlBtn) {
			_standaloneDlBtn.addEventListener('click', function () {
				/* If we already have a freshly-patched ROM, use it directly. */
				if (_latestPatchedRom) {
					_standaloneRunDownload(_latestPatchedRom);
					return;
				}
				/* Otherwise, ask RomPatcherWeb to apply the patch.
				   The patched ROM will arrive in our onpatch callback above,
				   which will then run _standaloneRunDownload because
				   _pendingDownload is set. */
				if (typeof RomPatcherWeb.applyPatch !== 'function') {
					alert('RomPatcherWeb is not ready yet.');
					return;
				}
				var applyBtn = document.getElementById('rom-patcher-button-apply');
				if (applyBtn) {
					applyBtn.style.display = 'inline-block';
					applyBtn.disabled = false;
				}
				_pendingDownload = true;
				RomPatcherWeb.applyPatch();
				/* Safety timeout: if onpatch never fires, reset the flag. */
				setTimeout(function () { _pendingDownload = false; }, 30000);
			});
		}
	} catch (err) {
		var message = err.message;
		if (/incompatible browser/i.test(message) || /variable RomPatcherWeb/i.test(message))
			message = 'Your browser is outdated and it is not compatible with the latest version of Rom Patcher JS.<br/><a href="legacy/">Try the legacy version</a>';

		document.getElementById('rom-patcher-container').innerHTML = message;
		document.getElementById('rom-patcher-container').style.color = 'red';
	}
});