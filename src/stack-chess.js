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
        this.pieces[y * 8 + x].push({type: piece, hasMoved: false});
    };

    undo() {
        const move = this.history.at(-1);
        if (!move) return;
        if (move.type === "move") {
            const piece = this.get(move.x2, move.y2)[0];
            if (piece) piece.hasMoved = move.hasMoved;
            this.forceMovePiece(move.x2, move.y2, move.x1, move.y1);
        } else if (move.type === "sweep") {
            const sq = this.get(move.x, move.y);
            sq.unshift(move.captured.map(i => ({type: i[0], hasMoved: i[1]})));
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
            piece: piece.type,
            x1, y1, x2, y2,
            hasMoved: piece.hasMoved
        });
        piece.hasMoved = true;
        this.turn = !this.turn;
        this.__render();
        return true;
    };

    sweepPiece(x, y) {
        const sq = this.get(x, y);
        const piece = sq[0];
        if (!piece || piece.type[0] !== (this.turn ? "w" : "b")) return;
        this.history.push({
            type: "sweep",
            x, y,
            captured: sq.slice(1).map(i => [i.type, i.hasMoved])
        });
        sq.length = 1;
        this.turn = !this.turn;
        this.__render();
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
        this.__render();
    };

    // --- RENDERING ---

    setDiv(div, sweepBox) {
        this.div = div;
        this._piecesDiv = document.createElement("div");
        this._piecesDiv.classList.add("piece-container");
        div.appendChild(this._piecesDiv);
        this.__render();

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
            let target = e.target;
            if (!target.classList.contains("piece")) return;
            target = Array.from(e.target.parentElement.children).at(-1);
            const R = div.getBoundingClientRect();
            const x = e.clientX - R.x;
            const y = e.clientY - R.y;
            holdingStart = [Math.floor(x / R.width * 8), Math.floor(y / R.height * 8)];
            const piece = this.get(holdingStart[0], holdingStart[1])[0];
            if ((piece.type[0] === "w") !== this.turn) return;
            holdingPiece = target;
            target.style.left = Math.max(0, Math.min(R.width, x)) + "px";
            target.style.top = Math.max(0, Math.min(R.height, y)) + "px";
            target.classList.add("dragging-piece");
            target.parentElement.parentElement.appendChild(target);
        });
        addEventListener("mousemove", e => {
            if (!holdingPiece) return;
            const R = div.getBoundingClientRect();
            const x = e.clientX - R.x;
            const y = e.clientY - R.y;
            holdingPiece.style.left = Math.max(0, Math.min(R.width, x)) + "px";
            holdingPiece.style.top = Math.max(0, Math.min(R.height, y)) + "px";
        });
        addEventListener("mouseup", async e => {
            if (!holdingPiece) return;
            const R = div.getBoundingClientRect();
            const x = e.clientX - R.x;
            const y = e.clientY - R.y;
            if (hoveringSweep) {
                this.sweepPiece(holdingStart[0], holdingStart[1]);
                const move = this.history.at(-1);
                for (let i = 0; i < move.captured.length; i++) {
                    CAPTURE.currentTime = 0;
                    CAPTURE.play().then(r => r);
                    await new Promise(r => setTimeout(r, 200));
                }
            } else {
                const X2 = Math.floor(x / R.width * 8);
                const Y2 = Math.floor(y / R.height * 8);
                if (holdingStart[0] !== X2 || holdingStart[1] !== Y2) {
                    if (this.movePiece(
                        holdingStart[0], holdingStart[1], X2, Y2
                    )) {
                        MOVE.play().then(r => r);
                    } else {
                        this.__render();
                        ILLEGAL.play().then(r => r);
                    }
                } else this.__render();
            }
            holdingPiece = null;
        });
    };

    flip() {
        this._flipped = !this._flipped;
        this.__render();
    };

    __render() {
        if (!this.div) return;
        let html = "";
        for (let i = 0; i < 64; i++) {
            const x = i % 8;
            const y = Math.floor(i / 8);
            const pieces = this.pieces[i];
            // Not the best approach, but it's 4am
            html += `<div class="square" style="left:${12.5 * x}%;top:${12.5 * (this._flipped ? 7 - y : y)}%">
${pieces.map(i => `<div class="piece" style="background-image:url('./assets/pieces/${i.type}.png')"></div>`).reverse().join("")}
</div>`;
        }
        this._piecesDiv.innerHTML = html;
    };
}