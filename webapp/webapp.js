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
	theme: 'default'
};
/* load settings from localStorage */
if (typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_STORAGE_SETTINGS_ID)) {
	try {
		const loadedSettings = JSON.parse(localStorage.getItem(LOCAL_STORAGE_SETTINGS_ID));

		if (typeof loadedSettings.language === 'string')
			settings.language = loadedSettings.language;

		if (typeof loadedSettings.outputSuffix === 'boolean')
			settings.outputSuffix = loadedSettings.outputSuffix;

		if (typeof loadedSettings.fixChecksum === 'boolean')
			settings.fixChecksum = loadedSettings.fixChecksum;

		if (typeof loadedSettings.theme === 'string' && ['light'].indexOf(loadedSettings.theme) !== -1)
			settings.theme = loadedSettings.theme;
	} catch (err) {
		console.error('Error while loading settings: ' + err.message);
	}
}
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
		}
	};
}
const saveSettings = function () {
	if (typeof localStorage !== 'undefined')
		localStorage.setItem(LOCAL_STORAGE_SETTINGS_ID, JSON.stringify(settings));
	RomPatcherWeb.setSettings(buildSettingsForWebapp());
}


var currentTab = 'patcher';

/* Add tab bar styles */
(function() {
	var s = document.createElement('style');
	s.textContent = [
		'.tab-bar { display:flex; gap:0; margin-bottom:12px; border-bottom:2px solid #ddd; }',
		'.tab-button { flex:1; padding:10px 16px; border:none; background:#f5f5f5; cursor:pointer; font-size:13px; font-weight:bold; color:#666; border-bottom:2px solid transparent; margin-bottom:-2px; transition:all 0.2s; }',
		'.tab-button:hover { background:#e8e8e8; }',
		'.tab-button.active { background:#fff; color:#333; border-bottom-color:#4a90d9; }'
	].join('\n');
	document.head.appendChild(s);
})();

window.addEventListener('load', function (evt) {
	/* set theme */
	document.body.className = 'theme-' + settings.theme;

	/* event listeners */
	document.getElementById('button-settings').addEventListener('click', function (evt) {
		document.getElementById('dialog-settings').showModal();
	});
	document.getElementById('dialog-settings-button-close').addEventListener('click', function (evt) {
		document.getElementById('dialog-settings').close();
	});

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

	/* Tab switching */
	const containers = {
		patcher: document.getElementById('rom-patcher-container'),
		creator: document.getElementById('patch-builder-container'),
		'url-builder': document.getElementById('url-builder-container')
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
		var elOutput = document.getElementById('url-builder-output');
		var elStatusPatch = document.getElementById('url-builder-status-patchfile');
		var elStatusRom = document.getElementById('url-builder-status-romfile');
		var elStatusHash = document.getElementById('url-builder-status-romhash');

		if (!elOutput) return; /* URL Builder elements not found */

		var _parseImportUrl = function () {
			var url = elImport.value.trim();
			if (!url) { elImportStatus.innerHTML = '<span style="color:orange">Enter a URL</span>'; return; }
			try {
				var parsed = new URL(url);
				var params = parsed.searchParams;
				var pf = params.get('patchfile');
				var rf = params.get('romfile');
				var rh = params.get('romhash');
				if (pf) elPatchUrl.value = pf;
				if (rf) elRomUrl.value = rf;
				if (rh) elRomHash.value = rh;
				if (pf || rf || rh) {
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
			if (pf) params.push('patchfile=' + encodeURIComponent(pf));
			if (rf) params.push('romfile=' + encodeURIComponent(rf));
			if (rh) params.push('romhash=' + encodeURIComponent(rh));
			if (params.length) elOutput.value = base + '?' + params.join('&');
			else elOutput.value = base;
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

		document.getElementById('url-builder-test-patchfile').addEventListener('click', function () {
			_testUrl(elPatchUrl.value.trim(), elStatusPatch, this);
		});
		document.getElementById('url-builder-test-romfile').addEventListener('click', function () {
			_testUrl(elRomUrl.value.trim(), elStatusRom, this);
		});

		document.getElementById('url-builder-copy').addEventListener('click', function () {
			if (!elOutput.value) return;
			navigator.clipboard.writeText(elOutput.value).then(function () {
				var origText = this.textContent;
				this.textContent = 'Copied!';
				var self = this;
				setTimeout(function () { self.textContent = origText; }, 2000);
			}.bind(this)).catch(function () {
				/* fallback */
				elOutput.select();
				document.execCommand('copy');
			});
		});

		_updateUrl();
	})();

	try {
		const initialSettings = buildSettingsForWebapp();

		/* check for remote file URL parameters */
		const urlParams = new URLSearchParams(window.location.search);
		const remotePatchFileUrl = urlParams.get('patchfile');
		const remoteRomFileUrl = urlParams.get('romfile');
		const remoteRomHash = urlParams.get('romhash');
		const hasRemoteFiles = remotePatchFileUrl || remoteRomFileUrl;

		/* parse romhash parameter: auto-detect type by length */
		const _parsedRomHash = (function () {
			if (!remoteRomHash) return null;
			var h = remoteRomHash.trim().toLowerCase().replace('0x', '');
			if (/^[0-9a-f]{8}$/.test(h)) return { type: 'CRC32', value: parseInt(h, 16) };
			if (/^[0-9a-f]{32}$/.test(h)) return { type: 'MD5', value: h };
			if (/^[0-9a-f]{40}$/.test(h)) return { type: 'SHA1', value: h };
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

		if (remoteRomFileUrl) {
			_fetchRemoteFile(remoteRomFileUrl, 'rom', function (remoteFile, remoteFileName) {
				RomPatcherWeb.provideRomFile(remoteFile);
				RomPatcherWeb.getHtmlElements().setFakeFile('rom', remoteFileName);
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

