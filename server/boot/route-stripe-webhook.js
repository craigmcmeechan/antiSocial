var request = require('request');
var stripe = require('stripe')(process.env.STRIPE_SK);


module.exports = function (server) {
	var router = server.loopback.Router();

	function resolveUserByStripeAccount(req, res, next) {
		var ctx = req.getCurrentContext();

		if (!req.body.user_id) {
			return next();
		}

		var query = {
			"where": {
				"stripeCustomerId": req.body.user_id
			}
		};

		req.app.models.TendrUser.findOne(query, function (err, user) {

			if (err) {
				return next(err);
			}

			if (user) {
				ctx.set('stripeAccountSecret', user.processors.stripe.secret);
				ctx.set('tendrUser', user);
			}

			next();
		});
	}

	router.post('/stripe/webhook', function (req, res) {
		var event = req.body;

		async.waterfall([
			function getEvent(cb) {
				stripe.events.retrieve(event.id, function (err, theEvent) {
					cb(err, theEvent);
				});
			},
			function findUser(theEvent, cb) {
				if (!theEvent.data.customer) {
					cb(null, theEvent, null);
				}
				var query = {
					"where": {
						"stripeCustomerId": theEvent.data.customer
					}
				};

				req.app.models.MyUser.findOne(query, function (err, theUser) {
					cb(null, theEvent, theUser);
				});
			}
		], function (err, theEvent, theUser) {
			if (err) {
				return res.sendStatus(401);
			}

			var status = 'ok';
			var notify = null;
			var doit = false;

			switch (theEvent.type) {
			case "charge.dispute.created":
				status = 'subscription suspended: chargeback';
				doit = true;
				notify = 'chargeback';
				break;

			case "invoice.payment_failed":
			case "charge.failed":
				status = 'subscription suspended: charge denied';
				doit = true;
				notify = 'declined';
				break;

			case "invoice.payment_succeeded":
			case "charge.succeeded":
				status = 'ok';
				doit = true;
				notify = 'payment';
				break;

			case "customer.subscription.deleted":
				status = 'subscription expired';
				doit = true;
				notify = 'expired';
				break;
			}

			if (doit) {
				// change status of MyUser
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
