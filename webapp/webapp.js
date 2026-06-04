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
			if(currentMode === 'creator'){
				document.getElementById('switch-create-button').click();
			}
		}
	};
}
const saveSettings = function () {
	if (typeof localStorage !== 'undefined')
		localStorage.setItem(LOCAL_STORAGE_SETTINGS_ID, JSON.stringify(settings));
	RomPatcherWeb.setSettings(buildSettingsForWebapp());
}


var currentMode = 'patcher';



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

	document.getElementById('switch-create-button').addEventListener('click', function () {
		if(!RomPatcherWeb.isInitialized())
			throw new Error('Rom Patcher JS is not initialized yet');

		if (/disabled/.test(document.getElementById('switch-create').className)) {
			try{
				if(!PatchBuilderWeb.isInitialized())
					PatchBuilderWeb.initialize();
			}catch(err){
				document.getElementById('patch-builder-container').innerHTML = err.message;
				document.getElementById('patch-builder-container').style.color = 'red';
			}

			currentMode = 'creator';
			document.getElementById('rom-patcher-container').style.display = 'none';
			document.getElementById('patch-builder-container').style.display = 'block';
			document.getElementById('switch-create').className = 'switch enabled';
		} else {
			currentMode = 'patcher';
			document.getElementById('rom-patcher-container').style.display = 'block';
			document.getElementById('patch-builder-container').style.display = 'none';
			document.getElementById('switch-create').className = 'switch disabled';
		}
	});

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

