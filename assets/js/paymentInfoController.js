(function ($) {
	function paymentInfoController(elem, options) {
		this.element = $(elem);
		var self = this;

		this.handler = null;

		this.start = function () {
			self.element.on('click', function (e) {
				e.preventDefault();
				self.doStripe();
			});
		};

		this.stop = function () {
			self.element.off('click');
			if (this.handler) {
				self.handler.close();
				self.handler = null;
			}
		};

		this.doStripe = function () {
			self.handler = StripeCheckout.configure({
				key: self.element.data('pk'),
				email: self.element.data('email'),
				token: function (token, args) {
					$.post('/api/MyUsers/me/subscriptionupdate', {
						'token': token,
						'new': true
					}, function (data) {
						self.load();
					});
				}
			});

			self.handler.open({
				'name': 'MyAntiSocial.net',
				'description': 'Monthly Subscription',
				'amount': 150
			});
		};
	}
	$.fn.paymentInfoController = GetJQueryPlugin('paymentInfoController', paymentInfoController);
})(jQuery);
