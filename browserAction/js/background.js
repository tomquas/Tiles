var currentURL = null;

chrome.tabs.onActivated.addListener(function(info) {
	chrome.tabs.get(info.tabId, function(tab) {
		update(tab.url);
	});
});

chrome.tabs.onUpdated.addListener(function(tabID, changeInfo, tab) {
	if (tab.active) {
		update(tab.url);
	}
});

chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
	if (request.message == "save") {
		sendResponse({url: currentURL});
	} else if (request.message == "saved") {
		changeIcon(true, null);
	} else if (request.message == "delete") {
		deleteSite(currentURL, function() {
			changeIcon(false, null);

			sendResponse({message: "deleted"});
		});
	}

	return true;
});

function setPopup(save) {
	if (save) {
		chrome.browserAction.setPopup({"popup": "browserAction/save.html"});
	} else {
		chrome.browserAction.setPopup({"popup": "browserAction/delete.html"});		
	}
}

function update(url) {
	currentURL = url;

	siteExists(url, function(exists) {
		setPopup(!exists);

		changeIcon(exists, null);
	});
}

function siteExists(url, callback) {
	getSites(function(sites) {
		if (sites) {
			for (var i = 0; i < sites.length; i++) {
				if (sites[i].url == url) {
					return callback(true);
				}
			}
		}

		return callback(false);
	});
}

function changeIcon(colors, callback) {
	var details = {};

	if (colors) {
		details.path = '../icons/icon-bitty.png';
	} else {
		details.path = '../icons/icon-bitty-gray.png';
	}

	chrome.browserAction.setIcon(details, callback);
}