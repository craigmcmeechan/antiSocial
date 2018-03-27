(function ($) {
	cache = {};

	function scrollToController(elem, options) {
		this.element = $(elem);
		this.timer = null;
		var self = this;
		this.start = function () {
			var key = document.location.pathname;
			key = key.replace(/^\/([^/]+).*/, "/$1");

			if (!$(window).scrollTop()) {
				if (cache[key]) {
					var vh = $(window).height();
					$(window).scrollTop(((vh / 3) * 2));
				}
				else {
					cache[key] = true;
					$(window).on('scroll.scrollToController', function () {
						self.stop();
					});
					self.timer = setTimeout(function () {
						self.timer = null;
						var vh = $(window).height();
						var body = $("html, body");
						body.stop().animate({
							scrollTop: (vh / 3) * 2
						}, '1000', 'swing');
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
			$(window).off('scroll.scrollToController');
		}
	}

	$.fn.scrollToController = GetJQueryPlugin('scrollToController', scrollToController);
})(jQuery);
