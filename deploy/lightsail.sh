yum install -y docker
usermod -a -G docker ec2-user
service docker start
docker volume create mongo-data
docker volume create mongo-logs
docker volume create uploads
curl -L https://github.com/docker/compose/releases/download/1.21.0/docker-compose-$(uname -s)-$(uname -m) -o /usr/bin/docker-compose
chmod +x /usr/bin/docker-compose
mkdir /etc/letsencrypt
cd ~/
touch antisocial-docker-mongo.env
echo LOG_LEVEL=debug >> antisocial-docker-mongo.env
echo NODE_ENV=production >> antisocial-docker-mongo.env
echo PUBLIC_HOST=localhost >> antisocial-docker-mongo.env
echo PUBLIC_PROTOCOL=http >> antisocial-docker-mongo.env
echo CONNECTOR=mongo >> antisocial-docker-mongo.env
echo MONGO_HOSTNAME=mongodb >> antisocial-docker-mongo.env
echo LOCAL_UPLOADS=true >> antisocial-docker-mongo.env
echo PORT=80 >> antisocial-docker-mongo.env
curl -L https://raw.githubusercontent.com/antiSocialNet/antiSocial/master/deploy/docker-assets/docker-compose-mongo.yml -o docker-compose.yml
docker-compose up -d
