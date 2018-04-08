(function ($) {
	function previewUrl(elem) {
		this.element = $(elem);
		var self = this;

		this.target = this.element.data('target');
		this.debug = this.element.data('debug');

		this.lastval = undefined;

		this.start = function () {
			this.element.on('focusout', function () {
				if (self.lastval !== self.element.val()) {
					self.preview(self.element.val());
					self.lastval = self.element.val();
				}
			});
		};

		this.stop = function () {
			this.element.off('focusout');
		};

		this.preview = function (url) {
			var buffer = '<div class="ogPreview" data-jsclass="OgTagPreview" data-src="/api/OgTags/scrape" data-url="' + url + '" data-type="json" data-debug="' + self.debug + '"></div><!--endog-->';
			$(self.target).find('.ogPreviewHere').empty().append(buffer);
			didInjectContent(self.target);
		};
	}

	$.fn.previewUrl = GetJQueryPlugin('previewUrl', previewUrl);
})(jQuery);
