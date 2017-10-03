#!/usr/bin/env bash

CMD="node ../index.js s 2"

for run in {1..1000}
do
  $CMD
done

