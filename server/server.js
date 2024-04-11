const express = require("express");
const IO = require("socket.io");
const http = require("http");
const app = express();
const server = http.createServer(app);
const io = new IO.Server(server);
const {StackChess: Board, Timer} = require("../lib/stack-chess.js");
const fs = require("fs");
const path = require("path");

const c = (a, b) => app.get(a, (req, res) => res.sendFile(path.join(__dirname, b)));
const b = (p, b) => fs.readdirSync(p).forEach(i =>
    fs.statSync(p + "/" + i).isFile()
    && c("/" + b + "/" + i, p + "/" + i)
);
b("../assets", "assets");
b("../assets/pieces", "assets/pieces");
b("../lib", "lib");
c("/", "../index.html");
c("/editor", "../editor.html");
c("/playground", "../playground.html");

/*** @type {Object<string, Room>} */
const rooms = {};

io.on("connection", socket => {
    socket.on("play", uuid => {
        if (getWSRoom(socket)) return;
        if (typeof uuid !== "string" && uuid !== null) return;
        const room = uuid ? rooms[uuid] : findFreeRoom() || new Room();
        if (!room) return socket.emit("invalid room");
        room.wsJoin(socket);
    });
    socket.on("move", (x1, y1, x2, y2) => {
        const room = getWSRoom(socket);
        if (room) room.wsMove(socket, x1, y1, x2, y2);
    });
    socket.on("sweep", (x, y) => {
        const room = getWSRoom(socket);
        if (room) room.wsSweep(socket, x, y);
    });
    socket.on("resign", () => {
        const room = getWSRoom(socket);
        if (room) room.wsResign(socket);
    });
    socket.on("leave", () => {
        const room = getWSRoom(socket);
        if (room) room.wsLeave(socket);
    });
    socket.on("disconnect", () => {
        const room = getWSRoom(socket);
        if (room) room.wsLeave(socket);
    });
});

server.listen(80);

function getWSRoom(ws) {
    return Object.values(rooms).find(i => i.whiteWS === ws || i.blackWS === ws);
}

function makeUUID() {
    return Math.floor(Math.random() * 10000000000).toString(32);
}

function findFreeRoom() {
    return Object.values(rooms).find(i => i.isFree());
}

function checkPos(x, y) {
    return x >= 0 && x <= 7 && y >= 0 && y <= 7 && Math.floor(x) === x && Math.floor(y) === y;
}

class Room {
    whiteWS = null;
    blackWS = null;
    board = new Board();
    timers = [new Timer, new Timer];

    constructor() {
        let uuid;
        while (!uuid || uuid in rooms) uuid = makeUUID();
        this.uuid = uuid;
        rooms[uuid] = this;
        this.board.reset();

        this.int = setInterval(() => {
            if (this.timers[0].remaining <= 0) {
                if (this.whiteWS) this.whiteWS.emit("timeout", true);
                if (this.blackWS) this.whiteWS.emit("timeout", true);
                clearInterval(this.int);
            }
            if (this.timers[1].remaining <= 0) {
                if (this.whiteWS) this.whiteWS.emit("timeout", false);
                if (this.blackWS) this.whiteWS.emit("timeout", false);
                clearInterval(this.int);
            }
        });
    };

    isFree() {
        return this.board.history.length === 0 && (!this.whiteWS || !this.blackWS);
    };

    getWSTeam(ws) {
        return this.whiteWS === ws ? "whiteWS" : (this.blackWS === ws ? "blackWS" : null)
    };

    wsJoin(ws) {
        if (!this.isFree()) return;
        const free = ["blackWS", "whiteWS"].filter(i => !this[i]);
        const sel = free[Math.floor(Math.random() * free.length)];
        const opp = this[sel === "blackWS" ? "whiteWS" : "blackWS"];
        this[sel] = ws;
        ws.emit("play ok", this.uuid, sel[0] === "w", !!opp);
        if (opp) {
            opp.emit("opponent join");
            this.timers[0].resume();
        }
    };

    wsLeave(ws) {
        const t = this.getWSTeam(ws);
        if (!t) return;
        const opp = this[t === "blackWS" ? "whiteWS" : "blackWS"];
        this[t] = null;
        if (opp) opp.emit("opponent left");
        this.destroy();
    };

    wsResign(ws) {
        const t = this.getWSTeam(ws);
        if (!t) return;
        const opp = this[t === "blackWS" ? "whiteWS" : "blackWS"];
        this[t] = null;
        if (opp) opp.emit("opponent resign");
        this.destroy();
    };

    wsMove(ws, x1, y1, x2, y2) {
        const t = this.getWSTeam(ws);
        if (!t) return;
        if (
            (t[0] === "w") !== this.board.turn
            || !checkPos(x1, y1)
            || !checkPos(x2, y2)
            || !this.board.movePiece(x1, y1, x2, y2)
        ) return;
        const opp = this[t === "blackWS" ? "whiteWS" : "blackWS"];
        if (opp) opp.emit("move", x1, y1, x2, y2);
        this.checkEnd();
    };

    wsSweep(ws, x, y) {
        const t = this.getWSTeam(ws);
        if (!t) return;
        if (
            (t[0] === "w") !== this.board.turn
            || !checkPos(x, y)
        ) return;
        this.board.sweepPiece(x, y);
        const opp = this[t === "blackWS" ? "whiteWS" : "blackWS"];
        if (opp) opp.emit("sweep", x, y);
        this.checkEnd();
    };

    checkEnd() {
        if (this.board.isGameOver()) return this.destroy();
    };

    destroy() {
        delete rooms[this.uuid];
        clearInterval(this.int);
    };
}