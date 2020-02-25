<template>
  <q-page class="flex flex-center flip-container">
    <!-- <img alt="Quasar logo" src="~assets/quasar-logo-full.svg" /> -->
    <flipbook
      class="flipbook"
      ref="flipbook"
      v-slot="flipbook"
      :pages="imageURLs"
      :pagesHiRes="highResImageURLs"
    >
      <div class="action-bar">
        <left-icon
          class="btn left"
          :class="{ disabled: !flipbook.canFlipLeft }"
          @click="flipbook.flipLeft"
        />
        <plus-icon
          class="btn plus"
          :class="{ disabled: !flipbook.canZoomIn }"
          @click="flipbook.zoomIn"
        />
        <span class="page-num">Page {{ flipbook.page }} of {{ flipbook.numPages }}</span>
        <minus-icon
          class="btn minus"
          :class="{ disabled: !flipbook.canZoomOut }"
          @click="flipbook.zoomOut"
        />
        <right-icon
          class="btn right"
          :class="{ disabled: !flipbook.canFlipRight }"
          @click="flipbook.flipRight"
        />
      </div>
    </flipbook>
  </q-page>
</template>


<script>
import Flipbook from "flipbook-vue";
import LeftIcon from "vue-material-design-icons/ChevronLeftCircle";
import RightIcon from "vue-material-design-icons/ChevronRightCircle";
import PlusIcon from "vue-material-design-icons/PlusCircle";
import MinusIcon from "vue-material-design-icons/MinusCircle";

export default {
  name: "PageIndex",
  components: { Flipbook, LeftIcon, RightIcon, PlusIcon, MinusIcon },
  mounted() {
    var flipbook;
    console.log(this);
    flipbook = this.$refs.flipbook;
    if (!flipbook) {
      return;
    }
    window.addEventListener("keydown", ev => {
      if (ev.keyCode === 37 && flipbook.canFlipLeft) {
        flipbook.flipLeft();
      }
      if (ev.keyCode === 39 && flipbook.canFlipRight) {
        flipbook.flipRight();
      }
    });
  },
  data() {
    let baseUrl = "../statics/images";
    let imageURLs = [null];
    let highResImageURLs = [null];
    for (let i = 0; i < 40; i++) {
      imageURLs.push(`${baseUrl}/${i + 1}.jpg`);
      highResImageURLs.push(`../statics/large-images/${i + 1}.jpg`);
    }
    return {
      imageURLs,
      highResImageURLs
    };
  }
};
</script>

<style>
.flipbook {
  width: 80vw;
  height: 100%;
}

.flip-container {
  background-color: #333;
}

a {
  color: inherit;
}

.q-page-container {
  height: 100vh;
}

.q-page {
  height: 100% !important;
  overflow: hidden;
}

.action-bar {
  width: 100%;
  height: 30px;
  padding: 10px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 7px;
  margin-top: 5px;
  box-sizing: content-box;
}
.action-bar .btn {
  font-size: 30px;
  color: #999;
}
.action-bar .btn svg {
  bottom: 0;
}
.action-bar .btn:not(:first-child) {
  margin-left: 10px;
}
.has-mouse .action-bar .btn:hover {
  color: #ccc;
  filter: drop-shadow(1px 1px 5px #000);
  cursor: pointer;
}
.action-bar .btn:active {
  filter: none !important;
}
.action-bar .btn.disabled {
  color: #666;
  pointer-events: none;
}
.action-bar .page-num {
  font-size: 14px;
  color: white;
  font-weight: bold;
  margin-left: 10px;
}
.flipbook .viewport {
  width: 90vw;
  height: 90vh !important;
}
.flipbook .bounding-box {
  box-shadow: 0 0 20px #000;
}
.credit {
  font-size: 12px;
  line-height: 20px;
  margin: 10px;
}
.material-design-icon__svg {
  transform: scale(1.3);
}
</style>