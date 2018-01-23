(function ($) {
	function friendLookupController(elem, options) {
		this.element = $(elem);

		var self = this;

		this.start = function () {
			this.element.on('submit', function (e) {
				e.preventDefault();
				loadPage(proxyEndPoint(self.element.find('[name="endpoint"]').val()));
			});
		};

		this.stop = function () {
			this.element.off('submit');
		};
	}

	$.fn.friendLookupController = GetJQueryPlugin('friendLookupController', friendLookupController);
})(jQuery);
