#!/bin/sh

command=$1
action=$2

# Print debug information
echo Command: $command
echo Action: $action
echo -ne "Running at speed "
stty -F /dev/ttyUSB0 speed

# Setting up the serial port
stty -F /dev/ttyUSB0 115200 raw -echo

# Grab serial output
(cat /dev/ttyUSB0 > /tmp/serial-output) & pid=$!
(sleep 2 && kill $pid) &

# Sending command
echo -ne '\r' > /dev/ttyUSB0
echo -ne "*$1=$2#" > /dev/ttyUSB0
echo -ne '\r' > /dev/ttyUSB0

sleep 2

echo "---- OUTPUT ----"
cat /tmp/serial-output
rm -rf /tmp/serial-output
