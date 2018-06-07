var scrollViewport = window;

function bootMyAntiSocial() {

	if ($.cookie('access_token')) {
		redirectorSetServer(document.location.protocol + '//' + document.location.host);
	}

	redirector(document.location);

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

	if (getAccessToken()) {
		didLogIn();
	}
	else {
		didLogOut();
	}

	window.setTimeout(function () {
		$('#splash').fadeOut('fast');
	}, 1000);

	$('.nav a').on('click', function () {
		if ($('body').hasClass('digitopia-xsmall')) {
			$('.navbar-toggler').click();
		}
	});

	$('.navbar-toggler').on('click', function (e) {
		$('.avatar').toggle();
	});

	$('.moreActivityButton').on('click', function (e) {
		e.preventDefault();
		$('.news-feed-items').toggleClass('constrained-height');
	});

	$('.show-feed-button').on('click', function (e) {
		e.preventDefault();
		$('.footer-button.active').toggleClass('active');
		$(this).toggleClass('active');
		$('.on-screen').toggleClass('on-screen');
		$('#content').show();
		$(scrollViewport).scrollTop(0);
		$('#news-feed').data('liveNewsFeedItemWebsocketController').clearCounter();
	});

	$('.show-notifications-button').on('click', function (e) {
		e.preventDefault();
		$('.footer-button.active').toggleClass('active');
		$(this).toggleClass('active');
		$('.on-screen').toggleClass('on-screen');
		$('#content').hide();
		$('#news-feed').toggleClass('on-screen');
		$(scrollViewport).scrollTop(0);
	});

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
}

var tz = moment.tz.guess();

function loadPage(href) {
	$('body').trigger('DigitopiaLoadPage', href);
}

function scrollToElement(element) {
	var top = $(element).offset().top;
	$('html,body').stop().animate({
		'scrollTop': top - 75
	}, '500', 'swing');
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
