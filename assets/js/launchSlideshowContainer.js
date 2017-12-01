(function ($) {
	function launchSlideshowController(elem, options) {
		this.element = $(elem);
		var self = this;

		this.start = function () {
			self.element.on('click', function (e) {
				e.preventDefault();
				var index = self.element.data('index');
				var container = $('#' + self.element.data('uuid'));
				container.show();
				$(window).scrollTop(container.offset().top + 7);

				var slideshow = $('#slideshow-' + self.element.data('uuid'));
				didInjectContent(slideshow);
				setTimeout(function () {
					slideshow.data('responsiveCarousel').doFullScreen();
					slideshow.carousel(index);
				}, 0);
			});
		};

		this.stop = function () {
			self.element.off('click');
		};

	}

	$.fn.launchSlideshowController = GetJQueryPlugin('launchSlideshowController', launchSlideshowController);
})(jQuery);
