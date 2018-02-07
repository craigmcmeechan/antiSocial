(function ($) {
	function logoutController(elem, options) {
		this.element = $(elem);

		this.start = function () {
			this.element.on('click', function (e) {
				e.preventDefault();
				$.post('/api/MyUsers/logout')
					.done(function () {
						flashAjaxStatus('info', 'logged out');
						didLogOut();
						loadPage('/');
					})
					.fail(function () {
						flashAjaxStatus('danger', 'problem logging out');
						didLogOut();
						loadPage('/');
					});
			});
		};

		this.stop = function () {
			this.element.off('click');
		};
	}
	$.fn.logoutController = GetJQueryPlugin('logoutController', logoutController);
})(jQuery);
