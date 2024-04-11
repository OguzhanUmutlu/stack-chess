# stack-chess

Stack Chess API. More information: https://www.chess.com/forum/view/general/stack-chess

# Example usage

```html

<link rel="stylesheet" href="./src/stack-chess.css">
<title>Stack Chess</title>

<div class="board"></div>
<div class="sweep-box">Drag your piece here to <i>sweep</i> it!</div>

<script type="module">
    import {StackChess} from "./src/stack-chess.js";

    const game = new StackChess;
    game.setDiv(
            document.querySelector(".board"),
            document.querySelector(".sweep-box")
    );
    game.reset();
</script>

<style>
    body {
        font-family: system-ui, sans-serif;
        background: #2a2626;
        overflow: hidden;
        color: white;
    }

    .sweep-box {
        position: absolute;
        top: 4%;
        left: 50%;
        translate: -50%;
        padding: 1%;
        background: #b2afaf;
        border-radius: 10px;
    }

    .sweep-box:hover {
        background: #739552;
        cursor: pointer;
    }
</style>
```

# API

TODO.