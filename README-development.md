### development notes

This prototype is built in [Nodejs](https://nodejs.org) on the [loopback](https://loopback.io/) application framework.

### installation

Fork the repository and clone it to your development computer

install node if you don't already have it

`cp localdev-example.env localdev.env`

Note that by default all data is ephemeral using the loopback memory connector. If you want the data to persist set MEMORY_CONNECTOR_BACKING_FILE=working/memory-db.json in localdev.env

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
