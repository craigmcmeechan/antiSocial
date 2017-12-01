### development notes

Fork the repository and clone it to your development computer

install node if you don't already have it

`cp localdev-example.env localdev.env`

run `npm install`

run `grunt devel &`

run tests:

`./localdev.sh mocha tests/friends.js`

start the app:

`./localdev.sh node .`

the app is now running on `http://localhost:3000`

launch in browser and create a user

make code changes

make some tests to illustrate the changes

commit them to your fork

once ready do a pull request back to the community repository
