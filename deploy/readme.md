This directory contains the gear for continuous integration deployment through CircleCI and AWS elastic beanstalk docker containers.


#### make container for CircleCI testing and deployment
cd deploy/docker-assets
docker build -f Dockerfile-circleci -t <username>/circleci:latest .
docker login
docker push <username>/circleci:latest

debugging container:
docker run -it <username>/circleci bash
