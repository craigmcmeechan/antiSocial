// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {


	function geoController(elem, options) {
		this.element = $(elem);

		var self = this;

		this.lookupDebounce = null;
		this.target = $(this.element).closest('.geo-zone').find(this.element.data('target'));
		this.pulldown = $(this.element).closest('.geo-zone').find(this.element.data('pulldown'));
		this.element.prop('disabled', true);
		this.start = function () {
			self.geoService = 'https://maps.googleapis.com/maps/api/geocode/json?key=' + self.element.data('api-key');
			self.placesService = new google.maps.places.PlacesService(self.element.closest('.geo-zone').find('.geo-attributions').get(0));

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

					// if editing and we have a location don't show nearby places
					if (!self.target.val()) {
						self.places();
					}
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
						'source': 'user',
						'description': loc.name,
						'loc': {
							'type': 'point',
							'coordinates': [
								self.position.lng(),
								self.position.lat()
							]
						}
					};
				}
				else {
					var desc = loc.name;
					self.element.val(desc);
					geo = {
						'source': 'google',
						'description': desc,
						'loc': {
							'type': 'point',
							'coordinates': [
								loc.geometry.location.lng(),
								loc.geometry.location.lat()
							]
						}
					};
				}
				self.target.val(JSON.stringify(geo));
				self.pulldown.hide();
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
			var desc = '';
			if (place.icon) {
				desc += '<img src="' + place.icon + '" style="height:.8em;padding-bottom:2px;"> ';
			}

			desc += place.name;

			if (_.has(place, 'geometry.location')) {
				var distance = getDistance(self.position, place.geometry.location);
				desc += ' <span class="distance">(' + (Math.ceil(distance / 100) / 10) + 'km)</span>';
			}

			if (0) {
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
					self.pulldown.empty().show();

					for (var i = 0; i < results.length; i++) {
						var loc = $('<a class="address dropdown-item">');
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
				var southWest = spherical.computeOffset(self.position, 1000, -135);
				var northEast = spherical.computeOffset(self.position, 1000, 45);

				var request = {
					bounds: new google.maps.LatLngBounds(southWest, northEast),
					radius: '1000',
					query: address
				};

				self.placesService.textSearch(request, function (results, status) {
					self.pulldown.empty().show();

					var loc = $('<li class="address freeform">');
					loc.data('location', {
						'freeform': true,
						'loc': self.position,
						'name': address
					});
					loc.html('<i class="fa fa-location-arrow"></i> ' + address + ' <span class="distance">(gps loc)</span>');
					self.pulldown.append(loc);

					if (status == google.maps.places.PlacesServiceStatus.OK) {

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

	var rad = function (x) {
		return x * Math.PI / 180;
	};

	var getDistance = function (p1, p2) {
		var R = 6378137; // Earth’s mean radius in meter
		var dLat = rad(p2.lat() - p1.lat());
		var dLong = rad(p2.lng() - p1.lng());
		var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(rad(p1.lat())) * Math.cos(rad(p2.lat())) *
			Math.sin(dLong / 2) * Math.sin(dLong / 2);
		var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		var d = R * c;
		return d; // returns the distance in meter
	};

	$.fn.geoController = GetJQueryPlugin('geoController', geoController);
})(jQuery);
