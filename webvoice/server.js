const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: false },
  maxHttpBufferSize: 1e6
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, service: "HOYLOTT WebVoice" }));

const rooms = new Map(); // roomCode -> Map(socketId -> {name})
const MAX_ROOM_SIZE = 8;

function cleanText(value, max = 24) {
  return String(value || "").replace(/[<>\\u0000-\\u001F]/g, "").trim().slice(0, max);
}
function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
function memberList(code) {
  const room = rooms.get(code);
  if (!room) return [];
  return [...room.entries()].map(([id, member]) => ({ id, name: member.name }));
}
function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  if (room) {
    room.delete(socket.id);
    socket.to(code).emit("peer-left", { id: socket.id });
    if (room.size === 0) rooms.delete(code);
    else io.to(code).emit("members", memberList(code));
  }
  socket.leave(code);
  socket.data.roomCode = null;
  socket.data.name = null;
}

io.on("connection", (socket) => {
  socket.on("create-room", ({ name } = {}, callback = () => {}) => {
    leaveRoom(socket);
    let code = makeCode();
    while (rooms.has(code)) code = makeCode();
    rooms.set(code, new Map());
    enterRoom(socket, code, name, callback);
  });

  socket.on("join-room", ({ code, name } = {}, callback = () => {}) => {
    const roomCode = cleanText(code, 6).toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) return callback({ ok: false, error: "گروه پیدا نشد. کد را بررسی کن." });
    if (room.size >= MAX_ROOM_SIZE) return callback({ ok: false, error: `ظرفیت گروه ${MAX_ROOM_SIZE} نفر است.` });
    enterRoom(socket, roomCode, name, callback);
  });

  function enterRoom(socket, code, rawName, callback) {
    const name = cleanText(rawName, 24) || "Player";
    const room = rooms.get(code);
    if (!room) return callback({ ok: false, error: "گروه دیگر وجود ندارد." });
    if ([...room.values()].some(m => m.name.toLowerCase() === name.toLowerCase())) {
      return callback({ ok: false, error: "این اسم در گروه استفاده شده؛ اسم دیگری بزن." });
    }
    room.set(socket.id, { name });
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.name = name;
    socket.to(code).emit("peer-joined", { id: socket.id, name });
    io.to(code).emit("members", memberList(code));
    callback({ ok: true, code, members: memberList(code), selfId: socket.id, maxRoomSize: MAX_ROOM_SIZE });
  }

  socket.on("signal", ({ to, description, candidate } = {}) => {
    const code = socket.data.roomCode;
    if (!code || !to || !rooms.get(code)?.has(to)) return;
    // Relay only signaling data to another member of the same room.
    io.to(to).emit("signal", {
      from: socket.id,
      description: description || null,
      candidate: candidate || null
    });
  });

  socket.on("leave-room", () => leaveRoom(socket));
  socket.on("disconnect", () => leaveRoom(socket));
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => {
  console.log(`HOYLOTT WebVoice listening on http://localhost:${port}`);
});
