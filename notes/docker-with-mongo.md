# Running myAntisocial.net webapp w/mongodb in docker containers on an aws instance

# minimum install to run service in a docker container
------------------------------------------------------
Spin up a 't2-medium' instance with running Amazon Linux with a min of 40 gb disk. Default config does not use other AWS services but the antisocial webservice can be configured to store images on S3 and send mail via SES. It is recommended that you use an instance role to allow access to these services if needed.

Install and start docker daemon:
```
sudo yum install -y docker
sudo usermod -a -G docker ec2-user
sudo service docker start
```

Install docker-compose:
```
sudo curl -L https://github.com/docker/compose/releases/download/1.21.0/docker-compose-$(uname -s)-$(uname -m) -o /usr/bin/docker-compose
chmod +x /usr/bin/docker-compose
```

### configure the stack

Docker compose gets it's configuration from: `/root/antisocial-docker-mongo.env`

```
KEEP_FEEDS_OPEN=true
LOG_LEVEL=debug
NODE_ENV=localdev
PUBLIC_HOST=localhost
PUBLIC_PROTOCOL=http
CONNECTOR=mongo
MONGO_HOSTNAME=mongodb
LOCAL_UPLOADS=true
ACCESS_LOG=dev
```

### create docker volumes for mongo and images

docker volume create mongo-data
docker volume create mongo-logs
docker volume create uploads

### start the services

`docker-compose-mongo.yml` is found in the repo directory `deploy/docker-assets`

```
docker-compose -f docker-compose-mongo.yml up -d
```

Stack now running with data volumes for images, mongo data and mongo logs. All logging to stdout.

Tail logs: `docker logs -f webapp-antisocial`

### periodic (hourly) backup with cron (antisocial is default db name)
```
0 */1 * * * mongodump --db antisocial --gzip --out /root/mongodumps/antisocial-`date +\%Y\%m\%d\%H\%M\%S` 2>&1
```

### restore mongo dump

Create a new docker volume:
```
docker volume create restore-vol
```

run a container :
- mount restore-vol as /restore-to
- mount current directory as /backup
- extract tar in current directory to /restore-to
when done the contents of the tar will be in restore-vol
```
docker run --rm -v my-vol:/restore-to -v $(pwd):/backup ubuntu bash -c "cd /restore-to && tar -xvf /backup/backup.tar"
```
