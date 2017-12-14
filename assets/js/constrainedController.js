(function ($) {
	function constrainedController(elem) {
		this.element = $(elem);
		var self = this;

		this.start = function () {
			this.element.on('click', '.constrained', function () {
				$(this).animate({
					'max-height': 1000
				}, 250, function () {
					$(this).removeClass('constrained').data('released', true);
				});
			});
			this.element.on('DigitopiaDidLoadNewPage DigitopiaDidResize', function (e) {
				self.fixConstrained();
			});
			self.fixConstrained();
		};

		this.stop = function () {
			this.element.on('click', '.constrained');
			this.element.off('DigitopiaDidLoadNewPage DigitopiaDidResize');
		};

		this.fixConstrained = function () {
			self.element.find('.want-constrained').each(function () {
				var e = $(this);
				var maxHeight = e.data('max-height') ? e.data('max-height') : 200;
				if (!e.data.released) {
					e.css({
						'max-height': maxHeight + 1 + 'px'
					});
					if (e.height() > maxHeight) {
						e.addClass('constrained').css({
							'max-height': maxHeight + 'px'
						});
					}
					else {
						e.removeClass('constrained');
					}
				}
			});
		};
	}

	$.fn.constrainedController = GetJQueryPlugin('constrainedController', constrainedController);
})(jQuery);
