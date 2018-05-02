# Running myAntisocial.net webapp w/mongodb service in docker containers

### configure the stack

Copy [docker-compose-mongo.yml](https://github.com/antiSocialNet/antiSocial/blob/master/deploy/docker-assets/docker-compose-mongo.yml) to your home directory.

Create an environment file: `~/antisocial-docker-mongo.env`

Minimal configuration to run under http (port 80) w/mongodb and local storage of images

```
KEEP_FEEDS_OPEN=true
LOG_LEVEL=debug
NODE_ENV=localdev
PUBLIC_HOST=localhost
PUBLIC_PROTOCOL=http
CONNECTOR=mongo
MONGO_HOSTNAME=mongodb
LOCAL_UPLOADS=true
PORT=80
```

### create docker volumes for mongo and images
```
docker volume create mongo-data
docker volume create mongo-logs
docker volume create uploads
```

### start the services
Web service exposes privileged port 80 so you need to use sudo if on a OSX. On linux this if probably not needed. `-d` runs detached from console (daemon mode)

```
sudo docker-compose -f ~/docker-compose-mongo.yml up -d
```

The stack now running with data volumes for images, mongo data and mongo logs. All logging to stdout.

Connect to `http://localhost/`

To see logs: `docker logs -f webapp-antisocial`

### Use cron to do periodic backup (hourly) with cron (antisocial is the default db name)
```
0 */1 * * * mongodump --db antisocial --gzip --out /root/mongodumps/antisocial-`date +\%Y\%m\%d\%H\%M\%S` 2>&1
```

### restore mongo dump

Create a new docker volume and run mongodb then perform restore:
```
docker volume create restore-vol
docker run --rm -v restore-vol:/data/db -p 27017:27017 --name mongodb-restore -d mongo
run mogorestore --db antisocial --gzip /root/mongodumps/antisocial-yyyymmddhhmmss
```
Change volume name in docker-compose file and start service.

### Minimum install to run on an AWS instance

Spin up a 't2-medium' instance with running Amazon Linux with a min of 40 gb disk. The default configuration does not use other AWS services but the antisocial webservice can be configured to store images on S3 and send mail via SES. It is recommended that you use an instance role to allow access to these services if needed.

Install and start docker daemon:
```
sudo yum install -y docker
sudo usermod -a -G docker ec2-user
sudo service docker start
```

Install docker-compose: (note - use latest version: https://docs.docker.com/compose/install/)
```
sudo curl -L https://github.com/docker/compose/releases/download/1.21.0/docker-compose-$(uname -s)-$(uname -m) -o /usr/bin/docker-compose
chmod +x /usr/bin/docker-compose
```

### MongoDB security
The mongodb container is running by default w/o authentication and the default mongo port is exposed to the host (for mongodump backup).

TODO: document implementing DB authentication

### Running with SSL

TODO: instructions for letsencrypt cert installation and configuration

### Storing images on S3

### Setting up email service

### Other configuration options
