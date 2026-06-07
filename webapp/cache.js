/* Rom Patcher JS - Base ROM Cache
 * IndexedDB-backed cache of base ROMs, keyed by hash.
 * Each entry stores the ROM as a zip-wrapped blob plus its CRC32, MD5, and SHA-1.
 * License: MIT
 */

const RomCache = (function () {
	const DB_NAME = 'rom-patcher-cache';
	const DB_VERSION = 1;
	const STORE_NAME = 'roms';
	const KEY_PATH = 'sha1';

	let _dbPromise = null;

	/* ---------- DB lifecycle ---------- */

	const _openDb = function () {
		if (_dbPromise) {
			console.log('DB already opening/open, returning existing promise');
			return _dbPromise;
		}
		console.log('Opening IndexedDB: ' + DB_NAME + ' v' + DB_VERSION);
		_dbPromise = new Promise(function (resolve, reject) {
			if (typeof indexedDB === 'undefined') {
				console.error('IndexedDB not available');
				reject(new Error('IndexedDB is not available'));
				return;
			}
			const req = indexedDB.open(DB_NAME, DB_VERSION);
			req.onupgradeneeded = function (evt) {
				console.log('IndexedDB upgrade needed (oldVersion=' + evt.oldVersion + ')');
				const db = evt.target.result;
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					const store = db.createObjectStore(STORE_NAME, { keyPath: KEY_PATH });
					store.createIndex('crc32', 'crc32', { unique: false });
					store.createIndex('md5', 'md5', { unique: false });
					store.createIndex('sha1', 'sha1', { unique: false });
					store.createIndex('addedAt', 'addedAt', { unique: false });
					console.log('Created object store and indexes');
				}
			};
			req.onsuccess = function () { console.log('IndexedDB opened successfully'); resolve(req.result); };
			req.onerror = function () { console.error('Failed to open IndexedDB: ' + (req.error ? req.error.message : 'unknown')); reject(req.error || new Error('Failed to open IndexedDB')); };
		});
		return _dbPromise;
	};

	const _tx = function (mode) {
		return _openDb().then(function (db) {
			return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
		});
	};

	const _wrap = function (req) {
		return new Promise(function (resolve, reject) {
			req.onsuccess = function () { resolve(req.result); };
			req.onerror = function () { reject(req.error); };
		});
	};

	/* ---------- Zip helpers ---------- */

	const _zipRom = function (u8, name) {
		return new Promise(function (resolve, reject) {
			if (typeof zip === 'undefined' || !zip || !zip.ZipWriter) {
				reject(new Error('zip library not available'));
				return;
			}
			try {
				const writer = new zip.ZipWriter(new zip.BlobWriter());
				writer.add(name || 'rom.bin', new zip.Uint8ArrayReader(u8)).then(function () {
					return writer.close();
				}).then(function (blob) {
					resolve(blob);
				}).catch(function (err) { reject(err); });
			} catch (e) {
				reject(e);
			}
		});
	};

	const _unzipRom = function (blob) {
		return new Promise(function (resolve, reject) {
			if (typeof zip === 'undefined' || !zip || !zip.ZipReader) {
				reject(new Error('zip library not available'));
				return;
			}
			try {
				const reader = new zip.ZipReader(new zip.BlobReader(blob));
				reader.getEntries().then(function (entries) {
					if (!entries || !entries.length) {
						reader.close();
						reject(new Error('Empty zip in cache entry'));
						return;
					}
					entries[0].getData(new zip.BlobWriter()).then(function (data) {
						reader.close();
						return data.arrayBuffer();
					}).then(function (arrayBuffer) {
						resolve(new Uint8Array(arrayBuffer));
					}).catch(function (err) {
						reader.close();
						reject(err);
					});
				}).catch(function (err) { reject(err); });
			} catch (e) {
				reject(e);
			}
		});
	};

	/* ---------- Hash helpers ---------- */

	const _hexFromCrc = function (n) {
		var s = (n >>> 0).toString(16);
		while (s.length < 8) s = '0' + s;
		return s;
	};

	const _toHex = function (u8) {
		var s = '';
		for (var i = 0; i < u8.length; i++) {
			var h = u8[i].toString(16);
			if (h.length < 2) h = '0' + h;
			s += h;
		}
		return s;
	};

	/* Read all bytes from a BinFile's _u8array.
	   CRITICAL: must copy the bytes immediately because the original ArrayBuffer
	   may be transferred (detached) to a web worker for CRC/SHA-1 calculation. */
	const _readAll = function (romFile) {
		if (!romFile || !romFile._u8array) return null;
		return new Uint8Array(romFile._u8array);
	};

	/* ---------- Public API ---------- */

	const open = function () {
		return _openDb();
	};

	const _normalizeHash = function (type, value) {
		if (value === null || value === undefined) return null;
		if (type === 'CRC32') {
			var n = typeof value === 'number' ? value : parseInt(String(value), 16);
			return _hexFromCrc(n);
		}
		return String(value).toLowerCase().replace(/^0x/, '');
	};

	const findByHash = function (hashInfo) {
		if (!hashInfo || !hashInfo.type) {
			console.log('findByHash: no hash info provided, returning null');
			return Promise.resolve(null);
		}
		var needle = _normalizeHash(hashInfo.type, hashInfo.value);
		if (!needle) {
			console.log('findByHash: could not normalize hash', hashInfo);
			return Promise.resolve(null);
		}
		console.log('findByHash: searching ' + hashInfo.type + '=' + needle.substring(0, 12) + '...');
		return _tx('readonly').then(function (store) {
			var indexName = hashInfo.type === 'CRC32' ? 'crc32'
				: hashInfo.type === 'MD5' ? 'md5'
				: hashInfo.type === 'SHA-1' ? 'sha1'
				: null;
			var req;
			if (indexName) {
				req = store.index(indexName).get(needle);
			} else {
				req = store.getAll();
			}
			return _wrap(req);
		}).then(function (result) {
			if (Array.isArray(result)) {
				var found = result.find(function (e) { return e && e.sha1; }) || null;
				if (found) console.log('findByHash: HIT - found ' + found.name + ' (SHA-1=' + found.sha1.substring(0, 12) + '...)');
				else console.log('findByHash: MISS - no entry found for ' + hashInfo.type);
				return found;
			}
			if (result) console.log('findByHash: HIT - found ' + result.name + ' (SHA-1=' + result.sha1.substring(0, 12) + '...)');
			else console.log('findByHash: MISS - no entry found for ' + hashInfo.type);
			return result || null;
		});
	};

	const put = function (romFile, name) {
		var u8 = _readAll(romFile);
		if (!u8) return Promise.reject(new Error('No ROM data to cache'));
		var displayName = name || romFile.fileName || 'rom.bin';

		var sha1P = romFile._sha1
			? Promise.resolve(romFile._sha1)
			: (typeof romFile.hashSHA1 === 'function' ? romFile.hashSHA1() : Promise.resolve(null));
		var crc32 = null, md5 = null;
		try { crc32 = romFile.hashCRC32 ? romFile.hashCRC32() : null; } catch (e) { crc32 = null; }
		try { md5 = romFile.hashMD5 ? romFile.hashMD5() : null; } catch (e) { md5 = null; }

		return sha1P.then(function (sha1) {
			if (!sha1) {
				console.warn('SHA-1 not available, skipping cache write for ' + displayName);
				return null;
			}
			var sha1Hex = String(sha1).toLowerCase();
			var crc32Hex = crc32 !== null && crc32 !== undefined ? _hexFromCrc(crc32) : null;
			var md5Hex = md5 ? String(md5).toLowerCase() : null;

			console.log('put: caching ' + displayName + ' (size=' + u8.byteLength + ', SHA-1=' + sha1Hex.substring(0, 12) + '...)');
			return _zipRom(u8, displayName).then(function (blob) {
				var compressionRatio = (u8.byteLength > 0) ? (blob.size / u8.byteLength * 100).toFixed(1) + '%' : 'N/A';
				console.log('put: zip compression ratio=' + compressionRatio + ' (raw=' + u8.byteLength + ', stored=' + blob.size + ')');
				var entry = {
					sha1: sha1Hex,
					md5: md5Hex,
					crc32: crc32Hex,
					name: displayName,
					size: u8.byteLength,
					storedSize: blob.size,
					addedAt: Date.now(),
					lastUsed: null,
					data: blob
				};
				return _tx('readwrite').then(function (store) {
					return _wrap(store.get(sha1Hex)).then(function (existing) {
						if (existing) {
							console.log('put: updating existing entry for ' + displayName);
							entry.addedAt = existing.addedAt;
							entry.lastUsed = existing.lastUsed;
							return _wrap(store.put(entry));
						}
						console.log('put: creating new entry for ' + displayName);
						return _wrap(store.put(entry));
					});
				}).then(function () { return entry; });
			});
		});
	};

	const list = function () {
		console.log('list: querying all entries');
		return _tx('readonly').then(function (store) {
			return _wrap(store.getAll());
		}).then(function (all) {
			var count = (all || []).length;
			console.log('list: ' + count + ' entries found');
			(all || []).sort(function (a, b) { return (b.lastUsed || b.addedAt || 0) - (a.lastUsed || a.addedAt || 0); });
			return (all || []).map(function (e) {
				return {
					sha1: e.sha1, md5: e.md5, crc32: e.crc32,
					name: e.name, size: e.size, storedSize: e.storedSize,
					addedAt: e.addedAt, lastUsed: e.lastUsed || null
				};
			});
		});
	};

	const remove = function (sha1) {
		if (!sha1) {
			console.log('remove: no SHA-1 provided, skipping');
			return Promise.resolve();
		}
		var shortSha = String(sha1).toLowerCase().substring(0, 12);
		console.log('remove: deleting entry SHA-1=' + shortSha + '...');
		return _tx('readwrite').then(function (store) {
			return _wrap(store.delete(String(sha1).toLowerCase())).then(function () {
				console.log('remove: deleted SHA-1=' + shortSha + '...');
			});
		});
	};

	const clear = function () {
		console.log('clear: removing ALL cache entries');
		return _tx('readwrite').then(function (store) {
			return _wrap(store.clear()).then(function () {
				console.log('clear: all entries removed');
			});
		});
	};

	const totalSize = function () {
		return list().then(function (all) {
			var sum = 0;
			(all || []).forEach(function (e) { sum += e.storedSize || 0; });
			console.log('totalSize: ' + sum + ' bytes across ' + (all || []).length + ' entries');
			return sum;
		});
	};

	const toBlob = function (entry) {
		if (!entry) return Promise.reject(new Error('No cache entry'));
		var shortSha = (entry.sha1 || '').substring(0, 12);
		console.log('toBlob: retrieving entry SHA-1=' + shortSha + '...');
		var startTime = Date.now();
		return _tx('readonly').then(function (store) {
			return _wrap(store.get(entry.sha1));
		}).then(function (full) {
			if (!full) throw new Error('Cache entry not found: ' + entry.sha1);
			full.lastUsed = Date.now();
			return _tx('readwrite').then(function (writeStore) {
				return _wrap(writeStore.put(full));
			}).then(function () {
				return _unzipRom(full.data);
			});
		}).then(function (u8) {
			var elapsed = Date.now() - startTime;
			console.log('toBlob: retrieved ' + (entry.name || 'unknown') + ' (' + (u8 ? u8.byteLength : 0) + ' bytes) in ' + elapsed + 'ms');
			return new Blob([u8], { type: 'application/octet-stream' });
		}).catch(function (err) {
			console.error('toBlob: failed for SHA-1=' + shortSha + ': ' + err.message);
			throw err;
		});
	};

	const usage = function () {
		if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
			return navigator.storage.estimate().then(function (e) {
				console.log('usage: ' + (e.usage || 0) + ' bytes used of ' + (e.quota || 0) + ' quota');
				return { usage: e.usage || 0, quota: e.quota || 0 };
			}).catch(function () { return { usage: 0, quota: 0 }; });
		}
		return Promise.resolve({ usage: 0, quota: 0 });
	};

	return {
		open: open,
		findByHash: findByHash,
		put: put,
		list: list,
		remove: remove,
		clear: clear,
		totalSize: totalSize,
		toBlob: toBlob,
		usage: usage,
		_toHex: _toHex,
		_hexFromCrc: _hexFromCrc
	};
})();