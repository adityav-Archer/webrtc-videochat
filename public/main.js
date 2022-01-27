let socket = io.connect("http://localhost:3005");
let roomName = document.querySelector("#roomName");
let videoContainer = document.querySelector("#videoContainer");
let roomInfoContainer = document.querySelector("#roomInfoContainer");
let joinBtn = document.querySelector("#joinBtn");
let userVideo = document.querySelector("#local");
let peerVideo = document.querySelector("#peer");
let optionsContainer = document.querySelector("#roomOptionsContainer");
let cameraOffBtn = document.querySelector("#cameraOffBtn");
let muteBtn = document.querySelector("#muteBtn");
let leaveBtn = document.querySelector("#leaveBtn");
let shareBtn = document.querySelector("#shareBtn");
let isOwner = false,
  muteFlag = false,
  toggleCameraFlag = false,
  mySocketId,
  userStream,
  room,
  rtcPeerConnection = {},
  constraints = {
    audio: true,
    video: {
      width: 1280,
      height: 720,
    },
  };

// Contains the stun server URL we will be using.
const iceServers = {
  iceServers: [
    {
      urls: "stun:stun1.l.google.com:19302",
    },
    {
      urls: "stun:stun2.l.google.com:19302",
    },
    {
      urls: "stun:stun.1und1.de:3478",
    },
  ],
};

async function getUserMedia(isCreator) {
  try {
    userStream = await navigator.mediaDevices.getUserMedia(constraints);
    userVideo.srcObject = userStream;
    userVideo.onloadedmetadata = function (e) {
      userVideo.play();
    };
    roomInfoContainer.style = "display:none;";
    optionsContainer.style = "display: block";
    if (!isCreator) {
      console.log("entered here");
      socket.emit("ready", room, mySocketId);
    }
  } catch (err) {
    console.log("Error in getting ::::User Media::::", err);
  }
}

function onIceCandidateHandler(event) {
  console.log("ICE Candidate", event, this.fromId);
  if (event.candidate) {
    socket.emit("candidate", event.candidate, room, mySocketId, this.fromId);
  }
}

function onTrackHandler(event) {
  console.log(event, this.fromId);
  //videoContainer = document.querySelector("#videoContainer");
  console.log("On track: ", this, event);
  let videoId = `remote_video_${this.fromId}`;
  let newVideo = document.getElementById(videoId);
  if (!newVideo) {
    newVideo = document.createElement("video");
    newVideo.id = videoId;
    newVideo.classList.add("remote-video");
    videoContainer.appendChild(newVideo);
  }
  newVideo.srcObject = event.streams[0];
  console.log(newVideo);
  newVideo.onloadedmetadata = function (e) {
    newVideo.play();
  };
  //console.log(event, peerVideo);
  /*peerVideo.srcObject = event.streams[0];
  console.log(peerVideo);
  peerVideo.onloadedmetadata = function (e) {
    peerVideo.play();
  };*/
}

joinBtn.addEventListener("click", (event) => {
  if (!roomName.value) {
    alert("Please enter the room name");
    return;
  }
  console.log("Welcome to the ROOM");
  videoContainer.style = "display: block";
  room = roomName.value;
  socket.emit("join", roomName.value);
});

muteBtn.addEventListener("click", (event) => {
  muteFlag = !muteFlag;

  console.log("User stream tracks", userStream.getTracks());
  userStream.getTracks()[0].enabled = !muteFlag;
  muteBtn.textContent = muteFlag ? "Unmute" : "Mute";
});
cameraOffBtn.addEventListener("click", (event) => {
  toggleCameraFlag = !toggleCameraFlag;

  console.log("User stream tracks", userStream.getTracks());
  userStream.getTracks()[1].enabled = !toggleCameraFlag;
  toggleCameraFlag.textContent = !toggleCameraFlag ? "Camera On" : "Camera Off";
});

leaveBtn.addEventListener("click", (event) => {
  socket.emit("leave", room, mySocketId);
  let container = document.querySelector("#videoContainer");
  container.style = "display:none";
  optionsContainer.style = "display:none";
  roomInfoContainer.style = "display:block;";

  if (userStream.srcObject) {
    userStream.srcObject.getTracks().forEach((track) => track.stop());
  }
  let videoContainer = document.querySelectorAll(".remote-video");
  videoContainer.forEach((item) => {
    if (item.srcObject) {
      item.srcObject.getTracks().forEach((track) => track.stop());
    }
  });

  //Checks if there is peer on the other side and safely closes the existing connection established with the peer.
  Object.keys(rtcPeerConnection).forEach((key) => clearRTCConnections(key));
  /*if (rtcPeerConnection) {
    rtcPeerConnection.ontrack = null;
    rtcPeerConnection.onicecandidate = null;
    rtcPeerConnection.close();
    rtcPeerConnection = null;
  }*/
});

function clearRTCConnections(key) {
  rtcPeerConnection[key].ontrack = null;
  rtcPeerConnection[key].onicecandidate = null;
  rtcPeerConnection[key].close();
  rtcPeerConnection[key] = null;
}

socket.on("connected", (socketId) => {
  if (!mySocketId) mySocketId = socketId;
});

socket.on("created", function () {
  isOwner = true;

  getUserMedia(isOwner);
});

// Triggered when a room is succesfully joined.

socket.on("joined", function () {
  isOwner = false;

  getUserMedia(isOwner);
});

// Triggered when a room is full (meaning has 2 people).

socket.on("full", function () {
  alert("Room is Full, Can't Join");
});

// Triggered when a peer has joined the room and ready to communicate.

socket.on("ready", (fromId) => {
  console.log(fromId);
  if (fromId === mySocketId) {
    return;
  }
  const socketContext = {
    fromId,
  };
  console.log("FromId", fromId, socketContext);
  if (!rtcPeerConnection[fromId]) {
    rtcPeerConnection[fromId] = new RTCPeerConnection(iceServers);
  }

  rtcPeerConnection[fromId].onicecandidate =
    onIceCandidateHandler.bind(socketContext);
  rtcPeerConnection[fromId].ontrack = onTrackHandler.bind(socketContext);
  rtcPeerConnection[fromId].addTrack(userStream.getTracks()[0], userStream);
  rtcPeerConnection[fromId].addTrack(userStream.getTracks()[1], userStream);
  rtcPeerConnection[fromId]
    .createOffer()
    .then((offer) => {
      rtcPeerConnection[fromId].setLocalDescription(offer);
      console.log("the offer is:", offer);
      socket.emit("offer", offer, room, mySocketId, fromId);
    })

    .catch((error) => {
      console.log(error);
    });
});

// Triggered on receiving an ice candidate from the peer.

socket.on("candidate", (candidate, fromId, toId) => {
  if (mySocketId !== toId) return;
  console.log(
    "candidate",
    rtcPeerConnection,
    fromId,
    candidate,
    mySocketId,
    toId
  );
  let icecandidate = new RTCIceCandidate(candidate);

  rtcPeerConnection[fromId].addIceCandidate(icecandidate).catch((e) => {
    console.log("Failure during addIceCandidate(): ", e);
  });
});

// Triggered on receiving an offer from the person who created the room.

socket.on("offer", (offer, fromId, toId) => {
  if (toId === mySocketId) {
    console.log("offer", offer);
    const socketContext = {
      fromId,
    };
    rtcPeerConnection[fromId] = new RTCPeerConnection(iceServers);
    rtcPeerConnection[fromId].onicecandidate =
      onIceCandidateHandler.bind(socketContext);
    rtcPeerConnection[fromId].ontrack = onTrackHandler.bind(socketContext);
    rtcPeerConnection[fromId].addTrack(userStream.getTracks()[0], userStream);
    rtcPeerConnection[fromId].addTrack(userStream.getTracks()[1], userStream);
    rtcPeerConnection[fromId].setRemoteDescription(offer);
    rtcPeerConnection[fromId]
      .createAnswer()
      .then((answer) => {
        rtcPeerConnection[fromId].setLocalDescription(answer);
        socket.emit("answer", answer, room, mySocketId, fromId);
      })
      .catch((error) => {
        console.log(error);
      });
  }
});

// Triggered on receiving an answer from the person who joined the room.

socket.on("answer", (answer, fromId, toId) => {
  if (toId !== mySocketId) return;
  rtcPeerConnection[fromId].setRemoteDescription(answer);
});

socket.on("leave", (fromId) => {
  isOwner = true;

  if (rtcPeerConnection[fromId]) {
    rtcPeerConnection[fromId].ontrack = null;
    rtcPeerConnection[fromId].onicecandidate = null;
    rtcPeerConnection[fromId].close();
    delete rtcPeerConnection[fromId];
  }

  let videoId = `remote_video_${this.fromId}`;
  let remoteVideoElement = document.getElementById(videoId);
  remoteVideoElement.srcObject.getTracks().forEach((track) => track.stop());
  remoteVideoElement.remove();
});
