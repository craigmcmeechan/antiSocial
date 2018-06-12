// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {

	function aspectRatioController(elem) {
		this.element = $(elem);

		var self = this;

		this.start = function () {
			this.element.on('DigitopiaDidResize', function (e) {
				if (e.target === this) {
					self.fixAspectRatio();
				}
			});

			this.element.on('DigitopiaDidLoadNewPage', function (e) {
				if (e.target === this) {
					self.fixAspectRatio();
				}
			});

			self.fixAspectRatio();
		};

		this.stop = function () {
			this.element.off('DigitopiaDidResize');
		};

		this.fixAspectRatio = function () {
			this.element.find('.maintain-aspect-ratio').each(function () {
				var p = $(this).data('width-percent');
				$(this).height($(this).width() / p);
			});
		};
	}

	$.fn.aspectRatioController = GetJQueryPlugin('aspectRatioController', aspectRatioController);

})(jQuery);
