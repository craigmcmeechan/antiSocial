(function ($) {


	function geoController(elem, options) {
		this.element = $(elem);

		var self = this;

		this.lookupDebounce = null;
		this.target = $(this.element.data('target'));
		this.pulldown = $(this.element.data('pulldown'));
		this.element.prop('disabled', true);
		this.start = function () {
			self.geoService = 'https://maps.googleapis.com/maps/api/geocode/json?key=' + self.element.data('api-key');
			self.placesService = new google.maps.places.PlacesService($('#geo-attributions').get(0));

			if (navigator.geolocation) {
				flashAjaxStatus('info', 'initializing geolocation');
				navigator.geolocation.getCurrentPosition(function (position) {
					var lat = _.get(position, 'coords.latitude');
					var lon = _.get(position, 'coords.longitude');

					// var point = new google.maps.LatLng(42.0562164, -70.1870635); // provincetown

					self.position = new google.maps.LatLng(lat, lon);

					var spherical = google.maps.geometry.spherical;
					var southWest = spherical.computeOffset(self.position, 30000, -135);
					var northEast = spherical.computeOffset(self.position, 30000, 45);
					self.bounds = southWest.lat() + ',' + southWest.lng() + '|' + northEast.lat() + ',' + northEast.lng();
					flashAjaxStatus('info', 'found appx. location');
					$('.loading').hide();
					self.element.on('keyup', function () {
						self.lookup();
					});
					self.element.prop('disabled', false);
					self.places();
				}, function (err) {
					$('.loading').hide();
					flashAjaxStatus('info', 'location unavailable');
					self.element.on('keyup', function () {
						self.lookup();
					});
				});
			}
			else {
				self.element.prop('disabled', false);
				flashAjaxStatus('info', 'location unavailable');
				self.element.on('keyup', function () {
					self.lookup();
				});
			}

			self.pulldown.on('click', '.address', function (e) {
				var loc = $(this).data('location');
				var geo = {};
				if (loc.freeform) {
					geo = {
						'description': loc.description,
						'loc': [
							self.position.lng(),
							self.position.lat()
						]
					}
				}
				else {
					var desc = self.getDescription(loc);
					self.element.val(desc);
					geo = {
						'description': desc,
						'loc': [
							loc.geometry.location.lng(),
							loc.geometry.location.lat()
						]
					}
				}
				self.target.val(JSON.stringify(geo));
				self.pulldown.parent().removeClass("open");
			});
		};

		this.stop = function () {
			this.element.off('keyup');
			self.pulldown.off('click', '.address');
		};

		this.getDescription = function (place) {
			//console.log('name:', place.name);
			//console.log('formatted address:', place.formatted_address);
			//console.log('vicinity:', place.vicinity);
			//console.log('types:', place.types);

			var desc = place.name ? place.name + ', ' : '';
			if (place.formatted_address) {
				if (place.types.indexOf('political') !== -1) {
					desc = place.formatted_address;
				}
				else {
					desc += place.formatted_address;
				}
			}
			else {
				desc += place.vicinity;
			}
			return desc;
		}

		this.places = function () {
			var spherical = google.maps.geometry.spherical;
			var southWest = spherical.computeOffset(self.position, 300, -135);
			var northEast = spherical.computeOffset(self.position, 300, 45);

			self.placesService.nearbySearch({
				bounds: new google.maps.LatLngBounds(southWest, northEast),
				type: []
			}, function (results, status) {
				if (status == google.maps.places.PlacesServiceStatus.OK) {
					self.pulldown.empty().parent().addClass("open");

					for (var i = 0; i < results.length; i++) {
						var loc = $('<li class="address">');
						loc.data('location', results[i]);
						var desc = self.getDescription(results[i]);
						loc.html(desc);
						self.pulldown.append(loc);
					}

					for (var i = 0; i < results.length; i++) {
						var place = results[i];
					}
				}
				else {}
			});
		}

		this.lookup = function (address) {
			if (self.lookupDebounce) {
				clearTimeout(self.lookupDebounce);
			}

			self.lookupDebounce = setTimeout(function () {
				self.lookupDebounce = undefined;

				var address = $(self.element).val();

				var spherical = google.maps.geometry.spherical;
				var southWest = spherical.computeOffset(self.position, 300, -135);
				var northEast = spherical.computeOffset(self.position, 300, 45);

				var request = {
					bounds: new google.maps.LatLngBounds(southWest, northEast),
					radius: '500',
					query: address
				};

				self.placesService.textSearch(request, function (results, status) {
					if (status == google.maps.places.PlacesServiceStatus.OK) {
						self.pulldown.empty().parent().addClass("open");

						var loc = $('<li class="address">');
						loc.data('location', {
							'freeform': true,
							'loc': self.location,
							'description': address
						});
						loc.html(address);
						self.pulldown.append(loc);

						for (var i = 0; i < results.length; i++) {
							var loc = $('<li class="address">');
							loc.data('location', results[i]);
							var desc = self.getDescription(results[i]);
							loc.html(desc);
							self.pulldown.append(loc);
						}
					}
				});

				/*
				var endpoint = self.geoService + '&address=' + encodeURIComponent(address);
				if (self.bounds) {
					endpoint += '&bounds=' + self.bounds;
				}
				console.log(endpoint);
				$.get(endpoint).done(function (data) {
					self.pulldown.empty().show();
					console.log(data);
					for (var i = 0; i < data.results.length; i++) {
						var loc = $('<div class="address">');
						loc.data('location', data.results[i]);
						loc.html(data.results[i].formatted_address);
						self.pulldown.append(loc);
					}
				});
				*/
			}, 500);
		};
	}

	$.fn.geoController = GetJQueryPlugin('geoController', geoController);
})(jQuery);
