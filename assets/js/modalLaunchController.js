(function ($) {
	function modalLaunchController(elem, options) {
		this.element = $(elem);
		var self = this;

		this.start = function () {
			var modal = location.hash;
			if (modal) {
				$(modal).modal()
			}
		};

		this.stop = function () {};
	}

	$.fn.modalLaunchController = GetJQueryPlugin('modalLaunchController', modalLaunchController);
})(jQuery);
