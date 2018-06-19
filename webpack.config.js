module.exports = [{
	entry: "./assets/materialjs/app.js",
	output: {
		filename: "working/js/material-bundle.js",
		library: 'MDC'
	},
	module: {
		loaders: [{
			test: /\.js$/,
			loader: 'babel-loader',
			query: {
				presets: ['es2015']
			}
		}]
	},
}];
