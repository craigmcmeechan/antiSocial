var async = require('async');
var stripe = require('stripe')(process.env.STRIPE_SK);
var debug = require('debug')('stripe');

module.exports = function (server) {
	var router = server.loopback.Router();

	router.post('/stripe/webhook', function (req, res) {
		var event = req.body;

		async.waterfall([
			function getEvent(cb) {
				stripe.events.retrieve(event.id, function (err, theEvent) {
					debug('webhook event %j', theEvent);
					cb(err, theEvent);
				});
			},
			function findUser(theEvent, cb) {
				if (!theEvent.data.customer) {
					return cb(null, theEvent, null);
				}

				var query = {
					'where': {
						'stripeCustomerId': theEvent.data.customer
					}
				};

				req.app.models.MyUser.findOne(query, function (err, theUser) {
					debug('webhook user %j', theUser);
					cb(null, theEvent, theUser);
				});
			}
		], function (err, theEvent, theUser) {
			if (err) {
				return res.sendStatus(401);
			}

			if (!theEvent || !theUser) {
				return res.sendStatus(200); // unable to find user from event so ignore it
			}

			var status = 'ok';
			var notify = null;
			var doit = false;

			switch (theEvent.type) {
			case 'charge.dispute.created':
				status = 'subscription suspended: chargeback';
				doit = true;
				notify = 'chargeback';
				break;

			case 'invoice.payment_failed':
			case 'charge.failed':
				status = 'subscription suspended: charge denied';
				doit = true;
				notify = 'declined';
				break;

			case 'invoice.payment_succeeded':
			case 'charge.succeeded':
				status = 'ok';
				doit = true;
				notify = 'payment';
				break;

			case 'customer.subscription.deleted':
				status = 'subscription expired';
				doit = true;
				notify = 'expired';
				break;
			}

			if (theUser && doit) {
				debug('webhook writeback status %s', status);
				theUser.subscriptionStatus = status;
				theUser.save();
			}

			if (notify) {
				// send email
			}

			res.sendStatus(200);
		});
	});

	server.use(router);
};
