(function ($) {
	function constrainedController(elem) {
		this.element = $(elem);
		var self = this;

		this.start = function () {
			this.element.on('click', '.constrained', function () {
				$(this).data('opened', true);
				$(this).animate({
					'max-height': 2000
				}, 250, function () {
					$(this).css({
						'max-height': 'none'
					}).removeClass('constrained').data('released', true);
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
				if (!e.data('opened')) {

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
							e.removeClass('constrained').css({
								'max-height': 'none'
							});
						}
					}
				}
			});
		};
	}

	$.fn.constrainedController = GetJQueryPlugin('constrainedController', constrainedController);
})(jQuery);
