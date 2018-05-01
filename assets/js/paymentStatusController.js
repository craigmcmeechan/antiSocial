(function ($) {
	function paymentStatusController(elem, options) {
		this.element = $(elem);
		var self = this;

		this.prompt = this.element.data('prompt');
		this.terms = this.element.data('terms');

		this.start = function () {
			this.element.parent().on('click', '#update-cc', function (e) {
				self.doStripe();
			});

			this.element.parent().on('click', '#cancel-subscription', function (e) {
				self.cancel();
			});

			this.element.parent().on('click', '#new-subscription', function (e) {
				self.doStripe(true);
			});

			this.load();
		};

		this.stop = function () {
			this.element.parent().off('click', '#update-cc');
			this.element.parent().off('click', '#cancel-subscription');
		};

		this.load = function () {
			this.element.empty();
			$.getJSON('/api/MyUsers/me/subscriptionstatus', function (data) {
				self.render(data.subscription);
			});
		};

		this.cancel = function () {
			$.getJSON('/api/MyUsers/me/subscriptioncancel', function (data) {
				self.load();
			});
		};

		this.doStripe = function (newSubscription) {
			var handler = StripeCheckout.configure({
				key: self.element.data('pk'),
				email: self.element.data('email'),
				token: function (token, args) {
					$.post('/api/MyUsers/me/subscriptionupdate', {
						'token': token,
						'new': newSubscription
					}, function (data) {
						self.load();
					});
				}
			});

			handler.open({
				'name': 'MyAntiSocial.net',
				'description': 'Monthly Subscription',
				'amount': 150,
				'allowRememberMe': false,
				'image': '/images/logo.png'
			});
		};

		this.render = function (data) {
			this.element.empty().hide();

			if (data.customer) {

				var body = $('<div>');

				if (data.customer.delinquent) {
					body.append('<div class="alert alert-danger">We had a problem with your card, please update your card information.</div>');
				}

				var cancelled = 0;

				if (data.customer.subscriptions && data.customer.subscriptions.data.length) {
					body.append('<div><strong>Billing Plan</strong></div>');

					var ul = $('<ul>');
					for (var i = 0; i < data.customer.subscriptions.data.length; i++) {
						var subscription = data.customer.subscriptions.data[i];
						var start = subscription.start ? new moment(subscription.start * 1000).format('MM/DD/YYYY') : '';
						var period_start = subscription.current_period_start ? new moment(subscription.current_period_start * 1000).format('MM/DD/YYYY') : '';
						var period_end = subscription.current_period_end ? new moment(subscription.current_period_end * 1000).format('MM/DD/YYYY') : '';
						var ended = subscription.ended_at ? new moment(subscription.ended_at * 1000).format('MM/DD/YYYY') : '';
						if (subscription.cancel_at_period_end) {
							ended = period_end;
							++cancelled;
						}
						var end = ended ? ' <strong class="text-danger">will cancel on ' + ended + '</strong>' : '';

						ul.append(
							'<li>' +
							subscription.plan.id +
							' subscription plan started on <strong>' + start + '</strong>' +
							' current period <strong>' + period_start + '</strong> through <strong>' + period_end + '</strong>' +
							end +
							'</li>'
						);
					}
					body.append(ul);

					var allCancelled = data.customer.subscriptions.data.length === cancelled;

					if (!allCancelled && data.customer.default_source) {
						for (var i = 0; i < data.customer.sources.data.length; i++) {
							if (data.customer.sources.data[i].id == data.customer.default_source) {
								var card = data.customer.sources.data[i];
								body.append('Your current ' + card.brand + ' card ends with <kbd>' + card.last4 + '</kbd> and expires on <kbd>' + card.exp_month + '/' + card.exp_year + '</kbd> ');
							}
						}
						body.append('<button id="update-cc" class="btn btn-default btn-xs">Update Credit Card Information</div>');
					}

				}
				else {
					allCancelled = true;
					body.append('<div><strong>No current billing plan</strong></div>');
				}

				this.element.empty().append(body);

				var table = $('<table class="table table-bordered" style="margin-top:15px;">');
				table.append('<thead><tr>' +
					'<th>Date</th>' +
					'<th>Description</th>' +
					'<th>Start</th>' +
					'<th>End</th>' +
					'<th>Amount</th>' +
					'<th>Prorated</th>' +
					'<th>Paid</th>' +
					'</tr></thead>');
				var tbody = $('<tbody>');
				table.append(tbody);

				if (data.upcoming && data.upcoming.lines && data.upcoming.lines.data.length) {
					for (var i = 0; i < data.upcoming.lines.data.length; i++) {
						var line = data.upcoming.lines.data[i];

						var date = new moment(data.upcoming.date * 1000).format('MM/DD/YYYY');
						var prorate = line.proration ? '<span class="glyphicon glyphicon-ok" aria-hidden="true"></span>' : '';
						var startdate = new moment(line.period.start * 1000).format('MM/DD/YYYY');
						var enddate = new moment(line.period.end * 1000).format('MM/DD/YYYY');
						var amount = line.amount / 100;
						var description = line.plan ? line.plan.name : line.description;

						tbody.append('<tr>' +
							'<td>' + date + '*</td>' +
							'<td>Next bill</td>' +
							'<td>' + startdate + '</td>' +
							'<td>' + enddate + '</td>' +
							'<td class="text-right">' + amount.toFixed(2) + '</td>' +
							'<td>' + prorate + '</td>' +
							'<td></td>' +
							'</tr>');
					}
				}

				if (data.invoices && data.invoices.data && data.invoices.data.length) {

					for (var i = 0; i < data.invoices.data.length; i++) {
						var invoice = data.invoices.data[i];

						for (var j = 0; j < invoice.lines.data.length; j++) {
							line = invoice.lines.data[j];

							var date = new moment(invoice.date * 1000).format('MM/DD/YYYY');
							var prorate = line.proration ? '<span class="glyphicon glyphicon-ok" aria-hidden="true"></span>' : '';
							var startdate = new moment(line.period.start * 1000).format('MM/DD/YYYY');
							var enddate = new moment(line.period.end * 1000).format('MM/DD/YYYY');
							var amount = line.amount / 100;
							var description = line.description;
							var paid = invoice.paid ? '<span class="glyphicon glyphicon-ok" aria-hidden="true"></span>' : '';

							table.append('<tr>' +
								'<td>' + date + '</td>' +
								'<td>' + description + '</td>' +
								'<td>' + startdate + '</td>' +
								'<td>' + enddate + '</td>' +
								'<td class="text-right">' + amount.toFixed(2) + '</td>' +
								'<td align=center>' + prorate + '</td>' +
								'<td align=center>' + paid + '</td>' +
								'</tr>');
						}
					}
				}
				this.element.append(table).show();

				if (!allCancelled) {
					this.element.append('<div><a id="cancel-subscription">Click Here</a> to stop recurring charges and cancel subscription at end of current billion period.</div>');
				}
				else {
					this.element.append('<p>Your recurring charges are cancelled</p>');
					this.element.append('<button id="new-subscription" class="btn btn-default btn-xs">' + self.prompt + '</button>' + ' ' + self.terms);
				}

				didInjectContent(this.element);
			}
			else {
				this.element.append('<button id="new-subscription" class="btn btn-default btn-xs">Start a New Subscription</div>').show();
			}
		};
	}
	$.fn.paymentStatusController = GetJQueryPlugin('paymentStatusController', paymentStatusController);
})(jQuery);
