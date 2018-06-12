// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {
	cache = {};

	function scrollToController(elem, options) {
		this.element = $(elem);
		this.timer = null;
		var self = this;
		this.start = function () {
			var key = document.location.pathname;
			key = key.replace(/^\/([^/]+).*/, "/$1");

			if (!$(scrollViewport).scrollTop()) {
				if (cache[key]) {
					var vh = $(window).height();
					$(scrollViewport).scrollTop(((vh / 3) * 2));
				}
				else {
					cache[key] = true;
					var element = scrollViewport;
					if (element === 'html, body') {
						element = document;
					}
					$(element).on('scroll.scrollToController', function () {
						self.stop();
					});
					self.timer = setTimeout(function () {
						self.timer = null;
						var vh = $(window).height();
						if (0 && window.Cordova) {
							$(scrollViewport).scrollTop(0, (vh / 3) * 2);
						}
						else {
							$('html,body').stop().animate({
								scrollTop: (vh / 3) * 2
							}, '1000', 'swing');
						}
					}, 1000);
				}
			}

			cache[key] = true;
		};

		this.stop = function () {
			if (self.timer) {
				clearTimeout(self.timer);
				self.timer = null;
			}
			var element = scrollViewport;
			if (element === 'html, body') {
				element = document;
			}
			$(element).off('scroll.scrollToController');
		}
	}

	$.fn.scrollToController = GetJQueryPlugin('scrollToController', scrollToController);
})(jQuery);
