const CONTROL_GROUP = '<div class="control-group"> \
	<div class="controls site-controls"> \
		<a type="button" class="btn disabled handle"><i class="icon-list"></i></a> \
		<input type="text" class="url" placeholder="www.google.com"> \
		<input type="text" class="input-nano abbreviation" placeholder="Gl" maxlength="2"> \
		<div class="action-buttons"> \
			<a type="button" class="btn btn-danger remove"><i class="icon-trash icon-white"></i></a> \
			<a type="button" class="btn btn-success add"><i class="icon-plus icon-white"></i></a> \
		</div> \
	</div> \
</div>';

const SUBMIT_BUTTON_SAVING_TEXT = "Saving...";
const SUBMIT_BUTTON_SUBMIT_TEXT = "Save";

const FAVICON_LOAD_FAIL_TITLE = "Failed to retrieve favicon!";
const FAVICON_LOAD_FAIL_URL_REPLACE = "#{url}";
const FAVICON_LOAD_FAIL_MESSAGE = "Could not retrieve favicon for #{url}. Check the URL and ensure the site does not redirect.";

$(document).ready(function() {
	var sites = [];

	getSites(function (data) {
		if (!data) {
			$("#sites").prepend(CONTROL_GROUP);
		} else {
			sites = data;

			sites = sites.reverse();

			for (var i = 0; i < sites.length; i++) {
				var newControlGroup = CONTROL_GROUP;
				var site = sites[i];

				newControlGroup = $(newControlGroup);
				newControlGroup.find('input.url').val(site.url);
				newControlGroup.find('input.abbreviation').val(site.abbreviation);

				$("#sites").prepend(newControlGroup);
			}
		}

		updateButtons();
		$("#sites").sortable({
			handle: '.handle',
			axis: 'y',
			update: function(event, ui) {
				updateButtons();
			}
		});

		$("button.close").on('click', function() {
			$(".alert-error").addClass("hidden").find("span").empty();
		});

		$(".container").removeClass("hidden");
	});

	updateButtons();

	function updateButtons() {
		var siteControlsCount = $('.site-controls').size();

		if (siteControlsCount == 1) {
			$('.site-controls').find('.btn.remove').addClass("hidden");
		} else {
			$('.site-controls').find('.btn.remove').removeClass("hidden");
		}

		$('.btn.remove').off().on('click', removeControlGroup);
		$('.btn.add').off().on('click', addControlGroup);
	}

	function removeControlGroup() {
		parent = $(this).parents('.control-group');
		parent.remove();

		updateButtons();
	}

	function addControlGroup() {
		parent = $(this).parents('.control-group');

		parent.after(CONTROL_GROUP);

		updateButtons();
	}

	function saveSites(sites) {
		console.log("Saving all sites");

		console.log(sites);

		chrome.storage.sync.remove("sites");

		chrome.storage.sync.set({"sites": sites}, function() {
			$("button.submit").removeClass("disabled").html(SUBMIT_BUTTON_SUBMIT_TEXT);
		});
	}

	$('form').submit(function(event) {
		event.preventDefault();
		event.stopPropagation();

		$(".alert-error").addClass("hidden");

		$("button.submit").addClass("disabled").html(SUBMIT_BUTTON_SAVING_TEXT);

		$('input:text.url').each(function(index, element) {
			var siteControlsCount = $('.site-controls').size();
			var value = $(this).val();

			if (!value || value.length == 0) {
				if (siteControlsCount > 1) {
					$(this).parents('.control-group').remove();

					updateButtons();
					return;
				}
			}
		});

		var fields = [];

		$('#sites .site-controls').each(function(index, element) {
			urlField = $(this).children('input:text.url').eq(0);
			abbreviationField = $(this).children('input:text.abbreviation').eq(0);

			var url = urlField.val();
			var abbreviation = abbreviationField.val();

			if (!url.match(/^(http|https):\/\//)) {
				url = "http://" + url;

				urlField.val(url);
			}

			if (!abbreviation) {
				abbreviation = makeAbbreviation(getHostname(url));

				abbreviationField.val(abbreviation);
			}

			fields[index] = {};
			fields[index].url = url;
			fields[index].abbreviation = abbreviation;
		});

		var numberOfSitesRequiringColor = fields.length;

		chrome.storage.sync.get('sites', function(items) {
			sites = items['sites'];

			for (var i = 0; i < fields.length; i++) {
				fields[i].color = null;
			}

			if (sites != null && sites.length != 0) {
				for (var i = 0; i < sites.length; i++) {
					for (var j = 0; j < fields.length; j++) {
						if (sites[i].url == fields[j].url) {
							if (!sites[i].lastUpdated || Date.now() - sites[i].lastUpdated >= TIME_BEFORE_UPDATE) {
								fields[i].color = null;
							} else {
								fields[j].color = sites[i].color;
								fields[i].lastUpdated = sites[i].lastUpdated;

								numberOfSitesRequiringColor--;
							}
						}
					}
				}
			}

			console.log(numberOfSitesRequiringColor + " sites require a color check");

			var siteSaved = false;

			for (var i = 0; i < fields.length; i++) {
				(function() {
					var site = fields[i];

					if (site.color != null) {
						if (!siteSaved && numberOfSitesRequiringColor <= 0) {
							saveSites(fields);

							siteSaved = true;
						}
					} else {
						setSiteColor(site, function(site, error) {
							if (error) {
								$(".alert-error").removeClass("hidden");
								$(".alert-error").children("span").html(FAVICON_LOAD_FAIL_MESSAGE.replace(FAVICON_LOAD_FAIL_URL_REPLACE, url));
								$(".alert-error").children("h4").html(FAVICON_LOAD_FAIL_TITLE);
							}

							numberOfSitesRequiringColor--;

							console.log((fields.length - numberOfSitesRequiringColor) + " / " + fields.length + " – Got color for " + site.url);

							if (!siteSaved && numberOfSitesRequiringColor <= 0) {
								saveSites(fields);

								siteSaved = true;
							}
						});
					}
				})();
			}
		});

		return false;
	});
});

function makeAbbreviation(string) {
	return string.substring(0, 1).toUpperCase() + string.substring(1, 2).toLowerCase();
}

function isWhiteOrTransparent(color) {
	const TOLERANCE = 20;

	if (color[3] != 255)
		return true;

	return 255 - color[0] <= TOLERANCE
		&& 255 - color[1] <= TOLERANCE
		&& 255 - color[2] <= TOLERANCE;
}

function getMajorityColor(imageData, ignoredColor) {
	var majorityCandidate = null;
	var retainCount = 1;
	var age = 1;
	var sumRGB = [0, 0, 0, 0];

	for (var i = 0; i < imageData.data.length; i += 4) {
		var pixel = [imageData.data[i],
		imageData.data[i + 1],
		imageData.data[i + 2],
		imageData.data[i + 3]];

		if (ignoredColor != undefined && pixelsAreSimilar(ignoredColor, pixel))
			continue;

		if (isWhiteOrTransparent(pixel))
			continue;

		if (majorityCandidate == null) {
			majorityCandidate = pixel;
			for (var j = 0; j < sumRGB.length; j++) {
				sumRGB[j] = pixel[j];
			}
		} else {

			if (pixelsAreSimilar(majorityCandidate, pixel)) {
				retainCount++;

				age++;
				for (var j = 0; j < pixel.length; j++) {
					sumRGB[j] += pixel[j];
				}
			} else {
				retainCount--;
			}

			if (retainCount == 0) {
				majorityCandidate = pixel;
				retainCount = 1;
				age = 1;

				for (var j = 0; j < sumRGB.length; j++) {
					sumRGB[j] = pixel[j];
				}
			}
		}
	}

	for (var j = 0; j < sumRGB.length; j++) {
		sumRGB[j] = Math.round(sumRGB[j] / age);
	}

	sumRGB = correctLightnessIfNeeded(sumRGB);

	return sumRGB;
}

function getFaviconColor(url, callback) {
	var image = new Image();

	image.onerror = function() {
		console.error("Loading favicon from " + image.src + " failed for " + url);

		$(".alert-error").removeClass("hidden");
		$(".alert-error").children("span").html(FAVICON_LOAD_FAIL_MESSAGE.replace(FAVICON_LOAD_FAIL_URL_REPLACE, url));
		$(".alert-error").children("h4").html(FAVICON_LOAD_FAIL_TITLE);

		callback(failColor);
	}

	image.onload = function() {
		console.log("Using favicon url " + image.src + " for " + url);

		var context = $("canvas")[0].getContext('2d');
		context.clearRect(0, 0, $("canvas")[0].width, $("canvas")[0].height);
		context.drawImage(image, 0, 0);
		var imageData = context.getImageData(0, 0, image.width, image.height);

		var majorityCandidates = [null, null];
		majorityCandidates[0] = getMajorityColor(imageData);
		majorityCandidates[1] = getMajorityColor(imageData, majorityCandidates[0]);

		if (majorityCandidates[1] == null) {
			callback(majorityCandidates[0]);
		} else if (rgbToHsl(majorityCandidates[0])[1] > rgbToHsl(majorityCandidates[1])[1]) {
			callback(majorityCandidates[0]);
		} else {
			callback(majorityCandidates[1]);
		}
	}

	var failColor = [0, 0, 0, 0];

	$.get(url).success(function(data) {
		// Search for explicitly declared icon hrefs
		var links = [];

		var results;
		var regex;

		regex = /<link (.*) ?\/?>/gim;
		while ((results = regex.exec(data)) !== null) {
			links.push(results[1]);
		}

		var hrefs = {};
		for (var i = 0; i < links.length; i++) {
			var relations = /rel="([\w -]*)"/.exec(links[i]);

			// If there is no relation, it's probably not an icon
			if (relations) {
				relations = relations[1].split(' ');

				var href = /href="([^ ]*)"/.exec(links[i])[1];

				for (var j = 0; j < relations.length; j++) {
					if (relations[j] != 'icon' && relations[j] != 'apple-touch-icon') {
						continue;
					}

					if (!hrefs[relations[j]]) {
						hrefs[relations[j]] = [];
					}

					hrefs[relations[j]].push(href);
				}
			}
		}

		var iconPath;
		if (hrefs['apple-touch-icon']) {
			iconPath = hrefs['apple-touch-icon'][0];
		} else if (hrefs['icon']) {
			iconPath = hrefs['icon'][0];
		}

		if (iconPath) {
			if (iconPath.substring(0, 2) == '//') {
				image.src = 'http:' + iconPath;
			} else if (iconPath.substring(0, 1) == '/') {
				image.src = 'http://' + getHostname(url) + iconPath;
			} else if (iconPath.substring(0, 4) != 'http') {
				if (url.substring(url.length - 1) != '/') {
					image.src = url + '/' + iconPath;
				} else {
					image.src = url + iconPath;
				}
			} else {
				image.src = iconPath;
			}

			return;
		}

		$.get(url + '/favicon.ico').success(function() {
			// Search the existing directory
			image.src = url + '/favicon.ico';
		}).error(function() {
			// Search for the favicon in the root of the site.
			var domain = getDomain(url);

			$.get(domain + '/favicon.ico').success(function() {
				image.src = domain + '/favicon.ico';
			}).error(function() {
				console.error("Could not find any icons for url – " + url);
				callback(failColor);
			})
		});
	}).error(function() {
		console.error("Could not load url – " + url);

		$(".alert-error").removeClass("hidden");
		$(".alert-error").children("span").html(FAVICON_LOAD_FAIL_MESSAGE.replace(FAVICON_LOAD_FAIL_URL_REPLACE, url));
		$(".alert-error").children("h4").html(FAVICON_LOAD_FAIL_TITLE);

		callback(failColor);
	});
}

function pixelsAreSimilar(a, b) {
	const TOLERANCE = 0.01;

	var aHSL = rgbToHsl(a);
	var bHSL = rgbToHsl(b);

	return Math.abs(aHSL[0] - bHSL[0]) <= TOLERANCE;
}

/**
 * Source: http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSL representation
 */
function rgbToHsl(rgb){
	var r = rgb[0] / 255;
	var g = rgb[1] / 255;
	var b = rgb[2] / 255;

	var max = Math.max(r, g, b), min = Math.min(r, g, b);
	var h, s, l = (max + min) / 2;

	if (max == min){
	    h = s = 0; // achromatic
	} else {
	    var d = max - min;
	    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	    
	    switch(max) {
	        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
	        case g: h = (b - r) / d + 2; break;
	        case b: h = (r - g) / d + 4; break;
	    }
	   
	    h /= 6;
	}

	return [h, s, l];
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   Number  h       The hue
 * @param   Number  s       The saturation
 * @param   Number  l       The lightness
 * @return  Array           The RGB representation
 */
function hslToRgb(hsl){
	var h = hsl[0], s = hsl[1], l = hsl[2];
    var r, g, b;

    if(s == 0){
        r = g = b = l; // achromatic
    }else{
        function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [r * 255, g * 255, b * 255];
}

function safeAlphaHslToRgb(hsl) {
	var rgb = hslToRgb(hsl);
	var safeRgb = [0, 0, 0, 255]
	for (var i = 0; i < hsl.length; i++) {
		safeRgb[i] = Math.floor(rgb[i]);
	}
	return safeRgb;
}

function averagePixels(a, b, ratio) {
	var weight;
	ratio++;
	if (ratio <= 0) {
		return null;
	} else {
		weight = 1 - (1 / ratio);
	}

	var avg = [];
	for (var i = 0; i < a.length; i++) {
		avg[i] = Math.round( (weight * a[i]) + ((1 - weight) * b[i]) );
	}

	return avg;
}

function correctLightnessIfNeeded(rgb) {
	const MAX_BRIGHTNESS = 0.8;

	var hsl = rgbToHsl(rgb);
	if (hsl[2] > MAX_BRIGHTNESS) {
		hsl[2] = MAX_BRIGHTNESS;
		rgb = safeAlphaHslToRgb(hsl);
	}

	return rgb;
}