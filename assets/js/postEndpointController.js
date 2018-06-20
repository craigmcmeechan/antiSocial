// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {
	function postEndpointController(elem, options) {
		this.element = $(elem);

		var self = this;

		self.submitter = self.element.data('submitter') ? $(self.element.data('submitter')) : self.element;
		self.endpoint = self.element.attr('action') ? self.element.attr('action') : self.element.data('endpoint');
		if (self.element.data('method')) {
			self.method = self.element.data('method');
		}
		else {
			self.method = self.element.attr('method') ? self.element.attr('method') : 'POST';
		}
		self.prompt = $(self.submitter).html();
		self.modal = self.element.data('modal') ? $(self.element.data('modal')) : null;
		self.successPrompt = self.element.data('success-prompt');
		self.data = self.element.data('data') ? self.element.data('data') : null;

		self.start = function () {
			self.submitter.on('click', function (e) {
				e.preventDefault();
				self.submitter.html('<i class="fa fa-circle-o-notch fa-spin"></i> Loading.');
				self.doIt();
			});
		};

		self.stop = function () {
			self.submitter.off('click');
		};

		self.doIt = function () {
			var data;
			if (self.data) {
				data = self.data;
			}
			else {
				data = self.element.serializeObject();
			}
			flashAjaxStatus('info', 'saving');
			$.ajax({
				'method': self.method,
				'url': self.endpoint,
				'data': data,
				'headers': {
					'x-digitopia-hijax': 'true'
				}
			}).done(function (data, textStatus, jqXHR) {
				var flashLevel = jqXHR.getResponseHeader('x-digitopia-hijax-flash-level') ? jqXHR.getResponseHeader('x-digitopia-hijax-flash-level') : 'info';
				var flashMessage = self.successPrompt ? self.successPrompt : jqXHR.getResponseHeader('x-digitopia-hijax-flash-message');
				var redirect = jqXHR.getResponseHeader('x-digitopia-hijax-location');
				var loggedIn = jqXHR.getResponseHeader('x-digitopia-hijax-did-login');
				var loggedOut = jqXHR.getResponseHeader('x-digitopia-hijax-did-logout');
				var failed = false;
				if (_.get(data, 'result.flashLevel')) {
					flashLevel = data.result.flashLevel;
				}
				if (_.get(data, 'result.flashMessage')) {
					flashMessage = self.successPrompt ? self.successPrompt : data.result.flashMessage;
				}
				if (_.get(data, 'result.hijaxLocation')) {
					redirect = data.result.hijaxLocation;
				}
				if (_.get(data, 'result.didLogIn')) {
					loggedIn = true;
				}
				if (_.get(data, 'result.didLogOut')) {
					loggedOut = true;
				}

				if (_.get(data, 'result.status')) {
					if (data.result.status !== 'ok') {
						failed = true;
					}
				}

				if (loggedIn) {
					didLogIn();
				}

				if (loggedOut) {
					didLogOut();
				}

				self.submitter.html(self.prompt);

				flashAjaxStatus(flashLevel, flashMessage);

				if (!failed) {
					if (redirect) {
						loadPage(redirect);
					}

					if (self.modal) {
						$(self.modal).data('mdc-dialog').destroy();
					}
				}

			}).fail(function (jqXHR, textStatus, errorThrown) {
				self.submitter.html(self.prompt);
				if (_.get(jqXHR, 'jqXHR.responseJSON.error.message')) {
					flashAjaxStatus('danger', jqXHR.responseJSON.error.message);
				}
				else {
					flashAjaxStatus('danger', textStatus + ': ' + errorThrown);
				}
			});
		};
	}
	$.fn.postEndpointController = GetJQueryPlugin('postEndpointController', postEndpointController);
})(jQuery);
