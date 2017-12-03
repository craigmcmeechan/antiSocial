cd docker-assets
docker-compose build

aws ecr get-login --profile awstest --no-include-email --region us-east-1

docker tag webapp-antisocial:latest 980978009426.dkr.ecr.us-east-1.amazonaws.com/anti-social:webapp-antisocial

docker tag nginx-antisocial:latest 980978009426.dkr.ecr.us-east-1.amazonaws.com/anti-social:nginx-antisocial

docker push 980978009426.dkr.ecr.us-east-1.amazonaws.com/anti-social:webapp-antisocial
docker push 980978009426.dkr.ecr.us-east-1.amazonaws.com/anti-social:nginx-antisocial
