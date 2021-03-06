// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {
	function graphController(elem, options) {
		this.element = $(elem);
		var self = this;

		this.endpoint = this.element.data('endpoint');

		this.start = function () {
			$.get(this.endpoint, function (data) {
				var n = []
				for (var i = 0; i < data.friends.nodes.length; i++) {
					var node = data.friends.nodes[i];
					n.push({
						'id': node.v,
						'label': node.value.name,
						'shape': 'circularImage',
						'image': node.resolvedProfiles[node.v].profile.photo ? node.resolvedProfiles[node.v].profile.photo.url : '/images/slug.png'
					});
				}

				var e = [];
				for (var i = 0; i < data.friends.edges.length; i++) {
					var edge = data.friends.edges[i];
					e.push({
						'from': edge.v,
						'to': edge.w
					});
				}

				var nodes = new vis.DataSet(n);
				var edges = new vis.DataSet(e);

				var network = new vis.Network(self.element[0], {
					'nodes': nodes,
					'edges': edges
				}, {});

			});
		};

		this.stop = function () {};

	}

	$.fn.graphController = GetJQueryPlugin('graphController', graphController);
})(jQuery);
