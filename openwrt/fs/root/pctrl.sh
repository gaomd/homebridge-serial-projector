#!/bin/sh

command=$1
action=$2
sleep=1

# Print debug information
echo Command: ${command}
echo Action: ${action}
echo -ne "Running at speed "
stty -F /dev/ttyUSB0 speed

# Setting up the serial port
stty -F /dev/ttyUSB0 115200 raw -echo

# Grab serial output
(cat /dev/ttyUSB0 > /tmp/serial-output) & pid=$!
(sleep ${sleep} && kill ${pid}) &

# Sending command
echo -ne '\r' > /dev/ttyUSB0
echo -ne "*$1=$2#" > /dev/ttyUSB0
echo -ne '\r' > /dev/ttyUSB0

# Wait for the projector to response, should be very quick
sleep ${sleep}

echo "---- OUTPUT ----"
cat /tmp/serial-output
rm -rf /tmp/serial-output
