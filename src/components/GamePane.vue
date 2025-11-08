<script setup lang="ts">
/*
CSS triggers
If you plan to use an HTML GUI overlay over the BabylonJS canvas, pay attention to browser reflows and repaints. 
Especially animated alpha transparent divs can degrade performance. You can read more about the topic in general 
here and have this cheat-sheet always prepared: CSS Triggers.

Vue reactivity, friend or foe?
If you want to expose scene information to Vue, keep in mind, that exposing the 'wrong' objects may put Vue and 
BabylonJS in a recursive redraw loop and it will dramatically degrade performance. As a thumb of rule never make 
the BabylonJS Engine or Scene object reactive. If you suspect such behaviour, test your scene without Vue.

*/


import { ref, onMounted, onBeforeUnmount, nextTick } from "@vue/runtime-core";
import { buildCanvas, disposeEngine, resizeGame } from "@/scenes/scene1/main";


const gameMsg = ref<string>(""); 

const gameContainer = ref<HTMLDivElement | null>(null);
const bjsCanvas = ref<HTMLCanvasElement | null>(null);
let resizeObserver: ResizeObserver | null = null;


onMounted(async () => {
 // autoplay video as soon as mounted
  if (bjsCanvas.value) {
    await buildCanvas(bjsCanvas.value);
  }
  // Resize observer to detect CSS size changes
  resizeObserver = new ResizeObserver(() => {
    resizeGame();
  });
  resizeObserver.observe(gameContainer.value!);

});


onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  disposeEngine();
});

</script>

<template>
  <div>
    <h2 class="title">Karlsruhe, Zentrum</h2>
  </div>

<div class="gamepane-container" ref="gameContainer">
    <!-- BabylonJS canvas  -->
    <canvas
      ref="bjsCanvas"
      class="game-canvas"
    ></canvas>
  </div>
</template>

<style scoped>
.game-canvas {
  box-sizing: border-box;
  width: 100%; 
  height: 80vh;
  border: 2px solid #ccc;
  border-radius: 8px;
  overflow: hidden;
}
.intro-video {
  width: 100%;
  height: auto;
  max-height: 50vh;
  display: block;
}
.gamepane-container {
  position: relative;
  width: 100%;
  /*
  height: 100%;
  */
}

.item {
  font-size: 1.2em;
  margin: 0.1em 0;
  min-height: 1.6em;
  height: 1.6em;
  display: block;
  align-items: center;
  padding: 0 0.25em;
  box-sizing: border-box;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item1 {
  margin-top:1rem;
}

.title {
  background: #F3EAC3;
  padding: 0.5em;
  border-radius: 8px;
  text-align: center;
  }

.info {
  margin: 0.5em 0;
  padding: 0.5em;
  border: 1px solid #ccc;
  border-radius: 8px;
  background: #E6D8A5;
  width: 42vh;
  height: 23vh;
  margin: auto;
}

.msg {
  margin: 0.5em;
  padding: 0.5em 1em;
  font-size: 1em;
  border: none;
  border-radius: 4px;
  background-color: #42b983;
  color: white;
  background-color: #0E3C48
}

.btn {
  margin: 0.5em;
  padding: 0.5em 1em;
  font-size: 1em;
  border: none;
  border-radius: 4px;
  background-color: #42b983;
  color: white;
  cursor: pointer;
  background-color: #0E3C48
}
.btn:hover {
  background-color: #1E6E84;
}

.infoRaw {
  /*
  background-image: url(~@/assets/img/movie_closed.jpg);
  background-size: cover;
  background-position: center;
  color: transparent;
  */
}
.infoOpen {
  background-image: url("/img/backgrounds/movie_open.jpg");
  background-size: cover;
  background-position: center;
  color: black;
}
.infoClosed {
  background-image: url("/img/backgrounds/movie_closed.jpg");
  background-size: cover;
  background-position: center;
  color: transparent;
}

@media (max-width: 1281px) {
.title {
  padding: 0.25em;
  border-radius: 6px;
  }
}


@media (max-width: 601px) {

  .title {
    font-size: 1.1rem;
    padding: 0.2rem;
  }

  .info {
    padding: 0.1rem;
    margin: 0;
    overflow:scroll;
    margin-left: auto;
    margin-right: auto;
    width: 45vh;
    height: 25vh;
  }

  .item {
    font-size: .8rem;
    /*
    min-height: auto;
    height: auto;
    white-space: normal; 
    overflow: visible;
    text-overflow: clip;
    */
  }

  .btn {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 0.65rem;
    font-size: .8rem;
    margin: 0.4em 0;
    border-radius: 6px;
  }
}
</style>