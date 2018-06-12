// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {
	function loginController(elem, options) {
		this.element = $(elem);

		var self = this;
		this.start = function () {

			$('#login-form').on('shown.bs.modal', function () {
				if (window.Cordova) {
					self.element.find('.login-server').val($.cookie('server'));
				}
				self.element.find('.login-email-address').focus()
			});

			this.element.on('submit', function (e) {
				e.preventDefault();
				if (window.Cordova) {
					server = self.element.find('[name="server"]').val();
					$.cookie('server', server, {
						'path': '/',
						'expires': 999
					})
				}
				$.post('/api/MyUsers/login', {
						'email': self.element.find('[name="email"]').val(),
						'password': self.element.find('[name="password"]').val()
					})
					.done(function (data, textStatus, jqXHR) {
						$('#login-form').modal('hide');
						flashAjaxStatus('success', 'logged in');

						loadPage('/feed');
						if (window.Cordova) {
							$.cookie('access_token', data.id, {
								'path': '/',
								'expires': 999
							})
						}
						didLogIn();
					})
					.fail(function () {
						flashAjaxStatus('warning', 'login failed');
					});
			});
		};

		this.stop = function () {
			$('#login-form').off('shown.bs.modal');
			this.element.off('submit');
		};
	}
	$.fn.loginController = GetJQueryPlugin('loginController', loginController);
})(jQuery);
