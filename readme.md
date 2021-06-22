# Valorant Websocket Logger

A simple node application to connect to the local Valorant websocket and log all events.

This logger uses the "help" endpoint to explicitly listen to each event which gives more detailed information for received event names.
Additionally, the time in ms of received events is logged.

If Valorant is not running, the logger will wait for the lockfile to be created and connect to the websocket as soon as possible.

Log files can be conveniently viewed with [Valorant WebSocket Log Viewer](https://techchrism.github.io/valorant-websocket-log-viewer/)

Set up with `npm install` and start with `node index.js`
