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

const __X_NAMES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const __Y_NAMES = ["8", "7", "6", "5", "4", "3", "2", "1"];

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
        const enPassant = board.enPassant;
        if (
            enPassant
            && y === enPassant[1]
            && Math.abs(x - enPassant[0]) === 1
        ) mv(enPassant[0], y + k);
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
        //const otherKing = board.getKingPosition(piece.type[0] === "b");
        //const noSquares = otherKing ? __getKingSquares(otherKing[0], otherKing[1]) : [];
        for (const [vx, vy] of __getKingSquares(x, y)) {
            // if (noSquares.some(i => i[0] === vx && i[1] === vy)) continue;
            mv(vx, vy);
        }

        const state = board.getCastleState(piece.type[0] === "w");
        if (state.queenside) mv(x - 2, y);
        if (state.kingside) mv(x + 2, y);
    }
};

class Timer {
    constructor(rem = 60 * 5 * 1000) {
        this.end = Date.now() + rem;
        this.pause();
    };

    get remaining() {
        return this.paused ? this.pauseRem : this.end - Date.now();
    };

    pause() {
        if (this.paused) return;
        this.pauseRem = this.remaining;
        this.paused = true;
    };

    resume() {
        if (!this.paused) return;
        this.paused = false;
        this.end = Date.now() + this.pauseRem;
    };
}

class StackChess {
    _flipped = false;
    turn = true;
    div = null;
    ruleMoves = 0;
    enPassant = null;

    constructor() {
        this.clear();
    };

    /**
     * @param {boolean} team
     * @return {{kingside: boolean, queenside: boolean}}
     */
    getCastleState(team) {
        const king = this.getKing(team);
        const [_, y] = this.getKingPosition(team);
        const state = {};
        if (this.history.every(i => i[0] !== "move" || i[1] !== king.type[0] + "k")) {
            for (const [X, p] of [[0, "queenside"], [7, "kingside"]]) {
                const rook = this.get(X, y);
                if (
                    rook.length === 1
                    && this.history.every(i => i.type !== "move" || i.piece !== rook || i.x1 !== X || i.y1 !== y)
                    && rook[0].type === king.type[0] + "r"
                ) {
                    // if (noSquares.some(i => i[0] === x + 2 && i[1] === y)) continue;
                    state[p] = true;
                }
            }
        }
        return state;
    };

    getKing(team) {
        return this.pieces.flat().find(i => i.type === (team ? "w" : "b") + "k");
    };

    getKingPosition(team) {
        for (let i = 0; i < 64; i++) {
            const sq = this.pieces[i];
            if (sq.some(i => i.type === (team ? "w" : "b") + "k")) return [i % 8, Math.floor(i / 8)];
        }
        return null;
    };

    getMovesOf(x, y) {
        const piece = this.get(x, y)[0];
        if (!piece) return [];
        const p = [];
        GetAllMoveList[piece.type[1]](piece, x, y, this, (x, y) => {
            if (x < 0 || x > 7 || y < 0 || y > 7) return;
            p.push([x, y]);
        });
        return p;
    };

    get(x, y) {
        if (x < 0 || x > 7 || y < 0 || y > 7) return [];
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
            move.piece.hasMoved = move.hasMoved;
            this.forceMovePiece(move.x2, move.y2, move.x1, move.y1);
            if (move.isPromotion) move.piece.type = move.piece.type[0] + "p";
            if (move.isCastleRight) {
                this.forceMovePiece(move.x2 - 1, move.y2, move.x2 + 1, move.y2);
            }
            if (move.isCastleLeft) {
                this.forceMovePiece(move.x2 + 1, move.y2, move.x2 - 2, move.y2);
            }
            if (move.isEnPassant) {
                this.forceMovePiece(move.x2, move.y2, move.x2, move.y1)
            }
        } else if (move.type === "sweep") {
            const sq = this.get(move.x, move.y);
            sq.push(...move.captured);
            if (this.div) for (const piece of move.captured) {
                this.__renderPut(move.x, move.y, piece);
            }
        }
        this.history.pop();
        this.fenHistory.pop();
        this.turn = !this.turn;
        if (this.div) {
            this._endMenu.style.opacity = "0";
            this._endMenu.style.pointerEvents = "none";
            this._promoteMenu.style.opacity = "0";
            this._promoteMenu.style.pointerEvents = "none";
        }
        if (this._undoProm) this.__renderSetPos(...this._undoProm)
    };

    forceMovePiece(x1, y1, x2, y2) {
        const sq = this.get(x1, y1);
        const piece = sq[0];
        if (!piece) return;
        sq.shift();
        this.get(x2, y2).unshift(piece);
        if (this.div) this.__renderMove(piece, x1, y1, x2, y2);
    };

    canMove(x1, y1, x2, y2) {
        const sq = this.get(x1, y1);
        const piece = sq[0];
        return piece
            && piece.type[0] === (this.turn ? "w" : "b")
            && this.getMovesOf(x1, y1).some(i => i[0] === x2 && i[1] === y2);
    };

    movePiece(x1, y1, x2, y2, promotion = "q") {
        const sq = this.get(x1, y1);
        const piece = sq[0];
        if (!this.canMove(x1, y1, x2, y2)) return false;

        const isPromotion = piece.type[1] === "p" && y2 === (piece.type[0] === "w" ? 0 : 7);
        const isCastleLeft = piece.type[1] === "k" && x1 - x2 === 2;
        const isCastleRight = piece.type[1] === "k" && x2 - x1 === 2;
        const isEnPassant = piece.type[1] === "p" && this.get(x2, y2).length === 0 && x1 !== x2;
        const isHalfMove = piece.type[1] === "p";

        if (isPromotion) {
            piece.type = piece.type[0] + promotion;
        }
        if (isCastleLeft) {
            this.forceMovePiece(0, y2, 3, y2);
        }
        if (isCastleRight) {
            this.forceMovePiece(7, y2, 5, y2);
        }
        if (isEnPassant) {
            const mv = this.turn ? -1 : 1;
            this.forceMovePiece(x2, y2 - mv, x2, y2);
        }
        this.history.push({
            type: "move",
            piece: piece,
            x1, y1, x2, y2,
            isPromotion,
            isEnPassant,
            isCastleLeft,
            isCastleRight,
            ruleMoves: this.ruleMoves
        });
        this.fenHistory.push(this.stackFen());

        if (isHalfMove) this.ruleMoves = 0;
        else this.ruleMoves++;

        if (piece.type[1] === "p" && Math.abs(y2 - y1) === 2) this.enPassant = [x2, y2];
        else this.enPassant = null;

        piece.hasMoved = true;
        this.turn = !this.turn;
        this.forceMovePiece(x1, y1, x2, y2);
        return true;
    };

    sweepPiece(x, y) {
        const sq = this.get(x, y);
        const piece = sq[0];
        if (!piece || piece.type[0] !== (this.turn ? "w" : "b")) return;

        const isHalfMove = sq.length > 1;

        this.history.push({
            type: "sweep",
            x, y,
            captured: sq.slice(1),
            ruleMoves: this.ruleMoves
        });

        if (isHalfMove) this.ruleMoves = 0;
        else this.ruleMoves++;

        this.fenHistory.push(this.stackFen());
        sq.length = 1;
        this.turn = !this.turn;
        if (this.div) this.__renderSweep(x, y);
    };

    isStalemate() {
        for (let i = 0; i < 64; i++) {
            const p = this.pieces[i][0];
            if (!p || p.type[0] !== (this.turn ? "w" : "b")) continue;
            if (this.getMovesOf(i % 8, Math.floor(i / 8)).length) return false;
        }
        return true;
    };

    is50MoveRule() {
        return this.ruleMoves >= 100;
    };

    isRepetition() {
        const last = this.fenHistory.at(-1);
        return last && this.fenHistory.filter(i => i === last).length >= 3;
    };

    isInsufficientMaterial() {
        const wKing = this.getKing(true);
        const bKing = this.getKing(false);
        const p = this.pieces.flat();
        const wP = p.filter(i => i.type[0] === "w");
        const bP = p.filter(i => i.type[0] === "b");
        return wKing && bKing && wP.length === 1 && bP.length === 1;
    };

    getVictory() {
        const move = this.history.at(-1);
        let k;
        return move && move.type === "sweep"
            && (k = move.captured.find(i => i.type[1] === "k"))
            && (k[0] === "w" ? "b" : "w");
    };

    isGameOver() {
        return this.isStalemate()
            || this.is50MoveRule()
            || this.isRepetition()
            || this.isInsufficientMaterial()
            || this.getVictory();
    };

    clear() {
        this.pieces = Array(64).fill(0).map(() => []);
        this.history = [];
        this.fenHistory = [];
        this.turn = true;
        if (this.div) for (const div of this.div.querySelectorAll(".piece")) div.remove();
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
        this.canInteract = true;

        this.__rerender();

        const onResize = () => {
            const isMobile = innerWidth < innerHeight;
            this.div.style.width = isMobile ? "80%" : "auto";
            this.div.style.height = isMobile ? "auto" : "80%";
            const R = div.getBoundingClientRect();
            canvas.width = R.width;
            canvas.height = R.height;
        };
        addEventListener("resize", onResize);

        const promotionMenu = document.createElement("div");
        promotionMenu.innerHTML = `<div class="promote">
            <div class="text">Pick a piece to promote your pawn to:</div>
            <div class="promote-options">
                <div data-promote="q"></div>
                <div data-promote="r"></div>
                <div data-promote="b"></div>
                <div data-promote="n"></div>
            </div>
        </div>`
        promotionMenu.classList.add("promotion-menu");
        div.appendChild(promotionMenu);
        this._promoteMenu = promotionMenu;

        const endMenu = document.createElement("div");
        endMenu.innerHTML = `<div class="end-container">
            <div class="big-text"></div>
            <div class="text"></div>
            <div class="ch-btn">Ok</div>
        </div>`;
        endMenu.classList.add("end-menu");
        endMenu.querySelector(".ch-btn").addEventListener("click", () => {
            endMenu.style.pointerEvents = "none";
            endMenu.style.opacity = "0";
            if (this.onCloseEnd) this.onCloseEnd();
        });
        div.appendChild(endMenu);
        this._endMenu = endMenu;
        this._bigT = endMenu.querySelector(".big-text");
        this._smallT = endMenu.querySelector(".text");

        const svg = this.numSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

        svg.setAttribute("viewBox", "0 0 100 100");
        this.__updateNumSvg();

        div.appendChild(svg);

        const canvas = this._canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        div.appendChild(canvas);

        onResize();

        const ILLEGAL = this.ILLEGAL = new Audio("./assets/illegal.webm");
        const MOVE = this.MOVE = new Audio("./assets/move.webm");
        const CAPTURE = this.CAPTURE = new Audio("./assets/capture.webm");

        let holdingPiece = null;
        let holdingStart = null;
        let hoveringSweep = false;
        const cacheClient = {x: 0, y: 0};
        let selectedPiece = null;
        let mouseMoved = false;
        if (sweepBox) {
            sweepBox.addEventListener("mouseenter", () => hoveringSweep = true);
            sweepBox.addEventListener("mouseleave", () => hoveringSweep = false);
        }

        const renderCanvas = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (!this.canInteract || this.EDITOR) return;
            if (selectedPiece) {
                const moves = this.getMovesOf(selectedPiece[0], selectedPiece[1]);
                if (moves.length) for (let [x, y] of moves) {
                    if (this._flipped) {
                        x = 7 - x;
                        y = 7 - y;
                    }
                    ctx.beginPath();
                    ctx.strokeStyle = "rgba(84, 84, 84, 0.5)";
                    ctx.lineWidth = 5;
                    ctx.arc((x + 0.5) * canvas.width / 8, (y + 0.5) * canvas.height / 8, canvas.width / 48, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.closePath();
                }
            }
        };

        const doPos = (x, y) => {
            const R = div.getBoundingClientRect();
            holdingPiece.style.left = Math.max(0, Math.min(R.width, x)) - R.width / 16 + "px";
            holdingPiece.style.top = Math.max(0, Math.min(R.height, y)) - R.height / 16 + "px";
        };

        const promoteListeners = [];
        for (const d of document.querySelectorAll(".promote-options > div")) {
            d.addEventListener("click", () => {
                promoteListeners.forEach(i => i(d.getAttribute("data-promote")));
                promoteListeners.length = 0;
            });
        }

        function showPromotionMenu(piece) {
            return new Promise(r => {
                promotionMenu.style.opacity = "1";
                promotionMenu.style.pointerEvents = "all";
                promoteListeners.push(t => {
                    promotionMenu.style.opacity = "0";
                    promotionMenu.style.pointerEvents = "none";
                    r(t);
                });
                for (const d of document.querySelectorAll(".promote-options > div")) {
                    const t = d.getAttribute("data-promote");
                    d.style.backgroundImage = `url("./assets/pieces/${piece.type[0] + t}.png")`;
                }
            });
        }

        const onMouseDown = (clientX, clientY) => {
            mouseMoved = false;
            cacheClient.x = clientX;
            cacheClient.y = clientY;
            if (!this.canInteract) return;
            const R = div.getBoundingClientRect();
            const x = clientX - R.x;
            const y = clientY - R.y;
            let X = Math.floor(x / R.width * 8);
            let Y = Math.floor(y / R.height * 8);
            if (this._flipped) {
                Y = 7 - Y;
                X = 7 - X;
            }
            if (X < 0 || Y < 0 || X > 7 || Y > 7) return;
            const piece = this.get(X, Y)[0];
            if (!piece || (!this.EDITOR && (piece.type[0] === "w") !== this.turn)) {
                selectedPiece = null;
                renderCanvas();
                return;
            }
            holdingStart = [X, Y];
            selectedPiece = [X, Y];
            renderCanvas();
            holdingPiece = document.querySelector(`[piece-x="${X}"][piece-y="${Y}"][piece-index="0"]`);
            holdingPiece.classList.add("dragging-piece");
        }

        const onMouseMove = (clientX, clientY) => {
            mouseMoved = true;
            cacheClient.x = clientX;
            cacheClient.y = clientY;
            if (!this.canInteract) return;
            if (!holdingPiece) return;
            const R = div.getBoundingClientRect();
            const x = clientX - R.x;
            const y = clientY - R.y;
            doPos(x, y);
        };

        const onMouseUp = () => {
            mouseMoved = false;
            if (!this.canInteract) return;
            if (!holdingPiece) return;
            const R = div.getBoundingClientRect();
            const x = cacheClient.x - R.x;
            const y = cacheClient.y - R.y;
            const X1 = holdingStart[0];
            const Y1 = holdingStart[1];
            let X2 = Math.floor(x / R.width * 8);
            let Y2 = Math.floor(y / R.height * 8);
            if (this._flipped) {
                Y2 = 7 - Y2;
                X2 = 7 - X2;
            }
            const piece = this.pieces[Y1 * 8 + X1][0];
            if (hoveringSweep) {
                this.sweepPiece(X1, Y1);
                if (this.onSweep) this.onSweep(X1, Y1);
                this.__checkEnd();
                this.__playSweepSound().then(r => r);
            } else {
                if (X1 !== X2 || Y1 !== Y2) {
                    if (this.EDITOR || this.canMove(X1, Y1, X2, Y2)) {
                        (async () => {
                            if (this.EDITOR) return this.forceMovePiece(X1, Y1, X2, Y2);
                            const div = holdingPiece;
                            const isPromotion = piece.type[1] === "p" && Y2 === (piece.type[0] === "w" ? 0 : 7);
                            let promotion = "q";
                            if (isPromotion) {
                                this.__renderSetPos(div, X2, Y2, piece);
                                this._undoProm = [div, X1, Y1, piece];
                                promotion = await showPromotionMenu(piece);
                                this._undoProm = null;
                                this.__renderSetPos(div, X1, Y1, piece);
                            }
                            this.movePiece(X1, Y1, X2, Y2, promotion);
                            if (this.onMove) this.onMove(X1, Y1, X2, Y2);
                            this.__checkEnd();
                            await MOVE.play();
                        })();
                    } else {
                        this.__renderSetPos(holdingPiece, X1, Y1, piece);
                        ILLEGAL.play().then(r => r);
                    }
                } else this.__renderSetPos(holdingPiece, X1, Y1, piece);
            }
            renderCanvas();
            holdingPiece.classList.remove("dragging-piece")
            holdingPiece = null;
        };

        addEventListener("mousedown", e => onMouseDown(e.clientX, e.clientY));
        addEventListener("mousemove", e => onMouseMove(e.clientX, e.clientY));
        addEventListener("mouseup", () => onMouseUp());
        addEventListener("touchstart", e => onMouseDown(e.touches[0].clientX, e.touches[0].clientY));
        addEventListener("touchmove", e => onMouseMove(e.touches[0].clientX, e.touches[0].clientY));
        addEventListener("touchend", () => onMouseUp());
    };

    __updateNumSvg() {
        this.numSvg.innerHTML = (
            this._flipped ? [
                [1, 0.75, 90.75, "8"],
                [0, 0.75, 78.25, "7"],
                [1, 0.75, 65.75, "6"],
                [0, 0.75, 53.25, "5"],
                [1, 0.75, 40.75, "4"],
                [0, 0.75, 28.25, "3"],
                [1, 0.75, 15.75, "2"],
                [0, 0.75, 3.5, "1"],
                [0, 97.5, 99, "a"],
                [1, 85, 99, "b"],
                [0, 72.5, 99, "c"],
                [1, 60, 99, "d"],
                [0, 47.5, 99, "e"],
                [1, 35, 99, "f"],
                [0, 22.5, 99, "g"],
                [1, 10, 99, "h"]
            ] : [
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
            ]
        ).map(i => `<text x="${i[1]}" y="${i[2]}" font-size="2.8" class="coordinate-${i[0] ? "dark" : "light"}">${i[3]}</text>`).join("")
    };

    async __playSweepSound() {
        const move = this.history.at(-1);
        for (let i = 0; i < move.captured.length; i++) {
            this.CAPTURE.currentTime = 0;
            this.CAPTURE.play().then(r => r);
            await new Promise(r => setTimeout(r, 200));
        }
    };

    flip() {
        this._flipped = !this._flipped;
        for (const div of document.querySelectorAll(".piece")) {
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
        this.__updateNumSvg();
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
        div.style.left = `calc(${12.5 * (this._flipped ? 7 - x : x)}% + ${rIndex * 5}px)`;
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

    __showEndScreen(b, s) {
        if (this.onEnd) this.onEnd();
        this._endMenu.style.opacity = "1";
        this._endMenu.style.pointerEvents = "all";
        this._smallT.innerText = s;
        this._bigT.innerText = b;
    };

    __checkEnd() {
        if (this.isStalemate()) return this.__showEndScreen("Draw", "by stalemate");
        if (this.is50MoveRule()) return this.__showEndScreen("Draw", "by the 50 move rule");
        if (this.isRepetition()) return this.__showEndScreen("Draw", "by repetition");
        if (this.isInsufficientMaterial()) return this.__showEndScreen("Draw", "by insufficient material");

        const victory = this.getVictory();
        if (victory) return this.__showEndScreen((victory === "w" ? "White" : "Black") + " wins", "by king capture");
    };

    stackFenRaw() {
        const S = [];
        let empty = 0;
        for (let i = 0; i < 64; i++) {
            const p = this.pieces[i];
            if (p.length === 0) {
                empty++;
                continue;
            }
            if (empty > 0) {
                S.push(empty);
                empty = 0;
            }
            S.push(p.map(i => i.type[0] === "w" ? i.type[1].toUpperCase() : i.type[1]).join(""));
        }
        return S.join("/");
    };

    stackFen() {
        const wCastle = this.getCastleState(true);
        const bCastle = this.getCastleState(false);
        const fields = [
            this.stackFenRaw(),
            this.turn ? "w" : "b",
            wCastle.queenside || wCastle.kingside ? "" : "-",
            bCastle.queenside || bCastle.kingside ? "" : "-",
            "-",
            this.ruleMoves.toString()
        ];
        if (wCastle.queenside) fields[2] += "Q";
        if (wCastle.kingside) fields[2] += "K";
        if (bCastle.queenside) fields[3] += "Q";
        if (bCastle.kingside) fields[3] += "K";
        const last = this.history.at(-1);
        if (last && last.type === "move" && last.piece.type[1] === "p" && Math.abs(last.y1 - last.y2) === 2) {
            fields[4] = __X_NAMES[last.x2] + __Y_NAMES[last.y2];
        }
        return fields.join(" ");
    };

    static fromStackFen(fen) {
        const spl = fen.split(" ");
        const board = new StackChess();
        const pieces = spl[0].split("/");
        const wCastle = spl[2];
        const bCastle = spl[3];
        const wCastleQ = wCastle.includes("Q");
        const wCastleK = wCastle.includes("K");
        const bCastleQ = bCastle.includes("Q");
        const bCastleK = bCastle.includes("K");
        const enSpl = spl[4].split("");
        board.turn = spl[1] === "w";
        board.enPassant = spl[4] === "-" ? null : [__X_NAMES.indexOf(enSpl[0]), __Y_NAMES.indexOf(enSpl[1])]
        board.ruleMoves = spl[5] * 1;
        for (let i = 0, j = 0; i < 64; j++) {
            const p = pieces[j];
            if (!isNaN(p * 1)) {
                i += p * 1;
            } else {
                board.pieces[i] = p.split("").map(v => {
                    const type = v.toUpperCase() === v ? "w" + v.toLowerCase() : "b" + v;
                    let hasMoved = false;
                    if (i === 0) hasMoved = bCastleQ;
                    if (i === 7) hasMoved = bCastleK;
                    if (i === 56) hasMoved = wCastleQ;
                    if (i === 63) hasMoved = wCastleK;
                    return {type, hasMoved};
                });
            }
        }
        return board;
    };
}

if (typeof exports !== "undefined") module.exports = {StackChess, Timer};