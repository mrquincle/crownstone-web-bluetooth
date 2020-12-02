# Control Crownstones over Web Bluetooth

Two folders:

1. api, a server
2. client

Actually, the server is only used for providing a private key to the front-end. It is to show that everything can
run locally. Alternatively, the client code could obtain this from <https://cloud.crownstone.rocks>.

# Prerequisites

Install the node modules through `npm` in each subdirectory.

## Run server

The server requires a local key. Currently it expects an environmental variable set before. The local key can be obtained through the cloud server for your sphere.


```
export CROWNSTONE_GUEST_KEY=XXXX
npm start
```

## Run client

Then run the client just with:

```
npm start
```

The state of this software is **proof of concept**. Do not use in production code.
