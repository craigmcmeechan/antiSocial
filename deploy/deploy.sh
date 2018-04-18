#!/usr/bin/env bash

# more bash-friendly output for jq
JQ="jq --raw-output --exit-status"

configure_aws_cli(){
	~/.local/bin/aws --version
	~/.local/bin/aws configure set default.region us-east-1
	~/.local/bin/aws configure set default.output json
}

run_grunt() {
	echo "grunt"
	cd ~/repo
	node_modules/.bin/grunt
}

build_images() {
	echo "docker-compose"
	cd ~/repo/deploy/docker-assets
	docker-compose build
	docker tag webapp-antisocial:latest $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/anti-social-$CIRCLE_BRANCH:webapp-antisocial
	#docker tag xray-antisocial:latest $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/anti-social-$CIRCLE_BRANCH:xray-antisocial
	#docker tag nginx-antisocial:latest $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/anti-social-$CIRCLE_BRANCH:nginx-antisocial

	echo "docker login"
	eval $(aws ecr get-login --region us-east-1)

	echo "docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/anti-social-$CIRCLE_BRANCH:webapp-antisocial"
	docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/anti-social-$CIRCLE_BRANCH:webapp-antisocial

	#echo "docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/anti-social-$CIRCLE_BRANCH:xray-antisocial"
	#docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/anti-social-$CIRCLE_BRANCH:xray-antisocial

	#echo "docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/anti-social-$CIRCLE_BRANCH:nginx-antisocial"
	#docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/anti-social-$CIRCLE_BRANCH:nginx-antisocial
}

deploy_eb () {
	if [ "$CIRCLE_BRANCH" == "production" ]; then
		cd ~/repo/deploy/production

		echo "deploying mr"
		~/.local/bin/eb use mr-antisocial
		~/.local/bin/eb deploy

		echo "deploying ae"
		~/.local/bin/eb use ae-antisocial
		~/.local/bin/eb deploy
	fi
	if [ "$CIRCLE_BRANCH" == "development" ]; then
		cd ~/repo/deploy/development

		echo "deploying development"
		~/.local/bin/eb use devel-antisocial
		~/.local/bin/eb deploy
	fi
}

deploy_ecs () {
	if [ "$CIRCLE_BRANCH" == "production" ]; then
		echo "deploying ae"
		aws ecs update-service --cluster arn:aws:ecs:us-east-1:980978009426:cluster/antisocial-ae --service arn:aws:ecs:us-east-1:980978009426:service/antisocial-ae --force-new-deployment
		echo "deploying mr"
		aws ecs update-service --cluster arn:aws:ecs:us-east-1:980978009426:cluster/antisocial-mr --service arn:aws:ecs:us-east-1:980978009426:service/antisocial-mr --force-new-deployment
	fi
	
	#if [ "$CIRCLE_BRANCH" == "development" ]; then
	#	echo "deploying development"
	#	aws ecs update-service --cluster arn:aws:ecs:us-east-1:980978009426:cluster/antisocial-fargate --service arn:aws:ecs:us-east-1:980978009426:service/sample-app-service --force-new-deployment
	#fi
}

run_grunt
configure_aws_cli
build_images
deploy_ecs
