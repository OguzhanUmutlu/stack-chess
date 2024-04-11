function __straightPathAll(vec, X, Y, board, mv) {
    for (const [vx, vy] of vec) {
        let x = X, y = Y;
        while (true) {
            x += vx;
            y += vy;
            if (x < 0 || x > 7 || y < 0 || y > 7) break;
            const s = board.get(x, y)[0];
            if (s) {
                mv(x, y);
                break;
            } else mv(x, y);
        }
    }
}

function __getKingSquares(x, y) {
    return [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [-1, 1],
        [1, 1],
        [-1, -1],
        [1, -1]
    ].map(i => [i[0] + x, i[1] + y]);
}

const GetAllMoveList = {
    p(piece, x, y, board, mv) {
        const k = piece.type[0] === "w" ? -1 : 1;
        if (!board.get(x, y + k)[0]) mv(x, y + k);
        if (y === (piece.type[0] === "w" ? 6 : 1) && !board.get(x, y + 2 * k)[0]) {
            mv(x, y + k * 2);
        }
        const diaLeft = board.get(x - 1, y + k)[0];
        const diaRight = board.get(x + 1, y + k)[0];
        if (diaLeft) mv(x - 1, y + k);
        if (diaRight) mv(x + 1, y + k);
        const h = board.history.at(-1);
        if (h) {
            const left = board.get(x - 1, y)[0];
            const right = board.get(x + 1, y)[0];
            if (left && h.x2 === left.x && h.y2 === left.y) mv(x - 1, y + k, true);
            if (right && h.x2 === right.x && h.y2 === right.y) mv(x + 1, y + k, true);
        }
    },
    r(piece, x, y, board, mv) {
        __straightPathAll([
            [0, 1],
            [1, 0],
            [0, -1],
            [-1, 0]
        ], x, y, board, mv);
    },
    n(piece, x, y, board, mv) {
        for (const [vx, vy] of [
            [1, 2],
            [-1, 2],
            [2, 1],
            [2, -1],
            [1, -2],
            [-1, -2],
            [-2, -1],
            [-2, 1]
        ]) mv(x + vx, y + vy);
    },
    b(piece, x, y, board, mv) {
        __straightPathAll([
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1]
        ], x, y, board, mv);
    },
    q(piece, x, y, board, mv) {
        __straightPathAll([
            [0, 1],
            [1, 0],
            [0, -1],
            [-1, 0],
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1]
        ], x, y, board, mv);
    },
    k(piece, x, y, board, mv) {
        const otherKing = board.getKingPosition(piece.type[0] === "b");
        const noSquares = otherKing ? __getKingSquares(otherKing[0], otherKing[1]) : [];
        for (const [vx, vy] of __getKingSquares(x, y)) {
            if (noSquares.some(i => i[0] === vx && i[1] === vy)) continue;
            mv(vx, vy);
        }

        if (board.history.every(i => i[0] !== "move" || i[1] !== piece.type[0] + "k")) {
            for (const X of [0, 7]) {
                const rook = board.get(X, y)[0];
                if (
                    rook.length === 1
                    && board.history.every(i => i[0] !== "move" || i[1] !== piece.type[0] + "r" || i[2] !== 7 || i[3] !== y)
                    && rook[0] === piece.type[0] + "r"
                ) {
                    if (noSquares.some(i => i[0] === x + 2 && i[1] === y)) continue;
                    mv(x + 2, y);
                }
            }
        }
    }
};

export class StackChess {
    _flipped = false;
    turn = true;
    div = null;

    constructor() {
        this.clear();
    };

    getKing(team) {
        return this.pieces.flat().find(i => i.type === (team ? "w" : "b") + "k");
    };

    getKingPosition(team) {
        for (let i = 0; i < 64; i++) {
            const sq = this.pieces[i];
            if (sq.some(i => i.type === (team ? "w" : "b") + "k")) return [Math.floor(i / 8), i % 8];
        }
        return null;
    };

    getMovesOf(x, y) {
        const piece = this.get(x, y)[0];
        if (!piece) return;
        const p = [];
        GetAllMoveList[piece.type[1]](piece, x, y, this, (x, y) => {
            if (x < 0 || x > 7 || y < 0 || y > 7) return;
            const get = this.get(x, y)[0];
            if (!get || get.type[0] !== piece.type[0]) p.push([x, y]);
        });
        return p;
    };

    get(x, y) {
        return this.pieces[y * 8 + x];
    };

    put(x, y, piece) {
        this.pieces[y * 8 + x].unshift(piece = {type: piece, hasMoved: false});
        if (this.div) this.__renderPut(x, y, piece);
    };

    undo() {
        const move = this.history.at(-1);
        if (!move) return;
        if (move.type === "move") {
            const piece = this.get(move.x2, move.y2)[0];
            if (piece) piece.hasMoved = move.hasMoved;
            this.forceMovePiece(move.x2, move.y2, move.x1, move.y1);
            if (this.div) {
                this.__renderMove({type: "move", x1: move.x2, y1: move.y2, x2: move.x1, y2: move.y1});
            }
        } else if (move.type === "sweep") {
            const sq = this.get(move.x, move.y);
            sq.push(...move.captured);
            if (this.div) for (const piece of move.captured) {
                this.__renderPut(move.x, move.y, piece);
            }
        }
        this.history.pop();
        this.turn = !this.turn;
    };

    forceMovePiece(x1, y1, x2, y2) {
        const sq = this.get(x1, y1);
        const piece = sq[0];
        if (!piece) return;
        sq.shift();
        this.get(x2, y2).unshift(piece);
    };

    movePiece(x1, y1, x2, y2, promotion = "q") { // todo: promotion, en passant, castling
        const sq = this.get(x1, y1);
        const piece = sq[0];
        if (
            !piece
            || piece.type[0] !== (this.turn ? "w" : "b")
            || !this.getMovesOf(x1, y1).some(i => i[0] === x2 && i[1] === y2)
        ) return false;
        sq.shift();
        this.get(x2, y2).unshift(piece);
        this.history.push({
            type: "move",
            piece: piece,
            x1, y1, x2, y2
        });
        piece.hasMoved = true;
        this.turn = !this.turn;
        if (this.div) this.__renderMove(piece, x1, y1, x2, y2);
        return true;
    };

    sweepPiece(x, y) {
        const sq = this.get(x, y);
        const piece = sq[0];
        if (!piece || piece.type[0] !== (this.turn ? "w" : "b")) return;
        this.history.push({
            type: "sweep",
            x, y,
            captured: sq.slice(1)
        });
        sq.length = 1;
        this.turn = !this.turn;
        if (this.div) this.__renderSweep(x, y);
    };

    isStalemate() {
        // only king
    };

    isVictory() {
        const move = this.history.at(-1);
        if (!move) return;

    };

    clear() {
        this.pieces = Array(64).fill(0).map(() => []);
        this.history = [];
    };

    reset() {
        this.clear();

        for (let i = 0; i < 8; i++) {
            this.put(i, 1, "bp");
            this.put(i, 6, "wp");
        }

        ["r", "n", "b"].forEach((p, i) => {
            this.put(i, 0, "b" + p);
            this.put(7 - i, 0, "b" + p);
            this.put(i, 7, "w" + p);
            this.put(7 - i, 7, "w" + p);
        });

        this.put(3, 0, "bq");
        this.put(4, 0, "bk");
        this.put(3, 7, "wq");
        this.put(4, 7, "wk");
    };

    // --- RENDERING ---

    setDiv(div, sweepBox) {
        this.div = div;

        this.__rerender();

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

        svg.setAttribute("viewBox", "0 0 100 100");
        svg.innerHTML = [
            [0, 0.75, 3.5, "8"],
            [1, 0.75, 15.75, "7"],
            [0, 0.75, 28.25, "6"],
            [1, 0.75, 40.75, "5"],
            [0, 0.75, 53.25, "4"],
            [1, 0.75, 65.75, "3"],
            [0, 0.75, 78.25, "2"],
            [1, 0.75, 90.75, "1"],
            [1, 10, 99, "a"],
            [0, 22.5, 99, "b"],
            [1, 35, 99, "c"],
            [0, 47.5, 99, "d"],
            [1, 60, 99, "e"],
            [0, 72.5, 99, "f"],
            [1, 85, 99, "g"],
            [0, 97.5, 99, "h"]
        ].map(i => `<text x="${i[1]}" y="${i[2]}" font-size="2.8" class="coordinate-${i[0] ? "dark" : "light"}">${i[3]}</text>`).join("");

        div.appendChild(svg);

        const ILLEGAL = new Audio("./assets/illegal.webm");
        const MOVE = new Audio("./assets/move.webm");
        const CAPTURE = new Audio("./assets/capture.webm");

        let holdingPiece = null;
        let holdingStart = null;
        let hoveringSweep = false;
        sweepBox.addEventListener("mouseenter", () => hoveringSweep = true);
        sweepBox.addEventListener("mouseleave", () => hoveringSweep = false);
        addEventListener("mousedown", e => {
            const R = div.getBoundingClientRect();
            const x = e.clientX - R.x;
            const y = e.clientY - R.y;
            const X = Math.floor(x / R.width * 8);
            const Y = Math.floor(y / R.height * 8);
            if (X < 0 || Y < 0 || X > 7 || Y > 7) return;
            holdingStart = [X, Y];
            const piece = this.get(X, Y)[0];
            if (!piece || (piece.type[0] === "w") !== this.turn) return;
            holdingPiece = document.querySelector(`[piece-x="${X}"][piece-y="${Y}"][piece-index="0"]`);
            holdingPiece.style.left = Math.max(0, Math.min(R.width, x)) - R.width / 16 + "px";
            holdingPiece.style.top = Math.max(0, Math.min(R.height, y)) - R.height / 16 + "px";
            holdingPiece.classList.add("dragging-piece");
        });
        addEventListener("mousemove", e => {
            if (!holdingPiece) return;
            const R = div.getBoundingClientRect();
            const x = e.clientX - R.x;
            const y = e.clientY - R.y;
            holdingPiece.style.left = Math.max(0, Math.min(R.width, x)) - R.width / 16 + "px";
            holdingPiece.style.top = Math.max(0, Math.min(R.height, y)) - R.height / 16 + "px";
        });
        addEventListener("mouseup", e => {
            if (!holdingPiece) return;
            const R = div.getBoundingClientRect();
            const x = e.clientX - R.x;
            const y = e.clientY - R.y;
            const X1 = holdingStart[0];
            const Y1 = holdingStart[1];
            const piece = this.pieces[Y1 * 8 + X1][0];
            if (hoveringSweep) {
                this.sweepPiece(X1, Y1);
                const move = this.history.at(-1);
                (async () => {
                    for (let i = 0; i < move.captured.length; i++) {
                        CAPTURE.currentTime = 0;
                        CAPTURE.play().then(r => r);
                        await new Promise(r => setTimeout(r, 200));
                    }
                })();
            } else {
                const X2 = Math.floor(x / R.width * 8);
                const Y2 = Math.floor(y / R.height * 8);
                if (X1 !== X2 || Y1 !== Y2) {
                    if (this.movePiece(
                        X1, Y1, X2, Y2
                    )) {
                        MOVE.play().then(r => r);
                    } else {
                        this.__renderSetPos(holdingPiece, X1, Y1, piece);
                        ILLEGAL.play().then(r => r);
                    }
                } else this.__renderSetPos(holdingPiece, X1, Y1, piece);
            }
            holdingPiece.classList.remove("dragging-piece")
            holdingPiece = null;
        });
    };

    flip() {
        this._flipped = !this._flipped;
        for (const div of document.querySelector(".piece")) {
            const x = div.getAttribute("piece-x") * 1;
            const y = div.getAttribute("piece-y") * 1;
            const index = div.getAttribute("piece-index") * 1;
            this.__renderSetPos(
                div,
                x,
                y,
                this.pieces[y * 8 + x][index]
            );
        }
    };

    __rerender() {
        for (const div of document.querySelectorAll(".piece")) div.remove();
        for (let i = 0; i < 64; i++) for (const piece of this.pieces[i]) {
            this.__renderPut(i % 8, Math.floor(i / 8), piece);
        }
    };

    __renderPut(x, y, piece) {
        const div = document.createElement("div");
        div.classList.add("piece");
        this.__renderSetPos(div, x, y, piece);
        this.div.appendChild(div);
    };

    __renderSetPos(div, x, y, piece) {
        const pieces = this.pieces[y * 8 + x];
        const index = pieces.indexOf(piece);
        const rIndex = pieces.length - 1 - index;
        div.style.backgroundImage = `url("./assets/pieces/${piece.type}.png")`;
        div.style.left = `calc(${12.5 * x}% + ${rIndex * 5}px)`;
        div.style.top = `calc(${12.5 * (this._flipped ? 7 - y : y)}% - ${rIndex * 5}px)`;
        div.style.zIndex = rIndex * 10 + "";
        div.setAttribute("piece-x", x);
        div.setAttribute("piece-y", y);
        div.setAttribute("piece-index", index);
    };

    __renderSweep(x, y) {
        for (const div of document.querySelectorAll(`[piece-x="${x}"][piece-y="${y}"]`)) {
            const index = div.getAttribute("piece-index") * 1;
            if (index !== 0) div.remove();
            else this.__renderSetPos(div, x, y, this.pieces[y * 8 + x][0]);
        }
    };

    __renderMove(piece, x1, y1, x2, y2) {
        if (!this.div) return;
        const divO = document.querySelector(`[piece-x="${x1}"][piece-y="${y1}"][piece-index="0"]`);
        for (const div of document.querySelectorAll(`[piece-x="${x1}"][piece-y="${y1}"]`)) {
            if (div === divO) continue;
            const oIndex = div.getAttribute("piece-index") * 1;
            div.setAttribute("piece-index", oIndex - 1 + "");
        }
        for (const div of document.querySelectorAll(`[piece-x="${x2}"][piece-y="${y2}"]`)) {
            const oIndex = div.getAttribute("piece-index") * 1;
            div.setAttribute("piece-index", oIndex + 1 + "");
        }
        this.__renderSetPos(divO, x2, y2, piece);
    };
}