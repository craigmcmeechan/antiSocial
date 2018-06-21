// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {
	function modalLaunchController(elem, options) {
		this.element = $(elem);
		var self = this;

		this.start = function () {
			var modal = location.hash;
			if (modal && modal.length > 1 && modal !== '#_=_') {
				$(modal).modal();
			}
		};

		this.stop = function () {};
	}

	$.fn.modalLaunchController = GetJQueryPlugin('modalLaunchController', modalLaunchController);
})(jQuery);
