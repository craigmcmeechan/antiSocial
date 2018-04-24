# Running myAntisocial.net webapp w/mongodb in docker containers

### configure the stack
/root/antisocial-development.env
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

### start the services
in deploy/docker-assets:
docker-compose -f docker-compose-mongo.yml build
docker-compose -f docker-compose-mongo.yml up

Stack now running with data volumes for images, mongo data and mongo logs. All logging to stdout.

Tail logs: `docker logs -f webapp-antisocial`

### backup

use mongodump/mongorestore for mongo data


run a container using webapp-antisocial volumes
- mount current directory in container as /backup
- run a tar of /var/app/current/client/uploads into /backup/backup.tar
when done you will have backup.tar in your current directory

```
docker run --rm --volumes-from webapp-antisocial -v $(pwd):/backup ubuntu tar cvf /backup/backup.tar /var/app/current/client/uploads
```

### restore

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
