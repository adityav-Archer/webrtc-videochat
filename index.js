const express = require("express");
const socket = require("socket.io");
const app = express();
const path = require("path");
const PORT = 80;
app.use(express.static("public"));

app.get("/*", (req, res) => {
  res.sendFile(path.join(path.join(__dirname + "/public/index.html")));
});
let appServer = app.listen(PORT, () =>
  console.log(`Server started successfully on ${PORT}`)
);

let io = socket(appServer);

io.on("connection", (socket) => {
  console.log("Socket connected", socket.id);
  socket.emit("connected", socket.id);
  socket.on("join", (room) => {
    const roomsList = io.sockets.adapter.rooms;
    let roomDetails = roomsList.get(room);
    console.log(roomDetails);
    if (!roomDetails) {
      socket.join(room);
      socket.emit("created", room);
    } else if (roomDetails.size < 10) {
      console.log(roomDetails.size);
      socket.join(room);
      socket.emit("joined", room);
    } else {
      socket.emit("full");
    }
    console.log(roomsList);
  });

  socket.on("ready", (room, fromId) => {
    console.log("Ready", room, fromId);
    socket.broadcast.to(room).emit("ready", fromId);
  });

  socket.on("candidate", (candidate, room, fromId, toId) => {
    // console.log("candidate", candidate);
    socket.broadcast.to(room).emit("candidate", candidate, fromId, toId);
  });

  socket.on("offer", (offer, room, fromId, toId) => {
    //console.log("offer", offer);
    socket.broadcast.to(room).emit("offer", offer, fromId, toId);
  });

  socket.on("answer", (answer, room, fromId, toId) => {
    //console.log("answer", answer);
    socket.broadcast.to(room).emit("answer", answer, fromId, toId);
  });

  socket.on("leave", (room, fromId) => {
    socket.leave(room);
    socket.broadcast.to(room).emit("leave", fromId);
  });
});
