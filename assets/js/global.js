(function ($) {
	var options = {
		'coverResize': false,
		'geometry': {
			'enabled': true,
			breakpoints: [{
				className: 'digitopia-xsmall',
				maxWidth: 768
			}, {
				className: 'digitopia-small',
				maxWidth: 992
			}, {
				className: 'digitopia-medium',
				maxWidth: 1200
			}, {
				className: 'digitopia-large',
				maxWidth: undefined
			}, ],
		},
		'hijax': {
			'enabled': true,
			'disableScrollAnimation': true
		},
	};

	$('body').digitopiaController(options);

	window.setTimeout(function () {
		$('#splash').fadeOut('fast');
	}, 1000);

	$('.nav a').on('click', function () {
		if ($('body').hasClass('digitopia-xsmall')) {
			$('.navbar-toggle').click();
		}
	});

	$('.navbar-toggle').on('click', function (e) {
		$('.avatar').toggle();
	})

	$('body').on('click', '.bug-report', function () {
		open('https://github.com/antiSocialNet/antiSocial/issues/new');
	});

	$('body').on('click', '.copy-to-clipboard', function () {
		var self = $(this);
		$(self.data('target'))[0].select();
		document.execCommand("Copy");
		var saveText = self.text();
		self.text('Copied');
		setTimeout(function () {
			self.text(saveText);
		}, 1000);
	});

	$.fn.extend({
		animateCss: function (animationName, callback) {
			var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
			this.addClass('animated ' + animationName).one(animationEnd, function () {
				$(this).removeClass('animated ' + animationName);
				if (callback) {
					callback();
				}
			});
			return this;
		}
	});

})(jQuery);

var tz = moment.tz.guess();

function loadPage(href) {
	$('body').trigger('DigitopiaLoadPage', href);
}

function getAccessToken() {
	return $.cookie('access_token');
}

function didLogIn() {
	var current = getAccessToken();
	$('#document-body').removeClass('is-logged-out').addClass('is-logged-in');
	$('.DigitopiaInstance').trigger('DidLogIn');
}

function didLogOut() {
	$('#document-body').removeClass('is-logged-in').addClass('is-logged-out'); // css login status rules
	$.removeCookie('access_token');
	$('.DigitopiaInstance').trigger('DidLogOut');
}

function didInjectContent(element) {
	$('#document-body').trigger('DigitopiaInstantiate');
	$('#document-body').data('digitopiaHijax').hijaxLinks(element);
	$('#document-body').data('aspectRatioController').fixAspectRatio();
	$('#document-body').data('constrainedController').fixConstrained();
	$('#document-body').data('liveTimeController').updateTimes();
}

(function ($) {
	if (getAccessToken()) {
		didLogIn();
	}
	else {
		didLogOut();
	}
})(jQuery);

var flashAjaxStatusTimeout;

function flashAjaxStatus(level, message) {

	var alert = '<div class="alert-container"><div class="alert alert-' + level + '">' + message + '</div></div>';

	$('#ajax-status').empty().html(alert);

	if (flashAjaxStatusTimeout) {
		clearTimeout(flashAjaxStatusTimeout);
	}
	flashAjaxStatusTimeout = setTimeout(function () {
		$('#ajax-status').empty();
		flashAjaxStatusTimeout = null;
	}, 6000);
}

function getUploadForProperty(prop, uploads, type, fpo) {
	if (uploads && uploads.length) {
		for (var j = 0; j < uploads.length; j++) {
			if (uploads[j].property === prop) {
				if (type) {
					if (uploads[j].imageSet[type]) {
						return uploads[j].imageSet[type];
					}
				}
				return uploads[j];
			}
		}
	}
	if (fpo) {
		return {
			url: '/images/fpo.jpg'
		};
	}
	return null;
}

(function ($) {
	$.fn.serializeObject = function () {

		var self = this,
			json = {},
			push_counters = {},
			patterns = {
				"validate": /^[a-zA-Z][a-zA-Z0-9_]*(?:\[(?:\d*|[a-zA-Z0-9_]+)\])*$/,
				"key": /[a-zA-Z0-9_]+|(?=\[\])/g,
				"push": /^$/,
				"fixed": /^\d+$/,
				"named": /^[a-zA-Z0-9_]+$/
			};


		this.build = function (base, key, value) {
			base[key] = value;
			return base;
		};

		this.push_counter = function (key) {
			if (push_counters[key] === undefined) {
				push_counters[key] = 0;
			}
			return push_counters[key]++;
		};

		$.each($(this).serializeArray(), function () {

			// skip invalid keys
			if (!patterns.validate.test(this.name)) {
				return;
			}

			var k,
				keys = this.name.match(patterns.key),
				merge = this.value,
				reverse_key = this.name;

			while ((k = keys.pop()) !== undefined) {

				// adjust reverse_key
				reverse_key = reverse_key.replace(new RegExp("\\[" + k + "\\]$"), '');

				// push
				if (k.match(patterns.push)) {
					merge = self.build([], self.push_counter(reverse_key), merge);
				}

				// fixed
				else if (k.match(patterns.fixed)) {
					merge = self.build([], k, merge);
				}

				// named
				else if (k.match(patterns.named)) {
					merge = self.build({}, k, merge);
				}
			}

			json = $.extend(true, json, merge);
		});

		return json;
	};
})(jQuery);
