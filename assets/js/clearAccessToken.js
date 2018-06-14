// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {
	function clearAccessToken(elem, options) {
		this.element = $(elem);

		this.start = function () {
			didLogOut();
		};

		this.stop = function () {};
	}
	$.fn.clearAccessToken = GetJQueryPlugin('clearAccessToken', clearAccessToken);
})(jQuery);
