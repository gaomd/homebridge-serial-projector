# homebridge-serial-projector

A Homebridge plugin to control BenQ Projector via RS232 Serial Port and OpenWrt.

## Features

* Power toggle
* Mute toggle
* Eco Blank (dim the display) toggle

## Requirements

* A BenQ Projector
* A RS232 to USB adapter (Prolific PL2303 chip recommended)
* A RS232 crossover (null modem) cable
* An OpenWrt router with USB port
* An existing home network (wired or wireless)

## Installation

### 1. OpenWrt router preparation

Run `firstboot` on the OpenWrt to get an clean reset.

#### 1.1. Install packages

    # opkg install coreutils coreutils-stty kmod-usb-serial kmod-usb-serial-pl2303 libpthread librt socat

#### 1.2. Install executables

    $ scp ./openwrt/fs/root/pctrl.sh     root@ip-of-openwrt:/root/
    $ scp ./openwrt/fs/www/cgi-bin/pctrl root@ip-of-openwrt:/www/cgi-bin/

#### 1.3. Install multicast listener

    # vim /etc/rc.local

Add

    # Keep responding to multicast diagrams
    while true; do socat UDP4-RECVFROM:2367,ip-add-membership=224.33.66.77:0.0.0.0,fork EXEC:"echo \"mac_address: $(cat /sys/class/net/eth0/address)\""; sleep 1; done &

    exit 0

#### 1.4. Configure OpenWrt as a routed client to your main (wireless) router network

Refer to the [OpenWrt Wiki](https://wiki.openwrt.org/doc/recipes/routedclient).

#### 1.5. Remember the IP address

Ensure the IP address of OpenWrt router is accessible from the main router network.

#### 1.6. Confirm working scripts

Test the following URLs on your computer connected to the main router network:

* get status: http://ip-of-openwrt/cgi-bin/pctrl/pow/%3F
* turn on: http://ip-of-openwrt/cgi-bin/pctrl/pow/on
* turn off: http://ip-of-openwrt/cgi-bin/pctrl/pow/off

### 2. Configure Homebridge

Refer to [Homebridge repo](https://github.com/nfarina/homebridge) for more information.

#### 2.1. Install packages

    $ sudo npm install -g homebridge # see also: https://github.com/nfarina/homebridge
    $ git clone https://github.com/gaomd/homebridge-serial-projector.git
    $ cd homebridge-serial-projector
    $ npm install

#### 2.2. Edit `~/.homebridge/config.json`

    {
        "bridge": {
            "//0": "Remove this line and refer to: https://github.com/nfarina/homebridge/blob/master/config-sample.json"
        },
        "accessories": [
            {
                "accessory": "SerialProjector",
                "name": "TV",                           "//0": "required, default to TV (the {name})",
                "power_switch_name": "TV Power",        "//1": "optional, default to {name} Power",
                "speaker_switch_name": "TV Speaker",    "//2": "optional, default to {name} Speaker",
                "display_switch_name": "TV Display",    "//3": "optional, default to {name} Display",
                "mac_address": "mac address of openwrt"
            }
        ]
    }

#### 2.3. Run Homebridge

    $ homebridge -D -P /path/to/homebridge-serial-projector

#### 2.4. Configure the iOS Home app

Open the Home app on your iOS device.
