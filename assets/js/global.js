// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var scrollViewport = window;

function bootMyAntiSocial() {

	if (doHomeServerRedirect) {
		// auto redirect to proxy form of url in the case where a users follows a link from
		// somewhere such as facebook and ends up on someone sleses antisocial server.
		var xd_cookie = xDomainCookie('//s3.amazonaws.com/myantisocial');
		xd_cookie.get('antisocial-home', function (cookie_val) {
			// if the antisocial-home xdomain cookie is not set and we are logged in set the cookie for later
			if (!cookie_val) {
				if ($.cookie('access_token')) {
					var new_val = document.location.protocol + '//' + document.location.host;
					xd_cookie.set('antisocial-home', new_val);
				}
			}
			else {
				// the antisocial-home cookie exists, if we are not on the user's antisocial server redirect to it
				// if the link is a post
				var server = document.location.protocol + '//' + document.location.host;
				if (server !== cookie_val) {

					var url = cookie_val;
					var href = document.location.href;
					href = href.replace(/\?.*$/, ''); // get rid of query string

					// profile url form
					if (document.location.pathname.match(/^\/([a-zA-Z0-9-]+)$/)) {
						url += '/proxy-profile?endpoint=' + encodeURIComponent(href);
						document.location.href = url;
					}

					// post permalink url form
					if (document.location.pathname.match(/\/post\//)) {
						url += '/proxy-post?endpoint=' + encodeURIComponent(href);
						document.location.href = url;
					}
				}
			}
		}, 365);
	}

	$(document).ajaxSend(function (event, jqxhr, settings) {
		jqxhr.setRequestHeader('X-API-Version', APIVersion);
	});

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

	instantiateMaterialDesignElements($('body'));
	$('body').on('DigitopiaDidLoadNewPage', function (e) {
		if (e.target === this) {
			instantiateMaterialDesignElements($('body'));
		}
	});

	window.setTimeout(function () {
		$('#splash').fadeOut('fast');
	}, 1000);

	$('.moreActivityButton').on('click', function (e) {
		e.preventDefault();
		$('.news-feed-items').toggleClass('constrained-height');
	});

	$('.reply-to-button').on('click', function (e) {
		e.preventDefault();
		var that = $(this);
		// download and inject comment form at end after closest comment
		$.get('/comment-form?about=' + encodeURIComponent(that.data('about')) + '&replyTo=' + encodeURIComponent(that.data('reply-to')), function (data, status, xhr) {
			if (status !== 'success') {
				flashAjaxStatus('danger', 'Could not load comment form');
			}
			else {
				var form = $(data);
				// no nested comments yet
				if (that.closest('.a-comment').find('.end-of-thread').length) {
					that.closest('.a-comment').find('.end-of-thread').before(form);
				}
				else {
					that.closest('.a-comment').nextAll().find('.end-of-thread').first().before(form);
				}
				didInjectContent(form);
			}
		})
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

	$('body').on('click', '.toggle-modal', function (e) {
		e.preventDefault();
		var self = $(this);
		var dialog = new MDC.MDCDialog(document.querySelector(self.data('target')));
		$(self.data('target')).data('mdc-dialog', dialog);
		$(self.data('target')).data('post-login', self.data('post-login'));
		dialog.show();
	});

	var filterTimer = null;
	$('body').on('click', '.filter-feed', function (e) {
		var self = $(this);
		var selected = self.closest('.feed-filters').find(':checked');
		var audiences = [];
		for (var i = 0; i < selected.length; i++) {
			audiences.push($(selected[i]).data('audience'));
		}
		if (filterTimer) {
			clearTimeout(filterTimer);
		}
		filterTimer = setTimeout(function () {
			flashAjaxStatus('info', 'applying filters');
			filterTimer = null;
			var str = JSON.stringify({
				'audiences': audiences
			});

			$.cookie('filters', str, {
				'path': '/',
				'expires': 999
			});

			$('body').trigger('DigitopiaReloadPage');
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
	var xd_cookie = xDomainCookie('//s3.amazonaws.com/myantisocial');
	var new_val = document.location.protocol + '//' + document.location.host;
	xd_cookie.set('antisocial-home', new_val);
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
	instantiateMaterialDesignElements(element);
}

var MDCInstanciateOnce = 0;

function instantiateMaterialDesignElements(element) {
	if (!MDCInstanciateOnce++) {
		const topAppBar = new MDC.MDCTopAppBar(document.querySelector('.mdc-top-app-bar'));

		const nav = new MDC.MDCTemporaryDrawer(document.querySelector('#nav-drawer'));
		document.querySelector('.menu').addEventListener('click', () => nav.open = true);
		$('body').on('click', '.nav-item', function () {
			nav.open = false;
		});

		const notifications = new MDC.MDCTemporaryDrawer(document.querySelector('#news-feed'));
		document.querySelector('.show-notifications-button').addEventListener('click', () => notifications.open = true);
		$('body').on('click', '.news-feed-item', function (e) {
			e.preventDefault();
			notifications.open = false;
			loadPage($(this).data('about'));
		});

	}

	$(element).find('.mdc-button').each(function () {
		const buttonRipple = new MDC.MDCRipple(this);
	});

	$(element).find('.mdc-text-field').each(function () {
		const textField = new MDC.MDCTextField(this);
	});

	$(element).find('.mdc-text-field__icon').each(function () {
		const icon = new MDC.MDCTextFieldIcon(this);
	});

	$(element).find('.mdc-text-field-helper-text').each(function () {
		const helperText = new MDC.MDCTextFieldHelperText(this);
	});

	$(element).find('.mdc-checkbox').each(function () {
		const checkbox = new MDC.MDCCheckbox(this);
		const formField = new MDC.MDCFormField(this.closest('.mdc-form-field'));
		formField.input = checkbox;
	});

}

var flashTimer = null;

function flashAjaxStatus(level, message) {
	if (flashTimer) {
		clearTimeout(flashTimer);
	}
	$('#ajax-status').find('.mdc-snackbar__text').html(message);
	$('#ajax-status').addClass('mdc-snackbar--active');

	flashTimer = setTimeout(function () {
		flashTimer = null;
		$('#ajax-status').removeClass('mdc-snackbar--active');
	}, 1500);
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
