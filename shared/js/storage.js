var storage = chrome.storage.sync;
const DEFAULT_STORAGE = chrome.storage.sync;
const TEST_STORAGE = chrome.storage.local;

/**
 * Reset the storage to the default storage for normal use.
 */
function resetStorageToDefault() {
	storage = DEFAULT_STORAGE;
}

/**
 * Get the version of the storage.
 * @param  {Function} callback Function taking in a version
 */
function getStorageVersion(callback) {
	storage.get('version', function(items) {
		if (!items || !items.version) {
			return callback(1);
		}

		return callback(items.version);
	});
}

/**
 * Set the storage to a version.
 * @param {int}      version  Some version
 * @param {Function} callback
 */
function setStorageVersion(version, callback) {
	storage.set({ 'version': version }, callback);
}