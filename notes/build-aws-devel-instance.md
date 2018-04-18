# minimum install to run service in a docker container
------------------------------------------------------
```
sudo yum install -y docker
sudo usermod -a -G docker ec2-user
sudo service docker start
eval $(aws ecr get-login --no-include-email)
create environment file: /root/antisocial-development.env
docker run --env-file=/root/antisocial-development.env -p 80:80 -p 443:443 --name=webapp-antisocial --rm -d  980978009426.dkr.ecr.us-east-1.amazonaws.com/anti-social-development:webapp-antisocial
```

# Useful commands
-----------------
```
docker logs -f webapp-antisocial
docker pull 980978009426.dkr.ecr.us-east-1.amazonaws.com/anti-social-development:webapp-antisocial
docker stop webapp-antisocial
docker restart webapp-antisocial

```

# Set up for container development
----------------------------------
```
curl -L https://github.com/docker/compose/releases/download/1.21.0/docker-compose-`uname -s`-`uname -m` -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
curl --silent --location https://rpm.nodesource.com/setup_8.x | sudo bash -
yum install -y gcc-c++ make
yum install -y nodejs
npm install -g yarn
npm install -g grunt
yum install git

aws configure

aws ecr get-login --no-include-email
docker login <output from last command>

mkdir /var/app
cd /var/app
git clone https://github.com/antiSocialNet/antiSocial.git
cd antiSocial
git checkout -b development
yarn
grunt

cd deploy/docker-assets
/usr/local/bin/docker-compose --file docker-compose-devel.yml build
/usr/local/bin/docker-compose --file docker-compose-devel.yml up
runs on port 3000

if running ssl:
docker run --env-file=/root/antisocial-development.env -p 80:80 -p 443:443 webapp-antisocial

```

# The environment

| Variable Name   | Required | Default   | Description |
| -------------   | -------- | --------- | ----------- |
| KEEP_FEEDS_OPEN | Yes | false | Use 'true' for now |
| LOG_LEVEL       | No | error | error,warning,info,debug |
| NODE_ENV        | Yes | | localdev, development, production |
| PORT            | No | 3000 | port service listens on  |
| PUBLIC_HOST     | Yes | 127.0.0.1 | public dns hostname of server  |
| PUBLIC_PORT     | Yes | PORT | public port of server  |
| PUBLIC_PROTOCOL | No | http | http, https |
| HTTPS_LISTENER  | No | false | set to true if service support ssl directly |
| ACCESS_LOG      | No | | combined, common, dev, short, tiny |
| S3_SSL_KEY_PATH | No | | S3 path to key.pem |
| S3_SSL_CERT_PATH| No | | S3 path to fullchain1.pem |
| AWS_REGION      | No | | region for AWS account |
| AWS_S3_KEY      | No | from ec2 role | if storing images or SSL keys in S3 |
| AWS_S3_KEY_ID   | No | from ec2 role | if storing images or SSL keys in S3 |
| AWS_S3_BUCKET | No | | if storing images in S3 |
| AWS_S3_REGION | No | | if storing images or SSL keys in S3 |
| GOOGLE_MAPS_API_KEY | No | | Client Side Geocoding |
| AWS_SES_KEY | No | from ec2 role  | Outbound SES Email IAM keys |
| AWS_SES_KEY_ID | No | from ec2 role  | Outbound SES Email IAM keys |
| CONNECTOR | No | Memory | mongo |
| MONGO_DB_NAME | | | |
| MONGO_USERNAME |  | | |
| MONGO_PASSWORD |  | | |
| MONGO_HOSTNAME | | localhost | |
| MONGO_URL |  | | mongo://[mongo credentials url] url options: &authSource=admin &w=majority &readPreference=primaryPreferred |
