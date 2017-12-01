// attach to forms to perform validation of fields while editing
(function ($) {
	function formValidator(elem, options) {
		this.element = $(elem);
		this.valid = false;
		this.submitter = this.element.find(this.element.data('submitter'));
		this.uniqueDebounce = null;
		this.lookupDebounce = null;

		var self = this;

		this.start = function () {
			self.initInput(self.element);

			this.element.find('[data-autofocus="true"]').focus();

			self.element.on('change blur focus keyup input', ':input', function (e) {
				if ($(this).attr('name')) {
					$(this).data('touched', true);
					$(this).closest('.form-group').addClass('touched');
					var isDirty = $(this).data('last-value') !== getRealVal(this);
					$(this).data('dirty', isDirty);
					self.validate();
				}
			});

			self.validate();
		};

		this.stop = function () {
			this.element.off('focus keyup', ':input');
			this.element.off('change blur', ':input');
		};

		this.validate = function (cb) {
			var invalidFields = 0;
			var fields = self.element.find(':input');

			async.map(fields, self.validateField, function (err, allerrors) {
				for (var i = 0; i < fields.length; i++) {
					var input = $(fields[i]);
					var errors = allerrors[i];

					if (errors && errors.length) {
						++invalidFields;

						input.closest('.form-group').removeClass('input-ok');
						if (input.data('touched')) {

							input.closest('.form-group').addClass('input-error');
							input.closest('.form-group').find('.validation-help').html(errors.join(', '));
						}
					}
					else {
						input.closest('.form-group').removeClass('input-error');
						input.closest('.form-group').addClass('input-ok');
						if (input.data('dirty')) {
							input.data('last-value', getRealVal(input));
							self.element.trigger('validchange', input);
						}
					}
				}

				if (invalidFields) {
					self.valid = false;
					$(self.submitter).prop('disabled', true).addClass('disabled');
				}
				else {
					self.valid = true;
					$(self.submitter).prop('disabled', false).removeClass('disabled');
				}

				if (cb) {
					cb(self.valid);
				}
			});
		};

		this.initInput = function (element) {
			element.find(':input').each(function () {
				var input = this;
				$(input).data('touched', false);
				$(input).data('dirty', false);
				$(input).data('last-value', getRealVal(input));
				$(input).data('original-value', getRealVal(input));
				if ($(input).data('checked')) {
					$(input).prop('checked', 'checked');
				}

				if ($(input).data('input-behavior')) {
					$(input).payment($(input).data('input-behavior'));
				}
			});
		};

		this.validateField = function (element, cb) {
			var input = $(element);

			var valid = true;
			var val = getRealVal(input);
			var errors = [];

			if (input.data('validate')) {
				var validations = input.data('validate').split(',');
				for (var i = 0; i < validations.length; i++) {
					var validation = validations[i];

					if (validation === 'required') {
						if (!val) {
							errors.push('Required');
						}
					}

					if (validation === 'integer') {
						if (val && val.match(/\D/)) {
							errors.push('Must be an integer');
						}
					}

					if (validation === 'float') {
						if (val && !val.match(/^[0-9\.]+$/)) {
							errors.push('Must be a valid amount');
						}
					}

					if (validation === 'url') {
						if (val && !val.match(/localhost/) && !val.match(/(^|\s)((https?:\/\/)?[\w-]+(\.[\w-]+)+\.?(:\d+)?(\/\S*)?)/gi)) {
							errors.push('Must be a valid url');
						}
					}

					if (validation === 'email') {
						var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
						if (val && !val.match(re)) {
							errors.push('Must be an email address');
						}
					}

					if (validation === 'password') {
						if (val && !(val.match(/[0-9]+/) && val.match(/[A-Za-z]+/))) {
							errors.push('Must contain at least one number, one letter');
						}
					}

					if (validation === 'cc-number') {
						var cardType = $.payment.cardType(val);
						input.closest('.form-group').find('.cc-brand').empty();
						if (cardType) {
							var img = '<img src="/images/icons/' + cardType + '.png">';
							input.closest('.form-group').find('.cc-brand').html(img);
						}
						var isvalid = $.payment.validateCardNumber(val);
						if (!isvalid) {
							errors.push('Must be a valid cc number');
						}
					}

					if (validation === 'cc-exp') {
						var isvalid = $.payment.validateCardExpiry($(input).payment('cardExpiryVal'));
						if (!isvalid) {
							errors.push('Must be a valid expire date');
						}
					}

					if (validation === 'cc-cvc') {
						var cardnum = getRealVal(input.data('card-field'));
						var cardType = $.payment.cardType(cardnum);
						var isvalid = $.payment.validateCardCVC(val, cardType);
						if (!isvalid) {
							errors.push('Must be a valid cvc code');
						}
					}
				}
			}

			if (val && input.data('mask')) {
				var mask = new RegExp(input.data('mask'));
				if (!mask.exec(val)) {
					errors.push('Invalid characters');
				}
			}

			if (input.data('length') && val.length !== input.data('length')) {
				errors.push('Must be ' + input.data('length') + ' characters long');
			}

			if (input.data('min-length') && val.length < input.data('min-length')) {
				errors.push('Must be at least ' + input.data('min-length') +
					' characters long');
			}

			if (input.data('max-length') && val.length > input.data('max-length')) {
				errors.push('Must be less than ' + input.data('max-length') +
					' characters long');
			}

			if (input.data('min') && val < input.data('min')) {
				errors.push('Minimum value ' + input.data('min'));
			}

			if (input.data('max') && val > input.data('max')) {
				errors.push('Maximum value ' + input.data('max'));
			}

			if (input.data('match') && getRealVal(self.element.find(input.data('match'))) !== getRealVal(input)) {
				errors.push('Does not match');
			}

			if (input.data('unique-endpoint')) {
				if (!errors.length && val.length > 2 && input.data('last-val') !== val &&
					!self.uniqueDebounce) {
					return self.isUnique(input, cb);
				}
				else {
					if (input.data('last-unique')) {
						errors.push('Already exists');
					}
				}
			}

			if (input.data('lookup-endpoint')) {
				if (!val.length) {
					input.removeData('last-lookup');
				}
				if (!errors.length && val.length && input.data('last-val') !== val && !self.lookupDebounce) {
					return self.lookup(input, cb);
				}
				else {
					if (input.data('last-lookup') && !input.data('last-lookup').found.length) {
						errors.push('Not found');
					}
				}
			}

			cb(null, errors);
		};

		this.isValid = function (cb) {
			this.validate(cb);
		};

		this.isUnique = function (input, cb) {
			self.uniqueDebounce = setTimeout(function () {
				self.uniqueDebounce = undefined;
				var endpoint = input.data('unique-endpoint');
				input.data('last-val', getRealVal(input));
				var delim = '?';
				if (endpoint.match(/\?/)) {
					delim = '&';
				}
				$.getJSON(endpoint + delim + 'value=' + getRealVal(input), function (data) {
					if (data.found) {
						input.data('last-unique', 1);
						cb(null, ['must be unique']);
					}
					else {
						input.removeData('last-unique');
						cb(null);
					}
				});
			}, 500);
		};

		this.lookup = function (input, cb) {
			self.lookupDebounce = setTimeout(function () {
				self.lookupDebounce = undefined;
				var endpoint = input.data('lookup-endpoint');
				input.data('last-val', getRealVal(input));
				$.getJSON(endpoint + '?code=' + getRealVal(input), function (data) {
					input.data('last-lookup', data);
					if (!data.found || !data.found.length) {
						cb(null, ['not found']);
					}
					else {
						input.data('id', data);
						var state = $('#document-body').data('modalController').getState();
						if (!state.payload) {
							state.payload = {};
						}
						state.payload[input.attr('name')] = data.found;
						$('#document-body').data('modalController').setState(state);
						cb(null);
					}
				});
			}, 500);
		};
	}

	$.fn.formValidator = GetJQueryPlugin('formValidator', formValidator);
})(jQuery);

// utility to get value of fields with special handling for checkboxes
function getRealVal(elem) {
	var $input = $(elem);
	var value;
	if ($input.attr('type') === 'checkbox') {
		value = $input.is(':checked');
		if ($input.prop('value') && $input.is(':checked')) {
			value = $input.prop('value');
		}
	}
	else {
		value = $input.val();
	}
	return value;
}
