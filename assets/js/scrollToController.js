(function ($) {
	cache = {};

	function scrollToController(elem, options) {
		this.element = $(elem);
		this.timer = null;
		var self = this;
		this.start = function () {
			if (!$(window).scrollTop()) {
				var key = document.location.href;
				key = key.replace(/\/post.*/, '');

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
