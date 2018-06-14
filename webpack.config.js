module.exports = [{
	entry: "./assets/materialjs/app.js",
	output: {
		filename: "working/js/material-bundle.js"
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
