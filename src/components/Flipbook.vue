<template>
  <div>
    <slot
      v-bind="{
      canFlipLeft,
      canFlipRight,
      canZoomIn,
      canZoomOut,
      page,
      numPages,
      flipLeft,
      flipRight,
      zoomIn,
      zoomOut
    }"
    />
    <div
      class="viewport"
      ref="viewport"
      :class="{
        zoom: zooming || zoom > 1,
        'drag-to-scroll': dragToScroll
      }"
      :style="{ cursor: cursor == 'grabbing' ? 'grabbing' : 'auto' }"
      @touchmove="onTouchMove"
      @pointermove="onPointerMove"
      @mousemove="onMouseMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @mouseup="onMouseUp"
      @wheel="onWheel"
    >
      <div class="container" :style="{ transform: `scale(${zoom})`, }">
        <div
          class="click-to-flip left"
          :style="{ cursor: canFlipLeft ? 'pointer' : 'auto'}"
          @click="flipLeft"
        />
        <div
          class="click-to-flip right"
          :style="{ cursor: canFlipRight ? 'pointer' : 'auto'}"
          @click="flipRight"
        />
        <div :style="{ transform: `translate3d(${centerOffsetSmoothed}px, 0, 0)`}">
          <img
            class="page fixed"
            :style="{
              width: pageWidth + 'px',
              height: pageHeight + 'px',
              left: xMargin + 'px',
              top: yMargin + 'px',
              backgroundColor: 'white'
            }"
            :src="pageUrl(leftPage, true)"
            v-if="showLeftPage"
            @load="didLoadImage($event)"
          />
          <img
            class="page fixed"
            :style="{
              width: pageWidth + 'px',
              height: pageHeight + 'px',
              left: viewWidth / 2 + 'px',
              top: yMargin + 'px',
              backgroundColor: 'white'
            }"
            v-if="showRightPage"
            :src="pageUrl(rightPage, true)"
            @load="didLoadImage($event)"
          />

          <div :style="{ opacity: flip.opacity }">
            <div
              v-for="[
                key,
                bgImage,
                lighting,
                bgPos,
                transform,
                z
              ] in polygonArray"
              class="polygon"
              :key="key"
              :class="{ blank: !bgImage }"
              :style="{
                backgroundColor: 'white',
                backgroundImage: bgImage,
                backgroundSize: polygonBgSize,
                backgroundPosition: bgPos,
                width: polygonWidth,
                height: polygonHeight,
                transform: transform,
                zIndex: z,
              }"
            >
              <div
                class="lighting"
                v-show="lighting.length"
                :style="{ backgroundImage: lighting }"
              />
            </div>
          </div>
          <div
            class="bounding-box"
            :style="{
              left: boundingLeft + 'px',
              top: yMargin + 'px',
              width: boundingRight - boundingLeft + 'px',
              height: pageHeight + 'px',
              cursor: cursor
            }"
            @touchstart="onTouchStart"
            @pointerdown="onPointerDown"
            @mousedown="onMouseDown"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="coffee">
import Matrix from './matrix'

const easeIn = x => Math.pow(x, 2);
const easeOut = x => 1 - easeIn(1 - x);
const easeInOut = function(x) {
  if (x < 0.5) { return easeIn(x * 2) / 2; } else { return 0.5 + (easeOut((x - 0.5) * 2) / 2); }
};

const IE = /Trident/.test(navigator.userAgent);

export default
  {
    props: {
      pages: {
        type: Array,
        required: true
      },
      pagesHiRes: {
        type: Array,
        default() { return []; }
      },
      flipDuration: {
        type: Number,
        default: 1000
      },
      zoomDuration: {
        type: Number,
        default: 500
      },
      zooms: {
        type: Array,
        default() { return [1, 2, 4]; }
      },
      perspective: {
        type: Number,
        default: 2400
      },
      nPolygons: {
        type: Number,
        default: 10
      },
      ambient: {
        type: Number,
        default: 0.4
      },
      gloss: {
        type: Number,
        default: 0.6
      },
      swipeMin: {
        type: Number,
        default: 3
      },
      singlePage: {
        type: Boolean,
        default: false
      },
      forwardDirection: {
        validator(val) { return (val === 'right') || (val === 'left'); },
        default: 'right'
      },
      centering: {
        type: Boolean,
        default: true
      },
      startPage: {
        type: Number,
        default: null
      }
    },

    data() {
      return {
        viewWidth: 0,
        viewHeight: 0,
        imageWidth: null,
        imageHeight: null,
        displayedPages: 1,
        nImageLoad: 0,
        nImageLoadTrigger: 0,
        imageLoadCallback: null,
        currentPage: 0,
        firstPage: 0,
        secondPage: 1,
        zoomIndex: 0,
        zoom: 1,
        zooming: false,
        touchStartX: null,
        touchStartY: null,
        maxMove: 0,
        activeCursor: null,
        hasTouchEvents: false,
        hasPointerEvents: false,
        minX: Infinity,
        maxX: -Infinity,
        preloadedImages: {},
        flip: {
          progress: 0,
          direction: null,
          frontImage: null,
          backImage: null,
          auto: false,
          opacity: 1
        },
        currentCenterOffset: null,
        animatingCenter: false,
        startScrollLeft: 0,
        startScrollTop: 0,
        scrollLeft: 0,
        scrollTop: 0
      };
    },

    computed: {
      canFlipLeft() {
        if (this.forwardDirection === 'left') { return this.canGoForward; } else { return this.canGoBack; }
      },
      canFlipRight() {
        if (this.forwardDirection === 'right') { return this.canGoForward; } else { return this.canGoBack; }
      },
      canZoomIn() { return !this.zooming && (this.zoomIndex < (this.zooms_.length - 1)); },
      canZoomOut() { return !this.zooming && (this.zoomIndex > 0); },
      numPages() { if (this.pages[0] === null) { return this.pages.length - 1; } else { return this.pages.length; } },
      page() {
        if (this.pages[0] !== null) {
          return this.currentPage + 1;
        } else {
          return Math.max(1, this.currentPage);
        }
      },

      zooms_() { return this.zooms || [1]; },

      canGoForward() {
        return !this.flip.direction && (this.currentPage < (this.pages.length - this.displayedPages));
      },
      canGoBack() {
        return !this.flip.direction && (this.currentPage >= this.displayedPages) &&
          !((this.displayedPages === 1) && !this.pageUrl(this.firstPage - 1));
      },
      leftPage() {
        if ((this.forwardDirection === 'right') || (this.displayedPages === 1)) {
          return this.firstPage;
        } else {
          return this.secondPage;
        }
      },
      rightPage() {
        if (this.forwardDirection === 'left') { return this.firstPage; } else { return this.secondPage; }
      },
      showLeftPage() {
        return this.pageUrl(this.leftPage);
      },
      showRightPage() {
        return this.pageUrl(this.rightPage) && (this.displayedPages === 2);
      },

      cursor() {
        if (this.activeCursor) {
          return this.activeCursor;
        } else if (IE) {
          return 'auto';
        } else if (this.canZoomIn) {
          return 'zoom-in';
        } else if (this.canZoomOut) {
          return 'zoom-out';
        } else {
          return 'grab';
        }
      },

      pageScale() {
        const vw = this.viewWidth / this.displayedPages;
        const xScale = vw / this.imageWidth;
        const yScale = this.viewHeight / this.imageHeight;
        const scale = xScale < yScale ? xScale : yScale;
        if (scale < 1) { return scale; } else { return 1; }
      },
      pageWidth() { return Math.round(this.imageWidth * this.pageScale); },
      pageHeight() { return Math.round(this.imageHeight * this.pageScale); },
      xMargin() { return (this.viewWidth - (this.pageWidth * this.displayedPages)) / 2; },
      yMargin() { return (this.viewHeight - this.pageHeight) / 2; },
      polygonWidth() {
        let w = this.pageWidth / this.nPolygons;
        w = Math.ceil(w + (1 / this.zoom));
        return w + 'px';
      },
      polygonHeight() { return this.pageHeight + 'px'; },
      polygonBgSize() { return `${this.pageWidth}px ${this.pageHeight}px`; },
      polygonArray() {
        return this.makePolygonArray('front').concat(this.makePolygonArray('back'));
      },
      boundingLeft() {
        if (this.displayedPages === 1) {
          return this.xMargin;
        } else {
          const x =
            this.pageUrl(this.leftPage) ?
              this.xMargin
            :
              this.viewWidth / 2;
          if (x < this.minX) { return x; } else { return this.minX; }
        }
      },
      boundingRight() {
        if (this.displayedPages === 1) {
          return this.viewWidth - this.xMargin;
        } else {
          const x =
            this.pageUrl(this.rightPage) ?
              this.viewWidth - this.xMargin
            :
              this.viewWidth / 2;
          if (x > this.maxX) { return x; } else { return this.maxX; }
        }
      },
      centerOffset() {
        const retval =
          this.centering ?
            Math.round((this.viewWidth / 2) - ((this.boundingLeft + this.boundingRight) / 2))
          :
            0;
        if ((this.currentCenterOffset === null) && (this.imageWidth !== null)) {
          this.currentCenterOffset = retval;
        }
        return retval;
      },

      centerOffsetSmoothed() { return Math.round(this.currentCenterOffset); },

      dragToScroll() { return !this.hasTouchEvents; },

      scrollLeftMin() {
        const w = (this.boundingRight - this.boundingLeft) * this.zoom;
        if (w < this.viewWidth) {
          return ((this.boundingLeft + this.centerOffsetSmoothed) * this.zoom) - ((this.viewWidth - w) / 2);
        } else {
          return (this.boundingLeft + this.centerOffsetSmoothed) * this.zoom;
        }
      },

      scrollLeftMax() {
        const w = (this.boundingRight - this.boundingLeft) * this.zoom;
        if (w < this.viewWidth) {
          return ((this.boundingLeft + this.centerOffsetSmoothed) * this.zoom) - ((this.viewWidth - w) / 2);
        } else {
          return ((this.boundingRight + this.centerOffsetSmoothed)* this.zoom) - this.viewWidth;
        }
      },

      scrollTopMin() {
        const h = this.pageHeight * this.zoom;
        if (h < this.viewHeight) {
          return (this.yMargin * this.zoom) - ((this.viewHeight - h) / 2);
        } else {
          return this.yMargin * this.zoom;
        }
      },

      scrollTopMax() {
        const h = this.pageHeight * this.zoom;
        if (h < this.viewHeight) {
          return (this.yMargin * this.zoom) - ((this.viewHeight - h) / 2);
        } else {
          return ((this.yMargin + this.pageHeight) * this.zoom) - this.viewHeight;
        }
      },

      scrollLeftLimited() {
        return Math.min(this.scrollLeftMax, Math.max(this.scrollLeftMin, this.scrollLeft));
      },

      scrollTopLimited() {
        return Math.min(this.scrollTopMax, Math.max(this.scrollTopMin, this.scrollTop));
      }
    },

    mounted() {
      window.addEventListener('resize',  this.onResize, {passive: true});
      this.onResize();
      this.preloadImages();
      this.zoom = this.zooms_[0];
      return this.goToPage(this.startPage);
    },

    beforeDestroy() {
      return window.removeEventListener('resize',  this.onResize, {passive: true});
    },

    methods: {
      onResize() {
        const {
          viewport
        } = this.$refs;
        if (!viewport) { return; }
        this.viewWidth = viewport.clientWidth;
        this.viewHeight = viewport.clientHeight;
        this.displayedPages =
          (this.viewWidth > this.viewHeight) && !this.singlePage ? 2 : 1;
        if (this.displayedPages === 2) { this.currentPage &= ~1; }
        this.fixFirstPage();
        this.minX = Infinity;
        return this.maxX = -Infinity;
      },

      fixFirstPage() {
        if ((this.displayedPages === 1) &&
          (this.currentPage === 0) &&
          this.pages.length &&
          !this.pageUrl(0)) { return this.currentPage++; }
      },

      pageUrl(page, hiRes) {
        if (hiRes == null) { hiRes = false; }
        if (hiRes && (this.zoom > 1) && !this.zooming) {
          const url = this.pagesHiRes[page];
          if (url) { return url; }
        }
        return this.pages[page] || null;
      },

      flipLeft() {
        if (!this.canFlipLeft) { return; }
        return this.flipStart('left', true);
      },

      flipRight() {
        if (!this.canFlipRight) { return; }
        return this.flipStart('right', true);
      },

      makePolygonArray(face) {
        let theta;
        if (!this.flip.direction) { return []; }

        let {
          progress
        } = this.flip;
        let {
          direction
        } = this.flip;

        if ((this.displayedPages === 1) && (direction !== this.forwardDirection)) {
          progress = 1 - progress;
          direction = this.forwardDirection;
        }

        this.flip.opacity =
          (this.displayedPages === 1) && (progress > .7) ?
            1 - ((progress - .7) / .3)
          :
            1;

        const image = face === 'front' ? this.flip.frontImage : this.flip.backImage;
        const bgImg = image && `url('${image}')`;

        const polygonWidth = this.pageWidth / this.nPolygons;

        let pageX = this.xMargin;
        let originRight = false;
        if (this.displayedPages === 1) {
          if (this.forwardDirection === 'right') {
            if (face === 'back') {
              originRight = true;
              pageX = this.xMargin - this.pageWidth;
            }
          } else {
            if (direction === 'left') {
              if (face === 'back') {
                pageX = this.pageWidth - this.xMargin;
              } else {
                originRight = true;
              }
            } else {
              if (face === 'front') {
                pageX = this.pageWidth - this.xMargin;
              } else {
                originRight = true;
              }
            }
          }
        } else {
          if (direction === 'left') {
            if (face === 'back') {
              pageX = this.viewWidth / 2;
            } else {
              originRight = true;
            }
          } else {
            if (face === 'front') {
              pageX = this.viewWidth / 2;
            } else {
              originRight = true;
            }
          }
        }

        const pageMatrix = new Matrix;
        pageMatrix.translate(this.viewWidth / 2);
        pageMatrix.perspective(this.perspective);
        pageMatrix.translate(-this.viewWidth / 2);
        pageMatrix.translate(pageX, this.yMargin);

        let pageRotation = 0;
        if (progress > 0.5) {
          pageRotation = -(progress - 0.5) * 2 * 180;
        }
        if (direction === 'left') {
          pageRotation = -pageRotation;
        }
        if (face === 'back') { pageRotation += 180; }

        if (pageRotation) {
          if (originRight) { pageMatrix.translate(this.pageWidth); }
          pageMatrix.rotateY(pageRotation);
          if (originRight) { pageMatrix.translate(-this.pageWidth); }
        }

        if (progress < 0.5) {
          theta = progress * 2 * Math.PI;
        } else {
          theta = (1 - ((progress - 0.5) * 2)) * Math.PI;
        }
        if (theta === 0) {
          theta = 1e-9;
        }
        const radius = this.pageWidth / theta;

        let radian = 0;
        const dRadian = theta / this.nPolygons;
        let rotate = (dRadian / 2 / Math.PI) * 180;
        let dRotate = (dRadian / Math.PI) * 180;

        if (originRight) {
          rotate = ((-theta / Math.PI) * 180) + (dRotate / 2);
        }

        if (face === 'back') {
          rotate = -rotate;
          dRotate = -dRotate;
        }

        this.minX = Infinity;
        this.maxX = -Infinity;
        return (() => {
          const result = [];
          for (let i = 0, end = this.nPolygons, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
            const bgPos = `${(i / (this.nPolygons - 1)) * 100}% 0px`;

            const m = pageMatrix.clone();
            const rad = originRight ? theta - radian : radian;
            let x = Math.sin(rad) * radius;
            if (originRight) { x = this.pageWidth - x; }
            let z = (1 - Math.cos(rad)) * radius;
            if (face === 'back') { z = -z; }

            m.translate3d(x, 0, z);
            m.rotateY(-rotate);
            m.backgroundColor = 'white';

            const x0 = m.transformX(0);
            const x1 = m.transformX(polygonWidth);
            this.maxX = Math.max(Math.max(x0, x1), this.maxX);
            this.minX = Math.min(Math.min(x0, x1), this.minX);

            const lighting = this.computeLighting(pageRotation - rotate, dRotate);

            radian += dRadian;
            rotate += dRotate;
            result.push([face+i, bgImg, lighting, bgPos, m.toString(), Math.abs(Math.round(z))]);
          }
          return result;
        })();
      },

      computeLighting(rot, dRotate) {
        const gradients = [];
        const lightingPoints = [-0.5, -0.25, 0, 0.25, 0.5];
        if (this.ambient < 1) {
          const blackness = 1 - this.ambient;
          const diffuse = lightingPoints.map(d => {
            return (1 - Math.cos(((rot - (dRotate * d)) / 180) * Math.PI)) * blackness;
          });
          gradients.push(`\
linear-gradient(to right,
    rgba(0, 0, 0, ${diffuse[0]}),
    rgba(0, 0, 0, ${diffuse[1]}) 25%,
    rgba(0, 0, 0, ${diffuse[2]}) 50%,
    rgba(0, 0, 0, ${diffuse[3]}) 75%,
    rgba(0, 0, 0, ${diffuse[4]}))\
`
          );
        }

        if ((this.gloss > 0) && !IE) {
          const DEG = 30;
          const POW = 200;
          const specular = lightingPoints.map(d => {
            return Math.max(
              Math.pow(Math.cos((((rot + DEG) - (dRotate * d)) / 180) * Math.PI), POW),
              Math.pow(Math.cos(((rot - DEG - (dRotate * d)) / 180) * Math.PI), POW)
            );
          });
          gradients.push(`\
linear-gradient(to right,
    rgba(255, 255, 255, ${specular[0] * this.gloss}),
    rgba(255, 255, 255, ${specular[1] * this.gloss}) 25%,
    rgba(255, 255, 255, ${specular[2] * this.gloss}) 50%,
    rgba(255, 255, 255, ${specular[3] * this.gloss}) 75%,
    rgba(255, 255, 255, ${specular[4] * this.gloss}))\
`
          );
        }
        return gradients.join(',');
      },

      flipStart(direction, auto) {
        if (direction !== this.forwardDirection) {
          if (this.displayedPages === 1) {
            this.flip.frontImage = this.pageUrl(this.currentPage - 1);
            this.flip.backImage = null;
          } else {
            this.flip.frontImage = this.pageUrl(this.firstPage);
            this.flip.backImage = this.pageUrl((this.currentPage - this.displayedPages) + 1);
          }
        } else {
          if (this.displayedPages === 1) {
            this.flip.frontImage = this.pageUrl(this.currentPage);
            this.flip.backImage = null;
          } else {
            this.flip.frontImage = this.pageUrl(this.secondPage);
            this.flip.backImage = this.pageUrl(this.currentPage + this.displayedPages);
          }
        }

        this.flip.direction = direction;
        this.flip.progress = 0;
        return requestAnimationFrame(() => { return requestAnimationFrame(() => {
          if (this.flip.direction !== this.forwardDirection) {
            if (this.displayedPages === 2) {
              this.firstPage = this.currentPage - this.displayedPages;
            }
          } else {
            if (this.displayedPages === 1) {
              this.firstPage = this.currentPage + this.displayedPages;
            } else {
              this.secondPage = this.currentPage + 1 + this.displayedPages;
            }
          }
          if (auto) { return this.flipAuto(true); }
        });
         });
      },

      flipAuto(ease) {
        const t0 = Date.now();
        const duration = this.flipDuration * (1 - this.flip.progress);
        const startRatio = this.flip.progress;
        this.flip.auto = true;
        this.$emit(`flip-${this.flip.direction}-start`, this.page);
        var animate = () => { return requestAnimationFrame(() => {
          const t = Date.now() - t0;
          let ratio = startRatio + (t / duration);
          if (ratio > 1) { ratio = 1; }
          this.flip.progress = ease ? easeInOut(ratio) : ratio;
          if (ratio < 1) {
            return animate();
          } else {
            if (this.flip.direction !== this.forwardDirection) {
              this.currentPage -= this.displayedPages;
            } else {
              this.currentPage += this.displayedPages;
            }
            this.$emit(`flip-${this.flip.direction}-end`, this.page);
            if ((this.displayedPages === 1) && (this.flip.direction === this.forwardDirection)) {
              this.flip.direction = null;
            } else {
              this.onImageLoad(1, () => { return this.flip.direction = null; });
            }
            return this.flip.auto = false;
          }
        }); };
        return animate();
      },

      flipRevert() {
        const t0 = Date.now();
        const duration = this.flipDuration * this.flip.progress;
        const startRatio = this.flip.progress;
        this.flip.auto = true;
        var animate = () => { return requestAnimationFrame(() => {
          const t = Date.now() - t0;
          let ratio = startRatio - ((startRatio * t) / duration);
          if (ratio < 0) { ratio = 0; }
          this.flip.progress = ratio;
          if (ratio > 0) {
            return animate();
          } else {
            this.firstPage = this.currentPage;
            this.secondPage = this.currentPage + 1;
            if ((this.displayedPages === 1) && (this.flip.direction !== this.forwardDirection)) {
              this.flip.direction = null;
            } else {
              this.onImageLoad(1, () => { return this.flip.direction = null; });
            }
            return this.flip.auto = false;
          }
        }); };
        return animate();
      },

      onImageLoad(trigger, cb) {
        this.nImageLoad = 0;
        this.nImageLoadTrigger = trigger;
        return this.imageLoadCallback = cb;
      },

      didLoadImage(ev) {
        if (this.imageWidth === null) {
          this.imageWidth = (ev.target || ev.path[0]).naturalWidth;
          this.imageHeight = (ev.target || ev.path[0]).naturalHeight;
        }
        if (!this.imageLoadCallback) { return; }
        if (++this.nImageLoad >= this.nImageLoadTrigger) {
          this.imageLoadCallback();
          return this.imageLoadCallback = null;
        }
      },

      zoomIn() {
        if (!this.canZoomIn) { return; }
        this.zoomIndex += 1;
        return this.zoomTo(this.zooms_[this.zoomIndex]);
      },

      zoomOut() {
        if (!this.canZoomOut) { return; }
        this.zoomIndex -= 1;
        return this.zoomTo(this.zooms_[this.zoomIndex]);
      },

      zoomTo(zoom, fixedX, fixedY) {
        const start = this.zoom;
        const end = zoom;
        const {
          viewport
        } = this.$refs;
        const startX = viewport.scrollLeft;
        const startY = viewport.scrollTop;
        if (!fixedX) { fixedX = viewport.clientWidth / 2; }
        if (!fixedY) { fixedY = viewport.clientHeight / 2; }
        const containerFixedX = fixedX + startX;
        const containerFixedY = fixedY + startY;
        const endX = ((containerFixedX / start) * end) - fixedX;
        const endY = ((containerFixedY / start) * end) - fixedY;

        const t0 = Date.now();
        this.zooming = true;
        this.$emit('zoom-start', zoom);
        var animate = () => { return requestAnimationFrame(() => {
          const t = Date.now() - t0;
          let ratio = t / this.zoomDuration;
          if ((ratio > 1) || IE) { ratio = 1; }
          ratio = easeInOut(ratio);
          this.zoom = start + ((end - start) * ratio);
          this.scrollLeft = startX + ((endX - startX) * ratio);
          this.scrollTop = startY + ((endY - startY) * ratio);
          if (t < this.zoomDuration) {
            return animate();
          } else {
            this.$emit('zoom-end', zoom);
            this.zooming = false;
            this.zoom = zoom;
            this.scrollLeft = endX;
            return this.scrollTop = endY;
          }
        }); };
        animate();
        if (end > 1) {
          return this.preloadImages(true);
        }
      },

      zoomAt(touch) {
        const rect = this.$refs.viewport.getBoundingClientRect();
        const x = touch.pageX - rect.left;
        const y = touch.pageY - rect.top;
        this.zoomIndex = (this.zoomIndex + 1) % this.zooms_.length;
        return this.zoomTo(this.zooms_[this.zoomIndex], x, y);
      },

      swipeStart(touch) {
        this.touchStartX = touch.pageX;
        this.touchStartY = touch.pageY;
        this.maxMove = 0;
        if (this.zoom <= 1) {
          return this.activeCursor = 'grab';
        } else {
          this.startScrollLeft = this.$refs.viewport.scrollLeft;
          this.startScrollTop = this.$refs.viewport.scrollTop;
          return this.activeCursor = 'all-scroll';
        }
      },

      swipeMove(touch) {
        if (this.touchStartX == null) { return; }
        const x = touch.pageX - this.touchStartX;
        const y = touch.pageY - this.touchStartY;
        this.maxMove = Math.max(this.maxMove, Math.abs(x));
        this.maxMove = Math.max(this.maxMove, Math.abs(y));
        if (this.zoom > 1) {
          if (this.dragToScroll) { this.dragScroll(x, y); }
          return;
        }
        if (Math.abs(y) > Math.abs(x)) { return; }
        this.activeCursor = 'grabbing';
        if (x > 0) {
          if ((this.flip.direction === null) && this.canFlipLeft && (x >= this.swipeMin)) {
            this.flipStart('left', false);
          }
          if (this.flip.direction === 'left') {
            this.flip.progress = x / this.pageWidth;
            if (this.flip.progress > 1) { this.flip.progress = 1; }
          }
        } else {
          if ((this.flip.direction === null) && this.canFlipRight && (x <= -this.swipeMin)) {
            this.flipStart('right', false);
          }
          if (this.flip.direction === 'right') {
            this.flip.progress = -x / this.pageWidth;
            if (this.flip.progress > 1) { this.flip.progress = 1; }
          }
        }
        return true;
      },

      swipeEnd(touch) {
        if (this.touchStartX == null) { return; }
        if (this.maxMove < this.swipeMin) { this.zoomAt(touch); }
        if ((this.flip.direction !== null) && !this.flip.auto) {
          if (this.flip.progress > (1/4)) {
            this.flipAuto(false);
          } else {
            this.flipRevert();
          }
        }
        this.touchStartX = null;
        return this.activeCursor = null;
      },

      onTouchStart(ev) {
        this.hasTouchEvents = true;
        return this.swipeStart(ev.changedTouches[0]);
      },
      onTouchMove(ev) {
        if (this.swipeMove(ev.changedTouches[0])) {
          if (ev.cancelable) { return ev.preventDefault(); }
        }
      },
      onTouchEnd(ev) { return this.swipeEnd(ev.changedTouches[0]); },

      onPointerDown(ev) {
        this.hasPointerEvents = true;
        if (this.hasTouchEvents) { return; }
        if (ev.which && (ev.which !== 1)) { return; } // Ignore right-click
        this.swipeStart(ev);
        try {
          return ev.target.setPointerCapture(ev.pointerId);
        } catch (error) {}
      },

      onPointerMove(ev) { if (!this.hasTouchEvents) { return this.swipeMove(ev); } },

      onPointerUp(ev) {
        if (this.hasTouchEvents) { return; }
        this.swipeEnd(ev);
        try {
          return ev.target.releasePointerCapture(ev.pointerId);
        } catch (error) {}
      },

      onMouseDown(ev) {
        if (this.hasTouchEvents || this.hasPointerEvents) { return; }
        if (ev.which && (ev.which !== 1)) { return; } // Ignore right-click
        return this.swipeStart(ev);
      },
      onMouseMove(ev) {
        if (!this.hasTouchEvents && !this.hasPointerEvents) { return this.swipeMove(ev); }
      },
      onMouseUp(ev) {
        if (!this.hasTouchEvents && !this.hasPointerEvents) { return this.swipeEnd(ev); }
      },

      dragScroll(x, y) {
        this.scrollLeft = this.startScrollLeft - x;
        return this.scrollTop = this.startScrollTop - y;
      },

      onWheel(ev) {
        if ((this.zoom > 1) && this.dragToScroll) {
          this.scrollLeft = this.$refs.viewport.scrollLeft + ev.deltaX;
          this.scrollTop = this.$refs.viewport.scrollTop + ev.deltaY;
          if (ev.cancelable) { return ev.preventDefault(); }
        }
      },

      preloadImages(hiRes) {
        let asc, end, start;
        let i, img, url;
        if (hiRes == null) { hiRes = false; }
        if (Object.keys(this.preloadedImages).length >= 10) {
          this.preloadedImages = {};
        }
        for (start = this.currentPage - 3, i = start, end = this.currentPage + 7, asc = start <= end; asc ? i <= end : i >= end; asc ? i++ : i--) {
          url = this.pageUrl(i);
          if (url) {
            if (!this.preloadedImages[url]) {
              img = new Image();
              img.src = url;
              this.preloadedImages[url] = img;
            }
          }
        }
        if (hiRes) {
          let asc1, end1;
          for (i = this.currentPage, end1 = this.currentPage + this.displayedPages, asc1 = this.currentPage <= end1; asc1 ? i < end1 : i > end1; asc1 ? i++ : i--) {
            url = this.pagesHiRes[i];
            if (url) {
              if (!this.preloadedImages[url]) {
                img = new Image();
                img.src = url;
                this.preloadedImages[url] = img;
              }
            }
          }
        }
      },

      goToPage(p) {
        if ((p === null) || (p === this.page)) { return; }
        if (this.pages[0] === null) {
          if ((this.displayedPages === 2) && (p === 1)) {
            this.currentPage = 0;
          } else {
            this.currentPage = p;
          }
        } else {
          this.currentPage = p - 1;
        }
        this.minX = Infinity;
        return this.maxX = -Infinity;
      }
    },

    watch: {
      currentPage() {
        this.firstPage = this.currentPage;
        this.secondPage = this.currentPage + 1;
        return this.preloadImages();
      },

      centerOffset() {
        if (this.animatingCenter) { return; }
        var animate = () => { return requestAnimationFrame(() => {
          const rate = 0.1;
          const diff = this.centerOffset - this.currentCenterOffset;
          if (Math.abs(diff) < 0.5) {
            this.currentCenterOffset = this.centerOffset;
            return this.animatingCenter = false;
          } else {
            this.currentCenterOffset += diff * rate;
            return animate();
          }
        }); };
        this.animatingCenter = true;
        return animate();
      },

      scrollLeftLimited(val) {
        if (IE) {
          return requestAnimationFrame(() => { return this.$refs.viewport.scrollLeft = val; });
        } else {
          return this.$refs.viewport.scrollLeft = val;
        }
      },

      scrollTopLimited(val) {
        if (IE) {
          return requestAnimationFrame(() => { return this.$refs.viewport.scrollTop = val; });
        } else {
          return this.$refs.viewport.scrollTop = val;
        }
      },

      pages(after, before) {
        this.fixFirstPage();
        if (!(before != null ? before.length : undefined) && (after != null ? after.length : undefined)) {
          if ((this.startPage > 1) && (after[0] === null)) {
            return this.currentPage++;
          }
        }
      },

      startPage(p) { return this.goToPage(p); }
    }
  };
</script>

<style scoped>
.viewport {
  -webkit-overflow-scrolling: touch;
  width: 100%;
  height: 100%;
}

.viewport.zoom {
  overflow: scroll;
}

.viewport.zoom.drag-to-scroll {
  overflow: hidden;
}

.container {
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: top left;
  user-select: none;
}

.click-to-flip {
  position: absolute;
  width: 50%;
  height: 100%;
  top: 0;
  user-select: none;
}

.click-to-flip.left {
  left: 0;
}

.click-to-flip.right {
  right: 0;
}

.bounding-box {
  position: absolute;
  user-select: none;
}

.page {
  position: absolute;
  backface-visibility: hidden;
}

.polygon {
  position: absolute;
  top: 0;
  left: 0;
  background-repeat: no-repeat;
  backface-visibility: hidden;
  transform-origin: center left;
}

.polygon.blank {
  background-color: #ddd;
}

.polygon .lighting {
  width: 100%;
  height: 100%;
}
</style>
