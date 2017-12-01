#!/bin/sh
env $(cat localdev.env | xargs) $@
