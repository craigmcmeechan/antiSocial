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
	node_modules/.bin/grunt
}

build_images() {
	echo "docker-compose"
	cd docker-assets
	docker-compose build
	docker tag webapp-antisocial:latest $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/anti-social-$CIRCLE_BRANCH:webapp-antisocial
	docker tag nginx-antisocial:latest $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/anti-social-$CIRCLE_BRANCH:nginx-antisocial

	echo "docker login"
	eval $(aws ecr get-login --region us-east-1)

	echo "docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/anti-social-$CIRCLE_BRANCH:webapp-antisocial"
	docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/anti-social-$CIRCLE_BRANCH:webapp-antisocial

	echo "docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/anti-social-$CIRCLE_BRANCH:nginx-antisocial"
	docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/anti-social-$CIRCLE_BRANCH:nginx-antisocial

	cd ../
}

deploy_eb () {
	if [ "$CIRCLE_BRANCH" == "production" ]; then
		cd production

		echo "deploying mr"
		~/.local/bin/eb use mr-antisocial
		~/.local/bin/eb deploy

		echo "deploying ae"
		~/.local/bin/eb use ae-antisocial
		~/.local/bin/eb deploy
		cd ../
	fi
	if [ "$CIRCLE_BRANCH" == "development" ]; then
		cd development

		echo "deploying development"
		~/.local/bin/eb use devel-antisocial
		~/.local/bin/eb deploy
		cd ../
	fi
}

run_grunt
configure_aws_cli
build_images
deploy_eb
