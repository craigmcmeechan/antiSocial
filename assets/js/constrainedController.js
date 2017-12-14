(function ($) {
	function constrainedController(elem) {
		this.element = $(elem);
		var self = this;

		this.start = function () {
			this.element.on('click', '.constrained', function () {
				$(this).animate({
					'max-height': 1000
				}, 250, function () {
					$(this).removeClass('constrained');
				});
			});
		};

		this.stop = function () {
			this.element.on('click', '.constrained');
		};
	}

	$.fn.constrainedController = GetJQueryPlugin('constrainedController', constrainedController);
})(jQuery);
